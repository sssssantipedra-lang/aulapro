/**
 * Actas de reunión y memorias de formación redactadas por la IA.
 *
 * El docente escribe durante la reunión lo que puede —frases sueltas,
 * abreviaturas, «Ana: revisar rúbrica antes del 12»— y aquí eso se convierte
 * en un documento presentable. Mismo camino que las situaciones de
 * aprendizaje: `responseSchema` para que el JSON venga con la forma exacta, y
 * un prompt que insiste en NO añadir nada que no esté en las anotaciones,
 * porque un acta inventada es peor que no tener acta.
 *
 * Los dos tipos comparten esquema. Cambia el papel de cada apartado:
 * `aplicacionAula` solo tiene sentido en una formación, y en una reunión se
 * deja vacío.
 */

import { callGemini, parseGeminiJson } from './gemini';
import type { WorkSession, WorkSessionDoc, WorkSessionKind } from '../types';
import type { Lang } from '../i18n';

const idioma = (lang: Lang) => (lang === 'en' ? 'INGLÉS' : 'ESPAÑOL');

const S = (d: string) => ({ type: 'STRING', description: d });

const APARTADO_SCHEMA = {
  type: 'OBJECT',
  properties: {
    titulo: S('Título del punto tratado, breve'),
    contenido: S('Qué se dijo o se trabajó en ese punto, redactado en prosa'),
  },
  required: ['titulo', 'contenido'],
  propertyOrdering: ['titulo', 'contenido'],
} as const;

const TAREA_SCHEMA = {
  type: 'OBJECT',
  properties: {
    tarea: S('Qué hay que hacer'),
    responsable: S('Quién se encarga; cadena vacía si en las anotaciones no se dice'),
    plazo: S('Para cuándo; cadena vacía si no se dice'),
  },
  required: ['tarea', 'responsable', 'plazo'],
  propertyOrdering: ['tarea', 'responsable', 'plazo'],
} as const;

const FIELDS = ['titulo', 'resumen', 'apartados', 'acuerdos', 'tareas', 'aplicacionAula', 'cierre'] as const;

const DOC_SCHEMA = {
  type: 'OBJECT',
  properties: {
    titulo: S('Título del documento'),
    resumen: S('Dos o tres frases con lo esencial de la sesión'),
    apartados: { type: 'ARRAY', items: APARTADO_SCHEMA },
    acuerdos: { type: 'ARRAY', items: S('Un acuerdo o idea clave, en una frase') },
    tareas: { type: 'ARRAY', items: TAREA_SCHEMA },
    aplicacionAula: { type: 'ARRAY', items: S('Una manera concreta de llevarlo al aula') },
    cierre: S('Cierre del documento: próxima convocatoria o valoración final'),
  },
  required: FIELDS,
  propertyOrdering: FIELDS,
} as const;

/** Cabecera con los datos de la sesión, para el prompt. */
function datosDe(s: WorkSession): string {
  const horas = [s.timeStart, s.timeEnd].filter(Boolean).join(' a ');
  const campos: [string, string | undefined][] = [
    ['Título', s.title],
    ['Fecha', s.date],
    ['Horario', horas || undefined],
    [s.kind === 'meeting' ? 'Convoca / órgano' : 'Entidad y ponente', s.organizer],
    ['Lugar', s.place],
    ['Asistentes', s.attendees],
    ['Horas certificadas', s.hours ? String(s.hours) : undefined],
  ];
  return campos
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

function systemPromptFor(kind: WorkSessionKind, lang: Lang): string {
  const comun =
    `REGLA PRINCIPAL, POR ENCIMA DE TODO: trabajas ÚNICAMENTE con lo que hay en las anotaciones. ` +
    `No añadas puntos, acuerdos, nombres, fechas ni conclusiones que no aparezcan. Si algo se ` +
    `menciona a medias, recógelo tal como está; si un apartado no tiene contenido en las ` +
    `anotaciones, déjalo como array vacío o cadena vacía. Un documento inventado no sirve para nada.\n` +
    `TU TRABAJO es ordenar, agrupar por temas y redactar en prosa clara y formal lo que el docente ` +
    `anotó de forma telegráfica: completar frases, quitar abreviaturas y dar estructura, sin ` +
    `añadir información nueva.\n` +
    `TAREAS: extrae solo compromisos reales que aparezcan en las anotaciones. Si no se dice quién ` +
    `o para cuándo, deja esos campos como cadena vacía en vez de suponerlo.\n` +
    `FORMATO: frases completas, tono profesional de documento de centro, sin florituras.\n` +
    `El idioma de salida DEBE SER ${idioma(lang)}.`;

  if (kind === 'meeting') {
    return `Eres el secretario de actas de un centro educativo español. Tu tarea exclusiva es ` +
      `redactar el ACTA de una reunión a partir de las anotaciones que tomó un docente durante ella.\n` +
      `ESTRUCTURA: "apartados" son los puntos del orden del día tratados; "acuerdos" son las ` +
      `decisiones adoptadas; "cierre" recoge la próxima convocatoria o cómo terminó la reunión.\n` +
      `NO uses "aplicacionAula": déjalo como array vacío, no procede en un acta.\n` + comun;
  }

  return `Eres un asesor de formación del profesorado. Tu tarea exclusiva es redactar la MEMORIA de ` +
    `una actividad formativa a partir de las anotaciones que tomó el docente asistente.\n` +
    `ESTRUCTURA: "apartados" son los bloques de contenido trabajados; "acuerdos" son las ideas ` +
    `clave que el docente se lleva; "aplicacionAula" recoge maneras concretas de aplicar lo ` +
    `aprendido con su alumnado —solo las que se deduzcan de las anotaciones—; "cierre" es la ` +
    `valoración final de la formación.\n` + comun;
}

export async function generateWorkSessionDoc(
  session: WorkSession,
  lang: Lang,
  callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<WorkSessionDoc | null> {
  const userPrompt =
    `DATOS DE LA SESIÓN:\n${datosDe(session)}\n\n` +
    `ANOTACIONES EN BRUTO DEL DOCENTE (única fuente de información):\n"""\n${session.notes.trim()}\n"""\n\n` +
    `Redacta el documento rellenando todos los campos del JSON de salida.`;

  const raw = await callGemini(systemPromptFor(session.kind, lang), userPrompt, [], callbacks, {
    maxOutputTokens: 8192,
    responseSchema: DOC_SCHEMA,
  });
  if (!raw) return null;

  const parsed = parseGeminiJson<WorkSessionDoc>(raw);
  if (!parsed) return null;

  // Un modelo de reserva puede devolver un array ausente en vez de vacío.
  return {
    ...parsed,
    at: new Date().toISOString(),
    titulo: parsed.titulo || session.title,
    apartados: parsed.apartados ?? [],
    acuerdos: parsed.acuerdos ?? [],
    tareas: parsed.tareas ?? [],
    aplicacionAula: session.kind === 'training' ? (parsed.aplicacionAula ?? []) : [],
    cierre: parsed.cierre ?? '',
  };
}
