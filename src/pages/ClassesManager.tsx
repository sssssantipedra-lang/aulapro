import { useState, useId } from 'react';
import {
  Users, Plus, Search, X, Trash2, Upload, AlertTriangle, Info, Pencil, Check,
} from 'lucide-react';
import type { Class, Student, Alert, Evaluation, Rubric } from '../types';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import { estadoDeMateria, materiasDelCurso, type ContextoClase } from '../lib/curriculum/materiasDeClase';
import { separaMatematicasAB } from '../lib/curriculum';
import { useCurriculo, useNivelTexto } from '../hooks/useCurriculo';
import {
  EtapaCursoFields, OpcionMatematicas, CurriculoNota,
} from '../components/curriculum/CurriculumFields';
import { initials } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { ClassChips } from '../components/ui/ClassChips';
import { useI18n } from '../i18n';

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
  /** Perfil activo, para distinguir las clases propias de las compartidas. */
  profileId?: string | null;
  /** Comunidad del perfil: de ella salen las materias oficiales que se ofrecen. */
  comunidad?: ComunidadId;
}

/** Parte aleatoria de los ids nuevos. Fuera del componente: solo se llama al guardar, nunca al pintar. */
function sufijoAleatorio(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ─── blank factories ──────────────────────────────────────────────────────────
function blankClass(): Omit<Class, 'id'> {
  return { name: '', subject: '', subjects: [], isTutoria: false, room: '', color: PALETTE[0] };
}

function blankAlert(): Omit<Alert, 'id'> {
  return { text: '', level: 'info' };
}

// ═══════════════════════════════════════════════════════════════════════════════
/** «12» → «Aula 12», pero «Aula 12» se queda igual (antes salía «Aula Aula 12»). */
function roomLabel(room: string, word: string): string {
  const r = room.trim();
  return r.toLocaleLowerCase('es').startsWith(word.toLocaleLowerCase('es')) ? r : `${word} ${r}`;
}

export function ClassesManager({
  classes, students, evaluations, rubrics,
  onAddClass, onUpdateClass, onDeleteClass,
  onAddStudent, onUpdateStudent, onDeleteStudent,
  onAddStudents, onOpenEval, profileId, comunidad,
}: Props) {
  const { toast: notify } = useToast();
  const { t } = useI18n();
  const nivelTexto = useNivelTexto();

  const uid = useId();
  const newId = () => `${uid}-${sufijoAleatorio()}`;

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
  /** La clase que se está editando; `null` si el formulario crea una nueva. */
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  // ── currículo oficial de la clase del formulario ──
  // Las asignaturas se marcan de la lista oficial del curso (el currículo de la
  // comunidad del perfil); las que no están en ella se añaden aparte, en modo
  // libre. Así una clase nueva nunca necesita adivinar qué materia es cada una.
  const curriculo = useCurriculo(comunidad, editClass.etapa);
  const ctxClase: ContextoClase | null = editClass.etapa && editClass.curso
    ? {
        etapa: editClass.etapa, curso: editClass.curso,
        opcionMatematicas: editClass.opcionMatematicas, materiasOficiales: editClass.materiasOficiales,
      }
    : null;
  /** Nombres de las materias oficiales de este curso, en el orden del decreto. */
  const materiasCurso = ctxClase && curriculo ? materiasDelCurso(ctxClase, curriculo.materias) : [];
  /**
   * Qué asignatura de la clase es cada materia oficial del curso: la que se
   * llama igual o la que ya se sabía que es esa materia por su identificador.
   * Así una clase creada en castellano tiene marcada «Matemàtiques» con la app
   * en valenciano, y su asignatura sigue llamándose como se creó: el cuaderno,
   * las rúbricas y las dianas cuelgan de ese nombre.
   */
  const asignaturaDe = new Map<string, string>();
  if (ctxClase && curriculo) {
    for (const s of editClass.subjects) {
      const e = estadoDeMateria(s, ctxClase, curriculo.materias);
      if (e.tipo === 'oficial' && !e.porAlias && materiasCurso.includes(e.materia) && !asignaturaDe.has(e.materia)) {
        asignaturaDe.set(e.materia, s);
      }
    }
  }
  const deLaLista = new Set(asignaturaDe.values());
  /** Asignaturas de la clase que no son de la lista oficial del curso. */
  const otrasAsignaturas = editClass.subjects.filter(s => s.trim() && !deLaLista.has(s));
  const [otraAsignatura, setOtraAsignatura] = useState('');
  const necesitaOpcionMat = ctxClase?.etapa === 'eso' && ctxClase.curso === 4 && editClass.subjects.some(s => {
    const e = curriculo ? estadoDeMateria(s, ctxClase, curriculo.materias) : null;
    return e?.tipo === 'oficial' && !!curriculo && separaMatematicasAB(e.materia, curriculo.materias);
  });

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
    if (!editStudent.name.trim()) { notify(t('El nombre es obligatorio')); return; }
    if (studentModal?.id === '__new__') {
      onAddStudent({ ...editStudent, id: newId() });
      notify(t('Alumno añadido'));
    } else {
      onUpdateStudent(editStudent);
      notify(t('Alumno actualizado'));
    }
    closeStudentModal();
  }

  function deleteStudentConfirm() {
    if (!editStudent) return;
    if (!window.confirm(t('¿Eliminar a {name}?', { name: editStudent.name }))) return;
    onDeleteStudent(editStudent.id);
    notify(t('Alumno eliminado'));
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
    setEditingClassId(null);
    setOtraAsignatura('');
    setClassModal(true);
  }

  /** El mismo formulario, con la clase ya rellena. */
  function openEditClass(c: Class) {
    const { id, ...rest } = c;
    setEditClass({ ...rest, subjects: [...(c.subjects ?? [c.subject])] });
    setEditingClassId(id);
    setOtraAsignatura('');
    setClassModal(true);
  }

  function setEtapaCurso(etapa: Class['etapa'] | '', curso: number | '') {
    setEditClass(c => ({
      ...c,
      etapa: etapa || undefined,
      curso: curso === '' ? undefined : curso,
      // La opción de Matemáticas solo existe en 4º de ESO
      opcionMatematicas: etapa === 'eso' && curso === 4 ? c.opcionMatematicas : undefined,
    }));
  }

  function toggleMateria(nombre: string) {
    const asignatura = asignaturaDe.get(nombre);
    setEditClass(c => ({
      ...c,
      subjects: asignatura ? c.subjects.filter(x => x !== asignatura) : [...c.subjects, nombre],
    }));
  }

  function addOtraAsignatura() {
    const nombre = otraAsignatura.trim();
    if (!nombre) return;
    setEditClass(c => (c.subjects.includes(nombre) ? c : { ...c, subjects: [...c.subjects, nombre] }));
    setOtraAsignatura('');
  }

  const quitarAsignatura = (nombre: string) =>
    setEditClass(c => ({ ...c, subjects: c.subjects.filter(x => x !== nombre) }));

  function saveClass() {
    if (!editClass.name.trim()) { notify(t('El nombre de la clase es obligatorio')); return; }
    if (!ctxClase || !curriculo) { notify(t('Elige la etapa y el curso de la clase.')); return; }

    // Primero las oficiales, en el orden del decreto; después las demás.
    const oficiales = materiasCurso.filter(n => asignaturaDe.has(n));
    const otras = otrasAsignaturas.map(s => s.trim());
    const subjects = [...oficiales.map(n => asignaturaDe.get(n)!), ...otras];
    if (subjects.length === 0) { notify(t('Pon al menos una asignatura')); return; }

    // Cada oficial guarda el identificador de su materia (vale aunque cambie el
    // idioma de la app); una de fuera de la lista queda en modo libre, salvo que
    // ya se supiera qué materia es (una clase anterior con «Mates», por ejemplo).
    const materias: Record<string, string | null> = {};
    for (const n of oficiales) materias[asignaturaDe.get(n)!] = curriculo.materias.find(m => m.nombre === n)!.id;
    for (const n of otras) {
      const e = estadoDeMateria(n, ctxClase, curriculo.materias);
      if (e.tipo === 'oficial') materias[n] = curriculo.materias.find(m => m.nombre === e.materia)!.id;
      else materias[n] = null;
    }
    // `subject` se mantiene sincronizado con la primera: todo lo escrito antes
    // de que existieran varias asignaturas sigue leyendo de ahí.
    const datos = { ...editClass, subjects, subject: subjects[0], materiasOficiales: materias };

    if (editingClassId) {
      const original = classes.find(c => c.id === editingClassId);
      if (original) onUpdateClass({ ...original, ...datos, id: original.id });
      setClassModal(false);
      notify(t('Clase actualizada'));
      return;
    }

    const newClass: Class = { id: newId(), ...datos };
    onAddClass(newClass);
    setActiveClassId(newClass.id);
    setClassModal(false);
    notify(subjects.length > 1 ? t('Clase creada con {n} asignaturas', { n: subjects.length }) : t('Clase creada'));
  }

  // ─── csv import ─────────────────────────────────────────────────────────────
  function importCsv() {
    const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed: Student[] = [];
    for (const line of lines) {
      const parts = line.split(/[,;]/);
      const name = parts[0]?.trim();
      const email = parts[1]?.trim() ?? '';
      if (!name) continue;
      // Salta la fila de cabecera («Nombre,Email» o «Name,Email»)
      if (/^(nombre|name)$/i.test(name) || /^email$/i.test(name) || /^correo$/i.test(name)) continue;
      parsed.push({
        id: newId(), class_id: activeClassId,
        name, email, photo: null, alerts: [], notes: '',
      });
    }
    if (parsed.length === 0) { notify(t('No se encontraron filas válidas')); return; }
    onAddStudents(parsed);
    setCsvModal(false);
    setCsvText('');
    notify(t(parsed.length === 1 ? '{n} alumno importado' : '{n} alumnos importados', { n: parsed.length }));
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
          <h1 className="pg-title">{t('Mis Clases')}</h1>
          <p className="pg-sub">
            {t(classes.length === 1 ? '{n} clase' : '{n} clases', { n: classes.length })}
            {' · '}
            {t(students.length === 1 ? '{n} alumno en total' : '{n} alumnos en total', { n: students.length })}
          </p>
        </div>
      </div>

      {/* ── Barra: clases (con su número de alumnos) y crear clase ── */}
      <div className="toolbar">
        <ClassChips
          classes={classes}
          value={activeClassId ?? ''}
          onChange={id => { setActiveClassId(id); setSearch(''); }}
          counts={Object.fromEntries(classes.map(c => [c.id, students.filter(s => s.class_id === c.id).length]))}
        />
        <span className="toolbar-spacer" />
        <button className="tb-btn" onClick={openClassModal}>
          <Plus size={14} />{t('Nueva clase')}
        </button>
      </div>

      {/* ── active class card ── */}
      {activeClass ? (
        <div className="card">
          {/* toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            <div className="tb-search">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                placeholder={t('Buscar alumno…')}
                aria-label={t('Buscar alumno')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <span className="toolbar-spacer" />
            <button className="tb-btn" onClick={() => setCsvModal(true)}>
              <Upload size={14} />{t('Importar CSV')}
            </button>
            <button className="btn-accent" style={{ height: 36 }} onClick={openNewStudent}>
              <Plus size={14} />{t('Nuevo alumno')}
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
                    {t('MI TUTORÍA')}
                  </span>
                )}
                {/* Clase de otro docente: su lista manda al sincronizar */}
                {activeClass.owner && profileId && activeClass.owner !== profileId && (
                  <span
                    title={t('La lista de alumnos la mantiene quien comparte la clase. Tus cambios en ella se sustituirán al sincronizar.')}
                    style={{
                      fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 99,
                      background: 'var(--surface)', color: 'var(--text-2)',
                      border: '1px solid var(--border)', letterSpacing: '0.03em',
                    }}
                  >
                    {t('LISTA DE {owner}', { owner: (activeClass.owner_name ?? t('Otro docente')).toUpperCase() })}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>
                {(activeClass.subjects ?? [activeClass.subject]).join(' · ')}
                {activeClass.room ? ` · ${roomLabel(activeClass.room, t('Aula'))}` : ''}
                {activeClass.etapa && activeClass.curso ? ` · ${nivelTexto(activeClass.etapa, activeClass.curso)}` : ''}
              </div>
            </div>
            <button
              className="ico-btn"
              style={{ marginLeft: 'auto' }}
              title={t('Editar clase')}
              aria-label={t('Editar clase')}
              onClick={() => openEditClass(activeClass)}
            >
              <Pencil size={15} />
            </button>
            <button
              className="ico-btn"
              title={t('Eliminar clase')}
              onClick={() => {
                if (!window.confirm(t('¿Eliminar la clase "{name}"? Se perderán todos sus datos.', { name: activeClass.name }))) return;
                onDeleteClass(activeClass.id);
                setActiveClassId(classes.find(c => c.id !== activeClassId)?.id ?? '');
                notify(t('Clase eliminada'));
              }}
            >
              <Trash2 size={15} color="var(--danger)" />
            </button>
          </div>

          {/* student grid */}
          {visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
              <Users size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
              {t(search ? 'Sin resultados para esa búsqueda' : 'Esta clase no tiene alumnos aún')}
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
                        background: 'var(--card)', borderRadius: 99, padding: '6px 16px',
                        fontSize: 12.5, fontWeight: 700, color: 'var(--text)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                      }}>{t('Ver ficha')}</span>
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
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>{t('Crea una clase para empezar')}</p>
          <button className="btn-accent" style={{ marginTop: 16 }} onClick={openClassModal}>
            <Plus size={14} />{t('Nueva clase')}
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
                  {t(studentModal?.id === '__new__' ? 'Nuevo alumno' : 'Ficha del alumno')}
                </div>
                {editStudent.id !== '__new__' && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{activeClass?.name}</div>
                )}
              </div>
              <button className="ico-btn" onClick={closeStudentModal} aria-label={t('Cerrar')} title={t('Cerrar')}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* name */}
              <div className="fgroup">
                <label className="flabel" htmlFor="classesmanager-f1">{t('Nombre')}</label>
                <input id="classesmanager-f1" className="finput" value={editStudent.name}
                  onChange={e => setEditStudent({ ...editStudent, name: e.target.value })}
                  placeholder={t('Nombre completo')} />
              </div>
              {/* email */}
              <div className="fgroup">
                <label className="flabel" htmlFor="classesmanager-f2">Email</label>
                <input id="classesmanager-f2" className="finput" type="email" value={editStudent.email}
                  onChange={e => setEditStudent({ ...editStudent, email: e.target.value })}
                  placeholder="correo@ejemplo.com" />
              </div>
            </div>

            {/* notes */}
            <div className="fgroup">
              <label className="flabel" htmlFor="classesmanager-f3">{t('Notas')}</label>
              <textarea id="classesmanager-f3" className="finput" rows={3} value={editStudent.notes}
                onChange={e => setEditStudent({ ...editStudent, notes: e.target.value })}
                placeholder={t('Observaciones, adaptaciones, etc.')}
                style={{ resize: 'vertical' }} />
            </div>

            {/* alerts */}
            <div className="fgroup">
              <label className="flabel">{t('Alertas')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {editStudent.alerts.length === 0 && (
                  <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{t('Sin alertas')}</span>
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
                <input className="finput" placeholder={t('Texto de la alerta')}
                  value={alertDraft.text}
                  onChange={e => setAlertDraft({ ...alertDraft, text: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAlertToEdit(); } }}
                  style={{ flex: 1 }} />
                <select className="finput" style={{ width: 100, flex: 'none' }}
                  value={alertDraft.level}
                  onChange={e => setAlertDraft({ ...alertDraft, level: e.target.value as Alert['level'] })}>
                  <option value="info">Info</option>
                  <option value="warn">{t('Aviso')}</option>
                  <option value="danger">{t('Alerta')}</option>
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
                  <label className="flabel" style={{ margin: 0 }}>{t('Últimas evaluaciones')}</label>
                  <button className="btn-accent" style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => {
                      const rubricId = rubrics[0]?.id ?? '';
                      onOpenEval(rubricId, editStudent.id, editStudent.class_id);
                      closeStudentModal();
                    }}>
                    <Plus size={12} />{t('Nueva evaluación')}
                  </button>
                </div>
                {studentEvals(editStudent.id).length === 0 ? (
                  <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{t('Sin evaluaciones registradas')}</p>
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
                  <Trash2 size={14} />{t('Eliminar')}
                </button>
              )}
              <button className="btn-ghost" onClick={closeStudentModal}>{t('Cancelar')}</button>
              <button className="btn-accent" onClick={saveStudent}>{t('Guardar')}</button>
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
            <span className="modal-title">{t(editingClassId ? 'Editar clase' : 'Nueva clase')}</span>
            <button className="ico-btn" onClick={() => setClassModal(false)} aria-label={t('Cerrar')} title={t('Cerrar')}><X size={18} /></button>
          </div>

          <div className="frow">
            <div className="fgroup">
              <label className="flabel" htmlFor="classesmanager-f4">{t('Nombre')}</label>
              <input id="classesmanager-f4" className="finput" placeholder={t('Ej. 5º A')} value={editClass.name}
                onChange={e => setEditClass({ ...editClass, name: e.target.value })} />
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="classesmanager-f5">{t('Aula')}</label>
              <input id="classesmanager-f5" className="finput" placeholder={t('Ej. A102')} value={editClass.room}
                onChange={e => setEditClass({ ...editClass, room: e.target.value })} />
            </div>
          </div>

          {/* Etapa y curso: deciden qué currículo oficial le toca a la clase y
              qué asignaturas se ofrecen para marcar. Son obligatorios. */}
          <EtapaCursoFields
            idPrefix="classesmanager-cur" etapa={editClass.etapa ?? ''} curso={editClass.curso ?? ''}
            onChange={setEtapaCurso}
          />
          {ctxClase && curriculo && (
            <div style={{ marginTop: -6, marginBottom: 14 }}><CurriculoNota curriculo={curriculo} /></div>
          )}

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
              <strong>{t('Soy el tutor o la tutora de este grupo')}</strong>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                {t('Aparecerá marcado en los listados y en los informes.')}
              </span>
            </span>
          </label>

          <div className="fgroup">
            <label className="flabel">{t('Asignaturas que le das')}</label>
            {!ctxClase ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5, margin: 0 }}>
                {t('Elige primero la etapa y el curso: aquí aparecerán sus asignaturas tal y como las llama el currículo.')}
              </p>
            ) : !curriculo ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0 }}>{t('Cargando…')}</p>
            ) : (
              <div role="group" aria-label={t('Asignaturas del currículo')} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {materiasCurso.map(n => {
                  const on = asignaturaDe.has(n);
                  return (
                    <button
                      key={n} type="button" aria-pressed={on} onClick={() => toggleMateria(n)}
                      className={`chip${on ? ' on' : ''}`}
                      style={{ whiteSpace: 'normal', height: 'auto', minHeight: 34, padding: '6px 14px', textAlign: 'left' }}
                    >
                      {on && <Check size={12} style={{ flexShrink: 0 }} />}
                      {n}
                    </button>
                  );
                })}
              </div>
            )}

            {otrasAsignaturas.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>{t('Otras asignaturas')}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {otrasAsignaturas.map(n => (
                    <span key={n} className="chip on" style={{ cursor: 'default' }}>
                      {n}
                      <button
                        type="button" className="ico-btn" style={{ width: 20, height: 20 }}
                        aria-label={t('Quitar «{asignatura}»', { asignatura: n })} onClick={() => quitarAsignatura(n)}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                className="finput" style={{ flex: 1 }}
                aria-label={t('Otra asignatura que no está en el currículo')}
                placeholder={t('Otra que no esté en la lista, por ejemplo Religión o Tutoría')}
                value={otraAsignatura}
                onChange={e => setOtraAsignatura(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOtraAsignatura(); } }}
              />
              <button type="button" className="btn-ghost" onClick={addOtraAsignatura} disabled={!otraAsignatura.trim()}>
                <Plus size={13} />{t('Añadir')}
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 9, lineHeight: 1.5 }}>
              {t('Si le das varias, no crees una clase por cada una: márcalas todas y luego elegirás cuál evalúas en el cuaderno, las rúbricas y las dianas.')}
            </p>
          </div>

          {necesitaOpcionMat && (
            <OpcionMatematicas
              value={editClass.opcionMatematicas}
              onChange={op => setEditClass(c => ({ ...c, opcionMatematicas: op }))}
            />
          )}

          <div className="fgroup">
            <label className="flabel">{t('Color')}</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {PALETTE.map((col, i) => (
                <button key={col} type="button" onClick={() => setEditClass({ ...editClass, color: col })}
                  aria-label={t('Color {n}', { n: i + 1 })}
                  aria-pressed={editClass.color === col}
                  style={{
                    width: 32, height: 32, borderRadius: '50%', background: col, border: 'none', cursor: 'pointer',
                    boxShadow: editClass.color === col ? `0 0 0 3px var(--card), 0 0 0 5px ${col}` : `0 0 0 2px transparent`,
                    transition: 'box-shadow 0.15s',
                  }} />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setClassModal(false)}>{t('Cancelar')}</button>
            <button className="btn-accent" onClick={saveClass}>{t(editingClassId ? 'Guardar cambios' : 'Crear clase')}</button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CSV import modal
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className={`modal-overlay${csvModal ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) { setCsvModal(false); setCsvText(''); } }}>
        <div className="modal">
          <div className="modal-hd">
            <span className="modal-title">{t('Importar alumnos (CSV)')}</span>
            <button className="ico-btn" onClick={() => { setCsvModal(false); setCsvText(''); }} aria-label={t('Cerrar')} title={t('Cerrar')}><X size={18} /></button>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
            {t('Pega las filas en formato')} <strong>{t('Nombre,Email')}</strong> {t('(una por línea). La primera fila puede ser una cabecera.')}
          </p>

          <div className="fgroup">
            <label className="flabel" htmlFor="classesmanager-f6">{t('Datos CSV')}</label>
            <textarea id="classesmanager-f6" className="finput" rows={8} value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder={'Nombre,Email\nAna García,ana@ejemplo.com\nLuis Pérez,luis@ejemplo.com'}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => { setCsvModal(false); setCsvText(''); }}>{t('Cancelar')}</button>
            <button className="btn-accent" onClick={importCsv}>
              <Upload size={14} />{t('Importar')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
