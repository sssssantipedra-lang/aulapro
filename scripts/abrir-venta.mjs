#!/usr/bin/env node
// Abre la venta de AulaPro y cierra a la vez el acceso anticipado gratuito (beta). Es el día de la apertura: quien entró gratis
// queda bloqueado y tiene que suscribirse (docs/MANTENIMIENTO.md, «Abrir la venta»).
//
//   node scripts/abrir-venta.mjs              enseña qué cambiaría, sin tocar nada
//   node scripts/abrir-venta.mjs --aplicar    lo escribe en los archivos
//
// Son TRES interruptores y se cambian siempre juntos (una venta abierta con la beta abierta dejaría entrar gratis a quien debe pagar;
// la beta cerrada con la venta cerrada dejaría a todo el mundo fuera):
//   1. web/funciones/api/_beta.js       CONFIG_BETA.abierta  true  → false   (el servidor deja de dar y de aceptar el acceso gratuito)
//   2. src/platform/cuentaWeb.ts        VENTA_ABIERTA        false → true    (la pantalla de licencia enseña el botón de compra)
//                                       ACCESO_ANTICIPADO    true  → false   (la entrada deja de decir que es gratis)
//   3. web/sitio/assets/launch.js       checkout y packs: los enlaces de pago; acceso: 'app/' → ''  (la portada vende en vez de «Prueba gratis»)
//
// Después: pull request, fusión a `master` (Netlify publica) y, en Lemon Squeezy, los productos activos (docs/MANTENIMIENTO.md).
// Antes de fusionar, `npm test` comprueba que los tres interruptores quedan coherentes (web/pruebas/interruptores.test.js).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

export const ARCHIVOS = {
  beta: 'web/funciones/api/_beta.js',
  app: 'src/platform/cuentaWeb.ts',
  portada: 'web/sitio/assets/launch.js',
};

/** Los enlaces de pago de la oferta de lanzamiento (Lemon Squeezy). Aquí y no en `launch.js`, que lo sirve la web a todo el mundo. */
export const ENLACES = {
  checkout: 'https://aulapro.lemonsqueezy.com/checkout/buy/b8296834-4f9d-4563-86e3-c798fb243781?enabled=2308832',
  pack5: 'https://aulapro.lemonsqueezy.com/checkout/buy/61f76d20-1ea7-48f7-86a5-e2a0b24dad68?enabled=2308833&checkout%5Bdiscount_code%5D=LANZAMIENTO5',
  pack10: 'https://aulapro.lemonsqueezy.com/checkout/buy/72657643-da0a-4803-9868-7762162ee184?enabled=2308835&checkout%5Bdiscount_code%5D=LANZAMIENTO10',
};

const un = (texto, re, que) => {
  const m = texto.match(re);
  if (!m) throw new Error(`No encuentro ${que}. ¿Ha cambiado el archivo? Revisa ${que} a mano.`);
  return m;
};

/** Cómo están hoy los tres interruptores, leídos de los textos de los archivos (`{ beta, app, portada }`). */
export function estadoDe({ beta, app, portada }) {
  return {
    betaAbierta: un(beta, /export const CONFIG_BETA = Object\.freeze\(\{\s*abierta: (true|false)/, 'CONFIG_BETA.abierta')[1] === 'true',
    ventaAbierta: un(app, /export const VENTA_ABIERTA = (true|false);/, 'VENTA_ABIERTA')[1] === 'true',
    accesoAnticipado: un(app, /export const ACCESO_ANTICIPADO = (true|false);/, 'ACCESO_ANTICIPADO')[1] === 'true',
    checkout: un(portada, /^\s*checkout: '([^']*)',/m, 'checkout')[1],
    acceso: un(portada, /^\s*acceso: '([^']*)',/m, 'acceso')[1],
    pack5: un(portada, /packs: \{ 5: '([^']*)', 10: '([^']*)' \}/, 'packs')[1],
    pack10: un(portada, /packs: \{ 5: '([^']*)', 10: '([^']*)' \}/, 'packs')[2],
  };
}

/** Los problemas de coherencia entre los tres interruptores (lista vacía = bien). Lo usa el script y la prueba. */
export function incoherencias(e) {
  const p = [];
  if (e.ventaAbierta && e.betaAbierta) p.push('La venta está abierta y la beta también: quien entró gratis seguiría entrando sin pagar.');
  if (!e.ventaAbierta && !e.betaAbierta) p.push('La venta está cerrada y la beta también: nadie (salvo los fundadores) podría entrar.');
  if (e.accesoAnticipado !== e.betaAbierta) p.push('ACCESO_ANTICIPADO (la app) no coincide con CONFIG_BETA.abierta (el servidor).');
  if (e.ventaAbierta !== !!e.checkout) p.push('VENTA_ABIERTA (la app) no coincide con checkout (la portada).');
  if (e.betaAbierta !== !!e.acceso) p.push('La portada no coincide con la beta: «acceso» tiene que estar relleno solo con la beta abierta.');
  if (e.ventaAbierta && (!e.pack5 || !e.pack10)) p.push('La venta está abierta pero falta el enlace de algún pack.');
  return p;
}

/** Los textos de los tres archivos con la venta abierta y la beta cerrada. Lanza si ya estaba abierta o si algo no encaja. */
export function abrirLaVenta(textos) {
  const antes = estadoDe(textos);
  if (antes.ventaAbierta || !antes.betaAbierta) throw new Error('La venta ya está abierta o la beta ya está cerrada: nada que hacer.');
  const reemplazar = (texto, re, nuevo) => { if (!re.test(texto)) throw new Error(`No encuentro ${re}`); return texto.replace(re, nuevo); };
  const salida = {
    beta: reemplazar(textos.beta, /(export const CONFIG_BETA = Object\.freeze\(\{\s*abierta: )true/, '$1false'),
    app: reemplazar(reemplazar(textos.app, /export const VENTA_ABIERTA = false;/, 'export const VENTA_ABIERTA = true;'),
      /export const ACCESO_ANTICIPADO = true;/, 'export const ACCESO_ANTICIPADO = false;'),
    portada: reemplazar(reemplazar(reemplazar(textos.portada,
      /^(\s*)checkout: '',/m, `$1checkout: '${ENLACES.checkout}',`),
      /^(\s*)acceso: '[^']*',/m, "$1acceso: '',"),
      /packs: \{ 5: '', 10: '' \}/, `packs: { 5: '${ENLACES.pack5}', 10: '${ENLACES.pack10}' }`),
  };
  const despues = incoherencias(estadoDe(salida));
  if (despues.length) throw new Error(`El resultado no es coherente:\n- ${despues.join('\n- ')}`);
  return salida;
}

/* ── Línea de órdenes ── */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const leer = () => Object.fromEntries(Object.entries(ARCHIVOS).map(([k, ruta]) => [k, readFileSync(join(RAIZ, ruta), 'utf8')]));
  try {
    const antes = leer();
    const despues = abrirLaVenta(antes);
    const aplicar = process.argv.includes('--aplicar');
    for (const k of Object.keys(ARCHIVOS)) console.log(`${antes[k] === despues[k] ? '=' : '✎'} ${ARCHIVOS[k]}`);
    if (!aplicar) {
      console.log('\nNo se ha escrito nada. Para aplicarlo: node scripts/abrir-venta.mjs --aplicar');
    } else {
      for (const k of Object.keys(ARCHIVOS)) writeFileSync(join(RAIZ, ARCHIVOS[k]), despues[k]);
      console.log('\nHecho. Ahora: npm test, pull request a master y, en Lemon Squeezy, los productos activos (docs/MANTENIMIENTO.md).');
    }
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exit(1);
  }
}
