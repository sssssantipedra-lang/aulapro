import { useMemo, useRef, useState } from 'react';
import { Paperclip, X, BookOpen, FileText, Brain, Plus, Download, Pencil, Settings2, Users, ArrowRight, Sparkles } from 'lucide-react';
import { callGemini, hasApiKey, type InlineFile } from '../services/gemini';
import { fileToBase64, isoDate } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import type { Class, Student, GradeCategory, GradeItem, GradeMap } from '../types';

interface Props {
  classes: Class[];
  students: Student[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  onAddCategory: (c: GradeCategory) => void;
  onUpdateCategory: (c: GradeCategory) => void;
  onDeleteCategory: (id: string) => void;
  onAddItem: (i: GradeItem) => void;
  onUpdateItem: (i: GradeItem) => void;
  onDeleteItem: (id: string) => void;
  onSetGrade: (itemId: string, studentId: string, value: number | null) => void;
  lawDocument: InlineFile | null;
  onLawDocumentChange: (doc: InlineFile | null) => void;
  onNav: (s: string) => void;
}

/* ══════════════════ Utilidades de cálculo ══════════════════ */

/** Media ponderada de un alumno: media de cada categoría × su peso. */
function weightedAverage(
  studentId: string,
  categories: GradeCategory[],
  items: GradeItem[],
  grades: GradeMap,
): number | null {
  let sum = 0;
  let weightUsed = 0;
  for (const cat of categories) {
    const catItems = items.filter(i => i.category_id === cat.id);
    const scores = catItems
      .map(i => grades[i.id]?.[studentId])
      .filter((v): v is number => typeof v === 'number');
    if (scores.length === 0) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    sum += avg * cat.weight;
    weightUsed += cat.weight;
  }
  if (weightUsed === 0) return null;
  return sum / weightUsed;
}

function fmtNota(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function notaColor(n: number | null): string {
  if (n === null) return 'var(--text-3)';
  if (n < 5) return '#dc2626';
  if (n < 7) return '#d97706';
  return '#047857';
}

/* ══════════════════ Celda de nota editable ══════════════════ */

function GradeCell({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const [text, setText] = useState<string | null>(null); // null = sin editar
  const shown = text !== null ? text : (value !== null ? String(value).replace('.', ',') : '');

  function commit() {
    if (text === null) return;
    const trimmed = text.trim().replace(',', '.');
    if (trimmed === '') {
      onCommit(null);
    } else {
      const n = Number(trimmed);
      if (!Number.isNaN(n)) {
        onCommit(Math.min(10, Math.max(0, Math.round(n * 100) / 100)));
      }
    }
    setText(null);
  }

  return (
    <input
      className="gb-cell"
      type="text"
      inputMode="decimal"
      value={shown}
      placeholder="·"
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setText(null);
      }}
      style={{ color: notaColor(value) }}
    />
  );
}

/* ══════════════════ Pestaña de calificaciones ══════════════════ */

const DEFAULT_CATEGORIES: { name: string; weight: number }[] = [
  { name: 'Exámenes', weight: 60 },
  { name: 'Tareas', weight: 30 },
  { name: 'Participación', weight: 10 },
];

function GradesTab({
  classes, students, gradeCategories, gradeItems, grades,
  onAddCategory, onUpdateCategory, onDeleteCategory,
  onAddItem, onUpdateItem, onDeleteItem, onSetGrade, onNav,
}: Omit<Props, 'lawDocument' | 'onLawDocumentChange'>) {
  const { toast } = useToast();
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [catModal, setCatModal]   = useState<GradeCategory | 'new' | null>(null);
  const [itemModal, setItemModal] = useState<GradeItem | 'new' | null>(null);

  // Formularios de los modales
  const [catName, setCatName]     = useState('');
  const [catWeight, setCatWeight] = useState('');
  const [itemName, setItemName]   = useState('');
  const [itemCat, setItemCat]     = useState('');
  const [itemDate, setItemDate]   = useState(isoDate());
  const [confirmDel, setConfirmDel] = useState(false);

  const cls = classes.find(c => c.id === classId) ?? classes[0];
  const clsId = cls?.id ?? '';

  /** Asignaturas de esta clase. Casi siempre una: entonces no se ve el selector. */
  const subjects = useMemo(
    () => (cls?.subjects?.length ? cls.subjects : cls ? [cls.subject] : []),
    [cls],
  );
  const [subject, setSubject] = useState('');
  // Al cambiar de clase, la asignatura elegida puede no existir en la nueva
  const activeSubject = subjects.includes(subject) ? subject : (subjects[0] ?? '');

  const myStudents = useMemo(
    () => students.filter(s => s.class_id === clsId).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [students, clsId],
  );
  const myCategories = useMemo(
    () => gradeCategories.filter(c =>
      c.class_id === clsId &&
      // Las categorías creadas antes de que hubiera varias asignaturas no
      // llevan ninguna: son de la principal, la primera de la lista.
      (c.subject ?? subjects[0] ?? '') === activeSubject),
    [gradeCategories, clsId, activeSubject, subjects],
  );
  const myItems = useMemo(() => {
    const mine = new Set(myCategories.map(c => c.id));
    return gradeItems.filter(i => i.class_id === clsId && mine.has(i.category_id));
  }, [gradeItems, clsId, myCategories]);
  // El peso suma 100% por asignatura, no por clase
  const weightSum = myCategories.reduce((a, c) => a + c.weight, 0);

  /* ── Modales: abrir ── */
  function openCatModal(cat: GradeCategory | 'new') {
    setCatName(cat === 'new' ? '' : cat.name);
    setCatWeight(cat === 'new' ? '' : String(cat.weight));
    setConfirmDel(false);
    setCatModal(cat);
  }

  function openItemModal(item: GradeItem | 'new') {
    setItemName(item === 'new' ? '' : item.name);
    setItemCat(item === 'new' ? (myCategories[0]?.id ?? '') : item.category_id);
    setItemDate(item === 'new' ? isoDate() : item.date);
    setConfirmDel(false);
    setItemModal(item);
  }

  /* ── Modales: guardar ── */
  function saveCategory() {
    const name = catName.trim();
    const weight = Number(catWeight.replace(',', '.'));
    if (!name) { toast('Escribe un nombre para la categoría'); return; }
    if (Number.isNaN(weight) || weight <= 0 || weight > 100) { toast('El peso debe ser un número entre 1 y 100'); return; }
    if (catModal === 'new') {
      onAddCategory({ id: 'gc' + Date.now(), class_id: clsId, name, weight, subject: activeSubject });
      toast('✅ Categoría creada');
    } else if (catModal) {
      onUpdateCategory({ ...catModal, name, weight });
      toast('✅ Categoría actualizada');
    }
    setCatModal(null);
  }

  function saveItem() {
    const name = itemName.trim();
    if (!name) { toast('Escribe un nombre (ej: Examen Tema 3)'); return; }
    if (!itemCat) { toast('Elige una categoría'); return; }
    if (itemModal === 'new') {
      onAddItem({ id: 'gi' + Date.now(), class_id: clsId, category_id: itemCat, name, date: itemDate });
      toast('✅ Columna de nota añadida');
    } else if (itemModal) {
      onUpdateItem({ ...itemModal, name, category_id: itemCat, date: itemDate });
      toast('✅ Actualizada');
    }
    setItemModal(null);
  }

  /* ── Exportar CSV (compatible con Excel en español) ── */
  function exportCsv() {
    if (myStudents.length === 0) { toast('No hay alumnos en esta clase'); return; }
    const cols = myCategories.flatMap(cat => myItems.filter(i => i.category_id === cat.id).map(i => ({ cat, item: i })));
    const header = ['Alumno', ...cols.map(c => `${c.cat.name} - ${c.item.name}`), 'Media ponderada'];
    const rows = myStudents.map(s => {
      const cells = cols.map(({ item }) => {
        const v = grades[item.id]?.[s.id];
        return typeof v === 'number' ? String(v).replace('.', ',') : '';
      });
      const avg = weightedAverage(s.id, myCategories, myItems, grades);
      return [s.name, ...cells, avg !== null ? avg.toFixed(2).replace('.', ',') : ''];
    });
    const csv = '\uFEFF' + [header, ...rows]
      .map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notas-${cls?.name.replace(/\s+/g, '-') ?? 'clase'}-${isoDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✅ Notas exportadas (ábrelas con Excel)');
  }

  /* ── Estados vacíos ── */
  if (classes.length === 0) {
    return (
      <div className="card" style={{ maxWidth: 560, margin: '30px auto', textAlign: 'center', padding: '40px 36px' }}>
        <Users size={36} color="var(--text-3)" style={{ margin: '0 auto 14px' }} />
        <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Aún no tienes clases</h3>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
          Para usar el cuaderno de notas, primero crea una clase con sus alumnos.
        </p>
        <button className="btn-accent" onClick={() => onNav('classes')}>
          Ir a Mis Clases <ArrowRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Selector de clase + acciones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {classes.map(c => (
          <button
            key={c.id}
            onClick={() => setClassId(c.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
              background: c.id === clsId ? 'white' : 'transparent',
              border: `1.5px solid ${c.id === clsId ? c.color : 'var(--border)'}`,
              borderRadius: 99, cursor: 'pointer', fontFamily: 'var(--font)',
              fontSize: 13, fontWeight: c.id === clsId ? 700 : 500, color: 'var(--text)',
              transition: 'all 0.18s',
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color }} />
            {c.name}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn-ghost" style={{ fontSize: 12.5 }} onClick={exportCsv} disabled={myItems.length === 0}>
          <Download size={13} />Exportar a Excel
        </button>
      </div>

      {/* Selector de asignatura: solo aparece si le das más de una a esta clase */}
      {subjects.length > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16,
          padding: '11px 14px', background: 'var(--surface)', borderRadius: 12,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginRight: 2 }}>
            Estás evaluando
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
                  background: on ? 'white' : 'transparent',
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

      {myStudents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px 24px' }}>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 16 }}>
            La clase <strong>{cls?.name}</strong> todavía no tiene alumnos.
          </p>
          <button className="btn-accent" onClick={() => onNav('classes')}>
            Añadir alumnos <ArrowRight size={14} />
          </button>
        </div>
      ) : myCategories.length === 0 ? (
        /* Primera vez en esta clase: configurar categorías */
        <div className="card" style={{ maxWidth: 620, margin: '20px auto', textAlign: 'center', padding: '36px 32px' }}>
          <Settings2 size={32} color="var(--accent-d)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            ¿Cómo evalúas en {cls?.name}?
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto 22px' }}>
            Define las categorías de nota y cuánto pesa cada una en la media.
            Puedes empezar con la configuración más habitual y ajustarla después.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn-accent"
              onClick={() => {
                DEFAULT_CATEGORIES.forEach((c, i) =>
                  onAddCategory({ id: 'gc' + Date.now() + '_' + i, class_id: clsId, name: c.name, weight: c.weight }));
                toast('✅ Categorías creadas: Exámenes 60% · Tareas 30% · Participación 10%');
              }}
            >
              Usar configuración típica (60/30/10)
            </button>
            <button className="btn-ghost" onClick={() => openCatModal('new')}>
              <Plus size={14} />Crear a mi manera
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Categorías */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {myCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => openCatModal(cat)}
                title="Editar categoría"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  background: 'var(--accent-l)', border: 'none', borderRadius: 8,
                  cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12.5,
                  fontWeight: 700, color: 'var(--accent-d)',
                }}
              >
                {cat.name} · {cat.weight}%
                <Pencil size={11} />
              </button>
            ))}
            <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => openCatModal('new')}>
              <Plus size={13} />Categoría
            </button>
            {weightSum !== 100 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309', background: 'rgba(245,158,11,0.12)', padding: '5px 12px', borderRadius: 8 }}>
                ⚠ Los pesos suman {weightSum}% (lo ideal es 100%)
              </span>
            )}
            <div style={{ flex: 1 }} />
            <button className="btn-accent" style={{ fontSize: 12.5, padding: '7px 14px' }} onClick={() => openItemModal('new')}>
              <Plus size={14} />Añadir nota
            </button>
          </div>

          {/* Tabla de notas */}
          {myItems.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 6 }}>
                Ya casi está. Añade tu primera columna de notas.
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 18 }}>
                Por ejemplo: «Examen Tema 1» en Exámenes, o «Cuaderno» en Tareas.
              </p>
              <button className="btn-accent" onClick={() => openItemModal('new')}>
                <Plus size={14} />Añadir nota
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="gb-table">
                  <thead>
                    <tr>
                      <th className="gb-sticky" style={{ zIndex: 3 }}>Alumno</th>
                      {myCategories.map(cat =>
                        myItems.filter(i => i.category_id === cat.id).map(item => (
                          <th key={item.id}>
                            <button className="gb-item-hd" onClick={() => openItemModal(item)} title={`${cat.name} · ${item.date} — clic para editar`}>
                              <span className="gb-item-name">{item.name}</span>
                              <span className="gb-item-cat">{cat.name}</span>
                            </button>
                          </th>
                        )),
                      )}
                      <th style={{ minWidth: 76 }}>Media</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myStudents.map(s => {
                      const avg = weightedAverage(s.id, myCategories, myItems, grades);
                      return (
                        <tr key={s.id}>
                          <td className="gb-sticky gb-student">{s.name}</td>
                          {myCategories.map(cat =>
                            myItems.filter(i => i.category_id === cat.id).map(item => (
                              <td key={item.id} style={{ textAlign: 'center' }}>
                                <GradeCell
                                  value={grades[item.id]?.[s.id] ?? null}
                                  onCommit={v => onSetGrade(item.id, s.id, v)}
                                />
                              </td>
                            )),
                          )}
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: 13.5, fontWeight: 800, color: notaColor(avg) }}>{fmtNota(avg)}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Media del grupo */}
                    <tr className="gb-footer">
                      <td className="gb-sticky" style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-2)' }}>Media del grupo</td>
                      {myCategories.map(cat =>
                        myItems.filter(i => i.category_id === cat.id).map(item => {
                          const vals = myStudents
                            .map(s => grades[item.id]?.[s.id])
                            .filter((v): v is number => typeof v === 'number');
                          const m = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                          return (
                            <td key={item.id} style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: notaColor(m) }}>
                              {fmtNota(m)}
                            </td>
                          );
                        }),
                      )}
                      <td style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 800, color: 'var(--text-2)' }}>
                        {(() => {
                          const avgs = myStudents
                            .map(s => weightedAverage(s.id, myCategories, myItems, grades))
                            .filter((v): v is number => v !== null);
                          const m = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
                          return fmtNota(m);
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal categoría */}
      <Modal
        open={catModal !== null}
        onClose={() => setCatModal(null)}
        title={catModal === 'new' ? 'Nueva categoría' : 'Editar categoría'}
      >
        <div className="fgroup">
          <label className="flabel">Nombre</label>
          <input className="finput" value={catName} onChange={e => setCatName(e.target.value)} placeholder="Ej: Exámenes" autoFocus />
        </div>
        <div className="fgroup">
          <label className="flabel">Peso en la media (%)</label>
          <input className="finput" value={catWeight} onChange={e => setCatWeight(e.target.value)} placeholder="Ej: 60" inputMode="numeric" />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button className="btn-accent" style={{ flex: 1, justifyContent: 'center' }} onClick={saveCategory}>Guardar</button>
          {catModal !== 'new' && catModal !== null && (
            confirmDel ? (
              <button
                className="btn-ghost"
                style={{ color: 'white', background: 'var(--danger)', border: 'none' }}
                onClick={() => { onDeleteCategory(catModal.id); setCatModal(null); toast('Categoría eliminada'); }}
              >
                ¿Eliminar con sus notas?
              </button>
            ) : (
              <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDel(true)}>Eliminar</button>
            )
          )}
        </div>
      </Modal>

      {/* Modal columna de nota */}
      <Modal
        open={itemModal !== null}
        onClose={() => setItemModal(null)}
        title={itemModal === 'new' ? 'Añadir nota' : 'Editar nota'}
      >
        <div className="fgroup">
          <label className="flabel">Nombre</label>
          <input className="finput" value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Ej: Examen Tema 3" autoFocus />
        </div>
        <div className="frow fgroup">
          <div>
            <label className="flabel">Categoría</label>
            <select className="finput" value={itemCat} onChange={e => setItemCat(e.target.value)} style={{ cursor: 'pointer' }}>
              {myCategories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.weight}%)</option>)}
            </select>
          </div>
          <div>
            <label className="flabel">Fecha</label>
            <input className="finput" type="date" value={itemDate} onChange={e => setItemDate(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button className="btn-accent" style={{ flex: 1, justifyContent: 'center' }} onClick={saveItem}>Guardar</button>
          {itemModal !== 'new' && itemModal !== null && (
            confirmDel ? (
              <button
                className="btn-ghost"
                style={{ color: 'white', background: 'var(--danger)', border: 'none' }}
                onClick={() => { onDeleteItem(itemModal.id); setItemModal(null); toast('Columna eliminada'); }}
              >
                ¿Eliminar con sus notas?
              </button>
            ) : (
              <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDel(true)}>Eliminar</button>
            )
          )}
        </div>
      </Modal>
    </>
  );
}

/* ══════════════════ Pestaña de consulta IA ══════════════════ */

interface HistoryEntry {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
}

const SYSTEM_PROMPT =
  'Eres un asistente pedagógico experto para docentes españoles de secundaria (sistema LOMLOE). Respondes en español de España, de forma clara, estructurada y útil.';

const MAX_FILE_BYTES = 19 * 1024 * 1024; // 19 MB

function AiTab({ lawDocument, onLawDocumentChange, onNav }: Pick<Props, 'lawDocument' | 'onLawDocumentChange' | 'onNav'>) {
  const { toast } = useToast();
  const [question, setQuestion] = useState('');
  const [attachedFile, setAttachedFile] = useState<InlineFile | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const attachRef = useRef<HTMLInputElement>(null);
  const lawRef = useRef<HTMLInputElement>(null);

  async function handleAttach(e: React.ChangeEvent<HTMLInputElement>, forLaw: boolean) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { toast('El archivo supera el límite de 19 MB'); return; }
    try {
      const inlineFile = await fileToBase64(file);
      if (forLaw) { onLawDocumentChange(inlineFile); toast('✅ Normativa adjuntada'); }
      else setAttachedFile(inlineFile);
    } catch {
      toast('No se pudo leer el archivo');
    }
  }

  async function handleAsk() {
    if (!question.trim()) { toast('Escribe una pregunta antes de consultar'); return; }
    const files: InlineFile[] = [];
    if (attachedFile) files.push(attachedFile);
    if (lawDocument) files.push(lawDocument);

    const result = await callGemini(SYSTEM_PROMPT, question.trim(), files, {
      onStart: () => setLoading(true),
      onEnd: () => setLoading(false),
      onError: msg => toast(msg),
    });
    if (result === null) return;

    setAnswer(result);
    setHistory(prev => [{
      id: crypto.randomUUID(),
      question: question.trim(),
      answer: result,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    }, ...prev].slice(0, 5));
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 18, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Aviso de clave sin configurar */}
        {!hasApiKey() && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
            background: 'rgba(245,158,11,0.09)', border: '0.5px solid rgba(245,158,11,0.35)',
            borderRadius: 12, fontSize: 13, color: '#92400e',
          }}>
            <Sparkles size={17} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, lineHeight: 1.5 }}>
              Para usar la IA necesitas una clave gratuita de Google (se configura en 2 minutos).
            </span>
            <button className="btn-accent" style={{ fontSize: 12.5, padding: '7px 14px', flexShrink: 0 }} onClick={() => onNav('profile')}>
              Configurar ahora
            </button>
          </div>
        )}

        <div className="card">
          <div className="card-hd">
            <div className="card-ttl"><Brain size={15} color="var(--accent-d)" />Consulta pedagógica</div>
          </div>
          <div className="fgroup">
            <label className="flabel">Pregunta o contexto</label>
            <textarea
              className="finput"
              rows={5}
              placeholder="Escribe tu pregunta pedagógica, describe una situación del aula, pide ideas de actividades…"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              style={{ resize: 'vertical', minHeight: 110 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            <button className="btn-ghost" style={{ fontSize: 12.5, gap: 6 }} onClick={() => attachRef.current?.click()} type="button">
              <Paperclip size={13} />Adjuntar documento
            </button>
            {attachedFile && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-l)', borderRadius: 99,
                padding: '3px 10px 3px 8px', fontSize: 12, color: 'var(--accent-d)', fontWeight: 600, maxWidth: 240, overflow: 'hidden',
              }}>
                <FileText size={12} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFile.name}</span>
                <button type="button" onClick={() => setAttachedFile(null)} aria-label="Quitar archivo adjunto"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0, marginLeft: 2, color: 'var(--accent-d)' }}>
                  <X size={12} />
                </button>
              </div>
            )}
            <input ref={attachRef} type="file" style={{ display: 'none' }} onChange={e => handleAttach(e, false)} accept="*/*" />
          </div>
          <button
            className="btn-ia"
            style={{ marginTop: 14, width: '100%', justifyContent: 'center', fontSize: 14, gap: 8 }}
            onClick={handleAsk}
            disabled={loading}
            type="button"
          >
            {loading ? <><span className="spin" /><span className="ia-generating">Consultando…</span></> : <>✨ Preguntar a la IA</>}
          </button>
        </div>

        {(answer !== null || loading) && (
          <div className="card">
            <div className="card-hd">
              <div className="card-ttl"><BookOpen size={14} color="var(--accent-d)" />Respuesta</div>
            </div>
            {loading && !answer ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', color: 'var(--text-2)', fontSize: 13 }}>
                <span className="spin" /><span className="ia-generating">Generando respuesta…</span>
              </div>
            ) : (
              <div style={{
                maxHeight: 420, overflowY: 'auto', fontSize: 13.5, lineHeight: 1.7, color: 'var(--text)',
                whiteSpace: 'pre-wrap', background: 'var(--surface)', borderRadius: 10, padding: '14px 16px',
                border: '0.5px solid var(--border)',
              }}>
                {answer}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Normativa de referencia */}
        <div className="card">
          <div className="card-hd">
            <div className="card-ttl"><BookOpen size={14} color="var(--accent-d)" />Normativa de referencia</div>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.55 }}>
            Adjunta el BOE o el currículo de tu comunidad y la IA lo tendrá en cuenta en todas sus respuestas.
          </p>
          {lawDocument ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 7, background: 'var(--accent-l)',
                borderRadius: 10, padding: '8px 12px', fontSize: 12.5, color: 'var(--accent-d)', fontWeight: 600, minWidth: 0,
              }}>
                <FileText size={14} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lawDocument.name}</span>
              </div>
              <button className="btn-ghost" style={{ padding: '7px 10px', flexShrink: 0 }} onClick={() => onLawDocumentChange(null)} type="button" aria-label="Quitar normativa">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', gap: 7, fontSize: 13 }} onClick={() => lawRef.current?.click()} type="button">
              <Paperclip size={14} />Adjuntar normativa (PDF…)
            </button>
          )}
          <input
            ref={lawRef} type="file" style={{ display: 'none' }} onChange={e => handleAttach(e, true)}
            accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          />
        </div>

        {/* Historial de consultas */}
        <div className="card">
          <div className="card-hd">
            <div className="card-ttl"><FileText size={14} color="var(--accent-d)" />Últimas consultas</div>
          </div>
          {history.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center', padding: '14px 0' }}>
              Tus últimas 5 consultas aparecerán aquí
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => { setQuestion(entry.question); setAnswer(entry.answer); }}
                  style={{
                    textAlign: 'left', padding: '10px 12px', borderRadius: 9, background: 'var(--surface)',
                    border: '0.5px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font)', width: '100%',
                  }}
                  title="Ver esta consulta"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {entry.question.length > 60 ? entry.question.slice(0, 60) + '…' : entry.question}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-3)', flexShrink: 0 }}>{entry.timestamp}</span>
                  </div>
                  <p style={{
                    fontSize: 11.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.5, overflow: 'hidden',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {entry.answer.slice(0, 100)}{entry.answer.length > 100 ? '…' : ''}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════ Página ══════════════════ */

export function Notebook(props: Props) {
  const [tab, setTab] = useState<'grades' | 'ai'>('grades');

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">Cuaderno de Notas</h1>
          <p className="pg-sub">Calificaciones con media ponderada y asistente pedagógico</p>
        </div>
        <div className="tab-bar" style={{ marginBottom: 0, width: 'auto' }}>
          <button className={`tab-btn${tab === 'grades' ? ' active' : ''}`} style={{ padding: '8px 20px' }} onClick={() => setTab('grades')}>
            Calificaciones
          </button>
          <button className={`tab-btn${tab === 'ai' ? ' active' : ''}`} style={{ padding: '8px 20px' }} onClick={() => setTab('ai')}>
            ✨ Consulta IA
          </button>
        </div>
      </div>

      {tab === 'grades' ? <GradesTab {...props} /> : <AiTab lawDocument={props.lawDocument} onLawDocumentChange={props.onLawDocumentChange} onNav={props.onNav} />}
    </section>
  );
}
