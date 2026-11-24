import { useSyncExternalStore } from 'react';
import { suscribirClaveIA, ventanaClaveAbierta, versionDeClave } from '../lib/claveIA';
import { hasApiKey } from '../services/gemini';

/**
 * Si hay clave de la IA, al día: la pantalla se vuelve a pintar cuando la clave se pone, se cambia o se quita
 * (por ejemplo, en la ventana de la clave abierta encima de ella), sin perder nada de lo escrito.
 */
export function useHayClaveIA(): boolean {
  useSyncExternalStore(suscribirClaveIA, versionDeClave, versionDeClave);
  return hasApiKey();
}

/** Si la ventana de la clave está abierta (`abrirClaveIA` y `cerrarClaveIA` en `lib/claveIA.ts`). */
export function useVentanaClaveIA(): boolean {
  return useSyncExternalStore(suscribirClaveIA, ventanaClaveAbierta, ventanaClaveAbierta);
}
