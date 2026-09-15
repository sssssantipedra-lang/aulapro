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
  Users, Sparkles, RotateCcw, RotateCw, FileDown, FileType2, Settings2, ArrowRight,
} from 'lucide-react';
import type { Class, Student, GradeCategory, GradeItem, GradeMap, AttendanceMap, SeatingPlan, CooperativeRole } from '../types';
import { seatStudentId } from '../types';
import { weightedAverage, attendanceRate } from '../services/aiContext';
import { generateBalancedGroups, type StudentForGrouping } from '../services/classGroups';
import { hasApiKey } from '../services/gemini';
import { buildTableSvg } from '../lib/seatingLayout';
import { saveSeatingPdf, saveSeatingDocx, roleForSeat, vecesLabel } from '../services/exportSeating';
import { PALETTE } from '../lib/demoData';
import { isDesktop } from '../services/storage';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';

interface Props {
  classes: Class[];
  students: Student[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  attendance: AttendanceMap;
  seatingPlans: Record<string, SeatingPlan>;
  onSave: (classId: string, plan: SeatingPlan) => void;
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
}: Props) {
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [notasDocente, setNotasDocente] = useState('');
  const [generating, setGenerating] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  /** Alumno elegido en la bandeja de «sin mesa», a la espera de un asiento. */
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);

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

  /* ── Asientos: sentar, quitar o intercambiar con un clic ── */
  function seatClick(groupId: string, seatIndex: number) {
    const groups = plan.groups.map(g => {
      if (g.id !== groupId) return g;
      const arr = [...g.studentIds];
      while (arr.length <= seatIndex) arr.push('');
      const ocupante = arr[seatIndex] || null;
      if (selected) arr[seatIndex] = selected; // sentar al elegido (si había alguien, vuelve a la bandeja)
      else if (ocupante) arr[seatIndex] = '';   // quitar a quien esté
      else return g;                            // vacío y nada elegido: no hace nada
      return { ...g, studentIds: arr };
    });
    guardar({ ...plan, groups });
    setSelected(null);
  }

  function handleMesaClick(groupId: string, e: React.MouseEvent<HTMLDivElement>) {
    const seat = (e.target as HTMLElement).closest('[data-seat-index]');
    if (!seat) return;
    seatClick(groupId, Number(seat.getAttribute('data-seat-index')));
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

  return (
    <section className="sec active">
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

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="frow">
          <div className="fgroup">
            <label className="flabel">{t('Clase')}</label>
            <select className="finput" value={classId} onChange={e => pickClass(e.target.value)}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="fgroup">
            <label className="flabel">{t('Rotación de roles')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44 }}>
              <button className="btn-ghost" onClick={() => rotar(-1)} title={t('Semana anterior')} type="button">
                <RotateCcw size={14} />
              </button>
              <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1, textAlign: 'center' }}>
                {vecesLabel(plan.weekOffset, t)}
              </span>
              <button className="btn-ghost" onClick={() => rotar(1)} title={t('Semana siguiente')} type="button">
                <RotateCw size={14} />
              </button>
            </div>
          </div>
        </div>

        <button
          className="btn-ghost" type="button" style={{ fontSize: 12.5, gap: 6 }}
          onClick={() => setConfigOpen(v => !v)}
        >
          <Settings2 size={13} />{t('Configuración de mesas y roles')}
        </button>

        {configOpen && (
          <div style={{ marginTop: 14 }}>
            <div className="frow">
              <div className="fgroup">
                <label className="flabel">{t('Nº de mesas')}</label>
                <input
                  className="finput" type="number" min={1} max={12} value={plan.numGroups}
                  onChange={e => applyStructure(Number(e.target.value), plan.groupSize)}
                />
              </div>
              <div className="fgroup">
                <label className="flabel">{t('Alumnos por mesa')}</label>
                <input
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
                    onChange={e => updateRole(i, { name: e.target.value })}
                  />
                  <input
                    className="finput" style={{ flex: 1, minWidth: 200 }} value={r.description}
                    onChange={e => updateRole(i, { description: e.target.value })}
                    placeholder={t('Responsabilidad de este rol')}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!hasApiKey() ? (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--warn)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
            {t('Para generar grupos equilibrados con IA hace falta la clave gratuita de Google que se configura en Mi Perfil. También puedes sentar al alumnado a mano, sin IA.')}
          </p>
          <button className="btn-accent" style={{ marginTop: 12 }} onClick={() => onNav('profile')}>
            {t('Configurar la IA')}
          </button>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-hd">
            <div className="card-ttl"><Sparkles size={14} color="var(--accent-d)" />{t('Generar grupos equilibrados con IA')}</div>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.55 }}>
            {t('La IA reparte al alumnado real de esta clase en mesas multinivel: mezcla niveles según la media ponderada, la asistencia y los avisos de cada alumno, sin inventar ninguno.')}
          </p>
          <textarea
            className="finput" rows={2} style={{ marginBottom: 10, resize: 'vertical' }}
            placeholder={t('Aspectos a tener en cuenta (opcional): p. ej. «Marco y Lucía no deben ir juntos»')}
            value={notasDocente} onChange={e => setNotasDocente(e.target.value)}
          />
          <button className="btn-ia" onClick={handleGenerate} disabled={generating} type="button">
            {generating ? <><span className="spin" />{t('Generando…')}</> : <>✨ {t('Generar grupos con IA')}</>}
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hd">
          <div className="card-ttl"><Users size={14} color="var(--accent-d)" />{t('Sin mesa asignada')} ({sinAsignar.length})</div>
        </div>
        {sinAsignar.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{t('Todo el alumnado tiene mesa asignada.')}</p>
        ) : (
          <>
            <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 8, lineHeight: 1.5 }}>
              {t('Toca a un alumno y después un asiento libre para sentarlo. Toca un asiento ocupado para quitar a quien esté ahí.')}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {sinAsignar.map(s => {
                const on = selected === s.id;
                return (
                  <button
                    key={s.id} type="button"
                    onClick={() => setSelected(v => (v === s.id ? null : s.id))}
                    style={{
                      padding: '6px 12px', borderRadius: 99, cursor: 'pointer', fontFamily: 'var(--font)',
                      fontSize: 12.5, fontWeight: on ? 800 : 600,
                      background: on ? 'var(--accent-l)' : 'transparent',
                      border: `1.5px solid ${on ? 'var(--accent-d)' : 'var(--border)'}`,
                      color: on ? 'var(--accent-d)' : 'var(--text-2)',
                    }}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {plan.groups.map((g, gi) => {
          const seats = Array.from({ length: plan.groupSize }, (_, i) => {
            const sid = seatStudentId(g, i);
            const student = sid ? roster.find(s => s.id === sid) : null;
            return {
              studentName: student?.name ?? null,
              roleName: student ? roleForSeat(plan, i)?.name ?? null : null,
            };
          });
          const color = PALETTE[gi % PALETTE.length];
          return (
            <div key={g.id} className="card" style={{ padding: 12 }}>
              <div
                onClick={e => handleMesaClick(g.id, e)}
                style={{ cursor: 'pointer' }}
                dangerouslySetInnerHTML={{ __html: buildTableSvg(seats, color, g.label) }}
              />
              {g.justificacion && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' }}>
                  {g.justificacion}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
