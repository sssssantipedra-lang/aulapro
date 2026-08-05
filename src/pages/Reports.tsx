import { useMemo, useState } from 'react';
import {
  FileText, Sparkles, Download, Users, ArrowRight, Check, Trash2, Pencil, AlertTriangle,
} from 'lucide-react';
import type {
  Class, Student, Evaluation, Rubric, EvalDiana, GradeCategory, GradeItem,
  GradeMap, AttendanceMap, CompetencyReport,
} from '../types';
import { callGemini, hasApiKey } from '../services/gemini';
import { isoDate, plural, PERIODS, LOMLOE_COMPETENCES } from '../lib/utils';
import { useToast } from '../components/ui/Toast';

interface Props {
  classes: Class[];
  students: Student[];
  evaluations: Evaluation[];
  rubrics: Rubric[];
  dianas: EvalDiana[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  attendance: AttendanceMap;
  reports: CompetencyReport[];
  onAddReport: (r: CompetencyReport) => void;
  onUpdateReport: (r: CompetencyReport) => void;
  onDeleteReport: (id: string) => void;
  onNav: (s: string) => void;
}

const SYSTEM_PROMPT =
  'Eres un docente español de secundaria con experiencia redactando informes de evaluación competencial ' +
  'según la LOMLOE. Escribes en español de España, en tercera persona, con un tono profesional, concreto y ' +
  'constructivo, apto para entregar a las familias. No inventas datos: te ciñes a la información aportada. ' +
  'El informe describe el grado de desarrollo de las COMPETENCIAS CLAVE del alumno, no su rendimiento en una ' +
  'asignatura: la materia es únicamente el contexto en el que se han podido observar esas competencias.';

/** Media ponderada del alumno en el cuaderno de notas. */
function notebookAverage(
  studentId: string, classId: string,
  categories: GradeCategory[], items: GradeItem[], grades: GradeMap,
): number | null {
  const cats = categories.filter(c => c.class_id === classId);
  let sum = 0, weight = 0;
  for (const cat of cats) {
    const catItems = items.filter(i => i.category_id === cat.id);
    const scores = catItems.map(i => grades[i.id]?.[studentId]).filter((v): v is number => typeof v === 'number');
    if (!scores.length) continue;
    sum += (scores.reduce((a, b) => a + b, 0) / scores.length) * cat.weight;
    weight += cat.weight;
  }
  return weight ? sum / weight : null;
}

export function Reports(props: Props) {
  const {
    classes, students, evaluations, rubrics, dianas,
    gradeCategories, gradeItems, grades, attendance, reports,
    onAddReport, onUpdateReport, onDeleteReport, onNav,
  } = props;

  const { toast } = useToast();
  const [classId, setClassId]   = useState(classes[0]?.id ?? '');
  const [period, setPeriod]     = useState<string>(PERIODS[0]);
  const [selected, setSelected] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [batch, setBatch]       = useState<{ done: number; total: number } | null>(null);
  const [draft, setDraft]       = useState('');
  const [editing, setEditing]   = useState(false);

  const cls = classes.find(c => c.id === classId) ?? classes[0];
  const clsId = cls?.id ?? '';

  const roster = useMemo(
    () => students.filter(s => s.class_id === clsId).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [students, clsId],
  );

  const reportOf = (studentId: string) =>
    reports.find(r => r.student_id === studentId && r.period === period);

  /** Reúne todo lo que sabemos del alumno para dárselo a la IA. */
  function buildEvidence(student: Student): { text: string; hasData: boolean } {
    const lines: string[] = [];

    const evs = evaluations.filter(e => e.student_id === student.id);
    if (evs.length) {
      lines.push('EVALUACIONES REGISTRADAS:');
      evs.slice(0, 12).forEach(ev => {
        const rubric = rubrics.find(r => r.id === ev.rubric_id);
        const diana  = dianas.find(d => d.id === ev.rubric_id);
        const detail = Object.entries(ev.scores).map(([k, v]) => {
          const name = rubric?.criteria.find(c => c.id === k)?.name
                    ?? diana?.items.find(i => i.id === k)?.name
                    ?? k;
          return `${name}: ${v}/4`;
        }).join('; ');
        const auto = ev.rubric_id === 'autoeval' ? ' [autoevaluación del propio alumno]' : '';
        lines.push(`- ${ev.rubric_name}${auto} (${ev.date}): ${detail}${ev.notes ? ` | Observación: ${ev.notes}` : ''}`);
      });
    }

    const avg = notebookAverage(student.id, clsId, gradeCategories, gradeItems, grades);
    if (avg !== null) {
      lines.push(`\nNOTA MEDIA DEL CUADERNO: ${avg.toFixed(1).replace('.', ',')} sobre 10.`);
    }

    const days = Object.keys(attendance[clsId] ?? {});
    if (days.length) {
      const counts = { present: 0, absent: 0, late: 0, justified: 0 };
      days.forEach(d => {
        const st = attendance[clsId]?.[d]?.[student.id];
        if (st) counts[st]++;
      });
      const total = counts.present + counts.absent + counts.late + counts.justified;
      if (total > 0) {
        lines.push(`\nASISTENCIA: ${total} sesiones registradas — ${counts.absent} faltas sin justificar, ` +
          `${counts.justified} justificadas, ${counts.late} retrasos.`);
      }
    }

    if (student.notes?.trim()) lines.push(`\nOBSERVACIONES DEL DOCENTE: ${student.notes.trim()}`);
    if (student.alerts?.length) {
      lines.push(`ALERTAS: ${student.alerts.map(a => a.text).join('; ')}`);
    }

    return { text: lines.join('\n'), hasData: evs.length > 0 || avg !== null };
  }

  async function generateFor(student: Student): Promise<boolean> {
    const { text: evidence, hasData } = buildEvidence(student);
    if (!hasData) {
      toast(`${student.name.split(' ')[0]} no tiene evaluaciones ni notas todavía`);
      return false;
    }

    const competences = LOMLOE_COMPETENCES.map(c => `${c.key} (${c.label})`).join(', ');
    const userPrompt =
      `Redacta el informe de evaluación competencial de un alumno para el periodo «${period}».\n\n` +
      `ALUMNO: ${student.name}\n` +
      `CONTEXTO DONDE SE OBSERVARON LAS EVIDENCIAS (no es el tema del informe): ` +
      `${cls?.name ?? ''}${cls?.subject ? ` — ${cls.subject}` : ''}\n\n` +
      `${evidence}\n\n` +
      `INSTRUCCIONES:\n` +
      `- El informe va sobre COMPETENCIAS, no sobre la asignatura. Describe lo que el alumno es capaz de hacer ` +
      `(comunicarse, razonar, trabajar con otros, autorregularse, usar herramientas digitales…), nunca si «va bien en la materia».\n` +
      `- Vertebra el texto en torno a las competencias clave LOMLOE que sostengan los datos (${competences}), ` +
      `citando su abreviatura entre paréntesis la primera vez que aparezca cada una. Menciona SOLO las que puedas ` +
      `justificar con las evidencias: es mejor tratar tres o cuatro a fondo que nombrarlas todas de pasada.\n` +
      `- Nombra la asignatura únicamente si hace falta para explicar POR QUÉ se observa ese resultado (la tarea o ` +
      `situación concreta en la que se vio). Nunca como asunto principal del informe.\n` +
      `- Escribe entre 120 y 180 palabras, en 2 o 3 párrafos, sin encabezados ni viñetas.\n` +
      `- Empieza por las competencias que ya tiene consolidadas, sigue con las que están en proceso y termina con ` +
      `una propuesta de mejora concreta y accionable.\n` +
      `- No inventes hechos que no aparezcan arriba. No menciones números de nota salvo la media general si existe.\n` +
      `- Devuelve únicamente el texto del informe.`;

    const raw = await callGemini(SYSTEM_PROMPT, userPrompt, [], {
      onStart: () => setGenerating(student.id),
      onEnd: () => setGenerating(null),
      onError: msg => toast(msg),
    });
    if (!raw) return false;

    onAddReport({
      id: 'rep' + Date.now() + Math.random().toString(36).slice(2, 6),
      student_id: student.id,
      student_name: student.name,
      class_id: clsId,
      period,
      date: isoDate(),
      text: raw.trim(),
    });
    return true;
  }

  async function generateAll() {
    const pending = roster.filter(s => !reportOf(s.id));
    if (pending.length === 0) { toast('Ya están todos generados para este periodo'); return; }
    setBatch({ done: 0, total: pending.length });
    let ok = 0;
    for (let i = 0; i < pending.length; i++) {
      const done = await generateFor(pending[i]);
      if (done) ok++;
      setBatch({ done: i + 1, total: pending.length });
    }
    setBatch(null);
    toast(ok > 0 ? `✅ ${plural(ok, 'informe generado', 'informes generados')}` : 'No se pudo generar ningún informe');
  }

  function exportAll() {
    const list = reports.filter(r => r.class_id === clsId && r.period === period);
    if (list.length === 0) { toast('No hay informes de este periodo'); return; }
    const text = list
      .slice()
      .sort((a, b) => a.student_name.localeCompare(b.student_name, 'es'))
      .map(r => `${r.student_name}\n${cls?.name ?? ''} · ${r.period} · ${r.date}\n\n${r.text}\n\n${'—'.repeat(40)}\n`)
      .join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `informes-${cls?.name.replace(/\s+/g, '-') ?? 'clase'}-${period.replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✅ Informes descargados');
  }

  if (classes.length === 0) {
    return (
      <section className="sec active">
        <div className="pg-hd">
          <div>
            <h1 className="pg-title">Informes competenciales</h1>
            <p className="pg-sub">Redactados por la IA con tus propias evaluaciones</p>
          </div>
        </div>
        <div className="card" style={{ maxWidth: 540, margin: '40px auto', textAlign: 'center', padding: '40px 34px' }}>
          <Users size={36} color="var(--text-3)" style={{ margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Aún no tienes clases</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
            Los informes se redactan a partir de las evaluaciones y notas de tus alumnos.
          </p>
          <button className="btn-accent" onClick={() => onNav('classes')}>
            Ir a Mis Clases <ArrowRight size={14} />
          </button>
        </div>
      </section>
    );
  }

  const current = selected ? roster.find(s => s.id === selected) : null;
  const currentReport = current ? reportOf(current.id) : null;
  const generatedCount = roster.filter(s => reportOf(s.id)).length;

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">Informes competenciales</h1>
          <p className="pg-sub">
            {generatedCount > 0
              ? `${generatedCount}/${roster.length} generados · ${period}`
              : 'Redactados por la IA con tus propias evaluaciones'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={exportAll} disabled={generatedCount === 0}>
            <Download size={14} />Descargar todos
          </button>
          <button className="btn-ia" onClick={generateAll} disabled={batch !== null || roster.length === 0}>
            {batch
              ? <><span className="spin" />{batch.done}/{batch.total}</>
              : <><Sparkles size={14} />Generar los que faltan</>}
          </button>
        </div>
      </div>

      {!hasApiKey() && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', marginBottom: 16,
          background: 'rgba(245,158,11,0.09)', border: '0.5px solid rgba(245,158,11,0.35)',
          borderRadius: 12, fontSize: 13, color: '#92400e',
        }}>
          <Sparkles size={17} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, lineHeight: 1.5 }}>
            Los informes los redacta la IA. Necesitas configurar tu clave gratuita de Google.
          </span>
          <button className="btn-accent" style={{ fontSize: 12.5, padding: '7px 14px', flexShrink: 0 }} onClick={() => onNav('profile')}>
            Configurar
          </button>
        </div>
      )}

      {/* Clase y periodo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {classes.map(c => {
          const on = c.id === clsId;
          return (
            <button
              key={c.id}
              onClick={() => { setClassId(c.id); setSelected(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
                background: on ? 'white' : 'transparent',
                border: `1.5px solid ${on ? c.color : 'var(--border)'}`,
                borderRadius: 99, cursor: 'pointer', fontFamily: 'var(--font)',
                fontSize: 13, fontWeight: on ? 700 : 500, color: 'var(--text)',
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color }} />
              {c.name}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <select
          className="finput"
          value={period}
          onChange={e => { setPeriod(e.target.value); setSelected(null); }}
          style={{ width: 176, height: 38, cursor: 'pointer' }}
        >
          {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {roster.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px 24px' }}>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 16 }}>
            La clase <strong>{cls?.name}</strong> todavía no tiene alumnos.
          </p>
          <button className="btn-accent" onClick={() => onNav('classes')}>
            Añadir alumnos <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '292px minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
          {/* Lista de alumnos */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '0.5px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Alumnos
            </div>
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {roster.map((s, i) => {
                const rep = reportOf(s.id);
                const on = selected === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelected(s.id); setEditing(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '11px 16px', border: 'none', cursor: 'pointer',
                      borderTop: i === 0 ? 'none' : '0.5px solid var(--border)',
                      background: on ? 'var(--accent-l)' : 'white',
                      fontFamily: 'var(--font)', textAlign: 'left',
                    }}
                  >
                    <span style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0, fontSize: 11, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: rep ? 'rgba(16,185,129,0.14)' : 'var(--surface)',
                      color: rep ? '#047857' : 'var(--text-3)',
                    }}>
                      {rep ? <Check size={12} /> : i + 1}
                    </span>
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 13, fontWeight: on ? 700 : 500,
                      color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Informe */}
          {!current ? (
            <div className="card" style={{ textAlign: 'center', padding: '56px 30px' }}>
              <FileText size={36} color="var(--text-3)" style={{ margin: '0 auto 14px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
                Elige un alumno
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
                La IA redacta el informe a partir de sus evaluaciones, sus notas del cuaderno y su
                asistencia, centrado en las competencias clave de la LOMLOE que ha desarrollado.
              </p>
            </div>
          ) : (
            <div className="card">
              <div className="card-hd">
                <div>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)' }}>{current.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    {cls?.name} · {period}
                    {currentReport && ` · generado el ${currentReport.date}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {currentReport && !editing && (
                    <>
                      <button className="ico-btn" title="Editar" onClick={() => { setDraft(currentReport.text); setEditing(true); }}>
                        <Pencil size={15} />
                      </button>
                      <button className="ico-btn" title="Eliminar informe" onClick={() => { onDeleteReport(currentReport.id); toast('Informe eliminado'); }}>
                        <Trash2 size={15} color="var(--danger)" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {generating === current.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '30px 0', justifyContent: 'center', color: 'var(--text-2)', fontSize: 13.5 }}>
                  <span className="spin" />Redactando el informe…
                </div>
              ) : editing && currentReport ? (
                <>
                  <textarea
                    className="finput" rows={11} value={draft} onChange={e => setDraft(e.target.value)}
                    style={{ resize: 'vertical', fontSize: 13.5, lineHeight: 1.7 }}
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button className="btn-accent" onClick={() => {
                      onUpdateReport({ ...currentReport, text: draft.trim() });
                      setEditing(false);
                      toast('✅ Informe actualizado');
                    }}>
                      Guardar cambios
                    </button>
                    <button className="btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
                  </div>
                </>
              ) : currentReport ? (
                <>
                  <div style={{
                    fontSize: 13.5, lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-wrap',
                    background: 'var(--surface)', borderRadius: 11, padding: '16px 18px',
                    border: '0.5px solid var(--border)',
                  }}>
                    {currentReport.text}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
                    <button className="btn-ia" onClick={() => generateFor(current)}>
                      <Sparkles size={13} />Volver a generar
                    </button>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', flex: 1, lineHeight: 1.5 }}>
                      Revísalo siempre antes de entregarlo. La IA se equivoca.
                    </p>
                  </div>
                </>
              ) : (
                <EmptyReport
                  student={current}
                  evidence={buildEvidence(current)}
                  onGenerate={() => generateFor(current)}
                  onNav={onNav}
                />
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function EmptyReport({
  student, evidence, onGenerate, onNav,
}: {
  student: Student;
  evidence: { text: string; hasData: boolean };
  onGenerate: () => void;
  onNav: (s: string) => void;
}) {
  if (!evidence.hasData) {
    return (
      <div style={{ textAlign: 'center', padding: '34px 24px' }}>
        <AlertTriangle size={30} color="var(--warn)" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
          Sin datos suficientes
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 400, margin: '0 auto 20px' }}>
          {student.name.split(' ')[0]} no tiene todavía evaluaciones ni notas en el cuaderno.
          Un informe sin datos serían solo frases genéricas, así que es mejor evaluarle antes.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn-ghost" onClick={() => onNav('rubrics')}>Ir a Evaluación</button>
          <button className="btn-ghost" onClick={() => onNav('notebook')}>Ir al Cuaderno</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '30px 24px' }}>
      <FileText size={32} color="var(--accent-d)" style={{ margin: '0 auto 14px' }} />
      <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 430, margin: '0 auto 20px' }}>
        Se usarán sus evaluaciones, su media del cuaderno y su asistencia para redactar el informe.
      </p>
      <button className="btn-ia" onClick={onGenerate} style={{ margin: '0 auto' }}>
        <Sparkles size={14} />Generar informe
      </button>
    </div>
  );
}
