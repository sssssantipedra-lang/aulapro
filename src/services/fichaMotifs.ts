/**
 * Motivo decorativo de cabecera de una ficha, elegido por palabras clave del
 * tema/área — sin IA. La generación de imagen no está en el nivel gratuito
 * de la API de Google: todos sus modelos de imagen exigen facturación
 * activada (https://ai.google.dev/gemini-api/docs/pricing), tanto el que se
 * probó primero como el que se probó después. En vez de depender de eso, o
 * de pedirle al docente que dé de alta una tarjeta solo para un detalle
 * decorativo, la ficha lleva un motivo propio por área: siempre disponible,
 * gratis, al instante y sin ningún punto de fallo.
 */

import {
  svgCalculator, svgBookOpen, svgLanguages, svgFlask, svgLandmark,
  svgMusic, svgDumbbell, svgPalette, svgScale, svgSparkles,
} from './fichaIcons';

export type FichaMotifKey =
  | 'matematicas' | 'lengua' | 'ingles' | 'cienciasNaturales' | 'cienciasSociales'
  | 'musica' | 'educacionFisica' | 'plastica' | 'valores' | 'general';

export const MOTIF_KEYS: FichaMotifKey[] = [
  'matematicas', 'lengua', 'ingles', 'cienciasNaturales', 'cienciasSociales',
  'musica', 'educacionFisica', 'plastica', 'valores', 'general',
];

/** Fondo suave y color de acento, en hex sin "#", por motivo. */
export const MOTIF_COLORS: Record<FichaMotifKey, { bg: string; accent: string }> = {
  matematicas: { bg: 'DBEAFE', accent: '1D4ED8' },
  lengua: { bg: 'FCE7F3', accent: 'BE185D' },
  ingles: { bg: 'E0E7FF', accent: '4338CA' },
  cienciasNaturales: { bg: 'DCFCE7', accent: '15803D' },
  cienciasSociales: { bg: 'FEF3C7', accent: 'B45309' },
  musica: { bg: 'F3E8FF', accent: 'A21CAF' },
  educacionFisica: { bg: 'FFEDD5', accent: 'C2410C' },
  plastica: { bg: 'EDE9FE', accent: '6D28D9' },
  valores: { bg: 'F1F5F9', accent: '475569' },
  general: { bg: 'E0F2FE', accent: '0369A1' },
};

/** Icono (markup SVG crudo, para exportFicha.ts) por motivo. */
export const MOTIF_ICON: Record<FichaMotifKey, (color: string, size?: number) => string> = {
  matematicas: svgCalculator,
  lengua: svgBookOpen,
  ingles: svgLanguages,
  cienciasNaturales: svgFlask,
  cienciasSociales: svgLandmark,
  musica: svgMusic,
  educacionFisica: svgDumbbell,
  plastica: svgPalette,
  valores: svgScale,
  general: svgSparkles,
};

/**
 * Orden deliberado, de más a menos específico: así "Lengua Extranjera:
 * Inglés" cae en "ingles" y no en "lengua" (que también encajaría por la
 * palabra "lengua"), y "Educación Física" no se confunde con una ficha de
 * "Ciencias Naturales: Física" (ninguna de las dos usa la palabra suelta
 * "física" como disparador, precisamente para no mezclarlas). "general" no
 * tiene lista: es la red de seguridad cuando no coincide nada.
 */
const KEYWORDS: [FichaMotifKey, string[]][] = [
  ['ingles', ['ingles', 'frances', 'lengua extranjera', 'idioma', 'english', 'french']],
  ['educacionFisica', ['educacion fisica', 'ed. fisica', 'ed fisica', 'deporte', 'gimnasia', 'motricidad', 'physical education']],
  ['cienciasSociales', ['ciencias sociales', 'historia', 'geografia', 'social studies', 'history']],
  ['cienciasNaturales', ['ciencias naturales', 'biolog', 'quimic', 'naturales', 'science']],
  ['musica', ['musica', 'music']],
  ['plastica', ['plastica', 'dibujo', 'arte', 'drawing']],
  ['valores', ['valores', 'religion', 'etica', 'moral', 'values', 'ethics']],
  ['matematicas', ['matematic', 'mates', 'algebra', 'geometr', 'aritmetic', 'numeros', 'fraccion', 'potencia', 'ecuacion', 'math']],
  ['lengua', ['lengua', 'literatura', 'gramatica', 'ortografia', 'lectura', 'escritura', 'language']],
];

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Elige el motivo según el tema y el área de la ficha. Nunca falla: sin coincidencia, "general". */
export function pickMotifKey(tema: string, area: string): FichaMotifKey {
  const text = normalize(`${tema} ${area}`);
  for (const [key, words] of KEYWORDS) {
    if (words.some(w => text.includes(w))) return key;
  }
  return 'general';
}
