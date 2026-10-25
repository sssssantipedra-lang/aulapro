import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { ImagenSesion } from '../../types/ef';
import { MAX_IMAGENES_SESION, imagenesValidas } from '../../lib/imagenesSesion';
import { useEntradaDeImagenes } from '../../hooks/useEntradaDeImagenes';
import { AvisoDeSoltar } from './ImagenesSesion';
import { useI18n } from '../../i18n';

/**
 * Imágenes en una sesión de una situación de aprendizaje (25-10-2026, petición
 * del dueño: «que las sesiones de las situaciones de aprendizaje también puedan
 * llevar imágenes arrastradas por el docente»).
 *
 * Una situación tiene muchas sesiones, así que aquí no se atiende el Ctrl+V de
 * todo el documento (no se sabría a cuál va): se arrastra la imagen sobre la
 * propia sesión, o se pulsa «Añadir imagen» y se pega en la zona que se abre
 * (ya enfocada), o se elige de un archivo. La sesión envuelve su contenido:
 * toda ella es zona para soltar.
 */

interface Props {
  /** Las de la sesión, tal como están guardadas. */
  imagenes?: ImagenSesion[];
  onChange: (f: (anteriores: ImagenSesion[]) => ImagenSesion[]) => void;
  /** El número de la sesión (1, 2, 3…), para los nombres que leen los lectores de pantalla. */
  numero: number;
  /** Lo que ya enseña la sesión (título, descripción, momentos). */
  children: ReactNode;
}

export function ImagenesDeSesionSda({ imagenes, onChange, numero, children }: Props) {
  const { t } = useI18n();
  const lista = imagenesValidas(imagenes ?? []);
  const entrada = useEntradaDeImagenes(lista, onChange, true, 'elemento');
  const [zona, setZona] = useState(false);
  const zonaRef = useRef<HTMLDivElement>(null);
  const selector = useRef<HTMLInputElement>(null);
  // Al abrir la zona, enfocada: así el Ctrl+V va a ella
  useEffect(() => { if (zona) zonaRef.current?.focus(); }, [zona]);

  const quitar = (id: string) => onChange(prev => prev.filter(x => x.id !== id));
  const poner = (id: string, pie: string) => onChange(prev => prev.map(x => (x.id === id ? { ...x, pie: pie || undefined } : x)));
  const lleno = lista.length >= MAX_IMAGENES_SESION;

  return (
    <div style={{ minWidth: 0, flex: 1, position: 'relative' }} {...entrada.arrastre}>
      <AvisoDeSoltar visible={entrada.arrastrando} />
      {children}

      {lista.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8, marginTop: 8 }}>
          {lista.map((im, i) => (
            <figure key={im.id} style={{ margin: 0, border: '1px solid var(--border)', borderRadius: 10, padding: 6, background: 'var(--card)' }}>
              <img src={im.src} alt={im.pie || t('Imagen {n} de la sesión {s}', { n: i + 1, s: numero })}
                style={{ width: '100%', height: 96, objectFit: 'contain', background: 'var(--surface)', borderRadius: 6, display: 'block' }} />
              <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
                <input
                  className="finput" style={{ fontSize: 11.5, padding: '4px 7px', minWidth: 0, flex: 1 }} value={im.pie ?? ''} maxLength={300}
                  placeholder={t('Pie de foto (opcional)')} aria-label={t('Pie de la imagen {n} de la sesión {s}', { n: i + 1, s: numero })}
                  onChange={e => poner(im.id, e.target.value)}
                />
                <button type="button" className="ico-btn" onClick={() => quitar(im.id)}
                  aria-label={t('Quitar la imagen {n} de la sesión {s}', { n: i + 1, s: numero })} title={t('Quitar')}><Trash2 size={14} /></button>
              </div>
            </figure>
          ))}
        </div>
      )}

      <div style={{ marginTop: 6 }}>
        <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '3px 9px' }}
          aria-expanded={zona} aria-label={t('Añadir una imagen a la sesión {s}', { s: numero })}
          disabled={lleno} onClick={() => setZona(z => !z)}>
          <ImagePlus size={13} />{t('Añadir imagen')}
        </button>
      </div>

      {zona && (
        <div
          ref={zonaRef} tabIndex={0} role="group" aria-label={t('Zona para pegar una imagen en la sesión {s}', { s: numero })}
          onPaste={entrada.alPegar}
          style={{
            marginTop: 6, padding: '10px 12px', border: '1.5px dashed var(--accent-d)', borderRadius: 10, outlineOffset: 2,
            background: 'rgba(var(--accent-rgb),0.06)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
          }}
        >
          <span style={{ flex: 1, minWidth: 180, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 }}>
            {t('Pega aquí con Ctrl+V una imagen, arrastra una sobre la sesión o elige un archivo.')}
          </span>
          <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '3px 9px' }} disabled={entrada.ocupado}
            onClick={() => selector.current?.click()}>
            {entrada.ocupado ? <><span className="spin" />{t('Añadiendo…')}</> : t('Elegir imagen')}
          </button>
          <input
            ref={selector} type="file" accept="image/*" multiple hidden aria-label={t('Elegir imagen')}
            onChange={e => { const f = Array.from(e.target.files ?? []); e.target.value = ''; void entrada.añadir(f); }}
          />
        </div>
      )}
    </div>
  );
}
