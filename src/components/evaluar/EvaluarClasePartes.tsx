/**
 * Las piezas comunes de «Evaluar a la clase» (20-11-2026) en las ventanas de la rúbrica y de la diana: la
 * lista del alumnado con quién está hecho y «Poner a todos este nivel», la cabecera (la clase, que se elige
 * una vez, o la evaluación que se corrige), el aviso de qué pasará al guardar y el pie con «Guardar y
 * siguiente». El estado lo lleva `hooks/useEvaluarClase.ts`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronRight, ClipboardCheck, Users } from 'lucide-react';
import type { AchievementLevel } from '../../types';
import { levelColor } from '../../types';
import { useI18n } from '../../i18n';
import { fromIsoDate } from '../../lib/utils';
import type { EvaluarClase } from '../../hooks/useEvaluarClase';
import { usePhoneScreen } from '../../hooks/useNarrowScreen';

function useFechaCorta() {
  const { locale } = useI18n();
  return (iso: string) => fromIsoDate(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** La lista del alumnado, en orden de lista, con quién está hecho; en pantallas estrechas, una tira que se desliza. */
export function ListaDeClase({ clase, niveles }: { clase: EvaluarClase; niveles: AchievementLevel[] }) {
  const { t, locale } = useI18n();
  const fecha = useFechaCorta();
  const lista = useRef<HTMLOListElement>(null);
  const { filas, studentId, hechos, sinGuardar } = clase;
  // En el móvil «Poner a todos este nivel» va plegado en una línea: la pantalla es para la rúbrica
  const movil = usePhoneScreen();
  const [desplegado, setDesplegado] = useState(false);
  const todosAbierto = !movil || desplegado || clase.nivelDeTodos !== null;

  // El alumno elegido, a la vista: al pasar al siguiente la lista lo sigue
  useEffect(() => {
    lista.current?.querySelector('[aria-current="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [studentId]);

  const nota = (g: number | undefined) => (typeof g === 'number' ? g.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '');

  return (
    <aside className="evc-lista" aria-label={t('Alumnado de la clase')}>
      <div className="evc-cuenta" aria-live="polite">
        <span><strong>{t('{hechos} de {total}', { hechos, total: filas.length })}</strong> {t('evaluados')}</span>
        {sinGuardar.length > 0 && <span className="evc-cuenta-sin">{t('{n} sin guardar', { n: sinGuardar.length })}</span>}
      </div>
      <div className="evc-barra" aria-hidden="true"><span style={{ width: `${filas.length ? (hechos / filas.length) * 100 : 0}%` }} /></div>

      {filas.length === 0 ? (
        <p className="evc-vacio">{t('Esa clase todavía no tiene alumnos.')}</p>
      ) : (
        <ol className="evc-alumnos" ref={lista}>
          {filas.map(f => {
            const cual = f.sinGuardar ? 'sin' : f.estado;
            const dato = f.sinGuardar ? t('sin guardar')
              : f.estado === 'hoy' ? nota(f.ultima?.grade)
              : f.estado === 'antes' && f.ultima ? fecha(f.ultima.date) : '';
            const leido = f.sinGuardar ? t('con niveles marcados sin guardar')
              : f.estado === 'hoy' ? t('evaluado hoy')
              : f.estado === 'antes' && f.ultima ? t('evaluado el {fecha}', { fecha: fecha(f.ultima.date) }) : t('sin evaluar');
            return (
              <li key={f.id}>
                <button type="button" className={`evc-al evc-${cual}${f.id === studentId ? ' sel' : ''}`}
                  aria-current={f.id === studentId ? 'true' : undefined} aria-label={`${f.name}, ${leido}`}
                  onClick={() => clase.elegirAlumno(f.id)}>
                  <span className="evc-marca" aria-hidden="true">{(f.estado !== 'pendiente' && !f.sinGuardar) && <Check size={12} strokeWidth={3} />}</span>
                  <span className="evc-nombre">{f.name}</span>
                  {dato && <span className="evc-dato">{dato}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {(clase.paraTodos > 0 || clase.nivelDeTodos !== null) && (
        <div className="evc-todos">
          {movil ? (
            <button type="button" className="evc-todos-t evc-todos-plegar" aria-expanded={todosAbierto} onClick={() => setDesplegado(d => !d)}>
              <Users size={13} aria-hidden="true" /> {t('Poner a todos este nivel')}
              <ChevronDown size={14} aria-hidden="true" style={{ transform: todosAbierto ? 'rotate(180deg)' : undefined }} />
            </button>
          ) : (
            <div className="evc-todos-t"><Users size={13} aria-hidden="true" /> {t('Poner a todos este nivel')}</div>
          )}
          {todosAbierto && <>
          <div className="evc-niveles" role="group" aria-label={t('Poner a todos este nivel')}>
            {niveles.map(lv => {
              const puesto = clase.nivelDeTodos === lv.value;
              const color = levelColor(lv.value, niveles.length);
              return (
                <button key={lv.value} type="button" className={`evc-nivel${puesto ? ' on' : ''}`} aria-pressed={puesto}
                  title={t(lv.label)} aria-label={t('Poner a todos el nivel {nivel}: {nombre}', { nivel: lv.value, nombre: t(lv.label) })}
                  style={{ borderColor: color, color: puesto ? 'white' : color, background: puesto ? color : undefined }}
                  onClick={() => clase.ponerATodos(lv.value)}>
                  {lv.value}
                </button>
              );
            })}
          </div>
          <p className="evc-todos-a">
            {clase.nivelDeTodos === null
              ? t(clase.paraTodos === 1
                ? 'Marca ese nivel en todo a {n} alumno que falta. Después cambias solo las excepciones; no se guarda nada hasta que pulses Guardar.'
                : 'Marca ese nivel en todo a los {n} alumnos que faltan. Después cambias solo las excepciones; no se guarda nada hasta que pulses Guardar.', { n: clase.paraTodos })
              : t('Puesto como punto de partida. Toca a quien sea una excepción, cambia lo suyo y pulsa «Guardar todo».')}
          </p>
          {clase.nivelDeTodos !== null && <button type="button" className="evc-enlace" onClick={clase.quitarDeTodos}>{t('Quitar el nivel puesto a todos')}</button>}
          </>}
        </div>
      )}
    </aside>
  );
}

/** Arriba: la clase, que se elige una vez, o la evaluación que se está corrigiendo. */
export function CabeceraDeEvaluarClase({ clase, asignatura, idSelect }: {
  clase: EvaluarClase; asignatura: (c: { id: string; subject: string }) => string; idSelect: string;
}) {
  const { t, locale } = useI18n();
  const { corrigiendo, evalClasses, classId } = clase;
  if (corrigiendo) {
    const suya = evalClasses.find(c => c.id === corrigiendo.class_id);
    return (
      <p className="evc-corrigiendo">
        {t('Corrigiendo la evaluación de')} <strong>{corrigiendo.student_name}</strong>
        {suya ? ` · ${suya.name}` : ''} · {fromIsoDate(corrigiendo.date).toLocaleDateString(locale)}
      </p>
    );
  }
  const unica = evalClasses.length === 1 && evalClasses[0].id === classId ? evalClasses[0] : undefined;
  return (
    <div className="evc-clase">
      <label className="flabel" htmlFor={idSelect}>{t('Clase')}</label>
      {unica ? (
        <span className="evc-clase-unica" id={idSelect}>{unica.name} – {asignatura(unica)}</span>
      ) : (
        <select id={idSelect} className="finput" value={classId} onChange={e => clase.cambiarClase(e.target.value)}>
          {!classId && <option value="">{t('Selecciona clase...')}</option>}
          {evalClasses.map(c => <option key={c.id} value={c.id}>{c.name} – {asignatura(c)}</option>)}
        </select>
      )}
    </div>
  );
}

/** A quién se está evaluando y qué pasará al guardar: evaluación nueva, corrección de la de hoy o de otro día. */
export function AlumnoQueSeEvalua({ clase }: { clase: EvaluarClase }) {
  const { t } = useI18n();
  const fecha = useFechaCorta();
  const { alumno, corrige, ultima, hoy, corrigiendo, esOtroTrabajo, filas } = clase;

  if (corrigiendo) {
    return <p className="evc-aviso">{t('Al guardar se actualiza esta evaluación, no se crea otra.')}</p>;
  }
  if (!alumno) {
    return (
      <p className="evc-elige">
        {filas.length === 0 ? t('Esa clase todavía no tiene alumnos.')
          : clase.hechos === filas.length ? t('Toda la clase está evaluada. Toca un alumno de la lista para ver o corregir su evaluación.')
          : t('Toca un alumno de la lista para evaluarlo.')}
      </p>
    );
  }
  const n = filas.findIndex(f => f.id === alumno.id) + 1;
  return (
    <div className="evc-quien">
      <div className="evc-quien-n">
        <strong>{alumno.name}</strong>
        {n > 0 && <span>{t('{n} de {total} en la lista', { n, total: filas.length })}</span>}
      </div>
      {esOtroTrabajo ? (
        <p className="evc-aviso">
          {t('Evaluación nueva: se guardará además de la que ya tiene de hoy.')}{' '}
          <button type="button" className="evc-enlace" onClick={clase.volver}>{t('Volver a la de hoy')}</button>
        </p>
      ) : corrige && corrige.date === hoy ? (
        <p className="evc-aviso">
          {t('Ya lo has evaluado hoy: lo que cambies corrige esa evaluación.')}{' '}
          <button type="button" className="evc-enlace" onClick={clase.otroTrabajo}>{t('Es otro trabajo')}</button>
        </p>
      ) : corrige ? (
        <p className="evc-aviso">
          {t('Estás corrigiendo su evaluación del {fecha}.', { fecha: fecha(corrige.date) })}{' '}
          <button type="button" className="evc-enlace" onClick={clase.volver}>{t('No corregirla')}</button>
        </p>
      ) : ultima ? (
        <p className="evc-aviso">
          {t('Ya tiene una evaluación del {fecha}. Lo que guardes ahora será una evaluación nueva.', { fecha: fecha(ultima.date) })}{' '}
          <button type="button" className="evc-enlace" onClick={clase.corregirAnterior}>{t('Corregir la del {fecha}', { fecha: fecha(ultima.date) })}</button>
        </p>
      ) : null}
    </div>
  );
}

/** Abajo, siempre a la vista: lo que lleva el alumno (a la izquierda) y «Guardar y siguiente». */
export function PieDeEvaluarClase({ clase, alGuardar, children }: {
  clase: EvaluarClase;
  /** Tras guardar y pasar al siguiente: la ventana vuelve arriba. */
  alGuardar?: () => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const { enClase, hayQueGuardar, siguienteId, sinGuardar, studentId } = clase;
  const otros = sinGuardar.some(id => id !== studentId);
  const seguir = () => { if (clase.guardarYSeguir()) alGuardar?.(); };
  return (
    <div className="evc-pie">
      <div className="evc-pie-dato">{children}</div>
      <div className="evc-pie-btns">
        <button type="button" className="btn-ghost" onClick={clase.cerrar}>{t(enClase ? 'Cerrar' : 'Cancelar')}</button>
        {enClase && otros && (
          <button type="button" className="btn-ghost evc-guardar-todo" onClick={() => clase.guardarTodos()}>
            <ClipboardCheck size={14} />{t('Guardar todo ({n})', { n: sinGuardar.length })}
          </button>
        )}
        {!enClase ? (
          <button type="button" className="btn-accent" disabled={!hayQueGuardar} onClick={seguir}>
            <ClipboardCheck size={14} />{t('Guardar cambios')}
          </button>
        ) : hayQueGuardar ? (
          <button type="button" className="btn-accent" onClick={seguir}>
            <ClipboardCheck size={14} />{siguienteId ? t('Guardar y siguiente') : t(clase.corrige ? 'Guardar cambios' : 'Guardar evaluación')}
          </button>
        ) : (
          <button type="button" className="btn-accent" disabled={!siguienteId || !studentId} onClick={seguir}>
            {t('Siguiente')}<ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
