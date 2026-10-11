import type { Class } from '../types';

/** Los grupos de clases, en el orden en que se muestran. */
const ETAPAS: { id: 'primaria' | 'eso' | 'otras'; label: string }[] = [
  { id: 'primaria', label: 'Primaria' },
  { id: 'eso', label: 'ESO' },
  { id: 'otras', label: 'Otras clases' },
];

/**
 * Las clases agrupadas por etapa (Primaria, ESO y las demás) y, dentro de
 * cada una, por curso. Lo usan el selector de clase (ClassChips) y la portada
 * de Mis clases.
 */
export function agruparPorEtapa<C extends Pick<Class, 'name' | 'etapa' | 'curso'>>(classes: C[]) {
  return ETAPAS
    .map(e => ({
      ...e,
      clases: classes
        .filter(c => (c.etapa ?? 'otras') === e.id)
        .sort((a, b) => (a.curso ?? 0) - (b.curso ?? 0) || a.name.localeCompare(b.name)),
    }))
    .filter(g => g.clases.length > 0);
}
