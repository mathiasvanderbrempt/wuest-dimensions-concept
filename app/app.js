/* Karta concept app: page links for the sidebar and in-page entry points, keyboard access for clickable rows,
   and the navigation drawer used below 1280px (see responsive.css). */
(function () {
  var NAV = { 'Portfolio': './', 'Properties': 'property.html', 'Market map': 'market.html', 'Performance': 'performance.html' };
  var EXTRA = [
    // [selector, label text, target]
    ['.kc-seg--scene button', 'Location', 'location.html'],
    ['.k-tab', 'Rents', 'listings.html']
  ];
  var NARROW = window.matchMedia('(max-width: 1279px)');
  var ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var ICON_PANEL = ICON + '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>';
  var ICON_MENU = ICON + '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>';
  var open = false, root = null, topbar = null, railBtn = null, scrim = null;

  function go(href) { return function (e) { e.preventDefault(); window.location.href = href; }; }
  function button(cls, icon) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.innerHTML = icon; b.__inj = true;
    b.addEventListener('click', function () { setOpen(!open, b); });
    return b;
  }
  function label(b, text) { b.setAttribute('aria-label', text); b.title = text; b.setAttribute('aria-expanded', String(open)); }

  // the drawer: below 1280px the sidebar is an icon rail (or hidden under the phone top bar) and opens over the page
  function apply() {
    if (!root) return;
    var aside = root.querySelector('.kc-app > .k-sidebar');
    if (!aside) return;
    var on = open && NARROW.matches;
    document.documentElement.classList.toggle('ka-nav-open', on);
    if (aside.__mini == null) aside.__mini = aside.classList.contains('kc-nav-mini');
    aside.classList.toggle('kc-nav-mini', aside.__mini && !on);
    aside.id = 'ka-nav';
    label(railBtn, on ? 'Close navigation' : 'Open navigation');
    label(topbar.lastChild, on ? 'Close navigation' : 'Open navigation');
  }
  function setOpen(v, from) {
    open = v; apply();
    var aside = root && root.querySelector('.kc-app > .k-sidebar');
    if (!aside) return;
    if (open) { var first = aside.querySelector('a.k-nav-item[href]'); if (first) first.focus(); }
    else if (from && from.offsetParent) from.focus();
    else if (topbar.lastChild.offsetParent) topbar.lastChild.focus();
    else railBtn.focus();
  }
  function chrome(app, aside) {
    if (!topbar) {
      topbar = document.createElement('header'); topbar.className = 'ka-topbar'; topbar.__inj = true;
      var brand = document.createElement('a'); brand.__inj = true; brand.className = 'ka-topbar-brand'; brand.href = './'; brand.setAttribute('aria-label', 'Wüest Dimensions, portfolio');
      var ws = aside.querySelector('.k-ws');
      if (ws) ['.k-ws-tile', '.k-ws-name'].forEach(function (s) { var n = ws.querySelector(s); if (n) { n = n.cloneNode(true); n.setAttribute('aria-hidden', 'true'); brand.appendChild(n); } });
      topbar.appendChild(brand);
      topbar.appendChild(button('k-iconbtn ka-menu', ICON_MENU));
      railBtn = button('k-iconbtn kc-nav-toggle ka-rail-toggle', ICON_PANEL);
      scrim = document.createElement('div'); scrim.className = 'ka-scrim'; scrim.__inj = true;
      scrim.addEventListener('click', function () { setOpen(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open && NARROW.matches) setOpen(false); });
      NARROW.addEventListener('change', apply);
    }
    app.insertBefore(topbar, app.firstChild);
    app.appendChild(scrim);
    var top = aside.querySelector('.kc-nav-top') || aside.querySelector('.k-ws');
    if (top && top.parentNode === aside) aside.insertBefore(railBtn, top.nextSibling);
  }

  // map pages: tell the CSS where the stage sits, so the page map stays under it when the header wraps or the columns stack
  function stage() {
    var main = root && root.querySelector('.kc-main--map'), st = main && main.querySelector('.kc-lq-stage');
    if (!st) return;
    var m = main.getBoundingClientRect(), r = st.getBoundingClientRect();
    main.style.setProperty('--ka-stage-x', Math.round(r.left - m.left) + 'px');
    main.style.setProperty('--ka-stage-y', Math.round(r.top - m.top) + 'px');
    main.style.setProperty('--ka-stage-w', Math.round(r.width) + 'px');
  }
  window.addEventListener('resize', stage);
  window.addEventListener('load', stage);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(stage);

  window.KartaApp = {
    afterRender: function (r) {
      root = r;
      root.querySelectorAll('a.k-nav-item').forEach(function (a) {
        var label = (a.querySelector('span') || a).textContent.trim();
        if (NAV[label]) { a.setAttribute('href', NAV[label]); if (!a.title) a.title = label; }
        else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.title = label + ', not part of this concept'; a.style.cursor = 'default'; }
      });
      EXTRA.forEach(function (x) {
        if (x[2] === 'location.html' && !/property\.html$/.test(location.pathname)) return;
        root.querySelectorAll(x[0]).forEach(function (b) {
          if (b.textContent.trim() === x[1] && !b.__kgo) { b.__kgo = 1; b.addEventListener('click', go(x[2])); }
        });
      });
      // placeholder links: stay on the page instead of jumping to the top
      root.querySelectorAll('a[href="#"]').forEach(function (a) {
        if (!a.__knop) { a.__knop = 1; a.addEventListener('click', function (e) { e.preventDefault(); }); }
      });
      // rows that act on click (map layer, linked selection) are reachable and operable from the keyboard
      root.querySelectorAll('.k-row.is-layer').forEach(function (row) {
        if (row.__kkey) return;
        row.__kkey = 1; row.tabIndex = 0;
        row.addEventListener('keydown', function (e) {
          if (e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); row.click(); }
        });
      });
      var app = root.querySelector('.kc-app'), aside = app && app.querySelector(':scope > .k-sidebar');
      if (app && aside) { chrome(app, aside); apply(); }
      stage();
      // page add-ons (maps.js, switches.js) run after every render
      (window.KartaHooks || []).forEach(function (fn) { try { fn(root); } catch (e) { if (window.console) console.warn(e); } });
    }
  };
})();
