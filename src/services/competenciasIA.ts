/**
 * Que la IA marque las competencias de una rúbrica o una diana hecha a mano:
 * el docente escribe los criterios y la IA elige para cada uno de 1 a 3
 * competencias clave de la LOMLOE y, si la clase tiene currículo oficial, de 1
 * a 3 criterios de evaluación de la lista cerrada de su clase (decisiones del
 * dueño, 3-10-2026). Lo que no esté en las listas se descarta.
 */
import { callGemini, parseGeminiJson } from './gemini';
import { catalogoCriterios, refsDesdeIA, type MateriaDeClase } from '../lib/curriculum/criteriosParaIA';
import { competenciasClaveValidas, LOMLOE_COMPETENCES } from '../lib/utils';
import type { OfficialCriterionRef } from '../types';

/** Lo que la IA pone a un criterio o ítem. */
export interface MarcadoIA {
  clave: string[];
  oficiales: OfficialCriterionRef[];
}

const CLAVE_EN: Record<string, string> = {
  CCL: 'Linguistic communication', CP: 'Plurilingual', STEM: 'Mathematics, science, technology and engineering',
  CD: 'Digital', CPSAA: 'Personal, social and learning to learn', CC: 'Citizenship', CE: 'Entrepreneurship',
  CCEC: 'Cultural awareness and expression',
};

/** La lista cerrada de competencias clave para el prompt: «CCL (Comunicación lingüística), …». */
export function listaCompetenciasClave(lang: 'es' | 'en' | 'ca'): string {
  return LOMLOE_COMPETENCES.map(c => `${c.key} (${lang === 'en' ? CLAVE_EN[c.key] : c.label})`).join(', ');
}

export async function marcarCompetenciasConIA(
  instrumento: { nombre: string; contexto?: string; asignaturaDeLaNota?: string },
  elementos: { id: string; nombre: string }[],
  materias: MateriaDeClase[],
  lang: 'es' | 'en' | 'ca',
  callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<Record<string, MarcadoIA> | null> {
  if (elementos.length === 0) return {};
  const { texto, disponibles } = catalogoCriterios(materias);
  const conOficiales = disponibles.length > 0;
  const en = lang === 'en';
  const systemPrompt = en
    ? 'You are an expert in competency-based assessment (LOMLOE, Spain). Reply ONLY with valid JSON.'
    : 'Eres un experto en evaluación competencial (LOMLOE, España). Responde SOLO con JSON válido.';
  const userPrompt = (en
    ? `Instrument: ${instrumento.nombre}\n` +
      (instrumento.contexto ? `Activity: ${instrumento.contexto}\n` : '') +
      (instrumento.asignaturaDeLaNota ? `The grade goes to: ${instrumento.asignaturaDeLaNota}.\n` : '') +
      `For each criterion below, in "competenciasClave" choose 1 to 3 key competencies from this closed list, ` +
      `only the ones it truly assesses: ${listaCompetenciasClave(lang)}.` +
      (conOficiales
        ? ` In "criteriosOficiales" choose 1 to 3 official assessment criteria from the closed list below (at least 1), ` +
          `the ones it truly assesses, written exactly as listed ("Subject|code")` +
          (instrumento.asignaturaDeLaNota ? `; prefer those of ${instrumento.asignaturaDeLaNota} and add other subjects only if the criterion really works on them` : '') + '.'
        : '') +
      `\n\nCriteria:\n`
    : `Instrumento: ${instrumento.nombre}\n` +
      (instrumento.contexto ? `Actividad: ${instrumento.contexto}\n` : '') +
      (instrumento.asignaturaDeLaNota ? `La nota va a: ${instrumento.asignaturaDeLaNota}.\n` : '') +
      `Para cada criterio de abajo, en "competenciasClave" elige de 1 a 3 competencias clave de esta lista cerrada, ` +
      `solo las que de verdad evalúe: ${listaCompetenciasClave(lang)}.` +
      (conOficiales
        ? ` En "criteriosOficiales" elige de 1 a 3 criterios de evaluación oficiales de la lista cerrada de abajo (al menos 1), ` +
          `los que de verdad evalúe, escritos tal cual («Materia|código»)` +
          (instrumento.asignaturaDeLaNota ? `; prioriza los de ${instrumento.asignaturaDeLaNota} y añade de otras asignaturas solo si el criterio las trabaja de verdad` : '') + '.'
        : '') +
      `\n\nCriterios:\n`) +
    elementos.map(e => `- id ${e.id}: ${e.nombre}`).join('\n') +
    (conOficiales ? `\n\n${en ? 'Official criteria' : 'Criterios oficiales'}:\n${texto}` : '');

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
              competenciasClave: { type: 'ARRAY', items: { type: 'STRING', enum: LOMLOE_COMPETENCES.map(c => c.key) } },
              ...(conOficiales ? { criteriosOficiales: { type: 'ARRAY', items: { type: 'STRING', enum: disponibles } } } : {}),
            },
            required: ['id', 'competenciasClave', ...(conOficiales ? ['criteriosOficiales'] : [])],
          },
        },
      },
      required: ['criterios'],
    },
    thinkingLevel: 'medium',
  });
  if (!raw) return null;
  const parsed = parseGeminiJson<{ criterios: { id: string; competenciasClave?: unknown; criteriosOficiales?: unknown }[] }>(raw);
  if (!parsed?.criterios) return null;
  const out: Record<string, MarcadoIA> = {};
  for (const c of parsed.criterios) {
    if (!elementos.some(e => e.id === c.id)) continue;
    const marcado = { clave: competenciasClaveValidas(c.competenciasClave), oficiales: refsDesdeIA(materias, c.criteriosOficiales) };
    if (marcado.clave.length || marcado.oficiales.length) out[c.id] = marcado;
  }
  return out;
}
