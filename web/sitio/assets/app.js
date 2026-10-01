/* AulaPro · page engine: language, the scroll-scrubbed hero, entrances, the list and the form. */
(() => {
  'use strict';

  // Where the final form sends its emails. Empty means preview mode: nothing is sent and the page says so.
  const FORM_ENDPOINT = 'https://formspree.io/f/meaodprb';

  // Purchase pages come from the launch switch (assets/launch.js). Empty means "coming soon":
  // the button leads to the waitlist form instead. When all three are set, the buttons say "Buy for...",
  // the waitlist disappears and the download links appear. One licence covers Windows, Mac and Android,
  // so all three open the same checkout.
  const LAUNCH = window.AULA_LAUNCH || {};
  const STORE_LINKS = {
    windows: LAUNCH.checkout || '',
    mac: LAUNCH.checkout || '',
    android: LAUNCH.checkout || ''
  };

  const VIDEO_URL = 'assets/hero-scrub.mp4';
  const POSTER_URL = 'assets/hero-poster.jpg';
  const ENDING_URL = 'assets/hero-ending.jpg';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smoothstep = (p, e0, e1) => { const t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
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
  // Castellano is the page itself: read it once, before anything gets split into words.
  textEls.forEach(el => { const k = el.dataset.i18n; if (!(k in DICT.es)) DICT.es[k] = el.innerHTML.trim(); });
  attrEls.forEach(el => el.dataset.i18nAttr.split(';').forEach(pair => {
    const [attr, k] = pair.split(':');
    if (!(k in DICT.es)) DICT.es[k] = el.getAttribute(attr) || '';
  }));
  let lang = 'es';
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
    bands.forEach(b => { b.op = -1; b.k = -1; b.lines.forEach(l => { l.s = -1; }); });
    if (scrubOn) updateCaptions(shown);
    if (save) store.set('aula-lang', lang);
  }

  /* ================= the hero ================= */
  const hero = $('#inicio');
  const stage = $('.stage', hero);
  const video = $('#hero-video');
  const poster = $('.poster', hero);
  const posterEnd = $('.poster-end', hero);
  const cue = $('.cue', hero);
  const bands = $$('.band', hero).map(el => ({
    el,
    a: parseFloat(el.dataset.a),
    b: parseFloat(el.dataset.b),
    ramp: parseFloat(el.dataset.ramp) || 0,
    first: parseFloat(el.dataset.a) === 0,
    last: parseFloat(el.dataset.b) === 1,
    op: -1, k: -1, live: false,
    lines: $$('.ln', el).map(ln => ({ el: ln, tick: $('.box svg', ln), s: -1 }))
  }));

  let heroTop = 0, heroRange = 1;
  function measure() {
    heroTop = hero.getBoundingClientRect().top + scrollY;
    heroRange = Math.max(1, hero.offsetHeight - innerHeight);
  }
  const heroProgress = () => clamp((scrollY - heroTop) / heroRange, 0, 1);

  // band 1 opens settled: a one-time assembly on load that then hands over to scroll
  let loadStart = 0, loadK = 0;
  let cueOp = -1, endOp = -1;
  let videoReady = false, videoFailed = false;

  function updateCaptions(p) {
    for (const bd of bands) {
      const { a, b } = bd;
      const f = Math.min(0.02, (b - a) / 3);
      let op = (bd.first ? 1 : smoothstep(p, a, a + f)) * (bd.last ? 1 : 1 - smoothstep(p, b - f, b));
      op = Math.round(op * 1000) / 1000;
      if (op !== bd.op) {
        bd.el.style.opacity = op;
        bd.op = op;
        const live = op > 0.6;
        if (live !== bd.live) { bd.el.classList.toggle('live', live); bd.live = live; }
      }
      const ramp = bd.ramp || Math.min(0.025, (b - a) * 0.35);
      let k = clamp((p - a) / ramp, 0, 1);
      if (bd.first) k = Math.max(k, loadK);
      if (Math.abs(k - bd.k) >= 0.008 || ((k === 0 || k === 1) && k !== bd.k)) {
        bd.el.style.setProperty('--k', k.toFixed(3));
        bd.k = k;
      }
      bd.lines.forEach((ln, i) => {
        const s0 = a + (b - a) * (0.34 + i * 0.1);
        const s = clamp((p - s0) / ((b - a) * 0.14), 0, 1);
        if (Math.abs(s - ln.s) >= 0.01 || ((s === 0 || s === 1) && s !== ln.s)) {
          ln.s = s;
          ln.el.style.setProperty('--s', s.toFixed(3));
          ln.tick.style.strokeDashoffset = (1 - clamp((s - 0.55) / 0.45, 0, 1)).toFixed(3);
        }
      });
    }
    if (videoFailed) {
      // no video: the still frames carry the journey, the sheet "lands" as the ending fades in
      const e = Math.round(smoothstep(p, 0.5, 0.72) * 100) / 100;
      if (e !== endOp) { posterEnd.style.opacity = e; endOp = e; }
    }
    const c = Math.round((1 - smoothstep(p, 0.01, 0.05)) * 100) / 100;
    if (c !== cueOp) { cue.style.opacity = c; cueOp = c; }
  }

  // seeks never overlap: coalesce to the newest target, one follow-up, never deadlock
  let seekBusy = false, pendingTime = null;
  function requestSeek(time) {
    if (!videoReady || !video.duration) return;
    const tt = clamp(time, 0, video.duration - 0.001);
    if (seekBusy) { pendingTime = tt; return; }
    if (Math.abs(video.currentTime - tt) < 0.004) return;
    seekBusy = true;
    video.currentTime = tt;
  }
  video.addEventListener('seeked', () => {
    seekBusy = false;
    if (pendingTime !== null) { const tt = pendingTime; pendingTime = null; requestSeek(tt); }
  });
  video.addEventListener('error', () => {
    seekBusy = false;
    pendingTime = null;
    if (!videoReady) failVideo();
  });

  // displayed progress eases toward the scroll target; the loop rests when converged
  let target = 0, shown = 0, rafId = null, lastTick = 0, heroOnScreen = true;
  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    shown += (target - shown) * (1 - Math.pow(1 - 0.14, dt / 16.667));
    if (loadK < 1) {
      const x = clamp((now - loadStart - 250) / 1300, 0, 1);
      loadK = 1 - Math.pow(1 - x, 3);
    }
    if (Math.abs(target - shown) < 0.0005 && loadK >= 1) {
      shown = target;
      rafId = null;
      lastTick = 0;
    } else {
      rafId = requestAnimationFrame(tick);
    }
    requestSeek(shown * (video.duration || 0));
    updateCaptions(shown);
  }
  function wake() {
    if (rafId === null && heroOnScreen && scrubOn) rafId = requestAnimationFrame(tick);
  }
  function onScroll() {
    target = heroProgress();
    wake();
  }

  // the video: poster first, then the whole file as a Blob (works on hosts without Range support)
  let heroInit = false, fetchStarted = false;
  function initHeroOnce() {
    if (heroInit) return;
    heroInit = true;
    poster.style.backgroundImage = `url('${POSTER_URL}')`;
    const img = new Image();
    img.onload = startBlobFetch;
    img.onerror = startBlobFetch;
    img.src = POSTER_URL;
    setTimeout(startBlobFetch, 4000);
  }
  function startBlobFetch() {
    if (fetchStarted) return;
    fetchStarted = true;
    loadHeroBlob().catch(failVideo);
  }
  async function loadHeroBlob() {
    const ctrl = new AbortController();
    const watchdog = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(VIDEO_URL, { priority: 'low', signal: ctrl.signal });
    if (!res.ok) throw new Error('video ' + res.status);
    const blob = await res.blob();
    clearTimeout(watchdog);
    video.addEventListener('loadeddata', () => {
      videoReady = true;
      stage.classList.add('video-ready');
      requestSeek(shown * video.duration);
    }, { once: true });
    video.src = URL.createObjectURL(blob);
    video.load();
  }
  function failVideo() {
    if (videoFailed) return;
    videoFailed = true;
    videoReady = false;
    stage.classList.add('video-failed');
    posterEnd.style.backgroundImage = `url('${ENDING_URL}')`;
    endOp = -1;
    if (scrubOn) updateCaptions(shown);
  }

  // the five static-hero gates, identical to the CSS media query, decided live
  const GATES = [
    '(max-width: 720px)',
    '(orientation: portrait) and (max-width: 1024px)',
    '(orientation: portrait) and (pointer: coarse)',
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
    '(prefers-reduced-motion: reduce)'
  ];
  let scrubOn = false;
  function enableScrub() {
    if (scrubOn) return;
    scrubOn = true;
    measure();
    initHeroOnce();
    if (!loadStart) loadStart = performance.now();
    addEventListener('scroll', onScroll, { passive: true });
    bands.forEach(b => { b.op = -1; b.k = -1; b.lines.forEach(l => { l.s = -1; }); });
    cueOp = -1; endOp = -1;
    target = shown = heroProgress();
    updateCaptions(shown);
    onScroll();
    rafId === null && (rafId = requestAnimationFrame(tick));
  }
  function disableScrub() {
    if (!scrubOn) return;
    scrubOn = false;
    removeEventListener('scroll', onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; lastTick = 0; }
  }
  function applyHeroMode() {
    if (GATES.some(q => matchMedia(q).matches)) disableScrub();
    else enableScrub();
    onPageScroll();
  }
  const MQLS = GATES.map(q => matchMedia(q));
  MQLS.forEach(m => m.addEventListener ? m.addEventListener('change', applyHeroMode) : m.addListener(applyHeroMode));

  new IntersectionObserver(([e]) => {
    heroOnScreen = e.isIntersecting;
    if (heroOnScreen) onScroll();
    else if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; lastTick = 0; }
  }).observe(hero);

  /* ================= nav + room ================= */
  const nav = $('#nav');
  let navSolid = null, inHero = null;
  function onPageScroll() {
    const y = scrollY;
    const solid = scrubOn ? y > heroTop + heroRange + innerHeight - 90 : y > 40;
    if (solid !== navSolid) { nav.classList.toggle('solid', solid); navSolid = solid; }
    const ih = scrubOn && y < heroTop + heroRange;
    if (ih !== inHero) { document.body.classList.toggle('in-hero', ih); inHero = ih; }
  }
  addEventListener('scroll', onPageScroll, { passive: true });
  addEventListener('resize', () => { measure(); onScroll(); onPageScroll(); }, { passive: true });
  addEventListener('load', () => { measure(); onScroll(); onPageScroll(); });

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
  const sheet = $('#sheet');
  const tasks = $$('.task', sheet);
  const countEl = $('#count');
  function updateCount() {
    const n = tasks.filter(b => b.getAttribute('aria-pressed') === 'true').length;
    if (countEl) countEl.textContent = t('s2.count').replace('{n}', n);
    sheet.classList.toggle('all-done', n === tasks.length);
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
    $$('.store').forEach(a => {
      const url = STORE_LINKS[a.dataset.store];
      const label = $('small', a);
      if (url) {
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
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
  }

  /* ================= start ================= */
  setupStores();
  $$('.lang button').forEach(b => b.addEventListener('click', () => applyLang(b.dataset.lang, true)));
  const fromUrl = new URLSearchParams(location.search).get('lang');
  const nav0 = (navigator.language || 'es').slice(0, 2).toLowerCase();
  const first = [fromUrl, store.get('aula-lang'), nav0].find(l => l && DICT[l]) || 'es';
  applyLang(first, false);
  applyHeroMode();
})();
