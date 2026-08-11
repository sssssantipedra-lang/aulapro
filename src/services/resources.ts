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
 * las fichas de verdad, con bloques tipo "ACTIVIDAD 1: ..."), y hay siete
 * tipos de ejercicio — los cuatro de siempre más tabla para rellenar,
 * relacionar y colorear según el resultado, pensados para que el alumnado
 * trabaje a mano sobre el papel: la ficha no dibuja las líneas de
 * "relacionar" ni colorea las celdas de "colorear" por él, solo deja el
 * espacio y la leyenda.
 */

import { callGemini, parseGeminiJson } from './gemini';
import type { Lang } from '../i18n';
import type { SdaContent } from './learningSituations';

/* ── Lo que devuelve la IA ── */

export type FichaExerciseType =
  | 'abierta' | 'completar' | 'opcion_multiple' | 'problema'
  | 'tabla_rellenar' | 'relacionar' | 'colorear';

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
}

export interface FichaContent {
  titulo: string;
  /** Repaso breve del concepto, previo a los ejercicios. */
  explicacion: string;
  instrucciones: string;
  actividades: FichaActivity[];
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
}

const idioma = (lang: Lang) => (lang === 'en' ? 'INGLÉS' : 'ESPAÑOL');

/* ── Esquema de salida ── */

const S = (d: string) => ({ type: 'STRING', description: d });

const TIPOS: FichaExerciseType[] = [
  'abierta', 'completar', 'opcion_multiple', 'problema', 'tabla_rellenar', 'relacionar', 'colorear',
];

const LEYENDA_ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: { color: S('Nombre del color'), criterio: S('Qué debe cumplir un elemento para llevar ese color') },
  required: ['color', 'criterio'],
  propertyOrdering: ['color', 'criterio'],
} as const;

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
          '"relacionar" dos columnas para unir a mano, "colorear" leyenda de colores + elementos a colorear',
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
      solucion: S(
        'La respuesta correcta, para el profesorado: en "tabla_rellenar" los valores que faltan, en ' +
        '"relacionar" qué elemento de la izquierda va con cuál de la derecha, en "colorear" qué color ' +
        'lleva cada elemento',
      ),
      ...(niveles ? {
        apoyo: S('Versión simplificada o con más pistas del MISMO ejercicio, para quien necesite refuerzo'),
        ampliacion: S('Versión de más nivel o un reto añadido del MISMO ejercicio, para quien necesite más exigencia'),
      } : {}),
    },
    required: niveles ? [...base, 'apoyo', 'ampliacion'] : [...base],
    propertyOrdering: [
      'tipo', 'enunciado', 'opciones', 'columnas', 'filas', 'izquierda', 'derecha',
      'leyenda', 'itemsColorear', 'solucion', ...(niveles ? ['apoyo', 'ampliacion'] : []),
    ],
  } as const;
}

function fichaActivitySchema(niveles: boolean) {
  return {
    type: 'OBJECT',
    properties: {
      titulo: S('Título breve del bloque de actividad, ej. "Escribe como potencia"'),
      ejercicios: { type: 'ARRAY', items: fichaExerciseSchema(niveles) },
    },
    required: ['titulo', 'ejercicios'],
    propertyOrdering: ['titulo', 'ejercicios'],
  } as const;
}

function fichaSchema(niveles: boolean) {
  return {
    type: 'OBJECT',
    properties: {
      titulo: S('Título breve de la ficha'),
      explicacion: S(
        'Repaso breve (3-5 frases) del concepto antes de los ejercicios: qué es, por qué sirve, ' +
        'y a ser posible un ejemplo resuelto sencillo. Se muestra destacado, antes de las instrucciones.',
      ),
      instrucciones: S('Instrucciones generales para el alumnado, dos o tres frases'),
      actividades: {
        type: 'ARRAY', items: fichaActivitySchema(niveles),
        description: 'De 2 a 4 bloques de actividad, cada uno con su título y sus propios ejercicios',
      },
    },
    required: ['titulo', 'explicacion', 'instrucciones', 'actividades'],
    propertyOrdering: ['titulo', 'explicacion', 'instrucciones', 'actividades'],
  } as const;
}

function systemPrompt(niveles: boolean, lang: Lang): string {
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
    solucion: cleanMathNotation(ex.solucion),
    apoyo: ex.apoyo ? cleanMathNotation(ex.apoyo) : ex.apoyo,
    ampliacion: ex.ampliacion ? cleanMathNotation(ex.ampliacion) : ex.ampliacion,
  };
}

function cleanFichaContent(c: FichaContent): FichaContent {
  return {
    ...c,
    titulo: cleanMathNotation(c.titulo),
    explicacion: cleanMathNotation(c.explicacion),
    instrucciones: cleanMathNotation(c.instrucciones),
    actividades: c.actividades.map(act => ({
      titulo: cleanMathNotation(act.titulo),
      ejercicios: act.ejercicios.map(cleanExercise),
    })),
  };
}

type Callbacks = { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void };

async function callFichaText(system: string, user: string, niveles: boolean, onError?: (m: string) => void): Promise<FichaContent | null> {
  const raw = await callGemini(system, user, [], { onError }, {
    maxOutputTokens: 12288,
    responseSchema: fichaSchema(niveles),
  });
  if (!raw) return null;
  const parsed = parseGeminiJson<FichaContent>(raw);
  if (!parsed) return null;
  return cleanFichaContent({ ...parsed, actividades: parsed.actividades ?? [] });
}

/* ── Vía suelta: tema + curso, sin anclar a ninguna SdA ── */

export async function generateFicha(
  req: FichaRequest, lang: Lang, callbacks: Callbacks = {},
): Promise<FichaContent | null> {
  callbacks.onStart?.();
  try {
    const userPrompt =
      `Tema: ${req.tema}\n` +
      `Área o asignatura: ${req.area || '(no indicada)'}\n` +
      `Curso o nivel: ${req.nivel || '(no indicado)'}\n` +
      (req.contextoClase ? `Características del grupo: ${req.contextoClase}\n` : '') +
      `Número de ejercicios: ${req.numEjercicios}\n\n` +
      `Genera una ficha de trabajo con un total de EXACTAMENTE ${req.numEjercicios} ejercicios sobre ` +
      `este tema, repartidos en sus bloques de actividad.`;

    return await callFichaText(systemPrompt(req.niveles, lang), userPrompt, req.niveles, callbacks.onError);
  } finally {
    callbacks.onEnd?.();
  }
}

/* ── Vía anclada: a partir de una Situación de Aprendizaje ya redactada ── */

export async function generateFichaFromSda(
  sda: SdaContent, area: string,
  opts: { numEjercicios: number; niveles: boolean; detalles: string },
  lang: Lang, callbacks: Callbacks = {},
): Promise<FichaContent | null> {
  callbacks.onStart?.();
  try {
    const areaData = sda.areas.find(a => a.area === area) ?? sda.areas[0];

    const userPrompt =
      `Situación de aprendizaje: ${sda.titulo}\n` +
      `Área: ${areaData?.area ?? area}\n` +
      `Saberes básicos de esta área: ${areaData?.saberesBasicos ?? ''}\n` +
      `Criterios de evaluación de esta área: ${areaData?.criteriosEvaluacion ?? ''}\n` +
      (opts.detalles ? `Además, ten en cuenta: ${opts.detalles}\n` : '') +
      `Número de ejercicios: ${opts.numEjercicios}\n\n` +
      `Genera una ficha de trabajo con un total de EXACTAMENTE ${opts.numEjercicios} ejercicios que ` +
      `trabajen estos saberes básicos, repartidos en sus bloques de actividad.`;

    return await callFichaText(systemPrompt(opts.niveles, lang), userPrompt, opts.niveles, callbacks.onError);
  } finally {
    callbacks.onEnd?.();
  }
}
