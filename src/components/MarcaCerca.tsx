/**
 * La marca de un evento cercano (25-11-2026, petición del dueño): a un evento de la Agenda le faltan 5 días o
 * menos (`diasSiCerca`, `lib/notificaciones.ts`). Parpadea 5 veces con el color del tema al entrar en la
 * pantalla (al montarse) y después se queda quieta, como un anillo discreto del mismo color; con «reducir
 * movimiento», solo la marca quieta (`estilos/notificaciones.css`). Siempre dice cuánto falta: «Hoy»,
 * «Mañana», «Faltan 3 días».
 *
 * `MarcaCerca` es la píldora con el texto, para las listas. Lo que ya tiene su forma (un día del calendario,
 * un evento de la semana) lleva la clase `CLASE_CERCA` y su texto en el título.
 */
import { useI18n } from '../i18n';
import { textoDeFalta } from '../lib/notificaciones';

/** La clase que hace parpadear el anillo de un elemento y lo deja marcado después. */
export const CLASE_CERCA = 'cerca-latido';

/**
 * La píldora «Faltan 3 días». Con `latido` (de partida) es ella la que parpadea; sin él, solo la marca quieta,
 * para cuando ya parpadea el elemento que la lleva (un evento del día elegido en la Agenda).
 */
export function MarcaCerca({ dias, className, latido = true }: { dias: number; className?: string; latido?: boolean }) {
  const { t } = useI18n();
  // La coma solo la oye el lector de pantalla: sin ella, «Reunión de ciclo Mañana» parecería parte del nombre
  return (
    <>
      <span className="sr-only">, </span>
      <span className={['cerca-pill', latido ? CLASE_CERCA : '', className ?? ''].filter(Boolean).join(' ')}>{textoDeFalta(dias, t)}</span>
    </>
  );
}
