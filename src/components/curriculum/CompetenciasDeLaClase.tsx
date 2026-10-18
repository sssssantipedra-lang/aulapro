/**
 * El cuaderno, pestaña «Por competencias»: la clase entera, un alumno por
 * fila y una columna por competencia específica de la asignatura, con el
 * currículo de la comunidad del perfil (decisión del dueño, 7-10-2026: el
 * currículo de cada comunidad también en el cuaderno). Las notas salen de las
 * rúbricas y dianas que marcan qué criterios oficiales evalúan, igual que en
 * la Diana competencial, que tiene el detalle de cada alumno criterio a
 * criterio. No cambia la nota del cuaderno. Ver `docs/COMUNIDADES.md`.
 */
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useI18n } from '../../i18n';
import { ClassChips } from '../ui/ClassChips';
import { useMateriasOficiales } from '../../hooks/useNotasPorCompetencias';
import { notasDeMateria, resumir, type NotaMateria } from '../../lib/curriculum/evaluacionPorCriterios';
import { citarNormas, type ComunidadId } from '../../lib/curriculum/comunidades';
import { downloadFile } from '../../lib/download';
import type { Class, Evaluation, Student } from '../../types';
import { CARPETAS } from '../../lib/carpetas';

function Nota({ valor }: { valor: number | null }) {
  const { t, locale } = useI18n();
  if (valor === null) return <span className="ce-sin" aria-label={t('Sin evaluar')}>—</span>;
  const tono = valor < 5 ? 'baja' : valor < 7 ? 'media' : 'alta';
  return (
    <span className={`ce-nota ${tono}`}>
      {valor.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
    </span>
  );
}

export function CompetenciasDeLaClase({ classes, students, evaluations, comunidad, onNav }: {
  classes: Class[];
  students: Student[];
  evaluations: Evaluation[];
  comunidad: ComunidadId | undefined;
  onNav: (s: string) => void;
}) {
  const { t, lang, locale } = useI18n();
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const cls = classes.find(c => c.id === classId) ?? classes[0] ?? null;
  const { estado, materias, curriculo } = useMateriasOficiales(cls, comunidad);
  const [elegida, setElegida] = useState('');
  const materia = materias.find(m => m.asignatura === elegida) ?? materias[0];

  const alumnos = useMemo(
    () => students.filter(s => s.class_id === cls?.id).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [students, cls?.id],
  );
  /** La nota de cada alumno en la materia elegida, competencia a competencia. */
  const filas = useMemo(() => (materia
    ? alumnos.map(a => ({ alumno: a, notas: notasDeMateria(materia.entry, materia.grupo, evaluations.filter(e => e.student_id === a.id)) }))
    : []), [materia, alumnos, evaluations]);
  const competencias: NotaMateria['competencias'] = filas[0]?.notas.competencias ?? [];
  const hayNotas = filas.some(f => f.notas.nota !== null);
  const cita = curriculo ? citarNormas(curriculo.normas, lang) : '';

  function exportar() {
    if (!materia) return;
    const num = (v: number | null) => (v === null ? '' : v.toLocaleString(locale, { maximumFractionDigits: 2 }));
    const celda = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const cab = [t('Alumno'), ...competencias.map(c => t('CE{n}', { n: c.n })), t('Área por competencias')];
    const lineas = filas.map(f => [f.alumno.name, ...f.notas.competencias.map(c => num(c.nota)), num(f.notas.nota)]);
    const csv = [cab, ...lineas].map(l => l.map(celda).join(';')).join('\r\n')
      + `\r\n\r\n${celda(`${materia.asignatura}${cita ? ` · ${cita}` : ''}`)}`;
    void downloadFile(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
      `${t('Competencias')} ${cls?.name ?? ''} ${materia.asignatura}.csv`.replace(/[\\/:*?"<>|]+/g, '-'), CARPETAS.informes);
  }

  if (!cls) {
    return <div className="card"><p className="ce-aviso">{t('Para usar el cuaderno de notas, primero crea una clase con sus alumnos.')}</p></div>;
  }

  return (
    <>
      <div className="toolbar">
        <ClassChips classes={classes} value={cls.id} onChange={setClassId} />
        {materias.length > 1 && (
          <>
            <span className="toolbar-sep" aria-hidden="true" />
            <div className="chip-row" role="group" aria-label={t('Asignatura')}>
              {materias.map(m => {
                const on = m.asignatura === materia?.asignatura;
                return (
                  <button key={m.asignatura} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setElegida(m.asignatura)}>
                    {m.asignatura}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <span className="toolbar-spacer" />
        <button className="tb-btn" onClick={exportar} disabled={!hayNotas}>
          <Download size={14} />{t('Exportar a Excel')}
        </button>
      </div>

      <div className="card">
        <p className="ce-intro">
          {t('La nota de cada competencia específica del currículo oficial, a partir de las rúbricas y dianas que marcan qué criterios evalúan. No cambia la nota del cuaderno. El detalle de cada alumno, criterio a criterio, está en la Diana competencial.')}
        </p>
        {estado === 'sin-nivel' && (
          <>
            <p className="ce-aviso">{t('Indica la etapa y el curso de la clase en Mis Clases para ver sus competencias específicas.')}</p>
            <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => onNav('classes')}>{t('Ir a Mis Clases')}</button>
          </>
        )}
        {estado === 'cargando' && <p className="ce-aviso">{t('Cargando…')}</p>}
        {estado === 'listo' && materias.length === 0 && (
          <p className="ce-aviso">{t('Ninguna asignatura de esta clase tiene materia oficial.')}</p>
        )}
        {materia && !hayNotas && (
          <>
            <p className="ce-aviso">
              {t('Aún no hay notas: en Rúbricas y Dianas, marca qué criterios oficiales evalúa cada criterio o ítem, y evalúa con ellos.')}
            </p>
            <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => onNav('rubrics')}>{t('Ir a Rúbricas')}</button>
          </>
        )}
        {materia && hayNotas && (
          <>
            <div className="ce-tabla-envoltorio ce-clase-envoltorio">
              <table className="ce-tabla ce-clase">
                <thead>
                  <tr>
                    <th scope="col">{t('Alumno')}</th>
                    {competencias.map(c => (
                      <th key={c.n} scope="col" title={c.texto}>{t('CE{n}', { n: c.n })}</th>
                    ))}
                    <th scope="col">{t('Área')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(({ alumno, notas }) => (
                    <tr key={alumno.id}>
                      <th scope="row">{alumno.name}</th>
                      {notas.competencias.map(c => <td key={c.n}><Nota valor={c.nota} /></td>)}
                      <td><Nota valor={notas.nota} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ol className="ce-leyenda">
              {competencias.map(c => (
                <li key={c.n}><strong>{t('CE{n}', { n: c.n })}</strong> <span title={c.texto}>{resumir(c.texto, 120)}</span></li>
              ))}
            </ol>
          </>
        )}
        {materia && cita && (
          <p className="ce-cita">{t('{materia}, según {norma}.', { materia: materia.entry.nombre, norma: cita })}</p>
        )}
      </div>
    </>
  );
}
