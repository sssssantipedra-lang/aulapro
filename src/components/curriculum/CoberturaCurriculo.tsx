/**
 * Cobertura del currículo, en la portada de Evaluar (18-11-2026, decisión del
 * dueño): de cada clase y asignatura con materia oficial, cuántos criterios de
 * evaluación llevan nota de alguna rúbrica o diana y cuáles faltan. La cuenta,
 * en `lib/curriculum/cobertura.ts`. Se carga aparte: necesita el currículo.
 */
import { useMemo } from 'react';
import { ListChecks } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useMateriasOficiales } from '../../hooks/useNotasPorCompetencias';
import { coberturaDeMateria, porcentaje } from '../../lib/curriculum/cobertura';
import { agruparPorEtapa } from '../../lib/etapas';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { Class, Evaluation } from '../../types';

function FilasDeClase({ cls, evaluations, comunidad, variasAsignaturas }: {
  cls: Class; evaluations: Evaluation[]; comunidad: ComunidadId | undefined; variasAsignaturas: boolean;
}) {
  const { t } = useI18n();
  const { materias } = useMateriasOficiales(cls, comunidad);
  const deLaClase = useMemo(() => evaluations.filter(e => e.class_id === cls.id), [evaluations, cls.id]);
  return (
    <>
      {materias.map(m => {
        const c = coberturaDeMateria(m.entry, m.grupo, deLaClase);
        if (!c.total) return null;
        const pct = porcentaje(c);
        return (
          <details key={m.asignatura} className="cob-fila" style={{ '--cob-c': cls.color } as React.CSSProperties}>
            <summary>
              <span className="cob-nombre"><b>{cls.name}</b>{(variasAsignaturas || m.asignatura !== cls.name) && <small>{m.asignatura}</small>}</span>
              <span className="cob-barra" role="img" aria-label={t('{n} de {total} criterios evaluados', { n: c.evaluados, total: c.total })}>
                <i style={{ width: `${pct}%` }} />
              </span>
              <span className="cob-cuenta">{t('{n} de {total}', { n: c.evaluados, total: c.total })}</span>
            </summary>
            {c.pendientes.length === 0 ? (
              <p className="cob-ok">{t('Todos los criterios de esta materia tienen ya alguna evaluación.')}</p>
            ) : (
              <>
                <p className="cob-faltan">{t(c.pendientes.length === 1 ? 'Falta 1 criterio por evaluar:' : 'Faltan {n} criterios por evaluar:', { n: c.pendientes.length })}</p>
                <ul>
                  {c.pendientes.map(p => <li key={p.codigo}><b>{p.codigo}</b> {p.texto}</li>)}
                </ul>
              </>
            )}
          </details>
        );
      })}
    </>
  );
}

export function CoberturaCurriculo({ classes, evaluations, comunidad }: { classes: Class[]; evaluations: Evaluation[]; comunidad: ComunidadId | undefined }) {
  const { t } = useI18n();
  // Solo las clases con etapa y curso: sin ellos no se sabe qué criterios les tocan
  const conNivel = agruparPorEtapa(classes.filter(c => c.etapa && c.curso)).flatMap(g => g.clases);
  if (!conNivel.length) return null;
  return (
    <div className="card cob">
      <div className="card-hd">
        <div className="card-ttl"><ListChecks size={15} aria-hidden="true" />{t('Cobertura del currículo')}</div>
      </div>
      <p className="cob-sub">{t('Cuántos criterios de evaluación oficiales llevas evaluados en cada clase con rúbricas y dianas que los tienen marcados. Pulsa una fila para ver los que faltan.')}</p>
      <div className="cob-lista">
        {conNivel.map(c => (
          <FilasDeClase key={c.id} cls={c} evaluations={evaluations} comunidad={comunidad} variasAsignaturas={(c.subjects?.length ?? 1) > 1} />
        ))}
      </div>
    </div>
  );
}
