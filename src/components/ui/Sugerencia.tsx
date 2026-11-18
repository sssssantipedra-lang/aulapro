/**
 * Una sugerencia en el momento (18-11-2026): un recuadro pequeño que dice qué
 * pasa y por qué, propone una sola cosa y se puede cerrar. Las reglas y lo que
 * ya se ha visto, en `lib/sugerencias.ts`.
 */
import { Lightbulb, X } from 'lucide-react';
import { useI18n } from '../../i18n';

export function Sugerencia({ titulo, porque, accion, onAccion, onCerrar }: {
  titulo: string;
  /** El motivo, siempre: una sugerencia sin explicación no se enseña. */
  porque: string;
  accion?: string;
  onAccion?: () => void;
  onCerrar: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="sug" role="status">
      <Lightbulb size={17} aria-hidden="true" />
      <div className="sug-txt">
        <strong>{titulo}</strong>
        <span>{porque}</span>
      </div>
      {accion && onAccion && <button type="button" className="btn-accent sug-btn" onClick={onAccion}>{accion}</button>}
      <button type="button" className="ico-btn" onClick={onCerrar} aria-label={t('Descartar la sugerencia')} title={t('Descartar la sugerencia')}><X size={16} /></button>
    </div>
  );
}
