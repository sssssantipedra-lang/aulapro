/**
 * La pizarra de circuitos de Educación Física (petición del dueño,
 * 17-10-2026): un banco de material en imágenes que se coloca sobre una pista,
 * y un reconocedor de lo que se dibuja a mano alzada. Ver `docs/EF.md`.
 *
 * Las imágenes del banco las dibuja el código (SVG), no un modelo de imagen:
 * pesan casi nada, se ven nítidas a cualquier tamaño y salen igual en pantalla,
 * en el PNG y en lo que se envía a la IA. Las coordenadas de la pizarra van de
 * 0 a `ANCHO_PIZARRA` y de 0 a `ALTO_PIZARRA`.
 */
import type { ElementoPizarra, MaterialPizarraId, PizarraEF, TrazoPizarra } from '../types/ef';

export const ANCHO_PIZARRA = 1000;
export const ALTO_PIZARRA = 600;

export interface MaterialPizarra {
  id: MaterialPizarraId;
  /** En castellano; la pantalla lo traduce con `t`. */
  label: string;
  /** Qué es, para la IA y para el docente. */
  descripcion: string;
  /** Tamaño de partida (escala 1) en unidades de pizarra; el dibujo se hace en esa caja. */
  ancho: number;
  alto: number;
  /** El dibujo, en una caja de `ancho` × `alto`. `texto` solo lo usa la estación. */
  svg: (texto?: string) => string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const rango = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i)).join('');

export const MATERIALES_PIZARRA: readonly MaterialPizarra[] = [
  {
    id: 'cono', label: 'Cono', descripcion: 'Cono de plástico, para marcar salidas, giros y recorridos (se ve como un triángulo).',
    ancho: 44, alto: 44,
    svg: () => '<ellipse cx="22" cy="38" rx="18" ry="5" fill="#9a3412" opacity=".3"/>' +
      '<path d="M22 4 L36 38 L8 38 Z" fill="#f97316" stroke="#c2410c" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M14 26 H30 M17 18 H27" stroke="#fff" stroke-width="3"/>',
  },
  {
    id: 'seta', label: 'Seta o marcador plano', descripcion: 'Disco o seta baja, para marcar posiciones en el suelo (se ve como un círculo pequeño).',
    ancho: 40, alto: 40,
    svg: () => '<ellipse cx="20" cy="22" rx="18" ry="9" fill="#facc15" stroke="#a16207" stroke-width="2"/>' +
      '<ellipse cx="20" cy="20" rx="8" ry="3.5" fill="#fde68a"/>',
  },
  {
    id: 'aro', label: 'Aro', descripcion: 'Aro plano en el suelo, para saltar, entrar y salir o marcar una base (se ve como un círculo grande).',
    ancho: 70, alto: 70,
    svg: () => '<circle cx="35" cy="35" r="29" fill="none" stroke="#2563eb" stroke-width="7"/>' +
      '<circle cx="35" cy="35" r="32" fill="none" stroke="#93c5fd" stroke-width="1.5"/>',
  },
  {
    id: 'pica', label: 'Pica', descripcion: 'Palo o pica con base, para slalom o para sostener una cuerda (se ve como una línea corta).',
    ancho: 20, alto: 110,
    svg: () => '<rect x="8" y="4" width="4" height="96" rx="2" fill="#ef4444"/>' +
      '<path d="M8 20 H12 M8 44 H12 M8 68 H12" stroke="#fff" stroke-width="6"/>' +
      '<ellipse cx="10" cy="102" rx="9" ry="4" fill="#475569"/>',
  },
  {
    id: 'valla', label: 'Valla baja', descripcion: 'Valla de atletismo o de agilidad, para saltarla (dos patas y una barra).',
    ancho: 90, alto: 50,
    svg: () => '<path d="M12 46 V14 M78 46 V14" stroke="#475569" stroke-width="5"/>' +
      '<path d="M2 46 H24 M66 46 H88" stroke="#475569" stroke-width="5" stroke-linecap="round"/>' +
      '<rect x="6" y="10" width="78" height="9" rx="2" fill="#f59e0b" stroke="#b45309" stroke-width="2"/>',
  },
  {
    id: 'colchoneta', label: 'Colchoneta', descripcion: 'Colchoneta para rodar, saltar o caer con seguridad (rectángulo ancho).',
    ancho: 120, alto: 64,
    svg: () => '<rect x="2" y="2" width="116" height="60" rx="8" fill="#34d399" stroke="#047857" stroke-width="2"/>' +
      '<path d="M40 5 V59 M80 5 V59" stroke="#047857" stroke-width="2" opacity=".5" stroke-dasharray="4 4"/>',
  },
  {
    id: 'banco', label: 'Banco sueco', descripcion: 'Banco largo y estrecho, para andar en equilibrio, saltar o trepar (rectángulo muy alargado).',
    ancho: 160, alto: 36,
    svg: () => '<rect x="2" y="6" width="156" height="12" rx="3" fill="#fbbf24" stroke="#92400e" stroke-width="2"/>' +
      '<rect x="14" y="18" width="8" height="14" fill="#92400e"/><rect x="138" y="18" width="8" height="14" fill="#92400e"/>' +
      '<path d="M8 32 H28 M132 32 H152" stroke="#92400e" stroke-width="4" stroke-linecap="round"/>',
  },
  {
    id: 'escalera', label: 'Escalera de agilidad', descripcion: 'Escalera plana en el suelo, para pies rápidos (rectángulo alargado con peldaños).',
    ancho: 180, alto: 44,
    svg: () => '<path d="M2 6 H178 M2 38 H178" stroke="#475569" stroke-width="4" stroke-linecap="round"/>' +
      rango(9, i => `<path d="M${14 + i * 19} 6 V38" stroke="#f97316" stroke-width="4"/>`),
  },
  {
    id: 'balon', label: 'Balón', descripcion: 'Balón o pelota (círculo pequeño con manchas).',
    ancho: 36, alto: 36,
    svg: () => '<circle cx="18" cy="18" r="16" fill="#f8fafc" stroke="#1e293b" stroke-width="2"/>' +
      '<path d="M18 9 L26 15 L23 24 H13 L10 15 Z" fill="#1e293b"/>' +
      '<path d="M18 9 V3 M26 15 L33 12 M23 24 L28 30 M13 24 L8 30 M10 15 L3 12" stroke="#1e293b" stroke-width="1.5"/>',
  },
  {
    id: 'porteria', label: 'Portería', descripcion: 'Portería de fútbol sala o balonmano, con red (marco abierto por abajo).',
    ancho: 140, alto: 70,
    svg: () => rango(11, i => `<path d="M${12 + i * 11.6} 10 V66" stroke="#cbd5e1" stroke-width="1.5"/>`) +
      rango(5, i => `<path d="M8 ${20 + i * 11} H132" stroke="#cbd5e1" stroke-width="1.5"/>`) +
      '<path d="M6 68 V8 H134 V68" fill="none" stroke="#334155" stroke-width="6" stroke-linejoin="round"/>',
  },
  {
    id: 'canasta', label: 'Canasta', descripcion: 'Canasta de baloncesto con su tablero.',
    ancho: 60, alto: 60,
    svg: () => '<rect x="8" y="2" width="44" height="28" rx="2" fill="#fff" stroke="#334155" stroke-width="3"/>' +
      '<rect x="22" y="14" width="16" height="12" fill="none" stroke="#ef4444" stroke-width="2"/>' +
      '<ellipse cx="30" cy="36" rx="16" ry="4" fill="none" stroke="#ef4444" stroke-width="3"/>' +
      '<path d="M15 37 L23 56 M45 37 L37 56 M30 40 V56 M23 56 H37" stroke="#94a3b8" stroke-width="1.5" fill="none"/>',
  },
  {
    id: 'cajon', label: 'Cajón o plinto', descripcion: 'Cajón de salto de varios cuerpos, para saltar o subir (cuadrado grueso).',
    ancho: 80, alto: 60,
    svg: () => '<rect x="6" y="40" width="68" height="16" rx="2" fill="#d97706" stroke="#78350f" stroke-width="2"/>' +
      '<rect x="12" y="26" width="56" height="14" rx="2" fill="#f59e0b" stroke="#78350f" stroke-width="2"/>' +
      '<rect x="18" y="8" width="44" height="18" rx="4" fill="#7c2d12" stroke="#431407" stroke-width="2"/>',
  },
  {
    id: 'cuerda', label: 'Cuerda o comba', descripcion: 'Cuerda o comba (línea ondulada con dos asas).',
    ancho: 100, alto: 40,
    svg: () => '<path d="M8 30 C22 2 42 40 60 16 S90 30 92 10" fill="none" stroke="#a855f7" stroke-width="5" stroke-linecap="round"/>' +
      '<circle cx="8" cy="30" r="5" fill="#6b21a8"/><circle cx="92" cy="10" r="5" fill="#6b21a8"/>',
  },
  {
    id: 'red', label: 'Red de voleibol', descripcion: 'Red con dos postes, para voleibol, bádminton o juegos de red.',
    ancho: 200, alto: 70,
    svg: () => '<rect x="13" y="8" width="174" height="26" fill="#e2e8f0" stroke="#64748b" stroke-width="1.5"/>' +
      rango(17, i => `<path d="M${22 + i * 10} 8 V34" stroke="#94a3b8" stroke-width="1"/>`) +
      rango(2, i => `<path d="M13 ${17 + i * 8.5} H187" stroke="#94a3b8" stroke-width="1"/>`) +
      '<rect x="13" y="6" width="174" height="5" fill="#fff" stroke="#64748b" stroke-width="1.5"/>' +
      '<rect x="6" y="2" width="7" height="64" rx="2" fill="#475569"/><rect x="187" y="2" width="7" height="64" rx="2" fill="#475569"/>',
  },
  {
    id: 'diana', label: 'Diana de lanzamiento', descripcion: 'Diana o blanco, para lanzar (círculos concéntricos).',
    ancho: 56, alto: 56,
    svg: () => '<circle cx="28" cy="28" r="26" fill="#ef4444" stroke="#7f1d1d" stroke-width="2"/>' +
      '<circle cx="28" cy="28" r="20" fill="#fff"/><circle cx="28" cy="28" r="14" fill="#ef4444"/>' +
      '<circle cx="28" cy="28" r="8" fill="#fff"/><circle cx="28" cy="28" r="3.5" fill="#ef4444"/>',
  },
  {
    id: 'espaldera', label: 'Espaldera', descripcion: 'Espaldera de pared, para trepar o hacer fuerza (marco con travesaños).',
    ancho: 100, alto: 120,
    svg: () => rango(9, i => `<path d="M6 ${14 + i * 12} H94" stroke="#b45309" stroke-width="4"/>`) +
      '<rect x="4" y="4" width="92" height="112" rx="3" fill="none" stroke="#92400e" stroke-width="6"/>',
  },
  {
    id: 'estacion', label: 'Estación', descripcion: 'Número de estación del circuito (círculo con un número o una letra).',
    ancho: 44, alto: 44,
    svg: texto => '<circle cx="22" cy="22" r="20" fill="#7c3aed" stroke="#4c1d95" stroke-width="2"/>' +
      `<text x="22" y="30" text-anchor="middle" font-family="sans-serif" font-size="${(texto ?? '').length > 1 ? 18 : 24}" font-weight="700" fill="#fff">${esc(texto ?? '')}</text>`,
  },
];

export const IDS_MATERIAL_PIZARRA = MATERIALES_PIZARRA.map(m => m.id);

export function materialDePizarra(id: MaterialPizarraId): MaterialPizarra {
  return MATERIALES_PIZARRA.find(m => m.id === id) ?? MATERIALES_PIZARRA[0];
}

/** Los colores de los trazos, con nombre para que no dependan solo del color. */
export const COLORES_TRAZO = [
  { id: '#1e293b', label: 'Negro' },
  { id: '#dc2626', label: 'Rojo' },
  { id: '#2563eb', label: 'Azul' },
  { id: '#16a34a', label: 'Verde' },
] as const;

/* ── Qué hay en la pizarra ── */

/** El material que hace falta para el circuito dibujado: cuántas piezas de cada, sin contar las estaciones. */
export function materialDeLaPizarra(elementos: readonly ElementoPizarra[]): { material: MaterialPizarraId; n: number }[] {
  const cuenta = new Map<MaterialPizarraId, number>();
  for (const e of elementos) if (e.material !== 'estacion') cuenta.set(e.material, (cuenta.get(e.material) ?? 0) + 1);
  return MATERIALES_PIZARRA.filter(m => cuenta.has(m.id)).map(m => ({ material: m.id, n: cuenta.get(m.id)! }));
}

/** El número de la siguiente estación: 1, 2, 3… según las que hay. */
export function siguienteEstacion(elementos: readonly ElementoPizarra[]): string {
  const usados = new Set(elementos.filter(e => e.material === 'estacion').map(e => e.texto));
  let n = 1;
  while (usados.has(String(n))) n++;
  return String(n);
}

const limita = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Un elemento nuevo con el tamaño de partida, dentro de la pizarra. */
export function elementoNuevo(id: string, material: MaterialPizarraId, x: number, y: number, texto?: string): ElementoPizarra {
  return {
    id, material, x: limita(Math.round(x), 0, ANCHO_PIZARRA), y: limita(Math.round(y), 0, ALTO_PIZARRA), giro: 0, escala: 1,
    ...(texto ? { texto } : {}),
  };
}

/* ── Reconocer lo que se dibuja ── */

export interface Caja { x: number; y: number; w: number; h: number }
export type FormaDibujada = 'triangulo' | 'rectangulo' | 'circulo' | 'linea' | 'otra';

export interface AnalisisTrazo {
  forma: FormaDibujada;
  /** De más a menos probable. Una forma sola no basta para saber qué es: se propone y el docente confirma. */
  candidatos: MaterialPizarraId[];
  caja: Caja;
}

type Punto = readonly [number, number];
const distancia = (a: Punto, b: Punto) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function longitud(p: readonly Punto[]): number {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += distancia(p[i - 1], p[i]);
  return l;
}

export function cajaDe(p: readonly Punto[]): Caja {
  const xs = p.map(q => q[0]);
  const ys = p.map(q => q[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Distancia de un punto al segmento a-b. */
function aSegmento(p: Punto, a: Punto, b: Punto): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return distancia(p, a);
  const t = limita(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1);
  return distancia(p, [a[0] + t * dx, a[1] + t * dy]);
}

/** Douglas-Peucker: la línea con solo sus esquinas. */
function simplificar(p: readonly Punto[], eps: number): Punto[] {
  if (p.length < 3) return [...p];
  let max = 0;
  let idx = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const d = aSegmento(p[i], p[0], p[p.length - 1]);
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [p[0], p[p.length - 1]];
  return [...simplificar(p.slice(0, idx + 1), eps).slice(0, -1), ...simplificar(p.slice(idx), eps)];
}

function area(p: readonly Punto[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i][0] * q[1] - q[0] * p[i][1];
  }
  return Math.abs(a) / 2;
}

/**
 * Qué forma es un trazo a mano alzada y qué material puede ser. Se apoya en la
 * forma (triángulo, rectángulo, círculo, raya) y en el tamaño y las
 * proporciones; no sabe más que eso, así que una forma que pueda ser varias
 * cosas (un círculo es un aro, un balón o una seta) devuelve varias, y el
 * docente elige. Devuelve `null` si el trazo es demasiado corto.
 */
export function analizarTrazo(puntos: readonly Punto[]): AnalisisTrazo | null {
  if (puntos.length < 4) return null;
  const caja = cajaDe(puntos);
  const largo = longitud(puntos);
  const diag = Math.hypot(caja.w, caja.h);
  if (largo < 14 || diag < 10) return null;

  const hueco = distancia(puntos[0], puntos[puntos.length - 1]);
  const cerrado = hueco < 0.22 * largo;
  const ladoMayor = Math.max(caja.w, caja.h);
  const ladoMenor = Math.max(1, Math.min(caja.w, caja.h));

  if (!cerrado) {
    const recta = puntos.every(q => aSegmento(q, puntos[0], puntos[puntos.length - 1]) < 0.12 * hueco);
    if (recta) return { forma: 'linea', candidatos: ladoMayor <= 170 ? ['pica', 'cuerda', 'banco'] : ['banco', 'cuerda', 'escalera'], caja };
    return { forma: 'otra', candidatos: ['cuerda'], caja };
  }

  const cerrada = [...puntos, puntos[0]];
  const circularidad = (4 * Math.PI * area(puntos)) / (longitud(cerrada) ** 2);
  const esquinas = simplificar(cerrada, 0.07 * diag).length - 1;
  const proporcion = ladoMayor / ladoMenor;
  const lado = (caja.w + caja.h) / 2;

  if (circularidad > 0.8 && proporcion < 1.5) {
    if (lado < 30) return { forma: 'circulo', candidatos: ['seta', 'balon', 'cono'], caja };
    if (lado < 58) return { forma: 'circulo', candidatos: ['balon', 'diana', 'aro', 'seta'], caja };
    return { forma: 'circulo', candidatos: ['aro', 'diana', 'balon'], caja };
  }
  if (esquinas === 3) return { forma: 'triangulo', candidatos: ['cono'], caja };
  if (esquinas === 4) {
    if (proporcion >= 4) return { forma: 'rectangulo', candidatos: ['banco', 'escalera', 'red'], caja };
    if (proporcion >= 1.7) {
      return { forma: 'rectangulo', candidatos: ladoMenor >= 50 ? ['colchoneta', 'porteria', 'valla', 'escalera'] : ['escalera', 'valla', 'banco', 'porteria'], caja };
    }
    return { forma: 'rectangulo', candidatos: ladoMayor >= 70 ? ['colchoneta', 'espaldera', 'cajon'] : ['cajon', 'colchoneta', 'diana'], caja };
  }
  if (circularidad > 0.65) return { forma: 'circulo', candidatos: ['aro', 'balon', 'diana'], caja };
  return { forma: 'otra', candidatos: ['cuerda'], caja };
}

/**
 * El elemento que sustituye a un trazo reconocido: en el centro del dibujo, con
 * su tamaño y, si lo dibujado está tumbado y el material está de pie (o al
 * revés), girado un cuarto de vuelta.
 */
export function elementoDeTrazo(id: string, material: MaterialPizarraId, caja: Caja, texto?: string): ElementoPizarra {
  const m = materialDePizarra(material);
  const largoMaterial = Math.max(m.ancho, m.alto);
  const tumbadoMaterial = m.ancho >= m.alto;
  const tumbadoDibujo = caja.w >= caja.h;
  const alargado = Math.max(m.ancho, m.alto) / Math.min(m.ancho, m.alto) > 1.3;
  return {
    ...elementoNuevo(id, material, caja.x + caja.w / 2, caja.y + caja.h / 2, texto),
    giro: alargado && tumbadoMaterial !== tumbadoDibujo ? 90 : 0,
    escala: Math.round(limita(Math.max(caja.w, caja.h) / largoMaterial, 0.5, 3) * 100) / 100,
  };
}

/* ── Duplicar y elegir, como en Canva ── */

/** Cuánto se desplaza una copia cuando no hay otra distancia que repetir. */
export const DESPLAZAMIENTO_COPIA = 24;

/**
 * Copias de las piezas elegidas, movidas `dx`, `dy`. Si una copia se saldría de
 * la pizarra, rebota hacia el otro lado en lugar de quedarse encima de la
 * original (que no se vería), o se queda en el borde si `rebotar` es falso.
 * Las estaciones siguen la numeración: la copia de la 2 es la siguiente libre.
 */
export function copiarElementos(
  todos: readonly ElementoPizarra[], ids: readonly string[], dx: number, dy: number, nuevoId: () => string, rebotar = true,
): ElementoPizarra[] {
  const origen = todos.filter(e => ids.includes(e.id));
  const sale = (v: number, d: number, max: number) => v + d < 0 || v + d > max;
  // Si una pieza rebota, rebota todo el grupo: no se parte
  const fx = rebotar && origen.some(e => sale(e.x, dx, ANCHO_PIZARRA)) ? -dx : dx;
  const fy = rebotar && origen.some(e => sale(e.y, dy, ALTO_PIZARRA)) ? -dy : dy;
  const copias: ElementoPizarra[] = [];
  for (const e of origen) {
    const copia: ElementoPizarra = { ...e, id: nuevoId(), x: limita(Math.round(e.x + fx), 0, ANCHO_PIZARRA), y: limita(Math.round(e.y + fy), 0, ALTO_PIZARRA) };
    if (e.material === 'estacion') copia.texto = siguienteEstacion([...todos, ...copias]);
    copias.push(copia);
  }
  return copias;
}

/** Las piezas cuyo centro cae dentro del recuadro. */
export function elementosEnCaja(todos: readonly ElementoPizarra[], caja: Caja): string[] {
  return todos.filter(e => e.x >= caja.x && e.x <= caja.x + caja.w && e.y >= caja.y && e.y <= caja.y + caja.h).map(e => e.id);
}

/** El recuadro que ocupan las piezas (con su giro y su escala), para colocar la barra flotante. */
export function cajaDeElementos(elementos: readonly ElementoPizarra[]): Caja | null {
  if (!elementos.length) return null;
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const e of elementos) {
    const m = materialDePizarra(e.material);
    const a = (e.giro * Math.PI) / 180;
    const w = (Math.abs(m.ancho * Math.cos(a)) + Math.abs(m.alto * Math.sin(a))) * e.escala;
    const h = (Math.abs(m.ancho * Math.sin(a)) + Math.abs(m.alto * Math.cos(a))) * e.escala;
    x0 = Math.min(x0, e.x - w / 2); x1 = Math.max(x1, e.x + w / 2);
    y0 = Math.min(y0, e.y - h / 2); y1 = Math.max(y1, e.y + h / 2);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/* ── Imagen de la pizarra ── */

const transformDe = (e: ElementoPizarra, m: MaterialPizarra) =>
  `translate(${e.x} ${e.y}) rotate(${e.giro}) scale(${e.escala}) translate(${-m.ancho / 2} ${-m.alto / 2})`;

/** Puntos de un trazo como atributo `points`. */
export const puntosSvg = (p: readonly Punto[]) => p.map(q => `${Math.round(q[0])},${Math.round(q[1])}`).join(' ');

/** La cabeza de una flecha en el último punto del trazo. */
export function cabezaFlecha(p: readonly Punto[]): string {
  if (p.length < 2) return '';
  const a = p[p.length - 2];
  const b = p[p.length - 1];
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const l = 16;
  const pt = (d: number): Punto => [b[0] - l * Math.cos(ang + d), b[1] - l * Math.sin(ang + d)];
  return puntosSvg([pt(0.45), b, pt(-0.45)]);
}

/** Lo que se ve de un trazo, como marcas SVG. */
export function trazoSvg(t: TrazoPizarra): string {
  const linea = `<polyline points="${puntosSvg(t.puntos)}" fill="none" stroke="${t.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  return t.tipo === 'flecha'
    ? linea + `<polyline points="${cabezaFlecha(t.puntos)}" fill="none" stroke="${t.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
    : linea;
}

/** La pizarra entera como un SVG suelto: para descargarla como imagen. */
export function pizarraSvg(p: Pick<PizarraEF, 'elementos' | 'trazos'>): string {
  const elementos = p.elementos.map(e => {
    const m = materialDePizarra(e.material);
    return `<g transform="${transformDe(e, m)}">${m.svg(e.texto)}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO_PIZARRA} ${ALTO_PIZARRA}" width="${ANCHO_PIZARRA}" height="${ALTO_PIZARRA}">` +
    `<rect width="${ANCHO_PIZARRA}" height="${ALTO_PIZARRA}" fill="#f8fafc"/>${p.trazos.map(trazoSvg).join('')}${elementos}</svg>`;
}

export { transformDe as transformDeElemento };
