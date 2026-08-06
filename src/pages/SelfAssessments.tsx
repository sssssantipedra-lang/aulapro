import { useMemo, useState } from 'react';
import { Smartphone, Check, Trash2, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import type { SelfAssessmentSession } from '../types';
import { useToast } from '../components/ui/Toast';
import { plural } from '../lib/utils';
import { formatDay, formatTime } from '../services/audit';

interface Props {
  sessions: SelfAssessmentSession[];
  onInclude: (id: string) => void;
  onDelete: (id: string) => void;
  onNav: (s: string) => void;
}

/** Los cuatro niveles que ofrece la página del alumno en su móvil. */
const LEVEL_LABEL = ['Aún no', 'A veces', 'Casi siempre', 'Siempre'];
const LEVEL_COLOR = ['#dc2626', '#d97706', '#2563eb', '#047857'];

function fmt(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function SelfAssessments({ sessions, onInclude, onDelete, onNav }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState<string | null>(null);

  const ordered = useMemo(
    () => [...sessions].sort((a, b) => b.at.localeCompare(a.at)),
    [sessions],
  );

  function include(s: SelfAssessmentSession) {
    onInclude(s.id);
    toast(`✅ ${plural(s.rows.length, 'autoevaluación pasada', 'autoevaluaciones pasadas')} al historial`);
  }

  function remove(s: SelfAssessmentSession) {
    if (!confirm(
      `Se borrarán las respuestas de ${plural(s.rows.length, 'alumno', 'alumnos')} ` +
      `de «${s.title}».\n\nEsto no se puede deshacer.`,
    )) return;
    onDelete(s.id);
    toast('Autoevaluación descartada');
  }

  if (sessions.length === 0) {
    return (
      <section className="sec active">
        <div className="pg-hd">
          <div>
            <h1 className="pg-title">Autoevaluaciones</h1>
            <p className="pg-sub">Lo que responden los alumnos desde su móvil</p>
          </div>
        </div>
        <div className="card" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center', padding: '40px 34px' }}>
          <Smartphone size={38} color="var(--text-3)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
            Todavía no hay ninguna
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 20 }}>
            Cuando abras una sala con una rúbrica o una diana, lo que contesten
            tus alumnos se guardará aquí automáticamente. Después decides si lo
            pasas al historial de evaluaciones o lo descartas.
          </p>
          <button className="btn-accent" onClick={() => onNav('classroom-live')}>
            Ir a la Sala de alumnos <ArrowRight size={14} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">Autoevaluaciones</h1>
          <p className="pg-sub">
            {plural(sessions.length, 'sesión guardada', 'sesiones guardadas')} ·
            {' '}{sessions.filter(s => !s.included).length} sin decidir
          </p>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 18,
        padding: '13px 16px', background: 'var(--surface)', borderRadius: 11,
        fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6,
      }}>
        <Smartphone size={15} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Esto es lo que <strong style={{ color: 'var(--text)' }}>dicen los alumnos de sí mismos</strong>,
          no una calificación tuya. Por eso se guarda aparte y nunca entra en el
          cuaderno: si la pasas al historial, queda marcada como autoevaluación.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ordered.map(s => {
          const isOpen = open === s.id;
          const media = (() => {
            const vals = s.rows.map(r => r.grade).filter((v): v is number => v !== null);
            return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
          })();

          return (
            <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
                <button
                  className="ico-btn"
                  onClick={() => setOpen(isOpen ? null : s.id)}
                  title={isOpen ? 'Plegar' : 'Ver respuestas'}
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>{s.title}</span>
                    {s.included ? (
                      <span style={{
                        fontSize: 10.5, fontWeight: 800, padding: '2px 9px', borderRadius: 99,
                        background: 'rgba(16,185,129,0.14)', color: '#047857',
                      }}>
                        EN EL HISTORIAL
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 10.5, fontWeight: 800, padding: '2px 9px', borderRadius: 99,
                        background: 'var(--accent-l)', color: 'var(--accent-d)',
                      }}>
                        SIN DECIDIR
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                    {s.class_name} · {formatDay(s.date)} a las {formatTime(s.at)} ·{' '}
                    {plural(s.rows.length, 'respuesta', 'respuestas')}
                    {media !== null && ` · media ${fmt(media)}`}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {!s.included && (
                    <button className="btn-accent" style={{ fontSize: 12.5 }} onClick={() => include(s)}>
                      <Check size={14} />Pasar al historial
                    </button>
                  )}
                  <button className="ico-btn" title="Descartar" onClick={() => remove(s)}>
                    <Trash2 size={15} color="var(--danger)" />
                  </button>
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop: '0.5px solid var(--border)', overflowX: 'auto' }}>
                  <table className="rtable" style={{ minWidth: 520 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', minWidth: 150 }}>Alumno</th>
                        {s.items.map(it => (
                          <th key={it.id} style={{ minWidth: 78, fontSize: 10 }}>
                            {it.name.length > 18 ? it.name.slice(0, 17) + '…' : it.name}
                          </th>
                        ))}
                        <th style={{ minWidth: 60 }}>Media</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.rows.map((r, i) => (
                        <tr key={`${r.student_name}-${i}`}>
                          <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.student_name}</td>
                          {s.items.map(it => {
                            const v = r.scores[it.id];
                            return (
                              <td key={it.id} style={{ textAlign: 'center' }}>
                                {v ? (
                                  <span
                                    title={LEVEL_LABEL[v - 1]}
                                    style={{
                                      display: 'inline-block', minWidth: 24, padding: '3px 7px',
                                      borderRadius: 7, fontSize: 12.5, fontWeight: 800,
                                      background: `${LEVEL_COLOR[v - 1]}18`, color: LEVEL_COLOR[v - 1],
                                    }}
                                  >
                                    {v}
                                  </span>
                                ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 13 }}>
                            {fmt(r.grade)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
