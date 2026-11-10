/* Karta concept app: range and view switches, and tabs without content.
   Switches that have content change the page: Period and Range on Portfolio, Compare with on Performance, View on Rental listings.
   (Map layer and Base map are in maps.js.) Every other tab or switch option has no content in this concept, so it is
   marked not interactive, the same way the sidebar marks its items. All figures are demo data. */
(function () {
  var WIRED = { 'Period': 1, 'Range': 1, 'Compare with': 1, 'View': 1, 'Map layer': 1, 'Base map': 1 };
  var NS = 'http://www.w3.org/2000/svg';
  var view = 'Map and charts';

  function txt(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function seeded(seed) { var h = seed >>> 0; return function () { h += 0x6D2B79F5; var t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function cardWith(root, title, sel) {
    return [].filter.call(root.querySelectorAll('.c-card'), function (c) { var t = c.querySelector('.c-title'); return t && txt(t) === title && (!sel || c.querySelector(sel)); })[0];
  }
  function pressed(group, btn) { [].forEach.call(group.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); }); }
  function inert(el) {
    if (el.__kaInert) return;
    el.__kaInert = 1;
    var label = el.getAttribute('aria-label') || txt(el);
    el.setAttribute('aria-disabled', 'true'); el.tabIndex = -1; el.classList.add('ka-inert');
    el.title = label + ', not part of this concept';
  }
  // a rising series with a little movement, first value 0 and last value 1
  function series(n, seed, wobble) {
    var r = seeded(seed), out = [];
    for (var i = 0; i < n; i++) { var t = i / (n - 1); out.push(i === 0 ? 0 : i === n - 1 ? 1 : t + (r() - 0.5) * wobble); }
    return out;
  }
  function keep(svg) {
    if (svg.__kaOrig == null) { [].forEach.call(svg.querySelectorAll('.ka-hit'), function (h) { h.remove(); }); svg.__kaOrig = svg.innerHTML; }
  }
  function redraw(svg, html) {
    svg.innerHTML = html; svg.__kaCharts = false;
  }
  function rewire() { var r = document.getElementById('dc-root'); if (window.KartaApp && window.KartaApp.afterRender && r) window.KartaApp.afterRender(r); }
  function chip(card, text) { var c = card && card.querySelector('.k-delta'); if (c && c.lastChild && c.lastChild.nodeType === 3) c.lastChild.nodeValue = text; }
  function hint(card, text) { var h = card && card.querySelector('.k-delta + .c-hint'); if (h) h.textContent = text; }

  /* ---------- Portfolio: Period ---------- */
  var PERIOD = {
    'Quarter': { vs: 'vs July 2026', value: '+1.1%', rent: '+2.4%', occ: '+0.2 pp', n: 14, rentFrom: 0.93, what: 'the last quarter, weekly' },
    '12 months': null,
    'Since purchase': { vs: 'vs purchase', value: '+22.9%', rent: '+31.5%', occ: '+2.9 pp', n: 28, rentFrom: 0.55, what: 'the time since purchase, quarterly' }
  };
  function period(root, name) {
    var p = PERIOD[name];
    var value = cardWith(root, 'Portfolio value', '.k-delta'), rent = cardWith(root, 'Net rent'), occ = cardWith(root, 'Occupancy');
    [value, rent, occ].forEach(function (c) {
      if (!c) return;
      var d = c.querySelector('.k-delta'), h = c.querySelector('.k-delta + .c-hint');
      if (c.__kaChip == null) { c.__kaChip = d.lastChild.nodeValue; c.__kaHint = h.textContent; }
    });
    var vs = value && value.querySelector('svg.c-chart'), rs = rent && rent.querySelector('svg.c-chart');
    if (vs) keep(vs); if (rs) keep(rs);
    if (!p) {
      [value, rent, occ].forEach(function (c) { if (c) { chip(c, c.__kaChip); hint(c, c.__kaHint); } });
      if (vs) { redraw(vs, vs.__kaOrig); vs.setAttribute('aria-label', 'Portfolio value over 12 months'); }
      if (rs) { redraw(rs, rs.__kaOrig); rs.setAttribute('aria-label', 'Net rent per month, last 12 months'); }
    } else {
      chip(value, p.value); chip(rent, p.rent); chip(occ, p.occ);
      [value, rent, occ].forEach(function (c) { hint(c, p.vs); });
      if (vs) {
        var defs = vs.querySelector('defs'), grad = defs && defs.querySelector('linearGradient');
        var s = series(p.n, p.n * 31, 0.09), pts = s.map(function (v, i) { return (i * 232 / (p.n - 1)).toFixed(1) + ' ' + (45 - v * 42).toFixed(1); });
        var line = 'M' + pts.join(' L');
        redraw(vs, (defs ? defs.outerHTML : '') + '<path d="' + line + ' L232 48 L0 48 Z" fill="' + (grad ? 'url(#' + grad.id + ')' : 'none') + '"/><path d="' + line + '" fill="none" stroke="var(--bar)" stroke-width="1.25" stroke-linejoin="round"/><circle cx="232.0" cy="3.0" r="2" fill="var(--signal)"/>');
        vs.setAttribute('aria-label', 'Portfolio value over ' + p.what);
      }
      if (rs) {
        var b = series(p.n, p.n * 17, 0.12), step = 232 / p.n, w = Math.max(2.5, step * 0.48), bars = '';
        b.forEach(function (v, i) {
          var h = 44.4 * (p.rentFrom + (1 - p.rentFrom) * v);
          bars += '<rect x="' + (i * step + (step - w) / 2).toFixed(1) + '" y="' + (48 - h).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="1.0" fill="' + (i === p.n - 1 ? 'var(--signal)' : 'var(--bar)') + '"/>';
        });
        redraw(rs, bars);
        rs.setAttribute('aria-label', 'Net rent over ' + p.what);
      }
    }
    rewire();
  }

  /* ---------- Portfolio: Range of the value chart ---------- */
  var RANGE = {
    '1Y': { hist: 13, fc: 3, wobble: 0.07, axis: ['Oct 2025', 'Jan', 'Apr', 'Jul', 'Oct', 'Jan 2027'], small: 'Forecast January 2027', b: 'CHF 618 M ± 1.5%', aria: 'Monthly portfolio value, October 2025 to October 2026, with a hatched forecast band to January 2027' },
    '5Y': null,
    'Max': { hist: 32, fc: 2, wobble: 0.05, axis: ['2019', '2021', '2023', '2025', '2027'], small: 'Forecast Q1 2027', b: 'CHF 621 M ± 2%', aria: 'Quarterly portfolio value 2019 to 2026 with a hatched forecast band to early 2027' }
  };
  function range(root, name) {
    var card = cardWith(root, 'Portfolio value', '.kc-seg[aria-label="Range"]');
    if (!card) return;
    var svg = card.querySelector('svg.c-chart'), axis = card.querySelector('.c-axis'), aside = card.querySelector('.c-aside');
    keep(svg);
    if (card.__kaAxis == null) { card.__kaAxis = axis.innerHTML; card.__kaAside = aside.innerHTML; card.__kaAria = svg.getAttribute('aria-label'); }
    var r = RANGE[name];
    if (!r) { redraw(svg, svg.__kaOrig); axis.innerHTML = card.__kaAxis; aside.innerHTML = card.__kaAside; svg.setAttribute('aria-label', card.__kaAria); rewire(); return; }
    var head = '', kids = svg.__kaOrigHead;
    if (kids == null) {
      var tmp = document.createElementNS(NS, 'svg'); tmp.innerHTML = svg.__kaOrig;
      kids = ''; [].forEach.call(tmp.children, function (c) { if (c.localName === 'defs' || c.localName === 'line') kids += c.outerHTML; });
      svg.__kaOrigHead = kids;
    }
    head = kids;
    var N = r.hist + r.fc, X = function (i) { return i * 419 / (N - 1); };
    var s = series(r.hist, r.hist * 13, r.wobble), hp = s.map(function (v, i) { return X(i).toFixed(1) + ' ' + (135 - v * 95.3).toFixed(1); });
    var x0 = X(r.hist - 1), fcl = [], up = [], lo = [];
    for (var k = 0; k <= r.fc; k++) {
      var t = k / r.fc, x = X(r.hist - 1 + k).toFixed(1), y = 39.7 - 18.9 * t;
      fcl.push(x + ' ' + y.toFixed(1)); up.push(x + ' ' + (y - 8 - 20 * t).toFixed(1)); lo.unshift(x + ' ' + (47.7 + 1.1 * t).toFixed(1));
    }
    redraw(svg, head + '<path d="M' + up.join(' L') + ' L' + lo.join(' L') + ' Z" fill="url(#fh)" stroke="var(--signal-300)" stroke-width="1"/>'
      + '<path d="M' + hp.join(' L') + '" fill="none" stroke="var(--bar)" stroke-width="1.5"/>'
      + '<path d="M' + fcl.join(' L') + '" fill="none" stroke="var(--bar)" stroke-width="1.5" stroke-dasharray="4 4"/>'
      + '<circle cx="' + x0.toFixed(1) + '" cy="39.7" r="4" fill="var(--signal)" stroke="#fff" stroke-width="2"/>');
    svg.setAttribute('aria-label', r.aria);
    axis.innerHTML = r.axis.map(function (a) { return '<span>' + a + '</span>'; }).join('');
    aside.innerHTML = '<small>' + r.small + '</small><b>' + r.b + '</b>';
    rewire();
  }

  /* ---------- Performance: Compare with ---------- */
  var COMPARE = {
    'Budget': { head: 'NOI against budget', of: 'of budget', v: [98.4, 103.1, 96.2, 101.0, 100.4] },
    'Last year': { head: 'NOI against last year', of: 'of last year', v: [103.6, 105.2, 97.8, 102.4, 100.9] },
    'Market': { head: 'NOI against market', of: 'of the market median', v: [101.8, 99.2, 95.4, 100.6, 97.9] }
  };
  function compare(root, name) {
    var c = COMPARE[name], card = cardWith(root, 'Property performance');
    if (!c || !card) return;
    var ths = card.querySelectorAll('.k-th');
    [].forEach.call(ths, function (th) { if (/^NOI against/.test(txt(th))) th.textContent = c.head; });
    [].forEach.call(card.querySelectorAll('.k-row'), function (row, i) {
      var v = c.v[i]; if (v == null) return;
      var svg = row.querySelector('svg.c-chart[aria-label^="NOI"]'); if (!svg) return;
      var cell = svg.closest('.k-td'), num = cell.querySelector('.k-muted'), rects = svg.querySelectorAll('rect');
      svg.setAttribute('aria-label', 'NOI ' + v.toFixed(1) + '% ' + c.of);
      rects[1].setAttribute('width', Math.min(120, v / 100 * 113.2).toFixed(1));
      rects[1].setAttribute('fill', v < 100 ? 'var(--signal)' : 'var(--bar)');
      num.textContent = v.toFixed(1) + '%';
      var status = row.querySelector('.k-td:last-child .k-chip');
      if (status) { status.textContent = v < 100 ? 'Watch' : 'On track'; status.className = 'k-chip ' + (v < 100 ? 'k-chip--attention' : 'k-chip--positive'); }
    });
  }

  /* ---------- Rental listings: View ---------- */
  function applyView(root) {
    var main = root.querySelector('.kc-main--map');
    if (!main || !root.querySelector('.kc-seg[aria-label="View"]')) return;
    // the header is drawn again on every page render, so the pressed option is set from the kept state
    [].forEach.call(root.querySelectorAll('.kc-seg[aria-label="View"] button'), function (b) { b.setAttribute('aria-pressed', txt(b) === view ? 'true' : 'false'); });
    main.classList.toggle('ka-view-charts', view === 'Charts');
    main.classList.toggle('ka-view-table', view === 'Table');
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.kc-seg button, .k-tab') : null;
    if (!b) return;
    if (b.classList.contains('ka-inert')) { e.preventDefault(); return; }
    var seg = b.closest('.kc-seg'), group = seg && seg.getAttribute('aria-label'), root = document.getElementById('dc-root'), name = txt(b);
    if (!seg || b.getAttribute('aria-pressed') === 'true') return;
    if (group === 'Period' && name in PERIOD) { pressed(seg, b); period(root, name); }
    else if (group === 'Range' && name in RANGE) { pressed(seg, b); range(root, name); }
    else if (group === 'Compare with' && COMPARE[name]) { pressed(seg, b); compare(root, name); }
    else if (group === 'View') { view = name; applyView(root); window.dispatchEvent(new Event('resize')); }
  });

  (window.KartaHooks = window.KartaHooks || []).push(function (root) {
    // tabs: the open one stays, a tab that leads somewhere stays, the rest have no content
    [].forEach.call(root.querySelectorAll('.k-tab'), function (t) {
      if (t.getAttribute('aria-selected') === 'true' || t.__kgo || t.getAttribute('href')) return;
      inert(t);
    });
    [].forEach.call(root.querySelectorAll('.kc-seg'), function (seg) {
      if (WIRED[seg.getAttribute('aria-label')]) return;
      [].forEach.call(seg.querySelectorAll('button'), function (b) { if (b.getAttribute('aria-pressed') !== 'true' && !b.__kgo) inert(b); });
    });
    applyView(root);
  });
})();
