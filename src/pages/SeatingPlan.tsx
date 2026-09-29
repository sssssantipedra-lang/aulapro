/**
 * Distribución de aula: grupos cooperativos con mesas en abanico (como las
 * mesas trapezoidales reales del aula), roles rotativos y reparto
 * equilibrado y multinivel generado por la IA a partir de datos reales.
 *
 * Una distribución por clase, no una lista: es la disposición física de
 * ahora mismo (ver `SeatingPlan` en types/index.ts). Cada cambio —sentar a
 * alguien, rotar los roles, regenerar con la IA— se guarda al instante con
 * `onSave`, igual que Asistencia: no hay un botón «Guardar» aparte.
 */

import { useMemo, useState } from 'react';
import {
  Users, Sparkles, RotateCcw, RotateCw, FileDown, FileType2, Settings2, ArrowRight, CheckCircle2, X, GripVertical, Flag,
} from 'lucide-react';
import type { Class, Student, GradeCategory, GradeItem, GradeMap, AttendanceMap, SeatingPlan, CooperativeRole, ClassMark } from '../types';
import { seatStudentId } from '../types';
import { weightedAverage, attendanceRate } from '../services/aiContext';
import { generateBalancedGroups, type StudentForGrouping } from '../services/classGroups';
import { hasApiKey } from '../services/gemini';
import { buildTableSvg } from '../lib/seatingLayout';
import { saveSeatingPdf, saveSeatingDocx, roleForSeat, vecesLabel } from '../services/exportSeating';
import { PALETTE } from '../lib/demoData';
import { isDesktop } from '../services/storage';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { useI18n } from '../i18n';
import { ClassMarksModal } from '../components/seating/ClassMarksModal';
import { markTypeInfo } from '../services/classMarks';
import { isoDate } from '../lib/utils';

interface Props {
  classes: Class[];
  students: Student[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  attendance: AttendanceMap;
  seatingPlans: Record<string, SeatingPlan>;
  onSave: (classId: string, plan: SeatingPlan) => void;
  /** Anotaciones del aula (sin tarea, comportamiento…), que cuentan en el cuaderno. */
  classMarks: ClassMark[];
  onAddMark: (m: ClassMark, label: string) => void;
  onDeleteMark: (id: string, label: string) => void;
  onNav: (s: string) => void;
}

const DEFAULT_NUM_GROUPS = 5;
const DEFAULT_GROUP_SIZE = 4;

function defaultRoles(t: (k: string, vars?: Record<string, string | number>) => string): CooperativeRole[] {
  return [
    { id: 'portavoz', name: t('Portavoz'), description: t('Habla en nombre del grupo y modera el turno de palabra.') },
    { id: 'secretario', name: t('Secretario/a'), description: t('Anota las conclusiones y los acuerdos del grupo.') },
    { id: 'material', name: t('Responsable del material'), description: t('Reparte, cuida y recoge el material del grupo.') },
    { id: 'tiempo', name: t('Responsable del tiempo'), description: t('Controla el tiempo de la tarea y el volumen de voz.') },
  ];
}

function emptyPlan(classId: string, t: (k: string, vars?: Record<string, string | number>) => string): SeatingPlan {
  return {
    class_id: classId,
    numGroups: DEFAULT_NUM_GROUPS,
    groupSize: DEFAULT_GROUP_SIZE,
    roles: defaultRoles(t),
    groups: Array.from({ length: DEFAULT_NUM_GROUPS }, (_, i) => ({
      id: crypto.randomUUID(), label: t('Mesa {n}', { n: i + 1 }), studentIds: [],
    })),
    weekOffset: 0,
    updatedAt: new Date().toISOString(),
  };
}

/** Ajusta la lista de roles a `groupSize` exacto, conservando los que ya había. */
function resizeRoles(roles: CooperativeRole[], groupSize: number, t: (k: string, vars?: Record<string, string | number>) => string): CooperativeRole[] {
  if (roles.length === groupSize) return roles;
  if (roles.length > groupSize) return roles.slice(0, groupSize);
  const extra = Array.from({ length: groupSize - roles.length }, (_, i) => ({
    id: crypto.randomUUID(), name: t('Rol {n}', { n: roles.length + i + 1 }), description: '',
  }));
  return [...roles, ...extra];
}

export function SeatingPlan({
  classes, students, gradeCategories, gradeItems, grades, attendance, seatingPlans, onSave, onNav,
  classMarks, onAddMark, onDeleteMark,
}: Props) {
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [notasDocente, setNotasDocente] = useState('');
  const [generating, setGenerating] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  /** Asiento (`groupId:índice`) o bandeja (`'tray'`) sobre el que se arrastra ahora mismo. */
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  /** Alumno elegido en la bandeja de «sin mesa», a la espera de un asiento. */
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
  /** Alumno al que se está anotando algo (sin tarea, comportamiento…). */
  const [marking, setMarking] = useState<Student | null>(null);

  const cls = classes.find(c => c.id === classId) ?? classes[0];
  const clsId = cls?.id ?? '';

  const roster = useMemo(
    () => students.filter(s => s.class_id === clsId).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [students, clsId],
  );

  const plan = seatingPlans[clsId] ?? emptyPlan(clsId, t);

  const asignados = useMemo(
    () => new Set(plan.groups.flatMap(g => g.studentIds.filter(Boolean))),
    [plan],
  );
  /** Anotaciones de hoy por alumno, para verlas de un vistazo en cada asiento. */
  const todayMarks = useMemo(() => {
    const today = isoDate();
    const out = new Map<string, { pos: number; neg: number }>();
    for (const m of classMarks) {
      if (m.class_id !== clsId || m.date !== today) continue;
      const e = out.get(m.student_id) ?? { pos: 0, neg: 0 };
      if (markTypeInfo(m.type)?.positive) e.pos++; else e.neg++;
      out.set(m.student_id, e);
    }
    return out;
  }, [classMarks, clsId]);

  const sinAsignar = useMemo(() => roster.filter(s => !asignados.has(s.id)), [roster, asignados]);

  function guardar(next: SeatingPlan) {
    onSave(clsId, { ...next, updatedAt: new Date().toISOString() });
  }

  function pickClass(id: string) {
    setClassId(id);
    setSelected(null);
  }

  /* ── Estructura: nº de mesas y alumnos por mesa ── */
  function applyStructure(numGroupsRaw: number, groupSizeRaw: number) {
    const numGroups = Math.max(1, Math.min(12, numGroupsRaw || 1));
    const groupSize = Math.max(1, Math.min(8, groupSizeRaw || 1));
    const groups = Array.from({ length: numGroups }, (_, i) =>
      plan.groups[i] ?? { id: crypto.randomUUID(), label: t('Mesa {n}', { n: i + 1 }), studentIds: [] },
    ).map(g => ({ ...g, studentIds: g.studentIds.slice(0, groupSize) }));
    guardar({ ...plan, numGroups, groupSize, groups, roles: resizeRoles(plan.roles, groupSize, t) });
  }

  function updateRole(index: number, patch: Partial<CooperativeRole>) {
    guardar({ ...plan, roles: plan.roles.map((r, i) => (i === index ? { ...r, ...patch } : r)) });
  }

  /* ── Asientos: sentar, quitar o intercambiar (clic o arrastrar) ── */

  /**
   * Sienta a `studentId` en el asiento destino. Si venía de otro asiento y el
   * destino estaba ocupado, los dos se intercambian; si venía de la bandeja,
   * quien ocupaba el destino vuelve a la bandeja. Con `to = null` lo levanta.
   */
  function moveStudent(studentId: string, to: { groupId: string; seat: number } | null) {
    let from: { groupId: string; seat: number } | null = null;
    for (const g of plan.groups) {
      const i = g.studentIds.indexOf(studentId);
      if (i >= 0) { from = { groupId: g.id, seat: i }; break; }
    }
    if (!from && !to) return;
    if (from && to && from.groupId === to.groupId && from.seat === to.seat) return;
    const destGroup = to ? plan.groups.find(g => g.id === to.groupId) : null;
    const ocupante = destGroup && to ? seatStudentId(destGroup, to.seat) : null;

    const groups = plan.groups.map(g => {
      const tocaOrigen = from?.groupId === g.id;
      const tocaDestino = to?.groupId === g.id;
      if (!tocaOrigen && !tocaDestino) return g;
      const arr = [...g.studentIds];
      const need = Math.max(tocaDestino && to ? to.seat : 0, tocaOrigen && from ? from.seat : 0);
      while (arr.length <= need) arr.push('');
      if (tocaOrigen && from) arr[from.seat] = ocupante ?? '';
      if (tocaDestino && to) arr[to.seat] = studentId;
      return { ...g, studentIds: arr };
    });
    guardar({ ...plan, groups });
  }

  /** Con un alumno elegido en la bandeja, sentarlo en ese asiento. */
  function seatClick(groupId: string, seatIndex: number) {
    if (!selected) return;
    moveStudent(selected, { groupId, seat: seatIndex });
    setSelected(null);
  }

  function handleMesaClick(groupId: string, e: React.MouseEvent<HTMLDivElement>) {
    const seat = (e.target as HTMLElement).closest('[data-seat-index]');
    if (!seat) return;
    seatClick(groupId, Number(seat.getAttribute('data-seat-index')));
  }

  /* ── Arrastrar y soltar ── */
  const DRAG_TYPE = 'text/x-aulapro-student';

  function onDragStart(e: React.DragEvent, studentId: string) {
    e.dataTransfer.setData(DRAG_TYPE, studentId);
    e.dataTransfer.effectAllowed = 'move';
    setSelected(null);
  }

  function dropProps(key: string, onDropId: (studentId: string) => void) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dropTarget !== key) setDropTarget(key);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDropTarget(null);
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setDropTarget(null);
        const id = e.dataTransfer.getData(DRAG_TYPE);
        if (id) onDropId(id);
      },
    };
  }

  /** Soltar sobre el dibujo: el asiento lo da la pieza del abanico bajo el puntero. */
  function svgDropProps(groupId: string) {
    return {
      onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        const seat = (e.target as Element).closest('[data-seat-index]');
        if (!seat) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const key = `${groupId}:${seat.getAttribute('data-seat-index')}`;
        if (dropTarget !== key) setDropTarget(key);
      },
      onDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
      },
      onDrop: (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDropTarget(null);
        const seat = (e.target as Element).closest('[data-seat-index]');
        const id = e.dataTransfer.getData(DRAG_TYPE);
        if (seat && id) moveStudent(id, { groupId, seat: Number(seat.getAttribute('data-seat-index')) });
      },
    };
  }

  /* ── Rotación semanal de roles: solo avanza un contador, nunca reescribe ── */
  function rotar(delta: number) {
    const next = ((plan.weekOffset + delta) % plan.groupSize + plan.groupSize) % plan.groupSize;
    guardar({ ...plan, weekOffset: next });
  }

  /* ── Generar grupos equilibrados con la IA ── */
  async function handleGenerate() {
    if (roster.length === 0) { toast(t('Esta clase todavía no tiene alumnos')); return; }
    const cats = gradeCategories.filter(c => c.class_id === clsId);
    const items = gradeItems.filter(i => i.class_id === clsId);
    const studentsForAI: StudentForGrouping[] = roster.map(s => {
      const asis = attendanceRate(clsId, s.id, attendance);
      return {
        id: s.id, name: s.name,
        media: weightedAverage(s.id, cats, items, grades),
        asistenciaPct: asis?.pct ?? null,
        avisos: s.alerts.map(a => a.text),
        notas: s.notes,
      };
    });

    const res = await generateBalancedGroups(
      { students: studentsForAI, numGroups: plan.numGroups, groupSize: plan.groupSize, notasDocente },
      lang,
      { onStart: () => setGenerating(true), onEnd: () => setGenerating(false), onError: m => toast(m) },
    );
    if (!res) return;
    setAiOpen(false);

    const groups = plan.groups.map((g, i) => ({
      ...g,
      studentIds: res.grupos[i]?.estudiantes ?? [],
      justificacion: res.grupos[i]?.justificacion,
    }));
    guardar({ ...plan, groups, weekOffset: 0, lastNotes: notasDocente.trim() || undefined });

    if (res.sinAsignar.length) {
      toast(t('{n} alumnos se han quedado sin mesa: no caben todos en {groups} mesas de {size}', {
        n: res.sinAsignar.length, groups: plan.numGroups, size: plan.groupSize,
      }));
    } else {
      toast(t('✅ Grupos generados'));
    }
  }

  /* ── Exportar ── */
  async function handleExportPdf() {
    if (!cls) return;
    setExporting('pdf');
    try {
      const res = await saveSeatingPdf(cls, plan, roster, lang);
      if ('error' in res && res.error === 'not-desktop') {
        toast(t('Guardar en PDF solo está disponible en la aplicación de escritorio.'));
      } else if ('error' in res && res.error) {
        toast(t('No se pudo generar el PDF.'));
      } else if (!('canceled' in res && res.canceled)) {
        toast(t('✅ PDF guardado'));
      }
    } finally {
      setExporting(null);
    }
  }

  async function handleExportDocx() {
    if (!cls) return;
    setExporting('docx');
    try {
      await saveSeatingDocx(cls, plan, roster, lang);
      toast(t('✅ Word descargado'));
    } catch {
      toast(t('No se pudo generar el documento Word.'));
    } finally {
      setExporting(null);
    }
  }

  if (classes.length === 0) {
    return (
      <section className="sec active">
        <div className="pg-hd">
          <div>
            <h1 className="pg-title">{t('Distribución de aula')}</h1>
            <p className="pg-sub">{t('Grupos cooperativos, roles y rotación semanal')}</p>
          </div>
        </div>
        <div className="card" style={{ maxWidth: 540, margin: '40px auto', textAlign: 'center', padding: '40px 34px' }}>
          <Users size={36} color="var(--text-3)" style={{ margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('Aún no tienes clases')}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
            {t('Para repartir grupos, primero crea una clase con sus alumnos.')}
          </p>
          <button className="btn-accent" onClick={() => onNav('classes')}>
            {t('Ir a Mis Clases')} <ArrowRight size={14} />
          </button>
        </div>
      </section>
    );
  }

  const sentados = asignados.size;
  const nadieSentado = sentados === 0 && roster.length > 0;

  return (
    <section className="sec active seat-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Distribución de aula')}</h1>
          <p className="pg-sub">{t('Grupos cooperativos, roles y rotación semanal')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={handleExportDocx} disabled={exporting !== null}>
            <FileType2 size={14} />{t('Word')}
          </button>
          {isDesktop() && (
            <button className="btn-ghost" onClick={handleExportPdf} disabled={exporting !== null}>
              <FileDown size={14} />{t('PDF')}
            </button>
          )}
        </div>
      </div>

      {/* ── Barra de controles: una sola fila compacta ── */}
      <div className="seat-toolbar">
        <select
          className="seat-select" value={classId} onChange={e => pickClass(e.target.value)}
          aria-label={t('Clase')}
        >
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="seat-rotation" role="group" aria-label={t('Rotación de roles')}>
          <button type="button" onClick={() => rotar(-1)} title={t('Semana anterior')} aria-label={t('Semana anterior')}>
            <RotateCcw size={14} />
          </button>
          <span title={t('Rotación de roles')}>{vecesLabel(plan.weekOffset, t)}</span>
          <button type="button" onClick={() => rotar(1)} title={t('Semana siguiente')} aria-label={t('Semana siguiente')}>
            <RotateCw size={14} />
          </button>
        </div>

        <div className="seat-toolbar-spacer" />

        {sinAsignar.length === 0 && roster.length > 0 ? (
          <span className="seat-pill ok"><CheckCircle2 size={13} />{t('Todos sentados')}</span>
        ) : sinAsignar.length > 0 ? (
          <span className="seat-pill warn"><Users size={13} />{t('{n} sin mesa', { n: sinAsignar.length })}</span>
        ) : null}

        <button className="seat-tb-btn" type="button" onClick={() => setConfigOpen(true)}>
          <Settings2 size={14} />{t('Mesas y roles')}
        </button>
        <button className="btn-ia" type="button" onClick={() => setAiOpen(true)} disabled={generating}>
          {generating ? <><span className="spin" />{t('Generando…')}</> : <><Sparkles size={14} />{t('Repartir con IA')}</>}
        </button>
      </div>

      {nadieSentado && (
        <p className="seat-hint">
          {t('Aún no hay nadie sentado. Reparte con IA o arrastra a cada alumno desde la bandeja inferior hasta un asiento.')}
        </p>
      )}

      {/* ── Mesas ── */}
      <div className="seat-grid">
        {plan.groups.map((g, gi) => {
          const seats = Array.from({ length: plan.groupSize }, (_, i) => {
            const sid = seatStudentId(g, i);
            const student = sid ? roster.find(s => s.id === sid) ?? null : null;
            return {
              student,
              studentName: student?.name ?? null,
              roleName: student ? roleForSeat(plan, i)?.name ?? null : null,
            };
          });
          const color = PALETTE[gi % PALETTE.length];
          const ocupados = seats.filter(x => x.student).length;
          const vacia = ocupados === 0;
          return (
            <div key={g.id} className={`seat-table${vacia ? ' empty' : ''}`}>
              <div className="seat-table-hd">
                <span className="seat-dot" style={{ background: vacia ? 'var(--border-strong)' : color }} />
                <span className="seat-table-name">{g.label}</span>
                <span className="seat-table-count">{ocupados}/{plan.groupSize}</span>
              </div>

              <div
                className="seat-svg"
                onClick={e => handleMesaClick(g.id, e)}
                {...svgDropProps(g.id)}
                dangerouslySetInnerHTML={{ __html: buildTableSvg(seats, color, g.label, { labels: false, showLabel: false }) }}
              />

              <ol className="seat-list">
                {seats.map((seat, i) => {
                  const key = `${g.id}:${i}`;
                  const over = dropTarget === key;
                  if (!seat.student) {
                    return (
                      <li
                        key={i}
                        className={`seat-row free${over ? ' over' : ''}${selected ? ' armed' : ''}`}
                        onClick={() => selected && seatClick(g.id, i)}
                        {...dropProps(key, id => moveStudent(id, { groupId: g.id, seat: i }))}
                      >
                        <span className="seat-num">{i + 1}</span>
                        <span className="seat-free-txt">{selected ? t('Sentar aquí') : t('Asiento libre')}</span>
                      </li>
                    );
                  }
                  const st = seat.student;
                  return (
                    <li
                      key={i}
                      className={`seat-row${over ? ' over' : ''}${selected ? ' armed' : ''}`}
                      draggable
                      onDragStart={e => onDragStart(e, st.id)}
                      onDragEnd={() => setDropTarget(null)}
                      onClick={() => selected && seatClick(g.id, i)}
                      {...dropProps(key, id => moveStudent(id, { groupId: g.id, seat: i }))}
                      title={t('Arrastra para cambiar de asiento')}
                    >
                      <span className="seat-num filled" style={{ background: color }}>{i + 1}</span>
                      <span className="seat-who">
                        <span className="seat-name">{st.name}</span>
                        {seat.roleName && <span className="seat-role">{seat.roleName}</span>}
                      </span>
                      {(() => {
                        const tm = todayMarks.get(st.id);
                        return (
                          <button
                            type="button" className={`seat-mark${tm ? ' has' : ''}`}
                            onClick={e => { e.stopPropagation(); setMarking(st); }}
                            title={t('Anotar: sin tarea, comportamiento, participación…')}
                            aria-label={t('Anotar a {name}', { name: st.name })}
                          >
                            {tm ? (
                              <>
                                {tm.neg > 0 && <b className="neg">−{tm.neg}</b>}
                                {tm.pos > 0 && <b className="pos">+{tm.pos}</b>}
                              </>
                            ) : <Flag size={13} />}
                          </button>
                        );
                      })()}
                      <button
                        type="button" className="seat-x"
                        onClick={e => { e.stopPropagation(); moveStudent(st.id, null); }}
                        title={t('Quitar de la mesa')} aria-label={t('Quitar de la mesa')}
                      >
                        <X size={12} />
                      </button>
                    </li>
                  );
                })}
              </ol>

              {g.justificacion && <p className="seat-why">{g.justificacion}</p>}
            </div>
          );
        })}
      </div>

      {/* ── Bandeja de «sin mesa»: solo existe si hay alguien sin sentar ── */}
      {sinAsignar.length > 0 && (
        <div
          className={`seat-dock${dropTarget === 'tray' ? ' over' : ''}`}
          {...dropProps('tray', id => moveStudent(id, null))}
        >
          <div className="seat-dock-hd">
            <span className="seat-dock-ttl"><Users size={14} />{t('Sin mesa asignada')} <b>{sinAsignar.length}</b></span>
            <span className="seat-dock-help">
              {t('Arrastra a un alumno hasta un asiento, o tócalo y después toca el asiento.')}
            </span>
          </div>
          <div className="seat-dock-chips">
            {sinAsignar.map(s => {
              const on = selected === s.id;
              return (
                <button
                  key={s.id} type="button" draggable
                  className={`seat-chip${on ? ' on' : ''}`}
                  onDragStart={e => onDragStart(e, s.id)}
                  onDragEnd={() => setDropTarget(null)}
                  onClick={() => setSelected(v => (v === s.id ? null : s.id))}
                >
                  <GripVertical size={12} className="seat-chip-grip" />{s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Repartir con IA ── */}
      <Modal open={aiOpen} onClose={() => setAiOpen(false)} title={<span className="seat-modal-ttl"><Sparkles size={16} color="var(--accent-d)" />{t('Repartir con IA')}</span>}>
        {!hasApiKey() ? (
          <>
            <p className="seat-modal-p">
              {t('Para generar grupos equilibrados con IA hace falta la clave gratuita de Google que se configura en Mi Perfil. También puedes sentar al alumnado a mano, sin IA.')}
            </p>
            <button className="btn-accent" onClick={() => { setAiOpen(false); onNav('profile'); }}>
              {t('Configurar la IA')}
            </button>
          </>
        ) : (
          <>
            <p className="seat-modal-p">
              {t('La IA reparte al alumnado real de esta clase en mesas multinivel: mezcla niveles según la media ponderada, la asistencia y los avisos de cada alumno, sin inventar ninguno.')}
            </p>
            {sentados > 0 && (
              <p className="seat-modal-warn">{t('Se sustituirá la distribución actual de {clase}.', { clase: cls?.name ?? '' })}</p>
            )}
            <label className="flabel" htmlFor="seatingplan-f1">{t('Aspectos a tener en cuenta (opcional)')}</label>
            <textarea
              id="seatingplan-f1"
              className="finput" rows={3} style={{ marginBottom: 14, resize: 'vertical' }}
              placeholder={t('p. ej. «Marco y Lucía no deben ir juntos»')}
              value={notasDocente} onChange={e => setNotasDocente(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn-ghost" type="button" onClick={() => setAiOpen(false)}>{t('Cancelar')}</button>
              <button className="btn-ia" onClick={handleGenerate} disabled={generating} type="button">
                {generating ? <><span className="spin" />{t('Generando…')}</> : <>✨ {t('Generar grupos con IA')}</>}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Configuración de mesas y roles ── */}
      <Modal open={configOpen} onClose={() => setConfigOpen(false)} title={t('Configuración de mesas y roles')} wide>
        <div className="frow">
          <div className="fgroup">
            <label className="flabel" htmlFor="seatingplan-f2">{t('Nº de mesas')}</label>
            <input
              id="seatingplan-f2"
              className="finput" type="number" min={1} max={12} value={plan.numGroups}
              onChange={e => applyStructure(Number(e.target.value), plan.groupSize)}
            />
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="seatingplan-f3">{t('Alumnos por mesa')}</label>
            <input
              id="seatingplan-f3"
              className="finput" type="number" min={1} max={8} value={plan.groupSize}
              onChange={e => applyStructure(plan.numGroups, Number(e.target.value))}
            />
          </div>
        </div>
        <label className="flabel">{t('Roles cooperativos')}</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plan.roles.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                className="finput" style={{ maxWidth: 200 }} value={r.name}
                aria-label={t('Rol {n}', { n: i + 1 })}
                onChange={e => updateRole(i, { name: e.target.value })}
              />
              <input
                className="finput" style={{ flex: 1, minWidth: 200 }} value={r.description}
                onChange={e => updateRole(i, { description: e.target.value })}
                placeholder={t('Responsabilidad de este rol')}
                aria-label={t('Responsabilidad de este rol')}
              />
            </div>
          ))}
        </div>
      </Modal>
      {marking && cls && (
        <ClassMarksModal
          student={marking}
          cls={cls}
          gradeCategories={gradeCategories}
          classMarks={classMarks}
          onAdd={onAddMark}
          onDelete={onDeleteMark}
          onClose={() => setMarking(null)}
          onNav={onNav}
        />
      )}
    </section>
  );
}
