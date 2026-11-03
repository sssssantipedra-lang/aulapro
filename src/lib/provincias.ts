/**
 * Las provincias de una comunidad, cuando algo depende de ellas. Hoy solo
 * Andalucía: su calendario escolar lo aprueba cada delegación territorial
 * (Decreto 301/2009), así que el perfil guarda también la provincia
 * (`TeacherProfile.provincia`, ver «Calendario escolar» en `docs/COMUNIDADES.md`).
 */
import type { ComunidadId, IdiomaApp } from './curriculum/comunidades';

export type ProvinciaId = 'almeria' | 'cadiz' | 'cordoba' | 'granada' | 'huelva' | 'jaen' | 'malaga' | 'sevilla';

export interface Provincia {
  id: ProvinciaId;
  nombre: Record<IdiomaApp, string>;
}

const ANDALUCIA: Provincia[] = [
  { id: 'almeria', nombre: { es: 'Almería', ca: 'Almeria', en: 'Almería' } },
  { id: 'cadiz', nombre: { es: 'Cádiz', ca: 'Cadis', en: 'Cádiz' } },
  { id: 'cordoba', nombre: { es: 'Córdoba', ca: 'Còrdova', en: 'Córdoba' } },
  { id: 'granada', nombre: { es: 'Granada', ca: 'Granada', en: 'Granada' } },
  { id: 'huelva', nombre: { es: 'Huelva', ca: 'Huelva', en: 'Huelva' } },
  { id: 'jaen', nombre: { es: 'Jaén', ca: 'Jaén', en: 'Jaén' } },
  { id: 'malaga', nombre: { es: 'Málaga', ca: 'Màlaga', en: 'Málaga' } },
  { id: 'sevilla', nombre: { es: 'Sevilla', ca: 'Sevilla', en: 'Seville' } },
];

const POR_COMUNIDAD: Partial<Record<ComunidadId, Provincia[]>> = { andalucia: ANDALUCIA };

/** Las provincias que la app distingue en esa comunidad; vacía si no hace falta elegir ninguna. */
export function provinciasDe(comunidad: ComunidadId | undefined | null): Provincia[] {
  return (comunidad && POR_COMUNIDAD[comunidad]) || [];
}

/** La provincia guardada en el perfil, si es una de su comunidad; si no, `null` (una copia editada a mano puede traer cualquier cosa). */
export function provinciaDePerfil(comunidad: ComunidadId | undefined | null, valor: unknown): ProvinciaId | null {
  return provinciasDe(comunidad).some(p => p.id === valor) ? (valor as ProvinciaId) : null;
}

export function nombreProvincia(id: ProvinciaId, idioma: IdiomaApp): string {
  return ANDALUCIA.find(p => p.id === id)?.nombre[idioma] ?? id;
}

/** Todas, para comprobar los datos del calendario. */
export const PROVINCIAS_ANDALUCIA: readonly ProvinciaId[] = ANDALUCIA.map(p => p.id);
