/**
 * Cómo se ordena la biblioteca de Situaciones de aprendizaje.
 *
 * Por defecto va por clase, que es como piensa un docente («¿qué tengo para
 * 3º A?»). Las áreas sirven de filtro; si se agrupa por área, una SdA de
 * varias áreas sale en cada una, marcada como compartida.
 */
import type { Class, LearningSituation } from '../types';

export type SdaGroupBy = 'class' | 'area' | 'none';

export interface SdaGroup {
  key: string;
  /** Nombre del bloque; vacío en «sin agrupar». */
  label: string;
  color?: string;
  items: { sda: LearningSituation; sharedWith: string[] }[];
}

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Número de la SdA para ordenar («SdA 2» antes que «SdA 10»); las que no tienen, al final. */
function num(s: LearningSituation): number {
  const n = parseInt(s.request.numero, 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}
const byNumber = (a: LearningSituation, b: LearningSituation) =>
  num(a) - num(b) || a.title.localeCompare(b.title, 'es');

/** Todas las áreas que aparecen en la biblioteca, para el filtro. */
export function sdaAreas(list: readonly LearningSituation[]): string[] {
  return [...new Set(list.flatMap(s => s.request.areas))].sort((a, b) => a.localeCompare(b, 'es'));
}

export function filterSituations(
  list: readonly LearningSituation[], area: string, query: string,
): LearningSituation[] {
  const q = plain(query.trim());
  return list.filter(s =>
    (!area || s.request.areas.includes(area)) &&
    (!q || plain(`${s.title} ${s.request.idea} ${s.class_name ?? ''}`).includes(q)));
}

export function groupSituations(
  list: readonly LearningSituation[], classes: readonly Class[], by: SdaGroupBy,
  labels: { noClass: string; noArea: string },
): SdaGroup[] {
  if (by === 'none') {
    return [{
      key: 'all', label: '',
      items: [...list].sort((a, b) => b.at.localeCompare(a.at)).map(sda => ({ sda, sharedWith: [] })),
    }];
  }

  if (by === 'class') {
    const groups = new Map<string, SdaGroup>();
    for (const sda of list) {
      const cls = classes.find(c => c.id === sda.class_id);
      // La clase puede haberse borrado: entonces se agrupa por el nombre que guardó la SdA
      const key = cls?.id ?? (sda.class_name ? `name:${sda.class_name}` : '');
      if (!groups.has(key)) {
        groups.set(key, { key: key || 'none', label: cls?.name ?? sda.class_name ?? labels.noClass, color: cls?.color, items: [] });
      }
      groups.get(key)!.items.push({ sda, sharedWith: [] });
    }
    const order = (g: SdaGroup) => {
      if (g.key === 'none') return Number.MAX_SAFE_INTEGER;
      const i = classes.findIndex(c => c.id === g.key);
      return i >= 0 ? i : classes.length;
    };
    return [...groups.values()]
      .sort((a, b) => order(a) - order(b) || a.label.localeCompare(b.label, 'es'))
      .map(g => ({ ...g, items: g.items.sort((a, b) => byNumber(a.sda, b.sda)) }));
  }

  // Por área: cada SdA en todas las suyas
  const groups = new Map<string, SdaGroup>();
  for (const sda of list) {
    const areas = sda.request.areas.length ? sda.request.areas : [''];
    for (const a of areas) {
      if (!groups.has(a)) groups.set(a, { key: a || 'none', label: a || labels.noArea, items: [] });
      groups.get(a)!.items.push({ sda, sharedWith: areas.filter(x => x && x !== a) });
    }
  }
  return [...groups.values()]
    .sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.label.localeCompare(b.label, 'es')))
    .map(g => ({ ...g, items: g.items.sort((a, b) => byNumber(a.sda, b.sda)) }));
}
