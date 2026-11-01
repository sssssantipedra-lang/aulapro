/* AulaPro · page engine: language, the hero moved by the scroll, entrances, the list and the form. */
(() => {
  'use strict';

  // Where the final form sends its emails. Empty means preview mode: nothing is sent and the page says so.
  const FORM_ENDPOINT = 'https://formspree.io/f/meaodprb';

  // Purchase pages come from the launch switch (assets/launch.js). Empty means "coming soon":
  // the button leads to the waitlist form instead. When all three are set, the buttons say "Buy for...",
  // the waitlist disappears and the download links appear. One licence covers Windows, Mac and Android,
  // so all three open the same checkout.
  const LAUNCH = window.AULA_LAUNCH || {};
  // 100% web desde el 29-10-2026: el botón lleva a la app, donde se entra con Google y se compra con el correo ya puesto
  const STORE_LINKS = {
    web: LAUNCH.checkout ? 'app/' : ''
  };


  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const rng = seed => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: fine */ } }
  };

  /* ================= language ================= */
  const DICT = window.AULA_I18N || { es: {}, ca: {}, en: {} };
  const textEls = $$('[data-i18n]');
  const attrEls = $$('[data-i18n-attr]');
  // Each language has its own page: / in castellano, /ca and /en (made by web/idiomas.mjs before publishing).
  // The page is its own language's text: read it once, before anything gets split into words.
  const PAGE = DICT[document.documentElement.lang] ? document.documentElement.lang : 'es';
  const PAGE_URL = { es: './', ca: 'ca', en: 'en' };
  textEls.forEach(el => { const k = el.dataset.i18n; if (!(k in DICT[PAGE])) DICT[PAGE][k] = el.innerHTML.trim(); });
  attrEls.forEach(el => el.dataset.i18nAttr.split(';').forEach(pair => {
    const [attr, k] = pair.split(':');
    if (!(k in DICT[PAGE])) DICT[PAGE][k] = el.getAttribute(attr) || '';
  }));
  let lang = PAGE;
  const t = k => (DICT[lang] && DICT[lang][k] != null) ? DICT[lang][k] : (DICT.es[k] != null ? DICT.es[k] : '');

  // Split a headline into word spans (keeping <em> for the underline), with seeded offsets.
  function splitWords(el, html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const tokens = [];
    let glue = false;
    tmp.childNodes.forEach(node => {
      if (node.nodeType === 1 && node.tagName === 'BR') { tokens.push('BR'); glue = false; return; }
      const em = node.nodeType === 1 && node.tagName === 'EM';
      node.textContent.split(/(\s+)/).forEach(piece => {
        if (!piece) return;
        if (/^\s+$/.test(piece)) { glue = false; return; }
        if (glue && tokens.length) tokens[tokens.length - 1].push({ text: piece, em });
        else tokens.push([{ text: piece, em }]);
        glue = true;
      });
    });
    const spread = parseFloat(el.dataset.spread) || 0.5;
    const r = rng(hash(el.dataset.i18n || 'x'));
    const sr = document.createElement('span');
    sr.className = 'sr';
    sr.textContent = html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    const words = tokens.filter(tk => tk !== 'BR').length;
    let wi = 0;
    tokens.forEach((segs, i) => {
      if (segs === 'BR') { vis.append(document.createElement('br')); return; }
      const w = document.createElement('span');
      w.className = 'w';
      segs.forEach(sg => {
        if (sg.em) { const e = document.createElement('em'); e.textContent = sg.text; w.append(e); }
        else w.append(sg.text);
      });
      w.style.setProperty('--th', (wi++ / Math.max(1, words) * spread + r() * 0.05).toFixed(3));
      vis.append(w);
      if (i < tokens.length - 1 && tokens[i + 1] !== 'BR') vis.append(' ');
    });
    el.replaceChildren(sr, vis);
  }

  function applyLang(next, save) {
    lang = DICT[next] ? next : 'es';
    document.documentElement.lang = lang;
    textEls.forEach(el => {
      const v = t(el.dataset.i18n);
      if (el.hasAttribute('data-split')) splitWords(el, v);
      else if (el.innerHTML !== v) el.innerHTML = v;
    });
    $$('[data-lang-link]').forEach(a => { a.href = a.dataset.langLink + (lang !== 'es' ? '?lang=' + lang : ''); });
    attrEls.forEach(el => el.dataset.i18nAttr.split(';').forEach(pair => {
      const [attr, k] = pair.split(':');
      el.setAttribute(attr, t(k));
    }));
    document.title = t('meta.title');
    const md = $('meta[name="description"]');
    if (md) md.setAttribute('content', t('meta.desc'));
    $$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    const fl = $('#f-lang');
    if (fl) fl.value = lang;
    $$('[data-demo-link]').forEach(a => { a.href = 'demo.html' + (lang !== 'es' ? '?lang=' + lang : ''); });
    updateCount();
    if (statusKey) setStatus(statusKey, statusCls);
    if (save) store.set('aula-lang', lang);
  }


  /* ================= the hero: the app on three screens, moved by the scroll =================
     Like a product page: the laptop comes forward, its screen tells the story (each caption says what
     the screen shows), and the three devices settle together at the end. Everything is a sharp capture
     moved with transforms, so it stays crisp at any size. On small or touch screens in portrait and with
     reduced motion, the hero is the still composition (same gates as the CSS of .hero.scrub). */
  const hero = $('#inicio');
  const stage = $('.stage', hero);
  const copyA = $('.hero-copy', hero);
  const box = $('.devices', hero);
  const devs = ['.dv-laptop', '.dv-tablet', '.dv-phone'].map(s => $(s, hero));
  const shots = $$('.dv-laptop img.later', hero).map(el => ({ el, t: +el.dataset.t }));
  const caps = $$('.beat', hero).map(el => ({ el, a: +el.dataset.a, b: +el.dataset.b, k: -1 }));
  const cue = $('.cue', hero);
  const ease = t => t * t * (3 - 2 * t);
  const ramp = (p, a, d) => clamp((p - a) / d, 0, 1);
  const GATES = [
    '(max-width: 720px)',
    '(orientation: portrait) and (max-width: 1024px)',
    '(orientation: portrait) and (pointer: coarse)',
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
    '(prefers-reduced-motion: reduce)'
  ];
  const T = { aOut: [0.07, 0.2], sOut: [0.78, 0.9] };   // still → story, story → together
  let scrubOn = false, geo = null, heroTop = 0, heroRange = 1, raf = null;

  function measure() {
    if (!scrubOn) return;
    devs.forEach(d => { d.style.transform = ''; d.style.opacity = ''; });
    copyA.style.transform = '';
    const st = stage.getBoundingClientRect();
    const rel = el => { const r = el.getBoundingClientRect(); return { x: r.left - st.left, y: r.top - st.top, w: r.width, h: r.height }; };
    const W = st.width, H = st.height;
    const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
    const gut = parseFloat(getComputedStyle(cue.parentElement.querySelector('.beat')).left) || 48;
    const A = devs.map(rel), D = rel(box);
    // the story: the caption on the left, the laptop as large as it fits on the right (it may bleed a little)
    const capW = clamp(W * 0.3, 300, 460);
    stage.style.setProperty('--capw', capW + 'px');
    const x0 = gut + capW + clamp(W * 0.04, 32, 72);
    const lw = Math.min((W - x0) * 1.1, (H - nav - 70) * (A[0].w / A[0].h));
    const L = { x: x0, y: nav + (H - nav - lw * A[0].h / A[0].w) / 2 - 8, w: lw };
    const S = [L, { x: A[1].x - W * 0.2, y: A[1].y + H * 0.45, w: A[1].w }, { x: A[2].x + W * 0.15, y: A[2].y + H * 0.45, w: A[2].w }];
    // the end: the three together, centred under the closing line and above the strip
    const top = nav + clamp(H * 0.2, 150, 210), bottom = clamp(H * 0.16, 110, 150);
    const k = Math.min(W * 0.8 / D.w, (H - top - bottom) / D.h);
    const ex = (W - D.w * k) / 2;
    const E = A.map(a => ({ x: ex + (a.x - D.x) * k, y: top + (a.y - D.y) * k, w: a.w * k }));
    geo = { A, S, E };
    heroTop = hero.getBoundingClientRect().top + scrollY;
    heroRange = Math.max(1, hero.offsetHeight - innerHeight);
  }

  const mix = (r1, r2, t) => ({ x: r1.x + (r2.x - r1.x) * t, y: r1.y + (r2.y - r1.y) * t, w: r1.w + (r2.w - r1.w) * t });
  function render() {
    raf = null;
    if (!scrubOn || !geo) return;
    const p = clamp((scrollY - heroTop) / heroRange, 0, 1);
    const tA = ease(ramp(p, T.aOut[0], T.aOut[1] - T.aOut[0]));
    const tE = ease(ramp(p, T.sOut[0], T.sOut[1] - T.sOut[0]));
    devs.forEach((d, i) => {
      const a = geo.A[i];
      const r = tE > 0 ? mix(geo.S[i], geo.E[i], tE) : mix(a, geo.S[i], tA);
      d.style.transform = `translate(${(r.x - a.x).toFixed(2)}px,${(r.y - a.y).toFixed(2)}px) scale(${(r.w / a.w).toFixed(4)})`;
      if (i) d.style.opacity = (tE > 0 ? tE : 1 - tA).toFixed(3);
    });
    const oA = 1 - ramp(p, 0.06, 0.06);
    copyA.style.opacity = oA.toFixed(3);
    copyA.style.transform = `translateY(${(-(1 - oA) * 28).toFixed(1)}px)`;
    copyA.style.pointerEvents = oA > 0.5 ? '' : 'none';
    caps.forEach(c => {
      const k = Math.min(ramp(p, c.a, 0.035), c.b >= 1 ? 1 : 1 - ramp(p, c.b - 0.035, 0.035));
      if (k === c.k) return;
      c.k = k;
      c.el.style.opacity = k.toFixed(3);
      c.el.style.setProperty('--dy', ((1 - k) * 18).toFixed(1) + 'px');
      c.el.classList.toggle('on', k > 0.5);
    });
    shots.forEach(s => { s.el.style.opacity = ramp(p, s.t, 0.025).toFixed(3); });
    cue.style.opacity = (1 - ramp(p, 0, 0.03)).toFixed(3);
  }
  const queue = () => { if (raf === null) raf = requestAnimationFrame(render); };
  const refresh = () => { measure(); caps.forEach(c => { c.k = -1; }); render(); };

  function setScrub(on) {
    if (on === scrubOn) return;
    scrubOn = on;
    hero.classList.toggle('scrub', on);
    if (on) {
      addEventListener('scroll', queue, { passive: true });
      refresh();
    } else {
      removeEventListener('scroll', queue);
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      [...devs, copyA, ...shots.map(s => s.el)].forEach(el => { el.style.transform = ''; el.style.opacity = ''; el.style.pointerEvents = ''; });
    }
  }
  const MQLS = GATES.map(q => matchMedia(q));
  const applyHeroMode = () => setScrub(!MQLS.some(m => m.matches));
  MQLS.forEach(m => m.addEventListener ? m.addEventListener('change', applyHeroMode) : m.addListener(applyHeroMode));
  addEventListener('resize', () => { if (scrubOn) refresh(); }, { passive: true });
  addEventListener('load', () => { if (scrubOn) refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (scrubOn) refresh(); });

  /* ================= nav + room ================= */
  const nav = $('#nav');
  let navSolid = null;
  function onPageScroll() {
    const solid = scrollY > 40;
    if (solid !== navSolid) { nav.classList.toggle('solid', solid); navSolid = solid; }
  }
  addEventListener('scroll', onPageScroll, { passive: true });
  onPageScroll();

  // whisper-level dust in the room, the same motes as the light beam in the footage
  const dust = $('.env .dust');
  if (dust) {
    const r = rng(20260929);
    for (let i = 0; i < 26; i++) {
      const m = document.createElement('i');
      const s = 1.5 + r() * 2.6;
      m.style.cssText = `--x:${(r() * 100).toFixed(1)}%;--y:${(8 + r() * 88).toFixed(1)}%;--s:${s.toFixed(1)}px;--o:${(0.18 + r() * 0.4).toFixed(2)};--t:${(18 + r() * 22).toFixed(1)}s;--d:${(-r() * 40).toFixed(1)}s;--dx:${((r() - 0.5) * 60).toFixed(0)}px`;
      dust.append(m);
    }
  }
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));

  /* ================= conversion: a real clip and real opinions, each hidden until it exists ================= */
  function setupConversion() {
    // 1. the clip of a real generation: only when launch.js names the files
    const v = LAUNCH.video || {};
    const sec = $('#video');
    if (sec && v.src) {
      sec.hidden = false;
      const vid = $('#clip-video'), btn = $('#clip-btn');
      if (v.poster) vid.poster = v.poster;
      let loaded = false, userPaused = false;
      const play = () => {
        if (!loaded) { loaded = true; vid.src = v.src; vid.preload = 'auto'; }
        const p = vid.play();
        if (p && p.catch) p.catch(() => { /* the browser asked for a tap: the button is there */ });
      };
      const sync = () => { sec.classList.toggle('playing', !vid.paused); btn.setAttribute('aria-pressed', String(!vid.paused)); };
      vid.addEventListener('play', sync);
      vid.addEventListener('pause', sync);
      const toggle = () => { if (vid.paused) { userPaused = false; play(); } else { userPaused = true; vid.pause(); } };
      btn.addEventListener('click', toggle);
      vid.addEventListener('click', toggle);
      // plays while it is on screen (muted and looping), unless the visitor paused it or asked for less movement
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { if (!userPaused) play(); } else vid.pause(); }), { threshold: 0.5 }).observe(vid);
    }
    // 2. what other teachers say: up to three, built with textContent (nothing here is HTML)
    const ops = (Array.isArray(LAUNCH.testimonios) ? LAUNCH.testimonios : []).filter(o => o && o.nombre && o.texto).slice(0, 3);
    const opSec = $('#opiniones'), list = $('#opiniones-lista');
    if (opSec && list && ops.length) {
      const pick = x => (x && typeof x === 'object') ? (x[lang] || x.es || '') : String(x || '');
      ops.forEach((o, i) => {
        const li = document.createElement('li');
        li.className = 'op rise';
        li.style.setProperty('--d', String(80 * i));
        const q = document.createElement('blockquote');
        q.textContent = pick(o.texto);
        const who = document.createElement('p');
        who.className = 'op-quien';
        const b = document.createElement('b');
        b.textContent = o.nombre;
        const r = document.createElement('span');
        r.textContent = pick(o.rol);
        who.append(b, r);
        li.append(q, who);
        list.append(li);
      });
      opSec.hidden = false;
    }
  }
  setupConversion();

  /* ================= entrances + living elements ================= */
  const entered = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    el.classList.add('in');
    entered.unobserve(el);
    const d = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
    setTimeout(() => el.classList.add('done'), d + 1700);   // retire the stagger so hovers never lag
  }), { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  $$('.rise, .docs').concat($$('.draw, .wipe').filter(d => !d.closest('.rise'))).forEach(el => entered.observe(el));

  const living = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('live-on', e.isIntersecting)));
  $$('[data-live]').forEach(el => living.observe(el));

  /* ================= the list you cross off ================= */
  // Salió de la portada el 29-10-2026: solo si sigue en la página
  const sheet = $('#sheet');
  const tasks = sheet ? $$('.task', sheet) : [];
  const countEl = $('#count');
  function updateCount() {
    const n = tasks.filter(b => b.getAttribute('aria-pressed') === 'true').length;
    if (countEl) countEl.textContent = t('s2.count').replace('{n}', n);
    if (sheet) sheet.classList.toggle('all-done', n === tasks.length);
  }
  tasks.forEach(b => b.addEventListener('click', () => {
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    updateCount();
  }));
  const reset = $('#reset');
  if (reset) reset.addEventListener('click', () => { tasks.forEach(b => b.setAttribute('aria-pressed', 'false')); updateCount(); });

  /* ================= the form ================= */
  const form = $('#form');
  const statusEl = $('#status');
  let statusKey = '', statusCls = '';
  function setStatus(key, cls) {
    statusKey = key;
    statusCls = cls;
    statusEl.textContent = key ? t(key) : '';
    statusEl.className = 'status' + (cls ? ' ' + cls : '');
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#f-email');
    if (!email.value.trim() || !email.checkValidity()) { setStatus('f.invalid', 'warn'); email.focus(); return; }
    const ok = $('#f-ok');
    if (ok && !ok.checked) { setStatus('f.needok', 'warn'); ok.focus(); return; }
    if (!FORM_ENDPOINT) { setStatus('f.preview', 'warn'); return; }
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    try {
      const res = await fetch(FORM_ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
      if (!res.ok) throw new Error(String(res.status));
      form.classList.add('sent');
      setStatus('f.ok', 'ok');
    } catch (err) {
      setStatus('f.err', 'warn');
    } finally {
      btn.disabled = false;
    }
  });

  /* ================= platform buttons ================= */
  function setupStores() {
    let allOpen = true;
    $$('a.store').forEach(a => {                 // the Mac tile is a <span>: coming soon, never a link
      const url = STORE_LINKS[a.dataset.store];
      const label = $('small', a);
      if (url) {
        a.href = url;
        a.classList.add('ready');
        label.dataset.i18n = 'buy.for';
      } else {
        a.href = '#quiero';
        a.removeAttribute('target');
        a.classList.remove('ready');
        label.dataset.i18n = 'buy.soon';
        allOpen = false;
      }
    });
    document.documentElement.classList.toggle('store-open', allOpen);
    // group packs: each has its own checkout; they never decide whether the shop is open
    const packs = LAUNCH.packs || {};
    $$('.pack').forEach(a => {
      const url = packs[a.dataset.pack] || '';
      const label = $('.pack-cta', a);
      a.href = url || '#quiero';
      if (url) { a.target = '_blank'; a.rel = 'noopener'; } else a.removeAttribute('target');
      a.classList.toggle('ready', !!url);
      label.dataset.i18n = url ? 'pk.buy' : 'buy.soon';
    });
  }

  /* ================= start ================= */
  setupStores();
  // A language button takes the visitor to that language's page (same spot), and remembers the choice.
  // The page never changes language by itself: the browser's language does not decide it, so Google sees
  // every page in its own language.
  const goLang = l => { store.set('aula-lang', l); if (l !== PAGE) location.href = PAGE_URL[l] + location.hash; };
  $$('.lang button').forEach(b => b.addEventListener('click', () => goLang(b.dataset.lang)));
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (fromUrl && DICT[fromUrl] && fromUrl !== PAGE) location.replace(PAGE_URL[fromUrl] + location.hash);
  applyLang(PAGE, false);
  applyHeroMode();
})();
