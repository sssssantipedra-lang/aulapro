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
  /** Con qué se evalúa: el nombre, qué es y su contenido completo en HTML (tabla o dibujo). */
  instrumentos?: { nombre: string; tipo: string; html: string }[];
  /** El circuito de la pizarra de circuitos, como imagen SVG. */
  circuito?: { nombre: string; svg: string };
}

export function buildSesionHtml(s: SesionEF, datos: DatosSesionPdf, lang: Lang): string {
  const t = (k: string) => translate(lang, k);

  // Ficha de cabecera: solo lo que se ha rellenado, en una tabla.
  const ficha: [string, string][] = ([
    [t('Clase'), datos.clase ?? ''],
    [t('Fecha'), datos.fecha ?? ''],
    [t('Instalación'), datos.instalacion ?? ''],
  ] as [string, string][]).filter(([, v]) => v);

  // Las tres partes, en una tabla (Fase | Desarrollo).
  const fases: [string, string][] = ([
    [t(datos.aula ? 'Inicio de la sesión' : 'Calentamiento'), s.calentamiento],
    [t(datos.aula ? 'Desarrollo de la sesión' : 'Parte principal'), s.principal],
    [t(datos.aula ? 'Cierre de la sesión' : 'Vuelta a la calma'), s.calma],
  ] as [string, string][]).filter(([, v]) => v.trim());

  const instrumentos = datos.instrumentos ?? [];

  const seccion = (titulo: string, cuerpo: string, clase = '') =>
    cuerpo.trim() ? `<section class="${clase}"><h2>${esc(t(titulo))}</h2>${cuerpo}</section>` : '';

  const tablaFicha = ficha.length
    ? `<table class="ficha"><tbody>${ficha.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`
    : '';

  const tablaFases = fases.length
    ? `<table class="fases"><tbody>${fases.map(([fase, texto]) =>
        `<tr><th>${esc(fase)}</th><td>${parrafos(texto)}</td></tr>`).join('')}</tbody></table>`
    : '';

  const criterios = datos.criterios.length
    ? `<table class="criterios"><tbody>${datos.criterios.map(c => `<tr><td>${esc(c)}</td></tr>`).join('')}</tbody></table>`
    : '';

  const tablaInstrumentos = instrumentos.length
    ? instrumentos.map(i =>
        `<div class="instr"><h3>${esc(i.nombre)} <small>${esc(i.tipo)}</small></h3>${i.html}</div>`).join('')
    : '';

  // Las imágenes que el docente pegó en la sesión: solo `data:` de imagen (lo único que se guarda), con su pie de foto
  const imagenes = (s.imagenes ?? []).filter(i => /^data:image\/(jpeg|png|webp|gif);base64,/.test(i.src));
  const galeria = imagenes.length
    ? `<section class="imagenes"><h2>${esc(t('Imágenes'))}</h2><div class="rejilla${imagenes.length === 1 ? ' una' : ''}">${imagenes.map(i =>
        `<figure><img src="${i.src}" alt="${esc(i.pie ?? '')}">${i.pie ? `<figcaption>${esc(i.pie)}</figcaption>` : ''}</figure>`).join('')}</div></section>`
    : '';

  const circuito = datos.circuito
    ? `<section class="circuito"><h2>${esc(t('Circuito'))} · ${esc(datos.circuito.nombre)}</h2>${datos.circuito.svg.replace(/ width="\d+" height="\d+"/, '')}</section>`
    : '';

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(s.titulo)}</title><style>
@page { size: A4 portrait; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1f2937; font-size: 12px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

.cabecera { border-bottom: 2.5px solid #0f766e; padding-bottom: 8px; margin-bottom: 14px; }
h1 { font-size: 20px; margin: 0; letter-spacing: -0.01em; }

table { width: 100%; border-collapse: collapse; margin: 0 0 12px; break-inside: avoid; }
table th, table td { border: 0.75px solid #d1d5db; padding: 7px 10px; text-align: left; vertical-align: top; }
table th { background: #eef4f3; color: #0f4c5c; font-weight: 700; }
.ficha th { width: 34%; white-space: nowrap; }
.fases th { width: 28%; }
.fases td p { margin: 0 0 5px; }
.fases td p:last-child { margin-bottom: 0; }
.criterios td { padding: 6px 10px; }

section { margin: 0 0 10px; break-inside: avoid; }
h2 { font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f766e; margin: 0 0 6px; padding-bottom: 3px; border-bottom: 1px solid #cbd5e1; }
section p { margin: 0 0 5px; }
section.dua { background: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 9px 11px; }
section.dua h2 { color: #b45309; border-bottom-color: #fcd34d; }
section.planb { border: 1px dashed #94a3b8; border-radius: 6px; padding: 9px 11px; }
.circuito svg { width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 6px; }
section.imagenes { break-inside: auto; }
.imagenes .rejilla { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.imagenes .rejilla.una { grid-template-columns: 1fr; }
.imagenes figure { margin: 0; break-inside: avoid; }
.imagenes img { display: block; width: 100%; max-height: 95mm; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 4px; background: #fff; }
.imagenes figcaption { font-size: 11px; color: #4b5563; text-align: center; margin-top: 3px; }
.instr { margin: 0 0 12px; break-inside: avoid; }
.instr h3 { font-size: 12px; margin: 0 0 6px; color: #0f4c5c; }
.instr small { color: #6b7280; font-weight: 400; }
.mat-instr { width: 100%; border-collapse: collapse; font-size: 11px; }
.mat-instr th, .mat-instr td { border: 0.75px solid #d1d5db; padding: 5px 8px; text-align: left; vertical-align: top; }
.mat-instr thead th { background: #eef4f3; color: #0f4c5c; }
.mat-diana { display: flex; gap: 16px; align-items: flex-start; }
.mat-diana-svg svg { width: 200px; height: 200px; }
.mat-diana-leyenda { flex: 1; min-width: 0; }
</style></head><body>
<div class="cabecera"><h1>${esc(s.titulo || t('Sesión'))}</h1></div>
${tablaFicha}
${seccion('Objetivo', parrafos(s.objetivo))}
${seccion('Criterios oficiales', criterios)}
${tablaFases}
${seccion(datos.aula ? 'Materiales' : 'Material', parrafos(s.material))}
${seccion(datos.aula ? 'Medidas de inclusión (DUA)' : 'Para que participe todo el grupo (DUA-A)', parrafos(s.inclusion), 'dua')}
${seccion('Plan B', parrafos(s.planB), 'planb')}
${galeria}
${circuito}
${seccion('Cómo se evalúa', tablaInstrumentos)}
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
