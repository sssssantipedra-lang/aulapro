/**
 * Las competencias que trabaja una rúbrica o una diana, arriba en el editor:
 * las clave (CCL, STEM…) que llevan sus criterios o ítems y las específicas de
 * los criterios oficiales que marcan. Cambian al cambiar los criterios. Las
 * específicas solo salen si la clase tiene currículo oficial; las clave,
 * siempre. Lleva el botón para que la IA marque lo que falte.
 */
import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { useMateriasOficiales } from '../../hooks/useNotasPorCompetencias';
import { competenciasDelInstrumento } from '../../lib/curriculum/criteriosParaIA';
import { competenciasClaveValidas, LOMLOE_COMPETENCES } from '../../lib/utils';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { Class, OfficialCriterionRef } from '../../types';

export function CompetenciasDelInstrumento({ cls, comunidad, clave, refs, children }: {
  cls: Class | null;
  comunidad: ComunidadId | undefined;
  /** Las competencias clave de todos sus criterios o ítems. */
  clave: string[];
  /** Todos los criterios oficiales del instrumento, de todos sus criterios o ítems. */
  refs: OfficialCriterionRef[];
  /** Acciones, como «Marcar con IA». */
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const { estado, materias } = useMateriasOficiales(cls, comunidad);
  const codigos = competenciasClaveValidas(clave);
  const conCurriculo = estado === 'listo' && materias.length > 0;
  const especificas = conCurriculo ? competenciasDelInstrumento(materias, refs) : [];
  return (
    <div className="co-resumen">
      <div className="co-resumen-hd">
        <span className="co-ttl">{t('Competencias clave que trabaja')}</span>
        {children}
      </div>
      {codigos.length === 0 ? (
        <p className="co-vacio">{t('Saldrán aquí al marcar las competencias clave de cada criterio.')}</p>
      ) : (
        <ul className="cc-resumen">
          {LOMLOE_COMPETENCES.filter(c => codigos.includes(c.key)).map(c => (
            <li key={c.key}><span className="cc-chip on">{c.key}</span> {t(c.label)}</li>
          ))}
        </ul>
      )}
      {conCurriculo && (
        <>
          <div className="co-resumen-hd co-resumen-sub">
            <span className="co-ttl">{t('Competencias específicas que trabaja')}</span>
          </div>
          {especificas.length === 0 ? (
            <p className="co-vacio">{t('Saldrán aquí al marcar los criterios oficiales de cada criterio.')}</p>
          ) : (
            <ul>
              {especificas.map(c => (
                <li key={`${c.materia}-${c.n}`} className="co-fila">
                  <span className="sda-chip">{c.materia} · {t('CE{n}', { n: c.n })}</span>
                  <span className="co-txt" title={c.texto}>{c.texto}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
