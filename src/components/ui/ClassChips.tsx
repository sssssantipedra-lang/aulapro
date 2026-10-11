import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Class } from '../../types';
import { useI18n } from '../../i18n';
import { agruparPorEtapa } from '../../lib/etapas';

interface Props {
  classes: Pick<Class, 'id' | 'name' | 'color' | 'etapa' | 'curso'>[];
  value: string;
  onChange: (id: string) => void;
  /** Número a mostrar junto a cada clase (p. ej. cuántos alumnos tiene). */
  counts?: Record<string, number>;
}

/**
 * A partir de cuántas clases los chips dejan sitio a un desplegable: con más,
 * ocupan dos líneas y empujan la tabla hacia abajo (decisión del dueño,
 * 11-10-2026, con los datos de ejemplo de diez clases).
 */
export const MAX_CHIPS = 6;



/**
 * Selector de clase. Es el mismo en todas las pantallas que trabajan clase a
 * clase (cuaderno, asistencia…), para que se lea y se use igual en todas.
 *
 * Con pocas clases, chips con su color. Con más de `MAX_CHIPS`, un
 * desplegable agrupado por etapa (Primaria, ESO y las demás), con el color
 * de la clase elegida al lado y flechas para pasar a la anterior o la
 * siguiente sin abrirlo.
 */
export function ClassChips({ classes, value, onChange, counts }: Props) {
  const { t } = useI18n();

  if (classes.length > MAX_CHIPS) {
    const grupos = agruparPorEtapa(classes);
    // Las flechas siguen el orden del desplegable
    const orden = grupos.flatMap(g => g.clases);
    const i = orden.findIndex(c => c.id === value);
    const actual = orden[i];
    const ir = (d: number) => onChange(orden[(i + d + orden.length) % orden.length].id);
    const texto = (c: Props['classes'][number]) => (counts ? `${c.name} (${counts[c.id] ?? 0})` : c.name);

    return (
      <div className="class-pick">
        <button type="button" className="ico-btn" onClick={() => ir(-1)} aria-label={t('Clase anterior')}><ChevronLeft size={16} /></button>
        <label className="class-pick-sel" style={{ '--cp-c': actual?.color ?? 'var(--border-strong)' } as React.CSSProperties}>
          <span className="chip-dot" aria-hidden="true" />
          <span className="sr-only">{t('Clase')}</span>
          <select value={value} onChange={e => onChange(e.target.value)}>
            {grupos.map(g => (
              <optgroup key={g.id} label={t(g.label)}>
                {g.clases.map(c => <option key={c.id} value={c.id}>{texto(c)}</option>)}
              </optgroup>
            ))}
          </select>
          <ChevronDown size={15} className="class-pick-chev" aria-hidden="true" />
        </label>
        <button type="button" className="ico-btn" onClick={() => ir(1)} aria-label={t('Clase siguiente')}><ChevronRight size={16} /></button>
      </div>
    );
  }

  return (
    <div className="chip-row">
      {classes.map(c => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            className={`chip${on ? ' on' : ''}`}
            style={on ? { borderColor: c.color } : undefined}
            aria-pressed={on}
            onClick={() => onChange(c.id)}
          >
            <span className="chip-dot" style={{ background: c.color }} aria-hidden="true" />
            {c.name}
            {counts && <span className="chip-count">{counts[c.id] ?? 0}</span>}
          </button>
        );
      })}
    </div>
  );
}
