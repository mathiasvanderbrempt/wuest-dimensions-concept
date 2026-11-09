/* Live address search and building facts for the Add property flow.
   Address search: geo.admin.ch SearchServer. Building facts: federal building register (GWR) on api3.geo.admin.ch.
   Massing is approximated from the register footprint and floor count. Rent and value stay demo data. */
var LIVE = (function () {
  var API = 'https://api3.geo.admin.ch/rest/services';
  var timer = null, seq = 0;
  function fmtEgid(e) { return String(e).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function clean(s) { return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
  function parse(r) {
    var a = r.attrs || {}, lab = clean(a.label);
    var m = /^(.*?)\s+(\d{4})\s+(.*?)\s+([A-Z]{2})$/.exec(lab);
    var egid = String(a.featureId || '').split('_')[0];
    return { id: 'live:' + a.featureId, featureId: a.featureId, street: m ? m[1] : lab, town: m ? m[2] + ' ' + m[3] : '', canton: m ? m[4] : '', egid: fmtEgid(egid), live: true };
  }
  function search(q) {
    var url = API + '/api/SearchServer?searchText=' + encodeURIComponent(q) + '&type=locations&origins=address&limit=8&sr=4326';
    return fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      return (d.results || []).filter(function (r) { return r.attrs && r.attrs.featureId; }).map(parse);
    });
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function useOf(gkat) {
    return gkat === 1020 ? 'Residential' : gkat === 1030 || gkat === 1040 ? 'Mixed use' : gkat === 1060 ? 'Commercial' : gkat === 1010 ? 'Provisional' : gkat === 1080 ? 'Special use' : 'Building';
  }
  function building(entry) {
    var url = API + '/ech/MapServer/ch.bfs.gebaeude_wohnungs_register/' + encodeURIComponent(entry.featureId) + '?returnGeometry=false&lang=en';
    return fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      var g = (d.feature || {}).attributes || {};
      var F = clamp(Math.round(g.gastw || 3), 1, 14);
      var foot = g.garea || 180, long = Math.sqrt(foot * 1.6), short = foot / long;
      var areas = (g.warea || []).filter(function (x) { return typeof x === 'number'; });
      var living = areas.length ? areas.reduce(function (s, x) { return s + x; }, 0) : Math.round(foot * F * 0.8);
      var rnd = seeded(String(g.egid || entry.featureId));
      return Object.assign(entry, {
        W: clamp(Math.round(long / 5), 2, 10), D: clamp(Math.round(short / 5), 2, 7), F: F,
        year: g.gbauj || 'Unknown', area: living, units: g.ganzwhg != null ? g.ganzwhg : null,
        use: useOf(g.gkat), rent: Math.round(2600 + rnd() * 2200), value: living * (9000 + rnd() * 6000) / 1e6,
        live: true, pending: false
      });
    });
  }
  function resolve(x) {
    if (x.featureId) return building(x);
    return search(x.street + ' ' + x.town).then(function (res) {
      if (!res.length) throw new Error('not found');
      return building(Object.assign(x, { featureId: res[0].featureId, egid: res[0].egid }));
    });
  }
  function debounced(value, cb) {
    var q = String(value || '').toLowerCase().trim();
    clearTimeout(timer);
    if (q.length < 3) return;
    var my = ++seq;
    timer = setTimeout(function () {
      search(q).then(function (res) { if (my === seq) cb(q, res); }).catch(function () { if (my === seq) cb(q, []); });
    }, 220);
  }
  return { search: search, resolve: resolve, debounced: debounced };
})();
