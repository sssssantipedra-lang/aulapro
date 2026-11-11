// El panel de la página del informe de uso (informe.html, 11-11-2026, petición del dueño: «una gráfica interactiva que se
// vaya actualizando», con cuánta gente entra, cuánta es nueva, cuánta repite y lo que sirva para decidir). Dos partes:
// - `metricas`: las cuentas, sin pantalla (se prueban en web/pruebas/informe-panel.test.js).
// - `crearPanel`: el filtro de periodo, la actualización automática, las cifras y las gráficas (SVG y HTML hechos aquí,
//   sin librerías: la CSP de la página solo deja su propio código).
// Los datos son los del registro (web/funciones/api/_usuarios.js) ya juntados de Netlify y Cloudflare (`fusionar`): por
// docente, el día de alta y los minutos de uso de cada día (un día con 0 minutos es un día que entró). No hay horas.
// Todo lo que viene del servidor se escribe como texto, nunca como HTML.

const DIA_MS = 86400_000;
const num = d => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / DIA_MS;
const fecha = n => new Date(n * DIA_MS).toISOString().slice(0, 10);
const diasDe = u => Object.keys(u.dias ?? {});

/** Los días del periodo, del más antiguo a `hoy`: los últimos `periodo` días, o desde la primera alta con 'todo'. */
export function diasDelPeriodo(usuarios, hoy, periodo) {
  const h = num(hoy);
  const ini = periodo === 'todo' ? Math.min(h, ...usuarios.map(u => num(u.alta))) : h - Number(periodo) + 1;
  const out = [];
  for (let n = ini; n <= h; n++) out.push(fecha(n));
  return out;
}

/** Cada día: quién entró, cuántos eran nuevos (se dieron de alta ese día) y cuántos volvían, los minutos, el total de
 *  registrados hasta ese día y los activos en los 7 días que acaban en él. */
export function serieDiaria(usuarios, dias) {
  return dias.map(d => {
    const n = num(d);
    let nuevos = 0, vuelven = 0, minutos = 0, registrados = 0, activos7 = 0;
    for (const u of usuarios) {
      const dd = u.dias ?? {};
      if (u.alta <= d) registrados++;
      if (d in dd) {
        if (u.alta === d) nuevos++; else if (u.alta < d) vuelven++;
        minutos += dd[d] || 0;
      } else if (u.alta === d) nuevos++;   // dado de alta ese día sin día anotado (no debería pasar)
      if (diasDe(u).some(x => { const m = num(x); return m <= n && m > n - 7; })) activos7++;
    }
    return { dia: d, nuevos, vuelven, entran: nuevos + vuelven, minutos, registrados, activos7 };
  });
}

/** Las cifras del periodo. «Repiten»: los que la usaron algún día del periodo después de su día de alta. «Vuelven en
 *  7 días»: de los que se dieron de alta en el periodo hace al menos 7 días, cuántos volvieron otro día de esa semana. */
export function resumen(usuarios, dias, hoy) {
  if (!dias.length) return null;
  const ini = dias[0], fin = dias[dias.length - 1];
  const h = num(hoy);
  let entran = 0, nuevos = 0, repiten = 0, minutos = 0, diasDeUso = 0, base7 = 0, vuelven7 = 0;
  for (const u of usuarios) {
    const enPeriodo = diasDe(u).filter(d => d >= ini && d <= fin);
    const altaEn = u.alta >= ini && u.alta <= fin;
    if (enPeriodo.length || altaEn) entran++;
    if (altaEn) nuevos++;
    if (enPeriodo.some(d => d > u.alta)) repiten++;
    diasDeUso += enPeriodo.length;
    for (const d of enPeriodo) minutos += u.dias[d] || 0;
    if (altaEn && num(u.alta) <= h - 7) {
      base7++;
      const a = num(u.alta);
      if (diasDe(u).some(d => { const m = num(d); return m > a && m <= a + 7; })) vuelven7++;
    }
  }
  return {
    entran, nuevos, repiten, minutos, diasDeUso,
    diasPorDocente: entran ? diasDeUso / entran : 0,
    minutosPorDocente: entran ? minutos / entran : 0,
    vuelven7: base7 ? { base: base7, vuelven: vuelven7, pct: Math.round((vuelven7 / base7) * 100) } : null,
  };
}

const SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
/** La media de docentes que entran cada día de la semana, en el periodo. */
export function porDiaDeSemana(serie) {
  const suma = Array(7).fill(0), veces = Array(7).fill(0);
  for (const s of serie) {
    const i = (new Date(num(s.dia) * DIA_MS).getUTCDay() + 6) % 7;
    suma[i] += s.entran; veces[i]++;
  }
  return SEMANA.map((nombre, i) => ({ nombre, valor: veces[i] ? Math.round((suma[i] / veces[i]) * 10) / 10 : 0 }));
}

export const TRAMOS_USO = [
  ['Solo entró', 0, 0], ['Menos de 15 min', 1, 14], ['De 15 a 60 min', 15, 59], ['De 1 a 3 h', 60, 179],
  ['De 3 a 10 h', 180, 599], ['10 h o más', 600, Infinity],
];
/** Cuántos de los que entraron en el periodo la usaron cuánto tiempo en total. */
export function porTiempoDeUso(usuarios, dias) {
  const ini = dias[0], fin = dias[dias.length - 1];
  const cuenta = TRAMOS_USO.map(([nombre]) => ({ nombre, valor: 0 }));
  for (const u of usuarios) {
    const enPeriodo = diasDe(u).filter(d => d >= ini && d <= fin);
    if (!enPeriodo.length && !(u.alta >= ini && u.alta <= fin)) continue;
    const m = enPeriodo.reduce((s, d) => s + (u.dias[d] || 0), 0);
    cuenta[TRAMOS_USO.findIndex(([, a, b]) => m >= a && m <= b)].valor++;
  }
  return cuenta;
}

const lunesDe = d => fecha(num(d) - ((new Date(num(d) * DIA_MS).getUTCDay() + 6) % 7));
/** Retención por semana de alta (las `max` últimas): de cada grupo, qué parte entró en su semana 0, 1, 2… */
export function cohortes(usuarios, hoy, max = 8, semanas = 8) {
  const h = num(hoy);
  const grupos = new Map();
  for (const u of usuarios) {
    const s = lunesDe(u.alta);
    if (!grupos.has(s)) grupos.set(s, []);
    grupos.get(s).push(u);
  }
  return [...grupos.keys()].sort().slice(-max).map(semana => {
    const lista = grupos.get(semana);
    const l = num(semana);
    const celdas = [];
    for (let k = 0; k < semanas; k++) {
      const a = l + 7 * k, b = a + 6;
      if (a > h) { celdas.push(null); continue; }
      const activos = lista.filter(u => diasDe(u).some(d => { const m = num(d); return m >= a && m <= b; })).length;
      celdas.push({ semana: k, activos, pct: Math.round((activos / lista.length) * 100) });
    }
    return { semana, altas: lista.length, celdas };
  });
}

/** Cuántos hay de cada valor de un campo (tipo de acceso, proveedor…), de más a menos. */
export function reparto(lista, campo, nombres = {}) {
  const c = new Map();
  for (const x of lista) { const v = x[campo] || 'sin dato'; c.set(v, (c.get(v) ?? 0) + 1); }
  return [...c].sort((a, b) => b[1] - a[1]).map(([k, valor]) => ({ nombre: nombres[k] ?? k, valor }));
}

/** Todo lo que enseña el panel para un periodo ('7', '30', '90' o 'todo'). */
export function metricas(usuarios, hoy, periodo) {
  const dias = diasDelPeriodo(usuarios, hoy, periodo);
  const serie = serieDiaria(usuarios, dias);
  const n = dias.length;
  const anteriores = periodo === 'todo' ? [] : diasDelPeriodo(usuarios, fecha(num(dias[0]) - 1), n);
  return {
    hoy, dias, serie,
    registrados: usuarios.filter(u => u.alta <= hoy).length,
    resumen: resumen(usuarios, dias, hoy),
    anterior: anteriores.length ? resumen(usuarios, anteriores, hoy) : null,
    semana: porDiaDeSemana(serie),
    uso: porTiempoDeUso(usuarios, dias),
    cohortes: cohortes(usuarios, hoy),
  };
}

// ---- La pantalla ----

const COLOR = { vuelven: '#2a78d6', nuevos: '#eb6834', uno: '#2a78d6' };
// Escala de un solo tono (azul) para la retención, de poco a mucho; validada con el método de dataviz
const RAMPA = ['#e8f1fc', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95'];
const TINTA_OSCURA = 4;   // desde este paso de la rampa, el texto va en blanco
const NS = 'http://www.w3.org/2000/svg';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const corta = d => `${Number(d.slice(8, 10))} ${MESES[Number(d.slice(5, 7)) - 1]}`;
const larga = d => `${SEMANA[(new Date(num(d) * DIA_MS).getUTCDay() + 6) % 7]} ${corta(d)}`;
const entero = v => Math.round(v).toLocaleString('es-ES');
const decimal = v => (Math.round(v * 10) / 10).toLocaleString('es-ES');
export const horas = m => (m < 60 ? `${Math.round(m)} min` : `${decimal(m / 60)} h`);

// Los estilos van por código (`style.setProperty`), nunca como atributo: la CSP de la página (style-src 'self') los bloquea
function el(tag, attrs = {}, texto) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'style') for (const [p, x] of Object.entries(v)) e.style.setProperty(p, x);
    else e.setAttribute(k, v);
  }
  if (texto != null) e.textContent = String(texto);
  return e;
}
function svg(tag, attrs = {}, texto) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (texto != null) e.textContent = String(texto);
  return e;
}

/** Marcas redondas del eje: 0, y pasos de 1, 2 o 5 por potencia de 10, como mucho 5. */
function marcas(max) {
  if (max <= 0) return [0, 1];
  const bruto = max / 4;
  const p = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 5, 10].map(f => f * p).find(s => s >= bruto) ?? 10 * p;
  const out = [];
  for (let v = 0; v <= max + paso * 0.999; v += paso) out.push(Math.round(v * 1000) / 1000);
  return out;
}

/** Una tabla con los datos de una gráfica, plegada debajo de ella. */
function tablaDatos(cabecera, filas) {
  const d = el('details', { class: 'datos' });
  d.append(el('summary', {}, 'Ver los datos'));
  const caja = el('div', { class: 'tabla-caja' });
  const t = el('table');
  const tr = el('tr');
  cabecera.forEach((c, i) => tr.append(el('th', i ? { class: 'num' } : {}, c)));
  const tb = el('tbody');
  for (const f of filas) {
    const r = el('tr');
    f.forEach((c, i) => r.append(el('td', i ? { class: 'num' } : {}, c)));
    tb.append(r);
  }
  t.append(el('thead'), tb);
  t.tHead.append(tr);
  caja.append(t);
  d.append(caja);
  return d;
}

function leyenda(series, forma) {
  const l = el('div', { class: 'leyenda' });
  for (const s of series) {
    const i = el('span');
    i.append(el('i', { class: forma === 'linea' ? 'clave linea' : 'clave', style: { '--c': s.color } }), document.createTextNode(s.nombre));
    l.append(i);
  }
  return l;
}

/**
 * Columnas por día (una serie o apiladas). Con el puntero o el teclado (flechas), la columna se resalta y la burbuja da
 * el día y el valor de cada serie.
 */
function columnas(caja, burbuja, { dias, series, formato = entero, total = true }) {
  const W = Math.max(280, caja.clientWidth), H = 220, m = { t: 14, r: 8, b: 26, l: 40 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const n = dias.length;
  const totales = dias.map((_, i) => series.reduce((s, x) => s + x.valores[i], 0));
  const ys = marcas(Math.max(...totales));
  const tope = ys[ys.length - 1] || 1;
  const y = v => m.t + ph - (v / tope) * ph;
  const banda = pw / n;
  const ancho = Math.max(1, Math.min(24, banda * 0.72));
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'grafica', tabindex: 0, role: 'img' });
  for (const v of ys) {
    s.append(svg('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: v ? 'rejilla' : 'base' }));
    s.append(svg('text', { x: m.l - 6, y: y(v) + 4, class: 'eje', 'text-anchor': 'end' }, formato(v)));
  }
  const cada = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 64))));
  const grupos = dias.map((d, i) => {
    const cx = m.l + banda * i + banda / 2;
    if (i % cada === 0 || i === n - 1) s.append(svg('text', { x: cx, y: H - 8, class: 'eje', 'text-anchor': 'middle' }, corta(d)));
    const g = svg('g', { class: 'columna' });
    let base = 0;
    const visibles = series.filter(x => x.valores[i] > 0);
    visibles.forEach((x, k) => {
      const v = x.valores[i];
      const y0 = y(base) - (k ? 2 : 0), y1 = y(base + v);
      const alto = Math.max(0, y0 - y1);
      if (alto > 0) {
        const r = k === visibles.length - 1 ? Math.min(4, ancho / 2, alto) : 0;
        const x0 = cx - ancho / 2, x1 = cx + ancho / 2;
        g.append(svg('path', { fill: x.color, d: `M${x0},${y0}V${y1 + r}Q${x0},${y1} ${x0 + r},${y1}H${x1 - r}Q${x1},${y1} ${x1},${y1 + r}V${y0}Z` }));
      }
      base += v;
    });
    s.append(g);
    return { g, cx };
  });
  const guia = svg('line', { y1: m.t, y2: m.t + ph, class: 'guia', visibility: 'hidden' });
  s.append(guia);
  const mostrar = i => {
    grupos.forEach((x, k) => x.g.classList.toggle('apagada', k !== i));
    guia.setAttribute('x1', grupos[i].cx); guia.setAttribute('x2', grupos[i].cx); guia.setAttribute('visibility', 'visible');
    const filas = series.map(x => [x.color, formato(x.valores[i]), x.nombre]);
    if (total && series.length > 1) filas.push([null, formato(totales[i]), 'En total']);
    burbuja.mostrar(larga(dias[i]), filas, s, grupos[i].cx, y(totales[i]));
  };
  enganchar(s, n, i => mostrar(i), () => { grupos.forEach(x => x.g.classList.remove('apagada')); guia.setAttribute('visibility', 'hidden'); burbuja.ocultar(); },
    ev => Math.min(n - 1, Math.max(0, Math.floor((enX(s, ev, W) - m.l) / banda))));
  caja.replaceChildren(s);
}

/** Líneas por día (series del mismo tipo de valor, un solo eje), con una guía vertical que busca el día. */
function lineas(caja, burbuja, { dias, series, formato = entero }) {
  const W = Math.max(280, caja.clientWidth), H = 220, m = { t: 14, r: 44, b: 26, l: 40 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const n = dias.length;
  const ys = marcas(Math.max(...series.flatMap(x => x.valores)));
  const tope = ys[ys.length - 1] || 1;
  const y = v => m.t + ph - (v / tope) * ph;
  const x = i => m.l + (n === 1 ? pw / 2 : (pw * i) / (n - 1));
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'grafica', tabindex: 0, role: 'img' });
  for (const v of ys) {
    s.append(svg('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: v ? 'rejilla' : 'base' }));
    s.append(svg('text', { x: m.l - 6, y: y(v) + 4, class: 'eje', 'text-anchor': 'end' }, formato(v)));
  }
  const cada = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 64))));
  dias.forEach((d, i) => { if (i % cada === 0 || i === n - 1) s.append(svg('text', { x: x(i), y: H - 8, class: 'eje', 'text-anchor': 'middle' }, corta(d))); });
  for (const se of series) {
    const pts = se.valores.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    if (se.area) s.append(svg('polygon', { points: `${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}`, fill: se.color, 'fill-opacity': 0.1 }));
    s.append(svg('polyline', { points: pts, fill: 'none', stroke: se.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    const ult = se.valores[n - 1];
    s.append(svg('circle', { cx: x(n - 1), cy: y(ult), r: 4, fill: se.color, class: 'punto' }));
    s.append(svg('text', { x: x(n - 1) + 8, y: y(ult) + 4, class: 'valor' }, formato(ult)));
  }
  const guia = svg('line', { y1: m.t, y2: m.t + ph, class: 'guia', visibility: 'hidden' });
  const marcadores = series.map(se => svg('circle', { r: 4, fill: se.color, class: 'punto', visibility: 'hidden' }));
  s.append(guia, ...marcadores);
  enganchar(s, n, i => {
    guia.setAttribute('x1', x(i)); guia.setAttribute('x2', x(i)); guia.setAttribute('visibility', 'visible');
    marcadores.forEach((c, k) => { c.setAttribute('cx', x(i)); c.setAttribute('cy', y(series[k].valores[i])); c.setAttribute('visibility', 'visible'); });
    burbuja.mostrar(larga(dias[i]), series.map(se => [se.color, formato(se.valores[i]), se.nombre]), s, x(i), Math.min(...series.map(se => y(se.valores[i]))));
  }, () => { guia.setAttribute('visibility', 'hidden'); marcadores.forEach(c => c.setAttribute('visibility', 'hidden')); burbuja.ocultar(); },
  ev => Math.min(n - 1, Math.max(0, Math.round(((enX(s, ev, W) - m.l) / pw) * (n - 1)))));
  caja.replaceChildren(s);
}

/** La x del puntero en las unidades del dibujo (el SVG se estira con la pantalla). */
const enX = (s, ev, W) => { const r = s.getBoundingClientRect(); return ((ev.clientX - r.left) / r.width) * W; };

/** Puntero y teclado sobre una gráfica por días: `ver(i)` enseña el día i, `quitar()` lo esconde. */
function enganchar(s, n, ver, quitar, indice) {
  let actual = n - 1;
  s.addEventListener('pointermove', ev => { actual = indice(ev); ver(actual); });
  s.addEventListener('pointerleave', quitar);
  s.addEventListener('focus', () => ver(actual));
  s.addEventListener('blur', quitar);
  s.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      actual = Math.min(n - 1, Math.max(0, actual + (ev.key === 'ArrowLeft' ? -1 : 1)));
      ver(actual);
    }
  });
}

/** Barras horizontales con su nombre y su valor (repartos: tipo de acceso, tiempo de uso, día de la semana…). */
function barras(caja, lista, formato = entero) {
  const max = Math.max(1, ...lista.map(x => x.valor));
  const total = lista.reduce((s, x) => s + x.valor, 0);
  const ul = el('ul', { class: 'barras' });
  for (const x of lista) {
    const li = el('li');
    const barra = el('span', { class: 'barra' });
    barra.append(el('i', { style: { width: `${(x.valor / max) * 100}%` } }));
    const pct = total && formato === entero ? ` · ${Math.round((x.valor / total) * 100)} %` : '';
    li.append(el('span', { class: 'nombre' }, x.nombre), barra, el('span', { class: 'cantidad' }, `${formato(x.valor)}${pct}`));
    ul.append(li);
  }
  caja.replaceChildren(ul);
}

/** La retención por semana de alta, en una rejilla de celdas con su porcentaje. */
function rejillaCohortes(caja, burbuja, lista) {
  const semanas = Math.max(0, ...lista.map(c => c.celdas.length));
  const t = el('table', { class: 'cohortes' });
  const cab = el('tr');
  cab.append(el('th', {}, 'Semana de alta'), el('th', { class: 'num' }, 'Altas'));
  for (let k = 0; k < semanas; k++) cab.append(el('th', { class: 'num' }, k ? `+${k}` : '0'));
  const tb = el('tbody');
  for (const c of lista) {
    const tr = el('tr');
    tr.append(el('td', {}, corta(c.semana)), el('td', { class: 'num' }, c.altas));
    for (const celda of c.celdas) {
      if (!celda) { tr.append(el('td', { class: 'vacia' })); continue; }
      const paso = Math.min(RAMPA.length - 1, Math.round((celda.pct / 100) * (RAMPA.length - 1)));
      const td = el('td', { class: 'celda', tabindex: 0, style: { background: RAMPA[paso], color: paso >= TINTA_OSCURA ? '#fff' : 'var(--text)' } }, `${celda.pct} %`);
      const ver = () => burbuja.mostrarEn(td, `Altas de la semana del ${corta(c.semana)}`, [[null, `${celda.activos} de ${c.altas}`, celda.semana ? `entraron en su semana +${celda.semana}` : 'entraron en su primera semana']]);
      td.addEventListener('pointerenter', ver); td.addEventListener('focus', ver);
      td.addEventListener('pointerleave', () => burbuja.ocultar()); td.addEventListener('blur', () => burbuja.ocultar());
      tr.append(td);
    }
    tb.append(tr);
  }
  t.append(el('thead'), tb);
  t.tHead.append(cab);
  const div = el('div', { class: 'tabla-caja' });
  div.append(t);
  caja.replaceChildren(div);
}

/** La burbuja de los datos al pasar el puntero o el foco. */
function crearBurbuja(panel) {
  const b = el('div', { class: 'burbuja', role: 'tooltip', hidden: '' });
  panel.append(b);
  const pintar = (titulo, filas) => {
    b.replaceChildren(el('p', { class: 'titulo' }, titulo));
    for (const [color, valor, nombre] of filas) {
      const p = el('p');
      if (color) p.append(el('i', { class: 'clave linea', style: { '--c': color } }));
      p.append(el('b', {}, valor), document.createTextNode(` ${nombre}`));
      b.append(p);
    }
    b.hidden = false;
  };
  const colocar = (px, py) => {
    const r = panel.getBoundingClientRect();
    const w = b.offsetWidth, h = b.offsetHeight;
    let left = px - r.left + 12, top = py - r.top - h - 10;
    if (left + w > r.width) left = px - r.left - w - 12;
    if (top < 0) top = py - r.top + 14;
    b.style.left = `${Math.max(0, left)}px`; b.style.top = `${top}px`;
  };
  return {
    mostrar(titulo, filas, s, x, y) {
      pintar(titulo, filas);
      const r = s.getBoundingClientRect();
      const k = r.width / Number(s.getAttribute('width'));
      colocar(r.left + x * k, r.top + y * k);
    },
    mostrarEn(nodo, titulo, filas) {
      pintar(titulo, filas);
      const r = nodo.getBoundingClientRect();
      colocar(r.left + r.width / 2, r.top);
    },
    ocultar() { b.hidden = true; },
  };
}

function tarjeta(titulo, nota) {
  const t = el('section', { class: 'graf' });
  t.append(el('h3', {}, titulo));
  if (nota) t.append(el('p', { class: 'nota' }, nota));
  return t;
}

/** Una cifra con su comparación con el periodo anterior (si lo hay). `mejorSube`: subir es bueno. */
function cifra(nombre, valor, ahora, antes, formato = entero, explica) {
  const d = el('div', { class: 'cifra' });
  d.append(el('span', { class: 'nombre' }, nombre), el('b', {}, valor));
  if (antes != null && ahora != null) {
    const dif = ahora - antes;
    const txt = dif === 0 ? 'igual que el periodo anterior' : `${dif > 0 ? '▲ +' : '▼ −'}${formato(Math.abs(dif))} respecto al periodo anterior`;
    d.append(el('span', { class: `cambio ${dif > 0 ? 'sube' : dif < 0 ? 'baja' : ''}` }, txt));
  }
  if (explica) d.title = explica;
  return d;
}

const PERIODOS = [['7', '7 días'], ['30', '30 días'], ['90', '90 días'], ['todo', 'Todo']];
const CADA = [[0, 'No'], [1, 'Cada minuto'], [5, 'Cada 5 min'], [15, 'Cada 15 min']];
const leerPref = (k, def) => { try { return localStorage.getItem(`aulapro_informe_${k}`) ?? def; } catch { return def; } };
const guardarPref = (k, v) => { try { localStorage.setItem(`aulapro_informe_${k}`, String(v)); } catch { /* sin almacenamiento */ } };

/**
 * El panel: filtro de periodo y de actualización arriba, cifras y gráficas debajo. `actualizar()` pide los datos de nuevo
 * (lo hace informe.js con la contraseña) y llama a `pintar`.
 */
export function crearPanel(nodo, { actualizar }) {
  let periodo = leerPref('periodo', '30');
  let cada = Number(leerPref('cada', '5'));
  let datos = null;
  let reloj = null;

  const filtros = el('div', { class: 'filtros-panel' });
  const grupo = el('div', { class: 'segmentos', role: 'group', 'aria-label': 'Periodo' });
  const botones = PERIODOS.map(([v, t]) => {
    const b = el('button', { type: 'button', 'aria-pressed': String(v === periodo) }, t);
    b.addEventListener('click', () => { periodo = v; guardarPref('periodo', v); botones.forEach((x, i) => x.setAttribute('aria-pressed', String(PERIODOS[i][0] === v))); pintar(); });
    grupo.append(b);
    return b;
  });
  const sel = el('select', { 'aria-label': 'Actualizar solo' });
  for (const [v, t] of CADA) { const o = el('option', { value: v }, t); if (v === cada) o.selected = true; sel.append(o); }
  sel.addEventListener('change', () => { cada = Number(sel.value); guardarPref('cada', cada); programar(); });
  const etiqueta = el('label', { class: 'auto' }, 'Actualizar solo: ');
  etiqueta.append(sel);
  const ahora = el('button', { type: 'button', class: 'btn ghost' }, 'Actualizar ahora');
  ahora.addEventListener('click', () => actualizar());
  const hora = el('span', { class: 'hora', 'aria-live': 'polite' });
  filtros.append(grupo, etiqueta, ahora, hora);

  const cuerpo = el('div', { class: 'cuerpo-panel' });
  nodo.replaceChildren(filtros, cuerpo);
  const burbuja = crearBurbuja(nodo);

  function programar() {
    clearInterval(reloj);
    reloj = cada ? setInterval(() => { if (document.visibilityState === 'visible') actualizar(); }, cada * 60_000) : null;
  }
  document.addEventListener('visibilitychange', () => {
    // Al volver a la pestaña, si tocaba actualizar mientras estaba oculta, se hace ya
    if (cada && document.visibilityState === 'visible' && datos && Date.now() - datos.recibido > cada * 60_000) actualizar();
  });
  let ancho = 0;
  addEventListener('resize', () => { if (datos && Math.abs(nodo.clientWidth - ancho) > 40) pintar(); });

  function pintar() {
    if (!datos) return;
    ancho = nodo.clientWidth;
    burbuja.ocultar();
    const M = metricas(datos.usuarios, datos.hoy, periodo);
    const r = M.resumen, a = M.anterior;
    hora.textContent = `Datos de las ${new Date(datos.recibido).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;

    const heroe = el('p', { class: 'heroe' });
    heroe.append(el('b', {}, entero(M.registrados)), document.createTextNode(' docentes registrados en total'));

    const cifras = el('div', { class: 'cifras' });
    cifras.append(
      cifra('Han entrado', entero(r.entran), r.entran, a?.entran),
      cifra('Nuevos', entero(r.nuevos), r.nuevos, a?.nuevos),
      cifra('Repiten', entero(r.repiten), r.repiten, a?.repiten, entero, 'La usaron algún día después del día en que se dieron de alta'),
      cifra('Tiempo de uso', horas(r.minutos), r.minutos, a?.minutos, horas),
      cifra('Días de uso por docente', decimal(r.diasPorDocente), r.diasPorDocente, a?.diasPorDocente, decimal, 'Media de días distintos que la usó cada docente que entró'),
      cifra('Vuelven en su primera semana', r.vuelven7 ? `${r.vuelven7.pct} %` : 'Aún sin datos', r.vuelven7?.pct, a?.vuelven7?.pct, v => `${entero(v)} puntos`,
        'De los que se dieron de alta hace al menos 7 días, cuántos volvieron otro día de esa semana'),
    );

    const s = M.serie;
    const g1 = tarjeta('Docentes que entran cada día', 'Nuevos: se dieron de alta ese día. Vuelven: ya se habían dado de alta antes.');
    const c1 = el('div', { class: 'lienzo' });
    const series1 = [
      { nombre: 'Vuelven', color: COLOR.vuelven, valores: s.map(x => x.vuelven) },
      { nombre: 'Nuevos', color: COLOR.nuevos, valores: s.map(x => x.nuevos) },
    ];
    g1.append(leyenda(series1, 'barra'), c1, tablaDatos(['Día', 'Nuevos', 'Vuelven', 'En total'], s.map(x => [corta(x.dia), x.nuevos, x.vuelven, x.entran])));

    const g2 = tarjeta('Crecimiento', 'Registrados: todos los que se han dado de alta. Activos: los que entraron en los últimos 7 días.');
    const c2 = el('div', { class: 'lienzo' });
    const series2 = [
      { nombre: 'Registrados', color: COLOR.vuelven, valores: s.map(x => x.registrados), area: true },
      { nombre: 'Activos en 7 días', color: COLOR.nuevos, valores: s.map(x => x.activos7) },
    ];
    g2.append(leyenda(series2, 'linea'), c2, tablaDatos(['Día', 'Registrados', 'Activos en 7 días'], s.map(x => [corta(x.dia), x.registrados, x.activos7])));

    const g3 = tarjeta('Tiempo de uso cada día', 'Minutos con la app a la vista y usándola, sumando a todos los docentes.');
    const c3 = el('div', { class: 'lienzo' });
    g3.append(c3, tablaDatos(['Día', 'Tiempo de uso', 'Por docente que entró'], s.map(x => [corta(x.dia), horas(x.minutos), x.entran ? horas(x.minutos / x.entran) : '-'])));

    const g4 = tarjeta('Cuánto la han usado en el periodo', 'Cada docente que entró, según su tiempo de uso total en el periodo.');
    const c4 = el('div');
    g4.append(c4);

    const g5 = tarjeta('Qué días de la semana entran más', 'Media de docentes que entran cada día de la semana, en el periodo.');
    const c5 = el('div');
    g5.append(c5);

    const g6 = tarjeta('Retención por semana de alta', 'De cada grupo que se dio de alta la misma semana, qué parte entró en cada semana siguiente. Siempre las últimas 8 semanas.');
    const c6 = el('div');
    g6.append(c6);

    const g7 = tarjeta('Tipo de acceso y cuenta', 'Todos los registrados.');
    const c7a = el('div'), c7b = el('div');
    g7.append(el('h4', {}, 'Acceso'), c7a, el('h4', {}, 'Entran con'), c7b);

    const rejilla = el('div', { class: 'rejilla-graficas' });
    g6.classList.add('ancha');
    rejilla.append(g1, g2, g3, g4, g5, g7, g6);
    cuerpo.replaceChildren(heroe, cifras, rejilla);
    cuerpo.classList.remove('recargando');

    columnas(c1, burbuja, { dias: M.dias, series: series1 });
    lineas(c2, burbuja, { dias: M.dias, series: series2 });
    columnas(c3, burbuja, { dias: M.dias, series: [{ nombre: 'de uso', color: COLOR.uno, valores: s.map(x => x.minutos / 60) }], formato: v => `${decimal(v)} h`, total: false });
    barras(c4, M.uso);
    barras(c5, M.semana, decimal);
    rejillaCohortes(c6, burbuja, M.cohortes);
    barras(c7a, reparto(datos.usuarios, 'tipo', { beta: 'Acceso gratuito', fundador: 'Fundador', pago: 'Suscripción', 'sin-licencia': 'Sin licencia', 'sin dato': 'Sin dato' }));
    barras(c7b, reparto(datos.usuarios, 'proveedor', { google: 'Google', microsoft: 'Microsoft', 'sin dato': 'Sin dato' }));
  }

  programar();
  return {
    /** Datos nuevos: `usuarios` ya juntados (`fusionar`) y el día de hoy del servidor. */
    pintar(usuarios, hoy) { datos = { usuarios, hoy, recibido: Date.now() }; pintar(); },
    /** Mientras se piden datos nuevos, lo de antes se queda a la vista, más tenue. */
    cargando(si) { cuerpo.classList.toggle('recargando', si); },
    parar() { clearInterval(reloj); reloj = null; },
  };
}
