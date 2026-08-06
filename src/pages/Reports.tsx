import { useMemo, useState } from 'react';
import {
  FileText, Sparkles, Download, FileDown, Users, ArrowRight, Check, Trash2, Pencil, AlertTriangle,
} from 'lucide-react';
import type {
  Class, Student, Evaluation, Rubric, EvalDiana, GradeCategory, GradeItem,
  GradeMap, AttendanceMap, CompetencyReport,
} from '../types';
import { callGemini, hasApiKey } from '../services/gemini';
import { isoDate, PERIODS, LOMLOE_COMPETENCES } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';

/** Las 8 competencias clave LOMLOE, en inglés, para los informes en ese idioma. */
const LOMLOE_COMPETENCES_EN = [
  { key: 'CCL',   label: 'Linguistic communication' },
  { key: 'CP',    label: 'Plurilingual' },
  { key: 'STEM',  label: 'Mathematical, scientific, technological and engineering' },
  { key: 'CD',    label: 'Digital' },
  { key: 'CPSAA', label: 'Personal, social and learning to learn' },
  { key: 'CC',    label: 'Citizenship' },
  { key: 'CE',    label: 'Entrepreneurship' },
  { key: 'CCEC',  label: 'Cultural awareness and expression' },
] as const;

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

const SYSTEM_PROMPT_ES =
  'Eres un docente español de secundaria con experiencia redactando informes de evaluación competencial ' +
  'según la LOMLOE. Escribes en español de España, en tercera persona, con un tono profesional, concreto y ' +
  'constructivo, apto para entregar a las familias. No inventas datos: te ciñes a la información aportada. ' +
  'El informe describe el grado de desarrollo de las COMPETENCIAS CLAVE del alumno, no su rendimiento en una ' +
  'asignatura: la materia es únicamente el contexto en el que se han podido observar esas competencias.';

const SYSTEM_PROMPT_EN =
  'You are an experienced secondary school teacher writing competency-based assessment reports. ' +
  'You write in clear English, in the third person, with a professional, specific and constructive tone, ' +
  'suitable to hand to families. You never invent data: you stick to the information given. ' +
  'The report describes the student’s development of KEY COMPETENCIES, not their performance in a ' +
  'subject: the subject is only the context in which those competencies were observed.';

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

/** Estilos del informe cuando viaja solo, fuera de la aplicación. */
const REPORT_DOC_STYLE = `
:root { --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
@page { size: A4 portrait; margin: 20mm 18mm; }
.rep { font-family: Georgia, 'Times New Roman', serif; color: #111827; }
.rep h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
.rep .sub { font-family: var(--font); font-size: 12px; color: #6b7280; margin-bottom: 16px; }
.rep .hd { border-bottom: 2px solid #111827; padding-bottom: 11px; margin-bottom: 18px; }
.rep dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0;
  border-bottom: 1px solid #d1d5db; margin: 0 0 20px; }
.rep dl > div { padding: 10px 12px 10px 0; }
.rep dt { font-family: var(--font); font-size: 9.5px; letter-spacing: .1em;
  text-transform: uppercase; color: #6b7280; font-weight: 700; margin-bottom: 3px; }
.rep dd { font-size: 13.5px; font-weight: 700; margin: 0; }
.rep .cuerpo { font-size: 13.5px; line-height: 1.85; text-align: justify; white-space: pre-wrap; }
.rep .pie { margin-top: 34px; font-family: var(--font); font-size: 10.5px;
  color: #6b7280; border-top: 1px solid #d1d5db; padding-top: 10px; line-height: 1.5; }
.rep .alumno { break-inside: avoid; page-break-inside: avoid; }
.rep .salto { page-break-after: always; break-after: page; }
`;

export function Reports(props: Props) {
  const {
    classes, students, evaluations, rubrics, dianas,
    gradeCategories, gradeItems, grades, attendance, reports,
    onAddReport, onUpdateReport, onDeleteReport, onNav,
  } = props;

  const { toast } = useToast();
  const { t, lang, locale } = useI18n();
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
    const en = lang === 'en';

    const evs = evaluations.filter(e => e.student_id === student.id);
    if (evs.length) {
      lines.push(en ? 'RECORDED ASSESSMENTS:' : 'EVALUACIONES REGISTRADAS:');
      evs.slice(0, 12).forEach(ev => {
        const rubric = rubrics.find(r => r.id === ev.rubric_id);
        const diana  = dianas.find(d => d.id === ev.rubric_id);
        const detail = Object.entries(ev.scores).map(([k, v]) => {
          const name = rubric?.criteria.find(c => c.id === k)?.name
                    ?? diana?.items.find(i => i.id === k)?.name
                    ?? k;
          return `${name}: ${v}/4`;
        }).join('; ');
        const auto = ev.rubric_id === 'autoeval' ? (en ? ' [student’s own self-assessment]' : ' [autoevaluación del propio alumno]') : '';
        const obsLabel = en ? 'Comment' : 'Observación';
        lines.push(`- ${ev.rubric_name}${auto} (${ev.date}): ${detail}${ev.notes ? ` | ${obsLabel}: ${ev.notes}` : ''}`);
      });
    }

    const avg = notebookAverage(student.id, clsId, gradeCategories, gradeItems, grades);
    if (avg !== null) {
      lines.push(en
        ? `\nGRADEBOOK AVERAGE: ${avg.toFixed(1)} out of 10.`
        : `\nNOTA MEDIA DEL CUADERNO: ${avg.toFixed(1).replace('.', ',')} sobre 10.`);
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
        lines.push(en
          ? `\nATTENDANCE: ${total} sessions recorded — ${counts.absent} unexcused absences, ` +
            `${counts.justified} excused, ${counts.late} late arrivals.`
          : `\nASISTENCIA: ${total} sesiones registradas — ${counts.absent} faltas sin justificar, ` +
            `${counts.justified} justificadas, ${counts.late} retrasos.`);
      }
    }

    if (student.notes?.trim()) lines.push(`\n${en ? 'TEACHER’S NOTES' : 'OBSERVACIONES DEL DOCENTE'}: ${student.notes.trim()}`);
    if (student.alerts?.length) {
      lines.push(`${en ? 'ALERTS' : 'ALERTAS'}: ${student.alerts.map(a => a.text).join('; ')}`);
    }

    return { text: lines.join('\n'), hasData: evs.length > 0 || avg !== null };
  }

  async function generateFor(student: Student): Promise<boolean> {
    const { text: evidence, hasData } = buildEvidence(student);
    if (!hasData) {
      toast(`${student.name.split(' ')[0]} ${t('no tiene evaluaciones ni notas todavía')}`);
      return false;
    }

    const en = lang === 'en';
    const competencesList = en ? LOMLOE_COMPETENCES_EN : LOMLOE_COMPETENCES;
    const competences = competencesList.map(c => `${c.key} (${c.label})`).join(', ');
    const periodLabel = t(period);
    const userPrompt = en
      ? `Write the competency assessment report for a student for the period "${periodLabel}".\n\n` +
        `STUDENT: ${student.name}\n` +
        `CONTEXT WHERE THE EVIDENCE WAS OBSERVED (not the report's subject): ` +
        `${cls?.name ?? ''}${cls?.subject ? ` — ${cls.subject}` : ''}\n\n` +
        `${evidence}\n\n` +
        `INSTRUCTIONS:\n` +
        `- The report is about COMPETENCIES, not the subject. Describe what the student is capable of doing ` +
        `(communicating, reasoning, working with others, self-regulating, using digital tools…), never whether ` +
        `they are "doing well in the subject".\n` +
        `- Build the text around the key competencies that the evidence supports (${competences}), ` +
        `citing the abbreviation in parentheses the first time each one appears. Mention ONLY the ones you can ` +
        `justify with the evidence: it's better to cover three or four in depth than to name them all in passing.\n` +
        `- Name the subject only when needed to explain WHY that result was observed (the specific task or ` +
        `situation). Never as the report's main subject.\n` +
        `- Write between 120 and 180 words, in 2 or 3 paragraphs, no headings or bullet points.\n` +
        `- Start with the competencies already consolidated, move to those in progress, and end with a ` +
        `concrete, actionable suggestion for improvement.\n` +
        `- Don't invent facts not given above. Don't mention grade numbers except the overall average if it exists.\n` +
        `- Return only the report text.`
      : `Redacta el informe de evaluación competencial de un alumno para el periodo «${periodLabel}».\n\n` +
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

    const raw = await callGemini(en ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ES, userPrompt, [], {
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
    if (pending.length === 0) { toast(t('Ya están todos generados para este periodo')); return; }
    setBatch({ done: 0, total: pending.length });
    let ok = 0;
    for (let i = 0; i < pending.length; i++) {
      const done = await generateFor(pending[i]);
      if (done) ok++;
      setBatch({ done: i + 1, total: pending.length });
    }
    setBatch(null);
    toast(ok > 0
      ? `✅ ${t(ok === 1 ? '{n} informe generado' : '{n} informes generados', { n: ok })}`
      : t('No se pudo generar ningún informe'));
  }

  const docs = window.electronAPI?.docs;
  const [working, setWorking] = useState<'one' | 'all' | null>(null);

  const esc = (t: string) =>
    t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  const slug = (t: string) => t.replace(/\s+/g, '-');

  /** Un informe como bloque del documento, con su cabecera y su pie. */
  function reportBlock(r: CompetencyReport, salto: boolean): string {
    const en = lang === 'en';
    return `<section class="alumno${salto ? ' salto' : ''}">
<div class="hd"><h1>${esc(r.student_name)}</h1>
<div class="sub">${esc(t('Informe de evaluación competencial'))}</div></div>
<dl>
<div><dt>${esc(t('Grupo'))}</dt><dd>${esc(cls?.name ?? '')}</dd></div>
<div><dt>${esc(t('Periodo'))}</dt><dd>${esc(t(r.period))}</dd></div>
<div><dt>${esc(t('Fecha'))}</dt><dd>${esc(en ? new Date(r.date).toLocaleDateString(locale) : r.date)}</dd></div>
</dl>
<div class="cuerpo">${esc(r.text)}</div>
<div class="pie">${esc(t('Informe redactado con asistencia de inteligencia artificial a partir de las evaluaciones, calificaciones y asistencia registradas, y revisado por el docente. Competencias clave según el currículo educativo español (LOMLOE).'))}</div>
</section>`;
  }

  function buildDoc(list: CompetencyReport[], title: string): string {
    // Cada alumno en su propia página: un informe es un documento que se
    // entrega a una familia, no una lista corrida.
    const bloques = list.map((r, i) => reportBlock(r, i < list.length - 1)).join('\n');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
      `<title>${esc(title)}</title><style>${REPORT_DOC_STYLE}</style></head>` +
      `<body class="rep">${bloques}</body></html>`;
  }

  async function savePdf(list: CompetencyReport[], nombre: string, modo: 'one' | 'all') {
    if (list.length === 0) { toast(t('No hay informes de este periodo')); return; }
    if (!docs) { window.print(); return; }
    setWorking(modo);
    const res = await docs.savePdf(buildDoc(list, nombre), nombre + '.pdf');
    setWorking(null);
    if (res.canceled) return;
    if (res.error) { toast(t('No se pudo generar el PDF: {error}', { error: res.error })); return; }
    toast(list.length === 1
      ? t('✅ Informe guardado en PDF')
      : t(list.length === 1 ? '✅ {n} informe guardado en PDF' : '✅ {n} informes guardados en PDF', { n: list.length }));
    if (res.path) docs.reveal(res.path);
  }

  const savePdfOne = (r: CompetencyReport) =>
    savePdf([r], `informe-${slug(r.student_name)}-${slug(r.period)}`, 'one');

  const savePdfAll = () =>
    savePdf(
      reports
        .filter(r => r.class_id === clsId && r.period === period)
        .sort((a, b) => a.student_name.localeCompare(b.student_name, 'es')),
      `informes-${slug(cls?.name ?? 'clase')}-${slug(period)}`,
      'all',
    );

  /** Copia en texto plano, por si quiere pegarlo en otro sitio. */
  function exportAll() {
    const list = reports.filter(r => r.class_id === clsId && r.period === period);
    if (list.length === 0) { toast(t('No hay informes de este periodo')); return; }
    const text = list
      .slice()
      .sort((a, b) => a.student_name.localeCompare(b.student_name, 'es'))
      .map(r => `${r.student_name}\n${cls?.name ?? ''} · ${t(r.period)} · ${r.date}\n\n${r.text}\n\n${'—'.repeat(40)}\n`)
      .join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `informes-${cls?.name.replace(/\s+/g, '-') ?? 'clase'}-${period.replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast(t('✅ Informes descargados'));
  }

  if (classes.length === 0) {
    return (
      <section className="sec active">
        <div className="pg-hd">
          <div>
            <h1 className="pg-title">{t('Informes competenciales')}</h1>
            <p className="pg-sub">{t('Redactados por la IA con tus propias evaluaciones')}</p>
          </div>
        </div>
        <div className="card" style={{ maxWidth: 540, margin: '40px auto', textAlign: 'center', padding: '40px 34px' }}>
          <Users size={36} color="var(--text-3)" style={{ margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('Aún no tienes clases')}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
            {t('Los informes se redactan a partir de las evaluaciones y notas de tus alumnos.')}
          </p>
          <button className="btn-accent" onClick={() => onNav('classes')}>
            {t('Ir a Mis Clases')} <ArrowRight size={14} />
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
          <h1 className="pg-title">{t('Informes competenciales')}</h1>
          <p className="pg-sub">
            {generatedCount > 0
              ? t('{n}/{total} generados · {period}', { n: generatedCount, total: roster.length, period: t(period) })
              : t('Redactados por la IA con tus propias evaluaciones')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={exportAll} disabled={generatedCount === 0}
            title={t('Copia en texto plano, para pegar en otro sitio')}>
            <Download size={14} />{t('Texto')}
          </button>
          <button className="btn-ghost" onClick={savePdfAll}
            disabled={generatedCount === 0 || working !== null}>
            {working === 'all'
              ? <><span className="spin" />{t('Generando…')}</>
              : <><FileDown size={14} />{t('Todos en PDF')}</>}
          </button>
          <button className="btn-ia" onClick={generateAll} disabled={batch !== null || roster.length === 0}>
            {batch
              ? <><span className="spin" />{batch.done}/{batch.total}</>
              : <><Sparkles size={14} />{t('Generar los que faltan')}</>}
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
            {t('Los informes los redacta la IA. Necesitas configurar tu clave gratuita de Google.')}
          </span>
          <button className="btn-accent" style={{ fontSize: 12.5, padding: '7px 14px', flexShrink: 0 }} onClick={() => onNav('profile')}>
            {t('Configurar')}
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
          {PERIODS.map(p => <option key={p} value={p}>{t(p)}</option>)}
        </select>
      </div>

      {roster.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px 24px' }}>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 16 }}>
            {t('La clase')} <strong>{cls?.name}</strong> {t('todavía no tiene alumnos.')}
          </p>
          <button className="btn-accent" onClick={() => onNav('classes')}>
            {t('Añadir alumnos')} <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '292px minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
          {/* Lista de alumnos */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '0.5px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('Alumnos')}
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
                {t('Elige un alumno')}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
                {t('La IA redacta el informe a partir de sus evaluaciones, sus notas del cuaderno y su asistencia, centrado en las competencias clave de la LOMLOE que ha desarrollado.')}
              </p>
            </div>
          ) : (
            <div className="card">
              <div className="card-hd">
                <div>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)' }}>{current.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    {cls?.name} · {t(period)}
                    {currentReport && ` ${t('· generado el {date}', { date: currentReport.date })}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {currentReport && !editing && (
                    <>
                      <button className="ico-btn" title={t('Editar')} onClick={() => { setDraft(currentReport.text); setEditing(true); }}>
                        <Pencil size={15} />
                      </button>
                      <button className="ico-btn" title={t('Eliminar informe')} onClick={() => { onDeleteReport(currentReport.id); toast(t('Informe eliminado')); }}>
                        <Trash2 size={15} color="var(--danger)" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {generating === current.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '30px 0', justifyContent: 'center', color: 'var(--text-2)', fontSize: 13.5 }}>
                  <span className="spin" />{t('Redactando el informe…')}
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
                      toast(t('✅ Informe actualizado'));
                    }}>
                      {t('Guardar cambios')}
                    </button>
                    <button className="btn-ghost" onClick={() => setEditing(false)}>{t('Cancelar')}</button>
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
                      <Sparkles size={13} />{t('Volver a generar')}
                    </button>
                    <button className="btn-ghost" onClick={() => savePdfOne(currentReport)}
                      disabled={working !== null}>
                      {working === 'one'
                        ? <><span className="spin" />{t('Generando…')}</>
                        : <><FileDown size={13} />{t('Guardar en PDF')}</>}
                    </button>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', flex: 1, lineHeight: 1.5 }}>
                      {t('Revísalo siempre antes de entregarlo. La IA se equivoca.')}
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
  const { t } = useI18n();
  if (!evidence.hasData) {
    return (
      <div style={{ textAlign: 'center', padding: '34px 24px' }}>
        <AlertTriangle size={30} color="var(--warn)" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
          {t('Sin datos suficientes')}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 400, margin: '0 auto 20px' }}>
          {t('{name} no tiene todavía evaluaciones ni notas en el cuaderno. Un informe sin datos serían solo frases genéricas, así que es mejor evaluarle antes.', { name: student.name.split(' ')[0] })}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn-ghost" onClick={() => onNav('rubrics')}>{t('Ir a Evaluación')}</button>
          <button className="btn-ghost" onClick={() => onNav('notebook')}>{t('Ir al Cuaderno')}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '30px 24px' }}>
      <FileText size={32} color="var(--accent-d)" style={{ margin: '0 auto 14px' }} />
      <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 430, margin: '0 auto 20px' }}>
        {t('Se usarán sus evaluaciones, su media del cuaderno y su asistencia para redactar el informe.')}
      </p>
      <button className="btn-ia" onClick={onGenerate} style={{ margin: '0 auto' }}>
        <Sparkles size={14} />{t('Generar informe')}
      </button>
    </div>
  );
}
