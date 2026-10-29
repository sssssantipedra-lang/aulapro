/**
 * Iconos de la versión web instalable (aulapro.app/app/), a partir del logo
 * pequeño (`public/favicon-mini.svg`). Se guardan en `web/app/` y los copia la
 * compilación para la web (vite.config.ts, modo `web`). Si cambia el logo:
 *
 *   node scripts/web/iconos-app.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SALIDA = path.join(RAIZ, 'web/app');
const svg = fs.readFileSync(path.join(RAIZ, 'public/favicon-mini.svg'), 'utf8');
const cuadrado = svg.replace(/ rx="112"/, ' rx="0"');
// Para la máscara de Android, el dibujo al 80 % sobre el fondo entero: la máscara recorta los bordes
const conMargen = svg
  .replace(/<rect width="512" height="512" rx="112" fill="url\(#bg\)"\/>/, '')
  .replace('</defs>', '</defs><rect width="512" height="512" fill="url(#bg)"/><g transform="translate(51.2 51.2) scale(0.8)">')
  .replace('</svg>', '</g></svg>');

const png = (fuente, lado) => sharp(Buffer.from(fuente), { density: 384 }).resize(lado, lado).png().toBuffer();

// Con esquinas: lo que se ve tal cual (Windows, Mac, la pestaña)
fs.writeFileSync(path.join(SALIDA, 'icono-192.png'), await png(svg, 192));
fs.writeFileSync(path.join(SALIDA, 'icono-512.png'), await png(svg, 512));
// Sin esquinas: Android y el iPhone ponen su propia máscara
fs.writeFileSync(path.join(SALIDA, 'icono-mascara-512.png'), await png(conMargen, 512));
fs.writeFileSync(path.join(SALIDA, 'icono-180.png'), await png(cuadrado, 180));
console.log('Iconos en', SALIDA);
