/* AulaPro · download and thank-you pages: follow the launch switch (assets/launch.js). */
(() => {
  'use strict';
  const L = window.AULA_LAUNCH || {};
  const root = document.documentElement;
  root.classList.toggle('launched', !!L.checkout);
  root.classList.toggle('no-play', !L.play);

  document.querySelectorAll('[data-dl]').forEach(a => {
    const k = a.dataset.dl;
    const url = k === 'android' ? L.play : (L.downloads || {})[k];
    if (url) a.href = url;
    if (k === 'android' && url) { a.target = '_blank'; a.rel = 'noopener'; }
  });
  document.querySelectorAll('[data-buy]').forEach(a => {
    if (!L.checkout) return;
    a.href = L.checkout;
    a.target = '_blank';
    a.rel = 'noopener';
  });

  // the current version, when the download server lets this page read it
  if (L.checkout && L.version && window.fetch && document.querySelector('[data-version]')) {
    fetch(L.version, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(v => {
        if (!v || !v.version) return;
        document.querySelectorAll('[data-version]').forEach(el => {
          const lang = (el.closest('[lang]') || root).getAttribute('lang') || 'es';
          let day = '';
          try { day = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(v.fecha + 'T12:00:00')); } catch (e) { day = v.fecha || ''; }
          el.textContent = el.dataset.version.replace('{v}', v.version).replace('{d}', day);
          el.hidden = false;
        });
      })
      .catch(() => { /* no version line: the downloads still work */ });
  }
})();
