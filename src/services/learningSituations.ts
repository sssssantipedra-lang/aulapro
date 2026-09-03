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
 *
 * **Competencias específicas y saberes básicos, sin inventar** (añadido
 * 2026-09-03): antes se le pedía a la IA que los REDACTASE, y con miles de
 * códigos repartidos en decenas de materias, lo que hacía era aproximarlos —
 * plausibles, pero no el texto real del decreto. Cuando la etapa, el curso y
 * el área encajan con `lib/curriculum` (enseñanzas mínimas estatales, RD
 * 157/2022 y RD 217/2022), la IA ya no redacta esos dos campos: ELIGE de la
 * lista real que se le pasa en el prompt, y el texto final lo pinta esta
 * función desde los datos, no la IA (ver `finalizarArea`). Si el área no
 * tiene un emparejamiento claro —o no se indicó etapa y curso—, sigue
 * funcionando exactamente como antes, en texto libre.
 */

import { callGemini, parseGeminiJson, type InlineFile } from './gemini';
import type { Lang } from '../i18n';
import { LOMLOE_COMPETENCES } from '../lib/utils';
import { resolverGrupo, type CurriculumEntry, type Etapa } from '../lib/curriculum';
import { emparejarMateria } from '../lib/curriculum/mapeoMaterias';

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
  /**
   * Códigos de `LOMLOE_COMPETENCES` que evalúa este criterio (p. ej. ["STEM",
   * "CD"]). Es lo que luego permite que la Diana Competencial tome estas
   * evaluaciones como referencia: ver `competencyScoresFor` en types/index.ts.
   */
  competencias: string[];
}

export interface SdaDianaItem {
  item: string;
  peso: number;
  nivel1: string;
  nivel2: string;
  nivel3: string;
  nivel4: string;
  /** Igual que en `SdaRubricRow.competencias`. */
  competencias: string[];
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
  /**
   * Etapa y curso estructurados, además del texto libre de `nivel`. Sin
   * ellos no hay forma de saber a qué decreto ni a qué grupo de cursos mirar,
   * así que las competencias y saberes de todas las áreas siguen en texto
   * libre, como antes de que existiera `lib/curriculum`.
   */
  etapa?: Etapa;
  curso?: number;
  /**
   * Solo hace falta si `curso` es 4º de la ESO y una de las `areas` empareja
   * con Matemáticas: el RD 217/2022 separa esa materia en dos opciones con
   * criterios y saberes propios a partir de ahí. En cualquier otro caso, se
   * ignora.
   */
  opcionMatematicas?: 'A' | 'B';
  /** Cómo es el grupo: ritmos, apoyos, lo que convenga tener en cuenta. */
  contextoClase: string;
  metodologia: string;
  docente: string;
  /** Resúmenes de los documentos que haya subido (normativa, programación…). */
  documentos: { nombre: string; resumen: string }[];
}

/** Una entrada de `req.areas` que sí encaja con el currículo oficial. */
interface AreaResuelta {
  entry: CurriculumEntry;
  grupo: string;
}

/**
 * Intenta emparejar cada área de la petición con una materia real del
 * currículo, en el orden de `req.areas`. Sin `etapa` y `curso` no hay nada
 * que resolver: todo el array sale a `null`, y cada área se genera en texto
 * libre como siempre.
 */
function resolverAreas(req: SdaRequest): (AreaResuelta | null)[] {
  if (!req.etapa || !req.curso) return req.areas.map(() => null);
  const { etapa, curso, opcionMatematicas } = req;
  return req.areas.map(area => {
    const materia = emparejarMateria(area, etapa);
    return materia ? resolverGrupo(etapa, materia, curso, opcionMatematicas) : null;
  });
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
    // Cuando el prompt trae una lista real de competencias/saberes para esta
    // área (ver `bloqueCurriculoReal`), estos dos campos de texto se ignoran
    // después: el texto final lo pinta la aplicación desde `competencias
    // Seleccionadas`/`saberesSeleccionados`, no lo que se escriba aquí. Por
    // eso siguen siendo obligatorios y de texto libre — para las áreas SIN
    // lista real, que es como ha funcionado esto siempre.
    competenciasEspecificas: S('De 2 a 4, no más'),
    criteriosEvaluacion: S('Criterios de evaluación asociados'),
    saberesBasicos: S('De 2 a 4, no más'),
    // No van en `required`: solo tienen sentido cuando el prompt trae una
    // lista real para esta área. Para el resto, se quedan vacíos sin más —
    // exigirlos forzaría al modelo a inventar números donde no hay ninguna
    // lista de la que elegir.
    competenciasSeleccionadas: {
      type: 'ARRAY',
      description:
        'SOLO si el prompt trae, para esta área, una lista de "Competencias específicas disponibles": ' +
        'de 2 a 4 números de ESA lista, los que mejor encajen con la idea de partida. ' +
        'Si el prompt no trae esa lista para esta área, deja el array vacío.',
      items: { type: 'INTEGER' },
    },
    saberesSeleccionados: {
      type: 'ARRAY',
      description:
        'SOLO si el prompt trae, para esta área, una lista de "Saberes básicos disponibles": ' +
        'de 2 a 4 letras de ESA lista. Si el prompt no trae esa lista para esta área, deja el array vacío.',
      items: { type: 'STRING' },
    },
  },
  required: ['area', 'competenciasEspecificas', 'criteriosEvaluacion', 'saberesBasicos'],
  propertyOrdering: [
    'area', 'competenciasSeleccionadas', 'saberesSeleccionados',
    'competenciasEspecificas', 'criteriosEvaluacion', 'saberesBasicos',
  ],
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

/** Los ocho códigos oficiales, para que Gemini no se invente uno nuevo. */
const LOMLOE_CODES = LOMLOE_COMPETENCES.map(c => c.key);

const RUBRIC_ROW_SCHEMA = {
  type: 'OBJECT',
  properties: {
    criterio: S('Criterio de desempeño, citando la competencia específica'),
    nivel1: S('Descriptor del nivel más bajo'),
    nivel2: S('Descriptor del segundo nivel'),
    nivel3: S('Descriptor del tercer nivel'),
    nivel4: S('Descriptor del nivel más alto'),
    competencias: {
      type: 'ARRAY',
      description: `De 1 a 3 códigos de esta lista cerrada, los que de verdad evalúe este criterio: ${LOMLOE_CODES.join(', ')}.`,
      items: { type: 'STRING', enum: LOMLOE_CODES },
    },
  },
  required: ['criterio', 'nivel1', 'nivel2', 'nivel3', 'nivel4', 'competencias'],
  propertyOrdering: ['criterio', 'competencias', 'nivel1', 'nivel2', 'nivel3', 'nivel4'],
} as const;

const RUBRIC_SCHEMA = {
  type: 'OBJECT',
  properties: {
    rubrica: { type: 'ARRAY', items: RUBRIC_ROW_SCHEMA },
  },
  required: ['rubrica'],
} as const;

const DIANA_ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    item: S('Nombre del ítem, breve (máximo 5 palabras)'),
    peso: { type: 'INTEGER', description: 'Peso relativo en la nota: 1 normalmente, 2 si es claramente más importante' },
    nivel1: S('Descriptor del nivel más bajo'),
    nivel2: S('Descriptor del segundo nivel'),
    nivel3: S('Descriptor del tercer nivel'),
    nivel4: S('Descriptor del nivel más alto'),
    competencias: {
      type: 'ARRAY',
      description: `De 1 a 3 códigos de esta lista cerrada, los que de verdad evalúe este ítem: ${LOMLOE_CODES.join(', ')}.`,
      items: { type: 'STRING', enum: LOMLOE_CODES },
    },
  },
  required: ['item', 'peso', 'nivel1', 'nivel2', 'nivel3', 'nivel4', 'competencias'],
  propertyOrdering: ['item', 'competencias', 'peso', 'nivel1', 'nivel2', 'nivel3', 'nivel4'],
} as const;

const DIANA_SCHEMA = {
  type: 'OBJECT',
  properties: {
    diana: { type: 'ARRAY', items: DIANA_ITEM_SCHEMA },
  },
  required: ['diana'],
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

/* ── Generación de la situación de aprendizaje: currículo real ── */

/**
 * El bloque que se añade al prompt para un área que sí empareja con el
 * currículo: la lista real de competencias y saberes de esa materia y ese
 * grupo de cursos, para que el modelo ELIJA de ahí en vez de redactar. Se
 * dan solo los títulos de los bloques de saberes, no sus ítems completos —
 * decenas por bloque en algunas materias—, que es información de sobra para
 * elegir cuál encaja con la idea de partida.
 */
function bloqueCurriculoReal(area: string, r: AreaResuelta): string {
  const competencias = r.entry.competencias.map(c => `${c.n}. ${c.texto}`).join('\n');
  const saberes = r.entry.saberes[r.grupo].map(b => `${b.bloque}. ${b.tituloBloque}`).join('\n');
  return (
    `\nÁREA "${area}" — CURRÍCULO OFICIAL REAL (enseñanzas mínimas estatales). ` +
    `NO redactes competencias ni saberes por tu cuenta para esta área: ELIGE de estas listas, ` +
    `por su número o letra, en "competenciasSeleccionadas" y "saberesSeleccionados".\n` +
    `Competencias específicas disponibles:\n${competencias}\n` +
    `Saberes básicos disponibles:\n${saberes}\n`
  );
}

/** `SdaArea` tal y como lo devuelve la IA, con los dos campos de selección. */
interface RawSdaArea extends SdaArea {
  competenciasSeleccionadas?: number[];
  saberesSeleccionados?: string[];
}

/**
 * Sustituye, para un área emparejada con el currículo real, lo que haya
 * escrito la IA en `competenciasEspecificas`, `criteriosEvaluacion` y
 * `saberesBasicos` por texto construido aquí a partir de los códigos que
 * ELIGIÓ y de los datos verificados de `lib/curriculum` — nunca a partir de
 * lo que la IA haya escrito en esos tres campos, que se descarta sin mirar.
 *
 * Si los códigos elegidos no encajan con esta área (ninguno válido, o el
 * modelo no eligió ninguno), se deja el texto libre de la IA tal cual: un
 * campo con contenido aproximado es mejor que uno vacío.
 */
function finalizarArea(a: RawSdaArea, r: AreaResuelta | null): SdaArea {
  const { competenciasSeleccionadas, saberesSeleccionados, ...libre } = a;
  if (!r) return libre;

  const competenciasElegidas = r.entry.competencias.filter(
    c => competenciasSeleccionadas?.includes(c.n),
  );
  const saberesElegidos = r.entry.saberes[r.grupo].filter(
    b => saberesSeleccionados?.includes(b.bloque),
  );
  if (competenciasElegidas.length === 0 || saberesElegidos.length === 0) return libre;

  const numerosElegidos = new Set(competenciasElegidas.map(c => c.n));
  const criteriosElegidos = r.entry.criterios[r.grupo].filter(c => numerosElegidos.has(c.competencia));

  return {
    ...libre,
    competenciasEspecificas: competenciasElegidas.map(c => `${c.n}. ${c.texto}`).join('\n'),
    criteriosEvaluacion: criteriosElegidos.map(c => `${c.codigo} ${c.texto}`).join('\n'),
    saberesBasicos: saberesElegidos
      .map(b => {
        const epigrafes = b.epigrafes.filter(e => e.titulo).map(e => e.titulo).join(', ');
        return epigrafes ? `${b.bloque}. ${b.tituloBloque} (${epigrafes})` : `${b.bloque}. ${b.tituloBloque}`;
      })
      .join('\n'),
  };
}

/* ── Generación de la situación de aprendizaje ── */

export async function generateSda(
  req: SdaRequest,
  lang: Lang,
  callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<SdaContent | null> {
  const resoluciones = resolverAreas(req);

  const systemPrompt =
    `Eres un experto en educación y en la legislación educativa LOMLOE, y evalúas con el rigor ` +
    `de un tribunal de oposición. Tu tarea exclusiva es redactar los apartados de una situación ` +
    `de aprendizaje para el grupo de ${req.docente || 'este docente'}.\n` +
    `CONTEXTO: apóyate en los resúmenes de los documentos aportados y en las características del grupo.\n` +
    `CANTIDAD: selecciona como máximo de 2 a 4 competencias específicas y de 2 a 4 saberes básicos ` +
    `POR ÁREA. Lo que se trabaja debe desarrollarse con profundidad; una lista larga y superficial ` +
    `es un error.\n` +
    `ÁREAS: crea una entrada del array "areas" por cada área indicada, y solo por esas.\n` +
    `CURRÍCULO REAL: si el prompt trae, para un área, una lista de "Competencias específicas ` +
    `disponibles" y "Saberes básicos disponibles", esa área tiene currículo oficial verificado — ` +
    `ELIGE de esas listas (por número o letra) en vez de redactar "competenciasEspecificas" o ` +
    `"saberesBasicos" por tu cuenta para esa área: se ignorará lo que escribas ahí y se sustituirá ` +
    `por el texto oficial de lo que elijas. Para las áreas SIN esa lista, sigue como siempre, ` +
    `redactando esos dos campos en texto libre.\n` +
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

  // Una por cada área que sí empareja con el currículo; para las demás, nada.
  const curriculoReal = req.areas
    .map((area, i) => (resoluciones[i] ? bloqueCurriculoReal(area, resoluciones[i]!) : ''))
    .join('');

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
    `Número total de sesiones: ${req.numSesiones}\n` +
    curriculoReal +
    `\nRellena todos los campos del JSON de salida.`;

  const raw = await callGemini(systemPrompt, userPrompt, [], callbacks, {
    // Una SdA entera no cabe en el tope de siempre: se cortaría a media frase
    // y el JSON llegaría roto.
    maxOutputTokens: 16384,
    responseSchema: SDA_SCHEMA,
    thinkingLevel: 'medium',
  });
  if (!raw) return null;

  const parsed = parseGeminiJson<Omit<SdaContent, 'areas'> & { areas?: RawSdaArea[] }>(raw);
  if (!parsed) return null;
  // Un modelo de reserva puede devolver el array vacío o ausente
  const areas = (parsed.areas ?? []).map((a, i) => finalizarArea(a, resoluciones[i] ?? null));
  return { ...parsed, areas, sesiones: parsed.sesiones ?? [] };
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
    `COMPETENCIAS: además, en el campo "competencias" de cada criterio, marca de 1 a 3 códigos de ` +
    `las ocho competencias clave LOMLOE (${LOMLOE_CODES.join(', ')}) que ese criterio evalúa de verdad ` +
    `— las que ya aparecen en las "Competencias específicas por área" de más abajo son buena guía. ` +
    `No es un adorno: con esos códigos se calculará luego la nota de cada competencia.\n` +
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
    thinkingLevel: 'high',
  });
  if (!raw) return null;

  const parsed = parseGeminiJson<{ rubrica: SdaRubricRow[] }>(raw);
  return parsed?.rubrica ?? null;
}

/* ── Diana a partir de la situación de aprendizaje ── */

/**
 * Genera una diana de evaluación en vez de una rúbrica. Mismo origen —la
 * misma SdA— pero pensada para lo observable en el momento (una exposición,
 * un trabajo en grupo), donde una diana rinde mejor que una tabla de
 * criterios: ver `EvalDianas.tsx`, que es donde vive el instrumento.
 */
export async function generateSdaDiana(
  sda: SdaContent,
  detalles: string,
  niveles: string[],
  lang: Lang,
  callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<SdaDianaItem[] | null> {
  const systemPrompt =
    `Eres un experto en evaluación competencial. Tu tarea exclusiva es generar los ítems de ` +
    `una diana de evaluación (un instrumento de observación directa, no una rúbrica de tabla).\n` +
    `Cada ítem DEBE ser observable en el momento: algo que el docente pueda ver y puntuar mientras ` +
    `ocurre, no algo que solo se aprecie corrigiendo en casa.\n` +
    `COMPETENCIAS: además, en el campo "competencias" de cada ítem, marca de 1 a 3 códigos de ` +
    `las ocho competencias clave LOMLOE (${LOMLOE_CODES.join(', ')}) que ese ítem evalúa de verdad ` +
    `— las que ya aparecen en las "Competencias específicas por área" de más abajo son buena guía. ` +
    `No es un adorno: con esos códigos se calculará luego la nota de cada competencia.\n` +
    `PESO: normalmente 1; usa 2 solo si el ítem es claramente más importante que el resto.\n` +
    `Los cuatro niveles, de menor a mayor, se llaman: ${niveles.join(', ')}. Redacta un descriptor ` +
    `observable y distinto para cada uno.\n` +
    `Genera de 4 a 6 ítems, adaptados a las características del grupo.\n` +
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
    `\nGenera de 4 a 6 ítems de diana.`;

  const raw = await callGemini(systemPrompt, userPrompt, [], callbacks, {
    maxOutputTokens: 8192,
    responseSchema: DIANA_SCHEMA,
    thinkingLevel: 'high',
  });
  if (!raw) return null;

  const parsed = parseGeminiJson<{ diana: SdaDianaItem[] }>(raw);
  return parsed?.diana ?? null;
}
