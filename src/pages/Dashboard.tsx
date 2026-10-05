/**
 * Inicio: «qué toca ahora».
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
  TrendingUp, Coffee, Clock, Bandage,
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
  ef?: { exentosHoy: { id: string; nombre: string; clase: string; detalle: string; tarea: string }[] };
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

      {/* ── Ahora ── */}
      <div className="card home-now">
        <div className="home-now-main">
          {focus ? (
            <>
              <span className={`home-now-tag${current ? ' live' : ''}`}>
                {current ? <><span className="home-dot" />{t('Ahora')}</> : <><Clock size={12} />{t('Siguiente, a las {h}', { h: focus.time_start })}</>}
              </span>
              <h2 className="home-now-ttl">{focus.subject}</h2>
              <p className="home-now-meta">
                {focus.time_start}–{focus.time_end}{focus.room ? ` · ${focus.room}` : ''}
              </p>
              <div className="home-now-actions">
                <button className="btn-accent" onClick={() => nav('attendance')}><UserCheck size={15} />{t('Pasar lista')}</button>
                {ef
                  ? <button className="btn-ghost" onClick={() => nav('ef-pista')}><Flag size={15} />{t('Observar en la pista')}</button>
                  : <button className="btn-ghost" onClick={() => nav('seating')}><Flag size={15} />{t('Anotar en el aula')}</button>}
                <button className="btn-ghost" onClick={() => nav('notebook')}><BookOpen size={15} />{t('Cuaderno')}</button>
              </div>
            </>
          ) : (
            <div className="home-now-empty">
              <span className="home-now-empty-ico"><Coffee size={20} /></span>
              <div>
                <h2 className="home-now-ttl">
                  {t(todayBlocks.length ? 'Has terminado las clases de hoy' : 'Hoy no tienes clases')}
                </h2>
                <p className="home-now-meta">
                  {t(scheduleBlocks.length ? 'Buen momento para poner notas o preparar lo de mañana.' : 'Añade tu horario en la Agenda y aquí verás siempre la clase que toca.')}
                </p>
                <div className="home-now-actions">
                  <button className="btn-ghost" onClick={() => nav(scheduleBlocks.length ? 'notebook' : 'agenda')}>
                    {t(scheduleBlocks.length ? 'Ir al Cuaderno' : 'Ir a la Agenda')} <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="home-day">
          <div className="home-card-ttl"><CalendarDays size={15} />{t('Tu día')}</div>
          {todayBlocks.length === 0 ? (
            <p className="home-muted">{t('Sin clases programadas para hoy.')}</p>
          ) : (
            <ol className="home-timeline">
              {todayBlocks.map(b => {
                const state = b === current ? 'now' : b.time_end <= nowHm ? 'past' : 'later';
                return (
                  <li key={b.id} className={`home-tl ${state}`}>
                    <span className="home-tl-time">{b.time_start}</span>
                    <span className="home-tl-bar" style={{ background: b.color }} />
                    <span className="home-tl-txt">
                      <span className="home-tl-subj">{b.subject}</span>
                      {b.room && <span className="home-tl-room">{b.room}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <button className="home-link" onClick={() => nav('agenda')}>{t('Ver la semana')} <ArrowRight size={13} /></button>
        </div>
      </div>

      {/* ── Lo demás, quieto y en listas cortas ── */}
      <div className="home-grid">
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

        <div className="card home-card">
          <div className="home-card-hd">
            <div className="home-card-ttl"><TrendingUp size={15} />{t('Cómo van tus clases')}</div>
            <button className="home-link" onClick={() => nav('notebook')}>{t('Cuaderno')}</button>
          </div>
          <ul className="home-list">
            {classAverages.map(({ cls, avg, failing, count }) => (
              <li key={cls.id} className="home-class">
                <span className="home-class-name"><span className="home-class-dot" style={{ background: cls.color }} />{cls.name}</span>
                <span className="home-class-bar"><span style={{ width: `${((avg ?? 0) / 10) * 100}%`, background: gradeColor(avg) }} /></span>
                <span className="home-class-avg" style={{ color: gradeColor(avg) }}>
                  {avg === null ? '—' : avg.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
                <span className="home-tl-room home-class-sub">
                  {count === 0 ? t('sin notas') : failing ? t('{n} por debajo de 5', { n: failing }) : t('todos aprueban')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
