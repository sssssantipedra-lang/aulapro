/**
 * Recursos: el creador de fichas.
 *
 * Dos vistas. En la primera se pide la ficha (tema, curso, cuántos
 * ejercicios y el mundo de la historia) y se ven las fichas guardadas. Al
 * generarla se pasa al editor: a la izquierda cada parte de la ficha es un
 * bloque que se edita, se mueve, se borra o se rehace con IA; a la derecha,
 * la hoja A4 tal cual se imprimirá, en vivo. El tema visual se cambia con un
 * clic sin volver a generar nada.
 */
import { useState } from 'react';
import {
  Sparkles, Plus, Trash2, Check, FileDown, FileType2, ArrowLeft, ArrowUp, ArrowDown, Wand2, Layers, Eye, ChevronDown, MonitorPlay,
} from 'lucide-react';
import type { Class, Ficha } from '../types';
import {
  generateFicha, regenerateExercise, rewriteStory, adaptFicha, cleanCode, addExercise, moreCards, TIPOS,
  type FichaContent, type FichaExercise, type FichaExerciseType, type FichaThemeChoice, type FichaRequest,
  type FichaFormato, type FichaVariante,
} from '../services/resources';
import { saveFichaPdf, saveFichaDocx, VARIANTE_LABEL } from '../services/exportFicha';
import { FICHA_THEMES, fichaTheme, type FichaThemeId } from '../lib/fichaThemes';
import { hasApiKey } from '../services/gemini';
import { isoDate } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';
import { AiKeyNotice } from '../components/ui/AiKeyNotice';
import { isDesktop } from '../services/storage';
import { ExerciseEditor } from '../components/fichas/ExerciseEditor';
import { FichaPreview } from '../components/fichas/FichaPreview';
import { ThemeArt } from '../components/fichas/ThemeArt';
import { TIPO_LABEL, TIPO_EMOJI } from '../components/fichas/tipos';
import { requestSettingsPanel } from '../lib/settingsNav';
import { takeFichaPara } from '../lib/apoyoNav';
import { contextoFichaApoyo, nivelDe, trimestreDe } from '../lib/apoyo';
import { useNombreCurso } from '../hooks/useNombreCurso';
import type { ApoyoData } from '../types/apoyo';

interface Props {
  classes: Class[];
  fichas: Ficha[];
  onSave: (f: Ficha) => void;
  onDelete: (id: string) => void;
  onNav: (s: string) => void;
  /** Abre la ficha a pantalla completa en Aula Live. */
  onProject?: (f: Ficha) => void;
  /** PT y AL: su alumnado de apoyo, para hacer una ficha adaptada a uno. */
  apoyo?: ApoyoData;
}

function newId() {
  return 'fic' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

/** Fichas guardadas antes de que existieran los bloques de actividad tenían `ejercicios` plano. */
function normalizeContent(c: FichaContent): FichaContent {
  if (c.actividades?.length) return c;
  const legacy = (c as unknown as { ejercicios?: FichaExercise[] }).ejercicios;
  return { ...c, actividades: legacy?.length ? [{ titulo: '', ejercicios: legacy }] : [] };
}

const move = <X,>(list: X[], i: number, dir: -1 | 1): X[] => {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

type T = (k: string, v?: Record<string, string | number>) => string;

const FORMATOS: { id: FichaFormato; emoji: string; label: string; desc: string }[] = [
  { id: 'ficha', emoji: '📝', label: 'Ficha', desc: 'Ejercicios por bloques, para trabajar en la hoja.' },
  { id: 'escape', emoji: '🔐', label: 'Escape room', desc: 'Cada bloque es una sala: sus respuestas forman el código que abre el candado.' },
  { id: 'tarjetas', emoji: '🃏', label: 'Tarjetas recortables', desc: 'Pregunta delante y respuesta detrás, para jugar en grupo.' },
];

const FORMATO_LABEL: Record<FichaFormato, string> = { ficha: 'Ficha', escape: 'Escape room', tarjetas: 'Tarjetas' };

const VARIANTES: { id: FichaVariante; emoji: string; desc: string }[] = [
  { id: 'apoyo', emoji: '🤝', desc: 'Más guiada y con números más sencillos.' },
  { id: 'ampliacion', emoji: '🚀', desc: 'Más reto: más pasos y justificar.' },
  { id: 'lectura_facil', emoji: '📖', desc: 'Frases cortas y claras, letra más grande.' },
];

const VARIANTE_SUFFIX: Record<FichaVariante, string> = { apoyo: 'apoyo', ampliacion: 'ampliación', lectura_facil: 'lectura fácil' };

/** Rejilla de temas para elegir el mundo de la ficha. */
function ThemeGrid({ value, onChange, withAuto, compact, t }: {
  value: FichaThemeChoice; onChange: (v: FichaThemeId | 'auto') => void; withAuto?: boolean; compact?: boolean; t: T;
}) {
  return (
    <div className={`fe-themes${compact ? ' compact' : ''}`} role="radiogroup" aria-label={t('Tema de la ficha')}>
      {withAuto && (
        <button
          type="button" role="radio" aria-checked={value === 'auto'}
          className={`fe-theme auto${value === 'auto' ? ' on' : ''}`} onClick={() => onChange('auto')}
        >
          <span className="fe-theme-art"><span className="big">✨</span></span>
          <span className="fe-theme-name">{t('Que elija la IA')}</span>
        </button>
      )}
      {FICHA_THEMES.map(th => (
        <button
          key={th.id} type="button" role="radio" aria-checked={value === th.id}
          className={`fe-theme${value === th.id ? ' on' : ''}`} onClick={() => onChange(th.id)}
          style={{ '--th': `#${th.color}`, '--thd': `#${th.oscuro}`, '--thl': `#${th.claro}` } as React.CSSProperties}
        >
          <span className={`fe-theme-art${th.id === 'clasico' ? ' plain' : ''}`}>
            <ThemeArt id={th.id} />
          </span>
          <span className="fe-theme-name">{t(th.nombre)}</span>
        </button>
      ))}
    </div>
  );
}

export function Resources({ classes, fichas, onSave, onDelete, onNav, onProject, apoyo }: Props) {
  const { toast } = useToast();
  const { t, lang, locale } = useI18n();
  const nombreCurso = useNombreCurso();

  /** PT y AL: el alumno para el que se adapta la ficha, su nivel y lo que necesita. */
  const paraAlumno = (id: string) => {
    const a = apoyo?.alumnos.find(x => x.id === id);
    if (!a) return null;
    const n = nivelDe(a);
    const T = trimestreDe(isoDate());
    const objetivos = (apoyo?.programas ?? []).filter(p => p.alumnoId === a.id)
      .flatMap(p => p.objetivos.filter(o => o.trimestres.includes(T)).map(o => o.texto.trim())).filter(Boolean);
    return { id: a.id, nivel: n ? nombreCurso(n) : '', contexto: contextoFichaApoyo(a, objetivos, t) };
  };
  // Desde Programas se llega con el alumno ya elegido
  const [inicial] = useState(() => { const id = takeFichaPara(); return id ? paraAlumno(id) : null; });
  const [alumnoApoyo, setAlumnoApoyo] = useState(inicial?.id ?? '');

  /* ── Formulario ── */
  const [classId, setClassId] = useState('');
  const [tema, setTema] = useState('');
  const [area, setArea] = useState('');
  const [nivel, setNivel] = useState(inicial?.nivel ?? '');
  const [numEjercicios, setNumEjercicios] = useState(6);
  const [niveles, setNiveles] = useState(false);
  const [contextoClase, setContextoClase] = useState(inicial?.contexto ?? '');
  const [estilo, setEstilo] = useState<FichaThemeChoice>('auto');
  const [formato, setFormato] = useState<FichaFormato>('ficha');

  /* ── Editor ── */
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState<FichaContent | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busyEx, setBusyEx] = useState<string | null>(null);
  const [storyBusy, setStoryBusy] = useState(false);
  const [adaptOpen, setAdaptOpen] = useState(false);
  const [adapting, setAdapting] = useState<FichaVariante | null>(null);
  /** Bloque al que se está añadiendo un ejercicio con IA, o -1 para tarjetas. */
  const [adding, setAdding] = useState<number | null>(null);
  const [addTipo, setAddTipo] = useState<Record<number, FichaExerciseType | ''>>({});

  const activeClass = classes.find(c => c.id === classId) ?? null;
  const sinClave = !hasApiKey();

  function pickClass(id: string) {
    setClassId(id);
    const cls = classes.find(c => c.id === id);
    if (cls) setArea(cls.subject);
  }

  const request = (): FichaRequest => ({ tema, area, nivel, numEjercicios, niveles, contextoClase, estilo, formato });

  function pickFormato(f: FichaFormato) {
    setFormato(f);
    if (f === 'tarjetas' && numEjercicios < 8) setNumEjercicios(12);
  }

  function edit(fn: (c: FichaContent) => FichaContent) {
    setContent(c => (c ? fn(c) : c));
    setDirty(true);
  }

  /* ── Generar ── */
  async function handleGenerate() {
    if (!tema.trim()) { toast(t('Escribe el tema de la ficha')); return; }
    const result = await generateFicha({ ...request(), tema: tema.trim() }, lang, {
      onStart: () => setGenerating(true),
      onEnd: () => setGenerating(false),
      onError: m => toast(m),
    });
    const ok = result && (result.formato === 'tarjetas' ? !!result.tarjetas?.length : result.actividades.some(a => a.ejercicios.length));
    if (!result || !ok) { toast(t('La IA no devolvió una ficha válida. Vuelve a intentarlo.')); return; }
    setContent(result);
    setEditingId(null);
    setDirty(true);
    setSelected(null);
    window.scrollTo({ top: 0 });
  }

  function currentFicha(): Ficha | null {
    if (!content) return null;
    return {
      id: editingId ?? newId(),
      at: new Date().toISOString(),
      date: isoDate(),
      class_id: classId || undefined,
      class_name: activeClass?.name,
      title: (content.titulo || t('Ficha de trabajo')) + (content.variante ? ` (${t(VARIANTE_SUFFIX[content.variante])})` : ''),
      request: { tema, area, nivel, numEjercicios, niveles, contextoClase },
      content,
    };
  }

  function handleSave() {
    const f = currentFicha();
    if (!f) return;
    onSave(f);
    setEditingId(f.id);
    setDirty(false);
    toast(t('Ficha guardada'));
  }

  /* ── Exportar ── */
  const CURRENT_KEY = '__current__';
  const [exporting, setExporting] = useState<{ key: string; kind: 'pdf' | 'docx' } | null>(null);

  async function handleExportPdf(f: Ficha | null, key: string) {
    if (!f) return;
    setExporting({ key, kind: 'pdf' });
    const res = await saveFichaPdf(f, lang);
    setExporting(null);
    if (res.error === 'not-desktop') { toast(t('Guardar en PDF solo está disponible en la aplicación de escritorio.')); return; }
    if (res.canceled) return;
    if (res.error) { toast(t('No se pudo generar el PDF: {error}', { error: res.error })); return; }
    toast(t('✅ PDF guardado'));
  }

  async function handleExportDocx(f: Ficha | null, key: string) {
    if (!f) return;
    setExporting({ key, kind: 'docx' });
    try {
      await saveFichaDocx(f, lang);
      toast(t('✅ Word descargado'));
    } catch {
      toast(t('No se pudo generar el documento Word.'));
    } finally {
      setExporting(null);
    }
  }

  function openSaved(f: Ficha) {
    setEditingId(f.id);
    setContent(normalizeContent(f.content));
    setClassId(f.class_id ?? '');
    setTema(f.request.tema);
    setArea(f.request.area);
    setNivel(f.request.nivel);
    setNumEjercicios(f.request.numEjercicios);
    setNiveles(f.request.niveles);
    setContextoClase(f.request.contextoClase);
    setDirty(false);
    setSelected(null);
    window.scrollTo({ top: 0 });
  }

  function backToLibrary() {
    if (dirty && !window.confirm(t('La ficha tiene cambios sin guardar. ¿Salir sin guardar?'))) return;
    setContent(null); setEditingId(null); setDirty(false); setSelected(null);
  }

  /* ── Edición por bloques ── */
  const patchEx = (a: number, i: number, ex: FichaExercise) => edit(c => ({
    ...c, actividades: c.actividades.map((act, ai) => (ai === a ? { ...act, ejercicios: act.ejercicios.map((x, xi) => (xi === i ? ex : x)) } : act)),
  }));
  const moveEx = (a: number, i: number, dir: -1 | 1) => {
    edit(c => ({ ...c, actividades: c.actividades.map((act, ai) => (ai === a ? { ...act, ejercicios: move(act.ejercicios, i, dir) } : act)) }));
    setSelected(`${a}-${i + dir}`);
  };
  const deleteEx = (a: number, i: number) => {
    edit(c => ({ ...c, actividades: c.actividades.map((act, ai) => (ai === a ? { ...act, ejercicios: act.ejercicios.filter((_, xi) => xi !== i) } : act)) }));
    setSelected(null);
  };
  const patchAct = (a: number, p: Partial<FichaContent['actividades'][number]>) =>
    edit(c => ({ ...c, actividades: c.actividades.map((act, ai) => (ai === a ? { ...act, ...p } : act)) }));
  const moveAct = (a: number, dir: -1 | 1) => { edit(c => ({ ...c, actividades: move(c.actividades, a, dir) })); setSelected(`act-${a + dir}`); };
  const deleteAct = (a: number) => {
    if (!window.confirm(t('¿Eliminar este bloque y sus ejercicios?'))) return;
    edit(c => ({ ...c, actividades: c.actividades.filter((_, ai) => ai !== a) }));
    setSelected(null);
  };

  async function handleRegenerate(a: number, i: number, instruccion: string, tipo?: FichaExerciseType) {
    if (!content) return;
    const id = `${a}-${i}`;
    const ex = await regenerateExercise(content, request(), a, i, { instruccion, tipo }, lang, {
      onStart: () => setBusyEx(id),
      onEnd: () => setBusyEx(null),
      onError: m => toast(m),
    });
    if (!ex) { toast(t('La IA no devolvió un ejercicio válido. Vuelve a intentarlo.')); return; }
    patchEx(a, i, ex);
    toast(t('Ejercicio rehecho'));
  }

  /** Crea la versión adaptada como ficha nueva; la actual se guarda antes para no perderla. */
  async function handleAdapt(v: FichaVariante) {
    if (!content) return;
    setAdaptOpen(false);
    if (dirty || !editingId) handleSave();
    const res = await adaptFicha(content, request(), v, lang, {
      onStart: () => setAdapting(v),
      onEnd: () => setAdapting(null),
      onError: m => toast(m),
    });
    if (!res) { toast(t('La IA no devolvió una ficha válida. Vuelve a intentarlo.')); return; }
    // El título impreso no dice que es una adaptación (lo vería el alumnado): eso va solo en «Mis fichas»
    setContent(res);
    setEditingId(null);
    setDirty(true);
    setSelected(null);
    window.scrollTo({ top: 0 });
    toast(t('{name} creada. Guárdala para tenerla en Mis fichas.', { name: t(VARIANTE_LABEL[v]) }));
  }

  async function handleAddExercise(a: number) {
    if (!content) return;
    const tipo = addTipo[a] || undefined;
    const ex = await addExercise(content, request(), a, { tipo }, lang, {
      onStart: () => setAdding(a),
      onEnd: () => setAdding(null),
      onError: m => toast(m),
    });
    if (!ex) { toast(t('La IA no devolvió un ejercicio válido. Vuelve a intentarlo.')); return; }
    const n = content.actividades[a]?.ejercicios.length ?? 0;
    edit(c => ({ ...c, actividades: c.actividades.map((act, ai) => (ai === a ? { ...act, ejercicios: [...act.ejercicios, ex] } : act)) }));
    setSelected(`${a}-${n}`);
    // En un escape room el código del candado sale de las respuestas: hay que revisarlo
    toast(t(content.formato === 'escape' ? 'Ejercicio añadido. Revisa el código del candado de esta sala.' : 'Ejercicio añadido'));
  }

  async function handleMoreCards() {
    if (!content) return;
    const list = await moreCards(content, request(), 4, lang, {
      onStart: () => setAdding(-1),
      onEnd: () => setAdding(null),
      onError: m => toast(m),
    });
    if (!list) { toast(t('La IA no devolvió tarjetas válidas. Vuelve a intentarlo.')); return; }
    edit(c => ({ ...c, tarjetas: [...(c.tarjetas ?? []), ...list] }));
    toast(t('{n} tarjetas añadidas', { n: list.length }));
  }

  const patchCard = (i: number, p: Partial<NonNullable<FichaContent['tarjetas']>[number]>) =>
    edit(c => ({ ...c, tarjetas: (c.tarjetas ?? []).map((x, xi) => (xi === i ? { ...x, ...p } : x)) }));

  function changeTheme(id: FichaThemeId) {
    edit(c => ({ ...c, estilo: id }));
  }

  async function handleRewriteStory() {
    if (!content?.estilo || content.estilo === 'clasico') return;
    const res = await rewriteStory(content, request(), content.estilo, lang, {
      onStart: () => setStoryBusy(true),
      onEnd: () => setStoryBusy(false),
      onError: m => toast(m),
    });
    if (!res) { toast(t('La IA no devolvió una historia válida. Vuelve a intentarlo.')); return; }
    edit(c => ({ ...c, historia: res.historia, actividades: res.actividades }));
    toast(t('Historia reescrita'));
  }

  /** Clic en la hoja: selecciona el bloque y lo trae a la vista en el editor. */
  function selectFromPreview(id: string) {
    setSelected(id);
    document.querySelector(`[data-block="${id}"]`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }

  /* ══ Editor ══ */
  if (content) {
    const theme = fichaTheme(content.estilo);
    const story = theme.id !== 'clasico';
    const tarjetas = content.formato === 'tarjetas';
    const escape = content.formato === 'escape';
    const historia = content.historia;
    const ficha = currentFicha()!;
    const blockCls = (id: string) => `fe-sec${selected === id ? ' sel' : ''}`;
    const selectOn = (id: string) => ({ 'data-block': id, onFocusCapture: () => setSelected(id), onClick: () => setSelected(id) });

    return (
      <section className="sec active fe">
        <div className="fe-top">
          <button type="button" className="btn-ghost" onClick={backToLibrary}><ArrowLeft size={14} />{t('Mis fichas')}</button>
          <div className="fe-top-ttl">
            <ThemeArt id={theme.id} className="fe-top-emoji" />
            <strong>{content.titulo || t('Ficha de trabajo')}</strong>
            {content.variante && <span className="fe-badge">{t(VARIANTE_LABEL[content.variante])}</span>}
            {dirty && <span className="sda-unsaved">{t('Sin guardar')}</span>}
          </div>
          <div className="fe-top-actions">
            {onProject && (
              <button type="button" className="btn-ghost" onClick={() => onProject(ficha)} title={t('Proyectarla a pantalla completa en Aula Live')}>
                <MonitorPlay size={14} />{t('Proyectar')}
              </button>
            )}
            <div className="fe-adapt">
              <button type="button" className="btn-ghost" disabled={sinClave || adapting !== null} aria-expanded={adaptOpen} onClick={() => setAdaptOpen(o => !o)}>
                {adapting ? <><span className="spin" />{t('Adaptando…')}</> : <><Wand2 size={14} />{t('Adaptar')}<ChevronDown size={13} /></>}
              </button>
              {adaptOpen && (
                <div className="fe-adapt-menu" role="menu">
                  <div className="fe-adapt-hd">{t('Crea otra versión de esta ficha, con la misma historia:')}</div>
                  {VARIANTES.map(v => (
                    <button key={v.id} type="button" role="menuitem" className="fe-adapt-item" onClick={() => handleAdapt(v.id)}>
                      <span className="fe-adapt-emoji">{v.emoji}</span>
                      <span><strong>{t(VARIANTE_LABEL[v.id])}</strong><em>{t(v.desc)}</em></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isDesktop() && (
              <button className="btn-ghost" disabled={exporting !== null} onClick={() => handleExportPdf(ficha, CURRENT_KEY)} title={t('Guardar en PDF')}>
                {exporting?.key === CURRENT_KEY && exporting.kind === 'pdf' ? <span className="spin" /> : <FileDown size={14} />}{t('PDF')}
              </button>
            )}
            <button className="btn-ghost" disabled={exporting !== null} onClick={() => handleExportDocx(ficha, CURRENT_KEY)} title={t('Descargar en Word')}>
              {exporting?.key === CURRENT_KEY && exporting.kind === 'docx' ? <span className="spin" /> : <FileType2 size={14} />}{t('Word')}
            </button>
            <button className="btn-accent" onClick={handleSave}><Check size={14} />{t('Guardar')}</button>
          </div>
        </div>

        <div className="card fe-theme-bar">
          <div className="fe-theme-bar-hd">
            <span className="fe-lbl">{t('Tema')}</span>
            <span className="fe-hint">{t('Cambia el aspecto al instante, sin volver a generar.')}</span>
            <span style={{ flex: 1 }} />
            {story && !tarjetas && (
              <button type="button" className="btn-ghost sm" disabled={storyBusy || sinClave} onClick={handleRewriteStory}>
                {storyBusy ? <span className="spin" /> : <Wand2 size={13} />}
                {historia ? t('Adaptar la historia a este tema') : t('Crear la historia')}
              </button>
            )}
          </div>
          <ThemeGrid value={theme.id} onChange={v => v !== 'auto' && changeTheme(v)} compact t={t} />
        </div>

        <div className="fe-grid">
          <div className="fe-panel">
            <div className={blockCls('titulo')} {...selectOn('titulo')}>
              <label className="fe-field">
                <span className="fe-lbl">{t('Título')}</span>
                <input className="finput fe-title" value={content.titulo ?? ''} onChange={e => edit(c => ({ ...c, titulo: e.target.value }))} />
              </label>
            </div>

            {story && historia && !tarjetas && (
              <div className={`${blockCls('historia')} fe-story`} {...selectOn('historia')}>
                <div className="fe-sec-hd">📖 {t('La historia')}</div>
                <div className="fe-row">
                  <input
                    className="finput fe-emoji" value={historia.emoji} aria-label={t('Emoji del personaje')}
                    onChange={e => edit(c => ({ ...c, historia: { ...c.historia!, emoji: e.target.value } }))}
                  />
                  <input
                    className="finput" value={historia.personaje} aria-label={t('Personaje')} placeholder={t('Personaje')}
                    onChange={e => edit(c => ({ ...c, historia: { ...c.historia!, personaje: e.target.value } }))}
                  />
                </div>
                <label className="fe-field">
                  <span className="fe-lbl">{t('La misión')}</span>
                  <textarea className="finput" rows={3} value={historia.mision} onChange={e => edit(c => ({ ...c, historia: { ...c.historia!, mision: e.target.value } }))} />
                </label>
              </div>
            )}

            {!tarjetas && (
              <div className={blockCls('explicacion')} {...selectOn('explicacion')}>
                <label className="fe-field">
                  <span className="fe-lbl">💡 {t('Antes de empezar')}</span>
                  <textarea className="finput" rows={3} value={content.explicacion ?? ''} onChange={e => edit(c => ({ ...c, explicacion: e.target.value }))} />
                </label>
              </div>
            )}
            <div className={blockCls('instrucciones')} {...selectOn('instrucciones')}>
              <label className="fe-field">
                <span className="fe-lbl">{t(tarjetas ? 'Cómo se juega' : 'Instrucciones')}</span>
                <textarea className="finput" rows={2} value={content.instrucciones ?? ''} onChange={e => edit(c => ({ ...c, instrucciones: e.target.value }))} />
              </label>
            </div>

            {tarjetas && (
              <div className="fe-cards">
                {(content.tarjetas ?? []).map((tj, i) => (
                  <div
                    key={i} className={`fe-card-row${selected === `card-${i}` ? ' sel' : ''}`} data-block={`card-${i}`}
                    onFocusCapture={() => setSelected(`card-${i}`)} onClick={() => setSelected(`card-${i}`)}
                  >
                    <span className="fe-ex-n">{i + 1}</span>
                    <div className="fe-card-fields">
                      <input className="finput" value={tj.pregunta} aria-label={t('Pregunta {n}', { n: i + 1 })} placeholder={t('Pregunta')} onChange={e => patchCard(i, { pregunta: e.target.value })} />
                      <input className="finput fe-card-ans" value={tj.respuesta} aria-label={t('Respuesta {n}', { n: i + 1 })} placeholder={t('Respuesta')} onChange={e => patchCard(i, { respuesta: e.target.value })} />
                    </div>
                    <button type="button" className="ico-btn sm" title={t('Subir')} aria-label={t('Subir')} disabled={i === 0}
                      onClick={() => edit(c => ({ ...c, tarjetas: move(c.tarjetas ?? [], i, -1) }))}><ArrowUp size={14} /></button>
                    <button type="button" className="ico-btn sm" title={t('Bajar')} aria-label={t('Bajar')} disabled={i === (content.tarjetas?.length ?? 0) - 1}
                      onClick={() => edit(c => ({ ...c, tarjetas: move(c.tarjetas ?? [], i, 1) }))}><ArrowDown size={14} /></button>
                    <button type="button" className="ico-btn sm" title={t('Eliminar')} aria-label={t('Eliminar')}
                      onClick={() => edit(c => ({ ...c, tarjetas: (c.tarjetas ?? []).filter((_, xi) => xi !== i) }))}><Trash2 size={14} color="var(--danger)" /></button>
                  </div>
                ))}
                <div className="fe-add-row">
                  <button type="button" className="btn-ghost sm" onClick={() => edit(c => ({ ...c, tarjetas: [...(c.tarjetas ?? []), { pregunta: '', respuesta: '' }] }))}>
                    <Plus size={14} />{t('Añadir tarjeta')}
                  </button>
                  <button type="button" className="fe-redo-btn" disabled={sinClave || adding !== null} onClick={handleMoreCards}>
                    {adding === -1 ? <span className="spin" /> : <Sparkles size={13} />}{t('4 tarjetas más con IA')}
                  </button>
                </div>
              </div>
            )}

            {!tarjetas && content.actividades.map((act, a) => {
              const color = theme.bloques[a % theme.bloques.length];
              return (
                <div
                  key={a} className={`fe-act${selected === `act-${a}` ? ' sel' : ''}`} data-block={`act-${a}`}
                  style={{ '--blk': `#${color.bg}`, '--blk-l': `#${color.light}` } as React.CSSProperties}
                >
                  <div className="fe-act-hd" onClick={() => setSelected(`act-${a}`)}>
                    {story && (
                      <input
                        className="fe-act-emoji" value={act.emoji ?? theme.iconos[a % theme.iconos.length]} aria-label={t('Emoji')}
                        onChange={e => patchAct(a, { emoji: e.target.value })}
                      />
                    )}
                    <span className="fe-act-lbl">{t(escape ? 'Sala' : theme.paso)} {a + 1}</span>
                    <input className="fe-act-ttl" value={act.titulo} aria-label={t('Título del bloque')} onChange={e => patchAct(a, { titulo: e.target.value })} />
                    <button type="button" className="ico-btn sm" title={t('Subir')} aria-label={t('Subir bloque')} disabled={a === 0} onClick={() => moveAct(a, -1)}><ArrowUp size={14} /></button>
                    <button type="button" className="ico-btn sm" title={t('Bajar')} aria-label={t('Bajar bloque')} disabled={a === content.actividades.length - 1} onClick={() => moveAct(a, 1)}><ArrowDown size={14} /></button>
                    <button type="button" className="ico-btn sm" title={t('Eliminar')} aria-label={t('Eliminar bloque')} onClick={() => deleteAct(a)}><Trash2 size={14} /></button>
                  </div>
                  {story && (
                    <input
                      className="finput fe-act-narr" value={act.narrativa ?? ''} placeholder={t('Qué pasa en la historia en este paso')}
                      aria-label={t('Narrativa')} onChange={e => patchAct(a, { narrativa: e.target.value })}
                    />
                  )}
                  <div className="fe-act-body">
                    {act.ejercicios.map((ex, i) => (
                      <ExerciseEditor
                        key={i} ex={ex} n={i + 1} id={`${a}-${i}`} t={t}
                        selected={selected === `${a}-${i}`} first={i === 0} last={i === act.ejercicios.length - 1}
                        busy={busyEx === `${a}-${i}`} aiDisabled={sinClave || (busyEx !== null && busyEx !== `${a}-${i}`)}
                        onSelect={() => setSelected(`${a}-${i}`)}
                        onChange={x => patchEx(a, i, x)}
                        onMove={dir => moveEx(a, i, dir)}
                        onDelete={() => deleteEx(a, i)}
                        onRegenerate={(ins, tipo) => handleRegenerate(a, i, ins, tipo)}
                      />
                    ))}
                    {!act.ejercicios.length && <p className="fe-empty">{t('Este bloque se ha quedado sin ejercicios.')}</p>}
                    <div className="fe-add-row">
                      <select
                        className="finput" value={addTipo[a] ?? ''} aria-label={t('Tipo del ejercicio nuevo')}
                        onChange={e => setAddTipo(m => ({ ...m, [a]: e.target.value as FichaExerciseType | '' }))}
                      >
                        <option value="">{t('Que elija la IA')}</option>
                        {TIPOS.map(x => <option key={x} value={x}>{TIPO_EMOJI[x]} {t(TIPO_LABEL[x])}</option>)}
                      </select>
                      <button type="button" className="fe-redo-btn" disabled={sinClave || adding !== null} onClick={() => handleAddExercise(a)}>
                        {adding === a ? <span className="spin" /> : <Plus size={13} />}{t('Añadir ejercicio con IA')}
                      </button>
                    </div>
                  </div>
                  {escape && (
                    <div className="fe-lock">
                      <span className="fe-lock-ico" aria-hidden="true">🔒</span>
                      <label className="fe-field fe-lock-code">
                        <span className="fe-lbl">{t('Código')}</span>
                        <input
                          className="finput" value={act.candado?.codigo ?? ''}
                          onChange={e => patchAct(a, { candado: { pista: act.candado?.pista ?? '', codigo: cleanCode(e.target.value) } })}
                        />
                      </label>
                      <label className="fe-field" style={{ flex: 1 }}>
                        <span className="fe-lbl">{t('Cómo se forma')} <em>· {t('se imprime; el código no')}</em></span>
                        <input
                          className="finput" value={act.candado?.pista ?? ''}
                          onChange={e => patchAct(a, { candado: { codigo: act.candado?.codigo ?? '', pista: e.target.value } })}
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}

            {story && historia && !tarjetas && (
              <div className={`${blockCls('cierre')} fe-story`} {...selectOn('cierre')}>
                <div className="fe-sec-hd">🏅 {t('El final y la insignia')}</div>
                <label className="fe-field">
                  <span className="fe-lbl">{t('Insignia')}</span>
                  <input className="finput" value={historia.insignia} onChange={e => edit(c => ({ ...c, historia: { ...c.historia!, insignia: e.target.value } }))} />
                </label>
                <label className="fe-field">
                  <span className="fe-lbl">{t('Mensaje final')}</span>
                  <textarea className="finput" rows={2} value={historia.cierre} onChange={e => edit(c => ({ ...c, historia: { ...c.historia!, cierre: e.target.value } }))} />
                </label>
              </div>
            )}
          </div>

          <aside className="fe-preview" aria-label={t('Vista previa')}>
            <div className="fe-preview-hd"><Eye size={13} />{t('Vista previa · así se imprime')}</div>
            <div className="fe-preview-scroll">
              <FichaPreview ficha={ficha} lang={lang} selected={selected} onSelect={selectFromPreview} />
            </div>
          </aside>
        </div>
      </section>
    );
  }

  /* ══ Crear + biblioteca ══ */
  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Recursos')}</h1>
          <p className="pg-sub">{t('Fichas con historia, listas para imprimir: la IA las crea y tú las retocas.')}</p>
        </div>
      </div>

      {sinClave && (
        <AiKeyNotice message={t('Para generar recursos hace falta la clave gratuita de Google que se configura en Configuración.')} action={t('Configurar la IA')} onAction={() => { requestSettingsPanel('ia'); onNav('profile'); }} />
      )}

      <div className="card fe-create" style={{ marginBottom: 16 }}>
        <div className="card-hd">
          <div className="card-ttl"><Sparkles size={14} color="var(--accent-d)" />{t('Nueva ficha')}</div>
        </div>

        <div className="fgroup">
          <label className="flabel" htmlFor="resources-f1">{t('¿De qué va la ficha?')} *</label>
          <input
            id="resources-f1"
            className="finput fe-big" value={tema} onChange={e => setTema(e.target.value)}
            placeholder={t('Ej: las fracciones equivalentes')}
            onKeyDown={e => { if (e.key === 'Enter' && !generating && !sinClave) handleGenerate(); }}
          />
        </div>

        <div className="frow">
          {apoyo?.alumnos.length ? (
            <div className="fgroup">
              <label className="flabel" htmlFor="resources-f2">{t('Adaptada a')}</label>
              <select id="resources-f2" className="finput" value={alumnoApoyo} onChange={e => {
                setAlumnoApoyo(e.target.value);
                const x = paraAlumno(e.target.value);
                setNivel(x?.nivel ?? '');
                setContextoClase(x?.contexto ?? '');
              }}>
                <option value="">{t('Sin alumno concreto')}</option>
                {[...apoyo.alumnos].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          ) : (
            <div className="fgroup">
              <label className="flabel" htmlFor="resources-f2">{t('Clase')}</label>
              <select id="resources-f2" className="finput" value={classId} onChange={e => pickClass(e.target.value)}>
                <option value="">{t('Sin clase concreta')}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="fgroup">
            <label className="flabel" htmlFor="resources-f3">{t('Área o asignatura')}</label>
            <input id="resources-f3" className="finput" value={area} onChange={e => setArea(e.target.value)} />
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="resources-f4">{t('Nivel o curso')}</label>
            <input id="resources-f4" className="finput" value={nivel} onChange={e => setNivel(e.target.value)} placeholder={t('Ej: 5º de Primaria')} />
          </div>
          <div className="fgroup" style={{ maxWidth: 140 }}>
            <label className="flabel" htmlFor="resources-f5">{t(formato === 'tarjetas' ? 'Nº de tarjetas' : 'Nº de ejercicios')}</label>
            <input
              id="resources-f5"
              className="finput" type="number" min={1} max={20} value={numEjercicios}
              onChange={e => setNumEjercicios(Math.max(1, Math.min(formato === 'tarjetas' ? 32 : 20, Number(e.target.value) || 1)))}
            />
          </div>
        </div>

        {alumnoApoyo && (
          <p className="fe-hint" style={{ margin: '-4px 0 12px' }}>
            {t('Se adapta a su nivel, a sus necesidades y a sus objetivos de este trimestre; la IA no recibe su nombre ni su diagnóstico. Lo que se le cuenta está en «Más opciones», y lo puedes cambiar.')}
          </p>
        )}

        <div className="fgroup">
          <span className="flabel">{t('Qué quieres crear')}</span>
          <div className="fe-formats" role="radiogroup" aria-label={t('Qué quieres crear')}>
            {FORMATOS.map(f => (
              <button
                key={f.id} type="button" role="radio" aria-checked={formato === f.id}
                className={`fe-format${formato === f.id ? ' on' : ''}`} onClick={() => pickFormato(f.id)}
              >
                <span className="fe-format-emoji">{f.emoji}</span>
                <span className="fe-format-txt"><strong>{t(f.label)}</strong><em>{t(f.desc)}</em></span>
              </button>
            ))}
          </div>
        </div>

        <div className="fgroup">
          <span className="flabel">{t(formato === 'tarjetas' ? 'Aspecto de las tarjetas' : 'El mundo de la historia')}</span>
          <ThemeGrid value={estilo} onChange={setEstilo} withAuto t={t} />
          <p className="fe-hint" style={{ marginTop: 6 }}>
            {formato === 'tarjetas'
              ? t('Solo cambia los colores y los dibujos de las tarjetas.')
              : formato === 'escape' && estilo === 'clasico'
                ? t('Un escape room necesita historia: la IA elegirá el mundo que mejor encaje.')
                : estilo === 'clasico'
                  ? t('Sin historia: una ficha sobria de las de siempre.')
                  : t('La ficha se convierte en una misión: un personaje la presenta, cada bloque es un paso de la aventura y al final se gana una insignia.')}
          </p>
        </div>

        <details className="fe-more">
          <summary>{t('Más opciones')}</summary>
          <div className="fgroup" style={{ marginTop: 10 }}>
            <label className="flabel" htmlFor="resources-f6">{t('Cómo es el grupo (opcional)')}</label>
            <textarea id="resources-f6" className="finput" rows={2} value={contextoClase} onChange={e => setContextoClase(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer', marginBottom: 4 }}>
            <input type="checkbox" checked={niveles} onChange={e => setNiveles(e.target.checked)} />
            {t('Incluir variantes de apoyo y ampliación por ejercicio')}
          </label>
          <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 4 }}>
            {t('Útil como referencia para atender distintos ritmos; no se exportan en la ficha impresa, solo se ven aquí.')}
          </p>
        </details>

        <div style={{ paddingTop: 14, marginTop: 10, borderTop: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn-accent" disabled={generating || sinClave} onClick={handleGenerate}>
            {generating
              ? <><span className="spin" />{t('Creando…')}</>
              : <><Sparkles size={14} />{t(formato === 'escape' ? 'Crear escape room' : formato === 'tarjetas' ? 'Crear tarjetas' : 'Crear ficha')}</>}
          </button>
          {generating && <span className="fe-hint">{t('La IA está escribiendo la historia y los ejercicios. Tarda unos segundos.')}</span>}
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-ttl"><Layers size={14} color="var(--accent-d)" />{t('Mis fichas')}</div>
          {fichas.length > 0 && <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 700 }}>{fichas.length}</span>}
        </div>
        {fichas.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>
            {t('Todavía no has guardado ninguna.')}
          </p>
        ) : (
          <div className="fe-lib">
            {fichas.map(f => {
              const th = fichaTheme(f.content.estilo);
              const nEj = f.content.formato === 'tarjetas' ? 0 : (f.content.actividades ?? []).reduce((s, a) => s + a.ejercicios.length, 0);
              return (
                <div key={f.id} className="fe-card" style={{ '--th': `#${th.color}`, '--thd': `#${th.oscuro}` } as React.CSSProperties}>
                  <button type="button" className="fe-card-main" onClick={() => openSaved(f)}>
                    <ThemeArt id={th.id} className="fe-card-art" />
                    <span className="fe-card-body">
                      <span className="fe-card-ttl">{f.title}</span>
                      <span className="fe-card-meta">
                        {[f.class_name, f.request.area, f.sda_title ? t('desde «{title}»', { title: f.sda_title }) : '',
                          nEj ? t('{n} ejercicios', { n: nEj }) : '',
                          f.content.formato === 'tarjetas' ? t('{n} tarjetas', { n: f.content.tarjetas?.length ?? 0 }) : '',
                          new Date(f.at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })]
                          .filter(Boolean).join(' · ')}
                      </span>
                      <span className="fe-card-theme">
                        {t(th.nombre)}
                        {f.content.formato && f.content.formato !== 'ficha' && <span className="fe-mini-badge">{t(FORMATO_LABEL[f.content.formato])}</span>}
                        {f.content.variante && <span className="fe-mini-badge var">{t(VARIANTE_LABEL[f.content.variante])}</span>}
                      </span>
                    </span>
                  </button>
                  <div className="fe-card-actions">
                    {isDesktop() && (
                      <button className="ico-btn" title={t('Guardar en PDF')} aria-label={t('Guardar en PDF')} disabled={exporting !== null} onClick={() => handleExportPdf(f, f.id)}>
                        {exporting?.key === f.id && exporting.kind === 'pdf' ? <span className="spin" /> : <FileDown size={15} />}
                      </button>
                    )}
                    <button className="ico-btn" title={t('Descargar en Word')} aria-label={t('Descargar en Word')} disabled={exporting !== null} onClick={() => handleExportDocx(f, f.id)}>
                      {exporting?.key === f.id && exporting.kind === 'docx' ? <span className="spin" /> : <FileType2 size={15} />}
                    </button>
                    <button
                      className="ico-btn" title={t('Eliminar')} aria-label={t('Eliminar')}
                      onClick={() => {
                        if (!window.confirm(t('¿Eliminar «{name}»?', { name: f.title }))) return;
                        onDelete(f.id);
                      }}
                    >
                      <Trash2 size={14} color="var(--danger)" />
                    </button>
                  </div>
                </div>
              );
            })}
            <button type="button" className="fe-card fe-card-new" onClick={() => document.getElementById('resources-f1')?.focus()}>
              <Plus size={18} />{t('Nueva ficha')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
