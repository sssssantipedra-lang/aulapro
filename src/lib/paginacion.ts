/**
 * Cuántas páginas ocupa una hoja y cuánto espacio libre deja al pie de cada una, medido en el navegador.
 *
 * No hace falta imprimir para saberlo: el navegador parte el contenido en páginas con las mismas reglas
 * (`break-inside: avoid`, `break-after: avoid`…) que en las columnas de CSS. El documento se pone en una
 * sola fila de columnas del tamaño del área imprimible, una por página, y cada columna es una página: se
 * cuentan y se mide hasta dónde llega lo que hay en cada una. Así se calcula igual en la app de escritorio,
 * en Android y en la vista previa, sin pasar por Electron.
 *
 * Sin dependencias de la aplicación a propósito (se carga suelto en las pruebas con un navegador de verdad).
 */
import type { MedidaPaginas } from './densidad';

export interface AreaPagina {
  /** Ancho y alto del área imprimible, en px de CSS. */
  ancho: number;
  alto: number;
}

/**
 * El área imprimible de una ficha: un A4 vertical con los márgenes que pide `electron/main.cjs`
 * (0,5 pulgadas arriba y abajo y 0,55 a los lados). Si cambian allí, cambian aquí.
 */
export const AREA_FICHA: AreaPagina = {
  ancho: (210 / 25.4 - 2 * 0.55) * 96,
  alto: (297 / 25.4 - 2 * 0.5) * 96,
};

/**
 * Cuánto se recorta el alto de cada página al medir, en px. Una hoja que cabe justo (3 px de sobra) puede
 * pasar a la página siguiente al imprimir, porque el motor de impresión redondea distinto: con un margen de
 * seguridad, lo medido coincide con las páginas del PDF en las 108 hojas de prueba.
 */
export const SEGURIDAD_PX = 8;

const OMITIR = new Set(['HEAD', 'SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'NOSCRIPT']);

/**
 * Mide el documento ya cargado: lo pone en columnas del tamaño de la página y devuelve el número de
 * columnas usadas y el hueco al pie de cada una. Cambia el estilo del documento (lo deja en columnas): pásale
 * uno que no se vaya a seguir usando.
 */
export function estiloColumnas(area: AreaPagina, seguridad: number = SEGURIDAD_PX): string {
  return `html { margin: 0; padding: 0; background: #fff; }` +
    `body { margin: 0 !important; padding: 0 !important; width: ${area.ancho}px; height: ${area.alto - seguridad}px; ` +
    `column-width: ${area.ancho}px; column-gap: 0; column-fill: auto; overflow: visible; }`;
}

export function medirPaginas(doc: Document, area: AreaPagina = AREA_FICHA, seguridad: number = SEGURIDAD_PX): MedidaPaginas {
  const altoUtil = area.alto - seguridad;
  const estilo = doc.createElement('style');
  estilo.textContent = estiloColumnas(area, seguridad);
  doc.head.appendChild(estilo);

  const base = doc.documentElement.getBoundingClientRect();
  // Hasta dónde llega lo que hay en cada columna: solo las piezas sin hijos (texto, cajas vacías, dibujos).
  // Un contenedor fragmentado puede llegar hasta el fondo de la columna aunque su contenido acabe antes.
  const fondo: number[] = [];
  const todos = doc.body.querySelectorAll('*');
  for (const el of Array.from(todos)) {
    if (OMITIR.has(el.tagName)) continue;
    // Un dibujo vectorial es una sola pieza: no se mide lo de dentro
    const svg = el.closest('svg');
    if (svg && svg !== el) continue;
    if (el.tagName.toLowerCase() !== 'svg' && el.children.length > 0) continue;
    for (const r of Array.from(el.getClientRects())) {
      if (r.width <= 0 || r.height <= 0) continue;
      const col = Math.max(0, Math.floor((r.left - base.left + 0.5) / area.ancho));
      const abajo = r.bottom - base.top;
      if (!(col in fondo) || abajo > fondo[col]) fondo[col] = abajo;
    }
  }
  const usadas = fondo.length ? fondo.length : 1;
  const huecos = Array.from({ length: usadas }, (_, c) => Math.max(0, Math.round(altoUtil - (fondo[c] ?? 0))));
  estilo.remove();
  return { paginas: usadas, huecos };
}
