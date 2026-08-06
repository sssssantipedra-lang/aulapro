import { useEffect, useMemo, useRef, useState } from 'react';
import { TrendingUp, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { Class, Student, GradeCategory, GradeItem, GradeMap } from '../../types';

interface Props {
  classes: Class[];
  students: Student[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  onNav: (s: string) => void;
}

/** Cada cuánto pasa al siguiente panel. */
const ROTATE_MS = 10_000;
/** Duración de la transición. Debe cuadrar con la del CSS. */
const FADE_MS = 420;

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

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const timers = useRef<number[]>([]);

  // Si desaparecen paneles (se borra una clase), el índice puede quedar fuera
  const safeIndex = panels.length ? index % panels.length : 0;
  const panel = panels[safeIndex];

  /** Cambia de panel con un fundido: primero se apaga, luego se sustituye. */
  function goTo(next: number) {
    timers.current.forEach(clearTimeout);
    setVisible(false);
    const t = window.setTimeout(() => {
      setIndex(((next % panels.length) + panels.length) % panels.length);
      setVisible(true);
    }, FADE_MS);
    timers.current = [t];
  }

  // El intervalo se crea una sola vez, así que debe leer el índice actual y no
  // el que hubiera cuando se creó.
  const indexRef = useRef(safeIndex);
  indexRef.current = safeIndex;

  useEffect(() => {
    if (paused || panels.length < 2) return;
    const id = window.setInterval(() => goTo(indexRef.current + 1), ROTATE_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, panels.length]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (panels.length === 0) return null;

  const top = panel.averages.slice(0, 6);
  const maxima = 10;

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <style>{CAROUSEL_CSS}</style>

      <div className="card-hd">
        <div className="card-ttl">
          <TrendingUp size={14} color="var(--accent-d)" />Rendimiento
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {panels.length > 1 && (
            <>
              <button className="ico-btn" title="Anterior" onClick={() => goTo(safeIndex - 1)}>
                <ChevronLeft size={15} />
              </button>
              <button
                className="ico-btn"
                title={paused ? 'Reanudar el paso automático' : 'Detener el paso automático'}
                onClick={() => setPaused(p => !p)}
              >
                {paused ? <Play size={14} /> : <Pause size={14} />}
              </button>
              <button className="ico-btn" title="Siguiente" onClick={() => goTo(safeIndex + 1)}>
                <ChevronRight size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className={`perf-panel${visible ? ' on' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: panel.color, flexShrink: 0 }} />
          <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>{panel.className}</span>
          <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{panel.subject}</span>
          <div style={{ flex: 1 }} />
          {panel.groupAverage !== null && (
            <span style={{ fontSize: 19, fontWeight: 800, color: colorFor(panel.groupAverage) }}>
              {panel.groupAverage.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
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
                {a.value.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
            </div>
          ))}
        </div>

        {panel.averages.length > top.length && (
          <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 10 }}>
            y {panel.averages.length - top.length} alumnos más
          </p>
        )}
      </div>

      {panels.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 12 }}>
          {panels.map((p, i) => (
            <button
              key={p.key}
              onClick={() => goTo(i)}
              title={`${p.className} · ${p.subject}`}
              style={{
                width: i === safeIndex ? 18 : 6, height: 6, borderRadius: 99, border: 'none',
                cursor: 'pointer', padding: 0,
                background: i === safeIndex ? 'var(--accent-d)' : 'var(--border)',
                transition: 'width 0.3s ease, background 0.3s ease',
              }}
            />
          ))}
        </div>
      )}

      <button
        className="btn-ghost"
        style={{ width: '100%', justifyContent: 'center', marginTop: 12, fontSize: 12.5 }}
        onClick={() => onNav('notebook')}
      >
        Abrir el cuaderno
      </button>
    </div>
  );
}

const CAROUSEL_CSS = `
.perf-panel {
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.42s ease, transform 0.42s ease;
}
.perf-panel.on { opacity: 1; transform: translateY(0); }
.perf-bar {
  height: 100%; border-radius: 5;
  transition: width 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}
@media (prefers-reduced-motion: reduce) {
  .perf-panel, .perf-bar { transition: none; }
}
`;
