/**
 * Diagramas de figuras geométricas para las fichas de trabajo — problemas de
 * área, superficie y volumen con un dibujo etiquetado, no solo texto.
 *
 * Igual que la sopa de letras (`wordSearch.ts`) o el motivo decorativo
 * (`fichaMotifs.ts`), el dibujo en sí NO lo genera la IA: la IA solo elige
 * qué `forma` encaja en el problema y qué medidas lleva cada una (ver
 * `FIGURE_SLOTS`, que documenta cuántas medidas espera cada forma y qué
 * representa cada una, en el orden en que hay que darlas). El código
 * construye el SVG con esos valores ya puestos en su sitio.
 *
 * Estilo: esquemático, como en la pizarra — no perspectiva realista. Los
 * cuerpos con volumen (cubo, prisma, cono...) llevan sus aristas ocultas en
 * trazo discontinuo, siguiendo el convenio habitual de los libros de texto.
 * Todas las formas comparten el mismo lienzo (200x170) para que, al lado
 * unas de otras en la ficha, no varíe el tamaño.
 */

export type FigureShape =
  | 'rectangulo' | 'triangulo' | 'circulo' | 'trapecio' | 'paralelogramo'
  | 'cubo' | 'prisma_rectangular' | 'cilindro' | 'prisma_triangular' | 'cono' | 'esfera' | 'piramide_cuadrangular';

export interface FigureMedida {
  etiqueta: string;
  valor: string;
}

export interface Figure {
  forma: FigureShape;
  medidas: FigureMedida[];
}

export const FIGURE_SHAPES: FigureShape[] = [
  'rectangulo', 'triangulo', 'circulo', 'trapecio', 'paralelogramo',
  'cubo', 'prisma_rectangular', 'cilindro', 'prisma_triangular', 'cono', 'esfera', 'piramide_cuadrangular',
];

export const FIGURE_LABEL: Record<FigureShape, string> = {
  rectangulo: 'Rectángulo',
  triangulo: 'Triángulo',
  circulo: 'Círculo',
  trapecio: 'Trapecio',
  paralelogramo: 'Paralelogramo',
  cubo: 'Cubo',
  prisma_rectangular: 'Prisma rectangular',
  cilindro: 'Cilindro',
  prisma_triangular: 'Prisma triangular',
  cono: 'Cono',
  esfera: 'Esfera',
  piramide_cuadrangular: 'Pirámide cuadrangular',
};

/**
 * Cuántas medidas espera cada forma y qué representa cada una, EN ORDEN —
 * es la referencia que se le da a la IA en el prompt. `medidas[i]` de la
 * forma va siempre en la posición del dibujo que le corresponde a `slots[i]`,
 * así que si la IA da menos medidas de las que pide la forma, esa medida
 * sencillamente no se dibuja (mejor un hueco que una etiqueta inventada).
 */
export const FIGURE_SLOTS: Record<FigureShape, string[]> = {
  rectangulo: ['base', 'altura'],
  triangulo: ['base', 'altura'],
  circulo: ['radio'],
  trapecio: ['base mayor', 'base menor', 'altura'],
  paralelogramo: ['base', 'altura'],
  cubo: ['lado'],
  prisma_rectangular: ['largo', 'ancho', 'altura'],
  cilindro: ['radio', 'altura'],
  prisma_triangular: ['base', 'altura del triángulo', 'altura del prisma'],
  cono: ['radio', 'altura'],
  esfera: ['radio'],
  piramide_cuadrangular: ['lado de la base', 'altura'],
};

/** Lienzo interno donde se dibuja cada forma — más pequeño que `FIGURE_W`: deja margen para las etiquetas. */
const CANVAS = 200;
/** Margen horizontal añadido a cada lado para que ninguna etiqueta se corte contra el borde del SVG. */
const MARGIN_X = 14;
export const FIGURE_W = CANVAS + MARGIN_X * 2;
export const FIGURE_H = 170;

const STROKE = 1.75;
const STROKE_DASHED = 1.4;
const FONT = 'font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="11" font-weight="700"';

const esc = (s: string) => (s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

/**
 * Solo el valor (ej. "6 cm"), sin la etiqueta: el dibujo ya deja claro qué
 * mide cada número por su posición, igual que en un libro de texto — poner
 * "altura: 6 cm" al lado de la arista sería redundante y, con etiquetas más
 * largas, no cabría. Recortado por si acaso a un máximo razonable: `medidas`
 * lo escribe la IA, y no hay control sobre lo largo que decida hacerlo.
 */
function medText(m: FigureMedida | undefined): string {
  if (!m || !m.valor) return '';
  const v = m.valor.trim();
  return v.length > 9 ? v.slice(0, 8) + '…' : v;
}

function label(x: number, y: number, m: FigureMedida | undefined, color: string, anchor: 'start' | 'middle' | 'end' = 'middle'): string {
  const text = medText(m);
  if (!text) return '';
  return `<text x="${x}" y="${y}" fill="${color}" text-anchor="${anchor}" ${FONT}>${esc(text)}</text>`;
}

function poly(points: [number, number][], color: string, opts: { fill?: boolean; dashed?: boolean } = {}): string {
  const p = points.map(([x, y]) => `${x},${y}`).join(' ');
  const fill = opts.fill ? `${color}` : 'none';
  const fillOpacity = opts.fill ? '0.12' : '0';
  return `<polygon points="${p}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${color}" ` +
    `stroke-width="${opts.dashed ? STROKE_DASHED : STROKE}" ${opts.dashed ? 'stroke-dasharray="4 3"' : ''} stroke-linejoin="round"/>`;
}

function line(x1: number, y1: number, x2: number, y2: number, color: string, dashed = false): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" ` +
    `stroke-width="${dashed ? STROKE_DASHED : STROKE}" ${dashed ? 'stroke-dasharray="4 3"' : ''} stroke-linecap="round"/>`;
}

function ellipse(cx: number, cy: number, rx: number, ry: number, color: string, opts: { fill?: boolean; dashed?: boolean } = {}): string {
  const fill = opts.fill ? color : 'none';
  const fillOpacity = opts.fill ? '0.12' : '0';
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${color}" ` +
    `stroke-width="${opts.dashed ? STROKE_DASHED : STROKE}" ${opts.dashed ? 'stroke-dasharray="4 3"' : ''}/>`;
}

/* ── 2D ── */

function drawRectangulo(m: FigureMedida[], color: string): string {
  return poly([[35, 35], [145, 35], [145, 120], [35, 120]], color, { fill: true }) +
    label(90, 133, m[0], color) + label(152, 80, m[1], color, 'start');
}

function drawTriangulo(m: FigureMedida[], color: string): string {
  return poly([[40, 130], [160, 130], [100, 35]], color, { fill: true }) +
    line(100, 35, 100, 130, color, true) +
    label(100, 145, m[0], color) + label(108, 82, m[1], color, 'start');
}

function drawCirculo(m: FigureMedida[], color: string): string {
  return ellipse(100, 85, 55, 55, color, { fill: true }) +
    line(100, 85, 149.8, 61.8, color) +
    label(131, 70, m[0], color, 'start');
}

function drawTrapecio(m: FigureMedida[], color: string): string {
  return poly([[30, 125], [170, 125], [130, 45], [70, 45]], color, { fill: true }) +
    line(70, 45, 70, 125, color, true) +
    label(100, 138, m[0], color) + label(100, 32, m[1], color) + label(64, 88, m[2], color, 'end');
}

function drawParalelogramo(m: FigureMedida[], color: string): string {
  return poly([[35, 125], [135, 125], [165, 45], [65, 45]], color, { fill: true }) +
    line(65, 45, 65, 125, color, true) +
    label(85, 138, m[0], color) + label(58, 88, m[1], color, 'end');
}

/* ── 3D ── */

function drawCubo(m: FigureMedida[], color: string): string {
  // Frente sólido, cara trasera con sus dos aristas ocultas (abajo e izquierda) discontinuas.
  return poly([[45, 55], [125, 55], [125, 135], [45, 135]], color, { fill: true }) +
    line(75, 27, 155, 27, color) + line(155, 27, 155, 107, color) +
    line(75, 27, 75, 107, color, true) + line(75, 107, 155, 107, color, true) +
    line(45, 55, 75, 27, color) + line(125, 55, 155, 27, color) + line(125, 135, 155, 107, color) +
    line(45, 135, 75, 107, color, true) +
    label(85, 148, m[0], color);
}

function drawPrismaRectangular(m: FigureMedida[], color: string): string {
  return poly([[30, 50], [140, 50], [140, 120], [30, 120]], color, { fill: true }) +
    line(58, 24, 168, 24, color) + line(168, 24, 168, 94, color) +
    line(58, 24, 58, 94, color, true) + line(58, 94, 168, 94, color, true) +
    line(30, 50, 58, 24, color) + line(140, 50, 168, 24, color) + line(140, 120, 168, 94, color) +
    line(30, 120, 58, 94, color, true) +
    // m[0]=largo (borde frontal inferior), m[1]=ancho (arista de profundidad), m[2]=altura (borde vertical frontal).
    label(85, 133, m[0], color) + label(172, 18, m[1], color, 'start') + label(148, 88, m[2], color, 'start');
}

function drawCilindro(m: FigureMedida[], color: string): string {
  return ellipse(100, 140, 48, 15, color, { fill: true }) +
    line(52, 42, 52, 140, color) + line(148, 42, 148, 140, color) +
    ellipse(100, 42, 48, 15, color, { fill: true }) +
    line(100, 42, 148, 42, color) +
    label(124, 32, m[0], color) + label(156, 94, m[1], color, 'start');
}

function drawPrismaTriangular(m: FigureMedida[], color: string): string {
  return poly([[30, 140], [110, 140], [30, 60]], color, { fill: true }) +
    line(155, 110, 75, 110, color, true) + line(75, 110, 75, 30, color, true) + line(155, 110, 75, 30, color) +
    line(30, 140, 75, 110, color, true) + line(110, 140, 155, 110, color) + line(30, 60, 75, 30, color) +
    label(70, 153, m[0], color) + label(22, 100, m[1], color, 'end') + label(140, 128, m[2], color, 'start');
}

function drawCono(m: FigureMedida[], color: string): string {
  return ellipse(100, 138, 52, 15, color, { fill: true }) +
    line(100, 30, 48, 138, color) + line(100, 30, 152, 138, color) +
    line(100, 30, 100, 138, color, true) +
    label(126, 156, m[0], color) + label(108, 82, m[1], color, 'start');
}

function drawEsfera(m: FigureMedida[], color: string): string {
  return ellipse(100, 88, 52, 52, color, { fill: true }) +
    ellipse(100, 88, 52, 16, color, { dashed: true }) +
    line(100, 88, 148.9, 70.2, color) +
    label(132, 75, m[0], color, 'start');
}

function drawPiramideCuadrangular(m: FigureMedida[], color: string): string {
  return poly([[100, 150], [172, 118], [100, 28], [28, 118]], color, { fill: true }) +
    line(28, 118, 172, 118, color, true) +
    line(100, 28, 100, 118, color, true) +
    label(50, 140, m[0], color, 'end') + label(108, 76, m[1], color, 'start');
}

const BUILDERS: Record<FigureShape, (m: FigureMedida[], color: string) => string> = {
  rectangulo: drawRectangulo,
  triangulo: drawTriangulo,
  circulo: drawCirculo,
  trapecio: drawTrapecio,
  paralelogramo: drawParalelogramo,
  cubo: drawCubo,
  prisma_rectangular: drawPrismaRectangular,
  cilindro: drawCilindro,
  prisma_triangular: drawPrismaTriangular,
  cono: drawCono,
  esfera: drawEsfera,
  piramide_cuadrangular: drawPiramideCuadrangular,
};

/**
 * SVG completo (con su propia etiqueta `<svg>`, viewBox 200x170) de la
 * figura pedida. `color` es el color de acento de la actividad a la que
 * pertenece el ejercicio (mismo criterio que las cabeceras de actividad en
 * `exportFicha.ts`), así el dibujo no desentona del resto del bloque.
 * Forma desconocida -> SVG vacío, nunca lanza.
 */
export function buildFigureSvg(forma: FigureShape, medidas: FigureMedida[], color: string): string {
  const draw = BUILDERS[forma];
  const inner = draw ? draw(medidas ?? [], color) : '';
  return `<svg viewBox="0 0 ${FIGURE_W} ${FIGURE_H}" width="${FIGURE_W}" height="${FIGURE_H}" ` +
    `xmlns="http://www.w3.org/2000/svg"><g transform="translate(${MARGIN_X},0)">${inner}</g></svg>`;
}
