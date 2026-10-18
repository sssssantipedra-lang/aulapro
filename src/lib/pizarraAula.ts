/**
 * Lógica de «Pizarra y herramientas» que no depende de la pantalla (petición del dueño, 18-10-2026: que la
 * pizarra del aula se parezca a la de Classroomscreen): fondos, escenas guardadas, símbolos de trabajo, dados,
 * reparto en grupos y formato del cronómetro. La pantalla está en `pages/SecClassroom.tsx` y los widgets nuevos,
 * en `components/live/PizarraWidgets.tsx`. Ver `docs/PIZARRA.md`.
 */

/* ── Fondos ── */

export type FondoId = 'blanco' | 'oscuro' | 'pizarra' | 'cielo' | 'atardecer' | 'bosque' | 'crema' | 'lavanda';

export interface Fondo {
  id: FondoId;
  /** En castellano; la pantalla lo traduce con `t`. */
  label: string;
  /** Claro u oscuro: decide los colores del lápiz y de la barra para que se vean. */
  tono: 'claro' | 'oscuro';
  /** Valor de `background` de CSS. */
  css: string;
  /** Con la cuadrícula fina encima, como el cuaderno. */
  cuadricula: boolean;
}

export const FONDOS: Fondo[] = [
  { id: 'blanco',    label: 'Blanco',        tono: 'claro',  css: '#ffffff', cuadricula: true },
  { id: 'crema',     label: 'Papel',         tono: 'claro',  css: '#fbf5e6', cuadricula: false },
  { id: 'cielo',     label: 'Cielo',         tono: 'claro',  css: 'linear-gradient(160deg,#dbeafe,#fef3c7)', cuadricula: false },
  { id: 'lavanda',   label: 'Lavanda',       tono: 'claro',  css: 'linear-gradient(160deg,#ede9fe,#fce7f3)', cuadricula: false },
  { id: 'oscuro',    label: 'Noche',         tono: 'oscuro', css: '#080f21', cuadricula: true },
  { id: 'pizarra',   label: 'Pizarra verde', tono: 'oscuro', css: '#1f4d3a', cuadricula: false },
  { id: 'bosque',    label: 'Bosque',        tono: 'oscuro', css: 'linear-gradient(160deg,#064e3b,#0f766e)', cuadricula: false },
  { id: 'atardecer', label: 'Atardecer',     tono: 'oscuro', css: 'linear-gradient(160deg,#4c1d95,#be185d 55%,#f59e0b)', cuadricula: false },
];

export function fondoPorId(id: unknown): Fondo {
  return FONDOS.find(f => f.id === id) ?? FONDOS[0];
}

/* ── Posición de las ventanas y escenas ── */

export interface Rect { x: number; y: number; width: number; height: number }

export interface VentanaGuardada { id: string; rect: Rect }

/** Una disposición de la pizarra con nombre: qué ventanas hay abiertas, dónde y con qué fondo. */
export interface Escena {
  id: string;
  nombre: string;
  fondo: FondoId;
  ventanas: VentanaGuardada[];
}

export const MAX_ESCENAS = 12;

const esNumero = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

function rectValido(r: unknown): r is Rect {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return esNumero(o.x) && esNumero(o.y) && esNumero(o.width) && esNumero(o.height) && (o.width as number) > 0 && (o.height as number) > 0;
}

/**
 * Lee las ventanas guardadas en el almacenamiento del dispositivo. Lo que llega puede estar roto o venir de otra
 * versión, así que se descarta lo que no sirve (ventanas que ya no existen, medidas absurdas) en vez de fallar.
 */
export function leerVentanas(raw: unknown, idsValidos: readonly string[]): VentanaGuardada[] {
  if (!Array.isArray(raw)) return [];
  const vistos = new Set<string>();
  const out: VentanaGuardada[] = [];
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const { id, rect } = v as { id?: unknown; rect?: unknown };
    if (typeof id !== 'string' || !idsValidos.includes(id) || vistos.has(id) || !rectValido(rect)) continue;
    vistos.add(id);
    out.push({ id, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
  }
  return out;
}

export function leerEscenas(raw: string | null, idsValidos: readonly string[]): Escena[] {
  if (!raw) return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(data)) return [];
  const out: Escena[] = [];
  for (const e of data) {
    if (!e || typeof e !== 'object') continue;
    const { id, nombre, fondo, ventanas } = e as Record<string, unknown>;
    if (typeof id !== 'string' || typeof nombre !== 'string' || !nombre.trim()) continue;
    out.push({ id, nombre: nombre.trim().slice(0, 40), fondo: fondoPorId(fondo).id, ventanas: leerVentanas(ventanas, idsValidos) });
  }
  return out.slice(0, MAX_ESCENAS);
}

/**
 * Mete una ventana en el área visible: una escena guardada en un monitor grande no puede dejar una ventana fuera
 * de la pantalla de un portátil. Si no cabe, la encoge hasta su mínimo.
 */
export function ajustarRect(r: Rect, area: { width: number; height: number }, min: { width: number; height: number }): Rect {
  const width = Math.max(min.width, Math.min(r.width, area.width));
  const height = Math.max(min.height, Math.min(r.height, area.height));
  const x = Math.max(0, Math.min(r.x, Math.max(0, area.width - width)));
  const y = Math.max(0, Math.min(r.y, Math.max(0, area.height - height)));
  return { x, y, width, height };
}

/* ── Símbolos de trabajo ── */

export interface SimboloTrabajo {
  id: string;
  /** En castellano; la pantalla lo traduce con `t`. */
  label: string;
  emoji: string;
  color: string;
}

/** Las consignas de siempre en el aula: cuánto ruido se admite y cómo se trabaja. */
export const SIMBOLOS_TRABAJO: SimboloTrabajo[] = [
  { id: 'silencio',   label: 'Silencio',           emoji: '🤫', color: '#ef4444' },
  { id: 'susurro',    label: 'Susurro',            emoji: '🗣️', color: '#f59e0b' },
  { id: 'voz',        label: 'Voz normal',         emoji: '💬', color: '#22c55e' },
  { id: 'individual', label: 'Trabajo individual', emoji: '✏️', color: '#3b82f6' },
  { id: 'parejas',    label: 'En parejas',         emoji: '👥', color: '#8b5cf6' },
  { id: 'grupos',     label: 'En grupos',          emoji: '🧩', color: '#ec4899' },
  { id: 'mano',       label: 'Levanta la mano',    emoji: '✋', color: '#14b8a6' },
  { id: 'escucha',    label: 'Escuchamos',         emoji: '👂', color: '#64748b' },
];

/* ── Dados ── */

export const MAX_DADOS = 6;

export function tirarDados(cantidad: number, caras = 6, rng: () => number = Math.random): number[] {
  const n = Math.max(1, Math.min(MAX_DADOS, Math.floor(cantidad) || 1));
  const c = Math.max(2, Math.floor(caras) || 6);
  return Array.from({ length: n }, () => Math.min(c, Math.floor(rng() * c) + 1));
}

/* ── Grupos ── */

export interface ReparticionGrupos {
  /** `tamano`: grupos de n personas; `numero`: n grupos. */
  por: 'tamano' | 'numero';
  n: number;
}

/**
 * Reparte los nombres al azar en grupos del mismo tamaño o con un nombre de diferencia como mucho. Con `tamano`
 * se calcula antes cuántos grupos salen, así nunca queda una persona sola cuando se pedían grupos de cuatro.
 */
export function repartirGrupos(nombres: string[], reparto: ReparticionGrupos, rng: () => number = Math.random): string[][] {
  const lista = nombres.map(n => n.trim()).filter(Boolean);
  if (lista.length === 0) return [];
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  const n = Math.max(1, Math.floor(reparto.n) || 1);
  const cuantos = reparto.por === 'numero' ? n : Math.ceil(lista.length / n);
  const k = Math.max(1, Math.min(cuantos, lista.length));
  const grupos: string[][] = Array.from({ length: k }, () => []);
  lista.forEach((nombre, i) => grupos[i % k].push(nombre));
  return grupos;
}

/* ── Cronómetro ── */

/** `MM:SS.cc` por debajo de la hora y `H:MM:SS` a partir de ella. */
export function formatoCrono(ms: number): string {
  const total = Number.isFinite(ms) ? Math.max(0, Math.floor(ms)) : 0;
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  const dos = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}.${dos(cs)}`;
}

/* ── Código QR ── */

/** Añade `https://` si el docente escribe solo `aulapro.app`; un texto libre o un esquema ya puesto se queda como está. */
export function direccionParaQr(raw: string): string {
  const t = raw.trim();
  if (/^(https?|mailto|tel|wifi):/i.test(t)) return t;
  return /^[^\s/]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(t) ? `https://${t}` : t;
}
