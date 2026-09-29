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
 *     la tienda cada semana; sin internet sigue funcionando hasta 30 días.
 *
 * Los dos van atados a la huella del equipo: copiar la carpeta de datos (o el
 * pendrive con la versión portable) a otro ordenador no se lleva la licencia.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Cada cuánto se pregunta a la tienda si la clave sigue siendo buena. */
const CHECK_EVERY = 7 * DAY;
/** Cuánto aguanta sin poder preguntar (sin internet) antes de pedir conexión. */
const OFFLINE_GRACE = 30 * DAY;

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
 * @returns {{ required: boolean, status: 'fundador'|'activa'|'sin-licencia'|'otro-equipo'|'caducada', needsCheck: boolean }}
 *   `required`: hay que enseñar la pantalla de activación.
 *   `needsCheck`: toca preguntar a la tienda (en segundo plano si aún no ha caducado).
 */
function evaluate(record, { machine, now, enforced }) {
  const gate = status => ({ required: !!enforced, status, needsCheck: false });

  if (!record || (record.kind !== 'fundador' && record.kind !== 'licencia')) return gate('sin-licencia');
  if (record.machine !== machine) return gate('otro-equipo');
  if (record.kind === 'fundador') return { required: false, status: 'fundador', needsCheck: false };

  const lastOk = Date.parse(record.lastOkAt || record.activatedAt);
  const age = Number.isFinite(lastOk) ? now - lastOk : Infinity;
  if (age > OFFLINE_GRACE) return { required: !!enforced, status: 'caducada', needsCheck: true };
  return { required: false, status: 'activa', needsCheck: age > CHECK_EVERY };
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

module.exports = { canBeFounder, evaluate, keyHint, activationError, CHECK_EVERY, OFFLINE_GRACE, DAY };
