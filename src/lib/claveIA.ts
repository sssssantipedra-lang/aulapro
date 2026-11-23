/**
 * La clave de la IA, a la vista de las pantallas (20-11-2026).
 *
 * Dos cosas pequeñas que antes no hacían falta porque la clave solo se ponía en Configuración:
 *
 *   - Avisar de que la clave ha cambiado. Las pantallas miran `hasApiKey()` al pintarse; si la clave se pone en
 *     una ventana abierta encima de ellas, tienen que volver a pintarse para activar su botón de generar sin
 *     perder lo escrito. `setApiKey` (`services/gemini.ts`) llama a `claveCambiada` y quien quiera enterarse usa
 *     `useHayClaveIA` (`hooks/useClaveIA.ts`).
 *   - Abrir la ventana de la clave desde cualquier sitio. «Configurar la IA» ya no lleva a Configuración: llama a
 *     `abrirClaveIA()` y los pasos salen en una ventana sobre la pantalla en curso (`components/VentanaClaveIA.tsx`,
 *     montada una vez en `App.tsx`).
 *
 * Aquí no se guarda ni se lee la clave: solo se avisa.
 */

type Oyente = () => void;

const oyentes = new Set<Oyente>();
let abierta = false;
/** Cuenta los cambios de la clave: lo que `useSyncExternalStore` compara para volver a pintar. */
let version = 0;

const avisar = () => { for (const f of [...oyentes]) f(); };

/** Para `useSyncExternalStore`: se llama a `f` cuando cambia la clave o se abre o se cierra la ventana. */
export function suscribirClaveIA(f: Oyente): () => void {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
}

/** La clave se ha guardado, cambiado o quitado. */
export function claveCambiada() {
  version += 1;
  avisar();
}

export const versionDeClave = () => version;

/** Abre los pasos de la clave en una ventana, sobre la pantalla en la que esté el docente. */
export function abrirClaveIA() {
  if (abierta) return;
  abierta = true;
  avisar();
}

export function cerrarClaveIA() {
  if (!abierta) return;
  abierta = false;
  avisar();
}

export const ventanaClaveAbierta = () => abierta;
