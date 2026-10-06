/**
 * Edición a mano de los apoyos visuales de una ficha (ver `lib/pictosFicha.ts`):
 * las tarjetas de la explicación, la indicación, los pasos y el «Recuerda» de
 * cada bloque, y la consigna y los dibujos de cada ejercicio. Cada dibujo se
 * cambia desde el mismo buscador de pictogramas que la agenda visual.
 */
import { useState } from 'react';
import { Plus, Search, Trash2, ImageOff } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n';
import { CATEGORIAS_PICTO, buscarPictos, pictoDe, urlPicto, type CategoriaPicto } from '../../lib/pictos';
import type { ConceptoVisual, FichaActivity, FichaExercise, PasoVisual, RecuerdaVisual } from '../../services/resources';

type T = (k: string, v?: Record<string, string | number>) => string;

/** El buscador de pictogramas: por palabra o por categoría. */
export function PictoPicker({ open, inicial, sinDibujo, onPick, onClose }: {
  open: boolean;
  inicial?: CategoriaPicto;
  /** Ofrece «Sin dibujo» para quitar el que hay. */
  sinDibujo?: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const [texto, setTexto] = useState('');
  const [cat, setCat] = useState<CategoriaPicto | undefined>(inicial);
  const resultado = buscarPictos(texto, lang, texto.trim() ? undefined : cat);
  const elegir = (id: string) => { onPick(id); setTexto(''); onClose(); };
  return (
    <Modal open={open} onClose={onClose} wide title={t('Elige un pictograma')}>
      <div className="ag-buscar">
        <Search size={15} aria-hidden="true" />
        <input className="finput" value={texto} onChange={e => setTexto(e.target.value)} placeholder={t('Buscar: leer, manzana, sumar…')} aria-label={t('Buscar un pictograma')} />
      </div>
      {!texto.trim() && (
        <div className="chip-row" style={{ margin: '10px 0' }}>
          {CATEGORIAS_PICTO.map(c => (
            <button key={c.id} type="button" className={`chip sm accent${cat === c.id ? ' on' : ''}`} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c[lang]}</button>
          ))}
        </div>
      )}
      {resultado.length === 0
        ? <p className="ap-vacio" style={{ margin: '12px 0' }}>{t('No hay ningún pictograma con ese nombre. Prueba con otra palabra.')}</p>
        : (
          <div className="ag-grid">
            {sinDibujo && (
              <button type="button" className="ag-op" onClick={() => elegir('')}>
                <span className="fe-vis-sin"><ImageOff size={28} /></span>
                <span>{t('Sin dibujo')}</span>
              </button>
            )}
            {resultado.map(p => (
              <button key={p.id} type="button" className="ag-op" onClick={() => elegir(p.id)}>
                <img src={urlPicto(p.id)} alt="" loading="lazy" />
                <span>{p[lang]}</span>
              </button>
            ))}
          </div>
        )}
    </Modal>
  );
}

/** Un dibujo que se cambia con un clic. */
export function PictoBoton({ id, onChange, label, inicial, sinDibujo = true, size = 44 }: {
  id: string | undefined;
  onChange: (id: string) => void;
  label: string;
  inicial?: CategoriaPicto;
  sinDibujo?: boolean;
  size?: number;
}) {
  const { t, lang } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const p = id ? pictoDe(id) : undefined;
  return (
    <>
      <button
        type="button" className="fe-vis-picto" style={{ width: size, height: size }} onClick={() => setAbierto(true)}
        aria-label={`${label}: ${p ? p[lang] : t('sin dibujo')}`} title={p ? p[lang] : t('Elegir dibujo')}
      >
        {p ? <img src={urlPicto(p.id)} alt="" /> : <Plus size={16} />}
      </button>
      {abierto && (
        <PictoPicker open inicial={p?.categoria ?? inicial} sinDibujo={sinDibujo} onPick={onChange} onClose={() => setAbierto(false)} />
      )}
    </>
  );
}

/** Las tarjetas de la explicación. */
export function ConceptosEditor({ conceptos, onChange, t }: { conceptos: ConceptoVisual[]; onChange: (c: ConceptoVisual[]) => void; t: T }) {
  const set = (i: number, p: Partial<ConceptoVisual>) => onChange(conceptos.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (
    <div className="fe-vis">
      <span className="fe-lbl">{t('Tarjetas con dibujo')}</span>
      {conceptos.map((c, i) => (
        <div key={i} className="fe-vis-row">
          <PictoBoton id={c.picto} label={t('Dibujo de la tarjeta {n}', { n: i + 1 })} inicial="matematicas" onChange={picto => set(i, { picto })} />
          <div className="fe-vis-fields">
            <input className="finput" value={c.titulo} placeholder={t('Nombre')} aria-label={t('Nombre de la tarjeta {n}', { n: i + 1 })} onChange={e => set(i, { titulo: e.target.value })} />
            <input className="finput" value={c.texto} placeholder={t('Una frase corta')} aria-label={t('Frase de la tarjeta {n}', { n: i + 1 })} onChange={e => set(i, { texto: e.target.value })} />
          </div>
          <button type="button" className="ico-btn sm" title={t('Quitar')} aria-label={t('Quitar la tarjeta {n}', { n: i + 1 })} onClick={() => onChange(conceptos.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
        </div>
      ))}
      {conceptos.length < 4 && (
        <button type="button" className="btn-ghost sm" onClick={() => onChange([...conceptos, { picto: '', titulo: '', texto: '' }])}><Plus size={14} />{t('Añadir tarjeta')}</button>
      )}
    </div>
  );
}

/** La indicación, los pasos y el «Recuerda» de un bloque. */
export function ActividadVisualEditor({ act, onChange, t }: { act: FichaActivity; onChange: (p: Partial<FichaActivity>) => void; t: T }) {
  const pasos = act.pasos ?? [];
  const recuerda = act.recuerda ?? [];
  const setPaso = (i: number, p: Partial<PasoVisual>) => onChange({ pasos: pasos.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const setRec = (i: number, p: Partial<RecuerdaVisual>) => onChange({ recuerda: recuerda.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return (
    <div className="fe-vis">
      <input
        className="finput" value={act.indicacion ?? ''} placeholder={t('Qué hay que hacer, en orden: «Primero, lee. Luego, rodea…»')}
        aria-label={t('Indicación del bloque')} onChange={e => onChange({ indicacion: e.target.value })}
      />
      <span className="fe-lbl">{t('Pasos')}</span>
      <div className="fe-vis-pasos">
        {pasos.map((p, i) => (
          <div key={i} className="fe-vis-paso">
            <span className="fe-vis-n">{i + 1}</span>
            <PictoBoton id={p.picto} label={t('Pictograma del paso {n}', { n: i + 1 })} inicial="consignas" sinDibujo={false} onChange={picto => setPaso(i, { picto })} />
            <input className="finput" value={p.verbo} placeholder={t('Lee')} aria-label={t('Verbo del paso {n}', { n: i + 1 })} onChange={e => setPaso(i, { verbo: e.target.value })} />
            <input className="finput" value={p.detalle} placeholder={t('cada enunciado')} aria-label={t('Qué, en el paso {n}', { n: i + 1 })} onChange={e => setPaso(i, { detalle: e.target.value })} />
            <button type="button" className="ico-btn sm" title={t('Quitar')} aria-label={t('Quitar el paso {n}', { n: i + 1 })} onClick={() => onChange({ pasos: pasos.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
          </div>
        ))}
        {pasos.length < 5 && (
          <button type="button" className="btn-ghost sm" onClick={() => onChange({ pasos: [...pasos, { picto: 'write', verbo: '', detalle: '' }] })}><Plus size={14} />{t('Añadir paso')}</button>
        )}
      </div>
      <span className="fe-lbl">{t('Recuerda')}</span>
      {recuerda.map((r, i) => (
        <div key={i} className="fe-vis-row">
          <PictoBoton id={r.picto} label={t('Dibujo de «Recuerda» {n}', { n: i + 1 })} inicial="matematicas" size={36} onChange={picto => setRec(i, { picto: picto || undefined })} />
          <input className="finput" value={r.texto} aria-label={t('«Recuerda» {n}', { n: i + 1 })} onChange={e => setRec(i, { texto: e.target.value })} />
          <button type="button" className="ico-btn sm" title={t('Quitar')} aria-label={t('Quitar «Recuerda» {n}', { n: i + 1 })} onClick={() => onChange({ recuerda: recuerda.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
        </div>
      ))}
      {recuerda.length < 4 && (
        <button type="button" className="btn-ghost sm" onClick={() => onChange({ recuerda: [...recuerda, { texto: '' }] })}><Plus size={14} />{t('Añadir a «Recuerda»')}</button>
      )}
    </div>
  );
}

/** La consigna dibujada de un ejercicio, sus dibujos y, en una tabla, el dibujo de cada fila. */
export function EjercicioVisualEditor({ ex, onChange, t }: { ex: FichaExercise; onChange: (p: Partial<FichaExercise>) => void; t: T }) {
  const imagenes = ex.imagenes ?? [];
  const setImg = (i: number, p: Partial<{ picto: string; cantidad: number }>) =>
    onChange({ imagenes: imagenes.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return (
    <div className="fe-vis fe-vis-ex">
      <div className="fe-vis-row">
        <PictoBoton id={ex.consigna} label={t('Consigna')} inicial="consignas" size={36} onChange={consigna => onChange({ consigna: consigna || undefined })} />
        <span className="fe-lbl">{t('Consigna')}</span>
        <span style={{ width: 10 }} />
        {imagenes.map((im, i) => (
          <span key={i} className="fe-vis-img">
            <PictoBoton
              id={im.picto} label={t('Dibujo {n}', { n: i + 1 })} inicial="comida" size={36}
              onChange={picto => (picto ? setImg(i, { picto }) : onChange({ imagenes: imagenes.filter((_, j) => j !== i) }))}
            />
            <input
              className="finput" type="number" min={1} max={10} value={im.cantidad ?? 1} aria-label={t('Cuántas veces, el dibujo {n}', { n: i + 1 })}
              onChange={e => setImg(i, { cantidad: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
            />
          </span>
        ))}
        {imagenes.length < 4 && (
          <PictoBoton id={undefined} label={t('Añadir un dibujo')} inicial="comida" size={36} sinDibujo={false} onChange={picto => onChange({ imagenes: [...imagenes, { picto, cantidad: 1 }] })} />
        )}
      </div>
      {ex.tipo === 'tabla_rellenar' && !!ex.filas?.length && (
        <div className="fe-vis-row">
          <span className="fe-lbl">{t('Dibujo de cada fila')}</span>
          {ex.filas.map((_, fi) => (
            <PictoBoton
              key={fi} id={ex.pictosFilas?.[fi] || undefined} label={t('Dibujo de la fila {n}', { n: fi + 1 })} inicial="comida" size={32}
              onChange={picto => onChange({ pictosFilas: ex.filas!.map((__, r) => (r === fi ? picto : ex.pictosFilas?.[r] ?? '')) })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
