/**
 * Marca en este dispositivo que la suscripción de la licencia terminó (no se renovó o se devolvió).
 * Solo cambia lo que dice la pantalla de licencia: «tu suscripción ha terminado» y el precio de renovación.
 * No guarda nada personal; si el almacenamiento no está, la pantalla sale como la de quien aún no ha comprado.
 */
const CLAVE = 'aulapro_licencia_vencida';

export const marcarLicenciaVencida = () => { try { localStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento */ } };
export const limpiarLicenciaVencida = () => { try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } };
export const licenciaVencida = () => { try { return localStorage.getItem(CLAVE) === '1'; } catch { return false; } };

/**
 * Lo mismo para el acceso anticipado gratuito (beta, `web/funciones/api/_beta.js`): se cerró al abrirse la venta. La pantalla de
 * licencia dice que el acceso anticipado terminó (no que «la suscripción terminó») y ofrece suscribirse al precio de lanzamiento.
 */
const CLAVE_BETA = 'aulapro_beta_terminada';

export const marcarBetaTerminada = () => { try { localStorage.setItem(CLAVE_BETA, '1'); } catch { /* sin almacenamiento */ } };
export const limpiarBetaTerminada = () => { try { localStorage.removeItem(CLAVE_BETA); } catch { /* sin almacenamiento */ } };
export const betaTerminada = () => { try { return localStorage.getItem(CLAVE_BETA) === '1'; } catch { return false; } };
