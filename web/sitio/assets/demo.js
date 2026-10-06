/* AulaPro · the interactive demo. A replica of the app window, drawn at its real size (1919 x 1032)
   and scaled to fit. The sidebar and the tab bars are HTML; each screen is the real screenshot with
   buttons laid over it, and a few tools really work: roulette, calculator, timer, board, rubric and target. */
(() => {
  'use strict';

  const W = 1919, H = 1032, SB = 256, CW = 1663;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: fine */ } }
  };

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
  const t = k => (DICT[lang] && DICT[lang][k] != null) ? DICT[lang][k] : (DICT.es[k] != null ? DICT.es[k] : '');

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
    $$('a[data-home]').forEach(a => { a.href = 'index.html' + (lang !== 'es' ? '?lang=' + lang : '') + (a.dataset.home || ''); });
    $$('[data-lang-link]').forEach(a => { a.href = a.dataset.langLink + (lang !== 'es' ? '?lang=' + lang : ''); });
    fullLabel();
    if (cur) {
      const s = SCREENS[cur];
      if (s.html) go(cur, { quiet: true });
      else { const im = $('.shot', view); if (im) im.alt = t(s.alt); }
    }
    if (save) store.set('aula-lang', lang);
  }

  /* ================= the stage: scale the window to the room we have ================= */
  const wrap = $('#demo');
  const stageEl = $('#stage');
  const win = $('#win');
  const view = $('#view');
  const tabsEl = $('#tabs');
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

  /* ================= screens ================= */
  const TABSETS = {
    evaluar: { label: 'Evaluar', icon: 'i-eval', tabs: [['rubricas', 'Rúbricas'], ['diana', 'Diana competencial'], ['autoeval', 'Autoevaluaciones'], ['historial', 'Historial']] },
    enclase: { label: 'En clase', icon: 'i-class', tabs: [['distribucion', 'Distribución de aula'], ['live', 'Aula Live'], ['sala', 'Sala de alumnos']] }
  };
  const NAV = {
    inicio: 'inicio', misclases: 'misclases', agenda: 'agenda', cuaderno: 'cuaderno', asistencia: 'asistencia',
    evaluar: 'rubricas', documentos: 'documentos', enclase: 'distribucion',
    reuniones: 'reuniones', formaciones: 'formaciones', compartido: 'compartido', registro: 'registro', config: 'config', perfil: 'perfil'
  };

  // Hotspots: [x0, y0, x1, y1, action, label], in the screenshot's own pixels.
  const SCREENS = {
    inicio: {
      nav: 'inicio', title: 'Inicio', img: 'inicio.webp', top: 23, alt: 'demo.alt.inicio',
      spots: [
        [1726, 360, 1850, 392, 'go:asistencia', 'Ir a Asistencia'],
        [1832, 146, 1856, 169, 't:steps', 'Primeros pasos'],
        [361, 581, 502, 621, 'go:cuaderno', 'Ir al Cuaderno'],
        [1262, 543, 1520, 583, 't:class', '1.º Bach A, Matemáticas I'],
        [1262, 594, 1520, 634, 't:class', '3.º ESO A, Matemáticas'],
        [1261, 648, 1366, 669, 'go:agenda', 'Ver la semana'],
        [993, 725, 1056, 747, 't:task', 'Añadir tarea'],
        [1807, 725, 1864, 747, 'go:agenda', 'Ver todo'],
        [967, 831, 1056, 853, 'go:misclases', 'Ver alumnado'],
        [297, 862, 560, 906, 'go:misclases', 'Alumno 7'],
        [297, 910, 560, 954, 'go:misclases', 'Alumno 10'],
        [1799, 831, 1864, 853, 'go:cuaderno', 'Cuaderno'],
        [1103, 862, 1300, 906, 'go:cuaderno', '4.º ESO B'],
        [1103, 910, 1300, 954, 'go:cuaderno', '1.º Bach A'],
        [1832, 959, 1886, 1013, 't:help', 'Ayuda']
      ]
    },
    diana: {
      nav: 'evaluar', set: 'evaluar', tab: 'diana', title: 'Diana competencial', img: 'diana.webp', top: 76, alt: 'demo.alt.diana',
      spots: [
        [1656, 106, 1764, 148, 't:reset', 'Reiniciar'],
        [1770, 106, 1882, 148, 't:save', 'Guardar'],
        [292, 185, 510, 223, 't:sample', 'Clase'],
        [519, 185, 744, 223, 't:sample', 'Alumno'],
        [1065, 265, 1292, 308, 't:fill', 'Rellenar desde evaluaciones'],
        [1299, 265, 1467, 308, 't:suggest', 'Sugerir perfil con IA'],
        [640, 385, 1110, 735, 't:axis', 'Diana competencial'],
        [1242, 858, 1454, 1030, 't:axis', 'Ajuste por competencia'],
        [1522, 304, 1860, 685, 't:desc', 'Descriptores'],
        [1536, 754, 1846, 833, 't:desc', 'Descriptor de Emprendimiento'],
        [1832, 959, 1886, 1013, 't:help', 'Ayuda']
      ]
    },
    rubrica: {
      nav: 'evaluar', set: 'evaluar', tab: 'rubricas', title: 'Rúbrica', img: 'rubrica.webp', top: 23, modal: [580, 63, 1340, 992], alt: 'demo.alt.rubrica',
      init: initRubric,
      spots: [
        [1270, 86, 1300, 116, 'fn:closeModal', 'Cerrar'],
        [603, 175, 946, 219, 't:sample', 'Clase'],
        [958, 175, 1301, 219, 't:sample', 'Alumno'],
        [604, 797, 1300, 992, 't:aieval', 'Evaluar trabajo con IA'],
        [1848, 960, 1900, 1012, 't:help', 'Ayuda']
      ]
    },
    dianas: {
      nav: 'evaluar', set: 'evaluar', tab: 'rubricas', title: 'Diana de evaluación', img: 'dianas-vacia.webp', top: 23, modal: [570, 135, 1350, 920], alt: 'demo.alt.dianas',
      init: initDiana,
      spots: [
        [1296, 159, 1324, 187, 'fn:closeModal', 'Cerrar'],
        [593, 246, 954, 292, 't:sample', 'Clase'],
        [965, 246, 1327, 292, 't:sample', 'Alumno'],
        [593, 757, 1327, 825, 't:obs', 'Observaciones'],
        [1046, 857, 1138, 899, 'fn:closeModal', 'Cancelar'],
        [1146, 857, 1327, 899, 'fn:dianaSave', 'Guardar evaluación'],
        [1848, 960, 1900, 1012, 't:help', 'Ayuda']
      ]
    },
    rubricas: { nav: 'evaluar', set: 'evaluar', tab: 'rubricas', title: 'Evaluación', html: listPage },
    distribucion: {
      nav: 'enclase', set: 'enclase', tab: 'distribucion', title: 'Distribución de aula', img: 'distribucion.webp', top: 76, alt: 'demo.alt.distribucion',
      spots: [
        [1704, 106, 1794, 148, 't:export', 'Exportar a Word'],
        [1800, 106, 1882, 148, 't:export', 'Exportar a PDF'],
        [292, 185, 493, 223, 't:sample', 'Clase'],
        [502, 185, 539, 223, 't:rotate', 'Rotar roles'],
        [539, 185, 755, 223, 't:roles', 'Roles como se formaron los grupos'],
        [755, 185, 791, 223, 't:rotate', 'Rotar roles'],
        [1464, 189, 1587, 219, 't:seated', 'Todos sentados'],
        [1596, 185, 1721, 223, 't:tables', 'Mesas y roles'],
        [1729, 185, 1869, 223, 't:aiseat', 'Repartir con IA'],
        [295, 300, 519, 425, 't:seat', 'Mesa 1'],
        [564, 300, 788, 425, 't:seat', 'Mesa 2'],
        [833, 300, 1058, 425, 't:seat', 'Mesa 3'],
        [1103, 300, 1327, 425, 't:seat', 'Mesa 4'],
        [1372, 300, 1596, 425, 't:seat', 'Mesa 5'],
        [295, 443, 519, 495, 't:student', 'Alumno 10'],
        [564, 443, 788, 514, 't:student', 'Alumno 8'],
        [833, 443, 1058, 514, 't:student', 'Alumno 7'],
        [1103, 443, 1327, 495, 't:student', 'Alumno 9'],
        [1832, 959, 1886, 1013, 't:help', 'Ayuda']
      ]
    },
    live: {
      nav: 'enclase', set: 'enclase', tab: 'live', title: 'Aula Live', img: 'live.webp', top: 76, dark: true, alt: 'demo.alt.live',
      init: initLive,
      spots: [
        [274, 94, 383, 128, 't:draw', 'Dibujando'],
        [391, 94, 517, 128, 't:whiteboard', 'Fondo blanco'],
        [570, 152, 590, 172, 't:close', 'Cerrar temporizador'],
        [1894, 113, 1914, 133, 't:close', 'Cerrar ruleta'],
        [1814, 603, 1834, 623, 't:close', 'Cerrar calculadora'],
        [836, 584, 856, 604, 't:close', 'Cerrar sonómetro'],
        [286, 610, 860, 912, 't:sound', 'Sonómetro'],
        [830, 918, 860, 948, 't:sound', 'Micrófono'],
        [836, 954, 930, 1011, 't:dock', 'Temporizador'],
        [938, 954, 1000, 1011, 't:dock', 'Ruleta'],
        [1006, 954, 1094, 1011, 't:dock', 'Calculadora'],
        [1100, 954, 1182, 1011, 't:dock', 'Sonómetro'],
        [1188, 954, 1270, 1011, 't:dock', 'Contenido'],
        [1276, 954, 1340, 1011, 't:reto', 'Reto'],
        [1847, 959, 1901, 1013, 't:help', 'Ayuda']
      ]
    },
    documentos: { nav: 'documentos', title: 'Documentos', html: docPage }
  };

  // Screens that exist in the app but not in the demo: an honest note in their place.
  const PH = {
    misclases: { nav: 'misclases', title: 'Mis Clases', icon: 'i-users', tries: ['distribucion', 'diana'] },
    agenda: { nav: 'agenda', title: 'Agenda', icon: 'i-cal', tries: ['live', 'diana'] },
    cuaderno: { nav: 'cuaderno', title: 'Cuaderno de Notas', icon: 'i-book', tries: ['dianas', 'rubrica'] },
    asistencia: { nav: 'asistencia', title: 'Asistencia', icon: 'i-ucheck', tries: ['distribucion', 'live'] },
    autoeval: { nav: 'evaluar', set: 'evaluar', tab: 'autoeval', title: 'Autoevaluaciones', icon: 'i-eval', tries: ['diana', 'rubrica'] },
    historial: { nav: 'evaluar', set: 'evaluar', tab: 'historial', title: 'Historial', icon: 'i-log', tries: ['dianas', 'rubrica'] },
    sala: { nav: 'enclase', set: 'enclase', tab: 'sala', title: 'Sala de alumnos', icon: 'i-users', tries: ['live', 'distribucion'] },
    reuniones: { nav: 'reuniones', title: 'Reuniones', icon: 'i-meet', tries: ['live', 'dianas'] },
    formaciones: { nav: 'formaciones', title: 'Formaciones', icon: 'i-grad', tries: ['live', 'dianas'] },
    compartido: { nav: 'compartido', title: 'Trabajo compartido', icon: 'i-share', tries: ['live', 'dianas'] },
    registro: { nav: 'registro', title: 'Registro de cambios', icon: 'i-log', tries: ['live', 'dianas'] },
    config: { nav: 'config', title: 'Configuración', icon: 'i-cog', tries: ['live', 'dianas'] },
    perfil: { nav: 'perfil', title: 'Mi perfil', icon: 'i-lock', tries: ['live', 'dianas'] }
  };
  Object.keys(PH).forEach(id => { SCREENS[id] = Object.assign({}, PH[id], { html: () => phPage(id) }); });

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = id => `<svg class="ln" aria-hidden="true"><use href="#${id}"/></svg>`;

  function phPage(id) {
    const p = PH[id];
    return `<div class="pg${p.set ? '' : ' untabbed'}"><h1>${esc(p.title)}</h1>
      <div class="note"><div class="ic">${icon(p.icon)}</div><div>
        <span class="pill">${t('demo.ph.pill')}</span>
        <h2>${t('demo.ph.title')}</h2>
        <p>${t('demo.ph.' + id)}</p>
        <div class="try"><span>${t('demo.ph.try')}</span>${p.tries.map(g => `<button type="button" data-act="go:${g}">${t('demo.go.' + g)}</button>`).join('')}</div>
      </div></div>
      <div class="skel" aria-hidden="true">${'<div><i></i><i></i><i></i><i></i></div>'.repeat(3)}</div></div>`;
  }

  function docPage() {
    const ai = lang === 'en' ? 'AI' : 'IA';
    const items = [['d1', 'i-doc', true], ['d2', 'i-spark', true], ['d3', 'i-print', false], ['d4', 'i-puzzle', true]];
    return `<div class="pg untabbed"><h1>Documentos</h1>
      <div class="note"><div class="ic">${icon('i-doc')}</div><div>
        <span class="pill">${t('demo.ph.pill')}</span>
        <h2>${t('demo.doc.title')}</h2>
        <p>${t('demo.doc.lede')}</p>
      </div></div>
      <div class="docs">${items.map(([k, ic, withAi]) => `<div><span class="ic">${icon(ic)}</span><span><b>${t('demo.doc.' + k)}${withAi ? `<span class="ai">${ai}</span>` : ''}</b><p>${t('demo.doc.' + k + 'd')}</p></span></div>`).join('')}</div></div>`;
  }

  // Evaluar > Rúbricas: the list behind the two evaluation windows.
  let listMode = 'rub';
  function miniTarget() {
    const cx = 75, cy = 75, R = 62, lv = [2, 3, 4, 1, 3], col = ['#e08a2c', '#3b6fe0', '#2ea65c', '#dc3b3b', '#3b6fe0'];
    const pt = (a, r) => `${(cx + r * Math.cos(a * Math.PI / 180)).toFixed(1)} ${(cy + r * Math.sin(a * Math.PI / 180)).toFixed(1)}`;
    let g = '';
    for (let k = 1; k <= 4; k++) g += `<circle cx="${cx}" cy="${cy}" r="${R * k / 4}" fill="none" stroke="#e2e8f0"/>`;
    const wedges = lv.map((l, i) => {
      const a0 = -90 + 72 * i + 1.5, a1 = a0 + 69, r = R * l / 4;
      return `<path d="M${cx} ${cy}L${pt(a0, r)}A${r} ${r} 0 0 1 ${pt(a1, r)}Z" fill="${col[i]}" opacity=".9"/>`;
    }).join('');
    return `<svg viewBox="0 0 150 150" aria-hidden="true">${g}${wedges}</svg>`;
  }
  function listPage() {
    const rub = listMode === 'rub';
    const card = rub
      ? `<article class="lcard"><h3>El Mercado Eco-Saludable</h3><p class="meta">Situación de aprendizaje · 5.º A · Castellano</p>
          <div class="tags"><span>3 criterios</span><span>4 niveles de logro</span></div>
          <ul><li>Matemáticas CE2: calcular presupuestos, descuentos y cambio de divisas.</li>
          <li>Lengua Castellana y Literatura CE2: redactar carteles y folletos persuasivos.</li>
          <li>Educación Física CE2: participar de forma cooperativa en juegos y proyectos motrices.</li></ul>
          <button type="button" class="vbtn" data-act="go:rubrica">${icon('i-eval')}Evaluar alumno</button></article>`
      : `<article class="lcard"><h3>El Mercado Eco-Saludable</h3><p class="meta">Diana de evaluación · 5.º A · Castellano</p>
          <div class="tags"><span>5 ítems</span><span>Nota automática</span></div>
          <div class="row">${miniTarget()}<ul><li>Participación y respeto de roles</li><li>Cálculo de cambio y precios</li><li>Explicación oral del puesto</li><li>Uso del valencià comercial</li><li>Promoción de hábitos saludables</li></ul></div>
          <button type="button" class="vbtn" data-act="go:dianas">${icon('i-eval')}Evaluar alumno</button></article>`;
    return `<div class="pg"><div class="lhead"><div><h1>Evaluación</h1><p class="sub">3 rúbricas · 2 dianas · 2 evaluaciones</p></div>
        <div class="seg" role="group" aria-label="Tipo de evaluación"><button type="button" aria-pressed="${rub}" data-act="fn:listRub">Rúbricas</button><button type="button" aria-pressed="${!rub}" data-act="fn:listDia">Dianas</button></div></div>
      <div class="lbar"><p>${rub ? 'Define criterios con descriptores por nivel y evalúa a cada alumno con un clic.' : 'Marca el nivel de logro de cada ítem y la nota se calcula sola.'}</p>
        <button type="button" class="vbtn" data-act="t:${rub ? 'newRubric' : 'newDiana'}">${icon('i-plus')}${rub ? 'Nueva rúbrica' : 'Nueva diana'}</button></div>
      <div class="lcards">${card}</div></div>`;
  }

  /* ================= navigation ================= */
  let cur = null, cleanup = null;
  const place = (x0, y0, x1, y1, top) => `left:${x0 - SB}px;top:${y0 - top}px;width:${x1 - x0}px;height:${y1 - y0}px`;

  function spot([x0, y0, x1, y1, act, label], top) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'spot';
    b.style.cssText = place(x0, y0, x1, y1, top);
    b.dataset.act = act;
    b.setAttribute('aria-label', label);
    return b;
  }

  function openGroup(grp, open) {
    grp.classList.toggle('open', open);
    $('.gh', grp).setAttribute('aria-expanded', String(open));
    $$('.it', grp).forEach(b => { if (open) b.removeAttribute('tabindex'); else b.tabIndex = -1; });
  }

  function renderTabs(s) {
    if (!s.set || s.modal) { tabsEl.hidden = true; return; }
    const ts = TABSETS[s.set];
    tabsEl.hidden = false;
    if (tabsEl.dataset.set !== s.set) {
      tabsEl.dataset.set = s.set;
      tabsEl.innerHTML = `<span class="sec">${icon(ts.icon)}${ts.label}</span>` +
        ts.tabs.map(([id, l]) => `<button type="button" class="tab" role="tab" data-tab="${id}">${l}</button>`).join('');
    }
    $$('.tab', tabsEl).forEach(b => {
      const on = b.dataset.tab === s.tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
  }

  function go(id, opt = {}) {
    const s = SCREENS[id];
    if (!s) return;
    if (cleanup) { try { cleanup(); } catch (e) { /* nothing to undo */ } cleanup = null; }
    const first = !cur;
    cur = id;
    $$('.it', win).forEach(b => {
      const on = b.dataset.nav === s.nav;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const item = $(`.it[data-nav="${s.nav}"]`, win);
    if (item) openGroup(item.closest('.grp'), true);
    renderTabs(s);
    win.classList.toggle('modal', !!s.modal);
    win.classList.toggle('dark', !!s.dark);
    view.classList.toggle('tabbed', !!s.set && !s.modal);

    const el = document.createElement('div');
    el.className = 'scr';
    if (s.img) {
      const im = new Image();
      im.className = 'shot';
      im.decoding = 'async';
      im.draggable = false;
      im.width = CW;
      im.height = H - s.top;
      im.alt = t(s.alt);
      im.src = 'assets/demo/' + s.img;
      el.append(im);
    }
    if (s.html) el.innerHTML = s.html();
    (s.spots || []).forEach(sp => el.append(spot(sp, s.top)));
    if (s.init) cleanup = s.init(el, s, opt) || null;
    view.replaceChildren(el);
    if (!first && !opt.quiet && !reduce.matches) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    if (!opt.quiet) srNote.textContent = `${t('demo.screen')}: ${s.title}`;
    btnZoom.disabled = !s.img;
  }

  function closeModal() {
    listMode = cur === 'dianas' ? 'dia' : 'rub';
    go('rubricas');
  }

  const FN = {
    // a click on the dimmed sidebar still reaches the menu item underneath
    closeModal(el, e) {
      if (e && el && el.classList.contains('dim')) {
        el.style.display = 'none';
        const under = document.elementFromPoint(e.clientX, e.clientY);
        el.style.display = '';
        const target = under && under.closest('[data-nav], .gh');
        if (target) { target.click(); return; }
      }
      closeModal();
    },
    full: toggleFull,
    listRub() { listMode = 'rub'; go('rubricas', { quiet: true }); },
    listDia() { listMode = 'dia'; go('rubricas', { quiet: true }); },
    dianaSave() { toast(t(diana && diana.done ? 'demo.t.dianaSave' : 'demo.t.dianaEarly')); }
  };
  function run(action, el, e) {
    const i = action.indexOf(':');
    const kind = action.slice(0, i), arg = action.slice(i + 1);
    if (kind === 'go') go(arg);
    else if (kind === 't') toast(t('demo.t.' + arg));
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
    const gh = e.target.closest('.gh');
    if (gh) { const g = gh.closest('.grp'); openGroup(g, !g.classList.contains('open')); return; }
    const nav = e.target.closest('[data-nav]');
    if (nav) { go(NAV[nav.dataset.nav]); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) { go(tab.dataset.tab); return; }
    const a = e.target.closest('[data-act]');
    if (a) { run(a.dataset.act, a, e); return; }
    const scr = e.target.closest('.scr');
    if (scr && e.target === scr) {
      const s = SCREENS[cur];
      if (s.modal) {
        const r = view.getBoundingClientRect();
        const x = (e.clientX - r.left) / scale + SB, y = (e.clientY - r.top) / scale + s.top;
        const [mx0, my0, mx1, my1] = s.modal;
        if (x < mx0 || x > mx1 || y < my0 || y > my1) { closeModal(); return; }
      }
      flashSpots();
    }
  });

  /* ================= Evaluar > Rúbricas: mark each criterion ================= */
  function initRubric(el) {
    const top = 23;
    const COLS = [[809, 915], [935, 1040], [1060, 1166], [1186, 1291]];
    const ROWS = [
      { top: 279, bot: [408, 417, 417, 417], band: [270, 429] },
      { top: 438, bot: [562, 594, 552, 592], band: [429, 604] },
      { top: 613, bot: [736, 771, 751, 736], band: [604, 796] }
    ];
    const BAKED = [1, 3, 2];
    const PATCH = [[807, 277, 917, 410, 'rub-r1.webp'], [1058, 436, 1168, 555, 'rub-r2.webp'], [933, 611, 1042, 774, 'rub-r3.webp']];
    const LV = { 1: ['#dc2626', '#fbe9e9'], 2: ['#d97706', '#fbf1e6'], 3: ['#2563eb', '#e9effd'], 4: ['#16a34a', '#e7f6ec'] };
    const state = BAKED.slice();
    const patches = PATCH.map(([x0, y0, x1, y1, f]) => {
      const im = new Image();
      im.className = 'patch';
      im.alt = '';
      im.src = 'assets/demo/' + f;
      im.style.cssText = place(x0, y0, x1, y1, top);
      el.append(im);
      return im;
    });
    const picks = ROWS.map(() => { const d = document.createElement('div'); d.className = 'pick'; el.append(d); return d; });
    const cells = [];
    let told = false;
    function paint(r) {
      patches[r].classList.toggle('on', state[r] !== BAKED[r]);
      const p = picks[r], lv = state[r];
      if (lv && lv !== BAKED[r]) {
        const [x0, x1] = COLS[lv - 1];
        const [bc, tint] = LV[lv];
        p.style.cssText = place(x0, ROWS[r].top, x1, ROWS[r].bot[lv - 1], top) + `;background:${tint};box-shadow:inset 0 0 0 1.5px ${bc}`;
        p.classList.remove('on');
        void p.offsetWidth;
        p.classList.add('on');
      } else p.classList.remove('on');
      cells[r].forEach((b, c) => b.setAttribute('aria-pressed', String(state[r] === c + 1)));
    }
    ROWS.forEach((row, r) => {
      cells[r] = COLS.map(([x0, x1], c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'spot';
        b.style.cssText = place(x0 - 6, row.band[0] + 4, x1 + 6, Math.min(row.band[1] - 4, 990), top);
        b.setAttribute('aria-label', `Criterio ${r + 1}, nivel ${c + 1}`);
        b.setAttribute('aria-pressed', String(state[r] === c + 1));
        b.addEventListener('click', () => {
          state[r] = state[r] === c + 1 ? 0 : c + 1;
          paint(r);
          if (!told) { told = true; toast(t('demo.t.rubric')); }
        });
        el.append(b);
        return b;
      });
    });
    return null;
  }

  /* ================= the target: click each sector and the mark works itself out ================= */
  let diana = null;
  function initDiana(el, s, opt) {
    const top = 23, CX = 820.5, CY = 493.5;
    const A0 = [-90, -18, 54, 126, 198];
    const WORDS = [[889, 404, 933, 415], [932, 537, 954, 548], [799, 620, 842, 631], [659, 537, 709, 548], [731, 408, 753, 419]];
    const ROWY = [489, 517, 545, 573, 600];
    const inset = (x0, y0, x1, y1) => `inset(${y0 - top}px ${CW - (x1 - SB)}px ${1009 - (y1 - top)}px ${x0 - SB}px)`;
    const cx = CX - SB, cy = CY - top;
    const wedgeClip = i => {
      const pts = [[cx, cy]];
      for (let k = 0; k <= 12; k++) {
        const a = (A0[i] + 72 * k / 12) * Math.PI / 180;
        pts.push([cx + 103 * Math.cos(a), cy + 103 * Math.sin(a)]);
      }
      return 'polygon(' + pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',') + ')';
    };
    const layer = (cls, clip) => {
      const d = document.createElement('div');
      d.className = 'reveal ' + cls;
      d.style.backgroundImage = 'url(assets/demo/dianas-llena.webp)';
      d.style.clipPath = clip;
      d.style.webkitClipPath = clip;
      if (cls === 'wedge') d.style.transformOrigin = `${cx}px ${cy}px`;
      el.append(d);
      return d;
    };
    const wedges = A0.map((_, i) => layer('wedge', wedgeClip(i)));
    const words = WORDS.map(b => layer('word', inset(...b)));
    const rows = ROWY.map(y => layer('row', inset(1076, y - 13, 1316, y + 13)));
    const nota = layer('nota', inset(1098, 328, 1296, 414));
    const save = layer('save', inset(1146, 857, 1327, 899));
    const counter = document.createElement('div');
    counter.className = 'lv counter';
    counter.style.cssText = place(1120, 397, 1272, 409, top);
    el.append(counter);
    const done = [false, false, false, false, false];
    diana = { done: false };
    const paintCount = () => { counter.textContent = `${done.filter(Boolean).length}/5 ítems marcados`; };
    paintCount();
    function mark(i) {
      if (i < 0 || done[i]) return;
      done[i] = true;
      wedges[i].classList.add('on');
      words[i].classList.add('on');
      rows[i].classList.add('on');
      paintCount();
      if (done.every(Boolean)) {
        diana.done = true;
        setTimeout(() => {
          if (!nota.isConnected) return;
          nota.classList.add('on');
          save.classList.add('on');
          counter.style.opacity = '0';
          toast(t('demo.t.dianaDone'));
        }, 420);
      }
    }
    const hit = document.createElement('button');
    hit.type = 'button';
    hit.className = 'spot big';
    hit.style.cssText = place(596, 312, 1046, 668, top);
    hit.setAttribute('aria-label', 'Diana: marcar el siguiente ítem');
    hit.addEventListener('click', e => {
      if (e.detail === 0) { mark(done.indexOf(false)); return; }   // keyboard: next item
      const r = hit.getBoundingClientRect();
      const k = r.width / 450;
      const x = (e.clientX - r.left) / k + 596, y = (e.clientY - r.top) / k + 312;
      const ang = Math.atan2(y - CY, x - CX) * 180 / Math.PI;
      mark(A0.findIndex(a0 => ((ang - a0) % 360 + 360) % 360 < 72));
    });
    el.append(hit);
    ROWY.forEach((y, i) => {
      const b = spot([1076, y - 13, 1316, y + 13, 'x', ['Participación y respeto de roles', 'Cálculo de cambio y precios', 'Explicación oral del puesto', 'Uso del valencià comercial', 'Promoción de hábitos saludables'][i]], top);
      b.removeAttribute('data-act');
      b.addEventListener('click', () => mark(i));
      el.append(b);
    });
    let hintT = 0;
    if (!opt.quiet) hintT = setTimeout(() => toast(t('demo.t.dianaHint')), 500);
    return () => clearTimeout(hintT);
  }

  /* ================= Aula Live: board, timer, roulette and calculator ================= */
  function initLive(el) {
    const top = 76;
    const timers = [];
    const later = (f, ms) => timers.push(setTimeout(f, ms));
    const mk = (tag, cls, css, html) => {
      const n = document.createElement(tag);
      n.className = cls;
      if (css) n.style.cssText = css;
      if (html != null) n.innerHTML = html;
      if (tag === 'button') n.type = 'button';
      el.append(n);
      return n;
    };
    const P = (x0, y0, x1, y1) => place(x0, y0, x1, y1, top);

    /* --- the board: draw anywhere except over the tools --- */
    const cv = document.createElement('canvas');
    cv.className = 'draw';
    cv.width = CW;
    cv.height = 956;
    cv.setAttribute('aria-hidden', 'true');
    el.firstChild.after(cv);
    const ctx = cv.getContext('2d');
    const BLOCK = [[273, 93, 748, 129], [281, 147, 597, 551], [283, 578, 862, 948], [1545, 108, 1919, 561], [1568, 598, 1841, 935], [835, 953, 1342, 1012], [1846, 959, 1902, 1014]]
      .map(([a, b, c, d]) => [a - SB, b - top, c - a, d - b]);
    let ink = '#ffffff', erasing = false, last = null;
    const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * CW / r.width, (e.clientY - r.top) * 956 / r.height]; };
    function stroke(a, b) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, CW, 956);
      BLOCK.forEach(r => ctx.rect(...r));
      ctx.clip('evenodd');
      ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
      ctx.strokeStyle = ink;
      ctx.lineWidth = erasing ? 36 : 5;
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

    const PAL = [['#ffffff', 572, 111, 'Blanco'], ['#38bdf8', 603, 111, 'Azul'], ['#f472b6', 634, 111, 'Rosa'], ['#facc15', 665, 111, 'Amarillo'], ['#4ade80', 696, 111, 'Verde']];
    const ring = mk('div', 'dot-ring', '');
    const moveRing = (x, y) => { ring.style.cssText = `left:${x - 13 - SB}px;top:${y - 13 - top}px;width:26px;height:26px`; };
    moveRing(572, 111);
    PAL.forEach(([c, x, y, name]) => {
      const b = mk('button', 'spot', P(x - 13, y - 13, x + 13, y + 13));
      b.style.borderRadius = '50%';
      b.setAttribute('aria-label', 'Color ' + name);
      b.addEventListener('click', () => { ink = c; erasing = false; moveRing(x, y); });
    });
    const eraser = mk('button', 'spot', P(719, 98, 747, 124));
    eraser.setAttribute('aria-label', 'Borrador. Púlsalo dos veces para borrar toda la pizarra.');
    eraser.addEventListener('click', () => {
      if (erasing) ctx.clearRect(0, 0, CW, 956);
      erasing = true;
      moveRing(733, 111);
    });

    /* --- timer --- */
    let total = 300, left = 300, running = false, endAt = 0, iv = 0;
    const digits = mk('div', 'lv t-digits', P(368, 312, 508, 358));
    mk('div', 'lv t-hint', P(388, 363, 488, 373), 'toca para editar');
    const fmt = s => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
    const goBtn = mk('button', 'lv go', P(379, 477, 497, 520));
    function paintTimer() {
      digits.textContent = fmt(left);
      goBtn.innerHTML = running ? `${icon('i-pause')}Pausar` : `${icon('i-play')}Iniciar`;
      goBtn.setAttribute('aria-label', (running ? 'Pausar' : 'Iniciar') + ' el temporizador, ' + fmt(left));
    }
    function stop() { running = false; clearInterval(iv); iv = 0; }
    function start() {
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
          later(() => { left = total; digits.classList.remove('done'); paintTimer(); }, 3200);
        }
        paintTimer();
      }, 200);
    }
    goBtn.addEventListener('click', () => { if (running) { left = (endAt - performance.now()) / 1000; stop(); } else start(); paintTimer(); });
    const face = mk('button', 'spot', P(372, 300, 504, 382));
    face.style.borderRadius = '50%';
    face.setAttribute('aria-label', 'Iniciar o pausar el temporizador');
    face.addEventListener('click', () => goBtn.click());
    const CHIPS = [[320, 178, 367, 207, '30 s', 30], [374, 178, 427, 207, '1 min', 60], [433, 178, 490, 207, '5 min', 300], [495, 178, 555, 207, '10 min', 600]];
    const chips = CHIPS.map(([x0, y0, x1, y1, label, secs]) => {
      const b = mk('button', 'lv chipt' + (secs === 300 ? ' on' : ''), P(x0, y0, x1, y1), label);
      b.addEventListener('click', () => {
        stop();
        total = left = secs;
        chips.forEach(c => c.classList.toggle('on', c === b));
        digits.classList.remove('done');
        paintTimer();
      });
      return b;
    });
    const adjust = d => {
      if (running) { endAt = Math.max(performance.now() + 1000, endAt + d * 1000); left = (endAt - performance.now()) / 1000; }
      else left = clamp(Math.ceil(left) + d, 10, 99 * 60);
      chips.forEach(c => c.classList.remove('on'));
      paintTimer();
    };
    const minus = mk('button', 'spot', P(333, 481, 371, 517));
    minus.setAttribute('aria-label', 'Restar un minuto');
    minus.addEventListener('click', () => adjust(-60));
    const plus = mk('button', 'spot', P(505, 481, 543, 517));
    plus.setAttribute('aria-label', 'Sumar un minuto');
    plus.addEventListener('click', () => adjust(60));
    const rst = mk('button', 'spot', P(400, 529, 476, 549));
    rst.setAttribute('aria-label', 'Reiniciar el temporizador');
    rst.addEventListener('click', () => { stop(); left = total; digits.classList.remove('done'); paintTimer(); });
    paintTimer();

    /* --- roulette --- */
    const NAMES = ['Alumno 7', 'Alumno 8', 'Alumno 9', 'Alumno 10', 'Alumno 11', 'Alumno 12', 'Alumno 13'];
    const disc = new Image();
    disc.className = 'disc';
    disc.alt = '';
    disc.src = 'assets/demo/ruleta-disco.webp';
    disc.style.left = (1609 - SB) + 'px';
    disc.style.top = (142 - top) + 'px';
    el.append(disc);
    el.insertAdjacentHTML('beforeend', `<svg class="pointer" style="left:${1719 - SB}px;top:${134 - top}px;width:26px;height:24px" viewBox="1719 134 26 24" aria-hidden="true"><path d="M1722.5 137.5h18l-9 15.5z" fill="#fff" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg>`);
    const hub = mk('button', 'lv hub', P(1698, 231, 1765, 298) + ';background-image:url(assets/demo/ruleta-centro.webp)');
    hub.setAttribute('aria-label', 'Girar la ruleta');
    const result = mk('div', 'lv winner', P(1600, 482, 1864, 510));
    result.style.display = 'none';
    result.setAttribute('aria-live', 'polite');
    let angle = 0, spinning = false;
    hub.addEventListener('click', () => {
      if (spinning) return;
      spinning = true;
      hub.classList.remove('pulse');
      const seg = 360 / NAMES.length;
      const pick = Math.floor(Math.random() * NAMES.length);
      const phi = pick * seg + seg * (0.2 + Math.random() * 0.6);
      const target = Math.ceil((angle + 360 * 5) / 360) * 360 + (360 - phi);
      const dur = reduce.matches ? 0 : 4200;
      result.style.display = 'grid';
      result.textContent = 'Girando…';
      disc.style.transition = dur ? `transform ${dur}ms cubic-bezier(.12,.62,.08,1)` : 'none';
      disc.style.transform = `rotate(${target}deg)`;
      angle = target;
      later(() => { spinning = false; result.innerHTML = `<span>¡Le toca a <b>${NAMES[pick]}</b>!</span>`; }, dur + 80);
    });

    /* --- calculator --- */
    const disp = mk('div', 'lv calc-d', P(1580, 636, 1834, 716), '<span class="ex"></span><span class="res">0</span>');
    const exEl = $('.ex', disp), resEl = $('.res', disp);
    const KEYS = [['C', '()', '%', '÷'], ['7', '8', '9', '×'], ['4', '5', '6', '−'], ['1', '2', '3', '+'], ['0', ',', '⌫', '=']];
    const KX = [1572, 1640, 1708, 1776], KY = [731, 772, 814, 856, 897];
    const NAMES_K = { 'C': 'Borrar todo', '()': 'Paréntesis', '%': 'Por ciento', '÷': 'Dividir', '×': 'Multiplicar', '−': 'Restar', '+': 'Sumar', ',': 'Coma', '⌫': 'Borrar', '=': 'Igual' };
    let expr = '', fresh = false;
    const isOp = c => '+−×÷'.includes(c);
    function show() {
      const txt = expr || '0';
      resEl.textContent = txt;
      resEl.style.fontSize = clamp(31 - Math.max(0, txt.length - 10) * 1.9, 15, 31) + 'px';
    }
    function evaluate(src) {
      const s = src.replace(/,/g, '.');
      let i = 0;
      const peek = () => s[i];
      function num() {
        const st = i;
        while (i < s.length && /[0-9.]/.test(s[i])) i++;
        if (st === i) throw new Error('num');
        const v = parseFloat(s.slice(st, i));
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
        while (peek() === '×' || peek() === '÷') { const op = s[i++]; const r = factor(); v = op === '×' ? v * r : v / r; }
        return v;
      }
      function sum() {
        let v = product();
        while (peek() === '+' || peek() === '−') { const op = s[i++]; const r = product(); v = op === '+' ? v + r : v - r; }
        return v;
      }
      const v = sum();
      if (i !== s.length || !Number.isFinite(v)) throw new Error('syntax');
      return v;
    }
    const pretty = v => {
      let r = Math.round(v * 1e10) / 1e10;
      let str = Math.abs(r) >= 1e12 ? r.toPrecision(8) : String(r);
      return str.replace('-', '−').replace('.', ',');
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
    KEYS.forEach((row, r) => row.forEach((k, c) => {
      const b = mk('button', 'lv key', P(KX[c], KY[r], KX[c] + 62, KY[r] + 35));
      b.setAttribute('aria-label', NAMES_K[k] || k);
      b.addEventListener('click', () => press(k));
    }));
    show();

    return () => { stop(); timers.forEach(clearTimeout); };
  }

  /* ================= toolbar above the window ================= */
  btnSpots.addEventListener('click', () => {
    const on = btnSpots.getAttribute('aria-pressed') !== 'true';
    btnSpots.setAttribute('aria-pressed', String(on));
    win.classList.toggle('show-spots', on);
  });
  btnZoom.addEventListener('click', () => {
    const s = SCREENS[cur];
    if (!s || !s.img || !window.AulaZoom) return;
    const src = cur === 'dianas' && diana && diana.done ? 'dianas-llena.webp' : s.img;
    window.AulaZoom.open('assets/demo/' + src, t(s.alt));
  });
  function bringIntoView() {
    const r = stageEl.getBoundingClientRect();
    if (r.top < 70 || r.top > innerHeight * 0.45) scrollTo({ top: scrollY + r.top - 84, behavior: reduce.matches ? 'auto' : 'smooth' });
  }
  $$('[data-try]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.try;
    if (k === 'live-ruleta') { go('live'); const hub = $('.hub', view); if (hub) hub.classList.add('pulse'); }
    else if (k === 'live-draw') { go('live'); toast(t('demo.t.draw')); }
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
  go(SCREENS[hash] && hash !== 'demo' ? hash : 'inicio', { quiet: true });
  applyLang(firstLang, false);

  // warm the other screens once the page is idle, so every click answers at once
  const warm = () => ['inicio', 'diana', 'rubrica', 'dianas-vacia', 'dianas-llena', 'distribucion', 'live', 'ruleta-disco', 'ruleta-centro', 'rub-r1', 'rub-r2', 'rub-r3']
    .forEach(n => { const i = new Image(); i.src = `assets/demo/${n}.webp`; });
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 }); else setTimeout(warm, 1500);
})();
