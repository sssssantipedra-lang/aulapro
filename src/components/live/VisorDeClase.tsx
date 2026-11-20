/**
 * Las imágenes de la sesión (y su circuito, en Educación Física) a toda la pizarra, con un toque desde la
 * ventana «Plan del día» («Dar la clase», 20-11-2026). Va dentro de la pizarra, así que también se ve con la
 * pantalla completa. Es un diálogo con su botón «Cerrar»: el botón de atrás lo cierra (`lib/loAbierto.ts`).
 */
import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { ImagenDeVisor } from '../../lib/darLaClase';

interface Props {
  imagenes: ImagenDeVisor[];
  indice: number;
  onCambiar: (indice: number) => void;
  onCerrar: () => void;
}

export function VisorDeClase({ imagenes, indice, onCambiar, onCerrar }: Props) {
  const { t } = useI18n();
  const n = imagenes.length;
  const i = Math.max(0, Math.min(n - 1, indice));
  const imagen = imagenes[i];

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
      else if (e.key === 'ArrowLeft' && n > 1) onCambiar((i - 1 + n) % n);
      else if (e.key === 'ArrowRight' && n > 1) onCambiar((i + 1) % n);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [i, n, onCambiar, onCerrar]);

  if (!imagen) return null;
  return (
    <div className="dlc-visor" role="dialog" aria-modal="true" aria-label={t('Imágenes de la sesión')} onClick={onCerrar}>
      <button type="button" className="dlc-visor-btn dlc-visor-cerrar" onClick={onCerrar} aria-label={t('Cerrar')} title={t('Cerrar')}><X size={22} /></button>
      {n > 1 && (
        <button type="button" className="dlc-visor-btn dlc-visor-ant" onClick={e => { e.stopPropagation(); onCambiar((i - 1 + n) % n); }} aria-label={t('Anterior')} title={t('Anterior')}>
          <ChevronLeft size={26} />
        </button>
      )}
      <figure className="dlc-visor-fig" onClick={e => e.stopPropagation()}>
        <img src={imagen.src} alt={imagen.pie ?? ''} draggable={false} />
        {(imagen.pie || n > 1) && (
          <figcaption>
            {imagen.pie}
            {n > 1 && <span>{i + 1} / {n}</span>}
          </figcaption>
        )}
      </figure>
      {n > 1 && (
        <button type="button" className="dlc-visor-btn dlc-visor-sig" onClick={e => { e.stopPropagation(); onCambiar((i + 1) % n); }} aria-label={t('Siguiente')} title={t('Siguiente')}>
          <ChevronRight size={26} />
        </button>
      )}
    </div>
  );
}
