import type { LicenseError, LicenseState } from '../types/electron';

/**
 * Licencia del equipo, vista desde la interfaz. Todo lo importante pasa en el
 * proceso principal (`electron/license.cjs`); aquí solo se pregunta y se
 * explica. Fuera del escritorio (el navegador) no hay licencia: `null`.
 */
export function licenseBridge() {
  return window.electronAPI?.license ?? null;
}

export async function getLicenseState(): Promise<LicenseState | null> {
  const bridge = licenseBridge();
  if (!bridge) return null;
  try { return await bridge.state(); } catch { return null; }
}

/** Qué decirle al docente cuando la activación no sale. */
export const LICENSE_ERROR_TEXT: Record<LicenseError, string> = {
  'clave-no-valida': 'Esa clave no existe. Cópiala tal cual del correo que recibiste al comprar.',
  'limite': 'Esta clave ya está activada en todos los dispositivos que permite. Desactívala en uno de ellos (Configuración › Licencia) y vuelve a probar.',
  'desactivada': 'Esta clave está desactivada. Revisa el correo de la compra o escríbenos.',
  'otra-tienda': 'Esa clave no es de Aula Pro.',
  'sin-conexion': 'Para activar hace falta internet (solo esta vez). Conéctate y vuelve a probar.',
  'error-tienda': 'La tienda no responde ahora mismo. Vuelve a probar en un rato.',
  'sin-licencia': 'En este equipo no hay ninguna licencia activada.',
};

/** Por qué aparece la pantalla de activación. */
export const LICENSE_STATUS_TEXT: Partial<Record<LicenseState['status'], string>> = {
  'sin-licencia': 'Escribe la clave de licencia que recibiste por correo al comprar Aula Pro.',
  'otro-equipo': 'Esta copia de Aula Pro se activó en otro ordenador. Escribe tu clave para activarla en este.',
};
