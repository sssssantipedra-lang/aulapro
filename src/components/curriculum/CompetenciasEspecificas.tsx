/**
 * Las notas de un alumno por competencias específicas, materia a materia de su
 * clase: la de cada criterio de evaluación oficial, la de cada competencia y
 * la del área por competencias. Va en la Diana competencial, con todo lo de
 * competencias (decisión del dueño, 3-10-2026). Las notas salen de las
 * evaluaciones con rúbricas y dianas que tienen criterios oficiales marcados;
 * ver `lib/curriculum/evaluacionPorCriterios.ts`.
 *
 * Una tabla por asignatura, con el número de cada competencia y criterio, un
 * resumen corto (el texto entero, al pasar el ratón; en el móvil, al tocarlo)
 * y su nota; y se puede sacar en PDF (petición del dueño, 3-10-2026).
 */
import { useState } from 'react';
import { ChevronDown, FileDown } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useToast } from '../ui/Toast';
import { useNotasPorCompetencias } from '../../hooks/useNotasPorCompetencias';
import { resumir } from '../../lib/curriculum/evaluacionPorCriterios';
import { citarNormas, type ComunidadId } from '../../lib/curriculum/comunidades';
import { saveCompetenciasPdf } from '../../services/exportCompetencias';
import { isoDate } from '../../lib/utils';
import type { Class, Evaluation } from '../../types';

/** El resumen de un texto oficial: entero al pasar el ratón, o al tocarlo. */
function Resumen({ texto }: { texto: string }) {
  const [entero, setEntero] = useState(false);
  const corto = resumir(texto);
  if (corto === texto) return <>{texto}</>;
  return (
    <button
      type="button" className="ce-resumen" title={texto}
      aria-expanded={entero} onClick={() => setEntero(e => !e)}
    >
      {entero ? texto : corto}
    </button>
  );
}

function Nota({ valor }: { valor: number | null }) {
  const { t, locale } = useI18n();
  if (valor === null) return <span className="ce-sin">{t('Sin evaluar')}</span>;
  const tono = valor < 5 ? 'baja' : valor < 7 ? 'media' : 'alta';
  return (
    <span className={`ce-nota ${tono}`}>
      {valor.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
    </span>
  );
}

export function CompetenciasEspecificas({ cls, comunidad, alumno, evaluaciones }: {
  cls: Class | null;
  comunidad: ComunidadId | undefined;
  /** El nombre del alumno, para el PDF. */
  alumno: string;
  /** Las evaluaciones del alumno. */
  evaluaciones: Evaluation[];
}) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { estado, materias, curriculo } = useNotasPorCompetencias(cls, comunidad, evaluaciones);
  const [exportando, setExportando] = useState(false);
  const hayNotas = materias.some(m => m.notas.nota !== null);

  async function exportar() {
    setExportando(true);
    const res = await saveCompetenciasPdf({
      alumno, clase: cls?.name ?? '', fecha: isoDate(), materias,
      cita: curriculo ? citarNormas(curriculo.normas, lang) : undefined,
    }, lang);
    setExportando(false);
    if (res.error) toast(t('No se pudo generar el PDF: {error}', { error: res.error }));
  }

  return (
    <section className="card" aria-labelledby="ce-titulo">
      <div className="card-hd">
        <div className="card-ttl" id="ce-titulo">{t('Competencias específicas')}</div>
        {materias.length > 0 && (
          <button type="button" className="btn-ghost" onClick={exportar} disabled={exportando} style={{ gap: 6 }}>
            <FileDown size={14} aria-hidden="true" />{t('Exportar PDF')}
          </button>
        )}
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
          <div className="ce-tabla-envoltorio">
            <table className="ce-tabla">
              <thead>
                <tr>
                  <th scope="col">{t('Nº')}</th>
                  <th scope="col">{t('Resumen')} <span className="ce-pista">{t('(pasa el ratón o tócalo para leerlo entero)')}</span></th>
                  <th scope="col">{t('Evaluado')}</th>
                  <th scope="col">{t('Nota')}</th>
                </tr>
              </thead>
              <tbody>
                {notas.competencias.map(c => [
                  <tr key={`ce${c.n}`} className="ce-competencia">
                    <th scope="row">{t('CE{n}', { n: c.n })}</th>
                    <td><Resumen texto={c.texto} /></td>
                    <td />
                    <td><Nota valor={c.nota} /></td>
                  </tr>,
                  ...c.criterios.map(cr => (
                    <tr key={cr.codigo}>
                      <th scope="row">{cr.codigo}</th>
                      <td><Resumen texto={cr.texto} /></td>
                      <td className="ce-veces">
                        {cr.veces > 0 ? t(cr.veces === 1 ? '{n} vez' : '{n} veces', { n: cr.veces }) : '—'}
                      </td>
                      <td><Nota valor={cr.nota} /></td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </section>
  );
}
