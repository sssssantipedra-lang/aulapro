/**
 * Licencia de Aula Pro en este equipo: guardarla, activarla con la tienda y
 * comprobarla de vez en cuando. Las reglas están en `licenseCore.cjs`.
 *
 * La venta se hace en la web con Lemon Squeezy, que da una clave por compra y
 * lleva la cuenta de en cuántos equipos se ha activado. Su API de licencias no
 * necesita ninguna clave secreta dentro de la aplicación:
 * https://docs.lemonsqueezy.com/api/license-api
 *
 * El registro (`licencia.dat`) va cifrado con el sistema operativo, como la
 * clave de la IA (ver `secrets.cjs`): no se puede editar a mano ni sirve
 * copiado a otro equipo o a otro usuario de Windows.
 */
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const fsp = require('fs/promises');
const { app, safeStorage } = require('electron');
const core = require('./licenseCore.cjs');

/* ── Ajustes de la venta ──────────────────────────────────────────────────
 * ENFORCED: mientras sea `false` nadie ve la pantalla de activación y todo
 *   equipo que abra la aplicación queda como fundador (gratis para siempre).
 *   Se pasa a `true` en la versión con la que empiece la venta.
 * FOUNDER_CUTOFF: fecha de esa versión (p. ej. '2026-11-01'). Quien tenga un
 *   perfil creado antes también es fundador aunque se salte versiones.
 * STORE_ID: el número de tienda de Lemon Squeezy; así una clave de otra tienda
 *   no vale. Vacío hasta que exista la tienda.
 * BUY_URL: la página donde se compra.
 */
const ENFORCED = false;
const FOUNDER_CUTOFF = '';
const STORE_ID = '';
const BUY_URL = '';
const API = 'https://api.lemonsqueezy.com/v1/licenses';

const file = () => path.join(app.getPath('userData'), 'licencia.dat');

/** Huella del equipo: no cambia al reinstalar ni al actualizar, sí en otro ordenador. */
function machineId() {
  let user = '';
  try { user = os.userInfo().username; } catch { /* sin usuario: da igual */ }
  const cpu = (os.cpus()[0] || {}).model || '';
  return crypto.createHash('sha256')
    .update(['aulapro-licencia', os.hostname(), user, os.platform(), os.arch(), cpu].join('|'))
    .digest('hex');
}

async function readRecord() {
  let raw;
  try { raw = JSON.parse(await fsp.readFile(file(), 'utf8')); } catch { return null; }
  try {
    if (raw.enc && safeStorage.isEncryptionAvailable()) {
      return JSON.parse(safeStorage.decryptString(Buffer.from(raw.enc, 'base64')));
    }
    // Solo sin cifrado disponible (un Linux sin anillo de claves) se acepta en claro
    if (raw.plain && !safeStorage.isEncryptionAvailable()) return raw.plain;
  } catch { /* de otro equipo o manipulado */ }
  return null;
}

async function writeRecord(record) {
  const body = safeStorage.isEncryptionAvailable()
    ? { enc: safeStorage.encryptString(JSON.stringify(record)).toString('base64') }
    : { plain: record };
  await fsp.mkdir(path.dirname(file()), { recursive: true });
  await fsp.writeFile(file(), JSON.stringify(body), { mode: 0o600 });
}

async function removeRecord() {
  await fsp.rm(file(), { force: true });
}

/** Llamada a la tienda. `null` si no hay conexión. */
async function store(action, fields) {
  try {
    const res = await fetch(`${API}/${action}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
      signal: AbortSignal.timeout(10000),
    });
    let body = {};
    try { body = await res.json(); } catch { /* respuesta vacía */ }
    return { status: res.status, body };
  } catch {
    return null;
  }
}

let record = null;
let ready = null;

/** Lo que necesita saber la interfaz (nunca la clave entera). */
function publicState() {
  const s = core.evaluate(record, { machine: machineId(), now: Date.now(), enforced: ENFORCED });
  return {
    required: s.required,
    status: s.status,
    enforced: ENFORCED,
    keyHint: record && record.kind === 'licencia' ? core.keyHint(record.key) : '',
    since: record ? record.activatedAt : '',
    buyUrl: BUY_URL,
  };
}

/** Pregunta a la tienda si la clave sigue valiendo. */
async function check() {
  if (!record || record.kind !== 'licencia') return;
  const r = await store('validate', { license_key: record.key, instance_id: record.instanceId });
  if (!r) return; // sin conexión: se vuelve a intentar al próximo arranque
  const st = r.body && r.body.license_key && r.body.license_key.status;
  if (r.body && r.body.valid && st !== 'disabled' && st !== 'expired') {
    record = { ...record, lastOkAt: new Date().toISOString() };
    await writeRecord(record);
  } else if (r.status < 500) {
    // La tienda dice que no: reembolsada, anulada o desactivada desde la web
    record = null;
    await removeRecord();
  }
}

/**
 * Se llama al arrancar. Marca como fundador a quien corresponda y, si toca,
 * comprueba la clave: esperando solo si ya había caducado.
 */
async function init(listProfiles) {
  record = await readRecord();
  const machine = machineId();
  const s = core.evaluate(record, { machine, now: Date.now(), enforced: ENFORCED });

  if (s.status === 'sin-licencia' || s.status === 'otro-equipo') {
    let profiles = [];
    try { profiles = await listProfiles(); } catch { /* sin perfiles */ }
    if (core.canBeFounder({ enforced: ENFORCED, founderCutoff: FOUNDER_CUTOFF, profiles })) {
      record = { v: 1, kind: 'fundador', machine, activatedAt: new Date().toISOString() };
      await writeRecord(record).catch(() => {});
    }
  } else if (s.needsCheck) {
    const pending = check().catch(() => {});
    if (s.status === 'caducada') await pending;
  }
}

function whenReady(listProfiles) {
  if (!ready) ready = init(listProfiles).catch(err => console.error('Licencia:', err));
  return ready;
}

async function activate(key) {
  const k = String(key || '').trim();
  if (!k) return { ok: false, error: 'clave-no-valida', state: publicState() };
  const instanceName = `${os.hostname()} (${os.platform() === 'darwin' ? 'Mac' : os.platform() === 'win32' ? 'Windows' : os.platform()})`;
  const r = await store('activate', { license_key: k, instance_name: instanceName });
  if (!r) return { ok: false, error: 'sin-conexion', state: publicState() };

  const error = core.activationError(r.body, r.status, STORE_ID);
  if (error) {
    // Clave de otra tienda: se deja libre la activación que acaba de gastar
    if (error === 'otra-tienda' && r.body.instance) store('deactivate', { license_key: k, instance_id: r.body.instance.id });
    return { ok: false, error, state: publicState() };
  }
  const now = new Date().toISOString();
  record = { v: 1, kind: 'licencia', machine: machineId(), key: k, instanceId: r.body.instance.id, activatedAt: now, lastOkAt: now };
  await writeRecord(record);
  return { ok: true, state: publicState() };
}

/** Libera este equipo para poder activar la clave en otro. */
async function deactivate() {
  if (!record || record.kind !== 'licencia') return { ok: false, error: 'sin-licencia', state: publicState() };
  const r = await store('deactivate', { license_key: record.key, instance_id: record.instanceId });
  if (!r) return { ok: false, error: 'sin-conexion', state: publicState() };
  record = null;
  await removeRecord();
  return { ok: true, state: publicState() };
}

/** Vuelve a preguntar a la tienda ahora (la pantalla de «sin conexión»). */
async function recheck() {
  await check().catch(() => {});
  return publicState();
}

module.exports = { whenReady, publicState, activate, deactivate, recheck };
