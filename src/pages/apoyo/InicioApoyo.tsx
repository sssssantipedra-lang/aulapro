/**
 * El Inicio del profesorado de PT y AL (decisión del dueño, 5-10-2026): las
 * sesiones de hoy, los avisos de seguimiento y la evolución de cada alumno en
 * el trimestre. Sin alumnado todavía, los primeros pasos. La lógica está en
 * `lib/inicioApoyo.ts`; ver `docs/PTAL.md`.
 */
import { useMemo, useState } from 'react';
import {
  CalendarDays, AlertTriangle, TrendingUp, ArrowRight, Check, Clock, Coffee, ChevronDown, Sparkles,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { isoDate, fromIsoDate, nombreDePila } from '../../lib/utils';
import { trimestreDe } from '../../lib/apoyo';
import { requestAlumno, requestRegistro, type PestanaAlumno } from '../../lib/apoyoNav';
import { avisosApoyo, evolucionDelTrimestre, sesionesDeHoy, type EstadoObjetivo } from '../../lib/inicioApoyo';
import type { AlumnoApoyo, ApoyoData, GrupoApoyo } from '../../types/apoyo';
import { GraficaObjetivo } from '../../components/apoyo/GraficaObjetivo';
import { AvisoFila } from '../../components/apoyo/AvisoFila';
import type { Section } from '../../types';

interface Props {
  nombre: string;
  data: ApoyoData;
  onNav: (s: Section) => void;
  onLoadDemo: () => void;
}

const ESTADOS: { id: EstadoObjetivo; label: string }[] = [
  { id: 'si', label: 'Conseguido' },
  { id: 'proceso', label: 'En proceso' },
  { id: 'no', label: 'No conseguido' },
  { id: 'sin', label: 'Sin trabajar' },
];

/** Cuántos avisos se ven antes de «Ver todos». */
const AVISOS_VISIBLES = 5;

export function InicioApoyo({ nombre, data, onNav, onLoadDemo }: Props) {
  const { t, locale } = useI18n();
  const [now] = useState(() => new Date());
  const hoy = isoDate(now);
  const T = trimestreDe(hoy);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [todosAvisos, setTodosAvisos] = useState(false);

  const greeting = t(now.getHours() < 13 ? 'Buenos días' : now.getHours() < 20 ? 'Buenas tardes' : 'Buenas noches');
  const firstName = nombre.split(' ')[0] ?? '';
  const rawDate = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const dateLabel = rawDate.charAt(0).toLocaleUpperCase(locale) + rawDate.slice(1);

  const deHoy = useMemo(() => sesionesDeHoy(data, hoy), [data, hoy]);
  const avisos = useMemo(() => avisosApoyo(data, hoy), [data, hoy]);
  const evolucion = useMemo(() => evolucionDelTrimestre(data, T), [data, T]);

  const registrar = (grupo: GrupoApoyo, fecha: string) => {
    requestRegistro({ grupoId: grupo.id, fecha });
    onNav('apoyo-registro');
  };
  const abrirAlumno = (a: AlumnoApoyo, pestana: PestanaAlumno = 'resumen') => {
    requestAlumno(a.id, pestana);
    onNav('apoyo-alumno');
  };
  const diaCorto = (fecha: string) => {
    const s = fromIsoDate(fecha).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  };

  if (data.alumnos.length === 0) {
    const pasos: { titulo: string; texto: string; ir: Section; boton: string }[] = [
      { titulo: 'Tu alumnado y tus grupos', texto: 'Añade a cada alumno con su clase, sus necesidades y su nivel, y agrúpalos con su horario de apoyo.', ir: 'apoyo-alumnado', boton: 'Ir a Mi alumnado' },
      { titulo: 'Sus programas', texto: 'Pulsa un alumno para abrir su página. En «Programa», sus objetivos por trimestre; la IA te puede proponer unos para revisar.', ir: 'apoyo-alumnado', boton: 'Ir a Mi alumnado' },
      { titulo: 'El registro de cada sesión', texto: 'En la sesión, cómo va cada objetivo y cómo ha respondido, con un toque. Con eso salen la evolución, los avisos y los informes.', ir: 'apoyo-registro', boton: 'Ir al Registro diario' },
    ];
    return (
      <section className="sec active home ap-page">
        <div className="home-hd">
          <h1 className="pg-title">{greeting}, {firstName}</h1>
          <p className="pg-sub">{dateLabel} · {t('{n}º trimestre', { n: T })}</p>
        </div>
        <div className="card home-card">
          <div className="home-card-ttl" style={{ marginBottom: 6 }}><Sparkles size={15} />{t('Empieza en tres pasos')}</div>
          <ol className="ap-pasos">
            {pasos.map((p, i) => (
              <li key={p.titulo}>
                <span className="ap-pasos-n">{i + 1}</span>
                <span className="ap-lista-txt">
                  <strong>{t(p.titulo)}</strong>
                  <span className="ap-meta">{t(p.texto)}</span>
                  <button className="home-link" onClick={() => onNav(p.ir)}>{t(p.boton)} <ArrowRight size={13} /></button>
                </span>
              </li>
            ))}
          </ol>
          <button type="button" className="btn-ghost" style={{ marginTop: 16 }} onClick={onLoadDemo}>
            <Sparkles size={14} />{t('Probar con datos de ejemplo')}
          </button>
        </div>
      </section>
    );
  }

  const pendientesHoy = deHoy.filter(s => !s.registrada).length;
  const summary = [
    t(deHoy.length === 1 ? '{n} sesión hoy' : '{n} sesiones hoy', { n: deHoy.length }),
    ...(avisos.length ? [t(avisos.length === 1 ? '{n} aviso' : '{n} avisos', { n: avisos.length })] : []),
  ];
  const avisosVisibles = todosAvisos ? avisos : avisos.slice(0, AVISOS_VISIBLES);

  return (
    <section className="sec active home ap-page">
      <div className="home-hd">
        <h1 className="pg-title">{greeting}, {firstName}</h1>
        <p className="pg-sub">{dateLabel} · {t('{n}º trimestre', { n: T })} · {summary.join(' · ')}</p>
      </div>

      <div className="home-grid">
        {/* ── Sesiones de hoy ── */}
        <div className="card home-card">
          <div className="home-card-hd">
            <div className="home-card-ttl"><CalendarDays size={15} />{t('Sesiones de hoy')}</div>
            {pendientesHoy > 0 && <span className="home-pill warn">{t('{n} sin registrar', { n: pendientesHoy })}</span>}
          </div>
          {deHoy.length === 0 ? (
            <div className="home-now-empty">
              <span className="home-now-empty-ico"><Coffee size={20} /></span>
              <p className="home-muted">{t(data.grupos.some(g => g.horario.length) ? 'Hoy no tienes sesiones de apoyo según tu horario.' : 'Pon el horario de tus grupos en Mi alumnado, en la pestaña «Grupos», y aquí verás las sesiones de cada día.')}</p>
            </div>
          ) : (
            <ul className="ap-lista">
              {deHoy.map(({ grupo, franjas, registrada }) => (
                <li key={grupo.id}>
                  <span className="home-tl-bar" style={{ background: grupo.color }} />
                  <span className="ap-lista-txt">
                    <strong>{grupo.nombre}</strong>
                    <span className="ap-meta">
                      <span className="ap-hora"><Clock size={12} />{franjas.map(f => `${f.inicio}–${f.fin}`).join(' · ')}</span>
                      <span>{grupo.especialidad} · {t(grupo.modalidad === 'dentro' ? 'Dentro del aula' : 'Fuera del aula')}</span>
                    </span>
                    <span className="ap-sub">
                      {grupo.alumnos.map(id => data.alumnos.find(a => a.id === id)?.nombre).filter((n): n is string => !!n).map(nombreDePila).join(', ')}
                    </span>
                  </span>
                  {registrada ? (
                    <button className="btn-ghost ap-hecho" onClick={() => registrar(grupo, hoy)}><Check size={14} />{t('Registrada')}</button>
                  ) : (
                    <button className="btn-accent" onClick={() => registrar(grupo, hoy)}>{t('Registrar')}</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button className="home-link" style={{ marginTop: 12 }} onClick={() => onNav('agenda')}>{t('Ver la semana')} <ArrowRight size={13} /></button>
        </div>

        {/* ── Avisos de seguimiento ── */}
        <div className="card home-card">
          <div className="home-card-hd">
            <div className="home-card-ttl"><AlertTriangle size={15} />{t('Avisos de seguimiento')}</div>
          </div>
          {avisos.length === 0 ? (
            <p className="home-muted">{t('Todo al día: sesiones registradas y objetivos en marcha.')}</p>
          ) : (
            <ul className="ap-lista">
              {avisosVisibles.map((a, i) => <AvisoFila key={i} aviso={a} diaCorto={diaCorto} onRegistrar={registrar} onAlumno={abrirAlumno} />)}
            </ul>
          )}
          {avisos.length > AVISOS_VISIBLES && (
            <button className="home-link" style={{ marginTop: 12 }} onClick={() => setTodosAvisos(v => !v)}>
              {todosAvisos ? t('Ver menos') : t('Ver los {n} avisos', { n: avisos.length })}
            </button>
          )}
        </div>
      </div>

      {/* ── Evolución del alumnado ── */}
      <div className="card home-card" style={{ marginTop: 16 }}>
        <div className="home-card-hd">
          <div className="home-card-ttl"><TrendingUp size={15} />{t('Evolución del alumnado')}</div>
          <button className="home-link" onClick={() => onNav('apoyo-alumnado')}>{t('Mi alumnado')}</button>
        </div>
        <p className="ap-sub" style={{ marginBottom: 10 }}>
          {t('Sus objetivos del {n}º trimestre, según lo último que registraste de cada uno.', { n: T })}
        </p>
        <ul className="ap-ley" aria-hidden="true">
          {ESTADOS.map(e => <li key={e.id}><span className={`ap-ley-c ${e.id}`} />{t(e.label)}</li>)}
        </ul>
        <ul className="ap-evol">
          {evolucion.map(ev => {
            const total = ev.objetivos.length;
            const open = abierto === ev.alumno.id;
            const resumen = ESTADOS.filter(e => ev.cuenta[e.id]).map(e => `${t(e.label)}: ${ev.cuenta[e.id]}`).join(', ');
            return (
              <li key={ev.alumno.id}>
                {/* Sin objetivos este trimestre no hay nada que desplegar: lleva a su programa */}
                <button
                  type="button" className={`ap-evol-fila${total === 0 ? ' vacia' : ''}`} aria-expanded={total === 0 ? undefined : open}
                  onClick={() => (total === 0 ? abrirAlumno(ev.alumno, 'programa') : setAbierto(open ? null : ev.alumno.id))}
                >
                  <span className="ap-evol-nom">
                    <strong>{ev.alumno.nombre}</strong>
                    <span className="ap-sub">{ev.alumno.claseOrigen}{ev.alumno.claseOrigen ? ' · ' : ''}{t(ev.sesiones === 1 ? '{n} sesión' : '{n} sesiones', { n: ev.sesiones })}</span>
                  </span>
                  {total === 0 ? (
                    <span className="home-muted">{t('Sin objetivos este trimestre')} <ArrowRight size={13} /></span>
                  ) : (
                    <>
                      <span className="ap-barra" role="img" aria-label={`${ev.alumno.nombre}. ${resumen}`}>
                        {ESTADOS.filter(e => ev.cuenta[e.id]).map(e => (
                          <span key={e.id} className={`ap-barra-s ${e.id}`} style={{ flexGrow: ev.cuenta[e.id] }} />
                        ))}
                      </span>
                      <span className="ap-evol-n">{t('{a} de {b}', { a: ev.cuenta.si, b: total })}</span>
                      <ChevronDown size={15} className="ap-evol-chev" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
                    </>
                  )}
                </button>
                {open && (
                  <>
                    <ul className="ap-evol-objs">
                      {ev.objetivos.map(o => (
                        <li key={o.objetivo.id}>
                          <span className="ap-reg-obj">{o.objetivo.texto}</span>
                          {o.puntos.length === 0
                            ? <span className="ap-sub">{t('Sin trabajar')}</span>
                            : <GraficaObjetivo puntos={o.puntos} />}
                        </li>
                      ))}
                    </ul>
                    <button className="home-link ap-evol-ir" onClick={() => abrirAlumno(ev.alumno)}>
                      {t('Abrir la página de {name}', { name: nombreDePila(ev.alumno.nombre) })} <ArrowRight size={13} />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
