import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, AlertTriangle, CalendarPlus } from 'lucide-react';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { useI18n } from '../i18n';
import { downloadFile } from '../lib/download';
import { CARPETAS } from '../lib/carpetas';
import { registrarCopia } from '../lib/avisoCopia';
import { isoDate } from '../lib/utils';
import {
  archivoDelCurso, conAvisosONotas, cursoSiguiente, lineasDelResumen, nombreAlSubir, nombresRepetidos, planDePartida, puedeSubir,
  resumenDeCursoNuevo, type DatosDelCurso, type Destino, type LineaDeResumen, type PlanDeCurso,
} from '../lib/cursoNuevo';

interface Props {
  open: boolean;
  /** `hecho`: si se cierra después de haber empezado el curso nuevo. */
  onClose: (hecho: boolean) => void;
  /** El curso escolar del perfil («2026-2027»), el que acaba. */
  curso: string;
  /** Todo el trabajo del perfil, tal como está ahora. */
  datos: DatosDelCurso;
  /** La copia descargable de siempre (la de «Descargar mis datos»). */
  onExportar: () => Record<string, unknown>;
  onEmpezar: (plan: PlanDeCurso, cursoNuevo: string) => Promise<void>;
}

const PASOS = ['Copia', 'Clases', 'Qué conservar', 'Resumen'] as const;
const DESTINOS: { id: Destino; texto: string }[] = [
  { id: 'sube', texto: 'Sube de curso' },
  { id: 'vacia', texto: 'Se queda vacía' },
  { id: 'se-va', texto: 'Se va' },
];

/** Una de las dos listas del resumen: cada cosa con su número. */
function Lista({ filas }: { filas: LineaDeResumen[] }) {
  const { t } = useI18n();
  return (
    <ul className="cn-lista">
      {filas.map(l => <li key={l.texto}><span>{t(l.texto)}</span><strong>{l.n}</strong></li>)}
    </ul>
  );
}

/**
 * El asistente «Empezar curso nuevo» (20-11-2026): la copia obligatoria del curso que acaba, qué pasa con cada
 * clase, qué se conserva y, antes de aplicar, el resumen de lo que se queda y lo que se borra. No decide nada:
 * toda la cuenta es de `lib/cursoNuevo.ts` y quien aplica es `startNewSchoolYear` (`hooks/useAppState.ts`).
 */
export function CursoNuevo({ open, onClose, curso, datos, onExportar, onEmpezar }: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [paso, setPaso] = useState(0);
  const [copiaHecha, setCopiaHecha] = useState(false);
  const [plan, setPlan] = useState<PlanDeCurso>(() => planDePartida(datos.classes));
  // El curso nuevo sale del que dice el perfil ahora (que se puede haber corregido con esta pantalla abierta),
  // mientras el docente no escriba otro
  const [cursoEscrito, setCursoEscrito] = useState<string | null>(null);
  const cursoNuevo = cursoEscrito ?? cursoSiguiente(curso);
  const [ocupado, setOcupado] = useState(false);
  /** Ya aplicado: la ventana solo dice qué hacer ahora, según lo que se eligió. */
  const [fin, setFin] = useState<{ curso: string; vacias: number; suben: number; clases: number; apoyo: number } | null>(null);
  const hecho = fin !== null;

  const cerrar = () => onClose(hecho);
  const archivo = archivoDelCurso(curso, isoDate());
  const alumnosDe = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of datos.students) m.set(s.class_id, (m.get(s.class_id) ?? 0) + 1);
    return m;
  }, [datos.students]);
  const resumen = useMemo(() => resumenDeCursoNuevo(datos, plan), [datos, plan]);
  const repetidos = useMemo(() => nombresRepetidos(datos.classes, plan), [datos.classes, plan]);
  const nombresDeAhora = useMemo(() => datos.classes.map(c => c.name), [datos.classes]);
  const destino = (id: string): Destino => plan.destinos[id] ?? 'vacia';
  const alguienConAvisos = datos.students.some(s => destino(s.class_id) === 'sube' && conAvisosONotas(s));

  function descargarCopia() {
    void downloadFile(new Blob([JSON.stringify(onExportar(), null, 2)], { type: 'application/json' }), archivo, CARPETAS.copias);
    registrarCopia();
    setCopiaHecha(true);
  }

  const poner = (id: string, d: Destino) => setPlan(p => ({ ...p, destinos: { ...p.destinos, [id]: d } }));
  const ponerATodas = (d: Destino) => setPlan(p => ({
    ...p, destinos: Object.fromEntries(datos.classes.map(c => [c.id, d === 'sube' && !puedeSubir(c) ? 'vacia' : d])),
  }));

  async function aplicar() {
    setOcupado(true);
    try {
      const elegido = cursoNuevo.trim();
      await onEmpezar(plan, elegido);
      setFin({
        curso: elegido,
        vacias: resumen.clases.vacias, suben: resumen.clases.suben,
        clases: resumen.clases.vacias + resumen.clases.suben, apoyo: resumen.conserva.alumnadoDeApoyo,
      });
      toast(t('✅ Curso nuevo empezado'));
    } catch {
      toast(t('No se ha podido empezar el curso nuevo. No se ha cambiado nada.'));
    }
    setOcupado(false);
  }

  const lineas = lineasDelResumen(resumen, plan);

  return (
    <Modal open={open} onClose={cerrar} wide stickyHeader title={<span className="cn-titulo"><CalendarPlus size={17} />{t('Empezar curso nuevo')}</span>}>
      {hecho ? (
        <div className="cn-hecho">
          <p className="cn-hecho-ttl"><Check size={18} />{fin.curso ? t('Ya estás en el curso {curso}.', { curso: fin.curso }) : t('Ya estás en el curso nuevo.')}</p>
          {fin.clases + fin.apoyo > 0 && (
            <>
              <p className="cn-texto">{t(fin.clases > 0 ? 'Lo que te queda por hacer, cuando tengas las listas:' : 'Lo que te queda por hacer:')}</p>
              <ul className="cn-pendiente">
                {fin.vacias > 0 && <li>{t('En «Mis clases», entra en cada clase vacía y pega su listado con «Importar CSV».')}</li>}
                {fin.clases > 0 && <li>{t('Si te falta algún grupo, créalo en «Nueva clase»; con «Crear varios grupos» salen todos de una vez.')}</li>}
                {fin.suben > 0 && <li>{t('Repasa en «Mis clases» las asignaturas de las clases que han subido de curso, por si alguna cambia.')}</li>}
                {fin.apoyo > 0 && <li>{t('En «Mi alumnado», repasa el curso y la clase de cada alumno o alumna de apoyo en su ficha: siguen como estaban.')}</li>}
              </ul>
            </>
          )}
          <p className="cn-texto">{t('El curso anterior está en el archivo que has descargado y en las copias de seguridad de «Mis datos».')}</p>
          <div className="cn-pie"><span /><button type="button" className="btn-accent" onClick={cerrar}>{t('Cerrar')}</button></div>
        </div>
      ) : (
        <>
          <ol className="cn-pasos" aria-label={t('Pasos')}>
            {PASOS.map((p, i) => (
              <li key={p} className={i === paso ? 'on' : i < paso ? 'hecho' : ''} aria-current={i === paso ? 'step' : undefined}>
                <span className="cn-paso-n">{i < paso ? <Check size={11} /> : i + 1}</span>{t(p)}
              </li>
            ))}
          </ol>

          {/* 1. La copia del curso que acaba, obligatoria */}
          {paso === 0 && (
            <div>
              <h3 className="cn-ttl">{t('Primero, guarda el curso que acaba')}</h3>
              <p className="cn-texto">
                {t('Empezar un curso nuevo borra las notas, las evaluaciones, la asistencia y las anotaciones de este. Por eso antes tienes que descargar una copia con todo, que es la que te permitirá consultarlo o volver atrás: se carga desde «Cargar desde archivo», en esta misma pantalla.')}
              </p>
              <button type="button" className="btn-accent" onClick={descargarCopia}>
                <Download size={14} />{curso.trim() ? t('Descargar la copia del curso {curso}', { curso: curso.trim() }) : t('Descargar la copia del curso')}
              </button>
              {copiaHecha && (
                <p className="cn-ok"><Check size={14} />{t('Copia descargada: {archivo}. Guárdala donde no se pierda.', { archivo })}</p>
              )}
              <p className="cn-nota">{t('Además, justo antes de aplicar el cambio AulaPro guarda otra copia automática en este dispositivo, entre las de «Mis datos».')}</p>
            </div>
          )}

          {/* 2. Qué pasa con cada clase */}
          {paso === 1 && (
            <div>
              <h3 className="cn-ttl">{t('¿Qué pasa con cada clase?')}</h3>
              {datos.classes.length === 0 ? (
                <p className="cn-texto">{t('No tienes clases en «Mis clases»: aquí no hay nada que elegir.')}</p>
              ) : (
                <>
                  <p className="cn-texto">
                    <strong>{t('Sube de curso')}</strong>: {t('el grupo sigue contigo y pasa al curso siguiente, con su alumnado y sus asignaturas.')}{' '}
                    <strong>{t('Se queda vacía')}</strong>: {t('la clase sigue igual, sin alumnado, para el grupo nuevo de ese curso.')}{' '}
                    <strong>{t('Se va')}</strong>: {t('ya no le darás clase y se borra.')}
                  </p>
                  {datos.classes.length > 1 && (
                    <div className="cn-todas">
                      <span>{t('Poner a todas:')}</span>
                      {DESTINOS.map(d => (
                        <button key={d.id} type="button" className="btn-ghost sm" onClick={() => ponerATodas(d.id)}>{t(d.texto)}</button>
                      ))}
                    </div>
                  )}
                  <ul className="cn-clases">
                    {datos.classes.map(c => {
                      const d = destino(c.id);
                      const n = alumnosDe.get(c.id) ?? 0;
                      const cambiaDeEtapa = c.etapa === 'primaria' && (c.curso ?? 0) >= 6;
                      return (
                        <li key={c.id} className={`cn-clase ${d}`}>
                          <div className="cn-clase-cab">
                            <span className="chip-dot" style={{ background: c.color }} />
                            <span className="cn-clase-nombre">{c.name}</span>
                            <span className="cn-clase-n">{t('Alumnado: {n}', { n })}</span>
                          </div>
                          <div className="chip-row" role="radiogroup" aria-label={t('Qué pasa con {clase}', { clase: c.name })}>
                            {DESTINOS.map(x => {
                              const no = x.id === 'sube' && !puedeSubir(c);
                              return (
                                <button
                                  key={x.id} type="button" role="radio" aria-checked={d === x.id} disabled={no}
                                  title={no ? t('Después de 4.º de ESO no hay un curso al que subir en AulaPro.') : undefined}
                                  className={`chip sm accent${d === x.id ? ' on' : ''}`} onClick={() => poner(c.id, x.id)}
                                >
                                  {d === x.id && <Check size={12} />}{t(x.texto)}
                                </button>
                              );
                            })}
                          </div>
                          {d === 'sube' && (
                            <div className="cn-clase-queda">
                              <label htmlFor={`cn-nombre-${c.id}`}>{t('Se llamará')}</label>
                              <input
                                id={`cn-nombre-${c.id}`} className="finput" value={plan.nombres[c.id] ?? nombreAlSubir(c, nombresDeAhora)}
                                onChange={e => setPlan(p => ({ ...p, nombres: { ...p.nombres, [c.id]: e.target.value } }))}
                              />
                              {cambiaDeEtapa && <span className="cn-clase-aviso">{t('Pasa de Primaria a ESO: después tendrás que marcar sus asignaturas en «Editar clase».')}</span>}
                            </div>
                          )}
                          {d === 'vacia' && n > 0 && <p className="cn-clase-dice">{t('Su alumnado de ahora sale de tu perfil. Queda en la copia.')}</p>}
                          {d === 'se-va' && <p className="cn-clase-dice">{t('Se borra con su alumnado. Queda en la copia.')}</p>}
                        </li>
                      );
                    })}
                  </ul>
                  {repetidos.length > 0 && (
                    <p className="cn-aviso"><AlertTriangle size={14} />{t('Quedarían dos clases con el mismo nombre: {nombres}. Cambia el nombre de la que sube o di qué pasa con la otra.', { nombres: repetidos.join(', ') })}</p>
                  )}
                  {alguienConAvisos && (
                    <label className="cn-casilla">
                      <input type="checkbox" checked={plan.conservarAvisos} onChange={e => setPlan(p => ({ ...p, conservarAvisos: e.target.checked }))} />
                      <span>
                        <strong>{t('Conservar los avisos y las notas de la ficha del alumnado que sigue')}</strong>
                        <small>{t('Pasan de un curso a otro tal como están. Desmárcala si prefieres empezar sin ellos; después conviene repasar si siguen valiendo.')}</small>
                      </span>
                    </label>
                  )}
                </>
              )}
            </div>
          )}

          {/* 3. Qué se conserva */}
          {paso === 2 && (
            <div>
              <h3 className="cn-ttl">{t('¿Qué conservas para el curso nuevo?')}</h3>
              {/* Solo se pregunta por lo que hay */}
              {datos.blocks.length > 0 && (
                <label className="cn-casilla">
                  <input type="checkbox" checked={plan.conservarHorario} onChange={e => setPlan(p => ({ ...p, conservarHorario: e.target.checked }))} />
                  <span>
                    <strong>{t('El horario')}</strong>
                    <small>{t('Los bloques de las clases que siguen, para retocarlos en vez de escribirlos de nuevo. Desmárcala si tu horario cambia entero.')}</small>
                  </span>
                </label>
              )}
              {datos.gradeCategories.length > 0 && (
                <label className="cn-casilla">
                  <input type="checkbox" checked={plan.conservarCuaderno} onChange={e => setPlan(p => ({ ...p, conservarCuaderno: e.target.checked }))} />
                  <span>
                    <strong>{t('Las categorías y los pesos del cuaderno')}</strong>
                    <small>{t('Cada clase que sigue empieza con sus categorías, sus porcentajes y su bloque de trabajo diario y actitud, sin ninguna nota.')}</small>
                  </span>
                </label>
              )}
              <p className="cn-nota">
                {t('Siempre se conservan tus rúbricas, dianas y escalas, con las clases que siguen; y tus situaciones de aprendizaje, fichas y sesiones, que se quedan en la clase que el curso nuevo tenga en su mismo curso o, si no hay ninguna, sin clase. Las reuniones y formaciones no se tocan.')}
              </p>
              <div className="fgroup" style={{ maxWidth: 260, marginTop: 16 }}>
                <label className="flabel" htmlFor="cn-curso">{t('Curso escolar nuevo')}</label>
                <input id="cn-curso" className="finput" value={cursoNuevo} maxLength={20} placeholder="2027-2028" onChange={e => setCursoEscrito(e.target.value)} />
              </div>
            </div>
          )}

          {/* 4. El resumen, antes de aplicar */}
          {paso === 3 && (
            <div>
              <h3 className="cn-ttl">{t('Esto es lo que va a pasar')}</h3>
              <div className="cn-resumen">
                <section className="conserva">
                  <h4>{t('Se conserva')}</h4>
                  {lineas.conserva.length ? <Lista filas={lineas.conserva} /> : <p className="cn-nota">{t('Nada: el perfil está vacío.')}</p>}
                </section>
                <section className="borra">
                  <h4>{t('Se borra de AulaPro')}</h4>
                  {lineas.borra.length ? <Lista filas={lineas.borra} /> : <p className="cn-nota">{t('Nada.')}</p>}
                  <p className="cn-nota">{t('Todo esto queda en la copia que has descargado.')}</p>
                </section>
              </div>
              {resumen.sinClase.situaciones + resumen.sinClase.fichas + resumen.sinClase.sesiones + resumen.sinClase.instrumentos > 0 && (
                <p className="cn-nota">
                  {t('Siguen en su biblioteca, pero sin clase: situaciones de aprendizaje, {sda}; fichas, {fichas}; sesiones, {sesiones}; rúbricas, dianas y escalas, {instrumentos}. Podrás unirlas a una clase cuando quieras.', {
                    sda: resumen.sinClase.situaciones, fichas: resumen.sinClase.fichas, sesiones: resumen.sinClase.sesiones, instrumentos: resumen.sinClase.instrumentos,
                  })}
                </p>
              )}
              {repetidos.length > 0 && (
                <p className="cn-aviso"><AlertTriangle size={14} />{t('Quedarían dos clases con el mismo nombre: {nombres}. Cambia el nombre de la que sube o di qué pasa con la otra.', { nombres: repetidos.join(', ') })}</p>
              )}
            </div>
          )}

          <div className="cn-pie">
            {paso > 0
              ? <button type="button" className="btn-ghost" onClick={() => setPaso(paso - 1)} disabled={ocupado}><ArrowLeft size={14} />{t('Atrás')}</button>
              : <button type="button" className="btn-ghost" onClick={cerrar}>{t('Cancelar')}</button>}
            {paso < PASOS.length - 1 ? (
              <button type="button" className="btn-accent" onClick={() => setPaso(paso + 1)} disabled={paso === 0 && !copiaHecha}>
                {t('Siguiente')}<ArrowRight size={14} />
              </button>
            ) : (
              <button type="button" className="btn-accent cn-aplicar" onClick={aplicar} disabled={ocupado || !copiaHecha}>
                {ocupado ? <><span className="spin" />&nbsp;{t('Guardando…')}</> : cursoNuevo.trim() ? t('Empezar el curso {curso}', { curso: cursoNuevo.trim() }) : t('Empezar curso nuevo')}
              </button>
            )}
          </div>
          {paso === 0 && !copiaHecha && <p className="cn-nota" style={{ textAlign: 'right' }}>{t('Descarga la copia para poder seguir.')}</p>}
        </>
      )}
    </Modal>
  );
}
