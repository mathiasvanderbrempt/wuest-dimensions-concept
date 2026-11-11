/* Wüest Dimensions design concept and Karta concept app. © 2026 Mathias van der Brempt. All rights reserved.
   Entry screen: opens until the Concept Access Terms are accepted in this browser, and adds the concept notice with
   Terms and Privacy choices to the homepage footer and the Karta sidebar. The choice is recorded in the browser only.
   Google Analytics loads only while the Analytics choice is on, and only once GA below holds a measurement ID.
   Reset with ?gate=reset.

   To switch Google Analytics on: set GA to the G-… measurement ID, raise TERMS, and update legal-content.js
   (version line, privacy sections 1, 4 and 7) so the entry screen asks every visitor again before collection starts. */
(function () {
  // The 3D scene runs inside the homepage hero; the homepage already carries the entry screen
  if (window.top !== window.self) return;

  const KEY = 'wd-concept-access', TERMS = '0.1', KEEP = 183 * 864e5, q = new URLSearchParams(location.search);
  // The record counts for six months and for this terms version only; otherwise the entry screen asks again
  const read = () => { try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); return r && r.terms === TERMS && Date.now() - Date.parse(r.at) < KEEP ? r : null; } catch (e) { return null; } };
  const write = r => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) {} };
  if (q.get('gate') === 'reset') { try { localStorage.removeItem(KEY); } catch (e) {} }
  const on = (d, id) => d.querySelector('#' + id).getAttribute('aria-checked') === 'true';

  // Google Analytics: not connected yet. With an ID it loads only after an Analytics opt-in, never for advertising
  const GA = '';
  let gaLoaded = false;
  function analytics(enabled) {
    if (!GA) return;
    window['ga-disable-' + GA] = !enabled;
    if (!enabled) { if (gaLoaded) window.gtag('consent', 'update', { analytics_storage: 'denied' }); return; }
    if (gaLoaded) { window.gtag('consent', 'update', { analytics_storage: 'granted' }); return; }
    gaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', GA, { allow_google_signals: false, allow_ad_personalization_signals: false });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA;
    document.head.appendChild(s);
  }

  function entry() {
    const d = WDGate.gate({ active: !!GA });
    d.addEventListener('close', () => { if (d.returnValue === 'understood') { const r = { terms: TERMS, analytics: on(d, 'wdg-an'), at: new Date().toISOString() }; write(r); analytics(r.analytics); d.remove(); } });
  }
  function choices() {
    const r = read() || { terms: TERMS, analytics: false };
    const d = WDGate.choices({ analytics: r.analytics, terms: r.terms, at: r.at, active: !!GA });
    d.addEventListener('close', () => { if (d.returnValue === 'save') { const n = Object.assign({}, r, { analytics: on(d, 'wdg-c-an'), changed: new Date().toISOString() }); write(n); analytics(n.analytics); } });
  }

  // The concept notice with its two links, outside the dialogs
  const LINKS = '<a tabindex="0" data-doc="terms">Terms</a> · <a tabindex="0" data-pc>Privacy choices</a>';
  function wire(el) {
    WDGate.wireDocs(el);
    const a = el.querySelector('[data-pc]');
    a.addEventListener('click', choices);
    a.addEventListener('keydown', e => { if (e.key === 'Enter') choices(); });
  }
  // Homepage: at the end of the existing footer line
  const foot = document.querySelector('[data-wd-legal]');
  if (foot) { const s = document.createElement('span'); s.className = 'wdg-foot'; s.innerHTML = ' ' + LINKS; foot.appendChild(s); wire(s); }
  // Karta app: under the user row in the sidebar. The app redraws its template, so the note is put back after each render
  let side = null;
  function sidebar(root) {
    const aside = (root || document).querySelector('.kc-app > .k-sidebar');
    if (!aside || aside.querySelector('.wdg-side')) return;
    if (!side) {
      side = document.createElement('p'); side.className = 'wdg-side'; side.__inj = true;
      side.innerHTML = 'Design concept by Mathias van der Brempt. Not an official Wüest Partner product. Figures are demo data. ' + LINKS;
      wire(side);
    }
    aside.appendChild(side);
  }
  (window.KartaHooks = window.KartaHooks || []).push(sidebar);
  sidebar(document);

  const saved = read();
  if (!saved) entry(); else if (saved.analytics) analytics(true);
})();
