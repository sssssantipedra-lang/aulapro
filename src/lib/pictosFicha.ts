/**
 * Pictogramas en las fichas con apoyos visuales (Recursos): cuáles puede
 * elegir la IA, cómo se le enseñan y qué se hace con lo que devuelve.
 *
 * La IA elige de una lista cerrada (el catálogo de `pictos.ts`): nunca dibuja
 * ni inventa. Lo que devuelve se comprueba aquí; un identificador que no está
 * en el catálogo se cambia por el de su verbo («Rodea» → rodear) o se quita.
 * Decisión del dueño (6-10-2026): las fichas para el alumnado con
 * adaptaciones llevan las instrucciones muy visuales, con pasos numerados,
 * pictogramas y dibujos del contenido. Ver `docs/PTAL.md`.
 */
import { PICTOS, pictoDe } from './pictos';

/**
 * Las consignas: lo que se puede pedir que haga el alumnado en un paso. Van
 * primero los gestos de ficha dibujados para AulaPro y después las acciones
 * de Mulberry.
 */
export const CONSIGNAS_FICHA: readonly string[] = [
  'read-book', 'write', 'ap-rodear', 'ap-unir', 'ap-subrayar', 'ap-tachar', 'ap-marcar', 'ap-completar',
  'ap-ordenar', 'ap-elegir', 'ap-verdadero-falso', 'ap-sopa-letras', 'ap-palotes', 'ap-tabla', 'ap-regla',
  'count', 'colour', 'draw', 'paint', 'cut-with-scissors', 'glue', 'cut-and-paste', 'trace', 'copy', 'spell',
  'eye', 'look', 'hear', 'point', 'think', 'find', 'sort', 'talk-1', 'ask', 'show-me',
  'tape-measure', 'weigh', 'calculator', 'ap-sumar', 'subtract', 'multiply', 'divide',
];

/** Lo que no tiene sentido dibujar dentro de un ejercicio: personas concretas y rutinas del día. */
const FUERA_DE_FICHA = new Set(['personas', 'rutinas']);

/** Los dibujos del contenido: todo el catálogo menos las consignas y lo de `FUERA_DE_FICHA`. */
export const DIBUJOS_FICHA: readonly string[] = PICTOS
  .filter(p => !CONSIGNAS_FICHA.includes(p.id) && !FUERA_DE_FICHA.has(p.categoria))
  .map(p => p.id);

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * El pictograma de un verbo, por si la IA da un identificador que no existe.
 * La clave es el comienzo del verbo, sin tildes, en castellano, catalán o
 * inglés: «Rodea», «Encercla» y «Circle» llevan al mismo.
 */
const POR_VERBO: [RegExp, string][] = [
  [/^(lee|llegeix|read)/, 'read-book'],
  [/^(escrib|escriu|anota|apunta|write)/, 'write'],
  [/^(rode|encercl|circle)/, 'ap-rodear'],
  [/^(une|uneix|relaciona|match|join|connect)/, 'ap-unir'],
  [/^(subray|subratll|underline)/, 'ap-subrayar'],
  [/^(tach|ratll|cross)/, 'ap-tachar'],
  [/^(marca|comprueba|revisa|tick|check)/, 'ap-marcar'],
  [/^(complet|rellena|omple|fill)/, 'ap-completar'],
  [/^(ordena|order|number)/, 'ap-ordenar'],
  [/^(elig|tria|escoge|choose|pick)/, 'ap-elegir'],
  [/^(busca|cerca|troba|find|search)/, 'find'],
  [/^(cuenta|compta|count)/, 'count'],
  [/^(colore|pinta|colour|color)/, 'colour'],
  [/^(dibuj|dibuix|draw)/, 'draw'],
  [/^(recort|retall|cut)/, 'cut-with-scissors'],
  [/^(pega|enganxa|glue|stick)/, 'glue'],
  [/^(mira|observ|look)/, 'eye'],
  [/^(escuch|escolt|listen)/, 'hear'],
  [/^(piensa|pensa|think)/, 'think'],
  [/^(mide|mesura|measure)/, 'ap-regla'],
  [/^(pesa|weigh)/, 'weigh'],
  [/^(calcul)/, 'calculator'],
  [/^(suma|add)/, 'ap-sumar'],
  [/^(resta|subtract)/, 'subtract'],
  [/^(multiplic)/, 'multiply'],
  [/^(divid)/, 'divide'],
  [/^(senal|assenyal|point)/, 'point'],
  [/^(copia|copy)/, 'copy'],
  [/^(repasa|ressegu|trace)/, 'trace'],
  [/^(habla|parla|di |explica|talk|say|tell)/, 'talk-1'],
  [/^(pregunta|ask)/, 'ask'],
  [/^(clasific|classific|agrupa|sort)/, 'sort'],
];

export function pictoDeVerbo(verbo: string): string | undefined {
  const v = plano(verbo);
  if (/palot|tally/.test(v)) return 'ap-palotes';
  return POR_VERBO.find(([re]) => re.test(v))?.[1];
}

/** El identificador si está en el catálogo; si no, `undefined`. */
export function pictoValido(id: string | undefined | null): string | undefined {
  const x = (id ?? '').trim();
  return x && pictoDe(x) ? x : undefined;
}

/** Para el prompt: «id (nombre)», separados por comas. */
export function listaParaIA(ids: readonly string[]): string {
  return ids.map(id => `${id} (${pictoDe(id)?.es ?? id})`).join(', ');
}

/**
 * Los dibujos de un ejercicio en el orden en que se pintan. Con varios
 * distintos se intercalan (manzana, plátano, naranja, manzana…), como en una
 * ficha de recuento: si fueran agrupados no habría nada que contar.
 */
export function dibujosEnOrden(imagenes: readonly { picto: string; cantidad?: number }[] | undefined): string[] {
  const colas = (imagenes ?? []).map(im => Array.from({ length: Math.max(1, im.cantidad ?? 1) }, () => im.picto));
  const out: string[] = [];
  for (let i = 0; colas.some(q => q.length > i); i++) for (const q of colas) if (q[i]) out.push(q[i]);
  return out;
}
