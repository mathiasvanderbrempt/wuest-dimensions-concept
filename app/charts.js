/* Karta concept app: chart interactions, following the Celsius pattern (Lakesight).
   Each bar, ranked line or point gets a transparent hit column; hovering fills that column with a light band behind
   the mark, and a dark tip shows "label: value" above it, following the pointer sideways.
   Values are read back from each chart's own gridline labels, so they match what the chart shows. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var tip = null, over = null;
  function tipbox() {
    if (!tip) { tip = document.createElement('div'); tip.className = 'ka-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.appendChild(tip); }
    return tip;
  }
  // above the hovered item so it never covers it, below only when there is no room above
  function place(e) {
    if (!over || !tip || tip.hidden) return;
    var r = tip.getBoundingClientRect(), a = over.getBoundingClientRect();
    var x = Math.max(8, Math.min(e.clientX - r.width / 2, innerWidth - r.width - 8));
    var y = a.top - r.height - 8;
    if (y < 8) y = a.bottom + 8;
    if (y + r.height > innerHeight - 8) y = Math.max(8, e.clientY - r.height - 14);
    tip.style.transform = 'translate(' + Math.round(x) + 'px, ' + Math.round(y) + 'px)';
  }
  function show(el, text, e) { if (!text) return; over = el; var t = tipbox(); t.textContent = text; t.hidden = false; place(e); }
  function hide() { if (tip) tip.hidden = true; over = null; }
  document.addEventListener('pointermove', place);
  addEventListener('scroll', hide, { passive: true });

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
  function cardOf(svg) { return svg.closest('.c-card, .kc-glass, section') || svg.parentNode; }

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
  function xScale(svg) {
    var texts = [].filter.call(svg.querySelectorAll('text'), function (t) { return num(t.textContent) && !inDefs(t) && t.getAttribute('text-anchor') === 'middle'; });
    if (texts.length < 2) return null;
    var maxY = Math.max.apply(null, texts.map(function (t) { return attr(t, 'y'); }));
    var row = texts.filter(function (t) { return Math.abs(attr(t, 'y') - maxY) < 16; });
    if (row.length < 2) return null;
    row.sort(function (p, q) { return attr(p, 'x') - attr(q, 'x'); });
    var a = row[0], b = row[row.length - 1], va = num(a.textContent).v, vb = num(b.textContent).v;
    return { f: function (x) { return va + (x - attr(a, 'x')) * (vb - va) / (attr(b, 'x') - attr(a, 'x')); } };
  }
  function axisLabels(svg, n) {
    var card = cardOf(svg), axes = card ? card.querySelectorAll('.c-axis') : [];
    for (var i = 0; i < axes.length; i++) { var s = axes[i].querySelectorAll('span'); if (s.length === n) return [].map.call(s, function (x) { return x.textContent.trim(); }); }
    return null;
  }
  function axisAll(svg) { var c = cardOf(svg), ax = c && c.querySelector('.c-axis'); return ax ? [].map.call(ax.querySelectorAll('span'), function (x) { return x.textContent.trim(); }) : null; }
  function title(svg) { var t = cardOf(svg) && cardOf(svg).querySelector('.c-title'); return t ? t.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function hintUnit(svg) { var c = cardOf(svg), h = c && c.querySelector('.c-hint'); return h && /^CHF/.test(h.textContent.trim()) ? 'CHF ' : ''; }
  function valueText(sc, v) { return fmt(v, sc.dec) + (sc.unit ? (/^%/.test(sc.unit) ? sc.unit : ' ' + sc.unit) : ''); }
  function joinTip(label, value) { return label && value ? label + ': ' + value : (label || value || ''); }
  // labels written under a bar (year, value)
  function textsUnder(svg, x0, x1, top) {
    var ts = [].filter.call(svg.querySelectorAll('text'), function (t) { var x = attr(t, 'x'); return !inDefs(t) && x >= x0 - 2 && x <= x1 + 2 && attr(t, 'y') > top; })
      .sort(function (a, b) { return attr(a, 'y') - attr(b, 'y'); }).map(function (t) { return t.textContent.trim(); });
    return ts.length ? joinTip(ts[0], ts[1] || '') : '';
  }

  // the hit column: transparent, on top of the marks, lit on hover
  function hit(svg, x, y, w, h, text) {
    var r = document.createElementNS(NS, 'rect');
    r.setAttribute('class', 'ka-hit');
    r.setAttribute('x', x.toFixed(1)); r.setAttribute('y', y.toFixed(1));
    r.setAttribute('width', Math.max(w, 1).toFixed(1)); r.setAttribute('height', Math.max(h, 1).toFixed(1));
    r.addEventListener('pointerenter', function (e) { show(r, typeof text === 'function' ? text() : text, e); });
    r.addEventListener('pointerleave', hide);
    svg.appendChild(r);
    return r;
  }
  function stepOf(xs, fallback) {
    var d = Infinity; for (var i = 1; i < xs.length; i++) d = Math.min(d, Math.abs(xs[i] - xs[i - 1]));
    return isFinite(d) && d > 0 ? d : fallback;
  }

  // vertical bars: rects of one width repeated four or more times, with varying heights
  function wireBars(svg, sc) {
    var vb = svg.viewBox.baseVal, groups = {}, done = false;
    [].forEach.call(svg.querySelectorAll('rect'), function (r) {
      if (inDefs(r) || attr(r, 'height') < 2) return;
      var k = r.getAttribute('width'); (groups[k] = groups[k] || []).push(r);
    });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k]; if (g.length < 4 || parseFloat(k) > vb.width * 0.3) return;
      var xs = {}; g = g.sort(function (a, b) { return attr(a, 'x') - attr(b, 'x'); }).filter(function (r) { var x = attr(r, 'x'); if (xs[x]) return false; xs[x] = 1; return true; });
      if (g.length < 4 || g.every(function (r) { return r.getAttribute('height') === g[0].getAttribute('height'); })) return; // a tick meter, not a bar chart
      var labels = axisLabels(svg, g.length), w = parseFloat(k);
      var centers = g.map(function (r) { return attr(r, 'x') + w / 2; }), step = stepOf(centers, w * 2);
      var base = Math.max.apply(null, g.map(function (r) { return attr(r, 'y') + attr(r, 'height'); }));
      g.forEach(function (r, i) {
        var cx = centers[i];
        hit(svg, cx - step / 2, vb.y, step, base - vb.y, function () {
          var v = sc ? valueText(sc, sc.f(attr(r, 'y'))) : '';
          if (!labels && !v) return textsUnder(svg, attr(r, 'x'), attr(r, 'x') + w, attr(r, 'y'));
          return joinTip(labels ? labels[i] : '', v);
        });
      });
      done = true;
    });
    return done;
  }
  // ranked lines: ten or more vertical lines on a value scale
  function wireRanked(svg, sc) {
    if (!sc) return false;
    var vb = svg.viewBox.baseVal;
    var ls = [].filter.call(svg.querySelectorAll('line'), function (l) { return !inDefs(l) && attr(l, 'x1') === attr(l, 'x2') && Math.abs(attr(l, 'y2') - attr(l, 'y1')) > 2 && parseFloat(l.getAttribute('stroke-width') || 1) >= 1.2; });
    if (ls.length < 10) return false;
    var xs = ls.map(function (l) { return attr(l, 'x1'); }), step = stepOf(xs.slice().sort(function (a, b) { return a - b; }), 4);
    var base = Math.max.apply(null, ls.map(function (l) { return Math.max(attr(l, 'y1'), attr(l, 'y2')); })), unit = hintUnit(svg);
    ls.forEach(function (l, i) {
      hit(svg, xs[i] - step / 2, vb.y, step, base - vb.y, function () {
        return joinTip('Rank ' + (i + 1) + ' of ' + ls.length, unit + valueText(sc, sc.f(Math.min(attr(l, 'y1'), attr(l, 'y2')))));
      });
    });
    return true;
  }
  // horizontal bars: rects of one height, three or more, with varying widths; the band spans the row
  function wireRows(svg) {
    var vb = svg.viewBox.baseVal, hg = {}, done = false;
    [].forEach.call(svg.querySelectorAll('rect'), function (r) { if (!inDefs(r) && attr(r, 'width') > 2) { var k = r.getAttribute('height'); (hg[k] = hg[k] || []).push(r); } });
    Object.keys(hg).forEach(function (k) {
      var g = hg[k], widths = {}; g.forEach(function (r) { widths[r.getAttribute('width')] = 1; });
      if (g.length < 3 || Object.keys(widths).length < 3 || g.some(function (r) { return attr(r, 'width') >= vb.width * 0.98; })) return;
      g.forEach(function (r) {
        var y0 = attr(r, 'y'), h = attr(r, 'height');
        hit(svg, vb.x, y0 - 3, vb.width, h + 6, function () {
          var row = [].filter.call(svg.querySelectorAll('text'), function (t) { var y = attr(t, 'y'); return !inDefs(t) && y >= y0 && y <= y0 + h + 6; })
            .sort(function (a, b) { return attr(a, 'x') - attr(b, 'x'); }).map(function (t) { return t.textContent.trim(); });
          return joinTip(row[0] || '', row.slice(1).join(' '));
        });
      });
      done = true;
    });
    return done;
  }
  // point series and scatter: columns for a series; for a scatter, the point itself carries the tip
  function wirePoints(svg, sc) {
    var vb = svg.viewBox.baseVal, groups = {};
    [].forEach.call(svg.querySelectorAll('circle'), function (c) {
      if (inDefs(c) || attr(c, 'r') < 2.5) return;
      var k = c.getAttribute('fill') || ''; (groups[k] = groups[k] || []).push(c);
    });
    function score(g) { return g.length < 4 ? -1 : attr(g[0], 'r') * 1000 + g.length; }
    var best = null; Object.keys(groups).forEach(function (k) { if (!best || score(groups[k]) > score(best)) best = groups[k]; });
    if (!best || best.length < 4) return false;
    var seen = {}, distinct = 0; best.forEach(function (c) { var x = Math.round(attr(c, 'cx')); if (!seen[x]) { seen[x] = 1; distinct++; } });
    if (best.length > 30 && distinct > best.length * 0.5) {
      var xs = xScale(svg), t = title(svg).split(/\s*against\s*/i);
      best.forEach(function (c) {
        c.classList.add('ka-point');
        c.addEventListener('pointerenter', function (e) {
          var xv = xs ? fmt(xs.f(attr(c, 'cx')), 0) + (/area/i.test(t[1] || '') ? ' m²' : '') : '';
          var yv = sc ? (/price/i.test(t[0] || '') ? 'CHF ' : '') + valueText(sc, sc.f(attr(c, 'cy'))) : '';
          show(c, (t[1] ? t[1] + ' ' : '') + xv + (yv ? ', ' + (t[0] ? t[0].toLowerCase() + ' ' : '') + yv : ''), e);
        });
        c.addEventListener('pointerleave', hide);
      });
      return true;
    }
    var all = [].filter.call(svg.querySelectorAll('circle'), function (c) { return !inDefs(c) && attr(c, 'r') >= 3.5 && (c.getAttribute('fill') === best[0].getAttribute('fill') || c.getAttribute('fill') === '#fff'); });
    var byX = {}; all.forEach(function (c) { var x = attr(c, 'cx'); if (!byX[x] || attr(c, 'r') > attr(byX[x], 'r')) byX[x] = c; });
    var pts = Object.keys(byX).map(function (x) { return byX[x]; }).sort(function (a, b) { return attr(a, 'cx') - attr(b, 'cx'); });
    var cx = pts.map(function (c) { return attr(c, 'cx'); }), step = stepOf(cx, 20), labels = axisLabels(svg, pts.length);
    pts.forEach(function (c, i) {
      hit(svg, cx[i] - step / 2, vb.y, step, vb.height, function () { return joinTip(labels ? labels[i] : '', sc ? valueText(sc, sc.f(attr(c, 'cy'))) : ''); });
    });
    // the drawing's own static tooltip and marker give way to the live one
    var card = cardOf(svg);
    if (card) [].forEach.call(card.querySelectorAll('.c-tooltip'), function (e) { e.style.display = 'none'; });
    [].forEach.call(svg.querySelectorAll('line[stroke="var(--ink)"]'), function (l) { if (attr(l, 'x1') === attr(l, 'x2')) l.style.display = 'none'; });
    return true;
  }
  // line drawn as one path: a column per vertex
  function wirePath(svg, sc) {
    var vb = svg.viewBox.baseVal, path = null, n = 0;
    [].forEach.call(svg.querySelectorAll('path'), function (p) {
      if (inDefs(p) || (p.getAttribute('fill') || '') !== 'none') return;
      var d = p.getAttribute('d') || '';
      if (/[CQASHV]/i.test(d.replace(/^M/, ''))) return;
      var m = d.match(/-?[\d.]+[ ,]-?[\d.]+/g) || [];
      if (m.length > n) { n = m.length; path = p; }
    });
    if (!path || n < 6) return false;
    var pts = path.getAttribute('d').match(/-?[\d.]+[ ,]-?[\d.]+/g).map(function (s) { var q = s.split(/[ ,]/); return [parseFloat(q[0]), parseFloat(q[1])]; });
    var labels = axisLabels(svg, pts.length), all = labels ? null : axisAll(svg);
    var step = stepOf(pts.map(function (p) { return p[0]; }), 10);
    pts.forEach(function (p, i) {
      var lab = labels ? labels[i] : all && all.length > 1 ? all[Math.round(i / (pts.length - 1) * (all.length - 1))] : '';
      var v = sc ? valueText(sc, sc.f(p[1])) : '';
      if (!lab && !v) return;
      hit(svg, p[0] - step / 2, vb.y, step, vb.height, joinTip(lab, v));
    });
    return true;
  }

  function init(root) {
    [].forEach.call(root.querySelectorAll('svg.c-chart'), function (svg) {
      if (svg.__kaCharts || svg.closest('.kc-map, .kc-lq-map, .kc-ls-stage')) return;
      var vb = svg.viewBox && svg.viewBox.baseVal; if (!vb || vb.height < 20) return;
      svg.__kaCharts = true;
      var sc = yScale(svg);
      wireBars(svg, sc) || wireRanked(svg, sc) || wireRows(svg) || wirePoints(svg, sc) || wirePath(svg, sc);
    });
  }

  var prev = window.KartaApp && window.KartaApp.afterRender;
  window.KartaApp = window.KartaApp || {};
  window.KartaApp.afterRender = function (root) { if (prev) prev(root); init(root); };
})();
