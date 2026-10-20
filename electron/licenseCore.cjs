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
 *     Las de por vida no caducan (`expiresAt` vacío). Las anuales llevan la fecha
 *     de caducidad que da la tienda; pasada, la licencia queda `caducada`: la app
 *     sigue abriéndose, pero solo para revisar lo que ya estaba creado (decisión
 *     del dueño, 20-10-2026). Los datos nunca se bloquean ni se borran.
 *
 * Los dos van atados a la huella del equipo: copiar la carpeta de datos (o el
 * pendrive con la versión portable) a otro ordenador no se lleva la licencia.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Cada cuánto se pregunta a la tienda (si hay conexión) si la clave sigue siendo buena. */
const CHECK_EVERY = 7 * DAY;
/** Días de cortesía tras la fecha de caducidad: un cobro que tarda no deja a nadie sin poder editar. */
const GRACE = 3 * DAY;
/** Desde cuándo se avisa de que una licencia anual está a punto de caducar (y se comprueba en cada arranque). */
const WARN_BEFORE = 30 * DAY;

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
 * @returns {{ required: boolean, status: 'fundador'|'activa'|'caducada'|'sin-licencia'|'otro-equipo', needsCheck: boolean, expiresAt: string, daysLeft: number|null }}
 *   `required`: hay que enseñar la pantalla de activación.
 *   `needsCheck`: toca preguntar a la tienda, en segundo plano. Nunca bloquea.
 *   `expiresAt`, `daysLeft`: solo en las anuales (días enteros que quedan, 0 si ya pasó).
 */
function evaluate(record, { machine, now, enforced }) {
  const gate = status => ({ required: !!enforced, status, needsCheck: false, expiresAt: '', daysLeft: null });

  if (!record || (record.kind !== 'fundador' && record.kind !== 'licencia')) return gate('sin-licencia');
  if (record.machine !== machine) return gate('otro-equipo');
  if (record.kind === 'fundador') return { required: false, status: 'fundador', needsCheck: false, expiresAt: '', daysLeft: null };

  const lastOk = Date.parse(record.lastOkAt || record.activatedAt);
  const age = Number.isFinite(lastOk) ? now - lastOk : Infinity;
  const exp = Date.parse(record.expiresAt);
  const annual = Number.isFinite(exp);
  const expiresAt = annual ? record.expiresAt : '';
  const daysLeft = annual ? Math.max(0, Math.ceil((exp - now) / DAY)) : null;

  // La tienda dijo que caducó, o pasó la fecha y los días de cortesía sin renovar.
  // La app sigue abriéndose (`required` falso); solo se revisa, no se modifica.
  if (record.expired || (annual && now > exp + GRACE)) {
    return { required: false, status: 'caducada', needsCheck: true, expiresAt, daysLeft: 0 };
  }
  // Cerca de la fecha, se pregunta en cada arranque para enterarse pronto de la renovación
  const near = annual && exp - now < WARN_BEFORE;
  return { required: false, status: 'activa', needsCheck: age > CHECK_EVERY || near, expiresAt, daysLeft };
}

/**
 * Qué hacer con la respuesta de la tienda al comprobar una clave ya activada.
 *   - `ok`: sigue valiendo (`expiresAt`: su fecha de caducidad, vacía si es de por vida).
 *   - `caducada`: la suscripción anual no se renovó; se conserva el registro.
 *   - `anulada`: reembolsada, desactivada o que ya no existe; se borra el registro.
 *   - `nada`: la tienda no responde bien (error 5xx); se vuelve a intentar luego.
 */
function checkOutcome(body, httpStatus) {
  const lk = (body && body.license_key) || {};
  const msg = String((body && body.error) || '').toLowerCase();
  if (body && body.valid && lk.status !== 'disabled' && lk.status !== 'expired') {
    return { kind: 'ok', expiresAt: lk.expires_at || '' };
  }
  if (lk.status === 'expired' || msg.includes('expired')) return { kind: 'caducada', expiresAt: lk.expires_at || '' };
  if (httpStatus < 500) return { kind: 'anulada' };
  return { kind: 'nada' };
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
  if (st === 'expired' || msg.includes('expired')) return 'caducada';
  if (st === 'disabled' || msg.includes('disabled')) return 'desactivada';
  if (httpStatus === 404 || msg.includes('not found') || msg.includes('invalid')) return 'clave-no-valida';
  return 'error-tienda';
}

module.exports = { canBeFounder, evaluate, checkOutcome, keyHint, activationError, CHECK_EVERY, GRACE, WARN_BEFORE, DAY };
