/**
 * Vista previa A4 de la ficha, en vivo: es el mismo HTML que se imprime en
 * PDF (`buildFichaHtml`), pintado en un iframe y escalado al ancho de la
 * columna. Al hacer clic en un bloque de la hoja se selecciona en el editor,
 * y el bloque elegido en el editor se resalta aquí.
 *
 * El documento se reescribe en el mismo iframe (sin recargarlo) y con un
 * pequeño retardo, para que escribir en el editor no haga parpadear la hoja.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Ficha } from '../../types';
import { buildFichaHtml } from '../../services/exportFicha';
import type { Lang } from '../../i18n';

/** Ancho del documento de la vista previa: la hoja A4 (210 mm ≈ 794 px) con su margen gris. */
const DOC_W = 840;

interface Props {
  ficha: Ficha;
  lang: Lang;
  selected: string | null;
  onSelect: (id: string) => void;
}

export function FichaPreview({ ficha, lang, selected, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.6);
  const [height, setHeight] = useState(1200);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  const html = useMemo(() => buildFichaHtml(ficha, lang, { preview: true }), [ficha, lang]);

  // Escala al ancho disponible
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / DOC_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reescribe el documento (con un retardo corto mientras se teclea)
  useEffect(() => {
    const id = window.setTimeout(() => {
      const doc = frameRef.current?.contentDocument;
      if (!doc) return;
      doc.open();
      doc.write(html);
      doc.close();
      doc.addEventListener('click', e => {
        const target = (e.target as Element | null)?.closest?.('[data-ex],[data-act],[data-part],[data-card]');
        if (!target) return;
        const card = target.getAttribute('data-card');
        onSelectRef.current(card !== null ? `card-${card}`
          : target.getAttribute('data-ex') ?? target.getAttribute('data-part') ?? `act-${target.getAttribute('data-act')}`);
      });
      const measure = () => setHeight(doc.documentElement?.scrollHeight || 1200);
      measure();
      // Los emoji y las fuentes pueden cambiar la altura al terminar de cargar
      window.setTimeout(measure, 120);
    }, 180);
    return () => window.clearTimeout(id);
  }, [html]);

  // Resalta el bloque elegido y lo trae a la vista dentro de la columna
  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    doc.querySelectorAll('.is-selected').forEach(n => n.classList.remove('is-selected'));
    if (!selected) return;
    const sel = selected.startsWith('act-')
      ? `[data-act="${selected.slice(4)}"]`
      : selected.startsWith('card-') ? `[data-card="${selected.slice(5)}"]`
      : /^\d+-\d+$/.test(selected) ? `[data-ex="${selected}"]` : `[data-part="${selected}"]`;
    const node = doc.querySelector(sel);
    if (!node) return;
    node.classList.add('is-selected');
    const scroller = wrapRef.current?.parentElement;
    if (scroller && typeof node.getBoundingClientRect === 'function') {
      const top = node.getBoundingClientRect().top * scale;
      const visible = top >= scroller.scrollTop && top <= scroller.scrollTop + scroller.clientHeight - 80;
      if (!visible) scroller.scrollTo({ top: Math.max(0, top - 40), behavior: 'smooth' });
    }
  }, [selected, html, scale, height]);

  return (
    <div ref={wrapRef} className="fe-preview-sheet" style={{ height: height * scale }}>
      <iframe
        ref={frameRef}
        title="preview"
        className="fe-preview-frame"
        style={{ width: DOC_W, height, transform: `scale(${scale})` }}
      />
    </div>
  );
}
