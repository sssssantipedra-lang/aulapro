/**
 * Cobertura del currículo, en la portada de Evaluar (18-11-2026, decisión del
 * dueño): de cada clase y asignatura con materia oficial, cuántos criterios de
 * evaluación llevan nota de alguna rúbrica o diana y cuáles faltan. La cuenta,
 * en `lib/curriculum/cobertura.ts`. Se carga aparte: necesita el currículo.
 *
 * Va por evaluación (20-11-2026), con el selector de toda la app: en una
 * evaluación dice qué criterios se han evaluado en ella, cuáles en otra y
 * cuáles en ninguna (los que quedan por repartir); en «Curso», como siempre.
 */
import { useMemo } from 'react';
import { ListChecks } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useMateriasOficiales } from '../../hooks/useNotasPorCompetencias';
import { coberturaDeEvaluacion, coberturaDeMateria, porcentaje, type CriterioPendiente } from '../../lib/curriculum/cobertura';
import { CURSO_ENTERO, EN_FRASE } from '../../lib/periodos';
import { PERIODS } from '../../lib/utils';
import { useEvaluacionElegida, type EvaluacionElegida } from '../../hooks/useEvaluacionElegida';
import { SelectorEvaluacion } from '../SelectorEvaluacion';
import { agruparPorEtapa } from '../../lib/etapas';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { Class, Evaluation } from '../../types';

/** El nombre corto de cada evaluación, como en el selector. */
const CORTO: Record<string, string> = { [PERIODS[0]]: '1.ª', [PERIODS[1]]: '2.ª', [PERIODS[2]]: '3.ª' };

/** Los criterios a repartir, con su texto: lo que hay que leer para decidir cuándo evaluarlos. */
function PorRepartir({ criterios }: { criterios: CriterioPendiente[] }) {
  return <ul>{criterios.map(p => <li key={p.codigo}><b>{p.codigo}</b> {p.texto}</li>)}</ul>;
}

function FilasDeClase({ cls, evaluations, comunidad, variasAsignaturas, ev }: {
  cls: Class; evaluations: Evaluation[]; comunidad: ComunidadId | undefined; variasAsignaturas: boolean; ev: EvaluacionElegida;
}) {
  const { t } = useI18n();
  const { materias } = useMateriasOficiales(cls, comunidad);
  const deLaClase = useMemo(() => evaluations.filter(e => e.class_id === cls.id), [evaluations, cls.id]);
  const enFrase = t(EN_FRASE[ev.periodo] ?? ev.periodo);
  const nombre = (asignatura: string) => (
    <span className="cob-nombre"><b>{cls.name}</b>{(variasAsignaturas || asignatura !== cls.name) && <small>{asignatura}</small>}</span>
  );
  if (ev.periodo !== CURSO_ENTERO) {
    return (
      <>
        {materias.map(m => {
          const c = coberturaDeEvaluacion(m.entry, m.grupo, deLaClase, ev.periodo, ev.hoy, ev.rangos);
          if (!c.total) return null;
          const ancho = (n: number) => `${(n / c.total) * 100}%`;
          const descripcion = [
            t('{n} de {total} criterios evaluados en {evaluacion}', { n: c.enEsta.length, total: c.total, evaluacion: enFrase }),
            ...(c.enOtra.length ? [t('{n} más en otra evaluación', { n: c.enOtra.length })] : []),
            t('{n} sin evaluar en todo el curso', { n: c.enNinguna.length }),
          ].join('; ');
          return (
            <details key={m.asignatura} className="cob-fila" style={{ '--cob-c': cls.color } as React.CSSProperties}>
              <summary>
                {nombre(m.asignatura)}
                <span className="cob-barra cob-barra-ev" role="img" aria-label={descripcion}>
                  <i style={{ width: ancho(c.enEsta.length) }} />
                  <i className="cob-otra" style={{ width: ancho(c.enOtra.length) }} />
                </span>
                <span className="cob-cuenta">
                  {t('{n} de {total}', { n: c.enEsta.length, total: c.total })}
                  {c.enOtra.length > 0 && <small>{t('+{n} en otras', { n: c.enOtra.length })}</small>}
                </span>
              </summary>
              {c.enEsta.length === 0 ? (
                <p>{t('Aún no has evaluado ningún criterio en {evaluacion}.', { evaluacion: enFrase })}</p>
              ) : (
                <p className="cob-grupo">
                  <strong>{t('Evaluados en {evaluacion} ({n}):', { evaluacion: enFrase, n: c.enEsta.length })}</strong>{' '}
                  {c.enEsta.map(cr => <span key={cr.codigo} className="cob-cod" title={cr.texto}>{cr.codigo}</span>)}
                </p>
              )}
              {c.enOtra.length > 0 && (
                <p className="cob-grupo">
                  <strong>{t('Evaluados solo en otra evaluación ({n}):', { n: c.enOtra.length })}</strong>{' '}
                  {c.enOtra.map(cr => (
                    <span key={cr.codigo} className="cob-cod otra" title={cr.texto}>
                      {cr.codigo} <small>{cr.periodos.length ? cr.periodos.map(p => t(CORTO[p] ?? p)).join(', ') : t('otro curso')}</small>
                    </span>
                  ))}
                </p>
              )}
              {c.enNinguna.length === 0 ? (
                <p className="cob-ok">{t('Todos los criterios de esta materia tienen ya alguna evaluación.')}</p>
              ) : (
                <>
                  <p className="cob-faltan">{t(c.enNinguna.length === 1 ? 'Queda 1 criterio sin evaluar en todo el curso, por repartir:' : 'Quedan {n} criterios sin evaluar en todo el curso, por repartir:', { n: c.enNinguna.length })}</p>
                  <PorRepartir criterios={c.enNinguna} />
                </>
              )}
            </details>
          );
        })}
      </>
    );
  }
  return (
    <>
      {materias.map(m => {
        const c = coberturaDeMateria(m.entry, m.grupo, deLaClase);
        if (!c.total) return null;
        const pct = porcentaje(c);
        return (
          <details key={m.asignatura} className="cob-fila" style={{ '--cob-c': cls.color } as React.CSSProperties}>
            <summary>
              {nombre(m.asignatura)}
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
                <PorRepartir criterios={c.pendientes} />
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
  // La evaluación es la del cuaderno y las actas
  const ev = useEvaluacionElegida();
  // Solo las clases con etapa y curso: sin ellos no se sabe qué criterios les tocan
  const conNivel = agruparPorEtapa(classes.filter(c => c.etapa && c.curso)).flatMap(g => g.clases);
  if (!conNivel.length) return null;
  const esCurso = ev.periodo === CURSO_ENTERO;
  return (
    <div className="card cob">
      <div className="card-hd cob-hd">
        <div className="card-ttl"><ListChecks size={15} aria-hidden="true" />{t('Cobertura del currículo')}</div>
        <SelectorEvaluacion ev={ev} queCuenta={t('La cobertura de una evaluación cuenta las rúbricas y dianas evaluadas en estas fechas.')} />
      </div>
      {esCurso ? (
        <p className="cob-sub">{t('Cuántos criterios de evaluación oficiales llevas evaluados en cada clase con rúbricas y dianas que los tienen marcados. Pulsa una fila para ver los que faltan.')}</p>
      ) : (
        <>
          <p className="cob-sub">{t('Cuántos criterios de evaluación oficiales has evaluado en {evaluacion} en cada clase, con rúbricas y dianas que los tienen marcados. Pulsa una fila para ver cuáles son y cuáles quedan por repartir.', { evaluacion: t(EN_FRASE[ev.periodo] ?? ev.periodo) })}</p>
          <p className="cob-leyenda" aria-hidden="true">
            <span><i className="cob-muestra" />{t('En esta evaluación')}</span>
            <span><i className="cob-muestra otra" />{t('Solo en otra evaluación')}</span>
            <span><i className="cob-muestra nada" />{t('Sin evaluar en todo el curso')}</span>
          </p>
        </>
      )}
      <div className="cob-lista">
        {conNivel.map(c => (
          <FilasDeClase key={c.id} cls={c} evaluations={evaluations} comunidad={comunidad} variasAsignaturas={(c.subjects?.length ?? 1) > 1} ev={ev} />
        ))}
      </div>
    </div>
  );
}
