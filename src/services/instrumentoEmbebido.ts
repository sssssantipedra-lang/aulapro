/**
 * Rúbricas, dianas y escalas de registro como fragmentos de HTML, para
 * INCORPORARLAS dentro de un documento mayor (la sesión, la situación de
 * aprendizaje) en lugar de imprimirlas sueltas. Reutiliza el dibujo de la diana
 * (`dianaSvg`) y los niveles y colores de siempre, así la vista previa y el
 * PDF de la sesión muestran el material completo, no solo su nombre.
 */
import { translate, type Lang } from '../i18n';
import { DEFAULT_LEVELS, levelColor, levelsOf, type EvalDiana, type Rubric } from '../types';
import { dianaSvg } from './exportInstrumento';
import { esRegistro } from '../lib/registro';
import type { SdaRubricRow, SdaDianaItem } from './learningSituations';

const esc = (s: string) => (s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** La rúbrica en una tabla: criterio × niveles, con sus descriptores. */
export function tablaRubrica(r: Rubric, lang: Lang): string {
  const t = (k: string) => translate(lang, k);
  const niveles = levelsOf(r);
  const thead = `<thead><tr><th style="width:18%">${esc(t('Criterio'))}</th>${niveles.map(l =>
    `<th style="background:${levelColor(l.value, niveles.length)};color:#fff">${esc(t(l.label))}</th>`).join('')}</tr></thead>`;
  const filas = r.criteria.map(c => `<tr><th scope="row">${esc(c.name)}</th>${niveles.map(l =>
    `<td>${esc(c.descriptors?.[l.value] ?? '')}</td>`).join('')}</tr>`).join('');
  return `<table class="mat-instr"><thead>${thead}</thead><tbody>${filas}</tbody></table>`;
}

/** La diana dibujada con su leyenda de ítems y niveles. */
export function tablaDiana(d: EvalDiana, lang: Lang): string {
  const t = (k: string) => translate(lang, k);
  const niveles = levelsOf(d);
  const conDescriptores = d.items.some(i => i.descriptors && Object.values(i.descriptors).some(Boolean));
  const leyenda = conDescriptores
    ? `<table class="mat-instr"><thead><tr><th style="width:26px">#</th><th>${esc(t('Ítem'))}</th>${niveles.map(l => `<th>${esc(t(l.label))}</th>`).join('')}</tr></thead><tbody>${
      d.items.map((it, i) => `<tr><td>${i + 1}</td><th scope="row">${esc(it.name)}</th>${niveles.map(l => `<td>${esc(it.descriptors?.[l.value] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    : `<table class="mat-instr"><tbody>${d.items.map((it, i) => `<tr><td style="width:26px"><strong>${i + 1}</strong></td><td>${esc(it.name)}</td></tr>`).join('')}</tbody></table>`;
  return `<div class="mat-diana"><div class="mat-diana-svg">${dianaSvg(d)}</div><div class="mat-diana-leyenda">${leyenda}</div></div>`;
}

/** La escala de registro: sus conceptos, para valorar con pulgar arriba o abajo. */
export function tablaRegistro(d: EvalDiana, lang: Lang): string {
  void lang;
  return `<table class="mat-instr"><tbody>${d.items.map(i =>
    `<tr><th scope="row">${esc(i.name)}</th><td style="text-align:center;width:72px">👍 / 👎</td></tr>`).join('')}</tbody></table>`;
}

/** El fragmento que corresponde a un instrumento (rúbrica, diana o escala). */
export function htmlInstrumento(inst: Rubric | EvalDiana, lang: Lang): string {
  if ('criteria' in inst) return tablaRubrica(inst as Rubric, lang);
  const d = inst as EvalDiana;
  return esRegistro(d) ? tablaRegistro(d, lang) : tablaDiana(d, lang);
}

/* ── Materiales generados desde una situación de aprendizaje ── */

/** La rúbrica generada desde una SdA, en los cuatro niveles clásicos. */
export function tablaRubricaSda(rows: SdaRubricRow[], lang: Lang): string {
  const t = (k: string) => translate(lang, k);
  const thead = `<thead><tr><th style="width:18%">${esc(t('Criterio'))}</th>${DEFAULT_LEVELS.map(l =>
    `<th style="background:${levelColor(l.value, 4)};color:#fff">${esc(t(l.label))}</th>`).join('')}</tr></thead>`;
  const filas = rows.map(r => `<tr><th scope="row">${esc(r.criterio)}</th>${[r.nivel1, r.nivel2, r.nivel3, r.nivel4].map(n => `<td>${esc(n)}</td>`).join('')}</tr>`).join('');
  return `<table class="mat-instr"><thead>${thead}</thead><tbody>${filas}</tbody></table>`;
}

/** La diana generada desde una SdA, en los cuatro niveles clásicos. */
export function tablaDianaSda(rows: SdaDianaItem[], lang: Lang): string {
  const t = (k: string) => translate(lang, k);
  const thead = `<thead><tr><th>${esc(t('Ítem'))}</th>${DEFAULT_LEVELS.map(l =>
    `<th style="background:${levelColor(l.value, 4)};color:#fff">${esc(t(l.label))}</th>`).join('')}</tr></thead>`;
  const filas = rows.map(r => `<tr><th scope="row">${esc(r.item)}</th>${[r.nivel1, r.nivel2, r.nivel3, r.nivel4].map(n => `<td>${esc(n)}</td>`).join('')}</tr>`).join('');
  return `<table class="mat-instr"><thead>${thead}</thead><tbody>${filas}</tbody></table>`;
}

/** El anexo con la rúbrica y la diana generadas desde la SdA, para meterlo en su documento. */
export function anexoMaterialesSda(rubricRows: SdaRubricRow[] | null, dianaRows: SdaDianaItem[] | null, lang: Lang): string {
  const t = (k: string) => translate(lang, k);
  const partes: string[] = [];
  if (rubricRows?.length) partes.push(`<div class="anexo-instr"><h3>${esc(t('Rúbrica'))}</h3>${tablaRubricaSda(rubricRows, lang)}</div>`);
  if (dianaRows?.length) partes.push(`<div class="anexo-instr"><h3>${esc(t('Diana'))}</h3>${tablaDianaSda(dianaRows, lang)}</div>`);
  return partes.length
    ? `<div class="sda-anexo"><h2>${esc(t('Instrumentos de evaluación'))}</h2>${partes.join('')}</div>`
    : '';
}
