/**
 * Fracciones dibujadas por el código: pizzas y tartas de 2 a 12 trozos iguales, con los
 * trozos cogidos en blanco y negro o separados (decisión del dueño, 14-10-2026, tras ver
 * que la pizza del catálogo —un dibujo de IA— no tiene los trozos que dice el ejercicio).
 *
 * Un modelo de imagen no sabe contar: la misma pizza sale con 7 trozos desiguales y uno
 * suelto. Aquí el dibujo sale del dato (`partes`, `tomadas`), así que el ejercicio y la
 * imagen coinciden siempre, y la solución (`solucionFracciones`) se calcula de los mismos
 * números. Es SVG puro: nítido al imprimir, sin pedir nada a ningún sitio.
 *
 * Los trozos van numerados desde las 12 en punto, en el sentido de las agujas del reloj, y
 * los cogidos son los primeros (siempre seguidos, como al servirse una pizza).
 */
import type { Lang } from '../i18n';

export type ObjetoFraccion = 'pizza' | 'tarta';
export const OBJETOS_FRACCION: readonly ObjetoFraccion[] = ['pizza', 'tarta'];

/** Cómo se ven los trozos que se cogen: en blanco y negro (rayados), separados del resto, o las dos cosas. */
export type CogidosFraccion = 'bn' | 'separados' | 'ambos';
export const COGIDOS_FRACCION: readonly CogidosFraccion[] = ['ambos', 'bn', 'separados'];

export interface FraccionDibujo {
  /** Trozos iguales en total (de 2 a 12). */
  partes: number;
  /** Trozos que se cogen (de 0 a `partes`). */
  tomadas: number;
  /** Sin él, una pizza. */
  objeto?: ObjetoFraccion;
}

export const MIN_PARTES = 2;
export const MAX_PARTES = 12;

/** Denominadores cuyo decimal es exacto (1/2, 1/4, 1/5, 1/8, 1/10): los únicos que se piden como decimal. */
export const DENOMINADORES_EXACTOS: readonly number[] = [2, 4, 5, 8, 10];

const TINTA = '#243B5E';
const RAYA = '#3A3A3A';

const PALETA: Record<ObjetoFraccion, { corteza: string; cortezaSombra: string; relleno: string; topping: string; toppingLuz: string; verde: string }> = {
  pizza: { corteza: '#E9A646', cortezaSombra: '#CF8626', relleno: '#FFD95A', topping: '#D6453D', toppingLuz: '#F2796F', verde: '#4CAF50' },
  tarta: { corteza: '#C98B50', cortezaSombra: '#A86D36', relleno: '#F6A9C9', topping: '#D9304F', toppingLuz: '#F5788E', verde: '#FFF6E0' },
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** ¿Una fracción dibujable? Enteros, de 2 a 12 trozos y de 0 a todos cogidos. */
export function fraccionValida(f: { partes?: unknown; tomadas?: unknown }): boolean {
  return Number.isInteger(f.partes) && Number.isInteger(f.tomadas)
    && (f.partes as number) >= MIN_PARTES && (f.partes as number) <= MAX_PARTES
    && (f.tomadas as number) >= 0 && (f.tomadas as number) <= (f.partes as number);
}

export interface OpcionesFraccionSvg {
  /** Cómo se ven los cogidos. Sin él, `ambos`. */
  cogidos?: CogidosFraccion;
  /** Todos los trozos en blanco, solo el contorno: para colorear. */
  vacia?: boolean;
  /** Para que los ids de dentro del SVG (el rayado) no choquen con los de otro dibujo del mismo documento. */
  uid?: string;
  /** Con `ancho` y `alto` (en px) el SVG se puede pasar a PNG; sin ellos, se ajusta al contenedor. */
  tam?: number;
}

/**
 * Una pizza o una tarta de `partes` trozos iguales con `tomadas` cogidos, como SVG. Los
 * trozos salen del dato: ángulos exactos, ni uno más ni uno menos.
 */
export function fraccionSvg(f: FraccionDibujo, o: OpcionesFraccionSvg = {}): string {
  const partes = Math.max(MIN_PARTES, Math.min(MAX_PARTES, Math.round(f.partes)));
  const tomadas = Math.max(0, Math.min(partes, Math.round(f.tomadas)));
  const objeto: ObjetoFraccion = f.objeto === 'tarta' ? 'tarta' : 'pizza';
  const cogidos = o.cogidos ?? 'ambos';
  const uid = (o.uid ?? 'f').replace(/[^A-Za-z0-9_-]/g, '');
  const pal = PALETA[objeto];
  const C = 50, R = 38, RIN = R * 0.8;
  const ang = (2 * Math.PI) / partes;
  const sepWanted = !o.vacia && (cogidos === 'separados' || cogidos === 'ambos');
  const P = (cx: number, cy: number, r: number, t: number) => `${r2(cx + r * Math.cos(t))} ${r2(cy + r * Math.sin(t))}`;

  const trozos: string[] = [];
  for (let i = 0; i < partes; i++) {
    const cogido = i < tomadas && !o.vacia;
    const t1 = -Math.PI / 2 + i * ang;
    const t2 = t1 + ang;
    const tm = (t1 + t2) / 2;
    const d = cogido && sepWanted ? R * 0.24 : 0;
    const cx = C + d * Math.cos(tm), cy = C + d * Math.sin(tm);
    const large = ang > Math.PI ? 1 : 0;
    const cuña = (r: number) => `M${r2(cx)} ${r2(cy)} L${P(cx, cy, r, t1)} A${r} ${r} 0 ${large} 1 ${P(cx, cy, r, t2)} Z`;
    const corona = `M${P(cx, cy, R, t1)} A${R} ${R} 0 ${large} 1 ${P(cx, cy, R, t2)} L${P(cx, cy, RIN, t2)} A${RIN} ${RIN} 0 ${large} 0 ${P(cx, cy, RIN, t1)} Z`;
    const bn = (cogido && (cogidos === 'bn' || cogidos === 'ambos')) || !!o.vacia;
    let g = '';
    if (bn) {
      // Blanco y negro: papel en blanco con el rayado de un dibujo para colorear; los trozos cogidos llevan rayas, los de colorear no
      g += `<path d="${cuña(R)}" fill="#fff"/>`;
      if (!o.vacia) g += `<path d="${cuña(R)}" fill="url(#h-${uid})"/>`;
      g += `<path d="M${P(cx, cy, RIN, t1)} A${RIN} ${RIN} 0 ${large} 1 ${P(cx, cy, RIN, t2)}" fill="none" stroke="${o.vacia ? TINTA : RAYA}" stroke-width=".9"/>`;
      g += `<path d="${cuña(R)}" fill="none" stroke="${o.vacia ? TINTA : '#111'}" stroke-width="1.3" stroke-linejoin="round"/>`;
    } else {
      g += `<path d="${cuña(RIN)}" fill="${pal.relleno}"/><path d="${corona}" fill="${pal.corteza}"/>`;
      g += `<path d="M${P(cx, cy, RIN, t1)} A${RIN} ${RIN} 0 ${large} 1 ${P(cx, cy, RIN, t2)}" fill="none" stroke="${pal.cortezaSombra}" stroke-width=".9"/>`;
      // Cada trozo lleva sus propios ingredientes: así se ve igual con 2 trozos que con 12, y al separarlo
      const ancho = 2 * 0.5 * R * Math.sin(ang / 2);
      const rp = Math.min(R * 0.15, ancho * 0.3);
      const pepe = (r: number, t: number, k: number) => {
        const x = cx + r * Math.cos(t), y = cy + r * Math.sin(t);
        return `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(k)}" fill="${pal.topping}" stroke="${TINTA}" stroke-width=".6"/>` +
          `<circle cx="${r2(x - k * 0.3)}" cy="${r2(y - k * 0.3)}" r="${r2(k * 0.28)}" fill="${pal.toppingLuz}"/>`;
      };
      g += pepe(R * 0.5, tm, rp);
      if (partes <= 6) g += pepe(R * 0.28, tm + ang * 0.22, rp * 0.62);
      if (partes <= 8) {
        const x = cx + R * 0.66 * Math.cos(tm - ang * 0.2), y = cy + R * 0.66 * Math.sin(tm - ang * 0.2);
        g += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(Math.max(0.9, rp * 0.34))}" fill="${pal.verde}" stroke="${TINTA}" stroke-width=".4"/>`;
      }
      g += `<path d="${cuña(R)}" fill="none" stroke="${TINTA}" stroke-width="1.3" stroke-linejoin="round"/>`;
    }
    trozos.push(`<g data-trozo="${i + 1}"${cogido ? ' data-cogido="1"' : ''}>${g}</g>`);
  }
  // Los separados al final: nunca quedan tapados por un vecino
  const orden = [...trozos.slice(tomadas), ...trozos.slice(0, tomadas)];
  const tam = o.tam ? ` width="${o.tam}" height="${o.tam}"` : '';
  const defs = `<defs><pattern id="h-${uid}" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="3" stroke="${RAYA}" stroke-width=".75"/></pattern></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${tam} class="fr-svg" data-partes="${partes}" data-tomadas="${tomadas}" data-objeto="${objeto}" aria-hidden="true">${defs}${orden.join('')}</svg>`;
}

/** El SVG como `data:` (para pasarlo a PNG en el Word, que no admite SVG). */
export const fraccionSvgDato = (f: FraccionDibujo, o: OpcionesFraccionSvg = {}): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fraccionSvg(f, { ...o, tam: o.tam ?? 240 }))}`;

/* ── Los números de una fracción: la solución la calcula el código ── */

const mcd = (a: number, b: number): number => (b ? mcd(b, a % b) : Math.abs(a));

/** Un decimal exacto con coma o con punto según el idioma («0,375»; «0.375» en inglés). */
export function decimalDe(f: FraccionDibujo, lang: Lang): string {
  const v = f.tomadas / f.partes;
  const txt = String(Math.round(v * 1e6) / 1e6);
  return lang === 'en' ? txt : txt.replace('.', ',');
}

/** ¿Su decimal es exacto? (1/3 no lo es: se pide solo con 2, 4, 5, 8 o 10 trozos.) */
export const tieneDecimalExacto = (f: FraccionDibujo): boolean => DENOMINADORES_EXACTOS.includes(f.partes);

export const fraccionTexto = (f: FraccionDibujo): string => `${f.tomadas}/${f.partes}`;

/** La fracción simplificada, si no lo está ya (4/8 → 1/2); `null` si ya es irreducible. */
export function simplificada(f: FraccionDibujo): string | null {
  const g = mcd(f.tomadas, f.partes);
  return g > 1 && f.tomadas > 0 ? `${f.tomadas / g}/${f.partes / g}` : null;
}

/** Las letras con que se llama a cada dibujo del ejercicio: A, B, C… */
export const letraFraccion = (i: number): string => String.fromCharCode(65 + i);

export type ModoFracciones = 'leer' | 'colorear' | 'unir';
export const MODOS_FRACCIONES: readonly ModoFracciones[] = ['leer', 'colorear', 'unir'];

interface ConFracciones {
  fracciones?: FraccionDibujo[];
  modo?: ModoFracciones;
  decimal?: boolean;
}

/** Con qué se une cada dibujo en el modo «unir»: la fracción o, si se pide el decimal, el decimal. */
export const valorUnir = (f: FraccionDibujo, decimal: boolean, lang: Lang): string => (decimal ? decimalDe(f, lang) : fraccionTexto(f));

/** Un generador repetible: el mismo ejercicio se mezcla siempre igual (vista previa, PDF y solución coinciden). */
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
 * El orden en que se ponen los valores a la derecha en el modo «unir»: una mezcla fija del
 * ejercicio que nunca deja ningún valor a la altura de su dibujo (siempre hay algo que unir).
 * Devuelve, para cada posición de la derecha, el índice del dibujo al que corresponde.
 */
export function ordenUnir(fracciones: FraccionDibujo[]): number[] {
  const n = fracciones.length;
  const base = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return base;
  const clave = fracciones.map(f => `${f.partes}/${f.tomadas}`).join(',');
  for (let intento = 0; intento < 30; intento++) {
    const rand = semilla(`${clave}#${intento}`);
    const m = [...base];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [m[i], m[j]] = [m[j], m[i]];
    }
    if (m.every((v, i) => v !== i)) return m;
  }
  // Un desplazamiento: ninguno se queda en su sitio
  return base.map(i => (i + 1) % n);
}

/**
 * La solución de un ejercicio de fracciones, para el profesorado: «A: 3/8 = 0,375; B: 1/2 = 0,5»,
 * «A con 3/8; B con 1/2», «A: 3 de 8 trozos». Vacía si el ejercicio no lleva fracciones.
 */
export function solucionFracciones(ex: ConFracciones, lang: Lang): string {
  const fr = ex.fracciones ?? [];
  if (!fr.length) return '';
  const modo = ex.modo ?? 'leer';
  const decimal = !!ex.decimal && fr.every(tieneDecimalExacto);
  if (modo === 'colorear') {
    const de = lang === 'en' ? 'of' : 'de';
    const trozos = lang === 'en' ? 'slices' : lang === 'ca' ? 'trossos' : 'trozos';
    return fr.map((f, i) => `${letraFraccion(i)}: ${f.tomadas} ${de} ${f.partes} ${trozos}`).join('; ');
  }
  if (modo === 'unir') {
    const orden = ordenUnir(fr);
    const con = lang === 'en' ? 'with' : lang === 'ca' ? 'amb' : 'con';
    return fr.map((f, i) => `${letraFraccion(i)} ${con} ${orden.indexOf(i) + 1} (${valorUnir(f, decimal, lang)})`).join('; ');
  }
  return fr.map((f, i) => `${letraFraccion(i)}: ${fraccionTexto(f)}${decimal ? ` = ${decimalDe(f, lang)}` : ''}`).join('; ');
}

/* ── Un ejercicio de fracciones hecho por el código, sin IA ── */

const ENUNCIADO_LEER: Record<Lang, (decimal: boolean) => string> = {
  es: d => `Los trozos en gris y separados son los que se han comido. Escribe la fracción de cada pizza${d ? ' y su decimal' : ''}.`,
  ca: d => `Els trossos en gris i separats són els que s'han menjat. Escriu la fracció de cada pizza${d ? ' i el seu decimal' : ''}.`,
  en: d => `The grey slices set apart are the ones that were eaten. Write the fraction of each pizza${d ? ' and its decimal' : ''}.`,
};

const ENUNCIADO_UNIR: Record<Lang, (decimal: boolean) => string> = {
  es: d => `Une cada pizza con ${d ? 'su decimal' : 'su fracción'}. Los trozos en gris y separados son los que se han comido.`,
  ca: d => `Uneix cada pizza amb ${d ? 'el seu decimal' : 'la seva fracció'}. Els trossos en gris i separats són els que s'han menjat.`,
  en: d => `Match each pizza with ${d ? 'its decimal' : 'its fraction'}. The grey slices set apart are the ones that were eaten.`,
};

const ENUNCIADO_COLOREAR: Record<Lang, string> = {
  es: 'Colorea en cada pizza los trozos que dice su fracción.',
  ca: 'Pinta a cada pizza els trossos que diu la seva fracció.',
  en: 'Colour in each pizza the slices its fraction says.',
};

export interface EjercicioFracciones {
  tipo: 'fracciones';
  enunciado: string;
  fracciones: FraccionDibujo[];
  modo: ModoFracciones;
  decimal?: true;
  solucion: string;
}

/**
 * Un ejercicio «fracciones» con pizzas de distinto número de trozos y distintas fracciones (de 2 a 10 trozos;
 * con decimal, solo 2, 4, 5, 8 y 10, que lo tienen exacto). Para cuando la IA no las pone: el dibujo y la
 * solución salen de los mismos números, así que siempre coinciden. En «unir» ninguna pareja vale lo mismo.
 */
export function fraccionesParaEjercicio(
  modo: ModoFracciones, lang: Lang, opts: { decimal?: boolean; rand?: () => number; n?: number } = {},
): EjercicioFracciones {
  const rand = opts.rand ?? Math.random;
  const decimal = !!opts.decimal && modo !== 'colorear';
  const pool = decimal ? [...DENOMINADORES_EXACTOS] : [2, 3, 4, 5, 6, 7, 8, 9, 10];
  const n = Math.min(opts.n ?? (modo === 'colorear' ? 3 : 4), pool.length);
  let fracciones: FraccionDibujo[] = [];
  for (let intento = 0; intento < 40; intento++) {
    const orden = [...pool];
    for (let i = orden.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [orden[i], orden[j]] = [orden[j], orden[i]];
    }
    fracciones = orden.slice(0, n).map(partes => ({ partes, tomadas: 1 + Math.floor(rand() * (partes - 1)) }));
    const valores = fracciones.map(f => f.tomadas / f.partes);
    if (new Set(valores.map(v => Math.round(v * 1e6))).size === valores.length) break;
  }
  const base = { fracciones, modo, ...(decimal ? { decimal: true as const } : {}) };
  const enunciado = modo === 'unir' ? ENUNCIADO_UNIR[lang](decimal) : modo === 'colorear' ? ENUNCIADO_COLOREAR[lang] : ENUNCIADO_LEER[lang](decimal);
  return { tipo: 'fracciones', enunciado, ...base, solucion: solucionFracciones(base, lang) };
}
