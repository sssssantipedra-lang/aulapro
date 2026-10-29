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

export const leerCuenta = () => idbKv.get<Cuenta>(CLAVE).catch(() => undefined);

export async function cerrarSesion() {
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
      };
    };
  };
}

let cargando: Promise<void> | null = null;
/** El último token de Google, solo en memoria: dura una hora y sirve para buscar la licencia. */
let ultimoToken = '';

/**
 * La clave de la licencia comprada con el correo de esta cuenta (función
 * `web/funciones/api/licencia/cuenta.js`), o `null`. Solo justo después de
 * entrar con Google, cuando hay token.
 */
/** Hay token de Google en esta sesión (se ha entrado hace poco). */
export const hayToken = () => !!ultimoToken;

export async function licenciaDeLaCuenta(): Promise<string | null> {
  if (!ultimoToken) return null;
  try {
    const r = await fetch('/api/licencia/cuenta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ultimoToken }),
    });
    return r.ok ? ((await r.json()).key ?? null) : null;
  } catch {
    return null;
  }
}

function cargarGoogle(): Promise<void> {
  return (cargando ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { cargando = null; reject(new Error('sin-conexion')); };
    document.head.appendChild(s);
  }));
}

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
      ultimoToken = credential;
      const cuenta: Cuenta = { ...datos, desde: new Date().toISOString() };
      await idbKv.set(CLAVE, cuenta);
      alEntrar(cuenta);
    },
  });
  g.accounts.id.renderButton(el, {
    type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill',
    logo_alignment: 'left', width: 300, locale: idioma,
  });
}

/**
 * Enlace de pago de la oferta de lanzamiento (Lemon Squeezy, docs/TIENDAS.md,
 * apartado 6), con el correo de la cuenta ya puesto: así la compra queda unida a
 * la cuenta y `licenciaDeLaCuenta` la encuentra sin escribir la clave.
 */
export const CHECKOUT = 'https://aulapro.lemonsqueezy.com/checkout/buy/b8296834-4f9d-4563-86e3-c798fb243781?enabled=2308832';

export const enlaceDePago = (email: string) => `${CHECKOUT}&checkout%5Bemail%5D=${encodeURIComponent(email)}`;
