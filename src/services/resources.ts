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
import { fichaTheme, cleanEmoji, conHistoria, STORY_THEME_IDS, type FichaThemeId } from '../lib/fichaThemes';
import { CONSIGNAS_FICHA, DIBUJOS_FICHA, listaParaIA, pictoDeVerbo, pictoValido } from '../lib/pictosFicha';
import { esContable, hiloDeFicha, hiloPorId, listaDibujosParaIA, type Hilo } from '../lib/hilos';
import { contarDelHilo, enunciadoRotular, esTipoConDibujos, etiquetarDelHilo, solucionDeDibujos } from '../lib/dibujosEjercicio';
import { ilustracionPorId, nombreIlustracion } from '../lib/ilustraciones';
import {
  avisoDeSubida, expectativas, NOMBRE_DIFICULTAD, normalizarEscalera, perfilDeCurso, planDeBloques, planParaPrompt,
  rangoNumerico, type BloquePlan, type Dificultad, type PerfilCurso,
} from '../lib/escalera';
import { ejemploParaPrompt } from './fichaEjemplos';
import {
  NIVELES_LECTURA, actividadesPedido, actividadesSistema, generarTextoLectura, instruccionesDeLectura, lecturaFacilPrompt,
} from './fichaLectura';
import { textoNumerado, type FichaLectura, type GeneroLectura } from '../lib/lectura';
import { equilibrarNegritas, negritaDelVerbo, quitarNegritas } from '../lib/negritas';
import type { Densidad } from '../lib/densidad';
import {
  MAX_FIGURAS_FRACCION, MIN_PARTES, MODOS_FRACCIONES, OBJETOS_FRACCION, completarFiguras, fraccionValida, fraccionesParaEjercicio, solucionFracciones, tieneDecimalExacto,
  type CogidosFraccion, type FraccionDibujo, type ModoFracciones,
} from '../lib/fraccionesDibujo';

/* ── Lo que devuelve la IA ── */

export type FichaExerciseType =
  | 'abierta' | 'completar' | 'opcion_multiple' | 'problema'
  | 'tabla_rellenar' | 'relacionar' | 'colorear' | 'sopa_letras'
  | 'verdadero_falso' | 'ordenar' | 'crucigrama' | 'comic' | 'calculos'
  // Con dibujos del catálogo (hilo conductor): cada dibujo lleva su espacio para contestar
  | 'contar' | 'etiquetar' | 'clasificar'
  // Pizzas y tartas dibujadas por el código con los trozos exactos (`lib/fraccionesDibujo.ts`)
  | 'fracciones'
  // Comprensión lectora (`lib/lectura.ts`): trabajar sobre el texto impreso, contestar varias preguntas y dibujar
  | 'en_texto' | 'contestar' | 'dibujar';

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
   * Solo 'calculos': lo que hay a la izquierda del «=» en cada línea (un número
   * para descomponer, una suma, una expresión). A su derecha, el alumnado
   * escribe la respuesta. Sin el «=» ni el hueco: los pone la ficha.
   */
  lineas?: string[];
  /** Solo 'calculos': dónde se escribe cada respuesta, en una línea o en una caja. Sin él, en línea. */
  respuesta?: 'linea' | 'caja';
  /**
   * Diagrama geométrico opcional (cualquier tipo, pero pensado sobre todo
   * para "problema" de área/perímetro/volumen). El dibujo en sí lo hace
   * `lib/geometryFigures.ts`, no la IA — ver esa cabecera.
   */
  figura?: Figure;
  /**
   * Fichas con apoyos visuales: el pictograma de la acción principal («Lee»,
   * «Rodea», «Escribe»), que se pinta delante del enunciado. Un identificador
   * de `pictos.ts`, elegido por la IA de una lista cerrada (`lib/pictosFicha.ts`).
   */
  consigna?: string;
  /** Fichas con apoyos visuales: dibujos del contenido, cada uno repetido `cantidad` veces (para contar). */
  imagenes?: ImagenEjercicio[];
  /** Solo 'tabla_rellenar' con apoyos visuales: un pictograma por fila ('' = ninguno), en una columna delante. */
  pictosFilas?: string[];
  /**
   * Con hilo conductor (diseño «Cuaderno»): dibujos del catálogo (`lib/ilustraciones.ts`)
   * que ayudan a hacer el ejercicio o lo ambientan, cada uno repetido `cantidad`
   * veces si hay que contarlo. La IA elige de la lista cerrada del hilo; las
   * copias las pone el código al maquetar, así que el recuento es exacto.
   * Cada tipo los usa a su manera: en «contar» cada grupo lleva su caja, en
   * «etiquetar» cada dibujo su línea, en «relacionar» y «tabla_rellenar» van de
   * uno en uno junto a cada elemento de la izquierda o cada fila, y en el resto
   * son una figura al lado del enunciado (uno) o una bandeja (varios).
   */
  dibujos?: DibujoEjercicio[];
  /** Solo 'clasificar': los grupos y los dibujos (identificadores del catálogo) que van en cada uno; la app los mezcla al maquetar. */
  categorias?: CategoriaDibujos[];
  /** Solo 'contar' con varios grupos: además de cada grupo, una caja para el total. */
  total?: boolean;
  /** Solo 'etiquetar': encima de los dibujos, el banco con las palabras (desordenadas) para quien necesite ayuda. */
  banco?: boolean;
  /**
   * Pizzas o tartas de 2 a 12 trozos iguales, dibujadas por el código a partir de estos números
   * (`lib/fraccionesDibujo.ts`): la imagen y el ejercicio coinciden siempre. En «fracciones» son el
   * ejercicio (cada figura con su espacio para contestar); en problema, abierta, completar y opción
   * múltiple, la figura de la que habla el enunciado (de 1 a 3).
   */
  fracciones?: FraccionDibujo[];
  /** Solo 'fracciones': «leer» (se ve la pizza con los trozos cogidos y se escribe la fracción), «colorear» (la pizza en blanco y se colorean los trozos que dice su fracción) o «unir» (pizzas a un lado y valores al otro). Sin él, «leer». */
  modo?: ModoFracciones;
  /** Solo 'fracciones' en «leer» y «unir»: además de la fracción, su decimal (solo con 2, 4, 5, 8 o 10 trozos, que lo tienen exacto). */
  decimal?: boolean;
  /** Cómo se ven los trozos cogidos: en blanco y negro, separados o las dos cosas. Sin él, las dos. */
  cogidos?: CogidosFraccion;
  /** Solo 'contestar': de 2 a 4 preguntas cortas, cada una con su línea para la respuesta. */
  preguntas?: string[];
  /** Solo 'en_texto' y 'dibujar': las líneas que se dejan para escribir (0 si solo se marca en el texto o se dibuja). */
  lineasRespuesta?: number;
  /** Solo 'completar': el recuadro con las palabras con las que se rellenan los huecos (con alguna de más). */
  bancoPalabras?: string[];
  /** Para el profesorado — nunca se muestra en la ficha exportada. */
  solucion: string;
  /** Variante simplificada del mismo ejercicio. Solo si se pidieron niveles. */
  apoyo?: string;
  /** Variante de más nivel del mismo ejercicio. Solo si se pidieron niveles. */
  ampliacion?: string;
}

/** Un grupo de un ejercicio «clasificar»: su nombre («Domésticos») y los dibujos que le tocan. */
export interface CategoriaDibujos {
  nombre: string;
  dibujos: string[];
}

/** Un dibujo del catálogo dentro de un ejercicio: su identificador y cuántas veces se dibuja (de 1 a 10). */
export interface DibujoEjercicio {
  ilustracion: string;
  cantidad?: number;
}

/** Un dibujo dentro de un ejercicio: un pictograma, repetido `cantidad` veces si hay que contarlo. */
export interface ImagenEjercicio {
  picto: string;
  cantidad?: number;
}

/** Un paso de la consigna de un bloque: «Lee» (verbo) + «cada enunciado» (detalle), con su pictograma. */
export interface PasoVisual {
  picto: string;
  verbo: string;
  detalle: string;
}

/** Una línea del recuadro «Recuerda» de un bloque, con su dibujo si lo hay. */
export interface RecuerdaVisual {
  picto?: string;
  texto: string;
}

/** Una tarjeta de la explicación: un dibujo, su nombre y una frase. */
export interface ConceptoVisual {
  picto: string;
  titulo: string;
  texto: string;
}

/**
 * El recuadro que acompaña a un bloque en el diseño «Cuaderno»: «Recuerda»
 * (lo que hay que saber para hacerlo, con chincheta), «Reto» (una pregunta
 * extra con su hueco, con estrella) o «Consejo» (una pista de método, con
 * bombilla).
 */
export type FichaRecuadroTipo = 'recuerda' | 'reto' | 'consejo';

export interface FichaRecuadro {
  tipo: FichaRecuadroTipo;
  /** La frase o la pregunta del reto. */
  texto: string;
  /** Solo «Recuerda»: equivalencias o datos, uno por línea («CM = centena de millar»). */
  lista?: string[];
}

/** Un bloque con título propio (p. ej. "Escribe como potencia") y sus ejercicios. */
export interface FichaActivity {
  titulo: string;
  /**
   * El peldaño de la escalera (`lib/escalera.ts`): 1 para empezar, 2 para practicar,
   * 3 para retarte. Las fichas van «de menos a más»; las guardadas antes de esto no lo traen.
   */
  dificultad?: Dificultad;
  ejercicios: FichaExercise[];
  /** Solo en el diseño «Cuaderno»: el recuadro lateral del bloque. */
  recuadro?: FichaRecuadro;
  /** Con apoyos visuales: qué hay que hacer en el bloque, en una frase y en orden. */
  indicacion?: string;
  /** Con apoyos visuales: de 2 a 4 pasos numerados, cada uno con su pictograma. */
  pasos?: PasoVisual[];
  /** Con apoyos visuales: lo que hay que recordar para hacerlo, en frases cortas con dibujo. */
  recuerda?: RecuerdaVisual[];
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
export type FichaVariante = 'apoyo' | 'ampliacion' | 'lectura_facil' | 'visual';

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
  /**
   * El hilo conductor (`lib/hilos.ts`): de qué trata la ficha, para ilustrarla
   * con los dibujos de ese mundo. Solo en «Cuaderno» y sin apoyos visuales; sin
   * él, la cabecera es la del área y los ejercicios no llevan dibujos.
   */
  hilo?: string;
  /**
   * La densidad de la hoja «Cuaderno» (`lib/densidad.ts`) si el docente la fijó a mano; sin ella, la elige la
   * app al imprimir midiendo la hoja (el compositor).
   */
  densidad?: Densidad;
  historia?: FichaHistoria;
  /** Sin él, 'ficha'. */
  formato?: FichaFormato;
  /** Solo en 'tarjetas'. */
  tarjetas?: FichaTarjeta[];
  variante?: FichaVariante;
  /**
   * Con apoyos visuales: cada bloque lleva sus pasos con pictogramas, los
   * ejercicios su consigna dibujada y la explicación sus tarjetas. Pensado
   * para el alumnado que necesita las instrucciones muy visuales (TEA,
   * dificultades de comprensión…). Ver `lib/pictosFicha.ts`.
   */
  visual?: boolean;
  /** Con apoyos visuales: las tarjetas de la explicación. */
  conceptos?: ConceptoVisual[];
  /**
   * Comprensión lectora (`lib/lectura.ts`): el texto de la ficha con sus dibujos. Sin él, es una ficha de ejercicios.
   * Las actividades se hacen sobre este texto y el título de la ficha es el del texto.
   */
  lectura?: FichaLectura;
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
  /** Instrucciones muy visuales, con pasos y pictogramas (no en tarjetas). */
  visual?: boolean;
  /** El hilo conductor: un identificador de `lib/hilos.ts`, 'ninguno' (sin dibujos) o 'auto' (lo elige la app por el tema). Sin él, 'auto'. */
  hilo?: string;
  /** Que la IA revise su propia ficha y se rehagan los ejercicios graves (cuentas mal, datos imposibles, nivel flojo). Sin él, sí. */
  revisar?: boolean;
  /** Comprensión lectora: un texto con dibujos y actividades sobre él (siempre en «Cuaderno»). */
  lectura?: boolean;
  /** Comprensión lectora: el tipo de texto; sin él, la IA elige el que encaja con el tema. */
  generoLectura?: GeneroLectura | 'auto';
  /** Lectura fácil para dislexia: frases cortas, palabras clave en negrita y letra más grande. */
  facil?: boolean;
}

export type FichaThemeChoice = FichaThemeId | 'auto';

const idioma = (lang: Lang) => (lang === 'en' ? 'INGLÉS' : lang === 'ca' ? 'CATALÁN (català)' : 'ESPAÑOL');

/* ── Esquema de salida ── */

const S = (d: string) => ({ type: 'STRING', description: d });

export const TIPOS: FichaExerciseType[] = [
  'abierta', 'completar', 'opcion_multiple', 'problema', 'tabla_rellenar', 'relacionar', 'colorear', 'sopa_letras',
  'verdadero_falso', 'ordenar', 'crucigrama', 'comic', 'calculos', 'contar', 'etiquetar', 'clasificar', 'fracciones',
  'en_texto', 'contestar', 'dibujar',
];

/** Los tipos propios de la comprensión lectora: sin texto no tienen sentido. */
export const TIPOS_DE_LECTURA: readonly FichaExerciseType[] = ['en_texto', 'contestar', 'dibujar'];

/** En una ficha de lectura no hay cálculo ni medidas: lo que se trabaja es el texto. */
const TIPOS_SIN_LECTURA: readonly FichaExerciseType[] = ['problema', 'calculos', 'colorear', 'contar', 'etiquetar', 'clasificar', 'fracciones'];

/**
 * Los tipos que se ofrecen a la IA y en el editor: los de dibujos solo con hilo, «fracciones» solo con el diseño
 * «Cuaderno» y, en una ficha de comprensión lectora, los de lectura (y no los de cálculo).
 */
export function tiposDisponibles(o: { dibujos: boolean; fracciones: boolean; lectura?: boolean }): FichaExerciseType[] {
  if (o.lectura) return TIPOS.filter(t => !TIPOS_SIN_LECTURA.includes(t));
  return TIPOS.filter(t => !TIPOS_DE_LECTURA.includes(t) && (t === 'fracciones' ? o.fracciones : o.dibujos || !esTipoConDibujos(t)));
}


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
const FRACCION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    partes: { type: 'INTEGER', description: `Trozos iguales en que está cortada la pizza o la tarta, de ${MIN_PARTES} a 10` },
    tomadas: { type: 'INTEGER', description: 'Trozos que se cogen (salen en blanco y negro y separados), de 0 a "partes"' },
    objeto: { type: 'STRING', enum: [...OBJETOS_FRACCION], description: '"pizza" o "tarta"' },
  },
  required: ['partes', 'tomadas'],
  propertyOrdering: ['partes', 'tomadas', 'objeto'],
} as const;

const IMAGEN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    picto: S('Identificador de un dibujo de la lista DIBUJOS, exactamente como está escrito'),
    cantidad: { type: 'INTEGER', description: 'Cuántas veces se dibuja, de 1 a 10: las que hay que contar, o 1 si solo se muestra' },
  },
  required: ['picto', 'cantidad'],
  propertyOrdering: ['picto', 'cantidad'],
} as const;

const DIBUJO_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ilustracion: S('Identificador de un dibujo de la lista DIBUJOS DEL HILO, exactamente como está escrito ("" solo en "relacionar" y "tabla_rellenar", para un elemento sin dibujo)'),
    cantidad: { type: 'INTEGER', description: 'Cuántas veces se dibuja, de 1 a 10: las que hay que contar, o 1 si solo se muestra' },
  },
  required: ['ilustracion', 'cantidad'],
  propertyOrdering: ['ilustracion', 'cantidad'],
} as const;

const CATEGORIA_SCHEMA = {
  type: 'OBJECT',
  properties: {
    nombre: S('Nombre corto del grupo, ej. "Animales domésticos"'),
    dibujos: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Identificadores de la lista DIBUJOS DEL HILO que van en este grupo, exactamente como están escritos' },
  },
  required: ['nombre', 'dibujos'],
  propertyOrdering: ['nombre', 'dibujos'],
} as const;

const PASO_SCHEMA = {
  type: 'OBJECT',
  properties: {
    picto: S('Identificador del pictograma de la acción, de la lista CONSIGNAS, exactamente como está escrito'),
    verbo: S('El verbo en imperativo, UNA palabra: "Lee", "Rodea", "Escribe", "Cuenta"'),
    detalle: S('Qué, en 2 a 6 palabras: "cada enunciado", "la unidad que corresponde"'),
  },
  required: ['picto', 'verbo', 'detalle'],
  propertyOrdering: ['picto', 'verbo', 'detalle'],
} as const;

const RECUERDA_SCHEMA = {
  type: 'OBJECT',
  properties: {
    picto: S('Identificador de un dibujo de la lista DIBUJOS que lo represente, o "" si no hay ninguno que encaje'),
    texto: S('Una frase muy corta con algo que hay que saber para hacer el bloque, ej. "El agua se mide en litros (l)"'),
  },
  required: ['picto', 'texto'],
  propertyOrdering: ['picto', 'texto'],
} as const;

const CONCEPTO_SCHEMA = {
  type: 'OBJECT',
  properties: {
    picto: S('Identificador de un dibujo de la lista DIBUJOS que represente el concepto'),
    titulo: S('El concepto en 1 a 4 palabras, ej. "Longitud (largo)"'),
    texto: S('Qué es, en UNA frase corta y concreta, ej. "Mide lo largo que es algo. Usamos centímetros (cm)."'),
  },
  required: ['picto', 'titulo', 'texto'],
  propertyOrdering: ['picto', 'titulo', 'texto'],
} as const;

function fichaExerciseSchema(niveles: boolean, visual = false, dibujos = false, fracciones = false, lectura = false) {
  const base = ['tipo', 'enunciado', ...(visual ? ['consigna'] : []), 'solucion'] as const;
  return {
    type: 'OBJECT',
    properties: {
      tipo: {
        type: 'STRING', enum: tiposDisponibles({ dibujos, fracciones, lectura }),
        description:
          '"abierta" respuesta libre, "completar" huecos, "opcion_multiple" varias opciones, ' +
          '"problema" cálculo o razonamiento con pasos, "tabla_rellenar" tabla con celdas en blanco, ' +
          '"relacionar" dos columnas para unir a mano, "colorear" leyenda de colores + elementos a colorear, ' +
          '"sopa_letras" lista de palabras para buscar en una rejilla, "verdadero_falso" frases para marcar V o F, ' +
          '"ordenar" pasos o elementos para numerar en orden, "crucigrama" palabras con pistas, ' +
          '"comic" tira de viñetas con bocadillos, alguno vacío para que lo escriba el alumnado, ' +
          '"calculos" lista de números o cuentas, cada una con su hueco para la respuesta a la derecha del "="' +
          (dibujos
            ? ', "contar" grupos de dibujos que se cuentan, cada uno con su caja para el número, ' +
              '"etiquetar" dibujos de los que se escribe el nombre, "clasificar" dibujos que se reparten en grupos'
            : '') +
          (fracciones ? ', "fracciones" pizzas o tartas cortadas en trozos iguales, cada una con su espacio para contestar' : '') +
          (lectura
            ? ', "en_texto" rodear, subrayar o buscar palabras o frases en el texto impreso, "contestar" varias preguntas cortas cada una con su línea, ' +
              '"dibujar" un recuadro para dibujar lo que se imagina del texto'
            : ''),
      },
      enunciado: S('El texto del ejercicio o la pregunta, autocontenido'),
      ...(visual ? {
        consigna: S('Identificador del pictograma de la acción principal del ejercicio, de la lista CONSIGNAS'),
        pictosFilas: {
          type: 'ARRAY', items: { type: 'STRING' },
          description: 'Solo si tipo es "tabla_rellenar": un identificador de DIBUJOS por fila, en el orden de "filas", o "" en la fila que no sea algo que se pueda dibujar',
        },
        imagenes: {
          type: 'ARRAY', items: IMAGEN_SCHEMA,
          description: 'Solo si un dibujo ayuda a entender o a hacer el ejercicio (contar objetos, reconocerlos, compararlos): de 1 a 4 dibujos distintos. Nunca de adorno.',
        },
      } : {}),
      ...(dibujos ? {
        dibujos: {
          type: 'ARRAY', items: DIBUJO_SCHEMA,
          description:
            'Los dibujos del ejercicio, de la lista del hilo. En "contar": de 1 a 3 grupos de los que se cuentan, cada uno con su ' +
            'cantidad EXACTA. En "etiquetar": de 3 a 8 dibujos distintos (cantidad 1). En "relacionar" y "tabla_rellenar": UN ' +
            'dibujo por elemento de "izquierda" o por fila, en el mismo orden ("" si un elemento no se puede dibujar). En ' +
            '"problema", "abierta", "completar" y "opcion_multiple": de 1 a 3 solo si ilustran lo que cuenta el enunciado. ' +
            'En "clasificar" no se usa (van en "categorias"). En el resto de tipos, ninguno.',
        },
        categorias: {
          type: 'ARRAY', items: CATEGORIA_SCHEMA,
          description: 'Solo si tipo es "clasificar": de 2 a 3 grupos, con los dibujos que van en cada uno (de 4 a 10 dibujos en total, sin repetir)',
        },
        total: { type: 'BOOLEAN', description: 'Solo si tipo es "contar" con 2 o 3 grupos y el enunciado pide también el total: true' },
        banco: { type: 'BOOLEAN', description: 'Solo si tipo es "etiquetar": true para dar las palabras (desordenadas) encima de los dibujos, en cursos bajos' },
      } : {}),
      ...(fracciones ? {
        fracciones: {
          type: 'ARRAY', items: FRACCION_SCHEMA,
          description:
            'Pizzas o tartas dibujadas por la aplicación con estos números. En "fracciones": de 3 a 4, con distinto número de trozos. ' +
            'En problema, abierta, completar y opcion_multiple: de 1 a 3, exactamente lo que dice el enunciado. En el resto de tipos, ninguna.',
        },
        modo: {
          type: 'STRING', enum: [...MODOS_FRACCIONES],
          description: 'Solo si tipo es "fracciones": "leer" (se ve la pizza con los trozos cogidos y se escribe la fracción), "colorear" (pizza en blanco y se colorean los trozos que dice la fracción) o "unir" (pizzas a un lado y fracciones al otro para unir)',
        },
        decimal: { type: 'BOOLEAN', description: 'Solo si tipo es "fracciones" en "leer" o "unir": true para pedir también el decimal (solo con 2, 4, 5, 8 o 10 trozos)' },
      } : {}),
      ...(lectura ? {
        preguntas: {
          type: 'ARRAY', items: { type: 'STRING' },
          description: 'Solo si tipo es "contestar": de 2 a 4 preguntas cortas sobre el texto, cada una con su línea para la respuesta',
        },
        lineasRespuesta: {
          type: 'INTEGER',
          description: 'Solo si tipo es "en_texto" o "dibujar": las líneas que se dejan para escribir (0 si solo se marca en el texto o se dibuja; 1 o 2 si hay que escribir lo encontrado)',
        },
        bancoPalabras: {
          type: 'ARRAY', items: { type: 'STRING' },
          description: 'Solo si tipo es "completar": de 4 a 8 palabras para rellenar los huecos, con alguna de más; en un recuadro encima de las frases',
        },
      } : {}),
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
      lineas: {
        type: 'ARRAY', items: { type: 'STRING' },
        description:
          'Solo si tipo es "calculos": de 2 a 6 líneas, cada una con lo que va A LA IZQUIERDA del "=" (un número ' +
          'para descomponer, una suma, una expresión). Sin el "=" ni la respuesta: la ficha pone el hueco.',
      },
      respuesta: {
        type: 'STRING', enum: ['linea', 'caja'],
        description: 'Solo si tipo es "calculos": "linea" si la respuesta es larga (una descomposición, una expresión), "caja" si es corta (un número)',
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
      'tipo', 'enunciado', ...(visual ? ['consigna'] : []), 'opciones', 'columnas', 'filas', ...(visual ? ['pictosFilas'] : []),
      'izquierda', 'derecha', 'leyenda', 'itemsColorear', 'palabras', 'afirmaciones', 'elementos', 'pistas', 'vinetas',
      'lineas', 'respuesta', 'figura', ...(visual ? ['imagenes'] : []), ...(dibujos ? ['dibujos', 'categorias', 'total', 'banco'] : []),
      ...(fracciones ? ['fracciones', 'modo', 'decimal'] : []),
      ...(lectura ? ['preguntas', 'lineasRespuesta', 'bancoPalabras'] : []),
      'solucion', ...(niveles ? ['apoyo', 'ampliacion'] : []),
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
  /** Apoyos visuales: pasos con pictogramas, consignas dibujadas y tarjetas de concepto. */
  visual?: boolean;
  /** Diseño «Cuaderno»: cada bloque puede llevar su recuadro lateral. */
  cuaderno?: boolean;
  /** Con hilo conductor: los ejercicios pueden llevar dibujos del catálogo. */
  dibujos?: boolean;
  /** La escalera de dificultad: cada bloque trae su nivel y el número de bloques es el del reparto. */
  escalera?: BloquePlan[];
  /** Tema de fracciones en «Cuaderno»: los ejercicios pueden llevar pizzas y tartas dibujadas por la aplicación. */
  fracciones?: boolean;
  /** Comprensión lectora: solo las actividades (el texto se pide aparte) y los tipos de ejercicio de lectura. */
  lectura?: boolean;
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

const RECUADRO_SCHEMA = {
  type: 'OBJECT',
  properties: {
    tipo: {
      type: 'STRING', enum: ['recuerda', 'reto', 'consejo'],
      description: '"recuerda": datos o equivalencias que hacen falta para el bloque; "reto": una pregunta extra algo más difícil; "consejo": una pista de método',
    },
    texto: S('"consejo" y "reto": la frase o la pregunta, 1 a 3 frases cortas. "recuerda": una introducción muy corta, o "" si basta la lista'),
    lista: {
      type: 'ARRAY', items: { type: 'STRING' },
      description: 'Solo en "recuerda": de 2 a 8 líneas del tipo "CM = centena de millar" (siglas o términos con su significado)',
    },
  },
  required: ['tipo', 'texto'],
  propertyOrdering: ['tipo', 'texto', 'lista'],
} as const;

function fichaActivitySchema(o: SchemaOpts) {
  const story = o.historia ? {
    emoji: S('UN emoji que represente esta misión dentro de la historia'),
    narrativa: S('Una frase que conecta este bloque con la historia, ej. "El motor de la nave se ha roto: resuelve estas potencias para repararlo"'),
  } : {};
  const escape = o.formato === 'escape';
  const vis = o.visual ? ['indicacion', 'pasos', 'recuerda'] : [];
  const tail = [...vis, 'ejercicios', ...(o.cuaderno ? ['recuadro'] : []), ...(escape ? ['candado'] : [])];
  const escalera = o.escalera?.length ? ['dificultad'] : [];
  return {
    type: 'OBJECT',
    properties: {
      titulo: S('Título breve del bloque de actividad, ej. "Escribe como potencia"'),
      ...(escalera.length ? {
        dificultad: {
          type: 'INTEGER',
          description:
            'El nivel del bloque en la escalera de dificultad: 1 = para empezar (fácil), 2 = para practicar, 3 = para retarte (difícil). ' +
            'Los bloques van de menos a más: el primero es el 1 y el último el 3.',
        },
      } : {}),
      ...story,
      ...(o.visual ? {
        indicacion: S('Qué hay que hacer en este bloque, en UNA frase corta y en orden, ej. "Primero, lee. Luego, rodea la unidad. Por último, escribe la respuesta."'),
        pasos: { type: 'ARRAY', items: PASO_SCHEMA, description: 'De 2 a 4 pasos, en el orden en que se hacen' },
        recuerda: { type: 'ARRAY', items: RECUERDA_SCHEMA, description: 'De 0 a 3 cosas que hay que recordar para hacer el bloque' },
      } : {}),
      ejercicios: { type: 'ARRAY', items: fichaExerciseSchema(o.niveles, o.visual, o.dibujos, o.fracciones, o.lectura) },
      ...(o.cuaderno ? {
        recuadro: {
          ...RECUADRO_SCHEMA,
          description: 'Opcional: un recuadro lateral para este bloque. Solo en algunos bloques (no en todos) y solo si aporta algo.',
        },
      } : {}),
      ...(escape ? { candado: CANDADO_SCHEMA } : {}),
    },
    required: ['titulo', ...escalera, ...(o.historia ? ['emoji', 'narrativa'] : []), ...tail.filter(k => k !== 'recuadro')],
    propertyOrdering: ['titulo', ...escalera, ...(o.historia ? ['emoji', 'narrativa'] : []), ...tail],
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

/** Las actividades de una ficha de comprensión lectora: el texto, la explicación y las instrucciones no las escribe esta llamada. */
function lecturaSchema(o: SchemaOpts) {
  return {
    type: 'OBJECT',
    properties: {
      actividades: {
        type: 'ARRAY', items: fichaActivitySchema(o),
        ...(o.escalera?.length
          ? {
            minItems: o.escalera.length, maxItems: o.escalera.length,
            description: `EXACTAMENTE ${o.escalera.length} bloques de actividad, de menos a más dificultad, cada uno con su título, su nivel y sus propios ejercicios`,
          }
          : { description: 'De 2 a 4 bloques de actividad, cada uno con su título y sus propios ejercicios' }),
      },
    },
    required: ['actividades'],
    propertyOrdering: ['actividades'],
  } as const;
}

function fichaSchema(o: SchemaOpts) {
  if (o.formato === 'tarjetas') return tarjetasSchema(o);
  if (o.lectura) return lecturaSchema(o);
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
      ...(o.visual ? {
        conceptos: { type: 'ARRAY', items: CONCEPTO_SCHEMA, description: 'De 2 a 4 tarjetas que explican el concepto, cada una con su dibujo' },
      } : {}),
      instrucciones: S('Instrucciones generales para el alumnado, dos o tres frases'),
      actividades: {
        type: 'ARRAY', items: fichaActivitySchema(o),
        // Solo el número de bloques: con los ejercicios de cada bloque también limitados, Gemini responde 400 «invalid argument» (comprobado el 14-10-2026).
        // Cuántos ejercicios lleva cada bloque lo ajusta el código después (`ajustarAlReparto`)
        ...(o.escalera?.length
          ? {
            minItems: o.escalera.length, maxItems: o.escalera.length,
            description: `EXACTAMENTE ${o.escalera.length} bloques de actividad, de menos a más dificultad, cada uno con su título, su nivel y sus propios ejercicios`,
          }
          : { description: 'De 2 a 4 bloques de actividad, cada uno con su título y sus propios ejercicios' }),
      },
    },
    required: [...head, 'explicacion', ...(o.visual ? ['conceptos'] : []), 'instrucciones', 'actividades'],
    propertyOrdering: [...head, 'explicacion', ...(o.visual ? ['conceptos'] : []), 'instrucciones', 'actividades'],
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

/**
 * La parte del prompt de las fichas con apoyos visuales (alumnado con TEA,
 * con dificultades de comprensión…): pasos numerados con pictogramas, una
 * consigna dibujada por ejercicio, dibujos del contenido y tarjetas en la
 * explicación. Los pictogramas salen de una lista cerrada; la IA no dibuja.
 */
function visualPrompt(): string {
  return (
    `APOYOS VISUALES: esta ficha es para alumnado que necesita las instrucciones MUY visuales (por ejemplo, ` +
    `alumnado con TEA o con dificultades de comprensión). Además de lo anterior:\n` +
    `- Enunciados cortos, una sola tarea por enunciado, vocabulario concreto y frecuente, sin dobles negaciones ` +
    `ni frases hechas. Mejor varios ejercicios cortos que uno largo.\n` +
    `- En la ficha, "conceptos": de 2 a 4 tarjetas que explican el concepto, cada una con un dibujo ("picto"), ` +
    `su nombre ("titulo") y una frase ("texto").\n` +
    `- En cada bloque, "indicacion": qué hay que hacer, en una frase y en orden ("Primero, lee. Luego, rodea…"); ` +
    `y "pasos": de 2 a 4 pasos en el orden en que se hacen, cada uno con el pictograma de la acción ("picto", de ` +
    `CONSIGNAS), el verbo en imperativo en una palabra ("verbo") y qué, en pocas palabras ("detalle"). Los pasos ` +
    `tienen que ser los que de verdad hay que hacer en los ejercicios de ese bloque.\n` +
    `- En cada bloque, "recuerda": de 0 a 3 frases muy cortas con lo que hay que saber para hacerlo, cada una con ` +
    `un dibujo de DIBUJOS solo si representa de verdad lo que dice la frase ("" si no hay ninguno así).\n` +
    `- En cada ejercicio, "consigna": el pictograma de su acción principal (de CONSIGNAS).\n` +
    `- "imagenes", solo cuando un dibujo ayude a entender o a hacer el ejercicio: los objetos que hay que contar ` +
    `(con su "cantidad", que tiene que coincidir con el enunciado y la solución), reconocer o comparar. Si el ` +
    `ejercicio se refiere a lo que se ve en los dibujos, dilo en el enunciado ("Cuenta las manzanas que ves"). ` +
    `No pongas dibujos de adorno.\n` +
    `- En "tabla_rellenar", "pictosFilas": un dibujo por fila cuando cada fila sea algo que se pueda dibujar.\n` +
    `- Un dibujo tiene que ser EXACTAMENTE lo que nombra: si en DIBUJOS no está esa cosa, no pongas uno parecido ` +
    `(un gato no es un tigre, una vaca no es un toro): deja "" o no pongas dibujo. Un dibujo equivocado confunde ` +
    `más que ninguno. Y nunca un dibujo que dé la respuesta (en «¿cuál de estos es un ave?», no dibujes un pájaro).\n` +
    `- Usa SOLO identificadores de estas dos listas, escritos exactamente igual (el nombre entre paréntesis es ` +
    `para que sepas qué es cada uno; no lo copies):\n` +
    `CONSIGNAS: ${listaParaIA(CONSIGNAS_FICHA)}\n` +
    `DIBUJOS: ${listaParaIA(DIBUJOS_FICHA)}\n`
  );
}

/**
 * La parte del prompt del diseño «Cuaderno»: una hoja de colegio, con bloques
 * numerados y, en algunos, un recuadro lateral que acompaña a los ejercicios.
 */
function cuadernoPrompt(): string {
  return (
    `DISEÑO CUADERNO: la ficha se imprime como una hoja de cuaderno de colegio, compacta, con cada bloque ` +
    `numerado y los ejercicios cortos y directos (sin historia ni personajes). Además de lo anterior:\n` +
    `- En los bloques de nivel 1 y 2 prefiere ejercicios que se contesten en poco espacio: "calculos" (varias ` +
    `líneas con su hueco), "tabla_rellenar", "completar", "relacionar", "ordenar" (con números o palabras cortas), ` +
    `"verdadero_falso". Un bloque puede mezclar dos o tres ejercicios cortos (por ejemplo, una lista de ` +
    `"calculos" para descomponer y otra para volver a escribir el número). En el de nivel 3 son buenos ` +
    `"problema" y "abierta": la hoja les deja su espacio para escribir las operaciones y la respuesta.\n` +
    `- En "recuadro" añade una nota breve a algunos bloques, como mucho una por bloque: "recuerda" (la leyenda o las ` +
    `equivalencias que se necesitan para el bloque, en "lista", líneas "SIGLA = significado"), "reto" (en "texto", ` +
    `una pregunta extra algo más difícil, de respuesta corta) o "consejo" (en "texto", una pista de método). ` +
    `No repitas en el recuadro el contenido de "explicacion". ` +
    `Que no se contesten en el recuadro cosas que ya se preguntan en los ejercicios.\n`
  );
}

/**
 * La parte del prompt del hilo conductor: de qué «mundo» es la ficha y con qué
 * dibujos de ese mundo (lista cerrada del catálogo) se pueden ilustrar los
 * ejercicios. La IA nunca dibuja: elige.
 */
function hiloPrompt(hilo: Hilo, lang: Lang): string {
  return (
    `HILO CONDUCTOR: esta ficha gira alrededor de «${hilo.nombre.es}». Cuando encaje con el contenido, ambienta ` +
    `los enunciados en ese mundo (los datos, los objetos y las situaciones: «En la granja hay…»), sin forzarlo y ` +
    `sin perder el rigor del tema.\n` +
    `DIBUJOS: la ficha se ilustra con dibujos del catálogo y cada dibujo lleva en la hoja SU espacio para ` +
    `contestar, así que úsalos donde el alumnado tenga algo que hacer con ellos:\n` +
    `- "contar": de 1 a 3 "dibujos" de los marcados con × (los que se pueden repetir), cada uno con su ` +
    `"cantidad" EXACTA. La ficha dibuja cada grupo con una caja al lado para escribir cuántos hay. Con 2 o 3 ` +
    `grupos y "total": true, añade una caja para el total (para sumar). El enunciado dice qué se cuenta ` +
    `(«Cuenta cuántos animales hay de cada tipo»). Las cantidades son distintas entre sí (nunca 10 y 10) y pequeñas: ` +
    `hasta 6 en 1.º y 2.º, hasta 9 en 3.º. La solución se calcula sola.\n` +
    `- "etiquetar": de 3 a 8 "dibujos" distintos (cantidad 1); el alumnado escribe el nombre de cada uno ` +
    `debajo. Con "banco": true se le dan las palabras desordenadas (cursos bajos). Solo con dibujos que se ` +
    `nombren con una palabra clara y que el alumnado conozca.\n` +
    `- "clasificar": en "categorias", de 2 a 3 grupos con su "nombre" y los "dibujos" de cada uno (de 4 a 10 ` +
    `dibujos en total, sin repetir, cada dibujo en un solo grupo): la ficha los mezcla y el alumnado escribe el ` +
    `número de cada dibujo en su grupo. El enunciado lo explica («Escribe el número de cada animal en su grupo»).\n` +
    `- "relacionar" y "tabla_rellenar": si cada elemento de "izquierda" (o cada fila) se puede dibujar, "dibujos" ` +
    `lleva UN dibujo por elemento, en el mismo orden, y el texto se mantiene ("" en el elemento que no tenga).\n` +
    `- "problema", "abierta", "completar" y "opcion_multiple": de 1 a 3 "dibujos" solo si ilustran de verdad lo ` +
    `que cuenta el enunciado (la pizza del problema de fracciones, el castillo de la pregunta). Un dibujo suelto ` +
    `queda al lado del enunciado.\n` +
    `Si el enunciado habla de lo que se ve («debajo de cada animal», «en la imagen», «los dibujos»), el ejercicio ` +
    `TIENE que llevar esos dibujos (en "etiquetar", "contar", "clasificar" o "dibujos"); si no los pones, no ` +
    `hables de dibujos. En "contar" se cuentan los propios dibujos repetidos («Cuenta cuántas naranjas hay»), ` +
    `nunca partes de un dibujo (gajos, trozos, patas): un dibujo con partes (la pizza, la tarta) va con 1 de ` +
    `cantidad. El "banco" solo en 1.º a 3.º de Primaria.\n` +
    `Reglas: la "cantidad" coincide con el enunciado; los marcados [solo 1] no se repiten; no pongas un dibujo ` +
    `que dé la respuesta ni uno que no sea EXACTAMENTE lo que nombra el ejercicio (un gato no es un tigre); ` +
    `nunca dibujos de adorno. Con un tema concreto (animales, objetos, lugares, oficios), en cursos bajos, ` +
    `lleva dibujos al menos la mitad de los ejercicios y empieza por los de contar, rotular y clasificar; con un ` +
    `tema abstracto o en cursos altos, pocos y solo donde ayuden.\n` +
    `DIBUJOS DEL HILO (usa SOLO estos identificadores, escritos exactamente igual; la descripción entre ` +
    `paréntesis es para que sepas qué es cada uno): ${listaDibujosParaIA(hilo, lang)}\n`
  );
}

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

/** Las pizzas del catálogo (un dibujo de IA, con los trozos desiguales): no valen para contar trozos. */
const PIZZAS_DEL_CATALOGO = new Set(['mat-pizza', 'mat-grafico-tarta']);

const RE_TEMA_FRACCIONES = /fracci|decimal|porcentaj|proporci|reparto|repartir|mitad|racional|partes? iguales/i;

/**
 * ¿Se le ofrecen a la IA las pizzas por fracciones? Solo en «Cuaderno», sin apoyos visuales, en una
 * ficha normal y con un tema de fracciones, decimales o repartos.
 */
export function admiteFracciones(
  c: { estilo?: FichaThemeChoice; formato?: FichaFormato; visual?: boolean }, req: Pick<FichaRequest, 'tema' | 'area'>,
): boolean {
  return c.estilo === 'cuaderno' && (c.formato ?? 'ficha') === 'ficha' && !c.visual && RE_TEMA_FRACCIONES.test(`${req.tema ?? ''} ${req.area ?? ''}`);
}

/** El enunciado remite a unas pizzas o figuras dibujadas («la parte coloreada de cada figura», «mira las pizzas»): sin ellas, no se puede hacer. */
const RE_HABLA_DE_FIGURAS = /\b(?:partes?|trozos?)\s+(?:coloread|sombread|en gris|grises)|\b(?:mira|observa|f[ií]jate en)\s+(?:en\s+)?(?:la|las|cada|esta|estas)\s+(?:pizzas?|figuras?|tartas?)\b|\bfiguras?\s+(?:de arriba|dibujad|siguientes?|que ves)\b|\bcada\s+figura\b/i;

const TIPOS_QUE_REMITEN_A_FIGURAS: readonly FichaExerciseType[] = ['abierta', 'completar', 'opcion_multiple', 'problema'];

/** ¿Este ejercicio habla de pizzas o figuras dibujadas y no lleva ninguna? */
export function hablaDeFigurasSinFiguras(ex: FichaExercise): boolean {
  return TIPOS_QUE_REMITEN_A_FIGURAS.includes(ex.tipo) && !ex.fracciones?.length && !ex.dibujos?.length && !ex.figura && RE_HABLA_DE_FIGURAS.test(ex.enunciado ?? '');
}

const admiteFraccionesEn = (c: FichaContent, req: Pick<FichaRequest, 'tema' | 'area'>): boolean =>
  admiteFracciones({ estilo: c.estilo, formato: c.formato, visual: c.visual }, req);

/** La parte del prompt de las pizzas y tartas dibujadas por la aplicación. */
function fraccionesPrompt(): string {
  return (
    `FRACCIONES DIBUJADAS: este tema se presta a pizzas y tartas cortadas en trozos iguales. La aplicación las dibuja EXACTAS a partir de ` +
    `tus números, con los trozos cogidos en blanco y negro y separados del resto, así que úsalas siempre que el ejercicio hable de trozos ` +
    `(nunca las del catálogo, que tienen los trozos desiguales). Cada figura es {"partes": de 2 a 10, "tomadas": los trozos que se cogen ` +
    `(de 0 a partes), "objeto": "pizza" o "tarta"}.\n` +
    `- Tipo "fracciones": de 3 a 4 figuras (casi siempre pizzas; una tarta de vez en cuando), cada una con su sitio para contestar. "modo": "leer" (se ve la pizza con los trozos cogidos y ` +
    `se escribe qué fracción es; con "decimal": true, también su decimal), "colorear" (la pizza en blanco: se colorean los trozos que dice ` +
    `su fracción, que la hoja escribe debajo) o "unir" (pizzas a un lado y sus fracciones, o sus decimales con "decimal": true, mezcladas ` +
    `al otro). El enunciado dice qué hacer («Escribe la fracción de pizza que se ha comido en cada caso»). La solución la calcula la aplicación.\n` +
    `- En problema, abierta, completar y opcion_multiple puedes poner de 1 a 3 "fracciones" como dibujo de lo que cuenta el enunciado: ` +
    `tiene que ser EXACTAMENTE lo que dice (pizza de 8 trozos de la que se comen 3: partes 8, tomadas 3). Si el enunciado dice «8 trozos», ` +
    `la figura tiene 8 partes.\n` +
    `- Variedad: en la ficha, pizzas con distinto número de trozos (2, 3, 4, 5, 6, 7, 8, 9, 10) y distintas fracciones, nunca todas de 8; ` +
    `en un mismo ejercicio, número de trozos distinto en cada figura. Con "decimal": true solo con 2, 4, 5, 8 o 10 trozos (decimal exacto: ` +
    `1/2 = 0,5; 3/4 = 0,75; 2/5 = 0,4; 3/8 = 0,375; 7/10 = 0,7).\n` +
    `- Incluye al menos un ejercicio de tipo "fracciones" en la ficha y úsalo para lo que sea visual: leer una fracción, ver equivalencias ` +
    `(2/4 y 1/2: dos pizzas con distinto número de trozos y la misma cantidad), comparar o pasar a decimal.\n`
  );
}

/** Lo que sabe el motor de la escalera de una ficha: el reparto por bloques y el curso. */
interface Escalera {
  plan: BloquePlan[];
  perfil: PerfilCurso;
}

/**
 * La parte del prompt de la escalera de dificultad: los bloques que hay, su nivel,
 * qué se pide en cada uno según el curso y una ficha de ejemplo bien hecha. Lo que
 * decide el reparto es el código (`lib/escalera.ts`); la IA solo lo rellena.
 */
function escaleraPrompt(e: Escalera, opts: { cuaderno: boolean; hilo: boolean }): string {
  return (
    `ESCALERA DE DIFICULTAD (obligatoria): la ficha tiene que ser MULTINIVEL y subir de menos a más. Cada bloque lleva su ` +
    `"dificultad" (1, 2 o 3) y los bloques van en este orden y con este reparto:\n${planParaPrompt(e.plan, e.perfil)}\n` +
    `- El nivel 1 es de entrada: el alumnado de ese curso tiene que poder hacerlo casi solo y con éxito, para ganar confianza. ` +
    `El nivel 3 exige pensar: razonar, varios pasos, explicar, corregir un error o inventar; no lo llenes de verdadero o falso ` +
    `ni de cálculos sueltos. Dentro de un bloque, los ejercicios tampoco bajan de nivel.\n` +
    `- Cada ejercicio ha de ser claramente más exigente que los del bloque anterior; no repitas el mismo ejercicio con otros ` +
    `números en otro bloque.\n` +
    `- El título de cada bloque dice qué se hace («Calculamos», «Resolvemos en la tienda», «Razonamos»), sin número delante ` +
    `(la hoja lo pone) y sin escribir «Nivel 1».\n` +
    (opts.cuaderno
      ? `- RECUADROS: el primer bloque lleva un "recuerda" (las equivalencias, siglas o datos que hacen falta; si no hay nada que ` +
        `recordar, un "consejo") y el último un "reto": una pregunta extra algo más difícil, de respuesta corta, que no repita ` +
        `ningún ejercicio. El del medio, ninguno.\n`
      : '') +
    avisoDeSubida(e.perfil) +
    `EJEMPLO DE FICHA BIEN HECHA (de otro tema y de otro curso): copia su forma —los tres niveles, la explicación con un ejemplo ` +
    `resuelto, la solución con las cuentas, los datos realistas y el último bloque que obliga a pensar—, nunca su tema, sus datos ` +
    `ni sus frases.${opts.hilo ? ' No lleva dibujos porque no tiene hilo conductor; en tu ficha sigue las reglas de DIBUJOS.' : ''}\n` +
    `${ejemploParaPrompt(e.perfil, { cuaderno: opts.cuaderno })}\n`
  );
}

function systemPrompt(
  niveles: boolean, lang: Lang, estilo: FichaThemeChoice = 'clasico', formato: FichaFormato = 'ficha', visual = false,
  hilo?: Hilo, escalera?: Escalera, fracciones = false, facil = false,
): string {
  if (formato === 'tarjetas') return tarjetasSystemPrompt(lang, estilo);
  // Con pizzas dibujadas por la aplicación, las del catálogo (trozos desiguales, uno suelto) no se ofrecen a la IA para fracciones
  const hiloIA = hilo && fracciones ? { ...hilo, dibujos: hilo.dibujos.filter(id => !PIZZAS_DEL_CATALOGO.has(id)) } : hilo;
  return (
    `Eres un experto en didáctica y creación de materiales educativos. Tu tarea exclusiva es ` +
    `redactar una ficha de trabajo imprimible para el alumnado: una breve explicación del concepto ` +
    `y después los ejercicios, repartidos en bloques de actividad.\n` +
    `EXPLICACIÓN: en el campo "explicacion", antes de los ejercicios, recuerda el concepto en pocas ` +
    `frases, como lo haría el profesorado en la pizarra antes de mandar la tarea — no es un tema nuevo, ` +
    `es un repaso. Si encaja, incluye un ejemplo resuelto corto.\n` +
    `ACTIVIDADES: reparte los ejercicios en ${escalera
      ? `EXACTAMENTE ${escalera.plan.length} bloques, de menos a más dificultad (ver ESCALERA DE DIFICULTAD)`
      : 'de 2 a 4 bloques'}, cada uno con un título corto y claro (ej. ` +
    `"Escribe como potencia", "Relaciona"). Agrupa en el mismo bloque los ejercicios del mismo tipo o ` +
    `del mismo objetivo.\n` +
    `TIPOS DE EJERCICIO — usa el que mejor encaje en cada bloque, variando entre bloques:\n` +
    `- "abierta": respuesta libre. "completar": el propio "enunciado" ES la frase o las frases, con cada hueco ` +
    `marcado con ______ (al menos tres guiones bajos); nunca escribas «completa las frases» sin escribirlas. ` +
    `"opcion_multiple": de 3 a 5 opciones en "opciones". "problema": un enunciado con varios pasos.\n` +
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
    `- "calculos": una lista de 2 a 6 "lineas", cada una con lo que va a la IZQUIERDA del "=" (un número para ` +
    `descomponer o redondear, una suma, una expresión, una cantidad para convertir); el "=" y el hueco de ` +
    `respuesta los pone la ficha, no los escribas. "respuesta": "linea" si la respuesta es larga (una ` +
    `descomposición, una expresión) o "caja" si es corta (un número). El "enunciado" es la consigna de toda la ` +
    `lista. Es el tipo más fiel a las fichas de cuaderno: úsalo en cuanto el ejercicio sea repetir una misma ` +
    `operación con varios datos.\n` +
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
    (conHistoria(estilo) ? storyPrompt(estilo) : '') +
    (estilo === 'cuaderno' ? cuadernoPrompt() : '') +
    (formato === 'escape' ? ESCAPE_PROMPT : '') +
    (visual ? visualPrompt() : '') +
    (hiloIA && !visual && formato === 'ficha' ? hiloPrompt(hiloIA, lang) : '') +
    (fracciones && !visual && formato === 'ficha' ? fraccionesPrompt() : '') +
    (escalera ? escaleraPrompt(escalera, { cuaderno: estilo === 'cuaderno' && formato === 'ficha', hilo: !!hilo && !visual && formato === 'ficha' }) : '') +
    (facil ? lecturaFacilPrompt() : '') +
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

/** Hasta 10 de cada dibujo: más no se cuentan bien en una ficha. */
const MAX_CANTIDAD = 10;

/**
 * Lo visual de un ejercicio, comprobado: solo pictogramas del catálogo, la
 * cantidad entre 1 y 10 y una fila de tabla por pictograma. Sin apoyos
 * visuales, el ejercicio se queda sin estos campos.
 */
function cleanVisualExercise(ex: FichaExercise, visual: boolean): Pick<FichaExercise, 'consigna' | 'imagenes' | 'pictosFilas'> {
  if (!visual) return { consigna: undefined, imagenes: undefined, pictosFilas: undefined };
  const imagenes = (ex.imagenes ?? [])
    .map(im => ({ picto: pictoValido(im?.picto), cantidad: Math.max(1, Math.min(MAX_CANTIDAD, Math.round(Number(im?.cantidad) || 1))) }))
    .filter((im): im is { picto: string; cantidad: number } => !!im.picto)
    .slice(0, 4);
  const filas = ex.tipo === 'tabla_rellenar' ? ex.filas?.length ?? 0 : 0;
  const pictosFilas = filas && ex.pictosFilas?.some(pictoValido)
    ? Array.from({ length: filas }, (_, i) => pictoValido(ex.pictosFilas?.[i]) ?? '')
    : undefined;
  return { consigna: pictoValido(ex.consigna), imagenes: imagenes.length ? imagenes : undefined, pictosFilas };
}

/** Los pasos de un bloque: el pictograma, del catálogo o el de su verbo; sin verbo, el paso no vale. */
export function cleanPasos(pasos: PasoVisual[] | undefined): PasoVisual[] | undefined {
  const out = (pasos ?? [])
    .map(p => ({ verbo: (p?.verbo ?? '').trim(), detalle: cleanMathNotation((p?.detalle ?? '').trim()), picto: p?.picto }))
    .filter(p => p.verbo)
    .map(p => ({ ...p, picto: pictoValido(p.picto) ?? pictoDeVerbo(p.verbo) ?? '' }))
    .slice(0, 5);
  return out.length ? out : undefined;
}

function cleanVisualActivity(act: FichaActivity, visual: boolean): Pick<FichaActivity, 'indicacion' | 'pasos' | 'recuerda'> {
  if (!visual) return {};
  const recuerda = (act.recuerda ?? [])
    .filter(r => r?.texto?.trim())
    .map(r => ({ texto: cleanMathNotation(r.texto.trim()), ...(pictoValido(r.picto) ? { picto: pictoValido(r.picto) } : {}) }))
    .slice(0, 4);
  return {
    indicacion: cleanMathNotation((act.indicacion ?? '').trim()) || undefined,
    pasos: cleanPasos(act.pasos),
    recuerda: recuerda.length ? recuerda : undefined,
  };
}

function cleanConceptos(c: ConceptoVisual[] | undefined): ConceptoVisual[] | undefined {
  const out = (c ?? [])
    .filter(x => x?.titulo?.trim() || x?.texto?.trim())
    .map(x => ({ picto: pictoValido(x.picto) ?? '', titulo: cleanMathNotation((x.titulo ?? '').trim()), texto: cleanMathNotation((x.texto ?? '').trim()) }))
    .slice(0, 4);
  return out.length ? out : undefined;
}

/**
 * Las líneas de un ejercicio «calculos»: sin el «=» ni los huecos que la IA
 * pone a veces al final (la ficha los pinta), y sin líneas vacías.
 */
export function cleanLineas(lineas: string[] | undefined): string[] {
  return (lineas ?? [])
    .map(l => cleanMathNotation(String(l ?? '')).replace(/[\s=_…]+$/u, '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

const RECUADROS: FichaRecuadroTipo[] = ['recuerda', 'reto', 'consejo'];

/** El recuadro de un bloque, comprobado; sin tipo válido o sin nada que decir, no hay recuadro. */
export function cleanRecuadro(r: FichaRecuadro | undefined): FichaRecuadro | undefined {
  if (!r || !RECUADROS.includes(r.tipo)) return undefined;
  const texto = cleanMathNotation((r.texto ?? '').trim());
  const lista = r.tipo === 'recuerda'
    ? (r.lista ?? []).map(l => cleanMathNotation(String(l ?? '').trim())).filter(Boolean).slice(0, 10)
    : [];
  if (!texto && !lista.length) return undefined;
  return { tipo: r.tipo, texto, ...(lista.length ? { lista } : {}) };
}

/**
 * Los dibujos de un ejercicio: solo los que están en el catálogo (la IA elige
 * de una lista cerrada, pero se comprueba), sin repetir, con una cantidad de 1 a
 * 10 y, si no son de los que se pueden contar, siempre 1. Como mucho `max` (tres
 * de ambientación; más en los tipos que rotulan o clasifican dibujos).
 */
export function cleanDibujos(list: DibujoEjercicio[] | undefined, max = 3): DibujoEjercicio[] | undefined {
  const vistos = new Set<string>();
  const out: DibujoEjercicio[] = [];
  for (const d of Array.isArray(list) ? list : []) {
    const id = String(d?.ilustracion ?? '').trim();
    if (!id || vistos.has(id) || ilustracionPorId(id)?.fuente !== 'img') continue;
    vistos.add(id);
    const cantidad = esContable(id) ? Math.max(1, Math.min(MAX_CANTIDAD, Math.round(Number(d?.cantidad) || 1))) : 1;
    out.push({ ilustracion: id, cantidad });
  }
  return out.length ? out.slice(0, max) : undefined;
}

/** Los dibujos de una lista que se corresponde elemento a elemento («relacionar», filas de una tabla): uno por elemento o ninguno. */
function dibujosAlineados(list: DibujoEjercicio[] | undefined, n: number): DibujoEjercicio[] | undefined {
  if (!Array.isArray(list) || list.length !== n) return undefined;
  const out = list.map(d => {
    const id = String(d?.ilustracion ?? '').trim();
    return { ilustracion: ilustracionPorId(id)?.fuente === 'img' ? id : '', cantidad: 1 };
  });
  return out.filter(d => d.ilustracion).length >= 2 ? out : undefined;
}

/** La ficha con otro hilo conductor (o sin ninguno): cambia la cabecera; los dibujos de los ejercicios se quedan. */
export function conHilo(content: FichaContent, hiloId: string | undefined): FichaContent {
  const hilo = hiloPorId(hiloId);
  if (!hilo) {
    const resto: FichaContent = { ...content };
    delete resto.hilo;
    return resto;
  }
  return { ...content, hilo: hilo.id };
}

/**
 * El hilo que se le pone a una ficha nueva. Solo «Cuaderno», en formato ficha
 * y sin apoyos visuales (que ya llevan sus pictogramas): 'ninguno' lo quita,
 * un identificador lo fija, y con 'auto' o sin nada lo elige la app por el tema.
 */
export function resolverHilo(
  req: { tema: string; area?: string; nivel?: string; hilo?: string },
  estilo: FichaThemeChoice, formato: FichaFormato, visual: boolean,
): Hilo | undefined {
  if (estilo !== 'cuaderno' || formato !== 'ficha' || visual || req.hilo === 'ninguno') return undefined;
  return hiloPorId(req.hilo) ?? hiloDeFicha({ tema: req.tema, area: req.area ?? '', nivel: req.nivel });
}

/**
 * Lo que los dibujos del catálogo hacen en un ejercicio, comprobado: los tipos
 * «contar», «etiquetar» y «clasificar» necesitan sus dibujos (si la IA no los da
 * bien, el ejercicio pasa a «abierta» con lo que quede, antes que salir roto) y
 * su solución la calcula el código; «relacionar» y las tablas llevan un dibujo
 * por elemento o ninguno; en el resto, hasta tres de ambientación. Sin hilo
 * conductor no hay dibujos.
 */
function cleanDibujosDeEjercicio(ex: FichaExercise, conDibujos: boolean, lang: Lang, conFracciones = false): FichaExercise {
  const base: FichaExercise = { ...ex };
  delete base.categorias; delete base.total; delete base.banco;
  const aAbierta = (dibujos: DibujoEjercicio[] | undefined): FichaExercise => {
    const out: FichaExercise = { ...base, tipo: 'abierta', dibujos: conDibujos ? cleanDibujos(dibujos) : undefined };
    if (!out.dibujos) delete out.dibujos;
    return out;
  };
  if (!conDibujos) {
    const out = esTipoConDibujos(ex.tipo) ? aAbierta(undefined) : { ...base };
    delete out.dibujos;
    return out;
  }
  if (ex.tipo === 'contar') {
    const grupos = (cleanDibujos(ex.dibujos) ?? []).filter(d => esContable(d.ilustracion));
    if (!grupos.length) return aAbierta(ex.dibujos);
    const out: FichaExercise = { ...base, dibujos: grupos, ...(ex.total && grupos.length > 1 ? { total: true } : {}) };
    return { ...out, solucion: solucionDeDibujos(out, lang) };
  }
  if (ex.tipo === 'etiquetar') {
    // Dos dibujos con el mismo nombre (el corazón del cuerpo y el de los valores) no se rotulan juntos
    const nombres = new Set<string>();
    const dibujos = (cleanDibujos(ex.dibujos, 12) ?? []).map(d => ({ ...d, cantidad: 1 })).filter(d => {
      const n = (nombreIlustracion(d.ilustracion, 'es') ?? d.ilustracion).toLowerCase();
      if (nombres.has(n)) return false;
      nombres.add(n);
      return true;
    }).slice(0, 8);
    if (dibujos.length < 2) return aAbierta(ex.dibujos);
    const out: FichaExercise = { ...base, dibujos, ...(ex.banco ? { banco: true } : {}) };
    return { ...out, solucion: solucionDeDibujos(out, lang) };
  }
  if (ex.tipo === 'clasificar') {
    const vistos = new Set<string>();
    const categorias = (Array.isArray(ex.categorias) ? ex.categorias : [])
      .map(c => ({
        nombre: cleanMathNotation(String(c?.nombre ?? '').trim()),
        dibujos: (Array.isArray(c?.dibujos) ? c.dibujos : []).map(id => String(id ?? '').trim())
          .filter(id => ilustracionPorId(id)?.fuente === 'img' && !vistos.has(id) && !!vistos.add(id)),
      }))
      .filter(c => c.nombre && c.dibujos.length)
      .slice(0, 3);
    let n = 0;
    const recortadas = categorias.map(c => ({ ...c, dibujos: c.dibujos.slice(0, Math.max(0, 10 - n)).map(id => (n++, id)) }));
    if (recortadas.length < 2 || recortadas.reduce((s, c) => s + c.dibujos.length, 0) < 4) return aAbierta(undefined);
    const out: FichaExercise = { ...base, categorias: recortadas };
    delete out.dibujos;
    return { ...out, solucion: solucionDeDibujos(out, lang) };
  }
  if (ex.tipo === 'relacionar') {
    const dibujos = dibujosAlineados(ex.dibujos, ex.izquierda?.length ?? 0);
    if (dibujos) return { ...base, dibujos };
    delete base.dibujos;
    return base;
  }
  if (ex.tipo === 'tabla_rellenar') {
    const dibujos = dibujosAlineados(ex.dibujos, ex.filas?.length ?? 0);
    if (dibujos) return { ...base, dibujos };
    delete base.dibujos;
    return base;
  }
  // «Escribe el nombre de cada animal debajo de su dibujo» como respuesta libre: cada dibujo ha de tener su línea, es un «etiquetar»
  if (ex.tipo === 'abierta' && esRotulado(ex.enunciado ?? '') && (cleanDibujos(ex.dibujos, 12)?.length ?? 0) >= 2) {
    const banco = RE_BANCO.test(ex.enunciado);
    const rotulado = cleanDibujosDeEjercicio({ ...ex, tipo: 'etiquetar', banco, enunciado: enunciadoRotular(banco, lang) }, true, lang);
    if (rotulado.tipo === 'etiquetar') return rotulado;
  }
  // Con pizzas dibujadas por la aplicación, la del catálogo no ilustra un enunciado de trozos: sus trozos no son los que dice
  const sinPizzas = conFracciones && RE_TROZOS.test(ex.enunciado ?? '')
    ? cleanDibujos(ex.dibujos)?.filter(d => !PIZZAS_DEL_CATALOGO.has(d.ilustracion))
    : cleanDibujos(ex.dibujos);
  const dibujos = sinPizzas?.length ? sinPizzas : undefined;
  if (dibujos) return { ...base, dibujos };
  delete base.dibujos;
  return base;
}

const RE_TROZOS = /\b(?:trozos?|porci[oó]n(?:es)?|rebanadas?|pedazos?|raciones?|partes? iguales|fracci[oó]n)\b/i;

const RE_BANCO = /\b(?:banco|banc|word bank|box)\b/i;

/** ¿Pide escribir el nombre de cada dibujo? (castellano, catalán o inglés) */
const esRotulado = (t: string): boolean =>
  /\b(?:escribe|anota|pon|rotula|completa|indica|escriu|posa|write|label|name)\b/i.test(t)
  && /\b(?:nombres?|noms?|names?)\b/i.test(t)
  && /\b(?:cada|debajo|bajo|junto|su dibujo|sus dibujos|sota|each|below|under)\b/i.test(t);

/** Cuántas figuras como mucho: en el ejercicio «fracciones», cuatro; como dibujo del enunciado de otro tipo, tres. */
const MAX_FIGURAS_AMBIENTE = 3;

/** Los tipos cuyo enunciado puede llevar una pizza al lado (la misma lista que la figura geométrica). */
const TIPOS_CON_FIGURA_DE_ENUNCIADO: readonly FichaExerciseType[] = ['problema', 'abierta', 'completar', 'opcion_multiple'];

const COGIDOS_VALIDOS: readonly CogidosFraccion[] = ['ambos', 'bn', 'separados'];

/**
 * Las pizzas y tartas de un ejercicio: solo figuras que se pueden dibujar (enteros, de 2 a 12 trozos y de
 * 0 a todos cogidos), sin pasarse de las que caben; «fracciones» sin ninguna pasa a pregunta abierta; el
 * decimal solo si todos los trozos lo tienen exacto; y la solución sale de los números, no de la IA.
 * Sin «Cuaderno» (`permitido` falso) no hay figuras.
 */
function cleanFracciones(ex: FichaExercise, permitido: boolean, lang: Lang): FichaExercise {
  const out: FichaExercise = { ...ex };
  delete out.fracciones; delete out.modo; delete out.decimal; delete out.cogidos;
  const quita = ex.tipo === 'fracciones' ? { ...out, tipo: 'abierta' as const } : out;
  const dedicado = ex.tipo === 'fracciones';
  // Como dibujo del enunciado, solo en los tipos que tienen un enunciado largo con espacio al lado
  if (!permitido || (!dedicado && !TIPOS_CON_FIGURA_DE_ENUNCIADO.includes(ex.tipo))) return quita;
  const figuras: FraccionDibujo[] = (Array.isArray(ex.fracciones) ? ex.fracciones : [])
    .map(f => ({ partes: Math.round(Number(f?.partes)), tomadas: Math.round(Number(f?.tomadas)), objeto: OBJETOS_FRACCION.includes(f?.objeto as never) ? f.objeto : undefined }))
    .filter(fraccionValida)
    .map(f => (f.objeto ? f : { partes: f.partes, tomadas: f.tomadas }))
    .slice(0, dedicado ? MAX_FIGURAS_FRACCION : MAX_FIGURAS_AMBIENTE);
  if (!figuras.length) return quita;
  const cogidos = COGIDOS_VALIDOS.includes(ex.cogidos as CogidosFraccion) ? { cogidos: ex.cogidos } : {};
  if (!dedicado) return { ...out, fracciones: figuras, ...cogidos };
  const modo: ModoFracciones = MODOS_FRACCIONES.includes(ex.modo as ModoFracciones) ? ex.modo as ModoFracciones : 'leer';
  // Con menos de tres figuras no hay con qué comparar: el código añade las que faltan
  const completas = completarFiguras(figuras, modo, !!ex.decimal && modo !== 'colorear');
  const decimal = !!ex.decimal && modo !== 'colorear' && completas.every(tieneDecimalExacto);
  const limpio: FichaExercise = { ...out, fracciones: completas, modo, ...(decimal ? { decimal: true } : {}), ...cogidos };
  return { ...limpio, solucion: solucionFracciones(limpio, lang) };
}

/** Un «problema» que pide explicar y no lleva ni una cifra no es de cálculo: es una pregunta abierta (la hoja le daría una cuadrícula de operaciones). */
const RE_EXPLICA = /\b(?:explica|razona|justifica|describe|argumenta|por qu[eé])\b/i;

/** Lo que cambia al limpiar un ejercicio en lectura fácil (negritas) o en una ficha de comprensión lectora (tipos propios). */
interface ExtraLimpieza {
  facil?: boolean;
  /** Comprensión lectora: los ejercicios son de lectura (sin pizzas ni dibujos del catálogo). */
  lectura?: boolean;
}

/** Las líneas que se dejan para escribir lo encontrado en el texto o bajo un dibujo: de 0 a `max`, y una si el enunciado pide escribir. */
function lineasDeRespuestaIA(valor: unknown, enunciado: string, max: number): number {
  const n = Math.round(Number(valor));
  if (Number.isFinite(n) && n >= 0) return Math.min(max, n);
  return /\b(?:escr[ií]be(?:l[oa]s?)?|copia(?:l[oa]s?)?|anota(?:l[oa]s?)?|escriu(?:-l[oa]s?)?|escriure|write)\b/i.test(enunciado) ? 1 : 0;
}

function cleanExercise(
  ex: FichaExercise, visual = false, conDibujos = false, lang: Lang = 'es', conFracciones = false, extra: ExtraLimpieza = {},
): FichaExercise {
  const limpio = cleanFracciones(cleanDibujosDeEjercicio({ ...ex, ...cleanVisualExercise(ex, visual) }, conDibujos && !visual, lang, conFracciones), conFracciones && !visual, lang);
  // Las negritas solo en lectura fácil, y bien cerradas; en el resto de fichas no se piden y se quitan
  const t = (x: string) => (extra.facil ? equilibrarNegritas(cleanMathNotation(x)) : quitarNegritas(cleanMathNotation(x)));
  const plano = (x: string) => quitarNegritas(cleanMathNotation(x));
  let tipo: FichaExerciseType = limpio.tipo === 'problema' && !limpio.figura && !/\d/.test(limpio.enunciado ?? '') && RE_EXPLICA.test(limpio.enunciado ?? '') ? 'abierta' : limpio.tipo;
  let enunciado = t(limpio.enunciado ?? '');
  // «Contestar» con una sola pregunta (o ninguna) es una pregunta abierta
  const preguntas = (limpio.tipo === 'contestar' ? limpio.preguntas ?? [] : []).map(t).filter(x => x.trim()).slice(0, 5);
  if (limpio.tipo === 'contestar' && preguntas.length < 2) {
    tipo = 'abierta';
    enunciado = preguntas[0] ?? enunciado;
  }
  if (extra.facil) enunciado = negritaDelVerbo(enunciado);
  const bancoPalabras = limpio.tipo === 'completar' ? (limpio.bancoPalabras ?? []).map(plano).filter(x => x.trim()).slice(0, 10) : [];
  const resto = { ...limpio };
  delete resto.preguntas; delete resto.lineasRespuesta; delete resto.bancoPalabras;
  return {
    ...resto,
    tipo,
    enunciado,
    ...(tipo === 'contestar' ? { preguntas } : {}),
    ...(tipo === 'en_texto' ? { lineasRespuesta: lineasDeRespuestaIA(limpio.lineasRespuesta, enunciado, 3) } : {}),
    ...(tipo === 'dibujar' ? { lineasRespuesta: lineasDeRespuestaIA(limpio.lineasRespuesta, enunciado, 2) } : {}),
    ...(bancoPalabras.length >= 2 ? { bancoPalabras } : {}),
    opciones: limpio.opciones?.map(t),
    columnas: limpio.columnas?.map(plano),
    filas: limpio.filas?.map(fila => fila.map(plano)),
    izquierda: limpio.izquierda?.map(t),
    derecha: limpio.derecha?.map(t),
    leyenda: limpio.leyenda?.map(l => ({ color: l.color, criterio: plano(l.criterio) })),
    itemsColorear: limpio.itemsColorear?.map(plano),
    afirmaciones: limpio.afirmaciones?.map(t),
    elementos: limpio.elementos?.map(t),
    pistas: limpio.pistas?.map(p => ({ palabra: p.palabra, pista: plano(p.pista) })),
    vinetas: limpio.vinetas?.map(v => ({ personaje: cleanEmoji(v.personaje, '🙂'), texto: plano(v.texto ?? '') })),
    ...(limpio.tipo === 'calculos' ? { lineas: cleanLineas(limpio.lineas), respuesta: limpio.respuesta === 'caja' ? 'caja' as const : 'linea' as const } : {}),
    // Una IA floja a veces se enrolla sin fin en la solución (salió una de más de 900 letras): el tope lo corta
    solucion: plano(limpio.solucion ?? '').slice(0, 1500),
    apoyo: limpio.apoyo ? plano(limpio.apoyo) : limpio.apoyo,
    ampliacion: limpio.ampliacion ? plano(limpio.ampliacion) : limpio.ampliacion,
  };
}

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

function cleanFichaContent(
  c: FichaContent, estilo: FichaThemeChoice = 'clasico', formato: FichaFormato = 'ficha', visual = false, hiloElegido?: Hilo,
  lang: Lang = 'es', plan?: BloquePlan[], extra: ExtraLimpieza = {},
): FichaContent {
  // Las negritas de la lectura fácil, bien cerradas; sin ella, ninguna
  const texto = (x: string) => (extra.facil ? equilibrarNegritas(cleanMathNotation(x)) : quitarNegritas(cleanMathNotation(x)));
  const hilo = hiloElegido && !visual && formato === 'ficha' ? hiloElegido : undefined;
  const finalEstilo: FichaThemeId = estilo === 'auto'
    ? (STORY_THEME_IDS.includes(c.estilo as FichaThemeId) ? c.estilo as FichaThemeId : 'espacio')
    : estilo;
  const theme = fichaTheme(finalEstilo);
  const historia = c.historia && theme.historia
    ? {
      ...c.historia,
      emoji: cleanEmoji(c.historia.emoji, theme.personaje),
      mision: texto(c.historia.mision),
      cierre: texto(c.historia.cierre),
    }
    : undefined;
  return {
    ...c,
    estilo: finalEstilo,
    historia,
    formato,
    titulo: cleanMathNotation(c.titulo),
    explicacion: texto(c.explicacion ?? ''),
    instrucciones: texto(c.instrucciones ?? ''),
    ...(extra.facil && formato !== 'tarjetas' ? { variante: 'lectura_facil' as const } : {}),
    ...(visual ? { visual: true, conceptos: cleanConceptos(c.conceptos) } : { visual: undefined, conceptos: undefined }),
    hilo: hilo?.id,
    // «De menos a más»: los bloques se ordenan por su nivel, y si la IA no los trae bien, se reparten por posición
    actividades: (formato === 'tarjetas'
      ? (c.actividades ?? []).map(a => ({ ...a, dificultad: undefined }))
      : normalizarEscalera((c.actividades ?? []).map(a => ({ ...a, dificultad: Number(a.dificultad) })), plan?.map(b => b.dificultad))
    ).map((act, i) => ({
      // El número del bloque lo pone la hoja: «1. El concepto» sin su «1.» (la IA lo escribe a veces)
      titulo: cleanMathNotation(act.titulo ?? '').replace(/^\s*\d+\s*[.)\-:]\s*/, ''),
      ...(act.dificultad ? { dificultad: act.dificultad } : {}),
      ...(historia ? {
        emoji: cleanEmoji(act.emoji, theme.iconos[i % theme.iconos.length]),
        narrativa: quitarNegritas(cleanMathNotation(act.narrativa ?? '')),
      } : {}),
      ...cleanVisualActivity(act, visual),
      ...(cleanRecuadro(act.recuadro) ? { recuadro: cleanRecuadro(act.recuadro) } : {}),
      ejercicios: (act.ejercicios ?? []).map(ex => cleanExercise(ex, visual, !!hilo, lang, finalEstilo === 'cuaderno' && formato === 'ficha' && !extra.lectura, extra)).map(prepareExercise),
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
  visual = false, hilo?: Hilo, lang: Lang = 'es', plan?: BloquePlan[], fracciones = false, extra: ExtraLimpieza = {},
): Promise<FichaContent | null> {
  const raw = await callGemini(system, user, [], { onError }, {
    // Con apoyos visuales la respuesta lleva además pasos, dibujos y tarjetas
    maxOutputTokens: visual ? 24576 : 16384,
    responseSchema: fichaSchema({
      niveles: niveles && formato !== 'tarjetas',
      historia: conHistoria(estilo) && formato !== 'tarjetas',
      elegirEstilo: estilo === 'auto',
      formato,
      visual,
      cuaderno: estilo === 'cuaderno' && formato === 'ficha',
      dibujos: !!hilo && !visual && formato === 'ficha',
      escalera: formato === 'tarjetas' ? undefined : plan,
      fracciones,
      lectura: extra.lectura,
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
  return cleanFichaContent({ ...parsed, actividades: parsed.actividades ?? [] }, estilo, formato, visual, hilo, lang, plan, extra);
}

/** Un escape room necesita historia: con «Clásica» se deja elegir el mundo a la IA. */
function effectiveEstilo(estilo: FichaThemeChoice | undefined, formato: FichaFormato): FichaThemeChoice {
  const e = estilo ?? 'auto';
  return formato === 'escape' && !conHistoria(e) ? 'auto' : e;
}

/** Qué se pide al final del prompt según el formato; con `plan`, repartido en los bloques de la escalera. */
function askFor(formato: FichaFormato, n: number, sobre: string, plan?: BloquePlan[]): string {
  if (formato === 'tarjetas') return `Crea EXACTAMENTE ${n} tarjetas ${sobre}.`;
  const reparto = plan?.length
    ? `repartidos en EXACTAMENTE ${plan.length} ${formato === 'escape' ? 'salas' : 'bloques'} de menos a más dificultad (${plan.map(b => b.ejercicios).join(' + ')} ejercicios)`
    : formato === 'escape' ? 'repartidos en de 2 a 4 salas, cada una con su candado' : 'repartidos en sus bloques de actividad';
  if (formato === 'escape') return `Crea un escape room con un total de EXACTAMENTE ${n} ejercicios ${sobre}, ${reparto}${plan?.length ? ', cada sala con su candado' : ''}.`;
  return `Genera una ficha de trabajo con un total de EXACTAMENTE ${n} ejercicios ${sobre}, ${reparto}.`;
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
function numberVarietyHint(perfil: PerfilCurso = perfilDeCurso('')): string {
  // Una ficha de ciencias o sociales no es un problema de cálculo: sin rango de cifras, solo que los datos sean creíbles
  if (!perfil.numerica) {
    return (
      `DATOS: si algún ejercicio lleva números (medidas, cantidades, fechas), que sean realistas para la situación y no se repitan ` +
      `de un ejercicio a otro. No conviertas el tema en un problema de cálculo si no lo es.`
    );
  }
  const { lo, hi, nota } = rangoNumerico(perfil);
  return (
    `VARIEDAD NUMÉRICA: en esta ficha en concreto, procura que las medidas, cantidades y datos de ` +
    `los ejercicios (figuras, problemas, tablas...) se muevan sobre todo entre ${lo} y ${hi} — evita ` +
    `en particular los combos más manidos de los libros de texto (8-4-6, 6-4, 5-3-4, 10-5) y no ` +
    `repitas los mismos números de un ejercicio a otro dentro de la ficha. Los números tienen que ser razonables ` +
    `para el curso y para la situación (una pizza no se corta en 13 trozos; en fracciones de Primaria, denominadores ` +
    `como 2, 3, 4, 5, 6, 8 o 10).${nota ? ` ${nota}` : ''}`
  );
}

/* ── Ejercicios rotos: lo que la IA promete y la hoja no lleva ── */

const RE_HABLA_DE_DIBUJOS = /\b(?:dibujos?|im[aá]genes?|ilustraci(?:ón|ones)|fotos?|fotograf[ií]as?)\b|\b(?:debajo|bajo) de cada\b|\bqu[eé] (?:ves|aparecen?)\b/i;
const RE_HUECO = /_{3,}|…{2,}|\.{5,}/;

/**
 * Qué le pasa a un ejercicio que no se puede hacer tal como lo escribió la IA,
 * dicho como indicación para rehacerlo; `undefined` si está bien. Casos que
 * salieron con una IA real: un «escribe el nombre debajo de cada animal» sin
 * ningún animal dibujado (solo con hilo conductor: sin él no hay dibujos en la
 * hoja), un «completa las frases» sin las frases y un «relacionar» con las mismas
 * palabras en las dos columnas.
 */
export function problemaDeEjercicio(ex: FichaExercise, conHilo: boolean): string | undefined {
  if (ex.tipo === 'completar' && !RE_HUECO.test(ex.enunciado)) {
    return 'Es de tipo "completar" pero el enunciado no tiene la frase con huecos. Escribe en el enunciado la frase o las frases completas, ' +
      'con cada hueco marcado con ______ (al menos tres guiones bajos), y en la solución las palabras que faltan.';
  }
  if (ex.tipo === 'relacionar' && ex.izquierda?.length && ex.derecha?.length) {
    // Los dos lados con las mismas palabras no es relacionar nada (salió con una IA real: «dos tercios» con «dos tercios»)
    const plano = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const der = new Set(ex.derecha.map(plano));
    if (ex.izquierda.filter(x => der.has(plano(x))).length >= Math.min(2, ex.izquierda.length)) {
      return 'Es de tipo "relacionar" pero las dos columnas repiten las mismas palabras, así que no hay nada que relacionar. En la columna derecha ' +
        'pon otra cosa que se relacione con cada elemento de la izquierda (su definición, su función, su resultado, su equivalente numérico).';
    }
  }
  const fr = ex.fracciones ?? [];
  if (ex.tipo === 'fracciones' && fr.length >= 2) {
    const iguales = new Set(fr.map(f => `${f.partes}/${f.tomadas}`)).size < fr.length;
    if (iguales || new Set(fr.map(f => f.partes)).size === 1) {
      return 'Es de tipo "fracciones" y las pizzas tienen todas el mismo número de trozos (o hay dos iguales), así que no hay nada que comparar ni distinguir. ' +
        'Usa pizzas con distinto número de trozos (por ejemplo 4, 5, 8 y 10) y distintas fracciones.';
    }
  }
  if (fr.length && ex.tipo !== 'fracciones') {
    // El enunciado habla de «8 trozos» y la figura tiene otros: lo que se lee y lo que se ve tienen que coincidir
    const permitidos = new Set(fr.flatMap(f => [f.partes, f.tomadas, f.partes - f.tomadas]));
    const dicen = [...(ex.enunciado ?? '').matchAll(/\b(\d{1,2})\s*(?:trozos?|porciones?|rebanadas?|pedazos?|raciones?|partes)\b/gi)].map(m => Number(m[1]));
    const malo = dicen.find(n => !permitidos.has(n));
    if (malo !== undefined) {
      return `El enunciado habla de ${malo} trozos pero la figura de fracciones tiene ${fr.map(f => `${f.partes} trozos con ${f.tomadas} cogidos`).join(' y ')}. ` +
        'Que lo que dice el enunciado y lo que se dibuja coincidan: cambia el enunciado o los números de la figura.';
    }
  }
  if (ex.tipo === 'contar' && (ex.dibujos?.length ?? 0) >= 2 && new Set(ex.dibujos!.map(d => Math.max(1, d.cantidad ?? 1))).size === 1) {
    return 'Es de tipo "contar" y todos los grupos tienen la misma cantidad, así que no hay nada que comparar ni sumar de verdad. ' +
      'Pon cantidades distintas y pequeñas (por ejemplo 4 y 7).';
  }
  if (conHilo && !['colorear', 'comic', 'sopa_letras', 'crucigrama'].includes(ex.tipo) && RE_HABLA_DE_DIBUJOS.test(ex.enunciado)
    && !ex.dibujos?.length && !ex.categorias?.length && !ex.figura) {
    return 'El enunciado habla de dibujos o imágenes, pero el ejercicio no lleva ninguno. Rehazlo con dibujos del hilo ' +
      '("etiquetar" si hay que escribir el nombre de cada uno, "contar" si hay que contarlos, "clasificar" si hay que repartirlos), ' +
      'o escríbelo sin mencionar dibujos.';
  }
  return undefined;
}

/** ¿Es una ficha en lectura fácil (dislexia)? */
export const esFacil = (c: Pick<FichaContent, 'variante'>): boolean => c.variante === 'lectura_facil';

/** La ficha con el ejercicio `e` del bloque `a` cambiado por `nuevo`. */
function conEjercicio(content: FichaContent, a: number, e: number, nuevo: FichaExercise): FichaContent {
  return {
    ...content,
    actividades: content.actividades.map((act, i) => (i === a
      ? { ...act, ejercicios: act.ejercicios.map((x, j) => (j === e ? nuevo : x)) }
      : act)),
  };
}

/**
 * Rehace, una vez cada uno y como mucho tres, los ejercicios rotos de una ficha
 * recién generada (`problemaDeEjercicio`). Si la IA no contesta, el ejercicio se
 * queda como estaba: el docente lo ve y lo edita.
 */
async function repararFicha(
  content: FichaContent, req: Pick<FichaRequest, 'tema' | 'area' | 'nivel'>, lang: Lang,
): Promise<FichaContent> {
  if ((content.formato ?? 'ficha') !== 'ficha') return content;
  let actual = content;
  let hechos = 0;
  for (let a = 0; a < content.actividades.length && hechos < 3; a++) {
    for (let e = 0; e < content.actividades[a].ejercicios.length && hechos < 3; e++) {
      const roto = actual.actividades[a].ejercicios[e];
      // «Escribe la fracción de cada figura» sin ninguna figura (salió con una IA real): las pizzas las monta el código
      if (!actual.lectura && admiteFraccionesEn(actual, req) && hablaDeFigurasSinFiguras(roto)) {
        actual = conEjercicio(actual, a, e, fraccionesParaEjercicio('leer', lang, { decimal: /decimal/i.test(req.tema ?? '') }) as FichaExercise);
        continue;
      }
      const motivo = problemaDeEjercicio(roto, !!actual.hilo);
      if (!motivo) continue;
      // «Escribe el nombre de cada dibujo» sin ningún dibujo: lo monta el código con los del hilo. Una IA floja no
      // rellena los dibujos ni con el motivo delante (salió dos veces seguidas con Flash-Lite)
      const hilo = hiloPorId(actual.hilo);
      if (hilo && esRotulado(roto.enunciado ?? '') && !roto.dibujos?.length && !roto.categorias?.length) {
        const fijo = etiquetarDelHilo(hilo, lang, { banco: bancoPermitido(perfilDeCurso(req.nivel)) });
        if (fijo) { actual = conEjercicio(actual, a, e, fijo as FichaExercise); continue; }
      }
      hechos++;
      const nuevo = await regenerateExercise(actual, req, a, e, { instruccion: motivo }, lang);
      if (!nuevo || problemaDeEjercicio(nuevo, !!actual.hilo)) continue;
      actual = conEjercicio(actual, a, e, nuevo);
    }
  }
  return actual;
}

/* ── Revisión: la IA repasa su propia ficha como lo haría un docente ── */

/** Cuántos ejercicios se rehacen, como mucho, tras la revisión. */
const MAX_REVISADOS = 3;

export interface HallazgoRevision {
  /** Bloque y ejercicio, contados desde 1 como en la hoja; el ejercicio 0 es el recuadro del bloque. */
  bloque: number;
  ejercicio: number;
  /** Qué está mal, dicho como indicación para rehacerlo. */
  motivo: string;
}

const REVISION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    problemas: {
      type: 'ARRAY',
      description: 'Los fallos graves, del más grave al menos y como mucho tres. Vacío si la ficha está bien.',
      items: {
        type: 'OBJECT',
        properties: {
          bloque: { type: 'INTEGER', description: 'Número del bloque (1, 2, 3…)' },
          ejercicio: { type: 'INTEGER', description: 'Número del ejercicio dentro del bloque (1, 2…), o 0 si el fallo está en el recuadro «Recuerda», «Reto» o «Consejo» del bloque' },
          motivo: S('Qué está mal y cómo rehacerlo, en una o dos frases, como una indicación para quien lo reescriba'),
        },
        required: ['bloque', 'ejercicio', 'motivo'],
        propertyOrdering: ['bloque', 'ejercicio', 'motivo'],
      },
    },
  },
  required: ['problemas'],
  propertyOrdering: ['problemas'],
} as const;

const REVISION_SISTEMA_LECTURA =
  `Eres un maestro o una maestra de Lengua con muchos años de experiencia que revisa una ficha de comprensión lectora antes de repartirla ` +
  `al alumnado. Encuentra los fallos GRAVES, no retoques el estilo. Tienes el texto (con sus párrafos numerados) y las actividades. Revisa ` +
  `ejercicio por ejercicio, volviendo al texto:\n` +
  `1. El ejercicio se puede hacer SOLO con el texto, y la solución es correcta y dice lo mismo que el texto (compruébalo en el párrafo ` +
  `que corresponda). Una solución que el texto contradice, o una pregunta cuya respuesta no está ni se deduce del texto, es siempre grave.\n` +
  `2. Está bien montado: en "verdadero_falso" las falsas tienen un error que se puede razonar en el texto; en "opcion_multiple" hay una sola ` +
  `correcta; en "ordenar" el orden de "elementos" es el del texto; en "completar" los huecos se deducen y las palabras del recuadro encajan; ` +
  `en "en_texto" lo que hay que marcar está de verdad en el texto, con esas palabras.\n` +
  `3. El nivel es el que toca: el bloque 1 pide localizar lo que el texto dice; el 2, vocabulario e inferencias; el 3, opinar y crear. Un ` +
  `ejercicio del bloque 3 que solo pide copiar una frase, o uno de un curso inferior, es grave.\n` +
  `4. No repite otro ejercicio ni da la respuesta de otro (un enunciado que cuenta lo que pregunta otro).\n` +
  `5. Si es lectura fácil: los enunciados son cortos y de una sola tarea.\n` +
  `NO son fallos: en "ordenar" los "elementos" vienen en el orden correcto a propósito (la aplicación los desordena); "dibujar" y las ` +
  `preguntas de opinión no tienen una única respuesta; la "solucion" es para el profesorado (no la juzgues por su estilo).\n` +
  `Si algo no es grave, no lo menciones. Si la ficha está bien, devuelve la lista vacía. Como mucho tres fallos, los más graves.`;

const REVISION_SISTEMA =
  `Eres un maestro o una maestra con muchos años de experiencia que revisa una ficha de trabajo antes de repartirla al ` +
  `alumnado. Tu trabajo es encontrar los fallos GRAVES, no retocar el estilo. Revisa ejercicio por ejercicio, haciendo tú las ` +
  `cuentas y las comprobaciones:\n` +
  `1. La solución es correcta: recalcúlala (cuentas, fracciones, unidades, fechas, datos). Una solución equivocada es siempre grave.\n` +
  `2. El ejercicio se puede resolver con lo que dice y los datos tienen sentido en la realidad (una pizza de 8 trozos no se reparte ` +
  `entre 5 personas sin que sobren; un niño de 7 años no pesa 70 kg; un reparto que no sale exacto cuando el enunciado lo da por exacto).\n` +
  `3. El nivel es el que toca: un ejercicio del bloque 1 que ya es difícil, un ejercicio del bloque 3 que solo pide reconocer o copiar, ` +
  `o uno que es de un curso inferior al de la ficha (en 5.º y 6.º de Primaria esto es grave).\n` +
  `4. No repite otro ejercicio de la ficha ni pregunta lo que otro ya contesta.\n` +
  `5. Es del tema y es riguroso (nada inventado, nada que un libro de texto contradiga). Esto incluye los recuadros de cada bloque ` +
  `(«recuerda»: equivalencias, siglas, datos; «reto»; «consejo»): un dato equivocado ahí se aprende mal. Si el fallo está en un recuadro, ` +
  `pon "ejercicio": 0.\n` +
  `5 bis. Si el ejercicio lleva "fracciones" (pizzas o tartas que dibuja la aplicación: "partes" trozos con "tomadas" cogidos), lo que dice el ` +
  `enunciado, las preguntas y los números tienen que coincidir con esas figuras (una pizza de 8 trozos de la que se comen 3 es 3/8, no 3/5).\n` +
  `6. Está bien montado: en "relacionar" cada par tiene sentido; en "verdadero_falso" las falsas tienen un error que se puede razonar; ` +
  `en "completar" los huecos se deducen; en "opcion_multiple" hay una sola correcta; la "solucion" explica cómo se llega.\n` +
  `NO son fallos: en "ordenar" los "elementos" vienen en el orden correcto a propósito (la aplicación los desordena al imprimir); ` +
  `en "sopa_letras" y "crucigrama" la cuadrícula la monta la aplicación; los dibujos se ponen en la hoja; la "solucion" es para el ` +
  `profesorado (no la juzgues por su estilo, solo si es incorrecta o no explica cómo se llega).\n` +
  `Si algo no es grave, no lo menciones. Si la ficha está bien, devuelve la lista vacía. Como mucho tres fallos, los más graves.`;

/**
 * La IA revisa la ficha ya hecha y señala los ejercicios que un docente corregiría
 * antes de repartirla. Es un paso extra: si falla, devuelve una lista vacía.
 * Los ejercicios con dibujos del catálogo no se revisan (su recuento y su solución
 * los calcula el código) ni el escape room (su código depende de las respuestas).
 */
export async function revisarFicha(
  content: FichaContent, req: Pick<FichaRequest, 'tema' | 'area' | 'nivel'>, lang: Lang, callbacks: Callbacks = {},
): Promise<HallazgoRevision[]> {
  if ((content.formato ?? 'ficha') !== 'ficha') return [];
  callbacks.onStart?.();
  try {
    const perfil = perfilDeCurso(req.nivel, req);
    const esperado = expectativas(perfil);
    const revisable = {
      titulo: content.titulo,
      explicacion: content.explicacion,
      bloques: content.actividades.map((a, i) => ({
        bloque: i + 1,
        titulo: a.titulo,
        dificultad: a.dificultad,
        recuadro: a.recuadro,
        ejercicios: a.ejercicios.flatMap((e, j) => {
          if (esTipoConDibujos(e.tipo)) return [];
          return [{ ejercicio: j + 1, ...exerciseForPrompt(e), dibujos: undefined, categorias: undefined }];
        }),
      })),
    };
    const userPrompt = content.lectura
      ? `Tema: ${req.tema}\nCurso o nivel: ${req.nivel || '(no indicado)'}\n${esFacil(content) ? 'Es una ficha en lectura fácil.\n' : ''}` +
        `Qué se espera en cada nivel:\n${([1, 2, 3] as const).map(d => `- Nivel ${d}: ${NIVELES_LECTURA[d]}`).join('\n')}\n` +
        `\nTEXTO (${content.lectura.genero}):\n${textoNumerado(content.lectura)}\n\nActividades (JSON):\n${JSON.stringify(revisable)}\n\nRevísalas. El idioma de salida DEBE SER ${idioma(lang)}.`
      : `Tema: ${req.tema}\nÁrea o asignatura: ${req.area || '(no indicada)'}\nCurso o nivel: ${req.nivel || '(no indicado)'}\n` +
        `Qué se espera en cada nivel de dificultad en este curso:\n` +
        ([1, 2, 3] as Dificultad[]).map(d => `- Nivel ${d}: ${esperado[d]}`).join('\n') + '\n' +
        avisoDeSubida(perfil) +
        `\nFicha (JSON):\n${JSON.stringify(revisable)}\n\nRevísala. El idioma de salida DEBE SER ${idioma(lang)}.`;
    const raw = await callGemini(content.lectura ? REVISION_SISTEMA_LECTURA : REVISION_SISTEMA, userPrompt, [], { onError: callbacks.onError }, {
      maxOutputTokens: 8192,
      responseSchema: REVISION_SCHEMA,
      thinkingLevel: 'medium',
      temperature: 0.3,
    });
    if (!raw) return [];
    const parsed = parseGeminiJson<{ problemas?: HallazgoRevision[] }>(raw);
    return (Array.isArray(parsed?.problemas) ? parsed.problemas : [])
      .filter(h => h && Number.isInteger(h.bloque) && Number.isInteger(h.ejercicio) && typeof h.motivo === 'string' && h.motivo.trim()
        && (h.ejercicio === 0 ? !!content.actividades[h.bloque - 1]?.recuadro : !!content.actividades[h.bloque - 1]?.ejercicios[h.ejercicio - 1]))
      .slice(0, MAX_REVISADOS);
  } catch {
    return [];
  } finally {
    callbacks.onEnd?.();
  }
}

/** Corrige el recuadro de un bloque (un dato mal en el «Recuerda»); `null` si la IA no contesta o no devuelve nada válido. */
async function regenerateRecuadro(
  content: FichaContent, req: Pick<FichaRequest, 'tema' | 'area' | 'nivel'>, actIdx: number, motivo: string, lang: Lang,
): Promise<FichaRecuadro | null> {
  const act = content.actividades[actIdx];
  if (!act?.recuadro) return null;
  try {
    const raw = await callGemini(
      'Eres un maestro o una maestra que corrige un recuadro de una ficha de trabajo. Devuelves el mismo recuadro con el fallo corregido, y nada más.',
      fichaContextForPrompt(content, req) +
      `Bloque de actividad: ${act.titulo}\nRecuadro actual (JSON):\n${JSON.stringify(act.recuadro)}\n\n` +
      `Fallo que hay que corregir: ${motivo}\n` +
      `Devuelve el recuadro corregido, del mismo tipo y con el mismo formato ("lista" con líneas «SIGLA = significado» si es de tipo "recuerda"). ` +
      `El idioma de salida DEBE SER ${idioma(lang)}.`,
      [], {}, { maxOutputTokens: 2048, responseSchema: RECUADRO_SCHEMA, thinkingLevel: 'low', temperature: 0.5 },
    );
    const nuevo = raw ? cleanRecuadro(parseGeminiJson<FichaRecuadro>(raw) ?? undefined) : undefined;
    return nuevo && nuevo.tipo === act.recuadro.tipo ? nuevo : null;
  } catch {
    return null;
  }
}

/**
 * Lo que se hace con una ficha recién salida de la IA: rehacer los ejercicios rotos
 * (`repararFicha`) y, después, que la IA revise la ficha y se rehagan los graves
 * (`revisarFicha`). Cualquier fallo deja la ficha como estaba: el docente la edita.
 */
/** Cuántos ejercicios nuevos se piden, como mucho, para completar el reparto. */
const MAX_ANADIDOS = 4;

/**
 * La ficha con los ejercicios que decidió el código para cada bloque: si la IA puso
 * menos (pasó con 4 de 6), se le piden los que faltan al bloque, y si puso de más, se
 * quitan los últimos. Solo si salieron los bloques del reparto, y nunca en un escape room.
 */
async function ajustarAlReparto(
  content: FichaContent, req: Pick<FichaRequest, 'tema' | 'area' | 'nivel'>, plan: BloquePlan[] | undefined, lang: Lang,
): Promise<FichaContent> {
  if (!plan?.length || (content.formato ?? 'ficha') !== 'ficha' || content.actividades.length !== plan.length) return content;
  let actual = content;
  let anadidos = 0;
  for (let a = 0; a < plan.length; a++) {
    const quiere = plan[a].ejercicios;
    if (actual.actividades[a].ejercicios.length > quiere) {
      actual = { ...actual, actividades: actual.actividades.map((act, i) => (i === a ? { ...act, ejercicios: act.ejercicios.slice(0, quiere) } : act)) };
    }
    while (actual.actividades[a].ejercicios.length < quiere && anadidos < MAX_ANADIDOS) {
      anadidos++;
      const nuevo = await addExercise(actual, req, a, {}, lang);
      if (!nuevo) break;
      actual = { ...actual, actividades: actual.actividades.map((act, i) => (i === a ? { ...act, ejercicios: [...act.ejercicios, nuevo] } : act)) };
    }
  }
  return actual;
}

/** El banco de palabras de «etiquetar» solo se da en 1.º a 3.º de Primaria. */
const bancoPermitido = (perfil: PerfilCurso): boolean => perfil.etapa === 'primaria' && perfil.curso >= 1 && perfil.curso <= 3;

/** Cuántos ejercicios con dibujos del catálogo (contar, etiquetar, clasificar) lleva como mínimo una ficha con hilo de 1.º y 2.º de Primaria. */
const MIN_EJERCICIOS_CON_DIBUJOS = 2;

/**
 * La receta de 1.º y 2.º de Primaria con hilo conductor: al menos un «contar» y un «etiquetar»
 * (o «clasificar»). Si la IA no los puso (una IA floja da solo preguntas abiertas con los
 * dibujos de adorno), el código monta los que faltan con los dibujos del hilo, sustituyendo
 * una pregunta abierta o un «completar» de los bloques de nivel 1 y 2, que no lleve dibujos.
 */
function completarDibujos(content: FichaContent, perfil: PerfilCurso, lang: Lang): FichaContent {
  const hilo = hiloPorId(content.hilo);
  if (!hilo || perfil.banda !== 'ciclo1' || (content.formato ?? 'ficha') !== 'ficha' || content.visual) return content;
  let actual = content;
  const todos = () => actual.actividades.flatMap(a => a.ejercicios);
  const conDibujos = () => todos().filter(x => esTipoConDibujos(x.tipo)).length;
  for (const tipo of ['contar', 'etiquetar'] as const) {
    if (conDibujos() >= MIN_EJERCICIOS_CON_DIBUJOS || todos().some(x => x.tipo === tipo)) continue;
    const nuevo = tipo === 'contar' ? contarDelHilo(hilo, lang, Math.random, perfil.curso <= 1 ? 5 : 6) : etiquetarDelHilo(hilo, lang, { banco: true });
    let sitio: [number, number] | undefined;
    actual.actividades.forEach((act, a) => {
      if (sitio || (act.dificultad ?? 1) > 2) return;
      const e = act.ejercicios.findIndex(x => ['abierta', 'completar'].includes(x.tipo) && !x.dibujos?.length && !x.figura);
      if (e >= 0) sitio = [a, e];
    });
    if (nuevo && sitio) actual = conEjercicio(actual, sitio[0], sitio[1], nuevo as FichaExercise);
  }
  return actual;
}

/**
 * La receta de un tema de fracciones o decimales en «Cuaderno»: al menos un ejercicio con pizzas. Si la IA no
 * puso ninguno (con una IA real a veces las ignora aunque se le pidan), el código monta uno, sustituyendo una
 * pregunta abierta o un «completar» de los bloques de nivel 1 y 2, mejor uno que ya hablara de fracciones o
 * de figuras. Con tema de decimales pide también el decimal de cada pizza.
 */
function completarFracciones(content: FichaContent, req: Pick<FichaRequest, 'tema' | 'area' | 'nivel'>, lang: Lang): FichaContent {
  if (!admiteFraccionesEn(content, req)) return content;
  if (content.actividades.some(a => a.ejercicios.some(x => x.tipo === 'fracciones' || x.fracciones?.length))) return content;
  let mejor: { a: number; e: number; puntos: number } | undefined;
  content.actividades.forEach((act, a) => {
    if ((act.dificultad ?? 1) > 2) return;
    act.ejercicios.forEach((x, e) => {
      if (!['abierta', 'completar'].includes(x.tipo) || x.dibujos?.length || x.figura) return;
      const puntos = (RE_HABLA_DE_FIGURAS.test(x.enunciado ?? '') ? 2 : 0) + (RE_TEMA_FRACCIONES.test(x.enunciado ?? '') ? 1 : 0);
      if (!mejor || puntos > mejor.puntos) mejor = { a, e, puntos };
    });
  });
  if (!mejor) return content;
  return conEjercicio(content, mejor.a, mejor.e, fraccionesParaEjercicio('leer', lang, { decimal: /decimal/i.test(req.tema ?? '') }) as FichaExercise);
}

async function mejorarFicha(
  content: FichaContent, req: Pick<FichaRequest, 'tema' | 'area' | 'nivel'>, lang: Lang, revisar = true, plan?: BloquePlan[],
): Promise<FichaContent> {
  const reparada = await repararFicha(await ajustarAlReparto(content, req, plan, lang), req, lang);
  // Una ficha de lectura no lleva dibujos de ejercicio ni pizzas: lo suyo es el texto
  let actual = content.lectura ? reparada : completarFracciones(completarDibujos(reparada, perfilDeCurso(req.nivel, req), lang), req, lang);
  if (!revisar || (actual.formato ?? 'ficha') !== 'ficha') return actual;
  for (const h of await revisarFicha(actual, req, lang)) {
    const a = h.bloque - 1;
    const e = h.ejercicio - 1;
    if (e < 0) {
      const recuadro = await regenerateRecuadro(actual, req, a, h.motivo, lang);
      if (recuadro) actual = { ...actual, actividades: actual.actividades.map((act, i) => (i === a ? { ...act, recuadro } : act)) };
      continue;
    }
    const nuevo = await regenerateExercise(actual, req, a, e, { instruccion: h.motivo }, lang);
    if (!nuevo || problemaDeEjercicio(nuevo, !!actual.hilo)) continue;
    actual = conEjercicio(actual, a, e, nuevo);
  }
  return actual;
}

/* ── Vía suelta: tema + curso, sin anclar a ninguna SdA ── */

export async function generateFicha(
  req: FichaRequest, lang: Lang, callbacks: Callbacks = {},
): Promise<FichaContent | null> {
  callbacks.onStart?.();
  try {
    // Comprensión lectora: primero el texto y después las actividades sobre él
    if (req.lectura) return await generateLectura(req, lang, callbacks);
    const formato = req.formato ?? 'ficha';
    const estilo = effectiveEstilo(req.estilo, formato);
    const visual = !!req.visual && formato !== 'tarjetas';
    const facil = !!req.facil && formato !== 'tarjetas';
    // La escalera de dificultad la decide el código: cuántos bloques y de qué nivel
    const perfil = perfilDeCurso(req.nivel, req);
    const plan = formato === 'tarjetas' ? undefined : planDeBloques(req.numEjercicios);
    const userPrompt =
      `Tema: ${req.tema}\n` +
      `Área o asignatura: ${req.area || '(no indicada)'}\n` +
      `Curso o nivel: ${req.nivel || '(no indicado)'}\n` +
      (req.contextoClase ? `Características del grupo: ${req.contextoClase}\n` : '') +
      `\n${askFor(formato, req.numEjercicios, 'sobre este tema', plan)}\n\n${numberVarietyHint(perfil)}`;

    const hilo = resolverHilo(req, estilo, formato, visual);
    const fracciones = admiteFracciones({ estilo, formato, visual }, req);
    const content = await callFichaText(
      systemPrompt(req.niveles, lang, estilo, formato, visual, hilo, plan?.length ? { plan, perfil } : undefined, fracciones, facil),
      userPrompt, req.niveles, estilo, formato, callbacks.onError, visual, hilo, lang, plan, fracciones, { facil },
    );
    return content ? await mejorarFicha(content, req, lang, req.revisar !== false, plan) : null;
  } finally {
    callbacks.onEnd?.();
  }
}

/* ── Comprensión lectora: un texto con sus dibujos y actividades sobre él ── */

/**
 * La ficha de comprensión lectora, en dos llamadas como lo haría un docente: primero el texto (su longitud la comprueba el
 * código y los dibujos son del catálogo), y después las actividades, escritas sobre el texto ya escrito. Siempre en
 * «Cuaderno». Con `base`, el texto que se reescribe (la lectura fácil de una ficha que ya existe).
 */
async function generateLectura(
  req: FichaRequest, lang: Lang, callbacks: Callbacks, base?: { titulo: string; lectura: FichaLectura },
): Promise<FichaContent | null> {
  const facil = !!req.facil;
  const perfil = perfilDeCurso(req.nivel, req);
  const texto = await generarTextoLectura(
    req.tema, { perfil, facil, tema: req.tema, area: req.area, nivel: req.nivel }, lang,
    { onError: callbacks.onError, genero: req.generoLectura, base },
  );
  if (!texto) return null;
  const plan = planDeBloques(req.numEjercicios);
  const content = await callFichaText(
    actividadesSistema(lang, plan, perfil, facil), actividadesPedido(texto.titulo, texto.lectura, plan, req.numEjercicios),
    false, 'cuaderno', 'ficha', callbacks.onError, false, undefined, lang, plan, false, { facil, lectura: true },
  );
  if (!content) return null;
  const completa: FichaContent = {
    ...content, titulo: texto.titulo, lectura: texto.lectura, explicacion: '', instrucciones: instruccionesDeLectura(lang, facil),
    estilo: 'cuaderno', formato: 'ficha', hilo: undefined,
  };
  return mejorarFicha(completa, req, lang, req.revisar !== false, plan);
}

/* ── Vía anclada: a partir de una Situación de Aprendizaje ya redactada ── */

export async function generateFichaFromSda(
  sda: SdaContent, area: string,
  opts: {
    numEjercicios: number; niveles: boolean; detalles: string; estilo?: FichaThemeChoice; formato?: FichaFormato; hilo?: string;
    /** El curso de la clase de la SdA, para calibrar el nivel («5º de Primaria»). */
    nivel?: string; revisar?: boolean;
  },
  lang: Lang, callbacks: Callbacks = {},
): Promise<FichaContent | null> {
  callbacks.onStart?.();
  try {
    const areaData = sda.areas.find(a => a.area === area) ?? sda.areas[0];
    const formato = opts.formato ?? 'ficha';
    const estilo = effectiveEstilo(opts.estilo, formato);
    const perfil = perfilDeCurso(opts.nivel, { area: areaData?.area ?? area, tema: sda.titulo });
    const plan = formato === 'tarjetas' ? undefined : planDeBloques(opts.numEjercicios);

    const userPrompt =
      `Situación de aprendizaje: ${sda.titulo}\n` +
      `Área: ${areaData?.area ?? area}\n` +
      (opts.nivel ? `Curso o nivel: ${opts.nivel}\n` : '') +
      `Saberes básicos de esta área: ${areaData?.saberesBasicos ?? ''}\n` +
      `Criterios de evaluación de esta área: ${areaData?.criteriosEvaluacion ?? ''}\n` +
      (opts.detalles ? `Además, ten en cuenta: ${opts.detalles}\n` : '') +
      `\n${askFor(formato, opts.numEjercicios, 'que trabajen estos saberes básicos', plan)}\n\n${numberVarietyHint(perfil)}`;

    const hilo = resolverHilo({ tema: sda.titulo, area: areaData?.area ?? area, hilo: opts.hilo }, estilo, formato, false);
    const fracciones = admiteFracciones({ estilo, formato }, { tema: sda.titulo, area: areaData?.area ?? area });
    const content = await callFichaText(
      systemPrompt(opts.niveles, lang, estilo, formato, false, hilo, plan?.length ? { plan, perfil } : undefined, fracciones),
      userPrompt, opts.niveles, estilo, formato, callbacks.onError, false, hilo, lang, plan, fracciones,
    );
    return content
      ? await mejorarFicha(content, { tema: sda.titulo, area: areaData?.area ?? area, nivel: opts.nivel ?? '' }, lang, opts.revisar !== false, plan)
      : null;
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

/** Lo que se espera del ejercicio de un bloque, para que el nuevo no baje ni suba de nivel. */
function nivelDeBloquePrompt(act: FichaActivity, req: Pick<FichaRequest, 'tema' | 'area' | 'nivel'>, lectura = false): string {
  const perfil = perfilDeCurso(req.nivel, req);
  const d = act.dificultad;
  if (lectura) return d ? `Nivel de dificultad de este bloque: ${d} de 3 (${NOMBRE_DIFICULTAD[d].toLowerCase()}). Aquí se pide: ${NIVELES_LECTURA[d]}\n` : '';
  return (d ? `Nivel de dificultad de este bloque: ${d} de 3 (${NOMBRE_DIFICULTAD[d].toLowerCase()}). Aquí se pide: ${expectativas(perfil)[d]}\n` : '') +
    avisoDeSubida(perfil);
}

function fichaContextForPrompt(c: FichaContent, req: Pick<FichaRequest, 'tema' | 'area' | 'nivel'>): string {
  return (
    `Ficha: ${c.titulo}\n` +
    `Tema: ${req.tema}\n` +
    `Área o asignatura: ${req.area || '(no indicada)'}\n` +
    `Curso o nivel: ${req.nivel || '(no indicado)'}\n` +
    (c.historia ? `Historia de la ficha: ${c.historia.personaje} — ${c.historia.mision}\n` : '') +
    (c.lectura ? `TEXTO (${c.lectura.genero}; los párrafos van numerados):\n${textoNumerado(c.lectura)}\n` : '')
  );
}

/**
 * ¿Se ofrecen las pizzas por fracciones al rehacer o añadir un ejercicio? Si el tema las admite o si ya
 * hay alguna en lo que se está tocando; siempre en «Cuaderno», una ficha normal y sin apoyos visuales.
 */
function conFraccionesEn(content: FichaContent, req: Pick<FichaRequest, 'tema' | 'area'>, ejercicios: FichaExercise[]): boolean {
  const base = { estilo: content.estilo as FichaThemeChoice | undefined, formato: content.formato, visual: content.visual };
  if (content.estilo !== 'cuaderno' || (content.formato ?? 'ficha') !== 'ficha' || content.visual) return false;
  return admiteFracciones(base, req) || ejercicios.some(e => e.tipo === 'fracciones' || !!e.fracciones?.length);
}

/**
 * Rehace un único ejercicio siguiendo la indicación del docente («hazlo más
 * fácil», «cámbialo por un crucigrama»…) sin tocar el resto de la ficha.
 */
export async function regenerateExercise(
  content: FichaContent, req: Pick<FichaRequest, 'tema' | 'area' | 'nivel'>, actIdx: number, exIdx: number,
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
      `Bloque de actividad: ${act.titulo}${act.narrativa ? ` (${act.narrativa})` : ''}\n` +
      nivelDeBloquePrompt(act, req, !!content.lectura) + '\n' +
      `Ejercicio actual (JSON):\n${JSON.stringify(exerciseForPrompt(ex))}\n\n` +
      `Rehaz SOLO este ejercicio. Indicación del docente: ${opts.instruccion || 'haz una versión distinta'}.\n` +
      (opts.tipo ? `El nuevo ejercicio debe ser de tipo "${opts.tipo}".\n` : 'Mantén el mismo tipo salvo que la indicación pida otro.\n') +
      `Debe seguir encajando en la ficha y en su historia, con el mismo nivel de dificultad que el resto de su bloque.\n\n` +
      (content.lectura ? '' : numberVarietyHint(perfilDeCurso(req.nivel, req)));
    const lectura = !!content.lectura;
    const facil = esFacil(content);
    const visual = !!content.visual && !lectura;
    const hilo = visual || lectura ? undefined : hiloPorId(content.hilo);
    // Las pizzas por fracciones, si el tema las admite o el ejercicio (o su bloque) ya las lleva
    const fracciones = !lectura && conFraccionesEn(content, req, [ex]);
    const sistema = lectura
      ? actividadesSistema(lang, [], perfilDeCurso(req.nivel, req), facil, true)
      : systemPrompt(niveles, lang, 'clasico', 'ficha', visual, hilo, undefined, fracciones, facil);
    const raw = await callGemini(sistema, userPrompt, [], { onError: callbacks.onError }, {
      maxOutputTokens: 4096,
      responseSchema: fichaExerciseSchema(niveles, visual, !!hilo, fracciones, lectura),
      thinkingLevel: 'low',
      temperature: 1.1,
    });
    if (!raw) return null;
    const parsed = parseGeminiJson<FichaExercise>(raw);
    if (!parsed?.tipo || !parsed.enunciado) return null;
    return prepareExercise(cleanExercise(parsed, visual, !!hilo, lang, content.estilo === 'cuaderno' && !lectura, { facil, lectura }));
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
  if (!conHistoria(estilo)) return null;
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
    `Crea la versión en LECTURA FÁCIL de esta ficha, para alumnado con dislexia o con dificultades lectoras. El contenido académico, ` +
    `los bloques y el número de ejercicios son los mismos; solo cambia cómo está escrito (ver LECTURA FÁCIL): frases cortas, ` +
    `una idea por frase, palabras clave en negrita con **doble asterisco** y enunciados de una sola tarea.`,
  visual:
    `Crea la versión CON APOYOS VISUALES de esta ficha (ver APOYOS VISUALES): mismo tema, mismos bloques, ` +
    `mismos tipos de ejercicio y el mismo número de ejercicios, con los mismos contenidos. Añade los pasos con ` +
    `pictogramas, la consigna dibujada de cada ejercicio, los dibujos donde ayuden y las tarjetas de la ` +
    `explicación, y acorta y simplifica los enunciados que lo necesiten sin cambiar lo que se trabaja.`,
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
    // Una ficha de comprensión lectora solo se adapta a lectura fácil, y reescribiendo su texto (las actividades se rehacen sobre él)
    if (content.lectura) {
      if (variante !== 'lectura_facil') return null;
      const total = content.actividades.reduce((n, a) => n + a.ejercicios.length, 0);
      const res = await generateLectura(
        { ...req, lectura: true, facil: true, generoLectura: content.lectura.genero, numEjercicios: Math.max(3, total) }, lang, callbacks,
        { titulo: content.titulo, lectura: content.lectura },
      );
      return res ? { ...res, variante } : null;
    }
    const formato = content.formato ?? 'ficha';
    const estilo: FichaThemeId = content.estilo ?? 'clasico';
    const historia = !!content.historia && conHistoria(estilo) && formato !== 'tarjetas';
    // «Cuaderno» sigue siendo «Cuaderno» en sus versiones adaptadas; «Clásica», sin estilo propio
    const cuaderno = estilo === 'cuaderno' && formato === 'ficha';
    const estiloPrompt: FichaThemeChoice = historia || cuaderno ? estilo : 'clasico';
    const original = {
      ...content,
      actividades: content.actividades.map(a => ({ ...a, ejercicios: a.ejercicios.map(exerciseForPrompt) })),
      estilo: undefined, variante: undefined,
    };
    // Una ficha visual sigue siéndolo en sus otras versiones
    const visual = (variante === 'visual' || !!content.visual) && formato !== 'tarjetas';
    const userPrompt =
      `Tema: ${req.tema}\n` +
      `Área o asignatura: ${req.area || '(no indicada)'}\n` +
      `Curso o nivel: ${req.nivel || '(no indicado)'}\n\n` +
      `Ficha original (JSON):\n${JSON.stringify(original)}\n\n` +
      `${VARIANTE_PROMPT[variante]}\n` +
      (historia ? 'Mantén la misma historia y el mismo personaje, adaptando sus textos al mismo criterio.\n' : '') +
      (formato === 'escape' ? 'Recalcula el código de cada candado para que salga de las nuevas respuestas.\n' : '');
    // Con hilo, la versión adaptada lo conserva (salvo la visual, que lleva pictogramas)
    const hilo = cuaderno && !visual ? hiloPorId(content.hilo) : undefined;
    // Una ficha con pizzas por fracciones las conserva en sus versiones adaptadas (menos la visual, que lleva pictogramas)
    const fracciones = cuaderno && !visual && conFraccionesEn(content, req, content.actividades.flatMap(a => a.ejercicios));
    const facil = variante === 'lectura_facil' && formato !== 'tarjetas';
    const raw = await callGemini(systemPrompt(false, lang, estiloPrompt, formato, visual, hilo, undefined, fracciones, facil), userPrompt, [], { onError: callbacks.onError }, {
      maxOutputTokens: visual ? 24576 : 16384,
      responseSchema: fichaSchema({ niveles: false, historia, elegirEstilo: false, formato, visual, cuaderno, dibujos: !!hilo, fracciones }),
      thinkingLevel: 'medium',
      temperature: 0.9,
    });
    if (!raw) return null;
    const parsed = parseGeminiJson<FichaContent>(raw);
    if (!parsed) return null;
    // Misma ficha, mismos bloques: cada uno conserva su peldaño de la escalera
    const mismos = (parsed.actividades ?? []).length === content.actividades.length;
    const actividades = (parsed.actividades ?? []).map((a, i) => ({ ...a, dificultad: mismos ? content.actividades[i].dificultad : a.dificultad }));
    const out = cleanFichaContent({ ...parsed, actividades }, estiloPrompt, formato, visual, hilo, lang, undefined, { facil });
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
  content: FichaContent, req: Pick<FichaRequest, 'tema' | 'area' | 'nivel'>, actIdx: number,
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
      nivelDeBloquePrompt(act, req, !!content.lectura) +
      `Ejercicios que ya tiene el bloque (no los repitas):\n` +
      act.ejercicios.map((e, i) => `${i + 1}. [${e.tipo}] ${e.enunciado}`).join('\n') + '\n\n' +
      `Crea UN ejercicio nuevo para este bloque, distinto de los anteriores y con el mismo nivel.\n` +
      (opts.tipo ? `Debe ser de tipo "${opts.tipo}".\n` : 'Elige el tipo que mejor complete el bloque, preferiblemente uno que el bloque aún no tenga.\n') +
      (opts.instruccion ? `Indicación del docente: ${opts.instruccion}\n` : '') +
      (formato === 'escape' ? 'Es un escape room: el ejercicio debe tener una respuesta corta y única.\n' : '') +
      (content.lectura ? '' : `\n${numberVarietyHint(perfilDeCurso(req.nivel, req))}`);
    const lectura = !!content.lectura;
    const facil = esFacil(content);
    const visual = !!content.visual && !lectura;
    const hilo = visual || lectura ? undefined : hiloPorId(content.hilo);
    const fracciones = !lectura && conFraccionesEn(content, req, act.ejercicios);
    const sistema = lectura
      ? actividadesSistema(lang, [], perfilDeCurso(req.nivel, req), facil, true)
      : systemPrompt(niveles, lang, 'clasico', 'ficha', visual, hilo, undefined, fracciones, facil);
    const raw = await callGemini(sistema, userPrompt, [], { onError: callbacks.onError }, {
      maxOutputTokens: 4096,
      responseSchema: fichaExerciseSchema(niveles, visual, !!hilo, fracciones, lectura),
      thinkingLevel: 'low',
      temperature: 1.1,
    });
    if (!raw) return null;
    const parsed = parseGeminiJson<FichaExercise>(raw);
    if (!parsed?.tipo || !parsed.enunciado) return null;
    return prepareExercise(cleanExercise(parsed, visual, !!hilo, lang, content.estilo === 'cuaderno' && !lectura, { facil, lectura }));
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
