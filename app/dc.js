/* Karta concept runtime: renders a page template with {{holes}}, <sc-if> and <sc-for>, bound to a DCLogic component. */
(function () {
  var HOLE = /\{\{\s*([^}]*?)\s*\}\}/g;
  var EVENTS = { onclick: 'click', onchange: 'input', onkeydown: 'keydown', onmouseenter: 'mouseenter', onmouseleave: 'mouseleave', oninput: 'input' };

  function lookup(expr, scope) {
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return +expr;
    var parts = expr.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function interp(str, scope) {
    return str.replace(HOLE, function (_, e) { var v = lookup(e, scope); return v == null || v === false ? '' : String(v); });
  }
  function single(str) { var m = /^\s*\{\{\s*([^}]*?)\s*\}\}\s*$/.exec(str); return m ? m[1] : null; }
  function hasHole(str) { return str.indexOf('{{') > -1; }

  // mark template nodes that never change, so they render once and are reused
  function markStatic(node) {
    var dyn = false;
    if (node.nodeType === 3) dyn = hasHole(node.nodeValue);
    else if (node.nodeType === 1) {
      var tag = node.localName;
      if (tag === 'sc-if' || tag === 'sc-for') dyn = true;
      for (var i = 0; i < node.attributes.length; i++) if (hasHole(node.attributes[i].value)) dyn = true;
      for (var c = node.firstChild; c; c = c.nextSibling) if (!markStatic(c)) dyn = true;
    }
    node.__static = !dyn;
    return node.__static;
  }

  function renderChildren(src, out, scope, inLoop) {
    for (var c = src.firstChild; c; c = c.nextSibling) renderNode(c, out, scope, inLoop);
  }
  function renderNode(n, out, scope, inLoop) {
    if (n.nodeType === 3) { out.appendChild(document.createTextNode(hasHole(n.nodeValue) ? interp(n.nodeValue, scope) : n.nodeValue)); return; }
    if (n.nodeType !== 1) return;
    if (n.__static) {
      if (!inLoop) { if (!n.__cache) n.__cache = document.importNode(n, true); out.appendChild(n.__cache); }
      else out.appendChild(document.importNode(n, true));
      return;
    }
    var tag = n.localName;
    if (tag === 'sc-if') {
      var e = single(n.getAttribute('value') || '');
      if (e != null && lookup(e, scope)) renderChildren(n, out, scope, inLoop);
      return;
    }
    if (tag === 'sc-for') {
      var list = lookup(single(n.getAttribute('list') || '') || '', scope) || [], as = n.getAttribute('as') || 'item';
      for (var i = 0; i < list.length; i++) {
        var sub = Object.create(scope); sub[as] = list[i]; sub.index = i;
        renderChildren(n, out, sub, true);
      }
      return;
    }
    // build the element empty and set attributes one by one, so a raw "{{hole}}" never reaches an SVG attribute parser
    var el = document.createElementNS(n.namespaceURI, n.localName);
    for (var k = 0; k < n.attributes.length; k++) {
      var a = n.attributes[k], name = a.name, val = a.value;
      if (name === 'hint-placeholder-val' || name === 'hint-placeholder-count') continue;
      if (EVENTS[name.toLowerCase()]) {
        var fn = lookup(single(val) || '', scope);
        if (typeof fn === 'function') el.addEventListener(EVENTS[name.toLowerCase()], fn);
        continue;
      }
      if (!hasHole(val)) { if (a.namespaceURI) el.setAttributeNS(a.namespaceURI, name, val); else el.setAttribute(name, val); continue; }
      var one = single(val);
      if (one != null) {
        var v = lookup(one, scope);
        if (v == null || v === false) el.removeAttribute(name);
        else el.setAttribute(name, v === true ? '' : String(v));
        if (name === 'value' && 'value' in el) el.value = v == null ? '' : String(v);
      } else el.setAttribute(name, interp(val, scope));
    }
    renderChildren(n, el, scope, inLoop);
    out.appendChild(el);
  }

  function pathOf(el, root) {
    var p = [];
    // nodes added after render (app.js chrome, marked __inj) do not count, so a path stays valid across renders
    while (el && el !== root) { var i = 0, s = el; while ((s = s.previousSibling)) if (!s.__inj) i++; p.unshift(i); el = el.parentNode; }
    return el === root ? p : null;
  }
  function atPath(root, p) {
    var el = root;
    for (var i = 0; i < p.length && el; i++) { var c = el.firstChild, k = p[i]; while (c && (c.__inj || k-- > 0)) c = c.nextSibling; el = c; }
    return el;
  }

  function DCLogic() { this.state = {}; }
  DCLogic.prototype.setState = function (patch) {
    var changed = false, st = this.state || {};
    for (var k in patch) if (st[k] !== patch[k]) changed = true;
    this.state = Object.assign({}, st, patch);
    if (changed && this.__render) this.__render();
  };

  function mount(Component, root, tpl) {
    markStatic(tpl.content);
    var comp = new Component();
    comp.state = comp.state || {};
    var scheduled = false;
    function draw() {
      scheduled = false;
      var active = document.activeElement, keep = active && active.__inj ? active : null, path = !keep && root.contains(active) ? pathOf(active, root) : null;
      var selS = active && 'selectionStart' in active ? active.selectionStart : null;
      var frag = document.createDocumentFragment();
      renderChildren(tpl.content, frag, comp.renderVals() || {}, false);
      root.replaceChildren(frag);
      if (window.KartaApp && window.KartaApp.afterRender) window.KartaApp.afterRender(root);
      if (path) {
        var el = atPath(root, path);
        if (el && el.focus) { el.focus({ preventScroll: true }); if (selS != null && el.setSelectionRange) try { el.setSelectionRange(selS, selS); } catch (e) {} }
      }
      if (keep && keep.isConnected) keep.focus({ preventScroll: true });
    }
    comp.__render = function () { if (!scheduled) { scheduled = true; requestAnimationFrame(draw); } };
    draw();
    if (comp.componentDidMount) comp.componentDidMount();
    window.addEventListener('pagehide', function () { if (comp.componentWillUnmount) comp.componentWillUnmount(); });
    return comp;
  }

  window.DCLogic = DCLogic;
  window.KartaDC = { mount: mount };
})();
