/**
 * Una sesión de Educación Física en PDF, para llevarla impresa a la pista:
 * los datos, el objetivo, los criterios oficiales, las tres partes, el
 * material, la inclusión (DUA-A) y el plan B. Ver `docs/EF.md`.
 */
import { translate, type Lang } from '../i18n';
import type { SesionEF } from '../types/ef';
import { CARPETAS } from '../lib/carpetas';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Cada salto de línea, un párrafo. */
const parrafos = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean).map(x => `<p>${esc(x)}</p>`).join('');

export interface DatosSesionPdf {
  /** Sesión del docente de aula: inicio, desarrollo y cierre en vez de calentamiento, parte principal y vuelta a la calma. */
  aula?: boolean;
  clase?: string;
  /** Ya escrita en el idioma de la app. */
  fecha?: string;
  instalacion?: string;
  /** «EF.1.2: texto del criterio». */
  criterios: string[];
  /** Con qué se evalúa: el nombre, qué es (ya en el idioma de la app) y lo que valora. */
  instrumentos?: { nombre: string; tipo: string; conceptos: string[] }[];
  /** El circuito de la pizarra de circuitos, como imagen SVG. */
  circuito?: { nombre: string; svg: string };
}

export function buildSesionHtml(s: SesionEF, datos: DatosSesionPdf, lang: Lang): string {
  const t = (k: string) => translate(lang, k);
  const bloque = (titulo: string, texto: string, clase = '') =>
    texto.trim() ? `<section class="${clase}"><h2>${esc(t(titulo))}</h2>${parrafos(texto)}</section>` : '';
  const meta = [datos.clase, datos.fecha, datos.instalacion].filter(Boolean).map(x => esc(x!)).join(' · ');
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(s.titulo)}</title><style>
@page { size: A4 portrait; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 12.5px; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { font-size: 21px; margin: 0 0 4px; }
.meta { color: #4b5563; margin: 0 0 12px; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 4px; color: #0f766e; }
section { margin: 0 0 10px; padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 6px; break-inside: avoid; }
section p { margin: 0 0 4px; }
section.dua { border-color: #f59e0b; background: #fffbeb; }
section.planb { border-style: dashed; }
ul { margin: 0; padding-left: 18px; }
.circuito svg { width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 6px; }
.instr { margin: 0 0 6px; }
.instr small { color: #4b5563; }
</style></head><body>
<h1>${esc(s.titulo || t('Sesión'))}</h1>
${meta ? `<p class="meta">${meta}</p>` : ''}
${bloque('Objetivo', s.objetivo)}
${datos.criterios.length ? `<section><h2>${esc(t('Criterios oficiales'))}</h2><ul>${datos.criterios.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>` : ''}
${bloque(datos.aula ? 'Inicio de la sesión' : 'Calentamiento', s.calentamiento)}
${bloque(datos.aula ? 'Desarrollo de la sesión' : 'Parte principal', s.principal)}
${bloque(datos.aula ? 'Cierre de la sesión' : 'Vuelta a la calma', s.calma)}
${bloque(datos.aula ? 'Materiales' : 'Material', s.material)}
${bloque(datos.aula ? 'Medidas de inclusión (DUA)' : 'Para que participe todo el grupo (DUA-A)', s.inclusion, 'dua')}
${bloque('Plan B', s.planB, 'planb')}
${datos.circuito ? `<section class="circuito"><h2>${esc(t('Circuito'))}: ${esc(datos.circuito.nombre)}</h2>${datos.circuito.svg.replace(/ width="\d+" height="\d+"/, '')}</section>` : ''}
${datos.instrumentos?.length ? `<section><h2>${esc(t('Cómo se evalúa'))}</h2>${datos.instrumentos.map(i => `<p class="instr"><strong>${esc(i.nombre)}</strong> <small>(${esc(i.tipo)})</small>${i.conceptos.length ? `<br>${esc(i.conceptos.join(' · '))}` : ''}</p>`).join('')}</section>` : ''}
</body></html>`;
}

export async function guardarSesionPdf(s: SesionEF, datos: DatosSesionPdf, lang: Lang) {
  const docs = window.electronAPI?.docs;
  if (!docs) return { error: 'not-desktop' as const };
  const nombre = (s.titulo || 'sesion').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const res = await docs.savePdf(buildSesionHtml(s, datos, lang), `sesion-ef-${nombre || 'sesion'}.pdf`, { landscape: false, carpeta: CARPETAS.ef });
  if (!res.canceled && !res.error && res.path) docs.reveal(res.path);
  return res;
}
