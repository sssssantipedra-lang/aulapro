import type { Class, ScheduleBlock } from '../types';

/**
 * La clase que toca pasar lista (11-10-2026): la que está en marcha según el
 * horario o, si no, la siguiente de hoy. Sin horario, la primera.
 */
export function claseQueToca(classes: Class[], blocks: ScheduleBlock[], now = new Date()): string {
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const hoy = blocks
    .filter(b => b.day === day && classes.some(c => c.id === b.class_id))
    .sort((a, b) => a.time_start.localeCompare(b.time_start));
  const toca = hoy.find(b => b.time_start <= hm && hm < b.time_end) ?? hoy.find(b => b.time_start > hm);
  return toca?.class_id ?? classes[0]?.id ?? '';
}
