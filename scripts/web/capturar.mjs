/**
 * Capturas de la app para la web: las de la portada (web/sitio/assets/app) y
 * las pantallas de la demo interactiva (web/sitio/assets/demo), con la
 * posición de cada botón para que la demo sepa qué se puede pulsar
 * (web/sitio/assets/demo-pantallas.js).
 *
 * Se hacen sobre la app de verdad, con los datos de ejemplo y un miércoles a
 * las 9:45 (hay clase en marcha). Así la demo y las capturas salen siempre
 * iguales que la app y basta con repetirlo cuando cambie algo.
 *
 * Uso, con la app arrancada en modo desarrollo (`npm run dev`):
 *
 *   npm i --no-save playwright@1.56.1
 *   node scripts/web/capturar.mjs [http://localhost:5173/]
 *
 * Además escribe en scripts/web/marcas.json dónde caen, en %, las marcas que
 * la portada dibuja sobre las capturas (números, círculos y etiquetas).
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITIO = path.join(RAIZ, 'web/sitio');
const BASE = process.argv[2] || 'http://localhost:5173/';
const W = 1920, H = 1008, SB = 256;

const webp = (buf, q = 84) => sharp(buf).webp({ quality: q, effort: 6 }).toBuffer();
async function guardar(rel, buf, q) {
  const out = path.join(SITIO, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, await webp(buf, q));
  return rel;
}
const r = n => Math.round(n);

/* ── A dónde lleva cada botón en la demo ──────────────────────────────── */
const MENU = {
  'Inicio': 'inicio', 'Mis Clases': 'clases', 'Agenda': 'agenda', 'Cuaderno de Notas': 'cuaderno',
  'Asistencia': 'asistencia', 'Evaluar': 'evaluar', 'Documentos': 'documentos', 'En clase': 'enclase',
  'Reuniones': 'reuniones', 'Formaciones': 'formaciones', 'Trabajo compartido': 'compartido',
  'Configuración': 'config', 'Registro de cambios': 'registro',
};
const PESTANAS = {
  evaluar: { 'Resumen': 'evaluar', 'Rúbricas': 'rubricas', 'Dianas': 'dianas', 'Diana competencial': 'diana', 'Autoevaluaciones': 'autoeval', 'Historial': 'historial' },
  documentos: { 'Resumen': 'documentos', 'Informes': 'informes', 'Actas': 'actas', 'Situaciones de aprendizaje': 'situaciones', 'Recursos': 'recursos' },
  enclase: { 'Resumen': 'enclase', 'Anotar actitud': 'actitud', 'Distribución de aula': 'distribucion', 'Pizarra y herramientas': 'pizarra', 'Actividades con móviles': 'moviles' },
};
/** Botones del contenido que llevan a otra pantalla de la demo. */
const SALTOS = [
  [/^Pasar lista/, 'asistencia'], [/^Anotar actitud/, 'actitud'], [/^Anotar$/, 'actitud'], [/^Añadir nota/, 'cuaderno'],
  [/^Ver la semana/, 'agenda'], [/^Ver alumnado/, 'clases'], [/^Ajustar en el cuaderno/, 'cuaderno'],
  [/^Evaluar por rúbricas/, 'rubricas'], [/^Evaluar por dianas/, 'dianas'],
  [/^Informes/, 'informes'], [/^Actas/, 'actas'], [/^Situaciones de aprendizaje/, 'situaciones'], [/^Recursos/, 'recursos'],
  [/^Distribución de aula/, 'distribucion'], [/^Pizarra y herramientas/, 'pizarra'], [/^Actividades con móviles/, 'moviles'],
];

/** Todo lo que se puede pulsar y se ve: [x0, y0, x1, y1, tipo, nombre, hub]. */
async function zonas(page) {
  return page.evaluate(() => {
    const vis = e => e.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const modal = [...document.querySelectorAll('.modal-overlay.open')].pop();
    const raiz = modal ?? document;
    const sel = 'button, a[href], [role=button], [role=tab], select, input:not([type=hidden]), textarea, summary';
    const todos = [...raiz.querySelectorAll(sel)].filter(e => {
      if (!vis(e)) return false;
      const b = e.getBoundingClientRect();
      return b.width >= 6 && b.height >= 6 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth;
    });
    // Solo el de fuera: un botón dentro de otro no es otra zona
    const fuera = todos.filter(e => !todos.some(o => o !== e && o.contains(e)));
    const hub = document.querySelector('.hub-tab.on, .hub-tab[aria-selected="true"]')?.closest('[class*=hub]')?.textContent ?? '';
    return {
      modal: modal ? (() => { const c = modal.querySelector('.modal, [role=dialog]') ?? modal.firstElementChild; const b = c.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; })() : null,
      hub,
      zonas: fuera.map(e => {
        const b = e.getBoundingClientRect();
        const tipo = e.classList.contains('nav-item') ? 'menu'
          : e.classList.contains('hub-tab') ? 'pestana'
          : /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) ? 'campo' : 'boton';
        const nombre = (e.getAttribute('aria-label') || e.innerText || e.title || e.getAttribute('placeholder') || '')
          .split('\n').map(s => s.trim()).filter(Boolean)[0] ?? '';
        return [Math.max(0, b.left), Math.max(0, b.top), Math.min(innerWidth, b.right), Math.min(innerHeight, b.bottom), tipo, nombre.slice(0, 60)];
      }),
    };
  });
}

/** Convierte las zonas de una pantalla en botones de la demo. */
function acciones(z, hubId, extra = {}) {
  return z.map(([x0, y0, x1, y1, tipo, nombre]) => {
    let act;
    if (tipo === 'menu') act = MENU[nombre] ? `go:${MENU[nombre]}` : `g`;
    else if (tipo === 'pestana') act = PESTANAS[hubId]?.[nombre] ? `go:${PESTANAS[hubId][nombre]}` : 'g';
    else if (extra[nombre]) act = extra[nombre];
    else if (tipo === 'campo') act = 'i';
    else act = SALTOS.find(([re]) => re.test(nombre)) ? `go:${SALTOS.find(([re]) => re.test(nombre))[1]}` : 'g';
    if (nombre === 'Cerrar sesión') act = 't:logout';
    if (/^Ayuda de Aula Pro/.test(nombre)) act = 't:help';
    return [r(x0), r(y0), r(x1), r(y1), act, nombre];
  });
}

const fuera = (zs, cajas) => zs.filter(([x0, y0, x1, y1]) => !cajas.some(([a, b, c, d]) => x0 >= a - 2 && y0 >= b - 2 && x1 <= c + 2 && y1 <= d + 2));

/* ── La sesión ───────────────────────────────────────────────────────── */
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'es-ES' });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('Error en la app:', e.message));
await ctx.clock.install({ time: new Date('2026-10-14T09:45:00') });
await page.goto(BASE);
await page.waitForTimeout(1500);
await page.getByText('Explorar con datos de ejemplo').click();
await page.waitForTimeout(3500);
// Sin cursor parpadeando ni animaciones a medias en las capturas
await page.addStyleTag({ content: '*{caret-color:transparent!important} .toast,.toast-wrap{display:none!important}' });

const menu = async nombre => { await page.locator('.sidebar .nav-item', { hasText: new RegExp(`^${nombre}$`) }).click(); await page.waitForTimeout(1300); };
const pestana = async nombre => { await page.locator('.hub-tab', { hasText: new RegExp(`^${nombre}$`) }).click(); await page.waitForTimeout(1300); };
const cerrarModal = async () => { await page.locator('.modal-overlay.open').last().getByRole('button', { name: 'Cerrar' }).first().click(); await page.waitForTimeout(500); };
const arriba = () => page.evaluate(() => window.scrollTo(0, 0));
const foto = async (opts = {}) => { await arriba(); await page.waitForTimeout(350); return page.screenshot(opts); };
/** Elige en un desplegable la opción cuyo texto empieza así (para enseñar clases de Primaria). */
async function elegir(select, texto) {
  const v = await select.locator('option').evaluateAll((os, t) => (os.find(o => o.textContent.trim().startsWith(t)) ?? os.find(o => o.value))?.value, texto);
  await select.selectOption(v);
  await page.waitForTimeout(400);
}
const caja = async loc => { const b = await loc.boundingBox(); return [r(b.x), r(b.y), r(b.x + b.width), r(b.y + b.height)]; };

const PANTALLAS = {};
const MARCAS = {};

/** Captura una pantalla entera para la demo, con sus zonas. */
async function pantalla(id, titulo, hubId, opts = {}) {
  const buf = await foto();
  const img = await guardar(`assets/demo/${id}.webp`, buf);
  const z = await zonas(page);
  let spots = acciones(z.zonas, hubId, opts.extra);
  if (opts.quitar) spots = fuera(spots, opts.quitar);
  PANTALLAS[id] = { title: titulo, img: path.basename(img), spots, ...(z.modal ? { modal: z.modal.map(r) } : {}), ...(opts.datos ?? {}) };
  console.log(`· ${id}: ${spots.length} zonas`);
  return buf;
}

/* Tu día a día */
await menu('Inicio');
const inicio = await pantalla('inicio', 'Inicio');
fs.writeFileSync(path.join(SITIO, 'assets/app/inicio.webp'), await webp(inicio));
MARCAS.inicio = await page.evaluate(() => {
  const pc = (el, dx = 0, dy = 0) => { const b = el.getBoundingClientRect(); return [+((b.left + dx) / innerWidth * 100).toFixed(1), +((b.top + dy) / innerHeight * 100).toFixed(1)]; };
  const pasos = document.querySelector('.fs-bar, .first-steps, [class*=fs-]');
  const hoja = t => [...document.querySelectorAll('main *')].find(e => e.childElementCount === 0 && e.textContent.trim() === t);
  const jornada = hoja('Tu jornada de hoy');
  const atencion = hoja('Necesitan atención');
  return { pasos: pasos && pc(pasos, 0, 26), jornada: jornada && pc(jornada, -14, 10), atencion: atencion && pc(atencion, -14, 10) };
});

await menu('Mis Clases');
await pantalla('clases', 'Mis Clases');
await menu('Agenda');
await pantalla('agenda', 'Agenda');
await menu('Cuaderno de Notas');
await elegir(page.locator('main .class-pick select').first(), '3º Primaria A');
const cuaderno = await pantalla('cuaderno', 'Cuaderno de Notas');
fs.writeFileSync(path.join(SITIO, 'assets/app/cuaderno.webp'), await webp(cuaderno));

await menu('Asistencia');
{
  const filas = await page.evaluate(() => [...document.querySelectorAll('.att-opts')].map(g => [...g.querySelectorAll('.att-opt')].map(b => {
    const x = b.getBoundingClientRect();
    return [Math.round(x.left), Math.round(x.top), Math.round(x.right), Math.round(x.bottom), getComputedStyle(b).getPropertyValue('--att-c').trim(), b.getAttribute('aria-pressed') === 'true', b.title];
  })));
  const quitar = filas.flat().map(([a, b, c, d]) => [a, b, c, d]);
  await pantalla('asistencia', 'Asistencia', null, { quitar, datos: { asistencia: filas } });
}

/* Evaluar */
await menu('Evaluar');
await pantalla('evaluar', 'Evaluar', 'evaluar');
await pestana('Rúbricas');
await pantalla('rubricas', 'Rúbricas', 'evaluar', { extra: { 'Evaluar alumno': 'go:rubrica' } });

// La ventana de evaluar con rúbrica, con clase y alumno elegidos y sin nada marcado
await page.locator('main').getByRole('button', { name: 'Evaluar alumno' }).first().click();
await page.waitForTimeout(900);
{
  const dlg = page.locator('.modal-overlay').filter({ has: page.locator('table') }).last();
  const selects = dlg.locator('select');
  await elegir(selects.nth(0), '4º Primaria A');
  await page.waitForTimeout(300);
  const alumnos = await selects.nth(1).locator('option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
  await selects.nth(1).selectOption(alumnos[alumnos.length - 1]);
  await page.waitForTimeout(500);
  const celdas = await page.evaluate(() => {
    const tabla = [...document.querySelectorAll('.modal-overlay.open table')].pop();
    return [...tabla.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].slice(1).map(td => {
      const b = td.getBoundingClientRect();
      return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)];
    })).filter(f => f.length);
  });
  const quitar = celdas.flat();
  const buf = await pantalla('rubrica', 'Evaluar con rúbrica', 'evaluar', { quitar, extra: { 'Cerrar': 'fn:closeModal', 'Cancelar': 'fn:closeModal', 'Guardar evaluación': 't:rubSave' }, datos: { rubrica: celdas, back: 'rubricas' } });
  const m = PANTALLAS.rubrica.modal;
  const [mx0, my0, mx1, my1] = m;
  fs.writeFileSync(path.join(SITIO, 'assets/app/rubrica.webp'), await webp(await sharp(buf).extract({ left: mx0, top: my0, width: mx1 - mx0, height: my1 - my0 }).toBuffer()));
  MARCAS.rubrica = { size: [mx1 - mx0, my1 - my0], ia: await page.evaluate(([x0, y0, w, h]) => {
    const t = [...document.querySelectorAll('.modal-overlay.open *')].find(e => e.checkVisibility() && /Evaluar trabajo con IA$/.test(e.textContent.trim()) && e.children.length < 3);
    const b = t.getBoundingClientRect();
    return [+((b.left - x0) / w * 100).toFixed(1), +((b.top - y0) / h * 100).toFixed(1), +(b.width / w * 100).toFixed(1), +(b.height / h * 100).toFixed(1)];
  }, [mx0, my0, mx1 - mx0, my1 - my0]) };
  await cerrarModal();
}

await pestana('Dianas');
await pantalla('dianas', 'Dianas', 'evaluar', { extra: { 'Evaluar alumno': 'go:dianaeval' } });
await page.locator('main').getByRole('button', { name: 'Evaluar alumno' }).first().click();
await page.waitForTimeout(900);
{
  const dlg = page.locator('.modal-overlay').filter({ has: page.locator('svg[aria-label="Diana de evaluación"]') }).last();
  const selects = dlg.locator('select');
  await elegir(selects.nth(0), '6º Primaria A');
  await page.waitForTimeout(300);
  const alumnos = await selects.nth(1).locator('option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
  await selects.nth(1).selectOption(alumnos[alumnos.length - 1]);
  await page.waitForTimeout(500);
  const diana = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('.modal-overlay.open svg[aria-label="Diana de evaluación"]')].pop();
    const b = svg.getBoundingClientRect();
    const dlg = svg.closest('.modal-overlay');
    const caja = el => { const x = el.getBoundingClientRect(); return [Math.round(x.left), Math.round(x.top), Math.round(x.right), Math.round(x.bottom)]; };
    const pills = [...dlg.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim() === 'Sin marcar' && e.checkVisibility());
    const items = pills.map(p => {
      let fila = p.parentElement;
      while (fila && fila.children.length < 2) fila = fila.parentElement;
      const texto = fila.textContent.replace('Sin marcar', '').trim();
      const peso = /×(\d+)/.exec(texto);
      return { name: texto.replace(/×\d+/, '').trim(), weight: peso ? +peso[1] : 1, pill: caja(p) };
    });
    const nota = [...dlg.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === '—' && e.checkVisibility());
    const cuenta = [...dlg.querySelectorAll('*')].find(e => e.children.length === 0 && /ítems marcados/.test(e.textContent) && e.checkVisibility());
    return { svg: [b.left, b.top, b.right, b.bottom].map(Math.round), viewBox: svg.getAttribute('viewBox'), items, nota: nota && caja(nota), cuenta: cuenta && caja(cuenta) };
  });
  await pantalla('dianaeval', 'Evaluar con diana', 'evaluar', {
    quitar: [diana.svg],
    extra: { 'Cerrar': 'fn:closeModal', 'Cancelar': 'fn:closeModal', 'Guardar evaluación': 'fn:dianaSave' },
    datos: { diana, back: 'dianas' },
  });
  // Rellena para la captura de la portada: un nivel por ítem
  const niveles = [4, 3, 3, 2, 4, 3];
  const n = diana.items.length;
  for (let i = 0; i < n; i++) {
    const titulo = `${diana.items[i].name} — ${['Insuficiente', 'Suficiente', 'Bien', 'Excelente'][niveles[i % niveles.length] - 1]}`;
    await dlg.locator('path').filter({ has: page.locator(`title:text-is("${titulo}")`) }).first().click({ force: true });
    await page.waitForTimeout(150);
  }
  await page.mouse.move(5, 5);
  await page.waitForTimeout(500);
  const m = PANTALLAS.dianaeval.modal;
  const lleno = await foto();
  const [mx0, my0, mx1, my1] = m;
  fs.writeFileSync(path.join(SITIO, 'assets/app/diana-nota.webp'), await webp(await sharp(lleno).extract({ left: mx0, top: my0, width: mx1 - mx0, height: Math.min(H, my1) - my0 }).toBuffer()));
  MARCAS.dianaNota = { size: [mx1 - mx0, Math.min(H, my1) - my0] };
  await cerrarModal();
}

await pestana('Diana competencial');
{
  // Con un alumno elegido, para que se vea su perfil
  const sel = page.locator('main select');
  await elegir(sel.nth(0), '5º Primaria A');
  await page.waitForTimeout(300);
  const alumnos = await sel.nth(1).locator('option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
  await sel.nth(1).selectOption(alumnos[1] ?? alumnos[0]);
  await page.waitForTimeout(900);
}
const dc = await pantalla('diana', 'Diana competencial', 'evaluar');
fs.writeFileSync(path.join(SITIO, 'assets/app/diana-competencial.webp'), await webp(dc));
MARCAS.dianaCompetencial = await page.evaluate(() => {
  const b = [...document.querySelectorAll('main button')].find(e => /Sugerir perfil con IA/.test(e.textContent) && e.checkVisibility());
  if (!b) return null;
  const x = b.getBoundingClientRect();
  return [+(x.left / innerWidth * 100).toFixed(1), +(x.top / innerHeight * 100).toFixed(1), +(x.width / innerWidth * 100).toFixed(1), +(x.height / innerHeight * 100).toFixed(1)];
});
await pestana('Autoevaluaciones');
await pantalla('autoeval', 'Autoevaluaciones', 'evaluar');
await pestana('Historial');
await pantalla('historial', 'Historial', 'evaluar');

/* Documentos */
await menu('Documentos');
await pantalla('documentos', 'Documentos', 'documentos');
await pestana('Informes');
await pantalla('informes', 'Informes', 'documentos');
await pestana('Actas');
await pantalla('actas', 'Actas', 'documentos');
await pestana('Situaciones de aprendizaje');
await pantalla('situaciones', 'Situaciones de aprendizaje', 'documentos');
await pestana('Recursos');
await pantalla('recursos', 'Recursos', 'documentos');

/* En clase */
await menu('En clase');
await pantalla('enclase', 'En clase', 'enclase');
await pestana('Anotar actitud');
{
  const filas = await page.evaluate(() => [...document.querySelectorAll('.act-row')].map(f => ({
    botones: [...f.querySelectorAll('.act-opt')].map(b => {
      const x = b.getBoundingClientRect();
      return [Math.round(x.left), Math.round(x.top), Math.round(x.right), Math.round(x.bottom), b.classList.contains('pos'), b.querySelector('.act-opt-lbl')?.textContent ?? ''];
    }),
    deshacer: (() => { const x = f.querySelector('.act-undo').getBoundingClientRect(); return [Math.round(x.left), Math.round(x.top), Math.round(x.right), Math.round(x.bottom)]; })(),
  })));
  const quitar = filas.flatMap(f => [...f.botones.map(b => b.slice(0, 4)), f.deshacer]);
  await pantalla('actitud', 'Anotar actitud', 'enclase', { quitar, datos: { actitud: filas } });
  // Para la portada, con algo anotado
  const fs0 = page.locator('.act-row');
  await fs0.nth(0).getByRole('button', { name: 'Participa' }).click();
  await fs0.nth(0).getByRole('button', { name: /Participa/ }).click();
  await fs0.nth(1).getByRole('button', { name: 'Sin tarea' }).click();
  await fs0.nth(2).getByRole('button', { name: 'Buen comportamiento' }).click();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  const act = await foto({ clip: { x: SB, y: 0, width: W - SB, height: 720 } });
  fs.writeFileSync(path.join(SITIO, 'assets/app/actitud.webp'), await webp(act));
}

await pestana('Distribución de aula');
{
  await elegir(page.locator('main .seat-select'), '2º Primaria A');
  const sentar = page.getByRole('button', { name: 'Sentar por orden de lista' }).first();
  if (await sentar.isVisible()) { await sentar.click(); await page.waitForTimeout(600); }
  await pantalla('distribucion', 'Distribución de aula', 'enclase');
}

await pestana('Pizarra y herramientas');
{
  // Para la portada: la pizarra tal cual se abre
  const limpia = await foto();
  fs.writeFileSync(path.join(SITIO, 'assets/app/pizarra.webp'), await webp(await sharp(limpia).extract({ left: SB, top: 0, width: W - SB, height: H }).toBuffer()));

  // Para la demo: también la calculadora y el lápiz
  await page.getByRole('button', { name: /^Añadir Calculadora/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Dibujar sobre la pantalla/ }).click();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(500);

  const live = await page.evaluate(() => {
    const caja = el => { const x = el.getBoundingClientRect(); return [Math.round(x.left), Math.round(x.top), Math.round(x.right), Math.round(x.bottom)]; };
    const btn = t => [...document.querySelectorAll('main button')].find(b => b.checkVisibility() && (b.getAttribute('aria-label') === t || b.title === t || b.textContent.trim() === t));
    const girar = btn('GIRAR');
    const ruleta = girar.parentElement;
    const disco = ruleta.querySelector('svg').parentElement;
    const nombres = [...disco.querySelectorAll('text')].map(t => t.textContent);
    const ventanas = [...document.querySelectorAll('main .drag-handle')].map(h => caja(h.closest('.react-draggable') ?? h.parentElement));
    const teclas = [...document.querySelectorAll('main button')].filter(b => b.checkVisibility() && b.style.minHeight === '34px')
      .map(b => [...caja(b), b.textContent.trim().replace(/\s+/g, '') || '⌫']);
    const k0 = teclas[0];
    const colores = [...document.querySelectorAll('main button[title="Color del lápiz"], main button[aria-label="Color del lápiz"]')].map(b => [...caja(b), getComputedStyle(b).backgroundColor]);
    const barra = btn('Desactivar lápiz').parentElement;
    const paleta = btn('Borrar todo').parentElement;
    const dock = btn('Añadir Temporizador').parentElement.parentElement;
    const cuenta = [...document.querySelectorAll('main button')].find(b => /^\d\d:\d\d$/.test(b.textContent.trim()));
    return {
      ruleta: { disco: caja(disco), centro: caja(girar), nombres },
      temporizador: {
        cifras: caja(cuenta),
        fichas: ['30 s', '1 min', '5 min', '10 min'].map(t => [...caja(btn(t)), t]),
        menos: caja(btn('Un minuto menos')), mas: caja(btn('Un minuto más')),
        iniciar: caja(btn('Iniciar')), reiniciar: caja(btn('Reiniciar')),
      },
      calculadora: { pantalla: k0 ? [k0[0], k0[1] - 102, teclas[3]?.[2] ?? k0[2], k0[1] - 10] : null, teclas },
      lapiz: { colores, borrar: caja(btn('Borrar todo')) },
      bloques: [caja(barra), caja(dock), caja(paleta), ...ventanas, caja(document.querySelector('.help-fab'))],
    };
  });
  // El disco sin el botón central ni la aguja, para girarlo en la demo
  await page.evaluate(() => {
    const g = [...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'GIRAR');
    g.style.visibility = 'hidden';
    g.parentElement.querySelector('div.absolute.z-20').style.visibility = 'hidden';
  });
  const [d0, d1, d2, d3] = live.ruleta.disco;
  await guardar('assets/demo/ruleta-disco.webp', await page.screenshot({ clip: { x: d0, y: d1, width: d2 - d0, height: d3 - d1 } }), 90);
  await page.evaluate(() => {
    const g = [...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'GIRAR');
    g.style.visibility = '';
    g.parentElement.querySelector('div.absolute.z-20').style.visibility = '';
  });
  await page.waitForTimeout(300);
  const [c0, c1, c2, c3] = live.ruleta.centro;
  await guardar('assets/demo/ruleta-centro.webp', await page.screenshot({ clip: { x: c0, y: c1, width: c2 - c0, height: c3 - c1 } }), 90);
  await pantalla('pizarra', 'Pizarra y herramientas', 'enclase', { quitar: live.bloques.slice(3, -1), datos: { live } });
  // Las zonas de la barra y el dock sí se quedan, menos las que hace la demo
  PANTALLAS.pizarra.spots = PANTALLAS.pizarra.spots.filter(s => !/^(Desactivar lápiz|Color del lápiz|Borrar todo)$/.test(s[5]));
}

/* Centro y equipo, y lo de abajo */
await menu('Reuniones');
await pantalla('reuniones', 'Reuniones');
await menu('Formaciones');
await pantalla('formaciones', 'Formaciones');
await menu('Trabajo compartido');
await pantalla('compartido', 'Trabajo compartido');
await menu('Configuración');
await pantalla('config', 'Configuración');
await menu('Registro de cambios');
await pantalla('registro', 'Registro de cambios');

/* Actividades con móviles, la última: se hace pasar por la app instalada
   (sin sala de verdad) para enseñar cómo se prepara la actividad. */
await page.evaluate(() => {
  const vacio = { running: false, port: null, code: null, label: '', addresses: [], activity: null, responses: [], connected: 0 };
  window.electronAPI = { ...(window.electronAPI ?? {}), classroom: {
    state: async () => vacio, stop: async () => vacio, start: async () => vacio,
    setActivity: async () => vacio, setRoster: async () => vacio, onUpdate: () => () => {},
  } };
});
await menu('En clase');
await pestana('Actividades con móviles');
await pantalla('moviles', 'Actividades con móviles', 'enclase', { extra: { 'Abrir sala': 't:room' } });

await browser.close();

const js = '/* Generado por scripts/web/capturar.mjs: no se edita a mano. Pantallas de la demo,\n'
  + '   con lo que se puede pulsar en cada una ([x0, y0, x1, y1, acción, nombre], en píxeles de la captura). */\n'
  + `window.AULA_DEMO_SCREENS = ${JSON.stringify(PANTALLAS)};\n`;
fs.writeFileSync(path.join(SITIO, 'assets/demo-pantallas.js'), js);
fs.writeFileSync(path.join(RAIZ, 'scripts/web/marcas.json'), JSON.stringify(MARCAS, null, 2) + '\n');
console.log('Hecho:', Object.keys(PANTALLAS).length, 'pantallas');
