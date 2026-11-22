/**
 * Un informe como documento para la familia: el de seguimiento por reglas (`lib/informeSeguimiento.ts`), el
 * competencial que redacta la IA y el escrito a mano, con la misma hoja. Aquí se decide qué partes lleva y
 * con qué textos (`partesDeInforme`) y se monta el HTML del PDF y de la vista previa (`informesHtml`); el
 * Word (`services/exportInformeDocx.ts`) usa las mismas partes.
 *
 * Lo que el docente ve y la familia no (de qué dato sale cada frase) no pasa de aquí: `partesDeInforme`
 * solo se queda con el texto de cada frase.
 */
import type { CompetencyReport } from '../types';
import { seVe } from './informeSeguimiento';
import { COLOR_VALORACION, NOMBRE, normalizarValoracion } from './tablaCompetencias';
import { fromIsoDate } from './utils';

type T = (clave: string, vars?: Record<string, string | number>) => string;

export interface ContextoDeInforme {
  /** El nombre del grupo del alumno. */
  grupo: string;
  t: T;
  locale: string;
  /** El nombre de una competencia clave en el idioma del informe. */
  etiquetaCompetencia: (clave: string) => string;
  /** Una frase más para el pie (la norma de las competencias específicas, en los informes con IA). */
  pieExtra?: (r: CompetencyReport) => string;
}

export interface TablaDeNotas {
  asignatura: string;
  /** Categoría, peso y nota, ya escritos. */
  filas: [string, string, string][];
  /** La nota del periodo, con su etiqueta. */
  total: [string, string];
}

export interface PartesDeInforme {
  alumno: string;
  titulo: string;
  /** Grupo, periodo y fecha. */
  datos: [string, string][];
  parrafo: string;
  notas: TablaDeNotas[];
  /** Días registrados, faltas sin justificar, justificadas y retrasos; vacío si no se entrega. */
  asistencia: [string, string][];
  competencias: { clave: string; nombre: string; valoracion: string; color: string; comentario: string }[];
  positivos: string[];
  mejorar: string[];
  observacion: string;
  pie: string;
}

const PIE_IA = 'Informe redactado con asistencia de inteligencia artificial a partir de las evaluaciones, calificaciones y asistencia registradas, y revisado por el docente. Competencias clave según el currículo educativo español (LOMLOE).';
const PIE_DOCENTE = 'Informe elaborado por el docente a partir de las calificaciones, la asistencia, las anotaciones de clase y las evaluaciones registradas en el periodo.';
const PIE_MANO = 'Informe redactado por el docente.';

/** La nota como se escribe en el idioma, con un decimal; una raya si no hay. */
const nota = (n: number | null | undefined, locale: string): string =>
  (typeof n === 'number' ? n.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—');

const dia = (iso: string, locale: string): string =>
  (/^\d{4}-\d{2}-\d{2}/.test(iso) ? fromIsoDate(iso.slice(0, 10)).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : iso);

/** El periodo como se lee en el documento: con sus fechas si el informe las guardó. */
export function textoDePeriodo(r: Pick<CompetencyReport, 'period' | 'seguimiento'>, t: T, locale: string): string {
  const s = r.seguimiento;
  if (!s?.desde || !s.hasta) return t(r.period);
  const corto = (iso: string) => fromIsoDate(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return t('{periodo} (del {desde} al {hasta})', { periodo: t(r.period), desde: corto(s.desde), hasta: corto(s.hasta) });
}

export function partesDeInforme(r: CompetencyReport, c: ContextoDeInforme): PartesDeInforme {
  const { t, locale } = c;
  const s = r.seguimiento;
  const notas: TablaDeNotas[] = !s || !seVe(s, 'notas') ? [] : s.notas.map(n => ({
    asignatura: n.asignatura,
    filas: [
      // Con la nota de cada evaluación (final de curso) van primero: es de lo que sale la nota final
      ...(n.evaluaciones ?? []).map((v, k): [string, string, string] => [t(['1ª evaluación', '2ª evaluación', '3ª evaluación'][k] ?? ''), '', nota(v, locale)]),
      ...n.categorias.filter(x => x.media !== null).map((x): [string, string, string] => [x.nombre, `${x.peso} %`, nota(x.media, locale)]),
    ],
    total: [t(n.evaluaciones ? 'Nota final de curso' : 'Nota de la evaluación'), nota(n.media, locale)],
  }));
  const a = s && seVe(s, 'asistencia') ? s.asistencia : null;
  const asistencia: [string, string][] = a ? [
    [t('Días registrados'), String(a.dias)], [t('Faltas sin justificar'), String(a.faltas)],
    [t('Faltas justificadas'), String(a.justificadas)], [t('Retrasos'), String(a.retrasos)],
  ] : [];
  const competencias = (!s || seVe(s, 'competencias') ? r.tabla ?? [] : []).map(f => {
    const v = normalizarValoracion(f.valoracion);
    return { clave: f.clave, nombre: c.etiquetaCompetencia(f.clave), valoracion: t(NOMBRE[v]), color: COLOR_VALORACION[v], comentario: f.comentario.trim() };
  });
  const base = r.origen === 'mano' ? PIE_MANO : r.origen === 'reglas' ? PIE_DOCENTE : PIE_IA;
  const extra = c.pieExtra?.(r) ?? '';
  return {
    alumno: r.student_name,
    titulo: t(s ? 'Informe de seguimiento' : 'Informe de evaluación competencial'),
    datos: [[t('Grupo'), c.grupo], [t('Periodo'), textoDePeriodo(r, t, locale)], [t('Fecha'), dia(r.date, locale)]],
    parrafo: r.text.trim(),
    notas, asistencia, competencias,
    positivos: (s?.positivos ?? []).map(f => f.texto.trim()).filter(Boolean),
    mejorar: (s?.mejorar ?? []).map(f => f.texto.trim()).filter(Boolean),
    observacion: s?.observacion.trim() ?? '',
    pie: t(base) + (extra ? ` ${extra}` : ''),
  };
}

/* ── HTML del PDF y de la vista previa ── */

const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));

/** Estilos del informe cuando viaja solo, fuera de la aplicación. */
export const ESTILO_INFORME = `
:root { --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
@page { size: A4 portrait; margin: 20mm 18mm; }
.rep { font-family: Georgia, 'Times New Roman', serif; color: #111827; }
.rep h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
.rep .sub { font-family: var(--font); font-size: 12px; color: #6b7280; margin-bottom: 16px; }
.rep .hd { border-bottom: 2px solid #111827; padding-bottom: 11px; margin-bottom: 18px; }
.rep dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0;
  border-bottom: 1px solid #d1d5db; margin: 0 0 20px; }
.rep dl > div { padding: 10px 12px 10px 0; }
.rep dt { font-family: var(--font); font-size: 9.5px; letter-spacing: .1em;
  text-transform: uppercase; color: #6b7280; font-weight: 700; margin-bottom: 3px; }
.rep dd { font-size: 13.5px; font-weight: 700; margin: 0; }
.rep .cuerpo { font-size: 13.5px; line-height: 1.85; text-align: justify; white-space: pre-wrap; }
.rep table.comp { width: 100%; border-collapse: collapse; margin-top: 22px; font-family: var(--font); font-size: 11.5px; line-height: 1.45; break-inside: avoid; }
.rep table.comp th, .rep table.comp td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
.rep table.comp thead th { background: #f3f4f6; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: #374151; }
.rep table.comp tbody th span { display: block; font-weight: 400; color: #6b7280; font-size: 10px; }
.rep table.comp td.val { font-weight: 700; white-space: nowrap; }
.rep h2 { font-family: var(--font); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #374151;
  font-weight: 700; margin: 22px 0 8px; break-after: avoid; }
.rep h2 + table.comp { margin-top: 0; }
.rep .notas { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
.rep table.nt { width: 100%; border-collapse: collapse; font-family: var(--font); font-size: 11.5px; line-height: 1.4; break-inside: avoid; }
.rep table.nt caption { text-align: left; font-weight: 700; font-size: 12.5px; padding: 0 0 5px; color: #111827; }
.rep table.nt td, .rep table.nt th { border: 1px solid #d1d5db; padding: 5px 8px; text-align: left; font-weight: 400; }
.rep table.nt td.n, .rep table.nt th.n { text-align: right; white-space: nowrap; width: 1%; }
.rep table.nt td.p { text-align: right; white-space: nowrap; width: 1%; color: #6b7280; }
.rep table.nt tfoot th { background: #f3f4f6; font-weight: 700; }
.rep dl.asis { grid-template-columns: repeat(4, 1fr); border-top: 1px solid #d1d5db; margin-bottom: 0; break-inside: avoid; }
.rep ul.fr { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.7; }
.rep ul.fr li { margin-bottom: 3px; break-inside: avoid; }
.rep .obs { font-size: 13.5px; line-height: 1.8; white-space: pre-wrap; }
.rep .pie { margin-top: 34px; font-family: var(--font); font-size: 10.5px;
  color: #6b7280; border-top: 1px solid #d1d5db; padding-top: 10px; line-height: 1.5; }
.rep .alumno { break-inside: avoid; page-break-inside: avoid; }
.rep .alumno.hoja { break-inside: auto; page-break-inside: auto; }
.rep .salto { page-break-after: always; break-after: page; }
`;

/** El cuerpo de un informe (sin cabecera ni pie): también lo pinta la pantalla, para que se vea como saldrá. */
export function cuerpoDeInformeHtml(p: PartesDeInforme, t: T): string {
  const out: string[] = [];
  if (p.parrafo) out.push(`<div class="cuerpo">${esc(p.parrafo)}</div>`);
  if (p.notas.length) {
    out.push(`<h2>${esc(t('Calificaciones'))}</h2><div class="notas">${p.notas.map(n => `<table class="nt"><caption>${esc(n.asignatura)}</caption><tbody>${
      n.filas.map(([a, b, c]) => `<tr><td>${esc(a)}</td><td class="p">${esc(b)}</td><td class="n">${esc(c)}</td></tr>`).join('')
    }</tbody><tfoot><tr><th colspan="2">${esc(n.total[0])}</th><th class="n">${esc(n.total[1])}</th></tr></tfoot></table>`).join('')}</div>`);
  }
  if (p.asistencia.length) {
    out.push(`<h2>${esc(t('Asistencia'))}</h2><dl class="asis">${p.asistencia.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`);
  }
  if (p.competencias.length) {
    const conComentario = p.competencias.some(f => f.comentario);
    const filas = p.competencias.map(f => `<tr><th scope="row">${esc(f.clave)}<span>${esc(f.nombre)}</span></th>`
      + `<td class="val" style="color:${f.color}">${esc(f.valoracion)}</td>${conComentario ? `<td>${esc(f.comentario)}</td>` : ''}</tr>`).join('');
    // En el informe de seguimiento la tabla lleva su título; en el competencial va detrás del texto, como siempre
    const titulo = p.notas.length || p.asistencia.length || p.positivos.length || p.mejorar.length || p.observacion ? `<h2>${esc(t('Competencias clave'))}</h2>` : '';
    out.push(`${titulo}<table class="comp"><thead><tr><th>${esc(t('Competencia clave'))}</th><th>${esc(t('Valoración'))}</th>${conComentario ? `<th>${esc(t('Comentario'))}</th>` : ''}</tr></thead><tbody>${filas}</tbody></table>`);
  }
  const lista = (titulo: string, frases: string[]) => {
    if (frases.length) out.push(`<h2>${esc(t(titulo))}</h2><ul class="fr">${frases.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`);
  };
  lista('Lo positivo', p.positivos);
  lista('A mejorar', p.mejorar);
  if (p.observacion) out.push(`<h2>${esc(t('Observaciones del docente'))}</h2><div class="obs">${esc(p.observacion)}</div>`);
  return out.join('\n');
}

/** Un informe como bloque del documento, con su cabecera y su pie. */
function bloqueDeInforme(r: CompetencyReport, c: ContextoDeInforme, salto: boolean): string {
  const p = partesDeInforme(r, c);
  // Un informe de seguimiento puede pasar de una hoja: no se le pide que quepa entero en una
  return `<section class="alumno${r.seguimiento ? ' hoja' : ''}${salto ? ' salto' : ''}">
<div class="hd"><h1>${esc(p.alumno)}</h1>
<div class="sub">${esc(p.titulo)}</div></div>
<dl>
${p.datos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n')}
</dl>
${cuerpoDeInformeHtml(p, c.t)}
<div class="pie">${esc(p.pie)}</div>
</section>`;
}

/** El documento con uno o varios informes: cada alumno en su propia página, porque cada uno va a una familia. */
export function informesHtml(lista: CompetencyReport[], titulo: string, lang: string, c: ContextoDeInforme): string {
  const bloques = lista.map((r, i) => bloqueDeInforme(r, c, i < lista.length - 1)).join('\n');
  return `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8">`
    + `<title>${esc(titulo)}</title><style>${ESTILO_INFORME}</style></head>`
    + `<body class="rep">${bloques}</body></html>`;
}

/** El informe en texto plano, para pegarlo en otro sitio (la plataforma del centro, un correo). */
export function informeEnTexto(r: CompetencyReport, c: ContextoDeInforme): string {
  const p = partesDeInforme(r, c);
  const { t } = c;
  const out: string[] = [p.alumno, p.datos.map(([, v]) => v).join(' · '), ''];
  if (p.parrafo) out.push(p.parrafo, '');
  for (const n of p.notas) {
    out.push(`${t('Calificaciones')} · ${n.asignatura}`);
    for (const [a, b, v] of n.filas) out.push(`- ${a}${b ? ` (${b})` : ''}: ${v}`);
    out.push(`${n.total[0]}: ${n.total[1]}`, '');
  }
  if (p.asistencia.length) out.push(`${t('Asistencia')}: ${p.asistencia.map(([k, v]) => `${k}: ${v}`).join('; ')}`, '');
  if (p.competencias.length) {
    out.push(t('Competencias clave'));
    for (const f of p.competencias) out.push(`- ${f.clave} (${f.nombre}): ${f.valoracion}${f.comentario ? `. ${f.comentario}` : ''}`);
    out.push('');
  }
  if (p.positivos.length) out.push(t('Lo positivo'), ...p.positivos.map(f => `- ${f}`), '');
  if (p.mejorar.length) out.push(t('A mejorar'), ...p.mejorar.map(f => `- ${f}`), '');
  if (p.observacion) out.push(t('Observaciones del docente'), p.observacion, '');
  return out.join('\n').trimEnd();
}
