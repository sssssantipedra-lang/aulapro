/**
 * Fichas hechas a mano, sin IA (20-11-2026): la ficha en blanco con la que arranca el editor,
 * el ejercicio vacío de cada tipo, cambiar un ejercicio de tipo conservando lo que encaja y
 * duplicarlo. Sin clave de Gemini (o sin cupo) en Recursos no se podía crear nada.
 *
 * Puro: de `services/` solo usa tipos. Lo que monta el código (la rejilla de la sopa, la
 * cuadrícula del crucigrama, el desorden de «ordenar») lo hace después `prepareExercise`,
 * igual que con lo que devuelve la IA.
 */
import type {
  FichaActivity, FichaContent, FichaExercise, FichaExerciseType, FichaFormato,
} from '../services/resources';
import type { Lang } from '../i18n';
import type { Hilo } from './hilos';
import type { GeneroLectura } from './lectura';
import { DIFICULTADES, type Dificultad } from './escalera';
import { fichaTheme, STORY_THEME_IDS, type FichaThemeId } from './fichaThemes';
import { contarDelHilo, etiquetarDelHilo } from './dibujosEjercicio';
import { fraccionesParaEjercicio } from './fraccionesDibujo';

/** Filas y columnas con las que nace una tabla, y sus topes al añadir. */
export const TABLA_INICIAL = { filas: 3, columnas: 3 };
export const MAX_FILAS_TABLA = 12;
export const MAX_COLUMNAS_TABLA = 6;
export const MAX_VINETAS = 4;

/** Las viñetas con las que nace un cómic: tres bocadillos por rellenar. */
const PERSONAJES_COMIC = ['🙂', '😀', '🤔', '😮'];

interface OpcionesVacio {
  lang?: Lang;
  /** Con hilo conductor, «contar» y «etiquetar» nacen con sus dibujos (un ejercicio de dibujos sin dibujos no se puede hacer). */
  hilo?: Hilo;
  rand?: () => number;
}

/**
 * Un ejercicio vacío de un tipo: con la forma justa para que el editor enseñe sus campos y la
 * hoja lo pinte sin romperse. Los tipos que no tienen sentido vacíos (pizzas, dibujos del hilo)
 * nacen con un ejemplo que se cambia en el editor.
 */
export function ejercicioVacio(tipo: FichaExerciseType, o: OpcionesVacio = {}): FichaExercise {
  const lang = o.lang ?? 'es';
  const base: FichaExercise = { tipo, enunciado: '', solucion: '' };
  switch (tipo) {
    case 'opcion_multiple': return { ...base, opciones: [] };
    case 'tabla_rellenar': return {
      ...base,
      columnas: Array.from({ length: TABLA_INICIAL.columnas }, () => ''),
      filas: Array.from({ length: TABLA_INICIAL.filas }, () => Array.from({ length: TABLA_INICIAL.columnas }, () => '')),
    };
    case 'relacionar': return { ...base, izquierda: [], derecha: [] };
    case 'colorear': return { ...base, leyenda: [], itemsColorear: [] };
    case 'sopa_letras': return { ...base, palabras: [] };
    case 'verdadero_falso': return { ...base, afirmaciones: [] };
    case 'ordenar': return { ...base, elementos: [], ordenCorrecto: [] };
    case 'crucigrama': return { ...base, pistas: [] };
    case 'comic': return { ...base, vinetas: PERSONAJES_COMIC.slice(0, 3).map(personaje => ({ personaje, texto: '' })) };
    case 'calculos': return { ...base, lineas: [], respuesta: 'caja' };
    case 'fracciones': return fraccionesParaEjercicio('leer', lang, { rand: o.rand });
    case 'contar': return (o.hilo && contarDelHilo(o.hilo, lang, o.rand)) || base;
    case 'etiquetar': return (o.hilo && etiquetarDelHilo(o.hilo, lang, { banco: true })) || base;
    case 'clasificar': return { ...base, categorias: [{ nombre: '', dibujos: [] }, { nombre: '', dibujos: [] }] };
    case 'contestar': return { ...base, preguntas: [] };
    case 'en_texto':
    case 'dibujar': return { ...base, lineasRespuesta: 0 };
    default: return base;
  }
}

/** Un bloque sin ejercicios, con su peldaño de la escalera si se da. */
export function bloqueVacio(dificultad?: Dificultad): FichaActivity {
  return { titulo: '', ...(dificultad ? { dificultad } : {}), ejercicios: [] };
}

/** El peldaño del bloque que se añade al final: el siguiente al último, y el 3 de ahí en adelante. Sin escalera, ninguno. */
export function dificultadDelSiguiente(actividades: Pick<FichaActivity, 'dificultad'>[]): Dificultad | undefined {
  const ultimo = actividades[actividades.length - 1]?.dificultad;
  if (!actividades.length) return 1;
  if (!ultimo) return undefined;
  return Math.min(3, ultimo + 1) as Dificultad;
}

/** Lo que se puede empezar en blanco: las cuatro tarjetas de «¿Qué quieres crear?», con las tarjetas en sus dos modos. */
export type QueEnBlanco = 'ficha' | 'lectura' | 'escape' | 'tarjetas' | 'interactivas';

export interface OpcionesEnBlanco {
  titulo?: string;
  /** El aspecto elegido en el formulario; 'auto' o ninguno, «Cuaderno» (en un escape room, el primer mundo con historia). */
  estilo?: FichaThemeId | 'auto';
  /** El hilo conductor ya resuelto (solo fichas «Cuaderno»). */
  hilo?: string;
  generoLectura?: GeneroLectura | 'auto';
}

/**
 * La ficha vacía con la que se abre el editor. Una ficha de ejercicios lleva ya los tres bloques
 * de la escalera (todas van de menos a más); un escape room, tres salas con su candado y su
 * historia por escribir; la comprensión lectora, un texto con un párrafo vacío y sus tres bloques;
 * y las tarjetas, un mazo con una tarjeta por rellenar.
 */
export function fichaEnBlanco(que: QueEnBlanco, o: OpcionesEnBlanco = {}): FichaContent {
  const titulo = (o.titulo ?? '').trim();
  const base = { titulo, explicacion: '', instrucciones: '' };
  const elegido: FichaThemeId | undefined = o.estilo && o.estilo !== 'auto' ? o.estilo : undefined;
  const escalera = (): FichaActivity[] => DIFICULTADES.map(d => bloqueVacio(d));

  if (que === 'tarjetas' || que === 'interactivas') {
    const formato: FichaFormato = 'tarjetas';
    return que === 'interactivas'
      ? { ...base, actividades: [], estilo: elegido ?? 'cuaderno', formato, interactivas: true, tarjetasInteractivas: [{ texto: '', imagen: '', imagenTipo: 'ilustracion', imagenDelante: true }] }
      : { ...base, actividades: [], estilo: elegido ?? 'cuaderno', formato, tarjetas: [{ pregunta: '', respuesta: '' }] };
  }
  if (que === 'escape') {
    // Un escape room necesita historia: si el aspecto elegido no la tiene, el primer mundo que sí
    const estilo = elegido && fichaTheme(elegido).historia ? elegido : STORY_THEME_IDS[0];
    const tema = fichaTheme(estilo);
    return {
      ...base, estilo, formato: 'escape',
      historia: { personaje: '', emoji: tema.personaje, mision: '', cierre: '', insignia: '' },
      actividades: escalera().map(a => ({ ...a, candado: { codigo: '', pista: '' } })),
    };
  }
  if (que === 'lectura') {
    return {
      ...base, estilo: 'cuaderno', formato: 'ficha', actividades: escalera(),
      lectura: { genero: o.generoLectura && o.generoLectura !== 'auto' ? o.generoLectura : 'cuento', parrafos: [''], dibujos: [] },
    };
  }
  const estilo = elegido ?? 'cuaderno';
  const tema = fichaTheme(estilo);
  return {
    ...base, estilo, formato: 'ficha', actividades: escalera(),
    ...(estilo === 'cuaderno' && o.hilo ? { hilo: o.hilo } : {}),
    ...(tema.historia ? { historia: { personaje: '', emoji: tema.personaje, mision: '', cierre: '', insignia: '' } } : {}),
  };
}

/* ── Cambiar de tipo ── */

const limpias = (l: (string | undefined)[] | undefined): string[] => (l ?? []).map(x => (x ?? '').trim()).filter(Boolean);

/**
 * La lista principal de un ejercicio, una línea por elemento: es lo que se conserva al cambiarlo de
 * tipo (las afirmaciones de un verdadero o falso pasan a ser las opciones, las palabras de una sopa,
 * las de un crucigrama…). En «ordenar», en su orden correcto.
 */
export function lineasDe(ex: FichaExercise): string[] {
  switch (ex.tipo) {
    case 'opcion_multiple': return limpias(ex.opciones);
    case 'verdadero_falso': return limpias(ex.afirmaciones);
    case 'calculos': return limpias(ex.lineas);
    case 'contestar': return limpias(ex.preguntas);
    case 'ordenar': return limpias(ex.ordenCorrecto?.length ? ex.ordenCorrecto : ex.elementos);
    case 'relacionar': return limpias(ex.izquierda);
    case 'sopa_letras': return limpias(ex.palabras);
    case 'crucigrama': return limpias(ex.pistas?.map(p => p.palabra));
    case 'colorear': return limpias(ex.itemsColorear);
    default: return [];
  }
}

/** Lo que tiene el ejercicio y no cabe en una lista de líneas: se pierde al cambiarlo de tipo. */
export function pierdeAlCambiar(ex: FichaExercise): boolean {
  switch (ex.tipo) {
    case 'tabla_rellenar': return !!ex.columnas?.some(c => c.trim()) || !!ex.filas?.some(f => f.some(c => c.trim()));
    case 'comic': return !!ex.vinetas?.some(v => v.texto.trim());
    case 'relacionar': return limpias(ex.derecha).length > 0;
    case 'crucigrama': return !!ex.pistas?.some(p => p.pista.trim());
    case 'colorear': return !!ex.leyenda?.length;
    case 'fracciones': return !!ex.fracciones?.length;
    case 'contar':
    case 'etiquetar': return !!ex.dibujos?.length;
    case 'clasificar': return !!ex.categorias?.some(c => c.dibujos.length || c.nombre.trim());
    default: return false;
  }
}

/**
 * El mismo ejercicio con otro tipo: conserva el enunciado, la solución, las variantes de apoyo y
 * ampliación, la consigna dibujada y, si los dos tipos son listas, sus líneas. El resto de campos son
 * los del tipo nuevo, vacíos. Quien llama pasa el resultado por `prepareExercise`.
 */
export function cambiarTipo(ex: FichaExercise, tipo: FichaExerciseType, o: OpcionesVacio = {}): FichaExercise {
  if (tipo === ex.tipo) return ex;
  const lineas = lineasDe(ex);
  const nuevo = ejercicioVacio(tipo, o);
  const comun: FichaExercise = {
    ...nuevo,
    // Las pizzas y los dibujos del hilo traen su enunciado y su solución, calculados: mandan sobre lo que hubiera
    enunciado: nuevo.enunciado || ex.enunciado,
    solucion: nuevo.solucion || ex.solucion,
    ...(ex.apoyo !== undefined ? { apoyo: ex.apoyo } : {}),
    ...(ex.ampliacion !== undefined ? { ampliacion: ex.ampliacion } : {}),
    ...(ex.consigna ? { consigna: ex.consigna } : {}),
  };
  if (!lineas.length) return comun;
  switch (tipo) {
    case 'opcion_multiple': return { ...comun, opciones: lineas };
    case 'verdadero_falso': return { ...comun, afirmaciones: lineas };
    case 'calculos': return { ...comun, lineas };
    case 'contestar': return { ...comun, preguntas: lineas };
    // `prepareExercise` guarda este orden como el correcto y los baraja
    case 'ordenar': return { ...comun, elementos: lineas, ordenCorrecto: [] };
    case 'relacionar': return { ...comun, izquierda: lineas };
    case 'sopa_letras': return { ...comun, palabras: lineas };
    case 'crucigrama': return { ...comun, pistas: lineas.map(palabra => ({ palabra, pista: '' })) };
    case 'colorear': return { ...comun, itemsColorear: lineas };
    default: return comun;
  }
}

/**
 * Un ejercicio recién añadido al que aún no se le ha escrito nada: sin enunciado y sin contenido propio (ni
 * líneas, ni dibujos, ni pizzas, ni figura). No se imprime ni cuenta en la numeración de la hoja: saldría un
 * número suelto. Una tabla o un cómic sí se pintan vacíos, porque su cuadrícula y sus bocadillos ya son el ejercicio.
 */
export function ejercicioSinEscribir(ex: FichaExercise): boolean {
  if ((ex.enunciado ?? '').trim()) return false;
  if (ex.tipo === 'tabla_rellenar' && ex.columnas?.length && ex.filas?.length) return false;
  if (ex.tipo === 'comic' && ex.vinetas?.length) return false;
  if (lineasDe(ex).length || limpias(ex.derecha).length || ex.leyenda?.length || limpias(ex.bancoPalabras).length) return false;
  if (ex.fracciones?.length || ex.dibujos?.length || ex.imagenes?.length || ex.figura) return false;
  if (ex.categorias?.some(c => c.dibujos.length)) return false;
  return true;
}

/** Una copia suelta del ejercicio, para ponerla debajo y retocarla. */
export function duplicarEjercicio(ex: FichaExercise): FichaExercise {
  return JSON.parse(JSON.stringify(ex)) as FichaExercise;
}

/* ── Tablas y cómics: añadir y quitar a mano ── */

export function conFilaDeTabla(ex: FichaExercise): FichaExercise {
  const n = ex.columnas?.length ?? 0;
  if (!n || (ex.filas?.length ?? 0) >= MAX_FILAS_TABLA) return ex;
  return { ...ex, filas: [...(ex.filas ?? []), Array.from({ length: n }, () => '')], ...(ex.pictosFilas ? { pictosFilas: [...ex.pictosFilas, ''] } : {}) };
}

export function sinFilaDeTabla(ex: FichaExercise): FichaExercise {
  const filas = ex.filas ?? [];
  if (filas.length <= 1) return ex;
  const quedan = filas.length - 1;
  return {
    ...ex, filas: filas.slice(0, quedan),
    ...(ex.pictosFilas ? { pictosFilas: ex.pictosFilas.slice(0, quedan) } : {}),
    // Los dibujos van uno por fila: si no cuadran, la hoja no pinta ninguno
    ...(ex.dibujos && ex.dibujos.length > quedan ? { dibujos: ex.dibujos.slice(0, quedan) } : {}),
  };
}

export function conColumnaDeTabla(ex: FichaExercise): FichaExercise {
  const columnas = ex.columnas ?? [];
  if (columnas.length >= MAX_COLUMNAS_TABLA) return ex;
  return { ...ex, columnas: [...columnas, ''], filas: (ex.filas ?? []).map(f => [...f, '']) };
}

export function sinColumnaDeTabla(ex: FichaExercise): FichaExercise {
  const columnas = ex.columnas ?? [];
  if (columnas.length <= 2) return ex;
  return { ...ex, columnas: columnas.slice(0, -1), filas: (ex.filas ?? []).map(f => f.slice(0, columnas.length - 1)) };
}

export function conVineta(ex: FichaExercise): FichaExercise {
  const vinetas = ex.vinetas ?? [];
  if (vinetas.length >= MAX_VINETAS) return ex;
  return { ...ex, vinetas: [...vinetas, { personaje: PERSONAJES_COMIC[vinetas.length % PERSONAJES_COMIC.length], texto: '' }] };
}

export function sinVineta(ex: FichaExercise, i: number): FichaExercise {
  const vinetas = ex.vinetas ?? [];
  if (vinetas.length <= 2) return ex;
  return { ...ex, vinetas: vinetas.filter((_, j) => j !== i) };
}
