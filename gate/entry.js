/* Wüest Dimensions design concept and Karta concept app. © 2026 Mathias van der Brempt. All rights reserved.
   The entry screen, Privacy choices and the documents reader. This file only builds the dialogs; gate.js decides when they open
   and keeps the record. The documents come from legal-content.js. */
(function () {
  const L = window.WD_LEGAL;
  const sw = (id, label, on) => `<div class="wdg-row"><span id="${id}-l">${label}</span><button type="button" class="wdg-sw" id="${id}" role="switch" aria-checked="${on}" aria-labelledby="${id}-l"><i></i><span class="st">${on ? 'On' : 'Off'}</span></button></div>`;
  const flip = b => { const on = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', on); b.querySelector('.st').textContent = on ? 'On' : 'Off'; };
  const make = (cls, html, label) => { const d = document.createElement('dialog'); d.className = 'wdg ' + cls; d.setAttribute('aria-labelledby', label); d.innerHTML = html; document.body.appendChild(d); return d; };
  const pending = active => active ? '' : '<p class="wdg-note">Analytics is not active yet, so nothing is collected for now. Your choice is saved.</p>';

  function gate({ active = false } = {}) {
    const d = make('wdg-gate', `<div class="wdg-box" tabindex="-1">
      <div><h2 id="wdg-title">Before you explore<span>.</span></h2>
        <div class="wdg-copy"><p id="wdg-concept">This is an independent design concept by Mathias van der Brempt. It is not an official Wüest Partner website or product.</p>
        <p id="wdg-ip">This is protected design work: please don’t copy it, share it publicly or upload it to AI tools.</p>
        <p id="wdg-desc">By selecting “I understand”, you agree to the <a data-doc="terms" tabindex="0">Concept Access Terms</a>.</p></div></div>
      <div>${sw('wdg-an', 'Analytics', true)}${pending(active)}</div>
      <button type="button" class="wdg-btn wdg-go" id="wdg-go">I understand</button>
      <nav class="wdg-links" aria-label="Documents"><a data-doc="terms" tabindex="0">Terms</a><a data-doc="privacy" tabindex="0">Privacy</a><a data-doc="contact" tabindex="0">Contact</a></nav>
    </div>`, 'wdg-title');
    // "I understand" is the only way in. closedby=none ignores Escape where supported; elsewhere the dialog opens again.
    d.setAttribute('closedby', 'none'); d.setAttribute('aria-describedby', 'wdg-concept wdg-ip wdg-desc');
    d.addEventListener('cancel', e => e.preventDefault());
    d.addEventListener('close', () => { if (d.returnValue !== 'understood') { d.showModal(); d.querySelector('.wdg-box').focus(); } });
    d.querySelector('#wdg-an').addEventListener('click', e => flip(e.currentTarget));
    d.querySelector('#wdg-go').addEventListener('click', () => d.close('understood'));
    wireDocs(d); d.showModal(); d.querySelector('.wdg-box').focus(); return d;
  }

  function choices({ analytics = true, terms = '', at = '', active = false } = {}) {
    const day = at ? new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const d = make('wdg-gate', `<div class="wdg-box" tabindex="-1">
      <div class="wdg-head"><div><h2 id="wdg-c-title">Privacy choices</h2><div class="wdg-copy"><p>Change or withdraw your choice at any time.</p></div></div><button type="button" class="wdg-x" aria-label="Close">×</button></div>
      <div>${sw('wdg-c-an', 'Analytics', analytics)}
        <p class="wdg-note">${active ? 'Switching it off stops future collection. Records already collected are not deleted automatically; <a data-doc="contact" tabindex="0">ask us</a> about deletion.' : 'Analytics is not active yet, so nothing is collected for now. The entry screen will ask again before it starts.'}</p></div>
      ${day ? `<p class="wdg-rec">Concept Access Terms ${terms} agreed on ${day} in this browser.</p>` : ''}
      <div class="wdg-acts"><button type="button" class="wdg-btn2" data-x>Cancel</button><button type="button" class="wdg-btn" data-x="save">Save</button></div>
    </div>`, 'wdg-c-title');
    d.querySelector('#wdg-c-an').addEventListener('click', e => flip(e.currentTarget));
    d.querySelectorAll('.wdg-x, [data-x]').forEach(b => b.addEventListener('click', () => d.close(b.dataset.x === 'save' ? 'save' : '')));
    d.addEventListener('close', () => d.remove());
    wireDocs(d); d.showModal(); d.querySelector('.wdg-box').focus(); return d;
  }

  function reader(kind = 'terms') {
    const d = make('wdg-read', `<div class="wdg-box" tabindex="-1">
      <header><div><h2 id="wdg-r-title"></h2><p id="wdg-r-meta"></p></div><div class="r"><span class="wdg-seg" role="tablist" aria-label="Documents"><span role="tab" data-k="terms" tabindex="0">Terms</span><span role="tab" data-k="privacy" tabindex="0">Privacy</span><span role="tab" data-k="contact" tabindex="0">Contact</span></span><button type="button" class="wdg-x" aria-label="Back">×</button></div></header>
      <article class="wdg-doc" tabindex="0"></article>
      <footer><button type="button" class="wdg-btn2" data-x>Back</button><span>${L.meta}</span></footer>
    </div>`, 'wdg-r-title');
    const show = k => {
      const doc = L[k];
      d.querySelector('#wdg-r-title').textContent = doc.title;
      d.querySelector('#wdg-r-meta').textContent = k === 'contact' ? 'Operator, controller and privacy contact' : 'Effective date: ' + L.effective;
      d.querySelector('.wdg-doc').innerHTML = doc.html; d.querySelector('.wdg-doc').scrollTop = 0;
      d.querySelectorAll('.wdg-doc a[href^="http"]').forEach(x => { x.target = '_blank'; x.rel = 'noopener'; });
      d.querySelectorAll('[role=tab]').forEach(t => { const on = t.dataset.k === k; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
    };
    d.querySelectorAll('[role=tab]').forEach(t => { t.addEventListener('click', () => show(t.dataset.k)); t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(t.dataset.k); } }); });
    d.querySelectorAll('.wdg-x, [data-x]').forEach(b => b.addEventListener('click', () => d.close('')));
    d.addEventListener('close', () => d.remove());
    show(kind); d.showModal(); d.querySelector('.wdg-box').focus(); return d;
  }

  function wireDocs(root) {
    root.querySelectorAll('[data-doc]').forEach(a => {
      const go = e => { e.preventDefault(); const back = document.activeElement; const r = reader(a.dataset.doc); r.addEventListener('close', () => back && back.focus && back.focus()); };
      a.addEventListener('click', go); a.addEventListener('keydown', e => { if (e.key === 'Enter') go(e); });
    });
  }

  window.WDGate = { gate, choices, reader, wireDocs };
})();
