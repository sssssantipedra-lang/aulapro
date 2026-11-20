import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Class } from '../../types';
import { useI18n } from '../../i18n';
import { agruparPorEtapa } from '../../lib/etapas';
import { useClaseDeAhora } from '../../hooks/useClaseActiva';

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
 *
 * La clase de ahora según el horario (`lib/claseActiva.ts`) lleva un punto, para que se vea por qué
 * la pantalla se ha abierto en ella y se pueda volver con un toque después de mirar otra.
 */
export function ClassChips({ classes, value, onChange, counts }: Props) {
  const { t } = useI18n();
  const deAhora = useClaseDeAhora();
  const ahora = deAhora && classes.some(c => c.id === deAhora.id) ? deAhora : null;
  const porque = ahora && (ahora.enMarcha ? t('Ahora, según tu horario') : t('Empieza a las {h}, según tu horario', { h: ahora.desde }));

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
                {g.clases.map(c => <option key={c.id} value={c.id}>{c.id === ahora?.id && c.id !== value ? `● ${texto(c)}` : texto(c)}</option>)}
              </optgroup>
            ))}
          </select>
          <ChevronDown size={15} className="class-pick-chev" aria-hidden="true" />
        </label>
        <button type="button" className="ico-btn" onClick={() => ir(1)} aria-label={t('Clase siguiente')}><ChevronRight size={16} /></button>
        {ahora && (ahora.id === value ? (
          <span className="clase-ahora" title={porque ?? undefined}>
            <span className="clase-ahora-punto" aria-hidden="true" />
            <span aria-hidden="true">{t(ahora.enMarcha ? 'Ahora' : 'A las {h}', { h: ahora.desde })}</span>
            <span className="sr-only">{porque}</span>
          </span>
        ) : (
          <button type="button" className="clase-ahora ir" title={porque ?? undefined} onClick={() => onChange(ahora.id)}>
            <span className="clase-ahora-punto" aria-hidden="true" />
            <span className="sr-only">{t('Ir a la clase de ahora:')} </span>
            {t(ahora.enMarcha ? 'Ahora' : 'A las {h}', { h: ahora.desde })}: {orden.find(c => c.id === ahora.id)?.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="chip-row">
      {classes.map(c => {
        const on = c.id === value;
        const esAhora = c.id === ahora?.id;
        return (
          <button
            key={c.id}
            type="button"
            className={`chip${on ? ' on' : ''}`}
            style={on ? { borderColor: c.color } : undefined}
            aria-pressed={on}
            title={esAhora ? porque ?? undefined : undefined}
            onClick={() => onChange(c.id)}
          >
            <span className="chip-dot" style={{ background: c.color }} aria-hidden="true" />
            {c.name}
            {counts && <span className="chip-count">{counts[c.id] ?? 0}</span>}
            {esAhora && (
              <span className="clase-ahora en-chip">
                <span className="clase-ahora-punto" aria-hidden="true" />
                <span aria-hidden="true">{t(ahora.enMarcha ? 'Ahora' : 'A las {h}', { h: ahora.desde })}</span>
                <span className="sr-only">{porque}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
