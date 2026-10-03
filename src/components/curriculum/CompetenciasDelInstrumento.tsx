/**
 * Las competencias específicas que trabaja una rúbrica o una diana: las de los
 * criterios oficiales que marcan sus criterios o ítems. Se ven arriba, en el
 * editor; cambian al cambiar esos criterios. Lleva el botón para que la IA
 * marque los criterios que falten.
 */
import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { useMateriasOficiales } from '../../hooks/useNotasPorCompetencias';
import { competenciasDelInstrumento } from '../../lib/curriculum/criteriosParaIA';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { Class, OfficialCriterionRef } from '../../types';

export function CompetenciasDelInstrumento({ cls, comunidad, refs, children }: {
  cls: Class | null;
  comunidad: ComunidadId | undefined;
  /** Todos los criterios oficiales del instrumento, de todos sus criterios o ítems. */
  refs: OfficialCriterionRef[];
  /** Acciones, como «Marcar con IA». */
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const { estado, materias } = useMateriasOficiales(cls, comunidad);
  if (estado !== 'listo' || materias.length === 0) return null;
  const competencias = competenciasDelInstrumento(materias, refs);
  return (
    <div className="co-resumen">
      <div className="co-resumen-hd">
        <span className="co-ttl">{t('Competencias específicas que trabaja')}</span>
        {children}
      </div>
      {competencias.length === 0 ? (
        <p className="co-vacio">{t('Saldrán aquí al marcar los criterios oficiales de cada criterio.')}</p>
      ) : (
        <ul>
          {competencias.map(c => (
            <li key={`${c.materia}-${c.n}`} className="co-fila">
              <span className="sda-chip">{c.materia} · {t('CE{n}', { n: c.n })}</span>
              <span className="co-txt" title={c.texto}>{c.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
