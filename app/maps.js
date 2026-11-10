/* Karta concept app: live maps. MapLibre GL draws swisstopo base maps that pan and zoom.
   Market map: demo cells, properties and the selected municipality are map layers.
   Location quality and Rental listings: the page keeps its own SVG overlay (rating grid, noise, radius, listings),
   and this file moves that overlay with the map. Every overlay value is demo data; the base map is swisstopo. */
(function () {
  if (!window.maplibregl) return;
  var VT = 'https://vectortiles.geo.admin.ch/styles/';
  var STYLES = { Neutral: VT + 'ch.swisstopo.lightbasemap.vt/style.json', Plan: VT + 'ch.swisstopo.basemap.vt/style.json', Satellite: VT + 'ch.swisstopo.imagerybasemap.vt/style.json' };
  var SWISS = [[5.6, 45.6], [10.9, 48.0]];
  var cache = {};

  function token(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  // LV95 (E, N in metres) to WGS84, swisstopo approximate formulas (about 1 m)
  function lv95(E, N) {
    var y = (E - 2600000) / 1e6, x = (N - 1200000) / 1e6;
    var lon = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
    var lat = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.0140 * x * x * x;
    return [lon * 100 / 36, lat * 100 / 36];
  }
  function hash(a, b, s) {
    var h = Math.imul(a * 374761393 + b * 668265263 + s * 2147483647, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // the light base map recoloured to the concept's map tokens: quiet land, water and roads, few labels
  function neutral(style) {
    var land = token('--map-land', '#f3f3f5'), water = token('--map-water', '#cfe0ea'), park = token('--map-park', '#e3ecdf');
    var casing = token('--map-road-casing', '#dcdce1'), label = token('--map-label', '#5e5a70'), boundary = token('--map-boundary', '#b9b6c9');
    var drop = /^(hillshade|scree|contour|hachure|spot_elevation|pattern_landcover|hazard|poi_|peaks_|aerodrome|area_name|road_number|park$|park_label|boundary_disputed|construct|landuse_outline|landuse_parking|landcover_casing|road_via_ferrata|aeroway|building_ln|water_line_intermittent)/;
    style.layers = style.layers.filter(function (l) { return !drop.test(l.id); });
    style.layers.forEach(function (l) {
      var p = l.paint = l.paint || {}, id = l.id;
      if (l.type === 'background') p['background-color'] = land;
      else if (id === 'landcover') { p['fill-color'] = park; p['fill-opacity'] = 0.9; delete p['fill-pattern']; }
      else if (id === 'landuse') { p['fill-color'] = park; p['fill-opacity'] = 0.55; delete p['fill-pattern']; }
      else if (id === 'water') { p['fill-color'] = water; delete p['fill-pattern']; }
      else if (id === 'water_outline' || id === 'water_line') p['line-color'] = water;
      else if (id === 'boundary') { p['line-color'] = boundary; }
      else if (/casing$/.test(id) && l.type === 'line' && id !== 'building_casing') p['line-color'] = casing;
      else if (/(_fill|road_fill)$/.test(id) && l.type === 'line') p['line-color'] = '#ffffff';
      else if (/public_transport/.test(id)) { p['line-color'] = '#a3a3a9'; }
      else if (/^tunnel|pedestrian|footway/.test(id)) p['line-color'] = casing;
      else if (id === 'building') { p['fill-color'] = '#e2e2e6'; delete p['fill-pattern']; }
      else if (id === 'building_casing') p['line-color'] = '#d3d3d8';
      else if (l.type === 'symbol') {
        var isWater = /water/.test(id), lay = l.layout = l.layout || {};
        p['text-color'] = isWater ? '#6f8a96' : label;
        p['text-halo-color'] = isWater ? water : land;
        p['text-halo-width'] = 1.5;
        p['icon-opacity'] = 0;
        // quieter labels: sentence case, about two thirds of the swisstopo size
        delete lay['text-transform'];
        if (lay['text-size'] != null) lay['text-size'] = scaled(lay['text-size'], /^place/.test(id) ? 0.6 : 0.8);
        lay['text-letter-spacing'] = 0.02;
      }
      if (l.type === 'line' && /(road|l1_|l2_|tunnel)/.test(id)) p['line-opacity'] = ['interpolate', ['linear'], ['zoom'], 10, 0.25, 13, 1];
    });
    return style;
  }
  // multiply the outputs of a size expression (zoom stops, interpolate, step, match, case)
  function scaled(e, k) {
    if (typeof e === 'number') return Math.round(e * k * 10) / 10;
    if (e && !Array.isArray(e) && e.stops) return Object.assign({}, e, { stops: e.stops.map(function (st) { return [st[0], scaled(st[1], k)]; }) });
    if (!Array.isArray(e)) return e;
    var op = e[0], out = e.slice(), i;
    if (op === 'interpolate' || op === 'interpolate-hcl' || op === 'interpolate-lab') { for (i = 4; i < out.length; i += 2) out[i] = scaled(out[i], k); }
    else if (op === 'step') { out[2] = scaled(out[2], k); for (i = 4; i < out.length; i += 2) out[i] = scaled(out[i], k); }
    else if (op === 'match') { for (i = 3; i < out.length; i += 2) out[i] = scaled(out[i], k); out[out.length - 1] = scaled(out[out.length - 1], k); }
    else if (op === 'case') { for (i = 2; i < out.length; i += 2) out[i] = scaled(out[i], k); out[out.length - 1] = scaled(out[out.length - 1], k); }
    return out;
  }
  function loadStyle(name) {
    if (!cache[name]) cache[name] = fetch(STYLES[name]).then(function (r) { return r.json(); }).then(function (s) { return name === 'Neutral' ? neutral(s) : s; });
    return cache[name];
  }
  function firstSymbol(map) {
    var ls = map.getStyle().layers;
    for (var i = 0; i < ls.length; i++) if (ls[i].type === 'symbol') return ls[i].id;
    return undefined;
  }

  // one map per page: the element is kept across page renders and put back into its slot
  function create(opts) {
    var el = document.createElement('div');
    el.className = 'ka-map'; el.__inj = true;
    el.setAttribute('role', 'application'); el.setAttribute('aria-label', opts.label);
    opts.slot.insertBefore(el, opts.slot.firstChild);
    var map = new maplibregl.Map({
      container: el, style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': token('--map-land', '#f3f3f5') } }] },
      center: opts.center, zoom: opts.zoom, minZoom: opts.minZoom || 8, maxZoom: 18.5, maxBounds: SWISS,
      attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false, cooperativeGestures: true, fadeDuration: 0
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    var api = { map: map, el: el, base: 'Neutral', ready: false };
    api.setBase = function (name) {
      api.base = name;
      return loadStyle(name).then(function (s) {
        if (api.base !== name) return;
        map.once('style.load', function () { api.ready = true; if (opts.layers) opts.layers(map, api); });
        map.setStyle(JSON.parse(JSON.stringify(s)), { diff: false });
      }, function () { el.classList.add('ka-map--offline'); });
    };
    api.setBase('Neutral');
    return api;
  }

  /* ---------------- Location quality and Rental listings: overlay that follows the map ---------------- */
  var GEO = {
    location: { E: 2684204.25, N: 1245928.0, px: 930, py: 300, pxm: 0.7644, label: 'Map around Seefeld Residences' },
    listings: { E: 2500130, N: 1117912, px: 860, py: 300, pxm: 0.518, label: 'Map of rental listings, Geneva centre' }
  };
  var page = null, geo = null, legendOff = false, full = false, ratingOn = false, failed = false, starting = false;

  function toLngLat(g, x, y) { return lv95(g.E + (x - g.px) / g.pxm, g.N - (y - g.py) / g.pxm); }
  function sync() {
    if (!page || !geo) return;
    var slot = page.el.parentNode, svg = slot && slot.querySelector('svg.ka-ov');
    if (!svg) return;
    var m = page.map, p0 = m.project(toLngLat(geo, geo.px, geo.py)), p1 = m.project(toLngLat(geo, geo.px + 1000, geo.py)), p2 = m.project(toLngLat(geo, geo.px, geo.py + 1000));
    var a = (p1.x - p0.x) / 1000, b = (p1.y - p0.y) / 1000, c = (p2.x - p0.x) / 1000, d = (p2.y - p0.y) / 1000;
    var e = p0.x - a * geo.px - c * geo.py, f = p0.y - b * geo.px - d * geo.py;
    var g = svg.querySelector('.ka-geo');
    if (g) g.setAttribute('transform', 'matrix(' + [a, b, c, d, e, f].map(function (v) { return v.toFixed(5); }).join(' ') + ')');
    // points keep their size: only their position follows the map
    var pts = svg.querySelectorAll('.ka-pts circle, .ka-pts text, .ka-pts .ka-pin');
    for (var i = 0; i < pts.length; i++) {
      var n = pts[i], pin = n.classList.contains('ka-pin');
      if (!pin && n.closest('.ka-pin')) continue;
      var ax = pin ? null : (n.localName === 'circle' ? 'cx' : 'x'), ay = pin ? null : (n.localName === 'circle' ? 'cy' : 'y');
      if (n.__gx == null) { n.__gx = parseFloat(pin ? n.getAttribute('data-gx') : n.getAttribute(ax)); n.__gy = parseFloat(pin ? n.getAttribute('data-gy') : n.getAttribute(ay)); }
      var x = a * n.__gx + c * n.__gy + e, y = b * n.__gx + d * n.__gy + f;
      if (pin) n.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
      else { n.setAttribute(ax, x.toFixed(1)); n.setAttribute(ay, y.toFixed(1)); }
    }
  }
  function homeZoom(g) {
    var lat = toLngLat(g, g.px, g.py)[1];
    return Math.log(78271.517 * Math.cos(lat * Math.PI / 180) * g.pxm) / Math.LN2;
  }
  function home(ms) {
    var el = page.el;
    page.map.easeTo({ center: toLngLat(geo, geo.px, geo.py), zoom: homeZoom(geo), offset: [geo.px - el.clientWidth / 2, geo.py - el.clientHeight / 2], duration: ms || 0 });
  }
  // demo rating cells for the listings map, same palette as Location quality
  function ratingCells() {
    var ramp = ['#e5484d', '#f27930', '#f5ad2d', '#aec746', '#3dae5c'], feats = [], S = 100;
    for (var i = -11; i <= 11; i++) for (var j = -9; j <= 9; j++) {
      var E = geo.E + i * S, N = geo.N + j * S;
      var v = 0.5 + 0.28 * Math.sin(i * 0.42 + 1.3) * Math.cos(j * 0.37 - 0.6) + 0.22 * Math.sin((i + j) * 0.23) + (hash(i + 40, j + 40, 7) - 0.5) * 0.22;
      var k = Math.max(0, Math.min(4, Math.floor(v * 5)));
      feats.push({ type: 'Feature', properties: { c: ramp[k] }, geometry: { type: 'Polygon', coordinates: [[lv95(E, N), lv95(E + S, N), lv95(E + S, N + S), lv95(E, N + S), lv95(E, N)]] } });
    }
    return { type: 'FeatureCollection', features: feats };
  }
  function overlayLayers(map) {
    if (document.querySelector('.kc-ls-map') && !map.getSource('ka-rating')) {
      map.addSource('ka-rating', { type: 'geojson', data: ratingCells() });
      map.addLayer({ id: 'ka-rating', type: 'fill', source: 'ka-rating', layout: { visibility: ratingOn ? 'visible' : 'none' }, paint: { 'fill-color': ['get', 'c'], 'fill-opacity': 0.42 } }, firstSymbol(map));
    }
    sync();
  }
  function setPressed(group, btn) {
    [].forEach.call(group.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
  }

  /* ---------------- Market map ---------------- */
  var market = null, mLayer = 'price', mPins = true, mCells = true;
  var KUSNACHT = null;
  var M_LAYERS = {
    'Price per m²': { key: 'price', title: 'Asking price per m², CHF', scale: ['8’000', '13’000', '24’000'], cuts: [9000, 10500, 12000, 13500, 16000, 19500] },
    'Change 12M': { key: 'chg', title: 'Change in asking price, 12 months', scale: ['−2%', '+2%', '+6%'], cuts: [-1, 0.5, 1.5, 2.5, 3.5, 4.5] },
    'Days on market': { key: 'dom', title: 'Days on market, median', scale: ['25', '50', '85'], cuts: [32, 40, 48, 56, 66, 76] },
    'Listings': { key: 'lst', title: 'Active listings per cell', scale: ['1', '10', '40'], cuts: [2, 5, 9, 15, 24, 34] }
  };
  function segDist(E, N, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((E - a[0]) * dx + (N - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(E - a[0] - t * dx, N - a[1] - t * dy) / 1000;
  }
  function cls(v, cuts) { var k = 1; cuts.forEach(function (c) { if (v >= c) k++; }); return k; }
  function marketCells() {
    var R = 600, W = Math.sqrt(3) * R, H = 1.5 * R, r = R * 0.94, feats = [], row = 0;
    var hb = [2683100, 1247900], lakeA = [2683400, 1246300], lakeB = [2704600, 1231200];
    for (var N = 1204000; N <= 1272000; N += H, row++) {
      var col = 0;
      for (var E = 2656000 + (row % 2 ? W / 2 : 0); E <= 2734000; E += W, col++) {
        var dZ = Math.hypot(E - hb[0], N - hb[1]) / 1000, dL = segDist(E, N, lakeA, lakeB);
        var n1 = hash(col, row, 1), n2 = hash(col, row, 2), n3 = hash(col, row, 3), n4 = hash(col, row, 4);
        var price = 19500 * Math.exp(-dZ / 24) * (1 + 0.42 * Math.exp(-dL / 3.5)) * (0.9 + 0.2 * n1);
        var chg = 1.2 + 3.6 * Math.exp(-dL / 3) - dZ * 0.06 + (n2 - 0.5) * 3.2;
        var dom = 30 + dZ * 1.7 - 9 * Math.exp(-dL / 3) + n3 * 22;
        var lst = 46 * Math.exp(-dZ / 6) * (0.4 + 1.2 * n4) + 7 * Math.exp(-dL / 2) * (0.3 + n4);
        var ring = [];
        for (var k = 0; k <= 6; k++) { var t = (30 + 60 * k) * Math.PI / 180; ring.push(lv95(E + r * Math.cos(t), N + r * Math.sin(t))); }
        feats.push({ type: 'Feature', properties: { price: cls(price, M_LAYERS['Price per m²'].cuts), chg: cls(chg, M_LAYERS['Change 12M'].cuts), dom: cls(dom, M_LAYERS['Days on market'].cuts), lst: cls(lst, M_LAYERS['Listings'].cuts) }, geometry: { type: 'Polygon', coordinates: [ring] } });
      }
    }
    return { type: 'FeatureCollection', features: feats };
  }
  // 34 properties, spread like the portfolio: Zürich, Zug, the gold coast, March and Höfe
  function marketPins() {
    var towns = [[2684300, 1245700, 9, 700], [2682700, 1248600, 4, 900], [2681700, 1224700, 7, 800], [2686900, 1241500, 3, 500], [2685900, 1243900, 2, 400], [2701700, 1228300, 3, 500], [2699300, 1228900, 2, 400], [2687900, 1234400, 2, 500], [2693500, 1230900, 1, 300], [2691800, 1236400, 1, 300]];
    var feats = [], n = 0;
    towns.forEach(function (t, ti) {
      for (var k = 0; k < t[2]; k++, n++) {
        var ang = hash(ti, k, 11) * Math.PI * 2, rad = Math.sqrt(hash(ti, k, 12)) * t[3];
        feats.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: lv95(t[0] + Math.cos(ang) * rad, t[1] + Math.sin(ang) * rad) } });
      }
    });
    return { type: 'FeatureCollection', features: feats };
  }
  function ramp() { return [1, 2, 3, 4, 5, 6, 7].map(function (i) { return token('--viz-seq-' + i, '#999'); }); }
  function cellColor() {
    var r = ramp(), ex = ['match', ['get', mLayer]];
    r.forEach(function (c, i) { ex.push(i + 1, c); });
    ex.push(r[0]);
    return ex;
  }
  function marketLayers(map) {
    if (map.getSource('ka-cells')) return;
    var sig = token('--signal', '#FA5848'), dark = token('--inverse', '#1B1838');
    map.addSource('ka-cells', { type: 'geojson', data: marketCells() });
    map.addLayer({ id: 'ka-cells', type: 'fill', source: 'ka-cells', layout: { visibility: mCells ? 'visible' : 'none' }, paint: { 'fill-color': cellColor(), 'fill-opacity': 0.85 } }, map.getLayer('water') ? 'water' : firstSymbol(map));
    if (KUSNACHT) {
      map.addSource('ka-sel', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: KUSNACHT } } });
      map.addLayer({ id: 'ka-sel-fill', type: 'fill', source: 'ka-sel', paint: { 'fill-color': sig, 'fill-opacity': 0.1 } }, firstSymbol(map));
      map.addLayer({ id: 'ka-sel-line', type: 'line', source: 'ka-sel', layout: { 'line-join': 'round' }, paint: { 'line-color': sig, 'line-width': 2 } }, firstSymbol(map));
      map.on('click', 'ka-sel-fill', function () { market.el.parentNode.classList.remove('ka-pop-off'); });
      map.on('mouseenter', 'ka-sel-fill', function () { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'ka-sel-fill', function () { map.getCanvas().style.cursor = ''; });
    }
    map.addSource('ka-pins', { type: 'geojson', data: marketPins() });
    map.addLayer({ id: 'ka-pins', type: 'circle', source: 'ka-pins', layout: { visibility: mPins ? 'visible' : 'none' }, paint: { 'circle-radius': 3.5, 'circle-color': dark, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } });
  }
  var KUS_C = [8.5836, 47.3165];
  function marketPop() {
    if (!market) return;
    var p = market.map.project(KUS_C), slot = market.el.parentNode;
    slot.style.setProperty('--ka-pop-x', Math.round(p.x + 60) + 'px');
    slot.style.setProperty('--ka-pop-y', Math.round(p.y - 46) + 'px');
  }
  function marketInit(slot) {
    market = create({ slot: slot, label: 'Market map of the Zürichsee region', center: [8.672, 47.288], zoom: 10.35, minZoom: 8.5, layers: marketLayers });
    var m = market.map;
    m.fitBounds([[8.47, 47.165], [8.875, 47.405]], { duration: 0 });
    [[8.5417, 47.372, '64'], [8.652, 47.268, '18'], [8.781, 47.203, '9']].forEach(function (c) {
      var d = document.createElement('div'); d.className = 'ka-cluster'; d.textContent = c[2]; d.setAttribute('aria-label', c[2] + ' listings');
      new maplibregl.Marker({ element: d }).setLngLat([c[0], c[1]]).addTo(m);
    });
    var dot = document.createElement('div'); dot.className = 'ka-seldot';
    new maplibregl.Marker({ element: dot }).setLngLat(KUS_C).addTo(m);
    m.on('move', marketPop); marketPop();
    slot.classList.add('ka-map-live');
  }
  function marketLegend(slot, def) {
    var t = slot.querySelector('.k-legend-title'), s = slot.querySelectorAll('.k-legend-scale span');
    if (t) t.textContent = def.title;
    [].forEach.call(s, function (el, i) { if (def.scale[i] != null) el.textContent = def.scale[i]; });
  }

  /* ---------------- controls ---------------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b) return;
    var label = b.getAttribute('aria-label') || b.textContent.trim();
    var api = b.closest('.kc-map') ? market : (b.closest('.kc-lq-stage') ? page : null);
    if (!api) return;
    var map = api.map, slot = api.el.parentNode;
    if (b.closest('.kc-map-ctrl')) {
      if (label === 'Zoom in') map.zoomIn();
      else if (label === 'Zoom out') map.zoomOut();
      else if (label === 'Centre on property' || label === 'Reset view') home(500);
      else if (label === 'Map layers') { legendOff = !legendOff; b.setAttribute('aria-pressed', String(!legendOff)); applyStage(); }
      else if (label === 'Full screen' || label === 'Exit full screen') { full = !full; applyStage(); }
      else if (label === 'My properties') { mPins = !mPins; b.setAttribute('aria-pressed', String(mPins)); if (map.getLayer('ka-pins')) map.setLayoutProperty('ka-pins', 'visibility', mPins ? 'visible' : 'none'); }
      else if (label === 'Layers') {
        mCells = !mCells; b.setAttribute('aria-pressed', String(mCells)); slot.classList.toggle('ka-cells-off', !mCells);
        if (map.getLayer('ka-cells')) map.setLayoutProperty('ka-cells', 'visibility', mCells ? 'visible' : 'none');
      }
      return;
    }
    var seg = b.closest('.kc-seg');
    if (seg && api === market && seg.getAttribute('aria-label') === 'Map layer' && M_LAYERS[label]) {
      setPressed(seg, b); mLayer = M_LAYERS[label].key;
      if (map.getLayer('ka-cells')) map.setPaintProperty('ka-cells', 'fill-color', cellColor());
      marketLegend(slot, M_LAYERS[label]);
    } else if (seg && api === page && seg.getAttribute('aria-label') === 'Base map' && STYLES[label]) {
      setPressed(seg, b); page.setBase(label);
    } else if (api === market && label === 'Close' && b.closest('.kc-glass')) slot.classList.add('ka-pop-off');
  });
  document.addEventListener('change', function (e) {
    var c = e.target;
    if (!page || !c.matches || !c.matches('.kc-ls-layers input[aria-label="Rental apartment rating"]')) return;
    ratingOn = c.checked;
    if (page.map.getLayer('ka-rating')) page.map.setLayoutProperty('ka-rating', 'visibility', ratingOn ? 'visible' : 'none');
  });
  function applyStage() {
    var main = document.querySelector('.kc-main--map'), stage = main && main.querySelector('.kc-lq-stage');
    if (!stage) return;
    stage.classList.toggle('ka-legend-off', legendOff);
    main.classList.toggle('ka-map-full', full);
    var fs = stage.querySelector('button[aria-label="Full screen"], button[aria-label="Exit full screen"]');
    if (fs) { fs.setAttribute('aria-label', full ? 'Exit full screen' : 'Full screen'); fs.setAttribute('aria-pressed', String(full)); }
    var ly = stage.querySelector('button[aria-label="Map layers"]');
    if (ly) ly.setAttribute('aria-pressed', String(!legendOff));
    if (page) [].forEach.call(stage.querySelectorAll('.kc-seg[aria-label="Base map"] button'), function (b) { b.setAttribute('aria-pressed', b.textContent.trim() === page.base ? 'true' : 'false'); });
    var rc = stage.querySelector('.kc-ls-layers input[aria-label="Rental apartment rating"]');
    if (rc) rc.checked = ratingOn;
  }

  (window.KartaHooks = window.KartaHooks || []).push(function (root) {
    if (failed) return;
    var ms = root.querySelector('.kc-map');
    if (ms && !market) {
      if (!starting) { starting = true; fetchKusnacht().then(function () { try { marketInit(ms); } catch (e) { failed = true; ms.classList.add('ka-map-none'); } }); }
      return;
    }
    var slot = root.querySelector('.kc-lq-map');
    if (!slot) return;
    if (!page) {
      geo = slot.classList.contains('kc-ls-map') ? GEO.listings : GEO.location;
      // without WebGL the page keeps its overlay on the plain land colour
      try { page = create({ slot: slot, label: geo.label, center: toLngLat(geo, geo.px, geo.py), zoom: homeZoom(geo), minZoom: 11, layers: overlayLayers }); }
      catch (e) { failed = true; page = null; var dead = slot.querySelector('.ka-map'); if (dead) dead.remove(); return; }
      home(0);
      page.map.on('move', sync);
      page.map.on('resize', sync);
    } else if (page.el.parentNode !== slot) {
      slot.insertBefore(page.el, slot.firstChild);
    }
    applyStage();
    sync();
  });
  window.KartaMaps = { get market() { return market; }, get page() { return page; } };
  function fetchKusnacht() {
    return fetch('kusnacht.json').then(function (r) { return r.json(); }).then(function (d) { KUSNACHT = d; }, function () { KUSNACHT = null; });
  }
})();
