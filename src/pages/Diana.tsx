import { useState, useMemo, useCallback } from 'react';
import {
  Sparkles, RotateCcw, Save, ListChecks, Target,
} from 'lucide-react';
import type { Class, Student, Evaluation, DianaProfile, Rubric, EvalDiana } from '../types';
import type { InlineFile } from '../services/gemini';
import { DIANA_SECTORS, fromIsoDate, isoDate } from '../lib/utils';
import { callGemini, parseGeminiJson } from '../services/gemini';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';
import { usePhoneScreen } from '../hooks/useNarrowScreen';
import { textoLibreParaIA } from '../lib/documentoParaIA';
import { CompetenciasEspecificas } from '../components/curriculum/CompetenciasEspecificas';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import { useNotasPorCompetencias } from '../hooks/useNotasPorCompetencias';
import { evidenciasPorSector, nivelDelSector, type SectorId } from '../lib/dianaSectores';
import { useClaseActiva } from '../hooks/useClaseActiva';
import { useEvaluacionElegida } from '../hooks/useEvaluacionElegida';
import { SelectorEvaluacion } from '../components/SelectorEvaluacion';
import { CURSO_ENTERO, EN_FRASE } from '../lib/periodos';
import { conDianaGuardada, dianaGuardada, otrasDianasGuardadas } from '../lib/dianaGuardada';

interface Props {
  classes: Class[];
  students: Student[];
  evaluations: Evaluation[];
  rubrics: Rubric[];
  dianas: EvalDiana[];
  lawDocument: InlineFile | null;
  dianaProfiles: Record<string, DianaProfile>;
  onSaveDiana: (studentId: string, profile: DianaProfile) => void;
  /** La comunidad del perfil: de ella sale el currículo de las competencias específicas. */
  comunidad?: ComunidadId;
}

type ScoreMap = Record<SectorId, number>;
type DescriptorMap = Record<SectorId, string>;

const SECTOR_IDS = DIANA_SECTORS.map(s => s.id) as SectorId[];
const N = DIANA_SECTORS.length; // 6
const RINGS = 4; // levels 1-4
const SVG_SIZE = 320;
const CENTER = SVG_SIZE / 2;
const MAX_RADIUS = 120;

const LEVEL_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
  2: { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
  3: { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd' },
  4: { bg: '#dcfce7', text: '#16a34a', border: '#86efac' },
};

const LEVEL_LABELS: Record<number, string> = {
  1: 'Insuficiente',
  2: 'Suficiente',
  3: 'Bien',
  4: 'Excelente',
};

function angleForIndex(i: number): number {
  // Start from top (-π/2), go clockwise
  return (2 * Math.PI * i) / N - Math.PI / 2;
}

function polarToCart(angle: number, r: number): [number, number] {
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

/** En el móvil, la diana es más pequeña para que quepan los nombres de los lados sin encoger la letra (18-11-2026). */
const RADIO_MOVIL = 82;
/** Lo que ocupa a lo ancho el nombre más largo de un lado («Emprendimiento»), a 10 px. */
const ANCHO_ETIQUETA = 80;

/** «Aprender a aprender» → «Aprender a» / «aprender»: los nombres largos, en dos líneas por el espacio más centrado. */
function lineasEtiqueta(texto: string): string[] {
  if (texto.length <= 11 || !texto.includes(' ')) return [texto];
  const mitad = texto.length / 2;
  let corte = -1;
  for (let i = 0; i < texto.length; i++) if (texto[i] === ' ' && (corte < 0 || Math.abs(i - mitad) < Math.abs(corte - mitad))) corte = i;
  return [texto.slice(0, corte), texto.slice(corte + 1)];
}

function hexagonPoints(radius: number): string {
  return DIANA_SECTORS.map((_, i) => {
    const [x, y] = polarToCart(angleForIndex(i), radius);
    return `${x},${y}`;
  }).join(' ');
}

function scorePolygonPoints(scores: ScoreMap, maxRadius: number): string {
  return SECTOR_IDS.map((id, i) => {
    const val = scores[id] ?? 0;
    const r = (val / RINGS) * maxRadius;
    const [x, y] = polarToCart(angleForIndex(i), r);
    return `${x},${y}`;
  }).join(' ');
}

function emptyScores(): ScoreMap {
  return { ds1: 0, ds2: 0, ds3: 0, ds4: 0, ds5: 0, ds6: 0 };
}

function emptyDescriptors(): DescriptorMap {
  return { ds1: '', ds2: '', ds3: '', ds4: '', ds5: '', ds6: '' };
}

/**
 * Nombre legible de lo que se evaluó en `key` (un id de criterio o de ítem),
 * buscando en la rúbrica o diana de la que salió la evaluación. Sin esto, el
 * resumen que se le manda a la IA está lleno de ids como «c1a2b3»: no aporta
 * nada y la obliga a adivinar en vez de razonar sobre lo que de verdad se
 * evaluó. Si el instrumento ya no existe (se borró después), se devuelve el
 * id tal cual: mejor eso que romper la generación.
 */
function resolveItemName(ev: Evaluation, key: string, rubrics: Rubric[], dianas: EvalDiana[]): string {
  if (ev.instrument === 'diana') {
    return dianas.find(d => d.id === ev.rubric_id)?.items.find(i => i.id === key)?.name ?? key;
  }
  return rubrics.find(r => r.id === ev.rubric_id)?.criteria.find(c => c.id === key)?.name ?? key;
}

interface DianaChartProps {
  scores: ScoreMap;
  onSetScore: (sectorId: SectorId, level: number) => void;
  selectedSector: SectorId | null;
  onSelectSector: (id: SectorId | null) => void;
}

function DianaChart({ scores, onSetScore, selectedSector, onSelectSector }: DianaChartProps) {
  const { t } = useI18n();
  const movil = usePhoneScreen();
  const RADIO = movil ? RADIO_MOVIL : MAX_RADIUS;
  // El dibujo incluye los nombres de los lados: antes se salían del gráfico y, en el iPhone, de la pantalla
  const medioAncho = Math.ceil(RADIO * Math.cos(Math.PI / 6) + 14 + ANCHO_ETIQUETA);
  const medioAlto = RADIO + 50;
  const ringRadii = Array.from({ length: RINGS }, (_, i) => ((i + 1) / RINGS) * RADIO);
  const filled = SECTOR_IDS.filter(id => scores[id] > 0);

  /** El color de la figura lo marca el nivel medio, para que se lea de un vistazo. */
  const avg = filled.length
    ? filled.reduce((a, id) => a + scores[id], 0) / filled.length
    : 0;
  const shade = LEVEL_COLORS[Math.max(1, Math.round(avg))] ?? LEVEL_COLORS[3];

  return (
    <svg
      width={medioAncho * 2}
      height={medioAlto * 2}
      viewBox={`${CENTER - medioAncho} ${CENTER - medioAlto} ${medioAncho * 2} ${medioAlto * 2}`}
      // En una pantalla estrecha se encoge con la tarjeta en vez de salirse
      style={{ overflow: 'visible', userSelect: 'none', maxWidth: '100%', height: 'auto' }}
    >
      <defs>
        <radialGradient id="diana-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={shade.text} stopOpacity={0.34} />
          <stop offset="100%" stopColor={shade.text} stopOpacity={0.13} />
        </radialGradient>
      </defs>

      {/* Fondo: da cuerpo al gráfico sin competir con los datos */}
      <polygon points={hexagonPoints(RADIO)} fill="var(--surface)" fillOpacity={0.55} />

      {/* Anillos, muy tenues: son referencia, no protagonistas */}
      {ringRadii.map((r, ri) => (
        <polygon
          key={`ring-${ri}`}
          points={hexagonPoints(r)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={ri === RINGS - 1 ? 1.5 : 1}
          strokeOpacity={ri === RINGS - 1 ? 0.9 : 0.45}
        />
      ))}

      {/* Ejes */}
      {DIANA_SECTORS.map((s, i) => {
        const [x, y] = polarToCart(angleForIndex(i), RADIO);
        return (
          <line
            key={`axis-${s.id}`}
            x1={CENTER} y1={CENTER} x2={x} y2={y}
            stroke="var(--border)"
            strokeWidth={1}
            strokeOpacity={selectedSector === s.id ? 1 : 0.5}
          />
        );
      })}

      {/* La figura */}
      {filled.length > 0 && (
        <polygon
          points={scorePolygonPoints(scores, RADIO)}
          fill="url(#diana-fill)"
          stroke={shade.text}
          strokeWidth={2.5}
          strokeLinejoin="round"
          style={{ transition: 'all 0.25s ease' }}
        />
      )}

      {/*
        Zonas de clic invisibles: un tramo por nivel a lo largo de cada eje.
        Así se puntúa haciendo clic donde quieras del eje, sin necesidad de
        dibujar veinticuatro puntos que ensucian el gráfico.
      */}
      {DIANA_SECTORS.map((s, i) =>
        ringRadii.map((r, ri) => {
          const prevR = ri === 0 ? 0 : ringRadii[ri - 1];
          const angle = angleForIndex(i);
          const [x1, y1] = polarToCart(angle, prevR);
          const [x2, y2] = polarToCart(angle, r);
          return (
            <line
              key={`hit-${s.id}-${ri}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="transparent"
              strokeWidth={30}
              strokeLinecap="round"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                onSelectSector(s.id as SectorId);
                onSetScore(s.id as SectorId, ri + 1);
              }}
            >
              <title>{`${t(s.label)}: ${t(LEVEL_LABELS[ri + 1])}`}</title>
            </line>
          );
        })
      )}

      {/* Un punto por competencia, solo en su nivel actual */}
      {DIANA_SECTORS.map((s, i) => {
        const val = scores[s.id as SectorId] ?? 0;
        if (val === 0) return null;
        const [cx, cy] = polarToCart(angleForIndex(i), (val / RINGS) * RADIO);
        const c = LEVEL_COLORS[val];
        return (
          <circle
            key={`v-${s.id}`}
            cx={cx} cy={cy}
            r={selectedSector === s.id ? 7 : 5.5}
            fill={c.text}
            stroke="#fff"
            strokeWidth={2.5}
            style={{ pointerEvents: 'none', transition: 'r 0.15s ease' }}
          />
        );
      })}

      {/* Sector labels */}
      {DIANA_SECTORS.map((s, i) => {
        const angle = angleForIndex(i);
        const labelR = RADIO + 32;
        const [lx, ly] = polarToCart(angle, labelR);
        const isSelected = selectedSector === s.id;
        const lineas = lineasEtiqueta(t(s.label));

        // Determine text anchor based on position
        let anchor: 'start' | 'middle' | 'end' = 'middle';
        const cosA = Math.cos(angle);
        if (cosA > 0.2) anchor = 'start';
        else if (cosA < -0.2) anchor = 'end';

        return (
          <g
            key={`label-${s.id}`}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectSector(isSelected ? null : (s.id as SectorId))}
          >
            <text
              x={lx}
              y={ly - 6}
              textAnchor={anchor}
              fontSize={13}
              fill={isSelected ? 'var(--accent-d)' : 'var(--text)'}
              fontWeight={isSelected ? 800 : 600}
              fontFamily="var(--font)"
            >
              {s.icon}
            </text>
            <text
              x={lx}
              y={ly + 9}
              textAnchor={anchor}
              fontSize={10}
              fill={isSelected ? 'var(--accent-d)' : 'var(--text-2)'}
              fontWeight={isSelected ? 800 : 600}
              fontFamily="var(--font)"
            >
              {lineas.map((l, li) => <tspan key={li} x={lx} dy={li === 0 ? 0 : 12}>{l}</tspan>)}
            </text>
            {scores[s.id as SectorId] > 0 && (
              <text
                x={lx}
                y={ly + 21 + (lineas.length - 1) * 12}
                textAnchor={anchor}
                fontSize={10}
                fill="var(--accent-d)"
                fontWeight={800}
                fontFamily="var(--font)"
              >
                {t('Nv.{n}', { n: scores[s.id as SectorId] })}
              </text>
            )}
          </g>
        );
      })}

      <circle cx={CENTER} cy={CENTER} r={2.5} fill="var(--border)" />
    </svg>
  );
}

export function Diana({ classes, students, evaluations, rubrics, dianas, lawDocument, dianaProfiles, onSaveDiana, comunidad }: Props) {
  const { toast } = useToast();
  const { t, lang, locale } = useI18n();
  // Se abre en la clase activa (la de ahora o la última con la que se trabajó): solo queda elegir al alumno
  const [classId, setClassId] = useClaseActiva(classes);
  const [studentId, setStudentId] = useState('');
  const [scores, setScores] = useState<ScoreMap>(emptyScores());
  const [descriptors, setDescriptors] = useState<DescriptorMap>(emptyDescriptors());
  const [selectedSector, setSelectedSector] = useState<SectorId | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  /**
   * La Diana va por evaluación (20-11-2026), con la misma evaluación elegida que el cuaderno y las actas:
   * cuentan las evaluaciones con rúbricas, dianas y escalas de sus fechas, y cada evaluación guarda su
   * propia Diana (`lib/dianaGuardada.ts`). «Curso» es lo de siempre: todo, y la Diana que ya había.
   */
  const ev = useEvaluacionElegida();
  const esCurso = ev.periodo === CURSO_ENTERO;
  const enFrase = t(EN_FRASE[ev.periodo] ?? ev.periodo);
  /** Si lo que se ve tiene cambios que no están guardados. */
  const [sucio, setSucio] = useState(false);
  /** Lo que se dejó a medias en otro alumno u otra evaluación: al volver, sigue ahí en vez de perderse. */
  const [aMedias, setAMedias] = useState<Record<string, { scores: ScoreMap; descriptors: DescriptorMap }>>({});

  // Al cambiar de alumno o de evaluación se enseña su Diana: lo que quedó a medias o, si no, la guardada
  const aLaVista = `${studentId}|${ev.periodo}`;
  const [cargada, setCargada] = useState(aLaVista);
  if (cargada !== aLaVista) {
    if (sucio) setAMedias(prev => ({ ...prev, [cargada]: { scores, descriptors } }));
    const pendiente = aMedias[aLaVista];
    const suya = dianaGuardada(dianaProfiles[studentId], ev.periodo, ev.hoy);
    setCargada(aLaVista);
    setScores(pendiente?.scores ?? (suya ? { ...emptyScores(), ...suya.scores } as ScoreMap : emptyScores()));
    setDescriptors(pendiente?.descriptors ?? (suya ? { ...emptyDescriptors(), ...suya.descriptors } as DescriptorMap : emptyDescriptors()));
    setSucio(!!pendiente);
    setSelectedSector(null);
    setSaved(false);
  }

  const classStudents = useMemo(
    () => students.filter(s => s.class_id === classId),
    [students, classId]
  );

  const student = useMemo(
    () => students.find(s => s.id === studentId) ?? null,
    [students, studentId]
  );

  /** Todas las del alumno en el curso, para decir cuántas quedan fuera de la evaluación elegida. */
  const todasLasSuyas = useMemo(
    () => evaluations.filter(e => e.student_id === studentId),
    [evaluations, studentId]
  );
  /** Las de la evaluación elegida, por su fecha, como en el acta; en «Curso», todas. */
  const studentEvals = useMemo(
    () => todasLasSuyas.filter(e => ev.cuenta(e.date)),
    [todasLasSuyas, ev]
  );

  /**
   * Evaluaciones que traen nota por competencia: las que se hicieron con una
   * rúbrica cuyos criterios llevan competencias LOMLOE asociadas (hoy, solo
   * las que genera una Situación de Aprendizaje). El resto de evaluaciones no
   * aportan nada aquí, aunque sí van de contexto en «Redactar descriptores con IA».
   */
  const competencyEvals = useMemo(
    () => studentEvals.filter(e => e.competencyScores && Object.keys(e.competencyScores).length > 0),
    [studentEvals]
  );

  /**
   * Las competencias específicas del alumno en las asignaturas de la clase con
   * currículo oficial: llegan a los sectores por las competencias clave con
   * las que las conecta el decreto (ver `lib/dianaSectores.ts`).
   */
  const clase = useMemo(() => classes.find(c => c.id === classId) ?? null, [classes, classId]);
  const { materias: notasEspecificas } = useNotasPorCompetencias(clase, comunidad, studentEvals);
  const numFmt = useCallback(
    (n: number) => n.toLocaleString(lang === 'en' ? 'en-GB' : 'es-ES', { maximumFractionDigits: 1 }),
    [lang],
  );
  const porSector = useMemo(
    () => evidenciasPorSector(competencyEvals, notasEspecificas, { numero: numFmt, ce: n => t('CE{n}', { n }) }),
    [competencyEvals, notasEspecificas, numFmt, t],
  );
  /** Las evaluaciones que aportan algo: con competencias clave o con criterios oficiales. */
  const evaluacionesConDatos = useMemo(
    () => studentEvals.filter(e => Object.keys(e.competencyScores ?? {}).length > 0 || Object.keys(e.officialCriteriaScores ?? {}).length > 0).length,
    [studentEvals],
  );
  const hayEvidencias = SECTOR_IDS.some(sid => porSector[sid].length > 0);

  // La Diana del alumno elegido se carga arriba, al pintar: aquí solo se dice quién es
  const handleClassChange = useCallback((id: string) => {
    setClassId(id);
    setStudentId('');
  }, [setClassId]);

  const handleStudentChange = useCallback((id: string) => setStudentId(id), []);

  const handleSetScore = useCallback((sectorId: SectorId, level: number) => {
    setScores(prev => ({ ...prev, [sectorId]: level }));
    setSucio(true);
    setSaved(false);
  }, []);

  const handleReset = useCallback(() => {
    setScores(emptyScores());
    setDescriptors(emptyDescriptors());
    setSelectedSector(null);
    setSucio(true);
    setSaved(false);
  }, []);

  /** Guarda la Diana de la evaluación elegida: las de las demás evaluaciones y la del curso no se tocan. */
  const handleSave = useCallback(() => {
    if (!studentId) return;
    onSaveDiana(studentId, conDianaGuardada(dianaProfiles[studentId], ev.periodo, ev.hoy, { scores, descriptors, updated: isoDate() }));
    setAMedias(prev => {
      if (!(aLaVista in prev)) return prev;
      const n = { ...prev }; delete n[aLaVista]; return n;
    });
    setSucio(false);
    setSaved(true);
    toast(esCurso ? t('✅ Diana guardada') : t('✅ Diana de {evaluacion} guardada', { evaluacion: enFrase }));
    setTimeout(() => setSaved(false), 2000);
  }, [studentId, scores, descriptors, onSaveDiana, dianaProfiles, ev.periodo, ev.hoy, aLaVista, esCurso, enFrase, toast, t]);

  /**
   * La IA redacta, no puntúa (19-11-2026; antes infería un nivel de 1 a 4 en
   * los sectores sin datos, contra la decisión del 3-11-2026 de que la IA no
   * pone notas, y eso es lo que dicen la web, la privacidad y las
   * condiciones). Solo escribe el descriptor de los sectores que ya tienen un
   * nivel calculado de las evaluaciones del docente (el mismo que da
   * `handleFillFromEvaluations`), citando esa evidencia. Los sectores sin
   * datos no se tocan: su nivel y su descriptor los pone el docente.
   */
  const handleAiSuggest = useCallback(async () => {
    if (!student) return;

    const cls = classes.find(c => c.id === classId);
    const sectorLabel = (sid: SectorId) => t(DIANA_SECTORS.find(s => s.id === sid)!.label);

    const bySector = porSector;
    const sectoresConDatos = SECTOR_IDS.filter(sid => nivelDelSector(bySector[sid]) !== null);
    if (sectoresConDatos.length === 0) {
      toast(t('La IA no propone niveles: solo redacta el descriptor de los sectores que ya tienen un nivel calculado de tus evaluaciones, y este alumno aún no tiene ninguno. Marca tú los niveles o evalúa antes con rúbricas o dianas que tengan competencias.'));
      return;
    }

    const objectiveBlock = sectoresConDatos.map(sid => {
      const entries = bySector[sid];
      const avg = entries.reduce((a, e) => a + e.value, 0) / entries.length;
      const detalle = entries.map(e => e.etiqueta).join(', ');
      return lang === 'en'
        ? `- ${sectorLabel(sid)} (${sid}): level already calculated ${avg.toFixed(1)}/4, from: ${detalle}`
        : `- ${sectorLabel(sid)} (${sid}): nivel ya calculado ${avg.toFixed(1)}/4, a partir de: ${detalle}`;
    }).join('\n');

    const evalSummary = studentEvals.length === 0
      ? (lang === 'en' ? 'No previous assessments recorded.' : 'Sin evaluaciones previas registradas.')
      : studentEvals.map(e => {
          const lines = Object.entries(e.scores)
            .map(([k, v]) => (dianas.find(d => d.id === e.rubric_id)?.tipo === 'registro'
              ? `  - ${resolveItemName(e, k, rubrics, dianas)}: ${v === 2 ? (lang === 'en' ? 'done well' : 'bien hecho') : (lang === 'en' ? 'needs improvement' : 'mejorable')}`
              : `  - ${resolveItemName(e, k, rubrics, dianas)}: ${lang === 'en' ? 'level' : 'nivel'} ${v}/4`))
            .join('\n');
          const kind = e.instrument === 'diana' ? (dianas.find(d => d.id === e.rubric_id)?.tipo === 'registro' ? (lang === 'en' ? 'Checklist scale' : 'Escala de registro') : (lang === 'en' ? 'Target' : 'Diana')) : (lang === 'en' ? 'Rubric' : 'Rúbrica');
          return lang === 'en'
            ? `${kind} "${e.rubric_name}" (${e.date}):\n${lines}${e.notes ? `\n  Notes: ${textoLibreParaIA(e.notes)}` : ''}`
            : `${kind} "${e.rubric_name}" (${e.date}):\n${lines}${e.notes ? `\n  Notas: ${textoLibreParaIA(e.notes)}` : ''}`;
        }).join('\n\n');

    const systemPrompt = lang === 'en'
      ? `You are an expert in competency-based education, helping a teacher word the descriptors of a student's Learner Profile. The levels are already calculated from the teacher's own assessments and are listed below: do not propose, change or comment on any level or grade, and do not assess any sector that is not on the list. Only write, for each listed sector, a short descriptor that cites that concrete evidence (name the assessment and the competency code). Reply ONLY with valid JSON, no extra text.`
      : `Eres un experto en educación competencial y ayudas a un docente a redactar los descriptores de la Diana Competencial de un alumno. Los niveles ya están calculados a partir de las evaluaciones del propio docente y se listan más abajo: no propongas, cambies ni comentes ningún nivel ni ninguna nota, y no valores ningún sector que no esté en la lista. Limítate a redactar, para cada sector de la lista, un descriptor breve que cite esa evidencia concreta (nombra la evaluación y el código de competencia). Responde ÚNICAMENTE con JSON válido, sin texto adicional.`;

    const listaSectores = sectoresConDatos.map(sid => `${sectorLabel(sid)} (${sid})`).join(', ');
    const userPrompt = lang === 'en' ? `Student: ${student.name}
Class: ${cls?.name ?? 'N/A'}, ${cls?.subject ?? ''}
Teacher's notes: ${textoLibreParaIA(student.notes || '') || 'None'}
Period: ${esCurso ? 'the whole school year' : `${enFrase} (only the assessments of its dates are listed)`}

Levels already calculated, per sector:
${objectiveBlock}

Assessment history, as context:
${evalSummary}

Write a descriptor, in English, only for these sectors: ${listaSectores}.` : `Alumno: ${student.name}
Clase: ${cls?.name ?? 'N/A'}, ${cls?.subject ?? ''}
Notas del profesor: ${textoLibreParaIA(student.notes || '') || 'Ninguna'}
Periodo: ${esCurso ? 'todo el curso' : `${enFrase} (solo se listan las evaluaciones de sus fechas)`}

Niveles ya calculados, por sector:
${objectiveBlock}

Historial de evaluaciones, como contexto:
${evalSummary}

Redacta un descriptor, en español de España, solo para estos sectores: ${listaSectores}.`;

    // El esquema solo admite descriptores, y solo de los sectores con nivel calculado: la IA no tiene dónde escribir un número
    const responseSchema = {
      type: 'OBJECT',
      properties: {
        descriptors: {
          type: 'OBJECT',
          properties: Object.fromEntries(sectoresConDatos.map(sid => [sid, { type: 'STRING' }])),
          required: sectoresConDatos,
        },
      },
      required: ['descriptors'],
    };

    const files: InlineFile[] = lawDocument ? [lawDocument] : [];

    const raw = await callGemini(systemPrompt, userPrompt, files, {
      onStart: () => setGenerating(true),
      onEnd: () => setGenerating(false),
      onError: msg => toast(msg),
    }, { responseSchema, maxOutputTokens: 4096, thinkingLevel: 'high' });

    if (!raw) return;

    const parsed = parseGeminiJson<{ descriptors: Partial<DescriptorMap> }>(raw);
    if (!parsed?.descriptors) { toast(t('La IA no devolvió unos descriptores válidos. Vuelve a intentarlo.')); return; }

    // El nivel es el calculado, nunca uno de la respuesta; lo que el docente tenía en los demás sectores se queda como estaba
    setScores(prev => {
      const next = { ...prev };
      for (const sid of sectoresConDatos) {
        const nivel = nivelDelSector(bySector[sid]);
        if (nivel !== null) next[sid] = nivel;
      }
      return next;
    });
    setDescriptors(prev => {
      const next = { ...prev };
      for (const sid of sectoresConDatos) {
        const texto = parsed.descriptors[sid];
        if (typeof texto === 'string' && texto.trim()) next[sid] = texto;
      }
      return next;
    });

    setSucio(true);
    setSaved(false);
  }, [student, studentEvals, porSector, dianas, rubrics, classes, classId, lawDocument, toast, lang, t, esCurso, enFrase]);

  /**
   * Rellena desde las evaluaciones con competencias asociadas, en vez de
   * pedírselo a la IA. No es una sugerencia: es la nota que ya salió de
   * evaluar con esas rúbricas, agregada por competencia y llevada al sector
   * que le corresponde (ver `LOMLOE_TO_DIANA` en lib/utils.ts).
   *
   * Solo toca los sectores para los que hay datos: un sector sin ninguna
   * evaluación con competencias no se borra, se deja como estuviera.
   */
  const handleFillFromEvaluations = useCallback(() => {
    if (!hayEvidencias) {
      toast(esCurso
        ? t('Este alumno aún no tiene evaluaciones con competencias clave ni con criterios oficiales. Se generan al evaluar con rúbricas y dianas que los tienen marcados.')
        : t('Este alumno no tiene en {evaluacion} evaluaciones con competencias clave ni con criterios oficiales. Mira en otra evaluación o en «Curso», o evalúa con rúbricas y dianas que los tengan marcados.', { evaluacion: enFrase }));
      return;
    }

    const newScores = { ...scores };
    const newDescriptors = { ...descriptors };
    let filled = 0;

    for (const sid of SECTOR_IDS) {
      const nivel = nivelDelSector(porSector[sid]);
      if (nivel === null) continue;
      filled++;
      newScores[sid] = nivel;
      newDescriptors[sid] = t('Calculado a partir de: {resumen}', { resumen: porSector[sid].map(e => e.etiqueta).join(', ') });
    }

    setScores(newScores);
    setDescriptors(newDescriptors);
    setSucio(true);
    setSaved(false);
    toast(t(evaluacionesConDatos === 1 ? '{n} competencias rellenadas desde 1 evaluación' : '{n} competencias rellenadas desde {m} evaluaciones', { n: filled, m: evaluacionesConDatos }));
  }, [hayEvidencias, porSector, evaluacionesConDatos, scores, descriptors, toast, t, esCurso, enFrase]);

  /** La Diana guardada de la evaluación elegida y, si no la hay, las que el alumno tiene en otras. */
  const guardada = useMemo(() => dianaGuardada(dianaProfiles[studentId], ev.periodo, ev.hoy), [dianaProfiles, studentId, ev.periodo, ev.hoy]);
  const otras = useMemo(() => otrasDianasGuardadas(dianaProfiles[studentId], ev.periodo, ev.hoy), [dianaProfiles, studentId, ev.periodo, ev.hoy]);
  const diaCorto = (f: string) => (f ? fromIsoDate(f).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '');
  const unaSola = studentEvals.length === 1;

  const totalScore = SECTOR_IDS.reduce((acc, id) => acc + (scores[id] ?? 0), 0);
  const maxScore = SECTOR_IDS.length * RINGS;
  const completedSectors = SECTOR_IDS.filter(id => scores[id] > 0).length;

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Diana Competencial')}</h1>
          <p className="pg-sub">{t('Perfil de competencias clave por alumno')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {studentId && (
            <>
              <button
                className="btn-ghost"
                onClick={handleReset}
                style={{ gap: 6 }}
              >
                <RotateCcw size={14} />
                {t('Reiniciar')}
              </button>
              <button
                className="btn-accent"
                onClick={handleSave}
                style={{ gap: 6 }}
              >
                <Save size={14} />
                {t(saved ? 'Guardado ✓' : 'Guardar')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Barra: clase y alumno */}
      <div className="toolbar">
        <select id="diana-clase" className="tb-select" value={classId} aria-label={t('Clase')} onChange={e => handleClassChange(e.target.value)}>
          {classes.length === 0 && <option value="">{t('— Selecciona una clase —')}</option>}
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>
          ))}
        </select>
        <select
          id="diana-alumno" className="tb-select" value={studentId} aria-label={t('Alumno')}
          onChange={e => handleStudentChange(e.target.value)} disabled={!classId}
        >
          <option value="">{t('— Selecciona un alumno —')}</option>
          {classStudents.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <span className="toolbar-sep ev-sel-sep" aria-hidden="true" />
        <SelectorEvaluacion ev={ev} queCuenta={t('La Diana de una evaluación se rellena con las rúbricas, dianas y escalas evaluadas en estas fechas.')} />
      </div>

      {!studentId ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)' }}>
          <Target size={40} color="var(--border-strong)" style={{ margin: '0 auto 12px', display: 'block' }} aria-hidden="true" />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>{t('Selecciona un alumno')}</div>
          <div style={{ fontSize: 13 }}>{t('Elige una clase y un alumno para ver su Diana Competencial')}</div>
        </div>
      ) : (
        // Dos columnas en el ordenador; en el iPhone (vertical y horizontal) y en la tableta, una debajo de otra (`.diana-grid`, 18-11-2026)
        <div className="diana-grid">
          {/* Left: chart + sector buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {/* Student header */}
            <div className="card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: 'var(--accent-l)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 800, fontSize: 15, color: 'var(--accent-d)',
                    flexShrink: 0
                  }}>
                    {student?.photo
                      ? <img src={student.photo} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} />
                      : student?.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                    }
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{student?.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {t('{n}/{total} competencias evaluadas', { n: completedSectors, total: SECTOR_IDS.length })}
                      {completedSectors > 0 && ` · ${t('{n}/{max} pts', { n: totalScore, max: maxScore })}`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                  <button
                    className="btn-ghost"
                    onClick={handleFillFromEvaluations}
                    disabled={generating}
                    title={hayEvidencias
                      ? t('{n} evaluaciones con competencias asociadas', { n: evaluacionesConDatos })
                      : esCurso
                        ? t('Este alumno aún no tiene evaluaciones con competencias clave ni con criterios oficiales. Se generan al evaluar con rúbricas y dianas que los tienen marcados.')
                        : t('Este alumno no tiene en {evaluacion} evaluaciones con competencias clave ni con criterios oficiales. Mira en otra evaluación o en «Curso», o evalúa con rúbricas y dianas que los tengan marcados.', { evaluacion: enFrase })}
                  >
                    <ListChecks size={14} />{t('Rellenar desde evaluaciones')}
                  </button>
                  <button
                    className="btn-ia"
                    onClick={handleAiSuggest}
                    disabled={generating}
                  >
                    {generating ? (
                      <span className="ia-generating">
                        <span className="spin" />
                        {t('Generando...')}
                      </span>
                    ) : (
                      <><Sparkles size={14} />{t('Redactar descriptores con IA')}</>
                    )}
                  </button>
                </div>
              </div>
              {/* De qué evaluación es la Diana que se ve, si está guardada y con qué se puede rellenar */}
              <div className="dn-estado">
                <p className="dn-cual" role="status">
                  <strong>{esCurso ? t('Diana de todo el curso') : t('Diana de {evaluacion}', { evaluacion: enFrase })}</strong>
                  <span className={`dn-marca${sucio ? ' sucio' : ''}`}>
                    {sucio ? t('Con cambios sin guardar') : guardada ? t('Guardada el {fecha}', { fecha: diaCorto(guardada.updated) }) : t('Sin guardar todavía')}
                  </span>
                </p>
                {esCurso ? studentEvals.length > 0 && (
                  <p>{t(unaSola ? '{n} evaluación disponible' : '{n} evaluaciones disponibles', { n: studentEvals.length })} {t('para análisis')}</p>
                ) : studentEvals.length > 0 ? (
                  <p>{t(unaSola ? 'Cuenta 1 evaluación de este alumno hecha en {evaluacion}.' : 'Cuentan {n} evaluaciones de este alumno hechas en {evaluacion}.', { n: studentEvals.length, evaluacion: enFrase })}</p>
                ) : (
                  <p>
                    {t('No hay evaluaciones de este alumno en {evaluacion}.', { evaluacion: enFrase })}
                    {todasLasSuyas.length > 0 && <> {t('En todo el curso tiene {n}.', { n: todasLasSuyas.length })}</>}
                  </p>
                )}
                {!guardada && !sucio && otras.length > 0 && (
                  <p className="dn-otras">
                    {t('Tiene guardada la Diana de:')}
                    {otras.map(o => (
                      <button key={o.periodo} type="button" className="ev-enlace" onClick={() => ev.elegir(o.periodo)}>
                        {t(EN_FRASE[o.periodo] ?? o.periodo)}{o.updated ? ` (${diaCorto(o.updated)})` : ''}
                      </button>
                    ))}
                  </p>
                )}
              </div>
            </div>

            {/* SVG Radar Chart */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16, textAlign: 'center' }}>
                {t('Haz clic sobre un eje, a la altura del nivel que quieras darle')}
              </div>
              <DianaChart
                scores={scores}
                onSetScore={handleSetScore}
                selectedSector={selectedSector}
                onSelectSector={setSelectedSector}
              />

              {/* Level legend */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[1, 2, 3, 4].map(lvl => (
                  <div key={lvl} style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                    background: LEVEL_COLORS[lvl].bg, color: LEVEL_COLORS[lvl].text,
                    padding: '3px 10px', borderRadius: 99, fontWeight: 700,
                    border: `1px solid ${LEVEL_COLORS[lvl].border}`
                  }}>
                    <span style={{ fontWeight: 900 }}>{lvl}</span> {t(LEVEL_LABELS[lvl])}
                  </div>
                ))}
              </div>
            </div>

            {/* Per-sector level buttons */}
            <div className="card">
              <div className="card-hd">
                <div className="card-ttl">{t('Ajuste por competencia')}</div>
                {selectedSector && (
                  <span style={{ fontSize: 12, color: 'var(--accent-d)', fontWeight: 700 }}>
                    {t('Editando: {name}', { name: t(DIANA_SECTORS.find(s => s.id === selectedSector)?.label ?? '') })}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DIANA_SECTORS.map(s => {
                  const sid = s.id as SectorId;
                  const current = scores[sid];
                  const isActive = selectedSector === sid;
                  return (
                    <div
                      key={sid}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                        padding: '10px 12px', borderRadius: 10,
                        background: isActive ? 'var(--accent-l)' : 'var(--surface)',
                        border: `1.5px solid ${isActive ? 'var(--accent-d)' : 'var(--border)'}`,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onClick={() => setSelectedSector(isActive ? null : sid)}
                    >
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
                      <span style={{ flex: '1 1 110px', fontSize: 13, fontWeight: 700, color: 'var(--text)', minWidth: 0 }}>
                        {t(s.label)}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[1, 2, 3, 4].map(lvl => (
                          <button
                            key={lvl}
                            onClick={e => { e.stopPropagation(); handleSetScore(sid, lvl); setSelectedSector(sid); }}
                            style={{
                              width: 30, height: 30, borderRadius: 7, border: 'none',
                              cursor: 'pointer', fontSize: 12, fontWeight: 800,
                              transition: 'all 0.15s',
                              background: current === lvl ? LEVEL_COLORS[lvl].bg : 'var(--card)',
                              color: current === lvl ? LEVEL_COLORS[lvl].text : 'var(--text-3)',
                              boxShadow: current === lvl
                                ? `0 0 0 2px ${LEVEL_COLORS[lvl].border}`
                                : '0 0 0 1px var(--border)',
                            }}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                      {current > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
                          background: LEVEL_COLORS[current].bg, color: LEVEL_COLORS[current].text,
                          border: `1px solid ${LEVEL_COLORS[current].border}`,
                          flexShrink: 0, minWidth: 60, textAlign: 'center',
                        }}>
                          {t(LEVEL_LABELS[current])}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: descriptors panel */}
          <div className="diana-lado">
            <div className="card">
              <div className="card-hd">
                <div className="card-ttl">{t('Descriptores')}</div>
                {Object.values(descriptors).some(d => d) && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'var(--accent-l)', color: 'var(--accent-d)', fontWeight: 700 }}>
                    IA
                  </span>
                )}
              </div>
              {generating ? (
                <div className="ia-generating" style={{ padding: '20px 0', justifyContent: 'center' }}>
                  <span className="spin" />
                  {t('Analizando perfil competencial...')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {DIANA_SECTORS.map(s => {
                    const sid = s.id as SectorId;
                    const desc = descriptors[sid];
                    const score = scores[sid];
                    const isActive = selectedSector === sid;
                    return (
                      <div
                        key={sid}
                        style={{
                          padding: '12px 14px', borderRadius: 10,
                          background: isActive ? 'var(--accent-l)' : desc ? 'var(--surface)' : 'transparent',
                          border: `1.5px solid ${isActive ? 'var(--accent-d)' : 'var(--border)'}`,
                          transition: 'all 0.15s', cursor: 'pointer',
                        }}
                        onClick={() => setSelectedSector(isActive ? null : sid)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: desc ? 8 : 0 }}>
                          <span style={{ fontSize: 15 }}>{s.icon}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)', flex: 1 }}>{t(s.label)}</span>
                          {score > 0 && (
                            <span style={{
                              fontSize: 10, fontWeight: 900, padding: '2px 8px',
                              borderRadius: 99,
                              background: LEVEL_COLORS[score].bg,
                              color: LEVEL_COLORS[score].text,
                              border: `1px solid ${LEVEL_COLORS[score].border}`,
                            }}>
                              {t('Nv.{n}', { n: score })} · {t(LEVEL_LABELS[score])}
                            </span>
                          )}
                        </div>
                        {desc ? (
                          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>{desc}</p>
                        ) : (
                          <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: 0, fontStyle: 'italic' }}>
                            {t('Sin descriptor. Tócalo para escribirlo, o usa «Rellenar desde evaluaciones».')}
                          </p>
                        )}
                        {/* Editable descriptor textarea */}
                        {isActive && (
                          <textarea
                            className="finput"
                            value={desc}
                            placeholder={t('Escribe un descriptor para esta competencia...')}
                            onChange={e => { setDescriptors(prev => ({ ...prev, [sid]: e.target.value })); setSucio(true); }}
                            onClick={e => e.stopPropagation()}
                            rows={3}
                            style={{ marginTop: 8, resize: 'vertical', fontSize: 12.5, lineHeight: 1.5 }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary card */}
            {completedSectors > 0 && (
              <div className="card" style={{ padding: '14px 16px' }}>
                <div className="card-hd" style={{ marginBottom: 10 }}>
                  <div className="card-ttl">{t('Resumen')}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-d)' }}>
                    {totalScore}/{maxScore}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {DIANA_SECTORS.filter(s => scores[s.id as SectorId] > 0).map(s => {
                    const sid = s.id as SectorId;
                    const score = scores[sid];
                    const pct = (score / RINGS) * 100;
                    return (
                      <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, width: 12 }}>{s.icon}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t(s.label)}
                        </span>
                        <div style={{ width: 60, height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: LEVEL_COLORS[score].text }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: LEVEL_COLORS[score].text, width: 14, textAlign: 'center' }}>{score}</span>
                      </div>
                    );
                  })}
                </div>
                {completedSectors < SECTOR_IDS.length && (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
                    {t((SECTOR_IDS.length - completedSectors) === 1 ? '{n} competencia pendiente' : '{n} competencias pendientes', { n: SECTOR_IDS.length - completedSectors })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {studentId && (
        <div style={{ marginTop: 16 }}>
          <CompetenciasEspecificas
            cls={classes.find(c => c.id === classId) ?? null}
            comunidad={comunidad}
            alumno={student?.name ?? ''}
            evaluaciones={studentEvals}
            periodo={esCurso ? undefined : ev.periodo}
            rango={ev.rango}
          />
        </div>
      )}
    </section>
  );
}
