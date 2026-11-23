/* AulaPro · the interactive demo. A replica of the app window, drawn at its real size (1920 x 1032)
   and scaled to fit. Each screen is a real screenshot of the app (assets/demo, made by
   scripts/web/capturar.mjs) with buttons laid over it where the app has them, so the whole window,
   menu included, answers like the app. Some tools really work: the board (pencil, felt pen, highlighter and
   eraser), roulette, timer, calculator, attendance, behaviour notes, and assessing the class with a rubric or an
   assessment target (the list of students, «Guardar y siguiente»). Nothing is saved.
   The board is spread out on purpose (timer, roulette and calculator each have their own room, clear of the bars and
   of the pen bar): see scripts/web/capturar.mjs. */
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
    paintPerfil();
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
    im.src = 'assets/demo/' + (s.base || s.img);
    el.append(im);
    (s.spots || []).forEach(sp => spot(el, sp));
    if (INIT[id]) cleanup = INIT[id](el, s, opt) || null;
    view.replaceChildren(el);
    // «Evaluar a la clase» has its buttons at the foot of the window, right where the tips come out: there, they go at the top
    toastBox.classList.toggle('alto', !!s.clase);
    // On a phone the window does not fit: a screen that is a dialog opens scrolled to it, not to the menu behind
    if (s.modal && wrap.classList.contains('narrow')) $('.stage-scroll', wrap).scrollLeft = Math.max(0, s.modal[0] * scale - 8);
    if (!first && !opt.quiet && !reduce.matches) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    if (!opt.quiet) srNote.textContent = `${t('demo.screen')}: ${s.title}`;
    if (HINT[id] && !opt.quiet && !opt.noHint) setTimeout(() => { if (cur === id) toast(t(HINT[id])); }, 450);
  }
  // The three profiles of the app: each one has its own menu and its own first screen
  const PERFIL_DE = id => (id.startsWith('ef-') ? 'ef' : id.startsWith('pt-') ? 'apoyo' : 'aula');
  const INICIO = { aula: 'inicio', ef: 'ef-inicio', apoyo: 'pt-inicio' };
  function paintPerfil() {
    const p = PERFIL_DE(cur || 'inicio');
    $$('.pf').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.perfil === p)));
  }
  $$('.pf').forEach(b => b.addEventListener('click', () => { if (SCREENS[INICIO[b.dataset.perfil]]) go(INICIO[b.dataset.perfil], { quiet: true }); }));

  // A short tip the first moment a screen with something to try opens
  const HINT = { pizarra: 'demo.h.pizarra', actitud: 'demo.h.actitud', asistencia: 'demo.h.asistencia', rubrica: 'demo.h.rubrica', dianaeval: 'demo.h.diana' };

  function closeModal() {
    const s = SCREENS[cur];
    go(s && s.back ? s.back : 'inicio');
  }

  const FN = { closeModal, full: toggleFull };
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

  /* ================= Evaluar a la clase: the list, who is being assessed and «Guardar y siguiente» =================
     The window of the rubric and the one of the target are the same in the app (components/evaluar/EvaluarClasePartes.tsx):
     the class at the top, its students in a list at the left with who is done, and a footer that saves and moves on to
     the next one. The capture brings where each piece is (`clase`, scripts/web/capturar.mjs) and the demo draws them
     again on top, in castellano like the capture, with the app's rules: what is marked for each student is kept while
     moving to another, saving marks the student as done today with the mark, and «siguiente» is the next one in the
     list who is not done today. `inst` is the instrument: its size, an empty set of marks, its mark out of 10 and how
     to show a set of marks. */
  const EVC_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const EVC_SAVE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>';
  const EVC_NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  const nota = v => v.toFixed(1).replace('.', ',');
  function claseEval(el, c, inst) {
    const rows = c.filas.map(f => ({ name: f.nombre, before: f.antes, marks: inst.blank(), saved: null }));
    const n = rows.length;
    let sel = 0, told = false;
    const same = (a, b) => a.every((v, i) => v === b[i]);
    const dirty = r => (r.saved ? !same(r.marks, r.saved) : r.marks.some(Boolean));
    // The next one in the list, going round, who is not done today; -1 if nobody is left
    const nextOf = i => { for (let k = 1; k < n; k++) { const j = (i + k) % n; if (!rows[j].saved) return j; } return -1; };

    const rowEls = c.filas.map(f => mk(el, 'div', 'evc-r', px(...f.caja), `<i>${EVC_CHECK}</i><b></b><span></span>`));
    const hits = c.filas.map((f, i) => {
      const b = mk(el, 'button', 'spot', px(...f.caja));
      b.addEventListener('click', () => { sel = i; paint(); });
      return b;
    });
    rowEls.forEach((r, i) => { $('b', r).textContent = rows[i].name; });
    const count = mk(el, 'div', 'evc-n', px(...c.cuenta));
    count.setAttribute('aria-live', 'polite');
    const bar = mk(el, 'div', 'evc-b', px(...c.barra), '<span></span>');
    const who = mk(el, 'div', 'evc-q', px(...c.quien));
    const [fx0, fy0, fx1, fy1] = c.pie;
    const foot = mk(el, 'div', 'evc-f', `right:${W - fx1}px;top:${fy0}px;height:${fy1 - fy0}px;min-width:${fx1 - fx0}px`);
    const closeB = mk(foot, 'button', 'gh', '', 'Cerrar');
    closeB.dataset.act = 'fn:closeModal';
    // «Guardar todo (n)»: as in the app, only while somebody else in the list has marks waiting to be saved
    const allB = mk(foot, 'button', 'gh');
    const act = mk(foot, 'button', 'ac');
    // «Poner a todos este nivel»: its sentence says how many students it reaches (not done today and with nothing marked),
    // and the app takes the whole block away when nobody is left
    const reach = c.todosFrase ? mk(el, 'div', 'evc-a', px(...c.todosFrase)) : null;
    const gone = c.todos ? mk(el, 'div', 'evc-x', px(...c.todos)) : null;

    function paint() {
      const done = rows.filter(r => r.saved).length, open = rows.filter(dirty).length;
      rows.forEach((r, i) => {
        const st = dirty(r) ? 'sin' : r.saved ? 'hoy' : '';
        rowEls[i].className = 'evc-r' + (st ? ' ' + st : '') + (i === sel ? ' sel' : '');
        const dato = st === 'sin' ? 'sin guardar' : st === 'hoy' ? nota(inst.grade(r.saved)) : r.before;
        rowEls[i].lastChild.textContent = dato;
        hits[i].setAttribute('aria-label', dato ? `${r.name}, ${dato}` : r.name);
        hits[i].setAttribute('aria-pressed', String(i === sel));
      });
      count.innerHTML = `<span><strong>${done} de ${n}</strong> ${esc(c.hoy || 'evaluados')}</span>${open ? `<em>${open} sin guardar</em>` : ''}`;
      bar.firstChild.style.width = (n ? done / n * 100 : 0) + '%';
      const r = rows[sel];
      const msg = r.saved
        ? 'Ya lo has evaluado hoy: lo que cambies corrige esa evaluación. <button type="button" data-act="t:evcOtro">Es otro trabajo</button>'
        : r.before
          ? `Ya tiene una evaluación del ${esc(r.before)}. Lo que guardes ahora será una evaluación nueva. <button type="button" data-act="t:evcCorr">Corregir la del ${esc(r.before)}</button>`
          : '';
      who.innerHTML = `<div><strong>${esc(r.name)}</strong><span>${sel + 1} de ${n} en la lista</span></div>${msg ? `<p>${msg}</p>` : ''}`;
      // As in the app: «Siguiente» with nothing to save; with something, «Guardar y siguiente» while somebody is left
      const next = nextOf(sel), d = dirty(r) && inst.count(r.marks) > 0;
      act.innerHTML = d ? EVC_SAVE + (next >= 0 ? 'Guardar y siguiente' : r.saved ? 'Guardar cambios' : 'Guardar evaluación') : 'Siguiente' + EVC_NEXT;
      act.disabled = !d && next < 0;
      const others = rows.some((x, i) => i !== sel && dirty(x));
      allB.hidden = !others;
      allB.innerHTML = EVC_SAVE + `Guardar todo (${open})`;
      const left = rows.filter(x => !x.saved && !x.marks.some(Boolean)).length;
      if (reach) reach.textContent = (left === 1 ? 'Marca ese nivel en todo a 1 alumno que falta.' : `Marca ese nivel en todo a los ${left} alumnos que faltan.`)
        + ' Después cambias solo las excepciones; no se guarda nada hasta que pulses Guardar.';
      if (gone) gone.hidden = left > 0;
      inst.show(r.marks);
    }
    allB.addEventListener('click', () => {
      rows.forEach(x => { if (dirty(x)) { if (inst.count(x.marks) > 0) x.saved = x.marks.slice(); else x.marks = x.saved.slice(); } });
      paint();
      toast(t(rows.every(x => x.saved) ? 'demo.t.evcFin' : 'demo.t.evcTodo'));
    });
    act.addEventListener('click', () => {
      const r = rows[sel];
      let said = '';
      if (dirty(r) && inst.count(r.marks) > 0) {
        const part = inst.count(r.marks) < inst.size;
        r.saved = r.marks.slice();
        const all = rows.every(x => x.saved);
        if (all) said = 'demo.t.evcFin';
        else if (part) said = 'demo.t.evcParcial';
        else if (!told) { told = true; said = 'demo.t.evcSave'; }
      } else if (r.saved) r.marks = r.saved.slice();   // everything unmarked on someone already saved: nothing to save
      const next = nextOf(sel);
      if (next >= 0) sel = next;
      paint();
      if (said) toast(t(said));
    });
    paint();
    return { marks: () => rows[sel].marks, changed: paint };
  }

  /* ================= Evaluar a la clase con una rúbrica: one level per criterion ================= */
  const LV = { 1: ['#dc2626', 'rgba(220,38,38,.10)'], 2: ['#d97706', 'rgba(217,119,6,.10)'], 3: ['#2563eb', 'rgba(37,99,235,.10)'], 4: ['#16a34a', 'rgba(22,163,74,.10)'] };
  INIT.rubrica = (el, s) => {
    const grid = s.rubrica || [];
    if (!grid.length || !s.clase) return null;
    let told = false;
    const max = grid[0].length;
    const picks = grid.map(() => mk(el, 'div', 'pick'));
    const btns = grid.map((row, r) => row.map(([x0, y0, x1, y1], c) => {
      const b = mk(el, 'button', 'spot', px(x0, y0, x1, y1));
      b.setAttribute('aria-label', t('demo.cell', { c: r + 1, n: c + 1 }));
      b.setAttribute('aria-pressed', 'false');
      return b;
    }));
    // The total of the footer: the pill «7 / 12» and its percentage
    const T = s.total;
    const tot = T ? mk(el, 'div', 'evc-t', `left:${T.caja[0]}px;top:${T.caja[1]}px;height:${T.caja[3] - T.caja[1]}px;min-width:${T.caja[2] - T.caja[0]}px`) : null;
    const show = marks => {
      marks.forEach((lv, r) => {
        const pick = picks[r];
        if (lv) {
          const [x0, y0, x1, y1] = grid[r][lv - 1];
          const [bc, tint] = LV[lv] || LV[4];
          const css = px(x0 + 3, y0 + 3, x1 - 3, y1 - 3) + `;background:${tint};box-shadow:inset 0 0 0 2px ${bc}`;
          if (pick.dataset.css !== css) {   // only what changes pops in
            pick.dataset.css = css;
            pick.style.cssText = css;
            pick.classList.remove('on');
            void pick.offsetWidth;
          }
          pick.classList.add('on');
        } else { pick.classList.remove('on'); pick.dataset.css = ''; }
        btns[r].forEach((b, j) => b.setAttribute('aria-pressed', String(j + 1 === lv)));
      });
      if (tot) {
        const sum = marks.reduce((a, v) => a + v, 0);
        tot.innerHTML = `<b>${sum} / ${T.max}</b><span>(${T.max ? Math.round(sum / T.max * 100) : 0}%)</span>`;
      }
    };
    const cls = claseEval(el, s.clase, {
      size: grid.length,
      blank: () => grid.map(() => 0),
      count: m => m.filter(Boolean).length,
      // As in the app (gradeFromLevels): only what is marked counts, never as a zero
      grade: m => { const on = m.filter(Boolean); return on.length ? on.reduce((a, v) => a + v / max, 0) / on.length * 10 : 0; },
      show
    });
    btns.forEach((row, r) => row.forEach((b, c) => b.addEventListener('click', () => {
      const m = cls.marks();
      m[r] = m[r] === c + 1 ? 0 : c + 1;   // the level already chosen, again: it is taken off
      cls.changed();
      if (!told) { told = true; toast(t('demo.t.rubric')); }
    })));
    return null;
  };

  /* ================= Evaluar a la clase con una diana: each ring is a level, the mark works itself out ================= */
  INIT.dianaeval = (el, s) => {
    const d = s.diana;
    if (!d || !s.clase) return null;
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
    const notaEl = d.nota ? mk(el, 'div', 'dia-nota', px(...d.nota)) : null;
    const cuenta = d.cuenta ? mk(el, 'div', 'dia-cuenta', px(...d.cuenta)) : null;
    // The footer says the mark too, once something is marked
    const K = s.clase.dato && s.clase.pie;
    const foot = K ? mk(el, 'div', 'evc-t', `left:${s.clase.dato[0]}px;top:${K[1]}px;height:${K[3] - K[1]}px`) : null;
    let told = false;
    // As in the app: each item counts with its weight, and only what is marked
    const grade = levels => {
      let sum = 0, w = 0;
      levels.forEach((lv, i) => { if (lv) { const wi = d.items[i].weight || 1; sum += lv / RINGS * wi; w += wi; } });
      return w ? Math.round(sum / w * 100) / 10 : 0;
    };
    const count = levels => levels.filter(Boolean).length;
    function show(levels) {
      levels.forEach((lv, i) => {
        const a0 = i * step - Math.PI / 2;
        if (lv) { petals[i].setAttribute('d', petal(a0 + gap, a0 + step - gap, ringR[lv - 1])); petals[i].setAttribute('fill', COLOR[lv - 1]); }
        else petals[i].removeAttribute('d');
        pills[i].classList.toggle('on', !!lv);
        pills[i].style.background = lv ? COLOR[lv - 1] : '';
        pills[i].textContent = lv ? `${lv} · ${LABEL[lv - 1]}` : '';
      });
      const marked = count(levels), g = grade(levels);
      if (notaEl) {
        notaEl.classList.toggle('on', marked > 0);
        notaEl.textContent = marked ? nota(g) : '';
        notaEl.style.color = !marked ? '' : g < 5 ? '#dc2626' : g < 7 ? '#d97706' : '#047857';
      }
      if (cuenta) { cuenta.classList.toggle('on', marked > 0); cuenta.textContent = `${marked}/${n} ítems marcados`; }
      if (foot) foot.innerHTML = marked ? `<i>Nota calculada</i><b>${nota(g)}</b>` : '';
    }
    const cls = claseEval(el, s.clase, { size: n, blank: () => d.items.map(() => 0), count, grade, show });
    const hit = mk(el, 'button', 'spot big', px(...d.svg));
    hit.setAttribute('aria-label', t('demo.dianaHit'));
    hit.addEventListener('click', e => {
      const levels = cls.marks();
      if (e.detail === 0) {   // keyboard: next item, at Bien
        const i = levels.indexOf(0);
        if (i < 0) return;
        levels[i] = 3;
      } else {
        const r = hit.getBoundingClientRect();
        const x = vx + (e.clientX - r.left) * vw / r.width, y = vy + (e.clientY - r.top) * vh / r.height;
        const dx = x - C, dy = y - C, dist = Math.hypot(dx, dy);
        if (dist > R) return;
        let a = Math.atan2(dy, dx) + Math.PI / 2;
        a = (a % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        levels[Math.min(n - 1, Math.floor(a / step))] = clamp(Math.ceil(dist / (R / RINGS)), 1, RINGS);
      }
      cls.changed();
      if (count(levels) === n) toast(t('demo.t.dianaDone', { n: nota(grade(levels)) }));
      else if (!told) { told = true; toast(t('demo.t.diana')); }
    });
    return null;
  };

  /* ================= Pizarra y herramientas: board, pen bar, timer, roulette and calculator =================
     The capture is taken with these hidden (scripts/web/capturar.mjs), so the demo draws them again, with the app's own
     measures, colours and rules (SecClassroom.tsx, lib/trazos.ts, lib/ruleta.ts), on the same white board. */
  const PZ_ICON = {
    lapiz: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    rotulador: '<path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/><path d="m2.3 2.3 7.286 7.286"/><circle cx="11" cy="11" r="2"/>',
    subrayador: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    borrador: '<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/>',
    deshacer: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
    rehacer: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/>',
    borrar: '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    play: '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
    pausa: '<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>',
    plumaLinea: '<path d="M13 21h8"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
    girando: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    trofeo: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    reiniciar: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'
  };
  const pzI = (k, size = 17) => `<svg class="pzi" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${PZ_ICON[k]}</svg>`;
  // As in the app: pen colours of the white board, highlighter colours, widths per tool and the highlighter's opacity
  const PZ_MARKER = ['#fde047', '#86efac', '#7dd3fc', '#f9a8d4', '#fdba74'];
  const PZ_WIDTH = { lapiz: [2, 3.5, 6], rotulador: [5, 9, 15], subrayador: [16, 26, 40], borrador: [18, 38, 76] };
  const PZ_ALPHA = 0.38;
  const PZ_TOOL = { 'Lápiz': 'lapiz', 'Rotulador': 'rotulador', 'Subrayador': 'subrayador', 'Borrador': 'borrador' };
  const PZ_WHEEL = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];
  const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  INIT.pizarra = (el, s) => {
    const L = s.live;
    if (!L) return null;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const add = (tag, cls, box, html) => mk(el, tag, cls, box ? px(...box) : '', html);

    /* --- the board: draw anywhere except over the bars and the tools --- */
    const cv = document.createElement('canvas');   // what is drawn
    const lv = document.createElement('canvas');   // the highlighter stroke being drawn, shown with its opacity
    [cv, lv].forEach(c => { c.width = W; c.height = SH; c.setAttribute('aria-hidden', 'true'); });
    cv.className = 'draw pen';
    lv.className = 'draw live';
    lv.style.opacity = PZ_ALPHA;
    el.firstChild.after(cv);
    cv.after(lv);
    const ctx = cv.getContext('2d'), lctx = lv.getContext('2d');
    const BLOCK = (L.bloques || []).filter(Boolean).map(([a, b, c, d]) => [a - 4, b - 4, c - a + 8, d - b + 8]);
    BLOCK.push([0, 0, 256, SH], [256, 0, W - 256, 54]);
    const smooth = (c, p) => {
      c.beginPath();
      c.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length - 1; i++) c.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
      c.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    };
    function paint(c, st, live) {
      if (st.t === 'limpiar') { c.clearRect(0, 0, W, SH); return; }
      c.save();
      c.beginPath();
      c.rect(0, 0, W, SH);
      BLOCK.forEach(r => c.rect(...r));
      c.clip('evenodd');
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.strokeStyle = c.fillStyle = st.c;
      c.lineWidth = st.w;
      c.globalCompositeOperation = st.t === 'borrador' ? 'destination-out' : 'source-over';
      // Live, the highlighter is drawn opaque on its own layer, which is shown with the opacity (so overlaps do not darken)
      c.globalAlpha = st.t === 'subrayador' && !live ? PZ_ALPHA : 1;
      if (st.p.length === 1) { c.beginPath(); c.arc(st.p[0][0], st.p[0][1], st.w / 2, 0, Math.PI * 2); c.fill(); }
      else { smooth(c, st.p); c.stroke(); }
      c.restore();
    }
    const strokes = [], redone = [];
    let penOn = true, tool = 'lapiz', size = 1, cur = null;
    const PEN = (L.paleta && L.paleta.colores || []).map(c => c[4]);
    let ink = PEN[0] || '#0f172a', inkMarker = PZ_MARKER[0];
    const inkNow = () => (tool === 'subrayador' ? inkMarker : ink);
    const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * SH / r.height]; };
    const hasInk = () => strokes.length > 0 && strokes[strokes.length - 1].t !== 'limpiar';
    const repaint = () => { ctx.clearRect(0, 0, W, SH); strokes.forEach(st => paint(ctx, st, false)); };
    cv.addEventListener('pointerdown', e => {
      if (!penOn || e.button > 0) return;
      cv.setPointerCapture(e.pointerId);
      cur = { t: tool, c: inkNow(), w: PZ_WIDTH[tool][size], p: [at(e)] };
      redone.length = 0;
      paint(tool === 'subrayador' ? lctx : ctx, cur, true);
      e.preventDefault();
      syncBar();
    });
    cv.addEventListener('pointermove', e => {
      if (!cur) return;
      const p = at(e), prev = cur.p[cur.p.length - 1];
      cur.p.push(p);
      if (cur.t === 'subrayador') { lctx.clearRect(0, 0, W, SH); paint(lctx, cur, true); }
      else paint(ctx, { t: cur.t, c: cur.c, w: cur.w, p: [prev, p] }, true);
    });
    const endStroke = () => {
      if (!cur) return;
      const st = cur;
      cur = null;
      if (st.t === 'subrayador') { lctx.clearRect(0, 0, W, SH); paint(ctx, st, false); }
      strokes.push(st);
      syncBar();
    };
    ['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, endStroke));
    /* --- the pen bar --- */
    let syncBar = () => {};
    if (L.paleta) {
      const P = L.paleta, [bx, by] = P.caja;
      const bar = add('div', 'pz-bar', P.caja);
      const inBar = ([x0, y0, x1, y1]) => px(x0 - bx, y0 - by, x1 - bx, y1 - by);
      const put = (cls, box, html, label) => {
        const b = mk(bar, 'button', cls, inBar(box), html);
        if (label) b.setAttribute('aria-label', label);
        return b;
      };
      P.separadores.forEach(b => mk(bar, 'i', 'pz-sep', inBar(b)));
      const tools = P.herramientas.map(([x0, y0, x1, y1, name]) => {
        const k = PZ_TOOL[name];
        const b = put('pz-tb', [x0, y0, x1, y1], pzI(k), name);
        b.addEventListener('click', () => { tool = k; syncBar(); });
        return [k, b];
      });
      const sizes = P.grosores.map(([x0, y0, x1, y1, name, dot], i) => {
        const b = put('pz-sz', [x0, y0, x1, y1], `<span style="width:${dot}px;height:${dot}px"></span>`, name);
        b.addEventListener('click', () => { size = i; syncBar(); });
        return b;
      });
      const dots = P.colores.map(([x0, y0, x1, y1], i) => {
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;   // the chosen one is measured enlarged: always 22 px
        const b = put('pz-co', [cx - 11, cy - 11, cx + 11, cy + 11], '', t('demo.color'));
        b.addEventListener('click', () => { if (tool === 'subrayador') inkMarker = PZ_MARKER[i]; else ink = PEN[i]; syncBar(); });
        return b;
      });
      const undoB = put('pz-tb', P.deshacer, pzI('deshacer'), t('demo.pzUndo'));
      const redoB = put('pz-tb', P.rehacer, pzI('rehacer'), t('demo.pzRedo'));
      const clearB = put('pz-tb', P.borrar, pzI('borrar'), t('demo.clear'));
      undoB.addEventListener('click', () => { if (strokes.length) { redone.push(strokes.pop()); repaint(); syncBar(); } });
      redoB.addEventListener('click', () => { if (redone.length) { strokes.push(redone.pop()); repaint(); syncBar(); } });
      clearB.addEventListener('click', () => {
        if (!hasInk()) return;
        redone.length = 0;
        strokes.push({ t: 'limpiar' });
        ctx.clearRect(0, 0, W, SH);
        syncBar();
      });
      syncBar = () => {
        tools.forEach(([k, b]) => { b.classList.toggle('on', k === tool); b.setAttribute('aria-pressed', String(k === tool)); });
        sizes.forEach((b, i) => { b.classList.toggle('on', i === size); b.setAttribute('aria-pressed', String(i === size)); });
        const colours = tool === 'subrayador' ? PZ_MARKER : PEN;
        dots.forEach((b, i) => {
          const on = colours[i] === inkNow();
          b.style.background = colours[i];
          b.classList.toggle('on', on);
          b.classList.toggle('dk', tool !== 'subrayador' && i === 0);
          b.setAttribute('aria-pressed', String(on));
          b.style.visibility = tool === 'borrador' ? 'hidden' : '';
        });
        undoB.disabled = !strokes.length;
        redoB.disabled = !redone.length;
        clearB.disabled = !hasInk();
      };
      // The pencil of the top bar shows and hides the pen bar, as in the app
      const penTop = add('button', 'pz-top', L.lapizSuperior, pzI('plumaLinea', 19));
      const topLabel = () => { penTop.setAttribute('aria-label', t(penOn ? 'demo.penOff' : 'demo.penOn')); penTop.setAttribute('aria-pressed', String(penOn)); };
      penTop.addEventListener('click', () => {
        penOn = !penOn;
        bar.hidden = !penOn;
        penTop.classList.toggle('off', !penOn);
        cv.classList.toggle('pen', penOn);
        cv.style.pointerEvents = penOn ? '' : 'none';
        topLabel();
      });
      topLabel();
      syncBar();
    }

    /* --- timer --- */
    const T = L.temporizador;
    let stopTimer = () => {};
    if (T) {
      const R = 78, CIRC = 2 * Math.PI * R;
      const ring = add('div', 'lv pz-ring', T.anillo,
        `<svg viewBox="0 0 190 190" width="190" height="190" aria-hidden="true"><circle cx="95" cy="95" r="${R}" fill="none" stroke="rgba(15,23,42,.08)" stroke-width="11"/><circle class="arc" cx="95" cy="95" r="${R}" fill="none" stroke="#22d3ee" stroke-width="11" stroke-linecap="round" stroke-dasharray="${CIRC}"/></svg>`);
      const arc = $('.arc', ring);
      const [cx0, cy0, cx1, cy1] = T.cifras;
      const digits = add('button', 'lv t-digits', T.cifras);
      const hint = add('div', 'lv t-hint', [cx0 - 20, cy1 + 2, cx1 + 20, cy1 + 16]);
      const goBtn = add('button', 'lv go', T.iniciar);
      let total = 300, left = 300, running = false, finished = false, endAt = 0, iv = 0;
      const fmt = v => { v = Math.max(0, Math.ceil(v)); return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0'); };
      const paintT = () => {
        const pct = total > 0 ? left / total : 0;
        arc.setAttribute('stroke', finished || pct <= 0.1 ? '#f43f5e' : pct <= 0.25 ? '#fbbf24' : '#22d3ee');
        arc.style.strokeDashoffset = CIRC * (1 - pct);
        digits.textContent = fmt(left);
        hint.textContent = finished ? '¡Tiempo!' : running ? '' : 'toca para editar';
        hint.classList.toggle('end', finished);
        ring.classList.toggle('end', finished);
        digits.classList.toggle('end', finished);
        goBtn.classList.toggle('run', running);
        // Lo que se ve, en castellano como la captura; lo que se lee, en el idioma elegido
        goBtn.innerHTML = running ? `${pzI('pausa')}Pausa` : `${pzI('play')}Iniciar`;
        goBtn.setAttribute('aria-label', `${running ? t('demo.pause') : t('demo.start')}, ${fmt(left)}`);
        digits.setAttribute('aria-label', `${t('demo.startPause')}, ${fmt(left)}`);
      };
      const stop = () => { running = false; clearInterval(iv); iv = 0; };
      stopTimer = stop;
      const start = () => {
        if (left <= 0) left = total;
        finished = false;
        running = true;
        endAt = performance.now() + left * 1000;
        clearInterval(iv);
        iv = setInterval(() => {
          left = (endAt - performance.now()) / 1000;
          if (left <= 0) {
            left = 0;
            stop();
            finished = true;
            toast(t('demo.t.timeUp'));
            later(() => { left = total; finished = false; paintT(); }, 3200);
          }
          paintT();
        }, 200);
        paintT();
      };
      const toggle = () => { if (running) { left = (endAt - performance.now()) / 1000; stop(); paintT(); } else start(); };
      goBtn.addEventListener('click', toggle);
      digits.addEventListener('click', toggle);
      const chips = (T.fichas || []).map(([x0, y0, x1, y1, label]) => {
        const secs = /min/.test(label) ? parseInt(label, 10) * 60 : parseInt(label, 10);
        const b = add('button', 'lv chipt' + (secs === 300 ? ' on' : ''), [x0, y0, x1, y1], label);
        b.addEventListener('click', () => {
          stop();
          total = left = secs;
          finished = false;
          chips.forEach(c => c.classList.toggle('on', c === b));
          paintT();
        });
        return b;
      });
      const adjust = dlt => {
        stop();
        total = left = clamp(Math.round(total) + dlt, 0, 99 * 60 + 59);
        finished = false;
        chips.forEach((c, i) => c.classList.toggle('on', /min/.test(T.fichas[i][4]) ? parseInt(T.fichas[i][4], 10) * 60 === total : parseInt(T.fichas[i][4], 10) === total));
        paintT();
      };
      const minus = add('button', 'spot', T.menos);
      minus.setAttribute('aria-label', t('demo.minus'));
      minus.addEventListener('click', () => adjust(-60));
      const plus = add('button', 'spot', T.mas);
      plus.setAttribute('aria-label', t('demo.plus'));
      plus.addEventListener('click', () => adjust(60));
      const rst = add('button', 'spot', T.reiniciar);
      rst.setAttribute('aria-label', t('demo.reset'));
      rst.addEventListener('click', () => { stop(); left = total; finished = false; paintT(); });
      paintT();
    }

    /* --- roulette: whoever has come out stays out until "Reiniciar lista" (the app remembers it per class) --- */
    const Rl = L.ruleta;
    if (Rl) {
      const SIZE = 250, C = SIZE / 2, RR = C - 6;
      const names = Rl.nombres || [];
      const wheel = add('div', 'lv pz-wheel', Rl.disco);
      const rot = mk(wheel, 'div', 'pz-rot', '');
      mk(wheel, 'i', 'pz-needle', '');
      const hub = mk(wheel, 'button', 'pz-hub hub', 'GIRAR');
      hub.setAttribute('aria-label', t('demo.spin'));
      const done = mk(wheel, 'div', 'pz-done', '');
      const result = add('div', 'lv pz-res', Rl.resultado);
      result.style.height = 'auto';   // the result may be taller than the app's 74 px minimum: it grows, it does not squash
      result.style.minHeight = (Rl.resultado[3] - Rl.resultado[1]) + 'px';
      result.setAttribute('aria-live', 'polite');
      const f = v => v.toFixed(2);
      const pointAt = (r, deg) => { const a = deg * Math.PI / 180; return [C + r * Math.sin(a), C - r * Math.cos(a)]; };
      function drawDisc(pool) {
        const n = pool.length, step = 360 / n;
        const parts = pool.map((name, i) => {
          const a0 = i * step, [x0, y0] = pointAt(RR, a0), [x1, y1] = pointAt(RR, a0 + step);
          const d = n === 1
            ? `M ${C} ${C} m ${-RR} 0 a ${RR} ${RR} 0 1 0 ${RR * 2} 0 a ${RR} ${RR} 0 1 0 ${-RR * 2} 0`
            : `M ${C} ${C} L ${f(x0)} ${f(y0)} A ${RR} ${RR} 0 ${step > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)} Z`;
          const mid = a0 + step / 2, [lx, ly] = pointAt(RR * 0.64, mid), turn = mid > 180 ? mid + 90 : mid - 90;
          const short = name.length > 11 ? name.slice(0, 10) + '…' : name;
          return `<path d="${d}" fill="${PZ_WHEEL[i % PZ_WHEEL.length]}" stroke="rgba(15,23,42,.55)" stroke-width="1.5"/>`
            + `<text x="${f(lx)}" y="${f(ly)}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="${n > 10 ? 10 : 12}" font-weight="800" font-family="Outfit,sans-serif" transform="rotate(${f(turn)} ${f(lx)} ${f(ly)})">${esc(short)}</text>`;
        }).join('');
        rot.innerHTML = `<svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" aria-hidden="true">${parts}<circle cx="${C}" cy="${C}" r="${RR}" fill="none" stroke="rgba(15,23,42,.22)" stroke-width="3"/></svg>`;
      }
      let out = [], angle = 0, spinning = false, winner = null, everyone = false;
      const waiting = () => names.filter(n => !out.includes(n));
      drawDisc(names);
      function paintResult() {
        const quedan = waiting().length;
        wheel.classList.toggle('empty', everyone);
        hub.disabled = spinning;
        hub.innerHTML = spinning ? pzI('girando', 22) : 'GIRAR';
        hub.classList.toggle('spin', spinning);
        if (everyone) {
          done.innerHTML = `${pzI('trofeo', 34)}<p>Ya han salido todos. Reinicia para volver a empezar.</p><button type="button" class="pz-link big">${pzI('reiniciar', 13)}Reiniciar lista</button>`;
          $('button', done).addEventListener('click', reset);
          result.innerHTML = '';
          return;
        }
        if (winner) {
          result.innerHTML = `<div class="pz-win">${esc(winner)}</div><p>${quedan === 0 ? 'Era el último: ya han salido todos' : quedan === 1 ? 'Queda 1 por salir' : `Quedan ${quedan} por salir`}</p><button type="button" class="pz-link">Volver a meter en el sorteo</button>`;
          $('button', result).addEventListener('click', putBack);
        } else if (spinning) {
          result.innerHTML = '<p class="pz-idle">Girando…</p>';
        } else {
          result.innerHTML = `<p class="pz-idle">${out.length === 0 ? `${names.length} participantes` : `Quedan ${quedan} de ${names.length}`}${out.length ? '<button type="button" class="pz-link">Reiniciar lista</button>' : ''}</p>`;
          const r = $('button', result);
          if (r) r.addEventListener('click', reset);
        }
      }
      function putBack() { if (!winner) return; out = out.filter(n => n !== winner); winner = null; paintResult(); }
      function reset() { out = []; winner = null; everyone = false; drawDisc(names); paintResult(); }
      hub.addEventListener('click', () => {
        if (spinning) return;
        const alive = waiting();
        winner = null;
        if (!alive.length) { everyone = true; paintResult(); return; }
        hub.classList.remove('pulse');
        spinning = true;
        drawDisc(alive);   // the circle is made again with whoever is left, as in the app
        const m = alive.length, step = 360 / m, pick = Math.floor(Math.random() * m);
        const targetMod = (360 - (pick + 0.5) * step + 360) % 360, currentMod = ((angle % 360) + 360) % 360;
        angle += 360 * 5 + (targetMod - currentMod + 360) % 360;
        const dur = reduce.matches ? 0 : 4000;
        rot.style.transition = dur ? `transform ${dur}ms cubic-bezier(.16,1,.3,1)` : 'none';
        rot.style.transform = `rotate(${angle}deg)`;
        paintResult();
        later(() => {
          spinning = false;
          winner = alive[pick];
          out.push(winner);
          paintResult();
          result.setAttribute('aria-label', t('demo.winner', { x: winner }));
        }, dur + 100);
      });
      paintResult();
    }

    /* --- calculator --- */
    const Cc = L.calculadora;
    if (Cc && Cc.pantalla) {
      const disp = add('div', 'lv calc-d', Cc.pantalla, '<span class="hist"></span><span class="res">0</span><span class="live"></span>');
      const histEl = $('.hist', disp), resEl = $('.res', disp), liveEl = $('.live', disp);
      const NAMES_K = { 'C': 'C', '()': '( )', '%': '%', '÷': '÷', '×': '×', '−': '−', '+': '+', ',': ',', '⌫': '⌫', '=': '=' };
      let expr = '', fresh = false;
      const isOp = c => '+−×÷'.includes(c);
      const show = () => {
        const txt = expr || '0';
        resEl.textContent = txt;
        resEl.style.fontSize = (txt.length > 22 ? 16 : txt.length > 17 ? 19 : txt.length > 12 ? 23 : 30) + 'px';
        // The live line: what the sum comes to while it is typed
        let live = '';
        if (expr && !fresh) {
          let src = expr;
          while (src && (isOp(src.slice(-1)) || src.slice(-1) === '(')) src = src.slice(0, -1);
          src += ')'.repeat(Math.max(0, (src.match(/\(/g) || []).length - (src.match(/\)/g) || []).length));
          try { if (src) live = '= ' + pretty(evaluate(src)); } catch (err) { live = ''; }
        }
        liveEl.textContent = live;
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
      function pretty(v) {
        const r = Math.round(v * 1e10) / 1e10;
        const out = Math.abs(r) >= 1e12 ? r.toPrecision(8) : String(r);
        return out.replace('-', '−').replace('.', ',');
      }
      function press(k) {
        const lastC = expr.slice(-1);
        if (/[0-9]/.test(k)) { if (fresh) expr = ''; expr += k; fresh = false; }
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
        else if (k === 'C') { expr = ''; fresh = false; }
        else if (k === '=') {
          let src = expr;
          while (src && (isOp(src.slice(-1)) || src.slice(-1) === '(')) src = src.slice(0, -1);
          if (!src) return;
          const open = (src.match(/\(/g) || []).length - (src.match(/\)/g) || []).length;
          src += ')'.repeat(Math.max(0, open));
          try {
            const out = pretty(evaluate(src));
            histEl.textContent = `${src} = ${out}`;
            expr = out;
          } catch (err) {
            expr = '';
            show();
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
  applyLang(firstLang, false);   // before the first screen, so what it builds (labels of the board) already speaks the language
  go(SCREENS[hash] ? hash : 'inicio', { quiet: true });

  // warm the screens one can reach in a click once the page is idle, so they answer at once
  const warm = () => ['evaluar', 'enclase', 'pizarra-base', 'actitud', 'cuaderno', 'asistencia', 'rubricas', 'rubrica-base', 'dianas', 'dianaeval-base']
    .forEach(n => { const i = new Image(); i.src = `assets/demo/${n}.webp`; });
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 }); else setTimeout(warm, 1500);
})();
