/**
 * PT y AL, pestaña «Evaluación» de la página de un alumno: el cierre de cada trimestre. Cada objetivo del
 * trimestre con lo que sugiere el registro diario y la valoración que el especialista da por buena, un
 * comentario y si se sigue trabajando el trimestre siguiente. Es lo que leen los informes y el PAP.
 * Ver `docs/PTAL.md`, «El cierre del trimestre».
 */
import { useMemo, useState } from 'react';
import { Check, Minus, X, CircleDashed, ArrowRight, Lock } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../i18n';
import { isoDate } from '../../lib/utils';
import { cerrarTrimestre, filasDeCierre, trimestreCerrado, trimestreDe, type ResultadoObjetivo } from '../../lib/apoyo';
import type { AlumnoApoyo, ApoyoData, Trimestre } from '../../types/apoyo';

interface Props {
  alumno: AlumnoApoyo;
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
  /** Para ir a «Documentos» con el trimestre ya cerrado. */
  onDocumentos: (trimestre: Trimestre) => void;
}

const TRIMESTRES: Trimestre[] = [1, 2, 3];

const RESULTADOS: { id: ResultadoObjetivo; label: string; icono: React.ReactNode }[] = [
  { id: 'si', label: 'Conseguido', icono: <Check size={13} strokeWidth={3} /> },
  { id: 'proceso', label: 'En proceso', icono: <Minus size={13} strokeWidth={3} /> },
  { id: 'no', label: 'No conseguido', icono: <X size={13} strokeWidth={3} /> },
  { id: 'sin', label: 'Sin trabajar', icono: <CircleDashed size={13} /> },
];

interface Edicion { resultado: ResultadoObjetivo; comentario: string; seguir: boolean }

export function CierreTrimestreApoyo({ alumno, data, onChange, onDocumentos }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [trimestre, setTrimestre] = useState<Trimestre>(trimestreDe(isoDate()));
  /** Lo que se ha tocado en esta pantalla y aún no se ha guardado, por objetivo. */
  const [cambios, setCambios] = useState<Record<string, Partial<Edicion>>>({});

  const filas = useMemo(() => filasDeCierre(data, alumno.id, trimestre), [data, alumno.id, trimestre]);
  const cerrado = trimestreCerrado(data, alumno.id, trimestre);
  const fechaCierre = data.evaluaciones.filter(e => e.alumnoId === alumno.id && e.trimestre === trimestre).map(e => e.fecha).sort().at(-1);
  const valor = (f: typeof filas[number]): Edicion => ({
    resultado: cambios[f.objetivo.id]?.resultado ?? f.resultado,
    comentario: cambios[f.objetivo.id]?.comentario ?? f.comentario,
    seguir: cambios[f.objetivo.id]?.seguir ?? f.seguir,
  });
  const sinGuardar = Object.keys(cambios).length > 0;
  const porPrograma = [...new Set(filas.map(f => f.programa.id))].map(id => ({ programa: filas.find(f => f.programa.id === id)!.programa, filas: filas.filter(f => f.programa.id === id) }));

  const tocar = (id: string, c: Partial<Edicion>) => setCambios(x => ({ ...x, [id]: { ...x[id], ...c } }));

  function elegirTrimestre(n: Trimestre) {
    if (sinGuardar && !window.confirm(t('Tienes cambios sin guardar en este trimestre. ¿Los descartas?'))) return;
    setCambios({});
    setTrimestre(n);
  }

  function guardar() {
    const hoy = isoDate();
    onChange(d => cerrarTrimestre(d, alumno.id, trimestre, filas.map(f => ({ objetivoId: f.objetivo.id, ...valor(f) })), hoy));
    setCambios({});
    toast(t('✅ Cierre del {n}º trimestre guardado. Ya puedes preparar los informes.', { n: trimestre }));
  }

  return (
    <div className="al-panel">
      <div className="al-barra">
        <p className="ap-sub" style={{ margin: 0 }}>
          {t('Al acabar el trimestre, confirma cómo ha ido cada objetivo. Es lo que sale en los informes y en el PAP; lo que se sugiere sale de tu registro diario.')}
        </p>
      </div>

      <div className="chip-row" role="group" aria-label={t('Trimestre')}>
        {TRIMESTRES.map(n => (
          <button key={n} type="button" className={`chip accent${trimestre === n ? ' on' : ''}`} aria-pressed={trimestre === n} onClick={() => elegirTrimestre(n)}>
            {trimestreCerrado(data, alumno.id, n) && <Lock size={12} aria-hidden="true" />}{t('{n}º trimestre', { n })}
          </button>
        ))}
      </div>

      {filas.length === 0 ? (
        <div className="card"><p className="ap-vacio">{t('Este alumno no tiene objetivos en este trimestre. Créalos en la pestaña «Programa».')}</p></div>
      ) : (
        <>
          <p className="ap-cierre-estado" role="status">
            {cerrado && !sinGuardar
              ? <><Lock size={13} aria-hidden="true" /> {t('Cerrado el {fecha}', { fecha: fechaCierre ? new Date(fechaCierre + 'T00:00:00').toLocaleDateString(locale) : '' })}</>
              : t('Aún sin cerrar: los informes usarán lo último que registraste.')}
          </p>

          {porPrograma.map(({ programa, filas: fs }) => (
            <article className="card" key={programa.id} aria-label={programa.ambito}>
              <div className="ap-prog-ttl">{programa.ambito}</div>
              <ul className="ap-cierre-lista">
                {fs.map(f => {
                  const v = valor(f);
                  const r = f.resumen;
                  const hayRegistro = r.si + r.proceso + r.no > 0;
                  return (
                    <li key={f.objetivo.id} className="ap-cierre-fila">
                      <div className="ap-cierre-txt">{f.objetivo.texto}</div>
                      <div className="ap-cierre-reg">
                        {hayRegistro
                          ? t('Registro: {si} conseguido, {proceso} en proceso, {no} no conseguido', { si: r.si, proceso: r.proceso, no: r.no })
                          : t('Sin registros este trimestre')}
                      </div>
                      <div className="chip-row" role="radiogroup" aria-label={f.objetivo.texto}>
                        {RESULTADOS.map(x => (
                          <button key={x.id} type="button" role="radio" aria-checked={v.resultado === x.id}
                            className={`chip sm ap-res ap-res-${x.id}${v.resultado === x.id ? ' on' : ''}`}
                            onClick={() => tocar(f.objetivo.id, { resultado: x.id, ...(trimestre < 3 && cambios[f.objetivo.id]?.seguir === undefined ? { seguir: x.id !== 'si' } : {}) })}>
                            {x.icono}{t(x.label)}
                          </button>
                        ))}
                      </div>
                      <input className="finput" value={v.comentario} placeholder={t('Comentario (opcional)')} aria-label={t('Comentario (opcional)')}
                        onChange={e => tocar(f.objetivo.id, { comentario: e.target.value })} />
                      {trimestre < 3 && (
                        <label className="ap-cierre-seguir">
                          <input type="checkbox" checked={v.seguir} onChange={e => tocar(f.objetivo.id, { seguir: e.target.checked })} />
                          {t('Seguir trabajándolo el {n}º trimestre', { n: trimestre + 1 })}
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}

          <div className="ap-acciones">
            <button className="btn-accent" onClick={guardar} disabled={cerrado && !sinGuardar}>
              <Check size={15} />{t('Guardar el cierre del {n}º trimestre', { n: trimestre })}
            </button>
            {cerrado && !sinGuardar && (
              <button className="btn-ghost" onClick={() => onDocumentos(trimestre)}>{t('Preparar los informes')}<ArrowRight size={14} /></button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
