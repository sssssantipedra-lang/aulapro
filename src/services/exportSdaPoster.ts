/**
 * Cartel de una Situación de Aprendizaje, en dos versiones (decisión del dueño,
 * 18-10-2026: «uno para el docente y otro para el alumnado, sin tanta
 * explicación»): qué vamos a trabajar, las sesiones y el producto final, con
 * uno de los temas visuales de las fichas (`lib/fichaThemes.ts`). La del
 * alumnado habla de «nosotros» y no lleva competencias; la del docente añade
 * lo que se trabaja de cada área y las competencias clave.
 *
 * No usa IA: sale de lo que ya dice la SdA, recortado a lo que se lee de un
 * vistazo desde el pupitre. Como las fichas, es un HTML que Electron imprime
 * a PDF en vertical.
 */
import type { LearningSituation } from '../types';
import { translate, type Lang } from '../i18n';
import { fichaTheme, type FichaThemeId } from '../lib/fichaThemes';
import { loadThemeArt } from '../lib/themeArtDoc';
import { CARPETAS } from '../lib/carpetas';

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

export type AudienciaCartel = 'docente' | 'alumnado';

export function buildSdaPosterHtml(sda: LearningSituation, themeId: FichaThemeId, lang: Lang, opts: { preview?: boolean; art?: string; audiencia?: AudienciaCartel } = {}): string {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const c = sda.content;
  const docente = opts.audiencia === 'docente';
  const theme = fichaTheme(fichaTheme(themeId).historia ? themeId : 'espacio');
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
  const kicker = docente ? [t('Para el docente'), meta].filter(Boolean).join(' · ') : [t('Situación de aprendizaje'), meta].filter(Boolean).join(' · ');

  const camino = phases.map((p, pi) => {
    const color = theme.bloques[pi % theme.bloques.length];
    return `<div class="ph" style="--pc:#${color.bg};--pl:#${color.light}"><div class="ph-name">${esc(p.fase)}</div>` +
      p.items.map(it => `<div class="ph-step"><span class="ph-n">${it.n}</span>${esc(it.titulo)}</div>`).join('') + `</div>`;
  }).join('<div class="ph-arrow">➜</div>');

  const areas = c.areas.filter(a => a.area);
  // Docente: lo que se trabaja de cada área. Alumnado: el reto en una frase y las áreas como etiquetas.
  const trabajar = docente
    ? areas.map(a => `<div class="ap"><div class="ap-area">${esc(a.area)}</div><div class="ap-txt">${esc(firstSentences(a.saberesBasicos, 150))}</div></div>`).join('') +
      (codes.length ? `<div class="chips">${codes.map(k => `<span class="chip"><b>${k}</b> ${esc(t(COMPETENCE_NAME[k]))}</span>`).join('')}</div>` : '')
    : (c.justificacion ? `<p>${esc(firstSentences(c.justificacion, 180))}</p>` : '') +
      (areas.length ? `<div class="chips">${areas.map(a => `<span class="chip">${esc(a.area)}</span>`).join('')}</div>` : '');

  const vars = `--c:#${theme.color};--cd:#${theme.oscuro};--cl:#${theme.claro};--paper:#${theme.papel};--font:${theme.fuente};--font-t:${theme.fuenteTitulo};--r:${theme.radio}px`;

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(c.titulo)}</title><style>${POSTER_STYLE}${opts.preview ? PREVIEW_STYLE : ''}</style></head>` +
    `<body><article class="poster${docente ? ' docente' : ''}" style='${vars}'>` +
    `<header class="banner">${decor}${opts.art ? `<img class="hero art" src="${opts.art}" alt="">` : `<span class="hero">${esc(theme.personaje)}</span>`}` +
    `<div class="banner-txt"><div class="kicker">${esc(kicker)}</div><h1>${esc(c.titulo)}</h1></div></header>` +
    (trabajar ? `<section class="box reto"><h2>🎯 ${esc(t(docente ? 'Qué vamos a trabajar' : '¿Qué vamos a trabajar?'))}</h2>${trabajar}</section>` : '') +
    (phases.length ? `<section class="camino"><h2>🗺️ ${esc(t(docente ? 'Las sesiones' : 'Nuestras sesiones'))}</h2><div class="ph-row">${camino}</div></section>` : '') +
    (c.productoFinal ? `<section class="box meta"><h2>🏁 ${esc(t('Nuestro producto final'))}</h2><p>${esc(firstSentences(c.productoFinal, 240))}</p></section>` : '') +
    `<div class="final"><span>${esc(theme.adornos[0] ?? '⭐')}</span>${esc(t('¡Vamos a por ello!'))}<span>${esc(theme.personaje)}</span></div>` +
    `</article></body></html>`;
}

const POSTER_STYLE = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
.poster { font-family: var(--font); color: #1e293b; display: flex; flex-direction: column; gap: 16px; padding: 2mm; min-height: 270mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.banner { position: relative; overflow: hidden; display: flex; align-items: center; gap: 18px; padding: 22px 24px; border-radius: var(--r); background: linear-gradient(135deg, var(--c), var(--cd)); color: #fff; min-height: 150px; }
.deco { position: absolute; opacity: .5; line-height: 1; }
.hero { font-size: 78px; line-height: 1; width: 110px; height: 110px; border-radius: 50%; background: rgba(255,255,255,.18); border: 3px solid rgba(255,255,255,.5); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.banner-txt { position: relative; padding-right: 150px; }
.kicker { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; opacity: .85; margin-bottom: 6px; }
h1 { font-family: var(--font-t); font-size: 38px; line-height: 1.12; margin: 0; }
h2 { font-family: var(--font-t); font-size: 19px; margin: 0 0 8px; color: var(--cd); text-transform: uppercase; letter-spacing: .04em; }
.box { background: var(--paper); border: 2px solid var(--cl); border-radius: var(--r); padding: 18px 22px; break-inside: avoid; }
.box p { margin: 0; font-size: 14.5px; line-height: 1.55; }
.reto { border-color: var(--c); border-width: 3px; }
.reto p { font-size: 22px; line-height: 1.45; }
.meta p { font-size: 22px; line-height: 1.45; font-weight: 700; }
.meta { background: var(--cl); border-color: var(--cl); }
.camino { flex: 1; display: flex; flex-direction: column; break-inside: avoid; }
.ph-row { flex: 1; display: flex; align-items: stretch; gap: 8px; }
.ph { flex: 1; min-width: 0; background: var(--pl); border-radius: var(--r); padding: 14px; border-top: 6px solid var(--pc); }
.ph-name { font-family: var(--font-t); font-weight: 800; font-size: 15px; text-transform: uppercase; color: var(--pc); margin-bottom: 10px; }
.ph-step { display: flex; gap: 8px; align-items: flex-start; font-size: 11.5px; line-height: 1.35; margin-bottom: 10px; }
.ph-n { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; background: var(--pc); color: #fff; font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.ph-arrow { align-self: center; color: #94a3b8; font-size: 16px; }
.ap { margin-bottom: 12px; }
.ap-area { font-weight: 800; font-size: 20px; color: var(--c); margin-bottom: 2px; }
.ap-txt { font-size: 18px; line-height: 1.45; }
.chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
.box p + .chips { margin-top: 12px; }
.chip { font-size: 16px; padding: 6px 14px; border-radius: 99px; background: var(--cl); }
.ph-step { font-size: 18px !important; line-height: 1.3; }
.docente .ph-step { font-size: 16px !important; }
.hero.art { border-radius: 22px; object-fit: cover; background: #fff; }
.final { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 10px; border-radius: var(--r); background: linear-gradient(135deg, var(--c), var(--cd)); color: #fff; font-family: var(--font-t); font-size: 24px; font-weight: 800; }
.final span { font-size: 28px; }
.chip b { color: var(--cd); }
@media print { @page { size: A4 portrait; margin: 10mm; } }
`;

const PREVIEW_STYLE = `
html, body { background: #e2e8f0; }
body { padding: 16px 0; }
.poster { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 10mm; background: #fff; box-shadow: 0 2px 14px rgba(15,23,42,.18); }
`;

export async function saveSdaPosterPdf(sda: LearningSituation, themeId: FichaThemeId, lang: Lang, audiencia: AudienciaCartel = 'alumnado') {
  const docs = window.electronAPI?.docs;
  if (!docs) return { error: 'not-desktop' as const };
  const slug = (s: string) => s.trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const art = (await loadThemeArt(fichaTheme(themeId).historia ? themeId : 'espacio'))?.dataUrl;
  const res = await docs.savePdf(buildSdaPosterHtml(sda, themeId, lang, { art, audiencia }), `cartel-${audiencia}-${slug(sda.title || 'sda')}.pdf`, { landscape: false, carpeta: CARPETAS.situaciones });
  if (!res.canceled && !res.error && res.path) docs.reveal(res.path);
  return res;
}
