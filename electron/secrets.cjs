/**
 * Secretos del docente (hoy, solo la clave de Google para la IA) cifrados con
 * el sistema operativo: DPAPI en Windows, el Llavero en Mac, el anillo de
 * claves en Linux. Ver `safeStorage` en la documentación de Electron.
 *
 * Se guardan fuera de las carpetas de perfil: la clave es de este equipo, no
 * de un curso, y no debe acabar dentro de una copia de seguridad que se
 * comparte o se lleva en un pendrive.
 *
 * Si el sistema no ofrece cifrado (un Linux sin anillo de claves), `set`
 * devuelve `false` y la interfaz sigue guardándola como antes.
 */
const path = require('path');
const fsp = require('fs/promises');
const { app, safeStorage } = require('electron');

/** Nombres permitidos: la interfaz no puede escribir un archivo cualquiera. */
const ALLOWED = new Set(['gemini']);

const file = () => path.join(app.getPath('userData'), 'secretos.json');

async function readAll() {
  try { return JSON.parse(await fsp.readFile(file(), 'utf8')); } catch { return {}; }
}

async function get(name) {
  if (!ALLOWED.has(name) || !safeStorage.isEncryptionAvailable()) return '';
  const all = await readAll();
  if (!all[name]) return '';
  try { return safeStorage.decryptString(Buffer.from(all[name], 'base64')); } catch { return ''; }
}

async function set(name, value) {
  if (!ALLOWED.has(name) || !safeStorage.isEncryptionAvailable()) return false;
  const all = await readAll();
  if (value) all[name] = safeStorage.encryptString(String(value)).toString('base64');
  else delete all[name];
  await fsp.mkdir(path.dirname(file()), { recursive: true });
  await fsp.writeFile(file(), JSON.stringify(all), { mode: 0o600 });
  return true;
}

module.exports = { get, set };
