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
import { admiteDensidad, buildFichaHtml, cargarIlustraciones, cargarPictos, ilustracionesDeFicha, pictosDeFicha } from '../../services/exportFicha';
import { componerHoja, type Composicion } from '../../services/compositor';
import { DENSIDADES, NOMBRE_DENSIDAD, esDensidad, type Densidad } from '../../lib/densidad';
import { useI18n } from '../../i18n';
import { fichaTheme } from '../../lib/fichaThemes';
import { useThemeArt } from '../../lib/themeArtDoc';
import { useFuenteCuaderno } from '../../lib/fuenteCuaderno';
import type { Lang } from '../../i18n';

/** Ancho del documento de la vista previa: la hoja A4 (210 mm ≈ 794 px) con su margen gris. */
const DOC_W = 840;

interface Props {
  ficha: Ficha;
  lang: Lang;
  selected: string | null;
  onSelect: (id: string) => void;
  /** El docente fija la distribución de la hoja (o vuelve a la automática con `undefined`). */
  onDensidad?: (d: Densidad | undefined) => void;
}

/** Las densidades en el selector; «Normal» lleva contexto porque la palabra sola ya existe en otros sitios. */
const CLAVE_DENSIDAD: Record<Densidad, string> = { ...NOMBRE_DENSIDAD, normal: 'Normal@@hoja' };

export function FichaPreview({ ficha, lang, selected, onSelect, onDensidad }: Props) {
  const { t } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.6);
  const [height, setHeight] = useState(1200);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  const temaId = fichaTheme(ficha.content.estilo).id;
  const art = useThemeArt(temaId);
  const fontCss = useFuenteCuaderno(temaId === 'cuaderno', ficha.content.variante === 'lectura_facil');
  // Con apoyos visuales, sus pictogramas: se cargan al cambiar cuáles son, no a cada tecla
  const ids = pictosDeFicha(ficha.content).join(' ');
  const [pictos, setPictos] = useState<Record<string, string>>({});
  useEffect(() => {
    let vivo = true;
    if (ids) cargarPictos(ids.split(' ')).then(p => { if (vivo) setPictos(p); });
    return () => { vivo = false; };
  }, [ids]);
  // Con hilo conductor, los dibujos del catálogo: igual, al cambiar cuáles son
  const idsIlu = ilustracionesDeFicha(ficha.content).join(' ');
  const [ilustraciones, setIlustraciones] = useState<Record<string, string>>({});
  useEffect(() => {
    let vivo = true;
    if (idsIlu) cargarIlustraciones(idsIlu.split(' ')).then(p => { if (vivo) setIlustraciones(p); });
    return () => { vivo = false; };
  }, [idsIlu]);

  // El compositor: mide la hoja tal como se imprime con cada densidad y elige la que mejor la deja
  const conDensidad = admiteDensidad(ficha.content);
  const htmlMedir = useMemo(
    () => (conDensidad ? buildFichaHtml(ficha, lang, { art, pictos, ilustraciones, fontCss, densidad: 'normal' }) : ''),
    [conDensidad, ficha, lang, art, pictos, ilustraciones, fontCss],
  );
  const [composicion, setComposicion] = useState<Composicion | null>(null);
  useEffect(() => {
    if (!htmlMedir) return;
    let vivo = true;
    // Mientras se teclea no se mide: se queda la última composición hasta que llegue la nueva
    const id = window.setTimeout(() => { componerHoja(htmlMedir).then(c => { if (vivo) setComposicion(c); }); }, 450);
    return () => { vivo = false; window.clearTimeout(id); };
  }, [htmlMedir]);
  const manual = esDensidad(ficha.content.densidad) ? ficha.content.densidad : undefined;
  const composicionVigente = conDensidad ? composicion : null;
  const densidad: Densidad | undefined = conDensidad ? manual ?? composicionVigente?.densidad ?? 'normal' : undefined;
  const paginas = densidad ? composicionVigente?.medidas[densidad].paginas : undefined;

  const html = useMemo(
    () => buildFichaHtml(ficha, lang, { preview: true, art, pictos, ilustraciones, fontCss, densidad }),
    [ficha, lang, art, pictos, ilustraciones, fontCss, densidad],
  );

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
      // `?.`: jsdom (las pruebas) no tiene scrollTo en los elementos
      if (!visible) scroller.scrollTo?.({ top: Math.max(0, top - 40), behavior: 'smooth' });
    }
  }, [selected, html, scale, height]);

  return (
    <>
      {conDensidad && onDensidad && (
        <div className="fe-compo">
          <label className="fe-compo-sel">
            <span className="fe-lbl">{t('Distribución de la hoja')}</span>
            <select
              className="finput" value={manual ?? 'auto'} title={t('La app mide la hoja y reparte el aire entre los ejercicios para que ocupe las menos páginas y deje pocos huecos.')}
              onChange={e => onDensidad(esDensidad(e.target.value) ? e.target.value : undefined)}
            >
              <option value="auto">{t('Automática')}{composicionVigente ? ` · ${t(CLAVE_DENSIDAD[composicionVigente.densidad])}` : ''}</option>
              {DENSIDADES.map(d => <option key={d} value={d}>{t(CLAVE_DENSIDAD[d])}</option>)}
            </select>
          </label>
          {paginas !== undefined && (
            <span className="fe-compo-pag">{paginas === 1 ? t('La hoja ocupa 1 página') : t('La hoja ocupa {n} páginas', { n: paginas })}</span>
          )}
        </div>
      )}
      <div ref={wrapRef} className="fe-preview-sheet" style={{ height: height * scale }}>
        <iframe
          ref={frameRef}
          title="preview"
          className="fe-preview-frame"
          style={{ width: DOC_W, height, transform: `scale(${scale})` }}
        />
      </div>
    </>
  );
}
