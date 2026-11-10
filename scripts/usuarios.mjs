#!/usr/bin/env node
// El registro de usuarios de AulaPro (web/funciones/api/_usuarios.js): quién la usa y cuánto.
//
//   node scripts/usuarios.mjs                       el resumen y la lista de docentes
//   node scripts/usuarios.mjs csv > usuarios.csv    la lista en CSV, para Excel
//   node scripts/usuarios.mjs borrar correo@x.es    borra a un docente (si pide que se borren sus datos)
//   node scripts/usuarios.mjs excluir correo@x.es   lo borra y deja de apuntarlo (si se opone al registro)
//
// Necesita la variable USUARIOS_INFORME_SECRETO (el mismo valor que en Netlify y Cloudflare). En PowerShell:
//   $env:USUARIOS_INFORME_SECRETO="..."; node scripts/usuarios.mjs
//
// Pregunta a aulapro.app (Netlify) y al respaldo de Cloudflare y junta lo de los dos. Los correos salen en pantalla: no
// guardes el CSV en carpetas compartidas ni lo subas al repositorio.
import { aCsv, analizar, fusionar } from '../web/sitio/assets/informe-usuarios.js';

const SERVIDORES = [
  ['aulapro.app (Netlify)', 'https://aulapro.app/api/licencia/usuarios'],
  ['Respaldo (Cloudflare)', 'https://aulapro-app.pages.dev/api/licencia/usuarios'],
];

const secreto = process.env.USUARIOS_INFORME_SECRETO;
if (!secreto) {
  console.error('Falta USUARIOS_INFORME_SECRETO (el mismo valor que en Netlify y Cloudflare). Ver docs/MANTENIMIENTO.md.');
  process.exit(1);
}
const cab = { Authorization: `Bearer ${secreto}` };
const [orden = 'informe', correo] = process.argv.slice(2);

if (orden === 'borrar' || orden === 'excluir') {
  if (!correo) { console.error(`Uso: node scripts/usuarios.mjs ${orden} correo@ejemplo.es`); process.exit(1); }
  let fallos = 0;
  for (const [nombre, url] of SERVIDORES) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { ...cab, 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: orden, correo }) });
      console.log(`${nombre}: ${r.ok ? 'hecho' : `no se pudo (${r.status})`}`);
      if (!r.ok) fallos++;
    } catch (e) {
      console.log(`${nombre}: no responde (${e.message})`);
      fallos++;
    }
  }
  if (fallos) console.log('\nVuelve a ejecutarlo cuando respondan los dos: el registro está en cada uno por separado.');
  process.exit(fallos ? 1 : 0);
}

const listas = [];
let hoy;
for (const [nombre, url] of SERVIDORES) {
  try {
    const r = await fetch(url, { headers: cab });
    if (!r.ok) { console.error(`${nombre}: no responde (${r.status})`); continue; }
    const j = await r.json();
    hoy = j.hoy;
    listas.push(j.usuarios);
  } catch (e) {
    console.error(`${nombre}: no se pudo consultar (${e.message})`);
  }
}
if (!listas.length) process.exit(1);
const informe = analizar(fusionar(...listas), hoy);

if (orden === 'csv') {
  process.stdout.write('﻿' + aCsv(informe) + '\r\n');   // con BOM, para que Excel lea bien las tildes
  process.exit(0);
}

const r = informe.resumen;
const horas = m => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
console.log(`\nAulaPro a ${informe.hoy}`);
console.log(`  Usuarios: ${r.usuarios}  (${Object.entries(r.porTipo).map(([t, n]) => `${t}: ${n}`).join(', ')})`);
console.log(`  Han entrado hoy: ${r.activosHoy} · en 7 días: ${r.activos7} · en 30 días: ${r.activos30}`);
console.log(`  Horas de uso en los últimos 7 días: ${r.horas7}`);
console.log(`  Estado: ${Object.entries(r.porEstado).map(([e, n]) => `${e}: ${n}`).join(', ')}`);
console.log('\n  Siguen una semana después de darse de alta:');
for (const c of r.retencion) console.log(`    semana del ${c.semana}: ${c.altas} altas, ${c.porcentaje == null ? 'aún no ha pasado una semana' : `${c.siguen} de ${c.conUnaSemana} (${c.porcentaje} %)`}`);
console.log('\n  #    Correo                               Tipo          Alta        Último día  Estado     Frecuencia  Días  Racha  Uso 7 días');
for (const f of informe.usuarios) {
  console.log(`  ${String(f.n).padEnd(4)} ${f.email.padEnd(36).slice(0, 36)} ${f.tipo.padEnd(13)} ${f.alta}  ${f.ultimoDia}  ${f.estado.padEnd(10)} ${f.frecuencia.padEnd(11)} ${String(f.diasDeUso).padStart(4)}  ${String(f.racha).padStart(5)}  ${horas(f.minutos7)}`);
}
console.log('\nEstados: nuevo (alta hace menos de 7 días), activo (la usó en los últimos 7), en riesgo (hace 8 a 21 días), perdido (más de 21).');
console.log('Frecuencia: días de uso por semana en las últimas 4: habitual (3 o más), semanal (1 o más), ocasional.');
