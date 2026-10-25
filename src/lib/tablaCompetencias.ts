/**
 * La tabla de competencias clave de un informe competencial: una fila por
 * competencia con su valoración (excelente, bien o necesita mejorar) y un
 * comentario de dos frases. La IA la devuelve tras el texto, detrás de una marca; el código la
 * separa y se queda solo con competencias y valoraciones válidas.
 */
import { LOMLOE_COMPETENCES } from './utils';

export type Valoracion = 'excelente' | 'bien' | 'mejorable';
/** `mal` solo lo traen los informes de la 2.18.17. */
export interface FilaCompetencia { clave: string; valoracion: Valoracion | 'mal'; comentario: string }

export const MARCA_TABLA = '###TABLA###';
const VALORACIONES: Valoracion[] = ['excelente', 'bien', 'mejorable'];
const MAX_COMENTARIO = 320;

/** Las valoraciones de antes («mal») pasan a «necesita mejorar»; lo desconocido, también. */
export const normalizarValoracion = (v: unknown): Valoracion =>
  VALORACIONES.includes(v as Valoracion) ? v as Valoracion : 'mejorable';

/** Separa lo que devuelve la IA en el texto del informe y su tabla; sin marca o con tabla rota, solo el texto. */
export function separarInforme(raw: string): { texto: string; tabla: FilaCompetencia[] } {
  const i = raw.indexOf(MARCA_TABLA);
  if (i < 0) return { texto: raw.trim(), tabla: [] };
  const texto = raw.slice(0, i).trim();
  let datos: unknown;
  try { datos = JSON.parse(raw.slice(i + MARCA_TABLA.length).replace(/```json?|```/g, '').trim()); } catch { return { texto, tabla: [] }; }
  const lista = Array.isArray(datos) ? datos : [];
  const claves = new Set<string>(LOMLOE_COMPETENCES.map(c => c.key));
  const vistas = new Set<string>();
  const tabla: FilaCompetencia[] = [];
  for (const f of lista) {
    const o = (f ?? {}) as Record<string, unknown>;
    const clave = typeof o.clave === 'string' ? o.clave.trim().toUpperCase() : '';
    const bruta = typeof o.valoracion === 'string' ? o.valoracion.trim().toLowerCase() : '';
    const valoracion = bruta === 'mal' ? 'mejorable' : bruta as Valoracion;
    if (!claves.has(clave) || vistas.has(clave) || !VALORACIONES.includes(valoracion)) continue;
    const comentario = typeof o.comentario === 'string' ? o.comentario.replace(/\s+/g, ' ').trim().slice(0, MAX_COMENTARIO) : '';
    if (!comentario) continue;
    vistas.add(clave);
    tabla.push({ clave, valoracion, comentario });
  }
  // En el orden oficial de las competencias
  const orden = LOMLOE_COMPETENCES.map(c => c.key as string);
  tabla.sort((a, b) => orden.indexOf(a.clave) - orden.indexOf(b.clave));
  return { texto, tabla };
}

const COLOR: Record<Valoracion, string> = { excelente: '#15803d', bien: '#1d4ed8', mejorable: '#b45309' };
const ESC = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

/** La tabla como HTML para el PDF y la vista previa; vacío si no hay filas. */
export function tablaCompetenciasHtml(
  tabla: FilaCompetencia[] | undefined, t: (k: string) => string, etiqueta: (clave: string) => string,
): string {
  if (!tabla?.length) return '';
  const filas = tabla.map(f => `<tr><th scope="row">${ESC(f.clave)}<span>${ESC(etiqueta(f.clave))}</span></th>`
    + `<td class="val" style="color:${COLOR[normalizarValoracion(f.valoracion)]}">${ESC(t(NOMBRE[normalizarValoracion(f.valoracion)]))}</td><td>${ESC(f.comentario)}</td></tr>`).join('');
  return `<table class="comp"><thead><tr><th>${ESC(t('Competencia clave'))}</th><th>${ESC(t('Valoración'))}</th><th>${ESC(t('Comentario'))}</th></tr></thead><tbody>${filas}</tbody></table>`;
}

/** Textos de las valoraciones, que `t` traduce. */
export const NOMBRE: Record<Valoracion, string> = { excelente: 'Excelente', bien: 'Bien', mejorable: 'Necesita mejorar' };
export const COLOR_VALORACION = COLOR;

/* ── Valoración calculada por el código a partir de las notas reales ── */

/** Excelente desde 3,5 sobre 4 (el nivel más alto al redondear), bien desde 2,5, necesita mejorar por debajo. */
export function valoracionDeNota(nota: number): Valoracion {
  return nota >= 3.5 ? 'excelente' : nota >= 2.5 ? 'bien' : 'mejorable';
}

/** Media (1 a 4) de cada competencia clave en las evaluaciones del alumno; solo las que tienen nota. */
export function notasPorClave(evaluaciones: { competencyScores?: Record<string, number> }[]): Record<string, number> {
  const suma: Record<string, { s: number; n: number }> = {};
  for (const ev of evaluaciones) {
    for (const [k, v] of Object.entries(ev.competencyScores ?? {})) {
      if (typeof v !== 'number' || !(v > 0)) continue;
      const a = (suma[k.toUpperCase()] ??= { s: 0, n: 0 });
      a.s += v; a.n++;
    }
  }
  return Object.fromEntries(Object.entries(suma).map(([k, a]) => [k, Math.round((a.s / a.n) * 10) / 10]));
}

/** Las líneas de las notas, para que la IA escriba el comentario de acuerdo con ellas. */
export function lineasDeClave(notas: Record<string, number>, en: boolean): string[] {
  return Object.entries(notas).map(([k, v]) => `- ${k}: ${String(v).replace('.', en ? '.' : ',')}/4 (${valoracionDeNota(v)})`);
}

/** La valoración de las competencias con nota la fija el código; la IA solo escribe el comentario (y valora las que no tienen nota). */
export function aplicarNotas(tabla: FilaCompetencia[], notas: Record<string, number>): FilaCompetencia[] {
  return tabla.map(f => (f.clave in notas ? { ...f, valoracion: valoracionDeNota(notas[f.clave]) } : f));
}
