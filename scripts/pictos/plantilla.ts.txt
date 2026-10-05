/**
 * Pictogramas de la agenda visual de PT y AL: una selección de Mulberry
 * Symbols, de Steve Lee, con licencia Creative Commons
 * Reconocimiento-CompartirIgual 4.0 (CC BY-SA 4.0), que permite el uso
 * comercial. Van dentro de la aplicación, en `public/pictos/mulberry/`, sin
 * modificar (solo optimizados con svgo), con su licencia al lado: funcionan
 * sin conexión y no se envía nada. La atribución tiene que verse en
 * Configuración y al pie de cada agenda impresa (`ATRIBUCION_MULBERRY`).
 * ARASAAC, Sclera y Soy Visual no se pueden usar: su licencia no permite el
 * uso comercial. Ver `docs/PTAL.md`.
 *
 * Archivo generado por `scripts/pictos/generar.py` con la lista de
 * `scripts/pictos/lista.py`: no se cambia a mano.
 */
import type { Lang } from '../i18n';

export type CategoriaPicto =
  | /*CATEGORIAS_TIPO*/;

export interface Picto { id: string; categoria: CategoriaPicto; es: string; ca: string; en: string }

export const CATEGORIAS_PICTO: readonly { id: CategoriaPicto; es: string; ca: string; en: string }[] = [
/*CATEGORIAS*/
];

export const PICTOS: readonly Picto[] = [
/*PICTOS*/
];

export { ATRIBUCION_MULBERRY } from './atribucionPictos';

/** Dónde está el dibujo, relativo a la página (la app se carga con `base: './'`). */
export function urlPicto(id: string): string {
  return `${import.meta.env.BASE_URL}pictos/mulberry/${id}.svg`;
}

export function pictoDe(id: string): Picto | undefined {
  return PICTOS.find(p => p.id === id);
}

export function nombrePicto(p: Picto | { es: string; ca: string; en: string }, lang: Lang): string {
  return p[lang];
}

/** Para buscar sin tildes ni mayúsculas, en el idioma de la app y en castellano. */
const plano = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function buscarPictos(texto: string, lang: Lang, categoria?: CategoriaPicto): Picto[] {
  const t = plano(texto.trim());
  return PICTOS.filter(p => (!categoria || p.categoria === categoria)
    && (!t || plano(p[lang]).includes(t) || plano(p.es).includes(t)));
}
