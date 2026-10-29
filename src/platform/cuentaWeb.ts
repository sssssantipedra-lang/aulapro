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
import { idbKv } from './webFs';
import { pedirApi } from './servidores';

export const GOOGLE_CLIENT_ID = '617666474619-nkre1e8divbf9orspfjv8cpcl7meuoo0.apps.googleusercontent.com';

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
  return t && leerTokenGoogle(t, Date.now() + 60_000) ? t : '';
}

/**
 * Un token nuevo sin que el docente haga nada, si ya dio permiso a AulaPro en
 * este navegador (Google lo da solo con `auto_select`). Vacío si no hay manera.
 */
async function tokenNuevo(): Promise<string> {
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

export type BusquedaLicencia = { key: string } | { key: null; error?: 'sin-cuenta' | 'sin-configurar' | 'token' | 'tienda' | 'sin-conexion' };

/**
 * La clave de la licencia comprada con el correo de esta cuenta (función
 * `web/funciones/api/licencia/cuenta.js`). Sin compra, `key: null` sin error;
 * si algo falla, el motivo, para poder decirlo en pantalla.
 */
export async function licenciaDeLaCuenta(): Promise<BusquedaLicencia> {
  const token = tokenVigente() || await tokenNuevo();
  if (!token) return { key: null, error: 'sin-cuenta' };
  try {
    const r = await pedirApi('/api/licencia/cuenta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j.fundador ? { key: FUNDADOR } : j.key ? { key: String(j.key) } : { key: null };
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

/** Guarda la cuenta de un token de Google ya recibido (entrada con un solo paso, `googleDrive.ts`). */
export async function entrarConToken(token: string): Promise<Cuenta | null> {
  const datos = leerTokenGoogle(token);
  if (!datos) return null;
  guardarToken(token);
  const cuenta: Cuenta = { ...datos, desde: new Date().toISOString() };
  actual = cuenta;
  await idbKv.set(CLAVE, cuenta);
  return cuenta;
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

export const enlaceDePago = (email: string) => `${CHECKOUT}&checkout%5Bemail%5D=${encodeURIComponent(email)}`;
