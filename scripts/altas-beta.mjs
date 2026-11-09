#!/usr/bin/env node
// Cuántos docentes se han dado de alta en el acceso anticipado gratuito (web/funciones/api/_altas.js).
//
//   CLAVES_INFORME_SECRETO=… node scripts/altas-beta.mjs
//
// Pregunta a aulapro.app (Netlify) y al respaldo de Cloudflare, y enseña el total y las altas de cada día. Solo hay
// números: el servidor no guarda quién se da de alta.
const secreto = process.env.CLAVES_INFORME_SECRETO;
if (!secreto) {
  console.error('Falta CLAVES_INFORME_SECRETO (el mismo valor que en Netlify y Cloudflare). Ver docs/MANTENIMIENTO.md.');
  process.exit(1);
}

const SERVIDORES = [
  ['aulapro.app (Netlify)', 'https://aulapro.app/api/licencia/altas'],
  ['Respaldo (Cloudflare)', 'https://aulapro-app.pages.dev/api/licencia/altas'],
];

let total = 0;
for (const [nombre, url] of SERVIDORES) {
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${secreto}` } });
    if (!r.ok) { console.log(`${nombre}: no responde (${r.status})`); continue; }
    const { dias } = await r.json();
    const suma = dias.reduce((s, d) => s + d.altas, 0);
    total += suma;
    console.log(`\n${nombre}: ${suma} altas`);
    for (const { dia, altas } of dias) console.log(`  ${dia}  ${String(altas).padStart(4)}`);
  } catch (e) {
    console.log(`${nombre}: no se pudo consultar (${e.message})`);
  }
}
console.log(`\nTotal: ${total} docentes dados de alta en el acceso anticipado.`);
