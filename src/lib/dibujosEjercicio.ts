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
import { nombreIlustracion } from './ilustraciones';

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
