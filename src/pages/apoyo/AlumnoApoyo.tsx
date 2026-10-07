/**
 * PT y AL, la página de un alumno (decisión del dueño, 6-10-2026): todo lo
 * suyo en un sitio, en pestañas, en vez de repartido por varias pantallas que
 * pedían elegirlo cada vez.
 *
 *   - Resumen: sus avisos, cómo va este trimestre, sus grupos, sus últimas
 *     sesiones y la última coordinación.
 *   - Programa, Coordinaciones y Documentos: las de antes, solo de él. Se
 *     cargan al abrirlas (Documentos lleva la librería de Word).
 *   - Sesiones: lo que se anotó de él en el Registro diario, sesión a sesión.
 *   - Datos: su ficha y sus grupos.
 *
 * Arriba, lo que se hace con él: registrar la sesión, una ficha adaptada y su
 * agenda visual. Se llega desde «Mi alumnado», el Inicio y el Registro diario
 * con `requestAlumno` (`lib/apoyoNav.ts`). Ver `docs/PTAL.md`.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, FileText, Images, NotebookPen, Pencil, Clock, Check, Minus, X, AlertTriangle, TrendingUp,
  Users, CalendarDays, Handshake,
} from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { useToast } from '../../components/ui/Toast';
import { Pestanas } from '../../components/apoyo/Pestanas';
import { AvisoFila } from '../../components/apoyo/AvisoFila';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import { useI18n, weekdayLabel } from '../../i18n';
import { fromIsoDate, isoDate } from '../../lib/utils';
import {
  ASPECTOS, ASPECTO_LABEL, CARAS, CON_QUIEN, coordinacionesDe, diaDeLaSemana, enEdicion, gruposDelDia, tieneDesfase, trimestreDe,
  type AlumnoEnEdicion,
} from '../../lib/apoyo';
import { avisosApoyo, avisosDelAlumno, evolucionDelTrimestre, sesionesDelAlumno, type EstadoObjetivo } from '../../lib/inicioApoyo';
import {
  requestAgendaPara, requestFichaPara, requestGrupos, requestRegistro, useAlumnoPedido, type PestanaAlumno,
} from '../../lib/apoyoNav';
import { EditarAlumno } from './EditarAlumno';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { AlumnoApoyo, ApoyoData, Especialidad, GrupoApoyo, Logro, Trimestre } from '../../types/apoyo';
import type { Section } from '../../types';

const ProgramasApoyo = lazy(() => import('./ProgramasApoyo').then(m => ({ default: m.ProgramasApoyo })));
const CoordinacionesApoyo = lazy(() => import('./CoordinacionesApoyo').then(m => ({ default: m.CoordinacionesApoyo })));
const DocumentosApoyo = lazy(() => import('./DocumentosApoyo').then(m => ({ default: m.DocumentosApoyo })));

interface Props {
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
  especialidades: Especialidad[];
  comunidad: ComunidadId | undefined;
  docente: { nombre: string; centro: string; curso: string };
  onNav: (s: Section) => void;
}

const PESTANAS: { id: PestanaAlumno; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'programa', label: 'Programa' },
  { id: 'sesiones', label: 'Sesiones' },
  { id: 'coordinaciones', label: 'Coordinaciones' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'datos', label: 'Datos' },
];

const ESTADOS: { id: EstadoObjetivo; label: string }[] = [
  { id: 'si', label: 'Conseguido' },
  { id: 'proceso', label: 'En proceso' },
  { id: 'no', label: 'No conseguido' },
  { id: 'sin', label: 'Sin trabajar' },
];

const ICONO_LOGRO: Record<Logro, React.ReactNode> = {
  si: <Check size={13} strokeWidth={3} />,
  proceso: <Minus size={13} strokeWidth={3} />,
  no: <X size={13} strokeWidth={3} />,
};

/** La hora de ahora, «HH:MM», para saber qué sesión de hoy toca. */
function horaDeAhora(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function AlumnoApoyo({ data, onChange, especialidades, comunidad, docente, onNav }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  const pedido = useAlumnoPedido();
  const [pestana, setPestana] = useState<PestanaAlumno>(pedido?.pestana ?? 'resumen');
  const [edicion, setEdicion] = useState<AlumnoEnEdicion | null>(null);
  const alumno = data.alumnos.find(a => a.id === pedido?.alumnoId);

  // Sin alumno (se ha eliminado, o se llegó sin elegir ninguno): a la lista
  useEffect(() => { if (!alumno) onNav('apoyo-alumnado'); }, [alumno, onNav]);
  if (!alumno) return null;

  const hoy = isoDate();
  const suyos = data.grupos.filter(g => g.alumnos.includes(alumno.id));
  const conAmbas = especialidades.length > 1;
  const especialidadesSuyas = [...new Set(suyos.map(g => g.especialidad))].sort();

  /** El grupo de la sesión que toca ahora (o la siguiente de hoy); si hoy no tiene, el primero. */
  function registrar(grupo?: GrupoApoyo, fecha = hoy) {
    if (!grupo) {
      const deHoy = gruposDelDia(suyos, hoy);
      const ahora = horaDeAhora();
      const dia = diaDeLaSemana(hoy);
      grupo = deHoy.find(g => g.horario.some(f => f.dia === dia && f.fin >= ahora)) ?? deHoy[deHoy.length - 1] ?? suyos[0];
    }
    if (!grupo) { toast(t('Primero ponlo en un grupo de apoyo, en la pestaña «Datos».')); setPestana('datos'); return; }
    requestRegistro({ grupoId: grupo.id, fecha });
    onNav('apoyo-registro');
  }

  return (
    <section className="sec active ap-page al-page">
      <button type="button" className="btn-ghost al-volver" onClick={() => onNav('apoyo-alumnado')}>
        <ArrowLeft size={14} />{t('Mi alumnado')}
      </button>

      <div className="al-cab">
        <span aria-hidden="true"><Avatar name={alumno.nombre} size={54} className="av al-av" /></span>
        <div className="al-cab-txt">
          <h1 className="pg-title">{alumno.nombre}</h1>
          <div className="ap-meta">
            {alumno.claseOrigen && <span className="sda-chip">{alumno.claseOrigen}</span>}
            {alumno.matricula && <span>{nombreCurso(alumno.matricula)}</span>}
            {alumno.nivel && (
              <span className={`sda-chip${tieneDesfase(alumno) ? ' shared' : ''}`}>{t('Nivel de {curso}', { curso: nombreCurso(alumno.nivel) })}</span>
            )}
            {alumno.categorias.map(c => <span key={c} className="sda-chip">{t(c)}</span>)}
            {conAmbas && especialidadesSuyas.length > 0 && <span className="sda-chip">{especialidadesSuyas.join(' · ')}</span>}
          </div>
        </div>
        <div className="al-acc">
          <button type="button" className="btn-ghost" onClick={() => { requestFichaPara(alumno.id); onNav('resources'); }}>
            <FileText size={15} />{t('Ficha adaptada')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => { requestAgendaPara(alumno.id); onNav('apoyo-agenda-visual'); }}>
            <Images size={15} />{t('Agenda visual')}
          </button>
          <button type="button" className="btn-accent" onClick={() => registrar()}>
            <NotebookPen size={15} />{t('Registrar sesión')}
          </button>
        </div>
      </div>

      <Pestanas label={alumno.nombre} value={pestana} onChange={setPestana} items={PESTANAS.map(p => ({ id: p.id, label: t(p.label) }))} />

      <div role="tabpanel" aria-label={t(PESTANAS.find(p => p.id === pestana)!.label)}>
        {pestana === 'resumen' && (
          <Resumen alumno={alumno} data={data} grupos={suyos} hoy={hoy} locale={locale} onPestana={setPestana} onRegistrar={registrar} />
        )}
        <Suspense fallback={<p className="ap-sub">{t('Cargando…')}</p>}>
          {pestana === 'programa' && (
            <ProgramasApoyo alumno={alumno} data={data} onChange={onChange} especialidades={especialidades} comunidad={comunidad} onNav={onNav} />
          )}
          {pestana === 'coordinaciones' && <CoordinacionesApoyo alumno={alumno} data={data} onChange={onChange} />}
          {pestana === 'documentos' && (
            <DocumentosApoyo alumno={alumno} data={data} onChange={onChange} especialidades={especialidades} comunidad={comunidad} docente={docente} onNav={onNav} />
          )}
        </Suspense>
        {pestana === 'sesiones' && <Sesiones alumno={alumno} data={data} hoy={hoy} locale={locale} onAbrir={registrar} />}
        {pestana === 'datos' && (
          <Datos alumno={alumno} data={data} onChange={onChange} onEditar={() => setEdicion(enEdicion(alumno, data))} onNav={onNav} />
        )}
      </div>

      <EditarAlumno edicion={edicion} onEdicion={setEdicion} data={data} onChange={onChange} />
    </section>
  );
}

/* ── Resumen ── */

function Resumen({ alumno, data, grupos, hoy, locale, onPestana, onRegistrar }: {
  alumno: AlumnoApoyo;
  data: ApoyoData;
  grupos: GrupoApoyo[];
  hoy: string;
  locale: string;
  onPestana: (p: PestanaAlumno) => void;
  onRegistrar: (g?: GrupoApoyo, fecha?: string) => void;
}) {
  const { t } = useI18n();
  const T = trimestreDe(hoy);
  const avisos = useMemo(() => avisosDelAlumno(avisosApoyo(data, hoy), alumno), [data, hoy, alumno]);
  const ev = useMemo(() => evolucionDelTrimestre(data, T).find(e => e.alumno.id === alumno.id), [data, T, alumno.id]);
  const sesiones = useMemo(() => sesionesDelAlumno(data, alumno.id), [data, alumno.id]);
  const ultimaCoord = coordinacionesDe(data, alumno.id).at(-1);
  const delTrimestre = sesiones.filter(s => trimestreDe(s.sesion.fecha) === T);
  const vino = delTrimestre.filter(s => !s.registro.ausente).length;
  const total = ev?.objetivos.length ?? 0;
  const dia = (n: number) => weekdayLabel(n, locale, 'short');
  const diaLargo = (fecha: string) => {
    const s = fromIsoDate(fecha).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  };
  const diaCorto = (fecha: string) => (fecha === hoy ? t('Hoy') : fromIsoDate(fecha).toLocaleDateString(locale, { day: 'numeric', month: 'short' }));

  return (
    <div className="al-panel">
      {avisos.length > 0 && (
        <div className="card home-card">
          <div className="home-card-hd"><div className="home-card-ttl"><AlertTriangle size={15} />{t('Avisos')}</div></div>
          <ul className="ap-lista">
            {avisos.map((a, i) => (
              <AvisoFila key={i} aviso={a} enSuPagina diaCorto={diaLargo} onRegistrar={onRegistrar} onAlumno={(_, p) => onPestana(p)} />
            ))}
          </ul>
        </div>
      )}

      <div className="al-grid">
        <div className="card home-card">
          <div className="home-card-hd">
            <div className="home-card-ttl"><TrendingUp size={15} />{t('Este trimestre')}</div>
            <button className="home-link" onClick={() => onPestana('programa')}>{t('Programa')} <ArrowRight size={13} /></button>
          </div>
          {total === 0 || !ev ? (
            <>
              <p className="home-muted">{t('No tiene objetivos para el {n}º trimestre.', { n: T })}</p>
              <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => onPestana('programa')}>{t('Añádelos en su programa')}</button>
            </>
          ) : (
            <>
              <div className="al-progreso-gr">
                <span className="ap-barra" role="img" aria-label={ESTADOS.filter(e => ev.cuenta[e.id]).map(e => `${t(e.label)}: ${ev.cuenta[e.id]}`).join(', ')}>
                  {ESTADOS.filter(e => ev.cuenta[e.id]).map(e => (
                    <span key={e.id} className={`ap-barra-s ${e.id}`} style={{ flexGrow: ev.cuenta[e.id] }} />
                  ))}
                </span>
                <span className="ap-evol-n">{t('{a} de {b}', { a: ev.cuenta.si, b: total })}</span>
              </div>
              <ul className="al-objs">
                {ev.objetivos.map(o => (
                  <li key={o.objetivo.id}>
                    <span className={`ap-ley-c ${o.estado}`} aria-hidden="true" />
                    <span className="al-obj-txt">{o.objetivo.texto || t('Sin texto')}</span>
                    <span className={`al-estado ${o.estado}`}>{t(ESTADOS.find(e => e.id === o.estado)!.label)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="al-col">
          <div className="card home-card">
            <div className="home-card-hd"><div className="home-card-ttl"><Users size={15} />{t('Sus grupos de apoyo')}</div></div>
            {grupos.length === 0 ? (
              <>
                <p className="home-muted">{t('No está en ningún grupo de apoyo.')}</p>
                <button className="home-link" style={{ marginTop: 8 }} onClick={() => onPestana('datos')}>{t('Ponerlo en un grupo')} <ArrowRight size={13} /></button>
              </>
            ) : (
              <ul className="al-mini">
                {grupos.map(g => (
                  <li key={g.id}>
                    <span className="chip-dot" style={{ background: g.color }} aria-hidden="true" />
                    <span className="ap-lista-txt">
                      <strong>{g.nombre}</strong>
                      <span className="ap-sub ap-hora">
                        <Clock size={11} aria-hidden="true" />
                        {[...g.horario].sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio)).map(f => `${dia(f.dia)} ${f.inicio}`).join(' · ')}
                        {' · '}{t(g.modalidad === 'dentro' ? 'Dentro del aula' : 'Fuera del aula')}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card home-card">
            <div className="home-card-hd">
              <div className="home-card-ttl"><CalendarDays size={15} />{t('Últimas sesiones')}</div>
              <button className="home-link" onClick={() => onPestana('sesiones')}>{t('Sesiones')} <ArrowRight size={13} /></button>
            </div>
            {delTrimestre.length > 0 && (
              <p className="ap-sub" style={{ margin: '0 0 8px' }}>{t('Ha venido a {a} de {b} sesiones este trimestre.', { a: vino, b: delTrimestre.length })}</p>
            )}
            {sesiones.length === 0 ? (
              <p className="home-muted">{t('Todavía no hay nada registrado de este alumno.')}</p>
            ) : (
              <ul className="al-mini">
                {sesiones.slice(0, 3).map(({ sesion, grupo, registro }) => {
                  const logros = Object.values(registro.objetivos);
                  return (
                    <li key={sesion.id}>
                      <span className="chip-dot" style={{ background: grupo?.color ?? 'var(--border)' }} aria-hidden="true" />
                      <span className="ap-lista-txt">
                        <strong>{diaCorto(sesion.fecha)} · {grupo?.nombre ?? t('Grupo eliminado')}</strong>
                        <span className="ap-sub">
                          {registro.ausente
                            ? t('No vino')
                            : logros.length
                              ? (['si', 'proceso', 'no'] as const).filter(l => logros.includes(l)).map(l => `${l === 'si' ? '✓' : l === 'proceso' ? '–' : '✗'} ${logros.filter(x => x === l).length}`).join(' · ')
                              : registro.nota.trim() || t('Sin objetivos anotados')}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="card home-card">
            <div className="home-card-hd">
              <div className="home-card-ttl"><Handshake size={15} />{t('Última coordinación')}</div>
              <button className="home-link" onClick={() => onPestana('coordinaciones')}>{t('Coordinaciones')} <ArrowRight size={13} /></button>
            </div>
            {!ultimaCoord ? (
              <p className="home-muted">{t('Todavía no hay coordinaciones de este alumno.')}</p>
            ) : (
              <p className="al-coord">
                <strong>{ultimaCoord.fecha ? diaCorto(ultimaCoord.fecha) : t('Sin fecha')} · {t(CON_QUIEN[ultimaCoord.con])}.</strong>{' '}
                {ultimaCoord.acuerdos.trim() || ultimaCoord.temas.trim()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sesiones ── */

function Sesiones({ alumno, data, hoy, locale, onAbrir }: {
  alumno: AlumnoApoyo;
  data: ApoyoData;
  hoy: string;
  locale: string;
  onAbrir: (g: GrupoApoyo, fecha: string) => void;
}) {
  const { t } = useI18n();
  const [trimestre, setTrimestre] = useState<Trimestre>(trimestreDe(hoy));
  const lista = useMemo(() => sesionesDelAlumno(data, alumno.id, trimestre), [data, alumno.id, trimestre]);
  const textoObjetivo = useMemo(() => {
    const m = new Map<string, string>();
    data.programas.filter(p => p.alumnoId === alumno.id).forEach(p => p.objetivos.forEach(o => m.set(o.id, o.texto)));
    return m;
  }, [data.programas, alumno.id]);
  const vino = lista.filter(s => !s.registro.ausente).length;
  const fecha = (f: string) => {
    const s = fromIsoDate(f).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  };

  return (
    <div className="al-panel">
      <div className="al-barra">
        <div className="chip-row" role="group" aria-label={t('Trimestre')}>
          {([1, 2, 3] as const).map(n => (
            <button key={n} type="button" className={`chip sm accent${trimestre === n ? ' on' : ''}`} aria-pressed={trimestre === n} onClick={() => setTrimestre(n)}>
              {t('{n}º trimestre', { n })}
            </button>
          ))}
        </div>
        {lista.length > 0 && <span className="ap-sub">{t('Ha venido a {a} de {b} sesiones.', { a: vino, b: lista.length })}</span>}
      </div>

      {lista.length === 0 ? (
        <div className="card"><p className="ap-vacio">{t('No hay sesiones registradas de este alumno en el {n}º trimestre. Se anotan en el Registro diario.', { n: trimestre })}</p></div>
      ) : (
        <div className="card">
          <ul className="al-ses">
            {lista.map(({ sesion, grupo, registro }) => {
              const objetivos = Object.entries(registro.objetivos).filter(([id]) => textoObjetivo.has(id));
              const respuesta = ASPECTOS.filter(a => registro.respuesta[a]);
              const propuesta = sesion.adaptaciones?.[alumno.id]?.trim();
              return (
                <li key={sesion.id}>
                  <div className="al-ses-hd">
                    <span className="chip-dot" style={{ background: grupo?.color ?? 'var(--border)' }} aria-hidden="true" />
                    <strong>{fecha(sesion.fecha)}</strong>
                    <span className="ap-sub">{grupo?.nombre ?? t('Grupo eliminado')}</span>
                    {grupo && (
                      <button type="button" className="home-link al-ses-ir" onClick={() => onAbrir(grupo, sesion.fecha)}>
                        <Pencil size={12} />{t('Abrir en el registro')}
                      </button>
                    )}
                  </div>
                  {registro.ausente ? (
                    <p className="ap-sub al-ses-txt">{t('No vino')}</p>
                  ) : (
                    <>
                      {sesion.temaClase.trim() && <p className="ap-sub al-ses-txt">{t('Su clase trabajaba: {tema}', { tema: sesion.temaClase.trim() })}</p>}
                      {propuesta && <p className="al-ses-prop"><span className="ap-reg-sec">{t('Propuesta para hoy')}</span>{propuesta}</p>}
                      {objetivos.length > 0 && (
                        <ul className="al-ses-objs">
                          {objetivos.map(([id, logro]) => (
                            <li key={id}>
                              <span className={`al-logro ${logro}`} title={t(ESTADOS.find(e => e.id === logro)!.label)}
                                aria-label={t(ESTADOS.find(e => e.id === logro)!.label)}>{ICONO_LOGRO[logro]}</span>
                              <span>{textoObjetivo.get(id)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {respuesta.length > 0 && (
                        <p className="ap-meta al-ses-txt">
                          {respuesta.map(a => {
                            const c = CARAS.find(x => x.id === registro.respuesta[a])!;
                            return <span key={a} title={t(c.label)}>{t(ASPECTO_LABEL[a])} {c.cara}</span>;
                          })}
                        </p>
                      )}
                      {registro.nota.trim() && <p className="al-ses-nota">{registro.nota}</p>}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Datos ── */

function Datos({ alumno, data, onChange, onEditar, onNav }: {
  alumno: AlumnoApoyo;
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
  onEditar: () => void;
  onNav: (s: Section) => void;
}) {
  const { t } = useI18n();
  const nombreCurso = useNombreCurso();
  const filas: [string, string][] = [
    [t('Clase de origen'), alumno.claseOrigen],
    [t('Curso en que está matriculado'), alumno.matricula ? nombreCurso(alumno.matricula) : ''],
    [t('Nivel de competencia curricular'), alumno.nivel ? nombreCurso(alumno.nivel) : t('El de su curso')],
    [t('Necesidades específicas de apoyo educativo'), alumno.categorias.map(c => t(c)).join(', ')],
    [t('Diagnóstico'), alumno.diagnostico],
    [t('Necesidades educativas'), alumno.necesidades],
    [t('Notas'), alumno.notas],
  ];
  const alternar = (g: GrupoApoyo) => onChange(d => ({
    ...d,
    grupos: d.grupos.map(x => (x.id !== g.id ? x : {
      ...x, alumnos: x.alumnos.includes(alumno.id) ? x.alumnos.filter(id => id !== alumno.id) : [...x.alumnos, alumno.id],
    })),
  }));

  return (
    <div className="al-panel">
      <div className="card">
        <div className="card-hd">
          <div className="card-ttl">{t('Datos')}</div>
          <button className="btn-ghost" onClick={onEditar}><Pencil size={14} />{t('Editar')}</button>
        </div>
        <table className="ap-ficha al-datos"><tbody>
          {filas.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v.trim() || <span className="ap-sub">{t('Sin indicar')}</span>}</td></tr>)}
        </tbody></table>
      </div>

      <div className="card">
        <div className="card-hd"><div className="card-ttl">{t('Sus grupos de apoyo')}</div></div>
        {data.grupos.length === 0 ? (
          <>
            <p className="ap-vacio">{t('Todavía no hay grupos. Créalos en Mi alumnado, en la pestaña «Grupos».')}</p>
            <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => { requestGrupos(); onNav('apoyo-alumnado'); }}>{t('Ir a los grupos')}</button>
          </>
        ) : (
          <>
            <p className="ap-aviso" style={{ margin: '0 0 10px' }}>{t('Marca los grupos en los que está. Se guarda al momento.')}</p>
            <div className="chip-row">
              {data.grupos.map(g => {
                const on = g.alumnos.includes(alumno.id);
                return (
                  <button key={g.id} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on} onClick={() => alternar(g)}>
                    <span className="chip-dot" style={{ background: g.color }} aria-hidden="true" />{g.nombre}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
