/**
 * Rúbricas, dianas y escalas de registro en PDF (petición del dueño,
 * 20-10-2026), para imprimirlas y evaluar en papel: la rúbrica con sus niveles
 * y descriptores, la diana dibujada con su leyenda y la escala de registro con
 * una fila por alumno y los dos pulgares por concepto. Mismo patrón que las
 * actas: HTML que imprime Electron, y fuera del escritorio la ventana de
 * imprimir del navegador, donde se puede elegir «Guardar como PDF».
 */
import { translate, type Lang } from '../i18n';
import { levelColor, levelsOf, type Class, type EvalDiana, type Rubric, type Student } from '../types';
import { objetivosDe } from '../lib/objetivos';
import { compararAlumnos } from '../lib/alumnado';
import { CARPETAS } from '../lib/carpetas';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const ESTILO = `
@page { size: A4 landscape; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 12px; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { font-size: 20px; margin: 0 0 2px; }
.meta { color: #4b5563; margin: 0 0 10px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #9ca3af; padding: 6px 8px; vertical-align: top; text-align: left; }
th { background: #f3f4f6; }
tr { break-inside: avoid; }
.campos { display: flex; gap: 18px; margin: 12px 0 0; }
.campos span { flex: 1; border-bottom: 1px solid #6b7280; padding-bottom: 14px; color: #4b5563; font-size: 11px; }
.campos span.corto { flex: 0 0 90px; }
small { color: #4b5563; }
`;

/** «Alumno/a, Clase, Fecha, Nota»: las líneas que se rellenan a mano. */
const campos = (t: (k: string) => string, conAlumno = true) =>
  `<div class="campos">${conAlumno ? `<span>${esc(t('Alumno/a'))}</span><span>${esc(t('Clase'))}</span>` : ''}<span class="corto">${esc(t('Fecha'))}</span><span class="corto">${esc(t('Nota'))}</span></div>`;

const cabecera = (titulo: string, clases: string[], contexto?: string) => {
  const meta = [...clases, contexto?.trim()].filter(Boolean).map(x => esc(x!)).join(' · ');
  return `<h1>${esc(titulo)}</h1>${meta ? `<p class="meta">${meta}</p>` : ''}`;
};

const documento = (titulo: string, lang: Lang, cuerpo: string, extra = '') =>
  `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${ESTILO}${extra}</style></head><body>${cuerpo}</body></html>`;

/** Los nombres de las clases de un instrumento, la principal primero. */
export function nombresDeClases(inst: Rubric | EvalDiana, classes: readonly Class[]): string[] {
  return objetivosDe(inst).map(o => classes.find(c => c.id === o.class_id)?.name).filter((x): x is string => !!x);
}

/* ── Rúbrica ── */

export function buildRubricaHtml(r: Rubric, clases: string[], lang: Lang): string {
  const t = (k: string) => translate(lang, k);
  const niveles = levelsOf(r);
  const filas = r.criteria.map(c => `<tr>
<th scope="row" style="width:16%">${esc(c.name)}${c.competencies?.length ? `<br><small>${esc(c.competencies.join(' · '))}</small>` : ''}</th>
${niveles.map(l => `<td>${esc(c.descriptors?.[l.value] ?? '')}</td>`).join('')}</tr>`).join('');
  const cuerpo = `${cabecera(r.name, clases, r.context)}
<table><thead><tr><th>${esc(t('Criterio'))}</th>${niveles.map(l =>
    `<th style="background:${levelColor(l.value, niveles.length)};color:#fff">${esc(t(l.label))} <small style="color:#fff">(${l.value})</small></th>`).join('')}</tr></thead><tbody>${filas}</tbody></table>
${campos(t)}`;
  return documento(r.name, lang, cuerpo);
}

/* ── Diana ── */

const TAM = 340;
const C = TAM / 2;
const R = 130;
const punto = (ang: number, radio: number): [number, number] => [C + radio * Math.cos(ang), C + radio * Math.sin(ang)];

function sector(a0: number, a1: number, rIn: number, rOut: number): string {
  const [x0o, y0o] = punto(a0, rOut);
  const [x1o, y1o] = punto(a1, rOut);
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  if (rIn <= 0.01) return `M ${C} ${C} L ${x0o} ${y0o} A ${rOut} ${rOut} 0 ${grande} 1 ${x1o} ${y1o} Z`;
  const [x0i, y0i] = punto(a0, rIn);
  const [x1i, y1i] = punto(a1, rIn);
  return `M ${x0o} ${y0o} A ${rOut} ${rOut} 0 ${grande} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rIn} ${rIn} 0 ${grande} 0 ${x0i} ${y0i} Z`;
}

/** La diana vacía: un sector por ítem (numerado) y un anillo por nivel, el peor dentro. */
export function dianaSvg(d: EvalDiana): string {
  const niveles = levelsOf(d);
  const n = Math.max(1, d.items.length);
  const ancho = R / niveles.length;
  const trozos: string[] = [];
  d.items.forEach((_, i) => {
    const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / n;
    niveles.forEach((l, k) => {
      trozos.push(`<path d="${sector(a0, a1, k * ancho, (k + 1) * ancho)}" fill="${levelColor(l.value, niveles.length)}" fill-opacity="0.13" stroke="#6b7280" stroke-width="1"/>`);
    });
    const [x, y] = punto((a0 + a1) / 2, R + 14);
    trozos.push(`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="#111827">${i + 1}</text>`);
  });
  return `<svg viewBox="0 0 ${TAM} ${TAM}" xmlns="http://www.w3.org/2000/svg" role="img">${trozos.join('')}</svg>`;
}

export function buildDianaHtml(d: EvalDiana, clases: string[], lang: Lang): string {
  const t = (k: string) => translate(lang, k);
  const niveles = levelsOf(d);
  const conDescriptores = d.items.some(i => i.descriptors && Object.values(i.descriptors).some(Boolean));
  const leyenda = conDescriptores
    ? `<table><thead><tr><th style="width:26px">#</th><th>${esc(t('Ítem'))}</th>${niveles.map(l => `<th>${esc(t(l.label))}</th>`).join('')}</tr></thead><tbody>${
      d.items.map((it, i) => `<tr><td>${i + 1}</td><th scope="row">${esc(it.name)}</th>${niveles.map(l => `<td>${esc(it.descriptors?.[l.value] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    : `<table><tbody>${d.items.map((it, i) => `<tr><td style="width:26px"><strong>${i + 1}</strong></td><td>${esc(it.name)}</td></tr>`).join('')}</tbody></table>`;
  const anillos = `<p class="meta">${esc(t('Del centro hacia fuera, de peor a mejor nivel'))}: ${niveles.map(l =>
    `<span style="color:${levelColor(l.value, niveles.length)};font-weight:700">${esc(t(l.label))}</span>`).join(' → ')}</p>`;
  const cuerpo = `${cabecera(d.name, clases, d.context)}
<div class="diana"><div class="dibujo">${dianaSvg(d)}<p class="meta">${esc(t('Rellena de dentro hacia fuera hasta el nivel logrado en cada sector.'))}</p></div>
<div class="leyenda">${anillos}${leyenda}</div></div>
${campos(t)}`;
  return documento(d.name, lang, cuerpo, `
.diana { display: flex; gap: 22px; align-items: flex-start; }
.diana .dibujo { flex: 0 0 300px; text-align: center; }
.diana .dibujo svg { width: 300px; height: 300px; }
.diana .leyenda { flex: 1; }
.diana .leyenda .meta { margin-bottom: 6px; }`);
}

/* ── Escala de registro ── */

export interface GrupoRegistro { clase: string; alumnos: string[] }

/** Un grupo por clase de la escala, con su alumnado por orden alfabético; sin clase, un grupo en blanco. */
export function gruposRegistro(d: EvalDiana, classes: readonly Class[], students: readonly Student[]): GrupoRegistro[] {
  const ids = objetivosDe(d).map(o => o.class_id);
  if (ids.length === 0) return [{ clase: '', alumnos: [] }];
  return ids.map(id => ({
    clase: classes.find(c => c.id === id)?.name ?? '',
    alumnos: students.filter(s => s.class_id === id).sort(compararAlumnos).map(s => s.name),
  }));
}

const FILAS_EN_BLANCO = 22;

/** Con pocos conceptos cabe más alumnado en una hoja vertical. */
export const registroApaisado = (d: EvalDiana): boolean => d.items.length > 4;

export function buildRegistroHtml(d: EvalDiana, grupos: GrupoRegistro[], lang: Lang): string {
  const t = (k: string) => translate(lang, k);
  const pagina = (g: GrupoRegistro, ultima: boolean) => {
    const nombres = g.alumnos.length ? g.alumnos : Array.from({ length: FILAS_EN_BLANCO }, () => '');
    return `<section${ultima ? '' : ' style="break-after:page"'}>${cabecera(d.name, g.clase ? [g.clase] : [], d.context)}
<p class="meta">${esc(t('Marca 👍 (bien hecho) o 👎 (mejorable) en cada concepto.'))}</p>
<table><thead><tr><th rowspan="2" style="width:24%">${esc(t('Alumno'))}</th>${d.items.map(i => `<th colspan="2" style="text-align:center">${esc(i.name)}</th>`).join('')}</tr>
<tr>${d.items.map(() => '<th class="pulgar">👍</th><th class="pulgar">👎</th>').join('')}</tr></thead><tbody>${
      nombres.map(n => `<tr class="fila"><th scope="row">${esc(n)}</th>${d.items.map(() => '<td></td><td></td>').join('')}</tr>`).join('')}</tbody></table>
${campos(t, false)}</section>`;
  };
  return documento(d.name, lang, grupos.map((g, i) => pagina(g, i === grupos.length - 1)).join(''), `
${registroApaisado(d) ? '' : '@page { size: A4 portrait; margin: 12mm; }'}
.pulgar { text-align: center; width: 34px; padding: 3px; font-size: 13px; }
.fila th, .fila td { height: 22px; padding: 2px 8px; }
.fila th { font-weight: 400; }`);
}

/* ── Guardar ── */

const slug = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').toLowerCase();

/**
 * Guarda el HTML como PDF, en horizontal, en la carpeta «Cuaderno» (lo que se
 * usa para evaluar). Fuera del escritorio abre la ventana de imprimir del
 * navegador.
 */
export async function guardarInstrumentoPdf(
  html: string, nombre: string, tipo: 'rubrica' | 'diana' | 'registro', apaisado = true,
): Promise<{ canceled?: boolean; error?: string }> {
  const docs = window.electronAPI?.docs;
  if (docs) {
    const res = await docs.savePdf(html, `${tipo === 'rubrica' ? 'rubrica' : tipo === 'diana' ? 'diana' : 'escala-registro'}-${slug(nombre) || 'instrumento'}.pdf`,
      { landscape: apaisado, carpeta: CARPETAS.cuaderno });
    if (!res.canceled && !res.error && res.path) docs.reveal(res.path);
    return res;
  }
  const marco = document.createElement('iframe');
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(marco);
  const doc = marco.contentDocument;
  if (!doc || !marco.contentWindow) { marco.remove(); return { error: 'print' }; }
  doc.open();
  doc.write(html);
  doc.close();
  const quitar = () => marco.remove();
  marco.contentWindow.addEventListener('afterprint', quitar);
  setTimeout(quitar, 60_000);
  marco.contentWindow.focus();
  marco.contentWindow.print();
  return {};
}
