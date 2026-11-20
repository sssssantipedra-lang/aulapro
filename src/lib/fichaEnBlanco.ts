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

/** Los tipos que admiten una pizza o una tarta al lado del enunciado (la figura de la que habla el problema). */
const CON_PIZZA_AL_LADO: readonly FichaExerciseType[] = ['problema', 'abierta', 'completar', 'opcion_multiple'];
/** Los tipos que usan sus dibujos a su manera (uno por grupo, por fila, por elemento): no valen de un tipo para otro. */
const DIBUJOS_PROPIOS: readonly FichaExerciseType[] = ['contar', 'etiquetar', 'clasificar', 'fracciones', 'relacionar', 'tabla_rellenar'];

/**
 * Lo que acompaña al enunciado y vale igual con el tipo nuevo: la figura geométrica (solo la dibuja la IA: perderla
 * sin clave no tiene arreglo), los pictogramas de una ficha visual, los dibujos sueltos del hilo y la pizza de un problema.
 */
function loQueAcompana(ex: FichaExercise, tipo: FichaExerciseType): Partial<FichaExercise> {
  const out: Partial<FichaExercise> = {};
  if (ex.figura) out.figura = ex.figura;
  if (ex.imagenes?.length) out.imagenes = ex.imagenes;
  if (ex.dibujos?.length && !DIBUJOS_PROPIOS.includes(ex.tipo) && !DIBUJOS_PROPIOS.includes(tipo)) out.dibujos = ex.dibujos;
  if (ex.fracciones?.length && ex.tipo !== 'fracciones' && CON_PIZZA_AL_LADO.includes(tipo)) {
    out.fracciones = ex.fracciones;
    if (ex.cogidos) out.cogidos = ex.cogidos;
  }
  return out;
}

/**
 * El mismo ejercicio con otro tipo: conserva el enunciado, la solución, las variantes de apoyo y
 * ampliación, la consigna dibujada, lo que acompaña al enunciado (`loQueAcompana`) y, si los dos tipos
 * son listas, sus líneas. El resto de campos son los del tipo nuevo, vacíos. Quien llama pasa el
 * resultado por `prepareExercise` y, antes de aplicarlo, mira con `loQuePierde` si hay que avisar.
 */
export function cambiarTipo(ex: FichaExercise, tipo: FichaExerciseType, o: OpcionesVacio = {}): FichaExercise {
  if (tipo === ex.tipo) return ex;
  const lineas = lineasDe(ex);
  const nuevo = ejercicioVacio(tipo, o);
  const comun: FichaExercise = {
    ...loQueAcompana(ex, tipo),
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

const escrito = (s: string | undefined): string => (s ?? '').trim();

/** Los nombres (claves en castellano, con su contexto) de lo que se puede perder al cambiar de tipo. */
export const PIERDE = {
  enunciado: 'el enunciado@@pierde',
  solucion: 'la solución@@pierde',
  lineas: 'las líneas de la lista que no caben en el tipo nuevo@@pierde',
  tabla: 'la tabla@@pierde',
  bocadillos: 'los bocadillos@@pierde',
  derecha: 'la columna derecha@@pierde',
  pistas: 'las pistas@@pierde',
  leyenda: 'la leyenda de colores@@pierde',
  pizzas: 'las pizzas@@pierde',
  dibujos: 'los dibujos@@pierde',
  recuadro: 'las palabras del recuadro@@pierde',
} as const;

/** «a», «a y b», «a, b y c». */
export function enumerar(lista: string[], y: string): string {
  if (lista.length <= 1) return lista[0] ?? '';
  return `${lista.slice(0, -1).join(', ')} ${y} ${lista[lista.length - 1]}`;
}

/**
 * Lo que se pierde al pasar de `antes` a `despues` (el ejercicio ya con su tipo nuevo y preparado): los nombres (claves
 * de `PIERDE`) de lo que el docente había escrito y ya no está. Vacío si no se pierde nada. Se compara lo que queda, no
 * lo que debería quedar: así cuenta también lo que el tipo nuevo no admite (una frase larga no cabe en una sopa de
 * letras) y el enunciado que sustituyen las pizzas. Las mayúsculas de una sopa de letras no son una pérdida.
 *
 * El desplegable del tipo cambia con las flechas del teclado: sin este aviso, pasar por «Cómic» o «Tabla» de camino a
 * otro tipo se llevaba la lista escrita sin decir nada.
 */
export function loQuePierde(antes: FichaExercise, despues: FichaExercise): string[] {
  if (antes.tipo === despues.tipo) return [];
  const out: string[] = [];
  if (escrito(antes.enunciado) && escrito(despues.enunciado) !== escrito(antes.enunciado)) out.push(PIERDE.enunciado);
  if (escrito(antes.solucion) && escrito(despues.solucion) !== escrito(antes.solucion)) out.push(PIERDE.solucion);
  const clave = (s: string) => s.trim().toLocaleUpperCase();
  const quedan = new Set(lineasDe(despues).map(clave));
  if (lineasDe(antes).some(l => !quedan.has(clave(l)))) out.push(PIERDE.lineas);
  if (antes.tipo === 'tabla_rellenar' && (antes.columnas?.some(c => c.trim()) || antes.filas?.some(f => f.some(c => c.trim())))) out.push(PIERDE.tabla);
  if (antes.tipo === 'comic' && antes.vinetas?.some(v => v.texto.trim())) out.push(PIERDE.bocadillos);
  if (antes.tipo === 'relacionar' && limpias(antes.derecha).length) out.push(PIERDE.derecha);
  if (antes.tipo === 'crucigrama' && antes.pistas?.some(p => p.pista.trim())) out.push(PIERDE.pistas);
  if (antes.tipo === 'colorear' && antes.leyenda?.length) out.push(PIERDE.leyenda);
  if (antes.fracciones?.length && despues.fracciones !== antes.fracciones) out.push(PIERDE.pizzas);
  if ((antes.dibujos?.length && despues.dibujos !== antes.dibujos) || antes.categorias?.some(c => c.dibujos.length || c.nombre.trim())) out.push(PIERDE.dibujos);
  if (limpias(antes.bancoPalabras).length && !limpias(despues.bancoPalabras).length) out.push(PIERDE.recuadro);
  return out;
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

/** La última fila tiene algo escrito: quitarla se lleva ese texto, así que antes se pregunta. */
export function ultimaFilaEscrita(ex: FichaExercise): boolean {
  const filas = ex.filas ?? [];
  return filas.length > 1 && filas[filas.length - 1].some(c => (c ?? '').trim() !== '');
}

/** La última columna tiene algo escrito, en su cabecera o en alguna fila. */
export function ultimaColumnaEscrita(ex: FichaExercise): boolean {
  const n = (ex.columnas ?? []).length;
  if (n <= 2) return false;
  return (ex.columnas![n - 1] ?? '').trim() !== '' || (ex.filas ?? []).some(f => (f[n - 1] ?? '').trim() !== '');
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
