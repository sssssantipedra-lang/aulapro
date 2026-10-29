// Antes de publicar, comprueba que la copia de la web que se va a subir está entera. Si algo falla, el
// flujo de publicación se para y la web que está en línea se queda como estaba: un cambio roto no puede
// tirar la web. Se ejecuta DESPUÉS de web/idiomas.mjs (que crea ca.html y en.html) y ANTES de
// web/versionar.mjs (que añade las huellas a las rutas).
//   node web/comprobar.mjs web/sitio
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import vm from 'node:vm';

const root = process.argv[2] || 'web/sitio';
const fallos = [];
const falla = m => fallos.push(m);
const leer = f => readFileSync(join(root, f), 'utf8');
const hay = f => existsSync(join(root, f));

// ---- las páginas y lo mínimo que lleva cada una
const PAGINAS = ['index.html', 'ca.html', 'en.html', 'demo.html', 'descargar.html', 'gracias.html',
  'condiciones.html', 'privacidad.html', 'aviso-legal.html'];
for (const p of PAGINAS) {
  if (!hay(p)) { falla(`falta ${p}`); continue; }
  if (statSync(join(root, p)).size < 4000) falla(`${p} es demasiado pequeña (${statSync(join(root, p)).size} bytes)`);
  const h = leer(p);
  if (!/<title>[^<]{5,}<\/title>/.test(h)) falla(`${p}: sin <title>`);
  if (!/<html lang="(es|ca|en)"/.test(h)) falla(`${p}: sin idioma en <html>`);
  if (!/<meta name="viewport"/.test(h)) falla(`${p}: sin viewport`);
}

// ---- cada archivo al que apuntan las páginas, los scripts y las hojas de estilo existe
const SALTAR = /^(https?:|\/\/|#|%23|mailto:|tel:|data:|javascript:|\/cdn-cgi\/)/i;   // %23: un # dentro de una imagen incrustada
// `base`: carpeta a la que son relativas las rutas ('' = la raíz de la web; las de una hoja de estilo, su carpeta)
function destino(base, ref) {
  let r = ref.trim().split('#')[0].split('?')[0];
  if (!r || SALTAR.test(ref.trim())) return null;
  if (r === './' || r === '/') return 'index.html';
  // La app (/app/) se compila y se copia después de esta comprobación (web.yml, netlify.toml)
  if (/^\/?app\//.test(r)) return null;
  if (r.startsWith('/')) r = r.slice(1); else r = normalize(join(base, r)).replace(/\\/g, '/');
  if (!/\.[a-z0-9]{2,5}$/i.test(r)) r += '.html';   // /ca, /demo: Cloudflare y GitHub las sirven sin la extensión
  return r;
}
const archivos = readdirSync(root).filter(f => /\.(html|css|js)$/.test(f))
  .concat(readdirSync(join(root, 'assets')).filter(f => /\.(css|js)$/.test(f)).map(f => 'assets/' + f))
  .concat(hay('assets/fonts/fonts.css') ? ['assets/fonts/fonts.css'] : []);
const vistas = new Set();
for (const f of archivos) {
  const t = leer(f);
  const refs = [];   // [ruta, carpeta a la que es relativa]
  if (f.endsWith('.html')) for (const m of t.matchAll(/\s(?:src|href|poster)="([^"]+)"/g)) refs.push([m[1], '']);
  if (f.endsWith('.css')) for (const m of t.matchAll(/url\(\s*["']?([^)"']+)["']?\s*\)/g)) refs.push([m[1], dirname(f)]);
  if (f.endsWith('.html')) for (const m of t.matchAll(/url\(\s*["']?([^)"']+)["']?\s*\)/g)) refs.push([m[1], '']);
  if (f.endsWith('.js') || f.endsWith('.html')) for (const m of t.matchAll(/["'`](assets\/[\w\-./]+\.(?:js|css|mp4|jpe?g|png|webp|svg|json|woff2))["'`]/g)) refs.push([m[1], '']);
  for (const [ref, base] of refs) {
    let d = destino(base, ref);
    if (!d || /^assets\/demo\//.test(d)) continue;     // las imágenes de la demo las nombra demo.js por partes
    if (/\.[a-z0-9]+$/i.test(d) && !/\.(html|css|js|mp4|jpe?g|png|webp|svg|json|woff2|txt|xml|ico)$/i.test(d)) continue;
    const clave = f + '→' + d;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    if (!hay(d)) falla(`${f} apunta a ${ref}, que no existe`);
  }
}

// ---- lo que el vídeo y la portada necesitan para funcionar
for (const [f, min] of [['assets/hero-scrub-60.mp4', 1e6], ['assets/hero-scrub-60-atras.mp4', 1e6], ['assets/hero-poster.jpg', 2e4],
  ['assets/hero-ending.jpg', 2e4], ['assets/escritorio.jpg', 5e4], ['assets/og.jpg', 2e4], ['assets/app.js', 2e4], ['assets/i18n.js', 2e4]]) {
  if (!hay(f)) falla(`falta ${f}`);
  else if (statSync(join(root, f)).size < min) falla(`${f} pesa demasiado poco (${statSync(join(root, f)).size} bytes)`);
}

// ---- idiomas: las tres portadas, cada una en el suyo, con su dirección y sus alternativas
const esperado = { 'index.html': ['es', 'https://aulapro.app/'], 'ca.html': ['ca', 'https://aulapro.app/ca'], 'en.html': ['en', 'https://aulapro.app/en'] };
for (const [f, [lang, url]] of Object.entries(esperado)) {
  if (!hay(f)) continue;
  const h = leer(f);
  if (!h.includes(`<html lang="${lang}"`)) falla(`${f}: debería estar en ${lang}`);
  if (!h.includes(`<link rel="canonical" href="${url}">`)) falla(`${f}: canonical distinto de ${url}`);
  for (const [l, u] of [['es', 'https://aulapro.app/'], ['ca', 'https://aulapro.app/ca'], ['en', 'https://aulapro.app/en'], ['x-default', 'https://aulapro.app/']])
    if (!h.includes(`<link rel="alternate" hreflang="${l}" href="${u}">`)) falla(`${f}: falta hreflang ${l}`);
  const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(h);
  if (!ld) falla(`${f}: falta la ficha de la app (JSON-LD)`);
  else { try { const d = JSON.parse(ld[1]); if (d.url !== url) falla(`${f}: la ficha apunta a ${d.url}`); } catch (e) { falla(`${f}: la ficha de la app no es JSON válido`); } }
  if (/\{n\}|undefined|\[object Object\]/.test(h.replace(/<script[\s\S]*?<\/script>/g, ''))) falla(`${f}: texto roto (undefined, {n} u [object Object])`);
}
if (hay('index.html') && hay('assets/i18n.js')) {
  const ctx = { window: {} };
  try {
    vm.runInNewContext(leer('assets/i18n.js'), ctx);
    const claves = new Set([...leer('index.html').matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]));
    for (const l of ['ca', 'en']) {
      const sin = [...claves].filter(k => !(k in ctx.window.AULA_I18N[l]));
      if (sin.length) falla(`i18n.js: en ${l} faltan ${sin.length} textos (${sin.slice(0, 5).join(', ')}...)`);
    }
  } catch (e) { falla('assets/i18n.js no se puede leer: ' + e.message); }
}

// ---- el interruptor de lanzamiento y el mapa del sitio
if (hay('assets/launch.js')) {
  const ctx = { window: {} };
  try {
    vm.runInNewContext(leer('assets/launch.js'), ctx);
    const L = ctx.window.AULA_LAUNCH;
    for (const k of ['checkout', 'play', 'store', 'packs', 'downloads']) if (!(k in L)) falla(`launch.js: falta ${k}`);
    for (const k of ['5', '10', '20', '30']) if (!(k in (L.packs || {}))) falla(`launch.js: falta el pack ${k}`);
    // el vídeo de una generación real (sección «En directo»): vacío, o completo y ligero
    for (const k of ['video', 'testimonios']) if (!(k in L)) falla(`launch.js: falta ${k}`);
    const v = L.video || {};
    if (v.src) {
      const f = String(v.src).replace(/\?.*$/, '');
      if (!/\.mp4$/i.test(f)) falla('launch.js: el vídeo tiene que ser un .mp4');
      else if (!hay(f)) falla(`launch.js: el vídeo ${f} no existe`);
      else if (statSync(join(root, f)).size > 6e6) falla(`launch.js: el vídeo pesa ${(statSync(join(root, f)).size / 1e6).toFixed(1)} MB (máximo 6 MB, o la web se vuelve lenta)`);
      if (!v.poster || !hay(String(v.poster).replace(/\?.*$/, ''))) falla('launch.js: el vídeo necesita su imagen (poster) y no existe');
    } else if (v.poster) falla('launch.js: hay poster pero no vídeo');
    // las opiniones: máximo 3, de personas con nombre y con un texto corto
    const ops = L.testimonios;
    if (!Array.isArray(ops)) falla('launch.js: testimonios tiene que ser una lista');
    else {
      if (ops.length > 3) falla('launch.js: como mucho 3 opiniones');
      ops.forEach((o, i) => {
        const t = o && typeof o.texto === 'object' ? Object.values(o.texto).join(' ') : String(o?.texto || '');
        if (!o?.nombre || !t) falla(`launch.js: la opinión ${i + 1} necesita nombre y texto`);
        else if (t.length > 600) falla(`launch.js: la opinión ${i + 1} es muy larga (${t.length} caracteres)`);
        if (/lorem|ejemplo|xxx/i.test(t + String(o?.nombre))) falla(`launch.js: la opinión ${i + 1} parece de relleno`);
      });
    }
  } catch (e) { falla('assets/launch.js no se puede leer: ' + e.message); }
}
if (hay('sitemap.xml')) {
  const s = leer('sitemap.xml');
  if (!/<urlset[\s>]/.test(s)) falla('sitemap.xml no es un mapa válido');
  for (const m of s.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const path = m[1].replace('https://aulapro.app', '') || '/';
    const d = destino('', path);
    if (!m[1].startsWith('https://aulapro.app') || !d || !hay(d)) falla(`sitemap.xml: ${m[1]} no corresponde a ninguna página`);
  }
} else falla('falta sitemap.xml');
if (!hay('robots.txt') || !/Sitemap:\s*https:\/\/aulapro\.app\/sitemap\.xml/.test(leer('robots.txt'))) falla('robots.txt no anuncia el mapa del sitio');
if (hay('calendario-escolar.json')) { try { JSON.parse(leer('calendario-escolar.json')); } catch (e) { falla('calendario-escolar.json no es JSON válido'); } }
else falla('falta calendario-escolar.json (la app lo descarga)');

// ---- nada de lo que no debe publicarse
const SECRETOS = /(sk_live_|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|CLOUDFLARE_API_TOKEN\s*[:=]\s*["'][^"']{10,})/;
for (const f of archivos) if (SECRETOS.test(leer(f))) falla(`${f} parece contener una clave secreta`);

if (fallos.length) {
  console.log(`\n✖ La web NO está lista para publicar (${fallos.length} problemas):`);
  for (const m of fallos.slice(0, 40)) console.log('  - ' + m);
  if (fallos.length > 40) console.log(`  ... y ${fallos.length - 40} más`);
  process.exit(1);
}
console.log(`✔ La web está lista para publicar: ${PAGINAS.length} páginas, ${vistas.size} enlaces y archivos comprobados.`);
