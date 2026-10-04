/**
 * Los criterios de evaluación oficiales de un criterio de rúbrica o de un ítem
 * de diana. Normalmente los pone la IA; aquí se ven, se quitan y, si hace
 * falta, se añade otro buscándolo: la lista entera es demasiado larga para
 * mostrarla (decisión del dueño, 3-10-2026). Salen del currículo de la clase
 * del instrumento: sus asignaturas con materia oficial, del curso de la clase.
 */
import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useMateriasOficiales } from '../../hooks/useNotasPorCompetencias';
import { claveCriterioOficial } from '../../lib/curriculum/evaluacionPorCriterios';
import { buscarCriterios, describirCriterio } from '../../lib/curriculum/criteriosParaIA';
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
  const [buscando, setBuscando] = useState(false);
  const [consulta, setConsulta] = useState('');
  const resultados = useMemo(() => {
    const ya = new Set(value.map(claveCriterioOficial));
    return buscarCriterios(materias, consulta, 12).filter(r => !ya.has(claveCriterioOficial(r.ref))).slice(0, 8);
  }, [materias, consulta, value]);
  const hayCurriculo = estado === 'listo' && materias.length > 0;

  return (
    <div className="co-picker">
      <div className="co-ttl">{t('Criterios oficiales')}</div>
      {estado === 'sin-clase' && <p className="co-vacio">{t('Elige arriba la clase para ver sus criterios oficiales.')}</p>}
      {estado === 'sin-nivel' && (
        <p className="co-vacio">{t('Indica la etapa y el curso de la clase en Mis Clases para ver sus criterios oficiales.')}</p>
      )}
      {estado === 'listo' && materias.length === 0 && (
        <p className="co-vacio">{t('Ninguna asignatura de esta clase tiene materia oficial.')}</p>
      )}
      {hayCurriculo && value.length === 0 && <p className="co-vacio">{t('Ninguno todavía.')}</p>}
      {value.length > 0 && (
        <ul className="co-marcados">
          {value.map(r => {
            const d = describirCriterio(materias, r);
            return (
              <li key={claveCriterioOficial(r)}>
                <span className="sda-chip">{d ? `${d.materia} · ${t('CE{n}', { n: d.competencia.n })}` : r.materia}</span>
                <span className="co-txt" title={d?.texto}><strong>{r.codigo}</strong> {d?.texto}</span>
                <button
                  type="button" className="co-quitar" onClick={() => onChange(value.filter(v => claveCriterioOficial(v) !== claveCriterioOficial(r)))}
                  aria-label={t('Quitar {criterio}', { criterio: `${d?.materia ?? r.materia} ${r.codigo}` })}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {hayCurriculo && (buscando ? (
        <div className="co-buscar">
          <input
            id={`${idPrefix}-buscar`} type="search" className="finput" autoFocus
            aria-label={t('Buscar un criterio oficial')}
            placeholder={t('Busca por código o palabra: «2.1», «problemas»…')}
            value={consulta} onChange={e => setConsulta(e.target.value)}
          />
          {resultados.length > 0 && (
            <ul className="co-resultados">
              {resultados.map(r => (
                <li key={claveCriterioOficial(r.ref)}>
                  <button type="button" onClick={() => { onChange([...value, r.ref]); setConsulta(''); setBuscando(false); }}>
                    <span className="sda-chip">{r.materia} · {t('CE{n}', { n: r.competencia.n })}</span>
                    <span className="co-txt"><strong>{r.ref.codigo}</strong> {r.texto}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {consulta.trim().length >= 2 && resultados.length === 0 && <p className="co-vacio">{t('Ningún criterio coincide.')}</p>}
        </div>
      ) : (
        <button type="button" className="co-anadir" onClick={() => setBuscando(true)}>
          <Plus size={12} aria-hidden="true" />{t('Añadir otro criterio')}
        </button>
      ))}
    </div>
  );
}
