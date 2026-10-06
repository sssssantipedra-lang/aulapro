/**
 * Saltos entre pantallas de PT y AL con algo ya elegido. Como
 * `settingsNav.ts`: se piden antes de navegar y la pantalla los lee una sola
 * vez al abrirse.
 *
 * El grupo y el día que se quieren abrir en el Registro diario al llegar
 * desde el Inicio («Registrar» en una sesión de hoy o en una que se quedó sin
 * registrar).
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

/**
 * El alumno para el que se quiere una ficha adaptada al llegar a Recursos
 * desde Programas. Se lee una sola vez.
 */
let fichaPara: string | null = null;

export function requestFichaPara(alumnoId: string) {
  fichaPara = alumnoId;
}

export function takeFichaPara(): string | null {
  const id = fichaPara;
  fichaPara = null;
  return id;
}
