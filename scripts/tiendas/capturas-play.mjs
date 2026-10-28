/**
 * Capturas de la ficha de Google Play (y de Microsoft Store en escritorio con `ESCRITORIO=1`),
 * hechas sobre la app de verdad con los datos de ejemplo de `scripts/web/ejemplos.mjs`.
 *
 *   npm run dev            (en otra terminal)
 *   CHROMIUM=/ruta/chromium node scripts/tiendas/capturas-play.mjs [carpeta de salida]
 *
 * Perfil con `PERFIL=aula|ef|apoyo` (por defecto aula). Móvil: 1080x1920 (9:16, lo que pide Play). Escritorio: 1920x1080 PNG.
 * Nombres de personas: ninguno (regla 7 de CLAUDE.md): «Profesor» y «Alumno N».
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ejemplosAula, fichasAula, reunionYFormacion, nuevasAula, ejemplosEF, ejemplosApoyo, borradorEvalFoto } from '../web/ejemplos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SALIDA = path.resolve(process.argv[2] || path.join(RAIZ, 'tiendas-capturas'));
const ESCRITORIO = !!process.env.ESCRITORIO;
const TABLET = !!process.env.TABLET;   // TABLET=1: 7" (1024x576 CSS); TABLET=10: 10" (1280x720 CSS). Siempre 1920x1080 en horizontal (16:9)
const T10 = process.env.TABLET === '10';
const PERFIL = process.env.PERFIL || 'aula';
const BASE = process.env.BASE || 'http://127.0.0.1:5173/';
fs.mkdirSync(SALIDA, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext(TABLET
  ? { viewport: T10 ? { width: 1280, height: 720 } : { width: 1024, height: 576 }, deviceScaleFactor: T10 ? 1.5 : 1.875, isMobile: true, hasTouch: true, locale: 'es-ES' }
  : ESCRITORIO
  ? { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: 'es-ES' }
  : { viewport: { width: 412, height: 732 }, deviceScaleFactor: 1080 / 412, isMobile: true, hasTouch: true, locale: 'es-ES' });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('Error en la app:', e.message));
await ctx.clock.install({ time: new Date('2026-10-14T09:45:00') });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(2500);
if (PERFIL === 'ef') await page.getByRole('radio', { name: /Educación Física/ }).click();
if (PERFIL === 'apoyo') await page.getByRole('radio', { name: /PT y AL/ }).click();
await page.getByText('Explorar con datos de ejemplo').click();
await page.waitForTimeout(4500);

const { id, data } = await page.evaluate(() => {
  const id = localStorage.getItem('aulapro_active_profile');
  return { id, data: JSON.parse(localStorage.getItem('aulapro_web_data_' + id) || '{}') };
});
const clase = n => data.classes.find(c => c.name.startsWith(n)) ?? data.classes[0];
let patch = {};
let borradores = {};
if (PERFIL === 'aula') {
  patch = { ...ejemplosAula({ clases: data.classes, alumnos: data.students }) };
  const fa = fichasAula({ clases: data.classes });
  patch.fichas = await page.evaluate(async ({ fa }) => {
    const rs = await import('/src/services/resources.ts');
    const prep = f => { f.content.actividades.forEach(a => { a.ejercicios = a.ejercicios.map(x => rs.prepareExercise(x)); }); return f; };
    return [prep(fa.lectura), prep(fa.escape), prep(fa.tarjetas)];
  }, { fa });
  const nuevas = nuevasAula({ clases: data.classes, sdaId: patch.learningSituations[0].id, imagenes: [] });
  patch.fichas.unshift(nuevas.interactivas);
  patch.ef = { ...(data.ef ?? {}), sesiones: nuevas.sesiones };
  patch.workSessions = reunionYFormacion();
  const c5 = clase('5º Primaria A');
  const alumno = data.students.find(a => a.class_id === c5.id);
  const categoria = data.gradeCategories.find(c => c.class_id === c5.id);
  borradores['evaluacion-foto'] = borradorEvalFoto({ clase: c5, alumno, categoriaId: categoria?.id ?? '' });
} else if (PERFIL === 'ef') {
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
  patch = { apoyo: { ...data.apoyo, ...ejemplosApoyo({ titulos }) }, workSessions: reunionYFormacion() };
}
await page.evaluate(({ id, patch, borradores }) => {
  const k = 'aulapro_web_data_' + id;
  for (const [tipo, b] of Object.entries(borradores)) localStorage.setItem(`aulapro_borrador_${id}_${tipo}`, JSON.stringify(b));
  localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k)), ...patch }));
  localStorage.setItem('aulapro_gemini_key', 'clave-de-ejemplo-no-valida');
}, { id, patch, borradores });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
await page.addStyleTag({ content: '*{caret-color:transparent!important} .toast,.toast-wrap,[aria-label="Ayuda de AulaPro"]{display:none!important}' });

async function menu(nombre) {
  const burger = page.getByRole('button', { name: 'Abrir el menú' });
  if (!ESCRITORIO && await burger.isVisible()) { await burger.click(); await page.waitForTimeout(700); }
  await page.locator('.sidebar .nav-item', { hasText: new RegExp(`^${nombre}$`) }).click();
  await page.waitForTimeout(1500);
}
const pestana = async n => { await page.locator('.hub-tab', { hasText: new RegExp(`^${n}$`) }).click(); await page.waitForTimeout(1300); };
async function foto(nombre, y = 0) {
  await page.evaluate(v => { window.scrollTo(0, v); document.querySelectorAll('main,.main,.content').forEach(e => { e.scrollTop = v; }); }, y);
  await page.waitForTimeout(500);
  const buf = await page.screenshot();
  const f = path.join(SALIDA, `${nombre}.png`);
  fs.writeFileSync(f, await (ESCRITORIO || TABLET ? sharp(buf) : sharp(buf).resize(1080, 1920, { fit: 'fill' })).png().toBuffer());
  console.log('→', f);
}

const cerrar = async () => { if (await page.locator('.modal-overlay.open').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(600); } };
const herramienta = n => page.locator('main').getByRole('button', { name: new RegExp(`^${n}`) }).first().click();
const tabPT = n => page.locator('main').getByRole('tab', { name: new RegExp(`^${n}`) }).first().click();
if (PERFIL === 'aula') {
  await foto('01-inicio');
  await menu('Mis Clases'); await foto('02-mis-clases');
  await menu('Cuaderno de Notas'); await foto('03-cuaderno');
  await menu('Evaluar'); await foto('04-evaluar');
  await menu('Documentos'); await pestana('Situaciones de aprendizaje'); await foto('05-situaciones');
  await menu('Documentos'); await pestana('Recursos'); await foto('06-recursos');
  await menu('En clase'); await pestana('Anotar actitud'); await foto('07-actitud');
  await menu('Agenda'); await foto('08-agenda');
  await menu('Evaluar'); await pestana('Rúbricas'); await foto('09-rubricas');
  await menu('Evaluar'); await pestana('Dianas'); await page.waitForTimeout(1500); await foto('10-dianas');
  await menu('Evaluar'); await pestana('Diana competencial');
  const sel = page.locator('main select');
  await sel.nth(0).selectOption({ index: 1 }); await page.waitForTimeout(600);
  await sel.nth(1).selectOption({ index: 1 }); await page.waitForTimeout(1500); await foto('11-diana-competencial');
  await menu('Evaluar'); await pestana('Por foto'); await page.waitForTimeout(1000); await foto('12-evaluar-foto');
  await menu('Documentos'); await pestana('Informes');
  await page.getByText('Alumno 1', { exact: true }).first().click(); await page.waitForTimeout(1200); await foto('14-informes');
  await menu('Documentos'); await pestana('Actas'); await foto('15-actas');
  // Pizarra y herramientas (Aula Live): con el temporizador y la ruleta abiertos, repartidos por la pizarra
  const ancho = page.viewportSize().width;
  const v = (tipo, x, y, w, h) => ({ id: tipo, tipo, rect: { x: Math.round(x), y, width: w, height: h } });
  await page.evaluate(vs => localStorage.setItem('aulapro_pizarra_actual', JSON.stringify(vs)),
    ancho < 600 ? [v('wheel', 50, 170, 300, 340)] : [v('timer', ancho * 0.3, 130, 290, 350), v('wheel', ancho * 0.58, 130, 290, 340)]);
  await menu('En clase'); await pestana('Pizarra y herramientas'); await page.waitForTimeout(1500); await foto('16-pizarra');
  await menu('En clase'); await pestana('Actividades con móviles'); await foto('17-actividades-moviles');
} else if (PERFIL === 'ef') {
  await menu('Educación Física'); await foto('ef-01-portada');
  for (const [n, f] of [['En la pista', 'ef-02-pista'], ['Equipos', 'ef-03-equipos'], ['Pruebas físicas', 'ef-04-pruebas']]) {
    await cerrar(); await menu('Educación Física'); await herramienta(n); await page.waitForTimeout(1000); await foto(f);
  }
  await menu('Educación Física'); await herramienta('Pizarra de circuitos'); await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Circuito de agilidad' }).first().click(); await page.waitForTimeout(900); await foto('ef-05-circuitos');
  await menu('Educación Física'); await herramienta('Sesiones'); await page.getByText('Voleibol: el toque de dedos').first().click(); await page.waitForTimeout(1500); await foto('ef-06-sesion');
  await cerrar(); await menu('Educación Física'); await herramienta('Situaciones de aprendizaje'); await page.getByText('Juegos cooperativos: la isla del tesoro').first().click(); await page.waitForTimeout(1500); await foto('ef-07-situacion');
} else {
  await menu('Inicio'); await foto('pt-01-inicio');
  await menu('Registro diario'); await foto('pt-02-registro');
  await menu('Mi alumnado'); await tabPT('Grupos'); await page.waitForTimeout(800); await foto('pt-03-grupos');
  await tabPT('Alumnado'); await page.getByText('Alumno 1', { exact: true }).first().click(); await page.waitForTimeout(1500); await foto('pt-04-alumno');
  for (const [t, f] of [['Programa', 'pt-05-programa'], ['Sesiones', 'pt-06-sesiones'], ['Documentos', 'pt-07-documentos']]) { await tabPT(t); await page.waitForTimeout(1000); await foto(f); }
  await page.getByRole('button', { name: /^Abrir «Informe trimestral a la familia/ }).click(); await page.waitForTimeout(1500); await foto('pt-08-informe');
}
await browser.close();
