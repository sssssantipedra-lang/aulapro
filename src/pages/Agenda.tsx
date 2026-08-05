import { useState, useMemo, Fragment } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, ScanLine } from 'lucide-react';
import { ScheduleScanner } from '../components/agenda/ScheduleScanner';
import type { ScheduleBlock, CalEvent, Class } from '../types';
import { PALETTE } from '../lib/demoData';
import { isoDate, fromIsoDate } from '../lib/utils';
import { useToast } from '../components/ui/Toast';

// --------------- helpers ---------------
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// La fecha se calcula en lib/utils para que toda la app use el mismo criterio

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const SHORT_DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const WEEK_DAY_LABELS = ['Lunes','Martes','Miércoles','Jueves','Viernes'];

// time slots 08:00 – 14:00 (1 h each)
const TIME_SLOTS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00'];

const TYPE_LABELS: Record<CalEvent['type'], string> = {
  deadline: 'Entrega',
  meeting: 'Reunión',
  event: 'Evento',
};

const URGENCY_LABELS: Record<CalEvent['urgency'], string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

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

// Check if a schedule block falls within a time slot
function blockInSlot(block: ScheduleBlock, slot: string): boolean {
  return block.time_start <= slot && block.time_end > slot;
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
  calEvents: CalEvent[];
  onAddBlock: (b: ScheduleBlock) => void;
  onUpdateBlock: (b: ScheduleBlock) => void;
  onDeleteBlock: (id: string) => void;
  onAddCalEvent: (ev: CalEvent) => void;
  onUpdateCalEvent: (ev: CalEvent) => void;
  onDeleteCalEvent: (id: string) => void;
  onNav: (s: string) => void;
}

// ==================== Agenda ====================
export function Agenda({
  classes,
  scheduleBlocks,
  calEvents,
  onAddBlock,
  onUpdateBlock,
  onDeleteBlock,
  onAddCalEvent,
  onUpdateCalEvent,
  onDeleteCalEvent,
  onNav,
}: Props) {
  const { toast } = useToast();
  const today = useMemo(() => new Date(), []);
  const [scannerOpen, setScannerOpen] = useState(false);

  // ---- view state ----
  const [view, setView] = useState<'mensual' | 'semanal'>('mensual');

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
    if (!blockForm.subject.trim()) { toast('Escribe el nombre de la asignatura'); return; }
    if (blockForm.time_end <= blockForm.time_start) { toast('La hora de fin debe ser posterior a la de inicio'); return; }
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
    if (!eventForm.name.trim()) { toast('Escribe un nombre para el evento'); return; }
    if (editingEventId) {
      onUpdateCalEvent({ ...eventForm, id: editingEventId });
    } else {
      onAddCalEvent({ ...eventForm, id: uid() });
    }
    setEventModalOpen(false);
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
          <h1 className="pg-title">Agenda</h1>
          <p className="pg-sub">Horario semanal y calendario de eventos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ia" onClick={() => setScannerOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ScanLine size={15} /> Escanear horario
          </button>
          <button className="btn-ghost" onClick={openNewBlock} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} /> Nuevo bloque
          </button>
          <button className="btn-accent" onClick={() => openNewEvent()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} /> Nuevo evento
          </button>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={view === 'mensual' ? 'btn-accent' : 'btn-ghost'}
          onClick={() => setView('mensual')}
        >
          Mensual
        </button>
        <button
          className={view === 'semanal' ? 'btn-accent' : 'btn-ghost'}
          onClick={() => setView('semanal')}
        >
          Semanal
        </button>
      </div>

      {/* ===== MONTHLY VIEW ===== */}
      {view === 'mensual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button className="ico-btn" onClick={prevMonth}><ChevronLeft size={18} /></button>
              <span className="card-ttl" style={{ margin: 0 }}>
                {MONTH_NAMES[calMonth]} {calYear}
              </span>
              <button className="ico-btn" onClick={nextMonth}><ChevronRight size={18} /></button>
            </div>

            {/* Day names header */}
            <div className="cal-grid" style={{ marginBottom: 4 }}>
              {SHORT_DAY_NAMES.map(d => (
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

                let cls = 'cal-day';
                if (isToday) cls += ' today';
                if (isSelected) cls += ' selected';
                if (isOtherMonth) cls += ' other-month';

                return (
                  <div
                    key={i}
                    className={cls}
                    onClick={() => setSelectedDate(ds)}
                    style={{ cursor: 'pointer' }}
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
          </div>

          {/* Selected day events panel */}
          <div className="card">
            <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="card-ttl" style={{ margin: 0 }}>
                {selectedDate
                  ? fromIsoDate(selectedDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
                  : 'Selecciona un día'}
              </span>
              <button
                className="btn-ghost"
                onClick={() => openNewEvent(selectedDate)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}
              >
                <Plus size={14} /> Evento
              </button>
            </div>

            {selectedDayEvents.length === 0 ? (
              <p style={{ color: 'var(--text-2, #9ca3af)', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
                Sin eventos para este día
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
                        {TYPE_LABELS[ev.type]} · Urgencia {URGENCY_LABELS[ev.urgency]}
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
            <button className="ico-btn" onClick={prevWeek}><ChevronLeft size={18} /></button>
            <span className="card-ttl" style={{ margin: 0 }}>
              {currentWeekDates[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              {' – '}
              {currentWeekDates[4].toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <button className="ico-btn" onClick={nextWeek}><ChevronRight size={18} /></button>
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
                    color: isToday ? 'var(--accent, #0284c7)' : 'var(--text-1, #111)',
                  }}
                >
                  <div style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10, opacity: 0.7 }}>
                    {WEEK_DAY_LABELS[di]}
                  </div>
                  <div style={{ fontSize: 18, lineHeight: 1.2 }}>{d.getDate()}</div>
                </div>
              );
            })}

            {/* Time rows */}
            {TIME_SLOTS.map(slot => (
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

      {/* ===== ESCÁNER DE HORARIO ===== */}
      <ScheduleScanner
        open={scannerOpen}
        classes={classes}
        onClose={() => setScannerOpen(false)}
        onImport={blocks => {
          blocks.forEach(onAddBlock);
          toast(`✅ ${blocks.length} sesiones añadidas al horario`);
          setView('semanal');
        }}
        onNav={onNav}
      />

      {/* ===== BLOCK MODAL ===== */}
      <div className={`modal-overlay${blockModalOpen ? ' open' : ''}`} onClick={closeBlockModal}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-hd">
            <span className="modal-title">{editingBlockId ? 'Editar bloque' : 'Nuevo bloque'}</span>
            <button className="ico-btn" onClick={closeBlockModal}><X size={18} /></button>
          </div>

          <div className="fgroup">
            <label className="flabel">Día</label>
            <select
              className="finput"
              value={blockForm.day}
              onChange={e => setBlockForm(f => ({ ...f, day: Number(e.target.value) }))}
            >
              {WEEK_DAY_LABELS.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>

          <div className="frow">
            <div className="fgroup">
              <label className="flabel">Hora inicio</label>
              <input
                type="time"
                className="finput"
                value={blockForm.time_start}
                onChange={e => setBlockForm(f => ({ ...f, time_start: e.target.value }))}
              />
            </div>
            <div className="fgroup">
              <label className="flabel">Hora fin</label>
              <input
                type="time"
                className="finput"
                value={blockForm.time_end}
                onChange={e => setBlockForm(f => ({ ...f, time_end: e.target.value }))}
              />
            </div>
          </div>

          <div className="fgroup">
            <label className="flabel">Asignatura</label>
            <input
              type="text"
              className="finput"
              placeholder="Nombre de la asignatura"
              value={blockForm.subject}
              onChange={e => setBlockForm(f => ({ ...f, subject: e.target.value }))}
            />
          </div>

          <div className="fgroup">
            <label className="flabel">Aula</label>
            <input
              type="text"
              className="finput"
              placeholder="Ej: Aula 301"
              value={blockForm.room}
              onChange={e => setBlockForm(f => ({ ...f, room: e.target.value }))}
            />
          </div>

          {classes.length > 0 && (
            <div className="fgroup">
              <label className="flabel">Clase</label>
              <select
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
            <label className="flabel">Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PALETTE.map(color => (
                <button
                  key={color}
                  onClick={() => setBlockForm(f => ({ ...f, color }))}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: color,
                    border: blockForm.color === color ? '3px solid var(--text-1, #111)' : '3px solid transparent',
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
                <Trash2 size={15} /> Eliminar
              </button>
            )}
            <button className="btn-accent" onClick={submitBlock} style={{ marginLeft: 'auto' }}>
              {editingBlockId ? 'Guardar' : 'Añadir'}
            </button>
          </div>
        </div>
      </div>

      {/* ===== EVENT MODAL ===== */}
      <div className={`modal-overlay${eventModalOpen ? ' open' : ''}`} onClick={closeEventModal}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-hd">
            <span className="modal-title">{editingEventId ? 'Editar evento' : 'Nuevo evento'}</span>
            <button className="ico-btn" onClick={closeEventModal}><X size={18} /></button>
          </div>

          <div className="fgroup">
            <label className="flabel">Nombre</label>
            <input
              type="text"
              className="finput"
              placeholder="Nombre del evento"
              value={eventForm.name}
              onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="frow">
            <div className="fgroup">
              <label className="flabel">Fecha</label>
              <input
                type="date"
                className="finput"
                value={eventForm.date}
                onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="fgroup">
              <label className="flabel">Hora</label>
              <input
                type="time"
                className="finput"
                value={eventForm.time}
                onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))}
              />
            </div>
          </div>

          <div className="frow">
            <div className="fgroup">
              <label className="flabel">Tipo</label>
              <select
                className="finput"
                value={eventForm.type}
                onChange={e => setEventForm(f => ({ ...f, type: e.target.value as CalEvent['type'] }))}
              >
                <option value="event">Evento</option>
                <option value="deadline">Entrega</option>
                <option value="meeting">Reunión</option>
              </select>
            </div>
            <div className="fgroup">
              <label className="flabel">Urgencia</label>
              <select
                className="finput"
                value={eventForm.urgency}
                onChange={e => setEventForm(f => ({ ...f, urgency: e.target.value as CalEvent['urgency'] }))}
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>

          <div className="fgroup">
            <label className="flabel">Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PALETTE.map(color => (
                <button
                  key={color}
                  onClick={() => setEventForm(f => ({ ...f, color }))}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: color,
                    border: eventForm.color === color ? '3px solid var(--text-1, #111)' : '3px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="fgroup">
            <label className="flabel">Descripción</label>
            <textarea
              className="finput"
              placeholder="Descripción opcional…"
              rows={3}
              value={eventForm.desc}
              onChange={e => setEventForm(f => ({ ...f, desc: e.target.value }))}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {editingEventId && (
              <button className="btn-ghost" onClick={deleteEvent} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444' }}>
                <Trash2 size={15} /> Eliminar
              </button>
            )}
            <button className="btn-accent" onClick={submitEvent} style={{ marginLeft: 'auto' }}>
              {editingEventId ? 'Guardar' : 'Añadir'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
