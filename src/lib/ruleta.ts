/**
 * La memoria de la ruleta: quién ha salido ya en cada clase, hasta que el
 * docente reinicia la lista (decisión del dueño, 18-10-2026). Se guarda en el
 * dispositivo, como la pizarra clara u oscura, y no en los datos del perfil.
 * Lleva solo nombres que ya están en la clase: lo que no coincide se ignora.
 */

const CLAVE = 'aulapro_ruleta_';

/** Los que ya han salido en esta clase; vacío si no hay nada guardado o no se puede leer. */
export function leerSalidos(clase: string): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CLAVE + clase) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function guardarSalidos(clase: string, salidos: string[]): void {
  try {
    if (salidos.length === 0) localStorage.removeItem(CLAVE + clase);
    else localStorage.setItem(CLAVE + clase, JSON.stringify(salidos));
  } catch { /* sin almacenamiento: la lista solo dura esta sesión */ }
}

/** Los nombres de la clase que todavía no han salido, en su orden. */
export function sinSalir(nombres: string[], salidos: string[]): string[] {
  const ya = new Set(salidos);
  return nombres.filter(n => !ya.has(n));
}

/** Añade a quien acaba de salir, sin repetirlo y sin guardar nombres que ya no están en la clase. */
export function marcarSalido(nombres: string[], salidos: string[], nombre: string): string[] {
  const aqui = new Set(nombres);
  return [...new Set([...salidos, nombre])].filter(n => aqui.has(n));
}
