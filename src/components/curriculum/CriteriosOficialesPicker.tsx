/**
 * Qué criterios de evaluación oficiales evalúa un criterio de rúbrica o un
 * ítem de diana. Salen del currículo de la clase del instrumento: sus
 * asignaturas con materia oficial, con sus competencias específicas y sus
 * criterios del curso de la clase. Se pueden marcar de varias materias a la
 * vez (decisión del dueño, 3-10-2026; ver `lib/curriculum/evaluacionPorCriterios.ts`).
 */
import { X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useMateriasOficiales } from '../../hooks/useNotasPorCompetencias';
import { claveCriterioOficial } from '../../lib/curriculum/evaluacionPorCriterios';
import { competenciasDe } from '../../lib/curriculum';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { Class, OfficialCriterionRef } from '../../types';

export function CriteriosOficialesPicker({ idPrefix, cls, comunidad, value, onChange }: {
  idPrefix: string;
  /** La clase del instrumento; sin ella no hay currículo del que elegir. */
  cls: Class | null;
  comunidad: ComunidadId | undefined;
  value: OfficialCriterionRef[];
  onChange: (v: OfficialCriterionRef[]) => void;
}) {
  const { t } = useI18n();
  const { estado, materias } = useMateriasOficiales(cls, comunidad);
  const marcados = new Set(value.map(claveCriterioOficial));
  const nombreDe = (id: string) => materias.find(m => m.entry.id === id)?.entry.nombre ?? id;

  const alternar = (ref: OfficialCriterionRef) => {
    const clave = claveCriterioOficial(ref);
    onChange(marcados.has(clave) ? value.filter(r => claveCriterioOficial(r) !== clave) : [...value, ref]);
  };

  return (
    <details className="co-picker">
      <summary>
        {t('Criterios oficiales que evalúa')}
        {value.length > 0 && <span className="sda-chip accent">{value.length}</span>}
      </summary>
      {value.length > 0 && (
        <div className="co-marcados">
          {value.map(r => (
            <span key={claveCriterioOficial(r)} className="sda-chip">
              {nombreDe(r.materia)} {r.codigo}
              <button
                type="button" className="co-quitar" onClick={() => alternar(r)}
                aria-label={t('Quitar {criterio}', { criterio: `${nombreDe(r.materia)} ${r.codigo}` })}
              >
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      {estado === 'sin-clase' && <p className="ce-aviso">{t('Elige arriba la clase para marcar sus criterios oficiales.')}</p>}
      {estado === 'sin-nivel' && (
        <p className="ce-aviso">{t('Indica la etapa y el curso de la clase en Mis Clases para marcar sus criterios oficiales.')}</p>
      )}
      {estado === 'cargando' && <p className="ce-aviso">{t('Cargando…')}</p>}
      {estado === 'listo' && materias.length === 0 && (
        <p className="ce-aviso">{t('Ninguna asignatura de esta clase tiene materia oficial.')}</p>
      )}
      {materias.map(({ asignatura, entry, grupo }) => (
        <fieldset key={asignatura} className="co-materia">
          <legend>{entry.nombre}</legend>
          {competenciasDe(entry, grupo).map(c => {
            const criterios = (entry.criterios[grupo] ?? []).filter(cr => cr.competencia === c.n);
            if (criterios.length === 0) return null;
            return (
              <div key={c.n} className="co-competencia">
                <div className="co-ce" title={c.texto}>{c.n}. {c.texto}</div>
                {criterios.map(cr => {
                  const ref = { materia: entry.id, codigo: cr.codigo };
                  const id = `${idPrefix}-${entry.id}-${cr.codigo}`;
                  return (
                    <label key={cr.codigo} htmlFor={id} className="co-criterio">
                      <input id={id} type="checkbox" checked={marcados.has(claveCriterioOficial(ref))} onChange={() => alternar(ref)} />
                      <span><strong>{cr.codigo}</strong> {cr.texto}</span>
                    </label>
                  );
                })}
              </div>
            );
          })}
        </fieldset>
      ))}
    </details>
  );
}
