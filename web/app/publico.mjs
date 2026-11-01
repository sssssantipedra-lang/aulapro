// Escribe en web/funciones/_publico.js la lista del JavaScript que la web entrega sin sesión, con su dirección
// exacta: los bloques de /app/assets/ que hacen falta para entrar y comprar (dist-web/publico.json, la saca
// vite.config.ts), el service worker y lo demás de la raíz de la app, y los scripts de la web (web/sitio).
// La importan la puerta de Cloudflare y la de Netlify (web/funciones/api/_puerta.js): todo otro código pide
// sesión. Se ejecuta al publicar (web.yml y netlify.toml), después de compilar. Si la lista de la app no
// está, para: publicar sin ella dejaría la puerta abierta sin que nadie se enterara.
//
//   node web/app/publico.mjs dist-web [web/sitio]
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';

const dist = process.argv[2] || 'dist-web';
const sitio = process.argv[3] || new URL('../sitio', import.meta.url).pathname;
const lista = JSON.parse(readFileSync(join(dist, 'publico.json'), 'utf8'));
if (!Array.isArray(lista) || !lista.length || !lista.every(f => typeof f === 'string' && /^assets\/.+\.m?js$/.test(f))) {
  console.error('publico.json no es una lista de bloques de assets/');
  process.exit(1);
}

/** Los .js y .mjs de una carpeta, con su ruta relativa en forma de dirección; `fuera` se salta (por nombre de carpeta). */
function scripts(dir, fuera = new Set()) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!e.isFile() || !/\.m?js$/.test(e.name)) continue;
    const rel = relative(dir, join(e.parentPath ?? e.path, e.name)).split(sep).join('/');
    if (fuera.has(rel.split('/')[0])) continue;
    out.push(rel);
  }
  return out;
}

const direcciones = [
  ...lista.map(f => `/app/${f}`),
  ...scripts(dist, new Set(['assets'])).map(f => `/app/${f}`),   // sw.js
  ...scripts(sitio, new Set(['app'])).map(f => `/${f}`),          // assets/app.js, launch.js…
].sort();
const destino = new URL('../funciones/_publico.js', import.meta.url);
writeFileSync(destino, `// Generado por web/app/publico.mjs al publicar: no editar.\nexport default ${JSON.stringify(direcciones, null, 2)};\n`);
console.log(`✔ Puerta: ${lista.length} bloques de la app públicos (entrar y comprar) y ${direcciones.length - lista.length} scripts más de la web; el resto del código, con sesión`);
