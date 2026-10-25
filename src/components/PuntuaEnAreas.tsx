import { Check, Equal, ListChecks } from 'lucide-react';
import type { AreaTarget, Class, GradeCategory, GradeTarget } from '../types';
import { useI18n } from '../i18n';

/** Un área de la situación de aprendizaje, con la materia oficial de la que salen sus criterios. */
export interface AreaSda { area: string; materia?: string }
export type ModoAreas = 'misma' | 'criterio';

const mismo = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const asignaturasDe = (c?: Class | null): string[] => (c?.subjects?.length ? c.subjects : c ? [c.subject] : []).filter(Boolean);

/** La asignatura de la clase que corresponde a un área de la SdA, si la hay. */
export const asignaturaDeArea = (clase: Class | null | undefined, area: string): string | undefined =>
  asignaturasDe(clase).find(s => mismo(s, area));

/** La categoría del cuaderno con ese nombre en esa asignatura de esa clase. */
export function categoriaDe(gradeCategories: GradeCategory[], clase: Class, asignatura: string, nombre: string): GradeCategory | undefined {
  const subs = asignaturasDe(clase);
  return gradeCategories.find(c => c.class_id === clase.id && (c.subject ?? subs[0] ?? '') === asignatura && mismo(c.name, nombre));
}

/**
 * Lo que se guarda en la rúbrica o la diana según las áreas elegidas: una sola
 * área funciona como siempre; con varias, `areas` y la forma de repartir la nota.
 */
export function destinoDeAreas(
  clase: Class, areas: AreaSda[], elegidas: string[], modo: ModoAreas, nombreCategoria: string, gradeCategories: GradeCategory[],
): Pick<GradeTarget, 'subject' | 'category_id' | 'areas' | 'modo_areas'> {
  const lista: AreaTarget[] = areas
    .filter(a => elegidas.some(e => mismo(e, a.area)))
    .flatMap(a => {
      const subject = asignaturaDeArea(clase, a.area);
      if (!subject) return [];
      return [{ subject, materia: a.materia, category_id: nombreCategoria ? categoriaDe(gradeCategories, clase, subject, nombreCategoria)?.id : undefined }];
    });
  if (lista.length === 0) return {};
  const [primera] = lista;
  return lista.length < 2
    ? { subject: primera.subject, category_id: primera.category_id }
    : { subject: primera.subject, category_id: primera.category_id, areas: lista, modo_areas: modo };
}

interface Props {
  areas: AreaSda[];
  clase: Class;
  gradeCategories: GradeCategory[];
  elegidas: string[];
  onElegidas: (v: string[]) => void;
  modo: ModoAreas;
  onModo: (m: ModoAreas) => void;
  categoria: string;
  onCategoria: (nombre: string) => void;
}

/**
 * Para una situación interdisciplinar: en qué áreas puntúa (una o varias,
 * marcadas como fichas) y, si son varias, cómo se refleja en el cuaderno: la
 * misma nota en cada área o la de los criterios de cada una.
 */
export function PuntuaEnAreas({ areas, clase, gradeCategories, elegidas, onElegidas, modo, onModo, categoria, onCategoria }: Props) {
  const { t } = useI18n();
  const disponibles = areas.filter(a => asignaturaDeArea(clase, a.area));
  const marcadas = disponibles.filter(a => elegidas.some(e => mismo(e, a.area)));
  const subs = marcadas.map(a => asignaturaDeArea(clase, a.area)!);
  const nombres = Array.from(new Map(
    subs.flatMap(s => gradeCategories.filter(c => c.class_id === clase.id && (c.subject ?? asignaturasDe(clase)[0] ?? '') === s))
      .map(c => [c.name.trim().toLowerCase(), c.name])).values());
  const sinCategoria = categoria ? marcadas.filter(a => !categoriaDe(gradeCategories, clase, asignaturaDeArea(clase, a.area)!, categoria)).map(a => a.area) : [];

  const alternar = (area: string) => onElegidas(
    elegidas.some(e => mismo(e, area)) ? elegidas.filter(e => !mismo(e, area)) : [...elegidas, area]);

  return (
    <div className="puntua-areas">
      <div className="fgroup">
        <span className="flabel">{t('¿En qué áreas puntúa?')}</span>
        <div className="chip-row" role="group" aria-label={t('¿En qué áreas puntúa?')}>
          {areas.map(a => {
            const ok = !!asignaturaDeArea(clase, a.area);
            const on = ok && elegidas.some(e => mismo(e, a.area));
            return (
              <button key={a.area} type="button" className={`chip accent${on ? ' on' : ''}`} aria-pressed={on} disabled={!ok}
                title={ok ? undefined : t('No es una asignatura de esta clase')} onClick={() => alternar(a.area)}>
                {on && <Check size={13} />}{a.area}
              </button>
            );
          })}
        </div>
      </div>

      {marcadas.length > 1 && (
        <div className="fgroup">
          <span className="flabel">{t('¿Cómo se refleja en el cuaderno?')}</span>
          <div className="area-opts" role="radiogroup" aria-label={t('¿Cómo se refleja en el cuaderno?')}>
            <button type="button" role="radio" aria-checked={modo === 'misma'} className={`area-opt${modo === 'misma' ? ' sel' : ''}`} onClick={() => onModo('misma')}>
              <span className="area-opt-ico"><Equal size={20} /></span>
              <strong>{t('Misma nota en cada área')}</strong>
              <span>{t('Una columna por área, todas con la nota final de la evaluación.')}</span>
            </button>
            <button type="button" role="radio" aria-checked={modo === 'criterio'} className={`area-opt${modo === 'criterio' ? ' sel' : ''}`} onClick={() => onModo('criterio')}>
              <span className="area-opt-ico"><ListChecks size={20} /></span>
              <strong>{t('Nota por criterios')}</strong>
              <span>{t('Cada área recibe la nota de los criterios que le corresponden.')}</span>
            </button>
          </div>
        </div>
      )}

      {marcadas.length > 0 && (
        <div className="fgroup">
          <label className="flabel" htmlFor="puntua-cat">{t('Categoría del cuaderno')}</label>
          <select id="puntua-cat" className="finput" value={categoria} onChange={e => onCategoria(e.target.value)}>
            <option value="">{t('Solo el historial, no el cuaderno')}</option>
            {nombres.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {sinCategoria.length > 0 && (
            <p className="sda-note" role="alert">{t('En estas áreas no hay una categoría con ese nombre y solo irá al historial:')} {sinCategoria.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}
