import { useMemo, useState } from 'react';
import {
  ClipboardList, Check, X, Clock, FileCheck2, ChevronLeft, ChevronRight,
  Users, ArrowRight, Download, CalendarDays,
} from 'lucide-react';
import type { Class, Student, AttendanceMap, AttendanceStatus } from '../types';
import { isoDate, fromIsoDate } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';

interface Props {
  classes: Class[];
  students: Student[];
  attendance: AttendanceMap;
  onSet: (classId: string, date: string, studentId: string, status: AttendanceStatus) => void;
  onSetDay: (classId: string, date: string, map: Record<string, AttendanceStatus>) => void;
  onNav: (s: string) => void;
}

function statusList(t: (k: string) => string): { id: AttendanceStatus; label: string; short: string; color: string; icon: React.ReactNode }[] {
  return [
    { id: 'present',   label: t('Presente'),   short: 'P', color: '#10b981', icon: <Check size={15} /> },
    { id: 'absent',    label: t('Falta'),      short: 'F', color: '#ef4444', icon: <X size={15} /> },
    { id: 'late',      label: t('Retraso'),    short: 'R', color: '#f59e0b', icon: <Clock size={15} /> },
    { id: 'justified', label: t('Justificada'), short: 'J', color: '#3b82f6', icon: <FileCheck2 size={15} /> },
  ];
}

/** Siguiente estado al tocar repetidamente sobre un alumno. */
const NEXT: Record<AttendanceStatus, AttendanceStatus> = {
  present: 'absent', absent: 'late', late: 'justified', justified: 'present',
};

function shiftDate(iso: string, days: number): string {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

function prettyDate(iso: string, locale: string): string {
  return fromIsoDate(iso).toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export function Attendance({ classes, students, attendance, onSet, onSetDay, onNav }: Props) {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const STATUS = useMemo(() => statusList(t), [t]);
  const STATUS_BY_ID = useMemo(
    () => Object.fromEntries(STATUS.map(s => [s.id, s])) as Record<AttendanceStatus, typeof STATUS[number]>,
    [STATUS],
  );
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [date, setDate]       = useState(isoDate());
  const [tab, setTab]         = useState<'day' | 'summary'>('day');

  const cls = classes.find(c => c.id === classId) ?? classes[0];
  const clsId = cls?.id ?? '';

  const roster = useMemo(
    () => students.filter(s => s.class_id === clsId).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [students, clsId],
  );

  const today = attendance[clsId]?.[date] ?? {};
  const marked = roster.filter(s => today[s.id]).length;

  /** Días con registro, del más reciente al más antiguo. */
  const days = useMemo(
    () => Object.keys(attendance[clsId] ?? {}).sort((a, b) => b.localeCompare(a)),
    [attendance, clsId],
  );

  const summary = useMemo(() => roster.map(s => {
    const counts: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, justified: 0 };
    days.forEach(d => {
      const st = attendance[clsId]?.[d]?.[s.id];
      if (st) counts[st]++;
    });
    const total = counts.present + counts.absent + counts.late + counts.justified;
    // Un retraso cuenta como asistencia; una falta justificada no penaliza el cómputo
    const attended = counts.present + counts.late + counts.justified;
    return { student: s, counts, total, pct: total ? Math.round((attended / total) * 100) : null };
  }), [roster, days, attendance, clsId]);

  function markAllPresent() {
    const map: Record<AttendanceStatus, AttendanceStatus> = {} as never;
    const next: Record<string, AttendanceStatus> = {};
    roster.forEach(s => { next[s.id] = today[s.id] ?? 'present'; });
    void map;
    onSetDay(clsId, date, next);
    toast(t('✅ Todos presentes'));
  }

  function exportCsv() {
    if (days.length === 0) { toast(t('Todavía no hay días registrados')); return; }
    const header = [t('Alumno'), ...days.slice().reverse(), t('% asistencia')];
    const rows = roster.map(s => {
      const cells = days.slice().reverse().map(d => {
        const st = attendance[clsId]?.[d]?.[s.id];
        return st ? STATUS_BY_ID[st].short : '';
      });
      const pct = summary.find(x => x.student.id === s.id)?.pct;
      return [s.name, ...cells, pct !== null && pct !== undefined ? `${pct}%` : ''];
    });
    const csv = '﻿' + [header, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `asistencia-${cls?.name.replace(/\s+/g, '-') ?? 'clase'}-${isoDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(t('✅ Asistencia exportada'));
  }

  if (classes.length === 0) {
    return (
      <section className="sec active">
        <div className="pg-hd">
          <div>
            <h1 className="pg-title">{t('Asistencia')}</h1>
            <p className="pg-sub">{t('Pasa lista en unos segundos')}</p>
          </div>
        </div>
        <div className="card" style={{ maxWidth: 540, margin: '40px auto', textAlign: 'center', padding: '40px 34px' }}>
          <Users size={36} color="var(--text-3)" style={{ margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('Aún no tienes clases')}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
            {t('Para pasar lista, primero crea una clase con sus alumnos.')}
          </p>
          <button className="btn-accent" onClick={() => onNav('classes')}>
            {t('Ir a Mis Clases')} <ArrowRight size={14} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Asistencia')}</h1>
          <p className="pg-sub">
            {days.length > 0
              ? `${t(days.length === 1 ? '{n} día registrado' : '{n} días registrados', { n: days.length })} ${t('en {name}', { name: cls?.name ?? '' })}`
              : t('Pasa lista en unos segundos')}
          </p>
        </div>
        <div className="tab-bar" style={{ marginBottom: 0, width: 'auto' }}>
          <button className={`tab-btn${tab === 'day' ? ' active' : ''}`} style={{ padding: '8px 20px' }} onClick={() => setTab('day')}>
            {t('Pasar lista')}
          </button>
          <button className={`tab-btn${tab === 'summary' ? ' active' : ''}`} style={{ padding: '8px 20px' }} onClick={() => setTab('summary')}>
            {t('Resumen')}
          </button>
        </div>
      </div>

      {/* Selector de clase */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {classes.map(c => {
          const on = c.id === clsId;
          return (
            <button
              key={c.id}
              onClick={() => setClassId(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
                background: on ? 'white' : 'transparent',
                border: `1.5px solid ${on ? c.color : 'var(--border)'}`,
                borderRadius: 99, cursor: 'pointer', fontFamily: 'var(--font)',
                fontSize: 13, fontWeight: on ? 700 : 500, color: 'var(--text)',
                transition: 'all 0.18s',
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color }} />
              {c.name}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        {tab === 'summary' && (
          <button className="btn-ghost" style={{ fontSize: 12.5 }} onClick={exportCsv} disabled={days.length === 0}>
            <Download size={13} />{t('Exportar a Excel')}
          </button>
        )}
      </div>

      {roster.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px 24px' }}>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 16 }}>
            {t('La clase')} <strong>{cls?.name}</strong> {t('todavía no tiene alumnos.')}
          </p>
          <button className="btn-accent" onClick={() => onNav('classes')}>
            {t('Añadir alumnos')} <ArrowRight size={14} />
          </button>
        </div>
      ) : tab === 'day' ? (
        <>
          {/* Fecha */}
          <div className="card" style={{ padding: '12px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button className="ico-btn" onClick={() => setDate(d => shiftDate(d, -1))} title={t('Día anterior')}>
                <ChevronLeft size={17} />
              </button>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', textTransform: 'capitalize' }}>
                  {prettyDate(date, locale)}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                  {t('{marked}/{total} marcados', { marked, total: roster.length })}
                  {date === isoDate() && t(' · hoy')}
                </div>
              </div>
              <button className="ico-btn" onClick={() => setDate(d => shiftDate(d, 1))} title={t('Día siguiente')}>
                <ChevronRight size={17} />
              </button>
              <input
                className="finput" type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ width: 160, flex: 'none', height: 38 }}
              />
              <button className="btn-ghost" style={{ fontSize: 12.5 }} onClick={() => setDate(isoDate())}>
                <CalendarDays size={13} />{t('Hoy')}
              </button>
              <button className="btn-accent" style={{ fontSize: 12.5 }} onClick={markAllPresent}>
                <Check size={14} />{t('Todos presentes')}
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {roster.map((s, i) => {
              const st = today[s.id];
              const info = st ? STATUS_BY_ID[st] : null;
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                    borderTop: i === 0 ? 'none' : '0.5px solid var(--border)',
                    background: st === 'absent' ? 'rgba(239,68,68,0.04)' : undefined,
                  }}
                >
                  <span style={{
                    width: 27, height: 27, borderRadius: 8, flexShrink: 0,
                    background: 'var(--surface)', color: 'var(--text-3)',
                    fontSize: 12, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {i + 1}
                  </span>

                  <button
                    onClick={() => onSet(clsId, date, s.id, st ? NEXT[st] : 'absent')}
                    title={t('Toca para cambiar el estado')}
                    style={{
                      flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none',
                      cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 14,
                      fontWeight: 600, color: 'var(--text)', padding: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {s.name}
                  </button>

                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    {STATUS.map(opt => {
                      const on = st === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => onSet(clsId, date, s.id, opt.id)}
                          title={opt.label}
                          style={{
                            width: 34, height: 32, borderRadius: 9, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `1.5px solid ${on ? opt.color : 'var(--border)'}`,
                            background: on ? opt.color : 'white',
                            color: on ? 'white' : 'var(--text-3)',
                            transition: 'all 0.15s',
                          }}
                        >
                          {opt.icon}
                        </button>
                      );
                    })}
                  </div>

                  <span style={{
                    width: 78, textAlign: 'right', flexShrink: 0,
                    fontSize: 12, fontWeight: 700,
                    color: info ? info.color : 'var(--text-3)',
                  }}>
                    {info ? info.label : t('Sin marcar')}
                  </span>
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12, lineHeight: 1.5 }}>
            {t('Toca el nombre para ir cambiando el estado, o usa los botones. Se guarda solo.')}
          </p>
        </>
      ) : (
        /* ── Resumen ── */
        days.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <ClipboardList size={34} color="var(--text-3)" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
              {t('Todavía no has pasado lista en {name}.', { name: cls?.name ?? '' })}
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="rtable">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', paddingLeft: 16 }}>{t('Alumno')}</th>
                    {STATUS.map(s => <th key={s.id} style={{ minWidth: 76 }}>{s.label}</th>)}
                    <th style={{ minWidth: 92 }}>{t('Asistencia')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map(row => (
                    <tr key={row.student.id}>
                      <td style={{ paddingLeft: 16, fontWeight: 600, fontSize: 13 }}>{row.student.name}</td>
                      {STATUS.map(s => (
                        <td key={s.id} style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: 13, fontWeight: 800,
                            color: row.counts[s.id] > 0 ? s.color : 'var(--text-3)',
                          }}>
                            {row.counts[s.id]}
                          </span>
                        </td>
                      ))}
                      <td style={{ textAlign: 'center' }}>
                        {row.pct === null ? (
                          <span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>—</span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                            <div style={{ width: 46, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                              <div style={{
                                width: `${row.pct}%`, height: '100%', borderRadius: 3,
                                background: row.pct >= 90 ? 'var(--ok)' : row.pct >= 75 ? 'var(--warn)' : 'var(--danger)',
                              }} />
                            </div>
                            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)', width: 34, textAlign: 'right' }}>
                              {row.pct}%
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '10px 16px', borderTop: '0.5px solid var(--border)', background: 'var(--surface)', fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
              {t('El porcentaje cuenta como asistencia los retrasos y las faltas justificadas.')}
            </div>
          </div>
        )
      )}
    </section>
  );
}
