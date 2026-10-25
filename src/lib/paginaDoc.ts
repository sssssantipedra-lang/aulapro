/**
 * La página de un documento tal como sale en el PDF: tamaño, orientación y márgenes.
 *
 * El motor de impresión (Electron y Android) hace caso al `@page` del propio HTML y, si no lo trae, usa un
 * A4 con los márgenes de `electron/main.cjs` (0,55 pulgadas a los lados, 0,5 arriba y abajo). Se comprobó
 * con Chromium: con un `@page { size; margin }` mandan el tamaño y el margen del documento, no los del encargo.
 * La vista previa lee lo mismo para pintar las hojas como se imprimen.
 */
import type { AreaPagina } from './paginacion';

export interface PaginaDoc {
  /** La hoja entera, en px de CSS. */
  ancho: number;
  alto: number;
  /** Márgenes, en px de CSS. */
  margen: { arriba: number; derecha: number; abajo: number; izquierda: number };
}

const PX_POR_MM = 96 / 25.4;
const A4 = { ancho: 210 * PX_POR_MM, alto: 297 * PX_POR_MM };
const MARGEN_PREDETERMINADO = { arriba: 0.5 * 96, derecha: 0.55 * 96, abajo: 0.5 * 96, izquierda: 0.55 * 96 };

function aPx(valor: string): number | null {
  const m = /^(-?\d*\.?\d+)(mm|cm|in|px|pt)?$/.exec(valor.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case 'mm': return n * PX_POR_MM;
    case 'cm': return n * 10 * PX_POR_MM;
    case 'in': return n * 96;
    case 'pt': return n * 96 / 72;
    default: return n;
  }
}

/** Los márgenes de la propiedad `margin` (1 a 4 valores); `null` si no se entiende. */
function margenes(valor: string): PaginaDoc['margen'] | null {
  const v = valor.trim().split(/\s+/).map(aPx);
  if (v.length === 0 || v.length > 4 || v.some(x => x === null)) return null;
  const [a, b = a, c = a, d = b] = v as number[];
  return { arriba: a, derecha: b, abajo: c, izquierda: d };
}

/** El `@page` del documento (también dentro de `@media print`); el último que aparece manda. */
function bloquesPage(html: string): string[] {
  return [...html.matchAll(/@page\s*(?::[a-z]+\s*)?\{([^}]*)\}/gi)].map(m => m[1]);
}

/**
 * La página con la que se imprime ese HTML. `apaisado` es lo que pide quien guarda el PDF cuando el
 * documento no dice nada de la orientación.
 */
export function leerPagina(html: string, apaisado = false): PaginaDoc {
  let horizontal = apaisado;
  let margen = { ...MARGEN_PREDETERMINADO };
  for (const cuerpo of bloquesPage(html)) {
    const size = /size\s*:\s*([^;}]+)/i.exec(cuerpo)?.[1].toLowerCase();
    if (size) {
      if (/landscape/.test(size)) horizontal = true;
      else if (/portrait/.test(size)) horizontal = false;
    }
    const m = /(?:^|[;\s])margin\s*:\s*([^;}]+)/i.exec(cuerpo)?.[1];
    const parsed = m ? margenes(m) : null;
    if (parsed) margen = parsed;
  }
  return horizontal
    ? { ancho: A4.alto, alto: A4.ancho, margen }
    : { ancho: A4.ancho, alto: A4.alto, margen };
}

/** El área donde cae el contenido: la hoja menos los márgenes. */
export function areaDe(p: PaginaDoc): AreaPagina {
  return { ancho: p.ancho - p.margen.izquierda - p.margen.derecha, alto: p.alto - p.margen.arriba - p.margen.abajo };
}

/**
 * El HTML tal como lo ve la impresora, para pintarlo en pantalla: lo que va dentro de `@media print` vale
 * siempre, lo que es solo de pantalla, nunca, y los saltos de página forzados pasan a saltos de columna.
 */
export function comoEnImpresion(html: string): string {
  return html
    .replace(/@media\s+print/gi, '@media all')
    .replace(/@media\s+screen/gi, '@media not all')
    // Un salto de página forzado es, en las columnas con las que se reparte la vista, un salto de columna
    .replace(/(?:page-)?break-(before|after)\s*:\s*(?:page|always|left|right)/gi, 'break-$1: column');
}
