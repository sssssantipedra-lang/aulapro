/**
 * Las competencias clave que evalúa un criterio de rúbrica o un ítem de diana:
 * las ocho de la LOMLOE como botones que se marcan y desmarcan. Las pone la
 * IA y el docente las cambia aquí (decisión del dueño, 3-10-2026). Con ellas
 * se calcula al evaluar la nota de cada competencia clave, que va a la Diana
 * competencial (`competencyScoresFor`).
 */
import { useI18n } from '../../i18n';
import { competenciasClaveValidas, LOMLOE_COMPETENCES } from '../../lib/utils';

export function CompetenciasClavePicker({ value, onChange }: {
  value: string[];
  onChange: (codigos: string[]) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="cc-picker" role="group" aria-label={t('Competencias clave')}>
      <span className="co-ttl">{t('Competencias clave')}</span>
      {LOMLOE_COMPETENCES.map(c => {
        const marcada = value.includes(c.key);
        return (
          <button
            key={c.key} type="button" className={`cc-chip${marcada ? ' on' : ''}`}
            aria-pressed={marcada} aria-label={`${c.key}, ${t(c.label)}`} title={t(c.label)}
            onClick={() => onChange(competenciasClaveValidas(marcada ? value.filter(k => k !== c.key) : [...value, c.key]))}
          >
            {c.key}
          </button>
        );
      })}
    </div>
  );
}
