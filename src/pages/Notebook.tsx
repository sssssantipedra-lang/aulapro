import { useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, X, BookOpen, FileText, Brain, Plus, Download, Pencil, Settings2, Users, ArrowRight, Sparkles, Send, Trash2, Database } from 'lucide-react';
import { callGemini, hasApiKey, type InlineFile, type ChatTurn } from '../services/gemini';
import { buildTeacherContext, chatSystemPrompt, type TeacherData, type ChatMessage } from '../services/aiContext';
import { fileToBase64, isoDate } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { useI18n } from '../i18n';
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
  /** Todo el cuaderno, para que el asistente responda con datos reales. */
  aiData: TeacherData;
  chat: ChatMessage[];
  onChatChange: (next: ChatMessage[]) => void;
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

function fmtNota(n: number | null, locale = 'es-ES'): string {
  if (n === null) return '—';
  return n.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function notaColor(n: number | null): string {
  if (n === null) return 'var(--text-3)';
  if (n < 5) return '#dc2626';
  if (n < 7) return '#d97706';
  return '#047857';
}

/* ══════════════════ Celda de nota editable ══════════════════ */

function GradeCell({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const { lang } = useI18n();
  const [text, setText] = useState<string | null>(null); // null = sin editar
  // El separador decimal sigue al idioma; escribir admite los dos igualmente.
  const formatted = value !== null ? (lang === 'es' ? String(value).replace('.', ',') : String(value)) : '';
  const shown = text !== null ? text : formatted;

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

const DEFAULT_CATEGORIES_ES: { name: string; weight: number }[] = [
  { name: 'Exámenes', weight: 60 },
  { name: 'Tareas', weight: 30 },
  { name: 'Participación', weight: 10 },
];
const DEFAULT_CATEGORIES_EN: { name: string; weight: number }[] = [
  { name: 'Tests', weight: 60 },
  { name: 'Homework', weight: 30 },
  { name: 'Participation', weight: 10 },
];

function GradesTab({
  classes, students, gradeCategories, gradeItems, grades,
  onAddCategory, onUpdateCategory, onDeleteCategory,
  onAddItem, onUpdateItem, onDeleteItem, onSetGrade, onNav,
}: Omit<Props, 'lawDocument' | 'onLawDocumentChange'>) {
  const { toast } = useToast();
  const { t, locale, lang } = useI18n();
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

  /**
   * Las pruebas agrupadas por categoría, en el orden en que se muestran.
   * Dentro de cada grupo van por fecha: así «todos los exámenes juntos» y
   * además en el orden en que se hicieron. Se calcula una sola vez y lo usan
   * la cabecera, las filas de alumnos y la media del grupo, que antes
   * repetían el mismo filtrado tres veces y podían descuadrarse.
   */
  // Solo entran las categorías que tienen columnas: una cabecera de grupo con
  // cero pruebas saldría con `colSpan={0}`, que HTML no admite, y el navegador
  // la dibujaría como una columna suelta desplazando toda la tabla.
  const grouped = useMemo(
    () => myCategories
      .map(cat => ({
        cat,
        items: myItems
          .filter(i => i.category_id === cat.id)
          .sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.name.localeCompare(b.name, 'es')),
      }))
      .filter(g => g.items.length > 0),
    [myCategories, myItems],
  );

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
    if (!name) { toast(t('Escribe un nombre para la categoría')); return; }
    if (Number.isNaN(weight) || weight <= 0 || weight > 100) { toast(t('El peso debe ser un número entre 1 y 100')); return; }
    if (catModal === 'new') {
      onAddCategory({ id: 'gc' + Date.now(), class_id: clsId, name, weight, subject: activeSubject });
      toast(t('✅ Categoría creada'));
    } else if (catModal) {
      onUpdateCategory({ ...catModal, name, weight });
      toast(t('✅ Categoría actualizada'));
    }
    setCatModal(null);
  }

  function saveItem() {
    const name = itemName.trim();
    if (!name) { toast(t('Escribe un nombre (ej: Examen Tema 3)')); return; }
    if (!itemCat) { toast(t('Elige una categoría')); return; }
    if (itemModal === 'new') {
      onAddItem({ id: 'gi' + Date.now(), class_id: clsId, category_id: itemCat, name, date: itemDate });
      toast(t('✅ Columna de nota añadida'));
    } else if (itemModal) {
      onUpdateItem({ ...itemModal, name, category_id: itemCat, date: itemDate });
      toast(t('✅ Actualizada'));
    }
    setItemModal(null);
  }

  /* ── Exportar CSV (compatible con Excel en español) ── */
  function exportCsv() {
    if (myStudents.length === 0) { toast(t('No hay alumnos en esta clase')); return; }
    const cols = myCategories.flatMap(cat => myItems.filter(i => i.category_id === cat.id).map(i => ({ cat, item: i })));
    const header = [t('Alumno'), ...cols.map(c => `${c.cat.name} - ${c.item.name}`), t('Media ponderada')];
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
    toast(t('✅ Notas exportadas (ábrelas con Excel)'));
  }

  /* ── Estados vacíos ── */
  if (classes.length === 0) {
    return (
      <div className="card" style={{ maxWidth: 560, margin: '30px auto', textAlign: 'center', padding: '40px 36px' }}>
        <Users size={36} color="var(--text-3)" style={{ margin: '0 auto 14px' }} />
        <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('Aún no tienes clases')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
          {t('Para usar el cuaderno de notas, primero crea una clase con sus alumnos.')}
        </p>
        <button className="btn-accent" onClick={() => onNav('classes')}>
          {t('Ir a Mis Clases')} <ArrowRight size={14} />
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
          <Download size={13} />{t('Exportar a Excel')}
        </button>
      </div>

      {/* Selector de asignatura: solo aparece si le das más de una a esta clase */}
      {subjects.length > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16,
          padding: '11px 14px', background: 'var(--surface)', borderRadius: 12,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginRight: 2 }}>
            {t('Estás evaluando')}
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
            {t('La clase')} <strong>{cls?.name}</strong> {t('todavía no tiene alumnos.')}
          </p>
          <button className="btn-accent" onClick={() => onNav('classes')}>
            {t('Añadir alumnos')} <ArrowRight size={14} />
          </button>
        </div>
      ) : myCategories.length === 0 ? (
        /* Primera vez en esta clase: configurar categorías */
        <div className="card" style={{ maxWidth: 620, margin: '20px auto', textAlign: 'center', padding: '36px 32px' }}>
          <Settings2 size={32} color="var(--accent-d)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            {t('¿Cómo evalúas en {name}?', { name: cls?.name ?? '' })}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto 22px' }}>
            {t('Define las categorías de nota y cuánto pesa cada una en la media. Puedes empezar con la configuración más habitual y ajustarla después.')}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn-accent"
              onClick={() => {
                const defaults = lang === 'en' ? DEFAULT_CATEGORIES_EN : DEFAULT_CATEGORIES_ES;
                defaults.forEach((c, i) =>
                  onAddCategory({ id: 'gc' + Date.now() + '_' + i, class_id: clsId, name: c.name, weight: c.weight, subject: activeSubject }));
                toast(`✅ ${lang === 'en' ? 'Categories created' : 'Categorías creadas'}: ${defaults.map(c => `${c.name} ${c.weight}%`).join(' · ')}`);
              }}
            >
              {t('Usar configuración típica (60/30/10)')}
            </button>
            <button className="btn-ghost" onClick={() => openCatModal('new')}>
              <Plus size={14} />{t('Crear a mi manera')}
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
                title={t('Editar categoría')}
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
              <Plus size={13} />{t('Categoría')}
            </button>
            {weightSum !== 100 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309', background: 'rgba(245,158,11,0.12)', padding: '5px 12px', borderRadius: 8 }}>
                ⚠ {t('Los pesos suman {n}% (lo ideal es 100%)', { n: weightSum })}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <button className="btn-accent" style={{ fontSize: 12.5, padding: '7px 14px' }} onClick={() => openItemModal('new')}>
              <Plus size={14} />{t('Añadir nota')}
            </button>
          </div>

          {/* Tabla de notas */}
          {myItems.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 6 }}>
                {t('Ya casi está. Añade tu primera columna de notas.')}
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 18 }}>
                {t('Por ejemplo: «Examen Tema 1» en Exámenes, o «Cuaderno» en Tareas.')}
              </p>
              <button className="btn-accent" onClick={() => openItemModal('new')}>
                <Plus size={14} />{t('Añadir nota')}
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="gb-table">
                  <thead>
                    {/* Fila de grupos: una celda por categoría, abarcando sus
                        pruebas. Antes la agrupación existía pero no se veía. */}
                    <tr>
                      <th className="gb-sticky" style={{ zIndex: 3 }} rowSpan={2}>{t('Alumno')}</th>
                      {grouped.map(({ cat, items }) => (
                        <th
                          key={`grp-${cat.id}`}
                          colSpan={items.length}
                          style={{
                            borderLeft: '2px solid var(--border)',
                            background: 'var(--surface)',
                            fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                            textTransform: 'uppercase', color: 'var(--text-2)',
                            padding: '7px 8px', whiteSpace: 'nowrap',
                          }}
                        >
                          {cat.name} · {cat.weight}%
                        </th>
                      ))}
                      <th style={{ minWidth: 76, borderLeft: '2px solid var(--border)' }} rowSpan={2}>{t('Media')}</th>
                    </tr>
                    <tr>
                      {grouped.map(({ cat, items }) =>
                        items.map((item, k) => (
                          <th key={item.id} style={k === 0 ? { borderLeft: '2px solid var(--border)' } : undefined}>
                            <button className="gb-item-hd" onClick={() => openItemModal(item)} title={`${cat.name} · ${item.date} — ${t('clic para editar')}`}>
                              <span className="gb-item-name">{item.name}</span>
                              <span className="gb-item-cat">{item.date}</span>
                            </button>
                          </th>
                        )),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {myStudents.map(s => {
                      const avg = weightedAverage(s.id, myCategories, myItems, grades);
                      return (
                        <tr key={s.id}>
                          <td className="gb-sticky gb-student">{s.name}</td>
                          {grouped.map(({ items }) =>
                            items.map((item, k) => (
                              <td key={item.id} style={{
                                textAlign: 'center',
                                ...(k === 0 ? { borderLeft: '2px solid var(--border)' } : {}),
                              }}>
                                <GradeCell
                                  value={grades[item.id]?.[s.id] ?? null}
                                  onCommit={v => onSetGrade(item.id, s.id, v)}
                                />
                              </td>
                            )),
                          )}
                          <td style={{ textAlign: 'center', borderLeft: '2px solid var(--border)' }}>
                            <span style={{ fontSize: 13.5, fontWeight: 800, color: notaColor(avg) }}>{fmtNota(avg, locale)}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Media del grupo */}
                    <tr className="gb-footer">
                      <td className="gb-sticky" style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-2)' }}>{t('Media del grupo')}</td>
                      {grouped.map(({ items }) =>
                        items.map((item, k) => {
                          const vals = myStudents
                            .map(s => grades[item.id]?.[s.id])
                            .filter((v): v is number => typeof v === 'number');
                          const m = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                          return (
                            <td key={item.id} style={{
                              textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: notaColor(m),
                              ...(k === 0 ? { borderLeft: '2px solid var(--border)' } : {}),
                            }}>
                              {fmtNota(m, locale)}
                            </td>
                          );
                        }),
                      )}
                      <td style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 800, color: 'var(--text-2)', borderLeft: '2px solid var(--border)' }}>
                        {(() => {
                          const avgs = myStudents
                            .map(s => weightedAverage(s.id, myCategories, myItems, grades))
                            .filter((v): v is number => v !== null);
                          const m = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
                          return fmtNota(m, locale);
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
        title={t(catModal === 'new' ? 'Nueva categoría' : 'Editar categoría')}
      >
        <div className="fgroup">
          <label className="flabel">{t('Nombre')}</label>
          <input className="finput" value={catName} onChange={e => setCatName(e.target.value)} placeholder={t('Ej: Exámenes')} autoFocus />
        </div>
        <div className="fgroup">
          <label className="flabel">{t('Peso en la media (%)')}</label>
          <input className="finput" value={catWeight} onChange={e => setCatWeight(e.target.value)} placeholder={t('Ej: 60')} inputMode="numeric" />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button className="btn-accent" style={{ flex: 1, justifyContent: 'center' }} onClick={saveCategory}>{t('Guardar')}</button>
          {catModal !== 'new' && catModal !== null && (
            confirmDel ? (
              <button
                className="btn-ghost"
                style={{ color: 'white', background: 'var(--danger)', border: 'none' }}
                onClick={() => { onDeleteCategory(catModal.id); setCatModal(null); toast(t('Categoría eliminada')); }}
              >
                {t('¿Eliminar con sus notas?')}
              </button>
            ) : (
              <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDel(true)}>{t('Eliminar')}</button>
            )
          )}
        </div>
      </Modal>

      {/* Modal columna de nota */}
      <Modal
        open={itemModal !== null}
        onClose={() => setItemModal(null)}
        title={t(itemModal === 'new' ? 'Añadir nota' : 'Editar nota')}
      >
        <div className="fgroup">
          <label className="flabel">{t('Nombre')}</label>
          <input className="finput" value={itemName} onChange={e => setItemName(e.target.value)} placeholder={t('Ej: Examen Tema 3')} autoFocus />
        </div>
        <div className="frow fgroup">
          <div>
            <label className="flabel">{t('Categoría')}</label>
            <select className="finput" value={itemCat} onChange={e => setItemCat(e.target.value)} style={{ cursor: 'pointer' }}>
              {myCategories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.weight}%)</option>)}
            </select>
          </div>
          <div>
            <label className="flabel">{t('Fecha')}</label>
            <input className="finput" type="date" value={itemDate} onChange={e => setItemDate(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button className="btn-accent" style={{ flex: 1, justifyContent: 'center' }} onClick={saveItem}>{t('Guardar')}</button>
          {itemModal !== 'new' && itemModal !== null && (
            confirmDel ? (
              <button
                className="btn-ghost"
                style={{ color: 'white', background: 'var(--danger)', border: 'none' }}
                onClick={() => { onDeleteItem(itemModal.id); setItemModal(null); toast(t('Columna eliminada')); }}
              >
                {t('¿Eliminar con sus notas?')}
              </button>
            ) : (
              <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDel(true)}>{t('Eliminar')}</button>
            )
          )}
        </div>
      </Modal>
    </>
  );
}

/* ══════════════════ Pestaña de asistente IA ══════════════════ */

const MAX_FILE_BYTES = 19 * 1024 * 1024; // 19 MB

/**
 * Tope de la respuesta, más alto que el de por defecto: aquí se piden
 * resúmenes de un grupo entero o comparativas entre clases, y con 4096 se
 * cortaban a media frase.
 */
const CHAT_MAX_TOKENS = 8192;

/**
 * Turnos que se reenvían como memoria de la conversación. Se cuentan mensajes
 * (no pares), así que 12 son unas seis preguntas con sus respuestas: bastante
 * para repreguntar sin que la petición crezca sin freno.
 */
const MEMORY_TURNS = 12;

interface AiTabProps {
  data: TeacherData;
  chat: ChatMessage[];
  onChatChange: (next: ChatMessage[]) => void;
  lawDocument: InlineFile | null;
  onLawDocumentChange: (doc: InlineFile | null) => void;
  onNav: (s: string) => void;
}

/**
 * Da formato al texto que devuelve la IA: negritas, encabezados y viñetas.
 * Antes salía en crudo con los asteriscos a la vista, lo que hacía difícil
 * leer justo las respuestas largas que ahora se piden.
 */
function RichText({ text }: { text: string }) {
  const bold = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
      chunk.startsWith('**') && chunk.endsWith('**')
        ? <strong key={i}>{chunk.slice(2, -2)}</strong>
        : <span key={i}>{chunk}</span>);

  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (bullets.length === 0) return;
    out.push(
      <ul key={`ul${out.length}`} style={{ margin: '6px 0 10px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {bullets.map((b, i) => <li key={i}>{bold(b)}</li>)}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) { bullets.push(bullet[1]); return; }
    flush();

    const heading = /^\s*#{1,4}\s+(.*)$/.exec(line);
    if (heading) {
      out.push(<div key={idx} style={{ fontWeight: 700, fontSize: 14, margin: '12px 0 4px' }}>{bold(heading[1])}</div>);
      return;
    }
    if (line.trim() === '') { out.push(<div key={idx} style={{ height: 6 }} />); return; }
    out.push(<p key={idx} style={{ margin: '0 0 6px' }}>{bold(line)}</p>);
  });
  flush();

  return <>{out}</>;
}

function AiTab({ data, chat, onChatChange, lawDocument, onLawDocumentChange, onNav }: AiTabProps) {
  const { toast } = useToast();
  const { t, lang, locale } = useI18n();
  const [question, setQuestion] = useState('');
  const [attachedFile, setAttachedFile] = useState<InlineFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [useData, setUseData] = useState(true);
  const [classId, setClassId] = useState<string>('');
  const attachRef = useRef<HTMLInputElement>(null);
  const lawRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // La conversación crece hacia abajo: sin esto, cada respuesta nueva queda
  // fuera de la vista y hay que bajar a mano.
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [chat, loading]);

  const scopedStudents = classId
    ? data.students.filter(s => s.class_id === classId)
    : data.students;

  async function handleAttach(e: React.ChangeEvent<HTMLInputElement>, forLaw: boolean) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { toast(t('El archivo supera el límite de 19 MB')); return; }
    try {
      const inlineFile = await fileToBase64(file);
      if (forLaw) { onLawDocumentChange(inlineFile); toast(t('✅ Normativa adjuntada')); }
      else setAttachedFile(inlineFile);
    } catch {
      toast(t('No se pudo leer el archivo'));
    }
  }

  async function ask(rawText: string) {
    const text = rawText.trim();
    if (!text) { toast(t('Escribe una pregunta antes de consultar')); return; }
    if (loading) return;

    const files: InlineFile[] = [];
    if (attachedFile) files.push(attachedFile);
    if (lawDocument) files.push(lawDocument);

    // El historial guarda la pregunta limpia; la ficha de datos se añade solo
    // al mensaje que se manda ahora. Si se guardara dentro, cada turno
    // arrastraría una copia del cuaderno entero.
    const history: ChatTurn[] = chat.slice(-MEMORY_TURNS).map(m => ({ role: m.role, text: m.text }));
    const context = useData ? buildTeacherContext(data, { classId: classId || undefined, locale }) : '';
    const prompt = context
      ? `${context}\n\n=== PREGUNTA DEL DOCENTE ===\n${text}`
      : text;

    const afterUser: ChatMessage[] = [...chat, {
      id: crypto.randomUUID(), role: 'user', text, at: new Date().toISOString(),
    }];
    onChatChange(afterUser);
    setQuestion('');
    setAttachedFile(null);

    const result = await callGemini(
      chatSystemPrompt(lang, useData),
      prompt,
      files,
      { onStart: () => setLoading(true), onEnd: () => setLoading(false), onError: msg => toast(msg) },
      { history, maxOutputTokens: CHAT_MAX_TOKENS },
    );
    if (result === null) return;

    onChatChange([...afterUser, {
      id: crypto.randomUUID(), role: 'model', text: result, at: new Date().toISOString(),
    }]);
  }

  /** Preguntas de ejemplo hechas con los datos que el docente tiene de verdad. */
  const suggestions = (() => {
    const cls = classId ? data.classes.find(c => c.id === classId) : data.classes[0];
    if (!cls) return [t('¿Por dónde empiezo a montar mi cuaderno de notas?')];
    const alumno = data.students.find(s => s.class_id === cls.id)?.name.split(' ')[0];
    return [
      t('¿Cómo va {clase} en general?', { clase: cls.name }),
      t('¿Qué alumnos de {clase} van justos y qué haría con ellos?', { clase: cls.name }),
      alumno ? t('Resúmeme cómo va {alumno}', { alumno }) : t('¿Quién tiene más faltas?'),
      t('Propón actividades de refuerzo de {asignatura}', { asignatura: cls.subjects[0] }),
    ];
  })();

  return (
    <div className="ai-layout">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Aviso de clave sin configurar */}
        {!hasApiKey() && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
            background: 'rgba(245,158,11,0.09)', border: '0.5px solid rgba(245,158,11,0.35)',
            borderRadius: 12, fontSize: 13, color: '#92400e',
          }}>
            <Sparkles size={17} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, lineHeight: 1.5 }}>
              {t('Para usar la IA necesitas una clave gratuita de Google (se configura en 2 minutos).')}
            </span>
            <button className="btn-accent" style={{ fontSize: 12.5, padding: '7px 14px', flexShrink: 0 }} onClick={() => onNav('profile')}>
              {t('Configurar ahora')}
            </button>
          </div>
        )}

        {/* Alcance de la consulta */}
        <div className="card" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: 'var(--text)' }}>
              <input type="checkbox" checked={useData} onChange={e => setUseData(e.target.checked)} style={{ cursor: 'pointer' }} />
              <Database size={13} color="var(--accent-d)" />{t('Responder con mis datos')}
            </label>
            <select
              className="finput"
              value={classId}
              onChange={e => setClassId(e.target.value)}
              disabled={!useData}
              style={{ width: 'auto', minWidth: 190, padding: '6px 10px', fontSize: 12.5, cursor: 'pointer', opacity: useData ? 1 : 0.5 }}
            >
              <option value="">{t('Todas mis clases')}</option>
              {data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)', flex: 1, minWidth: 140 }}>
              {useData
                ? t('{clases} clases · {alumnos} alumnos a la vista', { clases: classId ? 1 : data.classes.length, alumnos: scopedStudents.length })
                : t('La IA no verá tu cuaderno')}
            </span>
            {chat.length > 0 && (
              <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 11px', gap: 6 }} onClick={() => onChatChange([])} type="button">
                <Trash2 size={12} />{t('Nueva conversación')}
              </button>
            )}
          </div>
        </div>

        {/* Conversación */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 380 }}>
          <div style={{ flex: 1, maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 }}>
            {chat.length === 0 && !loading && (
              <div style={{ margin: 'auto 0', textAlign: 'center', padding: '20px 10px' }}>
                <Brain size={30} color="var(--accent-d)" style={{ opacity: 0.5 }} />
                <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '10px 0 4px', fontWeight: 600 }}>
                  {t('Pregúntame sobre tu cuaderno')}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 16px', lineHeight: 1.5 }}>
                  {t('Con «Responder con mis datos» activado veo tus clases, notas y asistencia reales.')}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {suggestions.map(s => (
                    <button key={s} className="btn-ghost" style={{ fontSize: 12, padding: '7px 12px' }} onClick={() => ask(s)} type="button">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chat.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: m.role === 'user' ? '80%' : '100%',
                  background: m.role === 'user' ? 'var(--accent-l)' : 'var(--surface)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 12,
                  padding: '10px 14px',
                  fontSize: 13.5,
                  lineHeight: 1.65,
                  color: 'var(--text)',
                }}>
                  {m.role === 'user'
                    ? <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
                    : <RichText text={m.text} />}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-2)', fontSize: 13 }}>
                <span className="spin" /><span className="ia-generating">{t('Generando respuesta…')}</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Escribir */}
          <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
            <textarea
              className="finput"
              rows={2}
              placeholder={t('Escribe tu pregunta… (Intro envía, Mayús+Intro salta de línea)')}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(question); }
              }}
              style={{ resize: 'vertical', minHeight: 62 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn-ghost" style={{ fontSize: 12.5, gap: 6 }} onClick={() => attachRef.current?.click()} type="button">
                <Paperclip size={13} />{t('Adjuntar documento')}
              </button>
              {attachedFile && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-l)', borderRadius: 99,
                  padding: '3px 10px 3px 8px', fontSize: 12, color: 'var(--accent-d)', fontWeight: 600, maxWidth: 220, overflow: 'hidden',
                }}>
                  <FileText size={12} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFile.name}</span>
                  <button type="button" onClick={() => setAttachedFile(null)} aria-label={t('Quitar archivo adjunto')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0, marginLeft: 2, color: 'var(--accent-d)' }}>
                    <X size={12} />
                  </button>
                </div>
              )}
              <div style={{ flex: 1 }} />
              <button className="btn-ia" style={{ gap: 7, fontSize: 13.5 }} onClick={() => ask(question)} disabled={loading} type="button">
                {loading ? <><span className="spin" />{t('Consultando…')}</> : <><Send size={14} />{t('Enviar')}</>}
              </button>
            </div>
            <input ref={attachRef} type="file" style={{ display: 'none' }} onChange={e => handleAttach(e, false)} accept="*/*" />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Qué está viendo la IA */}
        <div className="card">
          <div className="card-hd">
            <div className="card-ttl"><Database size={14} color="var(--accent-d)" />{t('Lo que puede consultar')}</div>
          </div>
          {useData ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.75 }}>
              <li>{t('{n} clases', { n: classId ? 1 : data.classes.length })}</li>
              <li>{t('{n} alumnos con su media ponderada', { n: scopedStudents.length })}</li>
              <li>{t('{n} pruebas del cuaderno', { n: data.gradeItems.length })}</li>
              <li>{t('{n} evaluaciones con rúbrica o diana', { n: data.evaluations.length })}</li>
              <li>{t('Asistencia, agenda y tareas pendientes')}</li>
            </ul>
          ) : (
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0, lineHeight: 1.6 }}>
              {t('Ahora mismo responde solo con conocimiento general, sin mirar tu cuaderno.')}
            </p>
          )}
          <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '12px 0 0', lineHeight: 1.55 }}>
            {t('Estos datos se envían a Google solo al hacer una pregunta, y no se guardan en ningún servidor de Aula Pro.')}
          </p>
        </div>

        {/* Normativa de referencia */}
        <div className="card">
          <div className="card-hd">
            <div className="card-ttl"><BookOpen size={14} color="var(--accent-d)" />{t('Normativa de referencia')}</div>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.55 }}>
            {t('Adjunta el BOE o el currículo de tu comunidad y la IA lo tendrá en cuenta en todas sus respuestas.')}
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
              <button className="btn-ghost" style={{ padding: '7px 10px', flexShrink: 0 }} onClick={() => onLawDocumentChange(null)} type="button" aria-label={t('Quitar normativa')}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', gap: 7, fontSize: 13 }} onClick={() => lawRef.current?.click()} type="button">
              <Paperclip size={14} />{t('Adjuntar normativa (PDF…)')}
            </button>
          )}
          <input
            ref={lawRef} type="file" style={{ display: 'none' }} onChange={e => handleAttach(e, true)}
            accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════ Página ══════════════════ */

export function Notebook(props: Props) {
  const [tab, setTab] = useState<'grades' | 'ai'>('grades');
  const { t } = useI18n();

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Cuaderno de Notas')}</h1>
          <p className="pg-sub">{t('Calificaciones con media ponderada y asistente pedagógico')}</p>
        </div>
        <div className="tab-bar" style={{ marginBottom: 0, width: 'auto' }}>
          <button className={`tab-btn${tab === 'grades' ? ' active' : ''}`} style={{ padding: '8px 20px' }} onClick={() => setTab('grades')}>
            {t('Calificaciones')}
          </button>
          <button className={`tab-btn${tab === 'ai' ? ' active' : ''}`} style={{ padding: '8px 20px' }} onClick={() => setTab('ai')}>
            ✨ {t('Consulta IA')}
          </button>
        </div>
      </div>

      {tab === 'grades' ? <GradesTab {...props} /> : (
        <AiTab
          data={props.aiData}
          chat={props.chat}
          onChatChange={props.onChatChange}
          lawDocument={props.lawDocument}
          onLawDocumentChange={props.onLawDocumentChange}
          onNav={props.onNav}
        />
      )}
    </section>
  );
}
