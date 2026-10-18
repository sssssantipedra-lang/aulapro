/**
 * Aviso de que se ha guardado un archivo en Android. El puente nativo
 * (platform/android.ts) lo emite; la pantalla (components/AvisoGuardado.tsx)
 * lo recoge y enseña dónde ha quedado, con botones para abrirlo, ir a su
 * carpeta o compartirlo.
 */

export const EVENTO_GUARDADO = 'aulapro:guardado';

export interface Guardado {
  /** Nombre del archivo, tal como quedó (Android añade «(1)» si ya existía). */
  nombre: string;
  /** La carpeta de AulaPro: «Fichas», «Actas»… */
  carpeta: string;
  /** Dirección para abrirlo o compartirlo. */
  uri: string;
  mime: string;
}

export function avisarGuardado(g: Guardado): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<Guardado>(EVENTO_GUARDADO, { detail: g }));
}

/** Escucha los avisos; devuelve la función para dejar de hacerlo. */
export function alGuardar(cb: (g: Guardado) => void): () => void {
  const f = (e: Event) => cb((e as CustomEvent<Guardado>).detail);
  window.addEventListener(EVENTO_GUARDADO, f);
  return () => window.removeEventListener(EVENTO_GUARDADO, f);
}
