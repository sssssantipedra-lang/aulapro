import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Target, X, Sparkles, ClipboardCheck } from 'lucide-react';
import type { EvalDiana, DianaItem, Evaluation, Class, Student } from '../types';
import type { InlineFile } from '../services/gemini';
import { callGemini, parseGeminiJson } from '../services/gemini';
import { isoDate } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { DianaBoard, dianaGrade, LEVEL_COLORS } from '../components/diana/DianaBoard';

interface Props {
  dianas: EvalDiana[];
  evaluations: Evaluation[];
  classes: Class[];
  students: Student[];
  lawDocument: InlineFile | null;
  onAddDiana: (d: EvalDiana) => void;
  onUpdateDiana: (d: EvalDiana) => void;
  onDeleteDiana: (id: string) => void;
  onAddEvaluation: (ev: Evaluation) => void;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function blankItem(): DianaItem {
  return { id: uid(), name: '', weight: 1 };
}

/* ═══════════════════ Modal crear / editar diana ═══════════════════ */

interface DianaModalProps {
  open: boolean;
  editing: EvalDiana | null;
  classes: Class[];
  lawDocument: InlineFile | null;
  onClose: () => void;
  onSave: (d: EvalDiana) => void;
}

function DianaModal({ open, editing, classes, lawDocument, onClose, onSave }: DianaModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'ia' | 'manual'>('ia');

  const [aiClassId, setAiClassId] = useState('');
  const [aiContext, setAiContext] = useState('');
  const [aiCount, setAiCount]     = useState(5);
  const [generating, setGenerating] = useState(false);

  const [name, setName]   = useState('');
  const [items, setItems] = useState<DianaItem[]>([blankItem()]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setMode('manual');
      setName(editing.name);
      setItems(editing.items.map(i => ({ ...i })));
      setAiContext(editing.context ?? '');
    } else {
      setMode('ia');
      setName('');
      setItems([blankItem()]);
      setAiContext('');
      setAiClassId('');
      setAiCount(5);
    }
  }, [editing, open]);

  async function handleGenerate() {
    if (!aiContext.trim()) { toast('Describe la actividad que quieres evaluar'); return; }
    const cls = classes.find(c => c.id === aiClassId);
    const className = cls ? `${cls.name} – ${cls.subject}` : 'sin clase concreta';

    const systemPrompt =
      'Eres un experto en evaluación competencial en secundaria (LOMLOE, España). Responde SOLO con JSON válido, sin texto adicional.';
    const userPrompt =
      `Crea una diana de evaluación para: ${aiContext.trim()}. Clase: ${className}. ` +
      `Genera exactamente ${aiCount} ítems observables y evaluables. ` +
      `Cada ítem lleva un "weight" (peso relativo, normalmente 1; usa 2 si el ítem es claramente más importante) ` +
      `y descriptores para los 4 niveles de logro (1=Insuficiente, 2=Suficiente, 3=Bien, 4=Excelente). ` +
      `Los nombres de los ítems deben ser breves (máximo 5 palabras). Todo en español de España. ` +
      `JSON: {"name":"...","items":[{"id":"it1","name":"...","weight":1,"descriptors":{"1":"...","2":"...","3":"...","4":"..."}}]}`;

    const files: InlineFile[] = lawDocument ? [lawDocument] : [];
    const raw = await callGemini(systemPrompt, userPrompt, files, {
      onStart: () => setGenerating(true),
      onEnd: () => setGenerating(false),
      onError: msg => toast(msg),
    });
    if (!raw) return;

    const parsed = parseGeminiJson<{ name: string; items: DianaItem[] }>(raw);
    if (!parsed?.items?.length) { toast('La IA no devolvió una diana válida. Vuelve a intentarlo.'); return; }

    setName(parsed.name || aiContext.trim());
    setItems(parsed.items.map(i => ({
      id: i.id || uid(),
      name: i.name ?? '',
      weight: typeof i.weight === 'number' && i.weight > 0 ? i.weight : 1,
      descriptors: i.descriptors,
    })));
    setMode('manual');
    toast('✅ Diana generada — revísala antes de guardar');
  }

  function handleSave() {
    const n = name.trim();
    if (!n) { toast('Ponle un nombre a la diana'); return; }
    const valid = items.filter(i => i.name.trim());
    if (valid.length < 3) { toast('La diana necesita al menos 3 ítems'); return; }
    onSave({
      id: editing?.id ?? 'dia' + Date.now(),
      name: n,
      context: aiContext.trim() || undefined,
      items: valid.map(i => ({ ...i, name: i.name.trim(), weight: i.weight > 0 ? i.weight : 1 })),
    });
    onClose();
  }

  const preview = items.filter(i => i.name.trim());

  return (
    <div className={`modal-overlay${open ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide" style={{ maxHeight: '92vh' }}>
        <div className="modal-hd">
          <div>
            <div className="modal-title">{editing ? 'Editar diana' : 'Nueva diana de evaluación'}</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3 }}>
              {mode === 'ia' ? 'Describe la actividad y la IA propone los ítems' : 'Ajusta los ítems y su peso en la nota'}
            </p>
          </div>
          <button className="ico-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <button className={mode === 'ia' ? 'btn-ia' : 'btn-ghost'} style={{ fontSize: 13, padding: '7px 14px' }} onClick={() => setMode('ia')}>
            <Sparkles size={13} />✨ Con IA
          </button>
          <button className={mode === 'manual' ? 'btn-accent' : 'btn-ghost'} style={{ fontSize: 13, padding: '7px 14px' }} onClick={() => setMode('manual')}>
            Manual
          </button>
        </div>

        {mode === 'ia' ? (
          <div>
            <div className="fgroup">
              <label className="flabel">Clase (opcional)</label>
              <select className="finput" value={aiClassId} onChange={e => setAiClassId(e.target.value)} style={{ cursor: 'pointer' }}>
                <option value="">Sin clase concreta</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} – {c.subject}</option>)}
              </select>
            </div>
            <div className="fgroup">
              <label className="flabel">¿Qué quieres evaluar? *</label>
              <textarea
                className="finput"
                rows={3}
                placeholder="Ej: Trabajo cooperativo en el proyecto de ecosistemas, 2º ESO"
                value={aiContext}
                onChange={e => setAiContext(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="fgroup">
              <label className="flabel">Número de ítems</label>
              <select className="finput" value={aiCount} onChange={e => setAiCount(Number(e.target.value))} style={{ cursor: 'pointer' }}>
                {[4, 5, 6, 8].map(n => <option key={n} value={n}>{n} ítems</option>)}
              </select>
            </div>
            <button
              className="btn-ia"
              disabled={!aiContext.trim() || generating}
              onClick={handleGenerate}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {generating ? <><span className="spin" />Generando diana…</> : <><Sparkles size={14} />✨ Generar diana</>}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 18, alignItems: 'start' }}>
            <div>
              <div className="fgroup">
                <label className="flabel">Nombre de la diana *</label>
                <input className="finput" placeholder="Ej: Trabajo cooperativo" value={name} onChange={e => setName(e.target.value)} />
              </div>

              <label className="flabel">Ítems a evaluar</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
                {items.map((item, idx) => (
                  <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', width: 18, flexShrink: 0 }}>{idx + 1}</span>
                    <input
                      className="finput"
                      placeholder="Nombre del ítem"
                      value={item.name}
                      onChange={e => setItems(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                      style={{ flex: 1 }}
                    />
                    <select
                      className="finput"
                      value={item.weight}
                      onChange={e => setItems(prev => prev.map((x, i) => i === idx ? { ...x, weight: Number(e.target.value) } : x))}
                      style={{ width: 104, flex: 'none', cursor: 'pointer' }}
                      title="Peso del ítem en la nota"
                    >
                      <option value={1}>Peso ×1</option>
                      <option value={2}>Peso ×2</option>
                      <option value={3}>Peso ×3</option>
                    </select>
                    {items.length > 1 && (
                      <button className="ico-btn" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} title="Quitar ítem">
                        <Trash2 size={14} color="var(--danger)" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setItems(prev => [...prev, blankItem()])}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', marginTop: 10,
                  padding: '8px 0', background: 'none', border: '1px dashed var(--border)',
                  borderRadius: 8, cursor: 'pointer', justifyContent: 'center',
                  fontSize: 12.5, color: 'var(--text-3)', fontFamily: 'var(--font)',
                }}
              >
                <Plus size={14} />Añadir ítem
              </button>
            </div>

            {/* Vista previa */}
            <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '16px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Vista previa
              </div>
              {preview.length >= 3 ? (
                <DianaBoard items={preview} scores={{}} onSetScore={() => {}} readOnly />
              ) : (
                <p style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '30px 10px', lineHeight: 1.5 }}>
                  Añade al menos 3 ítems para ver la diana
                </p>
              )}
            </div>
          </div>
        )}

        {mode === 'manual' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 18, paddingTop: 14, borderTop: '0.5px solid var(--border)' }}>
            <button className="btn-accent" onClick={handleSave}>{editing ? 'Guardar cambios' : 'Crear diana'}</button>
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════ Modal evaluar con diana ═══════════════════ */

interface DianaEvalProps {
  open: boolean;
  diana: EvalDiana | null;
  classes: Class[];
  students: Student[];
  onClose: () => void;
  onSave: (ev: Evaluation) => void;
}

function DianaEvalModal({ open, diana, classes, students, onClose, onSave }: DianaEvalProps) {
  const { toast } = useToast();
  const [classId, setClassId]   = useState('');
  const [studentId, setStudentId] = useState('');
  const [scores, setScores]     = useState<Record<string, number>>({});
  const [notes, setNotes]       = useState('');

  useEffect(() => {
    if (!open) return;
    setClassId('');
    setStudentId('');
    setScores({});
    setNotes('');
  }, [open, diana]);

  if (!diana) return null;

  const classStudents = students.filter(s => s.class_id === classId);
  const grade = dianaGrade(diana.items, scores);
  const done = diana.items.filter(i => scores[i.id]).length;

  function handleSave() {
    if (!studentId) { toast('Elige el alumno al que evalúas'); return; }
    if (done === 0) { toast('Marca al menos un ítem en la diana'); return; }
    const student = students.find(s => s.id === studentId);
    onSave({
      id: 'ev' + Date.now(),
      rubric_id: diana!.id,
      rubric_name: diana!.name,
      student_id: studentId,
      student_name: student?.name ?? '',
      class_id: classId,
      date: isoDate(),
      scores,
      notes,
      instrument: 'diana',
      grade: grade ?? undefined,
    });
    onClose();
  }

  return (
    <div className={`modal-overlay${open ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide" style={{ maxHeight: '92vh', width: 780 }}>
        <div className="modal-hd">
          <div>
            <div className="modal-title">{diana.name}</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3 }}>
              Haz clic en cada sector para marcar el nivel de logro
            </p>
          </div>
          <button className="ico-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="frow" style={{ marginBottom: 16 }}>
          <div className="fgroup" style={{ marginBottom: 0 }}>
            <label className="flabel">Clase</label>
            <select className="finput" value={classId} onChange={e => { setClassId(e.target.value); setStudentId(''); }} style={{ cursor: 'pointer' }}>
              <option value="">Selecciona clase…</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} – {c.subject}</option>)}
            </select>
          </div>
          <div className="fgroup" style={{ marginBottom: 0 }}>
            <label className="flabel">Alumno</label>
            <select className="finput" value={studentId} onChange={e => setStudentId(e.target.value)} disabled={!classId} style={{ cursor: 'pointer' }}>
              <option value="">Selecciona alumno…</option>
              {classStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 260px', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--surface)', borderRadius: 12, padding: '18px 12px' }}>
            <DianaBoard items={diana.items} scores={scores} onSetScore={(id, lv) => setScores(p => ({ ...p, [id]: p[id] === lv ? 0 : lv }))} />
            <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[1, 2, 3, 4].map(lv => (
                <span key={lv} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
                  padding: '3px 10px', borderRadius: 99, color: 'white', background: LEVEL_COLORS[lv].solid,
                }}>
                  {lv} · {LEVEL_COLORS[lv].label}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Nota calculada */}
            <div className="card" style={{ padding: '16px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Nota calculada
              </div>
              <div style={{
                fontSize: 40, fontWeight: 800, lineHeight: 1.15, margin: '4px 0 2px',
                color: grade === null ? 'var(--text-3)' : grade < 5 ? '#dc2626' : grade < 7 ? '#d97706' : '#047857',
              }}>
                {grade === null ? '—' : grade.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                {done}/{diana.items.length} ítems marcados
              </div>
            </div>

            {/* Detalle por ítem */}
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Ítems
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 190, overflowY: 'auto' }}>
                {diana.items.map(item => {
                  const lv = scores[item.id];
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}{item.weight > 1 && <span style={{ color: 'var(--accent-d)', fontWeight: 700 }}> ×{item.weight}</span>}
                      </span>
                      <span style={{
                        fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99, flexShrink: 0,
                        background: lv ? LEVEL_COLORS[lv].solid : 'var(--surface)',
                        color: lv ? 'white' : 'var(--text-3)',
                      }}>
                        {lv ? LEVEL_COLORS[lv].label : 'Sin marcar'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="fgroup" style={{ marginTop: 16 }}>
          <label className="flabel">Observaciones</label>
          <textarea
            className="finput" rows={2} placeholder="Comentarios para el alumno o la familia…"
            value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-accent" onClick={handleSave}>
            <ClipboardCheck size={14} />Guardar evaluación
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ Pestaña de dianas ═══════════════════ */

export function DianasTab({
  dianas, evaluations, classes, students, lawDocument,
  onAddDiana, onUpdateDiana, onDeleteDiana, onAddEvaluation,
}: Props) {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<EvalDiana | null>(null);
  const [evalOpen, setEvalOpen]   = useState(false);
  const [evalDiana, setEvalDiana] = useState<EvalDiana | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function openNew()  { setEditing(null); setModalOpen(true); }
  function openEdit(d: EvalDiana) { setEditing(d); setModalOpen(true); }
  function openEval(d: EvalDiana) { setEvalDiana(d); setEvalOpen(true); }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', flex: 1, lineHeight: 1.5 }}>
          Marca el nivel de logro de cada ítem y la nota sobre 10 se calcula sola.
        </p>
        <button className="btn-accent" onClick={openNew}>
          <Plus size={15} />Nueva diana
        </button>
      </div>

      {dianas.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Target size={40} style={{ margin: '0 auto 14px', opacity: 0.3 }} />
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: 'var(--text)' }}>Sin dianas todavía</div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 18, maxWidth: 420, margin: '0 auto 18px', lineHeight: 1.6 }}>
            Una diana es una forma visual y rápida de evaluar: describe la actividad,
            la IA propone los ítems y tú solo marcas el nivel alcanzado.
          </p>
          <button className="btn-ia" onClick={openNew} style={{ margin: '0 auto' }}>
            <Sparkles size={14} />✨ Crear mi primera diana
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {dianas.map(d => {
            const count = evaluations.filter(e => e.rubric_id === d.id && e.instrument === 'diana').length;
            return (
              <div key={d.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.name}
                    </div>
                    {d.context && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.context}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 2, marginLeft: 8, flexShrink: 0 }}>
                    <button className="ico-btn" onClick={() => openEdit(d)} title="Editar diana"><Pencil size={14} /></button>
                    <button className="ico-btn" onClick={() => setConfirmDelete(d.id)} title="Eliminar diana"><Trash2 size={14} color="var(--danger)" /></button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: 'var(--accent-l)', color: 'var(--accent-d)', fontWeight: 700 }}>
                    {d.items.length} ítems
                  </span>
                  <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: count > 0 ? '#dcfce7' : 'var(--surface)', color: count > 0 ? '#15803d' : 'var(--text-3)', fontWeight: 700 }}>
                    {count} {count === 1 ? 'evaluación' : 'evaluaciones'}
                  </span>
                </div>

                {/* Miniatura */}
                <div style={{ display: 'flex', justifyContent: 'center', flex: 1, alignItems: 'center', marginBottom: 12, transform: 'scale(0.62)', transformOrigin: 'center', height: 150 }}>
                  <DianaBoard items={d.items} scores={{}} onSetScore={() => {}} readOnly />
                </div>

                <button className="btn-accent" onClick={() => openEval(d)} style={{ justifyContent: 'center', width: '100%' }}>
                  <Target size={14} />Evaluar alumno
                </button>
              </div>
            );
          })}
        </div>
      )}

      <DianaModal
        open={modalOpen}
        editing={editing}
        classes={classes}
        lawDocument={lawDocument}
        onClose={() => setModalOpen(false)}
        onSave={d => {
          if (editing) { onUpdateDiana(d); toast('✅ Diana actualizada'); }
          else { onAddDiana(d); toast('✅ Diana creada'); }
        }}
      />

      <DianaEvalModal
        open={evalOpen}
        diana={evalDiana}
        classes={classes}
        students={students}
        onClose={() => setEvalOpen(false)}
        onSave={ev => { onAddEvaluation(ev); toast(`✅ Evaluación guardada — nota ${ev.grade?.toFixed(1).replace('.', ',')}`); }}
      />

      {/* Confirmar borrado */}
      <div className={`modal-overlay${confirmDelete ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
        <div className="modal">
          <div className="modal-hd">
            <div className="modal-title">Eliminar diana</div>
            <button className="ico-btn" onClick={() => setConfirmDelete(null)}><X size={18} /></button>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
            ¿Seguro que quieres eliminar esta diana? Las evaluaciones ya guardadas se conservan en el Historial.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn-accent"
              style={{ background: 'var(--danger)' }}
              onClick={() => { if (confirmDelete) { onDeleteDiana(confirmDelete); toast('Diana eliminada'); } setConfirmDelete(null); }}
            >
              Eliminar
            </button>
            <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
          </div>
        </div>
      </div>
    </>
  );
}
