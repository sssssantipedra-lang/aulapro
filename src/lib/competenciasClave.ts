import type { Evaluation } from '../types';

/**
 * La nota de cada competencia clave LOMLOE con unas evaluaciones: la media de lo que cada rúbrica o diana
 * apuntó en ella, pasada a la escala que se pida (`sobre`: 4 para los niveles de logro, 10 para la nota)
 * con el nivel más alto de cada evaluación (`max_level`): el nivel 3 de una rúbrica de tres niveles es el
 * máximo, igual que el 4 de una de cuatro. A un decimal.
 *
 * Es la cuenta de la segunda página del acta, y la Diana competencial y el informe de seguimiento tienen
 * que decir lo mismo: si cambia aquí, cambia para todos (`evidenciasPorSector` en `lib/dianaSectores.ts`
 * pasa cada evidencia a 1-4 de la misma manera).
 */
export function notasDeClaves(evaluaciones: readonly Evaluation[], sobre: number): Record<string, number> {
  const sumas: Record<string, number> = {};
  const veces: Record<string, number> = {};
  for (const ev of evaluaciones) {
    const max = ev.max_level && ev.max_level > 0 ? ev.max_level : 4;
    for (const [codigo, v] of Object.entries(ev.competencyScores ?? {})) {
      sumas[codigo] = (sumas[codigo] ?? 0) + (v / max) * sobre;
      veces[codigo] = (veces[codigo] ?? 0) + 1;
    }
  }
  const out: Record<string, number> = {};
  for (const codigo of Object.keys(veces)) out[codigo] = Math.round((sumas[codigo] / veces[codigo]) * 10) / 10;
  return out;
}
