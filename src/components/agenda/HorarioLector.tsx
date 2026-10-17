import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, ZoomIn, ZoomOut, Maximize2, FileText, AlertTriangle } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { HorarioDocumento } from '../../types';
import { tipoHorario } from '../../lib/horarioDoc';
import { abrirPdf } from '../../lib/pdfjs';
import { useI18n } from '../../i18n';

interface Props {
  doc: HorarioDocumento | null;
  /** Abre el selector de archivo (lo gestiona la Agenda, que también lo usa desde su menú). */
  onElegir: () => void;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_PASO = 0.25;

/**
 * El documento del horario, tal como lo trajo el docente: un lector, sin IA.
 * El PDF se dibuja con pdf.js (el visor del navegador no existe en el
 * WebView de Android) y la foto se muestra tal cual, con el mismo zoom.
 */
export function HorarioLector({ doc, onElegir }: Props) {
  const { t } = useI18n();
  if (!doc) {
    return (
      <button type="button" className="horario-vacio" onClick={onElegir}>
        <Upload size={28} color="var(--accent-d)" />
        <strong>{t('Carga tu horario')}</strong>
        <span>{t('Elige el PDF que te dio el centro, o una foto. Aquí lo tendrás siempre a mano.')}</span>
      </button>
    );
  }
  // Con otro documento se parte de cero: zoom y página vuelven al principio
  return <Visor key={`${doc.addedAt}|${doc.name}|${doc.base64.length}`} doc={doc} />;
}

function Visor({ doc }: { doc: HorarioDocumento }) {
  const { t } = useI18n();
  const caja = useRef<HTMLDivElement>(null);
  const [anchoCaja, setAnchoCaja] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const lienzos = useRef<(HTMLCanvasElement | null)[]>([]);

  const tipo = tipoHorario(doc.mimeType, doc.name);
  const src = useMemo(
    () => (tipo === 'imagen' ? `data:${doc.mimeType};base64,${doc.base64}` : ''),
    [doc, tipo],
  );

  // El ancho disponible: el documento se ajusta a él y el zoom parte de ahí
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setAnchoCaja(Math.floor(el.clientWidth));
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Abrir el PDF
  useEffect(() => {
    if (tipo !== 'pdf') return;
    let vivo = true;
    let cerrar: (() => void) | null = null;
    abrirPdf(doc.base64).then(
      abierto => {
        if (!vivo) { abierto.cerrar(); return; }
        cerrar = abierto.cerrar;
        setPdf(abierto.pdf);
      },
      () => { if (vivo) setError(true); },
    );
    return () => { vivo = false; cerrar?.(); };
  }, [doc, tipo]);

  // Dibujar las páginas al ancho y zoom actuales
  useEffect(() => {
    if (!pdf || anchoCaja <= 0) return;
    let vivo = true;
    const tareas: { cancel: () => void }[] = [];
    (async () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const lienzo = lienzos.current[n - 1];
        if (!vivo || !lienzo) return;
        const base = page.getViewport({ scale: 1 });
        const escala = (anchoCaja / base.width) * zoom;
        const vista = page.getViewport({ scale: escala * dpr });
        lienzo.width = Math.floor(vista.width);
        lienzo.height = Math.floor(vista.height);
        lienzo.style.width = `${Math.floor(vista.width / dpr)}px`;
        lienzo.style.height = `${Math.floor(vista.height / dpr)}px`;
        const ctx = lienzo.getContext('2d');
        if (!ctx) return;
        const tarea = page.render({ canvasContext: ctx, viewport: vista });
        tareas.push(tarea);
        try { await tarea.promise; } catch { return; /* cancelado al cambiar el zoom */ }
      }
    })();
    return () => { vivo = false; tareas.forEach(x => x.cancel()); };
  }, [pdf, anchoCaja, zoom]);

  const cambiarZoom = (z: number) => setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100)));

  return (
    <div className="horario-lector">
      <div className="horario-barra">
        <span className="horario-nombre" title={doc.name}>
          <FileText size={15} /> {doc.name}
        </span>
        <div className="horario-zoom" role="group" aria-label={t('Zoom')}>
          <button type="button" className="ico-btn" onClick={() => cambiarZoom(zoom - ZOOM_PASO)} disabled={zoom <= ZOOM_MIN}
            aria-label={t('Alejar')} title={t('Alejar')}><ZoomOut size={16} /></button>
          <span className="horario-zoom-n" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button type="button" className="ico-btn" onClick={() => cambiarZoom(zoom + ZOOM_PASO)} disabled={zoom >= ZOOM_MAX}
            aria-label={t('Acercar')} title={t('Acercar')}><ZoomIn size={16} /></button>
          <button type="button" className="ico-btn" onClick={() => cambiarZoom(1)}
            aria-label={t('Ajustar al ancho')} title={t('Ajustar al ancho')}><Maximize2 size={15} /></button>
        </div>
      </div>

      <div className="horario-hoja" ref={caja}>
        {error ? (
          <div className="horario-error" role="alert">
            <AlertTriangle size={16} /> {t('No se ha podido abrir el documento. Prueba a cargarlo de nuevo.')}
          </div>
        ) : tipo === 'imagen' ? (
          <img src={src} alt={t('Mi horario')} style={{ width: `${zoom * 100}%`, maxWidth: 'none', height: 'auto', display: 'block' }} />
        ) : !pdf ? (
          <div className="horario-cargando"><span className="spin" /> {t('Abriendo el documento…')}</div>
        ) : (
          Array.from({ length: pdf.numPages }, (_, i) => (
            <canvas key={i} ref={el => { lienzos.current[i] = el; }} className="horario-pagina"
              role="img" aria-label={t('Página {n} de {total}', { n: i + 1, total: pdf.numPages })} />
          ))
        )}
      </div>
    </div>
  );
}
