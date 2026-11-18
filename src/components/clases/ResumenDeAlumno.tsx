/**
 * Lo más relevante de un alumno, arriba de su ficha de «Mis clases» (18-11-2026,
 * petición del dueño): lo positivo a un lado y lo que necesita atención al otro,
 * del periodo elegido. Lo calculan las reglas de `lib/resumenAlumno.ts`, sin IA.
 */
import { useMemo, useState } from 'react';
import { BookOpen, CalendarCheck, Sparkles, Target, ThumbsUp, TriangleAlert } from 'lucide-react';
import { useI18n } from '../../i18n';
import { isoDate } from '../../lib/utils';
import { PERIODOS, resumenAlumno, type DatoResumen, type DatosParaResumen, type PeriodoResumen, type TipoDato } from '../../lib/resumenAlumno';

const CLAVE_PERIODO = 'aulapro_resumen_periodo';
const ICONO: Record<TipoDato, typeof BookOpen> = { notas: BookOpen, asistencia: CalendarCheck, actitud: ThumbsUp, competencias: Target };
const NOMBRE_TIPO: Record<TipoDato, string> = { notas: 'Notas', asistencia: 'Asistencia', actitud: 'Actitud y trabajo diario', competencias: 'Competencias' };

function periodoGuardado(): PeriodoResumen {
  try {
    const p = localStorage.getItem(CLAVE_PERIODO);
    return PERIODOS.some(x => x.id === p) ? (p as PeriodoResumen) : 'semanas';
  } catch { return 'semanas'; }
}

type Props = Omit<DatosParaResumen, 'hoy' | 'periodo'>;

export function ResumenDeAlumno(props: Props) {
  const { t, locale } = useI18n();
  const [periodo, setPeriodo] = useState<PeriodoResumen>(periodoGuardado);
  const [hoy] = useState(() => isoDate());
  const elegir = (p: PeriodoResumen) => { setPeriodo(p); try { localStorage.setItem(CLAVE_PERIODO, p); } catch { /* sin almacenamiento */ } };

  const { student, cls, companeros, gradeCategories, gradeItems, grades, attendance, classMarks, evaluations } = props;
  const r = useMemo(
    () => resumenAlumno({ student, cls, companeros, gradeCategories, gradeItems, grades, attendance, classMarks, evaluations, hoy, periodo }),
    [student, cls, companeros, gradeCategories, gradeItems, grades, attendance, classMarks, evaluations, hoy, periodo],
  );

  /** El texto de un dato: traducido, con los decimales como se escriben en el idioma y el desglose detrás. */
  const texto = (d: DatoResumen) => {
    const vars = Object.fromEntries(Object.entries(d.vars ?? {}).map(([k, v]) => [
      k, typeof v === 'number' ? v.toLocaleString(locale, { maximumFractionDigits: 1 }) : d.traducir?.includes(k) ? t(v) : v,
    ]));
    const detalle = d.detalle?.length ? `: ${d.detalle.map(x => (x.n > 1 ? `${t(x.etiqueta)} ×${x.n}` : t(x.etiqueta))).join(', ')}` : '';
    return t(d.clave, vars) + detalle;
  };

  const lista = (datos: DatoResumen[], vacio: string) => (
    datos.length === 0
      ? <p className="ra-vacio">{t(vacio)}</p>
      : (
        <ul>
          {datos.map((d, i) => {
            const Icono = ICONO[d.tipo];
            return <li key={i}><Icono size={14} aria-label={t(NOMBRE_TIPO[d.tipo])} /><span>{texto(d)}</span></li>;
          })}
        </ul>
      )
  );

  return (
    <section className="ra" aria-label={t('Lo más relevante')}>
      <div className="ra-hd">
        <strong>{t('Lo más relevante')}</strong>
        <div className="ra-periodos" role="group" aria-label={t('Periodo')}>
          {PERIODOS.map(p => (
            <button key={p.id} type="button" aria-pressed={periodo === p.id} onClick={() => elegir(p.id)}>{t(p.label)}</button>
          ))}
        </div>
      </div>
      {!r.hayDatos ? (
        <p className="ra-vacio">{t('Aún no hay notas, asistencia, anotaciones ni evaluaciones de este alumno en este periodo. Prueba con otro periodo.')}</p>
      ) : (
        <div className="ra-cols">
          <div className="ra-col pos">
            <h4><Sparkles size={14} aria-hidden="true" />{t('Lo positivo')}</h4>
            {lista(r.positivos, 'Nada que destacar en este periodo.')}
          </div>
          <div className="ra-col neg">
            <h4><TriangleAlert size={14} aria-hidden="true" />{t('Necesita atención')}</h4>
            {lista(r.atencion, 'Nada que necesite atención en este periodo.')}
          </div>
        </div>
      )}
    </section>
  );
}
