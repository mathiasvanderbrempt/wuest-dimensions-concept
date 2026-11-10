/* Karta concept app: chart interactions. Hover on bars, ranked lines and points dims the rest and shows a tooltip;
   line series get a crosshair that follows the pointer; scatter points report both axes.
   Values are read back from each chart's own gridline labels, so they match what the chart shows. */
(function () {
  var tip = null;
  function tooltip() {
    if (!tip) { tip = document.createElement('div'); tip.className = 'ka-tip'; tip.setAttribute('role', 'status'); tip.setAttribute('aria-live', 'polite'); document.body.appendChild(tip); }
    return tip;
  }
  function show(html, x, y) {
    var t = tooltip(); t.innerHTML = html; t.classList.add('on');
    var w = t.offsetWidth, vw = document.documentElement.clientWidth;
    t.style.left = Math.max(8 + w / 2, Math.min(vw - 8 - w / 2, x)) + 'px';
    t.style.top = (y + window.scrollY) + 'px';
  }
  function hide() { if (tip) tip.classList.remove('on'); }

  function num(s) {
    s = String(s).trim().replace(/[’'’,\s]/g, '').replace('−', '-').replace(/^CHF/, '');
    var m = /^(-?\d+(?:\.\d+)?)(.*)$/.exec(s);
    return m ? { v: parseFloat(m[1]), unit: m[2], dec: (m[1].split('.')[1] || '').length } : null;
  }
  function fmt(v, dec) {
    var s = Math.abs(v).toFixed(dec), p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '’');
    return (v < 0 ? '−' : '') + p.join('.');
  }
  function attr(el, a) { return parseFloat(el.getAttribute(a)); }
  function inDefs(el) { return !!el.closest('defs, pattern, mask, clipPath'); }

  // value scale from numeric gridline labels: text sitting on a horizontal line
  function yScale(svg) {
    var lines = [].filter.call(svg.querySelectorAll('line'), function (l) {
      return !inDefs(l) && attr(l, 'y1') === attr(l, 'y2') && Math.abs(attr(l, 'x2') - attr(l, 'x1')) > 40;
    }).map(function (l) { return attr(l, 'y1'); });
    var anchors = [];
    [].forEach.call(svg.querySelectorAll('text'), function (t) {
      var n = num(t.textContent); if (!n || inDefs(t)) return;
      var ty = attr(t, 'y'), best = null;
      lines.forEach(function (y) { if (Math.abs(y - ty) < 9 && (best == null || Math.abs(y - ty) < Math.abs(best - ty))) best = y; });
      if (best != null && !anchors.some(function (a) { return a.y === best; })) anchors.push({ y: best, v: n.v, unit: n.unit, dec: n.dec });
    });
    if (anchors.length < 2) return null;
    anchors.sort(function (a, b) { return a.y - b.y; });
    var a = anchors[0], b = anchors[anchors.length - 1];
    var range = Math.abs(a.v - b.v), dec = Math.max.apply(null, anchors.map(function (x) { return x.dec; })) + (range < 100 ? 1 : 0);
    return { f: function (y) { return a.v + (y - a.y) * (b.v - a.v) / (b.y - a.y); }, unit: (b.unit || a.unit || '').trim(), dec: dec };
  }
  // x scale for scatter charts: numeric labels along the bottom
  function xScale(svg) {
    var texts = [].filter.call(svg.querySelectorAll('text'), function (t) { return num(t.textContent) && !inDefs(t); });
    if (!texts.length) return null;
    var maxY = Math.max.apply(null, texts.map(function (t) { return attr(t, 'y'); }));
    var row = texts.filter(function (t) { return Math.abs(attr(t, 'y') - maxY) < 2 && t.getAttribute('text-anchor') === 'middle'; });
    if (row.length < 2) row = texts.filter(function (t) { return Math.abs(attr(t, 'y') - maxY) < 16 && t.getAttribute('text-anchor') === 'middle'; });
    if (row.length < 2) return null;
    row.sort(function (p, q) { return attr(p, 'x') - attr(q, 'x'); });
    var a = row[0], b = row[row.length - 1], va = num(a.textContent).v, vb = num(b.textContent).v;
    return { f: function (x) { return va + (x - attr(a, 'x')) * (vb - va) / (attr(b, 'x') - attr(a, 'x')); } };
  }
  function cardOf(svg) { return svg.closest('.c-card, .kc-glass, section') || svg.parentNode; }
  function axisLabels(svg, n) {
    var card = cardOf(svg), axes = card ? card.querySelectorAll('.c-axis') : [];
    for (var i = 0; i < axes.length; i++) { var s = axes[i].querySelectorAll('span'); if (s.length === n) return [].map.call(s, function (x) { return x.textContent.trim(); }); }
    return null;
  }

  // labels written under a bar (year, value): texts whose x falls inside the bar, below its top
  function textsUnder(svg, r) {
    var x0 = attr(r, 'x'), x1 = x0 + attr(r, 'width'), top = attr(r, 'y');
    var ts = [].filter.call(svg.querySelectorAll('text'), function (t) { var x = attr(t, 'x'); return !inDefs(t) && x >= x0 - 2 && x <= x1 + 2 && attr(t, 'y') > top; })
      .sort(function (a, b) { return attr(a, 'y') - attr(b, 'y'); });
    if (!ts.length) return null;
    return '<span>' + ts[0].textContent.trim() + '</span>' + ts.slice(1, 2).map(function (t) { return t.textContent.trim(); }).join('');
  }
  function hintUnit(svg) { var c = cardOf(svg), h = c && c.querySelector('.c-hint'); return h && /^CHF/.test(h.textContent.trim()) ? 'CHF ' : ''; }
  function title(svg) { var t = cardOf(svg) && cardOf(svg).querySelector('.c-title'); return t ? t.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function valueText(sc, v) { return sc ? fmt(v, sc.dec) + (sc.unit ? (/^[%]/.test(sc.unit) ? sc.unit : ' ' + sc.unit) : '') : ''; }
  function center(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, top: r.top, bottom: r.bottom }; }

  // bars: rects of one width repeated four or more times; ranked lines: vertical lines of one width
  function wireBars(svg, sc) {
    var groups = {};
    [].forEach.call(svg.querySelectorAll('rect'), function (r) {
      if (inDefs(r) || attr(r, 'height') < 2) return;
      var k = r.getAttribute('width'); (groups[k] = groups[k] || []).push(r);
    });
    var vb = svg.viewBox && svg.viewBox.baseVal, W = vb ? vb.width : 0, done = false;
    Object.keys(groups).forEach(function (k) {
      var g = groups[k]; if (g.length < 4 || (W && parseFloat(k) > W * 0.3)) return;
      g.sort(function (a, b) { return attr(a, 'x') - attr(b, 'x'); });
      // one bar per x position only
      var xs = {}; g = g.filter(function (r) { var x = attr(r, 'x'); if (xs[x]) return false; xs[x] = 1; return true; });
      if (g.length < 4) return;
      // a tick meter is rects of one height: not a bar chart
      if (g.every(function (r) { return r.getAttribute('height') === g[0].getAttribute('height'); })) return;
      var labels = axisLabels(svg, g.length), tt = title(svg);
      g.forEach(function (r, i) {
        r.classList.add('ka-mark');
        r.addEventListener('mouseenter', function () {
          svg.classList.add('ka-hovering'); r.classList.add('ka-on');
          var c = center(r), v = sc ? sc.f(attr(r, 'y')) : null;
          if (!labels && v == null) { var tl = textsUnder(svg, r); if (tl) { show(tl, c.x, c.top - 8); return; } }
          if (labels || v != null) show((labels ? '<span>' + labels[i] + '</span>' : '') + (v != null ? valueText(sc, v) : ''), c.x, c.top - 8);
        });
        r.addEventListener('mouseleave', function () { svg.classList.remove('ka-hovering'); r.classList.remove('ka-on'); hide(); });
      });
      done = true;
    });
    if (done) svg.classList.add('ka-has-bars');
    if (!done) {
      var hg = {};
      [].forEach.call(svg.querySelectorAll('rect'), function (r) { if (!inDefs(r) && attr(r, 'width') > 2) { var k = r.getAttribute('height'); (hg[k] = hg[k] || []).push(r); } });
      Object.keys(hg).forEach(function (k) {
        var g = hg[k], widths = {}; g.forEach(function (r) { widths[r.getAttribute('width')] = 1; });
        if (g.length < 3 || Object.keys(widths).length < 3 || (W && g.some(function (r) { return attr(r, 'width') >= W * 0.98; }))) return;
        g.forEach(function (r) {
          r.classList.add('ka-mark');
          r.addEventListener('mouseenter', function () {
            svg.classList.add('ka-hovering'); r.classList.add('ka-on');
            var y0 = attr(r, 'y'), y1 = y0 + attr(r, 'height'), x1 = attr(r, 'x') + attr(r, 'width');
            var row = [].filter.call(svg.querySelectorAll('text'), function (t) { var y = attr(t, 'y'); return y >= y0 - 14 && y <= y1 + 4; })
              .sort(function (a, b) { return attr(a, 'x') - attr(b, 'x'); }).map(function (t) { return t.textContent.trim(); });
            var c = r.getBoundingClientRect();
            if (row.length) show('<span>' + row[0] + '</span>' + row.slice(1).join(' '), c.left + c.width / 2, c.top - 8);
          });
          r.addEventListener('mouseleave', function () { svg.classList.remove('ka-hovering'); r.classList.remove('ka-on'); hide(); });
        });
        done = true;
      });
    }
    var vlines = [].filter.call(svg.querySelectorAll('line'), function (l) { return !inDefs(l) && attr(l, 'x1') === attr(l, 'x2') && attr(l, 'y2') - attr(l, 'y1') > 2 && parseFloat(l.getAttribute('stroke-width') || 1) >= 1.2; });
    if (vlines.length >= 10 && sc) {
      var n = vlines.length;
      vlines.forEach(function (l, i) {
        l.classList.add('ka-mark'); l.style.pointerEvents = 'stroke';
        l.addEventListener('mouseenter', function () {
          svg.classList.add('ka-hovering'); l.classList.add('ka-on');
          var c = center(l), v = sc ? sc.f(Math.min(attr(l, 'y1'), attr(l, 'y2'))) : null;
          show('<span>Rank ' + (i + 1) + ' of ' + n + '</span>' + (v != null ? hintUnit(svg) + valueText(sc, v) : ''), c.x, c.top - 8);
        });
        l.addEventListener('mouseleave', function () { svg.classList.remove('ka-hovering'); l.classList.remove('ka-on'); hide(); });
      });
      done = true;
    }
    return done;
  }

  // points: the largest group of circles; a series if their x positions are distinct, a scatter otherwise
  function wirePoints(svg, sc) {
    var groups = {};
    [].forEach.call(svg.querySelectorAll('circle'), function (c) {
      if (inDefs(c) || attr(c, 'r') < 2.5) return;
      var k = c.getAttribute('fill') || ''; if (k === '#fff' || k === '#ffffff') k = 'open';
      (groups[k] = groups[k] || []).push(c);
    });
    var best = null;
    function score(g) { return g.length < 4 ? -1 : attr(g[0], 'r') * 1000 + g.length; }
    Object.keys(groups).forEach(function (k) { if (!best || score(groups[k]) > score(best)) best = groups[k]; });
    if (!best || best.length < 4) return false;
    var xsSeen = {}, distinct = 0;
    best.forEach(function (c) { var x = Math.round(attr(c, 'cx')); if (!xsSeen[x]) { xsSeen[x] = 1; distinct++; } });
    var scatter = best.length > 30 && distinct > best.length * 0.5;
    var pts = best;
    if (!scatter) {
      // series: every circle of the line's colour plus open forecast points, one per x
      var all = [].filter.call(svg.querySelectorAll('circle'), function (c) { return !inDefs(c) && attr(c, 'r') >= 3.5 && (c.getAttribute('fill') === best[0].getAttribute('fill') || c.getAttribute('fill') === '#fff'); });
      var byX = {}; all.forEach(function (c) { var x = attr(c, 'cx'); if (!byX[x] || attr(c, 'r') > attr(byX[x], 'r')) byX[x] = c; });
      pts = Object.keys(byX).map(function (x) { return byX[x]; }).sort(function (a, b) { return attr(a, 'cx') - attr(b, 'cx'); });
    }
    var labels = !scatter ? axisLabels(svg, pts.length) : null, xs = scatter ? xScale(svg) : null;
    var t = title(svg).split(/\s*against\s*/i);
    var NS = 'http://www.w3.org/2000/svg', cross = null, ring = null, card = cardOf(svg);
    function clearStatic() {
      if (!card) return;
      [].forEach.call(card.querySelectorAll('.c-tooltip'), function (e) { e.style.display = 'none'; });
      [].forEach.call(svg.querySelectorAll('line[stroke="var(--ink)"]'), function (l) { if (attr(l, 'x1') === attr(l, 'x2') && !l.classList.contains('ka-cross')) l.style.display = 'none'; });
    }
    function mark(c) {
      if (!ring) {
        ring = document.createElementNS(NS, 'circle'); ring.setAttribute('class', 'ka-ring'); ring.setAttribute('r', '7');
        cross = document.createElementNS(NS, 'line'); cross.setAttribute('class', 'ka-cross');
        if (!scatter) svg.appendChild(cross);
        svg.appendChild(ring);
      }
      var vb = svg.viewBox.baseVal;
      ring.setAttribute('cx', c.getAttribute('cx')); ring.setAttribute('cy', c.getAttribute('cy'));
      cross.setAttribute('x1', c.getAttribute('cx')); cross.setAttribute('x2', c.getAttribute('cx'));
      cross.setAttribute('y1', vb.y); cross.setAttribute('y2', vb.y + vb.height);
      svg.classList.add('ka-pointing');
    }
    function report(c, i) {
      var r = c.getBoundingClientRect(), html;
      if (scatter) {
        var yv = sc ? valueText(sc, sc.f(attr(c, 'cy'))) : '', xv = xs ? fmt(xs.f(attr(c, 'cx')), 0) : '';
        html = '<span>' + (t[1] ? t[1] + ' ' : '') + xv + (/area/i.test(t[1] || '') ? ' m²' : '') + '</span>' + (t[0] ? t[0] + ' ' : '') + (/price/i.test(t[0] || '') ? 'CHF ' : '') + yv;
      } else {
        html = '<span>' + (labels ? labels[i] : title(svg)) + '</span>' + (sc ? valueText(sc, sc.f(attr(c, 'cy'))) : '');
      }
      show(html, r.left + r.width / 2, r.top - 10);
    }
    svg.addEventListener('mousemove', function (e) {
      var best_ = null, bd = Infinity;
      pts.forEach(function (c, i) {
        var r = c.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var d = scatter ? Math.hypot(cx - e.clientX, cy - e.clientY) : Math.abs(cx - e.clientX);
        if (d < bd) { bd = d; best_ = [c, i]; }
      });
      if (!best_ || (scatter && bd > 16)) { svg.classList.remove('ka-pointing'); hide(); return; }
      clearStatic(); mark(best_[0]); report(best_[0], best_[1]);
    });
    svg.addEventListener('mouseleave', function () { svg.classList.remove('ka-pointing'); hide(); });
    return true;
  }

  // line charts drawn as one path: crosshair and ring follow the line
  function wirePath(svg, sc) {
    var path = null, n = 0;
    [].forEach.call(svg.querySelectorAll('path'), function (p) {
      if (inDefs(p) || (p.getAttribute('fill') || '') !== 'none') return;
      var d = p.getAttribute('d') || '', m = d.match(/[ML]\s*-?[\d.]+[ ,]-?[\d.]+/g) || [];
      if (/[CQASHV]/i.test(d.replace(/^M/, ''))) return;
      if (m.length > n) { n = m.length; path = p; }
    });
    if (!path || n < 6) return false;
    var pts = path.getAttribute('d').match(/-?[\d.]+[ ,]-?[\d.]+/g).map(function (s) { var q = s.split(/[ ,]/); return [parseFloat(q[0]), parseFloat(q[1])]; });
    var labels = axisLabels(svg, pts.length), card = cardOf(svg), axisAll = null;
    if (!labels && card) { var ax = card.querySelector('.c-axis'); if (ax) axisAll = [].map.call(ax.querySelectorAll('span'), function (x) { return x.textContent.trim(); }); }
    var NS = 'http://www.w3.org/2000/svg', ring = null, cross = null;
    svg.addEventListener('mousemove', function (e) {
      var r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, x = vb.x + (e.clientX - r.left) / r.width * vb.width;
      var i = 0, bd = Infinity; pts.forEach(function (p, k) { var d = Math.abs(p[0] - x); if (d < bd) { bd = d; i = k; } });
      var p = pts[i];
      if (!ring) {
        cross = document.createElementNS(NS, 'line'); cross.setAttribute('class', 'ka-cross'); svg.appendChild(cross);
        ring = document.createElementNS(NS, 'circle'); ring.setAttribute('class', 'ka-ring'); ring.setAttribute('r', Math.max(3, vb.height / 40)); svg.appendChild(ring);
      }
      ring.setAttribute('cx', p[0]); ring.setAttribute('cy', p[1]);
      cross.setAttribute('x1', p[0]); cross.setAttribute('x2', p[0]); cross.setAttribute('y1', vb.y); cross.setAttribute('y2', vb.y + vb.height);
      svg.classList.add('ka-pointing');
      var lab = labels ? labels[i] : axisAll && axisAll.length > 1 ? axisAll[Math.round(i / (pts.length - 1) * (axisAll.length - 1))] : null;
      var v = sc ? valueText(sc, sc.f(p[1])) : '';
      var rr = ring.getBoundingClientRect();
      if (lab || v) show((lab ? '<span>' + lab + '</span>' : '') + v, rr.left + rr.width / 2, rr.top - 8); else hide();
    });
    svg.addEventListener('mouseleave', function () { svg.classList.remove('ka-pointing'); hide(); });
    return true;
  }

  function init(root) {
    [].forEach.call(root.querySelectorAll('svg.c-chart'), function (svg) {
      if (svg.__kaCharts || svg.closest('.kc-map, .kc-lq-map, .kc-ls-stage')) return;
      var vb = svg.viewBox && svg.viewBox.baseVal; if (!vb || vb.height < 20) return;
      svg.__kaCharts = true;
      var sc = yScale(svg);
      if (!wireBars(svg, sc) && !wirePoints(svg, sc)) wirePath(svg, sc);
    });
  }

  var prev = window.KartaApp && window.KartaApp.afterRender;
  window.KartaApp = window.KartaApp || {};
  window.KartaApp.afterRender = function (root) { if (prev) prev(root); init(root); };
  window.addEventListener('scroll', hide, { passive: true });
})();
