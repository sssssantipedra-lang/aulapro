// Bloqueo al momento de las licencias que Lemon Squeezy da por terminadas (petición del dueño, 2-11-2026: «desactivando la
// licencia podía seguir entrando»).
//
// Lemon Squeezy avisa a `POST /api/licencia/aviso` (un webhook firmado con `LEMONSQUEEZY_WEBHOOK_SECRET`) cuando cambia
// una clave, un pedido o una suscripción. No nos fiamos del nombre del aviso: con el número de pedido se pregunta a la
// tienda cómo están ahora sus claves (`LEMONSQUEEZY_API_KEY`) y se copia ese estado aquí. Una clave anulada, devuelta o
// caducada queda en la lista de bloqueadas; si vuelve a valer (se renueva, se reactiva), sale de ella.
//
// La lista se usa en tres sitios: la comprobación de la clave (`conFirma`) y la búsqueda por correo (`cuenta`) no dan la
// firma a una clave bloqueada, y la app pregunta cada 15 minutos a `POST /api/licencia/estado`, que solo lee esta
// lista (sin llamar a Lemon Squeezy), y se bloquea al momento si la suya está. Se guarda una huella de la clave, no la
// clave.
import { huella } from './_limite.js';

const LS = 'https://api.lemonsqueezy.com/v1';
const UN_ANIO = 400 * 24 * 3600;

const claveDe = async key => `bloqueo:${await huella(`clave:${key}`)}`;

/** `true` si la clave está en la lista. Si el almacén falla, `false`: nunca se deja a nadie fuera por un fallo de esto. */
export async function estaBloqueada(almacen, key) {
  if (!almacen || !key) return false;
  try { return !!(await almacen.get(await claveDe(key))); } catch { return false; }
}

/** Cómo está una clave según los datos de la tienda (`attributes` de un license-key). */
export const claveTerminada = a => !!a && (a.disabled === true || ['disabled', 'expired'].includes(String(a.status ?? '')));

async function anotar(almacen, key, terminada, cuenta) {
  if (!key) return;
  const k = await claveDe(key);
  if (terminada) await almacen.put(k, { desde: new Date().toISOString() }, UN_ANIO);
  else await almacen.del(k);
  if (cuenta) cuenta[terminada ? 'bloqueadas' : 'desbloqueadas'].add(k);
}

/** HMAC-SHA256 en hexadecimal del cuerpo tal cual llega, comparado sin atajos de tiempo. */
export async function firmaDeAvisoValida(cuerpo, firmaHex, secreto) {
  if (!secreto || !firmaHex) return false;
  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(cuerpo)));
  const esperada = [...mac].map(b => b.toString(16).padStart(2, '0')).join('');
  const dada = String(firmaHex).trim().toLowerCase();
  let d = esperada.length ^ dada.length;
  for (let i = 0; i < Math.max(esperada.length, dada.length); i++) d |= (esperada.charCodeAt(i) || 0) ^ (dada.charCodeAt(i) || 0);
  return d === 0;
}

/** El número de pedido de un aviso: el de la clave o la suscripción, o el propio pedido. */
export function pedidoDelAviso(evento) {
  const tipo = String(evento?.data?.type ?? '');
  const a = evento?.data?.attributes ?? {};
  if (tipo === 'orders') return String(evento.data.id ?? '');
  return a.order_id != null ? String(a.order_id) : '';
}

/**
 * Pone al día la lista con un aviso de Lemon Squeezy. Si el aviso es de una clave, se aplica su estado al momento; después,
 * con el número de pedido, se copia el estado de todas sus claves según la tienda. Lanza si la tienda no contesta, para
 * que el aviso se devuelva con error y Lemon Squeezy lo reintente. Devuelve cuántas claves han quedado bloqueadas y
 * cuántas libres (para el registro de la función).
 */
export async function procesarAviso(evento, { almacen, apiKey, pedir = fetch }) {
  const cuenta = { bloqueadas: new Set(), desbloqueadas: new Set() };
  const resumen = () => ({ bloqueadas: cuenta.bloqueadas.size, desbloqueadas: cuenta.desbloqueadas.size });
  const a = evento?.data?.attributes ?? {};
  if (evento?.data?.type === 'license-keys' && a.key) await anotar(almacen, a.key, claveTerminada(a), cuenta);
  const pedido = pedidoDelAviso(evento);
  if (!pedido || !apiKey) return resumen();
  const r = await pedir(`${LS}/license-keys?filter[order_id]=${encodeURIComponent(pedido)}`, {
    headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${apiKey}` },
  });
  if (!r.ok) throw new Error(`tienda ${r.status}`);
  // La tienda manda: lo que diga ahora de cada clave sustituye a lo que traía el aviso
  cuenta.bloqueadas.clear(); cuenta.desbloqueadas.clear();
  for (const k of (await r.json()).data ?? []) await anotar(almacen, k.attributes?.key, claveTerminada(k.attributes), cuenta);
  return resumen();
}

/**
 * Una línea en el registro de la función (Netlify › Logs › Functions › licencia) por cada aviso: su nombre y el resultado.
 * Nunca la clave, el correo ni el número de pedido. Petición del dueño, 2-11-2026, para poder comprobar que llegan.
 */
const registrar = texto => { try { console.log(`[aviso Lemon Squeezy] ${texto}`); } catch { /* sin consola */ } };

const json = (cuerpo, status, headers = {}) => new Response(JSON.stringify(cuerpo), {
  status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

/** `POST /api/licencia/aviso`: el webhook de Lemon Squeezy. Sin el secreto configurado, la dirección no existe. */
export async function responderAviso(request, { secreto, apiKey, almacen }) {
  if (!secreto) return new Response('Not found', { status: 404 });
  if (request.method !== 'POST') return json({ error: 'metodo' }, 405);
  const cuerpo = await request.text();
  if (cuerpo.length > 200_000 || !(await firmaDeAvisoValida(cuerpo, request.headers.get('X-Signature'), secreto))) {
    registrar('rechazado: la firma no coincide con LEMONSQUEEZY_WEBHOOK_SECRET');
    return json({ error: 'firma' }, 401);
  }
  let evento;
  try { evento = JSON.parse(cuerpo); } catch { registrar('rechazado: no es JSON'); return json({ error: 'cuerpo' }, 400); }
  const nombre = String(evento?.meta?.event_name ?? '').replace(/[^a-z_]/gi, '').slice(0, 60) || 'sin nombre';
  if (!almacen) { registrar(`${nombre} · error: sin almacén`); return json({ error: 'sin-almacen' }, 503); }
  let r;
  try { r = await procesarAviso(evento, { almacen, apiKey }); } catch {
    registrar(`${nombre} · error: Lemon Squeezy no contestó (lo volverá a enviar)`);
    return json({ error: 'tienda' }, 502);
  }
  const n = (x, uno, varios) => `${x} ${x === 1 ? uno : varios}`;
  registrar(`${nombre} · ${n(r.bloqueadas, 'clave bloqueada', 'claves bloqueadas')}, ${n(r.desbloqueadas, 'desbloqueada', 'desbloqueadas')}${apiKey ? '' : ' (sin LEMONSQUEEZY_API_KEY: solo lo que trae el aviso)'}`);
  return json({ ok: true }, 200);
}

/** `POST /api/licencia/estado` con `license_key`: si está bloqueada. Solo lee la lista. */
export async function responderEstado(salida, almacen, cors = {}) {
  return json({ bloqueada: await estaBloqueada(almacen, salida.get('license_key') || '') }, 200, cors);
}

/** El almacén sobre Cloudflare KV (`LIMITE`, con su prefijo). */
export const bloqueosKv = kv => (kv ? {
  get: async k => { const v = await kv.get(k); return v == null ? null : JSON.parse(v); },
  put: (k, v, ttl) => kv.put(k, JSON.stringify(v), { expirationTtl: ttl }),
  del: k => kv.delete(k),
} : null);
