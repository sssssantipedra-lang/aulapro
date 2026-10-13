import type { Class, ScheduleBlock } from '../types';
import { hhmm } from './utils';

/**
 * El bloque del horario que está en marcha o, si no, el siguiente de hoy.
 * `undefined` si hoy ya no queda ninguno de estas clases.
 */
export function bloqueQueToca(classes: Class[], blocks: ScheduleBlock[], now = new Date()): ScheduleBlock | undefined {
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const hm = hhmm(now);
  const hoy = blocks
    .filter(b => b.day === day && classes.some(c => c.id === b.class_id))
    .sort((a, b) => a.time_start.localeCompare(b.time_start));
  return hoy.find(b => b.time_start <= hm && hm < b.time_end) ?? hoy.find(b => b.time_start > hm);
}

/**
 * La clase que toca pasar lista (11-10-2026): la que está en marcha según el
 * horario o, si no, la siguiente de hoy. Sin horario, la primera.
 */
export function claseQueToca(classes: Class[], blocks: ScheduleBlock[], now = new Date()): string {
  return bloqueQueToca(classes, blocks, now)?.class_id ?? classes[0]?.id ?? '';
}
