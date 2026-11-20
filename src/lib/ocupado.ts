/**
 * Lo que está en marcha y no conviene cortar (19-11-2026): una petición a la IA o un temporizador de la
 * pizarra. Lo consultan la recarga que pone la versión nueva al volver a la app (`platform/web.ts`) y el
 * plazo que suelta la pizarra oculta (`App.tsx`). Quien empieza algo llama a `ocupar` y, al acabar, a la
 * función que devuelve.
 */
export type MotivoOcupado = 'ia' | 'temporizador';

const cuenta = new Map<MotivoOcupado, number>();

export function ocupar(motivo: MotivoOcupado): () => void {
  cuenta.set(motivo, (cuenta.get(motivo) ?? 0) + 1);
  let suelto = false;
  return () => {
    if (suelto) return;
    suelto = true;
    cuenta.set(motivo, Math.max(0, (cuenta.get(motivo) ?? 1) - 1));
  };
}

/** Si hay algo en marcha de ese motivo, o de cualquiera si no se dice. */
export function ocupado(motivo?: MotivoOcupado): boolean {
  return motivo ? (cuenta.get(motivo) ?? 0) > 0 : [...cuenta.values()].some(n => n > 0);
}
