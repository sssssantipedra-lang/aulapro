import { useMemo, useState } from 'react';
import { Printer, FileSpreadsheet, ArrowRight, Users } from 'lucide-react';
import type { Class, Student, GradeCategory, GradeItem, GradeMap } from '../types';
import { PERIODS } from '../lib/utils';
import { useToast } from '../components/ui/Toast';

interface Props {
  classes: Class[];
  students: Student[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  teacherName: string;
  course: string;
  onNav: (s: string) => void;
}

/**
 * Escala cualitativa oficial española. Se calcula sobre la nota YA redondeada
 * a un decimal, que es la que se imprime: si no, un 4,96 saldría como «5,0
 * (Insuficiente)» y parecería un error del acta.
 */
function gradeLabel(n: number): { short: string; long: string } {
  if (n < 5)  return { short: 'IN', long: 'Insuficiente' };
  if (n < 6)  return { short: 'SU', long: 'Suficiente' };
  if (n < 7)  return { short: 'BI', long: 'Bien' };
  if (n < 9)  return { short: 'NT', long: 'Notable' };
  return { short: 'SB', long: 'Sobresaliente' };
}

function num(n: number | null, decimals = 1): string {
  if (typeof n !== 'number') return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Apellidos primero, como se ordenan las actas en España. */
function byName(a: Student, b: Student) {
  return a.name.localeCompare(b.name, 'es');
}

export function Records({
  classes, students, gradeCategories, gradeItems, grades,
  teacherName, course, onNav,
}: Props) {
  const { toast } = useToast();
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [period, setPeriod]   = useState<string>(PERIODS[0]);
  const [showCategories, setShowCategories] = useState(true);
  const [showLabel, setShowLabel]           = useState(true);
  const [showSignature, setShowSignature]   = useState(true);

  const cls = classes.find(c => c.id === classId) ?? classes[0];
  const clsId = cls?.id ?? '';

  const roster = useMemo(
    () => students.filter(s => s.class_id === clsId).sort(byName),
    [students, clsId],
  );

  /** Un acta es siempre de UNA asignatura: es como se entregan. */
  const subjects = useMemo(
    () => (cls?.subjects?.length ? cls.subjects : cls ? [cls.subject] : []),
    [cls],
  );
  const [subject, setSubject] = useState('');
  const activeSubject = subjects.includes(subject) ? subject : (subjects[0] ?? '');

  const cats = useMemo(
    () => gradeCategories.filter(c =>
      c.class_id === clsId &&
      // Sin asignatura = creada antes de que hubiera varias: es de la principal
      (c.subject ?? subjects[0] ?? '') === activeSubject),
    [gradeCategories, clsId, activeSubject, subjects],
  );

  /** Media de un alumno dentro de una categoría (media simple de sus pruebas). */
  function categoryAverage(studentId: string, categoryId: string): number | null {
    const items = gradeItems.filter(i => i.category_id === categoryId);
    const vals = items
      .map(i => grades[i.id]?.[studentId])
      .filter((v): v is number => typeof v === 'number');
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  /** Nota final: media de las categorías ponderada por su peso. */
  function finalGrade(studentId: string): number | null {
    let sum = 0, weight = 0;
    for (const cat of cats) {
      const avg = categoryAverage(studentId, cat.id);
      if (avg === null) continue;
      sum += avg * cat.weight;
      weight += cat.weight;
    }
    return weight ? sum / weight : null;
  }

  const rows = useMemo(() => roster.map((s, i) => {
    const raw = finalGrade(s.id);
    const rounded = raw === null ? null : Math.round(raw * 10) / 10;
    return {
      n: i + 1,
      student: s,
      cells: cats.map(c => categoryAverage(s.id, c.id)),
      final: rounded,
      label: rounded === null ? null : gradeLabel(rounded),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [roster, cats, gradeItems, grades]);

  const stats = useMemo(() => {
    const graded = rows.filter(r => r.final !== null).map(r => r.final as number);
    const passed = graded.filter(v => v >= 5).length;
    return {
      total: rows.length,
      graded: graded.length,
      passed,
      failed: graded.length - passed,
      average: graded.length ? graded.reduce((a, b) => a + b, 0) / graded.length : null,
    };
  }, [rows]);

  const totalWeight = cats.reduce((a, c) => a + c.weight, 0);

  function downloadCsv() {
    if (rows.length === 0) { toast('Esta clase no tiene alumnos'); return; }
    const esc = (s: string | number) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const header = ['Nº', 'Alumno/a', ...cats.map(c => `${c.name} (${c.weight}%)`), 'Nota final', 'Calificación'];
    const lines = [
      header.map(esc).join(';'),
      ...rows.map(r => [
        r.n,
        r.student.name,
        ...r.cells.map(v => (v === null ? '' : num(v))),
        r.final === null ? '' : num(r.final),
        r.label?.long ?? '',
      ].map(esc).join(';')),
    ];
    // BOM + punto y coma: así Excel en España lo abre en columnas sin tocar nada
    const csv = '﻿' + lines.join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    const slug = (s: string) => s.replace(/\s+/g, '-');
    a.download = `acta-${slug(cls?.name ?? 'clase')}-${slug(activeSubject || 'materia')}-${slug(period)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✅ Datos descargados');
  }

  if (classes.length === 0) {
    return (
      <section className="sec active">
        <div className="pg-hd">
          <div>
            <h1 className="pg-title">Actas de calificaciones</h1>
            <p className="pg-sub">Documento oficial listo para imprimir o firmar</p>
          </div>
        </div>
        <div className="card" style={{ maxWidth: 540, margin: '40px auto', textAlign: 'center', padding: '40px 34px' }}>
          <Users size={36} color="var(--text-3)" style={{ margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Aún no tienes clases</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
            El acta se genera con las notas del cuaderno de una clase.
          </p>
          <button className="btn-accent" onClick={() => onNav('classes')}>
            Ir a Mis Clases <ArrowRight size={14} />
          </button>
        </div>
      </section>
    );
  }

  const today = new Date();
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  return (
    <section className="sec active">
      <style>{ACTA_CSS}</style>

      <div className="pg-hd no-print">
        <div>
          <h1 className="pg-title">Actas de calificaciones</h1>
          <p className="pg-sub">
            {rows.length > 0
              ? `${cls?.name}${activeSubject ? ` · ${activeSubject}` : ''} · ${period} · ${stats.graded}/${stats.total} calificados`
              : 'Documento oficial listo para imprimir o firmar'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={downloadCsv} disabled={rows.length === 0}>
            <FileSpreadsheet size={14} />Datos en CSV
          </button>
          <button className="btn-accent" onClick={() => window.print()} disabled={rows.length === 0}>
            <Printer size={15} />Imprimir o guardar en PDF
          </button>
        </div>
      </div>

      {/* ── Controles ── */}
      <div className="card no-print" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
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
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color }} />
                {c.name}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <select
            className="finput" value={period} onChange={e => setPeriod(e.target.value)}
            style={{ width: 176, height: 38, cursor: 'pointer' }}
          >
            {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {subjects.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginRight: 2 }}>
              Acta de
            </span>
            {subjects.map(s => {
              const on = s === activeSubject;
              return (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  style={{
                    padding: '6px 14px', borderRadius: 99, cursor: 'pointer', fontFamily: 'var(--font)',
                    fontSize: 12.5, fontWeight: on ? 800 : 500,
                    background: on ? 'var(--accent-l)' : 'transparent',
                    border: `1.5px solid ${on ? 'var(--accent-d)' : 'var(--border)'}`,
                    color: on ? 'var(--accent-d)' : 'var(--text-2)',
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <Toggle label="Desglose por categorías" on={showCategories} onChange={setShowCategories} />
          <Toggle label="Calificación en palabras" on={showLabel} onChange={setShowLabel} />
          <Toggle label="Pie de firma" on={showSignature} onChange={setShowSignature} />
        </div>

        {totalWeight !== 100 && cats.length > 0 && (
          <p style={{ fontSize: 12.5, color: 'var(--warn)', marginTop: 12, lineHeight: 1.5 }}>
            <strong>Atención:</strong> los pesos de las categorías suman {totalWeight}%, no 100%.
            La nota final se calcula igualmente en proporción, pero revisa el cuaderno antes de firmar el acta.
          </p>
        )}
      </div>

      {/* ── El documento ── */}
      {rows.length === 0 ? (
        <div className="card no-print" style={{ textAlign: 'center', padding: '36px 24px' }}>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 16 }}>
            La clase <strong>{cls?.name}</strong> todavía no tiene alumnos.
          </p>
          <button className="btn-accent" onClick={() => onNav('classes')}>
            Añadir alumnos <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="acta-wrap">
          <div id="acta" className="acta">
            <header className="acta-hd">
              <h1 className="acta-title">Acta de calificaciones</h1>
              <div className="acta-course">{course ? `Curso ${course}` : ''}</div>
            </header>

            <dl className="acta-meta">
              <div><dt>Grupo</dt><dd>{cls?.name}</dd></div>
              <div><dt>Materia</dt><dd>{activeSubject || '—'}</dd></div>
              <div><dt>Periodo</dt><dd>{period}</dd></div>
              <div><dt>Docente</dt><dd>{teacherName || '—'}</dd></div>
            </dl>

            <table className="acta-table">
              <thead>
                <tr>
                  <th className="c-n">Nº</th>
                  <th className="c-name">Alumno/a</th>
                  {showCategories && cats.map(c => (
                    <th key={c.id} className="c-num">
                      {c.name}
                      <span className="c-weight">{c.weight}%</span>
                    </th>
                  ))}
                  <th className="c-num c-final">Nota</th>
                  {showLabel && <th className="c-label">Calificación</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.student.id}>
                    <td className="c-n">{r.n}</td>
                    <td className="c-name">{r.student.name}</td>
                    {showCategories && r.cells.map((v, i) => (
                      <td key={cats[i].id} className="c-num">{num(v)}</td>
                    ))}
                    <td className={`c-num c-final${r.final !== null && r.final < 5 ? ' c-fail' : ''}`}>
                      {num(r.final)}
                    </td>
                    {showLabel && (
                      <td className="c-label">
                        {r.label ? <>{r.label.long} <span className="c-short">({r.label.short})</span></> : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="acta-sum">
              <span><b>{stats.total}</b> alumnos</span>
              <span><b>{stats.passed}</b> con calificación positiva</span>
              <span><b>{stats.failed}</b> negativa</span>
              {stats.graded < stats.total && (
                <span className="acta-sum-warn"><b>{stats.total - stats.graded}</b> sin calificar</span>
              )}
              <span>Media del grupo <b>{num(stats.average)}</b></span>
            </div>

            {showSignature && (
              <footer className="acta-foot">
                <p className="acta-place">
                  A día {today.getDate()} de {MONTHS[today.getMonth()]} del año {today.getFullYear()}
                </p>
                <div className="acta-sign">
                  <div className="acta-sign-line" />
                  <div className="acta-sign-name">Fdo.: {teacherName || '________________'}</div>
                </div>
              </footer>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-2)' }}>
      <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
      {label}
    </label>
  );
}

/**
 * Estilos del acta. Van aquí y no en la hoja global porque solo los usa esta
 * pantalla y porque las reglas de impresión son agresivas: al imprimir se
 * oculta TODO menos el documento.
 */
const ACTA_CSS = `
.acta-wrap { display: flex; justify-content: center; }
.acta {
  width: 100%; max-width: 210mm; background: #fff; color: #111827;
  padding: 16mm 15mm; border-radius: 4px;
  border: 0.5px solid var(--border); box-shadow: 0 6px 26px rgba(0,0,0,0.09);
  font-family: Georgia, 'Times New Roman', serif;
}
.acta-hd { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 4px; }
.acta-title { font-size: 25px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.01em; }
.acta-course { font-size: 12.5px; color: #6b7280; font-family: var(--font); }

.acta-meta {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 0;
  border-bottom: 1px solid #d1d5db; margin: 0 0 16px;
}
.acta-meta > div { padding: 11px 12px 11px 0; }
.acta-meta dt { font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280; font-family: var(--font); font-weight: 700; margin-bottom: 3px; }
.acta-meta dd { font-size: 13.5px; font-weight: 700; margin: 0; }

.acta-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.acta-table thead th {
  font-family: var(--font); font-size: 9.5px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.05em; color: #374151; text-align: center;
  padding: 7px 5px; border-bottom: 1.5px solid #111827; vertical-align: bottom;
}
.acta-table th.c-name { text-align: left; }
.acta-table .c-weight { display: block; font-weight: 600; color: #9ca3af; letter-spacing: 0; margin-top: 2px; }
.acta-table tbody td { padding: 6px 5px; border-bottom: 0.5px solid #e5e7eb; text-align: center; }
.acta-table td.c-name { text-align: left; font-weight: 600; }
.acta-table .c-n { width: 30px; color: #9ca3af; font-size: 11px; }
.acta-table .c-num { width: 62px; font-variant-numeric: tabular-nums; }
.acta-table .c-final { font-weight: 700; font-size: 13px; }
.acta-table .c-fail { color: #b91c1c; }
.acta-table .c-label { width: 118px; text-align: left; font-size: 11.5px; padding-left: 10px; }
.acta-table .c-short { color: #9ca3af; }
.acta-table tbody tr:nth-child(even) { background: #fafafa; }

.acta-sum {
  display: flex; flex-wrap: wrap; gap: 4px 20px; margin-top: 13px; padding-top: 11px;
  border-top: 1.5px solid #111827; font-family: var(--font); font-size: 11.5px; color: #4b5563;
}
.acta-sum b { color: #111827; }
.acta-sum-warn b { color: #b45309; }

.acta-foot { margin-top: 30px; }
.acta-place { font-size: 12.5px; margin-bottom: 34px; }
.acta-sign { width: 205px; }
.acta-sign-line { border-bottom: 1px solid #111827; margin-bottom: 6px; }
.acta-sign-name { font-size: 12px; }

@media print {
  /* Se oculta la aplicación entera y solo queda el documento. */
  body * { visibility: hidden; }
  #acta, #acta * { visibility: visible; }
  #acta {
    position: absolute; left: 0; top: 0; width: 100%;
    padding: 0; border: none; box-shadow: none; border-radius: 0;
  }
  .no-print { display: none !important; }
  /* La cabecera de la tabla se repite en cada hoja y no se parte ningún alumno. */
  .acta-table thead { display: table-header-group; }
  .acta-table tr { break-inside: avoid; page-break-inside: avoid; }
  .acta-table tbody tr:nth-child(even) { background: #f4f4f4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .acta-foot { break-inside: avoid; page-break-inside: avoid; }
  @page { size: A4 portrait; margin: 14mm; }
}
`;
