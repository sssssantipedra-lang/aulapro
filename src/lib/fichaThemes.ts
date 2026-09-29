/**
 * Temas visuales de las fichas: la «piel» con la que se imprime una ficha.
 *
 * Cada tema tiene paleta, tipografía, marco, un personaje y unos adornos. Los
 * dibujos son emoji: la API gratuita de Gemini no genera imágenes, y los emoji
 * ya vienen con el sistema (Windows, Mac), se imprimen en color y no pesan
 * nada. El tema se guarda en la ficha y se cambia con un clic sin volver a
 * generar nada: solo cambia cómo se pinta.
 *
 * «Clásica» es el aspecto de siempre, sin historia; las fichas guardadas
 * antes de que hubiera temas se ven así.
 */

export type FichaThemeId =
  | 'clasico' | 'espacio' | 'selva' | 'detectives' | 'oceano' | 'superheroes'
  | 'deportes' | 'dinosaurios' | 'piratas' | 'magia' | 'cocina';

export interface FichaTheme {
  id: FichaThemeId;
  nombre: string;
  /** El mundo de la historia, para el prompt de la IA. */
  ambiente: string;
  /** Personaje por defecto (si la IA no da uno). */
  personaje: string;
  /** Adornos que se reparten por la cabecera y el cierre. */
  adornos: string[];
  /** Emoji de reserva para cada misión, en orden. */
  iconos: string[];
  /** Cómo se llama cada bloque: «Misión 1», «Pista 1»… */
  paso: string;
  /** Hex sin «#». */
  color: string;
  oscuro: string;
  claro: string;
  papel: string;
  /** Colores de las cabeceras de misión, en rotación. */
  bloques: { bg: string; light: string }[];
  fuente: string;
  fuenteTitulo: string;
  borde: 'solid' | 'dashed' | 'double' | 'dotted';
  radio: number;
}

const ROUNDED = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
const COMIC = '"Comic Sans MS", "Chalkboard SE", "Comic Neue", "Trebuchet MS", sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const TYPE = '"Courier New", Courier, monospace';
const SYSTEM = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const FICHA_THEMES: FichaTheme[] = [
  {
    id: 'clasico', nombre: 'Clásica', ambiente: '',
    personaje: '📘', adornos: [], iconos: ['✏️', '✏️', '✏️', '✏️'], paso: 'Actividad',
    color: '0369A1', oscuro: '0C4A6E', claro: 'E0F2FE', papel: 'FFFFFF',
    bloques: [{ bg: '0369A1', light: 'E0F2FE' }, { bg: '15803D', light: 'DCFCE7' }, { bg: 'B45309', light: 'FEF3C7' }, { bg: '6D28D9', light: 'EDE9FE' }],
    fuente: SYSTEM, fuenteTitulo: SYSTEM, borde: 'solid', radio: 8,
  },
  {
    id: 'espacio', nombre: 'Misión espacial',
    ambiente: 'una misión espacial: una nave, una tripulación y planetas por explorar',
    personaje: '👩‍🚀', adornos: ['🚀', '🪐', '⭐', '🌙', '✨'], iconos: ['🚀', '🪐', '🛰️', '🌟', '☄️'], paso: 'Misión',
    color: '4338CA', oscuro: '1E1B4B', claro: 'E0E7FF', papel: 'F8F9FF',
    bloques: [{ bg: '4338CA', light: 'E0E7FF' }, { bg: '7C3AED', light: 'EDE9FE' }, { bg: '0E7490', light: 'CFFAFE' }],
    fuente: ROUNDED, fuenteTitulo: ROUNDED, borde: 'solid', radio: 14,
  },
  {
    id: 'selva', nombre: 'Expedición a la selva',
    ambiente: 'una expedición por la selva en busca de animales y un templo perdido',
    personaje: '🦁', adornos: ['🌿', '🦜', '🐒', '🌴', '🦋'], iconos: ['🌿', '🐒', '🦜', '🐍', '🗿'], paso: 'Etapa',
    color: '15803D', oscuro: '14532D', claro: 'DCFCE7', papel: 'FBFEF8',
    bloques: [{ bg: '15803D', light: 'DCFCE7' }, { bg: '65A30D', light: 'ECFCCB' }, { bg: 'B45309', light: 'FEF3C7' }],
    fuente: ROUNDED, fuenteTitulo: ROUNDED, borde: 'dashed', radio: 16,
  },
  {
    id: 'detectives', nombre: 'Caso de detectives',
    ambiente: 'un caso misterioso que resolver como detectives, reuniendo pistas',
    personaje: '🕵️', adornos: ['🔍', '🗝️', '🧩', '👣', '📜'], iconos: ['🔍', '🧩', '🗝️', '👣', '📁'], paso: 'Pista',
    color: '92400E', oscuro: '451A03', claro: 'FEF3C7', papel: 'FFFDF7',
    bloques: [{ bg: '92400E', light: 'FEF3C7' }, { bg: '44403C', light: 'F5F5F4' }, { bg: 'B91C1C', light: 'FEE2E2' }],
    fuente: SERIF, fuenteTitulo: TYPE, borde: 'double', radio: 4,
  },
  {
    id: 'oceano', nombre: 'Aventura submarina',
    ambiente: 'una aventura bajo el mar en un submarino, entre peces y arrecifes',
    personaje: '🐙', adornos: ['🐠', '🐚', '🫧', '🌊', '🐳'], iconos: ['🐠', '🐢', '🦀', '🐳', '🪸'], paso: 'Inmersión',
    color: '0E7490', oscuro: '164E63', claro: 'CFFAFE', papel: 'F6FDFF',
    bloques: [{ bg: '0E7490', light: 'CFFAFE' }, { bg: '0369A1', light: 'E0F2FE' }, { bg: '0F766E', light: 'CCFBF1' }],
    fuente: ROUNDED, fuenteTitulo: ROUNDED, borde: 'solid', radio: 20,
  },
  {
    id: 'superheroes', nombre: 'Superhéroes',
    ambiente: 'un equipo de superhéroes que tiene que salvar la ciudad usando sus poderes',
    personaje: '🦸', adornos: ['💥', '⚡', '⭐', '🏙️', '💫'], iconos: ['⚡', '💥', '🛡️', '🦸', '⭐'], paso: 'Reto',
    color: 'DC2626', oscuro: '7F1D1D', claro: 'FEF9C3', papel: 'FFFFFF',
    bloques: [{ bg: 'DC2626', light: 'FEE2E2' }, { bg: '2563EB', light: 'DBEAFE' }, { bg: 'CA8A04', light: 'FEF9C3' }],
    fuente: COMIC, fuenteTitulo: COMIC, borde: 'solid', radio: 6,
  },
  {
    id: 'deportes', nombre: 'La gran final',
    ambiente: 'un campeonato deportivo en el que el equipo se juega la gran final',
    personaje: '🏃', adornos: ['🏆', '⚽', '🏀', '🥇', '🎽'], iconos: ['⚽', '🏀', '🎾', '🏐', '🏆'], paso: 'Prueba',
    color: 'EA580C', oscuro: '7C2D12', claro: 'FFEDD5', papel: 'FFFCF8',
    bloques: [{ bg: 'EA580C', light: 'FFEDD5' }, { bg: '16A34A', light: 'DCFCE7' }, { bg: '1D4ED8', light: 'DBEAFE' }],
    fuente: ROUNDED, fuenteTitulo: ROUNDED, borde: 'solid', radio: 10,
  },
  {
    id: 'dinosaurios', nombre: 'Viaje al Jurásico',
    ambiente: 'un viaje en el tiempo a la época de los dinosaurios',
    personaje: '🦕', adornos: ['🦖', '🌋', '🥚', '🌿', '🦴'], iconos: ['🦖', '🥚', '🌋', '🦴', '🦕'], paso: 'Expedición',
    color: '4D7C0F', oscuro: '365314', claro: 'ECFCCB', papel: 'FCFDF7',
    bloques: [{ bg: '4D7C0F', light: 'ECFCCB' }, { bg: 'C2410C', light: 'FFEDD5' }, { bg: '78716C', light: 'F5F5F4' }],
    fuente: ROUNDED, fuenteTitulo: ROUNDED, borde: 'dashed', radio: 18,
  },
  {
    id: 'piratas', nombre: 'El tesoro pirata',
    ambiente: 'una tripulación pirata que sigue un mapa para encontrar un tesoro',
    personaje: '🏴‍☠️', adornos: ['🗺️', '⚓', '🦜', '💰', '🧭'], iconos: ['🗺️', '🧭', '⚓', '🦜', '💰'], paso: 'Parada',
    color: '1E3A8A', oscuro: '172554', claro: 'FEF3C7', papel: 'FFFBF0',
    bloques: [{ bg: '1E3A8A', light: 'DBEAFE' }, { bg: 'A16207', light: 'FEF3C7' }, { bg: '9F1239', light: 'FFE4E6' }],
    fuente: SERIF, fuenteTitulo: SERIF, borde: 'double', radio: 6,
  },
  {
    id: 'magia', nombre: 'Escuela de magia',
    ambiente: 'una escuela de magia en la que cada ejercicio es un hechizo que aprender',
    personaje: '🧙', adornos: ['🔮', '✨', '📜', '🌟', '🪄'], iconos: ['🪄', '🔮', '📜', '🧪', '🌟'], paso: 'Hechizo',
    color: '7E22CE', oscuro: '3B0764', claro: 'F3E8FF', papel: 'FDFAFF',
    bloques: [{ bg: '7E22CE', light: 'F3E8FF' }, { bg: 'BE185D', light: 'FCE7F3' }, { bg: '4338CA', light: 'E0E7FF' }],
    fuente: SERIF, fuenteTitulo: SERIF, borde: 'dotted', radio: 14,
  },
  {
    id: 'cocina', nombre: 'Concurso de cocina',
    ambiente: 'un concurso de cocina en el que cada prueba es una receta',
    personaje: '🧑‍🍳', adornos: ['🍰', '🥕', '🍳', '🧁', '🍓'], iconos: ['🥕', '🍳', '🧁', '🍕', '🍰'], paso: 'Receta',
    color: 'E11D48', oscuro: '881337', claro: 'FFE4E6', papel: 'FFFBFB',
    bloques: [{ bg: 'E11D48', light: 'FFE4E6' }, { bg: 'EA580C', light: 'FFEDD5' }, { bg: '0D9488', light: 'CCFBF1' }],
    fuente: ROUNDED, fuenteTitulo: COMIC, borde: 'dashed', radio: 16,
  },
];

export const STORY_THEME_IDS = FICHA_THEMES.filter(t => t.id !== 'clasico').map(t => t.id);

export function fichaTheme(id: string | undefined): FichaTheme {
  return FICHA_THEMES.find(t => t.id === id) ?? FICHA_THEMES[0];
}

const PICTO = /\p{Extended_Pictographic}/u;

/**
 * El emoji que da la IA puede venir con texto pegado o no ser un emoji: se
 * queda con el primer grafema si es un pictograma y, si no, usa el de reserva.
 */
export function cleanEmoji(raw: string | undefined, fallback: string): string {
  const s = (raw ?? '').trim();
  if (!s) return fallback;
  const first = typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)][0]?.segment ?? ''
    : [...s][0] ?? '';
  return PICTO.test(first) ? first : fallback;
}
