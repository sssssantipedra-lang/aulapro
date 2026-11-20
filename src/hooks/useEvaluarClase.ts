/**
 * El estado de «Evaluar a la clase» (20-11-2026), común a la ventana de la rúbrica (`EvalModal`) y a la de
 * la diana (`DianaEvalModal`): la clase se elige una vez, el alumnado sale en orden de lista con quién está
 * hecho, lo marcado a cada alumno se conserva al pasar a otro aunque no esté guardado, «Guardar y siguiente»
 * no cierra la ventana y «Poner a todos este nivel» deja un punto de partida para cambiar solo las
 * excepciones. Al entrar en un alumno ya evaluado hoy se carga lo marcado y guardar corrige esa evaluación
 * en vez de crear otra; con `corrigiendo` (desde el Historial) la ventana sirve para corregir una sola.
 *
 * Las cuentas están en `lib/evaluarClase.ts`, con pruebas. Aquí no se escribe nada hasta que el docente guarda.
 */
import { useMemo, useState } from 'react';
import type { Class, Evaluation, GradeTarget, ScheduleBlock, Student } from '../types';
import { useI18n } from '../i18n';
import { useToast } from '../components/ui/Toast';
import { useResetOnChange } from '../lib/useResetOnChange';
import { compararAlumnos } from '../lib/alumnado';
import { clasesDe } from '../lib/objetivos';
import { isoDate } from '../lib/utils';
import {
  claseDePartida, comoCorreccion, estadoDe, evaluacionQueCorrige, marcados, marcasATodos, mismasMarcas,
  porGuardar, siguientePendiente, sinCeros, ultimasPorAlumno,
  type Borrador, type EstadoDeAlumno, type Marcado,
} from '../lib/evaluarClase';

/** Cómo se guarda una evaluación nueva. Con `otroTrabajo`, el docente ya ha dicho que no corrige la de hoy: no se le pregunta. */
export type GuardarEvaluacion = (ev: Evaluation, opciones?: { otroTrabajo?: boolean }) => void;

/** Un alumno en la lista de la ventana. */
export interface FilaDeClase {
  id: string;
  name: string;
  estado: EstadoDeAlumno;
  /** Su evaluación más reciente con este instrumento en esta clase. */
  ultima?: Evaluation;
  /** Tiene niveles marcados que aún no se han guardado. */
  sinGuardar: boolean;
}

interface Opciones {
  open: boolean;
  /** La rúbrica o la diana. */
  instrumento: (GradeTarget & { id: string; name: string }) | null;
  tipo: 'rubric' | 'diana';
  /** Los ids de sus criterios o de sus ítems. */
  ids: string[];
  classes: Class[];
  students: Student[];
  /** Para saber a quién se ha evaluado ya y cargar lo marcado. */
  evaluations?: Evaluation[];
  /** El horario, para proponer la clase que toca. */
  scheduleBlocks?: ScheduleBlock[];
  defaultClassId?: string;
  defaultStudentId?: string;
  /** Una evaluación ya hecha que se abre para corregirla (desde el Historial): sin lista ni cambio de alumno. */
  corrigiendo?: Evaluation | null;
  /** La evaluación de ese alumno con lo marcado, con id nuevo y fecha de hoy. */
  construir: (alumno: { id: string; name: string }, classId: string, m: Marcado) => Evaluation;
  onSave: GuardarEvaluacion;
  /** Actualizar una evaluación ya hecha. Sin él, corregir pasa por `onSave` (y la pantalla pregunta si sustituye). */
  onUpdate?: (ev: Evaluation) => void;
  onClose: () => void;
}

const VACIO: Marcado = { scores: {}, notes: '' };
const SIN_EVALUACIONES: Evaluation[] = [];

export function useEvaluarClase(o: Opciones) {
  const { open, instrumento, tipo, ids, classes, students, scheduleBlocks, defaultClassId, defaultStudentId, construir, onSave, onUpdate, onClose } = o;
  const evaluations = o.evaluations ?? SIN_EVALUACIONES;
  // La versión al día de la que se corrige, por si cambia con la ventana abierta
  const corrigiendo = o.corrigiendo ? evaluations.find(e => e.id === o.corrigiendo!.id) ?? o.corrigiendo : null;
  const { t, locale } = useI18n();
  const { toast } = useToast();

  const [hoy, setHoy] = useState(() => isoDate());
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});

  /** Las clases en las que se puede evaluar: las del instrumento, o todas si no declara ninguna. */
  const evalClasses = useMemo(() => {
    const suyas = instrumento ? clasesDe(instrumento) : [];
    return suyas.length ? classes.filter(c => suyas.includes(c.id)) : classes;
  }, [instrumento, classes]);

  const alumnadoDe = (clase: string) => students.filter(s => s.class_id === clase).sort(compararAlumnos);

  useResetOnChange(`${open}:${instrumento?.id ?? ''}:${defaultClassId ?? ''}:${defaultStudentId ?? ''}:${o.corrigiendo?.id ?? ''}`, () => {
    if (!open || !instrumento) return;
    const dia = isoDate();
    setHoy(dia);
    setBorradores({});
    if (corrigiendo) {
      setClassId(corrigiendo.class_id);
      setStudentId(corrigiendo.student_id);
      return;
    }
    const clase = claseDePartida({ instrumento, classes, evaluations, scheduleBlocks, pedida: defaultClassId });
    setClassId(clase);
    // De partida, el primero de la lista que falta: así se empieza a marcar sin elegir a nadie
    const ultimas = ultimasPorAlumno(evaluations, instrumento.id, tipo, clase);
    setStudentId(defaultStudentId ?? siguientePendiente(alumnadoDe(clase).map(s => s.id), '', id => !!ultimas[id]) ?? '');
  });

  const alumnado = useMemo(
    () => students.filter(s => s.class_id === classId).sort(compararAlumnos),
    [students, classId],
  );
  const ultimas = useMemo(
    () => (instrumento ? ultimasPorAlumno(evaluations, instrumento.id, tipo, classId) : {}),
    [evaluations, instrumento, tipo, classId],
  );

  /** La evaluación que se corregirá al guardar a ese alumno, si se corrige alguna. */
  const corrigeDe = (id: string): Evaluation | undefined =>
    corrigiendo ? (id === corrigiendo.student_id ? corrigiendo : undefined) : evaluacionQueCorrige(borradores[id], ultimas[id], hoy, evaluations);
  /** Lo marcado a ese alumno: lo que tiene sin guardar o, si no, lo de la evaluación que corrige. */
  const marcadoDe = (id: string): Marcado => {
    const b = borradores[id];
    if (b) return b;
    const c = corrigeDe(id);
    return c ? { scores: c.scores, notes: c.notes ?? '' } : VACIO;
  };
  const tieneCambios = (id: string) => porGuardar(borradores[id], corrigeDe(id), ids);

  const filas: FilaDeClase[] = alumnado.map(s => ({
    id: s.id, name: s.name, estado: estadoDe(ultimas[s.id], hoy), ultima: ultimas[s.id], sinGuardar: tieneCambios(s.id),
  }));
  const hechos = filas.filter(f => f.estado !== 'pendiente').length;
  const sinGuardar = corrigiendo ? (tieneCambios(corrigiendo.student_id) ? [corrigiendo.student_id] : []) : filas.filter(f => f.sinGuardar).map(f => f.id);

  const alumno: { id: string; name: string } | undefined = !studentId ? undefined
    : students.find(s => s.id === studentId) ?? (corrigiendo?.student_id === studentId ? { id: studentId, name: corrigiendo.student_name } : undefined);
  const actual = marcadoDe(studentId);
  const corrige = studentId ? corrigeDe(studentId) : undefined;
  const ultima = studentId ? ultimas[studentId] : undefined;
  const siguienteId = corrigiendo ? undefined
    : siguientePendiente(alumnado.map(s => s.id), studentId, id => !!ultimas[id]);

  /* ── Marcar al alumno elegido ── */

  function editar(cambio: (m: Marcado) => Partial<Marcado>) {
    if (!studentId) return;
    const base = actual;
    setBorradores(prev => {
      const de = prev[studentId] ?? { scores: base.scores, notes: base.notes };
      // Tocarlo lo convierte en una excepción: «Poner a todos» ya no lo cambia
      return { ...prev, [studentId]: { ...de, ...cambio(de), deTodos: false } };
    });
  }
  const setScores = (s: Record<string, number> | ((p: Record<string, number>) => Record<string, number>)) =>
    editar(m => ({ scores: typeof s === 'function' ? s(m.scores) : s }));
  const setNotes = (notes: string) => editar(() => ({ notes }));

  /** Lo que se guarde será una evaluación nueva, aunque hoy ya tenga una: es otro trabajo. */
  const otroTrabajo = () => studentId && setBorradores(prev => ({ ...prev, [studentId]: { scores: {}, notes: '', editId: null } }));
  /** Cargar la evaluación de otro día para corregirla. */
  const corregirAnterior = () => ultima && setBorradores(prev => ({ ...prev, [studentId]: { scores: { ...ultima.scores }, notes: ultima.notes ?? '', editId: ultima.id } }));
  /** Dejar al alumno como al entrar: sin lo marcado y sin haber elegido corregir u otro trabajo. */
  const volver = () => setBorradores(prev => { const { [studentId]: _fuera, ...resto } = prev; void _fuera; return resto; });

  /* ── Poner a todos este nivel ── */

  /** A quién alcanza: quien no tiene evaluación ni marcas propias (lo puesto antes con otro nivel sí se cambia). */
  const alcanza = (f: FilaDeClase) => f.estado === 'pendiente' && (!borradores[f.id] || borradores[f.id].deTodos || marcados(borradores[f.id].scores, ids) === 0);
  const paraTodos = corrigiendo ? [] : filas.filter(alcanza);
  const conNivelDeTodos = filas.filter(f => borradores[f.id]?.deTodos);
  const nivelDeTodos: number | null = conNivelDeTodos.length ? borradores[conNivelDeTodos[0].id].scores[ids[0]] ?? null : null;

  function ponerATodos(nivel: number) {
    if (paraTodos.length === 0) return;
    const quienes = paraTodos.map(f => f.id);
    setBorradores(prev => {
      const next = { ...prev };
      for (const id of quienes) next[id] = { ...prev[id], scores: marcasATodos(ids, nivel), notes: prev[id]?.notes ?? '', deTodos: true };
      return next;
    });
    if (!studentId) setStudentId(quienes[0]);
  }
  const quitarDeTodos = () => setBorradores(prev => Object.fromEntries(Object.entries(prev).filter(([, b]) => !b.deTodos)));

  /* ── Guardar ── */

  const nota = (ev: Evaluation) => (typeof ev.grade === 'number' ? ev.grade.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—');

  /** Guarda a esos alumnos lo que tengan marcado: corrige la evaluación que toque o crea una. Devuelve lo guardado. */
  function guardar(quienes: string[]): { ev: Evaluation; correccion: boolean }[] {
    const hechas: { ev: Evaluation; correccion: boolean }[] = [];
    for (const id of quienes) {
      const m = marcadoDe(id);
      if (marcados(m.scores, ids) === 0) continue;
      const original = corrigeDe(id);
      if (original && mismasMarcas(m, original)) continue;
      const quien = students.find(s => s.id === id) ?? (original ? { id, name: original.student_name } : undefined);
      if (!quien) continue;
      const nueva = construir(quien, classId, { scores: sinCeros(m.scores), notes: m.notes });
      if (original && onUpdate) {
        const corregida = comoCorreccion(nueva, original);
        onUpdate(corregida);
        hechas.push({ ev: corregida, correccion: true });
      } else {
        onSave(nueva, borradores[id]?.editId === null ? { otroTrabajo: true } : undefined);
        hechas.push({ ev: nueva, correccion: false });
      }
    }
    setBorradores(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => !quienes.includes(id))));
    return hechas;
  }

  /** Lo que no se marca no cuenta como 0: se dice antes de guardar. `false` si el docente prefiere seguir marcando. */
  function conformeConLoQueFalta(quienes: string[]): boolean {
    const incompletos = quienes.filter(id => { const n = marcados(marcadoDe(id).scores, ids); return n > 0 && n < ids.length; });
    if (incompletos.length === 0) return true;
    if (quienes.length === 1) {
      const faltan = ids.length - marcados(marcadoDe(quienes[0]).scores, ids);
      const texto = tipo === 'diana'
        ? t(faltan === 1
          ? 'Queda {n} ítem sin marcar: la nota se calculará solo con lo marcado. ¿Guardar así?'
          : 'Quedan {n} ítems sin marcar: la nota se calculará solo con lo marcado. ¿Guardar así?', { n: faltan })
        : t(faltan === 1
          ? 'Queda {n} criterio sin marcar: la nota se calculará solo con lo marcado. ¿Guardar así?'
          : 'Quedan {n} criterios sin marcar: la nota se calculará solo con lo marcado. ¿Guardar así?', { n: faltan });
      return window.confirm(texto);
    }
    return window.confirm(t(incompletos.length === 1
      ? '{n} alumno tiene niveles sin marcar: su nota se calculará solo con lo marcado. ¿Guardar así?'
      : '{n} alumnos tienen niveles sin marcar: su nota se calculará solo con lo marcado. ¿Guardar así?', { n: incompletos.length }));
  }

  /** El alumno elegido tiene algo que guardar. */
  const hayQueGuardar = !!studentId && tieneCambios(studentId);

  /**
   * «Guardar y siguiente»: guarda al alumno elegido (si tiene algo que guardar) y pasa al siguiente que
   * falta, sin cerrar. Corrigiendo desde el Historial, guarda y cierra. Devuelve `true` si ha seguido adelante.
   */
  function guardarYSeguir(): boolean {
    if (!studentId) return false;
    if (hayQueGuardar) {
      if (!conformeConLoQueFalta([studentId])) return false;
      const [hecha] = guardar([studentId]);
      if (hecha) {
        toast(t(hecha.correccion ? '✅ Evaluación de {name} corregida: nota {grade}' : '✅ Evaluación de {name} guardada: nota {grade}',
          { name: hecha.ev.student_name, grade: nota(hecha.ev) }));
      }
    }
    if (corrigiendo) { onClose(); return true; }
    if (siguienteId) setStudentId(siguienteId);
    else if (instrumento) toast(t('✅ Ya has evaluado a toda la clase con «{instrumento}»', { instrumento: instrumento.name }));
    return true;
  }

  /** Guarda de una vez a todos los que tienen marcas sin guardar. */
  function guardarTodos(): boolean {
    if (sinGuardar.length === 0 || !conformeConLoQueFalta(sinGuardar)) return false;
    const n = guardar(sinGuardar).length;
    toast(t(n === 1 ? '✅ Guardada {n} evaluación' : '✅ Guardadas {n} evaluaciones', { n }));
    return true;
  }

  const confirmarPerder = () => sinGuardar.length === 0 || window.confirm(t(sinGuardar.length === 1
    ? 'Hay {n} alumno con niveles marcados sin guardar. ¿Salir sin guardarlos?'
    : 'Hay {n} alumnos con niveles marcados sin guardar. ¿Salir sin guardarlos?', { n: sinGuardar.length }));

  /** Cerrar la ventana; con marcas sin guardar, pregunta antes. */
  function cerrar() {
    if (!confirmarPerder()) return;
    setBorradores({});
    onClose();
  }

  /** Cambiar de clase; lo marcado sin guardar es de la clase que se deja, y se pregunta antes de perderlo. */
  function cambiarClase(id: string) {
    if (id === classId || !instrumento || !confirmarPerder()) return;
    setBorradores({});
    setClassId(id);
    const u = ultimasPorAlumno(evaluations, instrumento.id, tipo, id);
    setStudentId(siguientePendiente(alumnadoDe(id).map(s => s.id), '', a => !!u[a]) ?? '');
  }

  return {
    /** `true` si se evalúa a la clase (con la lista); `false` si se corrige una sola evaluación. */
    enClase: !corrigiendo,
    corrigiendo, hoy,
    classId, evalClasses, cambiarClase,
    filas, hechos, sinGuardar,
    studentId, elegirAlumno: setStudentId, alumno,
    scores: actual.scores, notes: actual.notes, setScores, setNotes,
    /** La evaluación que se corregirá al guardar al alumno elegido, si la hay. */
    corrige,
    /** La evaluación más reciente del alumno elegido. */
    ultima,
    /** El docente ha dicho que lo de hoy es otro trabajo. */
    esOtroTrabajo: !!studentId && borradores[studentId]?.editId === null,
    otroTrabajo, corregirAnterior, volver,
    paraTodos: paraTodos.length, nivelDeTodos, ponerATodos, quitarDeTodos,
    hayQueGuardar, siguienteId, guardarYSeguir, guardarTodos, cerrar,
  };
}

export type EvaluarClase = ReturnType<typeof useEvaluarClase>;
