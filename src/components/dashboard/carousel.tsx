import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useI18n } from '../../i18n';

/** Anterior · pausa · siguiente, para la cabecera de la tarjeta. */
export function CarouselControls({
  pages, paused, onPause, onPrev, onNext,
}: {
  pages: number;
  paused: boolean;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { t } = useI18n();
  if (pages < 2) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <button className="ico-btn" title={t('Anterior')} onClick={onPrev}>
        <ChevronLeft size={14} />
      </button>
      <button
        className="ico-btn"
        title={t(paused ? 'Reanudar el paso automático' : 'Detener el paso automático')}
        onClick={onPause}
      >
        {paused ? <Play size={13} /> : <Pause size={13} />}
      </button>
      <button className="ico-btn" title={t('Siguiente')} onClick={onNext}>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

/** Los puntitos de debajo, que además dicen cuántas páginas hay. */
export function CarouselDots({
  pages, index, onGo, titleFor,
}: {
  pages: number;
  index: number;
  onGo: (i: number) => void;
  titleFor?: (i: number) => string;
}) {
  const { t } = useI18n();
  if (pages < 2) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 12 }}>
      {Array.from({ length: pages }, (_, i) => (
        <button
          key={i}
          onClick={() => onGo(i)}
          title={titleFor ? titleFor(i) : t('Página {n}', { n: i + 1 })}
          style={{
            width: i === index ? 18 : 6, height: 6, borderRadius: 99, border: 'none',
            cursor: 'pointer', padding: 0,
            background: i === index ? 'var(--accent-d)' : 'var(--border)',
            transition: 'width 0.3s ease, background 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}
