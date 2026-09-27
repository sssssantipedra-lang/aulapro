/**
 * Dibujo de una mesa cooperativa: varios pupitres trapezoidales en abanico
 * compartiendo un vértice, como las mesas de la imagen que trajo el docente
 * (piezas curvas alrededor de un punto central, una silla por pieza).
 *
 * Igual que las figuras geométricas de las fichas (`geometryFigures.ts`): un
 * dibujo esquemático construido por trigonometría, no una foto realista. Se
 * genera como una cadena SVG para poder usar el mismo dibujo tanto dentro de
 * la aplicación (con `dangerouslySetInnerHTML`, sin riesgo: el contenido lo
 * genera este archivo, no lo escribe nadie más) como en el póster exportado
 * a PDF, sin duplicar la geometría en dos sitios.
 */

/** Un asiento de la mesa, ya resuelto: quién se sienta y con qué rol esta semana. */
export interface SeatVisual {
  studentName: string | null;
  roleName: string | null;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Punto a radio `r` y ángulo `deg` (0° = arriba, negativo = izquierda). */
function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = toRad(deg);
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Recorta a un ancho aproximado partiendo por palabras, para que no desborde el pupitre. */
function envolver(texto: string, maxChars: number): string[] {
  const palabras = texto.split(/\s+/);
  const lineas: string[] = [];
  let actual = '';
  for (const p of palabras) {
    const candidata = actual ? `${actual} ${p}` : p;
    if (candidata.length > maxChars && actual) { lineas.push(actual); actual = p; }
    else actual = candidata;
  }
  if (actual) lineas.push(actual);
  return lineas.slice(0, 2);
}

const WIDTH = 260;
const HEIGHT = 200;
const CX = WIDTH / 2;
const CY = HEIGHT - 6;
const R1 = 20;   // radio interior: el vértice compartido de los pupitres
const R2 = 150;  // radio exterior: el borde de la mesa, junto a la silla
const ARCO_TOTAL = 156; // grados que ocupa el abanico completo
const HUECO = 5;        // grados de separación entre pupitres contiguos

/**
 * SVG de una mesa completa (todos sus pupitres en abanico) con quien se
 * siente en cada uno y, debajo del nombre, su rol de esta semana. Un asiento
 * vacío (`studentName: null`) se dibuja igual pero sin texto, para que se
 * note a simple vista qué sitios quedan libres.
 */
/**
 * `data-seat-index` en cada asiento es lo que permite que la página enganche
 * un único `onClick` en el contenedor de la mesa (delegación de eventos) y
 * sepa a qué asiento corresponde el clic, sin tener que reconstruir el SVG
 * como elementos React uno a uno.
 */
export interface TableSvgOptions {
  /**
   * `true` (por defecto, el póster exportado): nombre y rol dentro de cada
   * pupitre. `false` (la pantalla): solo el número del asiento, porque los
   * nombres ya se leen en la lista de asientos que acompaña al dibujo y
   * dentro del abanico no caben sin montarse unos encima de otros.
   */
  labels?: boolean;
  /** Pinta la etiqueta de la mesa bajo el dibujo (la pantalla ya la muestra en la cabecera). */
  showLabel?: boolean;
}

/** Tonos neutros de un asiento libre: gris suave, sin discontinuas chillonas. */
const VACIO_RELLENO = '#f8fafc';
const VACIO_BORDE = '#cbd5e1';

export function buildTableSvg(
  seats: SeatVisual[], color: string, label: string,
  { labels = true, showLabel = true }: TableSvgOptions = {},
): string {
  const n = Math.max(1, seats.length);
  const segAngle = ARCO_TOTAL / n;
  const piezas: string[] = [];

  seats.forEach((seat, i) => {
    const a0 = -ARCO_TOTAL / 2 + i * segAngle + HUECO / 2;
    const a1 = -ARCO_TOTAL / 2 + (i + 1) * segAngle - HUECO / 2;
    const mid = (a0 + a1) / 2;
    const asiento: string[] = [];

    const pIn0 = polar(CX, CY, R1, a0);
    const pOut0 = polar(CX, CY, R2, a0);
    const pOut1 = polar(CX, CY, R2, a1);
    const pIn1 = polar(CX, CY, R1, a1);
    const d = `M ${pIn0.x.toFixed(1)},${pIn0.y.toFixed(1)} ` +
      `L ${pOut0.x.toFixed(1)},${pOut0.y.toFixed(1)} ` +
      `L ${pOut1.x.toFixed(1)},${pOut1.y.toFixed(1)} ` +
      `L ${pIn1.x.toFixed(1)},${pIn1.y.toFixed(1)} Z`;

    const ocupado = !!seat.studentName;
    asiento.push(ocupado
      ? `<path d="${d}" fill="${color}" fill-opacity="0.85" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" />`
      : `<path d="${d}" fill="${VACIO_RELLENO}" stroke="${VACIO_BORDE}" stroke-width="1.2" stroke-linejoin="round" />`);

    // Silla: un círculo justo fuera del borde de la mesa.
    const chair = polar(CX, CY, R2 + 15, mid);
    asiento.push(ocupado
      ? `<circle cx="${chair.x.toFixed(1)}" cy="${chair.y.toFixed(1)}" r="9" fill="${color}" fill-opacity="0.9" />`
      : `<circle cx="${chair.x.toFixed(1)}" cy="${chair.y.toFixed(1)}" r="9" fill="#e2e8f0" />`);

    if (!labels) {
      // Solo el número del asiento: casa con la lista de asientos de la pantalla.
      const p = polar(CX, CY, (R1 + R2) / 2 + 14, mid);
      asiento.push(`<text x="${p.x.toFixed(1)}" y="${(p.y + 5).toFixed(1)}" text-anchor="middle" font-size="15" font-weight="800" fill="${ocupado ? '#ffffff' : '#94a3b8'}">${i + 1}</text>`);
    } else if (seat.studentName) {
      const texto = polar(CX, CY, (R1 + R2) / 2 + 8, mid);
      const lineas = envolver(seat.studentName, 11);
      const nombreY = texto.y - (seat.roleName ? 6 : 0);
      asiento.push(`<text x="${texto.x.toFixed(1)}" y="${nombreY.toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#0f172a">` +
        lineas.map((l, li) => `<tspan x="${texto.x.toFixed(1)}" dy="${li === 0 ? 0 : 12}">${esc(l)}</tspan>`).join('') +
        `</text>`);
      if (seat.roleName) {
        asiento.push(`<text x="${texto.x.toFixed(1)}" y="${(nombreY + 12 * lineas.length + 2).toFixed(1)}" text-anchor="middle" font-size="9" fill="#475569">${esc(seat.roleName)}</text>`);
      }
    }

    piezas.push(`<g data-seat-index="${i}" class="seating-seat">${asiento.join('')}</g>`);
  });

  return (
    `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">` +
    piezas.join('') +
    (showLabel ? `<text x="${CX}" y="${HEIGHT - 2}" text-anchor="middle" font-size="10" font-weight="800" fill="${color}">${esc(label)}</text>` : '') +
    `</svg>`
  );
}
