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
import { cargarGoogle, GOOGLE_CLIENT_ID } from './cuentaWeb';

const CLAVE = 'drive';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

export interface PermisoDrive { email: string; refresh: string }

let acceso: { token: string; caduca: number } | null = null;

export const leerPermisoDrive = () => idbKv.get<PermisoDrive>(CLAVE).catch(() => undefined);
export async function quitarPermisoDrive() { acceso = null; await idbKv.del(CLAVE); }

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
  return d as { access_token: string; expires_in?: number; refresh_token?: string };
}

/**
 * La ventana de Google para dar permiso a Drive (tiene que ser al pulsar un
 * botón). `email`: la cuenta con la que se entró, para que Google no pregunte cuál.
 */
export async function pedirPermisoDrive(email: string): Promise<PermisoDrive> {
  // Safari (iPhone, iPad) solo deja abrir la ventana de Google en el mismo
  // instante del toque: si Google ya está cargado, se abre sin esperar a nada.
  type G = { google?: { accounts: { oauth2: { initCodeClient: (o: object) => { requestCode: () => void } } } } };
  if (!(window as unknown as G).google?.accounts?.oauth2) await cargarGoogle();
  const g = (window as unknown as G).google!;
  const code = await new Promise<string>((resolve, reject) => {
    g.accounts.oauth2.initCodeClient({
      client_id: GOOGLE_CLIENT_ID, scope: SCOPE, ux_mode: 'popup', login_hint: email,
      callback: (r: { code?: string; error?: string }) => (r.code ? resolve(r.code) : reject(sinPermiso())),
      error_callback: () => reject(sinPermiso()),
    }).requestCode();
  });
  const d = await pedirFuncion('token', { code });
  if (!d.refresh_token) throw new Error('Google no ha dado el permiso duradero');
  acceso = { token: d.access_token, caduca: Date.now() + (d.expires_in ?? 3600) * 1000 };
  const permiso = { email, refresh: d.refresh_token };
  await idbKv.set(CLAVE, permiso);
  return permiso;
}

/** Un acceso a Drive válido, renovándolo si hace falta. Sin permiso guardado o revocado, `NotAllowedError`. */
export async function tokenDrive(): Promise<string> {
  if (acceso && acceso.caduca - Date.now() > 60_000) return acceso.token;
  const permiso = await leerPermisoDrive();
  if (!permiso) throw sinPermiso();
  const d = await pedirFuncion('renovar', { refresh_token: permiso.refresh });
  acceso = { token: d.access_token, caduca: Date.now() + (d.expires_in ?? 3600) * 1000 };
  return acceso.token;
}
