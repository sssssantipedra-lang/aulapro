import { useEffect, useRef, useState } from 'react';
import {
  BookMarked, Sparkles, Plus, Trash2, Paperclip, X, ClipboardList, Check, ArrowRight, FileText,
  FileDown, FileType2, Target, Layers, ArrowLeft, Pencil, ChevronDown, CalendarRange, Users,
  RefreshCw, Lightbulb, Search, Frame,
} from 'lucide-react';
import type { Class, LearningSituation, Rubric, EvalDiana, Ficha, GradeCategory } from '../types';
import { DEFAULT_LEVELS } from '../types';
import {
  analyzeDocument, generateSda, generateSdaRubric, generateSdaDiana,
  type SdaContent, type SdaRubricRow, type SdaDianaItem,
} from '../services/learningSituations';
import { emparejarMateria } from '../lib/curriculum/mapeoMaterias';
import { resolverGrupo, type Etapa } from '../lib/curriculum';
import { generateFichaFromSda, type FichaContent, type FichaFormato } from '../services/resources';
import { saveSdaPdf, saveSdaDocx } from '../services/exportSda';
import { buildSdaPosterHtml, saveSdaPosterPdf } from '../services/exportSdaPoster';
import { FICHA_THEMES, type FichaThemeId } from '../lib/fichaThemes';
import { hasApiKey, type InlineFile } from '../services/gemini';
import { fileToBase64, isoDate } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';
import { Modal } from '../components/ui/Modal';
import { AiKeyNotice } from '../components/ui/AiKeyNotice';
import { isDesktop } from '../services/storage';
import { groupSituations, filterSituations, sdaAreas, type SdaGroupBy } from '../lib/sdaLibrary';

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

function fichaId() {
  return 'fic' + Date.now().toString(36);
}

/** Campo de texto largo, editable, con su etiqueta. */
function Field({
  label, value, onChange, rows = 3,
}: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="fgroup">
      <label className="flabel" htmlFor="learningsituations-f1">{label}</label>
      <textarea
        id="learningsituations-f1"
        className="finput" rows={rows} value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={{ resize: 'vertical' }}
      />
    </div>
  );
}

const LIB_GROUP_KEY = 'aulapro_sda_group';
const LIB_FOLD_KEY = 'aulapro_sda_folded';

/** Competencias clave de la LOMLOE, para mostrarlas como etiquetas. */
const KEY_COMPETENCES = ['CCL', 'CP', 'STEM', 'CD', 'CPSAA', 'CC', 'CE', 'CCEC'];

function competenceCodes(text: string): string[] {
  return KEY_COMPETENCES.filter(c => new RegExp(`(^|[^A-Z])${c}([^A-Z]|$)`).test(text ?? ''));
}

/** Color de cada fase de la SdA en la línea de tiempo de sesiones. */
function phaseTone(fase: string): string {
  const f = (fase ?? '').toLowerCase();
  if (/activ|inicio|motiva/.test(f)) return 'var(--info)';
  if (/consolid|refuerzo|aplica/.test(f)) return 'var(--warn)';
  if (/producto|final|cierre|evalua/.test(f)) return 'var(--ok)';
  return 'var(--accent-d)';
}

/**
 * Un apartado de la SdA como texto de documento. Se lee como un párrafo; el
 * lápiz lo convierte en un cuadro de texto solo mientras se edita. Así la SdA
 * se lee como lo que es —un documento— y no como veinte cuadros abiertos.
 */
function DocText({
  label, value, onChange, rows = 4, hint,
}: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const empty = !(value ?? '').trim();
  return (
    <div className={`sda-text${editing ? ' editing' : ''}`}>
      <div className="sda-text-hd">
        <h4>{label}</h4>
        {!editing && (
          <button type="button" className="sda-edit" onClick={() => setEditing(true)} aria-label={t('Editar «{name}»', { name: label })} title={t('Editar')}>
            <Pencil size={13} />
          </button>
        )}
      </div>
      {hint && !editing && <p className="sda-hint">{hint}</p>}
      {editing ? (
        <>
          <textarea
            className="finput" rows={rows} value={value ?? ''} autoFocus
            onChange={e => onChange(e.target.value)} style={{ resize: 'vertical' }} aria-label={label}
          />
          <button type="button" className="btn-ghost sda-done" onClick={() => setEditing(false)}>
            <Check size={13} />{t('Hecho')}
          </button>
        </>
      ) : empty ? (
        <button type="button" className="sda-empty" onClick={() => setEditing(true)}>{t('Sin rellenar · Añadir')}</button>
      ) : (
        <p className="sda-p">{value}</p>
      )}
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
  // Si el docente escribe el nivel a mano, deja de autorrellenarse al tocar
  // etapa o curso: no tiene sentido pisar algo que ya ha escrito él mismo.
  const [nivelAuto, setNivelAuto] = useState(true);
  const [etapa, setEtapa] = useState<Etapa | ''>('');
  const [curso, setCurso] = useState<number | ''>('');
  /** Solo se usa si `etapa==='eso' && curso===4` y hay un área de Matemáticas. */
  const [opcionMatematicas, setOpcionMatematicas] = useState<'A' | 'B'>('A');
  const [contextoClase, setContextoClase] = useState('');
  const [metodologia, setMetodologia] = useState('');
  const [numSesiones, setNumSesiones] = useState(6);
  const [areas, setAreas] = useState<string[]>([]);

  /* ── Documentos de apoyo ── */
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Vista ── */
  /** Formulario de creación abierto (o de ajustes, si ya hay una SdA abierta). */
  const [formOpen, setFormOpen] = useState(false);
  const [moreOpts, setMoreOpts] = useState(false);
  const [matTab, setMatTab] = useState<'rubrica' | 'diana' | 'ficha'>('rubrica');
  const [activeSec, setActiveSec] = useState('resumen');

  /* ── Biblioteca: agrupación, filtro y búsqueda (se recuerdan) ── */
  const [groupBy, setGroupByState] = useState<SdaGroupBy>(() => {
    try { const v = localStorage.getItem(LIB_GROUP_KEY); return v === 'area' || v === 'none' ? v : 'class'; } catch { return 'class'; }
  });
  const [areaFilter, setAreaFilter] = useState('');
  const [query, setQuery] = useState('');
  const [folded, setFolded] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LIB_FOLD_KEY) ?? '[]') as string[]); } catch { return new Set(); }
  });
  function setGroupBy(v: SdaGroupBy) {
    setGroupByState(v);
    try { localStorage.setItem(LIB_GROUP_KEY, v); } catch { /* solo esta sesión */ }
  }
  function toggleFold(key: string) {
    setFolded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem(LIB_FOLD_KEY, JSON.stringify([...next])); } catch { /* solo esta sesión */ }
      return next;
    });
  }

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
  const [fichaFormato, setFichaFormato] = useState<FichaFormato>('ficha');

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

  /** «5º de Primaria», «3º de ESO»… El docente puede seguir escribiéndolo a mano. */
  function nivelTexto(e: Etapa, c: number): string {
    return e === 'primaria' ? t('{curso}º de Primaria', { curso: c }) : t('{curso}º de ESO', { curso: c });
  }

  function onEtapaChange(e: Etapa | '') {
    setEtapa(e);
    setCurso('');
    if (nivelAuto) setNivel('');
  }

  function onCursoChange(c: number | '') {
    setCurso(c);
    if (nivelAuto && etapa && c !== '') setNivel(nivelTexto(etapa, c));
  }

  /**
   * Si alguna de las áreas elegidas empareja con Matemáticas y estamos en 4º
   * de la ESO, hace falta que el docente diga cuál de las dos opciones: el
   * RD 217/2022 les da criterios y saberes propios a partir de ahí.
   */
  const necesitaOpcionMatematicas =
    etapa === 'eso' && curso === 4 && areas.some(a => emparejarMateria(a, 'eso') === 'Matemáticas');

  /**
   * De cada área elegida, si empareja con el currículo real (para mostrar el
   * aviso junto a su chip, no para decidir nada: la decisión de verdad la
   * toma `generateSda` con la misma función).
   */
  function tieneCurriculoReal(area: string): boolean {
    if (!etapa || curso === '') return false;
    const materia = emparejarMateria(area, etapa);
    if (!materia) return false;
    return !!resolverGrupo(etapa, materia, curso, opcionMatematicas);
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
      etapa: etapa || undefined,
      curso: curso === '' ? undefined : curso,
      opcionMatematicas: necesitaOpcionMatematicas ? opcionMatematicas : undefined,
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
    setFormOpen(false);
    scrollTop();
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
        etapa: etapa || undefined,
        curso: curso === '' ? undefined : curso,
        opcionMatematicas: necesitaOpcionMatematicas ? opcionMatematicas : undefined,
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

  /* ── Cartel para el aula ── */
  const [posterOpen, setPosterOpen] = useState(false);
  const [posterTheme, setPosterTheme] = useState<FichaThemeId>('espacio');
  const [posterBusy, setPosterBusy] = useState(false);

  async function handlePosterPdf() {
    const sda = currentSda();
    if (!sda) return;
    setPosterBusy(true);
    const res = await saveSdaPosterPdf(sda, posterTheme, lang);
    setPosterBusy(false);
    if (res.error === 'not-desktop') { toast(t('Guardar en PDF solo está disponible en la aplicación de escritorio.')); return; }
    if (res.canceled) return;
    if (res.error) { toast(t('No se pudo generar el PDF: {error}', { error: res.error })); return; }
    toast(t('✅ PDF guardado'));
  }

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
    setNivelAuto(false); // ya trae un nivel propio; no hay que autorrellenarlo
    setEtapa(s.request.etapa ?? '');
    setCurso(s.request.curso ?? '');
    setOpcionMatematicas(s.request.opcionMatematicas ?? 'A');
    setContextoClase(s.request.contextoClase);
    setMetodologia(s.request.metodologia);
    setRubricRows(null);
    setDianaRows(null);
    setFichaContent(null);
    setFichaArea(s.content.areas[0]?.area ?? '');
    setFormOpen(false);
    scrollTop();
  }

  /** Vuelve a la biblioteca, sin nada abierto. */
  function resetAll() {
    setContent(null); setEditingId(null); setRubricRows(null); setDianaRows(null);
    setFichaContent(null);
    setIdea(''); setDocs([]);
    setFormOpen(false);
    scrollTop();
  }

  /** Empieza una SdA nueva desde cero. */
  function startNew() {
    resetAll();
    setClassId(''); setAreas([]); setNivel(''); setNivelAuto(true); setEtapa(''); setCurso('');
    setNumero('1'); setTemporalizacion(''); setMeses(''); setContextoClase(''); setMetodologia('');
    setNumSesiones(6); setMoreOpts(false);
    setFormOpen(true);
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      { numEjercicios: fichaNumEjercicios, niveles: fichaNiveles, detalles: fichaDetails, formato: fichaFormato },
      lang,
      { onStart: () => setFichaBusy(true), onEnd: () => setFichaBusy(false), onError: m => toast(m) },
    );
    const ok = result && (result.formato === 'tarjetas' ? !!result.tarjetas?.length : result.actividades.some(a => a.ejercicios.length));
    if (!ok) { toast(t('La IA no devolvió una ficha válida. Vuelve a intentarlo.')); return; }
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
      id: fichaId(),
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

  /* ── Índice del documento: qué apartado se está leyendo ── */
  const SECTIONS = [
    { id: 'resumen', label: t('Resumen') },
    { id: 'curriculo', label: t('Currículo') },
    { id: 'sesiones', label: t('Sesiones') },
    { id: 'desarrollo', label: t('Metodología') },
    { id: 'inclusion', label: t('Inclusión') },
    { id: 'evaluacion', label: t('Evaluación') },
    { id: 'materiales', label: t('Materiales') },
  ];
  const showDoc = !!content && !formOpen;
  useEffect(() => {
    if (!showDoc) return;
    const els = SECTIONS.map(x => document.getElementById(`sda-${x.id}`)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveSec(visible[0].target.id.replace('sda-', ''));
    }, { rootMargin: '-15% 0px -70% 0px' });
    els.forEach(e => io.observe(e));
    // El último apartado nunca llega arriba del todo: al tocar el final de la
    // página se marca él, que es el que se está leyendo.
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        setActiveSec(SECTIONS[SECTIONS.length - 1].id);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); };
    // Las secciones son fijas: solo hace falta volver a observar al abrir otra SdA
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDoc, editingId]);

  function goTo(id: string) {
    setActiveSec(id);
    document.getElementById(`sda-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const classColor = (id?: string) => classes.find(c => c.id === id)?.color ?? 'var(--accent)';

  /* ════════════════ Formulario (crear o ajustar) ════════════════ */
  const form = (
    <>
      <div className="pg-hd">
        <div>
          <button type="button" className="sda-back" onClick={() => (content ? setFormOpen(false) : resetAll())}>
            <ArrowLeft size={14} />{content ? t('Volver a la situación de aprendizaje') : t('Mis situaciones de aprendizaje')}
          </button>
          <h1 className="pg-title">{content ? t('Ajustar y volver a generar') : t('Nueva situación de aprendizaje')}</h1>
          <p className="pg-sub">{t('Cuéntale a la IA qué quieres trabajar; ella redacta la SdA completa con el currículo oficial.')}</p>
        </div>
      </div>

      {sinClave && (
        <AiKeyNotice message={t('Para redactar situaciones de aprendizaje hace falta la clave gratuita de Google que se configura en Mi Perfil.')} action={t('Configurar la IA')} onAction={() => onNav('profile')} />
      )}

      <div className="card sda-form">
        <div className="sda-step"><span>1</span>{t('La idea')}</div>
        <div className="fgroup">
          <label className="flabel" htmlFor="learningsituations-f2">{t('Idea de la situación de aprendizaje')} *</label>
          <textarea
            id="learningsituations-f2"
            className="finput" rows={3} value={idea}
            onChange={e => setIdea(e.target.value)}
            placeholder={t('Ej: un mercado sostenible en el patio para trabajar los residuos del centro')}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="sda-step"><span>2</span>{t('Para quién')}</div>
        <div className="frow">
          <div className="fgroup">
            <label className="flabel" htmlFor="learningsituations-f3">{t('Clase')}</label>
            <select id="learningsituations-f3" className="finput" value={classId} onChange={e => pickClass(e.target.value)}>
              <option value="">{t('Sin clase concreta')}</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="learningsituations-f4">{t('Nivel o curso')}</label>
            <input
              id="learningsituations-f4"
              className="finput" value={nivel}
              onChange={e => { setNivel(e.target.value); setNivelAuto(false); }}
              placeholder={t('Ej: 5º de Primaria')}
            />
          </div>
        </div>

        {/*
          Etapa y curso: además de alimentar el texto libre de arriba, es lo
          que permite saber qué decreto y qué grupo de cursos mirar en
          `lib/curriculum`. Sin esto, las áreas siguen en modo libre como
          hasta ahora — no es obligatorio rellenarlo.
        */}
        <div className="frow">
          <div className="fgroup">
            <label className="flabel" htmlFor="learningsituations-f5">{t('Etapa (currículo oficial)')}</label>
            <select id="learningsituations-f5" className="finput" value={etapa} onChange={e => onEtapaChange(e.target.value as Etapa | '')}>
              <option value="">{t('Sin especificar')}</option>
              <option value="primaria">{t('Primaria')}</option>
              <option value="eso">{t('ESO')}</option>
            </select>
          </div>
          {etapa && (
            <div className="fgroup">
              <label className="flabel" htmlFor="learningsituations-f6">{t('Curso')}</label>
              <select
                id="learningsituations-f6"
                className="finput" value={curso}
                onChange={e => onCursoChange(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">{t('Sin especificar')}</option>
                {Array.from({ length: etapa === 'primaria' ? 6 : 4 }, (_, i) => i + 1).map(c => (
                  <option key={c} value={c}>{nivelTexto(etapa, c)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {necesitaOpcionMatematicas && (
          <div className="fgroup">
            <label className="flabel">{t('Matemáticas de 4º: ¿opción A o B?')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['A', 'B'] as const).map(op => (
                <button
                  key={op} type="button" onClick={() => setOpcionMatematicas(op)}
                  className={opcionMatematicas === op ? 'btn-accent' : 'btn-ghost'}
                  style={{ minWidth: 80, justifyContent: 'center' }}
                >
                  {t('Matemáticas {opcion}', { opcion: op })}
                </button>
              ))}
            </div>
            <p className="sda-note">
              {t('El Real Decreto separa Matemáticas en dos opciones a partir de 4º de la ESO, con criterios y saberes propios de cada una.')}
            </p>
          </div>
        )}

        {etapa && curso !== '' && (
          <p className="sda-note" style={{ marginTop: -6, marginBottom: 14 }}>
            <Check size={11} style={{ display: 'inline', verticalAlign: -1, marginRight: 4, color: 'var(--ok)' }} />
            {t('Las áreas marcadas con currículo real usan las competencias específicas y los saberes básicos oficiales de {curso}; el resto sigue en modo libre.', { curso: nivelTexto(etapa, curso) })}
          </p>
        )}

        {classSubjects.length > 0 && (
          <div className="fgroup">
            <label className="flabel">{t('Áreas implicadas')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {classSubjects.map(sub => {
                const on = areas.includes(sub);
                const real = tieneCurriculoReal(sub);
                return (
                  <button
                    key={sub} type="button" onClick={() => toggleArea(sub)} aria-pressed={on}
                    title={real ? t('Usa el currículo oficial real de esta materia') : undefined}
                    className={`chip${on ? ' on' : ''}`}
                  >
                    {on && <Check size={12} style={{ flexShrink: 0 }} />}
                    {sub}
                    {real && <BookMarked size={11} style={{ flexShrink: 0, color: 'var(--ok)' }} />}
                  </button>
                );
              })}
            </div>
            <p className="sda-note">
              {t('Se trabajarán de 2 a 4 competencias y saberes por área, para que dé tiempo a desarrollarlos.')}
            </p>
          </div>
        )}

        <div className="frow">
          <div className="fgroup">
            <label className="flabel" htmlFor="learningsituations-f8">{t('Nº de sesiones')}</label>
            <input
              id="learningsituations-f8"
              className="finput" type="number" min={1} max={40} value={numSesiones}
              onChange={e => setNumSesiones(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
            />
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="learningsituations-f9">{t('Temporalización')}</label>
            <input
              id="learningsituations-f9"
              className="finput" value={temporalizacion} onChange={e => setTemporalizacion(e.target.value)}
              placeholder={t('Ej: 1ª evaluación')}
            />
          </div>
        </div>

        {/* Lo que casi nadie cambia, plegado para que el formulario no asuste */}
        <button type="button" className="sda-more" onClick={() => setMoreOpts(v => !v)} aria-expanded={moreOpts}>
          <ChevronDown size={14} style={{ transform: moreOpts ? 'rotate(180deg)' : 'none' }} />
          {t('Más opciones')}
          <span>{t('nº de la SdA, meses, cómo es el grupo, metodología y documentos de apoyo')}</span>
        </button>

        {moreOpts && (
          <div className="sda-more-body">
            <div className="frow">
              <div className="fgroup">
                <label className="flabel" htmlFor="learningsituations-f7">{t('Nº de la SdA')}</label>
                <input id="learningsituations-f7" className="finput" value={numero} onChange={e => setNumero(e.target.value)} />
              </div>
              <div className="fgroup">
                <label className="flabel" htmlFor="learningsituations-f10">{t('Meses')}</label>
                <input
                  id="learningsituations-f10"
                  className="finput" value={meses} onChange={e => setMeses(e.target.value)}
                  placeholder={t('Ej: octubre y noviembre')}
                />
              </div>
            </div>

            <Field label={t('Cómo es el grupo')} value={contextoClase} onChange={setContextoClase} rows={2} />
            <Field label={t('Metodología habitual')} value={metodologia} onChange={setMetodologia} rows={2} />

            <div className="fgroup">
              <label className="flabel">{t('Documentos de apoyo (opcional)')}</label>
              <p className="sda-note" style={{ marginTop: 0, marginBottom: 10 }}>
                {t('Normativa, programación o cualquier documento en el que quieras que se apoye. La IA lo resume y lo tiene en cuenta.')}
              </p>
              {docs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {docs.map(d => (
                    <div key={d.id} className="sda-doc">
                      <FileText size={14} color="var(--accent-d)" style={{ flexShrink: 0 }} />
                      <span>{d.nombre}</span>
                      <button className="ico-btn" title={t('Quitar')} aria-label={t('Quitar')} onClick={() => setDocs(prev => prev.filter(x => x.id !== d.id))}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn-ghost" disabled={analyzing || sinClave} onClick={() => fileRef.current?.click()}>
                {analyzing ? <><span className="spin" />{t('Analizando…')}</> : <><Paperclip size={14} />{t('Añadir documento')}</>}
              </button>
              <input ref={fileRef} type="file" accept=".pdf,.txt,.md,image/*" style={{ display: 'none' }} onChange={handleFile} />
            </div>
          </div>
        )}

        <div className="sda-form-ft">
          <button className="btn-accent" disabled={generating || sinClave} onClick={handleGenerate}>
            {generating
              ? <><span className="spin" />{t('Redactando la situación de aprendizaje…')}</>
              : <><Sparkles size={14} />{t(content ? 'Volver a generar' : 'Generar situación de aprendizaje')}</>}
          </button>
          {generating && <p className="sda-note">{t('Es la petición más larga de la aplicación: puede tardar cerca de un minuto.')}</p>}
        </div>
      </div>
    </>
  );

  /* ════════════════ Biblioteca ════════════════ */
  const libAreas = sdaAreas(learningSituations);
  const libGroups = groupSituations(
    filterSituations(learningSituations, areaFilter, query), classes, groupBy,
    { noClass: t('Sin clase'), noArea: t('Sin área') },
  );

  function renderCard(sda: LearningSituation, sharedWith: string[], key: string) {
    return (
    <article key={key} className="card sda-card" style={{ ['--sda-c' as string]: classColor(sda.class_id) }}>
              <button type="button" className="sda-card-main" onClick={() => openSaved(sda)}>
                <span className="sda-card-kicker">
                  {sda.request.numero ? t('SdA {n}', { n: sda.request.numero }) : t('Situación de aprendizaje')}
                  {sda.class_name ? ` · ${sda.class_name}` : ''}
                </span>
                <h3 className="sda-card-ttl">{sda.title}</h3>
                <p className="sda-card-desc">{sda.content.justificacion}</p>
                <span className="sda-card-chips">
                  {sda.request.areas.slice(0, 3).map(a => <span key={a} className="sda-chip">{a}</span>)}
                  {sharedWith.length > 0 && (
                    <span className="sda-chip shared" title={t('También está en: {areas}', { areas: sharedWith.join(', ') })}>
                      {t('Compartida')}
                    </span>
                  )}
                </span>
              </button>
              <footer className="sda-card-ft">
                <span className="sda-card-meta">
                  <CalendarRange size={13} />
                  {t('{n} sesiones', { n: sda.content.sesiones.length })}
                  {sda.request.temporalizacion ? ` · ${sda.request.temporalizacion}` : ''}
                  {` · ${new Date(sda.at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`}
                </span>
                <span className="sda-card-actions">
                  {isDesktop() && (
                    <button className="ico-btn" title={t('Guardar en PDF')} aria-label={t('Guardar en PDF')} disabled={exporting !== null} onClick={() => handleExportPdf(sda, sda.id)}>
                      {exporting?.key === sda.id && exporting.kind === 'pdf' ? <span className="spin" /> : <FileDown size={15} />}
                    </button>
                  )}
                  <button className="ico-btn" title={t('Descargar en Word')} aria-label={t('Descargar en Word')} disabled={exporting !== null} onClick={() => handleExportDocx(sda, sda.id)}>
                    {exporting?.key === sda.id && exporting.kind === 'docx' ? <span className="spin" /> : <FileType2 size={15} />}
                  </button>
                  <button
                    className="ico-btn" title={t('Eliminar')} aria-label={t('Eliminar')}
                    onClick={() => {
                      if (!window.confirm(t('¿Eliminar «{name}»?', { name: sda.title }))) return;
                      onDelete(sda.id);
                      if (editingId === sda.id) resetAll();
                    }}
                  >
                    <Trash2 size={14} color="var(--danger)" />
                  </button>
                </span>
              </footer>
            </article>
    );
  }

  const library = (
    <>
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Situaciones de aprendizaje')}</h1>
          <p className="pg-sub">{t('Diseña una SdA competencial con ayuda de la IA')}</p>
        </div>
        <button className="btn-accent" onClick={startNew}><Plus size={15} />{t('Nueva situación de aprendizaje')}</button>
      </div>

      {sinClave && (
        <AiKeyNotice message={t('Para redactar situaciones de aprendizaje hace falta la clave gratuita de Google que se configura en Mi Perfil.')} action={t('Configurar la IA')} onAction={() => onNav('profile')} />
      )}

      {learningSituations.length === 0 ? (
        <div className="card sda-empty-lib">
          <span className="sda-empty-ico"><Lightbulb size={24} /></span>
          <h2>{t('Todavía no tienes ninguna situación de aprendizaje')}</h2>
          <p>{t('Escribe una idea —«un mercado sostenible en el patio»— y la IA redacta la SdA entera: currículo, sesiones, inclusión y evaluación. Después puedes sacar su rúbrica, su diana y una ficha de ejercicios.')}</p>
          <button className="btn-accent" onClick={startNew}><Sparkles size={14} />{t('Crear la primera')}</button>
        </div>
      ) : (
        <>
          <div className="toolbar stack sda-lib-bar">
            <div className="toolbar-row">
              <label className="tb-search sda-search">
                <Search size={14} />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('Buscar por título o idea')} aria-label={t('Buscar')} />
              </label>
              <span className="toolbar-spacer" />
              <span className="toolbar-label" id="sda-group-label">{t('Agrupar por')}</span>
              <div className="chip-row" role="group" aria-labelledby="sda-group-label">
                {([['class', t('Clase')], ['area', t('Área')], ['none', t('Nada')]] as const).map(([id, label]) => (
                  <button key={id} type="button" className={`chip sm${groupBy === id ? ' on' : ''}`} aria-pressed={groupBy === id} onClick={() => setGroupBy(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {libAreas.length > 1 && (
              <div className="toolbar-row">
                <span className="toolbar-label" id="sda-area-label">{t('Área')}</span>
                <div className="chip-row" role="group" aria-labelledby="sda-area-label">
                  <button type="button" className={`chip sm${areaFilter === '' ? ' on' : ''}`} aria-pressed={areaFilter === ''} onClick={() => setAreaFilter('')}>
                    {t('Todas')}
                  </button>
                  {libAreas.map(a => (
                    <button key={a} type="button" className={`chip sm${areaFilter === a ? ' on' : ''}`} aria-pressed={areaFilter === a} onClick={() => setAreaFilter(v => (v === a ? '' : a))}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {libGroups.every(g => g.items.length === 0) ? (
            <p className="sda-no-match">{t('Ninguna situación de aprendizaje coincide con la búsqueda.')}</p>
          ) : libGroups.map(g => {
            const foldKey = `${groupBy}:${g.key}`;
            const isFolded = groupBy !== 'none' && folded.has(foldKey);
            return (
              <section key={g.key} className="sda-group">
                {groupBy !== 'none' && (
                  <button type="button" className="sda-group-hd" onClick={() => toggleFold(foldKey)} aria-expanded={!isFolded}>
                    <ChevronDown size={16} style={{ transform: isFolded ? 'rotate(-90deg)' : 'none' }} />
                    {g.color && <span className="sda-group-dot" style={{ background: g.color }} />}
                    <span className="sda-group-name">{g.label}</span>
                    <span className="sda-count">{g.items.length}</span>
                  </button>
                )}
                {!isFolded && (
                  <div className="sda-grid">
                    {g.items.map(({ sda, sharedWith }) => renderCard(sda, sharedWith, `${g.key}-${sda.id}`))}
                    {groupBy === 'none' && (
                      <button type="button" className="sda-card-new" onClick={startNew}>
                        <Plus size={22} />{t('Nueva situación de aprendizaje')}
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </>
  );

  /* ════════════════ Documento ════════════════ */
  const levelsTable = (rows: { name: string; extra?: React.ReactNode; codes: string[]; n: string[] }[], first: string) => (
    <div style={{ overflowX: 'auto' }}>
      <table className="sda-levels">
        <thead>
          <tr>
            <th>{first}</th>
            {DEFAULT_LEVELS.map((l, i) => <th key={l.value} className={`lv${i + 1}`}>{t(l.label)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="sda-lv-name">
                {r.name}{r.extra}
                {r.codes.length > 0 && (
                  <span className="sda-card-chips" style={{ marginTop: 5 }}>
                    {r.codes.map(code => <span key={code} className="sda-chip accent">{code}</span>)}
                  </span>
                )}
              </td>
              {r.n.map((d, k) => <td key={k} className={`lv${k + 1}`}>{d}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Las sesiones, agrupadas en fases consecutivas (Activación → Desarrollo → …)
  const phases: { fase: string; items: { n: number; s: SdaContent['sesiones'][number] }[] }[] = [];
  content?.sesiones.forEach((ses, i) => {
    const last = phases[phases.length - 1];
    if (last && last.fase === ses.fase) last.items.push({ n: i + 1, s: ses });
    else phases.push({ fase: ses.fase, items: [{ n: i + 1, s: ses }] });
  });
  const codes = content ? competenceCodes(content.competenciasClave) : [];

  const doc = content && (
    <>
      <div className="sda-doc-hd">
        <button type="button" className="sda-back" onClick={resetAll}>
          <ArrowLeft size={14} />{t('Mis situaciones de aprendizaje')}
        </button>
        <div className="sda-doc-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="sda-card-kicker">
              {t('SdA {n}', { n: numero || '1' })}{activeClass ? ` · ${activeClass.name}` : ''}{nivel ? ` · ${nivel}` : ''}
              {!editingId && <span className="sda-unsaved">{t('Sin guardar')}</span>}
            </span>
            <input
              className="sda-title-input" value={content.titulo ?? ''}
              onChange={e => patch('titulo', e.target.value)} aria-label={t('Título')}
            />
            <div className="sda-facts">
              <span><CalendarRange size={13} />{t('{n} sesiones', { n: content.sesiones.length })}{temporalizacion ? ` · ${temporalizacion}` : ''}{meses ? ` (${meses})` : ''}</span>
              {areas.length > 0 && <span><BookMarked size={13} />{areas.join(' · ')}</span>}
              {activeClass && <span><Users size={13} />{activeClass.name}</span>}
            </div>
          </div>
          <div className="sda-doc-actions">
            <button className="btn-ghost" onClick={() => setFormOpen(true)} title={t('Cambiar la idea o los datos y volver a generarla')}>
              <RefreshCw size={14} />{t('Ajustar')}
            </button>
            {isDesktop() && (
              <button className="btn-ghost" disabled={exporting !== null} onClick={() => handleExportPdf(currentSda(), CURRENT_KEY)} title={t('Guardar en PDF')}>
                {exporting?.key === CURRENT_KEY && exporting.kind === 'pdf' ? <span className="spin" /> : <FileDown size={14} />}{t('PDF')}
              </button>
            )}
            <button className="btn-ghost" disabled={exporting !== null} onClick={() => handleExportDocx(currentSda(), CURRENT_KEY)} title={t('Descargar en Word')}>
              {exporting?.key === CURRENT_KEY && exporting.kind === 'docx' ? <span className="spin" /> : <FileType2 size={14} />}{t('Word')}
            </button>
            <button className="btn-ghost" onClick={() => setPosterOpen(true)} title={t('Un cartel con el reto y el camino, para colgar en el aula')}>
              <Frame size={14} />{t('Cartel')}
            </button>
            <button className="btn-accent" onClick={handleSave}><Check size={14} />{t('Guardar')}</button>
          </div>
        </div>
      </div>

      <div className="sda-layout">
        <nav className="sda-toc" aria-label={t('Apartados')}>
          {SECTIONS.map(x => (
            <button key={x.id} type="button" className={activeSec === x.id ? 'on' : ''} aria-current={activeSec === x.id ? 'true' : undefined} onClick={() => goTo(x.id)}>
              {x.label}
            </button>
          ))}
        </nav>

        <div className="sda-body">
          <section id="sda-resumen" className="card sda-sec">
            <h3 className="sda-sec-ttl">{t('Resumen')}</h3>
            <DocText label={t('Justificación')} value={content.justificacion} onChange={v => patch('justificacion', v)} />
            <DocText label={t('Producto final')} value={content.productoFinal} onChange={v => patch('productoFinal', v)} rows={2} />
            <div className="sda-callout">
              <DocText
                label={t('Explicación curricular (para ti)')}
                hint={t('Por qué se han elegido estas competencias y saberes, explicado para ti.')}
                value={content.explicacionCurricular} onChange={v => patch('explicacionCurricular', v)} rows={5}
              />
            </div>
          </section>

          <section id="sda-curriculo" className="card sda-sec">
            <h3 className="sda-sec-ttl">{t('Currículo')}</h3>
            {codes.length > 0 && (
              <div className="sda-card-chips" style={{ marginBottom: 10 }}>
                {codes.map(code => <span key={code} className="sda-chip accent big">{code}</span>)}
              </div>
            )}
            <div className="sda-two">
              <DocText label={t('Competencias clave')} value={content.competenciasClave} onChange={v => patch('competenciasClave', v)} />
              <DocText label={t('Objetivos de etapa')} value={content.objetivosEtapa} onChange={v => patch('objetivosEtapa', v)} />
            </div>
            {content.areas.map((a, i) => (
              <details key={i} className="sda-area" open={i === 0}>
                <summary>{a.area}<ChevronDown size={15} /></summary>
                <div className="sda-area-cols">
                  <div><h5>{t('Competencias específicas')}</h5><p className="sda-p">{a.competenciasEspecificas}</p></div>
                  <div><h5>{t('Criterios de evaluación')}</h5><p className="sda-p">{a.criteriosEvaluacion}</p></div>
                  <div><h5>{t('Saberes básicos')}</h5><p className="sda-p">{a.saberesBasicos}</p></div>
                </div>
              </details>
            ))}
          </section>

          <section id="sda-sesiones" className="card sda-sec">
            <h3 className="sda-sec-ttl">{t('Sesiones')} <span className="sda-count">{content.sesiones.length}</span></h3>
            <div className="sda-timeline">
              {phases.map((ph, pi) => (
                <div key={pi} className="sda-phase" style={{ ['--ph' as string]: phaseTone(ph.fase) }}>
                  <div className="sda-phase-ttl">{ph.fase}</div>
                  {ph.items.map(({ n, s: ses }) => (
                    <div key={n} className="sda-session">
                      <span className="sda-session-n">{n}</span>
                      <div>
                        <div className="sda-session-ttl">{ses.titulo}</div>
                        <p className="sda-p">{ses.descripcion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section id="sda-desarrollo" className="card sda-sec">
            <h3 className="sda-sec-ttl">{t('Metodología')}</h3>
            <div className="sda-two">
              <DocText label={t('Metodología')} value={content.metodologia} onChange={v => patch('metodologia', v)} />
              <DocText label={t('Agrupamiento')} value={content.agrupamiento} onChange={v => patch('agrupamiento', v)} />
            </div>
            <DocText label={t('Recursos')} value={content.recursos} onChange={v => patch('recursos', v)} />
          </section>

          <section id="sda-inclusion" className="card sda-sec">
            <h3 className="sda-sec-ttl">{t('Medidas de inclusión')}</h3>
            <div className="sda-steps3">
              <div className="sda-lvl l1"><DocText label={t('Para todo el grupo')} value={content.inclusionUniversal} onChange={v => patch('inclusionUniversal', v)} /></div>
              <div className="sda-lvl l2"><DocText label={t('Apoyo puntual')} value={content.inclusionAdicional} onChange={v => patch('inclusionAdicional', v)} /></div>
              <div className="sda-lvl l3"><DocText label={t('Necesidades específicas')} value={content.inclusionIndividualizada} onChange={v => patch('inclusionIndividualizada', v)} /></div>
            </div>
          </section>

          <section id="sda-evaluacion" className="card sda-sec">
            <h3 className="sda-sec-ttl">{t('Evaluación')}</h3>
            <div className="sda-two">
              <DocText label={t('Técnicas de evaluación')} value={content.evaluacionTecnicas} onChange={v => patch('evaluacionTecnicas', v)} />
              <DocText label={t('Instrumentos de evaluación')} value={content.evaluacionInstrumentos} onChange={v => patch('evaluacionInstrumentos', v)} />
            </div>
            <DocText label={t('ODS relacionados')} value={content.ods} onChange={v => patch('ods', v)} rows={2} />
          </section>

          <section id="sda-materiales" className="card sda-sec">
            <h3 className="sda-sec-ttl">{t('Materiales de esta SdA')}</h3>
            <div className="tab-bar sda-mat-tabs" role="tablist">
              {([
                ['rubrica', t('Rúbrica'), <ClipboardList key="r" size={14} />],
                ['diana', t('Diana'), <Target key="d" size={14} />],
                ['ficha', t('Ficha de ejercicios'), <Layers key="f" size={14} />],
              ] as const).map(([id, label, icon]) => (
                <button key={id} role="tab" aria-selected={matTab === id} className={`tab-btn${matTab === id ? ' active' : ''}`} onClick={() => setMatTab(id)}>
                  {icon}{label}
                </button>
              ))}
            </div>

            {matTab === 'rubrica' && (
              <div>
                <p className="sda-mat-help">{t('Genera una rúbrica a partir de sus competencias y su producto final. Podrás llevarla a Rúbricas y evaluar con ella: la nota entrará sola en el cuaderno.')}</p>
                <div className="sda-mat-row">
                  <input className="finput" value={rubricDetails} onChange={e => setRubricDetails(e.target.value)} placeholder={t('Algo más que quieras que valore (opcional)')} />
                  <button className="btn-ghost" disabled={rubricBusy || sinClave} onClick={handleRubric}>
                    {rubricBusy ? <><span className="spin" />{t('Generando…')}</> : <><Sparkles size={14} />{t(rubricRows ? 'Volver a generar' : 'Generar rúbrica')}</>}
                  </button>
                </div>
                {rubricRows && (
                  <>
                    {levelsTable(rubricRows.map(r => ({ name: r.criterio, codes: r.competencias ?? [], n: [r.nivel1, r.nivel2, r.nivel3, r.nivel4] })), t('Criterio'))}
                    <button className="btn-accent" style={{ marginTop: 14 }} onClick={() => { setRubricClassId(classId); setRubricSubject(areas[0] ?? ''); setRubricModal(true); }}>
                      <ArrowRight size={14} />{t('Llevar a Rúbricas')}
                    </button>
                  </>
                )}
              </div>
            )}

            {matTab === 'diana' && (
              <div>
                <p className="sda-mat-help">{t('Genera una diana en vez de una rúbrica: mejor para lo que se observa en el momento —una exposición, un trabajo en grupo— que para corregir en casa. También podrás llevarla a Dianas y evaluar con ella.')}</p>
                <div className="sda-mat-row">
                  <input className="finput" value={dianaDetails} onChange={e => setDianaDetails(e.target.value)} placeholder={t('Algo más que quieras que valore (opcional)')} />
                  <button className="btn-ghost" disabled={dianaBusy || sinClave} onClick={handleDiana}>
                    {dianaBusy ? <><span className="spin" />{t('Generando…')}</> : <><Sparkles size={14} />{t(dianaRows ? 'Volver a generar' : 'Generar diana')}</>}
                  </button>
                </div>
                {dianaRows && (
                  <>
                    {levelsTable(dianaRows.map(r => ({
                      name: r.item, codes: r.competencias ?? [], n: [r.nivel1, r.nivel2, r.nivel3, r.nivel4],
                      extra: r.peso > 1 ? <span className="sda-weight">{t('Peso ×{n}', { n: r.peso })}</span> : undefined,
                    })), t('Ítem'))}
                    <button className="btn-accent" style={{ marginTop: 14 }} onClick={() => { setDianaClassId(classId); setDianaSubject(areas[0] ?? ''); setDianaModal(true); }}>
                      <ArrowRight size={14} />{t('Llevar a Dianas')}
                    </button>
                  </>
                )}
              </div>
            )}

            {matTab === 'ficha' && (
              <div>
                <p className="sda-mat-help">{t('Genera una ficha de ejercicios a partir de los saberes básicos de un área. Se guarda en Recursos, lista para imprimir.')}</p>
                <div className="chip-row" role="radiogroup" aria-label={t('Qué quieres crear')} style={{ marginBottom: 12 }}>
                  {([['ficha', '📝', 'Ficha'], ['escape', '🔐', 'Escape room'], ['tarjetas', '🃏', 'Tarjetas recortables']] as const).map(([id, emoji, label]) => (
                    <button
                      key={id} type="button" role="radio" aria-checked={fichaFormato === id}
                      className={`chip sm${fichaFormato === id ? ' on' : ''}`}
                      onClick={() => { setFichaFormato(id); setFichaContent(null); if (id === 'tarjetas' && fichaNumEjercicios < 8) setFichaNumEjercicios(12); }}
                    >
                      {emoji} {t(label)}
                    </button>
                  ))}
                </div>
                <div className="frow">
                  {content.areas.length > 1 && (
                    <div className="fgroup">
                      <label className="flabel" htmlFor="learningsituations-f12">{t('Área')}</label>
                      <select id="learningsituations-f12" className="finput" value={fichaArea} onChange={e => setFichaArea(e.target.value)}>
                        {content.areas.map(a => <option key={a.area} value={a.area}>{a.area}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="fgroup">
                    <label className="flabel" htmlFor="learningsituations-f13">{t(fichaFormato === 'tarjetas' ? 'Nº de tarjetas' : 'Nº de ejercicios')}</label>
                    <input
                      id="learningsituations-f13"
                      className="finput" type="number" min={1} max={fichaFormato === 'tarjetas' ? 32 : 20} value={fichaNumEjercicios}
                      onChange={e => setFichaNumEjercicios(Math.max(1, Math.min(fichaFormato === 'tarjetas' ? 32 : 20, Number(e.target.value) || 1)))}
                    />
                  </div>
                </div>
                <div className="fgroup">
                  <label className="flabel" htmlFor="learningsituations-f14">{t('Algo más que quieras que valore (opcional)')}</label>
                  <input id="learningsituations-f14" className="finput" value={fichaDetails} onChange={e => setFichaDetails(e.target.value)} />
                </div>
                {fichaFormato !== 'tarjetas' && (
                  <label className="sda-check">
                    <input type="checkbox" checked={fichaNiveles} onChange={e => setFichaNiveles(e.target.checked)} />
                    {t('Incluir variantes de apoyo y ampliación por ejercicio')}
                  </label>
                )}
                <button className="btn-ghost" disabled={fichaBusy || sinClave} onClick={handleFicha}>
                  {fichaBusy ? <><span className="spin" />{t('Generando…')}</> : <><Sparkles size={14} />{t(fichaFormato === 'escape' ? 'Crear escape room' : fichaFormato === 'tarjetas' ? 'Crear tarjetas' : 'Generar ficha')}</>}
                </button>
                {fichaContent && (
                  <>
                    <div className="sda-ficha">
                      {fichaContent.formato === 'tarjetas' ? (
                        <ol>{(fichaContent.tarjetas ?? []).map((tj, i) => <li key={i}>{tj.pregunta} <em>→ {tj.respuesta}</em></li>)}</ol>
                      ) : fichaContent.actividades.map((act, ai) => (
                        <div key={ai}>
                          {act.titulo && <div className="sda-ficha-act">{t(fichaContent.formato === 'escape' ? 'Sala' : 'Actividad')} {ai + 1}: {act.titulo}{act.candado ? ` · 🔒 ${act.candado.codigo}` : ''}</div>}
                          <ol>
                            {act.ejercicios.map((ex, i) => <li key={i}>{ex.enunciado}</li>)}
                          </ol>
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
          </section>
        </div>
      </div>
    </>
  );

  return (
    <section className="sec active sda-page">
      {showDoc ? doc : (formOpen || content) ? form : library}

      {/* ══ Cartel para el aula ══ */}
      <Modal open={posterOpen} onClose={() => setPosterOpen(false)} title={t('Cartel para el aula')} wide>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>
          {t('El reto, lo que se va a conseguir y el camino por fases, en una hoja A4 para colgar. Elige el aspecto:')}
        </p>
        <div className="chip-row" role="radiogroup" aria-label={t('Tema del cartel')} style={{ marginBottom: 12 }}>
          {FICHA_THEMES.filter(th => th.id !== 'clasico').map(th => (
            <button
              key={th.id} type="button" role="radio" aria-checked={posterTheme === th.id}
              className={`chip sm${posterTheme === th.id ? ' on' : ''}`} onClick={() => setPosterTheme(th.id)}
            >
              {th.personaje} {t(th.nombre)}
            </button>
          ))}
        </div>
        {posterOpen && content && (
          <div className="sda-poster-preview">
            <iframe
              title={t('Vista previa del cartel')}
              srcDoc={buildSdaPosterHtml(currentSda()!, posterTheme, lang, { preview: true })}
            />
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
          {!isDesktop() && <span style={{ fontSize: 12, color: 'var(--text-3)', alignSelf: 'center' }}>{t('Guardar en PDF solo está disponible en la aplicación de escritorio.')}</span>}
          <button className="btn-ghost" onClick={() => setPosterOpen(false)}>{t('Cerrar')}</button>
          <button className="btn-accent" disabled={posterBusy || !isDesktop()} onClick={handlePosterPdf}>
            {posterBusy ? <span className="spin" /> : <FileDown size={14} />}{t('Guardar en PDF')}
          </button>
        </div>
      </Modal>

      {/* ══ Dónde se guarda la nota de la rúbrica ══ */}
      <Modal open={rubricModal} onClose={() => setRubricModal(false)} title={t('Dónde se guarda la nota')}>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>
          {t('Si indicas clase, asignatura y categoría, cada alumno que evalúes con esta rúbrica aparecerá al instante en el cuaderno, en una columna propia.')}
        </p>
        <div className="fgroup">
          <label className="flabel" htmlFor="learningsituations-f15">{t('Clase')}</label>
          <select id="learningsituations-f15" className="finput" value={rubricClassId} onChange={e => { setRubricClassId(e.target.value); setRubricSubject(''); setRubricCategory(''); }}>
            <option value="">{t('Sin clase (solo historial)')}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {rubricSubjects.length > 0 && (
          <div className="fgroup">
            <label className="flabel" htmlFor="learningsituations-f16">{t('Asignatura')}</label>
            <select id="learningsituations-f16" className="finput" value={rubricSubject} onChange={e => { setRubricSubject(e.target.value); setRubricCategory(''); }}>
              {rubricSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        {rubricClassId && (
          <div className="fgroup">
            <label className="flabel" htmlFor="learningsituations-f17">{t('Categoría del cuaderno')}</label>
            <select id="learningsituations-f17" className="finput" value={rubricCategory} onChange={e => setRubricCategory(e.target.value)}>
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
          <label className="flabel" htmlFor="learningsituations-f18">{t('Clase')}</label>
          <select id="learningsituations-f18" className="finput" value={dianaClassId} onChange={e => { setDianaClassId(e.target.value); setDianaSubject(''); setDianaCategory(''); }}>
            <option value="">{t('Sin clase (solo historial)')}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {dianaSubjects.length > 0 && (
          <div className="fgroup">
            <label className="flabel" htmlFor="learningsituations-f19">{t('Asignatura')}</label>
            <select id="learningsituations-f19" className="finput" value={dianaSubject} onChange={e => { setDianaSubject(e.target.value); setDianaCategory(''); }}>
              {dianaSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        {dianaClassId && (
          <div className="fgroup">
            <label className="flabel" htmlFor="learningsituations-f20">{t('Categoría del cuaderno')}</label>
            <select id="learningsituations-f20" className="finput" value={dianaCategory} onChange={e => setDianaCategory(e.target.value)}>
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
