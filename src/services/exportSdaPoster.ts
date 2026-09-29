/**
 * Cartel de una Situación de Aprendizaje, para colgarlo en el aula: el reto,
 * lo que se va a conseguir, el camino por fases, las competencias y lo que se
 * aprende, con uno de los temas visuales de las fichas (`lib/fichaThemes.ts`).
 *
 * No usa IA: sale de lo que ya dice la SdA, recortado a lo que se lee de un
 * vistazo desde el pupitre. Como las fichas, es un HTML que Electron imprime
 * a PDF en vertical.
 */
import type { LearningSituation } from '../types';
import { translate, type Lang } from '../i18n';
import { fichaTheme, type FichaThemeId } from '../lib/fichaThemes';

const esc = (s: string) => (s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** Las primeras frases de un texto sin pasar de `max` caracteres (sin cortar a mitad de frase si se puede). */
export function firstSentences(text: string, max: number): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [clean];
  let out = '';
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out += s;
  }
  return out.trim() || `${clean.slice(0, max - 1).trimEnd()}…`;
}

const KEY_COMPETENCES = ['CCL', 'CP', 'STEM', 'CD', 'CPSAA', 'CC', 'CE', 'CCEC'];
const COMPETENCE_NAME: Record<string, string> = {
  CCL: 'Comunicación', CP: 'Idiomas', STEM: 'Ciencia y matemáticas', CD: 'Digital',
  CPSAA: 'Aprender a aprender', CC: 'Ciudadanía', CE: 'Emprender', CCEC: 'Cultura',
};

export function buildSdaPosterHtml(sda: LearningSituation, themeId: FichaThemeId, lang: Lang, opts: { preview?: boolean } = {}): string {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const c = sda.content;
  const theme = fichaTheme(themeId === 'clasico' ? 'espacio' : themeId);
  const codes = KEY_COMPETENCES.filter(k => new RegExp(`(^|[^A-Z])${k}([^A-Z]|$)`).test(c.competenciasClave ?? ''));

  // Las sesiones, agrupadas por fase y en orden
  const phases: { fase: string; items: { n: number; titulo: string }[] }[] = [];
  c.sesiones.forEach((s, i) => {
    const last = phases[phases.length - 1];
    if (last && last.fase === s.fase) last.items.push({ n: i + 1, titulo: s.titulo });
    else phases.push({ fase: s.fase, items: [{ n: i + 1, titulo: s.titulo }] });
  });

  const decor = theme.adornos.map((a, i) =>
    `<span class="deco" style="${['top:14px;right:170px;font-size:34px', 'bottom:12px;right:40px;font-size:28px', 'top:18px;right:24px;font-size:24px', 'bottom:16px;right:220px;font-size:20px', 'top:70px;right:110px;font-size:18px'][i % 5]}">${esc(a)}</span>`).join('');

  const meta = [sda.class_name, sda.request.numero ? `${t('SdA')} ${sda.request.numero}` : '', sda.request.temporalizacion].filter(Boolean).join(' · ');

  const camino = phases.map((p, pi) => {
    const color = theme.bloques[pi % theme.bloques.length];
    return `<div class="ph" style="--pc:#${color.bg};--pl:#${color.light}"><div class="ph-name">${esc(p.fase)}</div>` +
      p.items.map(it => `<div class="ph-step"><span class="ph-n">${it.n}</span>${esc(it.titulo)}</div>`).join('') + `</div>`;
  }).join('<div class="ph-arrow">➜</div>');

  const aprender = c.areas.map(a =>
    `<div class="ap"><div class="ap-area">${esc(a.area)}</div><div class="ap-txt">${esc(firstSentences(a.saberesBasicos, 170))}</div></div>`).join('');

  const vars = `--c:#${theme.color};--cd:#${theme.oscuro};--cl:#${theme.claro};--paper:#${theme.papel};--font:${theme.fuente};--font-t:${theme.fuenteTitulo};--r:${theme.radio}px`;

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(c.titulo)}</title><style>${POSTER_STYLE}${opts.preview ? PREVIEW_STYLE : ''}</style></head>` +
    `<body><article class="poster" style='${vars}'>` +
    `<header class="banner">${decor}<span class="hero">${esc(theme.personaje)}</span>` +
    `<div class="banner-txt"><div class="kicker">${esc(t('Situación de aprendizaje'))}${meta ? ` · ${esc(meta)}` : ''}</div><h1>${esc(c.titulo)}</h1></div></header>` +
    `<section class="box reto"><h2>🎯 ${esc(t('Nuestro reto'))}</h2><p>${esc(firstSentences(c.justificacion, 320))}</p></section>` +
    (c.productoFinal ? `<section class="box meta"><h2>🏁 ${esc(t('Lo que vamos a conseguir'))}</h2><p>${esc(firstSentences(c.productoFinal, 220))}</p></section>` : '') +
    (phases.length ? `<section class="camino"><h2>🗺️ ${esc(t('El camino'))}</h2><div class="ph-row">${camino}</div></section>` : '') +
    `<div class="two">` +
    (aprender ? `<section class="box"><h2>📚 ${esc(t('Lo que aprenderemos'))}</h2>${aprender}</section>` : '') +
    `<div class="col">` +
    (codes.length ? `<section class="box"><h2>💪 ${esc(t('Competencias'))}</h2><div class="chips">${codes.map(k => `<span class="chip"><b>${k}</b> ${esc(t(COMPETENCE_NAME[k]))}</span>`).join('')}</div></section>` : '') +
    (c.ods ? `<section class="box"><h2>🌍 ${esc(t('Objetivos de Desarrollo Sostenible'))}</h2><p>${esc(firstSentences(c.ods, 160))}</p></section>` : '') +
    `</div></div>` +
    `<div class="final"><span>${esc(theme.adornos[0] ?? '⭐')}</span>${esc(t('¡Vamos a por ello!'))}<span>${esc(theme.personaje)}</span></div>` +
    `</article></body></html>`;
}

const POSTER_STYLE = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
.poster { font-family: var(--font); color: #1e293b; display: flex; flex-direction: column; gap: 12px; padding: 2mm; min-height: 270mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.banner { position: relative; overflow: hidden; display: flex; align-items: center; gap: 18px; padding: 22px 24px; border-radius: var(--r); background: linear-gradient(135deg, var(--c), var(--cd)); color: #fff; min-height: 150px; }
.deco { position: absolute; opacity: .5; line-height: 1; }
.hero { font-size: 78px; line-height: 1; width: 110px; height: 110px; border-radius: 50%; background: rgba(255,255,255,.18); border: 3px solid rgba(255,255,255,.5); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.banner-txt { position: relative; padding-right: 150px; }
.kicker { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; opacity: .85; margin-bottom: 6px; }
h1 { font-family: var(--font-t); font-size: 34px; line-height: 1.12; margin: 0; }
h2 { font-family: var(--font-t); font-size: 15px; margin: 0 0 6px; color: var(--cd); text-transform: uppercase; letter-spacing: .04em; }
.box { background: var(--paper); border: 2px solid var(--cl); border-radius: var(--r); padding: 12px 16px; break-inside: avoid; }
.box p { margin: 0; font-size: 14.5px; line-height: 1.55; }
.reto { border-color: var(--c); border-width: 3px; }
.reto p { font-size: 16px; }
.meta { background: var(--cl); border-color: var(--cl); }
.camino { break-inside: avoid; }
.ph-row { display: flex; align-items: stretch; gap: 6px; }
.ph { flex: 1; min-width: 0; background: var(--pl); border-radius: var(--r); padding: 10px; border-top: 5px solid var(--pc); }
.ph-name { font-family: var(--font-t); font-weight: 800; font-size: 12px; text-transform: uppercase; color: var(--pc); margin-bottom: 6px; }
.ph-step { display: flex; gap: 6px; align-items: flex-start; font-size: 11.5px; line-height: 1.35; margin-bottom: 5px; }
.ph-n { flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%; background: var(--pc); color: #fff; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.ph-arrow { align-self: center; color: #94a3b8; font-size: 16px; }
.two { flex: 1; display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px; }
.col { display: flex; flex-direction: column; gap: 12px; }
.col .box:last-child { flex: 1; }
.ap { margin-bottom: 12px; }
.ap-area { font-weight: 800; font-size: 15px; color: var(--c); margin-bottom: 2px; }
.ap-txt { font-size: 14px; line-height: 1.5; }
.chips { display: flex; flex-wrap: wrap; gap: 7px; }
.chip { font-size: 13px; padding: 5px 11px; border-radius: 99px; background: var(--cl); }
.ph-step { font-size: 12.5px !important; }
.final { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 10px; border-radius: var(--r); background: linear-gradient(135deg, var(--c), var(--cd)); color: #fff; font-family: var(--font-t); font-size: 20px; font-weight: 800; }
.final span { font-size: 28px; }
.chip b { color: var(--cd); }
@media print { @page { size: A4 portrait; margin: 10mm; } }
`;

const PREVIEW_STYLE = `
html, body { background: #e2e8f0; }
body { padding: 16px 0; }
.poster { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 10mm; background: #fff; box-shadow: 0 2px 14px rgba(15,23,42,.18); }
`;

export async function saveSdaPosterPdf(sda: LearningSituation, themeId: FichaThemeId, lang: Lang) {
  const docs = window.electronAPI?.docs;
  if (!docs) return { error: 'not-desktop' as const };
  const slug = (s: string) => s.trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const res = await docs.savePdf(buildSdaPosterHtml(sda, themeId, lang), `cartel-${slug(sda.title || 'sda')}.pdf`, { landscape: false });
  if (!res.canceled && !res.error && res.path) docs.reveal(res.path);
  return res;
}
