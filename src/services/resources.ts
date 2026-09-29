/**
 * Motor de recursos pedagógicos — primer tipo: fichas de trabajo.
 *
 * Dos vías de generación, como ya pasa con rúbricas y dianas: suelta (un
 * tema y un curso, sin más contexto) o anclada a una Situación de
 * Aprendizaje ya redactada (usa sus saberes básicos y criterios de
 * evaluación, así el ejercicio no sale genérico). Las dos comparten el
 * mismo esquema de salida y acaban en el mismo sitio: la sección Recursos.
 *
 * Los ejercicios se agrupan en "actividades" con su propio título (como en
 * las fichas de verdad, con bloques tipo "ACTIVIDAD 1: ..."), y hay ocho
 * tipos de ejercicio — los cuatro de siempre más tabla para rellenar,
 * relacionar, colorear según el resultado y sopa de letras, pensados para
 * que el alumnado trabaje a mano sobre el papel: la ficha no dibuja las
 * líneas de "relacionar" ni colorea las celdas de "colorear" por él, solo
 * deja el espacio y la leyenda.
 *
 * Aparte del tipo, cualquier ejercicio puede llevar además una `figura`: un
 * diagrama geométrico etiquetado (rectángulo, prisma, cilindro...) para los
 * problemas de área/perímetro/volumen — ver `lib/geometryFigures.ts`. No es
 * un tipo de ejercicio más, es un adorno visual que se puede combinar sobre
 * todo con "problema".
 */

import { callGemini, parseGeminiJson } from './gemini';
import type { Lang } from '../i18n';
import type { SdaContent } from './learningSituations';
import { buildWordSearchGrid, type WordSearchPlacement } from '../lib/wordSearch';
import { FIGURE_SHAPES, FIGURE_SLOTS, FIGURE_LABEL, type Figure } from '../lib/geometryFigures';
import { buildCrossword, type Crossword } from '../lib/crossword';
import { fichaTheme, cleanEmoji, STORY_THEME_IDS, type FichaThemeId } from '../lib/fichaThemes';

/* ── Lo que devuelve la IA ── */

export type FichaExerciseType =
  | 'abierta' | 'completar' | 'opcion_multiple' | 'problema'
  | 'tabla_rellenar' | 'relacionar' | 'colorear' | 'sopa_letras'
  | 'verdadero_falso' | 'ordenar' | 'crucigrama' | 'comic';

export interface FichaExercise {
  tipo: FichaExerciseType;
  enunciado: string;
  /** Solo cuando `tipo` es 'opcion_multiple': de 3 a 5 opciones. */
  opciones?: string[];
  /** Solo 'tabla_rellenar': nombres de columna, ej. ["Base","Exponente","Resultado"]. */
  columnas?: string[];
  /** Solo 'tabla_rellenar': una fila por elemento, misma longitud que `columnas`; '' = celda en blanco. */
  filas?: string[][];
  /** Solo 'relacionar': columna izquierda, en el orden en que se muestra. */
  izquierda?: string[];
  /** Solo 'relacionar': columna derecha, en un orden DISTINTO al de `izquierda`. */
  derecha?: string[];
  /** Solo 'colorear': de 2 a 4 colores con su criterio. */
  leyenda?: { color: string; criterio: string }[];
  /** Solo 'colorear': elementos que el alumnado colorea a mano según `leyenda`. */
  itemsColorear?: string[];
  /**
   * Solo 'sopa_letras': de 6 a 10 palabras que la IA propone. Tras generarse
   * la ficha se sustituye por la lista final —solo las que consiguieron
   * colocarse en `rejilla`, ver `attachWordSearchGrids`— así que lo que
   * llega aquí desde la IA es un valor de partida, no el definitivo.
   */
  palabras?: string[];
  /** Solo 'sopa_letras': generada por código (`lib/wordSearch.ts`), NO por la IA. */
  rejilla?: string[][];
  /** Solo 'sopa_letras': dónde queda cada palabra de `palabras` en `rejilla`, para la vista del profesorado. */
  posiciones?: WordSearchPlacement[];
  /** Solo 'verdadero_falso': frases que el alumnado marca como V o F. */
  afirmaciones?: string[];
  /**
   * Solo 'ordenar': los pasos o elementos tal como se muestran, ya
   * desordenados. La IA los da en el orden correcto y el código los baraja
   * (ver `prepareExercise`); el orden bueno queda en `ordenCorrecto`.
   */
  elementos?: string[];
  /** Solo 'ordenar': el orden correcto, para el profesorado. */
  ordenCorrecto?: string[];
  /** Solo 'crucigrama': las palabras con su pista, tal como las propone la IA. */
  pistas?: { palabra: string; pista: string }[];
  /** Solo 'crucigrama': la cuadrícula, calculada por código (`lib/crossword.ts`). */
  crucigrama?: Crossword;
  /** Solo 'comic': de 2 a 4 viñetas; un `texto` vacío es un bocadillo para rellenar. */
  vinetas?: { personaje: string; texto: string }[];
  /**
   * Diagrama geométrico opcional (cualquier tipo, pero pensado sobre todo
   * para "problema" de área/perímetro/volumen). El dibujo en sí lo hace
   * `lib/geometryFigures.ts`, no la IA — ver esa cabecera.
   */
  figura?: Figure;
  /** Para el profesorado — nunca se muestra en la ficha exportada. */
  solucion: string;
  /** Variante simplificada del mismo ejercicio. Solo si se pidieron niveles. */
  apoyo?: string;
  /** Variante de más nivel del mismo ejercicio. Solo si se pidieron niveles. */
  ampliacion?: string;
}

/** Un bloque con título propio (p. ej. "Escribe como potencia") y sus ejercicios. */
export interface FichaActivity {
  titulo: string;
  ejercicios: FichaExercise[];
  /** Solo con historia: emoji de la misión y una frase que la une al relato. */
  emoji?: string;
  narrativa?: string;
  /** Solo en escape room: el código que abre el candado de esta sala y cómo se obtiene. */
  candado?: FichaCandado;
}

export interface FichaCandado {
  /** De 3 a 6 cifras o letras mayúsculas. */
  codigo: string;
  /** Cómo se forma el código a partir de las respuestas (se imprime). */
  pista: string;
}

/** Una tarjeta recortable: pregunta delante y respuesta detrás (se dobla por la mitad). */
export interface FichaTarjeta {
  pregunta: string;
  respuesta: string;
}

/**
 * Qué se imprime: la ficha de siempre, un escape room (cada bloque es una
 * sala con candado) o tarjetas para recortar y doblar.
 */
export type FichaFormato = 'ficha' | 'escape' | 'tarjetas';

/** Versión adaptada de otra ficha. Sin ella, es la versión estándar. */
export type FichaVariante = 'apoyo' | 'ampliacion' | 'lectura_facil';

/** El hilo narrativo que envuelve la ficha: quién habla, qué hay que conseguir y el premio. */
export interface FichaHistoria {
  /** Nombre del personaje, ej. «Capitana Nova». */
  personaje: string;
  emoji: string;
  /** Presentación de la misión, en segunda persona, al empezar. */
  mision: string;
  /** Mensaje al terminar. */
  cierre: string;
  /** Nombre de la insignia que se gana, ej. «Piloto de las fracciones». */
  insignia: string;
}

export interface FichaContent {
  titulo: string;
  /** Repaso breve del concepto, previo a los ejercicios. */
  explicacion: string;
  instrucciones: string;
  actividades: FichaActivity[];
  /** Tema visual. Sin él, la ficha se ve «Clásica» (así están las guardadas antes de los temas). */
  estilo?: FichaThemeId;
  historia?: FichaHistoria;
  /** Sin él, 'ficha'. */
  formato?: FichaFormato;
  /** Solo en 'tarjetas'. */
  tarjetas?: FichaTarjeta[];
  variante?: FichaVariante;
}

/* ── Lo que pide el docente ── */

export interface FichaRequest {
  tema: string;
  area: string;
  nivel: string;
  numEjercicios: number;
  /** Pedir a la IA una variante de apoyo y otra de ampliación por ejercicio. */
  niveles: boolean;
  contextoClase: string;
  /** 'auto': la IA elige el tema que mejor encaja; 'clasico': sin historia. */
  estilo?: FichaThemeChoice;
  formato?: FichaFormato;
}

export type FichaThemeChoice = FichaThemeId | 'auto';

const idioma = (lang: Lang) => (lang === 'en' ? 'INGLÉS' : 'ESPAÑOL');

/* ── Esquema de salida ── */

const S = (d: string) => ({ type: 'STRING', description: d });

export const TIPOS: FichaExerciseType[] = [
  'abierta', 'completar', 'opcion_multiple', 'problema', 'tabla_rellenar', 'relacionar', 'colorear', 'sopa_letras',
  'verdadero_falso', 'ordenar', 'crucigrama', 'comic',
];

const PISTA_ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: { palabra: S('Una sola palabra, sin espacios'), pista: S('Definición o pista breve para adivinarla') },
  required: ['palabra', 'pista'],
  propertyOrdering: ['palabra', 'pista'],
} as const;

const VINETA_ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    personaje: S('UN emoji que representa a quien habla (ej. 👧, 🧑‍🔬, 🐱)'),
    texto: S('Lo que dice en su bocadillo. Cadena vacía "" si es el bocadillo que escribe el alumnado'),
  },
  required: ['personaje', 'texto'],
  propertyOrdering: ['personaje', 'texto'],
} as const;

const LEYENDA_ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: { color: S('Nombre del color'), criterio: S('Qué debe cumplir un elemento para llevar ese color') },
  required: ['color', 'criterio'],
  propertyOrdering: ['color', 'criterio'],
} as const;

const MEDIDA_ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    etiqueta: S('Qué mide, en 1-2 palabras (ej. "base", "radio")'),
    valor: S('El valor con su unidad, corto (ej. "6 cm")'),
  },
  required: ['etiqueta', 'valor'],
  propertyOrdering: ['etiqueta', 'valor'],
} as const;

const FIGURA_SCHEMA = {
  type: 'OBJECT',
  properties: {
    forma: { type: 'STRING', enum: FIGURE_SHAPES, description: 'La forma geométrica del diagrama' },
    medidas: {
      type: 'ARRAY', items: MEDIDA_ITEM_SCHEMA,
      description: 'Las medidas de la forma, EN EL ORDEN que le corresponde a esa forma (ver FORMAS en las instrucciones)',
    },
  },
  required: ['forma', 'medidas'],
  propertyOrdering: ['forma', 'medidas'],
} as const;

/** "forma" (Nombre): slot1, slot2... — documentación de cada figura para el prompt, generada desde `FIGURE_SLOTS`. */
const FIGURA_FORMAS_DOC = FIGURE_SHAPES
  .map(f => `"${f}" (${FIGURE_LABEL[f]}): ${FIGURE_SLOTS[f].join(', ')}`)
  .join(' · ');

/**
 * Dos variantes del esquema del ejercicio según se pidan o no niveles: pedir
 * siempre "apoyo"/"ampliacion" como obligatorios, aunque no se vayan a usar,
 * hace que la IA los redacte igualmente por cumplir el esquema — mejor no
 * incluir el campo en absoluto cuando no hacen falta. Los campos propios de
 * cada tipo (columnas/filas, izquierda/derecha, leyenda/itemsColorear) van
 * siempre como opcionales: el formato de Gemini no permite condicionar un
 * campo al valor de otro, así que se explica en la descripción cuándo usar
 * cada uno y se confía en que la IA solo rellene los que le tocan.
 */
function fichaExerciseSchema(niveles: boolean) {
  const base = ['tipo', 'enunciado', 'solucion'] as const;
  return {
    type: 'OBJECT',
    properties: {
      tipo: {
        type: 'STRING', enum: TIPOS,
        description:
          '"abierta" respuesta libre, "completar" huecos, "opcion_multiple" varias opciones, ' +
          '"problema" cálculo o razonamiento con pasos, "tabla_rellenar" tabla con celdas en blanco, ' +
          '"relacionar" dos columnas para unir a mano, "colorear" leyenda de colores + elementos a colorear, ' +
          '"sopa_letras" lista de palabras para buscar en una rejilla, "verdadero_falso" frases para marcar V o F, ' +
          '"ordenar" pasos o elementos para numerar en orden, "crucigrama" palabras con pistas, ' +
          '"comic" tira de viñetas con bocadillos, alguno vacío para que lo escriba el alumnado',
      },
      enunciado: S('El texto del ejercicio o la pregunta, autocontenido'),
      opciones: {
        type: 'ARRAY', items: { type: 'STRING' },
        description: 'Solo si tipo es "opcion_multiple": de 3 a 5 opciones',
      },
      columnas: {
        type: 'ARRAY', items: { type: 'STRING' },
        description: 'Solo si tipo es "tabla_rellenar": nombres de columna, ej. ["Base","Exponente","Resultado"]',
      },
      filas: {
        type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'STRING' } },
        description:
          'Solo si tipo es "tabla_rellenar": una fila por elemento, con tantas celdas como "columnas". ' +
          'Escribe "" en las celdas que el alumnado debe rellenar, y el valor en las que ya vienen dadas.',
      },
      izquierda: {
        type: 'ARRAY', items: { type: 'STRING' },
        description: 'Solo si tipo es "relacionar": columna izquierda, en el orden en que se muestra',
      },
      derecha: {
        type: 'ARRAY', items: { type: 'STRING' },
        description:
          'Solo si tipo es "relacionar": columna derecha, con el mismo número de elementos que "izquierda" ' +
          'pero EN UN ORDEN DISTINTO — si van en el mismo orden que "izquierda" el ejercicio no tiene sentido',
      },
      leyenda: {
        type: 'ARRAY', items: LEYENDA_ITEM_SCHEMA,
        description: 'Solo si tipo es "colorear": de 2 a 4 colores con su criterio',
      },
      itemsColorear: {
        type: 'ARRAY', items: { type: 'STRING' },
        description: 'Solo si tipo es "colorear": expresiones o elementos que el alumnado colorea a mano según "leyenda"',
      },
      palabras: {
        type: 'ARRAY', items: { type: 'STRING' },
        description:
          'Solo si tipo es "sopa_letras": de 6 a 10 palabras SUELTAS (sin espacios, una sola palabra cada ' +
          'una) relacionadas con el tema, apropiadas al nivel, en mayúsculas',
      },
      afirmaciones: {
        type: 'ARRAY', items: { type: 'STRING' },
        description: 'Solo si tipo es "verdadero_falso": de 4 a 8 frases, mezclando verdaderas y falsas',
      },
      elementos: {
        type: 'ARRAY', items: { type: 'STRING' },
        description:
          'Solo si tipo es "ordenar": de 4 a 7 pasos, hechos o elementos EN SU ORDEN CORRECTO — la ' +
          'aplicación los desordena antes de mostrarlos',
      },
      pistas: {
        type: 'ARRAY', items: PISTA_ITEM_SCHEMA,
        description: 'Solo si tipo es "crucigrama": de 5 a 8 palabras sueltas del tema, cada una con su pista',
      },
      vinetas: {
        type: 'ARRAY', items: VINETA_ITEM_SCHEMA,
        description:
          'Solo si tipo es "comic": de 3 a 4 viñetas de una conversación sobre el tema; la última (o alguna) ' +
          'con "texto" vacío para que el alumnado escriba lo que dice el personaje',
      },
      figura: {
        ...FIGURA_SCHEMA,
        description:
          'Opcional, en cualquier tipo pero sobre todo en "problema": un diagrama geométrico SOLO cuando el ' +
          'ejercicio pide calcular área, perímetro, superficie o volumen de una forma concreta. No lo incluyas ' +
          'en el resto de ejercicios.',
      },
      solucion: S(
        'La respuesta correcta, para el profesorado: en "tabla_rellenar" los valores que faltan, en ' +
        '"relacionar" qué elemento de la izquierda va con cuál de la derecha, en "colorear" qué color ' +
        'lleva cada elemento, en "sopa_letras" basta con repetir la lista de palabras, en "verdadero_falso" ' +
        'V o F para cada frase (y la corrección de las falsas), en "ordenar" el orden correcto, en ' +
        '"crucigrama" las palabras, en "comic" un ejemplo de lo que podría decir el bocadillo vacío',
      ),
      ...(niveles ? {
        apoyo: S('Versión simplificada o con más pistas del MISMO ejercicio, para quien necesite refuerzo'),
        ampliacion: S('Versión de más nivel o un reto añadido del MISMO ejercicio, para quien necesite más exigencia'),
      } : {}),
    },
    required: niveles ? [...base, 'apoyo', 'ampliacion'] : [...base],
    propertyOrdering: [
      'tipo', 'enunciado', 'opciones', 'columnas', 'filas', 'izquierda', 'derecha',
      'leyenda', 'itemsColorear', 'palabras', 'afirmaciones', 'elementos', 'pistas', 'vinetas',
      'figura', 'solucion', ...(niveles ? ['apoyo', 'ampliacion'] : []),
    ],
  } as const;
}

/** Qué partes opcionales se piden a la IA: solo las que se van a usar, igual que con los niveles. */
interface SchemaOpts {
  niveles: boolean;
  /** Envolver la ficha en una historia (todo tema menos «Clásica»). */
  historia: boolean;
  /** Que la IA elija el tema visual. */
  elegirEstilo: boolean;
  formato: FichaFormato;
}

const CANDADO_SCHEMA = {
  type: 'OBJECT',
  properties: {
    codigo: S('El código que abre el candado de esta sala: de 3 a 5 cifras (o letras mayúsculas), sin espacios'),
    pista: S('Cómo se forma el código a partir de las respuestas de esta sala, ej. "Las cifras son los resultados de los ejercicios 1, 2 y 3, en orden"'),
  },
  required: ['codigo', 'pista'],
  propertyOrdering: ['codigo', 'pista'],
} as const;

function fichaActivitySchema(o: SchemaOpts) {
  const story = o.historia ? {
    emoji: S('UN emoji que represente esta misión dentro de la historia'),
    narrativa: S('Una frase que conecta este bloque con la historia, ej. "El motor de la nave se ha roto: resuelve estas potencias para repararlo"'),
  } : {};
  const escape = o.formato === 'escape';
  const tail = ['ejercicios', ...(escape ? ['candado'] : [])];
  return {
    type: 'OBJECT',
    properties: {
      titulo: S('Título breve del bloque de actividad, ej. "Escribe como potencia"'),
      ...story,
      ejercicios: { type: 'ARRAY', items: fichaExerciseSchema(o.niveles) },
      ...(escape ? { candado: CANDADO_SCHEMA } : {}),
    },
    required: ['titulo', ...(o.historia ? ['emoji', 'narrativa'] : []), ...tail],
    propertyOrdering: ['titulo', ...(o.historia ? ['emoji', 'narrativa'] : []), ...tail],
  } as const;
}

const HISTORIA_SCHEMA = {
  type: 'OBJECT',
  properties: {
    personaje: S('Nombre del personaje que guía la aventura, ej. "Capitana Nova"'),
    emoji: S('UN emoji que represente al personaje'),
    mision: S('Presentación de la misión, 2-3 frases en segunda persona dirigidas al alumnado, con emoción y un objetivo claro'),
    cierre: S('Mensaje final de 1-2 frases felicitando al alumnado por completar la misión'),
    insignia: S('Nombre corto y motivador de la insignia que se gana, relacionado con el tema, ej. "Piloto de las potencias"'),
  },
  required: ['personaje', 'emoji', 'mision', 'cierre', 'insignia'],
  propertyOrdering: ['personaje', 'emoji', 'mision', 'cierre', 'insignia'],
} as const;

const TARJETA_SCHEMA = {
  type: 'OBJECT',
  properties: {
    pregunta: S('La pregunta o el reto, breve (cabe en media tarjeta)'),
    respuesta: S('La respuesta correcta, breve'),
  },
  required: ['pregunta', 'respuesta'],
  propertyOrdering: ['pregunta', 'respuesta'],
} as const;

function tarjetasSchema(o: SchemaOpts) {
  const head = [...(o.elegirEstilo ? ['estilo'] : []), 'titulo'];
  return {
    type: 'OBJECT',
    properties: {
      ...(o.elegirEstilo ? { estilo: { type: 'STRING', enum: STORY_THEME_IDS, description: 'El mundo visual que mejor encaja' } } : {}),
      titulo: S('Título breve del juego de tarjetas'),
      instrucciones: S('Cómo se juega con las tarjetas, en 2-4 frases dirigidas al alumnado'),
      tarjetas: { type: 'ARRAY', items: TARJETA_SCHEMA, description: 'Las tarjetas, todas distintas' },
    },
    required: [...head, 'instrucciones', 'tarjetas'],
    propertyOrdering: [...head, 'instrucciones', 'tarjetas'],
  } as const;
}

function fichaSchema(o: SchemaOpts) {
  if (o.formato === 'tarjetas') return tarjetasSchema(o);
  const head = [...(o.elegirEstilo ? ['estilo'] : []), 'titulo', ...(o.historia ? ['historia'] : [])];
  return {
    type: 'OBJECT',
    properties: {
      ...(o.elegirEstilo ? {
        estilo: {
          type: 'STRING', enum: STORY_THEME_IDS,
          description: 'El mundo de la historia que mejor encaja con el tema y la edad (ver ESTILOS en las instrucciones)',
        },
      } : {}),
      titulo: S('Título breve de la ficha'),
      ...(o.historia ? { historia: HISTORIA_SCHEMA } : {}),
      explicacion: S(
        'Repaso breve (3-5 frases) del concepto antes de los ejercicios: qué es, por qué sirve, ' +
        'y a ser posible un ejemplo resuelto sencillo. Se muestra destacado, antes de las instrucciones.',
      ),
      instrucciones: S('Instrucciones generales para el alumnado, dos o tres frases'),
      actividades: {
        type: 'ARRAY', items: fichaActivitySchema(o),
        description: 'De 2 a 4 bloques de actividad, cada uno con su título y sus propios ejercicios',
      },
    },
    required: [...head, 'explicacion', 'instrucciones', 'actividades'],
    propertyOrdering: [...head, 'explicacion', 'instrucciones', 'actividades'],
  } as const;
}

const ESTILOS_DOC = STORY_THEME_IDS.map(id => `"${id}": ${fichaTheme(id).ambiente}`).join(' · ');

/** La parte del prompt que convierte la ficha en una aventura. */
function storyPrompt(estilo: FichaThemeChoice): string {
  const mundo = estilo === 'auto'
    ? `Elige en "estilo" el mundo que mejor encaje con el tema y la edad del alumnado. ESTILOS: ${ESTILOS_DOC}.\n`
    : `El mundo de la historia es ${fichaTheme(estilo).ambiente}.\n`;
  return (
    `HISTORIA: la ficha es una aventura. ${mundo}` +
    `En "historia" crea un personaje que guía al alumnado, presenta la misión en "mision" (segunda persona, ` +
    `con emoción, un objetivo claro), escribe un "cierre" que felicita al terminar y el nombre de la ` +
    `"insignia" que se gana. Cada bloque de actividad es un paso de la aventura: su "narrativa" dice en una ` +
    `frase por qué hay que resolverlo dentro de la historia. Los enunciados pueden usar personajes y ` +
    `objetos de ese mundo (planetas, animales, pistas…) siempre que el contenido académico sea el mismo y ` +
    `riguroso: la historia motiva, no sustituye al aprendizaje. Tono cercano, sin infantilizar en ` +
    `Secundaria.\n`
  );
}

/** La parte del prompt que convierte la ficha en un escape room. */
const ESCAPE_PROMPT =
  `ESCAPE ROOM: la ficha es un escape room imprimible. Cada bloque de actividad es una SALA cerrada con un ` +
  `candado. En "candado" da el "codigo" que lo abre y la "pista" que explica cómo se forma ese código a ` +
  `partir de las respuestas de los ejercicios de la sala (por ejemplo, las cifras de los resultados en orden, ` +
  `o la primera letra de cada respuesta). El código tiene que salir DE VERDAD de las respuestas correctas: ` +
  `comprueba las cuentas. Usa ejercicios con respuesta corta y única (números, palabras, V/F, opción ` +
  `múltiple, ordenar, completar) para que el código sea inequívoco; evita "abierta" y "comic" en este ` +
  `formato. La historia explica por qué hay que escapar o qué se desbloquea al final.\n`;

/** Prompt de sistema del formato «tarjetas recortables». */
function tarjetasSystemPrompt(lang: Lang, estilo: FichaThemeChoice): string {
  return (
    `Eres un experto en didáctica y gamificación. Tu tarea es crear un juego de tarjetas recortables para ` +
    `el aula: cada tarjeta tiene una pregunta o reto breve delante y su respuesta detrás (se dobla por la ` +
    `mitad). Las preguntas deben ser variadas (definiciones, cálculos cortos, ejemplos, verdadero o falso, ` +
    `completar), apropiadas al nivel, y cada una se tiene que poder responder en pocas palabras. En ` +
    `"instrucciones" explica un juego sencillo para usarlas en parejas o grupos (por ejemplo, por turnos: ` +
    `quien acierta se queda la tarjeta).\n` +
    (estilo === 'auto' ? `Elige en "estilo" el mundo visual que mejor encaje. ESTILOS: ${ESTILOS_DOC}.\n` : '') +
    `NOTACIÓN MATEMÁTICA: superíndices de verdad (x², 3⁴), nunca LaTeX.\n` +
    `El idioma de salida DEBE SER ${idioma(lang)}.`
  );
}

function systemPrompt(niveles: boolean, lang: Lang, estilo: FichaThemeChoice = 'clasico', formato: FichaFormato = 'ficha'): string {
  if (formato === 'tarjetas') return tarjetasSystemPrompt(lang, estilo);
  return (
    `Eres un experto en didáctica y creación de materiales educativos. Tu tarea exclusiva es ` +
    `redactar una ficha de trabajo imprimible para el alumnado: una breve explicación del concepto ` +
    `y después los ejercicios, repartidos en bloques de actividad.\n` +
    `EXPLICACIÓN: en el campo "explicacion", antes de los ejercicios, recuerda el concepto en pocas ` +
    `frases, como lo haría el profesorado en la pizarra antes de mandar la tarea — no es un tema nuevo, ` +
    `es un repaso. Si encaja, incluye un ejemplo resuelto corto.\n` +
    `ACTIVIDADES: reparte los ejercicios en de 2 a 4 bloques, cada uno con un título corto y claro (ej. ` +
    `"Escribe como potencia", "Relaciona"). Agrupa en el mismo bloque los ejercicios del mismo tipo o ` +
    `del mismo objetivo.\n` +
    `TIPOS DE EJERCICIO — usa el que mejor encaje en cada bloque, variando entre bloques:\n` +
    `- "abierta": respuesta libre. "completar": huecos en una frase o expresión. "opcion_multiple": de ` +
    `3 a 5 opciones en "opciones". "problema": un enunciado con varios pasos.\n` +
    `- "tabla_rellenar": tabla ("columnas" + "filas") con algunas celdas ya dadas y otras en blanco ("") ` +
    `para que el alumnado las complete.\n` +
    `- "relacionar": "izquierda" y "derecha" con el mismo número de elementos, PERO "derecha" EN UN ` +
    `ORDEN DISTINTO al de "izquierda" — si no, no hay nada que relacionar. El alumnado los une a mano.\n` +
    `- "colorear": una "leyenda" (2 a 4 colores con su criterio) y unos "itemsColorear" que el alumnado ` +
    `colorea a mano según esa leyenda.\n` +
    `- "sopa_letras": de 6 a 10 "palabras" sueltas (una palabra cada una, sin espacios ni frases) sobre ` +
    `el tema, apropiadas al nivel — la rejilla donde buscarlas la dibuja la propia aplicación, tú solo ` +
    `aportas la lista. Como mucho un bloque de actividad de este tipo por ficha.\n` +
    `- "verdadero_falso": de 4 a 8 "afirmaciones", unas verdaderas y otras falsas; las falsas, con un ` +
    `error concreto que se pueda razonar.\n` +
    `- "ordenar": de 4 a 7 "elementos" (pasos de un proceso, fechas, números, fases…) EN SU ORDEN ` +
    `CORRECTO; la aplicación los desordena.\n` +
    `- "crucigrama": de 5 a 8 "pistas", cada una una palabra suelta del tema con su definición; la ` +
    `cuadrícula la monta la aplicación. Como mucho uno por ficha.\n` +
    `- "comic": de 3 a 4 "vinetas" con un emoji de personaje y lo que dice; deja al menos un bocadillo ` +
    `vacío ("") para que el alumnado escriba la respuesta o la explicación. Como mucho uno por ficha.\n` +
    `VARIEDAD: usa al menos tres tipos distintos en la ficha y prefiere los más visuales y manipulativos ` +
    `(relacionar, ordenar, verdadero o falso, crucigrama, cómic…) cuando encajen con el contenido.\n` +
    `FIGURA: cuando un ejercicio (normalmente "problema") pida calcular área, perímetro, superficie o ` +
    `volumen de una forma geométrica concreta, añade el campo "figura" con "forma" (una de esta lista, ` +
    `EXACTAMENTE con ese nombre) y "medidas" (un {etiqueta, valor} por cada medida de esa forma, EN ESTE ` +
    `ORDEN — el dibujo lo hace la aplicación, no tú, así que el orden es lo único que le dice qué medida ` +
    `va en cada sitio del dibujo):\n${FIGURA_FORMAS_DOC}\n` +
    `El enunciado debe dar las mismas medidas en el mismo orden que "medidas", con sus unidades — así lo ` +
    `que lee el alumnado coincide con lo que ve dibujado. No pongas "figura" en ejercicios que no ` +
    `trabajan una forma geométrica concreta: la mayoría de ejercicios no la lleva.\n` +
    `VARÍA LOS NÚMEROS: no repitas los mismos valores de una figura a otra ni caigas siempre en los ` +
    `típicos de manual (6 y 4, por ejemplo) — cada figura de la ficha debe llevar medidas distintas, ` +
    `elegidas al azar dentro de un rango razonable para el nivel (números enteros sencillos en cursos ` +
    `bajos, con decimales si el nivel ya los trabaja). Esto vale también para los números de cualquier ` +
    `otro ejercicio con datos (tablas, problemas sin figura...): que no se repitan de una ficha a otra.\n` +
    `SOLUCIÓN: el campo "solucion" de cada ejercicio es SIEMPRE para el profesorado, nunca se muestra ` +
    `al alumnado en la ficha impresa: da la respuesta correcta, adaptada al tipo de ejercicio.\n` +
    (niveles
      ? `NIVELES: para cada ejercicio, redacta también "apoyo" (una versión simplificada o con más ` +
        `pistas del MISMO ejercicio, para quien necesite refuerzo) y "ampliacion" (una versión de más ` +
        `nivel o un reto añadido del MISMO ejercicio). No son ejercicios distintos, son variantes.\n`
      : '') +
    `NOTACIÓN MATEMÁTICA: si hay potencias, exponentes o fórmulas, escríbelas con caracteres normales ` +
    `— superíndices de verdad (3⁴, x², a²+b²=c²) — NUNCA en LaTeX ni con comandos de marcado con barra ` +
    `invertida: prohibido usar "$", "^" o cualquier delimitador de fórmula. Si un superíndice no es un ` +
    `número simple, escríbelo con palabras ("tres elevado a x").\n` +
    `El enunciado de cada ejercicio debe poder leerse y trabajarse solo, sin depender de un libro ` +
    `de texto que la IA no ha visto.\n` +
    (estilo !== 'clasico' ? storyPrompt(estilo) : '') +
    (formato === 'escape' ? ESCAPE_PROMPT : '') +
    `El idioma de salida DEBE SER ${idioma(lang)}.`
  );
}

/* ── Limpieza de notación matemática ── */

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};

function toSuperscript(digits: string): string {
  return digits.split('').map(c => SUPERSCRIPT_DIGITS[c] ?? c).join('');
}

/**
 * Red de seguridad para cuando la IA, a pesar de la instrucción, se le
 * escapa notación LaTeX de todos modos: convierte "3^4" o "3^{4}" —con o sin
 * el "$...$" de math-mode alrededor— en el superíndice de verdad, 3⁴.
 *
 * El primer intento de esto quitaba cualquier "$...$" cuyo interior, DESPUÉS
 * de convertir el exponente, ya no tuviera caracteres de LaTeX — pero eso no
 * distingue una fórmula real de dos precios en la misma frase: "cuesta $5 y
 * $10 más" también cumplía esa condición y se comía los dos símbolos de
 * dólar. Ahora los "$" solo se quitan cuando, DE PARTIDA, lo que hay entre
 * ellos es exactamente "base^exponente" —el "^" tiene que estar ahí ya, no
 * basta con que no queden restos después de limpiar—, así que un precio
 * nunca entra en el patrón.
 */
function cleanMathNotation(text: string): string {
  if (!text) return text;
  return text
    // $base^{exp}$ o $base^exp$ -> superíndice, sin los símbolos de dólar
    .replace(/\$([A-Za-z0-9)]+)\^\{?(-?\d+)\}?\$/g, (_m, base: string, exp: string) => base + toSuperscript(exp))
    // Lo mismo pero sin "$" alrededor (tolera un espacio antes del "^": "a ^{2}")
    .replace(/([A-Za-z0-9)])\s?\^\{(-?\d+)\}/g, (_m, base: string, exp: string) => base + toSuperscript(exp))
    .replace(/([A-Za-z0-9)])\s?\^(-?\d+)/g, (_m, base: string, exp: string) => base + toSuperscript(exp));
}

function cleanExercise(ex: FichaExercise): FichaExercise {
  return {
    ...ex,
    enunciado: cleanMathNotation(ex.enunciado),
    opciones: ex.opciones?.map(cleanMathNotation),
    columnas: ex.columnas?.map(cleanMathNotation),
    filas: ex.filas?.map(fila => fila.map(cleanMathNotation)),
    izquierda: ex.izquierda?.map(cleanMathNotation),
    derecha: ex.derecha?.map(cleanMathNotation),
    leyenda: ex.leyenda?.map(l => ({ color: l.color, criterio: cleanMathNotation(l.criterio) })),
    itemsColorear: ex.itemsColorear?.map(cleanMathNotation),
    afirmaciones: ex.afirmaciones?.map(cleanMathNotation),
    elementos: ex.elementos?.map(cleanMathNotation),
    pistas: ex.pistas?.map(p => ({ palabra: p.palabra, pista: cleanMathNotation(p.pista) })),
    vinetas: ex.vinetas?.map(v => ({ personaje: cleanEmoji(v.personaje, '🙂'), texto: cleanMathNotation(v.texto ?? '') })),
    solucion: cleanMathNotation(ex.solucion),
    apoyo: ex.apoyo ? cleanMathNotation(ex.apoyo) : ex.apoyo,
    ampliacion: ex.ampliacion ? cleanMathNotation(ex.ampliacion) : ex.ampliacion,
  };
}

/**
 * La IA solo propone la lista de palabras de un ejercicio "sopa_letras"; la
 * rejilla en sí la calcula `buildWordSearchGrid` (algoritmo determinista, no
 * IA — ver la cabecera de `lib/wordSearch.ts`). Aquí se genera una única vez,
 * al recibir la respuesta de la IA, y el resultado queda guardado en el
 * ejercicio: reabrir una ficha guardada no vuelve a barajar la rejilla.
 *
 * `palabras` se reduce a las que consiguieron colocarse (en su mismo orden
 * original) para que la lista que ve el alumnado nunca incluya una palabra
 * que no está en la rejilla.
 */
function attachWordSearchGrid(ex: FichaExercise): FichaExercise {
  if (ex.tipo !== 'sopa_letras' || !ex.palabras?.length) return ex;
  const { rejilla, posiciones } = buildWordSearchGrid(ex.palabras);
  const colocadas = new Set(posiciones.map(p => p.palabra));
  const palabras = ex.palabras.map(p => p.trim().toUpperCase()).filter(p => colocadas.has(p));
  return { ...ex, palabras, rejilla, posiciones };
}

/** Baraja sin dejar nunca el orden original (si no, no habría nada que ordenar). */
export function shuffleApart<T>(list: T[], rand: () => number = Math.random): T[] {
  if (list.length < 2) return [...list];
  for (let tries = 0; tries < 10; tries++) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.some((x, i) => x !== list[i])) return out;
  }
  return [...list.slice(1), list[0]];
}

/**
 * Lo que calcula el código y no la IA: la rejilla de la sopa de letras, la
 * cuadrícula del crucigrama y el desorden de «ordenar». Se hace al recibir el
 * ejercicio y cuando el docente cambia sus palabras en el editor.
 */
export function prepareExercise(ex: FichaExercise): FichaExercise {
  if (ex.tipo === 'sopa_letras') return attachWordSearchGrid(ex);
  if (ex.tipo === 'crucigrama' && ex.pistas?.length) {
    const crucigrama = buildCrossword(ex.pistas);
    return { ...ex, crucigrama };
  }
  if (ex.tipo === 'ordenar' && ex.elementos?.length && !ex.ordenCorrecto?.length) {
    return { ...ex, ordenCorrecto: ex.elementos, elementos: shuffleApart(ex.elementos) };
  }
  return ex;
}

/** Un código de candado: solo cifras y letras, en mayúsculas y sin tildes. */
export function cleanCode(raw: string): string {
  return (raw ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9Ñ]/g, '').slice(0, 8);
}

function cleanFichaContent(c: FichaContent, estilo: FichaThemeChoice = 'clasico', formato: FichaFormato = 'ficha'): FichaContent {
  const finalEstilo: FichaThemeId = estilo === 'auto'
    ? (STORY_THEME_IDS.includes(c.estilo as FichaThemeId) ? c.estilo as FichaThemeId : 'espacio')
    : estilo;
  const theme = fichaTheme(finalEstilo);
  const historia = c.historia && finalEstilo !== 'clasico'
    ? {
      ...c.historia,
      emoji: cleanEmoji(c.historia.emoji, theme.personaje),
      mision: cleanMathNotation(c.historia.mision),
      cierre: cleanMathNotation(c.historia.cierre),
    }
    : undefined;
  return {
    ...c,
    estilo: finalEstilo,
    historia,
    formato,
    titulo: cleanMathNotation(c.titulo),
    explicacion: cleanMathNotation(c.explicacion ?? ''),
    instrucciones: cleanMathNotation(c.instrucciones ?? ''),
    actividades: (c.actividades ?? []).map((act, i) => ({
      titulo: cleanMathNotation(act.titulo),
      ...(historia ? {
        emoji: cleanEmoji(act.emoji, theme.iconos[i % theme.iconos.length]),
        narrativa: cleanMathNotation(act.narrativa ?? ''),
      } : {}),
      ejercicios: (act.ejercicios ?? []).map(cleanExercise).map(prepareExercise),
      ...(formato === 'escape' && act.candado ? {
        candado: { codigo: cleanCode(act.candado.codigo), pista: cleanMathNotation(act.candado.pista ?? '') },
      } : {}),
    })),
    ...(formato === 'tarjetas' ? {
      tarjetas: (c.tarjetas ?? [])
        .filter(tj => tj?.pregunta?.trim())
        .map(tj => ({ pregunta: cleanMathNotation(tj.pregunta), respuesta: cleanMathNotation(tj.respuesta ?? '') })),
    } : {}),
  };
}

type Callbacks = { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void };

async function callFichaText(
  system: string, user: string, niveles: boolean, estilo: FichaThemeChoice, formato: FichaFormato, onError?: (m: string) => void,
): Promise<FichaContent | null> {
  const raw = await callGemini(system, user, [], { onError }, {
    maxOutputTokens: 16384,
    responseSchema: fichaSchema({
      niveles: niveles && formato !== 'tarjetas',
      historia: estilo !== 'clasico' && formato !== 'tarjetas',
      elegirEstilo: estilo === 'auto',
      formato,
    }),
    thinkingLevel: 'medium',
    // Con responseSchema el modelo tiende a converger en respuestas "típicas"
    // (mismos números de siempre en figuras/tablas) incluso a temperatura
    // normal — un poco más de temperatura, más la instrucción explícita del
    // prompt (VARÍA LOS NÚMEROS), es lo que de verdad rompe esa repetición.
    temperature: 1.3,
  });
  if (!raw) return null;
  const parsed = parseGeminiJson<FichaContent>(raw);
  if (!parsed) return null;
  return cleanFichaContent({ ...parsed, actividades: parsed.actividades ?? [] }, estilo, formato);
}

/** Un escape room necesita historia: con «Clásica» se deja elegir el mundo a la IA. */
function effectiveEstilo(estilo: FichaThemeChoice | undefined, formato: FichaFormato): FichaThemeChoice {
  const e = estilo ?? 'auto';
  return formato === 'escape' && e === 'clasico' ? 'auto' : e;
}

/** Qué se pide al final del prompt según el formato. */
function askFor(formato: FichaFormato, n: number, sobre: string): string {
  if (formato === 'tarjetas') return `Crea EXACTAMENTE ${n} tarjetas ${sobre}.`;
  if (formato === 'escape') {
    return `Crea un escape room con un total de EXACTAMENTE ${n} ejercicios ${sobre}, repartidos en de 2 a 4 salas, cada una con su candado.`;
  }
  return `Genera una ficha de trabajo con un total de EXACTAMENTE ${n} ejercicios ${sobre}, repartidos en sus bloques de actividad.`;
}

/**
 * Un rango numérico distinto por llamada, para meter en el prompt de cada
 * generación. Pedir en el prompt "usa números variados" no basta — probado
 * en la práctica, la IA converge una y otra vez en los mismos combos manidos
 * (8-4-6 en un prisma rectangular, por ejemplo) incluso con `temperature`
 * alta, porque son con diferencia los ejemplos más frecuentes en cualquier
 * texto de matemáticas. Darle un rango concreto y distinto cada vez —
 * generado aquí, no por la IA— le da un ancla nueva de la que no puede
 * escaparse repitiendo el ejemplo de siempre.
 */
function numberVarietyHint(): string {
  const lo = 2 + Math.floor(Math.random() * 7); // 2-8
  const hi = lo + 6 + Math.floor(Math.random() * 10); // lo+6..lo+15
  return (
    `VARIEDAD NUMÉRICA: en esta ficha en concreto, procura que las medidas, cantidades y datos de ` +
    `los ejercicios (figuras, problemas, tablas...) se muevan sobre todo entre ${lo} y ${hi} — evita ` +
    `en particular los combos más manidos de los libros de texto (8-4-6, 6-4, 5-3-4, 10-5) y no ` +
    `repitas los mismos números de un ejercicio a otro dentro de la ficha.`
  );
}

/* ── Vía suelta: tema + curso, sin anclar a ninguna SdA ── */

export async function generateFicha(
  req: FichaRequest, lang: Lang, callbacks: Callbacks = {},
): Promise<FichaContent | null> {
  callbacks.onStart?.();
  try {
    const formato = req.formato ?? 'ficha';
    const estilo = effectiveEstilo(req.estilo, formato);
    const userPrompt =
      `Tema: ${req.tema}\n` +
      `Área o asignatura: ${req.area || '(no indicada)'}\n` +
      `Curso o nivel: ${req.nivel || '(no indicado)'}\n` +
      (req.contextoClase ? `Características del grupo: ${req.contextoClase}\n` : '') +
      `\n${askFor(formato, req.numEjercicios, 'sobre este tema')}\n\n${numberVarietyHint()}`;

    return await callFichaText(systemPrompt(req.niveles, lang, estilo, formato), userPrompt, req.niveles, estilo, formato, callbacks.onError);
  } finally {
    callbacks.onEnd?.();
  }
}

/* ── Vía anclada: a partir de una Situación de Aprendizaje ya redactada ── */

export async function generateFichaFromSda(
  sda: SdaContent, area: string,
  opts: { numEjercicios: number; niveles: boolean; detalles: string; estilo?: FichaThemeChoice; formato?: FichaFormato },
  lang: Lang, callbacks: Callbacks = {},
): Promise<FichaContent | null> {
  callbacks.onStart?.();
  try {
    const areaData = sda.areas.find(a => a.area === area) ?? sda.areas[0];
    const formato = opts.formato ?? 'ficha';
    const estilo = effectiveEstilo(opts.estilo, formato);

    const userPrompt =
      `Situación de aprendizaje: ${sda.titulo}\n` +
      `Área: ${areaData?.area ?? area}\n` +
      `Saberes básicos de esta área: ${areaData?.saberesBasicos ?? ''}\n` +
      `Criterios de evaluación de esta área: ${areaData?.criteriosEvaluacion ?? ''}\n` +
      (opts.detalles ? `Además, ten en cuenta: ${opts.detalles}\n` : '') +
      `\n${askFor(formato, opts.numEjercicios, 'que trabajen estos saberes básicos')}\n\n${numberVarietyHint()}`;

    return await callFichaText(systemPrompt(opts.niveles, lang, estilo, formato), userPrompt, opts.niveles, estilo, formato, callbacks.onError);
  } finally {
    callbacks.onEnd?.();
  }
}

/* ── Editor: rehacer un solo ejercicio o solo la historia ── */

/** Lo que la IA necesita ver de un ejercicio: sin lo que calcula el código. */
function exerciseForPrompt(ex: FichaExercise): Partial<FichaExercise> {
  const rest: Partial<FichaExercise> = { ...ex };
  delete rest.rejilla; delete rest.posiciones; delete rest.crucigrama;
  return ex.tipo === 'ordenar' && ex.ordenCorrecto?.length ? { ...rest, elementos: ex.ordenCorrecto, ordenCorrecto: undefined } : rest;
}

function fichaContextForPrompt(c: FichaContent, req: FichaRequest): string {
  return (
    `Ficha: ${c.titulo}\n` +
    `Tema: ${req.tema}\n` +
    `Área o asignatura: ${req.area || '(no indicada)'}\n` +
    `Curso o nivel: ${req.nivel || '(no indicado)'}\n` +
    (c.historia ? `Historia de la ficha: ${c.historia.personaje} — ${c.historia.mision}\n` : '')
  );
}

/**
 * Rehace un único ejercicio siguiendo la indicación del docente («hazlo más
 * fácil», «cámbialo por un crucigrama»…) sin tocar el resto de la ficha.
 */
export async function regenerateExercise(
  content: FichaContent, req: FichaRequest, actIdx: number, exIdx: number,
  opts: { instruccion: string; tipo?: FichaExerciseType },
  lang: Lang, callbacks: Callbacks = {},
): Promise<FichaExercise | null> {
  const act = content.actividades[actIdx];
  const ex = act?.ejercicios[exIdx];
  if (!ex) return null;
  callbacks.onStart?.();
  try {
    const niveles = !!(ex.apoyo || ex.ampliacion);
    const userPrompt =
      fichaContextForPrompt(content, req) +
      `Bloque de actividad: ${act.titulo}${act.narrativa ? ` (${act.narrativa})` : ''}\n\n` +
      `Ejercicio actual (JSON):\n${JSON.stringify(exerciseForPrompt(ex))}\n\n` +
      `Rehaz SOLO este ejercicio. Indicación del docente: ${opts.instruccion || 'haz una versión distinta'}.\n` +
      (opts.tipo ? `El nuevo ejercicio debe ser de tipo "${opts.tipo}".\n` : 'Mantén el mismo tipo salvo que la indicación pida otro.\n') +
      `Debe seguir encajando en la ficha y en su historia.\n\n${numberVarietyHint()}`;
    const raw = await callGemini(systemPrompt(niveles, lang), userPrompt, [], { onError: callbacks.onError }, {
      maxOutputTokens: 4096,
      responseSchema: fichaExerciseSchema(niveles),
      thinkingLevel: 'low',
      temperature: 1.1,
    });
    if (!raw) return null;
    const parsed = parseGeminiJson<FichaExercise>(raw);
    if (!parsed?.tipo || !parsed.enunciado) return null;
    return prepareExercise(cleanExercise(parsed));
  } finally {
    callbacks.onEnd?.();
  }
}

/**
 * Tras cambiar de tema visual, reescribe solo la historia (personaje,
 * misión, cierre, insignia y la frase de cada bloque) para el nuevo mundo.
 * Los ejercicios no se tocan.
 */
export async function rewriteStory(
  content: FichaContent, req: FichaRequest, estilo: FichaThemeId, lang: Lang, callbacks: Callbacks = {},
): Promise<Pick<FichaContent, 'historia' | 'actividades'> | null> {
  if (estilo === 'clasico') return null;
  callbacks.onStart?.();
  try {
    const n = content.actividades.length;
    const schema = {
      type: 'OBJECT',
      properties: {
        historia: HISTORIA_SCHEMA,
        misiones: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              emoji: S('UN emoji para esta misión'),
              narrativa: S('Una frase que une este bloque con la historia'),
            },
            required: ['emoji', 'narrativa'],
            propertyOrdering: ['emoji', 'narrativa'],
          },
          description: `Exactamente ${n}, una por bloque y en el mismo orden`,
        },
      },
      required: ['historia', 'misiones'],
      propertyOrdering: ['historia', 'misiones'],
    } as const;
    const userPrompt =
      fichaContextForPrompt({ ...content, historia: undefined }, req) +
      `Bloques de actividad, en orden:\n${content.actividades.map((a, i) => `${i + 1}. ${a.titulo}`).join('\n')}\n\n` +
      `Escribe la historia de esta ficha y una frase para cada bloque. ` +
      `El mundo de la historia es ${fichaTheme(estilo).ambiente}. ` +
      `Presenta la misión en segunda persona, con emoción y un objetivo claro; tono cercano, sin infantilizar en Secundaria. ` +
      `El idioma de salida DEBE SER ${idioma(lang)}.`;
    const raw = await callGemini(
      'Eres un experto en gamificación educativa y escribes historias breves que motivan al alumnado.',
      userPrompt, [], { onError: callbacks.onError },
      { maxOutputTokens: 2048, responseSchema: schema, thinkingLevel: 'low', temperature: 1.1 },
    );
    if (!raw) return null;
    const parsed = parseGeminiJson<{ historia: FichaHistoria; misiones: { emoji: string; narrativa: string }[] }>(raw);
    if (!parsed?.historia) return null;
    const theme = fichaTheme(estilo);
    return {
      historia: { ...parsed.historia, emoji: cleanEmoji(parsed.historia.emoji, theme.personaje) },
      actividades: content.actividades.map((a, i) => ({
        ...a,
        emoji: cleanEmoji(parsed.misiones?.[i]?.emoji, theme.iconos[i % theme.iconos.length]),
        narrativa: parsed.misiones?.[i]?.narrativa ?? a.narrativa ?? '',
      })),
    };
  } finally {
    callbacks.onEnd?.();
  }
}

/* ── Versiones adaptadas: apoyo, ampliación y lectura fácil ── */

const VARIANTE_PROMPT: Record<FichaVariante, string> = {
  apoyo:
    `Crea la versión de APOYO de esta ficha, para el alumnado que necesita refuerzo. Mismo tema, mismos ` +
    `bloques, mismos tipos de ejercicio y el mismo número de ejercicios, trabajando los contenidos ` +
    `básicos: enunciados más cortos y guiados, números más sencillos, una pista o un ejemplo resuelto donde ` +
    `ayude, problemas con menos pasos y, en opción múltiple, solo 3 opciones.`,
  ampliacion:
    `Crea la versión de AMPLIACIÓN de esta ficha, para el alumnado que necesita más exigencia. Mismo tema, ` +
    `mismos bloques, mismos tipos de ejercicio y el mismo número de ejercicios, pero con más reto: datos ` +
    `más complejos, más pasos, pedir que justifiquen o generalicen, y alguna conexión con otros contenidos.`,
  lectura_facil:
    `Crea la versión en LECTURA FÁCIL de esta ficha, siguiendo las pautas de Lectura Fácil: frases cortas ` +
    `(como mucho 15-20 palabras), una idea por frase, palabras frecuentes, voz activa, sin metáforas, ` +
    `ironías ni dobles negaciones, instrucciones paso a paso y numeradas, y las palabras difíciles ` +
    `explicadas entre paréntesis la primera vez. El contenido académico y el número de ejercicios son los ` +
    `mismos; solo cambia cómo está escrito.`,
};

/**
 * Rehace la ficha entera como versión de apoyo, de ampliación o de lectura
 * fácil, con el mismo tema, la misma historia y el mismo formato. El
 * resultado es una ficha nueva: la original no se toca.
 */
export async function adaptFicha(
  content: FichaContent, req: FichaRequest, variante: FichaVariante, lang: Lang, callbacks: Callbacks = {},
): Promise<FichaContent | null> {
  callbacks.onStart?.();
  try {
    const formato = content.formato ?? 'ficha';
    const estilo: FichaThemeId = content.estilo ?? 'clasico';
    const historia = !!content.historia && estilo !== 'clasico' && formato !== 'tarjetas';
    const original = {
      ...content,
      actividades: content.actividades.map(a => ({ ...a, ejercicios: a.ejercicios.map(exerciseForPrompt) })),
      estilo: undefined, variante: undefined,
    };
    const userPrompt =
      `Tema: ${req.tema}\n` +
      `Área o asignatura: ${req.area || '(no indicada)'}\n` +
      `Curso o nivel: ${req.nivel || '(no indicado)'}\n\n` +
      `Ficha original (JSON):\n${JSON.stringify(original)}\n\n` +
      `${VARIANTE_PROMPT[variante]}\n` +
      (historia ? 'Mantén la misma historia y el mismo personaje, adaptando sus textos al mismo criterio.\n' : '') +
      (formato === 'escape' ? 'Recalcula el código de cada candado para que salga de las nuevas respuestas.\n' : '');
    const raw = await callGemini(systemPrompt(false, lang, historia ? estilo : 'clasico', formato), userPrompt, [], { onError: callbacks.onError }, {
      maxOutputTokens: 16384,
      responseSchema: fichaSchema({ niveles: false, historia, elegirEstilo: false, formato }),
      thinkingLevel: 'medium',
      temperature: 0.9,
    });
    if (!raw) return null;
    const parsed = parseGeminiJson<FichaContent>(raw);
    if (!parsed) return null;
    const out = cleanFichaContent({ ...parsed, actividades: parsed.actividades ?? [] }, historia ? estilo : 'clasico', formato);
    return { ...out, estilo, variante };
  } finally {
    callbacks.onEnd?.();
  }
}

/* ── Editor: añadir a una ficha ya hecha ── */

/**
 * Un ejercicio nuevo para un bloque, que no repita los que ya tiene. Si no se
 * pide un tipo, la IA elige el que mejor complete el bloque.
 */
export async function addExercise(
  content: FichaContent, req: FichaRequest, actIdx: number,
  opts: { tipo?: FichaExerciseType; instruccion?: string },
  lang: Lang, callbacks: Callbacks = {},
): Promise<FichaExercise | null> {
  const act = content.actividades[actIdx];
  if (!act) return null;
  callbacks.onStart?.();
  try {
    const niveles = act.ejercicios.some(e => e.apoyo || e.ampliacion);
    const formato = content.formato ?? 'ficha';
    const userPrompt =
      fichaContextForPrompt(content, req) +
      `Bloque de actividad: ${act.titulo}${act.narrativa ? ` (${act.narrativa})` : ''}\n` +
      `Ejercicios que ya tiene el bloque (no los repitas):\n` +
      act.ejercicios.map((e, i) => `${i + 1}. [${e.tipo}] ${e.enunciado}`).join('\n') + '\n\n' +
      `Crea UN ejercicio nuevo para este bloque, distinto de los anteriores y con el mismo nivel.\n` +
      (opts.tipo ? `Debe ser de tipo "${opts.tipo}".\n` : 'Elige el tipo que mejor complete el bloque, preferiblemente uno que el bloque aún no tenga.\n') +
      (opts.instruccion ? `Indicación del docente: ${opts.instruccion}\n` : '') +
      (formato === 'escape' ? 'Es un escape room: el ejercicio debe tener una respuesta corta y única.\n' : '') +
      `\n${numberVarietyHint()}`;
    const raw = await callGemini(systemPrompt(niveles, lang), userPrompt, [], { onError: callbacks.onError }, {
      maxOutputTokens: 4096,
      responseSchema: fichaExerciseSchema(niveles),
      thinkingLevel: 'low',
      temperature: 1.1,
    });
    if (!raw) return null;
    const parsed = parseGeminiJson<FichaExercise>(raw);
    if (!parsed?.tipo || !parsed.enunciado) return null;
    return prepareExercise(cleanExercise(parsed));
  } finally {
    callbacks.onEnd?.();
  }
}

/** Más tarjetas para un juego ya hecho, sin repetir las que tiene. */
export async function moreCards(
  content: FichaContent, req: FichaRequest, n: number, lang: Lang, callbacks: Callbacks = {},
): Promise<FichaTarjeta[] | null> {
  callbacks.onStart?.();
  try {
    const schema = {
      type: 'OBJECT',
      properties: { tarjetas: { type: 'ARRAY', items: TARJETA_SCHEMA, description: `Exactamente ${n} tarjetas nuevas` } },
      required: ['tarjetas'],
      propertyOrdering: ['tarjetas'],
    } as const;
    const userPrompt =
      `Tema: ${req.tema}\nÁrea o asignatura: ${req.area || '(no indicada)'}\nCurso o nivel: ${req.nivel || '(no indicado)'}\n` +
      `Juego: ${content.titulo}\n\nTarjetas que ya hay (no las repitas):\n` +
      (content.tarjetas ?? []).map((tj, i) => `${i + 1}. ${tj.pregunta}`).join('\n') +
      `\n\nCrea EXACTAMENTE ${n} tarjetas nuevas, distintas de las anteriores y con el mismo nivel.`;
    const raw = await callGemini(tarjetasSystemPrompt(lang, 'clasico'), userPrompt, [], { onError: callbacks.onError }, {
      maxOutputTokens: 4096, responseSchema: schema, thinkingLevel: 'low', temperature: 1.1,
    });
    if (!raw) return null;
    const parsed = parseGeminiJson<{ tarjetas: FichaTarjeta[] }>(raw);
    const list = (parsed?.tarjetas ?? [])
      .filter(tj => tj?.pregunta?.trim())
      .map(tj => ({ pregunta: cleanMathNotation(tj.pregunta), respuesta: cleanMathNotation(tj.respuesta ?? '') }));
    return list.length ? list : null;
  } finally {
    callbacks.onEnd?.();
  }
}
