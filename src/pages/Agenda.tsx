import { useState, useMemo, useRef, Fragment } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Plus, X, Trash2, ScanLine, CalendarClock, FileUp, FileX } from 'lucide-react';
import { ClasesDelHorario } from '../components/agenda/ClasesDelHorario';
import { HorarioLector } from '../components/agenda/HorarioLector';
import type { ScheduleBlock, CalEvent, Class, HorarioDocumento } from '../types';
import { documentoDeArchivo, MAX_HORARIO_BYTES } from '../lib/horarioDoc';
import { PALETTE } from '../lib/demoData';
import { isoDate, fromIsoDate } from '../lib/utils';
import { grupoDeBloque } from '../lib/apoyo';
import { requestGrupos } from '../lib/apoyoNav';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { useI18n, monthLabel, weekdayLabel, eventTypeLabel, urgencyLabel } from '../i18n';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import { useCalendarioEscolar } from '../hooks/useCalendarioEscolar';
import {
  calendarioDe, citarCalendario, cursoDe, diaEscolar, marcasDelDia, tieneCalendario, type EtapaCalendario,
} from '../lib/calendarioEscolar';

// --------------- helpers ---------------
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// La fecha se calcula en lib/utils para que toda la app use el mismo criterio

/**
 * Las horas de la semana, de una en una: de 08:00 a 14:00 como mínimo, y
 * hasta la hora en que empiece la última clase. Antes se cortaba siempre a
 * las 14:00 y las clases de la tarde no se veían (11-10-2026).
 */
function franjas(blocks: ScheduleBlock[]): string[] {
  const ultima = blocks.reduce((h, b) => Math.max(h, Number(b.time_start.slice(0, 2)) || 0), 14);
  return Array.from({ length: Math.min(ultima, 23) - 8 + 1 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`);
}

// Build a calendar grid for a given month (always 6 rows × 7 cols, Mon first)
function buildCalGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  // getDay(): 0=Sun..6=Sat → we want Mon=0
  const startOffset = (firstDay.getDay() + 6) % 7;
  const grid: Date[] = [];
  const start = new Date(year, month, 1 - startOffset);
  for (let i = 0; i < 42; i++) {
    grid.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return grid;
}

// Get Mon–Fri dates for the week that contains `date`
function weekDates(date: Date): Date[] {
  const dayOfWeek = (date.getDay() + 6) % 7; // Mon=0
  const monday = new Date(date);
  monday.setDate(date.getDate() - dayOfWeek);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// La fila en la que se pinta el bloque: la de la hora en la que empieza, una
// sola vez. Antes salía en cada hora que tocaba, y uno de 09:45 a 10:30 se
// veía dos veces (a las 9 y a las 10) aunque fuera una sola sesión. Lo que
// empieza antes de la primera fila y llega a ella sale en la primera.
function blockInSlot(block: ScheduleBlock, slot: string): boolean {
  const first = '08:00';
  if (block.time_start < first) return slot === first && block.time_end > first;
  return block.time_start.slice(0, 2) === slot.slice(0, 2);
}

// --------------- sub-components ---------------
interface BlockCardProps {
  block: ScheduleBlock;
  onClick: () => void;
}
function BlockCard({ block, onClick }: BlockCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: block.color,
        borderRadius: 8,
        padding: '4px 8px',
        cursor: 'pointer',
        color: '#fff',
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.3,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <div style={{ opacity: 0.85, fontSize: 10 }}>{block.time_start}–{block.time_end}</div>
      <div>{block.subject}</div>
      {block.room && <div style={{ opacity: 0.8 }}>{block.room}</div>}
    </div>
  );
}

// --------------- blank form states ---------------
function blankBlock(classes: Class[]): ScheduleBlock {
  return {
    id: '',
    day: 1,
    time_start: '08:00',
    time_end: '09:00',
    subject: '',
    room: '',
    class_id: classes[0]?.id ?? '',
    color: classes[0]?.color ?? PALETTE[0],
  };
}

function blankEvent(): CalEvent {
  return {
    id: '',
    name: '',
    date: isoDate(new Date()),
    time: '09:00',
    type: 'event',
    urgency: 'media',
    color: PALETTE[0],
    desc: '',
  };
}

// --------------- Props ---------------
interface Props {
  classes: Class[];
  scheduleBlocks: ScheduleBlock[];
  /**
   * PT y AL: el horario de sus grupos de apoyo, que se pinta en la semana sin
   * apuntarlo dos veces. Se cambia en «Mi alumnado», pestaña «Grupos», no aquí.
   */
  apoyoBlocks?: ScheduleBlock[];
  calEvents: CalEvent[];
  onAddBlock: (b: ScheduleBlock) => void;
  onUpdateBlock: (b: ScheduleBlock) => void;
  onDeleteBlock: (id: string) => void;
  /** Sustituye el horario entero (vacío = borrarlo). */
  onReplaceBlocks: (blocks: ScheduleBlock[]) => void;
  /** El PDF o la foto del horario del docente, que la pestaña «Mi horario» muestra. */
  horarioDoc: HorarioDocumento | null;
  onChangeHorarioDoc: (doc: HorarioDocumento | null) => void;
  onAddCalEvent: (ev: CalEvent) => void;
  onUpdateCalEvent: (ev: CalEvent) => void;
  onDeleteCalEvent: (id: string) => void;
  onNav: (s: string) => void;
  /** Del perfil: de ella sale el calendario escolar (vacaciones y días no lectivos). */
  comunidad?: ComunidadId;
}

// ==================== Agenda ====================
export function Agenda({
  classes,
  scheduleBlocks,
  apoyoBlocks = [],
  calEvents,
  onAddBlock,
  onUpdateBlock,
  onDeleteBlock,
  onReplaceBlocks,
  horarioDoc,
  onChangeHorarioDoc,
  onAddCalEvent,
  onUpdateCalEvent,
  onDeleteCalEvent,
  onNav,
  comunidad,
}: Props) {
  const { toast } = useToast();
  const { t, locale, lang } = useI18n();
  const today = useMemo(() => new Date(), []);
  const [detectarOpen, setDetectarOpen] = useState(false);
  const [confirmQuitarDoc, setConfirmQuitarDoc] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const shortDayLabels = useMemo(() => Array.from({ length: 7 }, (_, i) => weekdayLabel(i, locale, 'short')), [locale]);
  const weekDayLabels = useMemo(() => Array.from({ length: 5 }, (_, i) => weekdayLabel(i, locale)), [locale]);

  // ---- view state ----
  // Se abre en la semana: el horario es lo que más se mira (11-10-2026)
  const [view, setView] = useState<'mensual' | 'semanal' | 'documento'>('semanal');
  const [menuHorario, setMenuHorario] = useState(false);

  // ---- monthly state ----
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(isoDate(today));

  // ---- weekly state ----
  const [weekAnchor, setWeekAnchor] = useState<Date>(today);

  // ---- block modal ----
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockForm, setBlockForm] = useState<ScheduleBlock>(() => blankBlock(classes));
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  // ---- event modal ----
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventForm, setEventForm] = useState<CalEvent>(blankEvent);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // ---- calendar grid ----
  const calGrid = useMemo(() => buildCalGrid(calYear, calMonth), [calYear, calMonth]);

  // ---- calendario escolar de la comunidad (el curso del mes que se ve) ----
  const archivoCal = useCalendarioEscolar();
  const conCalendario = tieneCalendario(archivoCal, comunidad);
  const cursoVisto = cursoDe(new Date(calYear, calMonth, 15));
  const calEscolar = calendarioDe(archivoCal, comunidad, cursoVisto);
  /** Las etapas de las clases del docente, para marcar su primer y su último día; sin clases con etapa, las dos. */
  const etapasDocente = useMemo<EtapaCalendario[]>(() => {
    const e = new Set(classes.map(c => c.etapa).filter((x): x is EtapaCalendario => x === 'primaria' || x === 'eso'));
    return e.size ? [...e] : ['primaria', 'eso'];
  }, [classes]);
  const etapaLabel = (e: EtapaCalendario) => (e === 'primaria' ? t('Primaria') : t('ESO'));

  // ---- events by date (for dots) ----
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const ev of calEvents) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [calEvents]);

  // ---- selected day events ----
  const selectedDayEvents = useMemo(
    () => (eventsByDate[selectedDate] ?? []).sort((a, b) => a.time.localeCompare(b.time)),
    [eventsByDate, selectedDate],
  );

  // ---- week dates ----
  const currentWeekDates = useMemo(() => weekDates(weekAnchor), [weekAnchor]);

  // ==== month navigation ====
  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  }

  // ==== week navigation ====
  function prevWeek() {
    setWeekAnchor(d => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; });
  }
  function nextWeek() {
    setWeekAnchor(d => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; });
  }

  // ==== block form handlers ====
  function openNewBlock() {
    setEditingBlockId(null);
    setBlockForm(blankBlock(classes));
    setBlockModalOpen(true);
  }
  function openEditBlock(b: ScheduleBlock) {
    setEditingBlockId(b.id);
    setBlockForm({ ...b });
    setBlockModalOpen(true);
  }
  function closeBlockModal() { setBlockModalOpen(false); }

  function handleBlockClassChange(classId: string) {
    const cls = classes.find(c => c.id === classId);
    setBlockForm(f => ({ ...f, class_id: classId, color: cls?.color ?? f.color }));
  }

  function submitBlock() {
    if (!blockForm.subject.trim()) { toast(t('Escribe el nombre de la asignatura')); return; }
    if (blockForm.time_end <= blockForm.time_start) { toast(t('La hora de fin debe ser posterior a la de inicio')); return; }
    if (editingBlockId) {
      onUpdateBlock({ ...blockForm, id: editingBlockId });
    } else {
      onAddBlock({ ...blockForm, id: uid() });
    }
    setBlockModalOpen(false);
  }

  function deleteBlock() {
    if (editingBlockId) onDeleteBlock(editingBlockId);
    setBlockModalOpen(false);
  }

  // ==== event form handlers ====
  function openNewEvent(date?: string) {
    setEditingEventId(null);
    setEventForm({ ...blankEvent(), date: date ?? isoDate(today) });
    setEventModalOpen(true);
  }
  function openEditEvent(ev: CalEvent) {
    setEditingEventId(ev.id);
    setEventForm({ ...ev });
    setEventModalOpen(true);
  }
  function closeEventModal() { setEventModalOpen(false); }

  function submitEvent() {
    if (!eventForm.name.trim()) { toast(t('Escribe un nombre para el evento')); return; }
    if (editingEventId) {
      onUpdateCalEvent({ ...eventForm, id: editingEventId });
    } else {
      onAddCalEvent({ ...eventForm, id: uid() });
    }
    setEventModalOpen(false);
  }

  /** El docente elige su horario (PDF o foto): se guarda y se ofrece detectar sus clases. */
  async function cargarHorario(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const r = await documentoDeArchivo(file);
    if (!r.ok) {
      toast(t(r.error === 'peso'
        ? 'El archivo pesa demasiado (máximo {n} MB).'
        : r.error === 'tipo'
          ? 'Elige un PDF o una foto del horario.'
          : 'No se pudo leer el archivo.', { n: MAX_HORARIO_BYTES / (1024 * 1024) }));
      return;
    }
    onChangeHorarioDoc(r.doc);
    setView('documento');
    setDetectarOpen(true);
  }

  function deleteEvent() {
    if (editingEventId) onDeleteCalEvent(editingEventId);
    setEventModalOpen(false);
  }

  // ==================== RENDER ====================
  return (
    <section className="sec active">
      {/* Page header */}
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Agenda')}</h1>
          <p className="pg-sub">{t('Horario semanal y calendario de eventos')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Lo del horario, junto en un menú: «Borrar horario» en rojo a la
              vista era fácil de pulsar sin querer (11-10-2026) */}
          <div className="menu-wrap" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setMenuHorario(false); }}>
            <button
              type="button" className="btn-ghost" aria-haspopup="menu" aria-expanded={menuHorario}
              onClick={() => setMenuHorario(v => !v)}
              onKeyDown={e => { if (e.key === 'Escape') setMenuHorario(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <CalendarClock size={15} /> {t('Horario')} <ChevronDown size={14} />
            </button>
            {menuHorario && (
              <div className="menu-pop" role="menu" onKeyDown={e => { if (e.key === 'Escape') setMenuHorario(false); }}>
                <button type="button" role="menuitem" className="menu-item" onClick={() => { setMenuHorario(false); fileRef.current?.click(); }}>
                  <FileUp size={15} /> {t(horarioDoc ? 'Cambiar mi horario (PDF o foto)' : 'Cargar mi horario (PDF o foto)')}
                </button>
                {horarioDoc && (
                  <button type="button" role="menuitem" className="menu-item" onClick={() => { setMenuHorario(false); setDetectarOpen(true); }}>
                    <ScanLine size={15} /> {t('Detectar mis clases')}
                  </button>
                )}
                <button type="button" role="menuitem" className="menu-item" onClick={() => { setMenuHorario(false); openNewBlock(); }}>
                  <Plus size={15} /> {t('Nuevo bloque')}
                </button>
                {horarioDoc && (
                  <button type="button" role="menuitem" className="menu-item" onClick={() => { setMenuHorario(false); setConfirmQuitarDoc(true); }}>
                    <FileX size={15} /> {t('Quitar el documento')}
                  </button>
                )}
                {scheduleBlocks.length > 0 && (
                  <button type="button" role="menuitem" className="menu-item danger" onClick={() => { setMenuHorario(false); setConfirmClear(true); }}>
                    <Trash2 size={15} /> {t('Borrar horario')}
                  </button>
                )}
              </div>
            )}
          </div>
          <button className="btn-accent" onClick={() => openNewEvent()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} /> {t('Nuevo evento')}
          </button>
        </div>
      </div>

      {/* Vista: interruptor segmentado, como las pestañas del resto de la app */}
      <div className="tab-bar" role="tablist" aria-label={t('Vista')} style={{ width: 'fit-content', marginBottom: 16 }}>
        <button role="tab" aria-selected={view === 'mensual'} className={`tab-btn${view === 'mensual' ? ' active' : ''}`} style={{ padding: '7px 18px' }} onClick={() => setView('mensual')}>
          {t('Mensual')}
        </button>
        <button role="tab" aria-selected={view === 'semanal'} className={`tab-btn${view === 'semanal' ? ' active' : ''}`} style={{ padding: '7px 18px' }} onClick={() => setView('semanal')}>
          {t('Semanal')}
        </button>
        <button role="tab" aria-selected={view === 'documento'} className={`tab-btn${view === 'documento' ? ' active' : ''}`} style={{ padding: '7px 18px' }} onClick={() => setView('documento')}>
          {t('Mi horario')}
        </button>
      </div>

      <input
        ref={fileRef} type="file" style={{ display: 'none' }} onChange={cargarHorario}
        accept=".pdf,application/pdf,image/*" aria-label={t('Cargar mi horario (PDF o foto)')}
      />

      {/* ===== MI HORARIO: el documento del docente, tal cual ===== */}
      {view === 'documento' && (
        <HorarioLector doc={horarioDoc} onElegir={() => fileRef.current?.click()} />
      )}

      {/* ===== MONTHLY VIEW ===== */}
      {view === 'mensual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button className="ico-btn" onClick={prevMonth} aria-label={t('Anterior')} title={t('Anterior')}><ChevronLeft size={18} /></button>
              <span className="card-ttl" style={{ margin: 0 }}>
                {monthLabel(calMonth, locale)} {calYear}
              </span>
              <button className="ico-btn" onClick={nextMonth} aria-label={t('Siguiente')} title={t('Siguiente')}><ChevronRight size={18} /></button>
            </div>

            {/* Day names header */}
            <div className="cal-grid" style={{ marginBottom: 4 }}>
              {shortDayLabels.map(d => (
                <div
                  key={d}
                  style={{
                    textAlign: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-2, #6b7280)',
                    padding: '4px 0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="cal-grid">
              {calGrid.map((d, i) => {
                const ds = isoDate(d);
                const isOtherMonth = d.getMonth() !== calMonth;
                const isToday = ds === isoDate(today);
                const isSelected = ds === selectedDate;
                const dots = eventsByDate[ds] ?? [];
                const escolar = diaEscolar(calEscolar, ds);
                const finde = d.getDay() === 0 || d.getDay() === 6;

                let cls = 'cal-day';
                if (escolar?.tipo === 'no-lectivo' && !finde) cls += ' no-lectivo';
                if (escolar?.tipo === 'vacaciones') {
                  // Una franja continua: redondeada solo donde empieza y donde acaba
                  cls += ' vacaciones';
                  const antes = new Date(d); antes.setDate(d.getDate() - 1);
                  const despues = new Date(d); despues.setDate(d.getDate() + 1);
                  if (diaEscolar(calEscolar, isoDate(antes))?.tipo !== 'vacaciones' || d.getDay() === 1) cls += ' vac-ini';
                  if (diaEscolar(calEscolar, isoDate(despues))?.tipo !== 'vacaciones' || d.getDay() === 0) cls += ' vac-fin';
                }
                if (isToday) cls += ' today';
                if (isSelected) cls += ' selected';
                if (isOtherMonth) cls += ' other-month';

                return (
                  <div
                    key={i}
                    className={cls}
                    onClick={() => setSelectedDate(ds)}
                    style={{ cursor: 'pointer' }}
                    title={escolar && !(escolar.tipo === 'no-lectivo' && finde) ? t(escolar.nombre) : undefined}
                  >
                    <span>{d.getDate()}</span>
                    {dots.length > 0 && (
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                        {dots.slice(0, 3).map((ev, j) => (
                          <span
                            key={j}
                            className="cal-dot"
                            style={{ background: ev.color }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {conCalendario && (
              <p className="cal-escolar-fuente">
                {calEscolar ? (
                  <>
                    <span className="cal-leyenda vacaciones" aria-hidden="true" />{t('Vacaciones')}
                    <span className="cal-leyenda no-lectivo" aria-hidden="true" />{t('Día no lectivo')}
                    <br />
                    {t('Calendario escolar {curso}: {norma}. Los festivos locales dependen del municipio: añádelos como evento.', { curso: cursoVisto, norma: citarCalendario(calEscolar, lang) })}
                  </>
                ) : t('El calendario de este curso aún no está disponible.')}
              </p>
            )}
          </div>

          {/* Selected day events panel */}
          <div className="card">
            <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="card-ttl" style={{ margin: 0 }}>
                {selectedDate
                  ? fromIsoDate(selectedDate).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
                  : t('Selecciona un día')}
              </span>
              <button
                className="btn-ghost"
                onClick={() => openNewEvent(selectedDate)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}
              >
                <Plus size={14} /> {t('Evento')}
              </button>
            </div>

            {(() => {
              const cal = calendarioDe(archivoCal, comunidad, cursoDe(fromIsoDate(selectedDate)));
              const escolar = diaEscolar(cal, selectedDate);
              const marcas = marcasDelDia(cal, selectedDate, etapasDocente);
              if (!escolar && marcas.length === 0) return null;
              return (
                <ul className="cal-escolar-dia">
                  {escolar && <li className={escolar.tipo}>{t(escolar.nombre)}</li>}
                  {marcas.map(m => (
                    <li key={m.tipo + m.etapa}>
                      {t(m.tipo === 'inicio' ? 'Primer día de clase ({etapa})' : 'Último día de clase ({etapa})', { etapa: etapaLabel(m.etapa) })}
                    </li>
                  ))}
                </ul>
              );
            })()}
            {selectedDayEvents.length === 0 ? (
              <p style={{ color: 'var(--text-2, #9ca3af)', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
                {t('Sin eventos para este día')}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedDayEvents.map(ev => (
                  <div
                    key={ev.id}
                    onClick={() => openEditEvent(ev)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'var(--bg-2, #f9fafb)',
                      cursor: 'pointer',
                      borderLeft: `4px solid ${ev.color}`,
                    }}
                  >
                    <div style={{ minWidth: 48, fontSize: 12, color: 'var(--text-2, #6b7280)', paddingTop: 2 }}>
                      {ev.time}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{ev.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-2, #6b7280)', marginTop: 2 }}>
                        {eventTypeLabel(ev.type, lang)} · {t('Urgencia')} {urgencyLabel(ev.urgency, lang)}
                      </div>
                      {ev.desc && (
                        <div style={{ fontSize: 12, color: 'var(--text-2, #6b7280)', marginTop: 3 }}>{ev.desc}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== WEEKLY VIEW ===== */}
      {view === 'semanal' && (
        <div className="card" style={{ overflowX: 'auto' }}>
          {/* Week navigation */}
          <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button className="ico-btn" onClick={prevWeek} aria-label={t('Anterior')} title={t('Anterior')}><ChevronLeft size={18} /></button>
            <span className="card-ttl" style={{ margin: 0 }}>
              {currentWeekDates[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
              {' – '}
              {currentWeekDates[4].toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <button className="ico-btn" onClick={nextWeek} aria-label={t('Siguiente')} title={t('Siguiente')}><ChevronRight size={18} /></button>
          </div>

          {/* Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '56px repeat(5, 1fr)',
              gap: 0,
              minWidth: 540,
            }}
          >
            {/* Header row */}
            <div /> {/* empty corner */}
            {currentWeekDates.map((d, di) => {
              const ds = isoDate(d);
              const isToday = ds === isoDate(today);
              return (
                <div
                  key={di}
                  style={{
                    textAlign: 'center',
                    padding: '6px 4px 10px',
                    fontWeight: 700,
                    fontSize: 12,
                    borderBottom: '1px solid var(--border, #e5e7eb)',
                    color: isToday ? 'var(--accent, #0284c7)' : 'var(--text)',
                  }}
                >
                  <div style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10, opacity: 0.7 }}>
                    {weekDayLabels[di]}
                  </div>
                  <div style={{ fontSize: 18, lineHeight: 1.2 }}>{d.getDate()}</div>
                  {/* Los eventos del día, encima de sus clases (11-10-2026) */}
                  {(eventsByDate[ds] ?? []).map(ev => (
                    <button
                      key={ev.id} type="button" className="wk-event"
                      style={{ '--ev-c': ev.color || 'var(--accent-d)' } as React.CSSProperties}
                      onClick={() => openEditEvent(ev)} title={ev.desc || ev.name}
                    >
                      {ev.time && <b>{ev.time}</b>} {ev.name}
                    </button>
                  ))}
                </div>
              );
            })}

            {/* Time rows */}
            {franjas([...scheduleBlocks, ...apoyoBlocks]).map(slot => (
              <Fragment key={slot}>
                {/* Time label */}
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-2, #9ca3af)',
                    textAlign: 'right',
                    paddingRight: 8,
                    paddingTop: 6,
                    borderTop: '1px solid var(--border, #e5e7eb)',
                    lineHeight: 1,
                  }}
                >
                  {slot}
                </div>

                {/* Columns Mon–Fri */}
                {[1, 2, 3, 4, 5].map(dayNum => {
                  const blocksInCell = scheduleBlocks.filter(
                    b => b.day === dayNum && blockInSlot(b, slot),
                  );
                  const apoyoInCell = apoyoBlocks.filter(
                    b => b.day === dayNum && blockInSlot(b, slot),
                  );
                  return (
                    <div
                      key={`cell-${slot}-${dayNum}`}
                      style={{
                        borderTop: '1px solid var(--border, #e5e7eb)',
                        borderLeft: '1px solid var(--border, #e5e7eb)',
                        minHeight: 56,
                        padding: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      {apoyoInCell.map(b => (
                        <BlockCard key={b.id} block={b} onClick={() => { requestGrupos(grupoDeBloque(b.id)); onNav('apoyo-alumnado'); }} />
                      ))}
                      {blocksInCell.map(b => (
                        <BlockCard key={b.id} block={b} onClick={() => openEditBlock(b)} />
                      ))}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {/* ===== CLASES DETECTADAS DEL DOCUMENTO ===== */}
      <ClasesDelHorario
        open={detectarOpen}
        doc={horarioDoc}
        classes={classes}
        onClose={() => setDetectarOpen(false)}
        existingCount={scheduleBlocks.length}
        onImport={(blocks, replace) => {
          if (replace) onReplaceBlocks(blocks); else blocks.forEach(onAddBlock);
          toast(t(blocks.length === 1 ? '✅ {n} sesión añadida al horario' : '✅ {n} sesiones añadidas al horario', { n: blocks.length }));
          setView('semanal');
        }}
        onNav={onNav}
      />

      {/* ===== BLOCK MODAL ===== */}
      <div className={`modal-overlay${blockModalOpen ? ' open' : ''}`} onClick={closeBlockModal}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-hd">
            <span className="modal-title">{t(editingBlockId ? 'Editar bloque' : 'Nuevo bloque')}</span>
            <button className="ico-btn" onClick={closeBlockModal} aria-label={t('Cerrar')} title={t('Cerrar')}><X size={18} /></button>
          </div>

          <div className="fgroup">
            <label className="flabel" htmlFor="agenda-f1">{t('Día')}</label>
            <select
              id="agenda-f1"
              className="finput"
              value={blockForm.day}
              onChange={e => setBlockForm(f => ({ ...f, day: Number(e.target.value) }))}
            >
              {weekDayLabels.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>

          <div className="frow">
            <div className="fgroup">
              <label className="flabel" htmlFor="agenda-f2">{t('Hora inicio')}</label>
              <input
                id="agenda-f2"
                type="time"
                className="finput"
                value={blockForm.time_start}
                onChange={e => setBlockForm(f => ({ ...f, time_start: e.target.value }))}
              />
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="agenda-f3">{t('Hora fin')}</label>
              <input
                id="agenda-f3"
                type="time"
                className="finput"
                value={blockForm.time_end}
                onChange={e => setBlockForm(f => ({ ...f, time_end: e.target.value }))}
              />
            </div>
          </div>

          <div className="fgroup">
            <label className="flabel" htmlFor="agenda-f4">{t('Asignatura')}</label>
            <input
              id="agenda-f4"
              type="text"
              className="finput"
              placeholder={t('Nombre de la asignatura')}
              value={blockForm.subject}
              onChange={e => setBlockForm(f => ({ ...f, subject: e.target.value }))}
            />
          </div>

          <div className="fgroup">
            <label className="flabel" htmlFor="agenda-f5">{t('Aula')}</label>
            <input
              id="agenda-f5"
              type="text"
              className="finput"
              placeholder={t('Ej: Aula 301')}
              value={blockForm.room}
              onChange={e => setBlockForm(f => ({ ...f, room: e.target.value }))}
            />
          </div>

          {classes.length > 0 && (
            <div className="fgroup">
              <label className="flabel" htmlFor="agenda-f6">{t('Clase')}</label>
              <select
                id="agenda-f6"
                className="finput"
                value={blockForm.class_id}
                onChange={e => handleBlockClassChange(e.target.value)}
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="fgroup">
            <label className="flabel">{t('Color')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PALETTE.map((color, i) => (
                <button
                  key={color}
                  type="button"
                  aria-label={t('Color {n}', { n: i + 1 })}
                  aria-pressed={blockForm.color === color}
                  onClick={() => setBlockForm(f => ({ ...f, color }))}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: color,
                    border: blockForm.color === color ? '3px solid var(--text)' : '3px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {editingBlockId && (
              <button className="btn-ghost" onClick={deleteBlock} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444' }}>
                <Trash2 size={15} /> {t('Eliminar')}
              </button>
            )}
            <button className="btn-accent" onClick={submitBlock} style={{ marginLeft: 'auto' }}>
              {t(editingBlockId ? 'Guardar' : 'Añadir')}
            </button>
          </div>
        </div>
      </div>

      {/* ===== EVENT MODAL ===== */}
      <div className={`modal-overlay${eventModalOpen ? ' open' : ''}`} onClick={closeEventModal}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-hd">
            <span className="modal-title">{t(editingEventId ? 'Editar evento' : 'Nuevo evento')}</span>
            <button className="ico-btn" onClick={closeEventModal} aria-label={t('Cerrar')} title={t('Cerrar')}><X size={18} /></button>
          </div>

          <div className="fgroup">
            <label className="flabel" htmlFor="agenda-f7">{t('Nombre')}</label>
            <input
              id="agenda-f7"
              type="text"
              className="finput"
              placeholder={t('Nombre del evento')}
              value={eventForm.name}
              onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="frow">
            <div className="fgroup">
              <label className="flabel" htmlFor="agenda-f8">{t('Fecha')}</label>
              <input
                id="agenda-f8"
                type="date"
                className="finput"
                value={eventForm.date}
                onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="agenda-f9">{t('Hora')}</label>
              <input
                id="agenda-f9"
                type="time"
                className="finput"
                value={eventForm.time}
                onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))}
              />
            </div>
          </div>

          <div className="frow">
            <div className="fgroup">
              <label className="flabel" htmlFor="agenda-f10">{t('Tipo')}</label>
              <select
                id="agenda-f10"
                className="finput"
                value={eventForm.type}
                onChange={e => setEventForm(f => ({ ...f, type: e.target.value as CalEvent['type'] }))}
              >
                <option value="event">{eventTypeLabel('event', lang)}</option>
                <option value="deadline">{eventTypeLabel('deadline', lang)}</option>
                <option value="meeting">{eventTypeLabel('meeting', lang)}</option>
              </select>
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="agenda-f11">{t('Urgencia')}</label>
              <select
                id="agenda-f11"
                className="finput"
                value={eventForm.urgency}
                onChange={e => setEventForm(f => ({ ...f, urgency: e.target.value as CalEvent['urgency'] }))}
              >
                <option value="alta">{urgencyLabel('alta', lang)}</option>
                <option value="media">{urgencyLabel('media', lang)}</option>
                <option value="baja">{urgencyLabel('baja', lang)}</option>
              </select>
            </div>
          </div>

          <div className="fgroup">
            <label className="flabel">{t('Color')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PALETTE.map((color, i) => (
                <button
                  key={color}
                  type="button"
                  aria-label={t('Color {n}', { n: i + 1 })}
                  aria-pressed={eventForm.color === color}
                  onClick={() => setEventForm(f => ({ ...f, color }))}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: color,
                    border: eventForm.color === color ? '3px solid var(--text)' : '3px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="fgroup">
            <label className="flabel" htmlFor="agenda-f12">{t('Descripción')}</label>
            <textarea
              id="agenda-f12"
              className="finput"
              placeholder={t('Descripción opcional…')}
              rows={3}
              value={eventForm.desc}
              onChange={e => setEventForm(f => ({ ...f, desc: e.target.value }))}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {editingEventId && (
              <button className="btn-ghost" onClick={deleteEvent} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444' }}>
                <Trash2 size={15} /> {t('Eliminar')}
              </button>
            )}
            <button className="btn-accent" onClick={submitEvent} style={{ marginLeft: 'auto' }}>
              {t(editingEventId ? 'Guardar' : 'Añadir')}
            </button>
          </div>
        </div>
      </div>
      {/* Borrar el horario entero */}
      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title={t('¿Borrar tu horario?')}>
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 18 }}>
          {t(scheduleBlocks.length === 1
            ? 'Se quitará la {n} sesión de tu horario semanal. Los eventos del calendario no se tocan.'
            : 'Se quitarán las {n} sesiones de tu horario semanal. Los eventos del calendario no se tocan.', { n: scheduleBlocks.length })}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={() => setConfirmClear(false)}>{t('Cancelar')}</button>
          <button
            className="btn-ghost"
            style={{ color: 'white', background: 'var(--danger)', border: 'none' }}
            onClick={() => { onReplaceBlocks([]); setConfirmClear(false); toast(t('Horario borrado')); }}
          >
            <Trash2 size={14} /> {t('Borrar horario')}
          </button>
        </div>
      </Modal>
      {/* Quitar el documento: las sesiones del horario semanal se quedan */}
      <Modal open={confirmQuitarDoc} onClose={() => setConfirmQuitarDoc(false)} title={t('¿Quitar el documento?')}>
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 18 }}>
          {t('Se quitará el PDF o la foto de tu horario. Las sesiones del horario semanal no se tocan.')}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={() => setConfirmQuitarDoc(false)}>{t('Cancelar')}</button>
          <button
            className="btn-ghost"
            style={{ color: 'white', background: 'var(--danger)', border: 'none' }}
            onClick={() => { onChangeHorarioDoc(null); setConfirmQuitarDoc(false); toast(t('Documento quitado')); }}
          >
            <FileX size={14} /> {t('Quitar el documento')}
          </button>
        </div>
      </Modal>
    </section>
  );
}
