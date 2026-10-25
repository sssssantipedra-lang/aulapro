import { useRef } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Trash2 } from 'lucide-react';
import { MAX_IMAGENES_SESION } from '../../lib/imagenesSesion';
import type { EntradaDeImagenes } from '../../hooks/useEntradaDeImagenes';
import { useI18n } from '../../i18n';

/** Las imágenes del editor de una sesión: la zona para añadirlas y las que ya hay. El pegado y el arrastre, en `hooks/useEntradaDeImagenes.ts`. */

/** La franja que sale sobre el editor mientras se arrastra una imagen. */
export function AvisoDeSoltar({ visible }: { visible: boolean }) {
  const { t } = useI18n();
  if (!visible) return null;
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none', borderRadius: 12,
      border: '2.5px dashed var(--accent-d)', background: 'rgba(var(--accent-rgb),0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ background: 'var(--card)', padding: '10px 18px', borderRadius: 10, fontWeight: 700, color: 'var(--accent-d)', boxShadow: '0 4px 18px rgba(0,0,0,0.12)' }}>
        <ImagePlus size={16} style={{ verticalAlign: '-3px', marginRight: 7 }} />{t('Suelta la imagen para añadirla')}
      </span>
    </div>
  );
}

export function ImagenesSesion({ entrada }: { entrada: EntradaDeImagenes }) {
  const { t } = useI18n();
  const { imagenes, cambiar, ocupado, añadir } = entrada;
  const selector = useRef<HTMLInputElement>(null);

  const mover = (i: number, d: -1 | 1) => cambiar(prev => {
    const j = i + d;
    if (j < 0 || j >= prev.length) return prev;
    const sig = [...prev];
    [sig[i], sig[j]] = [sig[j], sig[i]];
    return sig;
  });
  const quitar = (id: string) => cambiar(prev => prev.filter(x => x.id !== id));
  const poner = (id: string, pie: string) => cambiar(prev => prev.map(x => (x.id === id ? { ...x, pie: pie || undefined } : x)));

  return (
    <div style={{ gridColumn: '1 / -1' }} data-testid="imagenes-sesion">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span className="flabel" style={{ margin: 0 }}>{t('Imágenes')}</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{t('{n} de {total}', { n: imagenes.length, total: MAX_IMAGENES_SESION })}</span>
      </div>

      <div style={{
        marginTop: 6, padding: '14px 16px', border: '1.5px dashed var(--border)', borderRadius: 12,
        background: 'var(--surface)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
      }}>
        <ImagePlus size={20} color="var(--accent-d)" aria-hidden="true" />
        <span style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
          {t('Pega una imagen con Ctrl+V, arrástrala al editor o elígela de un archivo.')}
        </span>
        <button type="button" className="btn-ghost" disabled={ocupado || imagenes.length >= MAX_IMAGENES_SESION}
          onClick={() => selector.current?.click()}>
          {ocupado ? <><span className="spin" />{t('Añadiendo…')}</> : t('Elegir imagen')}
        </button>
        <input
          ref={selector} type="file" accept="image/*" multiple hidden
          aria-label={t('Elegir imagen')}
          onChange={e => { const f = Array.from(e.target.files ?? []); e.target.value = ''; void añadir(f); }}
        />
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5, margin: '6px 2px 0' }}>
        {t('Se reducen para que los datos no pesen. Guarda la sesión para conservarlas: el borrador automático no las incluye.')}
      </p>

      {imagenes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, marginTop: 10 }}>
          {imagenes.map((im, i) => (
            <figure key={im.id} style={{ margin: 0, border: '1px solid var(--border)', borderRadius: 12, padding: 8, background: 'var(--card)' }}>
              <img src={im.src} alt={im.pie || t('Imagen {n} de la sesión', { n: i + 1 })}
                style={{ width: '100%', height: 150, objectFit: 'contain', background: 'var(--surface)', borderRadius: 8, display: 'block' }} />
              <input
                className="finput" style={{ marginTop: 8, fontSize: 12.5 }} value={im.pie ?? ''} maxLength={300}
                placeholder={t('Pie de foto (opcional)')} aria-label={t('Pie de la imagen {n}', { n: i + 1 })}
                onChange={e => poner(im.id, e.target.value)}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <button type="button" className="ico-btn" disabled={i === 0} onClick={() => mover(i, -1)}
                  aria-label={t('Mover antes')} title={t('Mover antes')}><ChevronLeft size={16} /></button>
                <button type="button" className="ico-btn" disabled={i === imagenes.length - 1} onClick={() => mover(i, 1)}
                  aria-label={t('Mover después')} title={t('Mover después')}><ChevronRight size={16} /></button>
                <div style={{ flex: 1 }} />
                <button type="button" className="ico-btn" onClick={() => quitar(im.id)}
                  aria-label={t('Quitar la imagen {n}', { n: i + 1 })} title={t('Quitar')}><Trash2 size={15} /></button>
              </div>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
