/**
 * Evaluar por foto: la IA lee la foto de un examen o de un trabajo de un
 * alumno y propone, pregunta por pregunta, los puntos y un comentario
 * (petición del dueño, 18-10-2026; ver `lib/evalFoto.ts`).
 *
 * Lo que sale de la app: las fotos del examen (reducidas y sin metadatos,
 * `fotoParaIA`), las de la hoja de soluciones si se pone y lo que el docente
 * escribe como criterios. No sale el nombre del alumno (ni siquiera lo conoce
 * la petición), y a la IA se le pide que no lea ni repita ningún nombre que
 * salga en la hoja. Nada se guarda fuera del equipo.
 */
import { callGemini, parseGeminiJson, type InlineFile } from './gemini';
import { normalizarCorreccion, ESTADOS_PREGUNTA, type CorreccionFoto } from '../lib/evalFoto';

type Callbacks = { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void };

export type TipoTrabajo = 'examen' | 'trabajo';

export interface PeticionFoto {
  tipo: TipoTrabajo;
  /** Asignatura y curso («Matemáticas, 5º de Primaria»), para ajustar la exigencia. */
  contexto: string;
  /** Total de puntos del examen si el docente lo sabe; si no, lo deduce la IA de la hoja. */
  total: number;
  /** Soluciones, criterios de corrección o lo que el docente quiera que se tenga en cuenta. */
  criterios: string;
}

/** Máximo de fotos del examen y de la hoja de soluciones: más no cabe con calidad en una petición. */
export const MAX_FOTOS_TRABAJO = 8;
export const MAX_FOTOS_SOLUCIONES = 3;

const SISTEMA =
  'Eres un docente experto en España que corrige con rigor, justicia y cercanía. Corriges con lo que se ve en las ' +
  'fotos: no inventes respuestas ni enunciados. Si algo no se lee, di que no se lee y marca la pregunta como dudosa ' +
  'en lugar de adivinar. No leas, copies ni repitas ningún nombre de persona que aparezca en la hoja: ignóralo. ' +
  'Escribe en castellano correcto, con tildes y eñes, sin markdown.';

/** Corrige un examen o un trabajo a partir de sus fotos. */
export async function corregirPorFoto(
  p: PeticionFoto, fotos: InlineFile[], soluciones: InlineFile[], callbacks: Callbacks = {},
): Promise<CorreccionFoto | null> {
  const esExamen = p.tipo === 'examen';
  const userPrompt =
    (fotos.length === 1 ? 'La foto adjunta es ' : `Las ${soluciones.length ? 'primeras ' : ''}${fotos.length} fotos adjuntas son `) +
    `${esExamen ? 'el examen' : 'el trabajo'} de un alumno, en el orden de las páginas.` +
    (soluciones.length ? ` ${soluciones.length === 1 ? 'La última foto es' : `Las ${soluciones.length} últimas fotos son`} la hoja de soluciones o de criterios del docente: corrige con ella.\n` : '\n') +
    (p.contexto ? `Asignatura y curso: ${p.contexto}.\n` : '') +
    (p.total > 0 ? `El examen vale ${p.total} puntos en total.\n` : '') +
    (p.criterios.trim() ? `Soluciones y criterios del docente, que mandan sobre tu criterio:\n${p.criterios.trim()}\n` : '') +
    (esExamen
      ? '\nCorrige el examen pregunta por pregunta. Si la hoja indica lo que vale cada pregunta, usa esos puntos; si no, repártelos ' +
        `con sentido hasta ${p.total > 0 ? p.total : 10} puntos. Si una pregunta tiene apartados, un elemento por apartado ("2a", "2b"). `
      : '\nCorrige el trabajo por apartados o criterios que tenga (si no los tiene, por contenido, organización, expresión y ' +
        `presentación), repartiendo ${p.total > 0 ? p.total : 10} puntos entre ellos. `) +
    'Para cada elemento de "preguntas": "n" (su número o letra), "enunciado" (muy corto), "respuesta" (lo que ha escrito o ' +
    'hecho el alumno, resumido, para que el docente compruebe que lo has leído bien), "puntosMax", "puntos" (justo y ' +
    `coherente: parcial si está en parte bien), "estado" (${ESTADOS_PREGUNTA.map(e => e.id).join(', ')}), "comentario" (una ` +
    'frase concreta de qué está bien o qué falla y cómo corregirlo) y "dudosa" (true si no estás segura de tu lectura o ' +
    'de tu puntuación). Además, "titulo" (qué examen o trabajo es), "comentarioGeneral" (2 a 4 frases para el alumno o su ' +
    'familia, en positivo y concretas), "puntosFuertes" y "aMejorar" (como mucho tres cada una, cosas concretas) y "avisos" ' +
    '(lo que no has podido leer o ver: una foto borrosa, una página que falta). No sumes tú los puntos: lo hace la aplicación.';

  const raw = await callGemini(SISTEMA + '\nResponde SOLO con JSON válido.', userPrompt, [...fotos, ...soluciones], callbacks, {
    responseSchema: {
      type: 'OBJECT',
      properties: {
        titulo: { type: 'STRING' },
        preguntas: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              n: { type: 'STRING' }, enunciado: { type: 'STRING' }, respuesta: { type: 'STRING' },
              puntosMax: { type: 'NUMBER' }, puntos: { type: 'NUMBER' },
              estado: { type: 'STRING', enum: ESTADOS_PREGUNTA.map(e => e.id) },
              comentario: { type: 'STRING' }, dudosa: { type: 'BOOLEAN' },
            },
            required: ['n', 'enunciado', 'respuesta', 'puntosMax', 'puntos', 'estado', 'comentario', 'dudosa'],
            propertyOrdering: ['n', 'enunciado', 'respuesta', 'puntosMax', 'puntos', 'estado', 'comentario', 'dudosa'],
          },
        },
        comentarioGeneral: { type: 'STRING' },
        puntosFuertes: { type: 'ARRAY', items: { type: 'STRING' } },
        aMejorar: { type: 'ARRAY', items: { type: 'STRING' } },
        avisos: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['titulo', 'preguntas', 'comentarioGeneral', 'puntosFuertes', 'aMejorar', 'avisos'],
    },
    thinkingLevel: 'high',
    maxOutputTokens: 16384,
  });
  if (!raw) return null;
  const c = normalizarCorreccion(parseGeminiJson<unknown>(raw), p.total > 0 ? p.total : 10);
  if (!c) { callbacks.onError?.('La IA no pudo corregirlo con esas fotos. Prueba con fotos más nítidas y de cerca.'); return null; }
  return c;
}
