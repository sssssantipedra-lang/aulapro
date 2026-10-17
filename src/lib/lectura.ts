/**
 * Comprensión lectora: el texto de una ficha de lectura (un cuento, un poema, una noticia…) con sus dibujos y
 * lo que hace falta para pedirlo a la IA y comprobarlo. Pedido del dueño (17-10-2026) tras ver un cuaderno de
 * comprensión lectora: un texto con ilustraciones que le den sentido y actividades del estilo («Rodea en el texto…»,
 * «Numera según el orden…», «Contesta», «Dibuja…»).
 *
 * Como en el resto de las fichas, **el código decide y la IA rellena**: cuánto debe medir el texto según el curso
 * (palabras, párrafos, versos, dibujos), qué dibujos valen (solo del catálogo, `lib/ilustraciones.ts`) y en qué párrafo
 * va cada uno, y si el texto se pasa o se queda corto (entonces se pide otra vez). Aquí solo hay lógica pura; las
 * llamadas a la IA están en `services/fichaLectura.ts`.
 */
import type { PerfilCurso } from './escalera';
import { ILUSTRACIONES, elegirIlustraciones, ilustracionPorId } from './ilustraciones';
import { quitarNegritas, cuantasNegritas } from './negritas';
import type { Lang } from '../i18n';

export type GeneroLectura = 'cuento' | 'poema' | 'noticia' | 'informativo' | 'descripcion' | 'entrevista' | 'instrucciones';

export const GENEROS_LECTURA: readonly GeneroLectura[] = ['cuento', 'poema', 'noticia', 'informativo', 'descripcion', 'entrevista', 'instrucciones'];

/** Los nombres que se ven en la pantalla (claves en castellano, como el resto de textos). */
export const NOMBRE_GENERO: Record<GeneroLectura, string> = {
  cuento: 'Cuento',
  poema: 'Poema',
  noticia: 'Noticia',
  informativo: 'Texto informativo',
  descripcion: 'Descripción',
  entrevista: 'Entrevista',
  instrucciones: 'Instrucciones',
};

/** Una pista para la IA sobre qué es cada género (en el prompt). */
export const GENERO_PARA_IA: Record<GeneroLectura, string> = {
  cuento: 'un cuento o una leyenda con personajes, un lugar, un problema y un final',
  poema: 'un poema con estrofas y rima, escrito en versos cortos',
  noticia: 'una noticia de periódico con titular implícito, qué pasó, dónde, cuándo y quién',
  informativo: 'un texto informativo o divulgativo sobre el tema, con datos y ejemplos',
  descripcion: 'una descripción de un lugar, un animal, un personaje o un objeto, con detalles que se pueden dibujar',
  entrevista: 'una entrevista con preguntas y respuestas (cada intervención empieza con un guion largo o con el nombre)',
  instrucciones: 'un texto instructivo (una receta, unas reglas de juego, un experimento) con pasos en orden',
};

export const esGenero = (g: unknown): g is GeneroLectura => typeof g === 'string' && (GENEROS_LECTURA as readonly string[]).includes(g);

/** Un dibujo del catálogo junto a un párrafo del texto (0 = el primero). */
export interface DibujoDeLectura {
  ilustracion: string;
  parrafo: number;
}

export interface FichaLectura {
  genero: GeneroLectura;
  /**
   * Los párrafos del texto (en un poema, las estrofas: cada una con sus versos separados por saltos de línea).
   * Pueden llevar **palabras clave** entre dobles asteriscos (lectura fácil).
   */
  parrafos: string[];
  /** Los dibujos que ilustran el texto, cada uno junto a un párrafo; la hoja los pone al lado, a la derecha. */
  dibujos: DibujoDeLectura[];
  /** Lo que dice la mascota antes de leer: una frase que orienta la lectura sin destripar nada («Fíjate en cómo se sienten los personajes»). */
  pista?: string;
  /** Lo que se trabaja, en una o dos etiquetas cortas («Vocabulario», «Orden de los hechos»). */
  destrezas?: string[];
}

/* ── Cuánto debe medir el texto ── */

export interface LongitudLectura {
  /** Palabras del texto (en prosa). */
  palabras: [number, number];
  /** Versos (en un poema). */
  versos: [number, number];
  /** Párrafos o estrofas. */
  parrafos: [number, number];
  /** Cuántos dibujos como mucho. */
  dibujos: number;
}

/**
 * Lo que mide un texto de comprensión lectora en cada curso: más corto y más ilustrado en los primeros cursos
 * (3 o 4 dibujos), más largo y con menos dibujos en los últimos. En lectura fácil, un cuarto menos de palabras
 * y párrafos más cortos: leer cuesta más y el texto tiene que caber en una lectura tranquila.
 */
export function longitudDeLectura(perfil: PerfilCurso, facil = false): LongitudLectura {
  const { etapa, curso } = perfil;
  let base: LongitudLectura;
  if (etapa === 'infantil') base = { palabras: [20, 40], versos: [4, 8], parrafos: [2, 3], dibujos: 3 };
  else if (etapa === 'primaria') {
    base = [
      { palabras: [40, 70], versos: [6, 10], parrafos: [3, 4], dibujos: 3 },
      { palabras: [70, 110], versos: [8, 12], parrafos: [3, 5], dibujos: 3 },
      { palabras: [110, 170], versos: [10, 14], parrafos: [4, 5], dibujos: 3 },
      { palabras: [170, 250], versos: [12, 16], parrafos: [4, 6], dibujos: 3 },
      { palabras: [250, 350], versos: [14, 20], parrafos: [5, 7], dibujos: 3 },
      { palabras: [320, 450], versos: [16, 24], parrafos: [5, 8], dibujos: 3 },
    ][Math.max(1, Math.min(6, curso || 4)) - 1] as LongitudLectura;
  } else if (etapa === 'eso') {
    base = curso <= 1
      ? { palabras: [350, 500], versos: [16, 28], parrafos: [6, 9], dibujos: 2 }
      : { palabras: [400, 600], versos: [16, 32], parrafos: [6, 10], dibujos: 2 };
  } else if (etapa === 'bachillerato') base = { palabras: [500, 700], versos: [16, 32], parrafos: [6, 10], dibujos: 1 };
  else base = { palabras: [200, 320], versos: [12, 20], parrafos: [4, 7], dibujos: 3 };
  if (!facil) return base;
  const reduce = (n: number) => Math.max(15, Math.round(n * 0.75 / 5) * 5);
  return {
    palabras: [reduce(base.palabras[0]), reduce(base.palabras[1])],
    versos: base.versos,
    parrafos: [base.parrafos[0], base.parrafos[1] + 1],
    dibujos: base.dibujos,
  };
}

/* ── Medir un texto ── */

export const contarPalabras = (parrafos: string[]): number =>
  parrafos.join(' ').replace(/\*\*/g, '').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;

/** Los versos de un poema (cada línea de cada estrofa). */
export const contarVersos = (parrafos: string[]): number => parrafos.reduce((n, p) => n + p.split('\n').filter(l => l.trim()).length, 0);

/** Las frases de un texto (se parte en puntos, signos de cierre y saltos de línea), sin las vacías. */
export function frasesDe(parrafos: string[]): string[] {
  return parrafos.join(' ').replace(/\*\*/g, '').split(/(?<=[.!?…])\s+|\n+/).map(f => f.trim()).filter(f => /[\p{L}\p{N}]/u.test(f));
}

/** Palabras por frase, de media. */
export function palabrasPorFrase(parrafos: string[]): number {
  const frases = frasesDe(parrafos);
  return frases.length ? contarPalabras(parrafos) / frases.length : 0;
}

/** La frase más larga, en palabras. */
export const fraseMasLarga = (parrafos: string[]): number => Math.max(0, ...frasesDe(parrafos).map(f => f.split(/\s+/).length));

/** Cuántas palabras por frase como mucho en lectura fácil, de media y la más larga. */
export const MEDIA_FRASE_FACIL = 11;
export const FRASE_MAX_FACIL = 18;

export interface MedidaDeTexto {
  palabras: number;
  versos: number;
  media: number;
  /** Lo que está mal, dicho como indicación para pedir otra vez el texto; vacío si el texto vale. */
  problemas: string[];
}

/** Comprueba el texto contra lo que se pidió: la longitud del curso y, en lectura fácil, frases cortas y negritas. */
export function medirTexto(l: Pick<FichaLectura, 'genero' | 'parrafos'>, long: LongitudLectura, facil: boolean): MedidaDeTexto {
  const palabras = contarPalabras(l.parrafos);
  const versos = contarVersos(l.parrafos);
  const media = palabrasPorFrase(l.parrafos);
  const problemas: string[] = [];
  if (l.genero === 'poema') {
    if (versos < Math.floor(long.versos[0] * 0.7)) problemas.push(`El poema tiene ${versos} versos y tiene que tener entre ${long.versos[0]} y ${long.versos[1]}.`);
    else if (versos > Math.ceil(long.versos[1] * 1.4)) problemas.push(`El poema tiene ${versos} versos y es demasiado largo: entre ${long.versos[0]} y ${long.versos[1]}.`);
  } else {
    if (palabras < Math.floor(long.palabras[0] * 0.7)) problemas.push(`El texto tiene ${palabras} palabras y tiene que tener entre ${long.palabras[0]} y ${long.palabras[1]}: desarróllalo más.`);
    else if (palabras > Math.ceil(long.palabras[1] * 1.4)) problemas.push(`El texto tiene ${palabras} palabras y es demasiado largo para este curso: entre ${long.palabras[0]} y ${long.palabras[1]}.`);
  }
  if (facil && l.genero !== 'poema') {
    if (media > MEDIA_FRASE_FACIL + 3) problemas.push(`Las frases miden de media ${media.toFixed(1)} palabras: en lectura fácil tienen que ser cortas (de 6 a ${MEDIA_FRASE_FACIL}), con una sola idea cada una.`);
    else if (fraseMasLarga(l.parrafos) > FRASE_MAX_FACIL + 6) problemas.push(`Hay una frase de ${fraseMasLarga(l.parrafos)} palabras: pártela en frases más cortas.`);
  }
  if (facil && l.parrafos.every(p => cuantasNegritas(p) === 0)) {
    problemas.push('No hay ninguna palabra clave en negrita: marca con **doble asterisco** las palabras clave de cada frase (personajes, lugares, acciones y datos importantes).');
  }
  return { palabras, versos, media, problemas };
}

/* ── Limpiar lo que devuelve la IA ── */

export interface ContextoLectura {
  /** El tipo de texto que eligió el docente: manda sobre lo que ponga la IA. */
  genero?: GeneroLectura;
  perfil: PerfilCurso;
  facil: boolean;
  tema: string;
  area: string;
  nivel: string;
}

/** Quita el número o el guion de delante que la IA pone a veces («1. El dragón»). */
const sinNumero = (s: string) => s.replace(/^\s*\d+\s*[.)\-:]\s*/, '').trim();

/** Un dibujo por párrafo y de uno en uno, repartidos a lo largo del texto. */
export function repartirDibujos(ids: string[], parrafos: number): DibujoDeLectura[] {
  if (!ids.length || parrafos < 1) return [];
  if (ids.length >= parrafos) return ids.slice(0, parrafos).map((ilustracion, i) => ({ ilustracion, parrafo: i }));
  // Repartidos: el primero en el primer párrafo y los demás a la misma distancia
  const salto = parrafos / ids.length;
  return ids.map((ilustracion, i) => ({ ilustracion, parrafo: Math.min(parrafos - 1, Math.floor(i * salto)) }));
}

/** Los dibujos del catálogo que mejor encajan con el tema, para cuando la IA no pone ninguno válido. */
export function dibujosPorDefecto(ctx: ContextoLectura, titulo: string, parrafos: string[]): DibujoDeLectura[] {
  const long = longitudDeLectura(ctx.perfil, ctx.facil);
  const elegidas = elegirIlustraciones(
    { tema: `${ctx.tema} ${titulo} ${parrafos.join(' ').slice(0, 600)}`, area: ctx.area, nivel: ctx.nivel },
    { uso: 'objeto', max: long.dibujos },
  ).map(i => i.id);
  return repartirDibujos(elegidas, parrafos.length);
}

/**
 * El texto de la IA, comprobado: título sin número, género válido, párrafos sin vacíos (los poemas conservan sus
 * versos; la prosa, no), la pista corta y los dibujos solo del catálogo, uno por párrafo, sin repetir y sin pasarse
 * de los que caben. Sin dibujos válidos, los pone el código por el tema. `null` si no hay texto.
 */
export function limpiarLectura(raw: unknown, ctx: ContextoLectura): { titulo: string; lectura: FichaLectura } | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const genero: GeneroLectura = ctx.genero ?? (esGenero(r.genero) ? r.genero : 'cuento');
  const parrafos = (Array.isArray(r.parrafos) ? r.parrafos : [])
    .map(p => (typeof p === 'string' ? p : ''))
    .map(p => (genero === 'poema' ? p.split('\n').map(l => l.trim()).filter(Boolean).join('\n') : p.replace(/\s*\n+\s*/g, ' ').trim()))
    .filter(p => /[\p{L}\p{N}]/u.test(p))
    .slice(0, 14);
  const titulo = sinNumero(typeof r.titulo === 'string' ? r.titulo : '').replace(/\*\*/g, '');
  if (!parrafos.length || !titulo) return null;
  const long = longitudDeLectura(ctx.perfil, ctx.facil);

  const vistos = new Set<string>();
  const ocupados = new Set<number>();
  let dibujos: DibujoDeLectura[] = [];
  for (const d of Array.isArray(r.dibujos) ? r.dibujos as { ilustracion?: unknown; parrafo?: unknown }[] : []) {
    const id = typeof d?.ilustracion === 'string' ? d.ilustracion : '';
    const ilu = ilustracionPorId(id);
    const parrafo = Math.round(Number(d?.parrafo)) - 1;
    if (!ilu || ilu.fuente !== 'img' || vistos.has(id) || !(parrafo >= 0 && parrafo < parrafos.length) || ocupados.has(parrafo)) continue;
    vistos.add(id); ocupados.add(parrafo);
    dibujos.push({ ilustracion: id, parrafo });
  }
  dibujos = dibujos.sort((a, b) => a.parrafo - b.parrafo).slice(0, long.dibujos);
  const lectura: FichaLectura = { genero, parrafos, dibujos: dibujos.length ? dibujos : [] };
  if (!lectura.dibujos.length) lectura.dibujos = dibujosPorDefecto(ctx, titulo, parrafos);

  const pista = quitarNegritas(typeof r.pista === 'string' ? r.pista : '').replace(/\s+/g, ' ').trim();
  if (pista) lectura.pista = pista.length > 150 ? `${pista.slice(0, 147).replace(/\s+\S*$/, '')}…` : pista;
  const destrezas = (Array.isArray(r.destrezas) ? r.destrezas : [])
    .map(d => quitarNegritas(typeof d === 'string' ? d : '').replace(/\s+/g, ' ').trim().replace(/[.:;]+$/, ''))
    .filter(d => d && d.length <= 36).slice(0, 2);
  if (destrezas.length) lectura.destrezas = destrezas;
  return { titulo, lectura };
}

/* ── Para los prompts ── */

/** El texto con sus párrafos numerados, para que los ejercicios puedan referirse a ellos («en el párrafo 2»). */
export function textoNumerado(l: Pick<FichaLectura, 'parrafos' | 'genero'>): string {
  return l.parrafos.map((p, i) => `[${i + 1}] ${l.genero === 'poema' ? p.split('\n').join(' / ') : p}`).join('\n');
}

/** Los dibujos del catálogo que se pueden ofrecer a la IA para ilustrar un texto: «id: lo que se ve». */
export function listaDibujosDeLectura(lang: Lang = 'es'): string {
  return ILUSTRACIONES.filter(i => i.fuente === 'img' && i.uso === 'objeto')
    .map(i => `${i.id}: ${i.descripcion[lang].split(':')[0]}`).join('\n');
}

/** Los identificadores de los dibujos de un texto, sin repetir (para cargarlos antes de maquetar). */
export const dibujosDeLaLectura = (l: Pick<FichaLectura, 'dibujos'> | undefined): string[] => [...new Set((l?.dibujos ?? []).map(d => d.ilustracion))];
