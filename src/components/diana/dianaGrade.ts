import type { DianaItem, AchievementLevel } from '../../types';
import { levelsOf, gradeFromLevels } from '../../types';

/**
 * Nota sobre 10 a partir de los niveles de logro, ponderada por el peso
 * de cada ítem. Solo cuentan los ítems ya evaluados.
 */
export function dianaGrade(
  items: DianaItem[],
  scores: Record<string, number>,
  levels?: AchievementLevel[],
): number | null {
  const weights: Record<string, number> = {};
  items.forEach(i => { weights[i.id] = i.weight > 0 ? i.weight : 1; });
  return gradeFromLevels(scores, items.map(i => i.id), levelsOf({ levels }), weights);
}
