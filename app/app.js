/* Karta concept app: page links for the sidebar and in-page entry points. */
(function () {
  var NAV = { 'Portfolio': './', 'Properties': 'property.html', 'Market map': 'market.html', 'Performance': 'performance.html' };
  var EXTRA = [
    // [selector, label text, target]
    ['.kc-seg--scene button', 'Location', 'location.html'],
    ['.k-tab', 'Rents', 'listings.html']
  ];
  function go(href) { return function (e) { e.preventDefault(); window.location.href = href; }; }
  window.KartaApp = {
    afterRender: function (root) {
      root.querySelectorAll('a.k-nav-item').forEach(function (a) {
        var label = (a.querySelector('span') || a).textContent.trim();
        if (NAV[label]) a.setAttribute('href', NAV[label]);
        else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.title = 'Not part of this concept'; a.style.cursor = 'default'; }
      });
      EXTRA.forEach(function (x) {
        if (x[2] === 'location.html' && !/property\.html$/.test(location.pathname)) return;
        root.querySelectorAll(x[0]).forEach(function (b) {
          if (b.textContent.trim() === x[1] && !b.__kgo) { b.__kgo = 1; b.addEventListener('click', go(x[2])); }
        });
      });
    }
  };
})();
