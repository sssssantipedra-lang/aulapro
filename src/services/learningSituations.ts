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
 * el área encajan con `lib/curriculum` (el decreto de la comunidad del docente
 * o, mientras no lo tengamos, las enseñanzas mínimas estatales, RD 157/2022 y
 * RD 217/2022), la IA ya no redacta esos dos campos: ELIGE de la
 * lista real que se le pasa en el prompt, y el texto final lo pinta esta
 * función desde los datos, no la IA (ver `finalizarArea`). Si el área no
 * tiene un emparejamiento claro —o no se indicó etapa y curso—, sigue
 * funcionando exactamente como antes, en texto libre.
 */

import { callGemini, parseGeminiJson, type InlineFile } from './gemini';
import type { Lang } from '../i18n';
import { LOMLOE_COMPETENCES } from '../lib/utils';
import { competenciasDe, resolverGrupo, type CurriculumBloqueSaberes, type CurriculumEntry, type Etapa } from '../lib/curriculum';
import { estadoDeMateria } from '../lib/curriculum/materiasDeClase';
import { cargarCurriculo, type CurriculoActivo } from '../lib/curriculum/cargar';
import { citarNormas, type ComunidadId } from '../lib/curriculum/comunidades';
import { IDS_MODELOS_EF, modeloEF, modelosParaIA, referenciasDeModelos } from '../lib/modelosEF';
import { IDS_MODALIDADES, MODALIDADES_EF, NIVELES_PARA_IA } from '../lib/ef';
import type { ModalidadEF } from '../types/ef';
import type { OfficialCriterionRef } from '../types';

/* ── Lo que devuelve la IA ── */

export interface SdaArea {
  /** Nombre del área o asignatura, tal y como la llama el docente. */
  area: string;
  competenciasEspecificas: string;
  criteriosEvaluacion: string;
  saberesBasicos: string;
  /**
   * `true` cuando las competencias, los criterios y los saberes son el texto
   * literal del decreto (la IA eligió de la lista oficial y la app escribió
   * el texto). Sin él, los redactó la IA. Las SdA anteriores no lo llevan.
   */
  oficial?: boolean;
  /**
   * Con `oficial`, la materia del currículo de la que sale (`CurriculumEntry.id`).
   * Con ella, las rúbricas y dianas que se hagan desde la SdA llevan ya
   * marcados los criterios oficiales que evalúan (`refsDeSda`).
   */
  materia?: string;
}

/** Una actividad real de una sesión de EF: un juego o una tarea con nombre, explicada paso a paso. */
export interface ActividadSesionEF {
  nombre: string;
  minutos: number;
  /** Cómo se hace: reglas, puntuación, progresión. */
  descripcion: string;
  /** Grupos, espacio y roles. */
  organizacion: string;
  material: string;
}

/** Uno de los tres momentos de una sesión: lo que se hace en él y sus actividades. */
export interface MomentoSesionEF {
  texto: string;
  actividades: ActividadSesionEF[];
}

/**
 * Una sesión de EF explicada en los tres momentos de Mosston (decisión del
 * dueño, 18-10-2026: «que proponga actividades reales siguiendo el preimpacto,
 * impacto y postimpacto»): antes de la práctica principal, durante ella y
 * después. Ver `docs/EF.md`.
 */
export interface MomentosSesionEF {
  preimpacto: MomentoSesionEF;
  impacto: MomentoSesionEF;
  postimpacto: MomentoSesionEF;
}

export interface SdaSession {
  fase: string;
  titulo: string;
  /** En las de EF con momentos, un resumen de la sesión; el detalle está en `momentos`. */
  descripcion: string;
  /** Solo en las SdA de EF hechas desde la 2.11.0. Las anteriores siguen con su `descripcion`. */
  momentos?: MomentosSesionEF;
  /** Si ya se dio en clase: sirve para saber por dónde vas (decisión del dueño, 18-10-2026). */
  completada?: boolean;
}

/**
 * El currículo del que salen las competencias y saberes de la SdA. Lo pone la
 * aplicación, nunca la IA, y se guarda con la SdA: cambiar de comunidad en el
 * perfil no reescribe lo que ya se hizo con otro decreto.
 */
export interface SdaNormativa {
  comunidad: ComunidadId;
  /** `estatal` si la comunidad aún no tiene su decreto en AulaPro (o es «Fuera de España»). */
  origen: 'autonomico' | 'estatal';
  /** La cita, en el idioma de la app al generarla: «Decreto 61/2022, de 13 de julio (BOCM núm. 169…)». */
  cita: string;
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
  /** Ausente si ninguna área usó currículo oficial, y en las SdA anteriores a esto. */
  normativa?: SdaNormativa;
  /**
   * Solo en las SdA de Educación Física (ver `docs/EF.md`): los modelos
   * pedagógicos con los que se diseñó (ids de `lib/modelosEF`) y sus
   * referencias. Las referencias las pone la aplicación, nunca la IA.
   */
  ef?: SdaEF;
}

export interface SdaEF {
  modelos: string[];
  referencias: string[];
  /** La modalidad del juego o deporte que trabaja, si es uno. */
  modalidad?: ModalidadEF;
  /**
   * Con varios deportes o juegos (de 2 a 6), cuáles son y en qué orden se trabajan: uno detrás de otro, nunca
   * mezclados sesión a sesión. Con uno solo, no se guarda.
   */
  secuencia?: string[];
}

/** Lo propio de Educación Física que se añade a la petición. */
export interface SdaPeticionEF {
  /** El id del modelo que eligió el docente; vacío, lo elige la IA. */
  modelo: string;
  /** La modalidad que eligió el docente; vacía, la decide la IA si la idea es un juego o un deporte. */
  modalidad?: ModalidadEF | '';
  /** El material disponible, ya en texto (ver `recursosParaIA`). */
  material: string;
  instalaciones: string;
  /** Lo que no puede hacer quien está exento o lesionado: una línea por alumno, sin nombre ni motivo. */
  limitaciones: string[];
  /** Lo que dura cada sesión, en minutos (50 si no se dice). */
  minutos?: number;
}

/** Lo que dura una sesión de EF si el docente no lo dice. */
export const MINUTOS_SESION_EF = 50;

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
  /**
   * Criterios de evaluación oficiales que evalúa, como «Área|código», elegidos
   * por la IA de los de la SdA. Se comprueban con `refsDeSda` antes de usarse.
   */
  criteriosOficiales?: string[];
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
  /** Igual que en `SdaRubricRow.criteriosOficiales`. */
  criteriosOficiales?: string[];
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
  /**
   * Comunidad del docente: decide de qué decreto salen las competencias y
   * saberes. Sin ella (o sin decreto propio todavía) se usa el estatal.
   */
  comunidad?: ComunidadId;
  /**
   * La materia oficial elegida para cada área, por el nombre que le da el
   * docente; `null` la deja en modo libre. Lo que no está aquí se empareja
   * por alias, y si no hay alias seguro queda en modo libre.
   */
  materiasOficiales?: Record<string, string | null>;
  /** Cómo es el grupo: ritmos, apoyos, lo que convenga tener en cuenta. */
  contextoClase: string;
  metodologia: string;
  /** Resúmenes de los documentos que haya subido (normativa, programación…). */
  documentos: { nombre: string; resumen: string }[];
  /** Solo si es una SdA de Educación Física. */
  ef?: SdaPeticionEF;
}

/**
 * Lo que se añade a las instrucciones en una SdA de Educación Física: el
 * modelo pedagógico, el DUA-A, la evaluación formativa y compartida, y que no
 * se cite nada que no esté en la lista (las referencias las pone la app).
 */
function instruccionesEF(ef: SdaPeticionEF): string {
  const elegido = modeloEF(ef.modelo);
  return (
    `\nEDUCACIÓN FÍSICA: esta SdA es de Educación Física y se diseña con modelos pedagógicos de EF ` +
    `(práctica basada en modelos). ` +
    (elegido
      ? `El docente ha elegido el modelo "${elegido.id}" (${elegido.nombre}): úsalo y pon solo ese id en "modelosPedagogicos".`
      : `Elige el modelo, o la hibridación de dos, que mejor encaje con la idea, y pon su id en "modelosPedagogicos" (1 o 2).`) +
    `\nModelos disponibles:\n${modelosParaIA()}\n` +
    `- Modalidad de juegos y deportes: ` +
    (ef.modalidad
      ? `el docente ha elegido "${ef.modalidad}"; pon ese id en "modalidadDeportiva". `
      : `si la idea trabaja un juego o un deporte, pon su modalidad en "modalidadDeportiva"; si no, "ninguna". `) +
    `Trabaja el juego o deporte según la lógica de su modalidad y prepáralo como ella pide (calentamiento específico, ` +
    `progresión y seguridad):\n${MODALIDADES_EF.map(m => `  - ${m.id}: ${m.label}. Lógica: ${m.logica} Preparación: ${m.preparacion}`).join('\n')}\n` +
    `- SECUENCIA CON LÓGICA (varios deportes o juegos): si la idea trabaja más de un deporte, juego o contenido (por ` +
    `ejemplo «baloncesto y balonmano», «un deporte de red y otro de invasión»), decide primero en "secuenciaDeportes" ` +
    `cuáles son y en qué orden. Se trabajan UNO DETRÁS DE OTRO, en bloques de sesiones seguidas: primero todas las ` +
    `sesiones del primero, completas y de menos a más (iniciación, práctica y aplicación en juego), y solo después las ` +
    `del segundo, y así. Nunca alternes deportes sesión a sesión ni mezcles dos en la misma sesión (salvo en el producto ` +
    `final). Si la idea ya da un orden, respétalo; si no, ordénalos de lo que prepara a lo que exige más (por ejemplo, ` +
    `las habilidades y reglas que el siguiente aprovecha). Reparte las sesiones a partes iguales entre ellos y deja la ` +
    `última sesión, o las dos últimas, para el producto final, que puede reunir a todos. El título de cada sesión empieza ` +
    `por el deporte de su bloque («Baloncesto: el pase y el desmarque»). Si solo se trabaja uno, "secuenciaDeportes" ` +
    `lleva un único elemento y las sesiones avanzan de menos a más como siempre.\n` +
    `- La metodología, el agrupamiento y cada sesión aplican de verdad el modelo (sus roles, grupos, fases y momentos de reflexión).\n` +
    `- Cada sesión de EF se explica en los tres momentos de la enseñanza (Mosston y Ashworth): PREIMPACTO (antes de la ` +
    `práctica principal: el objetivo, la organización del espacio, del material y de los grupos, las normas de seguridad, ` +
    `cómo se presenta la tarea, y la activación o calentamiento específico), IMPACTO (durante: las tareas principales, ` +
    `de lo fácil a lo difícil, cómo se organiza y qué decide el alumnado, el feedback del docente mientras tanto y las ` +
    `adaptaciones para que participe todo el grupo) y POSTIMPACTO (después: la vuelta a la calma, la puesta en común con ` +
    `preguntas concretas, la autoevaluación o coevaluación con su instrumento y el cierre).\n` +
    `- ACTIVIDADES REALES, no generalidades: en cada momento, de 1 a 3 actividades con nombre (un juego o una tarea que ` +
    `exista: «el pañuelo», «pilla-pilla de cadenas», «béisbol con la mano», «pase y desmarque 3 contra 1», «circuito de ` +
    `equilibrios»…), explicadas de modo que el docente pueda hacerlas mañana: cómo se juega, las reglas, cómo se puntúa o ` +
    `se gana, cuántos en cada grupo, el espacio, el material y cuánto y cómo se complica. Prohibido escribir «se realizará ` +
    `un juego de calentamiento» o «se practicarán los pases»: di CUÁL y CÓMO. Cada sesión es distinta de las demás y avanza ` +
    `respecto a la anterior (nada de repetir la misma actividad), y sus minutos suman la duración de la sesión ` +
    `(preimpacto de 10 a 15, impacto la mayor parte, postimpacto de 5 a 10 con la recogida).\n` +
    `- En "descripcion" de la sesión, un resumen de dos frases; el detalle va en "preimpacto", "impacto" y "postimpacto".\n` +
    `- El producto final es un desempeño motor (un festival, el evento final de una liga, una ruta de orientación, una ` +
    `coreografía, un juego inventado y enseñado a otro grupo).\n` +
    `- Inclusión según el DUA-A (Diseño Universal para el Aprendizaje y la Accesibilidad): quien tiene una limitación ` +
    `participa en las mismas tareas con cambios de reglas, espacio, material, tiempo o papel; una tarea aparte es el ` +
    `último recurso. ${NIVELES_PARA_IA}\n` +
    `- Evaluación formativa y compartida (López-Pastor y Pérez-Pueyo): autoevaluación, coevaluación y evaluación ` +
    `compartida, con instrumentos concretos (rúbricas, listas de control, escalas, cuaderno del alumnado).\n` +
    `- No cites autores, estudios ni referencias que no aparezcan en estas instrucciones, y no inventes ninguna: ` +
    `la aplicación añade las referencias del modelo.\n`
  );
}

/** Lo que dura cada sesión de EF, en minutos enteros y con sentido (de 20 a 120). */
export function minutosDeSesion(ef: Pick<SdaPeticionEF, 'minutos'>): number {
  const m = Math.round(ef.minutos ?? MINUTOS_SESION_EF);
  return Number.isFinite(m) && m >= 20 && m <= 120 ? m : MINUTOS_SESION_EF;
}

/** Los datos de EF para el prompt del usuario. */
function datosEF(ef: SdaPeticionEF): string {
  return (
    (ef.material ? `Material disponible: ${ef.material}\n` : '') +
    (ef.instalaciones ? `Instalaciones: ${ef.instalaciones}\n` : '') +
    `Duración de cada sesión: ${minutosDeSesion(ef)} minutos\n` +
    (ef.limitaciones.length
      ? `Alumnado con alguna limitación ahora o con medidas de nivel II o III (una línea por alumno, sin nombres): en ` +
        `"inclusionIndividualizada", una medida para cada uno, según su nivel:\n${ef.limitaciones.map(l => `- ${l}`).join('\n')}\n`
      : '')
  );
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
function resolverAreas(req: SdaRequest, curriculo: CurriculoActivo | null): (AreaResuelta | null)[] {
  if (!req.etapa || !req.curso || !curriculo) return req.areas.map(() => null);
  const { etapa, curso, opcionMatematicas } = req;
  return req.areas.map(area => {
    const estado = estadoDeMateria(
      area, { etapa, curso, opcionMatematicas, materiasOficiales: req.materiasOficiales }, curriculo.materias,
    );
    return estado.tipo === 'oficial'
      ? resolverGrupo(etapa, estado.materia, curso, opcionMatematicas, curriculo.materias)
      : null;
  });
}

const idioma = (lang: Lang) => (lang === 'en' ? 'INGLÉS' : lang === 'ca' ? 'CATALÁN (català)' : 'ESPAÑOL');

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
    descripcion: S(
      'De 5 a 8 frases que desarrollen la sesión de principio a fin, no un resumen de una línea: ' +
      'qué hace el docente, qué hace el alumnado (individual, en parejas o en grupo), con qué ' +
      'materiales o recursos concretos, y cómo se cierra o se comprueba lo trabajado. Nada de ' +
      'generalidades — algo que el docente pueda seguir en clase sin tener que improvisar el resto.',
    ),
  },
  required: ['fase', 'titulo', 'descripcion'],
  propertyOrdering: ['fase', 'titulo', 'descripcion'],
} as const;

const ACTIVIDAD_EF_SCHEMA = {
  type: 'OBJECT',
  properties: {
    nombre: S('Nombre de la actividad real: un juego o una tarea conocida o con nombre propio'),
    minutos: { type: 'NUMBER', description: 'Minutos que dura' },
    descripcion: S('Cómo se hace, paso a paso, en 3 a 5 frases: reglas, cómo se puntúa o se gana, y cómo progresa o se complica'),
    organizacion: S('Cuántos en cada grupo, en qué espacio y con qué papeles'),
    material: S('Material concreto y cuánto; «ninguno» si no hace falta'),
  },
  required: ['nombre', 'minutos', 'descripcion', 'organizacion', 'material'],
  propertyOrdering: ['nombre', 'minutos', 'descripcion', 'organizacion', 'material'],
} as const;

const MOMENTO_EF_SCHEMA = (que: string) => ({
  type: 'OBJECT',
  properties: {
    texto: S(que),
    actividades: { type: 'ARRAY', items: ACTIVIDAD_EF_SCHEMA },
  },
  required: ['texto', 'actividades'],
  propertyOrdering: ['texto', 'actividades'],
}) as const;

/** La sesión de EF: un resumen y los tres momentos, cada uno con actividades reales. */
const SDA_SESSION_SCHEMA_EF = {
  type: 'OBJECT',
  properties: {
    fase: S('Activación, Desarrollo, Consolidación o Producto final'),
    titulo: S('Título corto de la sesión'),
    descripcion: S('Resumen de la sesión en 2 frases: qué se trabaja y qué se consigue'),
    preimpacto: MOMENTO_EF_SCHEMA('Antes de la práctica principal: el objetivo de la sesión, cómo se organiza el espacio, el material y los grupos, las normas de seguridad y cómo se presenta la tarea (demostración, reto o ejemplo), en 2 a 4 frases'),
    impacto: MOMENTO_EF_SCHEMA('Durante la práctica: cómo se organiza el alumnado, qué decide, qué feedback da el docente mientras tanto y cómo se adapta para que participe todo el grupo (DUA-A), en 2 a 4 frases'),
    postimpacto: MOMENTO_EF_SCHEMA('Después de la práctica: el feedback y la evaluación (preguntas concretas de la puesta en común, autoevaluación o coevaluación con su instrumento) y el cierre, en 2 a 4 frases'),
  },
  required: ['fase', 'titulo', 'descripcion', 'preimpacto', 'impacto', 'postimpacto'],
  propertyOrdering: ['fase', 'titulo', 'descripcion', 'preimpacto', 'impacto', 'postimpacto'],
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
    explicacionCurricular: S('Lista enumerada que justifica al docente cada elección curricular, un punto por línea'),
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

/** El mismo esquema con los modelos pedagógicos de EF, lo primero: el resto se escribe ya con el modelo decidido. */
const SDA_SCHEMA_EF = {
  ...SDA_SCHEMA,
  properties: {
    ...SDA_SCHEMA.properties,
    sesiones: { type: 'ARRAY', items: SDA_SESSION_SCHEMA_EF },
    modelosPedagogicos: {
      type: 'ARRAY',
      description: 'De 1 a 2 identificadores de modelos pedagógicos de EF de la lista cerrada.',
      items: { type: 'STRING', enum: IDS_MODELOS_EF },
    },
    modalidadDeportiva: {
      type: 'STRING',
      description: 'La modalidad del juego o deporte que trabaja la SdA, o "ninguna".',
      enum: [...IDS_MODALIDADES, 'ninguna'],
    },
    // Antes que las sesiones: la IA decide el orden primero y después reparte las sesiones por bloques
    secuenciaDeportes: {
      type: 'ARRAY',
      description: 'Los deportes o juegos concretos que se trabajan, en el orden en que se trabajan, uno detrás de otro (un solo elemento si es uno).',
      items: { type: 'STRING' },
    },
  },
  required: ['modelosPedagogicos', 'modalidadDeportiva', 'secuenciaDeportes', ...SDA_FIELDS],
  propertyOrdering: ['modelosPedagogicos', 'modalidadDeportiva', 'secuenciaDeportes', ...SDA_FIELDS],
};

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

/**
 * El esquema de una fila de rúbrica o de un ítem de diana, con el campo de los
 * criterios oficiales cerrado a los de la SdA. Sin criterios oficiales, el
 * esquema de siempre.
 */
function conCriteriosOficiales<T extends { properties: object; required: readonly string[] }>(
  esquema: T, disponibles: string[],
): T {
  if (disponibles.length === 0) return esquema;
  return {
    ...esquema,
    properties: {
      ...esquema.properties,
      criteriosOficiales: {
        type: 'ARRAY',
        description: 'De 1 a 3 criterios de evaluación oficiales de la lista cerrada que de verdad evalúe, tal cual («Área|código»).',
        items: { type: 'STRING', enum: disponibles },
      },
    },
    required: [...esquema.required, 'criteriosOficiales'],
  };
}

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
 * El título de un bloque de saberes. Alguno no lo tiene en el decreto
 * (Filosofía en la Comunitat Valenciana: «Bloque 1:» sin más); entonces, su
 * primer saber, para que se sepa de qué trata.
 */
function tituloDeBloque(b: CurriculumBloqueSaberes): string {
  return b.tituloBloque || `${b.epigrafes[0]?.items[0] ?? ''}…`;
}

/**
 * El bloque que se añade al prompt para un área que sí empareja con el
 * currículo: la lista real de competencias y saberes de esa materia y ese
 * grupo de cursos, para que el modelo ELIJA de ahí en vez de redactar. Se
 * dan solo los títulos de los bloques de saberes, no sus ítems completos —
 * decenas por bloque en algunas materias—, que es información de sobra para
 * elegir cuál encaja con la idea de partida.
 */
function bloqueCurriculoReal(area: string, r: AreaResuelta, cita: string): string {
  const competencias = competenciasDe(r.entry, r.grupo).map(c => `${c.n}. ${c.texto}`).join('\n');
  const saberes = r.entry.saberes[r.grupo].map(b => `${b.bloque}. ${tituloDeBloque(b)}`).join('\n');
  return (
    `\nÁREA "${area}" — CURRÍCULO OFICIAL REAL (${cita}). ` +
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
 * campo con contenido aproximado es mejor que uno vacío. `oficial` dice si
 * al final el texto es el del decreto, que es lo que permite citarlo.
 */
function finalizarArea(a: RawSdaArea, r: AreaResuelta | null): { area: SdaArea; oficial: boolean } {
  const { competenciasSeleccionadas, saberesSeleccionados, ...libre } = a;
  if (!r) return { area: libre, oficial: false };

  const competenciasElegidas = competenciasDe(r.entry, r.grupo).filter(
    c => competenciasSeleccionadas?.includes(c.n),
  );
  const saberesElegidos = r.entry.saberes[r.grupo].filter(
    b => saberesSeleccionados?.includes(b.bloque),
  );
  if (competenciasElegidas.length === 0 || saberesElegidos.length === 0) return { area: libre, oficial: false };

  const numerosElegidos = new Set(competenciasElegidas.map(c => c.n));
  const criteriosElegidos = r.entry.criterios[r.grupo].filter(c => numerosElegidos.has(c.competencia));

  return {
    oficial: true,
    area: {
      ...libre,
      materia: r.entry.id,
      competenciasEspecificas: competenciasElegidas.map(c => `${c.n}. ${c.texto}`).join('\n'),
      criteriosEvaluacion: criteriosElegidos.map(c => `${c.codigo} ${c.texto}`).join('\n'),
      saberesBasicos: saberesElegidos
        .map(b => {
          const epigrafes = b.epigrafes.filter(e => e.titulo).map(e => e.titulo).join(', ');
          return epigrafes ? `${b.bloque}. ${tituloDeBloque(b)} (${epigrafes})` : `${b.bloque}. ${tituloDeBloque(b)}`;
        })
        .join('\n'),
    },
  };
}

/* ── Generación de la situación de aprendizaje ── */

export async function generateSda(
  req: SdaRequest,
  lang: Lang,
  callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<SdaContent | null> {
  // El currículo de la comunidad si lo hay y, si no, el estatal: `cargarCurriculo`
  // nunca falla, y lo que devuelve dice de dónde sale para poder citarlo.
  const curriculo = req.etapa ? await cargarCurriculo(req.comunidad ?? 'fuera', req.etapa, lang) : null;
  const resoluciones = resolverAreas(req, curriculo);
  const cita = curriculo ? citarNormas(curriculo.normas, lang) : '';

  const systemPrompt =
    `Eres un experto en educación y en la legislación educativa LOMLOE, y evalúas con el rigor ` +
    `de un tribunal de oposición. Tu tarea exclusiva es redactar los apartados de una situación ` +
    `de aprendizaje para un grupo concreto de alumnado.\n` +
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
    `y debe ser una lista enumerada que justifique cada elemento elegido, un punto por línea.\n` +
    `SESIONES: crea EXACTAMENTE ${req.numSesiones} sesiones en "sesiones", ni una más ni una menos. ` +
    `Deben aparecer al menos las fases Activación, Desarrollo, Consolidación y Producto final. ` +
    `Cada "descripcion" desarrolla la sesión de principio a fin —qué hace el docente, qué hace el ` +
    `alumnado, con qué recursos, cómo se cierra—, no un titular de una frase.\n` +
    `NIVEL: ajusta el currículo, el vocabulario y la exigencia a ${req.nivel || 'el nivel indicado'}.\n` +
    `FORMATO: todo muy resumido, claro y directo, en frases cortas o listas.\n` +
    (req.ef ? instruccionesEF(req.ef) : '') +
    `El idioma de salida DEBE SER ${idioma(lang)}.`;

  const docs = req.documentos.length
    ? 'DOCUMENTOS APORTADOS:\n' + req.documentos.map(d => `- ${d.nombre}:\n${d.resumen}`).join('\n\n') + '\n\n'
    : '';

  // Una por cada área que sí empareja con el currículo; para las demás, nada.
  const curriculoReal = req.areas
    .map((area, i) => (resoluciones[i] ? bloqueCurriculoReal(area, resoluciones[i]!, cita) : ''))
    .join('');

  const userPrompt =
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
    (req.ef ? datosEF(req.ef) : '') +
    curriculoReal +
    `\nRellena todos los campos del JSON de salida.`;

  const raw = await callGemini(systemPrompt, userPrompt, [], callbacks, {
    // Una SdA entera no cabe en el tope de siempre: se cortaría a media frase
    // y el JSON llegaría roto. Con sesiones más desarrolladas (de 5 a 8
    // frases cada una, no 2 o 3) hace falta más margen que antes, sobre todo
    // con muchas sesiones pedidas.
    maxOutputTokens: req.ef ? 32768 : 24576,
    responseSchema: req.ef ? SDA_SCHEMA_EF : SDA_SCHEMA,
    thinkingLevel: 'medium',
  });
  if (!raw) return null;

  const respuesta = parseGeminiJson<Omit<SdaContent, 'areas'> & { areas?: RawSdaArea[]; modelosPedagogicos?: unknown; modalidadDeportiva?: unknown; secuenciaDeportes?: unknown }>(raw);
  if (!respuesta) return null;
  const { modelosPedagogicos, modalidadDeportiva, secuenciaDeportes, ...parsed } = respuesta;
  // Un modelo de reserva puede devolver el array vacío o ausente
  const finales = (parsed.areas ?? []).map((a, i) => finalizarArea(a, resoluciones[i] ?? null));
  // Solo se cita un decreto si de verdad se usó: un área en modo libre, o una
  // elección inválida de la IA, no puede presumir de currículo oficial.
  const normativa: SdaNormativa | undefined = curriculo && finales.some(f => f.oficial)
    ? { comunidad: curriculo.comunidad, origen: curriculo.origen, cita }
    : undefined;
  // Solo los campos del esquema: lo que la IA añada por su cuenta (una «referencias»
  // inventada, por ejemplo) no llega a la SdA. Los de texto, siempre texto.
  const textos = Object.fromEntries(
    SDA_FIELDS.filter(k => k !== 'areas' && k !== 'sesiones')
      .map(k => [k, typeof parsed[k] === 'string' ? listaEnLineas(parsed[k]) : '']),
  ) as Omit<SdaContent, 'areas' | 'sesiones' | 'normativa' | 'ef'>;
  return {
    ...textos,
    areas: finales.map(f => (f.oficial ? { ...f.area, oficial: true } : f.area)),
    sesiones: sesionesDeLaRespuesta(parsed.sesiones, !!req.ef),
    normativa,
    ...(req.ef ? { ef: efDeLaRespuesta(req.ef, modelosPedagogicos, modalidadDeportiva, secuenciaDeportes) } : {}),
  };
}

const textoLimpio = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function momentoDeLaRespuesta(raw: unknown): MomentoSesionEF {
  const o = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const actividades = (Array.isArray(o.actividades) ? o.actividades : [])
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .map(a => {
      const min = typeof a.minutos === 'number' && Number.isFinite(a.minutos) ? Math.round(a.minutos) : 0;
      return {
        nombre: textoLimpio(a.nombre), minutos: min >= 1 && min <= 120 ? min : 0,
        descripcion: textoLimpio(a.descripcion), organizacion: textoLimpio(a.organizacion), material: textoLimpio(a.material),
      };
    })
    .filter(a => a.nombre && a.descripcion)
    .slice(0, 4);
  return { texto: textoLimpio(o.texto), actividades };
}

/**
 * Las sesiones tal como las devuelve la IA. En las de EF, con los tres
 * momentos saneados (actividades con nombre y cómo se hacen, como mucho cuatro
 * por momento, minutos razonables); si una sesión no trae ninguna actividad en
 * ningún momento, se queda como sesión de solo descripción en vez de enseñar
 * tres cuadros vacíos.
 */
export function sesionesDeLaRespuesta(raw: unknown, esEF: boolean): SdaSession[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map(s => {
      const base = { fase: textoLimpio(s.fase), titulo: textoLimpio(s.titulo), descripcion: textoLimpio(s.descripcion) };
      if (!esEF) return base;
      const momentos: MomentosSesionEF = {
        preimpacto: momentoDeLaRespuesta(s.preimpacto), impacto: momentoDeLaRespuesta(s.impacto), postimpacto: momentoDeLaRespuesta(s.postimpacto),
      };
      const hay = momentos.preimpacto.actividades.length + momentos.impacto.actividades.length + momentos.postimpacto.actividades.length > 0;
      return hay ? { ...base, momentos } : base;
    });
}

/**
 * «1. … 2. … 3. …» o «- … - …» en un solo párrafo, como a veces devuelve la IA
 * una lista aunque se le pida un punto por línea: cada número o guion que
 * empieza tras un punto, un punto y coma o dos puntos pasa a su línea. Si el
 * texto ya trae saltos de línea, no se toca.
 */
export function listaEnLineas(texto: string): string {
  if (texto.includes('\n')) return texto;
  return texto.replace(/([.;:])\s+(?=(\d{1,2}\.|[-•])\s)/g, '$1\n');
}

/**
 * Los modelos de la SdA de EF: el que eligió el docente o, si no, los que
 * eligió la IA de la lista cerrada (como mucho dos). Las referencias salen de
 * `lib/modelosEF`, no de la IA.
 */
export function efDeLaRespuesta(ef: SdaPeticionEF, marcados: unknown, modalidadIA?: unknown, secuenciaIA?: unknown): SdaEF {
  const deLaIA = (Array.isArray(marcados) ? marcados : []).filter((m): m is string => typeof m === 'string' && IDS_MODELOS_EF.includes(m));
  const modelos = modeloEF(ef.modelo) ? [ef.modelo] : [...new Set(deLaIA)].slice(0, 2);
  const modalidad = ef.modalidad || (IDS_MODALIDADES.includes(modalidadIA as ModalidadEF) ? modalidadIA as ModalidadEF : undefined);
  const secuencia = secuenciaDeportes(secuenciaIA);
  return { modelos, referencias: referenciasDeModelos(modelos), ...(modalidad ? { modalidad } : {}), ...(secuencia ? { secuencia } : {}) };
}

/** Los deportes en su orden: de 2 a 6 nombres cortos y distintos; con uno o ninguno no hay secuencia que mostrar. */
export function secuenciaDeportes(raw: unknown): string[] | undefined {
  const nombres: string[] = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    const n = typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
    if (n && !nombres.some(o => o.toLowerCase() === n.toLowerCase())) nombres.push(n);
  }
  return nombres.length >= 2 ? nombres.slice(0, 6) : undefined;
}

/* ── Rúbrica a partir de la situación de aprendizaje ── */

/** Los criterios oficiales de la SdA: los de sus áreas con texto del decreto, por área. */
export function criteriosOficialesDeSda(sda: SdaContent): { area: string; materia: string; criterios: { codigo: string; texto: string }[] }[] {
  return sda.areas
    .filter(a => a.oficial && a.materia)
    .map(a => ({
      area: a.area,
      materia: a.materia!,
      criterios: [...a.criteriosEvaluacion.matchAll(/^(\d+\.\d+) (.+)$/gm)].map(m => ({ codigo: m[1], texto: m[2] })),
    }))
    .filter(a => a.criterios.length > 0);
}

/**
 * De lo que marca la IA («Matemáticas|2.1») a criterios oficiales. Solo pasan
 * los que son de verdad de la SdA: un código inventado o de otra área se
 * descarta en silencio, como cualquier otra elección de la IA que no encaja.
 */
export function refsDeSda(sda: SdaContent, marcados: string[] | undefined): OfficialCriterionRef[] {
  const disponibles = criteriosOficialesDeSda(sda);
  const out: OfficialCriterionRef[] = [];
  for (const marcado of marcados ?? []) {
    const corte = marcado.lastIndexOf('|');
    const area = marcado.slice(0, corte).trim();
    const codigo = marcado.slice(corte + 1).trim();
    const a = disponibles.find(d => d.area === area);
    if (!a || !a.criterios.some(c => c.codigo === codigo)) continue;
    if (!out.some(r => r.materia === a.materia && r.codigo === codigo)) out.push({ materia: a.materia, codigo });
  }
  return out;
}

/** El trozo de las instrucciones y del prompt sobre los criterios oficiales, y la lista cerrada. */
function promptCriteriosOficiales(sda: SdaContent, que: 'criterio' | 'ítem') {
  const porArea = criteriosOficialesDeSda(sda);
  const disponibles = porArea.flatMap(a => a.criterios.map(c => `${a.area}|${c.codigo}`));
  if (disponibles.length === 0) return { sistema: '', usuario: '', disponibles };
  return {
    disponibles,
    sistema:
      `CRITERIOS OFICIALES: en el campo "criteriosOficiales" de cada ${que}, marca de 1 a 3 criterios de ` +
      `evaluación oficiales de la lista que se da, los que de verdad evalúe, escritos tal cual ` +
      `(«Área|código»). Pueden ser de varias áreas. Con ellos se calcula la nota de cada competencia ` +
      `específica de cada área.\n`,
    usuario:
      `Criterios de evaluación oficiales disponibles:\n` +
      porArea.flatMap(a => a.criterios.map(c => `- ${a.area}|${c.codigo}: ${c.texto}`)).join('\n') + '\n',
  };
}

export async function generateSdaRubric(
  sda: SdaContent,
  detalles: string,
  niveles: string[],
  lang: Lang,
  callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<SdaRubricRow[] | null> {
  const oficiales = promptCriteriosOficiales(sda, 'criterio');
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
    oficiales.sistema +
    `El idioma de salida DEBE SER ${idioma(lang)}.`;

  const areas = sda.areas
    .map(a => `- ${a.area}: ${a.competenciasEspecificas}`)
    .join('\n');

  const userPrompt =
    `Situación de aprendizaje: ${sda.titulo}\n` +
    `Justificación: ${sda.justificacion}\n` +
    `Competencias específicas por área:\n${areas}\n` +
    oficiales.usuario +
    `Producto final: ${sda.productoFinal}\n` +
    `Técnicas de evaluación: ${sda.evaluacionTecnicas}\n` +
    `Instrumentos: ${sda.evaluacionInstrumentos}\n` +
    (detalles ? `Además, valora especialmente: "${detalles}"\n` : '') +
    `\nGenera de 3 a 5 criterios de rúbrica.`;

  const raw = await callGemini(systemPrompt, userPrompt, [], callbacks, {
    maxOutputTokens: 8192,
    responseSchema: {
      ...RUBRIC_SCHEMA,
      properties: { rubrica: { type: 'ARRAY', items: conCriteriosOficiales(RUBRIC_ROW_SCHEMA, oficiales.disponibles) } },
    },
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
  const oficiales = promptCriteriosOficiales(sda, 'ítem');
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
    oficiales.sistema +
    `El idioma de salida DEBE SER ${idioma(lang)}.`;

  const areas = sda.areas
    .map(a => `- ${a.area}: ${a.competenciasEspecificas}`)
    .join('\n');

  const userPrompt =
    `Situación de aprendizaje: ${sda.titulo}\n` +
    `Justificación: ${sda.justificacion}\n` +
    `Competencias específicas por área:\n${areas}\n` +
    oficiales.usuario +
    `Producto final: ${sda.productoFinal}\n` +
    `Técnicas de evaluación: ${sda.evaluacionTecnicas}\n` +
    `Instrumentos: ${sda.evaluacionInstrumentos}\n` +
    (detalles ? `Además, valora especialmente: "${detalles}"\n` : '') +
    `\nGenera de 4 a 6 ítems de diana.`;

  const raw = await callGemini(systemPrompt, userPrompt, [], callbacks, {
    maxOutputTokens: 8192,
    responseSchema: {
      ...DIANA_SCHEMA,
      properties: { diana: { type: 'ARRAY', items: conCriteriosOficiales(DIANA_ITEM_SCHEMA, oficiales.disponibles) } },
    },
    thinkingLevel: 'high',
  });
  if (!raw) return null;

  const parsed = parseGeminiJson<{ diana: SdaDianaItem[] }>(raw);
  return parsed?.diana ?? null;
}
