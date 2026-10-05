/**
 * El grupo y el día que se quieren abrir en el Registro diario al llegar
 * desde el Inicio de PT y AL («Registrar» en una sesión de hoy o en una que
 * se quedó sin registrar). Como `settingsNav.ts`: se lee una sola vez.
 */
export interface RegistroPedido { grupoId: string; fecha: string }

let pending: RegistroPedido | null = null;

export function requestRegistro(p: RegistroPedido) {
  pending = p;
}

export function takeRegistro(): RegistroPedido | null {
  const p = pending;
  pending = null;
  return p;
}
