import { useEffect, useMemo, useState } from 'react';
import { X, ArrowLeft, ArrowRight, Shuffle, Check, Undo2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { urlIlustracion } from '../../lib/ilustraciones';
import { urlPicto } from '../../lib/pictos';
import type { FichaTarjetaInteractiva } from '../../services/resources';

interface Props {
  onClose: () => void;
  titulo?: string;
  cards: FichaTarjetaInteractiva[];
}

const urlDe = (tj: FichaTarjetaInteractiva) => (tj.imagenTipo === 'picto' ? urlPicto(tj.imagen) : urlIlustracion(tj.imagen));

/**
 * Modo de uso de las tarjetas interactivas: se proyectan a pantalla completa y
 * se giran al tocarlas. Se pueden barajar y marcar «lo sé / no lo sé» para
 * repasar solo las que fallan.
 */
export function TarjetasInteractivasPlay({ onClose, titulo, cards }: Props) {
  const { t } = useI18n();
  // Se monta solo mientras está abierto, así que aquí se baraja al abrir
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i).sort(() => Math.random() - 0.5));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  /** Índices (del array `cards`) marcados como «no lo sé». */
  const [fallan, setFallan] = useState<Set<number>>(new Set());
  const [soloFallan, setSoloFallan] = useState(false);

  const deck = useMemo(() => (soloFallan ? order.filter(i => fallan.has(i)) : order), [order, fallan, soloFallan]);
  const actual = deck[idx];
  const card = actual !== undefined ? cards[actual] : null;

  function pasar(d: number) {
    setFlipped(false);
    setIdx(i => Math.max(0, Math.min(deck.length - 1, i + d)));
  }
  function barajar() {
    setOrder(a => [...a].sort(() => Math.random() - 0.5));
    setIdx(0);
    setFlipped(false);
  }
  function marcar(loSabe: boolean) {
    if (actual === undefined) return;
    setFallan(prev => {
      const next = new Set(prev);
      if (loSabe) next.delete(actual); else next.add(actual);
      return next;
    });
    pasar(1);
  }

  // Teclado: flechas para pasar, espacio para girar, Esc para salir
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowRight') pasar(1);
      else if (e.key === 'ArrowLeft') pasar(-1);
      else if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, idx]);

  return (
    <div className="tip-overlay" role="dialog" aria-modal="true" aria-label={titulo || t('Tarjetas interactivas')}>
      <div className="tip-top">
        <span className="tip-ttl">{titulo}</span>
        <span className="tip-count">{deck.length ? `${idx + 1} / ${deck.length}` : '0'}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="tip-ico" onClick={barajar} title={t('Barajar')} aria-label={t('Barajar')}><Shuffle size={18} /></button>
        <button type="button" className={`tip-ico${soloFallan ? ' on' : ''}`} onClick={() => { setSoloFallan(v => !v); setIdx(0); setFlipped(false); }} title={t('Repasar solo las falladas')} aria-pressed={soloFallan}>
          <Undo2 size={18} />
        </button>
        <button type="button" className="tip-ico" onClick={onClose} title={t('Salir')} aria-label={t('Salir')}><X size={20} /></button>
      </div>

      {card && (
        <button type="button" className="tip-stage" onClick={() => setFlipped(f => !f)}>
          <div className={`tip-flip${flipped ? ' flipped' : ''}`}>
            <div className="tip-cara frente">
              {card.imagenDelante
                ? <img src={urlDe(card)} alt="" draggable={false} />
                : <span className="tip-texto">{card.texto}</span>}
            </div>
            <div className="tip-cara dorso">
              {card.imagenDelante
                ? <span className="tip-texto">{card.texto}</span>
                : <img src={urlDe(card)} alt="" draggable={false} />}
            </div>
          </div>
        </button>
      )}

      <div className="tip-bottom">
        <button type="button" className="tip-nav" onClick={() => pasar(-1)} disabled={idx === 0} aria-label={t('Anterior')}><ArrowLeft size={18} /></button>
        <button type="button" className="tip-juicio no" onClick={() => marcar(false)}>{t('No lo sé')}</button>
        <button type="button" className="tip-juicio si" onClick={() => marcar(true)}><Check size={16} />{t('Lo sé')}</button>
        <button type="button" className="tip-nav" onClick={() => pasar(1)} disabled={idx >= deck.length - 1} aria-label={t('Siguiente')}><ArrowRight size={18} /></button>
      </div>
    </div>
  );
}
