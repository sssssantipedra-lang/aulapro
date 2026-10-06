/**
 * La agenda visual en PDF, para imprimirla y recortarla: una tarjeta por paso
 * con su dibujo y su texto, en el orden de la agenda. Los pictogramas y las
 * fotos van dentro del documento, y al pie, la atribución que pide la
 * licencia de Mulberry Symbols si se ha usado alguno. Ver `lib/pictos.ts`.
 */
import { translate, type Lang } from '../i18n';
import { ATRIBUCION_MULBERRY, esMulberry, urlPicto } from '../lib/pictos';
import type { AgendaVisual, FotoApoyo } from '../types/apoyo';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cache = new Map<string, Promise<string | null>>();

/** El pictograma como `data:` para incrustarlo en el PDF. */
export function pictoComoDato(id: string): Promise<string | null> {
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(urlPicto(id));
        if (!res.ok) return null;
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await res.text())}`;
      } catch {
        return null;
      }
    })();
    p.then(r => { if (!r) cache.delete(id); });
    cache.set(id, p);
  }
  return p;
}

/** Las imágenes de cada paso, por su id, ya listas para el HTML. */
export async function imagenesDe(agenda: AgendaVisual, fotos: readonly FotoApoyo[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(agenda.pasos.map(async p => {
    const foto = p.fotoId ? fotos.find(f => f.id === p.fotoId)?.datos : undefined;
    const img = foto ?? (p.picto ? await pictoComoDato(p.picto) : null);
    if (img) out[p.id] = img;
  }));
  return out;
}

export function buildAgendaHtml(agenda: AgendaVisual, imagenes: Record<string, string>, lang: Lang): string {
  const t = (k: string) => translate(lang, k);
  // Los dibujos propios de AulaPro (`ap-`) no piden atribución
  const conMulberry = agenda.pasos.some(p => p.picto && !p.fotoId && esMulberry(p.picto));
  const tarjetas = agenda.pasos.map((p, i) => {
    const img = imagenes[p.id];
    return `<div class="ag-t"><span class="ag-n">${i + 1}</span>`
      + (img ? `<img src="${esc(img)}" alt="">` : '<div class="ag-sin"></div>')
      + `<div class="ag-x">${esc(p.texto)}</div></div>`;
  }).join('');
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(agenda.titulo)}</title><style>
@page { size: A4 portrait; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { font-size: 20px; margin: 0 0 10px; }
.ag { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6mm; }
.ag-t { position: relative; border: 1.5px dashed #9ca3af; border-radius: 4mm; padding: 4mm 3mm 3mm; text-align: center; break-inside: avoid; }
.ag-n { position: absolute; top: 2mm; left: 3mm; font-size: 10px; font-weight: 700; color: #6b7280; }
.ag-t img { width: 100%; aspect-ratio: 1; object-fit: contain; display: block; }
.ag-sin { width: 100%; aspect-ratio: 1; }
.ag-x { margin-top: 2mm; font-size: 15px; font-weight: 700; line-height: 1.2; text-transform: uppercase; }
.ag-pie { margin-top: 8mm; font-size: 8.5px; color: #6b7280; }
</style></head><body>
<h1>${esc(agenda.titulo || t('Agenda visual'))}</h1>
<div class="ag">${tarjetas}</div>
${conMulberry ? `<p class="ag-pie">${esc(ATRIBUCION_MULBERRY)}</p>` : ''}
</body></html>`;
}

export async function guardarAgendaPdf(agenda: AgendaVisual, fotos: readonly FotoApoyo[], lang: Lang) {
  const docs = window.electronAPI?.docs;
  if (!docs) return { error: 'not-desktop' as const };
  const html = buildAgendaHtml(agenda, await imagenesDe(agenda, fotos), lang);
  const nombre = (agenda.titulo || 'agenda').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const res = await docs.savePdf(html, `agenda-${nombre || 'visual'}.pdf`, { landscape: false });
  if (!res.canceled && !res.error && res.path) docs.reveal(res.path);
  return res;
}
