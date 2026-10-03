/**
 * Las competencias específicas de un alumno en PDF: por asignatura, una tabla
 * con cada competencia y cada criterio evaluados (solo su número) y su nota,
 * los números de lo que falta por evaluar, la nota del área y de qué decreto
 * sale (peticiones del dueño, 3-10-2026). Mismo patrón que las
 * actas: HTML que imprime Electron. Fuera del escritorio se abre la ventana de
 * imprimir del navegador, donde se puede elegir «Guardar como PDF».
 */
import { translate, type Lang } from '../i18n';
import { sinEvaluar, type NotaMateria } from '../lib/curriculum/evaluacionPorCriterios';
import { fromIsoDate } from '../lib/utils';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export interface DatosCompetencias {
  alumno: string;
  clase: string;
  /** La cita del decreto del que salen los criterios. */
  cita?: string;
  /** AAAA-MM-DD. */
  fecha: string;
  materias: { asignatura: string; notas: NotaMateria }[];
}

export function buildCompetenciasHtml(d: DatosCompetencias, lang: Lang): string {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const locale = lang === 'en' ? 'en-GB' : lang === 'ca' ? 'ca-ES' : 'es-ES';
  const fecha = fromIsoDate(d.fecha).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const nota = (n: number | null) => (n === null ? '—' : n.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

  const tablas = d.materias.map(({ asignatura, notas }) => {
    // Solo lo evaluado; lo que falta, solo con su número, debajo
    const filas = notas.competencias.filter(c => c.nota !== null).map(c =>
      `<tr class="ce"><th scope="row">${esc(t('CE{n}', { n: c.n }))}</th><td>${nota(c.nota)}</td></tr>` +
      c.criterios.filter(cr => cr.nota !== null).map(cr => `<tr><th scope="row">${esc(cr.codigo)}</th><td>${nota(cr.nota)}</td></tr>`).join(''),
    ).join('');
    const faltan = sinEvaluar(notas);
    return `<section><h2>${esc(asignatura)}${asignatura !== notas.nombre ? ` <small>(${esc(notas.nombre)})</small>` : ''}` +
      `<span class="area">${esc(t('Área'))}: ${nota(notas.nota)}</span></h2>` +
      (filas
        ? `<table><thead><tr><th>${esc(t('Criterio'))}</th><th>${esc(t('Nota'))}</th></tr></thead><tbody>${filas}</tbody></table>` +
          (faltan.length ? `<p class="faltan"><strong>${esc(t('Faltan por evaluar:'))}</strong> ${esc(faltan.join(', '))}</p>` : '')
        : `<p class="faltan">${esc(t('Aún no hay ningún criterio evaluado.'))}</p>`) +
      `</section>`;
  }).join('');

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<title>${esc(t('Competencias específicas'))} · ${esc(d.alumno)}</title><style>${ESTILO}</style></head><body>` +
    `<header><h1>${esc(t('Competencias específicas'))}</h1>` +
    `<p><strong>${esc(d.alumno)}</strong> · ${esc(d.clase)} · ${esc(fecha)}</p>` +
    (d.cita ? `<p class="cita">${esc(t('Currículo: {cita}', { cita: d.cita }))}</p>` : '') +
    `</header><div class="materias">${tablas}</div>` +
    `<footer>${esc(t('Nota de cada criterio: media de las veces que se ha evaluado. Competencia: media de sus criterios evaluados. Área: media de sus competencias evaluadas. Sobre 10.'))}</footer>` +
    `</body></html>`;
}

const ESTILO = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 12mm 14mm; font-size: 11px; }
header h1 { font-size: 18px; font-weight: 800; margin: 0 0 4px; }
header p { margin: 0 0 2px; color: #334155; font-size: 12px; }
header .cita { color: #64748b; font-size: 10.5px; }
.materias { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm 6mm; margin-top: 8mm; align-items: start; }
section { break-inside: avoid; }
h2 { font-size: 12.5px; font-weight: 800; margin: 0 0 4px; display: flex; justify-content: space-between; gap: 6px; border-bottom: 1.5px solid #1e293b; padding-bottom: 3px; }
h2 small { font-weight: 600; color: #64748b; }
h2 .area { white-space: nowrap; }
table { width: 100%; border-collapse: collapse; }
thead th { text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; padding: 2px 4px; }
thead th:last-child, td { text-align: right; }
tbody th, td { padding: 2px 4px; border-bottom: 0.5px solid #e2e8f0; font-weight: 500; }
tbody th { text-align: left; }
tr.ce th, tr.ce td { font-weight: 800; background: #f1f5f9; }
.faltan { margin: 4px 0 0; font-size: 10px; line-height: 1.45; color: #475569; }
footer { margin-top: 8mm; font-size: 9.5px; color: #64748b; }
@media print { @page { size: A4; margin: 12mm 14mm; } body { padding: 0; } }
`;

/** Guarda el PDF (escritorio) o abre la ventana de imprimir del navegador. */
export async function saveCompetenciasPdf(d: DatosCompetencias, lang: Lang): Promise<{ canceled?: boolean; error?: string }> {
  const html = buildCompetenciasHtml(d, lang);
  const docs = window.electronAPI?.docs;
  if (docs) {
    const slug = (x: string) => x.trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const res = await docs.savePdf(html, `competencias-${slug(d.alumno) || 'alumno'}.pdf`);
    if (!res.canceled && !res.error && res.path) docs.reveal(res.path);
    return res;
  }
  // Navegador: el documento en un marco invisible y su diálogo de imprimir
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
