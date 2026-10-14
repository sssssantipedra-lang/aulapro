/**
 * El diseño «Cuaderno» de las fichas (decisión del dueño, 14-10-2026): una
 * hoja de trabajo de colegio, bien maquetada. Cinta de título con una
 * ilustración a su lado, bloques numerados con su color, ejercicios compactos
 * (listas de cálculos con su hueco, series que se escriben en una caja) y un
 * recuadro lateral por bloque («Recuerda», «Reto», «Consejo»).
 *
 * Todo es HTML y SVG propio: sin imágenes que descargar, nítido al imprimir y
 * sin enviar nada. Las ilustraciones salen del catálogo de
 * `lib/ilustraciones.ts`: cada dibujo de este archivo es una entrada de ese
 * catálogo con su descripción y sus temas, y la app elige la cabecera que mejor
 * encaja con el tema y el área de la ficha. Las que se generan con fal.ai
 * (`fuente: 'img'`, ver `scripts/ilustraciones/`) son objetos sueltos para los
 * ejercicios, no cabeceras.
 *
 * `exportFicha.ts` monta la hoja con estas piezas; el Word usa solo los
 * datos (`recuadroLineas`, `serieDe`) porque no admite SVG ni rejillas.
 */
import type { FichaExercise, FichaRecuadro } from './resources';
import { elegirIlustraciones, ilustracionPorId, nombreIlustracion } from '../lib/ilustraciones';
import { DIBUJOS_CABECERA, hiloPorId } from '../lib/hilos';
import { bancoClasificar } from '../lib/dibujosEjercicio';
import type { Lang } from '../i18n';

type Tr = (k: string, vars?: Record<string, string | number>) => string;

/** Un `<img>` con un dibujo del catálogo (ya cargado como `data:`), o nada si aún no se tiene. */
export type Ilus = (id: string | undefined, cls: string) => string;

const esc = (s: string) => (s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/* ── Dibujos sueltos: cada uno cabe en una caja de unos 60 × 60 ── */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Una cara con rejilla n × n: `u` y `v` son los vectores de sus lados desde `p0`. */
function cara(p0: [number, number], u: [number, number], v: [number, number], fill: string, n: number, line: string): string {
  const P = (a: number, b: number): [number, number] => [p0[0] + u[0] * a + v[0] * b, p0[1] + u[1] * a + v[1] * b];
  const poly = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)].map(p => p.join(',')).join(' ');
  let s = `<polygon points="${poly}" fill="${fill}"/>`;
  for (let i = 1; i < n; i++) {
    const t = lerp(0, 1, i / n);
    s += `<line x1="${P(t, 0)[0]}" y1="${P(t, 0)[1]}" x2="${P(t, 1)[0]}" y2="${P(t, 1)[1]}" stroke="${line}" stroke-width=".6"/>`;
    s += `<line x1="${P(0, t)[0]}" y1="${P(0, t)[1]}" x2="${P(1, t)[0]}" y2="${P(1, t)[1]}" stroke="${line}" stroke-width=".6"/>`;
  }
  return s + `<polygon points="${poly}" fill="none" stroke="${line}" stroke-width="1" stroke-linejoin="round"/>`;
}

interface Colores { top: string; left: string; right: string; line: string }
const VERDE: Colores = { top: '#A8E063', left: '#4FAE2A', right: '#2F8B1C', line: '#1F6A12' };
const AZUL: Colores = { top: '#7CC4FF', left: '#2F8EE8', right: '#1B64B8', line: '#124A8C' };
const ROSA: Colores = { top: '#FF9DB6', left: '#EE3F6E', right: '#BE1F4D', line: '#8C0F36' };

/** Un cubo isométrico de lado `w`, con la esquina de arriba en (x, y). */
function cubo(x: number, y: number, w: number, c: Colores, n: number): string {
  const dx = w * 0.5, dy = w * 0.26, h = w * 0.62;
  return `<g transform="translate(${x} ${y})">` +
    cara([0, dy], [dx, dy], [0, h], c.left, n, c.line) +
    cara([dx, dy * 2], [dx, -dy], [0, h], c.right, n, c.line) +
    cara([dx, 0], [dx, dy], [-dx, dy], c.top, n, c.line) + '</g>';
}

/** Una barra de 10 cubitos, de pie. */
function barra(x: number, y: number): string {
  let s = '';
  for (let i = 0; i < 10; i++) s += `<rect x="${x + 2}" y="${y + 6 + i * 4.6}" width="9" height="4.6" fill="${i % 2 ? '#2F8EE8' : '#3D9AF0'}" stroke="#124A8C" stroke-width=".6"/>`;
  return `<polygon points="${x + 2},${y + 6} ${x + 6.5},${y + 2.5} ${x + 11},${y + 6} ${x + 6.5},${y + 9.5}" fill="#9AD2FF" stroke="#124A8C" stroke-width=".7"/>${s}` +
    `<polygon points="${x + 11},${y + 6} ${x + 11},${y + 52} ${x + 14},${y + 49} ${x + 14},${y + 3}" fill="#1B64B8" stroke="#124A8C" stroke-width=".6"/>`;
}

/** Una placa de 100: un cuadrado con rejilla de 10 × 10, tumbado. */
const placa = (x: number, y: number) =>
  cara([x + 4, y + 18], [30, -8], [-4, 14], '#F6D326', 10, '#8A6E00') +
  cara([x, y + 32], [30, 0], [0, 6], '#E9C21A', 1, '#8A6E00').replace(/<polygon points="([^"]+)" fill="#E9C21A"\/>/, '<polygon points="$1" fill="#D8AE0C"/>');

const unidad = (x: number, y: number) => cubo(x, y, 16, ROSA, 1);

function libro(x: number, y: number, c = '#3B82F6'): string {
  return `<g transform="translate(${x} ${y})">` +
    `<path d="M2 12 Q30 22 58 12 V50 Q30 60 2 50 Z" fill="${c}"/>` +
    `<path d="M5 8 Q18 5 30 12 V50 Q18 43 5 46 Z" fill="#fff" stroke="#1E3A8A" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M55 8 Q42 5 30 12 V50 Q42 43 55 46 Z" fill="#F8FAFF" stroke="#1E3A8A" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<g stroke="#9CB3E6" stroke-width="1.5" stroke-linecap="round"><path d="M9 17 Q16 15 25 19M9 24 Q16 22 25 26M9 31 Q16 29 25 33"/><path d="M35 19 Q44 15 51 17M35 26 Q44 22 51 24M35 33 Q44 29 51 31"/></g></g>`;
}

function lapiz(x: number, y: number): string {
  return `<g transform="translate(${x} ${y}) rotate(-35 4 30)">` +
    `<rect x="0" y="6" width="9" height="40" fill="#FFD43B" stroke="#B8860B" stroke-width="1.2"/>` +
    `<path d="M0 6h9" stroke="#B8860B" stroke-width="1.2"/><rect x="0" y="0" width="9" height="7" rx="1.5" fill="#F472B6" stroke="#B8860B" stroke-width="1.2"/>` +
    `<path d="M0 46h9L4.5 58z" fill="#F5DEB3" stroke="#B8860B" stroke-width="1.2" stroke-linejoin="round"/><path d="M3 53.5h3L4.5 58z" fill="#374151"/></g>`;
}

const bloqueLetra = (x: number, y: number, ch: string, fill: string, rot = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rot} 14 14)"><rect width="28" height="28" rx="6" fill="${fill}" stroke="#fff" stroke-width="2"/>` +
  `<text x="14" y="22" text-anchor="middle" font-size="19" fill="#fff">${ch}</text></g>`;

function bocadillo(x: number, y: number, texto: string, fill: string, cola: 'izq' | 'der'): string {
  const tail = cola === 'izq' ? 'M12 38 L6 50 L24 40' : 'M50 38 L56 50 L38 40';
  return `<g transform="translate(${x} ${y})"><rect x="2" y="2" width="56" height="38" rx="14" fill="${fill}" stroke="#fff" stroke-width="2"/>` +
    `<path d="${tail}Z" fill="${fill}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>` +
    `<text x="30" y="27" text-anchor="middle" font-size="15" fill="#fff">${esc(texto)}</text></g>`;
}

function matraz(x: number, y: number): string {
  return `<g transform="translate(${x} ${y})"><path d="M20 4h14M23 4v18L6 52q-2 5 3 5h36q5 0 3-5L31 22V4" fill="#E0F2FE" stroke="#0E7490" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<path d="M12 40q6-4 12 0t12 0t10 2l4 10q2 5-3 5H9q-5 0-3-5z" fill="#4ADE80" stroke="#15803D" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<circle cx="22" cy="46" r="2.4" fill="#fff" opacity=".8"/><circle cx="33" cy="49" r="1.8" fill="#fff" opacity=".8"/><circle cx="29" cy="12" r="1.8" fill="#38BDF8"/></g>`;
}

const hoja = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><path d="M4 50C2 22 22 4 52 4c2 28-12 48-40 46" fill="#4ADE80" stroke="#15803D" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M4 54Q24 34 46 12M20 36l10 1M28 26l11 0M14 44l8 1" stroke="#15803D" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`;

const lupa = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><circle cx="22" cy="22" r="17" fill="#E0F2FE" fill-opacity=".85" stroke="#0369A1" stroke-width="4"/>` +
    `<path d="M14 15q4-5 10-4" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M35 36l16 16" stroke="#92400E" stroke-width="7" stroke-linecap="round"/></g>`;

const globo = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><circle cx="30" cy="28" r="23" fill="#38BDF8" stroke="#0369A1" stroke-width="1.8"/>` +
    `<path d="M16 16q8-4 12 2t-4 8-10 2q-4-6 2-12zM34 32q8-2 12 4t-6 12q-8-2-8-8zM38 12q6 0 8 6-6 2-8-2z" fill="#4ADE80" stroke="#15803D" stroke-width="1"/>` +
    `<ellipse cx="30" cy="28" rx="10" ry="23" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1"/><path d="M7 28h46" stroke="#fff" stroke-opacity=".55"/>` +
    `<path d="M14 54h32M30 51v5" stroke="#92400E" stroke-width="3" stroke-linecap="round"/></g>`;

const brujula = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><circle cx="26" cy="26" r="23" fill="#FEF3C7" stroke="#B45309" stroke-width="3"/><circle cx="26" cy="26" r="17" fill="#fff" stroke="#D97706" stroke-width="1"/>` +
    `<path d="M26 8l5 18-5 3-5-3z" fill="#DC2626"/><path d="M26 44l5-18-5-3-5 3z" fill="#475569"/><circle cx="26" cy="26" r="2.4" fill="#fff" stroke="#1F2937"/>` +
    `<text x="26" y="7" text-anchor="middle" font-size="7" fill="#B45309">N</text></g>`;

const chinchetaMapa = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><path d="M18 2c-9 0-15 6-15 14 0 10 15 26 15 26s15-16 15-26C33 8 27 2 18 2z" fill="#EF4444" stroke="#991B1B" stroke-width="1.6"/><circle cx="18" cy="16" r="6" fill="#fff"/></g>`;

const nota = (x: number, y: number, c: string, doble = false) => doble
  ? `<g transform="translate(${x} ${y})"><path d="M14 8l30-6v34" stroke="${c}" stroke-width="3" fill="none" stroke-linejoin="round"/><path d="M14 8v34" stroke="${c}" stroke-width="3"/><path d="M14 8l30-6" stroke="${c}" stroke-width="6"/>` +
      `<ellipse cx="9" cy="43" rx="8" ry="6" fill="${c}" transform="rotate(-18 9 43)"/><ellipse cx="39" cy="37" rx="8" ry="6" fill="${c}" transform="rotate(-18 39 37)"/></g>`
  : `<g transform="translate(${x} ${y})"><path d="M20 4v36" stroke="${c}" stroke-width="3.5"/><path d="M20 4q12 4 10 18" stroke="${c}" stroke-width="3.5" fill="none" stroke-linecap="round"/><ellipse cx="13" cy="42" rx="9" ry="6.5" fill="${c}" transform="rotate(-18 13 42)"/></g>`;

const pentagrama = (x: number, y: number, w: number) =>
  `<g stroke="#94A3B8" stroke-width="1.2">${[0, 1, 2, 3, 4].map(i => `<line x1="${x}" x2="${x + w}" y1="${y + i * 9}" y2="${y + i * 9}"/>`).join('')}</g>`;

const balon = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><circle cx="28" cy="28" r="24" fill="#fff" stroke="#1F2937" stroke-width="2"/>` +
    `<path d="M28 15l11 8-4 13H21l-4-13z" fill="#1F2937"/><path d="M28 15V5M39 23l11-4M35 36l7 10M21 36l-7 10M17 23L6 19" stroke="#1F2937" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M10 41q-4-10 0-20" stroke="#E5E7EB" stroke-width="2" fill="none"/></g>`;

const trofeo = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><path d="M14 6h28v16q0 14-14 16Q14 36 14 22z" fill="#FBBF24" stroke="#B45309" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M14 10H6q0 14 10 16M42 10h8q0 14-10 16" fill="none" stroke="#B45309" stroke-width="2"/><path d="M28 38v10M18 54h20l-3-6H21z" fill="#F59E0B" stroke="#B45309" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M20 12q-2 8 2 14" stroke="#FEF3C7" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>`;

const crono = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><circle cx="24" cy="30" r="20" fill="#fff" stroke="#2563EB" stroke-width="3.5"/><rect x="19" y="2" width="10" height="6" rx="2" fill="#2563EB"/><path d="M24 30V16M24 30l9 6" stroke="#1E3A8A" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="30" r="2.5" fill="#EF4444"/></g>`;

const paleta = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><path d="M30 4C14 4 2 15 2 29s12 26 26 26c6 0 7-5 4-8s-1-8 5-8h8c8 0 13-5 13-12C58 14 46 4 30 4z" fill="#FDE68A" stroke="#B45309" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<circle cx="16" cy="26" r="5" fill="#EF4444"/><circle cx="26" cy="15" r="5" fill="#3B82F6"/><circle cx="40" cy="15" r="5" fill="#22C55E"/><circle cx="49" cy="26" r="5" fill="#A855F7"/><circle cx="18" cy="41" r="4" fill="#fff" stroke="#B45309" stroke-width="1.2"/></g>`;

const pincel = (x: number, y: number) =>
  `<g transform="translate(${x} ${y}) rotate(25 6 30)"><rect x="2" y="2" width="8" height="30" rx="3" fill="#B45309"/><rect x="1" y="30" width="10" height="7" fill="#9CA3AF"/><path d="M1 37h10q2 10-5 18-7-8-5-18z" fill="#EC4899"/></g>`;

const corazon = (x: number, y: number, c: string, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M28 50C6 34 2 22 8 12c6-8 16-6 20 2 4-8 14-10 20-2 6 10 2 22-20 38z" fill="${c}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><path d="M13 16q4-4 8-1" stroke="#fff" stroke-opacity=".7" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>`;

const estrellaChica = (x: number, y: number, c = '#FBBF24', s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M26 2l7.5 16 17.5 2-13 12 3.500 17.500L26 41l-15.500 8.500L14 32 1 20l17.500-2z" fill="${c}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></g>`;

const libros = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><rect x="2" y="34" width="52" height="11" rx="2" fill="#7C3AED" stroke="#4C1D95" stroke-width="1.5"/><rect x="6" y="23" width="46" height="11" rx="2" fill="#F97316" stroke="#9A3412" stroke-width="1.5"/>` +
    `<rect x="4" y="12" width="44" height="11" rx="2" fill="#10B981" stroke="#065F46" stroke-width="1.5"/><path d="M10 39h14M12 28h12M10 17h12" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/></g>`;

const bombilla = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><g stroke="#F4B400" stroke-width="2.4" stroke-linecap="round"><path d="M28 3v5M8 12l3.500 3.500M48 12l-3.500 3.500M3 30h5M53 30h-5"/></g>` +
    `<path d="M28 10c-8.500 0-14 6-14 13.200 0 5 2.600 7.600 5 10.400 1.400 1.700 2 3.100 2 5.400h14c0-2.300.6-3.700 2-5.400 2.400-2.800 5-5.400 5-10.400C42 16 36.500 10 28 10z" fill="#FFE066" stroke="#E0A800" stroke-width="2"/>` +
    `<path d="M22 18c-2.500 1.500-4 4-4 7" stroke="#fff" stroke-width="2.200" fill="none" stroke-linecap="round" opacity=".85"/>` +
    `<rect x="21" y="39" width="14" height="4.500" rx="2" fill="#9AA5B1"/><rect x="23" y="44" width="10" height="4" rx="2" fill="#7B8794"/></g>`;

function tartaFraccion(x: number, y: number): string {
  // Círculo de 4 partes, con 3 de color
  const c = [30, 30], r = 24;
  const sector = (a0: number, a1: number, fill: string) => {
    const p = (a: number) => `${c[0] + r * Math.cos(a)},${c[1] + r * Math.sin(a)}`;
    return `<path d="M${c[0]},${c[1]} L${p(a0)} A${r},${r} 0 0 1 ${p(a1)} Z" fill="${fill}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`;
  };
  const q = Math.PI / 2;
  return `<g transform="translate(${x} ${y})">${sector(-q, 0, '#F97316')}${sector(0, q, '#FB923C')}${sector(q, 2 * q, '#FDBA74')}${sector(2 * q, 3 * q, '#FFEDD5')}</g>`;
}

const barraFraccion = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})">${[0, 1, 2, 3].map(i => `<rect x="${i * 15}" y="0" width="15" height="20" fill="${i < 3 ? '#38BDF8' : '#E0F2FE'}" stroke="#0369A1" stroke-width="1.6"/>`).join('')}` +
    `<text x="30" y="46" text-anchor="middle" font-size="19" fill="#0C4A6E">3/4</text></g>`;

const regla = (x: number, y: number) =>
  `<g transform="translate(${x} ${y}) rotate(-8 30 8)"><rect x="0" y="0" width="64" height="16" rx="2" fill="#FDE047" stroke="#A16207" stroke-width="1.6"/>` +
    `<g stroke="#A16207" stroke-width="1.3">${Array.from({ length: 13 }, (_, i) => `<line x1="${4 + i * 4.8}" x2="${4 + i * 4.8}" y1="0" y2="${i % 5 === 0 ? 9 : 5}"/>`).join('')}</g></g>`;

const escuadra = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><path d="M2 54V4l48 50z" fill="#7DD3FC" fill-opacity=".8" stroke="#0369A1" stroke-width="2" stroke-linejoin="round"/><path d="M12 44V28l22 16z" fill="#fff" fill-opacity=".85" stroke="#0369A1" stroke-width="1.2" stroke-linejoin="round"/></g>`;

/* ── Cabeceras: composiciones de unos 210 × 70, una por entrada del catálogo ── */

const CABECERAS: Record<string, string> = {
  'cab-base10': cubo(2, 8, 52, VERDE, 10) + barra(66, 2) + placa(88, 14) + unidad(138, 40),
  'cab-fracciones': tartaFraccion(0, 6) + barraFraccion(66, 8) + estrellaChica(140, 10, '#FBBF24', 0.8),
  'cab-geometria': regla(0, 40) + escuadra(60, 8) + cubo(120, 12, 46, AZUL, 3),
  'cab-lengua': libro(0, 8) + lapiz(70, 6) + bloqueLetra(100, 6, 'A', '#EF4444', -8) + bloqueLetra(130, 24, 'B', '#3B82F6', 6),
  'cab-ingles': bocadillo(0, 4, 'Hello', '#3B82F6', 'izq') + bocadillo(70, 20, 'Hi!', '#EC4899', 'der') + bloqueLetra(140, 8, 'ABC', '#F59E0B', 6).replace('font-size="19"', 'font-size="12"'),
  'cab-naturales': matraz(0, 6) + hoja(64, 10) + lupa(122, 8),
  'cab-sociales': globo(0, 6) + brujula(66, 12) + chinchetaMapa(124, 10),
  'cab-musica': pentagrama(0, 14, 190) + nota(8, 10, '#EF4444') + nota(54, 6, '#3B82F6', true) + nota(120, 10, '#22C55E'),
  'cab-deporte': balon(0, 8) + trofeo(62, 6) + crono(126, 10),
  'cab-plastica': paleta(0, 6) + pincel(70, 4) + estrellaChica(100, 24, '#A855F7', 0.8) + corazon(136, 20, '#F97316', 0.7),
  'cab-valores': corazon(0, 8, '#EF4444') + corazon(66, 24, '#EC4899', 0.75) + estrellaChica(116, 8, '#FBBF24') + corazon(166, 30, '#8B5CF6', 0.5),
  'cab-aula': lapiz(0, 6) + libros(32, 12) + bombilla(96, 6) + estrellaChica(158, 12, '#F59E0B', 0.9),
};

/** La mascota de cada recuadro: una entrada del catálogo (`uso: 'mascota'`). */
const MASCOTAS: Record<FichaRecuadro['tipo'], { id: string; svg: string }> = {
  recuerda: {
    id: 'mascota-chincheta',
    svg: `<svg viewBox="0 0 48 48" width="40" height="40"><g transform="rotate(38 24 24)"><ellipse cx="24" cy="12" rx="11" ry="9" fill="#E23B5A"/><ellipse cx="21" cy="9.5" rx="4.5" ry="3" fill="#FF8DA3" opacity=".9"/><rect x="17" y="18" width="14" height="6" rx="2" fill="#C9254A"/><rect x="14" y="23" width="20" height="4.5" rx="2.2" fill="#E23B5A"/><path d="M24 28L24 44" stroke="#8D99A8" stroke-width="2.4" stroke-linecap="round"/></g></svg>`,
  },
  reto: {
    id: 'mascota-estrella',
    svg: `<svg viewBox="0 0 64 64" width="46" height="46"><path d="M32 4l8.200 17.400 19 2.300-14 13 3.700 18.800L32 46.300 15.100 55.500l3.700-18.800-14-13 19-2.300z" fill="#FFD43B" stroke="#E0A800" stroke-width="2.200" stroke-linejoin="round"/><circle cx="25" cy="30" r="2.300" fill="#7A4B00"/><circle cx="39" cy="30" r="2.300" fill="#7A4B00"/><path d="M25.500 37q6.500 6 13 0" stroke="#7A4B00" stroke-width="2.200" fill="none" stroke-linecap="round"/><ellipse cx="21" cy="35" rx="3" ry="2" fill="#FF9A9A" opacity=".8"/><ellipse cx="43" cy="35" rx="3" ry="2" fill="#FF9A9A" opacity=".8"/></svg>`,
  },
  consejo: {
    id: 'mascota-bombilla',
    svg: `<svg viewBox="0 0 56 56" width="42" height="42">${bombilla(0, 0)}</svg>`,
  },
};

/** El SVG de una cabecera del catálogo con la medida dada. */
function cabeceraSvg(id: string, alto: number): string {
  const inner = CABECERAS[id] ?? CABECERAS['cab-aula'];
  return `<svg viewBox="0 0 210 70" height="${alto}" width="${alto * 3}" role="img" aria-label="${esc(ilustracionPorId(id)?.descripcion.es ?? '')}">${inner}</svg>`;
}

/* ── Piezas de la hoja ── */

/** Un color un poco más claro, para el degradado de los números. */
function aclarar(hex: string, k = 0.35): string {
  const n = parseInt(hex, 16);
  const c = (v: number) => Math.round(v + (255 - v) * k).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/** La letra de la cinta: 30 px hasta unos 21 caracteres y, de ahí, la que haga que el título quepa en una línea (mínimo 17: más largo, baja a una segunda). */
export const tamanoTitulo = (titulo: string) => Math.max(17, Math.min(30, Math.floor(630 / Math.max(titulo.length, 1))));

/**
 * La cabecera: la cinta con el título y, a su lado, el arte. Con hilo conductor,
 * los tres primeros dibujos de ese hilo (el del medio, más grande); sin hilo, o
 * si aún no se han cargado, la ilustración de cabecera del catálogo que mejor
 * encaja con el tema, el área y el curso.
 */
export function cabeceraHtml(o: { titulo: string; tema: string; area: string; nivel?: string; marca: string; hilo?: string; ilus?: Ilus }): string {
  const hilo = hiloPorId(o.hilo);
  const trio = hilo?.dibujos.slice(0, DIBUJOS_CABECERA) ?? [];
  // El del medio, el más grande: el orden de pintado es 2.º, 1.º, 3.º
  const orden = trio.length === 3 ? [trio[1], trio[0], trio[2]] : trio;
  const imgs = o.ilus ? orden.map(id => o.ilus!(id, `cq-hdib${id === trio[0] ? ' c' : ''}`)) : [];
  const conHilo = !!hilo && imgs.length > 0 && imgs.every(Boolean);
  let arte: string;
  if (conHilo) {
    arte = `<div class="cq-arte cq-arte-hilo" data-hilo="${esc(hilo!.id)}" data-ilustracion="${esc(trio.join(' '))}">${imgs.join('')}</div>`;
  } else {
    const ilu = elegirIlustraciones({ tema: o.tema, area: o.area, nivel: o.nivel }, { uso: 'cabecera', max: 1 })
      .find(i => i.fuente === 'svg' && CABECERAS[i.id]);
    const id = ilu?.id ?? 'cab-aula';
    arte = `<div class="cq-arte" data-ilustracion="${esc(id)}">${cabeceraSvg(id, 62)}</div>`;
  }
  return `<header class="cq-cab"${o.marca}>` +
    `<div class="cq-cinta"><h1 style="font-size:${tamanoTitulo(o.titulo)}px">${esc(o.titulo)}</h1></div>${arte}</header>`;
}

/** Los dibujos que necesita la cabecera de un hilo (para cargarlos antes de maquetar). */
export const dibujosDeLaCabecera = (hiloId: string | undefined): string[] => hiloPorId(hiloId)?.dibujos.slice(0, DIBUJOS_CABECERA) ?? [];

/** Nombre, fecha y clase en una caja de trazos, con el área delante. */
export function datosHtml(area: string | undefined, marca: string, t: Tr): string {
  const campo = (k: string, corto = false) => `<span class="cq-campo${corto ? ' corto' : ''}">${esc(t(k))}:<i></i></span>`;
  return `<div class="ficha-datos cq-datos">${area ? `<strong class="cq-area">${esc(area)}</strong>` : ''}` +
    `${campo('Nombre')}${campo('Fecha')}${campo('Clase', true)}${marca}</div>`;
}

/** La cabecera de un bloque: el número en un círculo con degradado y el título en el color del bloque, con un filete punteado detrás. */
export function seccionHtml(n: number, titulo: string, color: { bg: string; light: string }, label: string, marca = ''): string {
  return `<div class="cq-sec"${marca} style="--sc:#${color.bg};--sc2:${aclarar(color.bg)}">` +
    `<span class="cq-num">${n}</span><h2>${esc(titulo || label)}</h2></div>`;
}

/* ── Dibujos del catálogo: cada uno con su espacio para contestar ── */

const cantidadDe = (d: { cantidad?: number }) => Math.max(1, Math.min(10, d.cantidad ?? 1));

/**
 * Los dibujos de ambientación de un ejercicio: uno solo, en una figura enmarcada
 * a un lado del enunciado; varios, en una bandeja enmarcada debajo, cada dibujo
 * repetido las veces que dice `cantidad` (las pone el código, así que lo que hay
 * que contar está siempre bien dibujado). `lado` va junto al enunciado y
 * `bandeja` después de él.
 */
export function dibujosHtml(ex: FichaExercise, ilus: Ilus): { lado: string; bandeja: string } {
  const lista = (ex.dibujos ?? []).filter(d => d.ilustracion).map(d => ({ id: d.ilustracion, n: cantidadDe(d) }));
  const total = lista.reduce((s, d) => s + d.n, 0);
  if (!total) return { lado: '', bandeja: '' };
  if (total === 1) {
    const img = ilus(lista[0].id, 'cq-dib');
    return { lado: img ? `<div class="cq-fig">${img}</div>` : '', bandeja: '' };
  }
  const tam = total <= 4 ? 'g' : total <= 8 ? 'm' : 'p';
  const grupos = lista.map(d => `<span class="cq-grupo">${Array.from({ length: d.n }, () => ilus(d.id, 'cq-dib')).join('')}</span>`).join('');
  return { lado: '', bandeja: `<div class="cq-dibujos ${tam}">${grupos}</div>` };
}

const cajaRespuesta = (t: Tr) => `<div class="cq-cres"><b>=</b><span class="cq-caja" title="${esc(t('Respuesta'))}"></span></div>`;

/**
 * «Contar»: un cuadro con una fila por grupo de dibujos y, en la misma fila, la
 * caja donde se escribe cuántos hay; con `total`, una última fila para el total.
 */
export function contarHtml(ex: FichaExercise, ilus: Ilus, t: Tr): string {
  const grupos = (ex.dibujos ?? []).filter(d => d.ilustracion).map(d => ({ id: d.ilustracion, n: cantidadDe(d) }));
  const tam = Math.max(0, ...grupos.map(g => g.n)) <= 5 ? 'g' : 'm';
  const filas = grupos.map(g =>
    `<div class="cq-crow"><div class="cq-cdib">${Array.from({ length: g.n }, () => ilus(g.id, 'cq-dib')).join('')}</div>${cajaRespuesta(t)}</div>`).join('');
  const total = ex.total && grupos.length > 1
    ? `<div class="cq-crow total"><div class="cq-ctot">${esc(t('Total'))}</div>${cajaRespuesta(t)}</div>` : '';
  return `<div class="cq-contar ${tam}">${filas}${total}</div>`;
}

/**
 * «Etiquetar»: una ficha por dibujo con su línea debajo para escribir el nombre;
 * con `banco`, encima, las palabras que se usan (ordenadas alfabéticamente, no
 * como salen los dibujos).
 */
export function etiquetarHtml(ex: FichaExercise, ilus: Ilus, lang: Lang): string {
  const dibujos = (ex.dibujos ?? []).filter(d => d.ilustracion);
  const cols = dibujos.length <= 4 ? Math.max(2, dibujos.length) : dibujos.length === 5 ? 5 : dibujos.length === 6 ? 3 : 4;
  const banco = ex.banco
    ? `<div class="cq-banco-p">${dibujos.map(d => nombreIlustracion(d.ilustracion, lang) ?? '').filter(Boolean)
      .sort((a, b) => a.localeCompare(b, lang)).map(n => `<span>${esc(n)}</span>`).join('')}</div>` : '';
  const fichas = dibujos.map(d => `<div class="cq-etiq-c">${ilus(d.ilustracion, 'cq-etiq-img')}<span class="cq-linea-e"></span></div>`).join('');
  return `${banco}<div class="cq-etiq" style="grid-template-columns:repeat(${cols},minmax(0,1fr));max-width:${Math.min(172, cols * 58)}mm">${fichas}</div>`;
}

/**
 * «Clasificar»: arriba los dibujos, mezclados y numerados, con su nombre; debajo
 * un cuadro por grupo donde se escriben los números de los que le tocan.
 */
export function clasificarHtml(ex: FichaExercise, ilus: Ilus, lang: Lang): string {
  const banco = bancoClasificar(ex.categorias);
  const fichas = banco.map((d, i) =>
    `<div class="cq-pic"><b>${i + 1}</b>${ilus(d.id, 'cq-pic-img')}<span>${esc(nombreIlustracion(d.id, lang) ?? '')}</span></div>`).join('');
  const grupos = (ex.categorias ?? []).map(c => {
    const lineas = c.dibujos.length > 5 ? 3 : 2;
    return `<div class="cq-cat"><h4>${esc(c.nombre)}</h4><div class="cq-cat-c">${'<div></div>'.repeat(lineas)}</div></div>`;
  }).join('');
  const cp = banco.length <= 6 ? Math.max(2, banco.length) : Math.min(5, Math.ceil(banco.length / 2));
  return `<div class="cq-pics" style="grid-template-columns:repeat(${cp},minmax(0,1fr));max-width:${Math.min(172, cp * 36)}mm">${fichas}</div><div class="cq-cats" style="grid-template-columns:repeat(${Math.max(1, (ex.categorias ?? []).length)},minmax(0,1fr))">${grupos}</div>`;
}

/* ── Espacios para contestar ── */

/** Una respuesta de una palabra o un número: cabe en una caja. */
export const esRespuestaCorta = (solucion: string | undefined) => {
  const s = (solucion ?? '').trim();
  return s.length > 0 && s.length <= 12;
};

/** Cuántas líneas necesita escribir lo que dice la solución: dos como mínimo, hasta cuatro; tres cuando es de opinión o no se sabe. */
export function lineasDeRespuesta(solucion: string | undefined): number {
  const s = (solucion ?? '').trim();
  if (!s || /\b(libre|personal|opini[oó]n|var[ií]a|cada alumno|cada alumna|cualquier)\b/i.test(s)) return 3;
  return s.length > 160 ? 4 : s.length > 70 ? 3 : 2;
}

export const lineasHtml = (n: number) => `<div class="cq-lineas">${'<div></div>'.repeat(n)}</div>`;

/** «Respuesta:» y su caja (si es corta) o su línea. */
export const respuestaHtml = (t: Tr, caja: boolean) =>
  `<div class="cq-respuesta"><b>${esc(t('Respuesta'))}:</b>${caja ? '<span class="cq-caja"></span>' : '<span class="cq-linea larga"></span>'}</div>`;

/** El espacio de un problema: una cuadrícula para las operaciones y debajo la respuesta con su unidad. */
export const operacionHtml = (t: Tr) =>
  `<div class="cq-op"><span>${esc(t('Operación'))}</span></div>${respuestaHtml(t, false)}`;

/**
 * Un hueco de «completar»: tres o más guiones bajos (o puntos suspensivos) del
 * enunciado pasan a una línea de verdad. Devuelve el texto ya escapado y si había hueco.
 */
export function completarHtml(enunciado: string): { html: string; hueco: boolean } {
  let hueco = false;
  const html = esc(enunciado).replace(/_{3,}|…{2,}|\.{5,}/g, () => { hueco = true; return '<span class="cq-hueco"></span>'; });
  return { html, hueco };
}

/** Las opciones de un test: un círculo para marcar cada una, en dos columnas si son cortas. */
export function opcionesHtml(opciones: string[]): string {
  const corta = opciones.every(o => o.length <= 28);
  return `<div class="cq-ops${corta ? ' dos' : ''}">${opciones.map((o, j) =>
    `<span class="cq-opi"><i></i><b>${String.fromCharCode(97 + j)})</b> ${esc(o)}</span>`).join('')}</div>`;
}

/** Cierre de la hoja: «¿Cómo me ha ido?» con tres caritas para rodear. */
export function autoevaluacionHtml(t: Tr): string {
  const cara = (c: string, boca: string) =>
    `<svg viewBox="0 0 32 32" width="30" height="30"><circle cx="16" cy="16" r="14" fill="#fff" stroke="${c}" stroke-width="2.5"/>` +
    `<circle cx="11" cy="13" r="1.8" fill="${c}"/><circle cx="21" cy="13" r="1.8" fill="${c}"/><path d="${boca}" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
  return `<footer class="cq-fin"><span>${esc(t('¿Cómo te ha ido?'))}</span>` +
    `${cara('#22A559', 'M9.5 19q6.500 6 13 0')}${cara('#E0A800', 'M10 21.500h12')}${cara('#E5484D', 'M9.500 23q6.500-6 13 0')}</footer>`;
}

/** «CM = centena de millar» → ['CM', 'centena de millar']; sin «=», `null`. */
function parejaDe(linea: string): [string, string] | null {
  const i = linea.indexOf('=');
  if (i <= 0 || i === linea.length - 1) return null;
  const a = linea.slice(0, i).trim(), b = linea.slice(i + 1).trim();
  return a && b ? [a, b] : null;
}

/**
 * El recuadro de un bloque: una franja con su mascota, el título y lo que dice
 * («Recuerda» y «Consejo» van antes de los ejercicios; «Reto», después, con su
 * hueco para la respuesta).
 */
export function recuadroHtml(r: FichaRecuadro, t: Tr): string {
  const titulo = r.tipo === 'recuerda' ? 'Recuerda' : r.tipo === 'reto' ? 'Reto' : 'Consejo';
  const parejas = r.tipo === 'recuerda' && r.lista?.length ? r.lista.map(parejaDe) : [];
  const leyenda = parejas.length && parejas.every(Boolean)
    ? `<div class="cq-leyenda">${(parejas as [string, string][]).map(([a, b]) => `<span><b>${esc(a)}</b><i>=</i>${esc(b)}</span>`).join('')}</div>`
    : r.lista?.length ? `<ul class="cq-lista">${r.lista.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '';
  const respuesta = r.tipo === 'reto'
    ? `<div class="cq-respuesta"><b>${esc(t('Respuesta'))}:</b><span class="cq-linea larga"></span></div>` : '';
  return `<aside class="cq-nota ${r.tipo}"><div class="cq-mascota">${MASCOTAS[r.tipo].svg}</div>` +
    `<div class="cq-nota-c"><div class="cq-nota-t">${esc(t(titulo))}</div>${r.texto ? `<p>${esc(r.texto)}</p>` : ''}${leyenda}${respuesta}</div></aside>`;
}

/** Lo que el Word necesita de un recuadro: título y líneas, sin dibujo. */
export function recuadroLineas(r: FichaRecuadro, t: Tr): { titulo: string; lineas: string[]; respuesta: boolean } {
  const titulo = r.tipo === 'recuerda' ? 'Recuerda' : r.tipo === 'reto' ? 'Reto' : 'Consejo';
  return { titulo: t(titulo), lineas: [...(r.texto ? [r.texto] : []), ...(r.lista ?? [])], respuesta: r.tipo === 'reto' };
}

/** Lo que va a la izquierda del «=»: sin el «=» ni los huecos que haya detrás. */
const izquierda = (l: string) => l.replace(/[\s=_…]+$/u, '');

/**
 * Una lista de cálculos: cada línea con su número, el «=» y su hueco (línea o
 * caja) pegado al cálculo, con los «=» alineados; en dos columnas cuando son
 * cuatro o más y cortas.
 */
export function calculosHtml(ex: FichaExercise): string {
  const caja = ex.respuesta === 'caja';
  const lineas = (ex.lineas ?? []).map(izquierda);
  const ancho = Math.max(...lineas.map(l => l.length), 1);
  const dos = lineas.length >= 4 && ancho <= 18;
  return `<div class="cq-calculos${caja ? ' con-caja' : ''}${dos ? ' dos' : ''}" style="--w:${Math.min(ancho, 40)}ch">${lineas.map((l, i) =>
    `<div class="cq-fila"><b>${i + 1}.</b><span class="cq-val">${esc(l)}</span><span class="cq-eq">=</span>` +
    `<span class="${caja ? 'cq-caja' : 'cq-linea'}"></span></div>`).join('')}</div>`;
}

/**
 * Una serie corta (números, palabras sueltas): se escribe en orden en una caja,
 * como en un cuaderno. Las largas (pasos de un proceso) siguen numerándose.
 */
export function serieDe(ex: FichaExercise): string[] | null {
  const el = ex.elementos ?? [];
  return ex.tipo === 'ordenar' && el.length >= 3 && el.every(e => e.length <= 14) ? el : null;
}

/** La serie dada y, debajo, tantas casillas como elementos para escribirla en orden. */
export function serieHtml(elementos: string[]): string {
  return `<div class="cq-serie">${elementos.map(e => `<span>${esc(e)}</span>`).join('<i>–</i>')}</div>` +
    `<div class="cq-celdas">${elementos.map(() => '<span class="cq-caja"></span>').join('<i>–</i>')}</div>`;
}

/* ── Estilos ── */

export const CUADERNO_STYLE = `
.th-cuaderno { font-size: 13.5px; word-spacing: .04em; --lin: #9db3cb; --tinta: #475569; }
.ficha-doc.th-cuaderno { padding: 0; }
.cq-cab { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; margin: 0 0 7px -4px; }
.cq-cinta { position: relative; flex: 1 1 auto; min-width: 0; max-width: 128mm; display: flex; align-items: center; min-height: 15mm; padding: 3.5mm 11mm 4mm 7mm; color: #fff;
  background: linear-gradient(180deg, var(--c), var(--cd)); border-bottom: 5px solid var(--cd); clip-path: polygon(0 0, 100% 0, calc(100% - 5mm) 50%, 100% 100%, 0 100%); }
.cq-cinta h1 { margin: 0; font-family: var(--font-t); font-weight: 900; text-transform: uppercase; line-height: 1.08; letter-spacing: .01em; word-spacing: .14em; overflow-wrap: anywhere;
  text-shadow: -2px -2px 0 var(--cd), 2px -2px 0 var(--cd), -2px 2px 0 var(--cd), 2px 2px 0 var(--cd), 0 3px 0 var(--cd), 0 -2px 0 var(--cd), -2px 0 0 var(--cd), 2px 0 0 var(--cd); }
.cq-arte { flex: 0 0 auto; display: flex; align-items: flex-end; margin-bottom: -2px; }
.cq-arte svg, .cq-arte img { display: block; }
.cq-arte-hilo { gap: 0; padding: 0 2px 0 0; }
.cq-arte-hilo .cq-hdib { width: 17mm; height: 17mm; object-fit: contain; margin-left: -3mm; position: relative; }
.cq-arte-hilo .cq-hdib:first-child { margin-left: 0; }
.cq-arte-hilo .cq-hdib.c { width: 21mm; height: 21mm; z-index: 1; margin-bottom: 1mm; }
.cq-arte text { font-family: var(--font-t); font-weight: 900; }

.cq-datos { display: flex; align-items: baseline; gap: 6mm; margin: 0 0 8px; padding: 5px 12px; border: 1.75px dashed #7DB8E8; background: var(--cl); border-radius: 10px; font-size: 14px; font-weight: 800; color: var(--cd); }
.cq-datos .cq-area { padding-right: 2mm; color: var(--c); }
.cq-campo { flex: 1; display: flex; align-items: baseline; gap: 6px; } .cq-campo.corto { flex: .55; }
.cq-campo i { flex: 1; border-bottom: 1.75px solid var(--cd); height: 1px; transform: translateY(-3px); }
.cq-datos .var-mark { margin-left: auto; }

.th-cuaderno .ficha-explicacion { background: var(--cl); border: 1.75px dashed var(--c); border-left-width: 1.75px; border-radius: 12px; padding: 9px 14px; margin-bottom: 10px; }
.th-cuaderno .ficha-explicacion .lbl { color: var(--c); font-family: var(--font-t); font-size: 12px; }
.th-cuaderno .ficha-explicacion .txt { font-size: 13px; line-height: 1.55; }
.th-cuaderno .ficha-instr { font-style: normal; font-weight: 700; color: #334155; margin: 0 0 14px; }

/* Bloque: cabecera con su filete punteado y los ejercicios debajo */
.th-cuaderno .ficha-actividad { margin: 0 0 7mm; padding: 0; border: none; break-inside: auto; page-break-inside: auto; }
.th-cuaderno .ficha-actividad:last-of-type { margin-bottom: 0; }
.cq-sec { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; break-after: avoid; break-inside: avoid; }
.cq-sec::after { content: ''; flex: 1 1 auto; height: 0; border-bottom: 2.5px dotted var(--sc); opacity: .5; transform: translateY(2px); }
.cq-num { flex: 0 0 auto; width: 9.5mm; height: 9.5mm; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-family: var(--font-t); font-weight: 900; font-size: 19px;
  background: linear-gradient(160deg, var(--sc2), var(--sc)); border: 2px solid var(--sc); box-shadow: inset 0 0 0 2.5px #fff; }
.cq-sec h2 { flex: 0 1 auto; margin: 0; font-family: var(--font-t); font-weight: 900; font-size: 18px; letter-spacing: .01em; word-spacing: .14em; color: var(--sc); text-transform: uppercase; line-height: 1.15; }

/* Ejercicio: el número en su casilla a la izquierda y todo lo demás en una columna, siempre alineada */
.th-cuaderno .ficha-actividad .ficha-ejercicios { list-style: none; counter-reset: ej; margin: 0; padding: 0; border: none; border-radius: 0; }
.th-cuaderno .ficha-ejercicios > li { counter-increment: ej; position: relative; display: block; padding-left: 10mm; margin: 0 0 5.5mm; break-inside: avoid; page-break-inside: avoid; }
.th-cuaderno .ficha-ejercicios > li.largo { break-inside: auto; page-break-inside: auto; }
.th-cuaderno .ficha-ejercicios > li:last-child { margin-bottom: 0; }
.th-cuaderno .ficha-ejercicios > li::before { content: counter(ej); position: absolute; left: 0; top: 0; box-sizing: border-box; width: 6.6mm; height: 6.6mm; display: flex; align-items: center; justify-content: center;
  border: 1.75px solid var(--num); border-radius: 2mm; background: #fff; color: var(--num); font-family: var(--font-t); font-weight: 900; font-size: 13px; }
.th-cuaderno .ficha-ejercicios.letras > li::before { content: counter(ej, upper-alpha); }
.th-cuaderno .ficha-ejercicios.sin > li { padding-left: 0; }
.th-cuaderno .ficha-ejercicios.sin > li::before { display: none; }
.cq-ej { min-width: 0; }
.cq-ej::after { content: ''; display: block; clear: both; }
.th-cuaderno .ficha-enunciado { display: block; font-size: 13.5px; line-height: 1.5; margin: 0; break-after: avoid; }
.th-cuaderno .ficha-enunciado .cq-hueco { display: inline-block; min-width: 24mm; height: .9em; margin: 0 1mm; border-bottom: 1.5px solid var(--tinta); }

/* Con un solo dibujo (o una figura geométrica): enmarcado, a la derecha del enunciado y de su espacio */
.cq-ej.con-fig { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 4mm; align-items: start; }
.cq-ej.con-fig > .cq-fig { grid-column: 2; grid-row: 1 / span 6; }
.cq-ej.con-fig > :not(.cq-fig) { grid-column: 1; }
.cq-fig { box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 29mm; min-height: 27mm; padding: 1.5mm; line-height: 0;
  border: 1.5px solid color-mix(in srgb, var(--num) 40%, #fff); border-radius: 3mm; background: color-mix(in srgb, var(--num) 4%, #fff); }
.cq-fig img { width: 24mm; height: 24mm; object-fit: contain; display: block; }
.cq-fig.svg { width: auto; max-width: 52mm; padding: 2mm 3mm; background: #fff; }
.cq-fig.svg svg { max-width: 46mm; height: auto; display: block; }
.cq-dib { object-fit: contain; display: block; }

/* Varios dibujos de ambientación: una bandeja enmarcada */
.cq-dibujos { display: flex; flex-wrap: wrap; align-items: center; gap: 1mm 7mm; margin: 2mm 0 0; padding: 2mm 3mm; line-height: 0;
  border: 1.5px solid color-mix(in srgb, var(--num) 40%, #fff); border-radius: 3mm; background: color-mix(in srgb, var(--num) 4%, #fff); }
.cq-grupo { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 1px; }
.cq-dibujos.g .cq-dib { width: 16mm; height: 16mm; } .cq-dibujos.m .cq-dib { width: 12.5mm; height: 12.5mm; } .cq-dibujos.p .cq-dib { width: 10mm; height: 10mm; }

/* Contar: una fila por grupo, con su caja en la misma fila */
.cq-contar { margin-top: 2mm; border: 1.5px solid color-mix(in srgb, var(--num) 45%, #fff); border-radius: 3mm; overflow: hidden; background: #fff; }
.cq-crow { display: grid; grid-template-columns: minmax(0, 1fr) 38mm; align-items: stretch; border-top: 1.25px dotted color-mix(in srgb, var(--num) 45%, #fff); }
.cq-crow:first-child { border-top: none; }
.cq-cdib { display: flex; flex-wrap: wrap; align-items: center; gap: .5mm 1mm; padding: 1.8mm 3mm; line-height: 0; }
.cq-contar.g .cq-dib { width: 14mm; height: 14mm; } .cq-contar.m .cq-dib { width: 11mm; height: 11mm; }
.cq-cres { display: flex; align-items: center; justify-content: center; gap: 2mm; padding: 0 3mm; background: color-mix(in srgb, var(--num) 6%, #fff); border-left: 1.25px dotted color-mix(in srgb, var(--num) 45%, #fff); }
.cq-cres b { color: var(--num); font-size: 18px; font-weight: 900; }
.cq-cres .cq-caja { flex: 0 0 18mm; width: 18mm; height: 9mm; }
.cq-crow.total { background: color-mix(in srgb, var(--num) 4%, #fff); }
.cq-ctot { display: flex; align-items: center; justify-content: flex-end; padding: 0 3mm; font-weight: 900; color: var(--num); text-transform: uppercase; font-size: 12px; letter-spacing: .04em; }

/* Etiquetar: una ficha por dibujo con su línea para el nombre */
.cq-etiq { display: grid; gap: 3mm 4mm; margin-top: 2mm; }
.cq-etiq-c { box-sizing: border-box; padding: 2mm 2.5mm 2.5mm; text-align: center; line-height: 0; break-inside: avoid;
  border: 1.5px solid color-mix(in srgb, var(--num) 40%, #fff); border-radius: 3mm; background: #fff; }
.cq-etiq-img { width: 21mm; height: 21mm; object-fit: contain; display: block; margin: 0 auto 1.5mm; }
.cq-linea-e { display: block; height: 7.5mm; border-bottom: 1.5px solid var(--lin); }
.cq-banco-p { display: flex; flex-wrap: wrap; justify-content: center; gap: 1.5mm 2.5mm; margin-top: 2mm; padding: 2mm 3mm; border: 1.5px dashed var(--num); border-radius: 3mm; background: color-mix(in srgb, var(--num) 5%, #fff); }
.cq-banco-p span { padding: .4mm 3mm; border: 1.25px solid var(--num); border-radius: 99px; background: #fff; font-weight: 800; font-size: 12.5px; color: var(--num); }

/* Clasificar: los dibujos numerados arriba y un cuadro por grupo debajo */
.cq-pics { display: grid; gap: 3mm; margin-top: 2.5mm; line-height: 0; }
.cq-pic { position: relative; box-sizing: border-box; padding: 2mm 1mm 1.5mm; text-align: center; border: 1.5px solid color-mix(in srgb, var(--num) 40%, #fff); border-radius: 3mm; background: #fff; }
.cq-pic b { position: absolute; top: -1.5mm; left: -1.5mm; width: 5.4mm; height: 5.4mm; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--num); color: #fff; font-size: 11px; font-weight: 900; line-height: 1; }
.cq-pic-img { width: 16mm; height: 16mm; object-fit: contain; display: block; margin: 0 auto; }
.cq-pic span { display: block; margin-top: .5mm; font-size: 10.5px; line-height: 1.2; color: var(--tinta); font-weight: 700; }
.cq-cats { display: grid; gap: 3mm; margin-top: 3mm; }
.cq-cat { border: 1.75px solid var(--num); border-radius: 3mm; overflow: hidden; background: #fff; }
.cq-cat h4 { margin: 0; padding: 1mm 2mm; background: var(--num); color: #fff; text-align: center; font-family: var(--font-t); font-weight: 900; font-size: 12.5px; letter-spacing: .02em; text-transform: uppercase; }
.cq-cat-c { padding: 0 3mm 1mm; } .cq-cat-c div { height: 7.5mm; border-bottom: 1.25px solid var(--lin); } .cq-cat-c div:last-child { border-bottom: none; }

/* Espacios para escribir: líneas finas de cuaderno, las justas según lo que se espera */
.cq-lineas { margin-top: 1mm; } .cq-lineas > div { height: 8mm; border-bottom: 1.25px solid var(--lin); }
.cq-respuesta { display: flex; align-items: center; gap: 2.5mm; margin: 2.5mm 0 0; font-size: 13px; }
.cq-respuesta b { flex: 0 0 auto; color: var(--num); font-weight: 900; }
.cq-respuesta .cq-caja { flex: 0 0 34mm; }
.cq-linea { display: inline-block; border-bottom: 1.5px solid var(--lin); }
.cq-respuesta .cq-linea.larga { flex: 1 1 auto; height: 6.5mm; }
.cq-op { position: relative; box-sizing: border-box; height: 22mm; margin-top: 4.5mm; border: 1.75px solid var(--num); border-radius: 3mm; background-color: #fff;
  background-image: linear-gradient(#dbe6f2 1px, transparent 1px), linear-gradient(90deg, #dbe6f2 1px, transparent 1px); background-size: 5mm 5mm; background-position: -1px -1px; }
.cq-op > span { position: absolute; top: -2.9mm; left: 4mm; padding: 0 2mm; background: #fff; color: var(--num); font-weight: 900; font-size: 11px; letter-spacing: .05em; text-transform: uppercase; }
.cq-caja { display: inline-block; box-sizing: border-box; flex: 0 0 26mm; height: 8mm; border: 1.75px solid var(--num); border-radius: 7px; background: #fff; }
.cq-caja.ancha { display: block; width: 100%; height: 7.5mm; margin: 3px 0 0; }
.cq-caja.libre { display: block; width: 100%; flex: none; height: 9mm; border: 1.75px solid var(--k); }

/* Listas de cálculos: el hueco pegado a la cuenta y los «=» alineados */
.cq-calculos { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2.5mm 9mm; margin: 2mm 0 0 1mm; }
.cq-calculos.dos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cq-fila { display: flex; align-items: center; gap: 2.5mm; font-size: 14px; break-inside: avoid; }
.cq-fila b { flex: 0 0 5.5mm; font-weight: 900; color: var(--num); font-size: 12.5px; }
.cq-val { flex: 0 0 auto; min-width: var(--w, 10ch); }
.cq-eq { flex: 0 0 auto; color: var(--tinta); }
.cq-calculos .cq-linea { flex: 1 1 auto; min-width: 20mm; max-width: 60mm; height: 6mm; transform: translateY(-.3mm); }
.cq-calculos .cq-caja { flex: 0 0 26mm; }
.cq-serie { display: flex; flex-wrap: wrap; align-items: center; gap: 2mm 3mm; margin: 2mm 0 0; font-size: 14px; }
.cq-serie span { padding: .6mm 3mm; border: 1.25px solid color-mix(in srgb, var(--num) 40%, #fff); border-radius: 99px; background: #fff; font-weight: 700; }
.cq-serie i, .cq-celdas i { font-style: normal; color: var(--tinta); }
.cq-celdas { display: flex; flex-wrap: wrap; align-items: center; gap: 2mm 3mm; margin-top: 2.5mm; }
.cq-celdas .cq-caja { flex: 0 0 22mm; }

/* Test: un círculo para marcar cada opción */
.cq-ops { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5mm 6mm; margin-top: 2mm; }
.cq-ops.dos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cq-opi { display: flex; align-items: baseline; gap: 2mm; font-size: 13.5px; line-height: 1.35; }
.cq-opi i { flex: 0 0 auto; box-sizing: border-box; width: 4.2mm; height: 4.2mm; border: 1.6px solid var(--num); border-radius: 50%; transform: translateY(.8mm); }
.cq-opi b { color: var(--num); }

/* El recuadro del bloque: una franja con su mascota */
.cq-nota { position: relative; display: flex; align-items: center; gap: 4mm; margin: 0 0 5mm; padding: 2.5mm 5mm 2.5mm 4mm; border: 1.75px dashed var(--k); background: var(--kb); border-radius: 3mm; break-inside: avoid; page-break-inside: avoid; }
.cq-nota.reto { margin: 5.5mm 0 0; break-before: avoid; }
.cq-nota.recuerda, .cq-nota.consejo { break-after: avoid; }
.cq-nota.recuerda { --k: #1E88D8; --kb: #EAF5FE; } .cq-nota.reto { --k: #E0900A; --kb: #FFF8E6; } .cq-nota.consejo { --k: #1E88D8; --kb: #EAF5FE; }
.cq-mascota { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 13mm; line-height: 0; }
.cq-mascota svg { max-width: 13mm; height: auto; }
.cq-nota-c { flex: 1 1 auto; min-width: 0; }
.cq-nota-t { font-family: var(--font-t); font-weight: 900; font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: var(--k); margin-bottom: 1mm; }
.cq-nota p { margin: 0; font-size: 12.5px; line-height: 1.5; color: #1e293b; }
.cq-leyenda { display: grid; grid-template-columns: repeat(auto-fit, minmax(42mm, 1fr)); gap: 1mm 6mm; font-size: 12.5px; }
.cq-leyenda span { display: flex; gap: 2mm; align-items: baseline; } .cq-leyenda b { min-width: 9mm; } .cq-leyenda i { font-style: normal; color: var(--tinta); }
.cq-lista { margin: 0; padding-left: 16px; font-size: 12.5px; line-height: 1.5; }
.cq-nota .cq-respuesta { margin-top: 2mm; } .cq-nota .cq-respuesta b { color: var(--k); }

/* Tablas, relacionar y verdadero o falso, con el mismo aire que el resto */
.th-cuaderno .ficha-tabla { border-collapse: separate; border-spacing: 0; border: 1.75px solid var(--num); border-radius: 9px; overflow: hidden; font-size: 13.5px; margin-top: 2mm; }
.th-cuaderno .ficha-tabla th { text-transform: none; font-size: 13.5px; font-weight: 800; border: none; border-left: 1.5px solid var(--num); padding: 5px 8px; }
.th-cuaderno .ficha-tabla td { border: none; border-top: 1.25px solid color-mix(in srgb, var(--num) 40%, #fff); border-left: 1.25px solid color-mix(in srgb, var(--num) 40%, #fff); padding: 3px 10px; }
.th-cuaderno .ficha-tabla th:first-child, .th-cuaderno .ficha-tabla td:first-child { border-left: none; }
.th-cuaderno .ficha-tabla td.blank { background: #fff; height: 9mm; }
.th-cuaderno .ficha-tabla .vis-col { width: 17mm; padding: 1.5mm; }
.th-cuaderno .ficha-tabla .cq-tdib { width: 12mm; height: 12mm; object-fit: contain; display: block; margin: 0 auto; }
.th-cuaderno .ord-item { border-style: solid; border-color: color-mix(in srgb, var(--num) 45%, #fff); }
.th-cuaderno .ord-num { width: 6.2mm; height: 6.2mm; border-color: var(--num); }
.th-cuaderno .ficha-ordenar { gap: 2mm; margin-top: 2mm; }
.th-cuaderno .ficha-vf { margin-top: 2mm; gap: 2mm; }
.th-cuaderno .vf-row { border-color: color-mix(in srgb, var(--num) 35%, #fff); break-inside: avoid; }
.th-cuaderno .vf-box { border-color: var(--num); color: var(--num); }
.cq-rel { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 3mm 22mm; margin-top: 2mm; }
.cq-rel .item { position: relative; box-sizing: border-box; display: flex; align-items: center; gap: 3mm; min-height: 10mm; padding: 2mm 3mm; font-size: 13px; border: 1.5px solid color-mix(in srgb, var(--num) 40%, #fff); border-radius: 3mm; background: #fff; }
.cq-rel .item.con-dib { min-height: 15mm; padding-top: 1.2mm; padding-bottom: 1.2mm; }
.cq-rel .item img { flex: 0 0 auto; width: 12mm; height: 12mm; object-fit: contain; display: block; }
.cq-rel .item .dot-r, .cq-rel .item .dot-l { position: absolute; top: 50%; width: 3mm; height: 3mm; margin-top: -1.5mm; border-radius: 50%; background: var(--num); }
.cq-rel .item .dot-r { right: -5mm; } .cq-rel .item .dot-l { left: -5mm; }
.cq-rel .item b { color: var(--num); }

/* Cierre de la hoja */
/* La hoja no acaba en una página con solo «¿Cómo te ha ido?»: el último ejercicio (o el reto) viaja con el cierre */
.th-cuaderno .ficha-actividad:last-of-type .cq-cuerpo > :last-child, .th-cuaderno .ficha-actividad:last-of-type .cq-cuerpo > ol > li:last-child { break-after: avoid; page-break-after: avoid; }
.cq-fin { break-before: avoid; page-break-before: avoid; display: flex; align-items: center; justify-content: flex-end; gap: 3mm; margin-top: 7mm; padding-top: 3mm; border-top: 2px dotted var(--lin); color: var(--tinta); font-weight: 800; font-size: 12.5px; break-inside: avoid; }
.cq-fin span { margin-right: 1mm; }
.cq-fin svg { display: block; }
`;

/** Lo que cada ilustración de este archivo es para el catálogo, para las pruebas. */
export const ILUSTRACIONES_PROPIAS = [...Object.keys(CABECERAS), ...Object.values(MASCOTAS).map(m => m.id)];
