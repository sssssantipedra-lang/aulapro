/**
 * Lo que el código calcula de los ejercicios con dibujos del catálogo, para que
 * la IA no tenga que contar ni escribir: el orden en que se mezclan los dibujos
 * de «clasificar» (siempre el mismo para el mismo ejercicio, así la vista previa,
 * el PDF y la solución coinciden) y la solución de «contar», «etiquetar» y
 * «clasificar», que sale de los propios dibujos y de sus nombres.
 *
 * Solo tipos: no importa nada de `services/`, para que lo usen a la vez el
 * motor de fichas, la maquetación y el editor sin ciclos.
 */
import type { Lang } from '../i18n';
import { ilustracionPorId, nombreIlustracion } from './ilustraciones';
import { esContable, type Hilo } from './hilos';

/** Los tipos de ejercicio que solo existen con dibujos del catálogo: sin hilo conductor no se ofrecen. */
export const TIPOS_CON_DIBUJOS = ['contar', 'etiquetar', 'clasificar'] as const;
export const esTipoConDibujos = (t: string | undefined): boolean => !!t && (TIPOS_CON_DIBUJOS as readonly string[]).includes(t);

interface Dibujo { ilustracion: string; cantidad?: number }
interface Categoria { nombre: string; dibujos: string[] }
interface ConDibujos {
  tipo: string;
  dibujos?: Dibujo[];
  categorias?: Categoria[];
  total?: boolean;
}

/** Un generador de números repetible: el mismo texto da siempre la misma mezcla. */
function semilla(texto: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * Los dibujos de un «clasificar», mezclados entre los grupos y numerados por su
 * posición: nunca salen ya agrupados, que es lo que hay que hacer a mano.
 */
export function bancoClasificar(categorias: Categoria[] | undefined): { id: string; categoria: number }[] {
  const todos = (categorias ?? []).flatMap((c, k) => c.dibujos.map(id => ({ id, categoria: k })));
  if (todos.length < 2) return todos;
  const clave = todos.map(d => d.id).join(',');
  const agrupado = (l: { categoria: number }[]) => l.every((d, i) => i === 0 || d.categoria >= l[i - 1].categoria);
  let mezcla = todos;
  for (let intento = 0; intento < 12; intento++) {
    const rand = semilla(`${clave}#${intento}`);
    mezcla = [...todos];
    for (let i = mezcla.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [mezcla[i], mezcla[j]] = [mezcla[j], mezcla[i]];
    }
    if (!agrupado(mezcla)) break;
  }
  return mezcla;
}

/** Los totales de un «contar»: la cantidad de cada grupo. */
export const cantidadesContar = (ex: ConDibujos): number[] => (ex.dibujos ?? []).map(d => Math.max(1, d.cantidad ?? 1));

/**
 * La solución de los tipos con dibujos, para el profesorado: «vaca: 5; gallina: 4;
 * Total: 9», «1. vaca, 2. gallina», «Domésticos: 1, 3; Salvajes: 2, 4». Vacía en
 * el resto de tipos.
 */
export function solucionDeDibujos(ex: ConDibujos, lang: Lang): string {
  const nombre = (id: string) => nombreIlustracion(id, lang) ?? id;
  if (ex.tipo === 'contar') {
    const grupos = ex.dibujos ?? [];
    const partes = grupos.map(d => `${nombre(d.ilustracion)}: ${Math.max(1, d.cantidad ?? 1)}`);
    if (ex.total && grupos.length > 1) partes.push(`Total: ${cantidadesContar(ex).reduce((s, n) => s + n, 0)}`);
    return partes.join('; ');
  }
  if (ex.tipo === 'etiquetar') return (ex.dibujos ?? []).map((d, i) => `${i + 1}. ${nombre(d.ilustracion)}`).join(', ');
  if (ex.tipo === 'clasificar') {
    const banco = bancoClasificar(ex.categorias);
    return (ex.categorias ?? []).map((c, k) =>
      `${c.nombre}: ${banco.flatMap((d, i) => (d.categoria === k ? [i + 1] : [])).join(', ')}`).join('; ');
  }
  return '';
}

/* ── Ejercicios con dibujos hechos por el código, sin IA ── */

/**
 * Una IA floja no siempre rellena los dibujos de un «etiquetar» (salió con Flash-Lite:
 * «etiquetar» con el banco y sin un solo dibujo, y las palabras en la solución), y en los
 * cursos bajos una ficha sin ejercicios con dibujos no es la que se espera. Estos dos
 * ejercicios los monta el código con los dibujos del hilo: el enunciado es genérico,
 * pero lo que se pide se puede hacer, el recuento es exacto y la solución sale de los dibujos.
 */

const ENUNCIADO_ROTULAR: Record<Lang, (banco: boolean) => string> = {
  es: banco => `Escribe el nombre de cada dibujo en su línea.${banco ? ' Usa las palabras del banco.' : ''}`,
  ca: banco => `Escriu el nom de cada dibuix a la seva línia.${banco ? ' Fes servir les paraules del banc.' : ''}`,
  en: banco => `Write the name of each picture on its line.${banco ? ' Use the words in the box.' : ''}`,
};

const ENUNCIADO_CONTAR: Record<Lang, (total: boolean) => string> = {
  es: total => `Cuenta cuántos hay de cada dibujo y escríbelo en su caja.${total ? ' Después, escribe el total.' : ''}`,
  ca: total => `Compta quants hi ha de cada dibuix i escriu-ho a la seva caixa.${total ? ' Després, escriu el total.' : ''}`,
  en: total => `Count how many of each picture there are and write it in its box.${total ? ' Then write the total.' : ''}`,
};

/** El enunciado de un «etiquetar»: «Escribe el nombre de cada dibujo en su línea.» */
export const enunciadoRotular = (banco: boolean, lang: Lang): string => ENUNCIADO_ROTULAR[lang](banco);

/** Los dibujos del hilo que se pueden rotular: del catálogo, con un nombre corto y sin repetir nombre. */
export function dibujosRotulables(hilo: Hilo, lang: Lang, max: number): string[] {
  const nombres = new Set<string>();
  const out: string[] = [];
  for (const id of hilo.dibujos) {
    const nombre = nombreIlustracion(id, lang);
    if (ilustracionPorId(id)?.fuente !== 'img' || !nombre || nombre.length > 16 || nombres.has(nombre.toLowerCase())) continue;
    nombres.add(nombre.toLowerCase());
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

export interface EjercicioConDibujos {
  tipo: 'contar' | 'etiquetar';
  enunciado: string;
  dibujos: { ilustracion: string; cantidad: number }[];
  banco?: true;
  total?: true;
  solucion: string;
}

/** Un «etiquetar» con los primeros dibujos rotulables del hilo; `undefined` si no hay al menos 3. */
export function etiquetarDelHilo(hilo: Hilo, lang: Lang, opts: { n?: number; banco?: boolean } = {}): EjercicioConDibujos | undefined {
  const ids = dibujosRotulables(hilo, lang, opts.n ?? 4);
  if (ids.length < 3) return undefined;
  const base = { tipo: 'etiquetar' as const, dibujos: ids.map(ilustracion => ({ ilustracion, cantidad: 1 })), ...(opts.banco ? { banco: true as const } : {}) };
  return { ...base, enunciado: enunciadoRotular(!!opts.banco, lang), solucion: solucionDeDibujos(base, lang) };
}

/**
 * Un «contar» con dos dibujos contables del hilo y cantidades distintas (de 2 a `max`),
 * con su caja para el total; `undefined` si el hilo no tiene dos dibujos que se puedan contar.
 */
export function contarDelHilo(hilo: Hilo, lang: Lang, rand: () => number = Math.random, max = 6): EjercicioConDibujos | undefined {
  const nombres = new Set<string>();
  const ids = hilo.dibujos.filter(id => {
    const nombre = nombreIlustracion(id, lang)?.toLowerCase();
    if (ilustracionPorId(id)?.fuente !== 'img' || !esContable(id) || !nombre || nombres.has(nombre)) return false;
    nombres.add(nombre);
    return true;
  }).slice(0, 2);
  if (ids.length < 2) return undefined;
  const a = 2 + Math.floor(rand() * (max - 1));
  let b = 2 + Math.floor(rand() * (max - 1));
  if (b === a) b = a === max ? a - 1 : a + 1;
  const base = { tipo: 'contar' as const, dibujos: ids.map((ilustracion, i) => ({ ilustracion, cantidad: i ? b : a })), total: true as const };
  return { ...base, enunciado: ENUNCIADO_CONTAR[lang](true), solucion: solucionDeDibujos(base, lang) };
}
