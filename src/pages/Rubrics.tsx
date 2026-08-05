import { useState, useEffect, useRef } from 'react';
import {
  Plus, Pencil, Trash2, ClipboardCheck, X, Paperclip, Sparkles, ChevronDown, Copy,
} from 'lucide-react';
import type { Rubric, RubricCriterion, Evaluation, Class, Student, EvalDiana, GradeCategory, GradeTarget } from '../types';
import { GradeTargetPicker } from '../components/GradeTargetPicker';
import type { InlineFile } from '../services/gemini';
import { callGemini, parseGeminiJson } from '../services/gemini';
import { fileToBase64, isoDate, LEVELS, plural } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { DianasTab } from './EvalDianas';

/* ─── Props ─── */
interface Props {
  rubrics: Rubric[];
  dianas: EvalDiana[];
  evaluations: Evaluation[];
  classes: Class[];
  students: Student[];
  gradeCategories: GradeCategory[];
  lawDocument: InlineFile | null;
  onAddRubric: (r: Rubric) => void;
  onUpdateRubric: (r: Rubric) => void;
  onDeleteRubric: (id: string) => void;
  onAddDiana: (d: EvalDiana) => void;
  onUpdateDiana: (d: EvalDiana) => void;
  onDeleteDiana: (id: string) => void;
  onAddEvaluation: (ev: Evaluation) => void;
  defaultOpenEvalRubricId?: string;
  defaultOpenEvalStudentId?: string;
  defaultOpenEvalClassId?: string;
  onEvalOpened?: () => void;
}

/* ─── Internal types ─── */
type RubricMode = 'ia' | 'manual';

interface CriterionDraft {
  id: string;
  name: string;
  d1: string;
  d2: string;
  d3: string;
  d4: string;
}

/* ─── Helpers ─── */
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function blankCriterion(): CriterionDraft {
  return { id: uid(), name: '', d1: '', d2: '', d3: '', d4: '' };
}

function criterionToDescriptors(c: CriterionDraft): RubricCriterion {
  return {
    id: c.id,
    name: c.name,
    descriptors: {
      ...(c.d1 ? { 1: c.d1 } : {}),
      ...(c.d2 ? { 2: c.d2 } : {}),
      ...(c.d3 ? { 3: c.d3 } : {}),
      ...(c.d4 ? { 4: c.d4 } : {}),
    },
  };
}

function criterionFromRubric(c: RubricCriterion): CriterionDraft {
  return {
    id: c.id,
    name: c.name,
    d1: c.descriptors[1] ?? '',
    d2: c.descriptors[2] ?? '',
    d3: c.descriptors[3] ?? '',
    d4: c.descriptors[4] ?? '',
  };
}

const MAX_FILE_BYTES = 19 * 1024 * 1024; // 19 MB

/* ═══════════════════════════════════════════════════════════════════════════
   RUBRIC MODAL (create / edit)
═══════════════════════════════════════════════════════════════════════════ */
interface RubricModalProps {
  open: boolean;
  editing: Rubric | null;
  classes: Class[];
  gradeCategories: GradeCategory[];
  lawDocument: InlineFile | null;
  onClose: () => void;
  onSave: (r: Rubric) => void;
}

function RubricModal({ open, editing, classes, gradeCategories, lawDocument, onClose, onSave }: RubricModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<RubricMode>('ia');

  /* AI state */
  const [aiClassId, setAiClassId] = useState('');
  const [aiContext, setAiContext] = useState('');
  const [aiCount, setAiCount] = useState(4);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPreview, setAiPreview] = useState<{ name: string; criteria: RubricCriterion[] } | null>(null);

  /* Manual state */
  const [manualName, setManualName] = useState('');
  const [manualCriteria, setManualCriteria] = useState<CriterionDraft[]>([blankCriterion()]);

  /* A qué clase pertenece y dónde caen sus notas */
  const [target, setTarget] = useState<GradeTarget>({});

  /* Populate when editing */
  useEffect(() => {
    if (editing) {
      setMode('manual');
      setManualName(editing.name);
      setManualCriteria(editing.criteria.map(criterionFromRubric));
      setAiContext(editing.context ?? '');
      setAiPreview(null);
      setTarget({
        class_id: editing.class_id, subject: editing.subject, category_id: editing.category_id,
      });
    } else {
      setMode('ia');
      setManualName('');
      setManualCriteria([blankCriterion()]);
      setAiContext('');
      setAiClassId('');
      setAiCount(4);
      setAiPreview(null);
      setTarget({});
    }
  }, [editing, open]);

  /* ── AI generate ── */
  async function handleGenerate() {
    if (!aiContext.trim()) return;
    const cls = classes.find(c => c.id === aiClassId);
    const className = cls ? `${cls.name} – ${cls.subject}` : 'Clase no especificada';
    const systemPrompt = 'Eres un experto en evaluación educativa. Responde SOLO con JSON válido.';
    const userPrompt =
      `Crea una rúbrica para: ${aiContext.trim()}. Clase: ${className}. ` +
      `Genera ${aiCount} criterios con descriptores para cada nivel (1=Insuficiente, 2=Suficiente, 3=Bien, 4=Excelente). ` +
      `JSON: {"name":"...","criteria":[{"id":"cr1","name":"...","descriptors":{"1":"...","2":"...","3":"...","4":"..."}}]}`;

    const files: InlineFile[] = lawDocument ? [lawDocument] : [];
    const raw = await callGemini(systemPrompt, userPrompt, files, {
      onStart: () => setAiGenerating(true),
      onEnd: () => setAiGenerating(false),
      onError: msg => toast(msg),
    });
    if (!raw) return;
    const parsed = parseGeminiJson<{ name: string; criteria: RubricCriterion[] }>(raw);
    if (parsed) setAiPreview(parsed);
    else toast('La IA no devolvió una rúbrica válida. Vuelve a intentarlo.');
  }

  function applyPreview() {
    if (!aiPreview) return;
    setManualName(aiPreview.name);
    setManualCriteria(aiPreview.criteria.map(criterionFromRubric));
    setMode('manual');
    setAiPreview(null);
  }

  /* ── Manual helpers ── */
  function updateCriterion(idx: number, field: keyof CriterionDraft, value: string) {
    setManualCriteria(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  function addCriterion() {
    setManualCriteria(prev => [...prev, blankCriterion()]);
  }

  function removeCriterion(idx: number) {
    setManualCriteria(prev => prev.filter((_, i) => i !== idx));
  }

  /* ── Save ── */
  function handleSave() {
    const name = manualName.trim();
    if (!name) return;
    const criteria = manualCriteria
      .filter(c => c.name.trim())
      .map(criterionToDescriptors);
    if (criteria.length === 0) return;

    const rubric: Rubric = {
      id: editing?.id ?? 'rub' + Date.now(),
      name,
      context: aiContext.trim() || undefined,
      criteria,
      ...target,
    };
    onSave(rubric);
    onClose();
  }

  const canSave = manualName.trim() && manualCriteria.some(c => c.name.trim());

  return (
    <div className={`modal-overlay${open ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide" style={{ maxHeight: '92vh' }}>
        {/* Header */}
        <div className="modal-hd">
          <div>
            <div className="modal-title">{editing ? 'Editar rúbrica' : 'Nueva rúbrica'}</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3 }}>
              {mode === 'ia' ? 'Genera criterios con IA' : 'Define los criterios manualmente'}
            </p>
          </div>
          <button className="ico-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <button
            className={mode === 'ia' ? 'btn-ia' : 'btn-ghost'}
            style={{ fontSize: 13, padding: '7px 14px' }}
            onClick={() => setMode('ia')}
          >
            <Sparkles size={13} />✨ IA
          </button>
          <button
            className={mode === 'manual' ? 'btn-accent' : 'btn-ghost'}
            style={{ fontSize: 13, padding: '7px 14px' }}
            onClick={() => setMode('manual')}
          >
            Manual
          </button>
        </div>

        <GradeTargetPicker
          value={target}
          onChange={setTarget}
          classes={classes}
          gradeCategories={gradeCategories}
        />

        {/* ── AI MODE ── */}
        {mode === 'ia' && (
          <div>
            <div className="fgroup">
              <label className="flabel">Clase (opcional)</label>
              <select className="finput" value={aiClassId} onChange={e => setAiClassId(e.target.value)}>
                <option value="">Sin clase específica</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} – {c.subject}</option>
                ))}
              </select>
            </div>
            <div className="fgroup">
              <label className="flabel">Contexto de la actividad *</label>
              <textarea
                className="finput"
                rows={3}
                placeholder="Ej: Presentación oral sobre la Revolución Francesa, 2º ESO..."
                value={aiContext}
                onChange={e => setAiContext(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="frow" style={{ marginBottom: 16 }}>
              <div className="fgroup" style={{ marginBottom: 0 }}>
                <label className="flabel">Número de criterios</label>
                <select className="finput" value={aiCount} onChange={e => setAiCount(Number(e.target.value))}>
                  {[3, 4, 5, 6].map(n => <option key={n} value={n}>{n} criterios</option>)}
                </select>
              </div>
            </div>
            <button
              className="btn-ia"
              disabled={!aiContext.trim() || aiGenerating}
              onClick={handleGenerate}
              style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}
            >
              {aiGenerating ? <><span className="spin" />Generando...</> : <><Sparkles size={14} />✨ Generar rúbrica</>}
            </button>

            {/* Preview */}
            {aiPreview && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface)' }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, color: 'var(--text)' }}>
                  Vista previa: {aiPreview.name}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {aiPreview.criteria.map((cr, i) => (
                    <div key={cr.id} style={{ background: 'white', borderRadius: 8, padding: '10px 12px', border: '0.5px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{i + 1}. {cr.name}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                        {LEVELS.map(lv => (
                          <div key={lv.value} style={{ fontSize: 11, color: 'var(--text-2)', padding: '4px 6px', background: 'var(--surface)', borderRadius: 5 }}>
                            <span style={{ fontWeight: 700, display: 'block', marginBottom: 2, color: 'var(--text)' }}>{lv.label}</span>
                            {cr.descriptors[lv.value as 1 | 2 | 3 | 4] ?? '—'}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn-accent" onClick={applyPreview} style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>
                  Aplicar y editar
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── MANUAL MODE ── */}
        {mode === 'manual' && (
          <div>
            <div className="fgroup">
              <label className="flabel">Nombre de la rúbrica *</label>
              <input
                className="finput"
                placeholder="Ej: Exposición oral"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
              {manualCriteria.map((cr, idx) => (
                <div key={cr.id} style={{ border: '0.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', flexShrink: 0 }}>#{idx + 1}</span>
                    <input
                      className="finput"
                      placeholder="Nombre del criterio"
                      value={cr.name}
                      onChange={e => updateCriterion(idx, 'name', e.target.value)}
                      style={{ flex: 1 }}
                    />
                    {manualCriteria.length > 1 && (
                      <button className="ico-btn" onClick={() => removeCriterion(idx)} title="Eliminar criterio">
                        <Trash2 size={14} color="var(--danger)" />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {[
                      { field: 'd1' as const, label: 'Insuficiente', color: '#ef4444' },
                      { field: 'd2' as const, label: 'Suficiente', color: '#f59e0b' },
                      { field: 'd3' as const, label: 'Bien', color: '#3b82f6' },
                      { field: 'd4' as const, label: 'Excelente', color: '#10b981' },
                    ].map(({ field, label, color }) => (
                      <div key={field}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color, marginBottom: 4 }}>{label}</div>
                        <textarea
                          className="finput"
                          rows={2}
                          placeholder="Descriptor..."
                          value={cr[field]}
                          onChange={e => updateCriterion(idx, field, e.target.value)}
                          style={{ resize: 'none', fontSize: 12, padding: '7px 10px' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%', marginTop: 10,
                padding: '8px 0', background: 'none', border: '1px dashed var(--border)',
                borderRadius: 8, cursor: 'pointer', justifyContent: 'center',
                fontSize: 12.5, color: 'var(--text-3)', fontFamily: 'var(--font)',
              }}
              onClick={addCriterion}
            >
              <Plus size={14} />Añadir criterio
            </button>
          </div>
        )}

        {/* Footer */}
        {mode === 'manual' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 18, paddingTop: 14, borderTop: '0.5px solid var(--border)' }}>
            <button className="btn-accent" disabled={!canSave} onClick={handleSave}>
              {editing ? 'Guardar cambios' : 'Crear rúbrica'}
            </button>
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EVAL MODAL
═══════════════════════════════════════════════════════════════════════════ */
interface EvalModalProps {
  open: boolean;
  rubric: Rubric | null;
  classes: Class[];
  students: Student[];
  lawDocument: InlineFile | null;
  defaultClassId?: string;
  defaultStudentId?: string;
  onClose: () => void;
  onSave: (ev: Evaluation) => void;
}

function EvalModal({
  open, rubric, classes, students, lawDocument,
  defaultClassId, defaultStudentId,
  onClose, onSave,
}: EvalModalProps) {
  const { toast } = useToast();
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');

  /* AI work evaluation */
  const [workDesc, setWorkDesc] = useState('');
  const [workFile, setWorkFile] = useState<InlineFile | null>(null);
  const [workFileErr, setWorkFileErr] = useState('');
  const [evalGenerating, setEvalGenerating] = useState(false);
  const [obsGenerating, setObsGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Reset when rubric/modal changes */
  useEffect(() => {
    if (!open || !rubric) return;
    setScores({});
    setNotes('');
    setWorkDesc('');
    setWorkFile(null);
    setWorkFileErr('');
    setClassId(defaultClassId ?? '');
    setStudentId(defaultStudentId ?? '');
  }, [open, rubric, defaultClassId, defaultStudentId]);

  const classStudents = students.filter(s => s.class_id === classId);

  const totalScore = rubric
    ? rubric.criteria.reduce((sum, cr) => sum + (scores[cr.id] ?? 0), 0)
    : 0;
  const maxScore = (rubric?.criteria.length ?? 0) * 4;

  /* ── File attach ── */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setWorkFileErr('El archivo supera el límite de 19 MB.');
      return;
    }
    setWorkFileErr('');
    const b64 = await fileToBase64(file);
    setWorkFile(b64);
    e.target.value = '';
  }

  /* ── AI evaluate work ── */
  async function handleEvalWithAI() {
    if (!rubric) return;
    const criteriaText = rubric.criteria
      .map(cr => {
        const descs = LEVELS
          .map(lv => `${lv.label}: ${cr.descriptors[lv.value as 1 | 2 | 3 | 4] ?? '(sin descriptor)'}`)
          .join('; ');
        return `- id:"${cr.id}" nombre:"${cr.name}" → ${descs}`;
      })
      .join('\n');

    const systemPrompt = 'Eres un experto en evaluación educativa. Responde SOLO con JSON válido.';
    const userPrompt =
      `Evalúa el siguiente trabajo de un alumno usando esta rúbrica.\n\n` +
      `CRITERIOS:\n${criteriaText}\n\n` +
      `DESCRIPCIÓN DEL TRABAJO:\n${workDesc || '(sin descripción)'}\n\n` +
      (workFile ? 'Se adjunta el archivo del trabajo.\n\n' : '') +
      `Devuelve un JSON con este formato exacto:\n` +
      `{"scores":{"<id_criterio>": <número_1_a_4>, ...},"observation":"<texto de observación general>"}`;

    const files: InlineFile[] = [workFile, lawDocument].filter((f): f is InlineFile => f !== null);

    const raw = await callGemini(systemPrompt, userPrompt, files, {
      onStart: () => setEvalGenerating(true),
      onEnd: () => setEvalGenerating(false),
      onError: msg => toast(msg),
    });
    if (!raw) return;

    const parsed = parseGeminiJson<{ scores: Record<string, number>; observation: string }>(raw);
    if (!parsed) { toast('La IA no devolvió una evaluación válida. Vuelve a intentarlo.'); return; }

    // Apply scores, clamped to 1–4
    const newScores: Record<string, number> = {};
    rubric.criteria.forEach(cr => {
      const v = parsed.scores[cr.id];
      if (typeof v === 'number') newScores[cr.id] = Math.min(4, Math.max(1, Math.round(v)));
    });
    setScores(newScores);
    if (parsed.observation) setNotes(parsed.observation);
  }

  /* ── AI generate observation ── */
  async function handleGenerateObs() {
    if (!rubric) return;
    const scoreLines = rubric.criteria
      .map(cr => {
        const sc = scores[cr.id];
        const lv = LEVELS.find(l => l.value === sc);
        return `- ${cr.name}: ${lv ? lv.label : 'No evaluado'}`;
      })
      .join('\n');

    const systemPrompt = 'Eres un experto en evaluación educativa. Responde SOLO con texto de observación, sin JSON.';
    const userPrompt =
      `Genera una observación breve (2-3 frases) para un alumno con estos resultados en la rúbrica "${rubric.name}":\n${scoreLines}\n\nSé constructivo y específico.`;

    const raw = await callGemini(systemPrompt, userPrompt, [], {
      onStart: () => setObsGenerating(true),
      onEnd: () => setObsGenerating(false),
      onError: msg => toast(msg),
    });
    if (raw) setNotes(raw.trim());
  }

  /* ── Save ── */
  function handleSave() {
    if (!rubric || !studentId) return;
    const student = students.find(s => s.id === studentId);
    const ev: Evaluation = {
      id: 'ev' + Date.now(),
      rubric_id: rubric.id,
      rubric_name: rubric.name,
      student_id: studentId,
      student_name: student?.name ?? '',
      class_id: classId,
      date: isoDate(),
      scores,
      notes,
    };
    onSave(ev);
    onClose();
  }

  const canSave = !!studentId && Object.keys(scores).length > 0;

  if (!rubric) return null;

  return (
    <div className={`modal-overlay${open ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide" style={{ maxHeight: '92vh', width: 760 }}>
        {/* Header */}
        <div className="modal-hd">
          <div>
            <div className="modal-title">{rubric.name}</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3 }}>
              Haz clic en el nivel para cada criterio
            </p>
          </div>
          <button className="ico-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Class + Student selectors */}
        <div className="frow" style={{ marginBottom: 16 }}>
          <div className="fgroup" style={{ marginBottom: 0 }}>
            <label className="flabel">Clase</label>
            <select
              className="finput"
              value={classId}
              onChange={e => { setClassId(e.target.value); setStudentId(''); }}
            >
              <option value="">Selecciona clase...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} – {c.subject}</option>)}
            </select>
          </div>
          <div className="fgroup" style={{ marginBottom: 0 }}>
            <label className="flabel">Alumno</label>
            <select
              className="finput"
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              disabled={!classId}
            >
              <option value="">Selecciona alumno...</option>
              {classStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Rubric table */}
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table className="rtable">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 140 }}>Criterio</th>
                {LEVELS.map(lv => (
                  <th key={lv.value} style={{ width: '18%' }}>{lv.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rubric.criteria.map(cr => (
                <tr key={cr.id}>
                  <td style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', verticalAlign: 'top', paddingTop: 10 }}>
                    {cr.name}
                  </td>
                  {LEVELS.map(lv => {
                    const selected = scores[cr.id] === lv.value;
                    const desc = cr.descriptors[lv.value as 1 | 2 | 3 | 4];
                    return (
                      <td key={lv.value} style={{ verticalAlign: 'top' }}>
                        <div
                          className={`level-cell ${lv.key}${selected ? ' selected' : ''}`}
                          onClick={() => setScores(prev => ({ ...prev, [cr.id]: lv.value }))}
                        >
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{lv.value}</div>
                          {desc && <div className="level-cell-desc">{desc}</div>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AI work evaluation section */}
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px 16px', marginBottom: 14, border: '0.5px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color="var(--accent-d)" />✨ Evaluar trabajo con IA
          </div>
          <div className="fgroup" style={{ marginBottom: 10 }}>
            <label className="flabel">Descripción del trabajo</label>
            <textarea
              id="em-work-desc"
              className="finput"
              rows={2}
              placeholder="Describe brevemente el trabajo del alumno..."
              value={workDesc}
              onChange={e => setWorkDesc(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* File attach */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <button
              className="btn-ghost"
              style={{ fontSize: 12.5, padding: '6px 12px' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={13} />Adjuntar archivo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {workFile && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(var(--accent-rgb),0.1)',
                color: 'var(--accent-d)', borderRadius: 99, padding: '4px 10px', fontSize: 12, fontWeight: 600,
              }}>
                <Paperclip size={11} />
                {workFile.name}
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}
                  onClick={() => setWorkFile(null)}
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {workFileErr && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{workFileErr}</span>}
          </div>

          <button
            className="btn-ia"
            disabled={(!workDesc.trim() && !workFile) || evalGenerating}
            onClick={handleEvalWithAI}
            style={{ fontSize: 12.5 }}
          >
            {evalGenerating
              ? <><span className="spin" />Evaluando...</>
              : <><Sparkles size={13} />✨ Evaluar con IA</>}
          </button>
        </div>

        {/* Observations */}
        <div className="fgroup">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label className="flabel" style={{ marginBottom: 0 }}>Observaciones</label>
            <button
              className="btn-ia btn-ia-sm"
              disabled={Object.keys(scores).length === 0 || obsGenerating}
              onClick={handleGenerateObs}
            >
              {obsGenerating
                ? <><span className="spin" />Generando...</>
                : <><Sparkles size={11} />✨ Generar con IA</>}
            </button>
          </div>
          <textarea
            className="finput"
            rows={3}
            placeholder="Escribe observaciones sobre el alumno..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Total + Save */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>Puntuación total:</span>
            <span className="score-pill">{totalScore} / {maxScore}</span>
            {maxScore > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                ({Math.round((totalScore / maxScore) * 100)}%)
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-accent" disabled={!canSave} onClick={handleSave}>
              <ClipboardCheck size={14} />Guardar evaluación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export function Rubrics({
  rubrics, dianas, evaluations, classes, students, gradeCategories, lawDocument,
  onAddRubric, onUpdateRubric, onDeleteRubric,
  onAddDiana, onUpdateDiana, onDeleteDiana, onAddEvaluation,
  defaultOpenEvalRubricId, defaultOpenEvalStudentId, defaultOpenEvalClassId,
  onEvalOpened,
}: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'rubrics' | 'dianas'>('rubrics');
  const [rubricModalOpen, setRubricModalOpen] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Rubric | null>(null);

  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalRubric, setEvalRubric] = useState<Rubric | null>(null);
  const [evalDefaultClassId, setEvalDefaultClassId] = useState<string | undefined>();
  const [evalDefaultStudentId, setEvalDefaultStudentId] = useState<string | undefined>();

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  /* Open eval modal from defaults (e.g. navigated from Dashboard) */
  useEffect(() => {
    if (defaultOpenEvalRubricId) {
      const r = rubrics.find(r => r.id === defaultOpenEvalRubricId);
      if (r) {
        setEvalRubric(r);
        setEvalDefaultClassId(defaultOpenEvalClassId);
        setEvalDefaultStudentId(defaultOpenEvalStudentId);
        setEvalModalOpen(true);
        onEvalOpened?.();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOpenEvalRubricId]);

  function openNewRubric() {
    setEditingRubric(null);
    setRubricModalOpen(true);
  }

  function openEditRubric(r: Rubric) {
    setEditingRubric(r);
    setRubricModalOpen(true);
  }

  function openEval(r: Rubric) {
    setEvalRubric(r);
    setEvalDefaultClassId(undefined);
    setEvalDefaultStudentId(undefined);
    setEvalModalOpen(true);
  }

  function handleSaveRubric(r: Rubric) {
    if (editingRubric) onUpdateRubric(r);
    else onAddRubric(r);
  }

  function handleSaveEval(ev: Evaluation) {
    onAddEvaluation(ev);
  }

  function handleDelete(id: string) {
    onDeleteRubric(id);
    setConfirmDeleteId(null);
  }

  /**
   * Copia con id nuevo, y por tanto con columna propia en el cuaderno.
   * Es la forma de reutilizar los mismos criterios en otro trimestre sin que
   * la evaluación nueva sobrescriba la anterior.
   */
  function duplicateRubric(r: Rubric) {
    onAddRubric({
      ...r,
      id: 'rub' + Date.now(),
      name: `${r.name} (copia)`,
      criteria: r.criteria.map(c => ({ ...c, id: 'cr' + Math.random().toString(36).slice(2, 9) })),
    });
    toast('✅ Rúbrica duplicada, con su propia columna en el cuaderno');
  }

  return (
    <section className="sec active">
      {/* Page header */}
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">Evaluación</h1>
          <p className="pg-sub">
            {plural(rubrics.length, 'rúbrica', 'rúbricas')} · {plural(dianas.length, 'diana', 'dianas')} · {plural(evaluations.length, 'evaluación', 'evaluaciones')}
          </p>
        </div>
        <div className="tab-bar" style={{ marginBottom: 0, width: 'auto' }}>
          <button className={`tab-btn${tab === 'rubrics' ? ' active' : ''}`} style={{ padding: '8px 20px' }} onClick={() => setTab('rubrics')}>
            Rúbricas
          </button>
          <button className={`tab-btn${tab === 'dianas' ? ' active' : ''}`} style={{ padding: '8px 20px' }} onClick={() => setTab('dianas')}>
            Dianas
          </button>
        </div>
      </div>

      {tab === 'dianas' ? (
        <DianasTab
          dianas={dianas}
          evaluations={evaluations}
          classes={classes}
          students={students}
          gradeCategories={gradeCategories}
          lawDocument={lawDocument}
          onAddDiana={onAddDiana}
          onUpdateDiana={onUpdateDiana}
          onDeleteDiana={onDeleteDiana}
          onAddEvaluation={onAddEvaluation}
        />
      ) : (
      <>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', flex: 1, lineHeight: 1.5 }}>
          Define criterios con descriptores por nivel y evalúa marcando la casilla que corresponda.
        </p>
        <button className="btn-accent" onClick={openNewRubric}>
          <Plus size={15} />Nueva rúbrica
        </button>
      </div>

      {/* Rubric list */}
      {rubrics.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-3)' }}>
          <ClipboardCheck size={40} style={{ margin: '0 auto 14px', opacity: 0.3 }} />
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Sin rúbricas todavía</div>
          <p style={{ fontSize: 13, marginBottom: 18 }}>
            Crea tu primera rúbrica manualmente o con ayuda de la IA.
          </p>
          <button className="btn-ia" onClick={openNewRubric} style={{ margin: '0 auto' }}>
            <Sparkles size={14} />✨ Crear rúbrica
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {rubrics.map(r => {
            const evCount = evaluations.filter(e => e.rubric_id === r.id).length;
            return (
              <div key={r.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </div>
                    {r.context && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.context}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 2, marginLeft: 8, flexShrink: 0 }}>
                    <button className="ico-btn" onClick={() => openEditRubric(r)} title="Editar rúbrica">
                      <Pencil size={14} />
                    </button>
                    <button className="ico-btn" onClick={() => duplicateRubric(r)} title="Duplicar rúbrica">
                      <Copy size={14} />
                    </button>
                    <button
                      className="ico-btn"
                      onClick={() => setConfirmDeleteId(r.id)}
                      title="Eliminar rúbrica"
                    >
                      <Trash2 size={14} color="var(--danger)" />
                    </button>
                  </div>
                </div>

                {/* Stats chips */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: 'var(--accent-l)', color: 'var(--accent-d)', fontWeight: 700 }}>
                    {r.criteria.length} criterio{r.criteria.length !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: evCount > 0 ? '#dcfce7' : 'var(--surface)', color: evCount > 0 ? '#15803d' : 'var(--text-3)', fontWeight: 700 }}>
                    {plural(evCount, 'evaluación', 'evaluaciones')}
                  </span>
                </div>

                {/* Criteria preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14, flex: 1 }}>
                  {r.criteria.slice(0, 3).map(cr => (
                    <div key={cr.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-2)' }}>
                      <ChevronDown size={11} style={{ transform: 'rotate(-90deg)', flexShrink: 0, color: 'var(--accent-d)' }} />
                      {cr.name}
                    </div>
                  ))}
                  {r.criteria.length > 3 && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', paddingLeft: 18 }}>
                      +{r.criteria.length - 3} más
                    </div>
                  )}
                </div>

                {/* Evaluar button */}
                <button className="btn-accent" onClick={() => openEval(r)} style={{ justifyContent: 'center', width: '100%' }}>
                  <ClipboardCheck size={14} />Evaluar alumno
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent evaluations */}
      {evaluations.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-hd">
            <div className="card-ttl"><ClipboardCheck size={14} color="var(--accent-d)" />Evaluaciones recientes</div>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{evaluations.length} total</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rtable">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Alumno</th>
                  <th style={{ textAlign: 'left' }}>Rúbrica</th>
                  <th>Fecha</th>
                  <th>Puntuación</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.slice(0, 10).map(ev => {
                  const rubric = rubrics.find(r => r.id === ev.rubric_id);
                  const maxPts = (rubric?.criteria.length ?? Object.keys(ev.scores).length) * 4;
                  const total = Object.values(ev.scores).reduce((a, b) => a + b, 0);
                  const isDiana = ev.instrument === 'diana';
                  return (
                    <tr key={ev.id}>
                      <td style={{ fontWeight: 700, fontSize: 13 }}>{ev.student_name}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-2)' }}>
                        {ev.rubric_name}
                        {isDiana && (
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 99, background: 'var(--accent-l)', color: 'var(--accent-d)' }}>
                            DIANA
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-3)' }}>{ev.date}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="score-pill">
                          {isDiana && typeof ev.grade === 'number'
                            ? `${ev.grade.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/10`
                            : `${total}/${maxPts}`}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}

      {/* Rubric modal */}
      <RubricModal
        open={rubricModalOpen}
        editing={editingRubric}
        classes={classes}
        gradeCategories={gradeCategories}
        lawDocument={lawDocument}
        onClose={() => setRubricModalOpen(false)}
        onSave={handleSaveRubric}
      />

      {/* Eval modal */}
      <EvalModal
        open={evalModalOpen}
        rubric={evalRubric}
        classes={classes}
        students={students}
        lawDocument={lawDocument}
        defaultClassId={evalDefaultClassId}
        defaultStudentId={evalDefaultStudentId}
        onClose={() => setEvalModalOpen(false)}
        onSave={handleSaveEval}
      />

      {/* Delete confirm */}
      <div className={`modal-overlay${confirmDeleteId ? ' open' : ''}`} onClick={() => setConfirmDeleteId(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-hd">
            <div className="modal-title">Eliminar rúbrica</div>
            <button className="ico-btn" onClick={() => setConfirmDeleteId(null)}><X size={18} /></button>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20 }}>
            ¿Seguro que quieres eliminar esta rúbrica? Las evaluaciones asociadas no se borrarán.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn-accent"
              style={{ background: 'var(--danger)' }}
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            >
              Eliminar
            </button>
            <button className="btn-ghost" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
          </div>
        </div>
      </div>
    </section>
  );
}
