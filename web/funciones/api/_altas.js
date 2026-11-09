// Cuántos docentes se dan de alta en el acceso anticipado gratuito (petición del dueño, 9-11-2026: «necesito saber el
// número de personas que se dan de alta en la prueba gratuita»).
//
// Solo se cuenta, no se identifica a nadie: por cada alta se guarda una entrada con el día y un número al azar, y nada
// más (ni el correo, ni su huella, ni la IP, ni la hora). Ninguna entrada se puede relacionar con una persona ni con su
// aceptación de las condiciones, así que no es un dato personal y la privacidad no cambia (dice que no guardamos una lista
// de quienes usan el acceso anticipado, y esto no lo es). Una entrada por alta, y no un contador que se suma, porque ni
// Cloudflare KV ni Netlify Blobs suman a la vez sin perder altas.
//
// Qué es un alta: una cuenta que recibe la licencia de beta (`licencia/cuenta`) y que no tenía ninguna aceptación de las
// condiciones anotada (`registrarAceptacion` devuelve 'nueva'). La misma persona en otro dispositivo o al renovar la
// firma cada día no vuelve a contar. Quien ya había entrado antes (pruebas del dueño, fundadores) no cuenta.
//
// Cloudflare y Netlify tienen cada uno su almacén: el informe de cada uno cuenta las altas que pasaron por él (Netlify
// atiende casi todo; Cloudflare es el respaldo). La misma cuenta podría contar una vez en cada uno si un día le respondió
// el respaldo: es raro y se ve en el informe.
//
// Leerlo: `GET /api/licencia/altas` con `Authorization: Bearer <CLAVES_INFORME_SECRETO>`, o `node scripts/altas-beta.mjs`.
import { iguales } from './_vigilancia.js';

const PREFIJO = 'alta:';

/** El día de hoy en España (AAAA-MM-DD), que es lo que entiende el dueño por «el día». */
export const diaDe = (ahora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);

/**
 * Anota un alta. `almacen` es `{ put(k, valor), list(prefijo) }`. Si falla, no pasa nada: nunca se deja a nadie sin entrar
 * por esto. Devuelve `true` si queda anotada.
 */
export async function anotarAlta(almacen, ahora = new Date()) {
  if (!almacen) return false;
  try {
    await almacen.put(`${PREFIJO}${diaDe(ahora)}:${crypto.randomUUID()}`, 1);
    return true;
  } catch {
    return false;
  }
}

/** `{ total, dias: [{ dia, altas }] }`, del día más antiguo al más reciente. */
export async function contarAltas(almacen) {
  const porDia = new Map();
  for (const k of (await almacen?.list(PREFIJO)) ?? []) {
    const dia = k.slice(PREFIJO.length, PREFIJO.length + 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }
  const dias = [...porDia].sort(([a], [b]) => a.localeCompare(b)).map(([dia, altas]) => ({ dia, altas }));
  return { total: dias.reduce((s, d) => s + d.altas, 0), dias };
}

/** `GET /api/licencia/altas`: solo con el secreto del informe (el mismo que el de las claves compartidas). */
export async function responderAltas(request, secreto, almacen, cors = {}) {
  if (!secreto) return new Response('Not found', { status: 404, headers: cors });
  const cab = { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  const dado = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!dado || !iguales(dado, secreto)) return new Response('{"error":"no-autorizado"}', { status: 401, headers: cab });
  const informe = await contarAltas(almacen).catch(() => null);
  if (!informe) return new Response('{"error":"almacen"}', { status: 503, headers: cab });
  return new Response(JSON.stringify({ hoy: diaDe(), ...informe }), { headers: cab });
}

/** El almacén sobre Cloudflare KV (el espacio `LIMITE`, con su propio prefijo). Sin caducidad: no hay datos personales. */
export const altasKv = kv => (kv ? {
  put: (k, v) => kv.put(k, JSON.stringify(v)),
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
