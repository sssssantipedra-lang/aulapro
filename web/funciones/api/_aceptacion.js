// La prueba de que se aceptaron las condiciones de venta y de uso y la política de privacidad (3-11-2026, revisión del
// abogado del dueño: «pondría una casillita que tengan que marcar expresamente, tanto los que pagan como los que entran
// gratis; así, si algún día tienes algún problema, puedes acreditar que las han aceptado»).
//
// La casilla está en la pantalla de entrada de la app (`src/pages/EntrarWeb.tsx`, y `AceptarCondiciones` para quien ya
// había entrado). La app manda la versión aceptada con la búsqueda de la licencia de su cuenta (`licencia/cuenta`), que
// ya comprueba con Google o Microsoft de quién es la cuenta. Aquí se guarda, por cuenta, qué versión se aceptó y cuándo.
//
// Qué se guarda (la privacidad lo explica): una huella del correo (no el correo), cada versión aceptada con su fecha y
// hora, y nada más. Se conserva mientras se use AulaPro y hasta seis años después de la última aceptación (el plazo
// para reclamar por un contrato es de cinco años), y después se borra.
import { huella } from './_limite.js';

export const PLAZO_ACEPTACION = 6 * 366 * 24 * 3600;
const VERSION = /^\d{4}-\d{2}-\d{2}$/;

export const claveAceptacion = async email => `aceptacion:${await huella(`correo:${String(email).trim().toLowerCase()}`)}`;

/** `true` si la versión tiene la forma de una fecha (`2026-11-03`). */
export const versionValida = v => typeof v === 'string' && VERSION.test(v);

/**
 * Anota que la cuenta `email` aceptó la `version`. `almacen` es `{ get(k), put(k, valor, ttlSeg) }`. Si esa versión ya
 * estaba anotada, se conserva su primera fecha. Devuelve `true` si queda anotada; si el almacén falla, `false` (y la app
 * lo volverá a mandar más tarde): nunca se deja a nadie sin entrar por un fallo de esto.
 */
export async function anotarAceptacion(almacen, email, version, ahora = new Date()) {
  if (!almacen || !email || !versionValida(version)) return false;
  try {
    const k = await claveAceptacion(email);
    const antes = (await almacen.get(k)) ?? {};
    const versiones = { ...(antes.versiones ?? {}) };
    versiones[version] ??= ahora.toISOString();
    const hasta = new Date(ahora.getTime() + PLAZO_ACEPTACION * 1000).toISOString();
    await almacen.put(k, { versiones, hasta }, PLAZO_ACEPTACION);
    return true;
  } catch {
    return false;
  }
}

/** El almacén sobre Cloudflare KV (el espacio `LIMITE`). */
export const aceptacionKv = kv => (kv ? {
  get: async k => { const v = await kv.get(k); return v == null ? null : JSON.parse(v); },
  put: (k, v, ttl) => kv.put(k, JSON.stringify(v), { expirationTtl: ttl }),
} : null);
