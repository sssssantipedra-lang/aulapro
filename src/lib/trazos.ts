/**
 * Los trazos de la pizarra (Pizarra y herramientas).
 *
 * Cada trazo se guarda como lo que es, una lista de puntos con su
 * herramienta, color y grosor, y no como píxeles. Con eso:
 *   - el borrador puede quitar solo una parte (es un trazo más, que borra
 *     lo que pasa por debajo) y se puede deshacer y rehacer;
 *   - al cambiar el fondo de blanco a oscuro se recolorean los trazos sin
 *     tocar píxeles;
 *   - al cambiar el tamaño del lienzo se vuelve a pintar todo, sin perder nada.
 *
 * El dibujo en vivo pinta solo el trozo nuevo de cada movimiento. Antes se
 * volvía a trazar todo el camino en cada movimiento, y cuanto más largo era
 * el trazo, más tardaba en salir: ese era el retraso al escribir con el dedo.
 */

export type Herramienta = 'lapiz' | 'rotulador' | 'subrayador' | 'borrador';

export interface Punto {
  x: number;
  y: number;
  /** Presión del lápiz táctil, de 0 a 1 (0,5 si el dispositivo no la da). */
  p: number;
}

export interface Trazo {
  h: Herramienta;
  color: string;
  ancho: number;
  puntos: Punto[];
}

export type Grosor = 0 | 1 | 2;

export const HERRAMIENTAS: readonly Herramienta[] = ['lapiz', 'rotulador', 'subrayador', 'borrador'];

/** Los tres grosores (fino, medio, grueso) de cada herramienta, en píxeles CSS. */
export const ANCHOS: Record<Herramienta, readonly [number, number, number]> = {
  lapiz: [2, 3.5, 6],
  rotulador: [5, 9, 15],
  subrayador: [16, 26, 40],
  borrador: [18, 38, 76],
};

/** Opacidad del subrayador: deja ver lo que hay debajo. */
export const ALFA_SUBRAYADOR = 0.38;

/** Solo el lápiz responde a la presión; el rotulador y el subrayador son parejos. */
export const conPresion = (h: Herramienta) => h === 'lapiz';

/** El ancho de un tramo según la presión (de la mitad al total del ancho elegido). */
export function anchoConPresion(ancho: number, p: number): number {
  const k = Math.min(1, Math.max(0, p));
  return ancho * (0.5 + k);
}

export const esTransparente = (h: Herramienta) => h === 'subrayador';

type Ctx = CanvasRenderingContext2D;

function preparar(ctx: Ctx, t: Trazo, enVivo: boolean) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = t.color;
  ctx.fillStyle = t.color;
  ctx.lineWidth = t.ancho;
  ctx.globalCompositeOperation = t.h === 'borrador' ? 'destination-out' : 'source-over';
  // En vivo el subrayador se pinta opaco en su propia capa, que se ve con la
  // opacidad ya aplicada: así los tramos que se solapan no se oscurecen.
  ctx.globalAlpha = esTransparente(t.h) && !enVivo ? ALFA_SUBRAYADOR : 1;
}

const medio = (a: Punto, b: Punto): Punto => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, p: (a.p + b.p) / 2 });

/** Un punto suelto (un toque sin arrastrar) también se ve. */
function punto(ctx: Ctx, t: Trazo, a: Punto) {
  const ancho = conPresion(t.h) ? anchoConPresion(t.ancho, a.p) : t.ancho;
  ctx.beginPath();
  ctx.arc(a.x, a.y, ancho / 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Pinta los tramos del trazo desde el punto `desde` (el primero si se omite)
 * hasta el último. Cada tramo es una curva suave entre los puntos medios de
 * puntos consecutivos. Con `cerrar`, añade el último medio tramo hasta el
 * final del trazo.
 */
export function pintarTramos(ctx: Ctx, t: Trazo, desde = 1, cerrar = false, enVivo = true): void {
  const pts = t.puntos;
  if (pts.length === 0) return;
  ctx.save();
  preparar(ctx, t, enVivo);
  if (pts.length === 1) {
    punto(ctx, t, pts[0]);
    ctx.restore();
    return;
  }
  const presion = conPresion(t.h);
  for (let i = Math.max(1, desde); i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const ini = i >= 2 ? medio(pts[i - 2], a) : a;
    const fin = medio(a, b);
    ctx.lineWidth = presion ? anchoConPresion(t.ancho, (a.p + b.p) / 2) : t.ancho;
    ctx.beginPath();
    ctx.moveTo(ini.x, ini.y);
    ctx.quadraticCurveTo(a.x, a.y, fin.x, fin.y);
    ctx.stroke();
  }
  if (cerrar) {
    const a = pts[pts.length - 1];
    const ini = medio(pts[pts.length - 2], a);
    ctx.lineWidth = presion ? anchoConPresion(t.ancho, a.p) : t.ancho;
    ctx.beginPath();
    ctx.moveTo(ini.x, ini.y);
    ctx.lineTo(a.x, a.y);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Pinta un trazo entero ya terminado. El subrayador va de una sola pasada
 * para que su transparencia sea pareja aunque el trazo se cruce consigo mismo.
 */
export function pintarTrazo(ctx: Ctx, t: Trazo): void {
  if (t.puntos.length === 0) return;
  if (!esTransparente(t.h) || t.puntos.length < 2) {
    pintarTramos(ctx, t, 1, true, false);
    return;
  }
  const pts = t.puntos;
  ctx.save();
  preparar(ctx, t, false);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const m = medio(pts[i], pts[i + 1]);
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
  ctx.restore();
}

/** Vuelve a pintar todos los trazos, en orden, sobre un lienzo limpio. */
export function repintar(ctx: Ctx, trazos: readonly Trazo[]): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  for (const t of trazos) pintarTrazo(ctx, t);
}

/**
 * Pasa los colores de los trazos de una paleta a la otra (el blanco del
 * lápiz oscuro se vuelve negro, etc.), el mismo lugar de la paleta. Un color
 * que no está en la vieja se queda como está. El borrador no tiene color.
 */
export function recolorear(trazos: readonly Trazo[], desde: readonly string[], hasta: readonly string[]): Trazo[] {
  return trazos.map(t => {
    if (t.h === 'borrador') return t;
    const i = desde.indexOf(t.color);
    return i >= 0 && hasta[i] ? { ...t, color: hasta[i] } : t;
  });
}
