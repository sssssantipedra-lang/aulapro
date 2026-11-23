import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText, Sparkles, Download, FileDown, Users, ArrowRight, Check, Trash2, Pencil, AlertTriangle, Eye, ListChecks, RefreshCw, PenLine,
} from 'lucide-react';
import type {
  Class, Student, Evaluation, Rubric, EvalDiana, GradeCategory, GradeItem,
  GradeMap, AttendanceMap, CompetencyReport, ClassMark, MarksBlockConfig,
} from '../types';
import { callGemini, hasApiKey } from '../services/gemini';
import { isoDate, LOMLOE_COMPETENCES, nombreDePila } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { ClassChips } from '../components/ui/ClassChips';
import { AiKeyNotice } from '../components/ui/AiKeyNotice';
import { useI18n } from '../i18n';
import { downloadFile } from '../lib/download';
import { useMateriasOficiales } from '../hooks/useNotasPorCompetencias';
import { lineasDeCompetencias } from '../lib/curriculum/evaluacionPorCriterios';
import { citarNormas, type ComunidadId } from '../lib/curriculum/comunidades';
import { compararAlumnos, compararNombres } from '../lib/alumnado';
import { CARPETAS } from '../lib/carpetas';
import { separarInforme, aplicarNotas, lineasDeClave, notasPorClave, MARCA_TABLA } from '../lib/tablaCompetencias';
import { DocPreview } from '../components/DocPreview';
import { textoLibreParaIA, soloDatosDeSalud } from '../lib/documentoParaIA';
import { useClaseActiva, useFijarClase } from '../hooks/useClaseActiva';
import { useEvaluacionElegida } from '../hooks/useEvaluacionElegida';
import { SelectorEvaluacion } from '../components/SelectorEvaluacion';
import { asistenciaDelPeriodo, claseDelPeriodo, componerSeguimiento, datosCambiados, notasDelPeriodo, origenDelTexto, recalcular } from '../lib/informeSeguimiento';
import { cuerpoDeInformeHtml, informeEnTexto, informesHtml, partesDeInforme, textoDePeriodo, type ContextoDeInforme } from '../lib/informeDocumento';
import { EditorSeguimiento, type BorradorDeSeguimiento } from '../components/informes/EditorSeguimiento';

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
  /** Las anotaciones de clase y la configuración del bloque «Trabajo diario y actitud», para las notas de cada evaluación. */
  classMarks?: ClassMark[];
  marksConfigs?: Record<string, MarksBlockConfig>;
  reports: CompetencyReport[];
  /** Un alumno cuyo informe de seguimiento hay que abrir al entrar (desde su ficha); después se avisa con `onAlumnoAbierto`. Solo se mira al montar: quien lo pasa cambia la `key`. */
  alumnoInicial?: string | null;
  onAlumnoAbierto?: () => void;
  /** La comunidad del perfil: de su currículo salen las competencias específicas que llegan al informe. */
  comunidad?: ComunidadId;
  onAddReport: (r: CompetencyReport) => void;
  /** Varios de una vez (los de seguimiento de la clase), con un solo «Deshacer»; sin él, se añaden de uno en uno. */
  onAddReports?: (rs: CompetencyReport[]) => void;
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

const SIN_ANOTACIONES: ClassMark[] = [];
const SIN_BLOQUES: Record<string, MarksBlockConfig> = {};

const nuevoId = () => 'rep' + Date.now() + Math.random().toString(36).slice(2, 6);

/** Qué se está escribiendo en el panel del alumno: la hoja de seguimiento o el texto a mano. */
type Edicion =
  | { tipo: 'seguimiento'; alumno: string; inicial: BorradorDeSeguimiento }
  | { tipo: 'texto'; alumno: string };

export function Reports(props: Props) {
  const {
    classes, students, evaluations, rubrics, dianas,
    gradeCategories, gradeItems, grades, attendance, reports, comunidad,
    classMarks = SIN_ANOTACIONES, marksConfigs = SIN_BLOQUES, alumnoInicial, onAlumnoAbierto,
    onAddReport, onAddReports, onUpdateReport, onDeleteReport, onNav,
  } = props;

  const { toast } = useToast();
  const { t, lang, locale } = useI18n();
  // Si se llega desde la ficha de un alumno, la pantalla se abre en su clase y con él elegido
  const [inicial] = useState(() => (alumnoInicial ? students.find(x => x.id === alumnoInicial) ?? null : null));
  const [classId, setClassId]   = useClaseActiva(classes, inicial?.class_id);
  // La evaluación es la misma que se ve en el cuaderno y en las actas (`useEvaluacionElegida`): el informe
  // cuenta las notas, la asistencia, las anotaciones y las evaluaciones de sus fechas
  const ev = useEvaluacionElegida();
  const { periodo: period, hoy, rangos } = ev;
  const [selected, setSelected] = useState<string | null>(inicial?.id ?? null);
  /** Al llegar desde la ficha se abre su informe de seguimiento sin más toques, hasta que el docente haga otra cosa. */
  const [alLlegar, setAlLlegar] = useState(!!inicial);
  useEffect(() => {
    if (alumnoInicial) onAlumnoAbierto?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una vez, al entrar
  }, []);
  // En pantallas estrechas el informe queda debajo de la lista del alumnado: al elegir a alguien (o al llegar desde su ficha) se lleva a la vista
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selected || !window.matchMedia?.('(max-width: 860px)').matches) return;
    panel.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [selected]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [batch, setBatch]       = useState<{ done: number; total: number } | null>(null);
  const [draft, setDraft]       = useState('');
  const [edicion, setEdicion]   = useState<Edicion | null>(null);

  const cls = classes.find(c => c.id === classId) ?? classes[0];
  const clsId = cls?.id ?? '';
  // Las asignaturas de la clase con materia oficial, del currículo de la comunidad
  const { materias: materiasOficiales, curriculo } = useMateriasOficiales(cls ?? null, comunidad);
  const cita = curriculo ? citarNormas(curriculo.normas, lang) : '';

  const roster = useMemo(
    () => students.filter(s => s.class_id === clsId).sort(compararAlumnos),
    [students, clsId],
  );

  /** El cuaderno de la clase en la evaluación elegida, calculado una vez para todos sus informes. */
  const clase = useMemo(
    () => (cls ? claseDelPeriodo({ classes, students, gradeCategories, gradeItems, grades, classMarks, marksConfigs }, cls, period, hoy, rangos) : null),
    [cls, classes, students, gradeCategories, gradeItems, grades, classMarks, marksConfigs, period, hoy, rangos],
  );

  const reportOf = (studentId: string) =>
    reports.find(r => r.student_id === studentId && r.period === period);

  /** Las evaluaciones con rúbricas, dianas y escalas del alumno en las fechas de la evaluación. */
  const evaluacionesDe = (studentId: string) => evaluations.filter(e => e.student_id === studentId && ev.cuenta(e.date));

  /** Las competencias específicas evaluadas del alumno (rúbricas y dianas con criterios oficiales). */
  const competenciasDe = (studentId: string) =>
    lineasDeCompetencias(materiasOficiales, evaluacionesDe(studentId), lang === 'en');

  const etiquetaCompetencia = (clave: string) => t((lang === 'en' ? LOMLOE_COMPETENCES_EN : LOMLOE_COMPETENCES).find(c => c.key === clave)?.label ?? '');

  /** Lo que el documento necesita además del informe: el grupo, el idioma y el pie de las competencias específicas. */
  const contexto: ContextoDeInforme = {
    grupo: cls?.name ?? '', t, locale, etiquetaCompetencia,
    pieExtra: r => (r.origen !== 'mano' && r.origen !== 'reglas' && cita && competenciasDe(r.student_id).length ? t('Competencias específicas según {norma}.', { norma: cita }) : ''),
  };

  /** El informe de seguimiento de un alumno recién calculado con las reglas, sin guardar. */
  const componer = (student: Student) => (clase ? componerSeguimiento({ clase, student, attendance, evaluations, t, locale }) : null);

  /** Reúne todo lo que sabemos del alumno en la evaluación para dárselo a la IA. */
  function buildEvidence(student: Student): { text: string; hasData: boolean; competencias: boolean } {
    const lines: string[] = [];
    const en = lang === 'en';

    const evs = evaluacionesDe(student.id);
    if (evs.length) {
      lines.push(en ? 'RECORDED ASSESSMENTS:' : 'EVALUACIONES REGISTRADAS:');
      evs.slice(0, 12).forEach(ev => {
        const rubric = rubrics.find(r => r.id === ev.rubric_id);
        const diana  = dianas.find(d => d.id === ev.rubric_id);
        const detail = Object.entries(ev.scores).map(([k, v]) => {
          const name = rubric?.criteria.find(c => c.id === k)?.name
                    ?? diana?.items.find(i => i.id === k)?.name
                    ?? k;
          if (diana?.tipo === 'registro') return `${name}: ${v === 2 ? (en ? 'done well' : 'bien hecho') : (en ? 'needs improvement' : 'mejorable')}`;
          return `${name}: ${v}/4`;
        }).join('; ');
        const auto = ev.rubric_id === 'autoeval' ? (en ? ' [student’s own self-assessment]' : ' [autoevaluación del propio alumno]') : '';
        const obsLabel = en ? 'Comment' : 'Observación';
        lines.push(`- ${ev.rubric_name}${auto} (${ev.date}): ${detail}${ev.notes ? ` | ${obsLabel}: ${textoLibreParaIA(ev.notes)}` : ''}`);
      });
    }

    const porCompetencias = competenciasDe(student.id);
    if (porCompetencias.length) {
      lines.push(en
        ? `\nSPECIFIC COMPETENCES OF THE OFFICIAL CURRICULUM (${cita}), mark out of 10:`
        : `\nCOMPETENCIAS ESPECÍFICAS DEL CURRÍCULO OFICIAL (${cita}), nota sobre 10:`);
      lines.push(...porCompetencias);
    }

    const notasClave = notasPorClave(evs);
    if (Object.keys(notasClave).length) {
      lines.push(en
        ? '\nKEY COMPETENCIES (mean of the assessments, out of 4; the rating in brackets is FIXED, do not change it):'
        : '\nCOMPETENCIAS CLAVE (media de las evaluaciones, sobre 4; la valoración entre paréntesis es FIJA, no la cambies):');
      lines.push(...lineasDeClave(notasClave, en));
    }

    // La nota del cuaderno en la evaluación, asignatura por asignatura (antes, una sola media de todo el curso que mezclaba las áreas)
    const notas = clase ? notasDelPeriodo(clase, student.id) : [];
    for (const n of notas) {
      if (n.media === null) continue;
      lines.push(en
        ? `\nGRADEBOOK MARK IN ${n.asignatura}: ${n.media.toFixed(1)} out of 10.`
        : `\nNOTA DEL CUADERNO EN ${n.asignatura}: ${n.media.toFixed(1).replace('.', ',')} sobre 10.`);
    }

    const asis = asistenciaDelPeriodo(attendance, clsId, student.id, f => ev.cuenta(f));
    if (asis) {
      lines.push(en
        ? `\nATTENDANCE: ${asis.dias} sessions recorded, ${asis.faltas} unexcused absences, ` +
          `${asis.justificadas} excused, ${asis.retrasos} late arrivals.`
        : `\nASISTENCIA: ${asis.dias} sesiones registradas, ${asis.faltas} faltas sin justificar, ` +
          `${asis.justificadas} justificadas, ${asis.retrasos} retrasos.`);
    }

    if (student.notes?.trim()) lines.push(`\n${en ? 'TEACHER’S NOTES' : 'OBSERVACIONES DEL DOCENTE'}: ${textoLibreParaIA(student.notes.trim())}`);
    const avisos = (student.alerts ?? []).map(a => textoLibreParaIA(a.text)).filter(x => x.trim() && !soloDatosDeSalud(x));
    if (avisos.length) {
      lines.push(`${en ? 'ALERTS' : 'ALERTAS'}: ${avisos.join('; ')}`);
    }

    return { text: lines.join('\n'), hasData: evs.length > 0 || notas.length > 0, competencias: porCompetencias.length > 0 };
  }

  async function generateFor(student: Student): Promise<boolean> {
    const { text: evidence, hasData, competencias: conCompetencias } = buildEvidence(student);
    if (!hasData) {
      toast(`${nombreDePila(student.name)} ${t('no tiene evaluaciones ni notas todavía')}`);
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
        (conCompetencias
          ? `- The specific competences of the official curriculum are the most solid evidence: rely on them to say which key competencies are consolidated and which are in progress, describing what the student does in plain language for families, without quoting codes or the legal wording.\n`
          : '') +
        `- Start with the competencies already consolidated, move to those in progress, and end with a ` +
        `concrete, actionable suggestion for improvement.\n` +
        `- Don't invent facts not given above. Don't mention grade numbers except the overall average if it exists.\n` +
        `- After the text, on a new line, write exactly ${MARCA_TABLA} and then a JSON array with one object per key competency you mentioned ({"clave":"CCL","valoracion":"excelente"|"bien"|"mejorable","comentario":"..."}): "excelente" = outstanding, "bien" = good, "mejorable" = needs improvement. The comment is TWO complete sentences (25 to 45 words): what the student does that supports the rating, with a concrete example from the evidence, and what to keep doing or how to improve. Use only abbreviations from the list above.\n` +
        `- Return only the report text followed by that table.`
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
        (conCompetencias
          ? `- Las competencias específicas del currículo oficial son la evidencia más sólida: apóyate en ellas para decir qué competencias clave tiene consolidadas y cuáles en proceso, contando lo que hace el alumno con palabras sencillas para las familias, sin citar códigos ni el texto legal.\n`
          : '') +
        `- Empieza por las competencias que ya tiene consolidadas, sigue con las que están en proceso y termina con ` +
        `una propuesta de mejora concreta y accionable.\n` +
        `- No inventes hechos que no aparezcan arriba. No menciones números de nota salvo la media general si existe.\n` +
        `- Después del texto, en una línea nueva, escribe exactamente ${MARCA_TABLA} y a continuación un array JSON con un objeto por cada competencia clave que hayas mencionado ({"clave":"CCL","valoracion":"excelente"|"bien"|"mejorable","comentario":"..."}): «excelente» es sobresaliente, «bien» es adecuado y «mejorable» es que necesita mejorar. El comentario son DOS frases completas (de 25 a 45 palabras): qué hace el alumno que justifica la valoración, con un ejemplo concreto de las evidencias, y qué mantener o cómo mejorar. Usa solo abreviaturas de la lista de arriba.\n` +
        `- Devuelve únicamente el texto del informe seguido de esa tabla.`;

    const raw = await callGemini(en ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ES, userPrompt, [], {
      onStart: () => setGenerating(student.id),
      onEnd: () => setGenerating(null),
      onError: msg => toast(msg),
    }, { thinkingLevel: 'high' });
    if (!raw) return false;

    const { texto, tabla: deLaIA } = separarInforme(raw);
    const tabla = aplicarNotas(deLaIA, notasPorClave(evaluacionesDe(student.id)));
    const previo = reportOf(student.id);
    if (previo?.seguimiento) {
      // En un informe de seguimiento la IA solo pone el texto y los comentarios de las competencias que
      // ya tienen valoración por reglas: la hoja, las frases y la observación del docente no se tocan
      const comentario = new Map(tabla.map(f => [f.clave, f.comentario]));
      onUpdateReport({
        ...previo, text: texto, origen: 'ia', editado: false,
        ...(previo.tabla ? { tabla: previo.tabla.map(f => ({ ...f, comentario: comentario.get(f.clave) ?? f.comentario })) } : {}),
      });
      return true;
    }
    onAddReport({
      id: nuevoId(),
      student_id: student.id,
      student_name: student.name,
      class_id: clsId,
      period,
      date: isoDate(),
      text: texto,
      origen: 'ia',
      ...(tabla.length ? { tabla } : {}),
    });
    return true;
  }

  /** Volver a pedir el texto a la IA lo cambia entero: si el docente lo corrigió a mano, se le pregunta antes. */
  function regenerar(student: Student, r: CompetencyReport) {
    if (r.editado && r.text.trim() && !window.confirm(t('Has corregido este texto a mano. Si la IA lo vuelve a redactar, se pierde lo que escribiste. ¿Continuar?'))) return;
    void generateFor(student);
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

  /* ── Informe de seguimiento: por reglas, sin IA y al instante ── */

  const informeDe = (student: Student, b: BorradorDeSeguimiento, previo?: CompetencyReport): CompetencyReport => ({
    ...(previo ?? { id: nuevoId(), student_id: student.id, student_name: student.name, class_id: clsId, period, date: isoDate() }),
    text: b.text,
    origen: origenDelTexto(b.text, previo),
    seguimiento: b.seguimiento,
    tabla: b.tabla,
  });

  /** Los informes de seguimiento de quienes aún no tienen informe en esta evaluación, de una vez. */
  function seguimientoDeTodos() {
    const pendientes = roster.filter(s => !reportOf(s.id));
    if (pendientes.length === 0) { toast(t('Todo el alumnado tiene ya su informe de esta evaluación')); return; }
    const nuevos: CompetencyReport[] = [];
    for (const s of pendientes) {
      const c = componer(s);
      if (c?.hayDatos) nuevos.push(informeDe(s, { text: '', seguimiento: c.seguimiento, tabla: c.tabla }));
    }
    const hechos = nuevos.length;
    if (onAddReports) onAddReports(nuevos); else nuevos.forEach(onAddReport);
    const sinDatos = pendientes.length - hechos;
    if (hechos === 0) { toast(t('No hay notas, asistencia, anotaciones ni evaluaciones de esta evaluación: no se ha creado ningún informe')); return; }
    toast(`✅ ${t(hechos === 1 ? '{n} informe de seguimiento creado. Revísalo antes de entregarlo.' : '{n} informes de seguimiento creados. Revísalos antes de entregarlos.', { n: hechos })}`
      + (sinDatos > 0 ? ` ${t(sinDatos === 1 ? '{n} alumno no tiene datos en esta evaluación.' : '{n} alumnos no tienen datos en esta evaluación.', { n: sinDatos })}` : ''));
  }

  /** Abre la hoja de seguimiento de un alumno para revisarla: recién calculada, o la que ya tenía guardada. */
  function abrirSeguimiento(student: Student, modo: 'nuevo' | 'editar' | 'recalcular') {
    const previo = reportOf(student.id);
    if (modo === 'editar' && previo?.seguimiento) {
      setEdicion({ tipo: 'seguimiento', alumno: student.id, inicial: { text: previo.text, seguimiento: previo.seguimiento, tabla: previo.tabla ?? [] } });
      return;
    }
    const c = componer(student);
    if (!c) return;
    const base = previo?.seguimiento ? recalcular(previo, c) : { seguimiento: c.seguimiento, tabla: recalcular({ tabla: previo?.tabla }, c).tabla };
    setEdicion({ tipo: 'seguimiento', alumno: student.id, inicial: { text: previo?.text ?? '', ...base } });
  }

  function guardarSeguimiento(student: Student, b: BorradorDeSeguimiento) {
    const previo = reportOf(student.id);
    // «Corregido a mano» se refiere al texto: es lo que la IA pisaría si lo vuelve a redactar
    // La fecha del informe es la de la última vez que el docente lo dio por bueno
    if (previo) onUpdateReport({ ...informeDe(student, b, previo), date: isoDate(), editado: !!previo.editado || b.text !== previo.text.trim() });
    else onAddReport(informeDe(student, b));
    setEdicion(null); setAlLlegar(false);
    toast(t(previo ? '✅ Informe actualizado' : '✅ Informe de seguimiento guardado'));
  }

  function guardarTexto(student: Student) {
    const texto = draft.trim();
    const previo = reportOf(student.id);
    if (!texto && !previo?.seguimiento) { toast(t('Escribe el informe antes de guardarlo')); return; }
    if (previo) {
      onUpdateReport({ ...previo, text: texto, editado: true, origen: origenDelTexto(texto, previo) });
      toast(t('✅ Informe actualizado'));
    } else {
      onAddReport({ id: nuevoId(), student_id: student.id, student_name: student.name, class_id: clsId, period, date: isoDate(), text: texto, origen: 'mano' });
      toast(t('✅ Informe guardado'));
    }
    setEdicion(null);
  }

  const docs = window.electronAPI?.docs;
  const [working, setWorking] = useState<'one' | 'all' | 'word' | null>(null);
  const [preview, setPreview] = useState<{ html: string; title: string } | null>(null);

  const slug = (t: string) => t.replace(/\s+/g, '-');
  const buildDoc = (list: CompetencyReport[], title: string) => informesHtml(list, title, lang, contexto);

  /** Los informes de la clase en esta evaluación, en orden de lista. */
  const delPeriodo = () => reports
    .filter(r => r.class_id === clsId && r.period === period)
    .sort((a, b) => compararNombres(a.student_name, b.student_name));
  const nombreDeTodos = `informes-${slug(cls?.name ?? 'clase')}-${slug(period)}`;
  const nombreDeUno = (r: CompetencyReport) => `informe-${slug(r.student_name)}-${slug(r.period)}`;

  async function savePdf(list: CompetencyReport[], nombre: string, modo: 'one' | 'all') {
    if (list.length === 0) { toast(t('No hay informes de este periodo')); return; }
    if (!docs) { window.print(); return; }
    setWorking(modo);
    const res = await docs.savePdf(buildDoc(list, nombre), nombre + '.pdf', { carpeta: CARPETAS.informes });
    setWorking(null);
    if (res.canceled) return;
    if (res.error) { toast(t('No se pudo generar el PDF: {error}', { error: res.error })); return; }
    toast(list.length === 1
      ? t('✅ Informe guardado en PDF')
      : t(list.length === 1 ? '✅ {n} informe guardado en PDF' : '✅ {n} informes guardados en PDF', { n: list.length }));
    if (res.path) docs.reveal(res.path);
  }

  /** El Word, con las mismas partes que el PDF; la librería se pide al pulsar, no al abrir la pantalla. */
  async function saveWord(list: CompetencyReport[], nombre: string) {
    if (list.length === 0) { toast(t('No hay informes de este periodo')); return; }
    setWorking('word');
    try {
      const { guardarInformesDocx } = await import('../services/exportInformeDocx');
      await guardarInformesDocx(list, nombre, contexto);
      toast(list.length === 1 ? t('✅ Informe guardado en Word') : t('✅ {n} informes guardados en Word', { n: list.length }));
    } catch {
      toast(t('No se pudo generar el Word'));
    }
    setWorking(null);
  }

  function previewAll() {
    const list = delPeriodo();
    if (list.length === 0) { toast(t('No hay informes de este periodo')); return; }
    setPreview({ html: buildDoc(list, nombreDeTodos), title: `${cls?.name ?? ''} · ${t(period)}` });
  }

  function previewOne(r: CompetencyReport) {
    setPreview({ html: buildDoc([r], nombreDeUno(r)), title: `${r.student_name} · ${t(r.period)}` });
  }

  /** Copia en texto plano, por si quiere pegarlo en otro sitio. */
  function exportAll() {
    const list = delPeriodo();
    if (list.length === 0) { toast(t('No hay informes de este periodo')); return; }
    const text = list.map(r => `${informeEnTexto(r, contexto)}\n\n${'-'.repeat(40)}\n`).join('\n');
    void downloadFile(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${nombreDeTodos}.txt`, CARPETAS.informes);
    toast(t('✅ Informes descargados'));
  }

  const SUBTITULO = 'De seguimiento, al instante y sin IA, o redactados por la IA con tus propias evaluaciones';

  if (classes.length === 0) {
    return (
      <section className="sec active">
        <div className="pg-hd">
          <div>
            <h1 className="pg-title">{t('Informes')}</h1>
            <p className="pg-sub">{t(SUBTITULO)}</p>
          </div>
        </div>
        <div className="card" style={{ maxWidth: 540, margin: '40px auto', textAlign: 'center', padding: '40px 34px' }}>
          <Users size={36} color="var(--text-3)" style={{ margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('Aún no tienes clases')}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
            {t('Los informes salen de las evaluaciones, las notas y la asistencia de tus alumnos.')}
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
  const conIA = hasApiKey();

  // Lo que se está escribiendo del alumno elegido. Al llegar desde su ficha sin informe en esta evaluación,
  // la hoja de seguimiento sale ya calculada, sin tener que pedirla
  let editando: Edicion | null = edicion && edicion.alumno === current?.id ? edicion : null;
  if (!editando && alLlegar && current && !currentReport) {
    const c = componer(current);
    if (c?.hayDatos) editando = { tipo: 'seguimiento', alumno: current.id, inicial: { text: '', seguimiento: c.seguimiento, tabla: c.tabla } };
  }
  const elegir = (id: string | null) => { setSelected(id); setEdicion(null); setAlLlegar(false); };
  const periodoDe = (r: Pick<CompetencyReport, 'period' | 'seguimiento'>) => textoDePeriodo(r, t, locale);
  const periodoAhora = textoDePeriodo({ period, seguimiento: ev.rango ? { desde: ev.rango.desde, hasta: ev.rango.hasta, notas: [], asistencia: null, positivos: [], mejorar: [], observacion: '' } : undefined }, t, locale);

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Informes')}</h1>
          <p className="pg-sub">
            {generatedCount > 0
              ? t('{n}/{total} generados · {period}', { n: generatedCount, total: roster.length, period: t(period) })
              : t(SUBTITULO)}
          </p>
        </div>
        <div className="inf-acciones">
          <button className="btn-accent" onClick={seguimientoDeTodos} disabled={roster.length === 0 || generatedCount === roster.length}
            title={t('Crea al instante el informe de seguimiento de quienes aún no tienen informe en esta evaluación, con reglas y sin IA')}>
            <ListChecks size={14} />{t('Informes de seguimiento de la clase')}
          </button>
          {conIA && (
            <button className="btn-ia" onClick={generateAll} disabled={batch !== null || roster.length === 0}
              title={t('La IA redacta el informe competencial de quienes aún no tienen informe: una petición por alumno')}>
              {batch
                ? <><span className="spin" />{batch.done}/{batch.total}</>
                : <><Sparkles size={14} />{t('Redactar con IA los que faltan')}</>}
            </button>
          )}
        </div>
      </div>

      {!conIA && (
        <AiKeyNotice message={t('El informe de seguimiento no necesita IA. Para que además la IA redacte el texto hace falta tu clave gratuita de Google.')} action={t('Configurar')} onAction={() => onNav('profile')} />
      )}

      {/* Barra de controles: clase, evaluación y progreso */}
      <div className="toolbar">
        <ClassChips classes={classes} value={clsId} onChange={id => { setClassId(id); elegir(null); }} />
        <span className="toolbar-spacer" />
        {roster.length > 0 && (
          generatedCount === roster.length
            ? <span className="seat-pill ok"><Check size={13} aria-hidden="true" />{t('Todos con informe')}</span>
            : <span className="seat-pill warn">{t('{n}/{total} con informe', { n: generatedCount, total: roster.length })}</span>
        )}
        <SelectorEvaluacion ev={ev} queCuenta={t('El informe cuenta las notas, la asistencia, las anotaciones y las evaluaciones de estas fechas.')} />
      </div>

      {generatedCount > 0 && (
        <div className="inf-salida" role="group" aria-label={t('Los informes de la clase en esta evaluación')}>
          <span className="toolbar-label">{t('Los {n} de la clase:', { n: generatedCount })}</span>
          <button className="btn-ghost sm" onClick={previewAll}><Eye size={13} />{t('Vista previa')}</button>
          <button className="btn-ghost sm" onClick={() => savePdf(delPeriodo(), nombreDeTodos, 'all')} disabled={working !== null}>
            {working === 'all' ? <><span className="spin" />{t('Generando…')}</> : <><FileDown size={13} />{t('Todos en PDF')}</>}
          </button>
          <button className="btn-ghost sm" onClick={() => saveWord(delPeriodo(), nombreDeTodos)} disabled={working !== null}>
            {working === 'word' ? <><span className="spin" />{t('Generando…')}</> : <><FileText size={13} />{t('Todos en Word')}</>}
          </button>
          <button className="btn-ghost sm" onClick={exportAll} title={t('Copia en texto plano, para pegar en otro sitio')}>
            <Download size={13} />{t('Texto')}
          </button>
        </div>
      )}

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
        <div className="split-list">
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
                    onClick={() => elegir(s.id)}
                    aria-pressed={on}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '11px 16px', border: 'none', cursor: 'pointer',
                      borderTop: i === 0 ? 'none' : '0.5px solid var(--border)',
                      background: on ? 'var(--accent-l)' : 'var(--card)',
                      fontFamily: 'var(--font)', textAlign: 'left',
                    }}
                  >
                    <span style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0, fontSize: 11, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: rep ? 'var(--ok-bg)' : 'var(--surface)',
                      color: rep ? 'var(--ok-fg)' : 'var(--text-3)',
                    }}>
                      {rep ? <Check size={12} aria-label={t('Con informe')} /> : i + 1}
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
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 460, margin: '0 auto' }}>
                {t('El informe de seguimiento sale al instante de sus notas, su asistencia, sus anotaciones y sus evaluaciones de la evaluación elegida, con reglas fijas y sin IA. Si quieres, la IA redacta además el texto, o lo escribes tú.')}
              </p>
            </div>
          ) : (
            <div className="card inf-panel" ref={panel}>
              <div className="card-hd">
                <div>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)' }}>{current.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    {cls?.name} · {currentReport ? periodoDe(currentReport) : t(period)}
                    {currentReport && ` ${t('· generado el {date}', { date: currentReport.date })}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {currentReport && !editando && (
                    <>
                      <button className="ico-btn" title={t('Editar')} aria-label={t('Editar')} onClick={() => {
                        if (currentReport.seguimiento) abrirSeguimiento(current, 'editar');
                        else { setDraft(currentReport.text); setEdicion({ tipo: 'texto', alumno: current.id }); }
                      }}>
                        <Pencil size={15} />
                      </button>
                      <button className="ico-btn" title={t('Eliminar informe')} aria-label={t('Eliminar informe')} onClick={() => { onDeleteReport(currentReport.id); toast(t('Informe eliminado')); }}>
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
              ) : editando?.tipo === 'seguimiento' ? (
                <EditorSeguimiento
                  key={current.id}
                  nombre={nombreDePila(current.name)}
                  periodo={periodoAhora}
                  inicial={editando.inicial}
                  partes={b => partesDeInforme({ id: '', student_id: current.id, student_name: current.name, class_id: clsId, period, date: isoDate(), ...b }, contexto)}
                  etiquetaCompetencia={etiquetaCompetencia}
                  nuevo={!currentReport}
                  onGuardar={b => guardarSeguimiento(current, b)}
                  onCancelar={() => { setEdicion(null); setAlLlegar(false); }}
                />
              ) : editando?.tipo === 'texto' ? (
                <>
                  <label className="flabel" htmlFor="rep-texto">{t('Texto del informe')}</label>
                  <textarea
                    id="rep-texto" className="finput" rows={11} value={draft} onChange={e => setDraft(e.target.value)}
                    placeholder={t('Escribe aquí el informe para la familia.')}
                    style={{ resize: 'vertical', fontSize: 13.5, lineHeight: 1.7 }}
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button className="btn-accent" onClick={() => guardarTexto(current)}>
                      {t(currentReport ? 'Guardar cambios' : 'Guardar informe')}
                    </button>
                    <button className="btn-ghost" onClick={() => setEdicion(null)}>{t('Cancelar')}</button>
                  </div>
                </>
              ) : currentReport ? (
                <>
                  {currentReport.seguimiento && datosCambiados(currentReport, componer(current) ?? { seguimiento: currentReport.seguimiento, tabla: currentReport.tabla ?? [], hayDatos: true }) && (
                    <p className="inf-aviso" role="status">
                      <AlertTriangle size={14} aria-hidden="true" />
                      {t('Los datos de esta evaluación han cambiado desde que se hizo el informe. Con «Actualizar los datos» lo pones al día sin perder lo que escribiste.')}
                    </p>
                  )}
                  <div className="inf-hoja" dangerouslySetInnerHTML={{ __html: cuerpoDeInformeHtml(partesDeInforme(currentReport, contexto), t) }} />
                  <div className="inf-botones">
                    <button className="btn-ghost" onClick={() => previewOne(currentReport)}
                      disabled={working !== null}>
                      <Eye size={13} />{t('Vista previa')}
                    </button>
                    <button className="btn-ghost" onClick={() => savePdf([currentReport], nombreDeUno(currentReport), 'one')}
                      disabled={working !== null}>
                      {working === 'one'
                        ? <><span className="spin" />{t('Generando…')}</>
                        : <><FileDown size={13} />{t('Guardar en PDF')}</>}
                    </button>
                    <button className="btn-ghost" onClick={() => saveWord([currentReport], nombreDeUno(currentReport))}
                      disabled={working !== null}>
                      <FileText size={13} />{t('Guardar en Word')}
                    </button>
                    <button className="btn-ghost" onClick={() => abrirSeguimiento(current, currentReport.seguimiento ? 'recalcular' : 'nuevo')}
                      title={currentReport.seguimiento
                        ? t('Vuelve a calcular la hoja con las notas, la asistencia y las anotaciones de ahora. Tu observación y lo que escribiste se conservan, y lo revisas antes de guardar.')
                        : t('Añade al informe las calificaciones, la asistencia, las competencias y las frases de lo positivo y lo que hay que mejorar, con reglas y sin IA')}>
                      {currentReport.seguimiento
                        ? <><RefreshCw size={13} />{t('Actualizar los datos')}</>
                        : <><ListChecks size={13} />{t('Añadir la hoja de seguimiento')}</>}
                    </button>
                    {conIA && (
                      <button className="btn-ia" onClick={() => regenerar(current, currentReport)}>
                        <Sparkles size={13} />{t(currentReport.text.trim() ? (currentReport.origen === 'mano' ? 'Redactar el texto con IA' : 'Volver a generar') : 'Redactar el texto con IA')}
                      </button>
                    )}
                  </div>
                  {/* Lo escrito entero a mano no necesita aviso: ni la IA ni las reglas han puesto nada */}
                  {(currentReport.seguimiento || (currentReport.origen ?? 'ia') === 'ia') && (
                    <p className="inf-nota">
                      {t((currentReport.origen ?? 'ia') === 'ia'
                        ? 'Revísalo siempre antes de entregarlo. La IA se equivoca.'
                        : 'Revísalo siempre antes de entregarlo: las reglas solo ven lo que has anotado en AulaPro.')}
                    </p>
                  )}
                </>
              ) : (
                <EmptyReport
                  student={current}
                  hayDatos={!!componer(current)?.hayDatos}
                  conIA={conIA}
                  onSeguimiento={() => abrirSeguimiento(current, 'nuevo')}
                  onGenerate={() => generateFor(current)}
                  onEscribir={() => { setDraft(''); setEdicion({ tipo: 'texto', alumno: current.id }); }}
                  onNav={onNav}
                />
              )}
            </div>
          )}
        </div>
      )}

      <DocPreview open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} html={preview?.html ?? ''} />
    </section>
  );
}

function EmptyReport({
  student, hayDatos, conIA, onSeguimiento, onGenerate, onEscribir, onNav,
}: {
  student: Student;
  /** Si en la evaluación hay algo anotado del alumno. */
  hayDatos: boolean;
  conIA: boolean;
  onSeguimiento: () => void;
  onGenerate: () => void;
  onEscribir: () => void;
  onNav: (s: string) => void;
}) {
  const { t } = useI18n();
  const fijarClase = useFijarClase();
  if (!hayDatos) {
    return (
      <div style={{ textAlign: 'center', padding: '34px 24px' }}>
        <AlertTriangle size={30} color="var(--warn)" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
          {t('Sin datos en esta evaluación')}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto 20px' }}>
          {t('{name} no tiene notas, asistencia, anotaciones ni evaluaciones en las fechas de esta evaluación. Prueba con otra evaluación, evalúale antes o escribe tú el informe.', { name: nombreDePila(student.name) })}
        </p>
        <div className="inf-vacio-btns">
          <button className="btn-accent" onClick={onEscribir}><PenLine size={14} />{t('Escribir a mano')}</button>
          <button className="btn-ghost" onClick={() => onNav('rubrics')}>{t('Ir a Evaluación')}</button>
          <button className="btn-ghost" onClick={() => { fijarClase(student.class_id); onNav('notebook'); }}>{t('Ir al Cuaderno')}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '30px 24px' }}>
      <FileText size={32} color="var(--accent-d)" style={{ margin: '0 auto 14px' }} />
      <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 460, margin: '0 auto 20px' }}>
        {t('El informe de seguimiento reúne sus calificaciones, su asistencia, sus competencias y lo más relevante de esta evaluación, al instante y sin IA. Lo revisas antes de guardarlo.')}
      </p>
      <div className="inf-vacio-btns">
        <button className="btn-accent" onClick={onSeguimiento}><ListChecks size={14} />{t('Informe de seguimiento')}</button>
        {conIA && <button className="btn-ia" onClick={onGenerate}><Sparkles size={14} />{t('Generar informe')}</button>}
        <button className="btn-ghost" onClick={onEscribir}><PenLine size={14} />{t('Escribir a mano')}</button>
      </div>
    </div>
  );
}
