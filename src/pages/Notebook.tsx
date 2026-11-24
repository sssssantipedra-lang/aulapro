import { esDeAsignatura, modeloAcs } from '../lib/acsModelos';
import { AyudaVideo } from '../components/AyudaVideo';
import type { AcsApoyo } from '../types/apoyo';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, X, BookOpen, FileText, Brain, Plus, Download, Pencil, Settings2, Users, ArrowRight, Sparkles, Send, Trash2, Database, Flag, Check, Hand, ChevronDown, ChevronUp } from 'lucide-react';
import { callGemini, hasApiKey, type InlineFile, type ChatTurn } from '../services/gemini';
import { ACEPTA_ADJUNTO, useAdjuntoParaIA } from '../hooks/useAdjuntoParaIA';
import { preguntaParaIA } from '../lib/preguntaParaIA';
import { buildTeacherContext, chatSystemPrompt, type TeacherData, type ChatMessage } from '../services/aiContext';
import { fileToBase64, fromIsoDate, isoDate, nombreDePila, PERIODS } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { RichText } from '../components/ui/RichText';
import { columnasACompletar } from '../lib/sugerencias';
import { Sugerencia } from '../components/ui/Sugerencia';
import { useSugerencias } from '../hooks/useSugerencias';
import { useI18n } from '../i18n';
import { ClassChips } from '../components/ui/ClassChips';
import type { Class, Student, GradeCategory, GradeItem, GradeMap, ClassMark, MarksBlockConfig, Evaluation } from '../types';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import {
  isMarksCategory, blockConfig, blockKey, sumaDePesos, blockActive, marksFor, studentBlock, BLOCK_ITEM_PREFIX,
  TARGETS, targetLabel, esAsignaturaEF, nombreDelBloque, BLOCK_NAME, MAX_BLOCK_POINTS, type MarkTarget,
} from '../services/classMarks';
import { abrirClaveIA } from '../lib/claveIA';
import { requestActitud } from '../lib/actitudNav';
import { downloadFile } from '../lib/download';
import { compararAlumnos } from '../lib/alumnado';
import { CARPETAS } from '../lib/carpetas';
import { mediaPonderada, pesoEnLaNotaFinal, porcentajesEnCategoria, hayPesosElegidos } from '../lib/ponderacion';
import { PesosDeNotas } from '../components/PesosDeNotas';
import { useClaseActiva } from '../hooks/useClaseActiva';
import { CURSO_ENTERO, diaParaNueva, EN_FRASE, periodoDeFecha } from '../lib/periodos';
import { categoriasDe, cuadernoDe, notasDeCurso, reglaFinal, type ReglaFinal } from '../lib/cuadernoEvaluacion';
import { useEvaluacionElegida, type EvaluacionElegida } from '../hooks/useEvaluacionElegida';
import { SelectorEvaluacion } from '../components/SelectorEvaluacion';
import { NotasDeCurso } from '../components/cuaderno/NotasDeCurso';
import { explicacionDePropuestas, propuestasDeCategorias, tiposDeAsignatura } from '../lib/categoriasCuaderno';
import { cambiosDeRelleno, esBloque, leerNota, leerPegado, pantallaTactil, type CambioDeNota } from '../lib/pegarNotas';
import { VistaPreviaPegado } from '../components/cuaderno/VistaPreviaPegado';
import { MenuDeColumna } from '../components/cuaderno/MenuDeColumna';
import { CalificarActividad } from '../components/cuaderno/CalificarActividad';

// El currículo (unos 650 KB) se abre con la pestaña «Por competencias», no con el cuaderno
const CompetenciasDeLaClase = lazy(() => import('../components/curriculum/CompetenciasDeLaClase')
  .then(m => ({ default: m.CompetenciasDeLaClase })));

interface Props {
  classes: Class[];
  students: Student[];
  /** Las adaptaciones curriculares significativas del alumnado (`ApoyoData.acsAula`): marca en el nombre. */
  acsAula?: AcsApoyo[];
  /**
   * Incluyen el bloque «Trabajo diario y actitud» de las anotaciones del aula
   * (categoría y columna virtuales, de solo lectura; ver services/classMarks.ts).
   */
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  /** Anotaciones del aula, para el desglose del bloque por alumno. */
  classMarks: ClassMark[];
  marksConfigs: Record<string, MarksBlockConfig>;
  /** `motivo` «regla»: lo que cambia es la regla de la nota final de curso, no el bloque (para el registro de cambios). */
  onSaveMarksConfig: (classId: string, subject: string, cfg: MarksBlockConfig, motivo?: 'regla') => void;
  onAddCategory: (c: GradeCategory) => void;
  onUpdateCategory: (c: GradeCategory) => void;
  onDeleteCategory: (id: string) => void;
  onAddItem: (i: GradeItem) => void;
  onUpdateItem: (i: GradeItem) => void;
  onDeleteItem: (id: string) => void;
  onSetGrade: (itemId: string, studentId: string, value: number | null) => void;
  /**
   * Varias notas de una vez (pegar un bloque, rellenar los vacíos): un solo cambio, con «Deshacer»
   * (`setManyGrades` de `useAppState`). Sin él se ponen una a una.
   */
  onSetGrades?: (cambios: CambioDeNota[], como: 'pegar' | 'rellenar') => void;
  lawDocument: InlineFile | null;
  onLawDocumentChange: (doc: InlineFile | null) => void;
  onNav: (s: string) => void;
  /** Para la pestaña «Por competencias»: las evaluaciones con criterios oficiales y la comunidad del perfil. */
  evaluations: Evaluation[];
  comunidad?: ComunidadId;
  /** Todo el cuaderno, para que el asistente responda con datos reales. */
  aiData: TeacherData;
  chat: ChatMessage[];
  onChatChange: (next: ChatMessage[]) => void;
}

/* ══════════════════ Utilidades de cálculo ══════════════════ */

function fmtNota(n: number | null, locale = 'es-ES'): string {
  if (n === null) return '—';
  return n.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function notaColor(n: number | null): string {
  if (n === null) return 'var(--text-3)';
  if (n < 5) return 'var(--grade-bad)';
  if (n < 7) return 'var(--grade-mid)';
  return 'var(--grade-good)';
}

/** Dónde se recuerda, en el dispositivo, si en «Curso» se ve la tabla de todas las actividades. */
const CLAVE_VER_TODAS = 'aulapro_cuaderno_curso_actividades';

/* ══════════════════ Celda de nota editable ══════════════════ */

/** La celda de nota del alumno de abajo (o de arriba) en la misma columna. */
function celdaVecina(desde: HTMLInputElement, paso: 1 | -1): HTMLInputElement | null {
  const td = desde.closest('td');
  const tr = td?.parentElement;
  if (!td || !tr) return null;
  const columna = Array.prototype.indexOf.call(tr.children, td);
  let fila = paso > 0 ? tr.nextElementSibling : tr.previousElementSibling;
  while (fila) {
    const celda = fila.children[columna]?.querySelector<HTMLInputElement>('input.gb-cell');
    if (celda) return celda;
    fila = paso > 0 ? fila.nextElementSibling : fila.previousElementSibling;
  }
  return null;
}

/** La celda de la actividad de al lado en la misma fila (se salta el bloque de anotaciones, que no se escribe). */
function celdaAlLado(desde: HTMLInputElement, paso: 1 | -1): HTMLInputElement | null {
  let td = desde.closest('td');
  while (td) {
    td = (paso > 0 ? td.nextElementSibling : td.previousElementSibling) as HTMLTableCellElement | null;
    const celda = td?.querySelector<HTMLInputElement>('input.gb-cell');
    if (celda) return celda;
  }
  return null;
}

function GradeCell({ value, onCommit, itemId, alumnoId, onPegar }: {
  value: number | null; onCommit: (v: number | null) => void;
  /** La actividad y el alumno de la celda: para llevarle el foco y saber dónde se pega. */
  itemId: string; alumnoId: string;
  /** Un bloque de más de una celda pegado aquí: en vez de escribirse, pasa a la vista previa. */
  onPegar?: (filas: string[][]) => void;
}) {
  const { lang, t } = useI18n();
  const { toast } = useToast();
  const [text, setText] = useState<string | null>(null); // null = sin editar
  // El separador decimal sigue al idioma; escribir admite los dos igualmente.
  const formatted = value !== null ? (lang !== 'en' ? String(value).replace('.', ',') : String(value)) : '';
  const shown = text !== null ? text : formatted;

  function commit() {
    if (text === null) return;
    const leida = leerNota(text);
    if (leida.tipo === 'vacia') onCommit(null);
    // Lo que no es una nota entre 0 y 10 no se guarda, y se dice (19-11-2026; antes un 11 o un 85
    // se guardaban como 10 y las letras se descartaban, las dos cosas sin avisar)
    else if (leida.tipo === 'mal') toast(t('«{texto}» no es una nota entre 0 y 10: no se ha guardado.', { texto: text.trim() }));
    else onCommit(leida.valor);
    setText(null);
  }

  return (
    <input
      className="gb-cell"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={shown}
      placeholder="·"
      data-item={itemId}
      data-alumno={alumnoId}
      // Sin nada a medio escribir, Ctrl+Z es el «Deshacer» común (el de pegar notas), no el del campo
      data-deshacer={text === null ? 'comun' : undefined}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onFocus={e => e.target.select()}
      onPaste={e => {
        if (!onPegar) return;
        // Una sola celda se pega como siempre; un bloque copiado de una hoja de cálculo pasa por la vista previa
        const filas = leerPegado(e.clipboardData.getData('text/plain'));
        if (!esBloque(filas)) return;
        e.preventDefault();
        setText(null);
        onPegar(filas);
      }}
      onKeyDown={e => {
        const celda = e.currentTarget;
        // Intro y la flecha abajo pasan al alumno siguiente y la flecha arriba, al anterior (19-11-2026; antes
        // Intro soltaba el foco y lo que se tecleaba después se perdía). Al salir de la celda se guarda sola.
        if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const vecina = celdaVecina(celda, e.key === 'ArrowUp' ? -1 : 1);
          if (vecina) vecina.focus(); else if (e.key === 'Enter') celda.blur();
        }
        // Las flechas a los lados pasan a la actividad de al lado cuando ya no pueden moverse dentro de la celda:
        // con todo seleccionado (como queda al entrar) o con el cursor en ese borde (22-11-2026)
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
          const ini = celda.selectionStart ?? 0;
          const fin = celda.selectionEnd ?? 0;
          const todo = ini === 0 && fin === celda.value.length;
          const enElBorde = ini === fin && (e.key === 'ArrowLeft' ? fin === 0 : ini === celda.value.length);
          if (todo || enElBorde) {
            const otra = celdaAlLado(celda, e.key === 'ArrowLeft' ? -1 : 1);
            if (otra) { e.preventDefault(); otra.focus(); }
          }
        }
        if (e.key === 'Escape') setText(null);
      }}
      style={{ color: notaColor(value) }}
    />
  );
}

/* ══════════════════ Pestaña de calificaciones ══════════════════ */

function GradesTab({
  classes, students, gradeCategories: todasLasCategorias, gradeItems: todasLasActividades, grades: notasGuardadas,
  classMarks, marksConfigs, onSaveMarksConfig,
  onAddCategory, onUpdateCategory, onDeleteCategory,
  onAddItem, onUpdateItem, onDeleteItem, onSetGrade, onSetGrades, onNav, acsAula = [], comunidad, clase, ev,
}: Omit<Props, 'lawDocument' | 'onLawDocumentChange'> & { clase: ReturnType<typeof useClaseActiva>; ev: EvaluacionElegida }) {
  const { toast } = useToast();
  const { t, locale, lang } = useI18n();
  // La clase la lleva la página: es la misma en «Calificaciones» y en «Por competencias»
  const [classId, setClassId, llevarClase] = clase;
  const [catModal, setCatModal]   = useState<GradeCategory | 'new' | null>(null);
  const [itemModal, setItemModal] = useState<GradeItem | 'new' | null>(null);

  // Formularios de los modales
  const [catName, setCatName]     = useState('');
  const [catWeight, setCatWeight] = useState('');
  const [blockOpen, setBlockOpen] = useState(false);
  /** Formulario del bloque, en texto para que se pueda escribir «33,33». */
  // `pct`: el peso del bloque en la nota final, en %. Se guarda en puntos sobre 10 (`points`).
  const [bf, setBf] = useState<{ name: string; enabled: boolean; pct: string; step: string; weights: Record<MarkTarget, string>; bases: Record<MarkTarget, string> } | null>(null);
  const [itemName, setItemName]   = useState('');
  const [itemCat, setItemCat]     = useState('');
  const [itemDate, setItemDate]   = useState(isoDate());
  /** Lo que cuenta la nota en su categoría, en % y en texto; vacío = como las demás. */
  const [itemWeight, setItemWeight] = useState('');
  /** Lo mismo para todas las notas de la categoría que se está editando. */
  const [catItemWeights, setCatItemWeights] = useState<Record<string, string>>({});
  const [confirmDel, setConfirmDel] = useState(false);
  /** La actividad cuyo menú está abierto y la que se está calificando en lista (por su id: si deja de verse, se cierran). */
  const [menuDe, setMenuDe] = useState<string | null>(null);
  const [calificando, setCalificando] = useState<string | null>(null);
  /** Un bloque pegado sobre una celda, a la espera de la vista previa. */
  const [pegado, setPegado] = useState<{ filas: string[][]; alumnoId: string; actividadId: string } | null>(null);
  /** La actividad recién creada: en cuanto sale en la tabla, el foco va a su primera celda. */
  const focoPendiente = useRef<string | null>(null);

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
    () => students.filter(s => s.class_id === clsId).sort(compararAlumnos),
    [students, clsId],
  );
  /**
   * El cuaderno de la evaluación que se está viendo (20-11-2026, `lib/cuadernoEvaluacion.ts`): solo las
   * actividades de sus fechas y el bloque de anotaciones calculado con las de esas fechas, la misma cuenta
   * que el acta. En «Curso», todas, con la nota de cada evaluación y la final al lado.
   */
  const esCurso = ev.periodo === CURSO_ENTERO;
  const entrada = useMemo(() => ({
    classes: cls ? [cls] : [], students: myStudents,
    gradeCategories: todasLasCategorias.filter(c => c.class_id === clsId),
    gradeItems: todasLasActividades.filter(i => i.class_id === clsId),
    grades: notasGuardadas, classMarks: classMarks.filter(m => m.class_id === clsId), marksConfigs,
  }), [cls, clsId, myStudents, todasLasCategorias, todasLasActividades, notasGuardadas, classMarks, marksConfigs]);
  /** Cómo sale la nota final de curso de esta clase y asignatura: evaluación continua si no se ha elegido otra cosa. */
  const regla = useMemo(() => reglaFinal(marksConfigs[blockKey(clsId, activeSubject)]), [marksConfigs, clsId, activeSubject]);
  const deCurso = useMemo(
    () => (esCurso && cls ? notasDeCurso(entrada, cls, activeSubject, regla, ev.hoy, ev.rangos) : null),
    [esCurso, entrada, cls, activeSubject, regla, ev.hoy, ev.rangos],
  );
  const vista = useMemo(
    () => deCurso?.curso ?? cuadernoDe(entrada, ev.periodo, ev.hoy, ev.rangos),
    [deCurso, entrada, ev.periodo, ev.hoy, ev.rangos],
  );
  const { gradeItems, grades } = vista;
  const myCategories = useMemo(() => (cls ? categoriasDe(vista, cls, activeSubject) : []), [vista, cls, activeSubject]);
  const myItems = useMemo(() => {
    const mine = new Set(myCategories.map(c => c.id));
    return gradeItems.filter(i => i.class_id === clsId && mine.has(i.category_id));
  }, [gradeItems, clsId, myCategories]);
  /** Todas las actividades de la asignatura, de cualquier evaluación (sin la columna del bloque de anotaciones). */
  const deTodoElCurso = useMemo(() => {
    const principal = subjects[0] ?? '';
    const suyas = new Set(todasLasCategorias.filter(c => c.class_id === clsId && !isMarksCategory(c.id) && (c.subject ?? principal) === activeSubject).map(c => c.id));
    return todasLasActividades.filter(i => i.class_id === clsId && suyas.has(i.category_id) && !i.id.startsWith(BLOCK_ITEM_PREFIX));
  }, [todasLasCategorias, todasLasActividades, clsId, activeSubject, subjects]);
  /** La nota de un alumno en lo que se está viendo: la de la evaluación o, en «Curso», la final con la regla elegida. */
  const notaDe = (studentId: string): number | null =>
    (deCurso ? deCurso.notas.get(studentId)?.final ?? null : mediaPonderada(myCategories, myItems, grades, studentId));
  /** En «Curso» la tabla de todas las actividades va plegada: lo primero son las notas de cada evaluación y la final. */
  const [verTodas, setVerTodas] = useState(() => { try { return localStorage.getItem(CLAVE_VER_TODAS) === '1'; } catch { return false; } });
  const cambiarVerTodas = (v: boolean) => { setVerTodas(v); try { localStorage.setItem(CLAVE_VER_TODAS, v ? '1' : '0'); } catch { /* sin almacenamiento */ } };
  const nombreCorto = (p: string) => t(EN_FRASE[p] ?? p);
  const diaCorto = (f: string) => fromIsoDate(f).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  /** Las actividades que cuentan juntas con una de esa fecha: las de su evaluación o, con evaluación continua y viendo el curso, todas. */
  const cuentanCon = (fecha: string) => {
    if (esCurso && regla.modo === 'continua') return () => true;
    const suya = periodoDeFecha(fecha, ev.hoy, ev.rangos);
    return (i: GradeItem) => !i.date || periodoDeFecha(i.date, ev.hoy, ev.rangos) === suya;
  };

  /**
   * Las categorías del docente, sin el bloque de anotaciones: ese no se edita
   * como las demás. Su peso interno se calcula para que valga su % de la nota
   * final (ver `blockCategoryWeight`).
   */
  const ownCategories = useMemo(() => myCategories.filter(c => !isMarksCategory(c.id)), [myCategories]);

  /**
   * Sugerencia en el momento (18-11-2026): la actividad más reciente que casi toda la clase tiene calificada y a la
   * que le falta la nota de alguien. Solo informa; al cerrarla no vuelve a salir para esa actividad.
   */
  const sugerencias = useSugerencias();
  const aCompletar = useMemo(() => {
    const propias = new Set(ownCategories.map(c => c.id));
    return columnasACompletar(myItems.filter(i => propias.has(i.category_id)), grades, myStudents.map(s => s.id))
      .find(c => !sugerencias.vista(c.clave)) ?? null;
  }, [ownCategories, myItems, grades, myStudents, sugerencias]);
  const nombresDe = (ids: string[]) => {
    const nombres = ids.map(id => myStudents.find(s => s.id === id)?.name ?? '').filter(Boolean);
    return nombres.length > 4 ? `${nombres.slice(0, 4).join(', ')} ${t('y {n} más', { n: nombres.length - 4 })}` : nombres.join(', ');
  };
  // El peso suma 100% por asignatura, no por clase
  const weightSum = ownCategories.reduce((a, c) => a + c.weight, 0);

  /** Bloque de anotaciones de esta clase y asignatura: configuración y desglose por alumno. */
  const block = useMemo(() => {
    if (!cls) return null;
    const cfg = blockConfig(marksConfigs, cls.id, activeSubject);
    // Las anotaciones de las fechas de la evaluación que se está viendo
    const marks = marksFor(classMarks, cls, activeSubject).filter(m => ev.cuenta(m.date));
    const perStudent = new Map(myStudents.map(s => [s.id, studentBlock(marks.filter(m => m.student_id === s.id), cfg)]));
    return { cfg, active: blockActive(cfg, marks.length), count: marks.length, perStudent };
  }, [cls, activeSubject, marksConfigs, classMarks, myStudents, ev]);
  /** Lo que pesa el bloque en la nota final, en % (0 si no cuenta). */
  const blockPct = block?.active ? Math.round(block.cfg.points * 100) / 10 : 0;
  const pesos = sumaDePesos(weightSum, blockPct);

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

  /** Las actividades donde se escribe, en el orden en que se ven (sin el bloque de anotaciones, que sale solo). */
  const editables = useMemo(() => grouped.filter(g => !isMarksCategory(g.cat.id)), [grouped]);
  const columnasEditables = useMemo(() => editables.flatMap(g => g.items), [editables]);
  const actividadDelMenu = menuDe ? columnasEditables.find(i => i.id === menuDe) ?? null : null;
  const actividadEnLista = calificando ? columnasEditables.find(i => i.id === calificando) ?? null : null;
  const detalleDe = (item: GradeItem) => [myCategories.find(c => c.id === item.category_id)?.name, item.date ? diaCorto(item.date) : '']
    .filter(Boolean).join(' · ');

  /** Varias notas de una vez: un solo cambio con «Deshacer» si la app lo ofrece; si no, una a una. */
  function ponerNotas(cambios: CambioDeNota[], como: 'pegar' | 'rellenar') {
    if (onSetGrades) onSetGrades(cambios, como);
    else cambios.forEach(c => onSetGrade(c.itemId, c.studentId, c.value));
  }
  /** Devuelve el foco a la celda (o a la casilla de la lista) de un alumno en una actividad. */
  function focoEn(itemId: string, alumnoId: string) {
    const sel = `[data-item="${CSS.escape(itemId)}"][data-alumno="${CSS.escape(alumnoId)}"]`;
    (document.querySelector<HTMLInputElement>(`input.pn-cal-nota${sel}`) ?? document.querySelector<HTMLInputElement>(`input.gb-cell${sel}`))?.focus();
  }

  // Al crear una actividad, el foco va a su primera celda en cuanto sale en la tabla (22-11-2026)
  useEffect(() => {
    const id = focoPendiente.current;
    if (!id || !columnasEditables.some(i => i.id === id)) return;
    focoPendiente.current = null;
    const celda = document.querySelector<HTMLInputElement>(`input.gb-cell[data-item="${CSS.escape(id)}"]`);
    if (!celda) return;
    celda.focus();
    celda.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [columnasEditables]);

  const dec = (n: number) => (lang !== 'en' ? String(n).replace('.', ',') : String(n));
  const parseDec = (v: string) => Number(v.trim().replace(',', '.'));

  function openBlock() {
    if (!block) return;
    const { cfg } = block;
    setBf({
      name: cfg.name ?? '',
      enabled: block.active,
      pct: dec(Math.round(cfg.points * 100) / 10),
      step: dec(cfg.step),
      weights: Object.fromEntries(TARGETS.map(tg => [tg, dec(cfg.weights[tg])])) as Record<MarkTarget, string>,
      bases: Object.fromEntries(TARGETS.map(tg => [tg, dec(cfg.bases[tg])])) as Record<MarkTarget, string>,
    });
    setBlockOpen(true);
  }

  function saveBlock() {
    if (!bf || !cls) return;
    const pct = parseDec(bf.pct);
    const points = Math.round(pct * 10) / 100;
    const step = parseDec(bf.step);
    const weights = Object.fromEntries(TARGETS.map(tg => [tg, parseDec(bf.weights[tg])])) as Record<MarkTarget, number>;
    const bases = Object.fromEntries(TARGETS.map(tg => [tg, parseDec(bf.bases[tg])])) as Record<MarkTarget, number>;
    if (!(pct >= 1 && pct <= MAX_BLOCK_POINTS * 10)) { toast(t('El bloque debe pesar entre 1% y {max}%', { max: MAX_BLOCK_POINTS * 10 })); return; }
    if (!(step > 0 && step <= 10)) { toast(t('Lo que vale cada anotación debe estar entre 0 y 10')); return; }
    if (TARGETS.some(tg => !(weights[tg] >= 0 && weights[tg] <= 100))) { toast(t('Cada peso debe estar entre 0 y 100')); return; }
    if (TARGETS.some(tg => !(bases[tg] >= 0 && bases[tg] <= 10))) { toast(t('La nota de partida debe estar entre 0 y 10')); return; }
    const wSum = TARGETS.reduce((a, tg) => a + weights[tg], 0);
    if (Math.abs(wSum - 100) > 0.05) { toast(t('Los pesos del bloque deben sumar 100% (ahora suman {n}%)', { n: dec(Math.round(wSum * 100) / 100) })); return; }
    // La regla de la nota final de curso va guardada con el bloque: se conserva
    const final = block?.cfg.final;
    onSaveMarksConfig(cls.id, activeSubject, { ...(bf.name.trim() ? { name: bf.name.trim() } : {}), enabled: bf.enabled, points, step, weights, bases, ...(final ? { final } : {}) });
    setBlockOpen(false);
    toast(t('✅ Bloque actualizado'));
  }

  /** Guarda la regla de la nota final en una clase y asignatura (con el resto de su configuración como estaba). */
  function guardarRegla(nueva: ReglaFinal, classId: string, subject: string) {
    const { final: _f, ...cfg } = blockConfig(marksConfigs, classId, subject); void _f;
    onSaveMarksConfig(classId, subject, nueva.modo === 'media' ? { ...cfg, final: { modo: 'media', pesos: [...nueva.pesos] } } : cfg, 'regla');
  }
  const otrasAsignaturas = classes.flatMap(c => (c.subjects?.length ? c.subjects : [c.subject]).map(s2 => ({ c, s: s2 })))
    .filter(x => !(x.c.id === clsId && x.s === activeSubject));
  function reglaParaTodas() {
    // Solo donde cambia: la que ya la tiene no se vuelve a guardar ni se anota en el registro
    const igual = (r: ReglaFinal) => r.modo === regla.modo && (r.modo === 'continua' || r.pesos.every((p, k) => p === regla.pesos[k]));
    otrasAsignaturas.filter(x => !igual(reglaFinal(marksConfigs[blockKey(x.c.id, x.s)]))).forEach(x => guardarRegla(regla, x.c.id, x.s));
    toast(t(regla.modo === 'media' ? '✅ Todas tus clases calculan la nota final con la media de las evaluaciones' : '✅ Todas tus clases calculan la nota final con evaluación continua'));
  }

  /* ── Modales: abrir ── */
  function openCatModal(cat: GradeCategory | 'new') {
    setCatName(cat === 'new' ? '' : cat.name);
    setCatWeight(cat === 'new' ? '' : String(cat.weight));
    setCatItemWeights(cat === 'new' ? {} : Object.fromEntries(
      myItems.filter(i => i.category_id === cat.id && typeof i.weight === 'number').map(i => [i.id, dec(i.weight!)])));
    setConfirmDel(false);
    setCatModal(cat);
  }

  function openItemModal(item: GradeItem | 'new') {
    setItemName(item === 'new' ? '' : item.name);
    setItemCat(item === 'new' ? (ownCategories[0]?.id ?? '') : item.category_id);
    // Una actividad nueva cae en la evaluación que se está viendo (la fecha se puede cambiar)
    setItemDate(item === 'new' ? diaParaNueva(ev.periodo, ev.hoy, ev.rangos) : item.date);
    setItemWeight(item !== 'new' && typeof item.weight === 'number' ? dec(item.weight) : '');
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
      const nuevos: GradeItem[] = [];
      // Solo las que se ven y se han podido editar: las de otras evaluaciones conservan su peso
      for (const i of (pesosEditables ? myItems.filter(x => x.category_id === catModal.id) : [])) {
        const txt = (catItemWeights[i.id] ?? '').trim();
        const w = txt === '' ? undefined : parseDec(txt);
        if (w !== undefined && !(w >= 0 && w <= 100)) { toast(t('Lo que cuenta cada nota debe estar entre 0 y 100')); return; }
        if (w !== i.weight) { const { weight: _w, ...resto } = i; void _w; nuevos.push(w === undefined ? resto : { ...resto, weight: w }); }
      }
      onUpdateCategory({ ...catModal, name, weight });
      nuevos.forEach(onUpdateItem);
      toast(t('✅ Categoría actualizada'));
    }
    setCatModal(null);
  }

  function saveItem() {
    const name = itemName.trim();
    if (!name) { toast(t('Escribe un nombre (ej: Examen Tema 3)')); return; }
    if (!itemCat) { toast(t('Elige una categoría')); return; }
    const w = itemWeight.trim() === '' ? undefined : parseDec(itemWeight);
    if (w !== undefined && !(w >= 0 && w <= 100)) { toast(t('Lo que cuenta cada nota debe estar entre 0 y 100')); return; }
    if (itemModal === 'new') {
      const id = 'gi' + Date.now();
      onAddItem({ id, class_id: clsId, category_id: itemCat, name, date: itemDate, ...(w !== undefined ? { weight: w } : {}) });
      // Lista para poner las notas, si se ve en la evaluación que se está mirando: con el dedo, en la lista de
      // casillas grandes; con teclado, el foco en la primera celda de su columna
      if (myStudents.length > 0 && ev.cuenta(itemDate) && !(esCurso && !verTodas)) {
        if (pantallaTactil()) setCalificando(id); else focoPendiente.current = id;
      }
      // Si por su fecha no cae en la evaluación que se está viendo, se dice dónde ha ido: si no, parecería que no se ha guardado
      const suya = periodoDeFecha(itemDate, ev.hoy, ev.rangos);
      toast(ev.cuenta(itemDate) ? t('✅ Columna de nota añadida')
        : suya ? t('✅ Añadida. Por su fecha cuenta en {evaluacion}: cambia de evaluación para verla.', { evaluacion: nombreCorto(suya) })
        : t('✅ Añadida. Su fecha es de otro curso: solo sale en «Curso».'));
    } else if (itemModal) {
      const { weight: _w, ...resto } = itemModal; void _w;
      onUpdateItem({ ...resto, name, category_id: itemCat, date: itemDate, ...(w !== undefined ? { weight: w } : {}) });
      const suya = periodoDeFecha(itemDate, ev.hoy, ev.rangos);
      toast(ev.cuenta(itemDate) || !suya ? t('✅ Actualizada')
        : t('✅ Actualizada. Por su fecha ahora cuenta en {evaluacion}.', { evaluacion: nombreCorto(suya) }));
    }
    setItemModal(null);
  }

  /* ── Exportar CSV (compatible con Excel en español) ── */
  function exportCsv() {
    if (myStudents.length === 0) { toast(t('No hay alumnos en esta clase')); return; }
    const cols = myCategories.flatMap(cat => myItems.filter(i => i.category_id === cat.id).map(i => ({ cat, item: i })));
    const num = (v: number | null | undefined) => (typeof v === 'number' ? v.toFixed(2).replace('.', ',') : '');
    // En una evaluación, sus actividades y su nota; en «Curso», todas, con la nota de cada evaluación y la final
    const header = [t('Alumno'), ...cols.map(c => `${c.cat.name} - ${c.item.name}`),
      ...(deCurso ? [...PERIODS.slice(0, 3).map(p => t(p)), t('Nota final')] : [`${t('Media ponderada')} (${t(ev.periodo)})`])];
    const rows = myStudents.map(s => {
      const cells = cols.map(({ item }) => {
        const v = grades[item.id]?.[s.id];
        return typeof v === 'number' ? String(v).replace('.', ',') : '';
      });
      const n = deCurso?.notas.get(s.id);
      return [s.name, ...cells, ...(n ? [...n.evaluaciones.map(num), num(n.final)] : [num(notaDe(s.id))])];
    });
    const csv = '\uFEFF' + [header, ...rows]
      .map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const slug = (x: string) => x.replace(/\s+/g, '-');
    void downloadFile(blob, `notas-${slug(cls?.name ?? 'clase')}-${slug(ev.periodo)}-${isoDate()}.csv`, CARPETAS.cuaderno);
    toast(t('✅ Notas exportadas (ábrelas con Excel)'));
  }

  /** Los pesos de cada nota dentro de la categoría se cuentan entre las de una misma evaluación: con la media de las evaluaciones, no se editan viendo todo el curso. */
  const pesosEditables = !(esCurso && regla.modo === 'media');

  /** La marca de quien tiene una adaptación curricular significativa en esta materia. */
  const marcaAcs = (s: Student) => (acsAula.some(a => a.alumnoId === s.id && esDeAsignatura(a, activeSubject)) ? (
    <span className="sda-chip gb-acs" title={t('Tiene una adaptación curricular significativa en esta materia: califícalo con sus criterios.')}>
      {modeloAcs(comunidad).sigla}
    </span>
  ) : null);

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
      {/* Barra de controles: clase, asignatura y exportar, en una sola fila */}
      <div className="toolbar">
        <ClassChips classes={classes} value={clsId} onChange={setClassId} />
        {/* La asignatura solo aparece si esta clase tiene más de una */}
        {subjects.length > 1 && (
          <>
            <span className="toolbar-sep" aria-hidden="true" />
            <span className="toolbar-label" id="nb-subject-label">{t('Estás evaluando')}</span>
            <div className="chip-row" role="group" aria-labelledby="nb-subject-label">
              {subjects.map(s => {
                const on = s === activeSubject;
                return (
                  <button key={s} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setSubject(s)}>
                    {s}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <span className="toolbar-sep ev-sel-sep" aria-hidden="true" />
        <SelectorEvaluacion ev={ev} queCuenta={t('El cuaderno enseña y cuenta las actividades y las anotaciones de estas fechas.')} />
        <span className="toolbar-spacer" />
        <button className="tb-btn" onClick={exportCsv} disabled={myItems.length === 0}>
          <Download size={14} />{t('Exportar a Excel')}
        </button>
      </div>

      {myStudents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px 24px' }}>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 16 }}>
            {t('La clase')} <strong>{cls?.name}</strong> {t('todavía no tiene alumnos.')}
          </p>
          <button className="btn-accent" onClick={() => onNav('classes')}>
            {t('Añadir alumnos')} <ArrowRight size={14} />
          </button>
        </div>
      ) : ownCategories.length === 0 ? (
        /* Primera vez en esta clase: configurar categorías */
        <div className="card" style={{ maxWidth: 620, margin: '20px auto', textAlign: 'center', padding: '36px 32px' }}>
          <Settings2 size={32} color="var(--accent-d)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            {t('¿Cómo evalúas en {name}?', { name: cls?.name ?? '' })}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto 22px' }}>
            {t(explicacionDePropuestas(tiposDeAsignatura(activeSubject, cls?.materiasOficiales?.[activeSubject])), { asignatura: activeSubject })}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* Una propuesta por lo que la asignatura es (lib/categoriasCuaderno.ts) y, al final, la típica: se ofrecen, no se imponen */}
            {propuestasDeCategorias(activeSubject, lang, cls?.materiasOficiales?.[activeSubject]).map((p, k) => (
              <button
                key={p.id} className={k === 0 ? 'btn-accent' : 'btn-ghost'}
                title={p.categorias.map(c => `${c.name} ${c.weight}%`).join(' · ')}
                onClick={() => {
                  p.categorias.forEach((c, i) =>
                    onAddCategory({ id: 'gc' + Date.now() + '_' + i, class_id: clsId, name: c.name, weight: c.weight, subject: activeSubject }));
                  toast(`✅ ${lang === 'en' ? 'Categories created' : lang === 'ca' ? 'Categories creades' : 'Categorías creadas'}: ${p.categorias.map(c => `${c.name} ${c.weight}%`).join(' · ')}`);
                }}
              >
                {t(p.boton)}
              </button>
            ))}
            <button className="btn-ghost" onClick={() => openCatModal('new')}>
              <Plus size={14} />{t('Crear a mi manera')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Cómo se calcula la nota, en una fila (11-10-2026): las categorías
              y el bloque de anotaciones, todos en %, sumados hasta el total.
              Cada uno se edita pulsándolo. «Añadir nota», aparte a la derecha. */}
          <div className="gb-formula">
            <div className="gb-formula-row" role="group" aria-label={t('Cómo se calcula la nota')}>
              <span className="gb-formula-lbl">{t('Nota final')}</span>
              <span className="gb-formula-eq" aria-hidden="true">=</span>
              {ownCategories.map((cat, k) => (
                <span key={cat.id} className="gb-formula-term">
                  {k > 0 && <span className="gb-formula-op" aria-hidden="true">+</span>}
                  <button type="button" className="gb-w-chip" onClick={() => openCatModal(cat)} title={t('Editar categoría')}>
                    {cat.name} <strong>{cat.weight}%</strong>
                    <Pencil size={11} />
                  </button>
                </span>
              ))}
              {block && (
                <span className="gb-formula-term">
                  <span className="gb-formula-op" aria-hidden="true">+</span>
                  <button
                    type="button"
                    className={`gb-w-chip block${block.active ? '' : ' off'}`}
                    onClick={openBlock}
                    title={t(esAsignaturaEF(activeSubject) ? 'Vestimenta e higiene, actitud y participación, con lo que observas en la pista' : 'Tareas, comportamiento y participación, con lo que anotas en En clase › Anotar actitud')}
                  >
                    <Flag size={12} />
                    {nombreDelBloque(block.cfg, t, activeSubject)} <strong>{block.active ? `${blockPct.toLocaleString(locale)}%` : t('no cuenta')}</strong>
                    <Pencil size={11} />
                  </button>
                  {/* Ir a anotar esta misma clase (11-10-2026); en EF, a la pista */}
                  <button
                    type="button" className="gb-formula-go"
                    onClick={() => {
                      if (esAsignaturaEF(activeSubject)) { llevarClase(); onNav('ef-pista'); return; }
                      requestActitud({ classId: cls!.id, subject: activeSubject });
                      onNav('actitud');
                    }}
                  >
                    <Hand size={12} />{t('Anotar')}
                  </button>
                </span>
              )}
              {/* El bloque se da en % de la nota final, como las categorías:
                  40 + 40 + 20 suman 100. Los cuadernos de antes, con las
                  categorías al 100% y el bloque aparte, tampoco avisan: la
                  cuenta es la misma. */}
              {pesos.ok ? (
                <span className="gb-formula-total ok" title={t('Los pesos están bien')}>
                  <Check size={13} />{`${pesos.total.toLocaleString(locale)}%`}
                </span>
              ) : (
                <span className="gb-formula-total warn">
                  ⚠ {t('Los pesos suman {n}% (lo ideal es 100%)', { n: pesos.total.toLocaleString(locale) })}
                </span>
              )}
              <button type="button" className="gb-formula-add" onClick={() => openCatModal('new')}>
                <Plus size={13} />{t('Categoría')}
              </button>
            </div>
            <button className="btn-accent gb-add-grade" onClick={() => openItemModal('new')}>
              <Plus size={15} />{t('Añadir nota')}
            </button>
          </div>

          {deCurso && myItems.length > 0 && (
            <NotasDeCurso
              alumnado={myStudents} notas={deCurso.notas} regla={regla}
              onRegla={r => guardarRegla(r, clsId, activeSubject)}
              onParaTodas={otrasAsignaturas.length > 0 ? reglaParaTodas : undefined}
              onVerEvaluacion={ev.elegir}
              marca={marcaAcs}
            />
          )}

          {aCompletar && (
            <Sugerencia
              titulo={aCompletar.faltan.length === 1
                ? t('En «{actividad}» falta 1 alumno por calificar', { actividad: aCompletar.item.name })
                : t('En «{actividad}» faltan {n} alumnos por calificar', { actividad: aCompletar.item.name, n: aCompletar.faltan.length })}
              porque={t('El resto de la clase ya tiene nota: {nombres}.', { nombres: nombresDe(aCompletar.faltan) })}
              // Abre la lista de casillas grandes, con el foco en el primero que falta
              accion={t('Calificar esta actividad')} onAccion={() => setCalificando(aCompletar.item.id)}
              onCerrar={() => sugerencias.marcar(aCompletar.clave)}
            />
          )}

          {/* Tabla de notas */}
          {myItems.length === 0 && deTodoElCurso.length > 0 && ev.rango ? (
            /* La evaluación que se mira no tiene nada, pero el cuaderno sí: se dice, para que no parezca vacío */
            <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 6 }}>
                {t('No hay actividades en {evaluacion}.', { evaluacion: nombreCorto(ev.periodo) })}
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 18 }}>
                {t('Va del {desde} al {hasta}. Lo que añadas ahora caerá en ella, y lo de las demás evaluaciones sigue en su sitio.', { desde: diaCorto(ev.rango.desde), hasta: diaCorto(ev.rango.hasta) })}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn-accent" onClick={() => openItemModal('new')}>
                  <Plus size={14} />{t('Añadir nota')}
                </button>
                <button className="btn-ghost" onClick={() => ev.elegir(CURSO_ENTERO)}>{t('Ver todo el curso')}</button>
              </div>
            </div>
          ) : myItems.length === 0 ? (
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
          ) : esCurso && !verTodas ? (
            <button type="button" className="nc-ver" aria-expanded={false} onClick={() => cambiarVerTodas(true)}>
              <ChevronDown size={15} aria-hidden="true" />{t('Ver todas las actividades del curso ({n})', { n: deTodoElCurso.length })}
            </button>
          ) : (
            <>
            {esCurso && (
              <button type="button" className="nc-ver" aria-expanded onClick={() => cambiarVerTodas(false)}>
                <ChevronUp size={15} aria-hidden="true" />{t('Ocultar las actividades del curso')}
              </button>
            )}
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
                          colSpan={isMarksCategory(cat.id) ? TARGETS.length + 1 : items.length}
                          style={{
                            borderLeft: '2px solid var(--border)',
                            background: 'var(--surface)',
                            fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                            textTransform: 'uppercase', color: 'var(--text-2)',
                            padding: '7px 8px', whiteSpace: 'nowrap',
                          }}
                        >
                          {isMarksCategory(cat.id) && block
                            ? `${nombreDelBloque(block.cfg, t, activeSubject)} · ${`${(Math.round(block.cfg.points * 100) / 10).toLocaleString(locale)}%`}`
                            : `${cat.name} · ${cat.weight}%`}
                        </th>
                      ))}
                      <th className="gb-sticky-r" style={{ minWidth: 76, borderLeft: '2px solid var(--border)' }} rowSpan={2}
                        title={esCurso ? t('La nota final de curso, con la regla elegida arriba') : t('La nota de {evaluacion}', { evaluacion: nombreCorto(ev.periodo) })}>
                        {t(esCurso ? 'Final@@nota' : 'Media')}
                      </th>
                    </tr>
                    <tr>
                      {grouped.map(({ cat, items }) =>
                        isMarksCategory(cat.id) && block ? (
                          [...TARGETS.map((tg, k) => (
                            <th key={`${cat.id}-${tg}`} style={k === 0 ? { borderLeft: '2px solid var(--border)' } : undefined}>
                              <button
                                className="gb-item-hd gb-marks-hd"
                                onClick={openBlock}
                                title={t(esAsignaturaEF(activeSubject) ? 'Sale sola de lo que observas en la pista. Clic para ajustar el bloque.' : 'Sale sola de lo que anotas en Anotar actitud o en la Distribución de aula. Clic para ajustar el bloque.')}
                              >
                                <span className="gb-item-name">{t(targetLabel(tg, activeSubject))}</span>
                                <span className="gb-item-cat">{block.cfg.weights[tg].toLocaleString(locale)}%</span>
                              </button>
                            </th>
                          )),
                          <th key={`${cat.id}-total`}>
                            <button className="gb-item-hd gb-marks-hd" onClick={openBlock} title={t('Nota del bloque, de 0 a 10')}>
                              <span className="gb-item-name"><Flag size={11} /> {t('Nota')}</span>
                              <span className="gb-item-cat">{t('automática')}</span>
                            </button>
                          </th>]
                        ) : items.map((item, k) => (
                          <th key={item.id} style={k === 0 ? { borderLeft: '2px solid var(--border)' } : undefined}>
                            <button className="gb-item-hd" aria-haspopup="dialog" onClick={() => setMenuDe(item.id)} title={`${cat.name} · ${item.date} — ${t('clic para calificarla, rellenarla o editarla')}`}>
                              <span className="gb-item-name">{item.name}</span>
                              <span className="gb-item-cat">{item.date}{hayPesosElegidos(items) && ` · ${(Math.round((porcentajesEnCategoria(items).get(item.id) ?? 0) * 10) / 10).toLocaleString(locale)}%`}</span>
                            </button>
                          </th>
                        )),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {myStudents.map(s => {
                      const avg = notaDe(s.id);
                      return (
                        <tr key={s.id}>
                          <td className="gb-sticky gb-student">
                            {s.name}
                            {marcaAcs(s)}
                          </td>
                          {grouped.map(({ cat, items }) => {
                            const sb = isMarksCategory(cat.id) ? block?.perStudent.get(s.id) : undefined;
                            if (sb) {
                              return [
                                ...TARGETS.map((tg, k) => {
                                  const p = sb.parts[tg];
                                  return (
                                    <td key={`${cat.id}-${tg}`} style={{ textAlign: 'center', ...(k === 0 ? { borderLeft: '2px solid var(--border)' } : {}) }}>
                                      <span
                                        className="gb-marks-cell" style={{ color: notaColor(p.score) }}
                                        title={p.pos + p.neg > 0
                                          ? t('{neg} negativas · {pos} positivas', { neg: p.neg, pos: p.pos })
                                          : t('Sin anotaciones: nota de partida')}
                                      >
                                        {fmtNota(p.score, locale)}
                                        {p.pos + p.neg > 0 && (
                                          <small>
                                            {p.neg > 0 && <b className="neg">−{p.neg}</b>}
                                            {p.pos > 0 && <b className="pos">+{p.pos}</b>}
                                          </small>
                                        )}
                                      </span>
                                    </td>
                                  );
                                }),
                                <td key={`${cat.id}-total`} style={{ textAlign: 'center' }}>
                                  <span className="gb-marks-cell total" style={{ color: notaColor(sb.total) }}>{fmtNota(sb.total, locale)}</span>
                                </td>,
                              ];
                            }
                            return items.map((item, k) => (
                              <td key={item.id} style={{
                                textAlign: 'center',
                                ...(k === 0 ? { borderLeft: '2px solid var(--border)' } : {}),
                              }}>
                                <GradeCell
                                  value={grades[item.id]?.[s.id] ?? null}
                                  onCommit={v => onSetGrade(item.id, s.id, v)}
                                  itemId={item.id} alumnoId={s.id}
                                  onPegar={filas => setPegado({ filas, alumnoId: s.id, actividadId: item.id })}
                                />
                              </td>
                            ));
                          })}
                          <td className="gb-sticky-r" style={{ textAlign: 'center', borderLeft: '2px solid var(--border)' }}>
                            <span style={{ fontSize: 13.5, fontWeight: 800, color: notaColor(avg) }}>{fmtNota(avg, locale)}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Media del grupo */}
                    <tr className="gb-footer">
                      <td className="gb-sticky" style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-2)' }}>{t('Media del grupo')}</td>
                      {grouped.map(({ cat, items }) => {
                        const mean = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
                        const cell = (key: string, m: number | null, first: boolean) => (
                          <td key={key} style={{
                            textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: notaColor(m),
                            ...(first ? { borderLeft: '2px solid var(--border)' } : {}),
                          }}>
                            {fmtNota(m, locale)}
                          </td>
                        );
                        if (isMarksCategory(cat.id) && block) {
                          const all = myStudents.map(st => block.perStudent.get(st.id)).filter(Boolean) as NonNullable<ReturnType<typeof block.perStudent.get>>[];
                          return [
                            ...TARGETS.map((tg, k) => cell(`${cat.id}-${tg}`, mean(all.map(b => b.parts[tg].score)), k === 0)),
                            cell(`${cat.id}-total`, mean(all.map(b => b.total)), false),
                          ];
                        }
                        return items.map((item, k) => cell(
                          item.id,
                          mean(myStudents.map(st => grades[item.id]?.[st.id]).filter((v): v is number => typeof v === 'number')),
                          k === 0,
                        ));
                      })}
                      <td className="gb-sticky-r" style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 800, color: 'var(--text-2)', borderLeft: '2px solid var(--border)' }}>
                        {(() => {
                          const avgs = myStudents
                            .map(s => notaDe(s.id))
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
            {columnasEditables.length > 0 && (
              <p className="sda-note pn-pista">
                <span className="pn-pista-teclado">{t('Intro y las flechas pasan de una celda a otra. Para traer notas de una hoja de cálculo, copia allí los nombres con sus notas y pégalos en la columna de la actividad: cada nota irá a su alumno, y antes de poner nada verás lo que cambia.')} </span>
                <span>{t('Pulsa el nombre de una actividad para calificarla en una lista o poner una nota a quien no tiene.')}</span>
              </p>
            )}
            </>
          )}
        </>
      )}

      {/* El menú de la columna: calificar en lista, poner una nota a quien no tiene y editar */}
      {actividadDelMenu && (
        <MenuDeColumna
          key={actividadDelMenu.id}
          item={actividadDelMenu} detalle={detalleDe(actividadDelMenu)} alumnado={myStudents} notas={grades[actividadDelMenu.id]}
          onClose={() => setMenuDe(null)}
          onCalificar={() => { setMenuDe(null); setCalificando(actividadDelMenu.id); }}
          onEditar={() => { setMenuDe(null); openItemModal(actividadDelMenu); }}
          onRellenar={valor => {
            ponerNotas(cambiosDeRelleno(actividadDelMenu.id, myStudents, grades[actividadDelMenu.id], valor), 'rellenar');
            setMenuDe(null);
          }}
        />
      )}

      {/* «Calificar esta actividad»: el alumnado en lista, con una casilla grande por nota */}
      {actividadEnLista && (
        <CalificarActividad
          item={actividadEnLista} detalle={detalleDe(actividadEnLista)}
          grupos={editables.map(g => ({ categoria: g.cat.name, items: g.items }))}
          alumnado={myStudents} notas={grades[actividadEnLista.id]} marca={marcaAcs}
          onNota={(studentId, v) => onSetGrade(actividadEnLista.id, studentId, v)}
          onCambiar={setCalificando}
          onPegar={(filas, alumnoId) => setPegado({ filas, alumnoId, actividadId: actividadEnLista.id })}
          onClose={() => setCalificando(null)}
        />
      )}

      {/* Lo pegado de una hoja de cálculo: nada se escribe hasta que el docente lo ha visto */}
      {pegado && (
        <VistaPreviaPegado
          filas={pegado.filas}
          donde={{
            alumnado: myStudents,
            // En la lista se pega en esa actividad y hacia abajo; en la tabla, también hacia la derecha
            actividades: actividadEnLista ? [actividadEnLista] : columnasEditables,
            alumnoId: pegado.alumnoId, actividadId: pegado.actividadId, notas: grades,
          }}
          onClose={() => { const { actividadId, alumnoId } = pegado; setPegado(null); focoEn(actividadId, alumnoId); }}
          onAplicar={cambios => {
            const { actividadId, alumnoId } = pegado;
            ponerNotas(cambios, 'pegar');
            setPegado(null);
            focoEn(actividadId, alumnoId);
          }}
        />
      )}

      {/* Modal del bloque de anotaciones del aula */}
      <Modal
        open={blockOpen && bf !== null}
        onClose={() => setBlockOpen(false)}
        title={<span className="mk-ttl"><Flag size={16} color="var(--accent-d)" />{nombreDelBloque(block?.cfg, t, activeSubject)}</span>}
      >
        {bf && (
          <>
            <p className="gb-marks-cfg-help">
              {t(esAsignaturaEF(activeSubject)
                ? 'Sale solo de lo que observas en la pista: «Sin equipación» y «Sin aseo» cuentan en Vestimenta e higiene; «Juego limpio» y «Mala actitud», en Actitud y juego limpio; «Participa», «Se esfuerza» y «No participa», en Participación y esfuerzo. Cada parte es una nota de 0 a 10 y el bloque es su media ponderada.'
                : 'Sale solo de lo que anotas en En clase › Anotar actitud (o desde la Distribución de aula): «Sin tarea» cuenta en Tareas; «Sin material» y el comportamiento, en Comportamiento; «Participa», en Participación. Cada parte es una nota de 0 a 10 y el bloque es su media ponderada.')}
            </p>
            <div className="fgroup">
              <label className="flabel" htmlFor="blk-name">{t('Título del bloque')}</label>
              <input id="blk-name" className="finput" value={bf.name} maxLength={60} placeholder={t(BLOCK_NAME)}
                onChange={e => setBf({ ...bf, name: e.target.value })} />
            </div>
            <label className="gb-block-toggle">
              <input type="checkbox" checked={bf.enabled} onChange={e => setBf({ ...bf, enabled: e.target.checked })} />
              {t('Cuenta en la nota de {name}', { name: activeSubject || cls?.name || '' })}
            </label>
            <div className="frow fgroup">
              <div>
                <label className="flabel" htmlFor="blk-points">{t('Peso en la nota final (%)')}</label>
                <input id="blk-points" className="finput" inputMode="decimal" value={bf.pct} disabled={!bf.enabled}
                  onChange={e => setBf({ ...bf, pct: e.target.value })} />
              </div>
              <div>
                <label className="flabel" htmlFor="blk-step">{t('Cada anotación suma o resta')}</label>
                <input id="blk-step" className="finput" inputMode="decimal" value={bf.step} disabled={!bf.enabled}
                  onChange={e => setBf({ ...bf, step: e.target.value })} />
              </div>
            </div>
            <table className="gb-block-parts">
              <thead>
                <tr><th />{TARGETS.map(tg => <th key={tg}>{t(targetLabel(tg, activeSubject))}</th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{t('Peso en el bloque (%)')}</th>
                  {TARGETS.map(tg => (
                    <td key={tg}>
                      <input className="finput" inputMode="decimal" aria-label={`${t('Peso en el bloque (%)')} · ${t(targetLabel(tg, activeSubject))}`}
                        value={bf.weights[tg]} disabled={!bf.enabled}
                        onChange={e => setBf({ ...bf, weights: { ...bf.weights, [tg]: e.target.value } })} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{t('Nota de partida')}</th>
                  {TARGETS.map(tg => (
                    <td key={tg}>
                      <input className="finput" inputMode="decimal" aria-label={`${t('Nota de partida')} · ${t(targetLabel(tg, activeSubject))}`}
                        value={bf.bases[tg]} disabled={!bf.enabled}
                        onChange={e => setBf({ ...bf, bases: { ...bf.bases, [tg]: e.target.value } })} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="gb-marks-cfg-help" style={{ marginTop: 10 }}>
              {t('Ejemplo: Pruebas 40% + Tareas 40% + este bloque 20% = 100%. Si tus categorías ya suman 100%, el bloque se queda con su % y ellas se reparten el resto en proporción.')}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn-accent" style={{ flex: 1, justifyContent: 'center' }} onClick={saveBlock}>{t('Guardar')}</button>
              <button className="btn-ghost" onClick={() => setBlockOpen(false)}>{t('Cancelar')}</button>
            </div>
          </>
        )}
      </Modal>

      {/* Modal categoría */}
      <Modal
        open={catModal !== null}
        onClose={() => setCatModal(null)}
        title={t(catModal === 'new' ? 'Nueva categoría' : 'Editar categoría')}
      >
        <div className="fgroup">
          <label className="flabel" htmlFor="notebook-f1">{t('Nombre')}</label>
          <input id="notebook-f1" className="finput" value={catName} onChange={e => setCatName(e.target.value)} placeholder={t('Ej: Exámenes')} autoFocus />
        </div>
        <div className="fgroup">
          <label className="flabel" htmlFor="notebook-f2">{t('Peso en la media (%)')}</label>
          <input id="notebook-f2" className="finput" value={catWeight} onChange={e => setCatWeight(e.target.value)} placeholder={t('Ej: 60')} inputMode="numeric" />
        </div>
        {catModal !== 'new' && catModal !== null && (() => {
          // Las de la evaluación que se está viendo: los pesos de cada nota se reparten entre las que cuentan juntas
          const suyas = myItems.filter(i => i.category_id === catModal.id)
            .sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.name.localeCompare(b.name, 'es'));
          if (!pesosEditables) return suyas.length > 1 ? <p className="sda-note">{t('Lo que cuenta cada nota dentro de la categoría se cambia en su evaluación (1.ª, 2.ª o 3.ª): con la media de las evaluaciones, las notas se reparten el peso dentro de cada una.')}</p> : null;
          return suyas.length > 1 ? <PesosDeNotas items={suyas} valores={catItemWeights} onChange={setCatItemWeights} /> : null;
        })()}
        {/* La categoría y su peso son de todo el curso: se dice cuando se mira una sola evaluación, y antes de eliminarla */}
        {!esCurso && <p className="sda-note">{t('La categoría y su peso valen para todo el curso: las tres evaluaciones usan los mismos.')}</p>}
        {confirmDel && catModal !== 'new' && catModal !== null && (() => {
          const fuera = deTodoElCurso.filter(i => i.category_id === catModal.id).length - myItems.filter(i => i.category_id === catModal.id).length;
          return fuera > 0 ? (
            <p className="sda-note nc-aviso" role="alert">
              {fuera === 1
                ? t('Tiene 1 actividad en otra evaluación, que ahora no ves: también se eliminará, con sus notas.')
                : t('Tiene {n} actividades en otras evaluaciones, que ahora no ves: también se eliminarán, con sus notas.', { n: fuera })}
            </p>
          ) : null;
        })()}
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
          <label className="flabel" htmlFor="notebook-f3">{t('Nombre')}</label>
          <input id="notebook-f3" className="finput" value={itemName} onChange={e => setItemName(e.target.value)} placeholder={t('Ej: Examen Tema 3')} autoFocus />
        </div>
        <div className="frow fgroup">
          <div>
            <label className="flabel" htmlFor="notebook-f4">{t('Categoría')}</label>
            <select id="notebook-f4" className="finput" value={itemCat} onChange={e => setItemCat(e.target.value)} style={{ cursor: 'pointer' }}>
              {ownCategories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.weight}%)</option>)}
            </select>
          </div>
          <div>
            <label className="flabel" htmlFor="notebook-f5">{t('Fecha')}</label>
            <input id="notebook-f5" className="finput" type="date" value={itemDate} onChange={e => setItemDate(e.target.value)} />
          </div>
        </div>
        {/* La fecha decide en qué evaluación cuenta: se dice siempre, para que no haya sorpresas al cambiarla */}
        <p className="sda-note nc-donde" role="status">
          {(() => {
            const suya = periodoDeFecha(itemDate, ev.hoy, ev.rangos);
            if (!itemDate) return t('Sin fecha, sale en todas las evaluaciones.');
            if (!suya) return t('Esa fecha es de otro curso: no cuenta en ninguna evaluación de este, solo sale en «Curso».');
            return t('Por su fecha, cuenta en {evaluacion}.', { evaluacion: nombreCorto(suya) });
          })()}
        </p>
        {(() => {
          const cat = ownCategories.find(c => c.id === itemCat);
          if (!cat) return null;
          // Las que cuentan con ella: las de su misma evaluación (o todas, con evaluación continua y viendo el curso)
          const hermanas = deTodoElCurso.filter(i => i.category_id === itemCat && (itemModal === 'new' || itemModal === null || i.id !== itemModal.id))
            .filter(cuentanCon(itemDate));
          const w = itemWeight.trim() === '' ? NaN : parseDec(itemWeight);
          const yo: GradeItem = { id: '__yo', class_id: clsId, category_id: itemCat, name: '', date: '', ...(w >= 0 ? { weight: w } : {}) };
          const lista = [...hermanas, yo];
          const pct = porcentajesEnCategoria(lista).get('__yo') ?? 0;
          const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString(locale);
          return (
            <div className="fgroup">
              <label className="flabel" htmlFor="notebook-f6">{t('Cuánto cuenta en la categoría (%)')}</label>
              <input id="notebook-f6" className="finput" inputMode="decimal" value={itemWeight} onChange={e => setItemWeight(e.target.value)}
                placeholder={t('Igual que las demás ({n}%)', { n: fmt(100 / lista.length) })} />
              <p className="sda-note">
                {t(esCurso && regla.modo === 'continua'
                  ? 'Cuenta un {pct}% de «{cat}», un {final}% de la nota final.'
                  : 'Cuenta un {pct}% de «{cat}» en su evaluación, un {final}% de la nota de esa evaluación.',
                { pct: fmt(pct), cat: cat.name, final: fmt(pesoEnLaNotaFinal(yo, lista, cat.weight)) })}
              </p>
            </div>
          );
        })()}
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
}

function AiTab({ data, chat, onChatChange, lawDocument, onLawDocumentChange }: AiTabProps) {
  const { toast } = useToast();
  const { t, lang, locale } = useI18n();
  const [question, setQuestion] = useState('');
  // Lo adjunto a una pregunta: un documento va como texto y una foto, con el nombre tapado (ver useAdjuntoParaIA)
  const adjunto = useAdjuntoParaIA(m => toast(t(m)));
  const attachedFile = adjunto.adjunto;
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
    if (!forLaw) { await adjunto.elegir(file); return; }
    if (file.size > MAX_FILE_BYTES) { toast(t('El archivo supera el límite de 19 MB')); return; }
    try {
      onLawDocumentChange(await fileToBase64(file));
      toast(t('✅ Normativa adjuntada'));
    } catch {
      toast(t('No se pudo leer el archivo'));
    }
  }

  async function ask(rawText: string) {
    const text = rawText.trim();
    if (!text) { toast(t('Escribe una pregunta antes de consultar')); return; }
    if (loading) return;

    const files: InlineFile[] = [...adjunto.archivos];
    if (lawDocument) files.push(lawDocument);
    // Un documento adjunto va como texto dentro de la pregunta (los nombres del alumnado los cambia callGemini)
    const documento = attachedFile?.texto ? `\n\n=== DOCUMENTO ADJUNTO: ${attachedFile.nombre} ===\n${attachedFile.texto.slice(0, 30000)}` : '';

    // El historial guarda la pregunta limpia; la ficha de datos se añade solo
    // al mensaje que se manda ahora. Si se guardara dentro, cada turno
    // arrastraría una copia del cuaderno entero.
    // Lo que escribió el docente, en esta pregunta y en las anteriores: sin datos de contacto ni, si nombra a un alumno, de salud
    const history: ChatTurn[] = chat.slice(-MEMORY_TURNS).map(m => ({ role: m.role, text: m.role === 'user' ? preguntaParaIA(m.text) : m.text }));
    const context = useData ? buildTeacherContext(data, { classId: classId || undefined, locale }) : '';
    const prompt = (context
      ? `${context}\n\n=== PREGUNTA DEL DOCENTE ===\n${preguntaParaIA(text)}`
      : preguntaParaIA(text)) + documento;

    const afterUser: ChatMessage[] = [...chat, {
      id: crypto.randomUUID(), role: 'user', text, at: new Date().toISOString(),
    }];
    onChatChange(afterUser);
    setQuestion('');
    adjunto.quitar();

    const result = await callGemini(
      chatSystemPrompt(lang, useData),
      prompt,
      files,
      { onStart: () => setLoading(true), onEnd: () => setLoading(false), onError: msg => toast(msg) },
      { history, maxOutputTokens: CHAT_MAX_TOKENS, thinkingLevel: 'low' },
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
    const nombre = data.students.find(s => s.class_id === cls.id)?.name;
    const alumno = nombre ? nombreDePila(nombre) : undefined;
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
            <button className="btn-accent" style={{ fontSize: 12.5, padding: '7px 14px', flexShrink: 0 }} onClick={abrirClaveIA}>
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
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFile.nombre}</span>
                  <button type="button" onClick={() => adjunto.quitar()} aria-label={t('Quitar archivo adjunto')}
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
            <input ref={attachRef} type="file" style={{ display: 'none' }} onChange={e => handleAttach(e, false)} accept={ACEPTA_ADJUNTO} />
            {adjunto.ventana}
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
            {t('Estos datos se envían a Google solo al hacer una pregunta, y no se guardan en ningún servidor de AulaPro.')}
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
  const [tab, setTab] = useState<'grades' | 'competencias' | 'ai'>('grades');
  const { t } = useI18n();
  // La clase se elige una vez para todo el cuaderno: al pasar de «Calificaciones» a «Por competencias» y al
  // volver se sigue viendo la misma, aunque el horario diga que ahora toca otra
  const clase = useClaseActiva(props.classes);
  // La evaluación que se ve («1.ª · 2.ª · 3.ª · Curso») es la misma que en las actas (`useEvaluacionElegida`)
  const ev = useEvaluacionElegida();

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Cuaderno de Notas')}<AyudaVideo id="cuaderno-notas" /></h1>
          <p className="pg-sub">{t('Calificaciones con media ponderada y asistente pedagógico')}</p>
        </div>
        <div className="tab-bar" style={{ marginBottom: 0, width: 'auto' }}>
          <button className={`tab-btn${tab === 'grades' ? ' active' : ''}`} style={{ padding: '8px 20px' }} onClick={() => setTab('grades')}>
            {t('Calificaciones')}
          </button>
          <button className={`tab-btn${tab === 'competencias' ? ' active' : ''}`} style={{ padding: '8px 20px' }} onClick={() => setTab('competencias')}>
            {t('Por competencias')}
          </button>
          <button className={`tab-btn${tab === 'ai' ? ' active' : ''}`} style={{ padding: '8px 20px' }} onClick={() => setTab('ai')}>
            ✨ {t('Consulta IA')}
          </button>
        </div>
      </div>

      {tab === 'grades' ? <GradesTab {...props} clase={clase} ev={ev} /> : tab === 'competencias' ? (
        <Suspense fallback={<div className="card"><p className="ce-aviso">{t('Cargando…')}</p></div>}>
          <CompetenciasDeLaClase classes={props.classes} students={props.students} evaluations={props.evaluations} comunidad={props.comunidad} onNav={props.onNav} clase={clase[0]} onClase={clase[1]} />
        </Suspense>
      ) : (
        <AiTab
          data={props.aiData}
          chat={props.chat}
          onChatChange={props.onChatChange}
          lawDocument={props.lawDocument}
          onLawDocumentChange={props.onLawDocumentChange}
        />
      )}
    </section>
  );
}
