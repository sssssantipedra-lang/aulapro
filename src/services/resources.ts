/**
 * Motor de recursos pedagógicos — primer tipo: fichas de trabajo.
 *
 * Dos vías de generación, como ya pasa con rúbricas y dianas: suelta (un
 * tema y un curso, sin más contexto) o anclada a una Situación de
 * Aprendizaje ya redactada (usa sus saberes básicos y criterios de
 * evaluación, así el ejercicio no sale genérico). Las dos comparten el
 * mismo esquema de salida y acaban en el mismo sitio: la sección Recursos.
 */

import { callGemini, parseGeminiJson } from './gemini';
import type { Lang } from '../i18n';
import type { SdaContent } from './learningSituations';

/* ── Lo que devuelve la IA ── */

export type FichaExerciseType = 'abierta' | 'completar' | 'opcion_multiple' | 'problema';

export interface FichaExercise {
  tipo: FichaExerciseType;
  enunciado: string;
  /** Solo cuando `tipo` es 'opcion_multiple': de 3 a 5 opciones. */
  opciones?: string[];
  /** Para el profesorado — nunca se muestra en la ficha exportada. */
  solucion: string;
  /** Variante simplificada del mismo ejercicio. Solo si se pidieron niveles. */
  apoyo?: string;
  /** Variante de más nivel del mismo ejercicio. Solo si se pidieron niveles. */
  ampliacion?: string;
}

export interface FichaContent {
  titulo: string;
  /** Repaso breve del concepto, previo a los ejercicios — ver `explicacion` en el esquema. */
  explicacion: string;
  instrucciones: string;
  ejercicios: FichaExercise[];
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

const TIPOS: FichaExerciseType[] = ['abierta', 'completar', 'opcion_multiple', 'problema'];

/**
 * Dos variantes del esquema del ejercicio según se pidan o no niveles: pedir
 * siempre "apoyo"/"ampliacion" como obligatorios, aunque no se vayan a usar,
 * hace que la IA los redacte igualmente por cumplir el esquema — mejor no
 * incluir el campo en absoluto cuando no hacen falta.
 */
function fichaExerciseSchema(niveles: boolean) {
  const base = ['tipo', 'enunciado', 'solucion'] as const;
  return {
    type: 'OBJECT',
    properties: {
      tipo: {
        type: 'STRING', enum: TIPOS,
        description: '"abierta" para respuesta libre, "completar" para huecos, "opcion_multiple" o "problema" para cálculos/razonamientos con pasos',
      },
      enunciado: S('El texto del ejercicio o la pregunta, autocontenido'),
      opciones: {
        type: 'ARRAY', items: { type: 'STRING' },
        description: 'Solo si tipo es "opcion_multiple": de 3 a 5 opciones',
      },
      solucion: S('La respuesta correcta o un modelo de respuesta breve, para el profesorado'),
      ...(niveles ? {
        apoyo: S('Versión simplificada o con más pistas del MISMO ejercicio, para quien necesite refuerzo'),
        ampliacion: S('Versión de más nivel o un reto añadido del MISMO ejercicio, para quien necesite más exigencia'),
      } : {}),
    },
    required: niveles ? [...base, 'apoyo', 'ampliacion'] : [...base],
    propertyOrdering: niveles
      ? ['tipo', 'enunciado', 'opciones', 'solucion', 'apoyo', 'ampliacion']
      : ['tipo', 'enunciado', 'opciones', 'solucion'],
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
      ejercicios: { type: 'ARRAY', items: fichaExerciseSchema(niveles) },
    },
    required: ['titulo', 'explicacion', 'instrucciones', 'ejercicios'],
    propertyOrdering: ['titulo', 'explicacion', 'instrucciones', 'ejercicios'],
  } as const;
}

function systemPrompt(niveles: boolean, lang: Lang): string {
  return (
    `Eres un experto en didáctica y creación de materiales educativos. Tu tarea exclusiva es ` +
    `redactar una ficha de trabajo imprimible para el alumnado: una breve explicación del concepto ` +
    `y después los ejercicios.\n` +
    `EXPLICACIÓN: en el campo "explicacion", antes de los ejercicios, recuerda el concepto en pocas ` +
    `frases, como lo haría el profesorado en la pizarra antes de mandar la tarea — no es un tema nuevo, ` +
    `es un repaso. Si encaja, incluye un ejemplo resuelto corto.\n` +
    `TIPOS: usa el tipo de ejercicio más adecuado a cada pregunta, variando cuando tenga sentido.\n` +
    `SOLUCIÓN: el campo "solucion" es SIEMPRE para el profesorado, nunca se muestra al alumnado en ` +
    `la ficha impresa: da la respuesta correcta o un modelo de respuesta breve.\n` +
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
 * El primer intento de esto quitaba cualquier `$...$` cuyo interior, DESPUÉS
 * de convertir el exponente, ya no tuviera caracteres de LaTeX — pero eso no
 * distingue una fórmula real de dos precios en la misma frase: "cuesta $5 y
 * $10 más" también cumplía esa condición y se comía los dos símbolos de
 * dólar. Ahora los `$` solo se quitan cuando, DE PARTIDA, lo que hay entre
 * ellos es exactamente "base^exponente" —el `^` tiene que estar ahí ya, no
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

function cleanFichaContent(c: FichaContent): FichaContent {
  return {
    ...c,
    titulo: cleanMathNotation(c.titulo),
    explicacion: cleanMathNotation(c.explicacion),
    instrucciones: cleanMathNotation(c.instrucciones),
    ejercicios: c.ejercicios.map(ex => ({
      ...ex,
      enunciado: cleanMathNotation(ex.enunciado),
      opciones: ex.opciones?.map(cleanMathNotation),
      solucion: cleanMathNotation(ex.solucion),
      apoyo: ex.apoyo ? cleanMathNotation(ex.apoyo) : ex.apoyo,
      ampliacion: ex.ampliacion ? cleanMathNotation(ex.ampliacion) : ex.ampliacion,
    })),
  };
}

type Callbacks = { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void };

async function callFicha(system: string, user: string, niveles: boolean, callbacks: Callbacks): Promise<FichaContent | null> {
  const raw = await callGemini(system, user, [], callbacks, {
    maxOutputTokens: 8192,
    responseSchema: fichaSchema(niveles),
  });
  if (!raw) return null;
  const parsed = parseGeminiJson<FichaContent>(raw);
  if (!parsed) return null;
  return cleanFichaContent({ ...parsed, ejercicios: parsed.ejercicios ?? [] });
}

/* ── Vía suelta: tema + curso, sin anclar a ninguna SdA ── */

export async function generateFicha(
  req: FichaRequest, lang: Lang, callbacks: Callbacks = {},
): Promise<FichaContent | null> {
  const userPrompt =
    `Tema: ${req.tema}\n` +
    `Área o asignatura: ${req.area || '(no indicada)'}\n` +
    `Curso o nivel: ${req.nivel || '(no indicado)'}\n` +
    (req.contextoClase ? `Características del grupo: ${req.contextoClase}\n` : '') +
    `Número de ejercicios: ${req.numEjercicios}\n\n` +
    `Genera una ficha de trabajo con EXACTAMENTE ${req.numEjercicios} ejercicios sobre este tema.`;

  return callFicha(systemPrompt(req.niveles, lang), userPrompt, req.niveles, callbacks);
}

/* ── Vía anclada: a partir de una Situación de Aprendizaje ya redactada ── */

export async function generateFichaFromSda(
  sda: SdaContent, area: string,
  opts: { numEjercicios: number; niveles: boolean; detalles: string },
  lang: Lang, callbacks: Callbacks = {},
): Promise<FichaContent | null> {
  const areaData = sda.areas.find(a => a.area === area) ?? sda.areas[0];

  const userPrompt =
    `Situación de aprendizaje: ${sda.titulo}\n` +
    `Área: ${areaData?.area ?? area}\n` +
    `Saberes básicos de esta área: ${areaData?.saberesBasicos ?? ''}\n` +
    `Criterios de evaluación de esta área: ${areaData?.criteriosEvaluacion ?? ''}\n` +
    (opts.detalles ? `Además, ten en cuenta: ${opts.detalles}\n` : '') +
    `Número de ejercicios: ${opts.numEjercicios}\n\n` +
    `Genera una ficha de trabajo con EXACTAMENTE ${opts.numEjercicios} ejercicios que trabajen estos saberes básicos.`;

  return callFicha(systemPrompt(opts.niveles, lang), userPrompt, opts.niveles, callbacks);
}
