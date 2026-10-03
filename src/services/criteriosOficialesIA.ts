/**
 * Que la IA marque los criterios oficiales de una rúbrica o una diana hecha a
 * mano: el docente escribe los criterios y la IA elige, de la lista cerrada de
 * su clase, de 1 a 3 para cada uno (decisión del dueño, 3-10-2026). Lo que no
 * esté en la lista se descarta (`refsDesdeIA`).
 */
import { callGemini, parseGeminiJson } from './gemini';
import { catalogoCriterios, refsDesdeIA, type MateriaDeClase } from '../lib/curriculum/criteriosParaIA';
import type { OfficialCriterionRef } from '../types';

export async function marcarCriteriosConIA(
  instrumento: { nombre: string; contexto?: string; asignaturaDeLaNota?: string },
  elementos: { id: string; nombre: string }[],
  materias: MateriaDeClase[],
  lang: 'es' | 'en' | 'ca',
  callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<Record<string, OfficialCriterionRef[]> | null> {
  const { texto, disponibles } = catalogoCriterios(materias);
  if (disponibles.length === 0 || elementos.length === 0) return {};
  const en = lang === 'en';
  const systemPrompt = en
    ? 'You are an expert in competency-based assessment (LOMLOE, Spain). Reply ONLY with valid JSON.'
    : 'Eres un experto en evaluación competencial (LOMLOE, España). Responde SOLO con JSON válido.';
  const userPrompt = (en
    ? `Instrument: ${instrumento.nombre}\n` +
      (instrumento.contexto ? `Activity: ${instrumento.contexto}\n` : '') +
      (instrumento.asignaturaDeLaNota ? `The grade goes to: ${instrumento.asignaturaDeLaNota}. Prefer its criteria; add other subjects only if the criterion really works on them.\n` : '') +
      `For each criterion below, choose 1 to 3 official assessment criteria from the closed list (at least 1), the ones it truly assesses, written exactly as listed ("Subject|code").\n\n` +
      `Criteria:\n`
    : `Instrumento: ${instrumento.nombre}\n` +
      (instrumento.contexto ? `Actividad: ${instrumento.contexto}\n` : '') +
      (instrumento.asignaturaDeLaNota ? `La nota va a: ${instrumento.asignaturaDeLaNota}. Prioriza sus criterios; añade de otras asignaturas solo si el criterio las trabaja de verdad.\n` : '') +
      `Para cada criterio de abajo, elige de 1 a 3 criterios de evaluación oficiales de la lista cerrada (al menos 1), los que de verdad evalúe, escritos tal cual («Materia|código»).\n\n` +
      `Criterios:\n`) +
    elementos.map(e => `- id ${e.id}: ${e.nombre}`).join('\n') +
    `\n\n${en ? 'Official criteria' : 'Criterios oficiales'}:\n${texto}`;

  const raw = await callGemini(systemPrompt, userPrompt, [], callbacks, {
    responseSchema: {
      type: 'OBJECT',
      properties: {
        criterios: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              id: { type: 'STRING', enum: elementos.map(e => e.id) },
              criteriosOficiales: { type: 'ARRAY', items: { type: 'STRING', enum: disponibles } },
            },
            required: ['id', 'criteriosOficiales'],
          },
        },
      },
      required: ['criterios'],
    },
    thinkingLevel: 'medium',
  });
  if (!raw) return null;
  const parsed = parseGeminiJson<{ criterios: { id: string; criteriosOficiales: string[] }[] }>(raw);
  if (!parsed?.criterios) return null;
  const out: Record<string, OfficialCriterionRef[]> = {};
  for (const c of parsed.criterios) {
    const refs = refsDesdeIA(materias, c.criteriosOficiales);
    if (refs.length && elementos.some(e => e.id === c.id)) out[c.id] = refs;
  }
  return out;
}
