/**
 * Versión web: el permiso para guardar en el Google Drive del docente
 * (`driveFs.ts`). Se pide una vez, con la ventana de Google (permiso
 * `drive.file`: solo lo que crea AulaPro). Google da a cambio un permiso
 * duradero (refresh token), que se guarda en este navegador y sirve para
 * pedir accesos de una hora sin volver a preguntar. El cambio lo hace la
 * función `/api/google/…` (`web/funciones/api/google/`), porque necesita el
 * secreto de cliente; no ve ni guarda nada más.
 */
import { idbKv } from './webFs';
import { pedirApi } from './servidores';
import { cargarGoogle, entrarConToken, GOOGLE_CLIENT_ID, type Cuenta } from './cuentaWeb';

const CLAVE = 'drive';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

export interface PermisoDrive { email: string; refresh: string }

let acceso: { token: string; caduca: number } | null = null;

/**
 * El acceso de una hora se recuerda también en `sessionStorage` (solo esta pestaña, como el token de
 * identidad en `cuentaWeb.ts`): al recargar la app no hace falta volver a pedirlo a la función (de 1 a 2 s).
 */
const ACCESO = 'aulapro_acceso_drive';
function recordarAcceso(token: string, expiraEn?: number) {
  acceso = { token, caduca: Date.now() + (expiraEn ?? 3600) * 1000 };
  try { sessionStorage.setItem(ACCESO, JSON.stringify(acceso)); } catch { /* sin almacenamiento */ }
}
function accesoVigente(): string {
  if (!acceso) { try { acceso = JSON.parse(sessionStorage.getItem(ACCESO) ?? 'null'); } catch { acceso = null; } }
  return acceso && typeof acceso.token === 'string' && acceso.caduca - Date.now() > 60_000 ? acceso.token : '';
}

export const leerPermisoDrive = () => idbKv.get<PermisoDrive>(CLAVE).catch(() => undefined);
export async function quitarPermisoDrive() {
  acceso = null;
  try { sessionStorage.removeItem(ACCESO); } catch { /* sin almacenamiento */ }
  await idbKv.del(CLAVE);
}

/** El error que `espejo.ts` entiende como «hace falta que el docente vuelva a dar permiso». */
const sinPermiso = () => new DOMException('drive', 'NotAllowedError');

async function pedirFuncion(accion: 'token' | 'renovar', cuerpo: object) {
  const r = await pedirApi(`/api/google/${accion}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (d.error === 'caducado' || r.status === 401) throw sinPermiso();
    throw new Error(d.error === 'sin-configurar' ? 'Falta configurar Google Drive en el servidor' : `Google no responde (${r.status} ${d.error ?? ''})`);
  }
  return d as { access_token: string; expires_in?: number; refresh_token?: string; id_token?: string; scope?: string };
}

type CodeClient = { requestCode: () => void };
type G = { google?: { accounts: { oauth2: { initCodeClient: (o: object) => CodeClient } } } };
type Respuesta = Awaited<ReturnType<typeof pedirFuncion>>;

/**
 * Safari (iPhone, iPad y Mac) bloquea la ventana emergente de Google, así que
 * ahí se va a la página de Google y se vuelve a la app («redirect»). En los
 * demás navegadores, la ventana, y si no se abre, también se va y se vuelve.
 */
const VUELTA = 'aulapro_drive_vuelta';
type Modo = 'entrar' | 'drive';
function usarRedireccion() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return true;
  return /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|Android|FxiOS|OPR/.test(ua);
}
const direccionDeVuelta = () => location.origin + location.pathname;

function irAGoogle(g: NonNullable<G['google']>, scope: string, modo: Modo, email?: string): Promise<never> {
  const state = crypto.randomUUID();
  try { sessionStorage.setItem(VUELTA, JSON.stringify({ state, modo })); } catch { /* sin almacenamiento */ }
  g.accounts.oauth2.initCodeClient({
    client_id: GOOGLE_CLIENT_ID, scope, ux_mode: 'redirect', redirect_uri: direccionDeVuelta(), state,
    ...(email ? { login_hint: email } : { select_account: true }),
  }).requestCode();
  return new Promise<never>(() => {});
}

/** El código de Google, con la ventana o yendo a su página. Tiene que empezar en el mismo toque. */
async function pedirCodigo(scope: string, modo: Modo, email?: string): Promise<Respuesta> {
  // La ventana de Google solo se abre en el mismo instante del toque: si Google ya está cargado, sin esperar a nada.
  if (!(window as unknown as G).google?.accounts?.oauth2) await cargarGoogle();
  const g = (window as unknown as G).google!;
  if (usarRedireccion()) return irAGoogle(g, scope, modo, email);
  const code = await new Promise<string>((resolve, reject) => {
    g.accounts.oauth2.initCodeClient({
      client_id: GOOGLE_CLIENT_ID, scope, ux_mode: 'popup',
      ...(email ? { login_hint: email } : { select_account: true }),
      callback: (r: { code?: string; error?: string }) => (r.code ? resolve(r.code) : reject(sinPermiso())),
      error_callback: (e: { type?: string }) => (e?.type === 'popup_failed_to_open' ? irAGoogle(g, scope, modo, email) : reject(sinPermiso())),
    }).requestCode();
  });
  return pedirFuncion('token', { code });
}

/** Una sola renovación a la vez: al abrir, la licencia y Drive la piden juntas y comparten la respuesta. */
let renovando: Promise<Respuesta> | null = null;
const renovar = (refresh: string) => (renovando ??= pedirFuncion('renovar', { refresh_token: refresh }).finally(() => { renovando = null; }));

const conDrive = (d: Respuesta) => !!d.refresh_token && (d.scope ?? '').split(' ').includes(SCOPE);

async function guardarPermiso(email: string, d: Respuesta) {
  if (!d.refresh_token) throw new Error('Google no ha dado el permiso duradero');
  recordarAcceso(d.access_token, d.expires_in);
  const permiso = { email, refresh: d.refresh_token };
  await idbKv.set(CLAVE, permiso);
  return permiso;
}

/**
 * Pedir permiso para Drive (tiene que ser al pulsar un botón). `email`: la
 * cuenta con la que se entró, para que Google no pregunte cuál. Con la
 * redirección, la página se va a Google y esto no vuelve: lo termina
 * `terminarVueltaDrive` al volver.
 */
export async function pedirPermisoDrive(email: string): Promise<PermisoDrive> {
  return guardarPermiso(email, await pedirCodigo(SCOPE, 'drive', email));
}

/**
 * Entrar con Google y, en la misma ventana, el permiso de Drive (petición del
 * dueño, 29-10-2026: un solo paso en cada dispositivo). Si el docente
 * desmarca Drive, entra igual y `drive` sale en falso.
 */
const ENTRAR = `openid email profile ${SCOPE}`;
export async function entrarConGoogle(): Promise<{ cuenta: Cuenta; drive: boolean }> {
  return terminarEntrada(await pedirCodigo(ENTRAR, 'entrar'));
}

async function terminarEntrada(d: Respuesta): Promise<{ cuenta: Cuenta; drive: boolean }> {
  const cuenta = await entrarConToken(d.id_token ?? '');
  if (!cuenta) throw new Error('Google no ha confirmado la cuenta');
  const drive = conDrive(d);
  if (drive) await guardarPermiso(cuenta.email, d);
  return { cuenta, drive };
}

function leerVuelta(): { state: string; modo: Modo } | null {
  try { return JSON.parse(sessionStorage.getItem(VUELTA) ?? 'null'); } catch { return null; }
}

/** La app acaba de volver de la página de Google con la respuesta (ver `irAGoogle`). */
export function hayVueltaDrive(modo: Modo = 'drive') {
  try {
    const state = new URL(location.href).searchParams.get('state');
    const v = leerVuelta();
    return !!state && v?.state === state && v.modo === modo;
  } catch { return false; }
}

async function codigoDeVuelta(): Promise<Respuesta> {
  const u = new URL(location.href);
  const code = u.searchParams.get('code');
  try { sessionStorage.removeItem(VUELTA); } catch { /* sin almacenamiento */ }
  for (const k of ['code', 'state', 'scope', 'authuser', 'prompt', 'hd', 'error', 'iss']) u.searchParams.delete(k);
  history.replaceState(null, '', u.pathname + u.search + u.hash);
  if (!code) throw sinPermiso();
  return pedirFuncion('token', { code, redirect_uri: direccionDeVuelta() });
}

export async function terminarVueltaDrive(email: string): Promise<PermisoDrive> {
  return guardarPermiso(email, await codigoDeVuelta());
}

export const hayVueltaEntrada = () => hayVueltaDrive('entrar');
export async function terminarVueltaEntrada() { return terminarEntrada(await codigoDeVuelta()); }

/**
 * Un token de identidad nuevo con el permiso de Drive, sin que el docente haga
 * nada (Google lo da al renovar si se entró con `openid`): para buscar la
 * compra (`licenciaDeLaCuenta`) también en Safari, que no lo da de otra forma.
 */
export async function tokenDeIdentidad(): Promise<string> {
  const permiso = await leerPermisoDrive();
  if (!permiso) return '';
  try {
    const d = await renovar(permiso.refresh);
    recordarAcceso(d.access_token, d.expires_in);
    return d.id_token ?? '';
  } catch { return ''; }
}

/** Un acceso a Drive válido, renovándolo si hace falta. Sin permiso guardado o revocado, `NotAllowedError`. */
export async function tokenDrive(): Promise<string> {
  const vigente = accesoVigente();
  if (vigente) return vigente;
  const permiso = await leerPermisoDrive();
  if (!permiso) throw sinPermiso();
  const d = await renovar(permiso.refresh);
  recordarAcceso(d.access_token, d.expires_in);
  return d.access_token;
}
