/**
 * Inicio: «qué toca ahora».
 *
 * Desde el 11-10-2026 («Tu jornada», elegido por el dueño): arriba, el día
 * como una línea de tiempo —el de hoy o, si hoy ya no queda clase, el
 * próximo día lectivo— con cuatro atajos (pasar lista, añadir nota, evaluar
 * y nueva tarea); debajo, tres columnas (tareas, eventos y alumnado con
 * avisos) y las clases en minitarjetas con su media. «Primeros pasos» sale
 * plegado en una línea.
 *
 * Antes era un tablero de cifras con varias tarjetas del mismo peso que
 * rotaban solas. Ahora hay una jerarquía clara: arriba, la clase de ahora (o
 * la siguiente) con los botones de lo que se hace en ella —pasar lista,
 * anotar, cuaderno— y el resto del día al lado; debajo, lo pendiente y lo que
 * pide atención, quieto y en listas cortas.
 */
import { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays, AlertTriangle, CheckSquare2, Plus, ArrowRight, UserCheck, Flag, BookOpen,
  TrendingUp, Clock, Bandage, Timer, ClipboardList, ClipboardCheck, ListPlus, Hand,
} from 'lucide-react';
import type { User, Task, ScheduleBlock, CalEvent, Student, Class, Evaluation,
  GradeCategory, GradeItem, GradeMap, AttendanceMap, Section } from '../types';
import { useI18n, priorityLabel, weekdayLabel } from '../i18n';
import { isoDate, fromIsoDate } from '../lib/utils';
import { FirstSteps } from '../components/dashboard/FirstSteps';
import { firstSteps } from '../lib/firstSteps';
import { hasApiKey } from '../services/gemini';
import { isMarksCategory } from '../services/classMarks';
import { weightedAverage } from '../services/aiContext';
import { agruparPorEtapa } from '../lib/etapas';

interface Props {
  user: User | null;
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  tasks: Task[];
  scheduleBlocks: ScheduleBlock[];
  calEvents: CalEvent[];
  students: Student[];
  classes: Class[];
  evaluations: Evaluation[];
  attendance: AttendanceMap;
  onNav: (s: string) => void;
  onAddTask: () => void;
  onToggleTask: (id: string) => void;
  onLoadDemo: () => void;
  /**
   * Educación Física sin tutoría: el mismo Inicio, con lo de EF (decisión del
   * dueño, 5-10-2026). Con tutoría no se pasa y queda el de tutoría tal cual.
   */
  ef?: {
    exentosHoy: { id: string; nombre: string; clase: string; detalle: string; tarea: string }[];
    pruebas: { id: string; clase: string; color: string; fecha?: string; prueba?: string }[];
    /** Las próximas sesiones de EF, de hoy en adelante. */
    sesiones: { id: string; titulo: string; clase: string; color: string; fecha: string }[];
  };
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function gradeColor(n: number | null): string {
  if (n === null) return 'var(--text-3)';
  if (n < 5) return 'var(--grade-bad)';
  if (n < 7) return 'var(--grade-mid)';
  return 'var(--grade-good)';
}

export function Dashboard({ user, tasks, scheduleBlocks, calEvents, students, classes,
  gradeCategories, gradeItems, grades, attendance, onNav, onAddTask, onToggleTask, onLoadDemo, ef }: Props) {
  const { t, locale, lang } = useI18n();

  // La hora manda en «ahora / siguiente»: se refresca cada medio minuto
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const greeting = t(now.getHours() < 13 ? 'Buenos días' : now.getHours() < 20 ? 'Buenas tardes' : 'Buenas noches');
  const firstName = user?.full_name.split(' ')[0] ?? '';
  // Solo la primera letra en mayúscula: «Martes, 29 de septiembre», no «29 De Septiembre»
  const rawDate = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const dateLabel = rawDate.charAt(0).toLocaleUpperCase(locale) + rawDate.slice(1);

  const todayDay = now.getDay() === 0 ? 7 : now.getDay();
  const nowHm = hhmm(now);
  const todayBlocks = useMemo(
    () => scheduleBlocks.filter(b => b.day === todayDay).sort((a, b) => a.time_start.localeCompare(b.time_start)),
    [scheduleBlocks, todayDay],
  );
  const current = todayBlocks.find(b => b.time_start <= nowHm && nowHm < b.time_end) ?? null;
  const next = todayBlocks.find(b => b.time_start > nowHm) ?? null;
  const focus = current ?? next;

  /**
   * El día que se enseña: hoy, mientras quede alguna clase; si no, el próximo
   * día con horario (el lunes, un domingo), a cuántos días está y sus clases.
   */
  const jornada = ((): { offset: number; blocks: ScheduleBlock[] } => {
    if (focus) return { offset: 0, blocks: todayBlocks };
    for (let k = 1; k <= 7; k++) {
      const day = ((todayDay - 1 + k) % 7) + 1;
      const blocks = scheduleBlocks.filter(b => b.day === day).sort((a, b) => a.time_start.localeCompare(b.time_start));
      if (blocks.length) return { offset: k, blocks };
    }
    return { offset: 0, blocks: [] };
  })();
  const jornadaDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + jornada.offset);
  const jornadaDia = jornadaDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric' });

  const pendingTasks = tasks.filter(tk => !tk.done);
  const alerts = students.filter(s => s.alerts.length > 0);
  const upcomingEvents = [...calEvents]
    .filter(ev => ev.date >= isoDate(now))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));

  /** Media de cada clase (todas sus asignaturas), para ver de un vistazo cómo va. */
  const classAverages = useMemo(() => classes.map(c => {
    const cats = gradeCategories.filter(g => g.class_id === c.id);
    const items = gradeItems.filter(i => i.class_id === c.id);
    const avgs = students
      .filter(s => s.class_id === c.id)
      .map(s => weightedAverage(s.id, cats, items, grades))
      .filter((v): v is number => v !== null);
    const failing = avgs.filter(v => v < 5).length;
    return { cls: c, avg: avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null, failing, count: avgs.length };
  }), [classes, gradeCategories, gradeItems, grades, students]);

  const steps = firstSteps({
    classes, students, scheduleBlocks, attendance, hasAi: hasApiKey(),
    // Solo las categorías del docente, no el bloque automático de anotaciones
    gradeCategories: gradeCategories.filter(c => !isMarksCategory(c.id)),
  });
  const nav = (s: Section) => onNav(s);

  if (classes.length === 0) {
    return (
      <section className="sec active home">
        <div className="home-hd">
          <h1 className="pg-title">{greeting}, {firstName}</h1>
          <p className="pg-sub">{dateLabel}</p>
        </div>
        <FirstSteps steps={steps} hero profileId={user?.id ?? ''} onNav={nav} onLoadDemo={onLoadDemo} />
      </section>
    );
  }

  const summary = [
    t(todayBlocks.length === 1 ? '{n} clase hoy' : '{n} clases hoy', { n: todayBlocks.length }),
    t(pendingTasks.length === 1 ? '{n} tarea pendiente' : '{n} tareas pendientes', { n: pendingTasks.length }),
    ...(alerts.length ? [t(alerts.length === 1 ? '{n} alumno con avisos' : '{n} alumnos con avisos', { n: alerts.length })] : []),
  ];

  return (
    <section className="sec active home">
      <div className="home-hd">
        <h1 className="pg-title">{greeting}, {firstName}</h1>
        <p className="pg-sub">{dateLabel} · {summary.join(' · ')}</p>
      </div>

      <FirstSteps steps={steps} hero={false} profileId={user?.id ?? ''} onNav={nav} onLoadDemo={onLoadDemo} />

      {/* ── Tu jornada: el día en una línea de tiempo y los atajos ── */}
      <div className="card home-jornada">
        <div className="home-j-hd">
          {focus ? (
            <span className={`home-now-tag${current ? ' live' : ''}`}>
              {current ? <><span className="home-dot" />{t('Ahora')}</> : <><Clock size={12} />{t('Siguiente, a las {h}', { h: focus.time_start })}</>}
            </span>
          ) : (
            <span className="home-now-tag">
              {t(!scheduleBlocks.length ? 'Sin horario' : todayBlocks.length ? 'Has terminado las clases de hoy' : 'Hoy no tienes clases')}
            </span>
          )}
          {jornada.blocks.length > 0 && (
            <h2 className="home-j-ttl">
              {jornada.offset === 0
                ? t('Tu jornada de hoy')
                : `${t(jornada.offset === 1 ? 'Mañana' : 'Próximo día lectivo')} · ${jornadaDia}`}
            </h2>
          )}
          <button className="home-link home-j-week" onClick={() => nav('agenda')}>{t('Ver la semana')} <ArrowRight size={13} /></button>
        </div>

        {jornada.blocks.length === 0 ? (
          <p className="home-muted home-j-empty">
            {t('Añade tu horario en la Agenda y aquí verás siempre la clase que toca.')}{' '}
            <button className="home-link" onClick={() => nav('agenda')}>{t('Ir a la Agenda')} <ArrowRight size={13} /></button>
          </p>
        ) : (
          <ol className="home-j-line">
            {jornada.blocks.map(b => {
              const state = jornada.offset > 0 ? 'later' : b === current ? 'now' : b.time_end <= nowHm ? 'past' : 'later';
              return (
                <li key={b.id} className={`home-j-item ${state}`} style={{ '--j-c': b.color } as React.CSSProperties}>
                  <span className="home-j-time">{b.time_start}</span>
                  <span className="home-j-subj">{b.subject}</span>
                  {b.room && <span className="home-j-room">{b.room}</span>}
                </li>
              );
            })}
          </ol>
        )}

        {/* Los atajos de lo que más se hace (elegidos por el dueño) */}
        <div className="home-quick">
          <button type="button" className="home-q" style={{ '--q-c': '#0ea5e9' } as React.CSSProperties} onClick={() => nav('attendance')}>
            <span className="home-q-ico"><UserCheck size={17} /></span>{t('Pasar lista')}
          </button>
          {/* En EF se anota en la pista (el último atajo) */}
          {!ef && (
            <button type="button" className="home-q" style={{ '--q-c': '#ec4899' } as React.CSSProperties} onClick={() => nav('actitud')}>
              <span className="home-q-ico"><Hand size={17} /></span>{t('Anotar actitud')}
            </button>
          )}
          <button type="button" className="home-q" style={{ '--q-c': '#10b981' } as React.CSSProperties} onClick={() => nav('notebook')}>
            <span className="home-q-ico"><BookOpen size={17} /></span>{t('Añadir nota')}
          </button>
          <button type="button" className="home-q" style={{ '--q-c': '#f59e0b' } as React.CSSProperties} onClick={() => nav('evaluar')}>
            <span className="home-q-ico"><ClipboardCheck size={17} /></span>{t('Evaluar')}
          </button>
          <button type="button" className="home-q" style={{ '--q-c': '#8b5cf6' } as React.CSSProperties} onClick={onAddTask}>
            <span className="home-q-ico"><ListPlus size={17} /></span>{t('Nueva tarea')}
          </button>
          {ef && (
            <button type="button" className="home-q" style={{ '--q-c': '#65a30d' } as React.CSSProperties} onClick={() => nav('ef-pista')}>
              <span className="home-q-ico"><Flag size={17} /></span>{t('Observar en la pista')}
            </button>
          )}
        </div>
      </div>

      {/* ── Lo demás, quieto y en listas cortas: tres columnas ── */}
      <div className="home-grid tres">
        <div className="card home-card">
          <div className="home-card-hd">
            <div className="home-card-ttl"><CheckSquare2 size={15} />{t('Tareas')}</div>
            <button className="home-link" onClick={onAddTask}><Plus size={13} />{t('Añadir')}</button>
          </div>
          {pendingTasks.length === 0 ? (
            <p className="home-muted">{t(tasks.length ? 'Todo hecho. ¡Bien!' : 'Apunta aquí tus recordatorios: corregir, preparar material…')}</p>
          ) : (
            <ul className="home-list">
              {pendingTasks.slice(0, 5).map(tk => (
                <li key={tk.id} className="home-task">
                  <input type="checkbox" checked={tk.done} onChange={() => onToggleTask(tk.id)} aria-label={tk.text} />
                  <span className="home-task-txt">{tk.text}</span>
                  {tk.priority === 'high' && <span className="home-pill warn">{priorityLabel(tk.priority, lang)}</span>}
                </li>
              ))}
              {pendingTasks.length > 5 && <li className="home-muted">{t('y {n} más', { n: pendingTasks.length - 5 })}</li>}
            </ul>
          )}
        </div>

        <div className="card home-card">
          <div className="home-card-hd">
            <div className="home-card-ttl"><CalendarDays size={15} />{t('Próximos eventos')}</div>
            <button className="home-link" onClick={() => nav('agenda')}>{t('Ver todo')}</button>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="home-muted">{t('Sin eventos próximos. Añádelos desde la Agenda.')}</p>
          ) : (
            <ul className="home-list">
              {upcomingEvents.slice(0, 4).map(ev => {
                const d = fromIsoDate(ev.date);
                return (
                  <li key={ev.id} className="home-event">
                    <span className="home-date">
                      <b>{d.getDate()}</b>
                      <small>{weekdayLabel((d.getDay() + 6) % 7, locale, 'short')}</small>
                    </span>
                    <span className="home-event-txt">
                      <span className="home-event-name">{ev.name}</span>
                      {ev.time && <span className="home-tl-room">{ev.time}</span>}
                    </span>
                    {ev.urgency === 'alta' && <span className="home-pill warn">{t('Urgente')}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card home-card">
          <div className="home-card-hd">
            <div className="home-card-ttl"><AlertTriangle size={15} />{t('Necesitan atención')}</div>
            <button className="home-link" onClick={() => nav('classes')}>{t('Ver alumnado')}</button>
          </div>
          {alerts.length === 0 ? (
            <p className="home-muted">{t('Ningún alumno tiene avisos activos.')}</p>
          ) : (
            <ul className="home-list">
              {alerts.slice(0, 4).map(s => (
                <li key={s.id} className="home-alert">
                  <span className={`home-alert-dot ${s.alerts[0]?.level ?? 'info'}`} />
                  <span className="home-event-txt">
                    <span className="home-event-name">{s.name}</span>
                    <span className="home-tl-room">{s.alerts[0]?.text}</span>
                  </span>
                </li>
              ))}
              {alerts.length > 4 && <li className="home-muted">{t('y {n} más', { n: alerts.length - 4 })}</li>}
            </ul>
          )}
        </div>

        {ef && (
          <div className="card home-card">
            <div className="home-card-hd">
              <div className="home-card-ttl"><Bandage size={15} />{t('Exentos y lesiones')}</div>
              <button className="home-link" onClick={() => nav('ef-exentos')}>{t('Ver todo')}</button>
            </div>
            {ef.exentosHoy.length === 0 ? (
              <p className="home-muted">{t('Hoy todo tu alumnado puede hacer la clase.')}</p>
            ) : (
              <ul className="home-list">
                {ef.exentosHoy.slice(0, 4).map(x => (
                  <li key={x.id} className="home-alert">
                    <span className="home-alert-dot warn" />
                    <span className="home-event-txt">
                      <span className="home-event-name">{x.nombre} · {x.clase}</span>
                      <span className="home-tl-room">{x.detalle}{x.tarea ? ` · ${x.tarea}` : ''}</span>
                    </span>
                  </li>
                ))}
                {ef.exentosHoy.length > 4 && <li className="home-muted">{t('y {n} más', { n: ef.exentosHoy.length - 4 })}</li>}
              </ul>
            )}
          </div>
        )}

        {ef && (
          <div className="card home-card">
            <div className="home-card-hd">
              <div className="home-card-ttl"><ClipboardList size={15} />{t('Próximas sesiones')}</div>
              <button className="home-link" onClick={() => nav('ef-sesiones')}>{ef.sesiones.length ? t('Ver todo') : t('Preparar')}</button>
            </div>
            {ef.sesiones.length === 0 ? (
              <p className="home-muted">{t('No tienes sesiones previstas.')}</p>
            ) : (
              <ul className="home-list">
                {ef.sesiones.slice(0, 3).map(s => (
                  <li key={s.id} className="home-event">
                    <span className="home-class-dot" style={{ background: s.color }} />
                    <span className="home-event-txt">
                      <span className="home-event-name">{s.titulo}</span>
                      <span className="home-tl-room">{[s.clase, fromIsoDate(s.fecha).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {ef && (
          <div className="card home-card">
            <div className="home-card-hd">
              <div className="home-card-ttl"><Timer size={15} />{t('Pruebas físicas')}</div>
              <button className="home-link" onClick={() => nav('ef-pruebas')}>{t('Anotar')}</button>
            </div>
            <ul className="home-list">
              {ef.pruebas.map(p => (
                <li key={p.id} className="home-event">
                  <span className="home-class-dot" style={{ background: p.color }} />
                  <span className="home-event-txt">
                    <span className="home-event-name">{p.clase}</span>
                    <span className="home-tl-room">{p.fecha
                      ? t('Última toma: {prueba}, {fecha}', { prueba: p.prueba ?? '', fecha: fromIsoDate(p.fecha).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })
                      : t('Todavía sin pruebas')}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>

      {/* ── Cómo van tus clases: una minitarjeta por clase con su media ── */}
      <div className="card home-card home-classes">
        <div className="home-card-hd">
          <div className="home-card-ttl"><TrendingUp size={15} />{t('Cómo van tus clases')}</div>
          <button className="home-link" onClick={() => nav('notebook')}>{t('Cuaderno')}</button>
        </div>
        <div className="home-cls-grid">
          {agruparPorEtapa(classAverages.map(a => ({ ...a, name: a.cls.name, etapa: a.cls.etapa, curso: a.cls.curso })))
            .flatMap(g => g.clases)
            .map(({ cls, avg, failing, count }) => (
              <button key={cls.id} type="button" className="home-cls" style={{ '--j-c': cls.color } as React.CSSProperties} onClick={() => nav('notebook')}>
                <span className="home-cls-name">{cls.name}</span>
                <span className="home-cls-avg" style={{ color: gradeColor(avg) }}>
                  {avg === null ? '—' : avg.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
                {/* Solo lo que pide atención: «todos aprueban» en cada tarjeta era ruido */}
                {(count === 0 || failing > 0) && (
                  <span className={`home-cls-sub${failing ? ' warn' : ''}`}>
                    {count === 0 ? t('sin notas') : t('{n} por debajo de 5', { n: failing })}
                  </span>
                )}
              </button>
            ))}
        </div>
      </div>
    </section>
  );
}
