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
import { useMemo, useState } from 'react';
import {
  Sparkles, Plus, Trash2, Check, FileDown, FileType2, ArrowLeft, ArrowUp, ArrowDown, Wand2, Layers, Eye, ChevronDown, MonitorPlay, NotebookPen, BookOpen, KeyRound, Scissors, FlipHorizontal2, Image as ImageIcon,
} from 'lucide-react';
import type { Class, Ficha } from '../types';
import {
  generateFicha, regenerateExercise, rewriteStory, adaptFicha, cleanCode, addExercise, moreCards, moreCardsInteractivas, conHilo, tiposDisponibles,
  type FichaContent, type FichaExercise, type FichaExerciseType, type FichaThemeChoice, type FichaRequest,
  type FichaFormato, type FichaVariante, type FichaTarjetaInteractiva,
} from '../services/resources';
import { saveFichaPdf, saveFichaDocx, VARIANTE_LABEL } from '../services/exportFicha';
import { DIFICULTADES, esDificultad, estrellas, NOMBRE_DIFICULTAD, type Dificultad } from '../lib/escalera';
import { FICHA_THEMES, fichaTheme, conHistoria, type FichaThemeId } from '../lib/fichaThemes';
import { hasApiKey } from '../services/gemini';
import { isoDate } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';
import { AiKeyNotice } from '../components/ui/AiKeyNotice';
import { isDesktop } from '../services/storage';
import { ExerciseEditor } from '../components/fichas/ExerciseEditor';
import { RecuadroEditor } from '../components/fichas/RecuadroEditor';
import { FichaPreview } from '../components/fichas/FichaPreview';
import { ThemeArt } from '../components/fichas/ThemeArt';
import { ActividadVisualEditor, ConceptosEditor } from '../components/fichas/VisualEditor';
import { TarjetaImagenPicker } from '../components/fichas/TarjetaImagenPicker';
import { TarjetasInteractivasPlay } from '../components/fichas/TarjetasInteractivasPlay';
import { HiloSelector } from '../components/fichas/DibujosEditor';
import { LecturaEditor } from '../components/fichas/LecturaEditor';
import { GENEROS_LECTURA, NOMBRE_GENERO, type GeneroLectura } from '../lib/lectura';
import { hiloDeFicha, hiloPorId } from '../lib/hilos';
import { urlIlustracion } from '../lib/ilustraciones';
import { urlPicto } from '../lib/pictos';
import { TIPO_LABEL, TIPO_EMOJI } from '../components/fichas/tipos';
import { requestSettingsPanel } from '../lib/settingsNav';
import { useFichaParaPedido } from '../lib/apoyoNav';
import { contextoFichaApoyo, nivelDe, trimestreDe } from '../lib/apoyo';
import { useNombreCurso } from '../hooks/useNombreCurso';
import { useBorrador } from '../hooks/useBorrador';
import { AvisoBorrador, EstadoBorrador } from '../components/AvisoBorrador';
import type { ApoyoData } from '../types/apoyo';
import { compararNombres } from '../lib/alumnado';

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

const FORMATO_LABEL: Record<FichaFormato, string> = { ficha: 'Ficha', escape: 'Escape room', tarjetas: 'Tarjetas' };

/** Lo que se puede crear: las cuatro tarjetas grandes del primer paso. La comprensión lectora es una ficha con texto (siempre en «Cuaderno»). */
type TipoCreacion = FichaFormato | 'lectura';

const TIPOS_CREACION: { id: TipoCreacion; icono: React.ReactNode; color: string; label: string; desc: string; dato: string }[] = [
  { id: 'ficha', icono: <NotebookPen size={24} />, color: '#ec4899', label: 'Ficha de ejercicios', desc: 'Ejercicios de menos a más, para trabajar en la hoja.', dato: 'Se imprime en PDF o Word' },
  { id: 'lectura', icono: <BookOpen size={24} />, color: '#0ea5e9', label: 'Comprensión lectora', desc: 'Un texto con dibujos y actividades sobre él.', dato: 'Cuento, poema, noticia…' },
  { id: 'escape', icono: <KeyRound size={24} />, color: '#f59e0b', label: 'Escape room', desc: 'Cada bloque es una sala con su candado.', dato: 'Se puede proyectar en clase' },
  { id: 'tarjetas', icono: <Layers size={24} />, color: '#8b5cf6', label: 'Tarjetas', desc: 'Pregunta delante y respuesta detrás.', dato: 'Se puede proyectar en clase' },
];

/** Cuántos ejercicios (o tarjetas) se proponen al elegir cada tipo. */
const NUM_POR_DEFECTO: Record<TipoCreacion, number> = { ficha: 6, lectura: 8, escape: 6, tarjetas: 12 };

const VARIANTES: { id: FichaVariante; emoji: string; desc: string }[] = [
  { id: 'apoyo', emoji: '🤝', desc: 'Más guiada y con números más sencillos.' },
  { id: 'ampliacion', emoji: '🚀', desc: 'Más reto: más pasos y justificar.' },
  { id: 'lectura_facil', emoji: '📖', desc: 'Frases cortas y claras, letra más grande.' },
  { id: 'visual', emoji: '🖼️', desc: 'Pasos numerados con pictogramas, dibujos y frases cortas.' },
];

const VARIANTE_SUFFIX: Record<FichaVariante, string> = { apoyo: 'apoyo', ampliacion: 'ampliación', lectura_facil: 'lectura fácil', visual: 'visual' };

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

/** Lo que se autoguarda de una ficha a medias: ella y lo que se pidió para hacerla. */
interface BorradorFicha {
  content: FichaContent;
  editingId: string | null;
  classId: string; tema: string; area: string; nivel: string;
  numEjercicios: number; niveles: boolean; contextoClase: string;
  tipo: TipoCreacion; facil: boolean; estilo: FichaThemeChoice; hilo: string; visual: boolean;
  generoLectura: GeneroLectura | 'auto'; alumnoApoyo: string;
  modoTarjeta: 'recortables' | 'interactivas';
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
  // Desde la página de un alumno se llega con él ya elegido
  const fichaPara = useFichaParaPedido();
  const [inicial] = useState(() => (fichaPara ? paraAlumno(fichaPara) : null));
  const [alumnoApoyo, setAlumnoApoyo] = useState(inicial?.id ?? '');

  /* ── Formulario ── */
  const [classId, setClassId] = useState('');
  const [tema, setTema] = useState('');
  const [area, setArea] = useState('');
  const [nivel, setNivel] = useState(inicial?.nivel ?? '');
  const [numEjercicios, setNumEjercicios] = useState(6);
  const [niveles, setNiveles] = useState(false);
  // Con un alumno de apoyo, las instrucciones salen muy visuales (decisión del dueño, 6-10-2026)
  const [visual, setVisual] = useState(!!inicial);
  const [contextoClase, setContextoClase] = useState(inicial?.contexto ?? '');
  // Por defecto, la hoja de cuaderno (decisión del dueño, 14-10-2026); «Que elija la IA» sigue entre los de historia
  const [estilo, setEstilo] = useState<FichaThemeChoice>('cuaderno');
  const [tipo, setTipo] = useState<TipoCreacion>('ficha');
  /** Tarjetas: si se eligen recortables o interactivas (se giran en pantalla). */
  const [modoTarjeta, setModoTarjeta] = useState<'recortables' | 'interactivas'>('recortables');
  const formato: FichaFormato = tipo === 'lectura' ? 'ficha' : tipo;
  // Comprensión lectora: el tipo de texto ('auto' lo elige la IA) y, para cualquier ficha, la lectura fácil (dislexia)
  const [generoLectura, setGeneroLectura] = useState<GeneroLectura | 'auto'>('auto');
  const [facil, setFacil] = useState(false);
  // El hilo conductor: 'auto' lo elige la app por el tema, 'ninguno' quita los dibujos, o un hilo concreto
  const [hilo, setHilo] = useState('auto');

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
  /** Índice de la tarjeta interactiva a la que se le está eligiendo imagen. */
  const [pickingImagen, setPickingImagen] = useState<number | null>(null);
  /** Tarjetas interactivas: abrir el modo de uso (girar y marcar). */
  const [playing, setPlaying] = useState(false);

  const activeClass = classes.find(c => c.id === classId) ?? null;
  const sinClave = !hasApiKey();

  /* ── Autoguardado: lo que se está haciendo y no se ha guardado, para poder continuar si se cierra a medias ── */
  const pendiente = useMemo<BorradorFicha | null>(() => (content && dirty ? {
    content, editingId, classId, tema, area, nivel, numEjercicios, niveles, contextoClase, tipo, facil, estilo, hilo, visual, generoLectura, alumnoApoyo, modoTarjeta,
  } : null), [content, dirty, editingId, classId, tema, area, nivel, numEjercicios, niveles, contextoClase, tipo, facil, estilo, hilo, visual, generoLectura, alumnoApoyo, modoTarjeta]);
  const borrador = useBorrador<BorradorFicha>('ficha', pendiente, content?.titulo || tema);

  function continuarBorrador() {
    const b = borrador.continuar();
    if (!b) return;
    setContent(normalizeContent(b.content));
    setEditingId(b.editingId);
    setClassId(b.classId); setTema(b.tema); setArea(b.area); setNivel(b.nivel);
    setNumEjercicios(b.numEjercicios); setNiveles(b.niveles); setContextoClase(b.contextoClase);
    setTipo(b.tipo); setFacil(b.facil); setEstilo(b.estilo); setHilo(b.hilo); setVisual(b.visual);
    setGeneroLectura(b.generoLectura); setAlumnoApoyo(b.alumnoApoyo);
    setModoTarjeta(b.modoTarjeta ?? 'recortables');
    setDirty(true);
    setSelected(null);
    window.scrollTo({ top: 0 });
  }

  function pickClass(id: string) {
    setClassId(id);
    const cls = classes.find(c => c.id === id);
    if (cls) setArea(cls.subject);
  }

  const lectura = tipo === 'lectura';
  const request = (): FichaRequest => ({
    tema, area, nivel, numEjercicios, niveles, contextoClase, formato, hilo,
    // La comprensión lectora es siempre «Cuaderno» y sin pictogramas; con tarjetas no hay lectura fácil
    estilo: lectura ? 'cuaderno' : estilo, visual: visual && !lectura, lectura, generoLectura, facil: facil && tipo !== 'tarjetas',
    interactivas: tipo === 'tarjetas' && modoTarjeta === 'interactivas',
  });
  // Lo que la app elegiría por el tema (se enseña en el selector)
  const hiloDetectado = useMemo(() => (tema.trim() ? hiloDeFicha({ tema, area, nivel }) : undefined), [tema, area, nivel]);

  function pickTipo(nuevo: TipoCreacion) {
    // El número de ejercicios que traía el tipo anterior pasa al del nuevo; si el docente lo cambió, se respeta
    if (numEjercicios === NUM_POR_DEFECTO[tipo]) setNumEjercicios(NUM_POR_DEFECTO[nuevo]);
    setTipo(nuevo);
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
    const ok = result && (result.interactivas
      ? !!result.tarjetasInteractivas?.length
      : result.formato === 'tarjetas' ? !!result.tarjetas?.length : result.actividades.some(a => a.ejercicios.length));
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
    setTipo(f.content.lectura ? 'lectura' : f.content.formato ?? 'ficha');
    setModoTarjeta(f.content.interactivas ? 'interactivas' : 'recortables');
    setFacil(f.content.variante === 'lectura_facil');
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

  async function handleMoreCardsInt() {
    if (!content) return;
    const list = await moreCardsInteractivas(content, request(), 4, lang, {
      onStart: () => setAdding(-1),
      onEnd: () => setAdding(null),
      onError: m => toast(m),
    });
    if (!list) { toast(t('La IA no devolvió tarjetas válidas. Vuelve a intentarlo.')); return; }
    edit(c => ({ ...c, tarjetasInteractivas: [...(c.tarjetasInteractivas ?? []), ...list] }));
    toast(t('{n} tarjetas añadidas', { n: list.length }));
  }

  const patchCard = (i: number, p: Partial<NonNullable<FichaContent['tarjetas']>[number]>) =>
    edit(c => ({ ...c, tarjetas: (c.tarjetas ?? []).map((x, xi) => (xi === i ? { ...x, ...p } : x)) }));

  const patchCardInt = (i: number, p: Partial<FichaTarjetaInteractiva>) =>
    edit(c => ({ ...c, tarjetasInteractivas: (c.tarjetasInteractivas ?? []).map((x, xi) => (xi === i ? { ...x, ...p } : x)) }));
  const urlImagenInt = (tj: FichaTarjetaInteractiva) => (tj.imagenTipo === 'picto' ? urlPicto(tj.imagen) : urlIlustracion(tj.imagen));

  function changeTheme(id: FichaThemeId) {
    // Al pasar a «Cuaderno» una ficha sin hilo (y sin apoyos visuales), se le pone el que encaja por el tema
    edit(c => {
      const nueva = { ...c, estilo: id };
      return id === 'cuaderno' && !c.hilo && !c.visual && (c.formato ?? 'ficha') === 'ficha'
        ? conHilo(nueva, hiloDeFicha({ tema, area, nivel }).id)
        : nueva;
    });
  }

  async function handleRewriteStory() {
    if (!content?.estilo || !conHistoria(content.estilo)) return;
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
    const story = theme.historia;
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
            {dirty && <EstadoBorrador guardadoEn={borrador.guardadoEn} />}
          </div>
          <div className="fe-top-actions">
            {content.interactivas && (
              <button type="button" className="btn-ghost" onClick={() => setPlaying(true)} title={t('Girarlas a pantalla completa')}>
                <MonitorPlay size={14} />{t('Probar')}
              </button>
            )}
            {onProject && !content.interactivas && (
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
                  {VARIANTES.filter(v => !content.lectura || v.id === 'lectura_facil').map(v => (
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

        {!content.lectura && (
          <details className="card fe-look">
            <summary>
              <ThemeArt id={theme.id} className="fe-look-art" />
              <span className="fe-look-txt"><strong>{t('Aspecto')}</strong><em>{t(theme.nombre)}{theme.id === 'cuaderno' && !tarjetas && !escape && !content.visual ? ` · ${content.hilo ? hiloPorId(content.hilo)?.nombre[lang] ?? '' : t('Sin dibujos')}` : ''}</em></span>
              <span className="fe-look-cambiar">{t('Cambiar')}<ChevronDown size={14} /></span>
            </summary>
            <div className="fe-look-body">
              <div className="fe-theme-bar-hd">
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
              {theme.id === 'cuaderno' && !tarjetas && !escape && !content.visual && (
                <div className="fe-look-hilo">
                  <span className="fe-lbl">{t('Hilo conductor')}</span>
                  <HiloSelector value={content.hilo ?? 'ninguno'} onChange={v => edit(c => conHilo(c, v === 'ninguno' ? undefined : v))} t={t} />
                  <span className="fe-hint">{t('Cambia los dibujos de la cabecera; los de los ejercicios se quedan.')}</span>
                </div>
              )}
            </div>
          </details>
        )}

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

            {content.lectura && (
              <div className={`${blockCls('lectura')} fe-lec`} {...selectOn('lectura')}>
                <div className="fe-sec-hd">📖 {t('El texto')}</div>
                <LecturaEditor lectura={content.lectura} onChange={lectura => edit(c => ({ ...c, lectura }))} t={t} />
              </div>
            )}

            {!tarjetas && !content.lectura && (
              <div className={blockCls('explicacion')} {...selectOn('explicacion')}>
                <label className="fe-field">
                  <span className="fe-lbl">💡 {t('Antes de empezar')}</span>
                  <textarea className="finput" rows={3} value={content.explicacion ?? ''} onChange={e => edit(c => ({ ...c, explicacion: e.target.value }))} />
                </label>
                {content.visual && (
                  <ConceptosEditor conceptos={content.conceptos ?? []} onChange={conceptos => edit(c => ({ ...c, conceptos }))} t={t} />
                )}
              </div>
            )}
            <div className={blockCls('instrucciones')} {...selectOn('instrucciones')}>
              <label className="fe-field">
                <span className="fe-lbl">{t(tarjetas ? 'Cómo se juega' : 'Instrucciones')}</span>
                <textarea className="finput" rows={2} value={content.instrucciones ?? ''} onChange={e => edit(c => ({ ...c, instrucciones: e.target.value }))} />
              </label>
            </div>

            {tarjetas && !content.interactivas && (
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

            {tarjetas && content.interactivas && (
              <div className="fe-cards">
                {(content.tarjetasInteractivas ?? []).map((tj, i) => (
                  <div
                    key={i} className={`fe-card-row${selected === `card-${i}` ? ' sel' : ''}`} data-block={`card-${i}`}
                    onFocusCapture={() => setSelected(`card-${i}`)} onClick={() => setSelected(`card-${i}`)}
                  >
                    <span className="fe-ex-n">{i + 1}</span>
                    <button type="button" className="fe-card-img" onClick={() => setPickingImagen(i)} title={t('Elegir imagen')} aria-label={t('Elegir imagen')}>
                      {tj.imagen ? <img src={urlImagenInt(tj)} alt="" draggable={false} /> : <ImageIcon size={22} color="var(--text-3)" />}
                    </button>
                    <div className="fe-card-fields">
                      <input className="finput" value={tj.texto} aria-label={t('Texto {n}', { n: i + 1 })} placeholder={t('Texto')} onChange={e => patchCardInt(i, { texto: e.target.value })} />
                    </div>
                    <button type="button" className={`chip sm${tj.imagenDelante ? ' on' : ''}`} title={t('Qué va delante al girar')}
                      onClick={() => patchCardInt(i, { imagenDelante: !tj.imagenDelante })}>
                      <FlipHorizontal2 size={13} />{t(tj.imagenDelante ? 'Imagen delante' : 'Texto delante')}
                    </button>
                    <button type="button" className="ico-btn sm" title={t('Subir')} aria-label={t('Subir')} disabled={i === 0}
                      onClick={() => edit(c => ({ ...c, tarjetasInteractivas: move(c.tarjetasInteractivas ?? [], i, -1) }))}><ArrowUp size={14} /></button>
                    <button type="button" className="ico-btn sm" title={t('Bajar')} aria-label={t('Bajar')} disabled={i === (content.tarjetasInteractivas?.length ?? 0) - 1}
                      onClick={() => edit(c => ({ ...c, tarjetasInteractivas: move(c.tarjetasInteractivas ?? [], i, 1) }))}><ArrowDown size={14} /></button>
                    <button type="button" className="ico-btn sm" title={t('Eliminar')} aria-label={t('Eliminar')}
                      onClick={() => edit(c => ({ ...c, tarjetasInteractivas: (c.tarjetasInteractivas ?? []).filter((_, xi) => xi !== i) }))}><Trash2 size={14} color="var(--danger)" /></button>
                  </div>
                ))}
                <div className="fe-add-row">
                  <button type="button" className="btn-ghost sm" onClick={() => edit(c => ({ ...c, tarjetasInteractivas: [...(c.tarjetasInteractivas ?? []), { texto: '', imagen: '', imagenTipo: 'ilustracion', imagenDelante: true }] }))}>
                    <Plus size={14} />{t('Añadir tarjeta')}
                  </button>
                  <button type="button" className="fe-redo-btn" disabled={sinClave || adding !== null} onClick={handleMoreCardsInt}>
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
                    <select
                      className="fe-act-niv" value={act.dificultad ?? ''} aria-label={t('Nivel del bloque')} title={t('Las fichas van de menos a más')}
                      onClick={e => e.stopPropagation()}
                      onChange={e => patchAct(a, { dificultad: esDificultad(Number(e.target.value)) ? Number(e.target.value) as Dificultad : undefined })}
                    >
                      <option value="">{t('Sin nivel')}</option>
                      {DIFICULTADES.map(d => <option key={d} value={d}>{estrellas(d)} {t(NOMBRE_DIFICULTAD[d])}</option>)}
                    </select>
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
                  {content.visual && <ActividadVisualEditor act={act} onChange={p => patchAct(a, p)} t={t} />}
                  <div className="fe-act-body">
                    {act.ejercicios.map((ex, i) => (
                      <ExerciseEditor
                        key={i} ex={ex} n={i + 1} id={`${a}-${i}`} t={t} visual={!!content.visual} hilo={content.hilo} lectura={!!content.lectura} fracciones={content.estilo === 'cuaderno' && !content.visual && !content.lectura}
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
                        {tiposDisponibles({ dibujos: !!content.hilo && !content.visual && !content.lectura, fracciones: content.estilo === 'cuaderno' && !content.visual && !content.lectura, lectura: !!content.lectura }).map(x => <option key={x} value={x}>{TIPO_EMOJI[x]} {t(TIPO_LABEL[x])}</option>)}
                      </select>
                      <button type="button" className="fe-redo-btn" disabled={sinClave || adding !== null} onClick={() => handleAddExercise(a)}>
                        {adding === a ? <span className="spin" /> : <Plus size={13} />}{t('Añadir ejercicio con IA')}
                      </button>
                    </div>
                  </div>
                  <RecuadroEditor recuadro={act.recuadro} onChange={recuadro => patchAct(a, { recuadro })} t={t} />
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
              <FichaPreview ficha={ficha} lang={lang} selected={selected} onSelect={selectFromPreview} onDensidad={d => edit(c => ({ ...c, densidad: d }))} />
            </div>
          </aside>
        </div>

        <TarjetaImagenPicker
          open={pickingImagen !== null}
          onClose={() => setPickingImagen(null)}
          onPick={(tipo, id) => { if (pickingImagen !== null) patchCardInt(pickingImagen, { imagen: id, imagenTipo: tipo }); setPickingImagen(null); }}
        />
        {playing && (
          <TarjetasInteractivasPlay
            onClose={() => setPlaying(false)}
            titulo={content.titulo}
            cards={content.tarjetasInteractivas ?? []}
          />
        )}
      </section>
    );
  }

  /* ══ Crear + biblioteca ══ */
  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Recursos')}</h1>
          <p className="pg-sub">{t('Fichas, lecturas y juegos listos para imprimir: la IA los crea y tú los retocas.')}</p>
        </div>
      </div>

      {sinClave && (
        <AiKeyNotice message={t('Para generar recursos hace falta la clave gratuita de Google que se configura en Configuración.')} action={t('Configurar la IA')} onAction={() => { requestSettingsPanel('ia'); onNav('profile'); }} />
      )}

      {borrador.encontrado && (
        <AvisoBorrador borrador={borrador.encontrado} queEra={t('una ficha')} onContinuar={continuarBorrador} onDescartar={borrador.descartar} />
      )}

      <div className="card fe-create" style={{ marginBottom: 16 }}>
        <div className="fe-paso"><span className="fe-paso-n">1</span>{t('¿Qué quieres crear?')}</div>
        <div className="ev-cards cuatro fe-tipos" role="radiogroup" aria-label={t('Qué quieres crear')}>
          {TIPOS_CREACION.map(x => (
            <button
              key={x.id} type="button" role="radio" aria-checked={tipo === x.id}
              className={`ev-card fe-tipo${tipo === x.id ? ' sel' : ''}`} style={{ '--ev-c': x.color } as React.CSSProperties}
              onClick={() => pickTipo(x.id)}
            >
              <span className="ev-card-ico" aria-hidden="true">{x.icono}</span>
              <span className="ev-card-ttl">{t(x.label)}</span>
              <span className="ev-card-txt">{t(x.desc)}</span>
              <span className="ev-card-ft">
                <span className="ev-card-dato">{t(x.dato)}</span>
                {tipo === x.id && <span className="ev-card-go"><Check size={15} />{t('Elegida')}</span>}
              </span>
            </button>
          ))}
        </div>

        {tipo === 'tarjetas' && (
          <div style={{ marginTop: 4 }}>
            <div className="fe-paso"><span className="fe-paso-n">1b</span>{t('¿Recortables o interactivas?')}</div>
            <div className="ev-cards fe-tipos" role="radiogroup" aria-label={t('Recortables o interactivas')}>
              {([
                { id: 'recortables' as const, icono: <Scissors size={20} />, label: 'Recortables', desc: 'Pregunta delante y respuesta detrás, para imprimir y doblar.' },
                { id: 'interactivas' as const, icono: <FlipHorizontal2 size={20} />, label: 'Interactivas', desc: 'Imagen en una cara y texto en la otra; se giran al tocarlas.' },
              ]).map(x => (
                <button
                  key={x.id} type="button" role="radio" aria-checked={modoTarjeta === x.id}
                  className={`ev-card fe-tipo${modoTarjeta === x.id ? ' sel' : ''}`} style={{ '--ev-c': '#8b5cf6' } as React.CSSProperties}
                  onClick={() => setModoTarjeta(x.id)}
                >
                  <span className="ev-card-ico" aria-hidden="true">{x.icono}</span>
                  <span className="ev-card-ttl">{t(x.label)}</span>
                  <span className="ev-card-txt">{t(x.desc)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="fe-paso"><span className="fe-paso-n">2</span>{t('¿De qué trata?')}</div>
        <div className="fgroup">
          <input
            id="resources-f1" aria-label={t('¿De qué va la ficha?')}
            className="finput fe-big" value={tema} onChange={e => setTema(e.target.value)}
            placeholder={t(lectura ? 'Ej: un dragón que perdió su fuego' : 'Ej: las fracciones equivalentes')}
            onKeyDown={e => { if (e.key === 'Enter' && !generating && !sinClave) handleGenerate(); }}
          />
        </div>

        <div className="frow fe-quien">
          {apoyo?.alumnos.length ? (
            <div className="fgroup">
              <label className="flabel" htmlFor="resources-f2">{t('Adaptada a')}</label>
              <select id="resources-f2" className="finput" value={alumnoApoyo} onChange={e => {
                setAlumnoApoyo(e.target.value);
                const x = paraAlumno(e.target.value);
                setNivel(x?.nivel ?? '');
                setContextoClase(x?.contexto ?? '');
                if (x) setVisual(true);
              }}>
                <option value="">{t('Sin alumno concreto')}</option>
                {[...apoyo.alumnos].sort((a, b) => compararNombres(a.nombre, b.nombre)).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
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
        </div>

        {alumnoApoyo && (
          <p className="fe-hint" style={{ margin: '-4px 0 12px' }}>
            {t('Se adapta a su nivel, a sus necesidades y a sus objetivos de este trimestre; la IA no recibe su nombre ni su diagnóstico. Lo que se le cuenta está en «Más opciones», y lo puedes cambiar.')}
          </p>
        )}

        {lectura && (
          <div className="fgroup">
            <span className="flabel">{t('Tipo de texto')}</span>
            <div className="fe-generos" role="radiogroup" aria-label={t('Tipo de texto')}>
              {(['auto', ...GENEROS_LECTURA] as const).map(g => (
                <button
                  key={g} type="button" role="radio" aria-checked={generoLectura === g}
                  className={`fe-genero${generoLectura === g ? ' on' : ''}`} onClick={() => setGeneroLectura(g)}
                >
                  {g === 'auto' ? t('Que elija la IA') : t(NOMBRE_GENERO[g])}
                </button>
              ))}
            </div>
          </div>
        )}

        {tipo !== 'tarjetas' && (
          <div className="fe-bolas">
            <label className={`fe-bola${facil ? ' on' : ''}`} style={{ '--ev-c': '#0ea5e9' } as React.CSSProperties} title={t('Para dislexia: frases cortas, palabras clave en negrita y letra más grande.')}>
              <input type="checkbox" className="sr-only" checked={facil} onChange={e => setFacil(e.target.checked)} />
              <span className="fe-bola-circ" aria-hidden="true">
                <img src={urlIlustracion('esc-libro')} alt="" width={64} height={64} draggable={false} />
                <span className="fe-bola-aa">Aa</span>
                <Check size={13} className="fe-bola-ok" />
              </span>
              <span className="fe-bola-txt">{t('Lectura fácil')}</span>
              <span className="fe-bola-sub">{t('Para dislexia')}</span>
            </label>
            {!lectura && (
              <label className={`fe-bola${visual ? ' on' : ''}`} style={{ '--ev-c': '#8b5cf6' } as React.CSSProperties} title={t('Pasos numerados con dibujos, para el alumnado que lo necesita (TEA…).')}>
                <input type="checkbox" className="sr-only" checked={visual} onChange={e => setVisual(e.target.checked)} />
                <span className="fe-bola-circ" aria-hidden="true">
                  <img src={urlPicto('ia-inicio-actividad')} alt="" width={64} height={64} draggable={false} />
                  <Check size={13} className="fe-bola-ok" />
                </span>
                <span className="fe-bola-txt">{t('Con pictogramas')}</span>
                <span className="fe-bola-sub">{t('Pasos con dibujos')}</span>
              </label>
            )}
          </div>
        )}

        <details className="fe-more">
          <summary>
            {t('Personalizar')}
            <span className="fe-resumen">{t(tipo === 'tarjetas' ? '{n} tarjetas' : '{n} ejercicios', { n: numEjercicios })}{!lectura && tipo !== 'tarjetas' ? ` · ${estilo === 'auto' ? t('Que elija la IA') : t(fichaTheme(estilo).nombre)}` : ''}</span>
          </summary>
          <div className="fe-more-body">
            <div className="fgroup" style={{ maxWidth: 160 }}>
              <label className="flabel" htmlFor="resources-f5">{t(tipo === 'tarjetas' ? 'Nº de tarjetas' : 'Nº de ejercicios')}</label>
              <input
                id="resources-f5"
                className="finput" type="number" min={1} max={20} value={numEjercicios}
                onChange={e => setNumEjercicios(Math.max(1, Math.min(tipo === 'tarjetas' ? 32 : 20, Number(e.target.value) || 1)))}
              />
            </div>
            {tipo !== 'tarjetas' && (
              <p className="fe-hint" style={{ margin: 0 }}>
                {t('Las fichas van de menos a más: bloques de nivel 1, 2 y 3, con estrellas en cada uno. En 5.º y 6.º de Primaria suben un punto.')}
              </p>
            )}

            {!lectura && (
              <div className="fgroup">
                <span className="flabel">{t(tipo === 'tarjetas' ? 'Aspecto de las tarjetas' : 'Aspecto de la ficha')}</span>
                <ThemeGrid value={estilo} onChange={setEstilo} withAuto t={t} />
                <p className="fe-hint" style={{ marginTop: 6 }}>
                  {tipo === 'tarjetas'
                    ? t('Solo cambia los colores y los dibujos de las tarjetas.')
                    : tipo === 'escape' && !conHistoria(estilo)
                      ? t('Un escape room necesita historia: la IA elegirá el mundo que mejor encaje.')
                      : estilo === 'cuaderno'
                        ? t('Una hoja de cuaderno de colegio: bloques numerados, recuadros de ayuda y un dibujo en la cabecera.')
                        : estilo === 'clasico'
                          ? t('Sin historia: una ficha sobria de las de siempre.')
                          : t('La ficha se convierte en una misión: un personaje la presenta, cada bloque es un paso de la aventura y al final se gana una insignia.')}
                </p>
              </div>
            )}

            {estilo === 'cuaderno' && tipo === 'ficha' && !visual && (
              <div className="fgroup">
                <span className="flabel">{t('Dibujos de la ficha')}</span>
                <HiloSelector auto value={hilo} onChange={setHilo} detectado={hiloDetectado} t={t} />
                <p className="fe-hint" style={{ marginTop: 6 }}>{t('Los dibujos y el ambiente de los enunciados salen de este tema. Puedes cambiarlo o quitarlo.')}</p>
              </div>
            )}

            <div className="fgroup">
              <label className="flabel" htmlFor="resources-f6">{t('Cómo es el grupo (opcional)')}</label>
              <textarea id="resources-f6" className="finput" rows={2} value={contextoClase} onChange={e => setContextoClase(e.target.value)} style={{ resize: 'vertical' }} />
            </div>
            {!lectura && tipo !== 'tarjetas' && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={niveles} onChange={e => setNiveles(e.target.checked)} />
                  {t('Incluir variantes de apoyo y ampliación por ejercicio')}
                </label>
                <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: 0 }}>
                  {t('Útil como referencia para atender distintos ritmos; no se exportan en la ficha impresa, solo se ven aquí.')}
                </p>
              </>
            )}
          </div>
        </details>

        <div className="fe-crear">
          <button className="btn-accent fe-crear-btn" disabled={generating || sinClave} onClick={handleGenerate}>
            {generating
              ? <><span className="spin" />{t('Creando…')}</>
              : <><Sparkles size={15} />{t(tipo === 'escape' ? 'Crear escape room' : tipo === 'tarjetas' ? 'Crear tarjetas' : tipo === 'lectura' ? 'Crear comprensión lectora' : 'Crear ficha')}</>}
          </button>
          {generating && <span className="fe-hint">{t(lectura ? 'La IA está escribiendo el texto y las actividades. Tarda unos segundos.' : 'La IA está escribiendo la historia y los ejercicios. Tarda unos segundos.')}</span>}
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
                        {f.content.lectura && <span className="fe-mini-badge">{t('Comprensión lectora')}</span>}
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
