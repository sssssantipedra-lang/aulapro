import { useState, useId } from 'react';
import {
  Users, Plus, Search, X, Trash2, Upload, AlertTriangle, Info,
} from 'lucide-react';
import type { Class, Student, Alert, Evaluation, Rubric } from '../types';
import { initials } from '../lib/utils';
import { useToast } from '../components/ui/Toast';

// ─── palette ─────────────────────────────────────────────────────────────────
const PALETTE = ['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'] as const;

// ─── alert helpers ────────────────────────────────────────────────────────────
const ALERT_COLORS: Record<Alert['level'], { bg: string; color: string; border: string }> = {
  info:   { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  warn:   { bg: '#fef3c7', color: '#b45309', border: '#fcd34d' },
  danger: { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
};

function AlertBadge({ alert }: { alert: Alert }) {
  const c = ALERT_COLORS[alert.level];
  const Icon = alert.level === 'danger' ? AlertTriangle : Info;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      borderRadius: 99, fontSize: 11, fontWeight: 700,
      padding: '2px 8px', flexShrink: 0,
    }}>
      <Icon size={10} />
      {alert.text}
    </span>
  );
}

// ─── gradient from name (deterministic hue) ───────────────────────────────────
function nameColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  const hue = h % 360;
  return `linear-gradient(135deg, hsl(${hue},60%,42%), hsl(${(hue + 40) % 360},65%,55%))`;
}

// ─── types ────────────────────────────────────────────────────────────────────
interface Props {
  classes: Class[];
  students: Student[];
  evaluations: Evaluation[];
  rubrics: Rubric[];
  onAddClass: (c: Class) => void;
  onUpdateClass: (c: Class) => void;
  onDeleteClass: (id: string) => void;
  onAddStudent: (s: Student) => void;
  onUpdateStudent: (s: Student) => void;
  onDeleteStudent: (id: string) => void;
  onAddStudents: (students: Student[]) => void;
  onOpenEval: (rubricId: string, studentId: string, classId: string) => void;
}

// ─── blank factories ──────────────────────────────────────────────────────────
function blankClass(): Omit<Class, 'id'> {
  return { name: '', subject: '', subjects: [''], isTutoria: false, room: '', color: PALETTE[0] };
}

function blankAlert(): Omit<Alert, 'id'> {
  return { text: '', level: 'info' };
}

// ═══════════════════════════════════════════════════════════════════════════════
export function ClassesManager({
  classes, students, evaluations, rubrics,
  onAddClass, onDeleteClass,
  onAddStudent, onUpdateStudent, onDeleteStudent,
  onAddStudents, onOpenEval,
}: Props) {
  const { toast: notify } = useToast();

  const uid = useId();
  const newId = () => `${uid}-${Math.random().toString(36).slice(2, 9)}`;

  // ── tabs ──
  const [activeClassId, setActiveClassId] = useState<string>(classes[0]?.id ?? '');
  const activeClass = classes.find(c => c.id === activeClassId) ?? null;

  // ── search ──
  const [search, setSearch] = useState('');

  // ── student modal ──
  const [studentModal, setStudentModal] = useState<Student | null>(null);
  const [editStudent, setEditStudent] = useState<Student | null>(null);

  // ── class modal ──
  const [classModal, setClassModal] = useState(false);
  const [editClass, setEditClass] = useState<Omit<Class, 'id'>>(blankClass());

  // ── csv modal ──
  const [csvModal, setCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');

  // ── alert draft ──
  const [alertDraft, setAlertDraft] = useState<Omit<Alert, 'id'>>(blankAlert());

  // ─── derived ────────────────────────────────────────────────────────────────
  const classStudents = students.filter(s => s.class_id === activeClassId);
  const q = search.toLowerCase();
  const visible = q
    ? classStudents.filter(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    : classStudents;

  // ─── student card hover ─────────────────────────────────────────────────────
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // ─── open student modal ─────────────────────────────────────────────────────
  function openStudent(s: Student) {
    setStudentModal(s);
    setEditStudent({ ...s, alerts: s.alerts.map(a => ({ ...a })) });
    setAlertDraft(blankAlert());
  }

  function closeStudentModal() {
    setStudentModal(null);
    setEditStudent(null);
  }

  function saveStudent() {
    if (!editStudent) return;
    if (!editStudent.name.trim()) { notify('El nombre es obligatorio'); return; }
    if (studentModal?.id === '__new__') {
      onAddStudent({ ...editStudent, id: newId() });
      notify('Alumno añadido');
    } else {
      onUpdateStudent(editStudent);
      notify('Alumno actualizado');
    }
    closeStudentModal();
  }

  function deleteStudentConfirm() {
    if (!editStudent) return;
    if (!window.confirm(`¿Eliminar a ${editStudent.name}?`)) return;
    onDeleteStudent(editStudent.id);
    notify('Alumno eliminado');
    closeStudentModal();
  }

  function addAlertToEdit() {
    if (!editStudent || !alertDraft.text.trim()) return;
    const newAlert: Alert = { id: newId(), ...alertDraft };
    setEditStudent({ ...editStudent, alerts: [...editStudent.alerts, newAlert] });
    setAlertDraft(blankAlert());
  }

  function removeAlertFromEdit(id: string) {
    if (!editStudent) return;
    setEditStudent({ ...editStudent, alerts: editStudent.alerts.filter(a => a.id !== id) });
  }

  // ─── add new student button ─────────────────────────────────────────────────
  function openNewStudent() {
    const blank: Student = {
      id: '__new__', class_id: activeClassId,
      name: '', email: '', photo: null, alerts: [], notes: '',
    };
    openStudent(blank);
  }

  // ─── class modal ────────────────────────────────────────────────────────────
  function openClassModal() {
    setEditClass(blankClass());
    setClassModal(true);
  }

  function saveClass() {
    if (!editClass.name.trim()) { notify('El nombre de la clase es obligatorio'); return; }
    const subjects = editClass.subjects.map(s => s.trim()).filter(Boolean);
    if (subjects.length === 0) { notify('Pon al menos una asignatura'); return; }

    // `subject` se mantiene sincronizado con la primera: todo lo escrito antes
    // de que existieran varias asignaturas sigue leyendo de ahí.
    const newClass: Class = { id: newId(), ...editClass, subjects, subject: subjects[0] };
    onAddClass(newClass);
    setActiveClassId(newClass.id);
    setClassModal(false);
    notify(subjects.length > 1 ? `Clase creada con ${subjects.length} asignaturas` : 'Clase creada');
  }

  /** Editores de la lista de asignaturas del formulario. */
  const setSubjectAt = (i: number, value: string) =>
    setEditClass(c => ({ ...c, subjects: c.subjects.map((s, j) => (j === i ? value : s)) }));
  const addSubject = () =>
    setEditClass(c => ({ ...c, subjects: [...c.subjects, ''] }));
  const removeSubjectAt = (i: number) =>
    setEditClass(c => ({ ...c, subjects: c.subjects.filter((_, j) => j !== i) }));

  // ─── csv import ─────────────────────────────────────────────────────────────
  function importCsv() {
    const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed: Student[] = [];
    for (const line of lines) {
      const parts = line.split(/[,;]/);
      const name = parts[0]?.trim();
      const email = parts[1]?.trim() ?? '';
      if (!name) continue;
      // Salta la fila de cabecera («Nombre,Email»)
      if (/^nombre$/i.test(name) || /^email$/i.test(name) || /^correo$/i.test(name)) continue;
      parsed.push({
        id: newId(), class_id: activeClassId,
        name, email, photo: null, alerts: [], notes: '',
      });
    }
    if (parsed.length === 0) { notify('No se encontraron filas válidas'); return; }
    onAddStudents(parsed);
    setCsvModal(false);
    setCsvText('');
    notify(`${parsed.length} alumno${parsed.length !== 1 ? 's' : ''} importado${parsed.length !== 1 ? 's' : ''}`);
  }

  // ─── student evaluations ─────────────────────────────────────────────────────
  function studentEvals(studentId: string): Evaluation[] {
    return evaluations
      .filter(e => e.student_id === studentId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <section className="sec active">
      {/* ── page header ── */}
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">Mis clases</h1>
          <p className="pg-sub">{classes.length} clase{classes.length !== 1 ? 's' : ''} · {students.length} alumnos en total</p>
        </div>
      </div>

      {/* ── class tabs ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {classes.map(c => (
          <button
            key={c.id}
            onClick={() => { setActiveClassId(c.id); setSearch(''); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 99, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font)', fontSize: 13.5, fontWeight: 700,
              background: activeClassId === c.id ? c.color : 'white',
              color: activeClassId === c.id ? 'white' : 'var(--text-2)',
              boxShadow: activeClassId === c.id
                ? `0 2px 10px ${c.color}55`
                : '0 0 0 1px var(--border)',
              transition: 'all 0.18s',
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: activeClassId === c.id ? 'rgba(255,255,255,0.6)' : c.color,
              flexShrink: 0,
            }} />
            {c.name}
            <span style={{
              fontSize: 11, background: activeClassId === c.id ? 'rgba(255,255,255,0.22)' : 'var(--surface)',
              borderRadius: 99, padding: '1px 7px', fontWeight: 800,
            }}>
              {students.filter(s => s.class_id === c.id).length}
            </span>
          </button>
        ))}
        <button
          className="btn-ghost"
          style={{ borderRadius: 99, padding: '8px 16px', fontSize: 13.5 }}
          onClick={openClassModal}
        >
          <Plus size={14} />Nueva clase
        </button>
      </div>

      {/* ── active class card ── */}
      {activeClass ? (
        <div className="card">
          {/* toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 320 }}>
              <Search size={14} color="var(--text-3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                className="finput"
                placeholder="Buscar alumno…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 34, height: 38 }}
              />
            </div>
            <button className="btn-ghost" style={{ fontSize: 13, padding: '8px 14px' }} onClick={() => setCsvModal(true)}>
              <Upload size={14} />Importar CSV
            </button>
            <button className="btn-accent" style={{ fontSize: 13, padding: '8px 16px' }} onClick={openNewStudent}>
              <Plus size={14} />Nuevo alumno
            </button>
          </div>

          {/* class meta */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'center' }}>
            <div style={{ width: 4, height: 44, borderRadius: 2, background: activeClass.color, flexShrink: 0 }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{activeClass.name}</span>
                {activeClass.isTutoria && (
                  <span style={{
                    fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 99,
                    background: 'var(--accent-l)', color: 'var(--accent-d)', letterSpacing: '0.03em',
                  }}>
                    MI TUTORÍA
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>
                {(activeClass.subjects ?? [activeClass.subject]).join(' · ')}
                {activeClass.room ? ` · Aula ${activeClass.room}` : ''}
              </div>
            </div>
            <button
              className="ico-btn"
              style={{ marginLeft: 'auto' }}
              title="Eliminar clase"
              onClick={() => {
                if (!window.confirm(`¿Eliminar la clase "${activeClass.name}"? Se perderán todos sus datos.`)) return;
                onDeleteClass(activeClass.id);
                setActiveClassId(classes.find(c => c.id !== activeClassId)?.id ?? '');
                notify('Clase eliminada');
              }}
            >
              <Trash2 size={15} color="var(--danger)" />
            </button>
          </div>

          {/* student grid */}
          {visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
              <Users size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
              {search ? 'Sin resultados para esa búsqueda' : 'Esta clase no tiene alumnos aún'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {visible.map(s => (
                <div
                  key={s.id}
                  onMouseEnter={() => setHoveredId(s.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => openStudent(s)}
                  style={{
                    background: 'var(--surface)', borderRadius: 12,
                    border: '0.5px solid var(--border)', padding: '16px 14px',
                    cursor: 'pointer', position: 'relative', overflow: 'hidden',
                    transition: 'box-shadow 0.18s, transform 0.18s',
                    boxShadow: hoveredId === s.id ? '0 4px 16px rgba(0,0,0,0.10)' : '0 1px 3px rgba(0,0,0,0.04)',
                    transform: hoveredId === s.id ? 'translateY(-2px)' : 'none',
                  }}
                >
                  {/* hover overlay button */}
                  {hoveredId === s.id && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.04)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 12,
                    }}>
                      <span style={{
                        background: 'white', borderRadius: 99, padding: '6px 16px',
                        fontSize: 12.5, fontWeight: 700, color: 'var(--text)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                      }}>Ver ficha</span>
                    </div>
                  )}

                  {/* avatar */}
                  <div
                    className="student-av"
                    style={{ background: nameColor(s.name), margin: '0 auto 10px', width: 52, height: 52, fontSize: 17 }}
                  >
                    {s.photo
                      ? <img src={s.photo} alt={s.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      : initials(s.name)
                    }
                  </div>

                  {/* name / email */}
                  <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email || '—'}</div>
                  </div>

                  {/* alerts */}
                  {s.alerts.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 6 }}>
                      {s.alerts.slice(0, 2).map(a => <AlertBadge key={a.id} alert={a} />)}
                      {s.alerts.length > 2 && (
                        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>+{s.alerts.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Users size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Crea una clase para empezar</p>
          <button className="btn-accent" style={{ marginTop: 16 }} onClick={openClassModal}>
            <Plus size={14} />Nueva clase
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          Student modal
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className={`modal-overlay${studentModal ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) closeStudentModal(); }}>
        {editStudent && (
          <div className="modal wide">
            <div className="modal-hd">
              <div>
                <div className="modal-title">
                  {studentModal?.id === '__new__' ? 'Nuevo alumno' : 'Ficha del alumno'}
                </div>
                {editStudent.id !== '__new__' && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{activeClass?.name}</div>
                )}
              </div>
              <button className="ico-btn" onClick={closeStudentModal}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* name */}
              <div className="fgroup">
                <label className="flabel">Nombre</label>
                <input className="finput" value={editStudent.name}
                  onChange={e => setEditStudent({ ...editStudent, name: e.target.value })}
                  placeholder="Nombre completo" />
              </div>
              {/* email */}
              <div className="fgroup">
                <label className="flabel">Email</label>
                <input className="finput" type="email" value={editStudent.email}
                  onChange={e => setEditStudent({ ...editStudent, email: e.target.value })}
                  placeholder="correo@ejemplo.com" />
              </div>
            </div>

            {/* notes */}
            <div className="fgroup">
              <label className="flabel">Notas</label>
              <textarea className="finput" rows={3} value={editStudent.notes}
                onChange={e => setEditStudent({ ...editStudent, notes: e.target.value })}
                placeholder="Observaciones, adaptaciones, etc."
                style={{ resize: 'vertical' }} />
            </div>

            {/* alerts */}
            <div className="fgroup">
              <label className="flabel">Alertas</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {editStudent.alerts.length === 0 && (
                  <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Sin alertas</span>
                )}
                {editStudent.alerts.map(a => (
                  <span key={a.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: ALERT_COLORS[a.level].bg, color: ALERT_COLORS[a.level].color,
                    border: `1px solid ${ALERT_COLORS[a.level].border}`,
                    borderRadius: 99, fontSize: 11.5, fontWeight: 700, padding: '3px 10px',
                  }}>
                    {a.text}
                    <button onClick={() => removeAlertFromEdit(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit', opacity: 0.7 }}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
              {/* add alert row */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="finput" placeholder="Texto de la alerta"
                  value={alertDraft.text}
                  onChange={e => setAlertDraft({ ...alertDraft, text: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAlertToEdit(); } }}
                  style={{ flex: 1 }} />
                <select className="finput" style={{ width: 100, flex: 'none' }}
                  value={alertDraft.level}
                  onChange={e => setAlertDraft({ ...alertDraft, level: e.target.value as Alert['level'] })}>
                  <option value="info">Info</option>
                  <option value="warn">Aviso</option>
                  <option value="danger">Alerta</option>
                </select>
                <button className="btn-ghost" style={{ padding: '9px 12px', flexShrink: 0 }} onClick={addAlertToEdit}>
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* evaluations */}
            {editStudent.id !== '__new__' && (
              <div className="fgroup">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label className="flabel" style={{ margin: 0 }}>Últimas evaluaciones</label>
                  <button className="btn-accent" style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => {
                      const rubricId = rubrics[0]?.id ?? '';
                      onOpenEval(rubricId, editStudent.id, editStudent.class_id);
                      closeStudentModal();
                    }}>
                    <Plus size={12} />Nueva evaluación
                  </button>
                </div>
                {studentEvals(editStudent.id).length === 0 ? (
                  <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Sin evaluaciones registradas</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {studentEvals(editStudent.id).map(ev => {
                      const scores = Object.values(ev.scores);
                      const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';
                      return (
                        <div key={ev.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 12px', borderRadius: 9, background: 'var(--surface)',
                          border: '0.5px solid var(--border)',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.rubric_name}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{ev.date}</div>
                          </div>
                          <span className="score-pill">{avg}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 6, borderTop: '0.5px solid var(--border)' }}>
              {editStudent.id !== '__new__' && (
                <button className="btn-ghost" style={{ color: 'var(--danger)', borderColor: '#fca5a5' }} onClick={deleteStudentConfirm}>
                  <Trash2 size={14} />Eliminar
                </button>
              )}
              <button className="btn-ghost" onClick={closeStudentModal}>Cancelar</button>
              <button className="btn-accent" onClick={saveStudent}>Guardar</button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Class modal
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className={`modal-overlay${classModal ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setClassModal(false); }}>
        <div className="modal">
          <div className="modal-hd">
            <span className="modal-title">Nueva clase</span>
            <button className="ico-btn" onClick={() => setClassModal(false)}><X size={18} /></button>
          </div>

          <div className="frow">
            <div className="fgroup">
              <label className="flabel">Nombre</label>
              <input className="finput" placeholder="Ej. 5º A" value={editClass.name}
                onChange={e => setEditClass({ ...editClass, name: e.target.value })} />
            </div>
            <div className="fgroup">
              <label className="flabel">Aula</label>
              <input className="finput" placeholder="Ej. A102" value={editClass.room}
                onChange={e => setEditClass({ ...editClass, room: e.target.value })} />
            </div>
          </div>

          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
            padding: '12px 14px', borderRadius: 11, background: 'var(--surface)', marginBottom: 16,
          }}>
            <input
              type="checkbox" checked={!!editClass.isTutoria}
              onChange={e => setEditClass({ ...editClass, isTutoria: e.target.checked })}
              style={{ width: 16, height: 16, marginTop: 1, cursor: 'pointer', flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
              <strong>Soy el tutor o la tutora de este grupo</strong>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                Aparecerá marcado en los listados y en los informes.
              </span>
            </span>
          </label>

          <div className="fgroup">
            <label className="flabel">Asignaturas que le das</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {editClass.subjects.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="finput" style={{ flex: 1 }}
                    placeholder={i === 0 ? 'Ej. Matemáticas' : 'Ej. Lengua'}
                    value={s}
                    onChange={e => setSubjectAt(i, e.target.value)}
                  />
                  {editClass.subjects.length > 1 && (
                    <button className="ico-btn" title="Quitar" onClick={() => removeSubjectAt(i)}>
                      <Trash2 size={14} color="var(--danger)" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="btn-ghost" style={{ marginTop: 9, fontSize: 12.5 }} onClick={addSubject}>
              <Plus size={13} />Añadir otra asignatura
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 9, lineHeight: 1.5 }}>
              Si le das varias, no crees una clase por cada una: pon aquí todas y luego
              elegirás cuál evalúas en el cuaderno, las rúbricas y las dianas.
            </p>
          </div>

          <div className="fgroup">
            <label className="flabel">Color</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {PALETTE.map(col => (
                <button key={col} onClick={() => setEditClass({ ...editClass, color: col })}
                  style={{
                    width: 32, height: 32, borderRadius: '50%', background: col, border: 'none', cursor: 'pointer',
                    boxShadow: editClass.color === col ? `0 0 0 3px white, 0 0 0 5px ${col}` : `0 0 0 2px transparent`,
                    transition: 'box-shadow 0.15s',
                  }} />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setClassModal(false)}>Cancelar</button>
            <button className="btn-accent" onClick={saveClass}>Crear clase</button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CSV import modal
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className={`modal-overlay${csvModal ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) { setCsvModal(false); setCsvText(''); } }}>
        <div className="modal">
          <div className="modal-hd">
            <span className="modal-title">Importar alumnos (CSV)</span>
            <button className="ico-btn" onClick={() => { setCsvModal(false); setCsvText(''); }}><X size={18} /></button>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
            Pega las filas en formato <strong>Nombre,Email</strong> (una por línea). La primera fila puede ser una cabecera.
          </p>

          <div className="fgroup">
            <label className="flabel">Datos CSV</label>
            <textarea className="finput" rows={8} value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder={'Nombre,Email\nAna García,ana@ejemplo.com\nLuis Pérez,luis@ejemplo.com'}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => { setCsvModal(false); setCsvText(''); }}>Cancelar</button>
            <button className="btn-accent" onClick={importCsv}>
              <Upload size={14} />Importar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
