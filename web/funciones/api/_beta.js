// Acceso anticipado gratuito (beta) de la versión web, hasta que se abra la venta (decisión del dueño, 5-11-2026).
//
// Por qué existe: el dueño necesita la resolución de la Conselleria antes de cobrar, así que la app sale el 10-11-2026 sin
// cobrar. Cualquier docente entra con su cuenta de Google o Microsoft, sin tarjeta y sin pagar. Y el día que se abra la
// venta, TODO el que entró así queda bloqueado y tiene que suscribirse para seguir.
//
// Cómo se corta (cuatro capas; las tres primeras las decide el servidor, no el navegador):
//   1. El servidor deja de dar firmas de beta (`licenciaBeta`, en `licencia/cuenta`) en cuanto `abierta` es `false`.
//   2. La puerta del código (`_puerta.js`) deja de servir el código de las pantallas a una sesión de beta, aunque su
//      cookie no haya caducado, y `licencia/sesion` ya no crea sesiones de beta.
//   3. La app pregunta cada 15 minutos a `licencia/estado?tipo=beta` y, si el servidor dice que la beta terminó, se
//      bloquea ya (`platform/androidLicense.ts`), con la app abierta. Y al abrir, antes de dejar pasar.
//   4. Aunque nada de lo anterior contestara (sin conexión), la firma de beta caduca a los `dias` días (3) o en `hasta`,
//      lo que llegue antes: sin renovarla con el servidor, a los 3 días la app no abre.
//
// Qué NO se guarda: ningún correo ni lista de la beta. La firma lleva el correo de quien la pidió, pero solo se la queda su
// navegador. Es lo que dice la privacidad («no tenemos una base de datos de usuarios»). La aceptación de las condiciones se
// anota como siempre (una huella del correo, `_aceptacion.js`).
//
// EL INTERRUPTOR: `abierta`. Para abrir la venta se pone en `false` en el MISMO cambio que rellena `checkout` en
// `web/sitio/assets/launch.js` y pone `VENTA_ABIERTA = true` en `src/platform/cuentaWeb.ts` (`node scripts/abrir-venta.mjs`
// hace los tres a la vez). Es una constante del código y no una variable del panel de Netlify o Cloudflare a propósito: un
// cambio de variable también exige una publicación nueva, y así el cierre va junto a la apertura de la venta, en el mismo
// despliegue, y se revisa y se prueba como el resto.
import { firmar } from './_firma.js';

/** La «clave» que guarda la app para este tipo de licencia (como `fundador`). */
export const BETA = 'beta';

/**
 * - `abierta`: la beta está abierta. `false` = cerrada para todos, ya.
 * - `hasta`: tope opcional (fecha ISO, p. ej. '2027-01-31T23:59:59+01:00'). `null` = sin fecha. Una fecha ilegible cuenta
 *   como cerrada (mejor cortar que dejar entrar de más).
 * - `dias`: lo que vale una firma de beta sin renovarla (la app la renueva sola cada día con conexión).
 */
export const CONFIG_BETA = Object.freeze({ abierta: true, hasta: null, dias: 3 });

/** ¿Se está dando acceso anticipado ahora? */
export function betaVigente(ahora = Date.now(), cfg = CONFIG_BETA) {
  if (!cfg.abierta) return false;
  if (cfg.hasta == null) return true;
  const fin = Date.parse(cfg.hasta);
  return Number.isFinite(fin) && ahora < fin;
}

/** Hasta cuándo vale una firma de beta pedida ahora (segundos): `dias` días, o `hasta` si llega antes. */
export function caducidadBeta(ahora = Date.now(), cfg = CONFIG_BETA) {
  const tope = Math.floor(ahora / 1000) + cfg.dias * 86400;
  if (cfg.hasta == null) return tope;
  const fin = Math.floor(Date.parse(cfg.hasta) / 1000);
  return Number.isFinite(fin) ? Math.min(tope, fin) : tope;
}

/**
 * La licencia de beta de una cuenta ya verificada con Google o Microsoft, o `null` si la beta está cerrada o el servidor no
 * tiene secreto para firmar (entonces no se da nada: nunca una licencia sin firma).
 */
export async function licenciaBeta(email, secretos, ahora = Date.now(), cfg = CONFIG_BETA) {
  if (!email || !betaVigente(ahora, cfg)) return null;
  const exp = caducidadBeta(ahora, cfg);
  const firma = await firmar({ t: 'cuenta', email, beta: true, exp }, secretos, ahora);
  return firma ? { firma, hasta: exp * 1000 } : null;
}

/** `{ bloqueada }` para `licencia/estado?tipo=beta`: la app se bloquea si es `true`. */
export const estadoBeta = (ahora = Date.now(), cfg = CONFIG_BETA) => ({ bloqueada: !betaVigente(ahora, cfg) });
