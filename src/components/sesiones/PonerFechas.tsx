/**
 * «Poner fechas» y «No se dio» (20-11-2026): la ventana que enseña, antes de cambiar nada, en qué día cae cada
 * sesión y por qué se salta cada día. La cuenta está en `lib/repartoSesiones.ts`; aquí se elige el primer día, las
 * horas del horario en que se dan (si la clase tiene varias asignaturas) y los días que no hay clase y el
 * calendario no sabe (un festivo local, una excursión). Sin IA y sin que nada salga del dispositivo.
 */
import { useContext, useMemo, useState } from 'react';
import { CalendarDays, Check, Undo2, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useI18n, weekdayLabel } from '../../i18n';
import { useCalendarioEscolar } from '../../hooks/useCalendarioEscolar';
import { ClaseActivaContexto } from '../../hooks/useClaseActiva';
import { tieneCalendario, type EtapaCalendario } from '../../lib/calendarioEscolar';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import {
  asignaturasDeClase, asignaturasPropuestas, bloquesDe, correrDesde, finDelCursoDe, franjasDeLaSemana, motivoNoLectivo,
  recordarReparto, repartir, repartoRecordado, resumirSaltos, type FechaPropuesta, type TramoSaltado,
} from '../../lib/repartoSesiones';
import { fromIsoDate, isoDate } from '../../lib/utils';
import type { CalEvent, Class, ScheduleBlock } from '../../types';
import type { SesionEF } from '../../types/ef';

/** Lo que se quiere fechar: un grupo entero («Poner fechas») o desde una sesión que no se dio. */
export interface PeticionDeFechas {
  modo: 'poner' | 'correr';
  /** El nombre del grupo: la situación de aprendizaje o «Sin situación de aprendizaje». */
  grupo: string;
  /** Clase y situación de aprendizaje, para recordar en el dispositivo lo que se eligió la última vez. */
  clave: string;
  claseId?: string;
  /** Las sesiones del grupo, en su orden. */
  sesiones: SesionEF[];
  /** «No se dio»: la sesión que no se dio. */
  desdeId?: string;
  /** Para proponer la asignatura: las áreas de la situación de aprendizaje, «Educación Física»… */
  pistas: string[];
}

interface Props {
  peticion: PeticionDeFechas | null;
  classes: Class[];
  bloques: ScheduleBlock[];
  /** Los eventos de la Agenda: si uno cae en un día propuesto, se avisa. */
  eventos?: CalEvent[];
  comunidad?: ComunidadId;
  /** Solo las sesiones que cambian de día. */
  onAplicar: (propuestas: FechaPropuesta[]) => void;
  onClose: () => void;
}

export function PonerFechas({ peticion, onClose, ...resto }: Props) {
  const { t } = useI18n();
  const noDada = peticion?.modo === 'correr' ? peticion.sesiones.find(s => s.id === peticion.desdeId) : undefined;
  const titulo = !peticion ? '' : peticion.modo === 'poner'
    ? t('Poner fechas a «{grupo}»', { grupo: peticion.grupo })
    : t('No se dio «{sesion}»', { sesion: noDada?.titulo || t('Sin título') });
  return (
    <Modal open={!!peticion} onClose={onClose} wide title={titulo}>
      {peticion && <Contenido key={`${peticion.modo}|${peticion.clave}|${peticion.desdeId ?? ''}`} peticion={peticion} onClose={onClose} {...resto} />}
    </Modal>
  );
}

function Contenido({ peticion, classes, bloques, eventos = [], comunidad: comunidadDada, onAplicar, onClose }: Props & { peticion: PeticionDeFechas }) {
  const { t, locale } = useI18n();
  const ctx = useContext(ClaseActivaContexto);
  const comunidad = comunidadDada ?? ctx?.comunidad;
  const provincia = ctx?.provincia;
  const archivo = useCalendarioEscolar();
  const { modo, sesiones, claseId, desdeId } = peticion;
  const clase = classes.find(c => c.id === claseId);

  const asignaturas = useMemo(() => asignaturasDeClase(bloques, claseId), [bloques, claseId]);
  const [recordado] = useState(() => repartoRecordado(peticion.clave));
  const [elegidas, setElegidas] = useState<string[]>(() => {
    const deAntes = (recordado.asignaturas ?? []).filter(a => asignaturas.includes(a));
    return deAntes.length ? deAntes : asignaturasPropuestas(asignaturas, peticion.pistas);
  });
  const [cadaDias, setCadaDias] = useState(recordado.cadaDias ?? 2);
  const [desde, setDesde] = useState(() => isoDate());
  const [quitados, setQuitados] = useState<Set<string>>(() => new Set());

  const conHorario = asignaturas.length > 0;
  const faltaElegir = conHorario && elegidas.length === 0;
  const noDada = sesiones.find(s => s.id === desdeId);
  const pendientes = sesiones.filter(s => !s.completada);
  const hechas = sesiones.length - pendientes.length;

  const reparto = useMemo(() => {
    if (faltaElegir) return null;
    const etapas: EtapaCalendario[] = clase?.etapa === 'primaria' || clase?.etapa === 'eso' ? [clase.etapa] : ['primaria', 'eso'];
    const primerDia = modo === 'poner' ? desde : (noDada?.fecha ?? desde);
    const donde = {
      bloques: bloquesDe(bloques, claseId, elegidas), cadaDias,
      noLectivo: motivoNoLectivo(archivo, comunidad, provincia, etapas), quitados, hasta: finDelCursoDe(primerDia),
    };
    return modo === 'poner' ? repartir(sesiones, donde, desde) : correrDesde(sesiones, desdeId ?? '', donde);
  }, [faltaElegir, clase, modo, desde, noDada, bloques, claseId, elegidas, cadaDias, archivo, comunidad, provincia, quitados, sesiones, desdeId]);

  const cambian = (reparto?.propuestas ?? []).filter(p => p.fecha !== p.antes);
  const dia = (iso: string) => fromIsoDate(iso).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const numero = (id: string) => sesiones.findIndex(s => s.id === id) + 1;
  const tituloDe = (id: string) => sesiones.find(s => s.id === id)?.titulo || t('Sin título');
  /** Lo que la Agenda tiene ese día para esta clase o para todas: un examen, una excursión. */
  const eventosDe = (iso: string) => eventos.filter(e => e.date === iso && (!e.classId || e.classId === claseId)).map(e => e.name);

  const semana = franjasDeLaSemana(bloquesDe(bloques, claseId, elegidas))
    .map(d => `${weekdayLabel(d.dia - 1, locale).toLowerCase()} ${d.franjas.map(f => f.hora).join(' y ')}`);

  const quitar = (iso: string) => setQuitados(prev => new Set(prev).add(iso));
  const reponer = (iso: string) => setQuitados(prev => { const n = new Set(prev); n.delete(iso); return n; });

  function porque(tramo: TramoSaltado): string {
    const m = tramo.motivo;
    const motivo = m.tipo === 'quitado' ? t('lo has quitado tú')
      : m.tipo === 'fuera-de-curso' ? t('fuera de los días de clase del curso')
      : t(m.nombre);
    return tramo.dias === 1
      ? t('Se salta el {dia}: {motivo}', { dia: dia(tramo.desde), motivo })
      : t('Se salta del {desde} al {hasta} ({n} clases): {motivo}', { desde: dia(tramo.desde), hasta: dia(tramo.hasta), n: tramo.dias, motivo });
  }

  function aplicar() {
    recordarReparto(peticion.clave, { ...(conHorario ? { asignaturas: elegidas } : {}), cadaDias });
    onAplicar(cambian);
  }

  return (
    <div className="pf">
      <p className="pf-intro">
        {modo === 'poner'
          ? t('Elige el primer día y AulaPro reparte las sesiones pendientes, en su orden, en las horas de esta clase en tu horario. Nada cambia hasta que pulses «Poner estas fechas».')
          : t('Esta sesión pasa a la clase siguiente y las que vienen detrás se corren solo si se pisan con ella. Nada cambia hasta que pulses «Correr las fechas».')}
      </p>

      <div className="pf-opciones">
        {modo === 'poner' && (
          <div className="fgroup">
            <label className="flabel" htmlFor="pf-desde">{t('Primer día')}</label>
            <input id="pf-desde" type="date" className="finput" value={desde} onChange={e => e.target.value && setDesde(e.target.value)} />
          </div>
        )}
        {conHorario && asignaturas.length > 1 && (
          <div className="fgroup pf-asignaturas" role="group" aria-label={t('En qué horas das estas sesiones')}>
            <span className="flabel">{t('En qué horas das estas sesiones')}</span>
            <div className="pf-chips">
              {asignaturas.map(a => {
                const on = elegidas.includes(a);
                return (
                  <button key={a} type="button" className={`pf-chip${on ? ' on' : ''}`} aria-pressed={on}
                    onClick={() => setElegidas(prev => (on ? prev.filter(x => x !== a) : [...prev, a]))}>
                    {on && <Check size={13} aria-hidden="true" />}{a}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {!conHorario && (
          <div className="fgroup">
            <label className="flabel" htmlFor="pf-cada">{t('Una sesión cada cuántos días lectivos')}</label>
            <input id="pf-cada" type="number" min={1} max={10} className="finput pf-cada" value={cadaDias}
              onChange={e => setCadaDias(Math.max(1, Math.min(10, Math.round(Number(e.target.value) || 1))))} />
          </div>
        )}
      </div>

      {conHorario
        ? semana.length > 0 && <p className="pf-nota"><CalendarDays size={14} aria-hidden="true" />{t('En tu horario: {dias}.', { dias: semana.join(', ') })}</p>
        : <p className="pf-nota">{t(clase
          ? 'Esta clase no tiene horas en tu horario semanal (Agenda › Horario), así que se cuenta en días lectivos, de lunes a viernes.'
          : 'Estas sesiones no tienen clase, así que se cuenta en días lectivos, de lunes a viernes.')}</p>}
      {!tieneCalendario(archivo, comunidad, provincia) && (
        <p className="pf-nota">{t('AulaPro no tiene el calendario escolar de tu comunidad: no sabe qué días son festivos. Quita a mano, con la X, los días sin clase.')}</p>
      )}

      {faltaElegir ? (
        <p className="pf-vacio">{t('Esta clase tiene varias asignaturas en el horario. Marca arriba en cuáles das estas sesiones y verás en qué día cae cada una.')}</p>
      ) : (
        <>
          {modo === 'poner' && hechas > 0 && (
            <p className="pf-nota">{t(hechas === 1 ? '{n} sesión ya completada conserva su día.' : '{n} sesiones ya completadas conservan su día.', { n: hechas })}</p>
          )}
          <ol className="pf-lista" aria-label={t('El día de cada sesión')}>
            {(reparto?.propuestas ?? []).map(p => {
              const tramos = resumirSaltos(p.saltos);
              const coincide = eventosDe(p.fecha);
              const igual = p.antes === p.fecha;
              return (
                <li key={p.id} className="pf-item">
                  {tramos.map(tr => (
                    <div key={tr.desde + tr.motivo.tipo} className={`pf-salto${tr.motivo.tipo === 'quitado' ? ' quitado' : ''}`}>
                      <span>{porque(tr)}</span>
                      {tr.motivo.tipo === 'quitado' && p.saltos.filter(s => s.motivo.tipo === 'quitado' && s.fecha >= tr.desde && s.fecha <= tr.hasta).map(s => (
                        <button key={s.fecha} type="button" className="pf-reponer" onClick={() => reponer(s.fecha)}>
                          <Undo2 size={13} aria-hidden="true" />{t('Volver a poner el {dia}', { dia: dia(s.fecha) })}
                        </button>
                      ))}
                    </div>
                  ))}
                  <div className={`pf-fila${igual ? ' igual' : ''}`}>
                    <span className="pf-num" aria-hidden="true">{numero(p.id)}</span>
                    <span className="pf-titulo">
                      <strong>{tituloDe(p.id)}</strong>
                      {coincide.length > 0 && <span className="pf-coincide">{t('Ese día tienes en la Agenda: {eventos}', { eventos: coincide.join(', ') })}</span>}
                    </span>
                    <span className="pf-fecha">
                      <strong>{dia(p.fecha)}{p.hora ? ` · ${p.hora}` : ''}</strong>
                      {p.antes && !igual && <span className="pf-antes">{t('antes, {dia}', { dia: dia(p.antes) })}</span>}
                      {igual && <span className="pf-antes">{t('como estaba')}</span>}
                    </span>
                    <button type="button" className="pf-quitar" onClick={() => quitar(p.fecha)}
                      title={t('Ese día no hay clase: saltarlo')} aria-label={t('El {dia} no hay clase: saltarlo', { dia: dia(p.fecha) })}>
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          {reparto && reparto.propuestas.length === 0 && reparto.sinHueco.length === 0 && (
            <p className="pf-vacio">{t(modo === 'poner' ? 'No queda ninguna sesión pendiente a la que poner fecha.' : 'No hay nada que correr.')}</p>
          )}
          {reparto && reparto.sinHueco.length > 0 && (
            <p className="pf-aviso" role="status">
              {t(reparto.sinHueco.length === 1
                ? 'No queda hueco antes de que acabe el curso para {n} sesión: se queda como estaba ({cuales}).'
                : 'No queda hueco antes de que acabe el curso para {n} sesiones: se quedan como estaban ({cuales}).',
              { n: reparto.sinHueco.length, cuales: reparto.sinHueco.map(tituloDe).join(', ') })}
            </p>
          )}
          {modo === 'correr' && reparto && reparto.propuestas.length > 0 && (
            <p className="pf-nota">{t('Las demás sesiones se quedan como están.')}</p>
          )}
        </>
      )}

      <div className="pf-pie">
        <button type="button" className="btn-ghost" onClick={onClose}>{t('Cancelar')}</button>
        <button type="button" className="btn-accent" disabled={cambian.length === 0} onClick={aplicar}>
          <CalendarDays size={15} aria-hidden="true" />
          {modo === 'poner' ? t('Poner estas fechas') : t('Correr las fechas')}
        </button>
      </div>
    </div>
  );
}
