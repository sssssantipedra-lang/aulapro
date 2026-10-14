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
import { elegirIlustraciones, ilustracionPorId } from '../lib/ilustraciones';

type Tr = (k: string, vars?: Record<string, string | number>) => string;

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
 * La cabecera: la cinta con el título y, a su lado, la ilustración de cabecera
 * del catálogo que mejor encaja con el tema, el área y el curso. Las de uso
 * «objeto» (las que se generan con fal.ai) no van aquí: se usan dentro de los
 * ejercicios.
 */
export function cabeceraHtml(o: { titulo: string; tema: string; area: string; nivel?: string; marca: string }): string {
  const ilu = elegirIlustraciones({ tema: o.tema, area: o.area, nivel: o.nivel }, { uso: 'cabecera', max: 1 })
    .find(i => i.fuente === 'svg' && CABECERAS[i.id]);
  const id = ilu?.id ?? 'cab-aula';
  return `<header class="cq-cab"${o.marca}>` +
    `<div class="cq-cinta"><h1 style="font-size:${tamanoTitulo(o.titulo)}px">${esc(o.titulo)}</h1></div>` +
    `<div class="cq-arte" data-ilustracion="${esc(id)}">${cabeceraSvg(id, 62)}</div></header>`;
}

/** Nombre, fecha y clase en una caja de trazos, con el área delante. */
export function datosHtml(area: string | undefined, marca: string, t: Tr): string {
  const campo = (k: string, corto = false) => `<span class="cq-campo${corto ? ' corto' : ''}">${esc(t(k))}:<i></i></span>`;
  return `<div class="ficha-datos cq-datos">${area ? `<strong class="cq-area">${esc(area)}</strong>` : ''}` +
    `${campo('Nombre')}${campo('Fecha')}${campo('Clase', true)}${marca}</div>`;
}

/** La cabecera de un bloque: el número en un círculo con degradado y el título en el color del bloque. */
export function seccionHtml(n: number, titulo: string, color: { bg: string; light: string }, label: string, marca = ''): string {
  return `<div class="cq-sec"${marca} style="--sc:#${color.bg};--sc2:${aclarar(color.bg)}">` +
    `<span class="cq-num">${n}</span><h2>${esc(titulo || label)}</h2></div>`;
}

/** «CM = centena de millar» → ['CM', 'centena de millar']; sin «=», `null`. */
function parejaDe(linea: string): [string, string] | null {
  const i = linea.indexOf('=');
  if (i <= 0 || i === linea.length - 1) return null;
  const a = linea.slice(0, i).trim(), b = linea.slice(i + 1).trim();
  return a && b ? [a, b] : null;
}

/** El recuadro de un bloque, con su título y su mascota. */
export function recuadroHtml(r: FichaRecuadro, t: Tr): string {
  const titulo = r.tipo === 'recuerda' ? 'Recuerda' : r.tipo === 'reto' ? 'Reto' : 'Consejo';
  const parejas = r.tipo === 'recuerda' && r.lista?.length ? r.lista.map(parejaDe) : [];
  const tabla = parejas.length && parejas.every(Boolean)
    ? `<table class="cq-leyenda">${(parejas as [string, string][]).map(([a, b]) => `<tr><td>${esc(a)}</td><td>=</td><td>${esc(b)}</td></tr>`).join('')}</table>`
    : r.lista?.length ? `<ul class="cq-lista">${r.lista.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '';
  const respuesta = r.tipo === 'reto'
    ? `<div class="cq-resp">${esc(t('Respuesta'))}:</div><div class="cq-caja libre"></div>` : '';
  return `<aside class="cq-nota ${r.tipo}"><div class="cq-nota-t">${esc(t(titulo))}</div>` +
    `${r.texto ? `<p>${esc(r.texto)}</p>` : ''}${tabla}${respuesta}<div class="cq-mascota">${MASCOTAS[r.tipo].svg}</div></aside>`;
}

/** Lo que el Word necesita de un recuadro: título y líneas, sin dibujo. */
export function recuadroLineas(r: FichaRecuadro, t: Tr): { titulo: string; lineas: string[]; respuesta: boolean } {
  const titulo = r.tipo === 'recuerda' ? 'Recuerda' : r.tipo === 'reto' ? 'Reto' : 'Consejo';
  return { titulo: t(titulo), lineas: [...(r.texto ? [r.texto] : []), ...(r.lista ?? [])], respuesta: r.tipo === 'reto' };
}

/** Lo que va a la izquierda del «=»: sin el «=» ni los huecos que haya detrás. */
const izquierda = (l: string) => l.replace(/[\s=_…]+$/u, '');

/** Una lista de cálculos: cada línea con su número, el «=» y su hueco (línea o caja). */
export function calculosHtml(ex: FichaExercise): string {
  const caja = ex.respuesta === 'caja';
  return `<div class="cq-calculos${caja ? ' con-caja' : ''}">${(ex.lineas ?? []).map((l, i) =>
    `<div class="cq-fila"><b>${i + 1}.</b><span class="cq-val">${esc(izquierda(l))}</span><span class="cq-eq">=</span>` +
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

export function serieHtml(elementos: string[]): string {
  return `<div class="cq-serie">${elementos.map(e => `<span>${esc(e)}</span>`).join('<i>–</i>')}</div><div class="cq-caja ancha"></div>`;
}

/* ── Estilos ── */

export const CUADERNO_STYLE = `
.th-cuaderno { font-size: 13.5px; word-spacing: .04em; }
.ficha-doc.th-cuaderno { padding: 0; }
.cq-cab { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; margin: 0 0 10px -4px; }
.cq-cinta { position: relative; flex: 1 1 auto; min-width: 0; max-width: 128mm; display: flex; align-items: center; min-height: 15mm; padding: 3.5mm 11mm 4mm 7mm; color: #fff;
  background: linear-gradient(180deg, var(--c), var(--cd)); border-bottom: 5px solid var(--cd); clip-path: polygon(0 0, 100% 0, calc(100% - 5mm) 50%, 100% 100%, 0 100%); }
.cq-cinta h1 { margin: 0; font-family: var(--font-t); font-weight: 900; text-transform: uppercase; line-height: 1.08; letter-spacing: .01em; word-spacing: .14em; overflow-wrap: anywhere;
  text-shadow: -2px -2px 0 var(--cd), 2px -2px 0 var(--cd), -2px 2px 0 var(--cd), 2px 2px 0 var(--cd), 0 3px 0 var(--cd), 0 -2px 0 var(--cd), -2px 0 0 var(--cd), 2px 0 0 var(--cd); }
.cq-arte { flex: 0 0 auto; display: flex; align-items: flex-end; margin-bottom: -2px; }
.cq-arte svg, .cq-arte img { display: block; }
.cq-arte text { font-family: var(--font-t); font-weight: 900; }

.cq-datos { display: flex; align-items: baseline; gap: 6mm; margin: 0 0 9px; padding: 7px 12px; border: 1.75px dashed #7DB8E8; background: var(--cl); border-radius: 10px; font-size: 14px; font-weight: 800; color: var(--cd); }
.cq-datos .cq-area { padding-right: 2mm; color: var(--c); }
.cq-campo { flex: 1; display: flex; align-items: baseline; gap: 6px; } .cq-campo.corto { flex: .55; }
.cq-campo i { flex: 1; border-bottom: 1.75px solid var(--cd); height: 1px; transform: translateY(-3px); }
.cq-datos .var-mark { margin-left: auto; }

.th-cuaderno .ficha-explicacion { background: var(--cl); border: 1.75px dashed var(--c); border-left-width: 1.75px; border-radius: 12px; padding: 9px 14px; }
.th-cuaderno .ficha-explicacion .lbl { color: var(--c); font-family: var(--font-t); font-size: 12px; }
.th-cuaderno .ficha-explicacion .txt { font-size: 13px; line-height: 1.55; }
.th-cuaderno .ficha-instr { font-style: normal; font-weight: 700; color: #334155; margin-bottom: 12px; }

.th-cuaderno .ficha-actividad { margin-bottom: 9px; padding-bottom: 9px; border-bottom: 2px solid var(--sc, #cbd5e1); }
.th-cuaderno .ficha-actividad:last-of-type { border-bottom: none; }
.cq-sec { display: flex; align-items: center; gap: 10px; margin: 0 0 6px; break-after: avoid; break-inside: avoid; }
.cq-num { flex: 0 0 auto; width: 9.5mm; height: 9.5mm; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-family: var(--font-t); font-weight: 900; font-size: 19px;
  background: linear-gradient(160deg, var(--sc2), var(--sc)); border: 2px solid var(--sc); box-shadow: inset 0 0 0 2.5px #fff; }
.cq-sec h2 { margin: 0; font-family: var(--font-t); font-weight: 900; font-size: 18px; letter-spacing: .01em; word-spacing: .14em; color: var(--sc); text-transform: uppercase; line-height: 1.15; }

.cq-cuerpo { display: block; }
.cq-cuerpo::after { content: ''; display: block; clear: both; }
/* El recuadro flota a la derecha y los ejercicios corren a su lado: así el bloque puede partirse entre páginas (una rejilla de dos columnas no se parte) */
.cq-cuerpo.con-nota > .cq-nota { float: right; width: 50mm; margin: 14px 0 8px 12px; }
.cq-cuerpo.con-nota > ol { display: flow-root; }
.th-cuaderno .ficha-actividad { break-inside: auto; page-break-inside: auto; }
.th-cuaderno .ficha-actividad .ficha-ejercicios { border: none; padding: 0; border-radius: 0; }
.th-cuaderno .ficha-ejercicios > li { margin-bottom: 9px; }
.th-cuaderno .ficha-ejercicios > li::before { color: var(--num); font-weight: 900; }
.th-cuaderno .ficha-ejercicios.letras > li::before { content: counter(ej, upper-alpha) '. '; }
.th-cuaderno .ficha-ejercicios.sin > li::before { content: none; }
.th-cuaderno .ficha-enunciado { font-size: 13.5px; }
.th-cuaderno .ficha-espacio.lines .ln, .th-cuaderno .ficha-espacio.line { border-bottom-color: #1e293b; }

.cq-calculos { margin: 6px 0 2px 2px; }
.cq-fila { display: flex; align-items: baseline; gap: 7px; margin: 0 0 5px; font-size: 14px; }
.cq-fila b { flex: 0 0 5.5mm; font-weight: 900; color: var(--num); }
.cq-val { flex: 0 0 auto; max-width: 100%; }
.cq-calculos:not(.con-caja) .cq-val { min-width: 24mm; }
.cq-eq { flex: 0 0 auto; }
.cq-linea { flex: 1 1 auto; min-width: 16mm; margin-right: 8mm; border-bottom: 1.5px solid #1e293b; height: 1px; transform: translateY(-3px); }
.cq-calculos.con-caja .cq-fila { align-items: center; margin-bottom: 6px; }
.cq-calculos.con-caja .cq-val { flex: 1 1 auto; }
.cq-caja { display: inline-block; flex: 0 0 26mm; height: 8.5mm; border: 1.75px solid var(--num); border-radius: 7px; background: #fff; }
.cq-caja.ancha { display: block; width: 100%; height: 8mm; margin: 3px 0 0; }
.cq-caja.libre { display: block; width: 100%; flex: none; height: 9mm; border: 1.75px solid var(--k); }
.cq-serie { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; margin: 4px 0 0; font-size: 14px; }
.cq-serie i { font-style: normal; color: #475569; }

.cq-nota { position: relative; border: 1.75px dashed var(--k); background: var(--kb); border-radius: 12px; padding: 8px 11px 10px; break-inside: avoid; page-break-inside: avoid; }
.cq-nota.recuerda { --k: #1E88D8; --kb: #EAF5FE; } .cq-nota.reto { --k: #E0900A; --kb: #FFF8E6; } .cq-nota.consejo { --k: #1E88D8; --kb: #EAF5FE; }
.cq-nota-t { text-align: center; font-family: var(--font-t); font-weight: 900; font-size: 14.5px; letter-spacing: .03em; text-transform: uppercase; color: var(--k); margin-bottom: 4px; }
.cq-nota p { margin: 0 0 5px; font-size: 12.2px; line-height: 1.5; color: #1e293b; }
.cq-mascota { position: absolute; line-height: 0; }
.cq-nota.recuerda .cq-mascota { top: -16px; right: -10px; } .cq-nota.reto .cq-mascota { top: -22px; right: -12px; } .cq-nota.consejo .cq-mascota { bottom: -10px; right: -8px; }
.cq-nota.consejo { padding-right: 34px; }
.cq-leyenda { border-collapse: collapse; margin: 0 auto; font-size: 12.2px; } .cq-leyenda td { padding: 1px 5px 1px 0; } .cq-leyenda td:first-child { min-width: 9mm; white-space: nowrap; } .cq-leyenda td:nth-child(2) { width: 4mm; }
.cq-lista { margin: 0; padding-left: 16px; font-size: 12.2px; line-height: 1.5; }
.cq-resp { color: var(--k); font-weight: 900; font-size: 12px; margin: 4px 0 4px; }

.th-cuaderno .ficha-tabla { border-collapse: separate; border-spacing: 0; border: 1.75px solid var(--num); border-radius: 9px; overflow: hidden; font-size: 13.5px; margin-top: 6px; }
.th-cuaderno .ficha-tabla th { text-transform: none; font-size: 13.5px; font-weight: 800; border-width: 0 1.5px 0 0; border-style: solid; border-color: var(--num); padding: 5px 8px; }
.th-cuaderno .ficha-tabla th:last-child { border-right: none; }
.th-cuaderno .ficha-tabla td { border-width: 1.25px 1.5px 0 0; border-style: solid; border-color: color-mix(in srgb, var(--num) 40%, #fff); padding: 4px 10px; }
.th-cuaderno .ficha-tabla td:last-child { border-right: none; }
.th-cuaderno .ficha-tabla td.blank { background: #fff; height: 9mm; }
.th-cuaderno .ficha-opciones li { font-size: 13px; line-height: 1.8; }
.th-cuaderno .ord-item { border-style: solid; border-color: color-mix(in srgb, var(--num) 45%, #fff); }
`;

/** Lo que cada ilustración de este archivo es para el catálogo, para las pruebas. */
export const ILUSTRACIONES_PROPIAS = [...Object.keys(CABECERAS), ...Object.values(MASCOTAS).map(m => m.id)];
