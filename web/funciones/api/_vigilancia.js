// Vigilancia de claves compartidas (auditoría del 1-11-2026, M4; decisión del dueño del mismo día: «B, medir»).
//
// Una comprobación de la clave sin número de activación (`validate` sin `instance_id`) recibe la firma de AulaPro, porque
// así se renueva la licencia de la cuenta, que no ocupa activaciones. Eso no deja rastro en Lemon Squeezy: una clave
// pasada a otras personas y usada así por alguien que sepa programar no se vería en su panel. Aquí se cuenta, por cada
// clave y cada semana, desde cuántas conexiones distintas llega esa comprobación. Un docente con su casa, el colegio
// y el móvil no pasa de unas pocas; si una clave pasa de `TOPE_CONEXIONES`, queda anotada para que la revise el
// dueño (o el agente de la oficina que lea el informe: `GET /api/licencia/sospechosas`).
//
// Qué se guarda (la privacidad lo explica): de cada comprobación, una huella de la clave y una huella corta de la IP,
// nunca la IP ni la clave en claro, y se borra a las 3 semanas. Solo de una clave que pasa del tope se guarda, además,
// su principio y su final («ABCD1234…WXYZ», para encontrarla en Lemon Squeezy), durante 8 semanas.
//
// Por defecto solo se anota. Con la variable `CLAVES_CORTAR_AL_TOPE=si` (en Netlify y en Cloudflare), una clave que
// pasa del tope deja de recibir la firma esa semana (la app pide entonces la licencia). La decisión es del dueño.
import { huella } from './_limite.js';

export const TOPE_CONEXIONES = 15;
const SEMANA = 7 * 24 * 3600;
const GUARDAR_USO = 3 * SEMANA;
const GUARDAR_SOSPECHA = 8 * SEMANA;
/** Por encima de esto no hace falta seguir apuntando conexiones: ya se sabe que es demasiado. */
const MAX_APUNTADAS = 100;

export const semanaDe = (ahoraMs = Date.now()) => Math.floor(ahoraMs / 1000 / SEMANA);
export const recortarClave = key => (key.length > 14 ? `${key.slice(0, 8)}…${key.slice(-4)}` : '…');
export const cortarAlTope = valor => String(valor ?? '').trim().toLowerCase() === 'si';

/**
 * Apunta una comprobación sin activación. `almacen` es `{ get(k), put(k, valor, ttlSeg), list(prefijo) }` (ver
 * `almacenKv` aquí y `almacenBlobs` en lib-netlify). Devuelve cuántas conexiones distintas lleva la clave esta semana y
 * si pasa del tope. Si el almacén falla, no pasa nada: nunca se deja a nadie sin licencia por un fallo de esto.
 */
export async function anotarComprobacion(almacen, key, ip, ahoraMs = Date.now()) {
  if (!almacen || !key) return { conexiones: 0, pasada: false };
  try {
    const semana = semanaDe(ahoraMs);
    const hk = await huella(`clave:${key}`);
    const hip = (await huella(`ip:${ip || 'desconocida'}`)).slice(0, 12);
    const k = `uso:${semana}:${hk}`;
    const ips = (await almacen.get(k)) ?? [];
    if (!ips.includes(hip) && ips.length < MAX_APUNTADAS) {
      ips.push(hip);
      await almacen.put(k, ips, GUARDAR_USO);
    }
    const pasada = ips.length > TOPE_CONEXIONES;
    if (pasada) {
      await almacen.put(`sospechosa:${semana}:${hk}`, { clave: recortarClave(key), conexiones: ips.length, semana, vista: new Date(ahoraMs).toISOString() }, GUARDAR_SOSPECHA);
    }
    return { conexiones: ips.length, pasada };
  } catch {
    return { conexiones: 0, pasada: false };
  }
}

/** Las claves anotadas de las últimas 8 semanas, de la más reciente a la más antigua. */
export async function clavesSospechosas(almacen, ahoraMs = Date.now()) {
  if (!almacen) return [];
  const desde = semanaDe(ahoraMs) - 8;
  const out = [];
  for (const k of await almacen.list('sospechosa:')) {
    if (Number(k.split(':')[1]) < desde) continue;
    const v = await almacen.get(k);
    if (v) out.push(v);
  }
  return out.sort((a, b) => b.semana - a.semana || b.conexiones - a.conexiones);
}

/** Comparación sin atajos de tiempo, para el secreto del informe. */
function iguales(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

/**
 * `GET /api/licencia/sospechosas` con `Authorization: Bearer <CLAVES_INFORME_SECRETO>`. Sin la variable puesta en el
 * servidor, la dirección no existe (404); con un secreto equivocado, 401.
 */
export async function responderInforme(request, secreto, almacen, cors = {}) {
  if (!secreto) return new Response('Not found', { status: 404, headers: cors });
  const dado = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!dado || !iguales(dado, secreto)) return new Response('{"error":"no-autorizado"}', { status: 401, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
  const claves = await clavesSospechosas(almacen).catch(() => []);
  return new Response(JSON.stringify({ tope: TOPE_CONEXIONES, semana: semanaDe(), claves }), {
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** El almacén sobre Cloudflare KV (el mismo espacio `LIMITE` que los contadores, con otro prefijo). */
export const almacenKv = kv => (kv ? {
  get: async k => { const v = await kv.get(k); return v == null ? null : JSON.parse(v); },
  put: (k, v, ttl) => kv.put(k, JSON.stringify(v), { expirationTtl: ttl }),
  list: async prefijo => {
    const out = [];
    let cursor;
    do {
      const r = await kv.list({ prefix: prefijo, cursor });
      out.push(...r.keys.map(x => x.name));
      cursor = r.list_complete ? undefined : r.cursor;
    } while (cursor);
    return out;
  },
} : null);
