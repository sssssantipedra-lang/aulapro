import { useState, useMemo } from 'react';
import { Plus, ChevronDown, ChevronUp, Search, ClipboardList } from 'lucide-react';
import type { Evaluation, Class, Student, Rubric } from '../types';
import { plural } from '../lib/utils';

interface Props {
  evaluations: Evaluation[];
  classes: Class[];
  students: Student[];
  rubrics: Rubric[];
  onOpenEval: (rubricId: string, studentId: string, classId: string) => void;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function evalTotalScore(e: Evaluation): { sum: number; max: number } {
  const values = Object.values(e.scores);
  return { sum: values.reduce((a, v) => a + v, 0), max: values.length * 4 };
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  const color = pct >= 75 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 48, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function ExpandedRow({ evaluation, rubric }: { evaluation: Evaluation; rubric: Rubric | undefined }) {
  const criteria = rubric?.criteria ?? [];

  return (
    <tr>
      <td colSpan={7} style={{ padding: '0 0 2px 0', background: 'var(--accent-l)' }}>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {Object.entries(evaluation.scores).map(([key, val]) => {
              const criterion = criteria.find(c => c.id === key);
              const name = criterion?.name ?? key;
              const descriptor = criterion?.descriptors?.[val as 1 | 2 | 3 | 4] ?? '';
              const pct = (val / 4) * 100;
              const scoreColor = pct >= 75 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)';
              return (
                <div
                  key={key}
                  style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: 'white', border: '0.5px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: 'var(--text)',
                      flex: 1, minWidth: 0, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8,
                    }}>
                      {name}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 900, flexShrink: 0,
                      padding: '2px 8px', borderRadius: 99,
                      background: `${scoreColor}18`, color: scoreColor,
                      border: `1px solid ${scoreColor}44`,
                    }}>
                      {val}/4
                    </span>
                  </div>
                  {descriptor && (
                    <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, lineHeight: 1.45 }}>{descriptor}</p>
                  )}
                  <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: scoreColor }} />
                  </div>
                </div>
              );
            })}
          </div>
          {evaluation.notes && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: '#fffbeb', border: '0.5px solid #fcd34d',
              fontSize: 12.5, color: '#92400e', lineHeight: 1.5,
            }}>
              <strong style={{ fontWeight: 700 }}>Notas: </strong>{evaluation.notes}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export function History({ evaluations, classes, students, rubrics, onOpenEval }: Props) {
  const [filterClassId, setFilterClassId] = useState('');
  const [filterStudentId, setFilterStudentId] = useState('');
  const [filterRubricId, setFilterRubricId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'date' | 'student' | 'rubric' | 'score'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const classStudents = useMemo(
    () => students.filter(s => !filterClassId || s.class_id === filterClassId),
    [students, filterClassId]
  );

  const filtered = useMemo(() => {
    let list = [...evaluations];

    if (filterClassId) list = list.filter(e => e.class_id === filterClassId);
    if (filterStudentId) list = list.filter(e => e.student_id === filterStudentId);
    if (filterRubricId) list = list.filter(e => e.rubric_id === filterRubricId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        e.student_name.toLowerCase().includes(q) ||
        e.rubric_name.toLowerCase().includes(q) ||
        (e.notes ?? '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = a.date.localeCompare(b.date);
      } else if (sortField === 'student') {
        cmp = a.student_name.localeCompare(b.student_name);
      } else if (sortField === 'rubric') {
        cmp = a.rubric_name.localeCompare(b.rubric_name);
      } else if (sortField === 'score') {
        const sa = evalTotalScore(a);
        const sb = evalTotalScore(b);
        const pa = sa.max > 0 ? sa.sum / sa.max : 0;
        const pb = sb.max > 0 ? sb.sum / sb.max : 0;
        cmp = pa - pb;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [evaluations, filterClassId, filterStudentId, filterRubricId, searchQuery, sortField, sortDir]);

  function handleSort(field: typeof sortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function SortIcon({ field }: { field: typeof sortField }) {
    if (sortField !== field) return <ChevronDown size={11} style={{ opacity: 0.3 }} />;
    return sortDir === 'asc'
      ? <ChevronUp size={11} style={{ color: 'var(--accent-d)' }} />
      : <ChevronDown size={11} style={{ color: 'var(--accent-d)' }} />;
  }

  const handleClassFilter = (id: string) => {
    setFilterClassId(id);
    setFilterStudentId('');
    setExpandedId(null);
  };

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">Historial de evaluaciones</h1>
          <p className="pg-sub">
            {plural(filtered.length, 'evaluación', 'evaluaciones')}
            {evaluations.length !== filtered.length ? ` de ${evaluations.length} totales` : ' en total'}
          </p>
        </div>
        <button
          className="btn-accent"
          onClick={() => onOpenEval('', '', filterClassId)}
          style={{ gap: 6 }}
        >
          <Plus size={14} />
          Nueva evaluación
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.4fr', gap: 10, alignItems: 'end' }}>
          <div className="fgroup" style={{ marginBottom: 0 }}>
            <label className="flabel">Clase</label>
            <div style={{ position: 'relative' }}>
              <select
                className="finput"
                value={filterClassId}
                onChange={e => handleClassFilter(e.target.value)}
                style={{ appearance: 'none', paddingRight: 32 }}
              >
                <option value="">Todas las clases</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
            </div>
          </div>

          <div className="fgroup" style={{ marginBottom: 0 }}>
            <label className="flabel">Alumno</label>
            <div style={{ position: 'relative' }}>
              <select
                className="finput"
                value={filterStudentId}
                onChange={e => { setFilterStudentId(e.target.value); setExpandedId(null); }}
                style={{ appearance: 'none', paddingRight: 32 }}
              >
                <option value="">Todos los alumnos</option>
                {classStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
            </div>
          </div>

          <div className="fgroup" style={{ marginBottom: 0 }}>
            <label className="flabel">Rúbrica</label>
            <div style={{ position: 'relative' }}>
              <select
                className="finput"
                value={filterRubricId}
                onChange={e => { setFilterRubricId(e.target.value); setExpandedId(null); }}
                style={{ appearance: 'none', paddingRight: 32 }}
              >
                <option value="">Todas las rúbricas</option>
                {rubrics.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
            </div>
          </div>

          <div className="fgroup" style={{ marginBottom: 0 }}>
            <label className="flabel">Buscar</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input
                type="text"
                className="finput"
                placeholder="Alumno, rúbrica, notas..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 34 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)' }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
            <ClipboardList size={40} color="var(--border)" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>
            Sin evaluaciones
          </div>
          <div style={{ fontSize: 13, marginBottom: 16 }}>
            {evaluations.length === 0
              ? 'Todavía no hay evaluaciones registradas'
              : 'No hay resultados con los filtros actuales'}
          </div>
          <button
            className="btn-accent"
            onClick={() => onOpenEval('', '', filterClassId)}
            style={{ margin: '0 auto', gap: 6 }}
          >
            <Plus size={14} />Nueva evaluación
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="rtable">
              <thead>
                <tr>
                  <th
                    style={{ cursor: 'pointer', textAlign: 'left', paddingLeft: 16 }}
                    onClick={() => handleSort('date')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Fecha <SortIcon field="date" />
                    </span>
                  </th>
                  <th
                    style={{ cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => handleSort('student')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Alumno <SortIcon field="student" />
                    </span>
                  </th>
                  <th
                    style={{ cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => handleSort('rubric')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Rúbrica <SortIcon field="rubric" />
                    </span>
                  </th>
                  <th style={{ textAlign: 'left' }}>Clase</th>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSort('score')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Puntuación <SortIcon field="score" />
                    </span>
                  </th>
                  <th style={{ textAlign: 'left' }}>Notas</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(ev => {
                  const { sum, max } = evalTotalScore(ev);
                  const cls = classes.find(c => c.id === ev.class_id);
                  const rubric = rubrics.find(r => r.id === ev.rubric_id);
                  const isExpanded = expandedId === ev.id;
                  const pct = max > 0 ? (sum / max) * 100 : 0;
                  const scoreColor = pct >= 75 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)';

                  return (
                    <>
                      <tr
                        key={ev.id}
                        style={{
                          cursor: 'pointer',
                          background: isExpanded ? 'var(--accent-l)' : undefined,
                          transition: 'background 0.15s',
                        }}
                        onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                      >
                        <td style={{ paddingLeft: 16, fontWeight: 600, color: 'var(--text-2)', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                          {formatDate(ev.date)}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                            {ev.student_name}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                            {ev.rubric_name}
                            {ev.instrument === 'diana' && (
                              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 99, background: 'var(--accent-l)', color: 'var(--accent-d)' }}>
                                DIANA
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {cls ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cls.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{cls.name}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {max > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                              <span
                                className="score-pill"
                                style={{ background: `${scoreColor}18`, color: scoreColor }}
                              >
                                {ev.instrument === 'diana' && typeof ev.grade === 'number'
                                  ? `${ev.grade.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/10`
                                  : `${sum}/${max}`}
                              </span>
                              <ScoreBar score={sum} max={max} />
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>
                          )}
                        </td>
                        <td style={{ maxWidth: 200 }}>
                          {ev.notes ? (
                            <span style={{
                              fontSize: 12, color: 'var(--text-3)',
                              display: 'inline-block', maxWidth: 180,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {ev.notes}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--border)' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', paddingRight: 12 }}>
                          <div style={{ color: 'var(--text-3)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {isExpanded
                              ? <ChevronUp size={15} color="var(--accent-d)" />
                              : <ChevronDown size={15} />
                            }
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <ExpandedRow key={`exp-${ev.id}`} evaluation={ev} rubric={rubric} />
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div style={{
            padding: '10px 16px', borderTop: '0.5px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </span>
            <button
              className="btn-accent"
              onClick={() => onOpenEval('', '', filterClassId)}
              style={{ gap: 6, padding: '7px 14px', fontSize: 12.5 }}
            >
              <Plus size={13} />
              Nueva evaluación
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
