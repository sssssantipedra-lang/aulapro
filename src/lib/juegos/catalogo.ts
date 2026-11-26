/**
 * El catálogo de los juegos para la clase (26-11-2026). Petición del dueño: una sección de juegos por áreas
 * (Matemáticas, Lengua castellana, Valenciano, Inglés y Ciencias), dos por área, cada uno por los cinco tramos
 * (`lib/juegos/tramos.ts`). Se ve como una galería en Recursos («Juegos para la clase») y desde el botón del mando de
 * Pizarra y herramientas (`components/juegos/GaleriaJuegos.tsx`), sin entrada nueva en el menú.
 *
 * Añadir un juego es añadir una entrada aquí con su `cargar` (el componente, que se carga solo al abrirlo y recibe
 * `{ clase, onClose }`), sus textos en un archivo de `i18n/tanda/` y, si tiene portada dibujada, su caso en
 * `PortadaJuego`. Las áreas con menos de `POR_AREA` juegos enseñan los que faltan como «Próximamente».
 */
import type { ComponentType } from 'react';
import type { ClaseDelJuego, Tramo } from './tramos';

export type AreaJuego = 'matematicas' | 'castellano' | 'valenciano' | 'ingles' | 'ciencias';

export const AREAS: readonly { id: AreaJuego; nombre: string; color: string }[] = [
  { id: 'matematicas', nombre: 'Matemáticas', color: '#ef4444' },
  { id: 'castellano', nombre: 'Lengua castellana', color: '#f59e0b' },
  { id: 'valenciano', nombre: 'Valenciano', color: '#10b981' },
  { id: 'ingles', nombre: 'Inglés', color: '#3b82f6' },
  { id: 'ciencias', nombre: 'Ciencias', color: '#8b5cf6' },
];

/** Cuántos juegos tendrá cada área. */
export const POR_AREA = 2;

export interface PropsJuego { clase?: ClaseDelJuego | null; onClose: () => void }

export interface Juego {
  id: string;
  area: AreaJuego;
  nombre: string;
  descripcion: string;
  tramos: readonly Tramo[];
  /** El color de su tarjeta. */
  color: string;
  /** El componente del juego, que se pide al abrirlo. */
  cargar: () => Promise<{ default: ComponentType<PropsJuego> }>;
}

const TODOS: readonly Tramo[] = ['p12', 'p34', 'p56', 'e12', 'e34'];

export const JUEGOS: readonly Juego[] = [
  {
    id: 'cuerda', area: 'matematicas', nombre: 'Tirar de la cuerda',
    descripcion: 'Dos equipos compiten en la misma pantalla: cada cuenta bien hecha tira de la cuerda hacia su lado.',
    tramos: TODOS, color: '#ef4444',
    cargar: () => import('../../components/juegos/TirarDeLaCuerda'),
  },
  {
    id: 'recta', area: 'matematicas', nombre: 'La recta numérica',
    descripcion: 'Sale un número y cada equipo lleva su marcador hasta donde cree que está. Gana quien queda más cerca.',
    tramos: TODOS, color: '#0ea5e9',
    cargar: () => import('../../components/juegos/LaRectaNumerica'),
  },
];

export const juegoPorId = (id: string): Juego | undefined => JUEGOS.find(j => j.id === id);

/** Una tarjeta de la galería: un juego o un hueco «Próximamente» de su área, con cuántos juegos le faltan. */
export type TarjetaGaleria = { tipo: 'juego'; juego: Juego } | { tipo: 'pronto'; area: AreaJuego; faltan: number };

/**
 * Lo que enseña la galería con el filtro de un área (o de todas): primero los juegos y, detrás, una tarjeta
 * «Próximamente» por cada área a la que le faltan juegos (con todas las áreas, una sola por área, para no llenar la
 * galería de huecos).
 */
export function tarjetasDeGaleria(filtro: AreaJuego | 'todas'): TarjetaGaleria[] {
  const areas = filtro === 'todas' ? AREAS.map(a => a.id) : [filtro];
  const juegos: TarjetaGaleria[] = [];
  const pronto: TarjetaGaleria[] = [];
  for (const a of areas) {
    const suyos = JUEGOS.filter(j => j.area === a);
    for (const j of suyos) juegos.push({ tipo: 'juego', juego: j });
    if (suyos.length < POR_AREA) pronto.push({ tipo: 'pronto', area: a, faltan: POR_AREA - suyos.length });
  }
  return [...juegos, ...pronto];
}
