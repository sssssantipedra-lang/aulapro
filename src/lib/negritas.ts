/**
 * Las palabras clave en negrita de las fichas en lectura fácil (dislexia): en el texto van entre dos asteriscos,
 * «el **dragón** vive en una **cueva**». La IA las marca al escribir; el código comprueba que estén
 * bien cerradas, las pinta (HTML y Word) y pone en negrita el verbo de cada consigna («**Rodea** en el
 * texto…»). Aquí solo hay texto: nada depende de la app, para usarlo igual en el PDF, en la vista previa y en el Word.
 */

const PAR = /\*\*([^*]+?)\*\*/g;

/** El texto sin las marcas (para contar palabras, comparar o dejarlo en un campo que no pinta negritas). */
export const quitarNegritas = (s: string): string => (s ?? '').replace(/\*\*/g, '');

/**
 * Deja las marcas bien cerradas: una pareja vacía («****») o un asterisco doble suelto (la IA a veces
 * abre una negrita y no la cierra) se quitan; lo bien cerrado se respeta.
 */
export function equilibrarNegritas(s: string): string {
  let t = (s ?? '').replace(/\*{3,}/g, '**').replace(/\*\*(\s*)\*\*/g, '$1');
  // Un número impar de marcas: la última se quedó sin pareja y se quita
  if ((t.split('**').length - 1) % 2 === 1) {
    const i = t.lastIndexOf('**');
    t = t.slice(0, i) + t.slice(i + 2);
  }
  return t;
}

/** Cuántas palabras o expresiones hay en negrita. */
export const cuantasNegritas = (s: string): number => [...equilibrarNegritas(s).matchAll(PAR)].length;

/**
 * El HTML de un texto con negritas: escapa primero (con la función de quien llama) y después pinta las marcas
 * como `<b>`. Lo que no sea una pareja cerrada se muestra sin asteriscos.
 */
export function negritasHtml(s: string, esc: (t: string) => string): string {
  return esc(equilibrarNegritas(s)).replace(PAR, '<b>$1</b>').replace(/\*\*/g, '');
}

/** El texto partido en trozos, cada uno con su negrita sí o no: para el Word. */
export function partirNegritas(s: string): { texto: string; negrita: boolean }[] {
  const partes = equilibrarNegritas(s).split('**');
  return partes.map((texto, i) => ({ texto, negrita: i % 2 === 1 })).filter(p => p.texto !== '');
}

/** Los verbos de las consignas (sin tilde, en minúscula): castellano, catalán e inglés. */
const VERBOS_CONSIGNA = new Set([
  // castellano
  'rodea', 'subraya', 'escribe', 'contesta', 'responde', 'une', 'marca', 'completa', 'ordena', 'numera', 'dibuja', 'colorea',
  'busca', 'copia', 'observa', 'lee', 'explica', 'piensa', 'relaciona', 'senala', 'calcula', 'resuelve', 'indica', 'rellena',
  'clasifica', 'inventa', 'imagina', 'describe', 'elige', 'tacha', 'cuenta', 'compara', 'decide', 'pon', 'anota', 'identifica',
  // catalán
  'envolta', 'subratlla', 'escriu', 'contesta', 'respon', 'uneix', 'marca', 'completa', 'ordena', 'numera', 'dibuixa', 'pinta',
  'cerca', 'copia', 'observa', 'llegeix', 'explica', 'pensa', 'relaciona', 'assenyala', 'calcula', 'resol', 'indica', 'omple',
  'classifica', 'inventa', 'imagina', 'descriu', 'tria', 'barra', 'compta', 'compara', 'decideix', 'posa', 'anota', 'identifica',
  // inglés
  'circle', 'underline', 'write', 'answer', 'match', 'tick', 'complete', 'order', 'number', 'draw', 'colour', 'color', 'find',
  'copy', 'look', 'read', 'explain', 'think', 'relate', 'point', 'calculate', 'solve', 'say', 'fill', 'classify', 'invent',
  'imagine', 'describe', 'choose', 'cross', 'count', 'compare', 'decide', 'put', 'note', 'identify',
]);

const sinTilde = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * El verbo con el que empieza una consigna, en negrita («**Rodea** en el texto…»): en lectura fácil lo primero que
 * ve el alumnado es qué tiene que hacer. Sin tocar lo que ya lleva negritas ni lo que no empieza por un verbo conocido.
 */
export function negritaDelVerbo(enunciado: string): string {
  const s = enunciado ?? '';
  if (!s || s.includes('**')) return s;
  const m = /^(\s*)([A-Za-zÀ-ÿ·]+)(?=[\s,.:;]|$)/.exec(s);
  if (!m || !VERBOS_CONSIGNA.has(sinTilde(m[2]))) return s;
  return `${m[1]}**${m[2]}**${s.slice(m[0].length)}`;
}
