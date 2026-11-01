/**
 * Versión web: la sesión que abre el código de la app («sin pagar, no hay app», 1-11-2026, decisión del
 * dueño). El código de las pantallas (/app/assets/) solo sale del servidor con una cookie de sesión, que
 * crea `/api/licencia/sesion` a partir de la licencia firmada (`web/funciones/api/_sesion.js`). La cookie
 * es HttpOnly: aquí no se ve; solo se recuerda hasta cuándo vale, para no pedirla en cada apertura.
 *
 * Siempre al mismo sitio desde el que se abrió la app (la cookie es de ese sitio), sin el paso al servidor
 * de respaldo de `servidores.ts`.
 */
const HASTA = 'aulapro_sesion_hasta';
const HUELLA = 'aulapro_sesion_huella';
/** Se renueva cuando le quedan menos de 2 días (la firma, y con ella la sesión, dura 7). */
const MARGEN = 2 * 24 * 60 * 60 * 1000;
const API = '/api/licencia/sesion';

async function huellaDe(texto: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
  return [...h.slice(0, 12)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function leer(clave: string): string {
  try { return localStorage.getItem(clave) ?? ''; } catch { return ''; }
}

/** Con licencia y sesión: el service worker guarda el código de las pantallas y los dibujos para usar sin conexión. */
function guardarParaSinConexion() {
  navigator.serviceWorker?.ready.then(r => { r.active?.postMessage('privado'); r.active?.postMessage('resto'); }).catch(() => {});
}

/**
 * Pide la sesión con la licencia firmada, si no la hay ya para esta firma o está a punto de caducar. Sin
 * conexión no pasa nada: el código ya guardado en el dispositivo sigue sirviendo.
 */
export async function pedirSesion(firma: string | undefined, f: typeof fetch = fetch): Promise<boolean> {
  if (!firma) return false;
  const huella = await huellaDe(firma).catch(() => '');
  if (huella && leer(HUELLA) === huella && Number(leer(HASTA)) - Date.now() > MARGEN) {
    guardarParaSinConexion();
    return true;
  }
  let ok = false;
  const control = new AbortController();
  const espera = setTimeout(() => control.abort(), 6000);
  try {
    const r = await f(`${location.origin}${API}`, {
      method: 'POST', credentials: 'same-origin', signal: control.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firma }),
    });
    if (r.ok) {
      const { hasta } = await r.json();
      try { localStorage.setItem(HASTA, String(Number(hasta) || 0)); localStorage.setItem(HUELLA, huella); } catch { /* sin almacenamiento */ }
      ok = true;
    }
  } catch { /* sin conexión */ } finally {
    clearTimeout(espera);
  }
  guardarParaSinConexion();
  return ok;
}

/**
 * La suscripción terminó (lo ha dicho el servidor): se borra la sesión y el código de la app guardado en el
 * dispositivo, que ya no se puede usar sin pagar. El trabajo del docente no se toca (está en IndexedDB y en
 * su Drive u OneDrive), y al renovar se vuelve a descargar todo.
 */
let bloqueada = false;

export async function olvidarApp(f: typeof fetch = fetch): Promise<void> {
  bloqueada = true;
  try { localStorage.removeItem(HASTA); localStorage.removeItem(HUELLA); } catch { /* sin almacenamiento */ }
  await f(`${location.origin}${API}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
  try {
    for (const r of (await navigator.serviceWorker?.getRegistrations()) ?? []) await r.unregister();
    for (const k of await caches.keys()) if (k.startsWith('aulapro-')) await caches.delete(k);
  } catch { /* sin service worker */ }
}

/**
 * Un bloque de código no ha llegado (la cookie se borró aparte, o caducó antes de lo que se recordaba): se
 * olvida lo recordado y se recarga una vez, para que al abrir se pida una sesión nueva.
 */
export function vigilarSesion() {
  window.addEventListener('vite:preloadError', () => {
    // Con la suscripción terminada, que falte el código es lo esperado: nada de recargar
    if (bloqueada) return;
    try {
      if (sessionStorage.getItem('aulapro_sesion_reintento')) return;
      sessionStorage.setItem('aulapro_sesion_reintento', '1');
      localStorage.removeItem(HASTA);
    } catch { return; }
    location.reload();
  });
}
