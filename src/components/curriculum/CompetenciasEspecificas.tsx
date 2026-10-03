/**
 * Las notas de un alumno por competencias específicas, materia a materia de su
 * clase: la de cada criterio de evaluación oficial, la de cada competencia y
 * la del área por competencias. Va en la Diana competencial, con todo lo de
 * competencias (decisión del dueño, 3-10-2026). Las notas salen de las
 * evaluaciones con rúbricas y dianas que tienen criterios oficiales marcados;
 * ver `lib/curriculum/evaluacionPorCriterios.ts`.
 */
import { ChevronDown } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useNotasPorCompetencias } from '../../hooks/useNotasPorCompetencias';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { Class, Evaluation } from '../../types';

function Nota({ valor }: { valor: number | null }) {
  const { t, locale } = useI18n();
  if (valor === null) return <span className="sda-chip">{t('Sin evaluar')}</span>;
  const tono = valor < 5 ? 'baja' : valor < 7 ? 'media' : 'alta';
  return (
    <span className={`ce-nota ${tono}`}>
      {valor.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
    </span>
  );
}

export function CompetenciasEspecificas({ cls, comunidad, evaluaciones }: {
  cls: Class | null;
  comunidad: ComunidadId | undefined;
  /** Las evaluaciones del alumno. */
  evaluaciones: Evaluation[];
}) {
  const { t } = useI18n();
  const { estado, materias } = useNotasPorCompetencias(cls, comunidad, evaluaciones);
  const hayNotas = materias.some(m => m.notas.nota !== null);

  return (
    <section className="card" aria-labelledby="ce-titulo">
      <div className="card-hd">
        <div className="card-ttl" id="ce-titulo">{t('Competencias específicas')}</div>
      </div>
      <p className="ce-intro">
        {t('Nota de cada criterio de evaluación oficial, de cada competencia específica y del área, a partir de las rúbricas y dianas que marcan qué criterios oficiales evalúan. No cambia la nota del cuaderno.')}
      </p>
      {estado === 'sin-nivel' && (
        <p className="ce-aviso">{t('Indica la etapa y el curso de la clase en Mis Clases para ver sus competencias específicas.')}</p>
      )}
      {estado === 'cargando' && <p className="ce-aviso">{t('Cargando…')}</p>}
      {estado === 'listo' && materias.length === 0 && (
        <p className="ce-aviso">{t('Ninguna asignatura de esta clase tiene materia oficial.')}</p>
      )}
      {estado === 'listo' && materias.length > 0 && !hayNotas && (
        <p className="ce-aviso">
          {t('Aún no hay notas: en Rúbricas y Dianas, marca qué criterios oficiales evalúa cada criterio o ítem, y evalúa con ellos.')}
        </p>
      )}
      {materias.map(({ asignatura, notas }) => (
        <details key={asignatura} className="sda-area">
          <summary>
            <span className="sda-area-ttl">
              {asignatura}
              {asignatura !== notas.nombre && <span className="sda-chip">{notas.nombre}</span>}
            </span>
            <span className="sda-area-ttl">
              <Nota valor={notas.nota} />
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          </summary>
          <ol className="ce-lista">
            {notas.competencias.map(c => (
              <li key={c.n}>
                <div className="ce-fila">
                  <span className="ce-texto"><strong>{c.n}.</strong> {c.texto}</span>
                  <Nota valor={c.nota} />
                </div>
                <ul className="ce-criterios">
                  {c.criterios.map(cr => (
                    <li key={cr.codigo} className="ce-fila">
                      <span className="ce-texto"><strong>{cr.codigo}</strong> {cr.texto}</span>
                      <span className="ce-veces">
                        {cr.veces > 0 && t(cr.veces === 1 ? 'Evaluado {n} vez' : 'Evaluado {n} veces', { n: cr.veces })}
                      </span>
                      <Nota valor={cr.nota} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </section>
  );
}
