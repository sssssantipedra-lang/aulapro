/**
 * El botón «Dar la clase» (20-11-2026): abre «Pizarra y herramientas» con la clase de la sesión y su plan del
 * día ya montado. El mismo en la franja de En clase, en el Inicio, en cada fila de Sesiones y en las sesiones
 * de una situación de aprendizaje. Qué hace al pulsarlo lo decide `darLaClase` de `App.tsx`.
 */
import { Presentation } from 'lucide-react';
import { useI18n } from '../../i18n';

interface Props {
  onClick: () => void;
  /** El título de la sesión que se va a dar, para quien no ve la fila (lector de pantalla) y como ayuda al pasar el ratón. */
  titulo?: string;
  /** En una fila de una lista: más pequeño y sin fondo. */
  compacto?: boolean;
  /** El botón principal de su franja. */
  principal?: boolean;
}

export function BotonDarLaClase({ onClick, titulo, compacto, principal }: Props) {
  const { t } = useI18n();
  const ayuda = titulo
    ? t('Abrir la pizarra con «{titulo}» en el plan del día', { titulo })
    : t('Abrir la pizarra con esta clase y el plan del día');
  return (
    <button
      type="button"
      className={`${principal ? 'btn-accent' : 'btn-ghost'} dlc-btn${compacto ? ' compacto' : ''}`}
      onClick={onClick}
      title={ayuda}
      aria-label={titulo ? t('Dar la clase: «{titulo}»', { titulo }) : undefined}
    >
      <Presentation size={compacto ? 13 : 14} aria-hidden="true" />{t('Dar la clase')}
    </button>
  );
}
