/**
 * Marca en este dispositivo que la suscripción de la licencia terminó (no se renovó o se devolvió).
 * Solo cambia lo que dice la pantalla de licencia: «tu suscripción ha terminado» y el precio de renovación.
 * No guarda nada personal; si el almacenamiento no está, la pantalla sale como la de quien aún no ha comprado.
 */
const CLAVE = 'aulapro_licencia_vencida';

export const marcarLicenciaVencida = () => { try { localStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento */ } };
export const limpiarLicenciaVencida = () => { try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } };
export const licenciaVencida = () => { try { return localStorage.getItem(CLAVE) === '1'; } catch { return false; } };
