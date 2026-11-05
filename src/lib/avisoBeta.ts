/**
 * El aviso que lee y confirma quien entra en el acceso anticipado gratuito (beta, 5-11-2026, petición del dueño: «que al entrar
 * tengan que clicar como que se les informa de que durante un periodo de tiempo la app va a estar abierta, pero después
 * pasará a ser de pago, y que sus datos los pueden recuperar descargándolos»).
 *
 * Se guarda en este dispositivo qué versión del aviso se confirmó. Si el aviso cambia de forma importante, se sube
 * `VERSION_AVISO_BETA` y se vuelve a pedir. No viaja al servidor (AulaPro no guarda nada de quien usa la beta). Solo lo ve quien
 * tiene la licencia de acceso anticipado (`components/AvisoAccesoAnticipado.tsx`, `App.tsx`): fundadores y quien paga, no.
 */
export const VERSION_AVISO_BETA = '2026-11-05';

const CLAVE = 'aulapro_aviso_beta';

/** ¿Se confirmó en este dispositivo la versión vigente del aviso? */
export function avisoBetaVisto(): boolean {
  try { return localStorage.getItem(CLAVE) === VERSION_AVISO_BETA; } catch { return false; }
}

/** Se confirmó: no se vuelve a pedir en este dispositivo (salvo que cambie la versión). */
export function marcarAvisoBetaVisto() {
  try { localStorage.setItem(CLAVE, VERSION_AVISO_BETA); } catch { /* sin almacenamiento: se volverá a pedir */ }
}

/** ¿Hay que enseñar el aviso antes de dejar usar la app? Solo con la licencia de acceso anticipado y sin confirmar. */
export const hayQueEnseñarAvisoBeta = (estado: string | undefined, visto: boolean) => estado === 'beta' && !visto;
