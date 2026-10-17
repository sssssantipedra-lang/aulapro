/**
 * El texto de una ficha de comprensión lectora, editable: el tipo de texto, lo que dice la mascota, lo que se trabaja y
 * cada párrafo (o estrofa) con su dibujo del catálogo al lado. Todo lo que se cambia aquí se ve al instante en la hoja.
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { GENEROS_LECTURA, NOMBRE_GENERO, contarPalabras, esGenero, type FichaLectura } from '../../lib/lectura';
import { Dibujo, DibujoPicker } from './DibujosEditor';

type T = (k: string, v?: Record<string, string | number>) => string;

/** Quita el párrafo `i` y recoloca los dibujos de los de después. */
function sinParrafo(l: FichaLectura, i: number): FichaLectura {
  return {
    ...l,
    parrafos: l.parrafos.filter((_, j) => j !== i),
    dibujos: l.dibujos.filter(d => d.parrafo !== i).map(d => (d.parrafo > i ? { ...d, parrafo: d.parrafo - 1 } : d)),
  };
}

/** Intercambia el párrafo `i` con el vecino y se lleva sus dibujos. */
function moverParrafo(l: FichaLectura, i: number, dir: -1 | 1): FichaLectura {
  const j = i + dir;
  if (j < 0 || j >= l.parrafos.length) return l;
  const parrafos = [...l.parrafos];
  [parrafos[i], parrafos[j]] = [parrafos[j], parrafos[i]];
  return { ...l, parrafos, dibujos: l.dibujos.map(d => (d.parrafo === i ? { ...d, parrafo: j } : d.parrafo === j ? { ...d, parrafo: i } : d)) };
}

export function LecturaEditor({ lectura, onChange, t }: { lectura: FichaLectura; onChange: (l: FichaLectura) => void; t: T }) {
  const [eligiendo, setEligiendo] = useState<number | null>(null);
  const dibujoDe = (i: number) => lectura.dibujos.find(d => d.parrafo === i)?.ilustracion;
  const poner = (i: number, id: string) => onChange({ ...lectura, dibujos: [...lectura.dibujos.filter(d => d.parrafo !== i && d.ilustracion !== id), { ilustracion: id, parrafo: i }].sort((a, b) => a.parrafo - b.parrafo) });
  const quitar = (i: number) => onChange({ ...lectura, dibujos: lectura.dibujos.filter(d => d.parrafo !== i) });
  const poema = lectura.genero === 'poema';

  return (
    <div className="fe-lectura">
      <div className="fe-row">
        <label className="fe-field" style={{ flex: '0 0 190px' }}>
          <span className="fe-lbl">{t('Tipo de texto')}</span>
          <select className="finput" value={lectura.genero} onChange={e => esGenero(e.target.value) && onChange({ ...lectura, genero: e.target.value })}>
            {GENEROS_LECTURA.map(g => <option key={g} value={g}>{t(NOMBRE_GENERO[g])}</option>)}
          </select>
        </label>
        <label className="fe-field" style={{ flex: 1 }}>
          <span className="fe-lbl">{t('Lo que dice la mascota')}</span>
          <input className="finput" value={lectura.pista ?? ''} onChange={e => onChange({ ...lectura, pista: e.target.value })} placeholder={t('Fíjate en…')} />
        </label>
      </div>
      <label className="fe-field">
        <span className="fe-lbl">{t('Lo que se trabaja')} <em>· {t('separado por comas')}</em></span>
        <input
          className="finput" value={(lectura.destrezas ?? []).join(', ')} placeholder={t('Vocabulario, Orden de los hechos')}
          onChange={e => onChange({ ...lectura, destrezas: e.target.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 2) })}
        />
      </label>

      <div className="fe-lbl" style={{ margin: '4px 0 -2px' }}>
        {t(poema ? 'Estrofas' : 'Párrafos')} <em>· {t('{n} palabras', { n: contarPalabras(lectura.parrafos) })}</em>
      </div>
      {lectura.parrafos.map((p, i) => {
        const id = dibujoDe(i);
        return (
          <div key={i} className="fe-lec-par">
            <span className="fe-ex-n">{i + 1}</span>
            <textarea
              className="finput" rows={poema ? Math.max(3, p.split('\n').length) : Math.max(3, Math.ceil(p.length / 70))} value={p}
              aria-label={t(poema ? 'Estrofa {n}' : 'Párrafo {n}', { n: i + 1 })}
              onChange={e => onChange({ ...lectura, parrafos: lectura.parrafos.map((x, j) => (j === i ? e.target.value : x)) })}
            />
            <div className="fe-lec-acc">
              {id ? (
                <span className="fe-lec-dib" title={t('Cambiar el dibujo')}>
                  <button type="button" className="fe-lec-img" onClick={() => setEligiendo(i)}><Dibujo id={id} size={44} /></button>
                  <button type="button" className="fe-lec-x" aria-label={t('Quitar el dibujo')} onClick={() => quitar(i)}><X size={11} /></button>
                </span>
              ) : (
                <button type="button" className="ico-btn sm" title={t('Poner un dibujo junto a este párrafo')} aria-label={t('Poner un dibujo')} onClick={() => setEligiendo(i)}><ImagePlus size={15} /></button>
              )}
              <button type="button" className="ico-btn sm" title={t('Subir')} aria-label={t('Subir')} disabled={i === 0} onClick={() => onChange(moverParrafo(lectura, i, -1))}><ArrowUp size={14} /></button>
              <button type="button" className="ico-btn sm" title={t('Bajar')} aria-label={t('Bajar')} disabled={i === lectura.parrafos.length - 1} onClick={() => onChange(moverParrafo(lectura, i, 1))}><ArrowDown size={14} /></button>
              <button
                type="button" className="ico-btn sm" title={t('Eliminar')} aria-label={t('Eliminar')} disabled={lectura.parrafos.length <= 1}
                onClick={() => onChange(sinParrafo(lectura, i))}
              ><Trash2 size={14} color="var(--danger)" /></button>
            </div>
          </div>
        );
      })}
      <div className="fe-add-row">
        <button type="button" className="btn-ghost sm" onClick={() => onChange({ ...lectura, parrafos: [...lectura.parrafos, ''] })}><Plus size={14} />{t(poema ? 'Añadir estrofa' : 'Añadir párrafo')}</button>
      </div>
      <p className="fe-hint">{t('Si cambias el texto, repasa las actividades. En lectura fácil, las palabras clave van entre dos asteriscos: **dragón**.')}</p>

      <DibujoPicker
        open={eligiendo !== null} onClose={() => setEligiendo(null)}
        onPick={id => { if (eligiendo !== null) poner(eligiendo, id); }}
      />
    </div>
  );
}
