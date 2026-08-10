export function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/**
 * Concuerda en número: `plural(2, 'evaluación', 'evaluaciones')` → "2 evaluaciones".
 * Necesario porque muchos plurales españoles no se forman añadiendo letras
 * (evaluación → evaluaciones pierde la tilde).
 */
export function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Fecha en formato AAAA-MM-DD usando el día **local**, no el UTC.
 *
 * No se puede usar toISOString(): en España va una o dos horas por delante de
 * UTC, así que el 12 de agosto a las 00:00 se convertía en «2026-08-11» y todo
 * lo guardado aparecía un día antes de lo que tocaba.
 */
export function isoDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Convierte AAAA-MM-DD en una fecha local, sin saltos de zona horaria. */
export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function escapeHtml(str: string): string {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export function fileToBase64(file: File): Promise<{ name: string; mimeType: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ name: file.name, mimeType: file.type || 'application/octet-stream', base64: result.split(',')[1] });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const THEMES = {
  sky:     { label: 'Azul cielo', accent: '#38bdf8', accentD: '#0ea5e9', accentL: '#e0f2fe', accentRgb: '14,165,233',  sbBg: '#0c2340' },
  emerald: { label: 'Esmeralda',  accent: '#34d399', accentD: '#10b981', accentL: '#d1fae5', accentRgb: '16,185,129',  sbBg: '#052e1c' },
  violet:  { label: 'Violeta',    accent: '#a78bfa', accentD: '#7c3aed', accentL: '#ede9fe', accentRgb: '124,58,237',  sbBg: '#1e0a3c' },
  rose:    { label: 'Rosa',        accent: '#fb7185', accentD: '#e11d48', accentL: '#ffe4e6', accentRgb: '225,29,72',   sbBg: '#3d0020' },
  amber:   { label: 'Ámbar',       accent: '#fbbf24', accentD: '#d97706', accentL: '#fef3c7', accentRgb: '217,119,6',   sbBg: '#1c1000' },
  slate:   { label: 'Pizarra',    accent: '#94a3b8', accentD: '#475569', accentL: '#f1f5f9', accentRgb: '71,85,105',   sbBg: '#0f172a' },
} as const;

export type ThemeKey = keyof typeof THEMES;

export function applyTheme(key: ThemeKey) {
  const t = THEMES[key] ?? THEMES.sky;
  const r = document.documentElement;
  r.style.setProperty('--accent',     t.accent);
  r.style.setProperty('--accent-d',   t.accentD);
  r.style.setProperty('--accent-l',   t.accentL);
  r.style.setProperty('--accent-rgb', t.accentRgb);
  r.style.setProperty('--sb-bg',      t.sbBg);
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = t.sbBg;
  localStorage.setItem('aulapro_theme', key);
}

export const LEVELS = [
  { value: 1, label: 'Insuficiente', key: 'ins' },
  { value: 2, label: 'Suficiente',   key: 'suf' },
  { value: 3, label: 'Bien',         key: 'bi'  },
  { value: 4, label: 'Excelente',    key: 'exc' },
] as const;

/** Competencias clave de la LOMLOE, con su abreviatura oficial. */
export const LOMLOE_COMPETENCES = [
  { key: 'CCL',   label: 'Comunicación lingüística' },
  { key: 'CP',    label: 'Plurilingüe' },
  { key: 'STEM',  label: 'Matemática, ciencia, tecnología e ingeniería' },
  { key: 'CD',    label: 'Digital' },
  { key: 'CPSAA', label: 'Personal, social y de aprender a aprender' },
  { key: 'CC',    label: 'Ciudadana' },
  { key: 'CE',    label: 'Emprendedora' },
  { key: 'CCEC',  label: 'Conciencia y expresión culturales' },
] as const;

/** Periodos de evaluación del curso escolar español. */
export const PERIODS = ['1ª evaluación', '2ª evaluación', '3ª evaluación', 'Final de curso'] as const;

export const DIANA_SECTORS = [
  { id: 'ds1', label: 'Comunicación',       icon: '💬' },
  { id: 'ds2', label: 'Matemática',          icon: '🔢' },
  { id: 'ds3', label: 'Digital',            icon: '💻' },
  { id: 'ds4', label: 'Social',             icon: '🤝' },
  { id: 'ds5', label: 'Aprender a aprender',icon: '🧠' },
  { id: 'ds6', label: 'Emprendimiento',     icon: '🚀' },
] as const;

/**
 * Qué sector de la Diana Competencial recoge cada competencia clave LOMLOE.
 *
 * Son taxonomías distintas —8 competencias oficiales contra 6 sectores
 * pensados para verse de un vistazo en un hexágono— así que el encaje es
 * aproximado, no una traducción exacta:
 *
 * - CPSAA junta en una sola competencia oficial lo que la Diana separa en dos
 *   sectores (Social y Aprender a aprender), así que alimenta a los dos.
 * - CCEC (conciencia y expresión culturales) es la que peor encaja de las
 *   ocho: se cuenta junto a Comunicación, por el lado de la «expresión».
 *
 * Si no encaja con cómo lo ves, es la aproximación que hay que ajustar aquí,
 * no cada evaluación por separado.
 */
export const LOMLOE_TO_DIANA: Record<string, readonly (typeof DIANA_SECTORS)[number]['id'][]> = {
  CCL:   ['ds1'],
  CP:    ['ds1'],
  STEM:  ['ds2'],
  CD:    ['ds3'],
  CPSAA: ['ds4', 'ds5'],
  CC:    ['ds4'],
  CE:    ['ds6'],
  CCEC:  ['ds1'],
};
