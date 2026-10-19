/**
 * Reglas de la licencia, sin nada de Electron ni de disco, para poder
 * probarlas (ver `electron/license.cjs`, que es quien guarda y llama a la
 * tienda).
 *
 * Un equipo puede tener dos tipos de registro:
 *
 *   - `fundador`: docentes que ya usaban Aula Pro antes de que se vendiera.
 *     Nunca ven la pantalla de activación en ese ordenador.
 *   - `licencia`: se activó con una clave comprada en la web. Se comprueba con
 *     la tienda cada semana; sin internet sigue funcionando, sin límite de tiempo.
 *     Las de por vida no caducan (`expiresAt` vacío). Las anuales (desde el
 *     16-4-2027) guardan la fecha de caducidad que da la tienda; si pasa sin
 *     renovar, el estado es `caducada`: los datos se abren y se exportan
 *     siempre, y lo que se bloquea son las funciones de IA y crear perfiles.
 *
 * Los dos van atados a la huella del equipo: copiar la carpeta de datos (o el
 * pendrive con la versión portable) a otro ordenador no se lleva la licencia.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Cada cuánto se pregunta a la tienda (si hay conexión) si la clave sigue siendo buena. */
const CHECK_EVERY = 7 * DAY;
/** Desde cuántos días antes de caducar se avisa y se comprueba en cada arranque (por si ya renovó). */
const RENEW_WARN_DAYS = 14;

/**
 * ¿Puede este equipo quedar como fundador sin pedir clave?
 *
 * - Mientras no se venda (`enforced` en falso), todo equipo que abra la
 *   aplicación queda como fundador: es la fase de prueba con los compañeros.
 * - Ya a la venta, cuenta también quien tenga un perfil creado antes de
 *   `founderCutoff`: así no se le pide clave a quien pasó meses sin abrirla
 *   (o, en Mac, sin actualizar) y llega directamente a la versión de pago.
 */
function canBeFounder({ enforced, founderCutoff, profiles }) {
  if (!enforced) return true;
  if (!founderCutoff) return false;
  const cutoff = Date.parse(founderCutoff);
  return (profiles || []).some(p => {
    const t = Date.parse(p && p.createdAt);
    return Number.isFinite(t) && t < cutoff;
  });
}

/**
 * Estado de la licencia en este equipo.
 *
 * @returns {{ required: boolean, status: 'fundador'|'activa'|'caducada'|'sin-licencia'|'otro-equipo', needsCheck: boolean, expiresAt?: string, daysLeft?: number }}
 *   `required`: hay que enseñar la pantalla de activación.
 *   `needsCheck`: toca preguntar a la tienda, en segundo plano. Nunca bloquea.
 */
function evaluate(record, { machine, now, enforced }) {
  const gate = status => ({ required: !!enforced, status, needsCheck: false });

  if (!record || (record.kind !== 'fundador' && record.kind !== 'licencia')) return gate('sin-licencia');
  if (record.machine !== machine) return gate('otro-equipo');
  if (record.kind === 'fundador') return { required: false, status: 'fundador', needsCheck: false };

  const lastOk = Date.parse(record.lastOkAt || record.activatedAt);
  const age = Number.isFinite(lastOk) ? now - lastOk : Infinity;

  // Anual: la tienda da la fecha de caducidad; la de por vida no la tiene
  const exp = Date.parse(record.expiresAt);
  if (Number.isFinite(exp)) {
    const daysLeft = Math.ceil((exp - now) / DAY);
    // Caducada: sigue sin bloquear los datos; se pregunta en cada arranque por si ya renovó
    if (exp < now) return { required: false, status: 'caducada', needsCheck: true, expiresAt: record.expiresAt, daysLeft: 0 };
    return {
      required: false, status: 'activa', expiresAt: record.expiresAt, daysLeft,
      needsCheck: age > CHECK_EVERY || daysLeft <= RENEW_WARN_DAYS,
    };
  }
  return { required: false, status: 'activa', needsCheck: age > CHECK_EVERY };
}

/** Fecha de caducidad que da la tienda (ISO), o vacío si la licencia no caduca. */
function expiresAtOf(body) {
  const e = body && body.license_key && body.license_key.expires_at;
  return e && Number.isFinite(Date.parse(e)) ? new Date(e).toISOString() : '';
}

/**
 * ¿La respuesta de «comprobar» quita la licencia? Solo si la tienda la da por
 * anulada o devuelta. Una anual caducada (`expired`) se conserva: el docente
 * sigue entrando a sus datos y, al renovar, vuelve a estar activa.
 */
function validationVerdict(body, httpStatus) {
  const st = body && body.license_key && body.license_key.status;
  if (body && body.valid && st !== 'disabled' && st !== 'expired') return 'valida';
  if (st === 'expired') return 'caducada';
  if (httpStatus < 500) return 'anulada';
  return 'incierta';
}

/** Los últimos caracteres de la clave, para enseñarla sin mostrarla entera. */
function keyHint(key) {
  const k = String(key || '').trim();
  return k.length > 4 ? `••••${k.slice(-4)}` : '';
}

/**
 * Traduce la respuesta de la tienda (Lemon Squeezy) a un código que la
 * interfaz sabe explicar. `storeId` vacío: aún no hay tienda configurada y se
 * acepta cualquiera.
 */
function activationError(body, httpStatus, storeId) {
  const msg = String((body && body.error) || '').toLowerCase();
  if (body && body.activated && body.meta && storeId && String(body.meta.store_id) !== String(storeId)) return 'otra-tienda';
  if (body && body.activated) return null;
  if (msg.includes('activation limit')) return 'limite';
  const st = body && body.license_key && body.license_key.status;
  if (st === 'disabled' || st === 'expired' || msg.includes('disabled') || msg.includes('expired')) return 'desactivada';
  if (httpStatus === 404 || msg.includes('not found') || msg.includes('invalid')) return 'clave-no-valida';
  return 'error-tienda';
}

module.exports = { canBeFounder, evaluate, keyHint, activationError, expiresAtOf, validationVerdict, CHECK_EVERY, RENEW_WARN_DAYS, DAY };
