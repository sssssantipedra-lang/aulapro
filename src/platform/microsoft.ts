/**
 * Versión web: entrar con la cuenta de Microsoft y guardar el trabajo en su OneDrive. Es el equivalente de
 * `googleDrive.ts` con Microsoft. Microsoft no tiene una librería de ventanas como la de Google: se va a su
 * página y se vuelve a la app («redirect»), en todos los navegadores, con PKCE. El cambio del código por
 * accesos lo hacen las funciones `/api/microsoft/…` (`web/funciones/api/_microsoft.js`), que tienen el secreto
 * de cliente; no ven ni guardan nada más.
 *
 * Dos pasos, a diferencia de Google: primero solo la identidad (`entrarConMicrosoft`, funciona con cualquier
 * cuenta) y después, aparte, el permiso de OneDrive (`pedirPermisoOneDrive`). Muchos centros educativos
 * bloquean que sus docentes den permiso de archivos a aplicaciones de terceros; así, entrar funciona igual y
 * solo falla (y se puede saltar con «Ahora no») el guardado en OneDrive.
 */
import { idbKv } from './webFs';
import { createOneDriveFs } from './oneDriveFs';
import { pedirApi } from './servidores';
import { entrarConTokenMicrosoft, MICROSOFT_CLIENT_ID, type Cuenta } from './cuentaWeb';

const CLAVE = 'microsoft';
const AUTORIZAR = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const SCOPE_IDENTIDAD = 'openid email profile offline_access';
const SCOPE_ARCHIVOS = 'Files.ReadWrite.AppFolder';
const VUELTA = 'aulapro_ms_vuelta';
const ACCESO = 'aulapro_acceso_onedrive';

/** `archivos`: el permiso de OneDrive está dado. Sin él, el permiso duradero solo sirve para renovar la identidad. */
export interface PermisoMicrosoft { email: string; refresh: string; archivos: boolean }
type Modo = 'entrar' | 'onedrive';
type Respuesta = { access_token: string; expires_in?: number; refresh_token?: string; id_token?: string; scope?: string };

let acceso: { token: string; caduca: number } | null = null;

export const leerPermisoMicrosoft = () => idbKv.get<PermisoMicrosoft>(CLAVE).catch(() => undefined);
/** El permiso de OneDrive, si se dio (no el de la identidad sola). */
export const leerPermisoOneDrive = async () => { const p = await leerPermisoMicrosoft(); return p?.archivos ? p : undefined; };

/** Deja de guardar en OneDrive pero conserva la identidad (para seguir buscando la compra sin volver a entrar). */
export async function quitarPermisoOneDrive() {
  acceso = null;
  try { sessionStorage.removeItem(ACCESO); } catch { /* sin almacenamiento */ }
  const p = await leerPermisoMicrosoft();
  if (p) await idbKv.set(CLAVE, { ...p, archivos: false });
}

/** El error que `espejo.ts` entiende como «hace falta que el docente vuelva a dar permiso». */
const sinPermiso = () => new DOMException('onedrive', 'NotAllowedError');

async function pedirFuncion(accion: 'token' | 'renovar', cuerpo: object): Promise<Respuesta> {
  const r = await pedirApi(`/api/microsoft/${accion}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (d.error === 'caducado' || r.status === 401) throw sinPermiso();
    throw new Error(d.error === 'sin-configurar' ? 'Falta configurar Microsoft en el servidor' : `Microsoft no responde (${r.status} ${d.error ?? ''})`);
  }
  return d as Respuesta;
}

function recordarAcceso(token: string, expiraEn?: number) {
  acceso = { token, caduca: Date.now() + (expiraEn ?? 3600) * 1000 };
  try { sessionStorage.setItem(ACCESO, JSON.stringify(acceso)); } catch { /* sin almacenamiento */ }
}
function accesoVigente(): string {
  if (!acceso) { try { acceso = JSON.parse(sessionStorage.getItem(ACCESO) ?? 'null'); } catch { acceso = null; } }
  return acceso && typeof acceso.token === 'string' && acceso.caduca - Date.now() > 60_000 ? acceso.token : '';
}

/** Una sola renovación a la vez (la licencia y OneDrive la piden juntas al abrir). */
let renovando: Promise<Respuesta> | null = null;
function renovar(permiso: PermisoMicrosoft): Promise<Respuesta> {
  return (renovando ??= (async () => {
    const d = await pedirFuncion('renovar', { refresh_token: permiso.refresh, archivos: permiso.archivos });
    // Microsoft da un permiso duradero nuevo en cada renovación: se guarda el último para que no caduque por falta de uso
    if (d.refresh_token && d.refresh_token !== permiso.refresh) await idbKv.set(CLAVE, { ...permiso, refresh: d.refresh_token });
    return d;
  })().finally(() => { renovando = null; }));
}

/** Un token de identidad nuevo, sin que el docente haga nada, para buscar la compra. Vacío si no se puede. */
export async function tokenDeIdentidadMicrosoft(): Promise<string> {
  const permiso = await leerPermisoMicrosoft();
  if (!permiso) return '';
  try {
    const d = await renovar(permiso);
    if (permiso.archivos) recordarAcceso(d.access_token, d.expires_in);
    return d.id_token ?? '';
  } catch { return ''; }
}

/** Un acceso a OneDrive válido, renovándolo si hace falta. Sin permiso guardado o revocado, `NotAllowedError`. */
export async function tokenOneDrive(): Promise<string> {
  const vigente = accesoVigente();
  if (vigente) return vigente;
  const permiso = await leerPermisoOneDrive();
  if (!permiso) throw sinPermiso();
  const d = await renovar(permiso);
  recordarAcceso(d.access_token, d.expires_in);
  return d.access_token;
}

export const oneDriveFs = () => createOneDriveFs(tokenOneDrive);

/* ── Ir a la página de Microsoft y volver ── */

const direccionDeVuelta = () => location.origin + location.pathname;
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function irAMicrosoft(modo: Modo, email?: string): Promise<never> {
  return (async () => {
    const state = crypto.randomUUID();
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    const reto = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    try { sessionStorage.setItem(VUELTA, JSON.stringify({ state, modo, verifier })); } catch { /* sin almacenamiento */ }
    const p = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID, response_type: 'code', redirect_uri: direccionDeVuelta(), response_mode: 'query',
      scope: modo === 'onedrive' ? `${SCOPE_IDENTIDAD} ${SCOPE_ARCHIVOS}` : SCOPE_IDENTIDAD,
      state, code_challenge: reto, code_challenge_method: 'S256',
      ...(email ? { login_hint: email } : { prompt: 'select_account' }),
    });
    location.assign(`${AUTORIZAR}?${p}`);
    return new Promise<never>(() => {});
  })();
}

function leerVuelta(): { state: string; modo: Modo; verifier: string } | null {
  try { return JSON.parse(sessionStorage.getItem(VUELTA) ?? 'null'); } catch { return null; }
}

/** La app acaba de volver de la página de Microsoft con la respuesta (ver `irAMicrosoft`). */
export function hayVueltaMicrosoft(modo: Modo) {
  try {
    const state = new URL(location.href).searchParams.get('state');
    const v = leerVuelta();
    return !!state && v?.state === state && v.modo === modo;
  } catch { return false; }
}

async function codigoDeVuelta(archivos: boolean): Promise<Respuesta> {
  const u = new URL(location.href);
  const code = u.searchParams.get('code');
  const v = leerVuelta();
  try { sessionStorage.removeItem(VUELTA); } catch { /* sin almacenamiento */ }
  for (const k of ['code', 'state', 'session_state', 'client_info', 'error', 'error_description', 'error_uri']) u.searchParams.delete(k);
  history.replaceState(null, '', u.pathname + u.search + u.hash);
  if (!code || !v) throw sinPermiso();
  return pedirFuncion('token', { code, redirect_uri: direccionDeVuelta(), code_verifier: v.verifier, archivos });
}

async function guardarPermiso(email: string, d: Respuesta, archivos: boolean) {
  if (!d.refresh_token) throw new Error('Microsoft no ha dado el permiso duradero');
  if (archivos) recordarAcceso(d.access_token, d.expires_in);
  const permiso: PermisoMicrosoft = { email, refresh: d.refresh_token, archivos };
  await idbKv.set(CLAVE, permiso);
  return permiso;
}

/** Entrar con la cuenta de Microsoft: va a su página y vuelve (no termina aquí: ver `terminarVueltaEntradaMicrosoft`). */
export async function entrarConMicrosoft(): Promise<{ cuenta: Cuenta; drive: boolean }> {
  return irAMicrosoft('entrar');
}

export const hayVueltaEntradaMicrosoft = () => hayVueltaMicrosoft('entrar');
export async function terminarVueltaEntradaMicrosoft(): Promise<{ cuenta: Cuenta; drive: boolean }> {
  const d = await codigoDeVuelta(false);
  const cuenta = await entrarConTokenMicrosoft(d.id_token ?? '');
  if (!cuenta) throw new Error('Microsoft no ha confirmado la cuenta');
  await guardarPermiso(cuenta.email, d, false);
  return { cuenta, drive: false };
}

/** Pedir el permiso de OneDrive (al pulsar un botón): va a la página de Microsoft y vuelve. */
export function pedirPermisoOneDrive(email: string): Promise<PermisoMicrosoft> {
  return irAMicrosoft('onedrive', email);
}
export const hayVueltaOneDrive = () => hayVueltaMicrosoft('onedrive');
export async function terminarVueltaOneDrive(email: string): Promise<PermisoMicrosoft> {
  const error = new URL(location.href).searchParams.get('error');
  if (error) { await codigoDeVuelta(true).catch(() => {}); throw sinPermiso(); }
  return guardarPermiso(email, await codigoDeVuelta(true), true);
}
