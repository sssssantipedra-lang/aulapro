/**
 * Anotar actitud: toda la clase en una lista, con un botón por anotación en
 * cada fila (Participa, Buen comportamiento, Sin tarea…). Un toque, una
 * anotación; sin sentar antes a nadie en la Distribución de aula (decisión
 * del dueño, 11-10-2026: anotar desde las mesas quedaba escondido).
 *
 * Las anotaciones son las mismas de siempre y cuentan en el bloque «Trabajo
 * diario y actitud» del cuaderno (ver services/classMarks.ts). Se abre en la
 * clase que toca según el horario, o en la que pida el Cuaderno.
 */
import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Flag, Undo2, Users } from 'lucide-react';
import type { AttendanceMap, Class, ClassMark, ClassMarkType, MarksBlockConfig, ScheduleBlock, Student } from '../types';
import {
  BLOCK_NAME, EF_MARK_TYPES, MARK_TYPES, blockConfig, esAsignaturaEF, markTypeInfo, marksFor, studentBlock, targetLabel,
} from '../services/classMarks';
import { claseQueToca } from '../lib/claseQueToca';
import { useActitudPedido } from '../lib/actitudNav';
import { markIcon } from '../lib/markIcons';
import { fromIsoDate, isoDate } from '../lib/utils';
import { ClassChips } from '../components/ui/ClassChips';
import { useI18n } from '../i18n';

interface Props {
  classes: Class[];
  students: Student[];
  classMarks: ClassMark[];
  marksConfigs: Record<string, MarksBlockConfig>;
  /** Para marcar a quien tiene falta ese día. */
  attendance: AttendanceMap;
  scheduleBlocks?: ScheduleBlock[];
  onAdd: (m: ClassMark, label: string) => void;
  onDelete: (id: string, label: string) => void;
  onNav: (s: string) => void;
}

/** En el móvil no cabe «comportamiento» entero bajo el icono. */
const CORTO: Partial<Record<ClassMarkType, string>> = {
  'behavior-good': 'Buen comport.',
  'behavior-bad': 'Mal comport.',
};

function shiftDate(iso: string, days: number): string {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

function prettyDate(iso: string, locale: string): string {
  const s = fromIsoDate(iso).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
}

export function Actitud({ classes, students, classMarks, marksConfigs, attendance, scheduleBlocks = [], onAdd, onDelete, onNav }: Props) {
  const { t, locale } = useI18n();
  const pedido = useActitudPedido();
  const [classId, setClassId] = useState(() => pedido?.classId ?? claseQueToca(classes, scheduleBlocks));
  const [subjectPick, setSubject] = useState(pedido?.subject ?? '');
  const [date, setDate] = useState(isoDate());

  const cls = classes.find(c => c.id === classId) ?? classes[0];
  const clsId = cls?.id ?? '';
  const subjects = cls ? (cls.subjects?.length ? cls.subjects : [cls.subject]) : [];
  const subject = subjects.includes(subjectPick) ? subjectPick : (subjects[0] ?? '');
  // Primero lo que suma, como se anota más a menudo
  const tipos = [...(esAsignaturaEF(subject) ? EF_MARK_TYPES : MARK_TYPES)].sort((a, b) => Number(b.positive) - Number(a.positive));
  const cfg = blockConfig(marksConfigs, clsId, subject);
  const pct = (Math.round(cfg.points * 100) / 10).toLocaleString(locale);

  const roster = useMemo(
    () => students.filter(s => s.class_id === clsId).sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true })),
    [students, clsId],
  );
  const mine = useMemo(() => (cls ? marksFor(classMarks, cls, subject) : []), [classMarks, cls, subject]);
  const faltas = attendance[clsId]?.[date] ?? {};

  function pickClass(id: string) {
    setClassId(id);
    setSubject('');
  }

  function add(student: Student, type: ClassMarkType) {
    const info = markTypeInfo(type);
    if (!info || !cls) return;
    onAdd({
      id: 'mk' + crypto.randomUUID(),
      class_id: cls.id,
      student_id: student.id,
      type,
      date,
      // Como en la Distribución de aula: solo se guarda si hay donde elegir
      subject: subjects.length > 1 ? subject : undefined,
    }, t(info.label));
  }

  if (!cls) {
    return (
      <section className="sec active">
        <div className="pg-hd"><div><h1 className="pg-title">{t('Anotar actitud')}</h1></div></div>
        <div className="card" style={{ maxWidth: 540, margin: '40px auto', textAlign: 'center', padding: '40px 34px' }}>
          <Users size={36} color="var(--text-3)" style={{ margin: '0 auto 14px' }} />
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 18 }}>{t('Para anotar, primero crea una clase con sus alumnos.')}</p>
          <button className="btn-accent" onClick={() => onNav('classes')}>{t('Ir a Mis Clases')} <ArrowRight size={14} /></button>
        </div>
      </section>
    );
  }

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Anotar actitud')}</h1>
          <p className="pg-sub">{t('Un toque por anotación. Cuenta en «{name}» del cuaderno.', { name: t(BLOCK_NAME) })}</p>
        </div>
      </div>

      <div className="toolbar">
        <ClassChips classes={classes} value={clsId} onChange={pickClass} />
        {subjects.length > 1 && (
          <div className="chip-row" role="group" aria-label={t('Asignatura')}>
            {subjects.map(s => (
              <button key={s} type="button" className={`chip sm accent${s === subject ? ' on' : ''}`} aria-pressed={s === subject} onClick={() => setSubject(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className={`act-info${cfg.enabled === false ? ' off' : ''}`}>
        <Flag size={14} aria-hidden="true" />
        <span>
          {cfg.enabled === false
            ? t('En esta asignatura el bloque «{name}» está desactivado: las anotaciones se guardan, pero no cuentan en la nota.', { name: t(BLOCK_NAME) })
            : t('Pesa un {n}% de la nota final. Cada anotación suma o resta {step} en su parte.', { n: pct, step: cfg.step.toLocaleString(locale) })}
        </span>
        <button type="button" className="mk-link" onClick={() => onNav('notebook')}>
          {t('Ajustar en el cuaderno')} <ArrowRight size={12} />
        </button>
      </p>

      {roster.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px 24px' }}>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 16 }}>
            {t('La clase')} <strong>{cls.name}</strong> {t('todavía no tiene alumnos.')}
          </p>
          <button className="btn-accent" onClick={() => onNav('classes')}>{t('Añadir alumnos')} <ArrowRight size={14} /></button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-bar">
            <button className="ico-btn" onClick={() => setDate(d => shiftDate(d, -1))} title={t('Día anterior')} aria-label={t('Día anterior')}>
              <ChevronLeft size={17} />
            </button>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>{prettyDate(date, locale)}</div>
              {date === isoDate() && <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{t('Hoy')}</div>}
            </div>
            <button className="ico-btn" onClick={() => setDate(d => shiftDate(d, 1))} title={t('Día siguiente')} aria-label={t('Día siguiente')}>
              <ChevronRight size={17} />
            </button>
            {date !== isoDate() && (
              <button className="btn-ghost" style={{ fontSize: 12.5 }} onClick={() => setDate(isoDate())}>
                <CalendarDays size={13} />{t('Hoy')}
              </button>
            )}
            <span className="act-nota-hd">{t('Nota')}</span>
          </div>

          {roster.map((s, i) => {
            const suyas = mine.filter(m => m.student_id === s.id);
            const deHoy = suyas.filter(m => m.date === date);
            const nota = studentBlock(suyas, cfg).total;
            const falta = faltas[s.id] === 'absent';
            const ultima = deHoy[deHoy.length - 1];
            return (
              <div key={s.id} className={`act-row${falta ? ' falta' : ''}`}>
                <span className="act-num">{i + 1}</span>
                <span className="act-name">
                  <span>{s.name}</span>
                  {falta && <span className="act-falta">{t('Falta')}</span>}
                </span>
                <div className="act-opts" role="group" aria-label={s.name}>
                  {tipos.map(tp => {
                    const n = deHoy.filter(m => m.type === tp.id).length;
                    const label = t(tp.label);
                    return (
                      <button
                        key={tp.id} type="button"
                        className={`act-opt ${tp.positive ? 'pos' : 'neg'}${n > 0 ? ' on' : ''}`}
                        onClick={() => add(s, tp.id)}
                        title={`${label} (${tp.positive ? '+' : '−'} ${t(targetLabel(tp.target, subject))})`}
                        aria-label={n > 0 ? t('{what}, {n} hoy', { what: label, n }) : label}
                      >
                        {markIcon(tp.id, 15)}
                        <span className="act-opt-lbl">{label}</span>
                        <span className="act-opt-corto" aria-hidden="true">{CORTO[tp.id] ? t(CORTO[tp.id]!) : label}</span>
                        {n > 0 && <b className="act-count" aria-hidden="true">{n}</b>}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button" className="act-undo"
                  disabled={!ultima}
                  onClick={() => {
                    if (!ultima) return;
                    const info = markTypeInfo(ultima.type);
                    onDelete(ultima.id, info ? t(info.label) : ultima.type);
                  }}
                  title={t('Deshacer la última anotación de este día')}
                  aria-label={t('Deshacer la última anotación de {name}', { name: s.name })}
                >
                  <Undo2 size={14} />
                </button>
                <span className={`act-nota${nota >= 5 ? '' : ' baja'}`} title={t('Nota del bloque, sobre 10')}>
                  {nota.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12, lineHeight: 1.5 }}>
        {t('Se guarda solo. El número de cada botón es lo anotado ese día; la flecha deshace la última anotación.')}
      </p>
    </section>
  );
}
