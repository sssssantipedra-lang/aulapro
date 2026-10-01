/* AulaPro · legal pages: show the article in the visitor's language and keep links in that language. */
(() => {
  'use strict';
  const LANGS = ['es', 'ca', 'en'];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: fine */ } }
  };
  const UI = {
    es: { back: 'Volver a la web', terms: 'Condiciones de venta', legal: 'Aviso legal', privacy: 'Política de privacidad', skip: 'Saltar al contenido', label: 'Idioma' },
    ca: { back: 'Torna al web', terms: 'Condicions de venda', legal: 'Avís legal', privacy: 'Política de privacitat', skip: 'Salta al contingut', label: 'Idioma' },
    en: { back: 'Back to the website', terms: 'Terms of sale', legal: 'Legal notice', privacy: 'Privacy policy', skip: 'Skip to content', label: 'Language' }
  };
  function apply(lang, save) {
    document.documentElement.lang = lang;
    document.querySelectorAll('article[lang]').forEach(a => {
      const on = a.getAttribute('lang') === lang;
      a.hidden = !on;
      if (on && a.dataset.title) document.title = a.dataset.title;
    });
    document.querySelectorAll('[data-ui]').forEach(el => { el.textContent = UI[lang][el.dataset.ui]; });
    document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    const g = document.querySelector('.lang');
    if (g) g.setAttribute('aria-label', UI[lang].label);
    const q = lang !== 'es' ? '?lang=' + lang : '';
    document.querySelectorAll('a[data-to]').forEach(a => { a.href = a.dataset.to.replace('#', q + '#').replace(/^([^#]*)$/, '$1' + q); });
    if (save) store.set('aula-lang', lang);
    // #devoluciones, #app...: jump to that heading inside the article now on screen
    const hash = decodeURIComponent(location.hash.slice(1));
    const target = hash && document.querySelector(`article[lang="${lang}"] [data-anchor="${hash}"]`);
    if (target) requestAnimationFrame(() => target.scrollIntoView());
  }
  document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => apply(b.dataset.lang, true)));
  const fromUrl = new URLSearchParams(location.search).get('lang');
  const nav0 = (navigator.language || 'es').slice(0, 2).toLowerCase();
  apply([fromUrl, store.get('aula-lang'), nav0].find(l => l && LANGS.includes(l)) || 'es', false);
})();
