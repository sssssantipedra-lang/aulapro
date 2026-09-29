import { useState, useEffect } from 'react';
import { Clock, Book, Users, ClipboardList, BarChart3, CalendarDays, Zap, AlertTriangle, CheckSquare2, Plus, Target, ClipboardCheck } from 'lucide-react';
import type { User, Task, ScheduleBlock, CalEvent, Student, Class, Evaluation,
  GradeCategory, GradeItem, GradeMap, AttendanceMap, Section } from '../types';
import { FirstSteps } from '../components/dashboard/FirstSteps';
import { firstSteps } from '../lib/firstSteps';
import { hasApiKey } from '../services/gemini';
import { isMarksCategory } from '../services/classMarks';
import { PerformanceCarousel } from '../components/dashboard/PerformanceCarousel';
import { CarouselControls, CarouselDots } from '../components/dashboard/carousel';
import { useCarousel, paginate } from '../components/dashboard/useCarousel';
import { useI18n, priorityLabel } from '../i18n';
import { isoDate } from '../lib/utils';

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
}

export function Dashboard({ user, tasks, scheduleBlocks, calEvents, students, classes, evaluations,
  gradeCategories, gradeItems, grades, attendance, onNav, onAddTask, onToggleTask, onLoadDemo }: Props) {
  const { t, locale, lang } = useI18n();
  const [time, setTime] = useState(() => {
    const n = new Date();
    return n.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  });

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }));
    }, 30_000);
    return () => clearInterval(id);
  }, [locale]);

  const now = new Date();
  const greeting = t(now.getHours() < 13 ? 'Buenos días' : now.getHours() < 20 ? 'Buenas tardes' : 'Buenas noches');
  const firstName = user?.full_name.split(' ')[0] ?? '';
  // Solo la primera letra en mayúscula: «Martes, 29 de septiembre», no «29 De Septiembre De»
  const rawDate = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const dateLabel = rawDate.charAt(0).toLocaleUpperCase(locale) + rawDate.slice(1);

  const todayDay = now.getDay() === 0 ? 7 : now.getDay();
  const todayBlocks = scheduleBlocks.filter(b => b.day === todayDay).sort((a, b) => a.time_start.localeCompare(b.time_start));

  const pendingTasks = tasks.filter(t => !t.done);
  const alerts = students.filter(s => s.alerts.length > 0);

  // Ya no se recortan las listas: lo que no cabe en una página pasa a la
  // siguiente y la tarjeta las va rotando. Antes, el quinto evento o la quinta
  // alerta sencillamente no existían para quien miraba el inicio.
  const upcomingEvents = [...calEvents]
    .filter(ev => ev.date >= isoDate())
    .sort((a, b) => a.date.localeCompare(b.date));

  const schedulePages = paginate(todayBlocks, 3);
  const eventPages    = paginate(upcomingEvents, 3);
  const alertPages    = paginate(alerts, 4);
  const taskPages     = paginate(tasks, 8);

  const scheduleCar = useCarousel(schedulePages.length);
  const eventCar    = useCarousel(eventPages.length);
  const alertCar    = useCarousel(alertPages.length);
  const taskCar     = useCarousel(taskPages.length);

  const emptyWorkspace = classes.length === 0;
  const steps = firstSteps({
    classes, students, scheduleBlocks, attendance, hasAi: hasApiKey(),
    // Solo las categorías del docente, no el bloque automático de anotaciones
    gradeCategories: gradeCategories.filter(c => !isMarksCategory(c.id)),
  });

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{greeting}, {firstName}</h1>
          <p className="pg-sub">{dateLabel}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '9px 16px', flexShrink: 0 }}>
          <Clock size={15} color="var(--accent-d)" />
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{time}</span>
        </div>
      </div>

      {emptyWorkspace ? (
        /* ── Primer uso: la guía de primeros pasos es todo el Inicio ── */
        <FirstSteps steps={steps} hero profileId={user?.id ?? ''} onNav={s => onNav(s)} onLoadDemo={onLoadDemo} />
      ) : (
        <>
          <FirstSteps steps={steps} hero={false} profileId={user?.id ?? ''} onNav={(s: Section) => onNav(s)} onLoadDemo={onLoadDemo} />

          {/* Resumen */}
          <div className="dash-stats">
            {[
              { label: t('Clases hoy'), val: todayBlocks.length, hint: t(todayBlocks.length ? 'sesiones programadas' : 'Sin clases hoy'), icon: <Book size={17} color="var(--accent-d)" />, bg: 'color-mix(in srgb, var(--accent-d) 14%, var(--card))', nav: 'agenda' },
              { label: t('Alumnos'), val: students.length, hint: t(classes.length === 1 ? 'en {n} grupo' : 'en {n} grupos', { n: classes.length }), icon: <Users size={17} color="var(--info)" />, bg: 'color-mix(in srgb, var(--info) 14%, var(--card))', nav: 'classes' },
              { label: t('Tareas pendientes'), val: pendingTasks.length, hint: t(pendingTasks.length ? 'por completar' : 'Al día ✓'), icon: <ClipboardList size={17} color="var(--warn)" />, bg: 'color-mix(in srgb, var(--warn) 14%, var(--card))', nav: null },
              { label: t('Evaluaciones'), val: evaluations.length, hint: t(evaluations.length ? 'registradas con rúbrica' : 'Ninguna todavía'), icon: <BarChart3 size={17} color="var(--ok)" />, bg: 'color-mix(in srgb, var(--ok) 14%, var(--card))', nav: 'history' },
            ].map(s => (
              <div
                key={s.label}
                className="card"
                style={{ padding: '14px 16px', cursor: s.nav ? 'pointer' : 'default' }}
                onClick={() => s.nav && onNav(s.nav)}
              >
                <div style={{ width: 34, height: 34, borderRadius: 9, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>{s.icon}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1, margin: '3px 0 4px' }}>{s.val}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{s.hint}</div>
              </div>
            ))}
          </div>

          <div className="dash-main">
            {/* Horario de hoy */}
            <div className="card" {...scheduleCar.hoverProps}>
              <div className="card-hd">
                <div className="card-ttl"><CalendarDays size={14} color="var(--accent-d)" />{t('Horario de hoy')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CarouselControls
                    pages={schedulePages.length}
                    paused={scheduleCar.paused}
                    onPause={() => scheduleCar.setPaused(p => !p)}
                    onPrev={() => scheduleCar.goTo(scheduleCar.index - 1)}
                    onNext={() => scheduleCar.goTo(scheduleCar.index + 1)}
                  />
                  <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onNav('agenda')}>{t('Ver agenda')}</button>
                </div>
              </div>
              {todayBlocks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)', fontSize: 13 }}>
                  {t('Sin clases programadas para hoy.')}
                  <div style={{ marginTop: 6, fontSize: 12 }}>{t('Configura tu horario semanal en la Agenda.')}</div>
                </div>
              ) : (
                <>
                  <div className={`dash-panel${scheduleCar.visible ? ' on' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(schedulePages[scheduleCar.index] ?? []).map(b => (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, background: 'var(--surface)', border: `0.5px solid ${b.color}33` }}>
                        <div style={{ width: 3, height: 36, borderRadius: 2, background: b.color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{b.subject}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{b.time_start}–{b.time_end} · {b.room}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <CarouselDots pages={schedulePages.length} index={scheduleCar.index} onGo={scheduleCar.goTo} />
                </>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
                <button className="btn-accent" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }} onClick={() => onNav('rubrics')}>
                  <ClipboardCheck size={14} />{t('Evaluar')}
                </button>
                <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }} onClick={() => onNav('diana')}>
                  <Target size={14} />{t('Diana')}
                </button>
              </div>
            </div>

            {/* Columna central */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Próximos eventos */}
              <div className="card" {...eventCar.hoverProps}>
                <div className="card-hd">
                  <div className="card-ttl"><Zap size={14} color="var(--warn)" />{t('Próximos eventos')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CarouselControls
                      pages={eventPages.length}
                      paused={eventCar.paused}
                      onPause={() => eventCar.setPaused(p => !p)}
                      onPrev={() => eventCar.goTo(eventCar.index - 1)}
                      onNext={() => eventCar.goTo(eventCar.index + 1)}
                    />
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onNav('agenda')}>{t('Ver todo')}</button>
                  </div>
                </div>
                {upcomingEvents.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>
                    {t('Sin eventos próximos. Añádelos desde la Agenda.')}
                  </div>
                ) : (
                  <>
                    <div className={`dash-panel${eventCar.visible ? ' on' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(eventPages[eventCar.index] ?? []).map(ev => (
                        <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{ev.date} · {ev.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <CarouselDots pages={eventPages.length} index={eventCar.index} onGo={eventCar.goTo} />
                  </>
                )}
              </div>

              {/* Alertas */}
              <div className="card" {...alertCar.hoverProps}>
                <div className="card-hd">
                  <div className="card-ttl"><AlertTriangle size={14} color="var(--warn)" />{t('Alertas de alumnos')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CarouselControls
                      pages={alertPages.length}
                      paused={alertCar.paused}
                      onPause={() => alertCar.setPaused(p => !p)}
                      onPrev={() => alertCar.goTo(alertCar.index - 1)}
                      onNext={() => alertCar.goTo(alertCar.index + 1)}
                    />
                    {alerts.length > 0 && <span style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{alerts.length}</span>}
                  </div>
                </div>
                {alerts.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>{t('Sin alertas activas')}</div>
                ) : (
                  <>
                    <div className={`dash-panel${alertCar.visible ? ' on' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {(alertPages[alertCar.index] ?? []).map(s => (
                        <div key={s.id} style={{ fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>{s.name.split(' ')[0]}:</div>
                          <div style={{ color: 'var(--text-2)' }}>{s.alerts[0]?.text}</div>
                        </div>
                      ))}
                    </div>
                    <CarouselDots pages={alertPages.length} index={alertCar.index} onGo={alertCar.goTo} />
                  </>
                )}
                <button className="btn-ghost" style={{ marginTop: 10, width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={() => onNav('classes')}>
                  {t('Ver todos los alumnos')}
                </button>
              </div>
            </div>

            {/* Rendimiento, rotando por clase y asignatura */}
            <PerformanceCarousel
              classes={classes}
              students={students}
              gradeCategories={gradeCategories}
              gradeItems={gradeItems}
              grades={grades}
              onNav={onNav}
            />

            {/* Tareas */}
            <div className="card" {...taskCar.hoverProps}>
              <div className="card-hd">
                <div className="card-ttl"><CheckSquare2 size={14} color="var(--accent-d)" />{t('Tareas')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CarouselControls
                    pages={taskPages.length}
                    paused={taskCar.paused}
                    onPause={() => taskCar.setPaused(p => !p)}
                    onPrev={() => taskCar.goTo(taskCar.index - 1)}
                    onNext={() => taskCar.goTo(taskCar.index + 1)}
                  />
                  {tasks.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)' }}>{tasks.filter(t=>t.done).length}/{tasks.length}</span>
                  )}
                </div>
              </div>
              {tasks.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>
                  {t('Apunta aquí tus recordatorios: corregir, preparar material…')}
                </div>
              ) : (
                <div className={`dash-panel${taskCar.visible ? ' on' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {(taskPages[taskCar.index] ?? []).map(tk => (
                    <div key={tk.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <input type="checkbox" checked={tk.done} onChange={() => onToggleTask(tk.id)} aria-label={tk.text} style={{ cursor: 'pointer', accentColor: 'var(--accent-d)' }} />
                      <span style={{ flex: 1, fontSize: 12.5, color: tk.done ? 'var(--text-3)' : 'var(--text)', textDecoration: tk.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tk.text}</span>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: tk.priority === 'high' ? '#fee2e2' : tk.priority === 'medium' ? '#fef3c7' : '#f1f5f9', color: tk.priority === 'high' ? '#dc2626' : tk.priority === 'medium' ? '#d97706' : 'var(--text-3)', fontWeight: 700 }}>
                        {priorityLabel(tk.priority, lang)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <CarouselDots pages={taskPages.length} index={taskCar.index} onGo={taskCar.goTo} />
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', marginTop: 10, padding: '8px 0', background: 'none', border: '1px dashed var(--border)', borderRadius: 8, cursor: 'pointer', justifyContent: 'center', fontSize: 12.5, color: 'var(--text-3)', fontFamily: 'var(--font)' }} onClick={onAddTask}>
                <Plus size={14} />{t('Añadir tarea')}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
