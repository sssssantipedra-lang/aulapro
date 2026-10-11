/* AulaPro · the interactive demo. A replica of the app window, drawn at its real size (1920 x 1032)
   and scaled to fit. Each screen is a real screenshot of the app (assets/demo, made by
   scripts/web/capturar.mjs) with buttons laid over it where the app has them, so the whole window,
   menu included, answers like the app. Some tools really work: roulette, calculator, timer, board,
   attendance, behaviour notes, rubric and assessment target. Nothing is saved. */
(() => {
  'use strict';

  const W = 1920, H = 1032, TB = 24, SH = H - TB;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: fine */ } }
  };
  const SCREENS = window.AULA_DEMO_SCREENS || {};

  /* ================= language ================= */
  const BASE = window.AULA_I18N || {};
  const MORE = window.AULA_DEMO_I18N || {};
  const DICT = {};
  ['es', 'ca', 'en'].forEach(l => { DICT[l] = Object.assign({}, BASE[l] || {}, MORE[l] || {}); });
  const textEls = $$('[data-i18n]');
  const attrEls = $$('[data-i18n-attr]');
  textEls.forEach(el => { const k = el.dataset.i18n; if (!(k in DICT.es)) DICT.es[k] = el.innerHTML.trim(); });
  attrEls.forEach(el => el.dataset.i18nAttr.split(';').forEach(pair => {
    const [attr, k] = pair.split(':');
    if (!(k in DICT.es)) DICT.es[k] = el.getAttribute(attr) || '';
  }));
  let lang = 'es';
  const t = (k, vars) => {
    let s = (DICT[lang] && DICT[lang][k] != null) ? DICT[lang][k] : (DICT.es[k] != null ? DICT.es[k] : '');
    if (vars) Object.keys(vars).forEach(v => { s = s.split('{' + v + '}').join(vars[v]); });
    return s;
  };

  function applyLang(next, save) {
    lang = DICT[next] ? next : 'es';
    document.documentElement.lang = lang;
    textEls.forEach(el => { const v = t(el.dataset.i18n); if (el.innerHTML !== v) el.innerHTML = v; });
    attrEls.forEach(el => el.dataset.i18nAttr.split(';').forEach(pair => {
      const [attr, k] = pair.split(':');
      el.setAttribute(attr, t(k));
    }));
    document.title = t('demo.meta.title');
    const md = $('meta[name="description"]');
    if (md) md.setAttribute('content', t('demo.meta.desc'));
    $$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $$('a[data-home]').forEach(a => { a.href = ({ es: './', ca: 'ca', en: 'en' }[lang] || './') + (a.dataset.home || ''); });   // /, /ca, /en
    $$('[data-lang-link]').forEach(a => { a.href = a.dataset.langLink + (lang !== 'es' ? '?lang=' + lang : ''); });
    fullLabel();
    const im = $('.shot', view);
    if (im && cur) im.alt = altOf(cur);
    if (save) store.set('aula-lang', lang);
  }
  const altOf = id => t('demo.alt', { screen: (SCREENS[id] || {}).title || '' });

  /* ================= the stage: scale the window to the room we have ================= */
  const wrap = $('#demo');
  const stageEl = $('#stage');
  const win = $('#win');
  const view = $('#view');
  const toastBox = $('#toasts');
  const btnFull = $('#t-full');
  const btnZoom = $('#t-zoom');
  const btnSpots = $('#t-spots');
  const srNote = document.createElement('p');
  srNote.className = 'sr';
  srNote.setAttribute('aria-live', 'polite');
  wrap.append(srNote);

  let scale = 1, lastAvail = -1;
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  function fit(force) {
    const fs = fsEl() === wrap;
    const cs = getComputedStyle(wrap);
    const avail = fs ? innerWidth : wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (!force && avail === lastAvail && !fs) return;
    lastAvail = avail;
    let s = fs ? Math.min(innerWidth / W, innerHeight / H) : Math.min(avail / W, 1);
    const narrow = !fs && avail < 700;
    wrap.classList.toggle('narrow', narrow);
    if (narrow) s = Math.max(s, 0.42);
    scale = s;
    win.style.transform = `scale(${s})`;
    stageEl.style.width = Math.round(W * s) + 'px';
    stageEl.style.height = Math.round(H * s) + 'px';
  }
  new ResizeObserver(() => fit()).observe(wrap);
  addEventListener('resize', () => fit(true), { passive: true });

  const canFull = !!(wrap.requestFullscreen || wrap.webkitRequestFullscreen);
  if (!canFull) btnFull.hidden = true;
  function toggleFull() {
    if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else if (canFull) (wrap.requestFullscreen || wrap.webkitRequestFullscreen).call(wrap);
  }
  function fullLabel() {
    const sp = $('span', btnFull);
    if (sp) sp.textContent = t(fsEl() ? 'demo.fullx' : 'demo.full');
  }
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => { fit(true); fullLabel(); }));
  btnFull.addEventListener('click', toggleFull);

  /* ================= toasts ================= */
  let toastTimer = 0;
  function toast(msg) {
    if (!msg) return;
    toastBox.replaceChildren();
    const d = document.createElement('div');
    d.className = 'toast';
    d.innerHTML = '<i aria-hidden="true"></i><span></span>';
    d.lastChild.textContent = msg;
    toastBox.append(d);
    requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('in')));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { d.classList.remove('in'); setTimeout(() => d.remove(), 450); }, clamp(msg.length * 55, 3000, 7000));
  }

  /* ================= building blocks ================= */
  const px = (x0, y0, x1, y1) => `left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px`;
  function mk(el, tag, cls, css, html) {
    const n = document.createElement(tag);
    n.className = cls;
    if (css) n.style.cssText = css;
    if (html != null) n.innerHTML = html;
    if (tag === 'button') n.type = 'button';
    el.append(n);
    return n;
  }
  function spot(el, [x0, y0, x1, y1, act, label]) {
    const b = mk(el, 'button', 'spot', px(x0, y0, x1, y1));
    b.dataset.act = act;
    b.dataset.label = label || '';
    b.setAttribute('aria-label', label || t('demo.button'));
    return b;
  }
  const ICON = {
    present: '<path d="M20 6 9 17l-5-5"/>',
    absent: '<path d="M18 6 6 18M6 6l12 12"/>',
    late: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    justified: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="m9 15 2 2 4-4"/>',
    play: '<path d="m7 4 13 8-13 8z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>'
  };
  const svgI = (k, size = 15) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${ICON[k]}</svg>`;

  /* ================= navigation ================= */
  let cur = null, cleanup = null;

  function go(id, opt = {}) {
    const s = SCREENS[id];
    if (!s) return;
    if (cleanup) { try { cleanup(); } catch (e) { /* nothing to undo */ } cleanup = null; }
    const first = !cur;
    cur = id;
    if (!first) { clearTimeout(toastTimer); toastBox.replaceChildren(); }
    const el = document.createElement('div');
    el.className = 'scr';
    const im = new Image();
    im.className = 'shot';
    im.decoding = 'async';
    im.draggable = false;
    im.width = W;
    im.height = SH;
    im.alt = altOf(id);
    im.src = 'assets/demo/' + s.img;
    el.append(im);
    (s.spots || []).forEach(sp => spot(el, sp));
    if (INIT[id]) cleanup = INIT[id](el, s, opt) || null;
    view.replaceChildren(el);
    if (!first && !opt.quiet && !reduce.matches) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    if (!opt.quiet) srNote.textContent = `${t('demo.screen')}: ${s.title}`;
    if (HINT[id] && !opt.quiet && !opt.noHint) setTimeout(() => { if (cur === id) toast(t(HINT[id])); }, 450);
  }
  // A short tip the first moment a screen with something to try opens
  const HINT = { pizarra: 'demo.h.pizarra', actitud: 'demo.h.actitud', asistencia: 'demo.h.asistencia', rubrica: 'demo.h.rubrica', dianaeval: 'demo.h.diana' };

  function closeModal() {
    const s = SCREENS[cur];
    go(s && s.back ? s.back : 'inicio');
  }

  const FN = {
    closeModal,
    full: toggleFull,
    dianaSave() { toast(t(diana && diana.done ? 'demo.t.dianaSave' : 'demo.t.dianaEarly')); }
  };
  function run(action, el, e) {
    const i = action.indexOf(':');
    const kind = i < 0 ? action : action.slice(0, i), arg = i < 0 ? '' : action.slice(i + 1);
    if (kind === 'go') go(arg);
    else if (kind === 't') toast(t('demo.t.' + arg));
    else if (kind === 'g') toast(t('demo.t.g', { x: el && el.dataset.label ? el.dataset.label : t('demo.button') }));
    else if (kind === 'i') toast(t('demo.t.i'));
    else if (kind === 'fn' && FN[arg]) FN[arg](el, e);
  }

  let hintTimer = 0;
  function flashSpots() {
    if (win.classList.contains('show-spots')) return;
    win.classList.remove('hint');
    void win.offsetWidth;
    win.classList.add('hint');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => win.classList.remove('hint'), 1000);
  }

  win.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (a) { run(a.dataset.act, a, e); return; }
    const scr = e.target.closest('.scr');
    if (scr && e.target === scr) {
      const s = SCREENS[cur];
      if (s.modal) {
        const r = view.getBoundingClientRect();
        const x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
        const [mx0, my0, mx1, my1] = s.modal;
        if (x < mx0 || x > mx1 || y < my0 || y > my1) { closeModal(); return; }
      }
      flashSpots();
    }
  });

  /* ================= Asistencia: one of four states per student ================= */
  const INIT = {};
  INIT.asistencia = (el, s) => {
    const KEYS = ['present', 'absent', 'late', 'justified'];
    let told = false;
    (s.asistencia || []).forEach(row => {
      const marks = row.map(([x0, y0, x1, y1, color, , title], k) => {
        const m = mk(el, 'div', 'att-on', px(x0, y0, x1, y1) + `;background:${color}`, `${svgI(KEYS[k] || 'present')}<span>${title}</span>`);
        return m;
      });
      const btns = row.map(([x0, y0, x1, y1, , , title]) => {
        const b = mk(el, 'button', 'spot', px(x0, y0, x1, y1));
        b.setAttribute('aria-label', title);
        b.setAttribute('aria-pressed', 'false');
        return b;
      });
      btns.forEach((b, k) => b.addEventListener('click', () => {
        marks.forEach((m, j) => m.classList.toggle('on', j === k));
        btns.forEach((o, j) => o.setAttribute('aria-pressed', String(j === k)));
        if (!told) { told = true; toast(t('demo.t.att')); }
      }));
    });
  };

  /* ================= Anotar actitud: a tap is a note, the arrow undoes it ================= */
  INIT.actitud = (el, s) => {
    let told = false;
    (s.actitud || []).forEach(row => {
      const done = [];
      const counts = row.botones.map(() => 0);
      const marks = row.botones.map(([x0, y0, x1, y1, pos]) => {
        const m = mk(el, 'div', 'act-on ' + (pos ? 'pos' : 'neg'), px(x0, y0, x1, y1));
        mk(m, 'b', '', '', '');
        return m;
      });
      const paint = k => {
        marks[k].classList.toggle('on', counts[k] > 0);
        marks[k].firstChild.textContent = counts[k] || '';
      };
      row.botones.forEach(([x0, y0, x1, y1, , label], k) => {
        const b = mk(el, 'button', 'spot', px(x0, y0, x1, y1));
        b.setAttribute('aria-label', label);
        b.addEventListener('click', () => {
          counts[k]++;
          done.push(k);
          paint(k);
          undo.classList.add('on');
          if (!told) { told = true; toast(t('demo.t.act')); }
        });
      });
      const [u0, u1, u2, u3] = row.deshacer;
      const undoMark = mk(el, 'div', 'act-undo', px(u0, u1, u2, u3), '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>');
      const undo = undoMark;
      const ub = mk(el, 'button', 'spot', px(u0, u1, u2, u3));
      ub.setAttribute('aria-label', t('demo.undo'));
      ub.addEventListener('click', () => {
        const k = done.pop();
        if (k == null) return;
        counts[k]--;
        paint(k);
        undo.classList.toggle('on', done.length > 0);
      });
    });
  };

  /* ================= Evaluar con rúbrica: one level per criterion ================= */
  const LV = { 1: ['#dc2626', 'rgba(220,38,38,.10)'], 2: ['#d97706', 'rgba(217,119,6,.10)'], 3: ['#2563eb', 'rgba(37,99,235,.10)'], 4: ['#16a34a', 'rgba(22,163,74,.10)'] };
  INIT.rubrica = (el, s) => {
    let told = false;
    (s.rubrica || []).forEach((row, r) => {
      const pick = mk(el, 'div', 'pick');
      let state = 0;
      const btns = row.map(([x0, y0, x1, y1], c) => {
        const b = mk(el, 'button', 'spot', px(x0, y0, x1, y1));
        b.setAttribute('aria-label', t('demo.cell', { c: r + 1, n: c + 1 }));
        b.setAttribute('aria-pressed', 'false');
        return b;
      });
      btns.forEach((b, c) => b.addEventListener('click', () => {
        const [x0, y0, x1, y1] = row[c];
        state = state === c + 1 ? 0 : c + 1;
        if (state) {
          const [bc, tint] = LV[state] || LV[4];
          pick.style.cssText = px(x0 + 3, y0 + 3, x1 - 3, y1 - 3) + `;background:${tint};box-shadow:inset 0 0 0 2px ${bc}`;
          pick.classList.remove('on');
          void pick.offsetWidth;
          pick.classList.add('on');
        } else pick.classList.remove('on');
        btns.forEach((o, j) => o.setAttribute('aria-pressed', String(j === c && !!state)));
        if (!told) { told = true; toast(t('demo.t.rubric')); }
      }));
    });
  };

  /* ================= Evaluar con diana: each ring is a level, the mark works itself out ================= */
  let diana = null;
  INIT.dianaeval = (el, s) => {
    const d = s.diana;
    if (!d) return null;
    const [vx, vy, vw, vh] = d.viewBox.split(/\s+/).map(Number);
    const C = 170, R = 116, RINGS = 4;
    const n = d.items.length, step = 2 * Math.PI / n, gap = Math.min(step * 0.05, 0.035);
    const ringR = [1, 2, 3, 4].map(k => k / RINGS * R);
    const LABEL = ['Insuficiente', 'Suficiente', 'Bien', 'Excelente'];
    const COLOR = ['#dc2626', '#d97706', '#2563eb', '#16a34a'];
    const polar = (a, r) => [C + r * Math.cos(a), C + r * Math.sin(a)];
    const f = v => v.toFixed(2);
    const petal = (a0, a1, r) => {
      const [x0, y0] = polar(a0, r), [x1, y1] = polar(a1, r);
      return `M ${C} ${C} L ${f(x0)} ${f(y0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f(x1)} ${f(y1)} Z`;
    };
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', d.viewBox);
    svg.setAttribute('class', 'dia-svg');
    svg.style.cssText = px(...d.svg);
    const petals = d.items.map(() => { const p = document.createElementNS(ns, 'path'); p.setAttribute('fill-opacity', '.82'); svg.append(p); return p; });
    let guides = ringR.slice(0, RINGS - 1).map(r => `<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="#fff" stroke-width="1" stroke-opacity=".5"/>`).join('');
    guides += `<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="#ece6db" stroke-width="1.5"/>`;
    guides += d.items.map((_, i) => { const [x, y] = polar(i * step - Math.PI / 2, R); return `<line x1="${C}" y1="${C}" x2="${f(x)}" y2="${f(y)}" stroke="#ece6db" stroke-opacity=".55"/>`; }).join('');
    svg.insertAdjacentHTML('beforeend', guides);
    el.append(svg);

    const pills = d.items.map(it => mk(el, 'div', 'dia-pill', px(...it.pill)));
    const nota = d.nota ? mk(el, 'div', 'dia-nota', px(...d.nota)) : null;
    const cuenta = d.cuenta ? mk(el, 'div', 'dia-cuenta', px(...d.cuenta)) : null;
    const levels = d.items.map(() => 0);
    diana = { done: false };
    let told = false;

    function paint() {
      levels.forEach((lv, i) => {
        const a0 = i * step - Math.PI / 2;
        if (lv) { petals[i].setAttribute('d', petal(a0 + gap, a0 + step - gap, ringR[lv - 1])); petals[i].setAttribute('fill', COLOR[lv - 1]); }
        else petals[i].removeAttribute('d');
        pills[i].classList.toggle('on', !!lv);
        pills[i].style.background = lv ? COLOR[lv - 1] : '';
        pills[i].textContent = lv ? `${lv} · ${LABEL[lv - 1]}` : '';
      });
      const marked = levels.filter(Boolean).length;
      let sum = 0, w = 0;
      levels.forEach((lv, i) => { if (lv) { const wi = d.items[i].weight || 1; sum += lv / RINGS * wi; w += wi; } });
      const grade = w ? Math.round(sum / w * 100) / 10 : null;
      if (nota) {
        nota.classList.toggle('on', grade != null);
        nota.textContent = grade == null ? '' : grade.toFixed(1).replace('.', ',');
        nota.style.color = grade == null ? '' : grade < 5 ? '#dc2626' : grade < 7 ? '#d97706' : '#047857';
      }
      if (cuenta) { cuenta.classList.toggle('on', marked > 0); cuenta.textContent = `${marked}/${n} ítems marcados`; }
      diana.done = marked === n;
      if (diana.done) toast(t('demo.t.dianaDone', { n: grade.toFixed(1).replace('.', ',') }));
    }
    const hit = mk(el, 'button', 'spot big', px(...d.svg));
    hit.setAttribute('aria-label', t('demo.dianaHit'));
    hit.addEventListener('click', e => {
      if (e.detail === 0) {   // keyboard: next item, at Bien
        const i = levels.indexOf(0);
        if (i >= 0) { levels[i] = 3; paint(); }
        return;
      }
      const r = hit.getBoundingClientRect();
      const x = vx + (e.clientX - r.left) * vw / r.width, y = vy + (e.clientY - r.top) * vh / r.height;
      const dx = x - C, dy = y - C, dist = Math.hypot(dx, dy);
      if (dist > R) return;
      let a = Math.atan2(dy, dx) + Math.PI / 2;
      a = (a % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      const i = Math.min(n - 1, Math.floor(a / step));
      const lv = clamp(Math.ceil(dist / (R / RINGS)), 1, RINGS);
      levels[i] = lv;
      paint();
      if (!told && !diana.done) { told = true; toast(t('demo.t.diana')); }
    });
    paint();
    return null;
  };

  /* ================= Pizarra y herramientas: board, timer, roulette and calculator ================= */
  INIT.pizarra = (el, s) => {
    const L = s.live;
    if (!L) return null;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const add = (tag, cls, box, html) => mk(el, tag, cls, box ? px(...box) : '', html);

    /* --- the board: draw anywhere except over the tools --- */
    const cv = document.createElement('canvas');
    cv.className = 'draw';
    cv.width = W;
    cv.height = SH;
    cv.setAttribute('aria-hidden', 'true');
    el.firstChild.after(cv);
    const ctx = cv.getContext('2d');
    const BLOCK = (L.bloques || []).filter(Boolean).map(([a, b, c, d]) => [a - 4, b - 4, c - a + 8, d - b + 8]);
    BLOCK.push([0, 0, 256, SH], [0, 0, W, 54]);
    const colors = (L.lapiz && L.lapiz.colores) || [];
    let ink = colors[0] ? colors[0][4] : '#0f172a', last = null;
    const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * SH / r.height]; };
    function stroke(a, b) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, SH);
      BLOCK.forEach(r => ctx.rect(...r));
      ctx.clip('evenodd');
      ctx.strokeStyle = ink;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      ctx.restore();
    }
    cv.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      cv.setPointerCapture(e.pointerId);
      last = at(e);
      stroke(last, [last[0] + 0.01, last[1]]);
      e.preventDefault();
    });
    cv.addEventListener('pointermove', e => { if (!last) return; const p = at(e); stroke(last, p); last = p; });
    ['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, () => { last = null; }));
    const ring = add('div', 'dot-ring');
    const moveRing = ([x0, y0, x1, y1]) => { ring.style.cssText = px(x0 - 2, y0 - 2, x1 + 2, y1 + 2); };
    if (colors[0]) moveRing(colors[0]);
    colors.forEach(c => {
      const b = add('button', 'spot round', c.slice(0, 4));
      b.setAttribute('aria-label', t('demo.color'));
      b.addEventListener('click', () => { ink = c[4]; moveRing(c); });
    });
    if (L.lapiz && L.lapiz.borrar) {
      const er = add('button', 'spot', L.lapiz.borrar);
      er.setAttribute('aria-label', t('demo.clear'));
      er.addEventListener('click', () => ctx.clearRect(0, 0, W, SH));
    }

    /* --- timer --- */
    const T = L.temporizador;
    let stopTimer = () => {};
    if (T) {
      let total = 300, left = 300, running = false, endAt = 0, iv = 0;
      const digits = add('div', 'lv t-digits', T.cifras);
      const goBtn = add('button', 'lv go', T.iniciar);
      const fmt = v => { v = Math.max(0, Math.ceil(v)); return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0'); };
      const paintT = () => {
        digits.textContent = fmt(left);
        // Lo que se ve, en castellano como la captura; lo que se lee, en el idioma elegido
        goBtn.innerHTML = running ? `${svgI('pause')}Pausar` : `${svgI('play')}Iniciar`;
        goBtn.setAttribute('aria-label', `${running ? t('demo.pause') : t('demo.start')}, ${fmt(left)}`);
      };
      const stop = () => { running = false; clearInterval(iv); iv = 0; };
      stopTimer = stop;
      const start = () => {
        if (left <= 0) left = total;
        running = true;
        endAt = performance.now() + left * 1000;
        digits.classList.remove('done');
        clearInterval(iv);
        iv = setInterval(() => {
          left = (endAt - performance.now()) / 1000;
          if (left <= 0) {
            left = 0;
            stop();
            digits.classList.add('done');
            toast(t('demo.t.timeUp'));
            later(() => { left = total; digits.classList.remove('done'); paintT(); }, 3200);
          }
          paintT();
        }, 200);
      };
      goBtn.addEventListener('click', () => { if (running) { left = (endAt - performance.now()) / 1000; stop(); } else start(); paintT(); });
      const face = add('button', 'spot round', T.cifras);
      face.setAttribute('aria-label', t('demo.startPause'));
      face.addEventListener('click', () => goBtn.click());
      const chips = (T.fichas || []).map(([x0, y0, x1, y1, label]) => {
        const secs = /min/.test(label) ? parseInt(label, 10) * 60 : parseInt(label, 10);
        const b = add('button', 'lv chipt' + (secs === 300 ? ' on' : ''), [x0, y0, x1, y1], label);
        b.addEventListener('click', () => {
          stop();
          total = left = secs;
          chips.forEach(c => c.classList.toggle('on', c === b));
          digits.classList.remove('done');
          paintT();
        });
        return b;
      });
      const adjust = dlt => {
        if (running) { endAt = Math.max(performance.now() + 1000, endAt + dlt * 1000); left = (endAt - performance.now()) / 1000; }
        else left = clamp(Math.ceil(left) + dlt, 10, 99 * 60);
        chips.forEach(c => c.classList.remove('on'));
        paintT();
      };
      const minus = add('button', 'spot round', T.menos);
      minus.setAttribute('aria-label', t('demo.minus'));
      minus.addEventListener('click', () => adjust(-60));
      const plus = add('button', 'spot round', T.mas);
      plus.setAttribute('aria-label', t('demo.plus'));
      plus.addEventListener('click', () => adjust(60));
      const rst = add('button', 'spot', T.reiniciar);
      rst.setAttribute('aria-label', t('demo.reset'));
      rst.addEventListener('click', () => { stop(); left = total; digits.classList.remove('done'); paintT(); });
      paintT();
    }

    /* --- roulette --- */
    const Rl = L.ruleta;
    if (Rl) {
      const [d0, d1, d2, d3] = Rl.disco;
      const disc = new Image();
      disc.className = 'disc';
      disc.alt = '';
      disc.src = 'assets/demo/ruleta-disco.webp';
      disc.style.cssText = px(d0, d1, d2, d3);
      el.append(disc);
      const cx = (d0 + d2) / 2;
      add('div', 'pointer', [cx - 11, d1 - 4, cx + 11, d1 + 16]);
      const hub = add('button', 'lv hub', Rl.centro);
      hub.style.backgroundImage = 'url(assets/demo/ruleta-centro.webp)';
      hub.setAttribute('aria-label', t('demo.spin'));
      const result = add('div', 'lv winner', [d0 - 30, d3 + 28, d2 + 30, d3 + 62]);
      result.setAttribute('aria-live', 'polite');
      const NAMES = Rl.nombres || [];
      let angle = 0, spinning = false;
      hub.addEventListener('click', () => {
        if (spinning || !NAMES.length) return;
        spinning = true;
        hub.classList.remove('pulse');
        const seg = 360 / NAMES.length;
        const pick = Math.floor(Math.random() * NAMES.length);
        const phi = pick * seg + seg * (0.2 + Math.random() * 0.6);
        const target = Math.ceil((angle + 360 * 5) / 360) * 360 + (360 - phi);
        const dur = reduce.matches ? 0 : 4000;
        result.classList.add('on');
        result.textContent = 'Girando…';
        result.setAttribute('aria-label', t('demo.spinning'));
        disc.style.transition = dur ? `transform ${dur}ms cubic-bezier(.16,1,.3,1)` : 'none';
        disc.style.transform = `rotate(${target}deg)`;
        angle = target;
        later(() => {
          spinning = false;
          result.innerHTML = `¡Le toca a <b>${NAMES[pick]}</b>!`;
          result.setAttribute('aria-label', t('demo.winner', { x: NAMES[pick] }));
        }, dur + 80);
      });
    }

    /* --- calculator --- */
    const Cc = L.calculadora;
    if (Cc && Cc.pantalla) {
      const [p0, p1, p2, p3] = Cc.pantalla;
      const disp = add('div', 'lv calc-d', [p0 + 2, p1 + 2, p2 - 2, p3 - 2], '<span class="ex"></span><span class="res">0</span>');
      const exEl = $('.ex', disp), resEl = $('.res', disp);
      const NAMES_K = { 'C': 'C', '()': '( )', '%': '%', '÷': '÷', '×': '×', '−': '−', '+': '+', ',': ',', '⌫': '⌫', '=': '=' };
      let expr = '', fresh = false;
      const isOp = c => '+−×÷'.includes(c);
      const show = () => {
        const txt = expr || '0';
        resEl.textContent = txt;
        resEl.style.fontSize = clamp(34 - Math.max(0, txt.length - 10) * 2, 16, 34) + 'px';
      };
      function evaluate(src) {
        const str = src.replace(/,/g, '.');
        let i = 0;
        const peek = () => str[i];
        function num() {
          const st = i;
          while (i < str.length && /[0-9.]/.test(str[i])) i++;
          if (st === i) throw new Error('num');
          const v = parseFloat(str.slice(st, i));
          if (Number.isNaN(v)) throw new Error('num');
          return v;
        }
        function factor() {
          if (peek() === '−') { i++; return -factor(); }
          let v;
          if (peek() === '(') { i++; v = sum(); if (peek() === ')') i++; } else v = num();
          while (peek() === '%') { i++; v /= 100; }
          return v;
        }
        function product() {
          let v = factor();
          while (peek() === '×' || peek() === '÷') { const op = str[i++]; const r = factor(); v = op === '×' ? v * r : v / r; }
          return v;
        }
        function sum() {
          let v = product();
          while (peek() === '+' || peek() === '−') { const op = str[i++]; const r = product(); v = op === '+' ? v + r : v - r; }
          return v;
        }
        const v = sum();
        if (i !== str.length || !Number.isFinite(v)) throw new Error('syntax');
        return v;
      }
      const pretty = v => {
        const r = Math.round(v * 1e10) / 1e10;
        const out = Math.abs(r) >= 1e12 ? r.toPrecision(8) : String(r);
        return out.replace('-', '−').replace('.', ',');
      };
      function press(k) {
        const lastC = expr.slice(-1);
        if (/[0-9]/.test(k)) { if (fresh) { expr = ''; exEl.textContent = ''; } expr += k; fresh = false; }
        else if (k === ',') {
          if (fresh) { expr = ''; fresh = false; }
          const tail = expr.split(/[+−×÷()]/).pop();
          if (!tail.includes(',')) expr += tail === '' ? '0,' : ',';
        } else if (isOp(k)) {
          fresh = false;
          if (!expr) { if (k === '−') expr = '−'; }
          else if (isOp(lastC)) expr = expr.slice(0, -1) + k;
          else if (lastC !== '(' || k === '−') expr += k;
        } else if (k === '%') { if (/[0-9)]/.test(lastC)) expr += '%'; fresh = false; }
        else if (k === '()') {
          fresh = false;
          const open = (expr.match(/\(/g) || []).length - (expr.match(/\)/g) || []).length;
          if (open > 0 && /[0-9)%]/.test(lastC)) expr += ')';
          else expr += /[0-9)%]/.test(lastC) ? '×(' : '(';
        } else if (k === '⌫') { expr = fresh ? '' : expr.slice(0, -1); fresh = false; }
        else if (k === 'C') { expr = ''; exEl.textContent = ''; fresh = false; }
        else if (k === '=') {
          let src = expr;
          while (src && (isOp(src.slice(-1)) || src.slice(-1) === '(')) src = src.slice(0, -1);
          if (!src) return;
          const open = (src.match(/\(/g) || []).length - (src.match(/\)/g) || []).length;
          src += ')'.repeat(Math.max(0, open));
          try {
            const v = evaluate(src);
            exEl.textContent = src + ' =';
            expr = pretty(v);
          } catch (err) {
            exEl.textContent = src;
            expr = '';
            resEl.textContent = 'Error';
            fresh = true;
            return;
          }
          fresh = true;
        }
        show();
      }
      (Cc.teclas || []).forEach(([x0, y0, x1, y1, k]) => {
        const b = add('button', 'lv key', [x0, y0, x1, y1]);
        b.setAttribute('aria-label', NAMES_K[k] || k);
        b.addEventListener('click', () => press(k));
      });
      show();
    }

    return () => { stopTimer(); timers.forEach(clearTimeout); };
  };

  /* ================= toolbar above the window ================= */
  btnSpots.addEventListener('click', () => {
    const on = btnSpots.getAttribute('aria-pressed') !== 'true';
    btnSpots.setAttribute('aria-pressed', String(on));
    win.classList.toggle('show-spots', on);
  });
  btnZoom.addEventListener('click', () => {
    const s = SCREENS[cur];
    if (!s || !window.AulaZoom) return;
    window.AulaZoom.open('assets/demo/' + s.img, altOf(cur));
  });
  function bringIntoView() {
    const r = stageEl.getBoundingClientRect();
    if (r.top < 70 || r.top > innerHeight * 0.45) scrollTo({ top: scrollY + r.top - 84, behavior: reduce.matches ? 'auto' : 'smooth' });
  }
  $$('[data-try]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.try;
    if (k === 'ruleta') { go('pizarra', { noHint: true }); const hub = $('.hub', view); if (hub) hub.classList.add('pulse'); toast(t('demo.h.ruleta')); }
    else if (k === 'dibujar') { go('pizarra', { noHint: true }); toast(t('demo.h.dibujar')); }
    else go(k);
    bringIntoView();
  }));

  /* ================= start ================= */
  $$('.lang button').forEach(b => b.addEventListener('click', () => applyLang(b.dataset.lang, true)));
  const fromUrl = new URLSearchParams(location.search).get('lang');
  const nav0 = (navigator.language || 'es').slice(0, 2).toLowerCase();
  const firstLang = [fromUrl, store.get('aula-lang'), nav0].find(l => l && DICT[l]) || 'es';
  fit(true);
  const hash = location.hash.slice(1);
  go(SCREENS[hash] ? hash : 'inicio', { quiet: true });
  applyLang(firstLang, false);

  // warm the screens one can reach in a click once the page is idle, so they answer at once
  const warm = () => ['evaluar', 'enclase', 'pizarra', 'actitud', 'cuaderno', 'asistencia', 'rubricas', 'rubrica', 'dianas', 'dianaeval', 'ruleta-disco', 'ruleta-centro']
    .forEach(n => { const i = new Image(); i.src = `assets/demo/${n}.webp`; });
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 }); else setTimeout(warm, 1500);
})();
