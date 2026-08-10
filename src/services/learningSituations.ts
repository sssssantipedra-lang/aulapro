/**
 * Situaciones de aprendizaje redactadas por la IA.
 *
 * El diseño viene de un generador propio que estaba atado al currículo
 * valenciano de primaria: el esquema traía dentro las áreas concretas (Llengua,
 * Coneixement del Medi) y sus ciclos. Aquí las áreas son una lista abierta que
 * sale de las asignaturas que el docente ya tiene en sus clases, para que la
 * misma pantalla sirva en cualquier etapa y comunidad.
 *
 * Se conservan tal cual las reglas que hacían buena aquella versión: pocas
 * competencias y saberes bien trabajados en vez de una lista interminable, un
 * número exacto de sesiones con sus fases, y una explicación curricular
 * enumerada dirigida al docente, no al alumnado.
 */

import { callGemini, parseGeminiJson, type InlineFile } from './gemini';
import type { Lang } from '../i18n';

/* ── Lo que devuelve la IA ── */

export interface SdaArea {
  /** Nombre del área o asignatura, tal y como la llama el docente. */
  area: string;
  competenciasEspecificas: string;
  criteriosEvaluacion: string;
  saberesBasicos: string;
}

export interface SdaSession {
  fase: string;
  titulo: string;
  descripcion: string;
}

export interface SdaContent {
  titulo: string;
  justificacion: string;
  ods: string;
  objetivosEtapa: string;
  competenciasClave: string;
  /** Justificación de cada elección, dirigida al docente. */
  explicacionCurricular: string;
  areas: SdaArea[];
  /** Medidas de inclusión, de lo universal a lo individualizado. */
  inclusionUniversal: string;
  inclusionAdicional: string;
  inclusionIndividualizada: string;
  sesiones: SdaSession[];
  metodologia: string;
  agrupamiento: string;
  recursos: string;
  productoFinal: string;
  evaluacionTecnicas: string;
  evaluacionInstrumentos: string;
}

export interface SdaRubricRow {
  criterio: string;
  nivel1: string;
  nivel2: string;
  nivel3: string;
  nivel4: string;
}

/* ── Contexto que aporta el docente ── */

export interface SdaRequest {
  /** La idea de partida, en las palabras del docente. */
  idea: string;
  numero: string;
  temporalizacion: string;
  meses: string;
  /** Áreas implicadas: normalmente las asignaturas de la clase elegida. */
  areas: string[];
  numSesiones: number;
  /** Etapa y nivel («5º de Primaria», «3º ESO»), para ajustar el currículo. */
  nivel: string;
  /** Cómo es el grupo: ritmos, apoyos, lo que convenga tener en cuenta. */
  contextoClase: string;
  metodologia: string;
  docente: string;
  /** Resúmenes de los documentos que haya subido (normativa, programación…). */
  documentos: { nombre: string; resumen: string }[];
}

const idioma = (lang: Lang) => (lang === 'en' ? 'INGLÉS' : 'ESPAÑOL');

/* ── Esquemas de salida ── */

const S = (d: string) => ({ type: 'STRING', description: d });

/**
 * Sin `required`, el modelo trata cada campo del esquema como opcional y, con
 * uno tan grande como este (17 campos más dos listas anidadas), tiende a
 * rellenar solo el primero y dar el resto por completado con una cadena
 * vacía: el JSON sale válido —por eso no salta ningún error— pero disperso.
 * Se marca aquí, en cada nivel, qué campos son obligatorios, y también el
 * orden en que deben escribirse (`propertyOrdering`): sin orden explícito el
 * modelo puede escribirlos en cualquiera, y algunos —como las sesiones,
 * mejor las últimas— rinden peor si se piden antes de tener ya decidido todo
 * lo anterior.
 */
const SDA_AREA_SCHEMA = {
  type: 'OBJECT',
  properties: {
    area: S('Nombre del área o asignatura'),
    competenciasEspecificas: S('De 2 a 4, no más'),
    criteriosEvaluacion: S('Criterios de evaluación asociados'),
    saberesBasicos: S('De 2 a 4, no más'),
  },
  required: ['area', 'competenciasEspecificas', 'criteriosEvaluacion', 'saberesBasicos'],
  propertyOrdering: ['area', 'competenciasEspecificas', 'criteriosEvaluacion', 'saberesBasicos'],
} as const;

const SDA_SESSION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    fase: S('Activación, Desarrollo, Consolidación o Producto final'),
    titulo: S('Título corto de la sesión'),
    descripcion: S('Qué se hace, en dos o tres frases'),
  },
  required: ['fase', 'titulo', 'descripcion'],
  propertyOrdering: ['fase', 'titulo', 'descripcion'],
} as const;

const SDA_FIELDS = [
  'titulo', 'justificacion', 'ods', 'objetivosEtapa', 'competenciasClave',
  'explicacionCurricular', 'areas',
  'inclusionUniversal', 'inclusionAdicional', 'inclusionIndividualizada',
  'metodologia', 'agrupamiento', 'recursos', 'productoFinal',
  'evaluacionTecnicas', 'evaluacionInstrumentos',
  'sesiones',
] as const;

const SDA_SCHEMA = {
  type: 'OBJECT',
  properties: {
    titulo: S('Título breve y atractivo de la situación de aprendizaje'),
    justificacion: S('Por qué esta SdA, ligada al contexto del grupo'),
    ods: S('Objetivos de Desarrollo Sostenible relacionados'),
    objetivosEtapa: S('Objetivos de etapa que se trabajan'),
    competenciasClave: S('Competencias clave LOMLOE implicadas, con su abreviatura'),
    explicacionCurricular: S('Lista enumerada que justifica al docente cada elección curricular'),
    areas: { type: 'ARRAY', items: SDA_AREA_SCHEMA },
    inclusionUniversal: S('Medidas para todo el grupo (DUA)'),
    inclusionAdicional: S('Medidas para quien necesite apoyo puntual'),
    inclusionIndividualizada: S('Medidas para necesidades específicas'),
    metodologia: S('Metodologías activas empleadas'),
    agrupamiento: S('Cómo se agrupa al alumnado'),
    recursos: S('Materiales y recursos necesarios'),
    productoFinal: S('Producto o desempeño final'),
    evaluacionTecnicas: S('Técnicas de evaluación'),
    evaluacionInstrumentos: S('Instrumentos de evaluación'),
    // Al final: son la parte más larga, mejor una vez decidido todo lo demás.
    sesiones: { type: 'ARRAY', items: SDA_SESSION_SCHEMA },
  },
  required: SDA_FIELDS,
  propertyOrdering: SDA_FIELDS,
} as const;

const RUBRIC_ROW_SCHEMA = {
  type: 'OBJECT',
  properties: {
    criterio: S('Criterio de desempeño, citando la competencia específica'),
    nivel1: S('Descriptor del nivel más bajo'),
    nivel2: S('Descriptor del segundo nivel'),
    nivel3: S('Descriptor del tercer nivel'),
    nivel4: S('Descriptor del nivel más alto'),
  },
  required: ['criterio', 'nivel1', 'nivel2', 'nivel3', 'nivel4'],
  propertyOrdering: ['criterio', 'nivel1', 'nivel2', 'nivel3', 'nivel4'],
} as const;

const RUBRIC_SCHEMA = {
  type: 'OBJECT',
  properties: {
    rubrica: { type: 'ARRAY', items: RUBRIC_ROW_SCHEMA },
  },
  required: ['rubrica'],
} as const;

/* ── Análisis de documentos de apoyo ── */

/**
 * Resume un documento (normativa, programación, lo que aporte el docente) para
 * que la SdA pueda apoyarse en él sin arrastrar el texto entero en cada
 * petición. Gemini lee los PDF directamente, así que el archivo va tal cual.
 */
export async function analyzeDocument(
  file: InlineFile,
  lang: Lang,
  callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<string | null> {
  const systemPrompt =
    `Eres un experto en educación y pedagogía. Analiza el documento y extrae los elementos ` +
    `(legislativos, metodológicos o curriculares) que sirvan para diseñar una situación de ` +
    `aprendizaje LOMLOE. Devuelve un resumen muy conciso en forma de lista, solo con lo relevante. ` +
    `El idioma de salida DEBE SER ${idioma(lang)}.`;

  return callGemini(systemPrompt, `Analiza este documento: ${file.name}`, [file], callbacks);
}

/* ── Generación de la situación de aprendizaje ── */

export async function generateSda(
  req: SdaRequest,
  lang: Lang,
  callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<SdaContent | null> {
  const systemPrompt =
    `Eres un experto en educación y en la legislación educativa LOMLOE, y evalúas con el rigor ` +
    `de un tribunal de oposición. Tu tarea exclusiva es redactar los apartados de una situación ` +
    `de aprendizaje para el grupo de ${req.docente || 'este docente'}.\n` +
    `CONTEXTO: apóyate en los resúmenes de los documentos aportados y en las características del grupo.\n` +
    `CANTIDAD: selecciona como máximo de 2 a 4 competencias específicas y de 2 a 4 saberes básicos ` +
    `POR ÁREA. Lo que se trabaja debe desarrollarse con profundidad; una lista larga y superficial ` +
    `es un error.\n` +
    `ÁREAS: crea una entrada del array "areas" por cada área indicada, y solo por esas.\n` +
    `EXPLICACIÓN CURRICULAR: el campo "explicacionCurricular" se dirige EXCLUSIVAMENTE AL DOCENTE ` +
    `y debe ser una lista enumerada que justifique cada elemento elegido.\n` +
    `SESIONES: crea EXACTAMENTE ${req.numSesiones} sesiones en "sesiones", ni una más ni una menos. ` +
    `Deben aparecer al menos las fases Activación, Desarrollo, Consolidación y Producto final.\n` +
    `NIVEL: ajusta el currículo, el vocabulario y la exigencia a ${req.nivel || 'el nivel indicado'}.\n` +
    `FORMATO: todo muy resumido, claro y directo, en frases cortas o listas.\n` +
    `El idioma de salida DEBE SER ${idioma(lang)}.`;

  const docs = req.documentos.length
    ? 'DOCUMENTOS APORTADOS:\n' + req.documentos.map(d => `- ${d.nombre}:\n${d.resumen}`).join('\n\n') + '\n\n'
    : '';

  const userPrompt =
    `Docente: ${req.docente}\n` +
    `Nivel: ${req.nivel}\n` +
    `Características del grupo: ${req.contextoClase || '(sin indicar)'}\n` +
    `Metodología habitual: ${req.metodologia || '(sin indicar)'}\n\n` +
    docs +
    `Idea de partida: "${req.idea}"\n` +
    `Nº de la situación de aprendizaje: ${req.numero}\n` +
    `Temporalización: ${req.temporalizacion}\n` +
    `Meses: ${req.meses}\n` +
    `Áreas implicadas: ${req.areas.join(', ')}\n` +
    `Número total de sesiones: ${req.numSesiones}\n\n` +
    `Rellena todos los campos del JSON de salida.`;

  const raw = await callGemini(systemPrompt, userPrompt, [], callbacks, {
    // Una SdA entera no cabe en el tope de siempre: se cortaría a media frase
    // y el JSON llegaría roto.
    maxOutputTokens: 16384,
    responseSchema: SDA_SCHEMA,
  });
  if (!raw) return null;

  const parsed = parseGeminiJson<SdaContent>(raw);
  if (!parsed) return null;
  // Un modelo de reserva puede devolver el array vacío o ausente
  return { ...parsed, areas: parsed.areas ?? [], sesiones: parsed.sesiones ?? [] };
}

/* ── Rúbrica a partir de la situación de aprendizaje ── */

export async function generateSdaRubric(
  sda: SdaContent,
  detalles: string,
  niveles: string[],
  lang: Lang,
  callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<SdaRubricRow[] | null> {
  const systemPrompt =
    `Eres un experto en evaluación competencial. Tu tarea exclusiva es generar los criterios de ` +
    `una rúbrica de desempeño.\n` +
    `Cada criterio DEBE mencionar explícitamente la competencia específica que evalúa.\n` +
    `Los cuatro niveles, de menor a mayor, se llaman: ${niveles.join(', ')}. Redacta un descriptor ` +
    `observable y distinto para cada uno.\n` +
    `Genera de 3 a 5 criterios, adaptados a las características del grupo.\n` +
    `El idioma de salida DEBE SER ${idioma(lang)}.`;

  const areas = sda.areas
    .map(a => `- ${a.area}: ${a.competenciasEspecificas}`)
    .join('\n');

  const userPrompt =
    `Situación de aprendizaje: ${sda.titulo}\n` +
    `Justificación: ${sda.justificacion}\n` +
    `Competencias específicas por área:\n${areas}\n` +
    `Producto final: ${sda.productoFinal}\n` +
    `Técnicas de evaluación: ${sda.evaluacionTecnicas}\n` +
    `Instrumentos: ${sda.evaluacionInstrumentos}\n` +
    (detalles ? `Además, valora especialmente: "${detalles}"\n` : '') +
    `\nGenera de 3 a 5 criterios de rúbrica.`;

  const raw = await callGemini(systemPrompt, userPrompt, [], callbacks, {
    maxOutputTokens: 8192,
    responseSchema: RUBRIC_SCHEMA,
  });
  if (!raw) return null;

  const parsed = parseGeminiJson<{ rubrica: SdaRubricRow[] }>(raw);
  return parsed?.rubrica ?? null;
}
