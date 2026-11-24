/**
 * De dónde salen los valores de los seis sectores de la Diana competencial
 * (decisión del dueño, 11-10-2026: unir las competencias específicas con la
 * Diana por sus descriptores del perfil de salida; ver docs/COMUNIDADES.md).
 *
 * Dos fuentes, cada una con su escala, llevadas al 1-4 de la Diana:
 *
 * - Las competencias clave que lleva cada criterio de rúbrica o ítem de diana
 *   (`Evaluation.competencyScores`, en los niveles de su instrumento). Se pasan
 *   a 1-4 con el nivel más alto de la evaluación (`max_level`), igual que en la
 *   segunda página del acta: el nivel 3 de una rúbrica de tres niveles es un 4,
 *   no un 3. Con los cuatro niveles de siempre no cambia nada.
 * - Las competencias específicas evaluadas con criterios oficiales, a través
 *   de las competencias clave con las que las conecta el decreto
 *   (`NotaCompetencia.clave`). Su nota sobre 10 pasa a la escala de la Diana
 *   con la cuenta inversa de la que la hizo: un nivel 3 de 4 es un 7,5, y un
 *   7,5 es un 3.
 *
 * Cada competencia específica cuenta una vez por sector, aunque se conecte
 * con dos competencias clave que van al mismo (CCL y CCEC, a Comunicación).
 */
import { LOMLOE_TO_DIANA } from './utils';
import type { NotaMateria } from './curriculum/evaluacionPorCriterios';
import type { Evaluation } from '../types';

export type SectorId = 'ds1' | 'ds2' | 'ds3' | 'ds4' | 'ds5' | 'ds6';

export interface EvidenciaSector {
  /** En la escala de la Diana, de 1 a 4. */
  value: number;
  /** De dónde sale, para el descriptor y para la IA: «CCL 3 («Mercado»)» o «Matemáticas CE2 7,5/10». */
  etiqueta: string;
}

const vacio = (): Record<SectorId, EvidenciaSector[]> => ({ ds1: [], ds2: [], ds3: [], ds4: [], ds5: [], ds6: [] });

export function evidenciasPorSector(
  evaluaciones: Evaluation[],
  materias: { asignatura: string; notas: NotaMateria }[],
  formato: { numero: (n: number) => string; ce: (n: number) => string },
): Record<SectorId, EvidenciaSector[]> {
  const out = vacio();
  for (const ev of evaluaciones) {
    const max = ev.max_level && ev.max_level > 0 ? ev.max_level : 4;
    for (const [code, nivel] of Object.entries(ev.competencyScores ?? {})) {
      // Sin redondear: la media del sector sale de los mismos números que la del acta (el redondeo, al enseñarlo)
      const value = (nivel / max) * 4;
      for (const sid of LOMLOE_TO_DIANA[code] ?? []) {
        out[sid as SectorId].push({ value, etiqueta: `${code} ${formato.numero(Math.round(value * 10) / 10)} («${ev.rubric_name}»)` });
      }
    }
  }
  for (const { asignatura, notas } of materias) {
    for (const c of notas.competencias) {
      if (c.nota === null || c.clave.length === 0) continue;
      const sectores = new Set(c.clave.flatMap(code => LOMLOE_TO_DIANA[code] ?? []));
      const value = Math.round(c.nota * 0.4 * 10) / 10;
      for (const sid of sectores) {
        out[sid as SectorId].push({ value, etiqueta: `${asignatura} ${formato.ce(c.n)} ${formato.numero(c.nota)}/10` });
      }
    }
  }
  return out;
}

/** El valor del sector: la media de sus evidencias, redondeada a un nivel de 1 a 4. */
export function nivelDelSector(evidencias: EvidenciaSector[]): number | null {
  if (evidencias.length === 0) return null;
  const media = evidencias.reduce((a, e) => a + e.value, 0) / evidencias.length;
  return Math.max(1, Math.min(4, Math.round(media)));
}
