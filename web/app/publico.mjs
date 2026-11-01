// Copia la lista de lo que /app/assets/ entrega sin sesión (dist-web/publico.json, la saca vite.config.ts)
// a web/funciones/_publico.js, que importan la puerta de Cloudflare y la de Netlify. Se ejecuta al publicar
// (web.yml y netlify.toml), después de compilar. Si la lista no está, para: publicar sin ella dejaría la
// puerta abierta sin que nadie se enterara.
//
//   node web/app/publico.mjs dist-web
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const dist = process.argv[2] || 'dist-web';
const lista = JSON.parse(readFileSync(join(dist, 'publico.json'), 'utf8'));
if (!Array.isArray(lista) || !lista.length || !lista.every(f => typeof f === 'string' && /^assets\/.+\.m?js$/.test(f))) {
  console.error('publico.json no es una lista de bloques de assets/');
  process.exit(1);
}
const destino = new URL('../funciones/_publico.js', import.meta.url);
writeFileSync(destino, `// Generado por web/app/publico.mjs al publicar: no editar.\nexport default ${JSON.stringify(lista, null, 2)};\n`);
console.log(`✔ Puerta de /app/: ${lista.length} bloques de código públicos (entrar y comprar); el resto, con sesión`);
