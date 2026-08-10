import { useRef, useState } from 'react';
import {
  BookMarked, Sparkles, Plus, Trash2, Paperclip, X, ClipboardList, Check, ArrowRight, FileText,
  FileDown, FileType2, Target, Layers,
} from 'lucide-react';
import type { Class, LearningSituation, Rubric, EvalDiana, Ficha, GradeCategory } from '../types';
import { DEFAULT_LEVELS } from '../types';
import {
  analyzeDocument, generateSda, generateSdaRubric, generateSdaDiana,
  type SdaContent, type SdaRubricRow, type SdaDianaItem,
} from '../services/learningSituations';
import { generateFichaFromSda, type FichaContent } from '../services/resources';
import { saveSdaPdf, saveSdaDocx } from '../services/exportSda';
import { hasApiKey, type InlineFile } from '../services/gemini';
import { fileToBase64, isoDate } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';
import { Modal } from '../components/ui/Modal';
import { isDesktop } from '../services/storage';

const MAX_FILE_BYTES = 19 * 1024 * 1024; // 19 MB

interface Props {
  classes: Class[];
  gradeCategories: GradeCategory[];
  learningSituations: LearningSituation[];
  teacherName: string;
  onSave: (s: LearningSituation) => void;
  onDelete: (id: string) => void;
  onAddRubric: (r: Rubric) => void;
  onAddDiana: (d: EvalDiana) => void;
  onAddFicha: (f: Ficha) => void;
  onNav: (s: string) => void;
}

/** Documento de apoyo ya resumido por la IA. */
interface DocSummary {
  id: string;
  nombre: string;
  resumen: string;
}

function newId() {
  return 'sda' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Campo de texto largo, editable, con su etiqueta. */
function Field({
  label, value, onChange, rows = 3,
}: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="fgroup">
      <label className="flabel">{label}</label>
      <textarea
        className="finput" rows={rows} value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={{ resize: 'vertical' }}
      />
    </div>
  );
}

export function LearningSituations({
  classes, gradeCategories, learningSituations, teacherName,
  onSave, onDelete, onAddRubric, onAddDiana, onAddFicha, onNav,
}: Props) {
  const { toast } = useToast();
  const { t, lang, locale } = useI18n();

  /* ── Formulario ── */
  const [classId, setClassId] = useState('');
  const [idea, setIdea] = useState('');
  const [numero, setNumero] = useState('1');
  const [temporalizacion, setTemporalizacion] = useState('');
  const [meses, setMeses] = useState('');
  const [nivel, setNivel] = useState('');
  const [contextoClase, setContextoClase] = useState('');
  const [metodologia, setMetodologia] = useState('');
  const [numSesiones, setNumSesiones] = useState(6);
  const [areas, setAreas] = useState<string[]>([]);

  /* ── Documentos de apoyo ── */
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Resultado ── */
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState<SdaContent | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  /* ── Rúbrica ── */
  const [rubricRows, setRubricRows] = useState<SdaRubricRow[] | null>(null);
  const [rubricDetails, setRubricDetails] = useState('');
  const [rubricBusy, setRubricBusy] = useState(false);
  const [rubricModal, setRubricModal] = useState(false);
  const [rubricClassId, setRubricClassId] = useState('');
  const [rubricSubject, setRubricSubject] = useState('');
  const [rubricCategory, setRubricCategory] = useState('');

  /* ── Diana ── */
  const [dianaRows, setDianaRows] = useState<SdaDianaItem[] | null>(null);
  const [dianaDetails, setDianaDetails] = useState('');
  const [dianaBusy, setDianaBusy] = useState(false);
  const [dianaModal, setDianaModal] = useState(false);
  const [dianaClassId, setDianaClassId] = useState('');
  const [dianaSubject, setDianaSubject] = useState('');
  const [dianaCategory, setDianaCategory] = useState('');

  /* ── Ficha ── */
  const [fichaContent, setFichaContent] = useState<FichaContent | null>(null);
  const [fichaArea, setFichaArea] = useState('');
  const [fichaNumEjercicios, setFichaNumEjercicios] = useState(6);
  const [fichaNiveles, setFichaNiveles] = useState(false);
  const [fichaDetails, setFichaDetails] = useState('');
  const [fichaBusy, setFichaBusy] = useState(false);

  const activeClass = classes.find(c => c.id === classId) ?? null;
  const classSubjects = activeClass ? (activeClass.subjects ?? [activeClass.subject]).filter(Boolean) : [];

  /** Al elegir clase se proponen sus asignaturas como áreas de la SdA. */
  function pickClass(id: string) {
    setClassId(id);
    const cls = classes.find(c => c.id === id);
    setAreas(cls ? (cls.subjects ?? [cls.subject]).filter(Boolean) : []);
  }

  function toggleArea(a: string) {
    setAreas(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  /* ── Documentos ── */
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { toast(t('El archivo supera el límite de 19 MB.')); return; }

    const inline: InlineFile = await fileToBase64(file);
    const resumen = await analyzeDocument(inline, lang, {
      onStart: () => setAnalyzing(true),
      onEnd: () => setAnalyzing(false),
      onError: m => toast(m),
    });
    if (!resumen) return;
    setDocs(prev => [...prev, { id: newId(), nombre: file.name, resumen }]);
    toast(t('Documento analizado'));
  }

  /* ── Generar ── */
  async function handleGenerate() {
    if (!idea.trim()) { toast(t('Escribe la idea de la situación de aprendizaje')); return; }
    if (areas.length === 0) { toast(t('Elige al menos un área')); return; }

    const result = await generateSda({
      idea: idea.trim(), numero, temporalizacion, meses,
      areas, numSesiones, nivel,
      contextoClase, metodologia,
      docente: teacherName,
      documentos: docs.map(d => ({ nombre: d.nombre, resumen: d.resumen })),
    }, lang, {
      onStart: () => setGenerating(true),
      onEnd: () => setGenerating(false),
      onError: m => toast(m),
    });

    if (!result) { toast(t('La IA no devolvió una situación de aprendizaje válida. Vuelve a intentarlo.')); return; }
    setContent(result);
    setEditingId(null);
    setRubricRows(null);
    setDianaRows(null);
    setFichaContent(null);
    setFichaArea(result.areas[0]?.area ?? '');
  }

  function patch(k: keyof SdaContent, v: string) {
    setContent(c => (c ? { ...c, [k]: v } : c));
  }

  /**
   * El objeto tal y como se guardaría ahora mismo.
   *
   * Se usa tanto al guardar como al exportar: exportar no exige haber
   * guardado antes, así que necesita esta misma forma sin pasar por
   * `onSave`.
   */
  function currentSda(): LearningSituation | null {
    if (!content) return null;
    return {
      id: editingId ?? newId(),
      at: new Date().toISOString(),
      date: isoDate(),
      class_id: classId || undefined,
      class_name: activeClass?.name,
      title: content.titulo || t('Situación de aprendizaje'),
      request: {
        idea, numero, temporalizacion, meses, areas,
        numSesiones, nivel, contextoClase, metodologia,
      },
      content,
    };
  }

  /* ── Guardar ── */
  function handleSave() {
    const sda = currentSda();
    if (!sda) return;
    onSave(sda);
    setEditingId(sda.id);
    toast(t('Situación de aprendizaje guardada'));
  }

  /* ── Exportar ── */
  // `key` identifica QUIÉN pidió la exportación (el formulario abierto, o una
  // fila concreta de la lista guardada), no el id de la SdA en sí: mientras no
  // se guarda, cada llamada a currentSda() saca un id nuevo, así que no sirve
  // para saber si el botón que se pulsó sigue siendo el que está cargando.
  const CURRENT_KEY = '__current__';
  const [exporting, setExporting] = useState<{ key: string; kind: 'pdf' | 'docx' } | null>(null);

  async function handleExportPdf(sda: LearningSituation | null, key: string) {
    if (!sda) return;
    setExporting({ key, kind: 'pdf' });
    const res = await saveSdaPdf(sda, lang);
    setExporting(null);
    if (res.error === 'not-desktop') { toast(t('Guardar en PDF solo está disponible en la aplicación de escritorio.')); return; }
    if (res.canceled) return;
    if (res.error) { toast(t('No se pudo generar el PDF: {error}', { error: res.error })); return; }
    toast(t('✅ PDF guardado'));
  }

  async function handleExportDocx(sda: LearningSituation | null, key: string) {
    if (!sda) return;
    setExporting({ key, kind: 'docx' });
    try {
      await saveSdaDocx(sda, lang);
      toast(t('✅ Word descargado'));
    } catch {
      toast(t('No se pudo generar el documento Word.'));
    } finally {
      setExporting(null);
    }
  }

  function openSaved(s: LearningSituation) {
    setEditingId(s.id);
    setContent(s.content);
    setClassId(s.class_id ?? '');
    setIdea(s.request.idea);
    setNumero(s.request.numero);
    setTemporalizacion(s.request.temporalizacion);
    setMeses(s.request.meses);
    setAreas(s.request.areas);
    setNumSesiones(s.request.numSesiones);
    setNivel(s.request.nivel);
    setContextoClase(s.request.contextoClase);
    setMetodologia(s.request.metodologia);
    setRubricRows(null);
    setDianaRows(null);
    setFichaContent(null);
    setFichaArea(s.content.areas[0]?.area ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetAll() {
    setContent(null); setEditingId(null); setRubricRows(null); setDianaRows(null);
    setFichaContent(null);
    setIdea(''); setDocs([]);
  }

  /* ── Rúbrica ── */
  async function handleRubric() {
    if (!content) return;
    const rows = await generateSdaRubric(
      content, rubricDetails, DEFAULT_LEVELS.map(l => t(l.label)), lang,
      { onStart: () => setRubricBusy(true), onEnd: () => setRubricBusy(false), onError: m => toast(m) },
    );
    if (!rows?.length) { toast(t('La IA no devolvió una rúbrica válida. Vuelve a intentarlo.')); return; }
    setRubricRows(rows);
  }

  /**
   * Lleva la rúbrica generada a la sección de Rúbricas.
   *
   * Los cuatro niveles que devuelve la IA encajan con los de siempre, así que
   * la rúbrica nace ya evaluable: al usarla, la nota entra sola en el cuaderno
   * si se le indica clase y categoría.
   */
  function createRubric() {
    if (!rubricRows || !content) return;
    const rubric: Rubric = {
      id: 'r' + Date.now().toString(36),
      name: content.titulo || t('Situación de aprendizaje'),
      context: content.justificacion,
      criteria: rubricRows.map((r, i) => ({
        id: `c${Date.now().toString(36)}${i}`,
        name: r.criterio,
        descriptors: { 1: r.nivel1, 2: r.nivel2, 3: r.nivel3, 4: r.nivel4 },
        competencies: r.competencias,
      })),
      class_id: rubricClassId || undefined,
      subject: rubricSubject || undefined,
      category_id: rubricCategory || undefined,
    };
    onAddRubric(rubric);
    setRubricModal(false);
    toast(t('Rúbrica creada en Rúbricas'));
  }

  const rubricClass = classes.find(c => c.id === rubricClassId) ?? null;
  const rubricSubjects = rubricClass ? (rubricClass.subjects ?? [rubricClass.subject]).filter(Boolean) : [];
  const rubricCategories = gradeCategories.filter(
    c => c.class_id === rubricClassId && (!rubricSubject || (c.subject ?? rubricSubjects[0]) === rubricSubject),
  );

  /* ── Diana ── */
  async function handleDiana() {
    if (!content) return;
    const rows = await generateSdaDiana(
      content, dianaDetails, DEFAULT_LEVELS.map(l => t(l.label)), lang,
      { onStart: () => setDianaBusy(true), onEnd: () => setDianaBusy(false), onError: m => toast(m) },
    );
    if (!rows?.length) { toast(t('La IA no devolvió una diana válida. Vuelve a intentarlo.')); return; }
    setDianaRows(rows);
  }

  /** Igual que `createRubric`, pero para Dianas. */
  function createDiana() {
    if (!dianaRows || !content) return;
    const diana: EvalDiana = {
      id: 'dia' + Date.now().toString(36),
      name: content.titulo || t('Situación de aprendizaje'),
      context: content.justificacion,
      items: dianaRows.map((r, i) => ({
        id: `it${Date.now().toString(36)}${i}`,
        name: r.item,
        weight: r.peso > 0 ? r.peso : 1,
        descriptors: { 1: r.nivel1, 2: r.nivel2, 3: r.nivel3, 4: r.nivel4 },
        competencies: r.competencias,
      })),
      class_id: dianaClassId || undefined,
      subject: dianaSubject || undefined,
      category_id: dianaCategory || undefined,
    };
    onAddDiana(diana);
    setDianaModal(false);
    toast(t('Diana creada en Dianas'));
  }

  const dianaClass = classes.find(c => c.id === dianaClassId) ?? null;
  const dianaSubjects = dianaClass ? (dianaClass.subjects ?? [dianaClass.subject]).filter(Boolean) : [];
  const dianaCategories = gradeCategories.filter(
    c => c.class_id === dianaClassId && (!dianaSubject || (c.subject ?? dianaSubjects[0]) === dianaSubject),
  );

  /* ── Ficha ── */
  async function handleFicha() {
    if (!content) return;
    const result = await generateFichaFromSda(
      content, fichaArea || content.areas[0]?.area || '',
      { numEjercicios: fichaNumEjercicios, niveles: fichaNiveles, detalles: fichaDetails },
      lang,
      { onStart: () => setFichaBusy(true), onEnd: () => setFichaBusy(false), onError: m => toast(m) },
    );
    if (!result?.ejercicios.length) { toast(t('La IA no devolvió una ficha válida. Vuelve a intentarlo.')); return; }
    setFichaContent(result);
  }

  /**
   * Lleva la ficha generada a Recursos. A diferencia de la rúbrica y la
   * diana, una ficha no reparte nota: no hace falta preguntar dónde se
   * guarda, se crea directamente con la clase de la SdA (si tenía) y queda
   * en el historial de Recursos.
   */
  function createFicha() {
    if (!fichaContent || !content) return;
    const ficha: Ficha = {
      id: 'fic' + Date.now().toString(36),
      at: new Date().toISOString(),
      date: isoDate(),
      class_id: classId || undefined,
      class_name: activeClass?.name,
      sda_id: editingId ?? undefined,
      sda_title: content.titulo,
      title: fichaContent.titulo || content.titulo || t('Ficha de trabajo'),
      request: {
        tema: content.titulo, area: fichaArea || content.areas[0]?.area || '',
        nivel, numEjercicios: fichaNumEjercicios, niveles: fichaNiveles, contextoClase,
      },
      content: fichaContent,
    };
    onAddFicha(ficha);
    setFichaContent(null);
    toast(t('Ficha creada en Recursos'));
  }

  const sinClave = !hasApiKey();

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Situaciones de aprendizaje')}</h1>
          <p className="pg-sub">{t('Diseña una SdA competencial con ayuda de la IA')}</p>
        </div>
        {content && (
          <button className="btn-ghost" onClick={resetAll}>
            <Plus size={14} />{t('Empezar otra')}
          </button>
        )}
      </div>

      {sinClave && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--warn)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
            {t('Para redactar situaciones de aprendizaje hace falta la clave gratuita de Google que se configura en Mi Perfil.')}
          </p>
          <button className="btn-accent" style={{ marginTop: 12 }} onClick={() => onNav('profile')}>
            {t('Configurar la IA')}
          </button>
        </div>
      )}

      {/* ══ Formulario ══ */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hd">
          <div className="card-ttl"><Sparkles size={14} color="var(--accent-d)" />{t('Qué quieres diseñar')}</div>
        </div>

        <div className="fgroup">
          <label className="flabel">{t('Idea de la situación de aprendizaje')} *</label>
          <textarea
            className="finput" rows={3} value={idea}
            onChange={e => setIdea(e.target.value)}
            placeholder={t('Ej: un mercado sostenible en el patio para trabajar los residuos del centro')}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="frow">
          <div className="fgroup">
            <label className="flabel">{t('Clase')}</label>
            <select className="finput" value={classId} onChange={e => pickClass(e.target.value)}>
              <option value="">{t('Sin clase concreta')}</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="fgroup">
            <label className="flabel">{t('Nivel o curso')}</label>
            <input
              className="finput" value={nivel} onChange={e => setNivel(e.target.value)}
              placeholder={t('Ej: 5º de Primaria')}
            />
          </div>
        </div>

        {classSubjects.length > 0 && (
          <div className="fgroup">
            <label className="flabel">{t('Áreas implicadas')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {classSubjects.map(s => {
                const on = areas.includes(s);
                return (
                  <button
                    key={s} onClick={() => toggleArea(s)}
                    style={{
                      padding: '7px 14px', borderRadius: 99, cursor: 'pointer',
                      fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: on ? 800 : 600,
                      background: on ? 'var(--accent-l)' : 'transparent',
                      border: `1.5px solid ${on ? 'var(--accent-d)' : 'var(--border)'}`,
                      color: on ? 'var(--accent-d)' : 'var(--text-2)',
                    }}
                  >
                    {on && <Check size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />}
                    {s}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8 }}>
              {t('Se trabajarán de 2 a 4 competencias y saberes por área, para que dé tiempo a desarrollarlos.')}
            </p>
          </div>
        )}

        <div className="frow">
          <div className="fgroup">
            <label className="flabel">{t('Nº de la SdA')}</label>
            <input className="finput" value={numero} onChange={e => setNumero(e.target.value)} />
          </div>
          <div className="fgroup">
            <label className="flabel">{t('Nº de sesiones')}</label>
            <input
              className="finput" type="number" min={1} max={40} value={numSesiones}
              onChange={e => setNumSesiones(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
            />
          </div>
        </div>

        <div className="frow">
          <div className="fgroup">
            <label className="flabel">{t('Temporalización')}</label>
            <input
              className="finput" value={temporalizacion} onChange={e => setTemporalizacion(e.target.value)}
              placeholder={t('Ej: 1ª evaluación')}
            />
          </div>
          <div className="fgroup">
            <label className="flabel">{t('Meses')}</label>
            <input
              className="finput" value={meses} onChange={e => setMeses(e.target.value)}
              placeholder={t('Ej: octubre y noviembre')}
            />
          </div>
        </div>

        <Field label={t('Cómo es el grupo')} value={contextoClase} onChange={setContextoClase} rows={2} />
        <Field label={t('Metodología habitual')} value={metodologia} onChange={setMetodologia} rows={2} />

        {/* Documentos de apoyo */}
        <div className="fgroup">
          <label className="flabel">{t('Documentos de apoyo (opcional)')}</label>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.5 }}>
            {t('Normativa, programación o cualquier documento en el que quieras que se apoye. La IA lo resume y lo tiene en cuenta.')}
          </p>
          {docs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {docs.map(d => (
                <div key={d.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  borderRadius: 8, background: 'var(--surface)', border: '0.5px solid var(--border)',
                }}>
                  <FileText size={14} color="var(--accent-d)" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.nombre}
                  </span>
                  <button
                    className="ico-btn" title={t('Quitar')}
                    onClick={() => setDocs(prev => prev.filter(x => x.id !== d.id))}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button className="btn-ghost" disabled={analyzing || sinClave} onClick={() => fileRef.current?.click()}>
            {analyzing ? <><span className="spin" />{t('Analizando…')}</> : <><Paperclip size={14} />{t('Añadir documento')}</>}
          </button>
          <input
            ref={fileRef} type="file" accept=".pdf,.txt,.md,image/*"
            style={{ display: 'none' }} onChange={handleFile}
          />
        </div>

        <div style={{ paddingTop: 14, borderTop: '0.5px solid var(--border)' }}>
          <button className="btn-accent" disabled={generating || sinClave} onClick={handleGenerate}>
            {generating
              ? <><span className="spin" />{t('Redactando la situación de aprendizaje…')}</>
              : <><Sparkles size={14} />{t('Generar situación de aprendizaje')}</>}
          </button>
          {generating && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
              {t('Es la petición más larga de la aplicación: puede tardar cerca de un minuto.')}
            </p>
          )}
        </div>
      </div>

      {/* ══ Resultado ══ */}
      {content && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-hd">
            <div className="card-ttl"><BookMarked size={14} color="var(--accent-d)" />{t('Situación de aprendizaje')}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {isDesktop() && (
                <button
                  className="btn-ghost" disabled={exporting !== null}
                  onClick={() => handleExportPdf(currentSda(), CURRENT_KEY)} title={t('Guardar en PDF')}
                >
                  {exporting?.key === CURRENT_KEY && exporting.kind === 'pdf' ? <span className="spin" /> : <FileDown size={14} />}{t('PDF')}
                </button>
              )}
              <button
                className="btn-ghost" disabled={exporting !== null}
                onClick={() => handleExportDocx(currentSda(), CURRENT_KEY)} title={t('Descargar en Word')}
              >
                {exporting?.key === CURRENT_KEY && exporting.kind === 'docx' ? <span className="spin" /> : <FileType2 size={14} />}{t('Word')}
              </button>
              <button className="btn-accent" onClick={handleSave}>
                <Check size={14} />{t('Guardar')}
              </button>
            </div>
          </div>

          <div className="fgroup">
            <label className="flabel">{t('Título')}</label>
            <input className="finput" value={content.titulo ?? ''} onChange={e => patch('titulo', e.target.value)} />
          </div>

          <Field label={t('Justificación')} value={content.justificacion} onChange={v => patch('justificacion', v)} />
          <Field label={t('Explicación curricular (para ti)')} value={content.explicacionCurricular} onChange={v => patch('explicacionCurricular', v)} rows={5} />

          <div className="frow">
            <Field label={t('Objetivos de etapa')} value={content.objetivosEtapa} onChange={v => patch('objetivosEtapa', v)} />
            <Field label={t('Competencias clave')} value={content.competenciasClave} onChange={v => patch('competenciasClave', v)} />
          </div>

          {/* Áreas */}
          {content.areas.length > 0 && (
            <div className="fgroup">
              <label className="flabel">{t('Por áreas')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {content.areas.map((a, i) => (
                  <div key={i} style={{
                    padding: '12px 14px', borderRadius: 10,
                    background: 'var(--surface)', border: '0.5px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{a.area}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
                      <div><strong>{t('Competencias específicas')}:</strong> {a.competenciasEspecificas}</div>
                      <div style={{ marginTop: 5 }}><strong>{t('Criterios de evaluación')}:</strong> {a.criteriosEvaluacion}</div>
                      <div style={{ marginTop: 5 }}><strong>{t('Saberes básicos')}:</strong> {a.saberesBasicos}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sesiones */}
          {content.sesiones.length > 0 && (
            <div className="fgroup">
              <label className="flabel">
                {t('Sesiones')} ({content.sesiones.length})
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {content.sesiones.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: 'var(--accent-l)', color: 'var(--accent-d)',
                      fontSize: 12, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        {s.titulo}
                        <span style={{
                          marginLeft: 8, fontSize: 10.5, fontWeight: 800, padding: '2px 8px',
                          borderRadius: 99, background: 'var(--surface)', color: 'var(--text-2)',
                          border: '1px solid var(--border)',
                        }}>{s.fase}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.55 }}>{s.descripcion}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="frow">
            <Field label={t('Metodología')} value={content.metodologia} onChange={v => patch('metodologia', v)} rows={2} />
            <Field label={t('Agrupamiento')} value={content.agrupamiento} onChange={v => patch('agrupamiento', v)} rows={2} />
          </div>
          <div className="frow">
            <Field label={t('Recursos')} value={content.recursos} onChange={v => patch('recursos', v)} rows={2} />
            <Field label={t('Producto final')} value={content.productoFinal} onChange={v => patch('productoFinal', v)} rows={2} />
          </div>

          <div className="fgroup">
            <label className="flabel">{t('Medidas de inclusión')}</label>
            <Field label={t('Para todo el grupo')} value={content.inclusionUniversal} onChange={v => patch('inclusionUniversal', v)} rows={2} />
            <Field label={t('Apoyo puntual')} value={content.inclusionAdicional} onChange={v => patch('inclusionAdicional', v)} rows={2} />
            <Field label={t('Necesidades específicas')} value={content.inclusionIndividualizada} onChange={v => patch('inclusionIndividualizada', v)} rows={2} />
          </div>

          <div className="frow">
            <Field label={t('Técnicas de evaluación')} value={content.evaluacionTecnicas} onChange={v => patch('evaluacionTecnicas', v)} rows={2} />
            <Field label={t('Instrumentos de evaluación')} value={content.evaluacionInstrumentos} onChange={v => patch('evaluacionInstrumentos', v)} rows={2} />
          </div>

          <Field label={t('ODS relacionados')} value={content.ods} onChange={v => patch('ods', v)} rows={2} />
        </div>
      )}

      {/* ══ Rúbrica ══ */}
      {content && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-hd">
            <div className="card-ttl"><ClipboardList size={14} color="var(--accent-d)" />{t('Rúbrica de esta SdA')}</div>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>
            {t('Genera una rúbrica a partir de sus competencias y su producto final. Podrás llevarla a Rúbricas y evaluar con ella: la nota entrará sola en el cuaderno.')}
          </p>
          <div className="fgroup">
            <input
              className="finput" value={rubricDetails} onChange={e => setRubricDetails(e.target.value)}
              placeholder={t('Algo más que quieras que valore (opcional)')}
            />
          </div>
          <button className="btn-ghost" disabled={rubricBusy || sinClave} onClick={handleRubric}>
            {rubricBusy ? <><span className="spin" />{t('Generando…')}</> : <><Sparkles size={14} />{t('Generar rúbrica')}</>}
          </button>

          {rubricRows && (
            <>
              <div style={{ overflowX: 'auto', marginTop: 16 }}>
                <table className="rtable">
                  <thead>
                    <tr>
                      <th>{t('Criterio')}</th>
                      {DEFAULT_LEVELS.map(l => <th key={l.value}>{t(l.label)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rubricRows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700 }}>
                          {r.criterio}
                          {r.competencias?.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                              {r.competencias.map(code => (
                                <span key={code} style={{
                                  fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 99,
                                  background: 'var(--accent-l)', color: 'var(--accent-d)',
                                }}>{code}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>{r.nivel1}</td>
                        <td>{r.nivel2}</td>
                        <td>{r.nivel3}</td>
                        <td>{r.nivel4}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="btn-accent" style={{ marginTop: 14 }}
                onClick={() => { setRubricClassId(classId); setRubricSubject(areas[0] ?? ''); setRubricModal(true); }}
              >
                <ArrowRight size={14} />{t('Llevar a Rúbricas')}
              </button>
            </>
          )}
        </div>
      )}

      {/* ══ Diana ══ */}
      {content && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-hd">
            <div className="card-ttl"><Target size={14} color="var(--accent-d)" />{t('Diana de esta SdA')}</div>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>
            {t('Genera una diana en vez de una rúbrica: mejor para lo que se observa en el momento —una exposición, un trabajo en grupo— que para corregir en casa. También podrás llevarla a Dianas y evaluar con ella.')}
          </p>
          <div className="fgroup">
            <input
              className="finput" value={dianaDetails} onChange={e => setDianaDetails(e.target.value)}
              placeholder={t('Algo más que quieras que valore (opcional)')}
            />
          </div>
          <button className="btn-ghost" disabled={dianaBusy || sinClave} onClick={handleDiana}>
            {dianaBusy ? <><span className="spin" />{t('Generando…')}</> : <><Sparkles size={14} />{t('Generar diana')}</>}
          </button>

          {dianaRows && (
            <>
              <div style={{ overflowX: 'auto', marginTop: 16 }}>
                <table className="rtable">
                  <thead>
                    <tr>
                      <th>{t('Ítem')}</th>
                      {DEFAULT_LEVELS.map(l => <th key={l.value}>{t(l.label)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {dianaRows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700 }}>
                          {r.item}
                          {r.peso > 1 && (
                            <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--text-3)', fontWeight: 600 }}>
                              {t('Peso ×{n}', { n: r.peso })}
                            </span>
                          )}
                          {r.competencias?.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                              {r.competencias.map(code => (
                                <span key={code} style={{
                                  fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 99,
                                  background: 'var(--accent-l)', color: 'var(--accent-d)',
                                }}>{code}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>{r.nivel1}</td>
                        <td>{r.nivel2}</td>
                        <td>{r.nivel3}</td>
                        <td>{r.nivel4}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="btn-accent" style={{ marginTop: 14 }}
                onClick={() => { setDianaClassId(classId); setDianaSubject(areas[0] ?? ''); setDianaModal(true); }}
              >
                <ArrowRight size={14} />{t('Llevar a Dianas')}
              </button>
            </>
          )}
        </div>
      )}

      {/* ══ Ficha ══ */}
      {content && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-hd">
            <div className="card-ttl"><Layers size={14} color="var(--accent-d)" />{t('Ficha de esta SdA')}</div>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>
            {t('Genera una ficha de ejercicios a partir de los saberes básicos de un área. Se guarda en Recursos, lista para imprimir.')}
          </p>
          {content.areas.length > 1 && (
            <div className="fgroup">
              <label className="flabel">{t('Área')}</label>
              <select className="finput" value={fichaArea} onChange={e => setFichaArea(e.target.value)}>
                {content.areas.map(a => <option key={a.area} value={a.area}>{a.area}</option>)}
              </select>
            </div>
          )}
          <div className="frow">
            <div className="fgroup">
              <label className="flabel">{t('Nº de ejercicios')}</label>
              <input
                className="finput" type="number" min={1} max={20} value={fichaNumEjercicios}
                onChange={e => setFichaNumEjercicios(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              />
            </div>
            <div className="fgroup">
              <label className="flabel">{t('Algo más que quieras que valore (opcional)')}</label>
              <input className="finput" value={fichaDetails} onChange={e => setFichaDetails(e.target.value)} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer', marginBottom: 14 }}>
            <input type="checkbox" checked={fichaNiveles} onChange={e => setFichaNiveles(e.target.checked)} />
            {t('Incluir variantes de apoyo y ampliación por ejercicio')}
          </label>
          <button className="btn-ghost" disabled={fichaBusy || sinClave} onClick={handleFicha}>
            {fichaBusy ? <><span className="spin" />{t('Generando…')}</> : <><Sparkles size={14} />{t('Generar ficha')}</>}
          </button>

          {fichaContent && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                {fichaContent.ejercicios.map((ex, i) => (
                  <div key={i} style={{
                    padding: '10px 13px', borderRadius: 9,
                    background: 'var(--surface)', border: '0.5px solid var(--border)',
                    fontSize: 12.5, color: 'var(--text)', lineHeight: 1.55,
                  }}>
                    <strong>{i + 1}.</strong> {ex.enunciado}
                  </div>
                ))}
              </div>
              <button className="btn-accent" style={{ marginTop: 14 }} onClick={createFicha}>
                <ArrowRight size={14} />{t('Llevar a Recursos')}
              </button>
            </>
          )}
        </div>
      )}

      {/* ══ Guardadas ══ */}
      <div className="card">
        <div className="card-hd">
          <div className="card-ttl"><BookMarked size={14} color="var(--accent-d)" />{t('Mis situaciones de aprendizaje')}</div>
          {learningSituations.length > 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 700 }}>{learningSituations.length}</span>
          )}
        </div>
        {learningSituations.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>
            {t('Todavía no has guardado ninguna.')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {learningSituations.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px',
                borderRadius: 10, background: 'var(--surface)', border: '0.5px solid var(--border)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                    {[s.class_name, s.request.areas.join(' · '),
                      new Date(s.at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })]
                      .filter(Boolean).join(' · ')}
                  </div>
                </div>
                {isDesktop() && (
                  <button
                    className="ico-btn" title={t('Guardar en PDF')} disabled={exporting !== null}
                    onClick={() => handleExportPdf(s, s.id)}
                  >
                    {exporting?.key === s.id && exporting.kind === 'pdf' ? <span className="spin" /> : <FileDown size={15} />}
                  </button>
                )}
                <button
                  className="ico-btn" title={t('Descargar en Word')} disabled={exporting !== null}
                  onClick={() => handleExportDocx(s, s.id)}
                >
                  {exporting?.key === s.id && exporting.kind === 'docx' ? <span className="spin" /> : <FileType2 size={15} />}
                </button>
                <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => openSaved(s)}>
                  {t('Abrir')}
                </button>
                <button
                  className="ico-btn" title={t('Eliminar')}
                  onClick={() => {
                    if (!window.confirm(t('¿Eliminar «{name}»?', { name: s.title }))) return;
                    onDelete(s.id);
                    if (editingId === s.id) resetAll();
                  }}
                >
                  <Trash2 size={14} color="var(--danger)" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ Dónde se guarda la nota de la rúbrica ══ */}
      <Modal open={rubricModal} onClose={() => setRubricModal(false)} title={t('Dónde se guarda la nota')}>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>
          {t('Si indicas clase, asignatura y categoría, cada alumno que evalúes con esta rúbrica aparecerá al instante en el cuaderno, en una columna propia.')}
        </p>
        <div className="fgroup">
          <label className="flabel">{t('Clase')}</label>
          <select className="finput" value={rubricClassId} onChange={e => { setRubricClassId(e.target.value); setRubricSubject(''); setRubricCategory(''); }}>
            <option value="">{t('Sin clase (solo historial)')}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {rubricSubjects.length > 0 && (
          <div className="fgroup">
            <label className="flabel">{t('Asignatura')}</label>
            <select className="finput" value={rubricSubject} onChange={e => { setRubricSubject(e.target.value); setRubricCategory(''); }}>
              {rubricSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        {rubricClassId && (
          <div className="fgroup">
            <label className="flabel">{t('Categoría del cuaderno')}</label>
            <select className="finput" value={rubricCategory} onChange={e => setRubricCategory(e.target.value)}>
              <option value="">{t('Solo el historial, no el cuaderno')}</option>
              {rubricCategories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.weight}%)</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={() => setRubricModal(false)}>{t('Cancelar')}</button>
          <button className="btn-accent" onClick={createRubric}>{t('Crear rúbrica')}</button>
        </div>
      </Modal>

      {/* ══ Dónde se guarda la nota de la diana ══ */}
      <Modal open={dianaModal} onClose={() => setDianaModal(false)} title={t('Dónde se guarda la nota')}>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>
          {t('Si indicas clase, asignatura y categoría, cada alumno que evalúes con esta diana aparecerá al instante en el cuaderno, en una columna propia.')}
        </p>
        <div className="fgroup">
          <label className="flabel">{t('Clase')}</label>
          <select className="finput" value={dianaClassId} onChange={e => { setDianaClassId(e.target.value); setDianaSubject(''); setDianaCategory(''); }}>
            <option value="">{t('Sin clase (solo historial)')}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {dianaSubjects.length > 0 && (
          <div className="fgroup">
            <label className="flabel">{t('Asignatura')}</label>
            <select className="finput" value={dianaSubject} onChange={e => { setDianaSubject(e.target.value); setDianaCategory(''); }}>
              {dianaSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        {dianaClassId && (
          <div className="fgroup">
            <label className="flabel">{t('Categoría del cuaderno')}</label>
            <select className="finput" value={dianaCategory} onChange={e => setDianaCategory(e.target.value)}>
              <option value="">{t('Solo el historial, no el cuaderno')}</option>
              {dianaCategories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.weight}%)</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={() => setDianaModal(false)}>{t('Cancelar')}</button>
          <button className="btn-accent" onClick={createDiana}>{t('Crear diana')}</button>
        </div>
      </Modal>
    </section>
  );
}
