/**
 * Recorre la demo interactiva de la web (web/sitio/demo.html) como la vería un docente, para comprobar que sigue
 * entera después de rehacer las capturas (`scripts/web/capturar.mjs`) o de tocar `assets/demo.js`:
 *
 * - cada zona pulsable cae dentro de la pantalla (y de su ventana, si la hay), lleva a una pantalla que existe y cada
 *   aviso tiene texto en los tres idiomas;
 * - a todas las pantallas se llega pulsando desde el inicio de su perfil;
 * - cada pantalla abre con su imagen (1920 x 1008), sin errores de consola ni de red y sin desbordar la página;
 * - cada destino responde de verdad: se pulsa en el centro de su zona y se mira a dónde lleva;
 * - «Evaluar a la clase» con rúbrica y con diana: marcar, «Guardar y siguiente», la lista y la cuenta.
 *
 * No necesita la app: sirve `web/sitio` él mismo. Uso (Playwright y su Chromium tienen que estar instalados):
 *
 *   node scripts/web/recorrer-demo.mjs          # ordenador y móvil
 *   node scripts/web/recorrer-demo.mjs movil    # solo uno: pc o movil
 *
 * Sale con error si algo falla.
 */
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/sitio');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2' };
const servidor = http.createServer((req, res) => {
  const f = path.join(SITIO, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(SITIO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => servidor.listen(0, '127.0.0.1', r));
const URL_DEMO = `http://127.0.0.1:${servidor.address().port}/demo.html`;

const MODOS = process.argv[2] ? [process.argv[2]] : ['pc', 'movil'];
const FN = new Set(['closeModal', 'full']);   // las funciones de `FN` en assets/demo.js
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let total = 0;

for (const modo of MODOS) {
  const movil = modo === 'movil';
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1600, height: 1000 }, locale: 'es-ES' });
  const p = await ctx.newPage();
  const fallos = [], ruido = new Set();
  p.on('pageerror', e => ruido.add('error: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') ruido.add('consola: ' + m.text().slice(0, 200)); });
  p.on('requestfailed', r => ruido.add('no carga: ' + r.url()));
  p.on('response', r => { if (r.status() >= 400) ruido.add(r.status() + ' ' + r.url()); });
  const abrir = async id => { await p.goto(`${URL_DEMO}#${id}`); await p.reload(); await p.waitForTimeout(movil ? 250 : 100); };
  const pulsar = (x, y) => (movil ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
  /** Lleva a la vista el punto (x, y) de la pantalla de la app y dice dónde ha quedado en la página y qué hay ahí. */
  const punto = ([cx, cy]) => p.evaluate(([cx, cy]) => {
    const w = document.querySelector('#win'), k = w.getBoundingClientRect().width / 1920;
    const en = () => { const r = w.getBoundingClientRect(); return [r.left + cx * k, r.top + (cy + 24) * k]; };
    let [x, y] = en();
    if (x > innerWidth - 4 || x < 4) document.querySelector('.stage-scroll').scrollLeft += x - innerWidth / 2;
    [x, y] = en();
    if (y > innerHeight - 4 || y < 70) scrollBy(0, y - innerHeight / 2);
    [x, y] = en();
    const el = document.elementFromPoint(x, y);
    return { x, y, act: el?.closest('[data-act]')?.dataset.act ?? null, que: el ? `${el.tagName.toLowerCase()}.${el.className}` : 'nada' };
  }, [cx, cy]);
  const centro = ([x0, y0, x1, y1]) => [(x0 + x1) / 2, (y0 + y1) / 2];
  const imagen = () => p.evaluate(() => { const im = document.querySelector('#view img.shot'); return { src: im?.getAttribute('src'), bien: !!im && im.complete && im.naturalWidth === 1920 && im.naturalHeight === 1008 }; });

  await abrir('inicio');
  const { S, I18N } = await p.evaluate(() => ({
    S: window.AULA_DEMO_SCREENS,
    I18N: Object.fromEntries(['es', 'ca', 'en'].map(l => [l, { ...window.AULA_I18N[l], ...window.AULA_DEMO_I18N[l] }])),
  }));
  const ids = Object.keys(S);

  /* 1. Los datos: cada zona en su sitio, cada destino existe, cada aviso tiene texto */
  for (const id of ids) {
    const s = S[id];
    for (const [x0, y0, x1, y1, act, nombre] of s.spots) {
      if (!(x0 >= 0 && y0 >= 0 && x1 <= 1920 && y1 <= 1008 && x1 - x0 >= 6 && y1 - y0 >= 6)) fallos.push(`${id}: «${nombre}» cae fuera de la pantalla (${[x0, y0, x1, y1]})`);
      if (s.modal) { const [a, b, c, d] = s.modal; if (x0 < a - 2 || y0 < b - 2 || x1 > c + 2 || y1 > d + 2) fallos.push(`${id}: «${nombre}» cae fuera de su ventana`); }
      const [tipo, arg] = act.split(':');
      if (tipo === 'go' && !S[arg]) fallos.push(`${id}: «${nombre}» lleva a una pantalla que no existe (${arg})`);
      if (tipo === 'fn' && !FN.has(arg)) fallos.push(`${id}: «${nombre}» llama a una función que no existe (${arg})`);
      if (tipo === 't') for (const l of ['es', 'ca', 'en']) if (!I18N[l]['demo.t.' + arg]) fallos.push(`${id}: falta el texto demo.t.${arg} en ${l}`);
    }
    if (s.back && !S[s.back]) fallos.push(`${id}: al cerrar vuelve a una pantalla que no existe (${s.back})`);
  }

  /* 2. A todas se llega pulsando desde el inicio de su perfil */
  const vistas = new Set();
  for (const cola = ['inicio', 'ef-inicio', 'pt-inicio']; cola.length;) {
    const id = cola.pop();
    if (vistas.has(id) || !S[id]) continue;
    vistas.add(id);
    for (const sp of S[id].spots) if (sp[4].startsWith('go:')) cola.push(sp[4].slice(3));
    if (S[id].back) cola.push(S[id].back);
  }
  for (const id of ids) if (!vistas.has(id)) fallos.push(`${id}: no se llega a ella pulsando`);

  /* 3. Cada pantalla abre, y cada destino responde en el centro de su zona (en el móvil, los dos primeros de cada una) */
  let pulsadas = 0;
  for (const id of ids) {
    await abrir(id);
    let im = await imagen();
    if (!im.bien) { await p.waitForTimeout(800); im = await imagen(); }
    if (!im.bien) fallos.push(`${id}: su imagen no carga o no mide 1920 x 1008 (${im.src})`);
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) fallos.push(`${id}: la página se desborda a lo ancho`);
    const destinos = new Set();
    for (const sp of S[id].spots) {
      const act = sp[4];
      if (!act.startsWith('go:') || destinos.has(act)) continue;
      destinos.add(act);
      if (movil && destinos.size > 2) break;
      const hay = await punto(centro(sp));
      if (hay.act !== act) { fallos.push(`${id}: en el centro de «${sp[5]}» (${act}) responde ${hay.act ?? hay.que}`); continue; }
      await pulsar(hay.x, hay.y);
      await p.waitForTimeout(60);
      const destino = S[act.slice(3)];
      if ((await imagen()).src !== 'assets/demo/' + (destino.base || destino.img)) fallos.push(`${id}: «${sp[5]}» no lleva a ${act.slice(3)}`);
      pulsadas++;
      await abrir(id);
    }
  }

  /* 4. «Evaluar a la clase»: marcar, guardar y pasar al siguiente */
  const pie = () => p.locator('#view .evc-f .ac');
  const lista = () => p.evaluate(() => ({
    filas: [...document.querySelectorAll('#view .evc-r')].map(r => r.className.replace('evc-r', '').trim() + '|' + r.lastChild.textContent),
    cuenta: document.querySelector('#view .evc-n').textContent,
    quien: document.querySelector('#view .evc-q strong').textContent,
  }));
  const espera = (id, que, bien) => { if (!bien) fallos.push(`${id}: ${que}`); };
  for (const id of ['rubrica', 'dianaeval']) {
    const s = S[id];
    if (!s?.clase) { fallos.push(`${id}: faltan los datos de «Evaluar a la clase»`); continue; }
    await abrir(id);
    const nombres = s.clase.filas.map(f => f.nombre);
    const marcarTodo = async () => {
      if (id === 'rubrica') for (const fila of s.rubrica) { const h = await punto(centro(fila[2])); await pulsar(h.x, h.y); }
      else {
        // Un punto de cada sector de la diana, en su tercer anillo (el centro del dibujo es 170, 170 y el radio, 116)
        const [x0, y0, x1, y1] = s.diana.svg, [vx, vy, vw, vh] = s.diana.viewBox.split(/\s+/).map(Number), n = s.diana.items.length;
        for (let i = 0; i < n; i++) {
          const a = (i + 0.5) * 2 * Math.PI / n - Math.PI / 2, r = 116 * 0.65;
          const h = await punto([x0 + (170 + r * Math.cos(a) - vx) / vw * (x1 - x0), y0 + (170 + r * Math.sin(a) - vy) / vh * (y1 - y0)]);
          await pulsar(h.x, h.y);
        }
      }
      await p.waitForTimeout(80);
    };
    let l = await lista();
    espera(id, 'se abre con el primero de la lista elegido', l.quien === nombres[0] && l.filas[0].startsWith('sel'));
    espera(id, 'sin marcar nada el botón es «Siguiente»', (await pie().textContent()).trim() === 'Siguiente');
    await marcarTodo();
    l = await lista();
    espera(id, `al marcar, el alumno queda «sin guardar» (${l.filas[0]}; ${l.cuenta})`, /sin/.test(l.filas[0]) && /1 sin guardar/.test(l.cuenta));
    espera(id, 'con algo marcado el botón es «Guardar y siguiente»', (await pie().textContent()).trim() === 'Guardar y siguiente');
    await pie().scrollIntoViewIfNeeded();
    await (movil ? pie().tap() : pie().click());
    await p.waitForTimeout(120);
    l = await lista();
    espera(id, `al guardar queda hecho con su nota y se pasa al segundo (${l.filas[0]}; ${l.quien}; ${l.cuenta})`,
      /^hoy\|\d+,\d$/.test(l.filas[0]) && l.quien === nombres[1] && l.cuenta.startsWith(`1 de ${nombres.length}`) && !/sin guardar/.test(l.cuenta));
    // Volver al primero: sigue con lo suyo y se avisa de que se corrige
    const h = await punto(centro(s.clase.filas[0].caja));
    await pulsar(h.x, h.y);
    await p.waitForTimeout(80);
    espera(id, 'al volver a un alumno guardado se dice que se corrige su evaluación', /corrige esa evaluación/.test(await p.locator('#view .evc-q').textContent()));
    // Y el resto de la clase, hasta el final
    for (let i = 1; i < nombres.length; i++) {
      const f = await punto(centro(s.clase.filas[i].caja));
      await pulsar(f.x, f.y);
      await marcarTodo();
      await pie().scrollIntoViewIfNeeded();
      await (movil ? pie().tap() : pie().click());
      await p.waitForTimeout(80);
    }
    l = await lista();
    espera(id, `con toda la clase guardada la cuenta lo dice (${l.cuenta})`, l.cuenta.startsWith(`${nombres.length} de ${nombres.length}`) && l.filas.every(f => /^hoy( sel)?\|/.test(f)));
  }

  console.log(`${modo}: ${ids.length} pantallas, ${pulsadas} destinos pulsados, ${[...ruido].length} errores de consola o de red, ${fallos.length} fallos`);
  for (const r of ruido) console.log('  ' + r);
  for (const f of fallos) console.log('  ' + f);
  total += fallos.length + ruido.size;
  await ctx.close();
}
await browser.close();
servidor.close();
if (total) process.exit(1);
console.log('La demo está entera.');
