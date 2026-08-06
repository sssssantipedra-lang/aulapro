import { useState, useEffect } from 'react';
import { Clock, Book, Users, ClipboardList, BarChart3, CalendarDays, Zap, AlertTriangle, CheckSquare2, Plus, Target, ClipboardCheck, Sparkles, ArrowRight } from 'lucide-react';
import type { User, Task, ScheduleBlock, CalEvent, Student, Class, Evaluation,
  GradeCategory, GradeItem, GradeMap } from '../types';
import { PerformanceCarousel } from '../components/dashboard/PerformanceCarousel';
import { useI18n } from '../i18n';
import { isoDate } from '../lib/utils';

const DAY_NAMES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

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
  onNav: (s: string) => void;
  onAddTask: () => void;
  onToggleTask: (id: string) => void;
  onLoadDemo: () => void;
}

export function Dashboard({ user, tasks, scheduleBlocks, calEvents, students, classes, evaluations,
  gradeCategories, gradeItems, grades, onNav, onAddTask, onToggleTask, onLoadDemo }: Props) {
  const { t } = useI18n();
  const [time, setTime] = useState(() => {
    const n = new Date();
    return n.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  });

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const greeting = t(now.getHours() < 13 ? 'Buenos días' : now.getHours() < 20 ? 'Buenas tardes' : 'Buenas noches');
  const firstName = user?.full_name.split(' ')[0] ?? '';
  const dateLabel = `${DAY_NAMES[now.getDay()]}, ${now.getDate()} de ${MONTH_NAMES[now.getMonth()]} de ${now.getFullYear()}`;

  const todayDay = now.getDay() === 0 ? 7 : now.getDay();
  const todayBlocks = scheduleBlocks.filter(b => b.day === todayDay).sort((a, b) => a.time_start.localeCompare(b.time_start));

  const pendingTasks = tasks.filter(t => !t.done);
  const alerts = students.filter(s => s.alerts.length > 0);

  const upcomingEvents = [...calEvents]
    .filter(ev => ev.date >= isoDate())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const emptyWorkspace = classes.length === 0;

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{greeting}, {firstName}</h1>
          <p className="pg-sub" style={{ textTransform: 'capitalize' }}>{dateLabel}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '0.5px solid var(--border)', borderRadius: 10, padding: '9px 16px', flexShrink: 0 }}>
          <Clock size={15} color="var(--accent-d)" />
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{time}</span>
        </div>
      </div>

      {emptyWorkspace ? (
        /* ── Primer uso: guía de arranque ── */
        <div className="card" style={{ maxWidth: 640, margin: '40px auto', textAlign: 'center', padding: '44px 40px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,var(--accent-d),var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(var(--accent-rgb),0.35)' }}>
            <Users size={28} color="white" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
            Empieza creando tu primera clase
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 420, margin: '0 auto 26px' }}>
            Añade un grupo (por ejemplo «3º ESO A») con su lista de alumnos.
            A partir de ahí podrás poner notas en el cuaderno, evaluar con rúbricas
            y organizar tu agenda.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn-accent" style={{ fontSize: 14, padding: '11px 22px' }} onClick={() => onNav('classes')}>
              Crear mi primera clase
              <ArrowRight size={15} />
            </button>
            <button className="btn-ghost" style={{ fontSize: 13.5 }} onClick={onLoadDemo}>
              <Sparkles size={14} color="var(--accent-d)" />
              Cargar datos de ejemplo
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: t('Clases hoy'), val: todayBlocks.length, hint: todayBlocks.length ? 'sesiones programadas' : 'Sin clases hoy', icon: <Book size={17} color="var(--accent-d)" />, bg: 'var(--accent-l)', nav: 'agenda' },
              { label: t('Alumnos'), val: students.length, hint: `en ${classes.length} ${classes.length === 1 ? 'grupo' : 'grupos'}`, icon: <Users size={17} color="var(--info)" />, bg: '#dbeafe', nav: 'classes' },
              { label: t('Tareas pendientes'), val: pendingTasks.length, hint: pendingTasks.length ? 'por completar' : 'Al día ✓', icon: <ClipboardList size={17} color="var(--warn)" />, bg: '#fef3c7', nav: null },
              { label: t('Evaluaciones'), val: evaluations.length, hint: evaluations.length ? 'registradas con rúbrica' : 'Ninguna todavía', icon: <BarChart3 size={17} color="var(--ok)" />, bg: '#dcfce7', nav: 'history' },
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: 16 }}>
            {/* Horario de hoy */}
            <div className="card">
              <div className="card-hd">
                <div className="card-ttl"><CalendarDays size={14} color="var(--accent-d)" />Horario de hoy</div>
                <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onNav('agenda')}>Ver agenda</button>
              </div>
              {todayBlocks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)', fontSize: 13 }}>
                  Sin clases programadas para hoy.
                  <div style={{ marginTop: 6, fontSize: 12 }}>Configura tu horario semanal en la Agenda.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {todayBlocks.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, background: 'var(--surface)', border: `0.5px solid ${b.color}33` }}>
                      <div style={{ width: 3, height: 36, borderRadius: 2, background: b.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{b.subject}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{b.time_start}–{b.time_end} · {b.room}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
                <button className="btn-accent" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }} onClick={() => onNav('rubrics')}>
                  <ClipboardCheck size={14} />Evaluar
                </button>
                <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }} onClick={() => onNav('diana')}>
                  <Target size={14} />Diana
                </button>
              </div>
            </div>

            {/* Columna central */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Próximos eventos */}
              <div className="card">
                <div className="card-hd">
                  <div className="card-ttl"><Zap size={14} color="var(--warn)" />Próximos eventos</div>
                  <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onNav('agenda')}>Ver todo</button>
                </div>
                {upcomingEvents.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>
                    Sin eventos próximos. Añádelos desde la Agenda.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {upcomingEvents.map(ev => (
                      <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{ev.date} · {ev.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Alertas */}
              <div className="card">
                <div className="card-hd">
                  <div className="card-ttl"><AlertTriangle size={14} color="var(--warn)" />Alertas de alumnos</div>
                  {alerts.length > 0 && <span style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{alerts.length}</span>}
                </div>
                {alerts.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>Sin alertas activas</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {alerts.slice(0, 4).map(s => (
                      <div key={s.id} style={{ fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>{s.name.split(' ')[0]}:</div>
                        <div style={{ color: 'var(--text-2)' }}>{s.alerts[0]?.text}</div>
                      </div>
                    ))}
                  </div>
                )}
                <button className="btn-ghost" style={{ marginTop: 10, width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={() => onNav('classes')}>
                  Ver todos los alumnos
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
            <div className="card">
              <div className="card-hd">
                <div className="card-ttl"><CheckSquare2 size={14} color="var(--accent-d)" />{t('Tareas')}</div>
                {tasks.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)' }}>{tasks.filter(t=>t.done).length}/{tasks.length}</span>
                )}
              </div>
              {tasks.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>
                  Apunta aquí tus recordatorios: corregir, preparar material…
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {tasks.slice(0, 8).map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <input type="checkbox" checked={t.done} onChange={() => onToggleTask(t.id)} style={{ cursor: 'pointer', accentColor: 'var(--accent-d)' }} />
                      <span style={{ flex: 1, fontSize: 12.5, color: t.done ? 'var(--text-3)' : 'var(--text)', textDecoration: t.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</span>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: t.priority === 'high' ? '#fee2e2' : t.priority === 'medium' ? '#fef3c7' : '#f1f5f9', color: t.priority === 'high' ? '#dc2626' : t.priority === 'medium' ? '#d97706' : 'var(--text-3)', fontWeight: 700 }}>
                        {t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Media' : 'Baja'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', marginTop: 10, padding: '8px 0', background: 'none', border: '1px dashed var(--border)', borderRadius: 8, cursor: 'pointer', justifyContent: 'center', fontSize: 12.5, color: 'var(--text-3)', fontFamily: 'var(--font)' }} onClick={onAddTask}>
                <Plus size={14} />Añadir tarea
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
