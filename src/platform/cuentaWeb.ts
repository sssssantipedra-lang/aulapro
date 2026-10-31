/**
 * Versión web: entrar con la cuenta de Google (y, más adelante, de Microsoft).
 * Decisión del dueño, 29-10-2026: el docente entra con su cuenta y, en una
 * segunda fase, sus datos se guardarán solos en su propio Drive o OneDrive.
 *
 * Por ahora la cuenta solo identifica al docente en este navegador: se guardan
 * en IndexedDB su nombre, su correo y su identificador de Google, nada más, y
 * no salen hacia ningún servidor de AulaPro. Se usa Google Identity Services
 * (accounts.google.com/gsi/client), que devuelve un token firmado con esos
 * datos; sin servidor propio no se puede comprobar la firma, pero sí que va
 * dirigido a AulaPro y no ha caducado, que es lo que importa mientras la
 * cuenta no da acceso a nada fuera del dispositivo.
 *
 * El ID de cliente es público (Google Cloud, proyecto «AulaPro», cliente
 * «AulaPro web»; orígenes aulapro.app, prueba.aulapro-app.pages.dev y
 * localhost:5173).
 */
import { marcarLicenciaVencida } from '../lib/licenciaVencida';
import { idbKv } from './webFs';
import { pedirApi } from './servidores';

export const GOOGLE_CLIENT_ID = '617666474619-nkre1e8divbf9orspfjv8cpcl7meuoo0.apps.googleusercontent.com';
/**
 * «Id. de aplicación (cliente)» del registro de AulaPro en entra.microsoft.com (es público, como el de
 * Google). Mientras esté vacío, «Continuar con Microsoft» sigue apagado. La misma constante, en el
 * servidor: `web/funciones/api/_microsoft.js`.
 */
export const MICROSOFT_CLIENT_ID = 'aaf98623-576d-4fed-903f-3a0812385435';
export const MICROSOFT_LISTO: boolean = MICROSOFT_CLIENT_ID.length > 0;

export interface Cuenta {
  proveedor: 'google' | 'microsoft';
  /** Identificador estable de la cuenta en su proveedor. */
  id: string;
  email: string;
  nombre: string;
  foto?: string;
  desde: string;
}

const CLAVE = 'cuenta';

let actual: Cuenta | undefined;
export const leerCuenta = () => idbKv.get<Cuenta>(CLAVE).then(c => (actual = c)).catch(() => undefined);
/** La cuenta ya leída, sin esperar (para abrir la ventana de Google en el mismo toque). */
export const cuentaActual = () => actual;

export async function cerrarSesion() {
  actual = undefined;
  await idbKv.del(CLAVE);
  // El permiso de Microsoft (identidad y OneDrive) es de la cuenta: se va con ella (el de Google Drive lo comprueba `abrirCarpetaGuardada`)
  await idbKv.del('microsoft');
  try { sessionStorage.removeItem('aulapro_acceso_onedrive'); } catch { /* sin almacenamiento */ }
  try { (window as unknown as GoogleGlobal).google?.accounts.id.disableAutoSelect(); } catch { /* sin Google cargado */ }
}

/* ── Google ── */

interface GoogleGlobal {
  google?: {
    accounts: {
      id: {
        initialize: (o: Record<string, unknown>) => void;
        renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
        disableAutoSelect: () => void;
        prompt: () => void;
      };
    };
  };
}

let cargando: Promise<void> | null = null;

export function cargarGoogle(): Promise<void> {
  return (cargando ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { cargando = null; reject(new Error('sin-conexion')); };
    document.head.appendChild(s);
  }));
}
/**
 * El último token de Google: dura una hora y sirve para que la función de la
 * licencia compruebe la cuenta. En memoria y en `sessionStorage` (solo esta
 * pestaña): así sobrevive a recargar la página tras pagar.
 */
const TOKEN = 'aulapro_token_google';
let ultimoToken = '';

function guardarToken(t: string) {
  ultimoToken = t;
  try { sessionStorage.setItem(TOKEN, t); } catch { /* sin almacenamiento */ }
}

/** El token, si aún le queda al menos un minuto. */
function tokenVigente(): string {
  let t = ultimoToken;
  if (!t) { try { t = sessionStorage.getItem(TOKEN) ?? ''; } catch { t = ''; } }
  return t && leerTokenCuenta(t, Date.now() + 60_000) ? t : '';
}

/** Lo que trae el token de identidad, sea de Google o de Microsoft. */
export function leerTokenCuenta(token: string, ahora = Date.now()) {
  return leerTokenGoogle(token, ahora) ?? leerTokenMicrosoft(token, ahora);
}

/**
 * Un token nuevo sin que el docente haga nada, si ya dio permiso a AulaPro en
 * este navegador (Google lo da solo con `auto_select`). Vacío si no hay manera.
 */
async function tokenNuevo(): Promise<string> {
  // Cuenta de Microsoft: la identidad se renueva con su permiso duradero, sin ventanas (`platform/microsoft.ts`)
  if ((actual ?? await leerCuenta())?.proveedor === 'microsoft') {
    const { tokenDeIdentidadMicrosoft } = await import('./microsoft');
    const t = await tokenDeIdentidadMicrosoft();
    if (t && leerTokenMicrosoft(t)) { guardarToken(t); return t; }
    return '';
  }
  // Con el permiso de Drive (entrada con un solo paso), Google lo da al renovar, también en Safari
  const { tokenDeIdentidad } = await import('./googleDrive');
  const conDrive = await tokenDeIdentidad();
  if (conDrive && leerTokenGoogle(conDrive)) { guardarToken(conDrive); return conDrive; }
  try { await cargarGoogle(); } catch { return ''; }
  const g = (window as unknown as GoogleGlobal).google!;
  return new Promise(resolve => {
    const fin = setTimeout(() => resolve(''), 10_000);
    g.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID, auto_select: true, use_fedcm_for_prompt: true,
      callback: ({ credential }: { credential: string }) => {
        clearTimeout(fin);
        if (leerTokenGoogle(credential)) { guardarToken(credential); resolve(credential); } else resolve('');
      },
    });
    g.accounts.id.prompt();
  });
}

/** La «clave» de un fundador de la versión web: su correo está en la lista (`FUNDADORES` de la función de la licencia). */
export const FUNDADOR = 'fundador';

export type BusquedaLicencia = { key: string; firma?: string } | { key: null; vencida?: boolean; error?: 'sin-cuenta' | 'sin-configurar' | 'token' | 'tienda' | 'sin-conexion' };

/**
 * La clave de la licencia comprada con el correo de esta cuenta (función
 * `web/funciones/api/licencia/cuenta.js`). Sin compra, `key: null` sin error;
 * si algo falla, el motivo, para poder decirlo en pantalla.
 */
export function licenciaDeLaCuenta(): Promise<BusquedaLicencia> {
  // Una sola búsqueda a la vez: la que se adelanta al entrar (`adelantarLicencia`) y la de la pantalla comparten la llamada
  return (buscando ??= buscarLicencia().then(b => {
    if (!('error' in b && b.error)) { try { sessionStorage.setItem(MIRADA, String(Date.now())); } catch { /* sin almacenamiento */ } }
    return b;
  }).finally(() => { buscando = null; }));
}

const MIRADA = 'aulapro_licencia_mirada';
/** ¿Se acaba de mirar la compra de esta cuenta (en esta pestaña)? Para no repetir la llamada a la función. */
export function licenciaMiradaHace(ms: number): boolean {
  try { return Date.now() - Number(sessionStorage.getItem(MIRADA) ?? 0) < ms; } catch { return false; }
}

let buscando: Promise<BusquedaLicencia> | null = null;

async function buscarLicencia(): Promise<BusquedaLicencia> {
  const token = tokenVigente() || await tokenNuevo();
  if (!token) return { key: null, error: 'sin-cuenta' };
  try {
    const r = await pedirApi('/api/licencia/cuenta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, proveedor: leerTokenCuenta(token)?.proveedor }),
    });
    const j = await r.json().catch(() => ({}));
    const firma = typeof j.firma === 'string' && j.firma ? { firma: j.firma as string } : {};
    if (r.ok) {
      if (j.fundador) return { key: FUNDADOR, ...firma };
      if (j.key) return { key: String(j.key), ...firma };
      // La suscripción de este correo terminó: se recuerda en el dispositivo para decirlo en la pantalla de licencia
      if (j.vencida) { marcarLicenciaVencida(); return { key: null, vencida: true }; }
      return { key: null };
    }
    return { key: null, error: ['sin-configurar', 'token', 'tienda'].includes(j.error) ? j.error : 'tienda' };
  } catch {
    return { key: null, error: 'sin-conexion' };
  }
}

/** Hay manera de buscar la licencia sin volver a entrar (o Google la dará sola). */
export const hayToken = () => !!tokenVigente();

/** Lo que trae el token de Google (un JWT), sin comprobar la firma: ver arriba. */
export function leerTokenGoogle(token: string, ahora = Date.now()): Omit<Cuenta, 'desde'> | null {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(parte.padEnd(Math.ceil(parte.length / 4) * 4, '=')), c => c.charCodeAt(0));
    const p = JSON.parse(new TextDecoder().decode(bytes));
    if (p.aud !== GOOGLE_CLIENT_ID) return null;
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(p.iss)) return null;
    if (typeof p.exp !== 'number' || p.exp * 1000 < ahora) return null;
    if (!p.sub || !p.email) return null;
    return { proveedor: 'google', id: String(p.sub), email: String(p.email), nombre: String(p.name || p.email), ...(p.picture ? { foto: String(p.picture) } : {}) };
  } catch {
    return null;
  }
}

/**
 * Lo que trae el token de identidad de Microsoft, sin comprobar la firma (como con Google: la comprueba el
 * servidor al buscar la licencia, `web/funciones/api/_microsoft.js`). El correo es el de `email`; si falta,
 * el nombre de usuario, que sirve para enseñarlo pero no para buscar compras.
 */
export function leerTokenMicrosoft(token: string, ahora = Date.now(), clientId = MICROSOFT_CLIENT_ID): Omit<Cuenta, 'desde'> | null {
  try {
    if (!clientId) return null;
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(parte.padEnd(Math.ceil(parte.length / 4) * 4, '=')), c => c.charCodeAt(0));
    const p = JSON.parse(new TextDecoder().decode(bytes));
    if (p.aud !== clientId || typeof p.tid !== 'string') return null;
    if (p.iss !== `https://login.microsoftonline.com/${p.tid}/v2.0`) return null;
    if (typeof p.exp !== 'number' || p.exp * 1000 < ahora) return null;
    const email = String(p.email || p.preferred_username || '').trim().toLowerCase();
    const id = p.oid || p.sub;
    if (!id || !email) return null;
    return { proveedor: 'microsoft', id: `${p.tid}.${id}`, email, nombre: String(p.name || email) };
  } catch {
    return null;
  }
}

/** Guarda la cuenta de un token de Microsoft ya recibido (`platform/microsoft.ts`). */
export async function entrarConTokenMicrosoft(token: string): Promise<Cuenta | null> {
  const datos = leerTokenMicrosoft(token);
  if (!datos) return null;
  guardarToken(token);
  const cuenta: Cuenta = { ...datos, desde: new Date().toISOString() };
  actual = cuenta;
  await idbKv.set(CLAVE, cuenta);
  adelantarLicencia();
  return cuenta;
}

/** Guarda la cuenta de un token de Google ya recibido (entrada con un solo paso, `googleDrive.ts`). */
export async function entrarConToken(token: string): Promise<Cuenta | null> {
  const datos = leerTokenGoogle(token);
  if (!datos) return null;
  guardarToken(token);
  const cuenta: Cuenta = { ...datos, desde: new Date().toISOString() };
  actual = cuenta;
  await idbKv.set(CLAVE, cuenta);
  adelantarLicencia();
  return cuenta;
}

/**
 * Busca la compra en cuanto se entra y guarda la licencia, mientras el docente
 * pasa por el paso de Drive: antes iba después, una cosa tras otra, y sumaban
 * varios segundos. Si hay compra, al terminar lo de Drive la app abre sin esperar.
 */
function adelantarLicencia() {
  licenciaDeLaCuenta()
    .then(b => (b.key ? (typeof window !== 'undefined' ? window.electronAPI : undefined)?.license?.porCuenta?.(b.key, b.firma) : undefined))
    .catch(() => {});
}

/**
 * Pinta el botón «Continuar con Google» en `el`. Al entrar, guarda la cuenta
 * y llama a `alEntrar`. Falla con `sin-conexion` si no se puede cargar Google.
 */
export async function botonGoogle(el: HTMLElement, idioma: string, alEntrar: (c: Cuenta) => void, alFallar: () => void) {
  await cargarGoogle();
  const g = (window as unknown as GoogleGlobal).google!;
  g.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    use_fedcm_for_button: true,
    callback: async ({ credential }: { credential: string }) => {
      const datos = leerTokenGoogle(credential);
      if (!datos) { alFallar(); return; }
      guardarToken(credential);
      const cuenta: Cuenta = { ...datos, desde: new Date().toISOString() };
      actual = cuenta;
      await idbKv.set(CLAVE, cuenta);
      alEntrar(cuenta);
    },
  });
  g.accounts.id.renderButton(el, {
    type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill',
    logo_alignment: 'left', width: 400, locale: idioma,
  });
}

/**
 * Enlace de pago de la oferta de lanzamiento (Lemon Squeezy, docs/TIENDAS.md,
 * apartado 6), con el correo de la cuenta ya puesto: así la compra queda unida a
 * la cuenta y `licenciaDeLaCuenta` la encuentra sin escribir la clave.
 */
export const CHECKOUT = 'https://aulapro.lemonsqueezy.com/checkout/buy/b8296834-4f9d-4563-86e3-c798fb243781?enabled=2308832';

/**
 * Interruptor de la venta dentro de la app (decisión del dueño, 31-10-2026: cerrada hasta el 10-11-2026).
 * Con `false`, la pantalla de licencia no enseña el botón de compra y avisa de cuándo se abre; la clave a
 * mano y la licencia ya comprada o de fundador siguen funcionando. El otro interruptor es `checkout` en
 * `web/sitio/assets/launch.js`: se abren los dos a la vez (docs/MANTENIMIENTO.md).
 */
export const VENTA_ABIERTA = false;

/** Descuento del primer año (34 %, una sola vez en Lemon Squeezy). Se quita del enlace al acabar la oferta, el 15-4-2027. */
export const CODIGO_LANZAMIENTO = 'LANZAMIENTO';
/** Con `renovar` no lleva el código: el primer año a precio de lanzamiento es para quien se suscribe por primera vez. */
export const enlaceDePago = (email: string, renovar = false) => `${CHECKOUT}&checkout%5Bemail%5D=${encodeURIComponent(email)}${renovar ? '' : `&checkout%5Bdiscount_code%5D=${CODIGO_LANZAMIENTO}`}`;
