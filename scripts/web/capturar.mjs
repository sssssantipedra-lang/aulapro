/**
 * Capturas de la app para la web: las de la portada (web/sitio/assets/app) y
 * las pantallas de la demo interactiva (web/sitio/assets/demo), con la
 * posición de cada botón para que la demo sepa qué se puede pulsar
 * (web/sitio/assets/demo-pantallas.js).
 *
 * Se hacen sobre la app de verdad, con los datos de ejemplo y un miércoles a
 * las 9:45 (hay clase en marcha), para los tres perfiles: docente de aula, Educación
 * Física y PT y AL, y una cuarta pasada, `nuevas`, con las sesiones, las tarjetas interactivas y los
 * pesos del cuaderno (`FASES=aula,ef` para hacer solo alguna: las pantallas de las demás se conservan).
 * Desde el 20-11-2026 la clase de cada pantalla la decide la app (la clase activa): con ese reloj es la
 * que está en marcha, 5º Primaria A, con su marca «Ahora», y aquí ya no se elige otra a mano. Los datos de ejemplo de la
 * app no traen nada de lo que crea la IA (situaciones de aprendizaje, informes, fichas, actas…),
 * así que antes de capturar se le suma un ejemplo de cada cosa (`scripts/web/ejemplos.mjs`).
 * Nada se genera de verdad: lo único que se escribe es lo que se ve en la captura. Así la demo y las capturas salen siempre
 * iguales que la app y basta con repetirlo cuando cambie algo.
 *
 * Uso, con la app arrancada en modo desarrollo (`npm run dev`):
 *
 *   node scripts/web/capturar.mjs [http://localhost:5173/]
 *
 * (Playwright y su Chromium tienen que estar instalados: `npm i --no-save playwright@1.56.1` si faltan.)
 *
 * **Mientras se ejecuta no hay que guardar ningún archivo del repositorio**: el servidor de desarrollo recarga la página
 * (también por un .md o un guion, que no son de la app) y la captura siguiente sale sin su ventana abierta.
 *
 * Además escribe en scripts/web/marcas.json dónde caen, en %, las marcas que
 * la portada dibuja sobre las capturas (números, círculos y etiquetas).
 *
 * La pizarra de la demo es especial: se capturan las ventanas repartidas por la
 * pizarra (cada una con aire alrededor, sin que las tape ninguna barra), una vez
 * completa (`pizarra.webp`, la que se amplía) y otra sin lo que la demo vuelve a
 * dibujar al usarlo (`pizarra-base.webp`: anillo y cifras del temporizador, ruleta,
 * pantalla de la calculadora y paleta del lápiz). Si cambia algo de esa pantalla
 * (ver `docs/PIZARRA.md`), hay que cambiar aquí y en `INIT.pizarra` de `assets/demo.js`.
 *
 * «Evaluar a la clase» (rúbrica y diana) también se puede probar en la demo: de la ventana se apunta
 * dónde están la lista del alumnado, la cuenta, a quién se evalúa y el pie (`datosDeClase`), y la demo
 * los vuelve a dibujar encima para que «Guardar y siguiente» pase de verdad al alumno siguiente
 * (`claseEval` en `assets/demo.js`, con los estilos de `src/estilos/evaluarClase.css`). Como la pizarra,
 * cada ventana se captura dos veces: completa (`rubrica.webp`, la que se amplía) y sin lo que la demo
 * vuelve a dibujar (`rubrica-base.webp`). Para la portada (`assets/app/rubrica.webp` y `diana-nota.webp`)
 * la misma ventana se captura a medio evaluar y en ancho de tableta, con la lista arriba: es más estrecha
 * y se lee mejor en pequeño.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ejemplosAula, fichasAula, borradorEvalFoto, reunionYFormacion, ejemplosEF, ejemplosApoyo, nuevasAula } from './ejemplos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITIO = path.join(RAIZ, 'web/sitio');
const BASE = process.argv[2] || 'http://localhost:5173/';
const W = 1920, H = 1008, SB = 256, BARRA = 53;   // la ventana, el menú lateral y la barra de pestañas de un apartado

const webp = (buf, q = 84) => sharp(buf).webp({ quality: q, effort: 6 }).toBuffer();
async function guardar(rel, buf, q) {
  const out = path.join(SITIO, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, await webp(buf, q));
  return rel;
}
const r = n => Math.round(n);

/* ── A dónde lleva cada botón en la demo ──────────────────────────────── */
const MENU_AULA = {
  'Inicio': 'inicio', 'Mis Clases': 'clases', 'Agenda': 'agenda', 'Cuaderno de Notas': 'cuaderno',
  'Asistencia': 'asistencia', 'Evaluar': 'evaluar', 'Documentos': 'documentos', 'En clase': 'enclase',
  'Reuniones': 'reuniones', 'Formaciones': 'formaciones', 'Trabajo compartido': 'compartido',
  'Configuración': 'config', 'Registro de cambios': 'registro',
};
const PESTANAS_AULA = {
  evaluar: { 'Resumen': 'evaluar', 'Rúbricas': 'rubricas', 'Dianas': 'dianas', 'Por foto': 'evalfoto', 'Diana competencial': 'diana', 'Autoevaluaciones': 'autoeval', 'Historial': 'historial' },
  documentos: { 'Resumen': 'documentos', 'Informes': 'informes', 'Actas': 'actas', 'Situaciones de aprendizaje': 'situaciones', 'Sesiones': 'sesiones', 'Recursos': 'recursos' },
  enclase: { 'Resumen': 'enclase', 'Anotar actitud': 'actitud', 'Distribución de aula': 'distribucion', 'Pizarra y herramientas': 'pizarra', 'Actividades con móviles': 'moviles' },
};
/** Botones del contenido que llevan a otra pantalla de la demo. */
const SALTOS_AULA = [
  [/^Pasar lista/, 'asistencia'], [/^Anotar actitud/, 'actitud'], [/^Anotar$/, 'actitud'], [/^Añadir nota/, 'cuaderno'],
  [/^Ver la semana/, 'agenda'], [/^Ver alumnado/, 'clases'], [/^Ajustar en el cuaderno/, 'cuaderno'],
  [/^Evaluar por rúbricas/, 'rubricas'], [/^Evaluar por dianas/, 'dianas'], [/^Evaluar por foto/, 'evalfoto'],
  [/^Agenda mensual/, 'agendames'], [/^Horario semanal/, 'agendasemana'],
  [/^Informes/, 'informes'], [/^Actas/, 'actas'], [/^Situaciones de aprendizaje/, 'situaciones'], [/^Sesiones/, 'sesiones'], [/^Recursos/, 'recursos'],
  [/^Distribución de aula/, 'distribucion'], [/^Pizarra y herramientas/, 'pizarra'], [/^Actividades con móviles/, 'moviles'],
];

/* El perfil de Educación Física: el menú de aula, con «Educación Física» después de Inicio */
const EF_HERRAMIENTAS = [
  ['En la pista', 'ef-pista'], ['Equipos', 'ef-equipos'], ['Cronómetro de circuitos', 'ef-circuitos'], ['Exentos y lesiones', 'ef-exentos'],
  ['Pruebas físicas', 'ef-pruebas'], ['Actividades', 'ef-actividades'], ['Sesiones', 'ef-sesiones'], ['Situaciones de aprendizaje', 'ef-sda'],
  ['Pizarra de circuitos', 'ef-pizarra'], ['Material e instalaciones', 'ef-material'],
];
const EF_COMPARTIDAS = [
  ['Mis Clases', 'ef-clases'], ['Agenda', 'ef-agenda'], ['Cuaderno de Notas', 'ef-cuaderno'], ['Asistencia', 'ef-asistencia'], ['Evaluar', 'ef-evaluar'],
  ['Documentos', 'ef-documentos'], ['En clase', 'ef-enclase'], ['Reuniones', 'ef-reuniones'], ['Formaciones', 'ef-formaciones'],
  ['Trabajo compartido', 'ef-compartido'], ['Configuración', 'ef-config'], ['Registro de cambios', 'ef-registro'],
];
const MENU_EF = { 'Inicio': 'ef-inicio', 'Educación Física': 'ef-portada', ...Object.fromEntries(EF_COMPARTIDAS) };
const PESTANAS_EF = {
  ef: { 'Resumen': 'ef-portada', ...Object.fromEntries(EF_HERRAMIENTAS.map(([n, id]) => [n, id])) },
  documentos: { 'Resumen': 'ef-documentos', 'Situaciones de aprendizaje': 'ef-situaciones' },
  evaluar: { 'Resumen': 'ef-evaluar' }, enclase: { 'Resumen': 'ef-enclase' },
};
const SALTOS_EF = [
  [/^Pasar lista/, 'ef-asistencia'], [/^Añadir nota/, 'ef-cuaderno'], [/^Evaluar$/, 'ef-evaluar'], [/^Observar en la pista/, 'ef-pista'],
  [/^Ver la semana/, 'ef-agenda'], [/^Ver alumnado/, 'ef-clases'], [/^Exentos y lesiones/, 'ef-exentos'], [/^Pruebas físicas/, 'ef-pruebas'],
].map(([re, id]) => [re, id]);

/* El perfil de PT y AL: su menú, sin hubs */
const PT_PANTALLAS = [
  ['Inicio', 'pt-inicio'], ['Registro diario', 'pt-registro'], ['Mi alumnado', 'pt-alumnado'], ['Agenda', 'pt-agenda'], ['Agenda visual', 'pt-agendavisual'],
  ['Recursos', 'pt-recursos'], ['Pizarra y herramientas', 'pt-pizarra'], ['Reuniones', 'pt-reuniones'], ['Formaciones', 'pt-formaciones'],
  ['Configuración', 'pt-config'], ['Registro de cambios', 'pt-cambios'],
];
const MENU_PT = Object.fromEntries(PT_PANTALLAS);
const SALTOS_PT = [[/^Registrar/, 'go:pt-registro'], [/^Ver la semana/, 'go:pt-agenda'], [/^Mi alumnado/, 'go:pt-alumnado'], [/^Programa$/, 'go:pt-alumnado']]
  .map(([re, a]) => [re, a.replace('go:', '')]);
const RUTAS_PT = { 'pt-alumnado': [[/^Alumno \d/, 'go:pt-al-resumen']] };
const EXTRA_ALUMNADO = { 'Alumnado': 'go:pt-alumnado', 'Grupos': 'go:pt-grupos' };
const EXTRA_ALUMNO = {
  'Mi alumnado': 'go:pt-alumnado', 'Resumen': 'go:pt-al-resumen', 'Programa': 'go:pt-al-programa', 'Sesiones': 'go:pt-al-sesiones',
  'Evaluación': 'go:pt-al-eval', 'Coordinaciones': 'go:pt-al-coord', 'Documentos': 'go:pt-al-docs', 'Datos': 'go:pt-al-datos', 'Agenda visual': 'go:pt-agendavisual',
  'Registrar sesión': 'go:pt-registro',
};
const EXTRA_PT = { 'pt-alumnado': EXTRA_ALUMNADO };

/** El perfil que se está capturando: a dónde lleva cada botón. Cada fase pone el suyo. */
let P = { menu: MENU_AULA, pestanas: PESTANAS_AULA, saltos: SALTOS_AULA };

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
    const cajaModal = modal ? (() => { const c = modal.querySelector('.modal, [role=dialog]') ?? modal.firstElementChild; const b = c.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; })() : null;
    // Lo que se ve de cada zona: dentro de la pantalla y, con una ventana abierta, dentro de la ventana (lo que queda
    // por encima o por debajo de lo que se desplaza dentro de ella no se ve, aunque el navegador lo dé por visible)
    const [mx0, my0, mx1, my1] = cajaModal ?? [0, 0, innerWidth, innerHeight];
    return {
      modal: cajaModal,
      hub,
      zonas: fuera.map(e => {
        const b = e.getBoundingClientRect();
        const tipo = e.classList.contains('nav-item') ? 'menu'
          : e.classList.contains('hub-tab') ? 'pestana'
          : /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) ? 'campo' : 'boton';
        // De un desplegable, lo que tiene elegido (su texto son todas las opciones, y la primera no es la que se ve)
        const texto = e.tagName === 'SELECT' ? (e.selectedOptions[0]?.textContent ?? '').replace(/^●\s*/, '') : e.innerText;
        const nombre = (e.getAttribute('aria-label') || texto || e.title || e.getAttribute('placeholder') || '')
          .split('\n').map(s => s.trim()).filter(Boolean)[0] ?? '';
        return [Math.max(0, mx0, b.left), Math.max(0, my0, b.top), Math.min(innerWidth, mx1, b.right), Math.min(innerHeight, my1, b.bottom), tipo, nombre.slice(0, 60)];
      }).filter(([x0, y0, x1, y1]) => x1 - x0 >= 6 && y1 - y0 >= 6),
    };
  });
}

/**
 * Botones que en la app piden algo a la IA (o lo rehacen con ella): en la demo avisan de que no generan nada.
 * «Corregir» (una evaluación, en el Historial), «Nueva ficha» y «Nueva actividad» no la usan: salieron de la lista el 23-11-2026.
 */
const RE_IA = /(con IA\b|^Generar|^Volver a generar|^Crear (la primera|ficha|escape|tarjetas|lectura)|^Nueva situación|^Reconocer|^Retocar|^Desde (un manual|una foto)|^Proponer|^Preparar|^Redactar|^Ajustar$|^Adaptar)/i;

/** Convierte las zonas de una pantalla en botones de la demo. */
function acciones(z, hubId, extra = {}, rutas = []) {
  return z.map(([x0, y0, x1, y1, tipo, nombre]) => {
    let act;
    if (tipo === 'menu') act = P.menu[nombre] ? `go:${P.menu[nombre]}` : `g`;
    else if (tipo === 'pestana') act = P.pestanas[hubId]?.[nombre] ? `go:${P.pestanas[hubId][nombre]}` : 'g';
    else if (extra[nombre]) act = extra[nombre];
    else if (rutas.find(([re]) => re.test(nombre))) act = rutas.find(([re]) => re.test(nombre))[1];
    else if (tipo === 'campo') act = 'i';
    else act = P.saltos.find(([re]) => re.test(nombre)) ? `go:${P.saltos.find(([re]) => re.test(nombre))[1]}` : 'g';
    // Lo que haría la IA: en la demo no se genera nada, y el aviso lo dice
    if (act === 'g' && RE_IA.test(nombre)) act = 't:ia';
    if (nombre === 'Cerrar sesión') act = 't:logout';
    if (/^Ayuda de AulaPro/.test(nombre)) act = 't:help';
    return [r(x0), r(y0), r(x1), r(y1), act, nombre];
  });
}

const fuera = (zs, cajas) => zs.filter(([x0, y0, x1, y1]) => !cajas.some(([a, b, c, d]) => x0 >= a - 2 && y0 >= b - 2 && x1 <= c + 2 && y1 <= d + 2));

/* ── La sesión ───────────────────────────────────────────────────────── */
const FASES = (process.env.FASES || 'aula,ef,apoyo,nuevas').split(',');
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ctx, page;
const CLAVE_AI = 'clave-de-ejemplo-no-valida';   // Solo para que la app no pida la clave: no se conecta a nada

/** Crea el perfil de ejemplo del tipo, le suma un ejemplo de cada cosa que crea la IA y lo deja abierto. */
async function abrirPerfil(tipo) {
  if (ctx) await ctx.close();
  ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'es-ES' });
  page = await ctx.newPage();
  page.on('pageerror', e => console.log('Error en la app:', e.message));
  // Cerrar una ventana con algo a medias pregunta antes («¿Salir sin guardar?»): en las capturas, sí
  page.on('dialog', d => d.accept().catch(() => {}));
  // Sin cursor parpadeando ni avisos pasajeros (el de «Deshacer» dura diez segundos). En cada carga de la página, porque
  // el guion la recarga varias veces (al sumar los ejemplos y al disponer la pizarra)
  await ctx.addInitScript(() => {
    const poner = () => {
      const st = document.createElement('style');
      st.textContent = '*{caret-color:transparent!important} .toast,.toast-wrap,.deshacer{display:none!important}';
      document.head.append(st);
    };
    if (document.head) poner(); else document.addEventListener('DOMContentLoaded', poner);
  });
  await ctx.clock.install({ time: new Date('2026-10-14T09:45:00') });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2000);
  if (tipo === 'ef') await page.getByRole('radio', { name: /Educación Física/ }).click();
  if (tipo === 'apoyo') await page.getByRole('radio', { name: /PT y AL/ }).click();
  await page.getByText('Explorar con datos de ejemplo').click();
  await page.waitForTimeout(4500);

  // Lo que la app guardó para el perfil, y lo que se le suma
  const { id, data } = await page.evaluate(() => {
    const id = localStorage.getItem('aulapro_active_profile');
    return { id, data: JSON.parse(localStorage.getItem('aulapro_web_data_' + id) || '{}') };
  });
  const clase = n => data.classes.find(c => c.name.startsWith(n)) ?? data.classes[0];
  let patch = {}, borradores = {};
  if (tipo === 'aula') {
    patch = { ...ejemplosAula({ clases: data.classes, alumnos: data.students }) };
    const fa = fichasAula({ clases: data.classes });
    // Las fichas, con sus ejercicios completados por la propia app (`prepareExercise`); la de ejercicios es una de las que la app enseña a la IA como modelo
    patch.fichas = await page.evaluate(async ({ fa, p5 }) => {
      const rs = await import('/src/services/resources.ts');
      const fe = await import('/src/services/fichaEjemplos.ts');
      const prep = f => { f.content.actividades.forEach(a => { a.ejercicios = a.ejercicios.map(x => rs.prepareExercise(x)); }); return f; };
      const agua = JSON.parse(JSON.stringify(fe.EJEMPLOS_FICHA.agua));
      agua.estilo = 'cuaderno'; agua.hilo = 'agua';
      const f1 = { id: 'ej-fic1', at: '2026-10-12T10:30:00.000Z', date: '2026-10-12', class_id: p5.id, class_name: p5.name, title: agua.titulo,
        request: { tema: 'El ciclo del agua', area: 'Conocimiento del Medio', nivel: '5º de Primaria', numEjercicios: 6, niveles: false, contextoClase: '' }, content: agua };
      return [f1, prep(fa.lectura), prep(fa.escape), prep(fa.tarjetas)];
    }, { fa, p5: clase('5º Primaria A') });
    // Las tarjetas interactivas y las sesiones con imágenes (2.14 a 2.21): las imágenes salen del catálogo, ya reducidas y en JPEG como las guarda la app
    const jpeg = async (id, pie) => {
      const im = sharp(path.join(RAIZ, 'public/ilustraciones', id + '.webp')).flatten({ background: '#ffffff' }).resize(640, 420, { fit: 'contain', background: '#ffffff' });
      const b = await im.jpeg({ quality: 82 }).toBuffer();
      return { src: 'data:image/jpeg;base64,' + b.toString('base64'), ancho: 640, alto: 420, pie };
    };
    const nuevas = nuevasAula({ clases: data.classes, sdaId: patch.learningSituations[0].id, imagenes: [await jpeg('com-naranja', 'Un puesto con fruta de temporada'), await jpeg('obj-cofre', 'La caja de cada equipo')] });
    patch.fichas.unshift(nuevas.interactivas);   // la primera: así sale en la primera fila de la biblioteca y la demo puede llevar a ella
    patch.ef = { ...(data.ef ?? {}), sesiones: nuevas.sesiones };
    const c5 = clase('5º Primaria A');
    const alumno = data.students.find(a => a.class_id === c5.id);
    const categoria = data.gradeCategories.find(c => c.class_id === c5.id);
    borradores['evaluacion-foto'] = borradorEvalFoto({ clase: c5, alumno, categoriaId: categoria?.id ?? '' });
  } else if (tipo === 'ef') {
    const referencias = await page.evaluate(async () => (await import('/src/lib/modelosEF.ts')).referenciasDeModelos(['aprendizaje-cooperativo']));
    const e = ejemplosEF({ referencias });
    patch = { learningSituations: e.learningSituations, workSessions: reunionYFormacion(), ef: { ...data.ef, pizarras: e.pizarras } };
  } else {
    const titulos = await page.evaluate(async alumno => {
      const { tituloDe } = await import('/src/services/apoyoDocumentos.ts');
      const { translate } = await import('/src/i18n/core.ts');
      const t = (s, v) => translate('es', s, v);
      return { familia: tituloDe('familia', alumno, 1, t), programacion: tituloDe('programacion', alumno, undefined, t) };
    }, data.apoyo.alumnos[0]);
    const fichas = await page.evaluate(async () => {
      const fe = await import('/src/services/fichaEjemplos.ts');
      const c = JSON.parse(JSON.stringify(fe.EJEMPLOS_FICHA.sumas));
      c.estilo = 'cuaderno'; c.variante = 'apoyo';
      return [{ id: 'ej-fic-ap1', at: '2026-10-09T10:30:00.000Z', date: '2026-10-09', title: c.titulo,
        request: { tema: 'Sumas y restas hasta 100', area: 'Matemáticas', nivel: '2º de Primaria', numEjercicios: 6, niveles: false, contextoClase: '' }, content: c }];
    });
    patch = { apoyo: { ...data.apoyo, ...ejemplosApoyo({ titulos }) }, workSessions: reunionYFormacion(), fichas };
  }
  if (tipo === 'aula') patch.workSessions = reunionYFormacion();
  await page.evaluate(({ id, patch, borradores, clave }) => {
    const k = 'aulapro_web_data_' + id;
    localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k)), ...patch }));
    for (const [tipo, b] of Object.entries(borradores)) localStorage.setItem(`aulapro_borrador_${id}_${tipo}`, JSON.stringify(b));
    localStorage.setItem('aulapro_gemini_key', clave);
  }, { id, patch, borradores, clave: CLAVE_AI });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
}

const menu = async nombre => { await page.locator('.sidebar .nav-item', { hasText: new RegExp(`^${nombre}$`) }).click(); await page.waitForTimeout(1300); };
const pestana = async nombre => { await page.locator('.hub-tab', { hasText: new RegExp(`^${nombre}$`) }).click(); await page.waitForTimeout(1300); };
const cerrarModal = async () => { await page.locator('.modal-overlay.open').last().getByRole('button', { name: 'Cerrar' }).first().click(); await page.waitForTimeout(500); };
/**
 * Pulsa algo que abre una ventana y espera a que esté abierta. Si no se abre (pasó una vez con el acta de una reunión,
 * sin causa aparente), vuelve a pulsar; a la tercera, el guion se para aquí y no con una captura equivocada.
 */
async function abrirVentana(loc) {
  for (let intento = 1; ; intento++) {
    await loc.click();
    const abierta = await page.locator('.modal-overlay.open').first().waitFor({ timeout: 4000 }).then(() => true, () => false);
    if (abierta) break;
    if (intento === 3) throw new Error('No se ha abierto la ventana tras pulsar ' + loc);
    console.log('  (la ventana no se abrió: se vuelve a pulsar)');
  }
  await page.mouse.move(5, 5);   // el ratón se queda donde estaba el botón, ahora encima de algo de la ventana
  await page.waitForTimeout(1200);
}
const arriba = () => page.evaluate(() => window.scrollTo(0, 0));
const foto = async (opts = {}, y = 0) => { await arriba(); if (y) await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(350); return page.screenshot(opts); };
/**
 * «Evaluar a la clase» (la ventana de la rúbrica y la de la diana): dónde están la lista del alumnado, la cuenta, a quién
 * se evalúa y el pie. La demo los vuelve a dibujar encima para que la lista y «Guardar y siguiente» respondan.
 */
const datosDeClase = () => page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.modal-overlay.open')].pop();
  const caja = el => { const x = el.getBoundingClientRect(); return [Math.round(x.left), Math.round(x.top), Math.round(x.right), Math.round(x.bottom)]; };
  const cuenta = dlg.querySelector('.evc-cuenta');
  return {
    filas: [...dlg.querySelectorAll('.evc-al')].map(b => ({ caja: caja(b), nombre: b.querySelector('.evc-nombre').textContent, antes: b.querySelector('.evc-dato')?.textContent ?? '' })),
    cuenta: caja(cuenta),
    // «evaluados hoy» si la clase ya se evaluó otro día con este instrumento, «evaluados» si es la primera vez
    hoy: cuenta.querySelector('span').textContent.replace(/^\d+ de \d+\s*/, '').trim(),
    barra: caja(dlg.querySelector('.evc-barra')),
    quien: caja(dlg.querySelector('.evc-quien')),
    aviso: caja(dlg.querySelector('.evc-quien .evc-aviso') ?? dlg.querySelector('.evc-quien')),
    pie: caja(dlg.querySelector('.evc-pie-btns')),
    dato: caja(dlg.querySelector('.evc-pie-dato')),
  };
});
/** Esconde (o vuelve a enseñar) lo que la demo dibuja de nuevo en «Evaluar a la clase»; se ocultan, no se quitan: así no se mueve nada. */
const ocultarDeClase = oculto => page.evaluate(oculto => {
  const dlg = [...document.querySelectorAll('.modal-overlay.open')].pop();
  const piezas = [...dlg.querySelectorAll('.evc-al, .evc-cuenta > *, .evc-quien, .evc-pie-btns, .evc-pie-dato .score-pill, .evc-pie-dato .score-pill + span')];
  for (const el of piezas) el.style.visibility = oculto ? 'hidden' : '';
}, oculto);
/**
 * La ventana de «Evaluar a la clase» para la demo: la captura completa (la que se amplía) y la base, sin lo que la demo
 * vuelve a dibujar. `quitar` son las zonas que la demo pone por su cuenta (las celdas de la rúbrica, la diana).
 */
async function ventanaDeClase(id, titulo, quitar, datos) {
  await guardar(`assets/demo/${id}.webp`, await foto());
  await ocultarDeClase(true);
  await pantalla(id, titulo, 'evaluar', {
    archivo: `${id}-base`, quitar, extra: { 'Cerrar': 'fn:closeModal' }, rutas: [[/^Poner a todos el nivel/, 't:todos']],
    datos: { ...datos, back: id === 'rubrica' ? 'rubricas' : 'dianas' },
  });
  PANTALLAS[id].base = PANTALLAS[id].img;
  PANTALLAS[id].img = `${id}.webp`;
  await ocultarDeClase(false);
}
/**
 * La ventana abierta, en ancho de tableta (la lista del alumnado pasa arriba), para la portada. Devuelve su tamaño.
 * Con `hasta` (un selector de dentro de la ventana) se corta por debajo de esa pieza: la diana va en una tarjeta sobre otra
 * captura y, entera, la tapaba.
 */
async function ventanaEstrecha(archivo, hasta) {
  await page.setViewportSize({ width: 880, height: 1300 });
  await page.evaluate(() => { document.querySelector('.help-fab').style.visibility = 'hidden'; });
  await page.mouse.move(5, 5);
  await page.waitForTimeout(700);
  // (la captura de la página, recortada a la ventana: la de un solo elemento se queda esperando con el reloj parado)
  const [left, top, width, height] = await page.evaluate(hasta => {
    const m = [...document.querySelectorAll('.modal-overlay.open .modal')].pop();
    const b = m.getBoundingClientRect();
    const fin = hasta ? m.querySelector(hasta).getBoundingClientRect().bottom + 22 : b.bottom;
    return [b.left, b.top, b.width, fin - b.top].map(Math.round);
  }, hasta);
  fs.writeFileSync(path.join(SITIO, archivo), await webp(await sharp(await page.screenshot()).extract({ left, top, width, height }).toBuffer()));
  await page.evaluate(() => { document.querySelector('.help-fab').style.visibility = ''; });
  await page.setViewportSize({ width: W, height: H });
  await page.waitForTimeout(600);
  return [width, height];
}
const caja = async loc => { const b = await loc.boundingBox(); return [r(b.x), r(b.y), r(b.x + b.width), r(b.y + b.height)]; };

const PANTALLAS = {};
const MARCAS = {};

/** Captura una pantalla entera para la demo, con sus zonas. */
async function pantalla(id, titulo, hubId, opts = {}) {
  const buf = await foto({}, opts.scroll ?? 0);   // `scroll`: píxeles que se baja la página, para enseñar lo que queda debajo
  const img = await guardar(`assets/demo/${opts.archivo ?? id}.webp`, buf);
  const z = await zonas(page);
  // Con la página bajada, lo que ha quedado debajo de la barra de pestañas (que se queda fija arriba) no se puede pulsar
  if (opts.scroll) z.zonas = z.zonas.filter(([, y0, , , tipo]) => tipo === 'menu' || tipo === 'pestana' || y0 >= BARRA);
  let spots = acciones(z.zonas, hubId, opts.extra, opts.rutas);
  if (opts.quitar) spots = fuera(spots, opts.quitar);
  // Zonas que no son un botón de la app (lo que asoma de una lista y lleva a ella): debajo de las demás, que mandan
  if (opts.mas) spots.unshift(...opts.mas);
  PANTALLAS[id] = { title: titulo, img: path.basename(img), spots, ...(z.modal ? { modal: z.modal.map(r) } : {}), ...(opts.datos ?? {}) };
  console.log(`· ${id}: ${spots.length} zonas`);
  return buf;
}

/* ══ Docente de aula ══════════════════════════════════════════════════ */
if (FASES.includes('aula')) {
await abrirPerfil('aula');
P = { menu: MENU_AULA, pestanas: PESTANAS_AULA, saltos: SALTOS_AULA };

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
// La Agenda se abre en su portada de dos tarjetas; las pestañas Resumen, Mensual y Semanal son botones de la propia pantalla
const AGENDA = { 'Resumen': 'go:agenda', 'Mensual': 'go:agendames', 'Semanal': 'go:agendasemana', 'Agenda mensual': 'go:agendames', 'Horario semanal': 'go:agendasemana' };
await menu('Agenda');
await pantalla('agenda', 'Agenda', null, { extra: AGENDA });
await page.getByRole('tab', { name: 'Mensual', exact: true }).click();
await page.waitForTimeout(900);
await pantalla('agendames', 'Agenda mensual', null, { extra: AGENDA });
await page.getByRole('tab', { name: 'Semanal', exact: true }).click();
await page.waitForTimeout(900);
await pantalla('agendasemana', 'Horario semanal', null, { extra: AGENDA });
await menu('Cuaderno de Notas');
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
await pantalla('rubricas', 'Rúbricas', 'evaluar', { extra: { 'Evaluar a la clase': 'go:rubrica' } });

// «Evaluar a la clase» con una rúbrica: la clase de ahora, su alumnado en la lista y nada marcado
await abrirVentana(page.locator('main').getByRole('button', { name: 'Evaluar a la clase' }).first());
{
  const dlg = page.locator('.modal-overlay.open').last();
  const clase = await datosDeClase();
  const { celdas, total } = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.modal-overlay.open')].pop();
    const caja = el => { const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
    const celdas = [...dlg.querySelectorAll('table tbody tr')].map(tr => [...tr.querySelectorAll('td')].slice(1).map(caja)).filter(f => f.length);
    // La puntuación del pie: la pastilla «0 / 12» y el porcentaje, que la demo vuelve a escribir
    const pastilla = dlg.querySelector('.evc-pie-dato .score-pill'), pct = pastilla.nextElementSibling;
    const [x0, y0, , y1] = caja(pastilla);
    return { celdas, total: { caja: [x0, y0, caja(pct)[2], y1], max: +pastilla.textContent.split('/')[1] } };
  });
  await ventanaDeClase('rubrica', 'Evaluar a la clase con una rúbrica', celdas.flat(), { rubrica: celdas, total, clase });
  // Para la portada, a mitad de evaluar: el primero de la lista ya guardado y, en el segundo, dos niveles marcados.
  // (Esa evaluación se queda en los datos de ejemplo de esta pasada: sale en el Historial, como en la app.)
  const filas = dlg.locator('table tbody tr');
  for (const [fila, nivel] of [[0, 3], [1, 4], [2, 3]]) await filas.nth(fila).locator('td').nth(nivel).click();
  await dlg.getByRole('button', { name: 'Guardar y siguiente' }).click();
  await page.waitForTimeout(500);
  for (const [fila, nivel] of [[0, 4], [1, 3]]) await filas.nth(fila).locator('td').nth(nivel).click();
  MARCAS.rubrica = { size: await ventanaEstrecha('assets/app/rubrica.webp') };
  await cerrarModal();
}

await pestana('Dianas');
await pantalla('dianas', 'Dianas', 'evaluar', { extra: { 'Evaluar a la clase': 'go:dianaeval' } });
await abrirVentana(page.locator('main').getByRole('button', { name: 'Evaluar a la clase' }).first());
{
  const dlg = page.locator('.modal-overlay.open').filter({ has: page.locator('svg[aria-label="Diana de evaluación"]') }).last();
  const clase = await datosDeClase();
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
  await ventanaDeClase('dianaeval', 'Evaluar a la clase con una diana', [diana.svg], { diana, clase });
  // Rellena para la captura de la portada: un nivel por ítem
  const niveles = [4, 3, 3, 2, 4, 3];
  const n = diana.items.length;
  for (let i = 0; i < n; i++) {
    const titulo = `${diana.items[i].name} — ${['Insuficiente', 'Suficiente', 'Bien', 'Excelente'][niveles[i % niveles.length] - 1]}`;
    await dlg.locator('path').filter({ has: page.locator(`title:text-is("${titulo}")`) }).first().click({ force: true });
    await page.waitForTimeout(150);
  }
  MARCAS.dianaNota = { size: await ventanaEstrecha('assets/app/diana-nota.webp', '.evc-diana-zona') };
  await cerrarModal();
}

// «Por foto» está apagada desde el 3-11-2026 (`CORRECCION_CON_IA`): ya no hay pestaña ni captura.

await pestana('Diana competencial');
{
  // Con un alumno elegido, para que se vea su perfil (la clase es la de ahora)
  const sel = page.locator('main select');
  const alumnos = await sel.nth(1).locator('option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
  await sel.nth(1).selectOption(alumnos[1] ?? alumnos[0]);
  await page.waitForTimeout(900);
}
const dc = await pantalla('diana', 'Diana competencial', 'evaluar');
fs.writeFileSync(path.join(SITIO, 'assets/app/diana-competencial.webp'), await webp(dc));
MARCAS.dianaCompetencial = await page.evaluate(() => {
  const b = [...document.querySelectorAll('main button')].find(e => /Redactar descriptores con IA/.test(e.textContent) && e.checkVisibility());
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
{
  // Los informes de seguimiento de toda la clase, que la app compone al instante y sin IA, creados de una vez; a la vista,
  // el de un alumno que tiene de todo: calificaciones, competencias, «Lo positivo» y «A mejorar»
  await page.locator('main').getByRole('button', { name: 'Informes de seguimiento de la clase' }).click();
  await page.waitForTimeout(1500);
  await page.locator('main').getByRole('button', { name: /Alumno 52$/ }).first().click();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(900);
  await pantalla('informes', 'Informes', 'documentos');
}
await pestana('Actas');
await pantalla('actas', 'Actas', 'documentos');
await pestana('Situaciones de aprendizaje');
await pantalla('situaciones', 'Situaciones de aprendizaje', 'documentos', { rutas: [[/^SdA \d/, 'go:sda'], [/Un mercado sostenible/, 'go:sda']] });
await page.getByText('Un mercado sostenible en el patio').first().click();
await page.waitForTimeout(1500);
await pantalla('sda', 'Situación de aprendizaje', 'documentos', { extra: { 'Mis situaciones de aprendizaje': 'go:situaciones' } });
await menu('Documentos');
await pestana('Recursos');
{
  // Con la quinta tarjeta («Al instante»), las fichas guardadas quedan debajo de lo que se ve: lo que asoma de «Mis fichas»
  // lleva a la misma pantalla bajada hasta ellas, y desde ahí se abre cada una
  const FICHAS = [[/El viaje del agua/, 'go:ficha'], [/El drag/, 'go:lectura'], [/Tarjetas interactivas/, 'go:tarjetas-panel'], [/^Nueva ficha$/, 'go:recursos']];
  const titulo = page.locator('main .card-ttl', { hasText: /^Mis fichas$/ }).first();
  await arriba();
  const b = await titulo.boundingBox();
  const asoma = b && b.y < H - 24 ? [[SB + 24, r(b.y - 14), W - 24, H, 'go:recursos-fichas', 'Mis fichas']] : [];
  await pantalla('recursos', 'Recursos', 'documentos', { rutas: FICHAS, mas: asoma });
  const baja = b ? Math.max(0, r(b.y - 90)) : 0;
  await pantalla('recursos-fichas', 'Recursos: mis fichas', 'documentos', { scroll: baja, rutas: FICHAS });
}
// Al tocar una ficha guardada sale su panel («Proyectar» y «Editar»): la ficha se abre con «Editar»
const abrirFicha = async titulo => {
  await page.getByText(titulo).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Editar', exact: true }).first().click();
  await page.waitForTimeout(1800);
};
await abrirFicha('El viaje del agua');
await pantalla('ficha', 'Ficha de ejercicios', 'documentos', { extra: { 'Mis fichas': 'go:recursos' } });
await menu('Documentos');
await pestana('Recursos');
await abrirFicha('El dragón que perdió su fuego');
await pantalla('lectura', 'Comprensión lectora', 'documentos', { extra: { 'Mis fichas': 'go:recursos' } });

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
  // Desde el 20-11-2026 la Distribución usa el selector de clase común y abre la clase de ahora
  const sentar = page.getByRole('button', { name: 'Sentar por orden de lista' }).first();
  if (await sentar.isVisible()) { await sentar.click(); await page.waitForTimeout(600); }
  await pantalla('distribucion', 'Distribución de aula', 'enclase');
}

await pestana('Pizarra y herramientas');
{
  // Cada ventana tiene su sitio con aire alrededor: ni se tocan entre sí, ni las tapa la barra de arriba, ni la
  // paleta del lápiz (que sale debajo de ella mientras se dibuja), ni el dock de abajo. En la app las ventanas
  // se abren juntas, arriba a la izquierda, y con el lápiz activado la paleta tapa a la calculadora; por eso, para
  // las capturas, se reparten por la pizarra.
  const area = await page.evaluate(() => {
    const girar = [...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'GIRAR');
    let el = girar;
    while (el && !(el.classList.contains('relative') && el.classList.contains('overflow-hidden'))) el = el.parentElement;
    const b = el.getBoundingClientRect();
    return { width: Math.round(b.width), height: Math.round(b.height) };
  });
  const TAM = { timer: [290, 350], wheel: [290, 340], calc: [270, 380] };   // lo que mide cada una al abrirse
  const ventana = (tipo, x, y) => ({ id: tipo, tipo, rect: { x: r(x), y: r(y), width: TAM[tipo][0], height: TAM[tipo][1] } });
  // La pizarra lee dónde estaban las ventanas al montarse. Desde el 19-11-2026 sigue montada al cambiar de
  // pantalla, así que salir y volver a entrar ya no basta: se recarga la app con la disposición hecha
  const disponer = async ventanas => {
    await page.evaluate(v => localStorage.setItem('aulapro_pizarra_actual', JSON.stringify(v)), ventanas);
    await page.reload();
    await page.locator('.sidebar .nav-item').first().waitFor();
    await page.waitForTimeout(1500);
    await menu('En clase');
    await pestana('Pizarra y herramientas');
    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);
  };

  // Para la portada: temporizador y ruleta con aire, a la izquierda (a la derecha la tapa la captura de Anotar actitud)
  await disponer([ventana('timer', area.width * 0.17, 130), ventana('wheel', area.width * 0.47, 130)]);
  const limpia = await foto();
  fs.writeFileSync(path.join(SITIO, 'assets/app/pizarra.webp'), await webp(await sharp(limpia).extract({ left: SB, top: 0, width: W - SB, height: H }).toBuffer()));

  // Para la demo: los tres en fila, centrados en la franja que dejan la barra de arriba con la paleta y el dock, y el lápiz activado
  const ARRIBA = 170, ABAJO = 110;
  const mitad = (area.height - ARRIBA - ABAJO) / 2 + ARRIBA;
  await disponer(['timer', 'wheel', 'calc'].map((tipo, i) => ventana(tipo, area.width * (2 * i + 1) / 6 - TAM[tipo][0] / 2, mitad - TAM[tipo][1] / 2)));
  await page.getByRole('button', { name: /^Dibujar sobre la pantalla/ }).click();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(500);

  // La captura completa, tal cual la ve el docente: es la que se amplía en la demo
  await guardar('assets/demo/pizarra.webp', await foto());

  // Dónde está cada cosa. La demo vuelve a dibujar lo que cambia al usarlo (anillo y cifras del temporizador, la
  // ruleta, la pantalla de la calculadora y la paleta del lápiz) con las mismas medidas, y para eso necesita la
  // captura sin ellos: sobre la misma pizarra, sin parches.
  const live = await page.evaluate(() => {
    const caja = el => { const x = el.getBoundingClientRect(); return [Math.round(x.left), Math.round(x.top), Math.round(x.right), Math.round(x.bottom)]; };
    const botones = raiz => [...raiz.querySelectorAll('button')].filter(b => b.checkVisibility());
    const btn = t => botones(document.querySelector('main')).find(b => b.getAttribute('aria-label') === t || b.title === t || b.textContent.trim() === t);
    const ventanas = [...document.querySelectorAll('main .pz-ventana')];
    const con = f => ventanas.find(v => botones(v).some(f));
    const marco = v => v.closest('.react-draggable') ?? v;
    const vTimer = con(b => b.textContent.trim() === 'Iniciar');
    const vRuleta = con(b => b.textContent.trim() === 'GIRAR');
    const vCalc = con(b => b.style.minHeight === '34px');

    // Ruleta
    const girar = btn('GIRAR');
    const discoCaja = girar.parentElement;                      // el cuadrado de 250 px con disco, aguja y botón
    const disco = discoCaja.querySelector('svg').parentElement;
    const resultado = [...vRuleta.querySelectorAll('div')].find(d => d.classList.contains('w-full') && d.classList.contains('text-center'));
    // Temporizador
    const anillo = [...vTimer.querySelectorAll('svg')].find(s => s.classList.contains('-rotate-90'));
    const cifras = botones(vTimer).find(b => /^\d\d:\d\d$/.test(b.textContent.trim()));
    const fichas = btn('30 s').parentElement;
    // Calculadora
    const teclas = botones(vCalc).filter(b => b.style.minHeight === '34px')
      .map(b => [...caja(b), b.textContent.trim().replace(/\s+/g, '') || '⌫']);
    const pantalla = vCalc.querySelector('div.rounded-2xl.flex-col');
    // Paleta del lápiz
    const paleta = btn('Borrar todo').closest('[role=toolbar]');
    const grupo = n => paleta.querySelector(`[role=group][aria-label="${n}"]`);
    const nombre = b => b.getAttribute('aria-label');
    const barra = btn('Dejar de dibujar').parentElement;
    const dock = btn('Añadir Temporizador').parentElement.parentElement;

    const datos = {
      barra: caja(barra),
      lapizSuperior: caja(btn('Dejar de dibujar')),
      temporizador: {
        anillo: caja(anillo), cifras: caja(cifras),
        fichas: botones(fichas).map(b => [...caja(b), b.textContent.trim()]),
        menos: caja(btn('Un minuto menos')), mas: caja(btn('Un minuto más')),
        iniciar: caja(btn('Iniciar')), reiniciar: caja(btn('Reiniciar')),
      },
      ruleta: { ventana: caja(marco(vRuleta)), disco: caja(disco), centro: caja(girar), resultado: caja(resultado), nombres: [...disco.querySelectorAll('text')].map(t => t.textContent) },
      calculadora: { pantalla: caja(pantalla), teclas },
      paleta: {
        caja: caja(paleta),
        herramientas: botones(grupo('Herramienta')).map(b => [...caja(b), nombre(b)]),
        grosores: botones(grupo('Grosor')).map(b => [...caja(b), nombre(b), Math.round(b.firstElementChild.getBoundingClientRect().width)]),
        colores: botones(grupo('Color')).map(b => [...caja(b), getComputedStyle(b).backgroundColor]),
        separadores: [...paleta.querySelectorAll(':scope > span[aria-hidden]')].map(caja),
        deshacer: caja(btn('Deshacer')), rehacer: caja(btn('Rehacer')), borrar: caja(btn('Borrar todo')),
      },
    };
    datos.bloques = [datos.barra, caja(dock), datos.paleta.caja, ...ventanas.map(v => caja(marco(v))), caja(document.querySelector('.help-fab'))];
    return datos;
  });

  // Se esconde lo que la demo vuelve a dibujar (se ocultan, no se quitan: así no se mueve nada de sitio)
  await page.evaluate(() => {
    const botones = raiz => [...raiz.querySelectorAll('button')];
    const ocultar = el => { if (el) el.style.visibility = 'hidden'; };
    const ventanas = [...document.querySelectorAll('main .pz-ventana')];
    const con = f => ventanas.find(v => botones(v).some(f));
    const vTimer = con(b => b.textContent.trim() === 'Iniciar');
    const vRuleta = con(b => b.textContent.trim() === 'GIRAR');
    const vCalc = con(b => b.style.minHeight === '34px');
    botones(vTimer).filter(b => b.textContent.trim() === 'Iniciar').forEach(ocultar);
    ocultar([...vTimer.querySelectorAll('svg')].find(s => s.classList.contains('-rotate-90')).parentElement);
    ocultar(botones(vTimer).find(b => b.textContent.trim() === '30 s').parentElement);
    ocultar(botones(vRuleta).find(b => b.textContent.trim() === 'GIRAR').parentElement);
    ocultar([...vRuleta.querySelectorAll('div')].find(d => d.classList.contains('w-full') && d.classList.contains('text-center')));
    [...vCalc.querySelector('div.rounded-2xl.flex-col').children].forEach(ocultar);
    ocultar(document.querySelector('main [role=toolbar]'));
  });
  await page.waitForTimeout(300);
  await pantalla('pizarra', 'Pizarra y herramientas', 'enclase', { archivo: 'pizarra-base', quitar: live.bloques.slice(3, -1), datos: { live } });
  // La pantalla se muestra con la base vacía y se amplía con la captura completa
  PANTALLAS.pizarra.base = PANTALLAS.pizarra.img;
  PANTALLAS.pizarra.img = 'pizarra.webp';
  // Las zonas de la barra y el dock sí se quedan, menos el lápiz de arriba, que lo hace la demo
  PANTALLAS.pizarra.spots = PANTALLAS.pizarra.spots.filter(s => !/^(Dejar de dibujar|Dibujar sobre la pantalla)$/.test(s[5]));
}

/* Centro y equipo, y lo de abajo */
await menu('Reuniones');
await pantalla('reuniones', 'Reuniones', null, { rutas: [[/^Reunión de ciclo/, 'go:reunion']] });
await abrirVentana(page.getByText('Reunión de ciclo').first());
await pantalla('reunion', 'Acta de reunión', null, { extra: { 'Cerrar': 'fn:closeModal' }, datos: { back: 'reuniones' } });
await cerrarModal();
await menu('Formaciones');
await pantalla('formaciones', 'Formaciones', null, { rutas: [[/^Curso: evaluaci/, 'go:formacion']] });
await abrirVentana(page.getByText('Curso: evaluación competencial').first());
await pantalla('formacion', 'Resumen de formación', null, { extra: { 'Cerrar': 'fn:closeModal' }, datos: { back: 'formaciones' } });
await cerrarModal();
await menu('Trabajo compartido');
await pantalla('compartido', 'Trabajo compartido');
await menu('Configuración');
await pantalla('config', 'Configuración');
await menu('Registro de cambios');
await pantalla('registro', 'Registro de cambios');

/* Actividades con móviles, la última: se hace pasar por la versión web (la única que se publica desde el 29-10-2026), que
   enseña «Próximamente en la versión web». Hasta el 5-11-2026 se hacía pasar por la app instalada y enseñaba la sala, que en la
   web no existe: la demo prometía algo que no hay (auditoría de textos del 5-11-2026, `CLAUDE.md`). */
await page.evaluate(() => { window.electronAPI = { ...(window.electronAPI ?? {}), platform: 'web' }; });
await menu('En clase');
await pestana('Actividades con móviles');
await pantalla('moviles', 'Actividades con móviles', 'enclase', { extra: { 'Abrir sala': 't:room' } });

}

/* ══ Educación Física ═════════════════════════════════════════════════ */
if (FASES.includes('ef')) {
await abrirPerfil('ef');
P = { menu: MENU_EF, pestanas: PESTANAS_EF, saltos: SALTOS_EF };
const herramienta = n => page.locator('main').getByRole('button', { name: new RegExp(`^${n}`) }).first().click();
const cerrarSiHayModal = async () => { if (await page.locator('.modal-overlay.open').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(600); } if (await page.locator('.modal-overlay.open').count()) await cerrarModal(); };
const vuelta = async () => { await cerrarSiHayModal(); await menu('Educación Física'); };   // entrar en el apartado abre siempre su portada

await menu('Inicio');
await pantalla('ef-inicio', 'Inicio');
await menu('Educación Física');
await pantalla('ef-portada', 'Educación Física', 'ef', { rutas: EF_HERRAMIENTAS.map(([n, id]) => [new RegExp(`^${n}$`), `go:${id}`]) });
// Lo que cada lista abre: la sesión, la situación de aprendizaje y la actividad que creó la IA
const RUTAS_EF = {
  'ef-actividades': [[/^Deportes/, 'go:ef-deportes']],
  'ef-sesiones': [[/^Abrir las sesiones de 1º ESO A/, 'go:ef-sesiones-clase']],
  'ef-sda': [[/^SdA \d/, 'go:ef-sda-doc'], [/Juegos cooperativos/, 'go:ef-sda-doc']],
};
for (const [nombre, id] of EF_HERRAMIENTAS) {
  await vuelta();
  await herramienta(nombre);
  await page.waitForTimeout(900);
  // La pizarra se abre con el circuito guardado a la vista
  if (id === 'ef-pizarra') { await page.getByRole('button', { name: 'Circuito de agilidad' }).first().click(); await page.waitForTimeout(900); }
  await pantalla(id, nombre, 'ef', { rutas: RUTAS_EF[id] });
}
await vuelta();
await herramienta('Actividades');
await page.getByText('Deportes', { exact: true }).first().click();
await page.waitForTimeout(1200);
await pantalla('ef-deportes', 'Actividades: deportes', 'ef', { extra: { 'Todas las actividades': 'go:ef-actividades' } });
await vuelta();
await herramienta('Sesiones');
// Sesiones se abre en la portada de clases: dentro de la clase están sus sesiones («Poner fechas», «Dar la clase») y, al tocar una, su editor
await page.getByRole('button', { name: 'Abrir las sesiones de 1º ESO A' }).click();
await page.waitForTimeout(1200);
await pantalla('ef-sesiones-clase', 'Sesiones de una clase', 'ef', { extra: { 'Sesiones': 'go:ef-sesiones' }, rutas: [[/^Voleibol/, 'go:ef-sesion']] });
await abrirVentana(page.getByText('Voleibol: el toque de dedos').first());
await pantalla('ef-sesion', 'Sesión de Educación Física', 'ef', { extra: { 'Cerrar': 'fn:closeModal', 'Cancelar': 'fn:closeModal', 'Guardar': 'fn:closeModal' }, datos: { back: 'ef-sesiones-clase' } });
await vuelta();
await herramienta('Situaciones de aprendizaje');
await page.getByText('Juegos cooperativos: la isla del tesoro').first().click();
await page.waitForTimeout(1500);
await pantalla('ef-sda-doc', 'Situación de aprendizaje de Educación Física', 'ef', { extra: { 'Mis situaciones de aprendizaje': 'go:ef-sda' } });
for (const [nombre, id] of EF_COMPARTIDAS) {
  await menu(nombre);
  await pantalla(id, nombre, ({ 'Evaluar': 'evaluar', 'Documentos': 'documentos', 'En clase': 'enclase' })[nombre]);
}
await menu('Documentos');
await pestana('Situaciones de aprendizaje');
await pantalla('ef-situaciones', 'Situaciones de aprendizaje', 'documentos', { rutas: [[/^SdA \d/, 'go:ef-sda-doc'], [/Juegos cooperativos/, 'go:ef-sda-doc']] });
}

/* ══ PT y AL ══════════════════════════════════════════════════════════ */
if (FASES.includes('apoyo')) {
await abrirPerfil('apoyo');
P = { menu: MENU_PT, pestanas: {}, saltos: SALTOS_PT };
const tabPT = n => page.locator('main').getByRole('tab', { name: new RegExp(`^${n}`) }).first().click();

for (const [nombre, id] of PT_PANTALLAS) {
  // La pizarra, con sus ventanas repartidas (la app las abre juntas, arriba a la izquierda)
  if (id === 'pt-pizarra') {
    const v = (tipo, x, w, h) => ({ id: tipo, tipo, rect: { x: r(x), y: 130, width: w, height: h } });
    await page.evaluate(vs => localStorage.setItem('aulapro_pizarra_actual', JSON.stringify(vs)), [v('timer', 1664 * 0.17, 290, 350), v('wheel', 1664 * 0.47, 290, 340)]);
  }
  await menu(nombre);
  await pantalla(id, nombre, null, { rutas: RUTAS_PT[id], extra: EXTRA_PT[id] });
}

// Mi alumnado: sus grupos, la página de un alumno con todas sus pestañas y los documentos que creó la IA
await menu('Mi alumnado');
await tabPT('Grupos');
await page.waitForTimeout(800);
await pantalla('pt-grupos', 'Mi alumnado: grupos', null, { extra: EXTRA_ALUMNADO });
await tabPT('Alumnado');
await page.locator('main .sec.active').getByText('Alumno 1', { exact: true }).first().click();
await page.waitForTimeout(1500);
await pantalla('pt-al-resumen', 'Alumno: resumen', null, { extra: EXTRA_ALUMNO });
const ABRIR_DOC = /^Abrir «Informe trimestral a la familia/;
for (const [pestana, id] of [['Programa', 'pt-al-programa'], ['Sesiones', 'pt-al-sesiones'], ['Evaluación', 'pt-al-eval'], ['Coordinaciones', 'pt-al-coord'], ['Documentos', 'pt-al-docs'], ['Datos', 'pt-al-datos']]) {
  await tabPT(pestana);
  await page.waitForTimeout(1000);
  // Los documentos guardados quedan al final de la pestaña, lejos de lo que se ve. Arriba está elegido justo el que hay de
  // ejemplo (informe trimestral a la familia, 1.er trimestre): en la demo, «Preparar con IA» lo abre, y la demo avisa de que ya estaba hecho
  await pantalla(id, `Alumno: ${pestana.toLowerCase()}`, null, { extra: EXTRA_ALUMNO, rutas: id === 'pt-al-docs' ? [[/^Preparar con IA$/, 'go:pt-doc'], [ABRIR_DOC, 'go:pt-doc']] : [] });
}
await tabPT('Documentos');
await abrirVentana(page.getByRole('button', { name: ABRIR_DOC }));
await pantalla('pt-doc', 'Informe trimestral a la familia', null, { extra: { ...EXTRA_ALUMNO, 'Cerrar': 'fn:closeModal' }, datos: { back: 'pt-al-docs' } });
}

/* ══ Lo que llegó entre la 2.14 y la 2.21 ═════════════════════════════ */
if (FASES.includes('nuevas')) {
await abrirPerfil('aula');
P = { menu: MENU_AULA, pestanas: PESTANAS_AULA, saltos: SALTOS_AULA };

/** Una pantalla que ocupa toda la ventana (el juego de tarjetas, el memory): solo valen sus propios botones. */
async function pantallaCompleta(id, titulo, raiz, accion, datos = {}) {
  const buf = await foto();
  const img = await guardar(`assets/demo/${id}.webp`, buf);
  const z = await page.evaluate(sel => [...document.querySelector(sel).querySelectorAll('button')]
    .filter(e => e.checkVisibility() && e.getBoundingClientRect().width >= 6)
    .map(e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom, e.className, e.getAttribute('aria-label') || e.innerText.trim().split('\n')[0] || '']; }), raiz);
  const spots = z.map(([x0, y0, x1, y1, cls, nombre]) => [r(x0), r(y0), r(x1), r(y1), accion(cls, nombre) ?? 'g', nombre.slice(0, 60)]);
  PANTALLAS[id] = { title: titulo, img: path.basename(img), spots, ...datos };
  console.log(`· ${id}: ${spots.length} zonas`);
}
const fijarOrden = () => page.evaluate(() => { window.__azar = Math.random; Math.random = () => 0.5; });   // Las tarjetas se barajan al abrir: así salen siempre en el mismo orden
const soltarOrden = () => page.evaluate(() => { if (window.__azar) Math.random = window.__azar; });

/* Sesiones: la portada con las clases, una clase con sus sesiones por SdA y el editor con sus imágenes */
await menu('Documentos');
await pestana('Sesiones');
await pantalla('sesiones', 'Sesiones', 'documentos', { rutas: [[/^(Abrir las sesiones de )?5º Primaria A/, 'go:sesiones-clase']] });
await page.getByText('5º Primaria A', { exact: true }).first().click();
await page.waitForTimeout(1200);
await pantalla('sesiones-clase', 'Sesiones de una clase', 'documentos', { extra: { 'Sesiones': 'go:sesiones' }, rutas: [[/^Preparamos los puestos/, 'go:sesion'], [/^Ver la SdA/, 'go:sda']] });
await abrirVentana(page.getByText('Preparamos los puestos del mercado').first());
await page.getByText('Imágenes', { exact: true }).first().scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
await pantalla('sesion', 'Sesión con imágenes', 'documentos', { extra: { 'Cancelar': 'fn:closeModal', 'Cerrar': 'fn:closeModal', 'Guardar': 'fn:closeModal' }, datos: { back: 'sesiones-clase' } });
await page.getByRole('button', { name: 'Cancelar' }).first().click();
await page.waitForTimeout(600);

/* Tarjetas interactivas: la biblioteca con su panel, el juego (delante y detrás), el memory y el editor */
await menu('Documentos');
await pestana('Recursos');
await page.getByText('Tarjetas interactivas: el tiempo y la naturaleza').first().click();
await page.waitForTimeout(1000);
await pantalla('tarjetas-panel', 'Recursos: una ficha de tarjetas interactivas', 'documentos', { scroll: 560, extra: { 'Proyectar': 'go:tarjetas-juego', 'Memory': 'go:memory', 'Editar': 'go:tarjetas-editor' }, rutas: [[/El viaje del agua/, 'go:ficha'], [/El drag/, 'go:lectura'], [/^Nueva ficha$/, 'go:recursos']] });
await fijarOrden();
await page.getByRole('button', { name: 'Proyectar' }).first().click();
await page.waitForTimeout(1500);
const alJuego = (cls, nombre) => /tip-stage/.test(cls) ? 'go:__otra' : (nombre === 'Salir' ? 'go:recursos' : null);
await pantallaCompleta('tarjetas-juego', 'Tarjetas interactivas: delante', '.tip-overlay', (c, n) => { const a = alJuego(c, n); return a === 'go:__otra' ? 'go:tarjetas-girada' : a; });
await page.keyboard.press('Space');
await page.waitForTimeout(900);
await pantallaCompleta('tarjetas-girada', 'Tarjetas interactivas: detrás', '.tip-overlay', (c, n) => { const a = alJuego(c, n); return a === 'go:__otra' ? 'go:tarjetas-juego' : a; });
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
await page.getByText('Tarjetas interactivas: el tiempo y la naturaleza').first().click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Memory' }).first().click();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'Empezar', exact: true }).click();
await page.waitForTimeout(900);
{
  // Se juega un poco: dos parejas encontradas y una carta levantada
  const par = { 'nat-lluvia': 'La lluvia', 'nat-sol': 'El sol', 'nat-arcoiris': 'El arcoíris', 'nat-tormenta': 'La tormenta', 'nat-viento': 'El viento', 'nat-rio': 'El río', 'nat-cascada': 'La cascada', 'nat-volcan': 'El volcán' };
  const fichas = await page.evaluate(() => [...document.querySelectorAll('.mem-tile')].map(t => {
    const img = t.querySelector('.mem-cara.face img');
    return { clave: img ? img.getAttribute('src').replace(/^.*\//, '').replace(/\..*$/, '') : null, texto: t.querySelector('.mem-texto')?.textContent ?? null };
  }));
  const tiles = page.locator('.mem-tile');
  const juntas = clave => [fichas.findIndex(f => f.clave === clave), fichas.findIndex(f => f.texto === par[clave])];
  for (const clave of ['nat-sol', 'nat-rio']) {
    const [i, j] = juntas(clave);
    await tiles.nth(i).click(); await page.waitForTimeout(350);
    await tiles.nth(j).click(); await page.waitForTimeout(1300);
  }
  const [k] = juntas('nat-volcan');
  await tiles.nth(k).click();
  await page.waitForTimeout(900);
}
await pantallaCompleta('memory', 'Memory de tarjetas', '.mem-overlay', (c, n) => n === 'Salir' ? 'go:recursos' : null);
await page.getByRole('button', { name: 'Salir' }).click();
await page.waitForTimeout(700);
await soltarOrden();
await page.getByText('Tarjetas interactivas: el tiempo y la naturaleza').first().click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Editar' }).first().click();
await page.waitForTimeout(1800);
await pantalla('tarjetas-editor', 'Editar tarjetas interactivas', 'documentos', { extra: { 'Mis fichas': 'go:recursos' } });

/* El peso de cada nota dentro de su categoría */
await menu('Cuaderno de Notas');
await abrirVentana(page.locator('[title="Editar categoría"]').first());
{
  const pesos = page.locator('.modal-overlay.open input[placeholder="50"]');   // los de cada nota; el de la categoría lleva su valor
  if (await pesos.count() >= 2) { await pesos.nth(0).fill('30'); await pesos.nth(1).fill('70'); }
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(500);
}
await pantalla('pesos', 'Cuánto cuenta cada nota', null, { extra: { 'Cerrar': 'fn:closeModal', 'Guardar': 'fn:closeModal', 'Eliminar': 'fn:closeModal' }, datos: { back: 'cuaderno' } });
await cerrarModal();

// Desde lo que ya había: la pestaña, la biblioteca y el cuaderno llevan a lo nuevo
if (PANTALLAS.cuaderno) PANTALLAS.cuaderno.spots = PANTALLAS.cuaderno.spots.map(sp => (/^Pruebas/.test(sp[5]) && sp[4] === 'g' ? [sp[0], sp[1], sp[2], sp[3], 'go:pesos', sp[5]] : sp));
}

/*__FIN__*/

await browser.close();

// Con solo algunas fases, se conservan las pantallas de las demás
const destino = path.join(SITIO, 'assets/demo-pantallas.js');
let todas = PANTALLAS;
if (process.env.FASES) {
  try {
    const w = {};
    new Function('window', fs.readFileSync(destino, 'utf8'))(w);
    todas = { ...w.AULA_DEMO_SCREENS, ...PANTALLAS };
  } catch { /* sin archivo previo */ }
}
// El cuaderno lleva a «Pesos de las notas» aunque se hayan capturado en pasadas distintas (`aula` y `nuevas`): antes solo se
// enlazaba si estaban las dos en la misma, y la pantalla de los pesos se quedaba sin camino (5-11-2026)
if (todas.cuaderno && todas.pesos) todas.cuaderno.spots = todas.cuaderno.spots.map(sp => (/^Pruebas/.test(sp[5]) && sp[4] === 'g' ? [sp[0], sp[1], sp[2], sp[3], 'go:pesos', sp[5]] : sp));
const js ='/* Generado por scripts/web/capturar.mjs: no se edita a mano. Pantallas de la demo,\n'
  + '   con lo que se puede pulsar en cada una ([x0, y0, x1, y1, acción, nombre], en píxeles de la captura). */\n'
  + `window.AULA_DEMO_SCREENS = ${JSON.stringify(todas)};\n`;
fs.writeFileSync(destino, js);
if (FASES.includes('aula')) fs.writeFileSync(path.join(RAIZ, 'scripts/web/marcas.json'), JSON.stringify(MARCAS, null, 2) + '\n');
console.log('Hecho:', Object.keys(PANTALLAS).length, 'pantallas nuevas,', Object.keys(todas).length, 'en total');
