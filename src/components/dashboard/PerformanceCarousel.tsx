import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import type { Class, Student, GradeCategory, GradeItem, GradeMap } from '../../types';
import { useI18n } from '../../i18n';
import { useCarousel, CarouselControls, CarouselDots } from './carousel';

interface Props {
  classes: Class[];
  students: Student[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  onNav: (s: string) => void;
}

interface Panel {
  key: string;
  className: string;
  subject: string;
  color: string;
  /** Media de cada alumno, ya calculada. */
  averages: { name: string; value: number }[];
  groupAverage: number | null;
}

/** Media ponderada de un alumno dentro de una asignatura. */
function studentAverage(
  studentId: string, cats: GradeCategory[], items: GradeItem[], grades: GradeMap,
): number | null {
  let sum = 0, weight = 0;
  for (const cat of cats) {
    const vals = items
      .filter(i => i.category_id === cat.id)
      .map(i => grades[i.id]?.[studentId])
      .filter((v): v is number => typeof v === 'number');
    if (vals.length === 0) continue;
    sum += (vals.reduce((a, b) => a + b, 0) / vals.length) * cat.weight;
    weight += cat.weight;
  }
  return weight ? sum / weight : null;
}

function colorFor(n: number): string {
  if (n < 5) return '#dc2626';
  if (n < 7) return '#d97706';
  return '#047857';
}

/**
 * Rendimiento por clase y asignatura, rotando solo.
 *
 * Un docente con varias clases tendría que ir abriendo el cuaderno una por
 * una para hacerse una idea. Aquí van pasando: cada panel es una asignatura
 * de una clase, y solo aparecen las que tienen alguna nota puesta.
 */
export function PerformanceCarousel({
  classes, students, gradeCategories, gradeItems, grades, onNav,
}: Props) {
  const { t, locale } = useI18n();
  const panels = useMemo<Panel[]>(() => {
    const out: Panel[] = [];
    for (const cls of classes) {
      const roster = students.filter(s => s.class_id === cls.id);
      if (roster.length === 0) continue;
      const subjects = cls.subjects?.length ? cls.subjects : [cls.subject];

      for (const subject of subjects) {
        const cats = gradeCategories.filter(c =>
          c.class_id === cls.id && (c.subject ?? subjects[0] ?? '') === subject);
        if (cats.length === 0) continue;

        const catIds = new Set(cats.map(c => c.id));
        const items = gradeItems.filter(i => catIds.has(i.category_id));
        if (items.length === 0) continue;

        const averages = roster
          .map(s => ({ name: s.name, value: studentAverage(s.id, cats, items, grades) }))
          .filter((x): x is { name: string; value: number } => x.value !== null)
          .sort((a, b) => b.value - a.value);

        // Sin ninguna nota puesta no hay nada que enseñar
        if (averages.length === 0) continue;

        out.push({
          key: `${cls.id}-${subject}`,
          className: cls.name,
          subject,
          color: cls.color,
          averages,
          groupAverage: averages.reduce((a, b) => a + b.value, 0) / averages.length,
        });
      }
    }
    return out;
  }, [classes, students, gradeCategories, gradeItems, grades]);

  const { index: safeIndex, visible, paused, setPaused, goTo, hoverProps } = useCarousel(panels.length);
  const panel = panels[safeIndex];

  if (panels.length === 0) return null;

  const top = panel.averages.slice(0, 6);
  const maxima = 10;

  return (
    <div className="card" style={{ overflow: 'hidden' }} {...hoverProps}>
      <style>{CAROUSEL_CSS}</style>

      <div className="card-hd">
        <div className="card-ttl">
          <TrendingUp size={14} color="var(--accent-d)" />{t('Rendimiento')}
        </div>
        <CarouselControls
          pages={panels.length}
          paused={paused}
          onPause={() => setPaused(p => !p)}
          onPrev={() => goTo(safeIndex - 1)}
          onNext={() => goTo(safeIndex + 1)}
        />
      </div>

      <div className={`dash-panel${visible ? ' on' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: panel.color, flexShrink: 0 }} />
          <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>{panel.className}</span>
          <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{panel.subject}</span>
          <div style={{ flex: 1 }} />
          {panel.groupAverage !== null && (
            <span style={{ fontSize: 19, fontWeight: 800, color: colorFor(panel.groupAverage) }}>
              {panel.groupAverage.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {top.map((a, i) => (
            <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 96, flexShrink: 0, fontSize: 12, color: 'var(--text-2)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {a.name.split(' ')[0]} {a.name.split(' ')[1]?.[0] ?? ''}.
              </span>
              <div style={{ flex: 1, height: 9, borderRadius: 5, background: 'var(--surface)', overflow: 'hidden' }}>
                <div
                  className="perf-bar"
                  style={{
                    width: visible ? `${(a.value / maxima) * 100}%` : '0%',
                    background: colorFor(a.value),
                    transitionDelay: `${i * 45}ms`,
                  }}
                />
              </div>
              <span style={{
                width: 30, textAlign: 'right', fontSize: 12, fontWeight: 800,
                color: colorFor(a.value), flexShrink: 0,
              }}>
                {a.value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
            </div>
          ))}
        </div>

        {panel.averages.length > top.length && (
          <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 10 }}>
            {t('y {n} alumnos más', { n: panel.averages.length - top.length })}
          </p>
        )}
      </div>

      <CarouselDots
        pages={panels.length}
        index={safeIndex}
        onGo={goTo}
        titleFor={i => `${panels[i].className} · ${panels[i].subject}`}
      />

      <button
        className="btn-ghost"
        style={{ width: '100%', justifyContent: 'center', marginTop: 12, fontSize: 12.5 }}
        onClick={() => onNav('notebook')}
      >
        {t('Abrir el cuaderno')}
      </button>
    </div>
  );
}

// El fundido del panel vive en index.css (.dash-panel), compartido con las
// demás tarjetas del inicio. Aquí queda solo lo propio de las barras.
const CAROUSEL_CSS = `
.perf-bar {
  height: 100%; border-radius: 5px;
  transition: width 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}
@media (prefers-reduced-motion: reduce) {
  .perf-bar { transition: none; }
}
`;
