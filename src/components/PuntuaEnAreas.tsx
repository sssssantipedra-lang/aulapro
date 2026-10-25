import { Check, Equal, ListChecks } from 'lucide-react';
import type { Class, GradeCategory } from '../types';
import { useI18n } from '../i18n';
import { asignaturaDeArea, asignaturasDe, categoriaDe, mismo, type AreaSda, type ModoAreas } from '../lib/areasMaterial';

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
