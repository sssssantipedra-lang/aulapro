import { createContext, useContext } from 'react';

/**
 * Modo de prueba: sin licencia, la pantalla de activación deja entrar con datos
 * de ejemplo (docs/WEB.md, apartado 3, punto 6). Nada de lo que se hace ahí es
 * del docente: el perfil es de ejemplo, no se pueden crear perfiles de verdad y
 * se borra al activar la licencia. Salir de la app vuelve a pedir la clave.
 */

const KEY = 'aulapro_perfil_prueba';

/** El perfil de ejemplo de la prueba en curso (o de la última), si lo hay. */
export function perfilPrueba(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function recordarPerfilPrueba(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch { /* almacenamiento no disponible */ }
}

/**
 * Borra el perfil de ejemplo de la prueba. `borrar` es `deleteProfile` de
 * `services/storage`; `activo` y `quitarActivo`, el perfil abierto, para no dejar
 * apuntando a uno que ya no existe.
 */
export async function limpiarPrueba(
  borrar: (id: string) => Promise<void>,
  activo: () => string | null,
  quitarActivo: () => void,
) {
  const id = perfilPrueba();
  if (!id) return;
  try { await borrar(id); } catch { /* ya no estaba */ }
  if (activo() === id) quitarActivo();
  recordarPerfilPrueba(null);
}

export interface PruebaContexto {
  /** Hay que dejar la prueba y enseñar la pantalla de activación. */
  activar: () => void;
}

/** `null` fuera del modo de prueba. */
export const PruebaCtx = createContext<PruebaContexto | null>(null);

export function useModoPrueba(): PruebaContexto | null {
  return useContext(PruebaCtx);
}
