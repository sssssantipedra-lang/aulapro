import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Eye, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { areaDe, comoEnImpresion, leerPagina } from '../lib/paginaDoc';
import { estiloColumnas, medirPaginas, SEGURIDAD_PX } from '../lib/paginacion';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** HTML autocontenido, el mismo que se imprimiría como PDF. */
  html: string;
  /** Orientación con la que se guarda el PDF cuando el propio HTML no la fija (`@page`). */
  apaisado?: boolean;
}

/** Hojas que se pintan como máximo: cada una carga el documento, y más de esto pesaría demasiado. */
const MAX_HOJAS = 60;
/** Lo más que se espera a que carguen las imágenes antes de medir. */
const ESPERA_IMAGENES_MS = 2500;

/**
 * «Visor» del documento: lo pinta como saldrá en el PDF, hoja a hoja y sin descargar ni guardar nada.
 *
 * Lee del HTML la hoja (tamaño, orientación y márgenes del `@page`, o los de siempre) y lo reparte en
 * páginas con las columnas de CSS del navegador, igual que las mide el compositor de las fichas
 * (`lib/paginacion.ts`): el contenido se pone en columnas del tamaño del área imprimible y cada hoja
 * enseña una. Un iframe con `srcDoc` lo hace funcionar igual en escritorio, web y Android. `sandbox`
 * sin `allow-scripts` deja el HTML estático (nada de scripts), que es justo lo que son estos documentos;
 * `allow-same-origin` solo sirve para medirlo.
 */
export function DocPreview({ open, onClose, title, html, apaisado = false }: Props) {
  const { t } = useI18n();
  const titleId = useId();
  const caja = useRef<HTMLDivElement>(null);
  const [anchoCaja, setAnchoCaja] = useState(0);
  /** Las páginas medidas y de qué documento: si el documento cambia, la medida deja de valer sin tener que borrarla. */
  const [medida, setMedida] = useState<{ para: string; paginas: number } | null>(null);

  const pagina = useMemo(() => leerPagina(html, apaisado), [html, apaisado]);
  const area = useMemo(() => areaDe(pagina), [pagina]);
  const impreso = useMemo(() => comoEnImpresion(html), [html]);
  const conColumnas = useMemo(
    () => impreso.replace(/<\/head>/i, `<style>${estiloColumnas(area)}</style></head>`),
    [impreso, area],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Cuánto mide la caja que enseña las hojas, para encoger la hoja si no cabe
  useLayoutEffect(() => {
    const el = caja.current;
    if (!open || !el) return;
    const medir = () => setAnchoCaja(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  /** Con el documento medidor cargado: espera imágenes y tipos de letra y cuenta las páginas. */
  async function medir(frame: HTMLIFrameElement) {
    const doc = frame.contentDocument;
    if (!doc) { setMedida({ para: conColumnas, paginas: 1 }); return; }
    const imgs = Array.from(doc.images).filter(i => !i.complete);
    await Promise.race([
      Promise.all([...imgs.map(i => new Promise(r => { i.onload = i.onerror = () => r(null); })), doc.fonts?.ready]),
      new Promise(r => setTimeout(r, ESPERA_IMAGENES_MS)),
    ]);
    setMedida({ para: conColumnas, paginas: Math.max(1, medirPaginas(doc, area).paginas) });
  }

  const paginas = medida?.para === conColumnas ? medida.paginas : null;
  const escala = anchoCaja > 0 ? Math.min(1, (anchoCaja - 36) / pagina.ancho) : 1;
  const hojas = Math.min(paginas ?? 1, MAX_HOJAS);

  return (
    <div
      className={`modal-overlay${open ? ' open' : ''}`}
      style={{ zIndex: 300, padding: 0, background: 'rgba(15,23,42,0.66)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
      aria-hidden={!open}
    >
      <div
        style={{
          position: 'absolute', inset: 12, display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            borderBottom: '0.5px solid var(--border)', background: 'var(--card)', flexShrink: 0,
          }}
        >
          <Eye size={17} color="var(--accent-d)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              id={titleId}
              style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {title}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
              {t('Vista previa · así se imprime')}
              {paginas !== null && ` · ${t(paginas === 1 ? '{n} página' : '{n} páginas', { n: paginas })}`}
            </div>
          </div>
          <button className="ico-btn" onClick={onClose} aria-label={t('Cerrar')} title={t('Cerrar')}>
            <X size={18} />
          </button>
        </div>

        <div ref={caja} className="docprev-fondo" style={{ flex: 1, overflow: 'auto', background: '#475569', padding: 18, position: 'relative' }}>
          {open && html && (
            <>
              {/* El medidor: el documento en columnas, fuera de la vista, para contar las páginas */}
              <iframe
                title="" aria-hidden tabIndex={-1} sandbox="allow-same-origin" srcDoc={conColumnas}
                onLoad={e => { void medir(e.currentTarget); }}
                style={{ position: 'absolute', left: -99999, top: 0, width: area.ancho, height: area.alto, border: 0, visibility: 'hidden' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                {Array.from({ length: hojas }, (_, i) => (
                  <div
                    key={i} className="docprev-hoja"
                    style={{ width: pagina.ancho * escala, height: pagina.alto * escala, background: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.25)', borderRadius: 2, overflow: 'hidden', position: 'relative', flexShrink: 0 }}
                  >
                    <div style={{ position: 'absolute', left: 0, top: 0, width: pagina.ancho, height: pagina.alto, transform: `scale(${escala})`, transformOrigin: '0 0' }}>
                      <div style={{ position: 'absolute', left: pagina.margen.izquierda, top: pagina.margen.arriba, width: area.ancho, height: area.alto - SEGURIDAD_PX, overflow: 'hidden' }}>
                        <iframe
                          title={`${title} · ${i + 1}`} srcDoc={conColumnas} sandbox="allow-same-origin" tabIndex={-1}
                          style={{ position: 'absolute', top: 0, left: -i * area.ancho, width: area.ancho * (paginas ?? 1), height: area.alto - SEGURIDAD_PX, border: 0, background: 'transparent' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {(paginas ?? 0) > MAX_HOJAS && (
                  <p style={{ color: '#e2e8f0', fontSize: 12.5, margin: 0 }}>
                    {t('Se enseñan las primeras {n} páginas; el PDF lleva todas.', { n: MAX_HOJAS })}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
