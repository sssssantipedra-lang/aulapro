/**
 * Un interruptor para que el guardado automático (`hooks/useGuardadoAutomatico.ts`) no escriba nada más en esta
 * pestaña (auditoría del 1-11-2026). Se baja cuando lo que hay en memoria ya no es lo último y escribirlo pisaría el
 * trabajo bueno:
 *
 *  - otra pestaña o ventana se ha quedado con AulaPro (`platform/unaPestana.ts`);
 *  - se acaba de restaurar una copia y la app se va a recargar (`components/DataFolder.tsx`).
 *
 * No se vuelve a subir: la pestaña se recarga y empieza de nuevo.
 */
let bloqueado = false;

export function bloquearGuardado(): void {
  bloqueado = true;
}

export const guardadoBloqueado = (): boolean => bloqueado;
