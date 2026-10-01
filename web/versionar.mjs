// Antes de publicar, cada referencia a un archivo de assets/ recibe ?v=<huella de su contenido>.
// Cloudflare dice a los navegadores que guarden los archivos de assets/ 4 horas; con la huella, el
// navegador vuelve a pedir un archivo justo cuando ha cambiado y nunca se queda con una versión vieja.
// Lo ejecuta web.yml sobre la copia que se publica; el repositorio conserva las rutas limpias.
//   node web/versionar.mjs web/sitio
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const root = process.argv[2] || 'web/sitio';
const REF = /(["'`(])(assets\/[\w\-./]+\.(?:js|css|mp4|jpe?g|png|webp|svg|json))(?=["'`)])/g;
// las fuentes ya llevan la huella en el nombre; las imágenes de la demo las nombra demo.js por partes
// (sellar solo algunas haría que se descargaran dos veces)
const NO_SELLAR = /^assets\/demo\//;
const huella = f => createHash('sha256').update(readFileSync(join(root, f))).digest('hex').slice(0, 10);

function sellar(file) {
  const src = readFileSync(join(root, file), 'utf8');
  let n = 0;
  const out = src.replace(REF, (m, q, p) => (!NO_SELLAR.test(p) && existsSync(join(root, p)) ? (n++, `${q}${p}?v=${huella(p)}`) : m));
  if (n) writeFileSync(join(root, file), out);
  return n;
}

// primero los scripts (nombran el vídeo y sus imágenes), después las páginas, que así ven los scripts ya sellados
const scripts = readdirSync(join(root, 'assets')).filter(f => f.endsWith('.js')).map(f => 'assets/' + f);
const pages = readdirSync(root).filter(f => f.endsWith('.html'));
for (const f of [...scripts, ...pages]) console.log(`${f}: ${sellar(f)}`);
