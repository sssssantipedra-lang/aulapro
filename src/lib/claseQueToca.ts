import type { Class, ScheduleBlock } from '../types';

/** «8:30», «08:30» o «8.30» en minutos desde las 0:00; `null` si no es una hora. */
export function aMinutos(hm: string | undefined): number | null {
  const m = /^\s*(\d{1,2})\s*[:.h]\s*(\d{2})\s*$/.exec(hm ?? '');
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/**
 * El bloque del horario que está en marcha o, si no, el siguiente de hoy.
 * `undefined` si hoy ya no queda ninguno de estas clases, o si `lectivo` es
 * `false` (festivo o vacaciones según el calendario escolar: el horario no
 * manda ese día). Las horas se comparan como horas, no como texto: «9:00»
 * escrito sin cero no puede ir detrás de «10:00».
 */
export function bloqueQueToca(
  classes: Class[], blocks: ScheduleBlock[], now = new Date(), lectivo = true,
): ScheduleBlock | undefined {
  if (!lectivo) return undefined;
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const ahora = now.getHours() * 60 + now.getMinutes();
  const hoy = blocks
    .filter(b => Number(b.day) === day && classes.some(c => c.id === b.class_id))
    .map(b => ({ b, ini: aMinutos(b.time_start), fin: aMinutos(b.time_end) }))
    .filter((x): x is { b: ScheduleBlock; ini: number; fin: number } => x.ini !== null && x.fin !== null && x.fin > x.ini)
    .sort((x, y) => x.ini - y.ini);
  return (hoy.find(x => x.ini <= ahora && ahora < x.fin) ?? hoy.find(x => x.ini > ahora))?.b;
}

/** Si ese bloque está en marcha a esa hora (y no es solo el siguiente). */
export function enMarcha(b: ScheduleBlock, now = new Date()): boolean {
  const ini = aMinutos(b.time_start), fin = aMinutos(b.time_end);
  const ahora = now.getHours() * 60 + now.getMinutes();
  return ini !== null && fin !== null && ini <= ahora && ahora < fin;
}

/**
 * La clase que toca pasar lista (11-10-2026): la que está en marcha según el
 * horario o, si no, la siguiente de hoy. Sin horario, la primera.
 */
export function claseQueToca(classes: Class[], blocks: ScheduleBlock[], now = new Date(), lectivo = true): string {
  return bloqueQueToca(classes, blocks, now, lectivo)?.class_id ?? classes[0]?.id ?? '';
}
