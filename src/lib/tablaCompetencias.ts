/**
 * La tabla de competencias clave de un informe competencial: una fila por
 * competencia con su valoración (bien, mejorable o mal) y un comentario muy
 * breve. La IA la devuelve tras el texto, detrás de una marca; el código la
 * separa y se queda solo con competencias y valoraciones válidas.
 */
import { LOMLOE_COMPETENCES } from './utils';

export type Valoracion = 'bien' | 'mejorable' | 'mal';
export interface FilaCompetencia { clave: string; valoracion: Valoracion; comentario: string }

export const MARCA_TABLA = '###TABLA###';
const VALORACIONES: Valoracion[] = ['bien', 'mejorable', 'mal'];
const MAX_COMENTARIO = 140;

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
    const valoracion = typeof o.valoracion === 'string' ? o.valoracion.trim().toLowerCase() as Valoracion : 'bien';
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

const COLOR: Record<Valoracion, string> = { bien: '#15803d', mejorable: '#b45309', mal: '#b91c1c' };
const ESC = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

/** La tabla como HTML para el PDF y la vista previa; vacío si no hay filas. */
export function tablaCompetenciasHtml(
  tabla: FilaCompetencia[] | undefined, t: (k: string) => string, etiqueta: (clave: string) => string,
): string {
  if (!tabla?.length) return '';
  const filas = tabla.map(f => `<tr><th scope="row">${ESC(f.clave)}<span>${ESC(etiqueta(f.clave))}</span></th>`
    + `<td class="val" style="color:${COLOR[f.valoracion]}">${ESC(t(NOMBRE[f.valoracion]))}</td><td>${ESC(f.comentario)}</td></tr>`).join('');
  return `<table class="comp"><thead><tr><th>${ESC(t('Competencia clave'))}</th><th>${ESC(t('Valoración'))}</th><th>${ESC(t('Comentario'))}</th></tr></thead><tbody>${filas}</tbody></table>`;
}

/** Textos de las valoraciones, que `t` traduce. */
export const NOMBRE: Record<Valoracion, string> = { bien: 'Bien', mejorable: 'Mejorable', mal: 'Mal' };
export const COLOR_VALORACION = COLOR;

/* ── Valoración calculada por el código a partir de las notas reales ── */

/** Bien desde 3 sobre 4, mejorable desde 2, mal por debajo. */
export function valoracionDeNota(nota: number): Valoracion {
  return nota >= 3 ? 'bien' : nota >= 2 ? 'mejorable' : 'mal';
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
