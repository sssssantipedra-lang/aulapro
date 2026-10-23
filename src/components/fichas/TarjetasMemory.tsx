import { useEffect, useRef, useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n';
import { urlIlustracion } from '../../lib/ilustraciones';
import { urlPicto } from '../../lib/pictos';
import type { FichaTarjetaInteractiva } from '../../services/resources';

interface Props {
  onClose: () => void;
  titulo?: string;
  cards: FichaTarjetaInteractiva[];
}

interface Tile {
  /** Índice de la tarjeta a la que pertenece la casilla. */
  card: number;
  lado: 'imagen' | 'texto';
}

const urlDe = (tj: FichaTarjetaInteractiva) => (tj.imagenTipo === 'picto' ? urlPicto(tj.imagen) : urlIlustracion(tj.imagen));

/** mm:ss */
const reloj = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * Juego del memory con las tarjetas interactivas: cada pareja es una imagen y
 * su texto. Se elige cuántas parejas, se voltean de dos en dos y las parejas
 * encontradas se quedan giradas viendo el resultado.
 */
export function TarjetasMemory({ onClose, titulo, cards }: Props) {
  const { t } = useI18n();
  const opciones = [4, 6, 8, 10, 12].filter(n => n <= cards.length);
  const [numPares, setNumPares] = useState(() => Math.min(6, cards.length));
  const [empezado, setEmpezado] = useState(false);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [volteadas, setVolteadas] = useState<number[]>([]);
  const [acertadas, setAcertadas] = useState<Set<number>>(new Set());
  const [intentos, setIntentos] = useState(0);
  const [inicio, setInicio] = useState<number | null>(null);
  const [tiempo, setTiempo] = useState(0);
  const flipBack = useRef<ReturnType<typeof setTimeout> | null>(null);

  const terminado = empezado && acertadas.size === tiles.length && tiles.length > 0;

  function empezar() {
    const elegidas = cards.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, numPares);
    const t: Tile[] = [];
    elegidas.forEach(card => { t.push({ card, lado: 'imagen' }); t.push({ card, lado: 'texto' }); });
    if (flipBack.current) clearTimeout(flipBack.current);
    setTiles(t.sort(() => Math.random() - 0.5));
    setVolteadas([]);
    setAcertadas(new Set());
    setIntentos(0);
    setTiempo(0);
    setInicio(Date.now());
    setEmpezado(true);
  }

  // Cronómetro
  useEffect(() => {
    if (!inicio || terminado) return;
    const timer = setInterval(() => setTiempo(Math.floor((Date.now() - inicio) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [inicio, terminado]);

  useEffect(() => () => { if (flipBack.current) clearTimeout(flipBack.current); }, []);

  function tocar(i: number) {
    if (terminado || acertadas.has(i) || volteadas.includes(i) || volteadas.length >= 2) return;
    const next = [...volteadas, i];
    setVolteadas(next);
    if (next.length < 2) return;
    setIntentos(n => n + 1);
    const [a, b] = next;
    if (tiles[a].card === tiles[b].card) {
      const nuevo = new Set(acertadas);
      nuevo.add(a); nuevo.add(b);
      setAcertadas(nuevo);
      setVolteadas([]);
    } else {
      flipBack.current = setTimeout(() => setVolteadas([]), 850);
    }
  }

  const cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(tiles.length))));

  return (
    <div className="mem-overlay" role="dialog" aria-modal="true" aria-label={titulo || t('Memory')}>
      <div className="mem-top">
        <span className="mem-ttl">{titulo}</span>
        <span style={{ flex: 1 }} />
        {empezado && (
          <span className="mem-score">
            {t('Parejas: {n} de {m}', { n: acertadas.size / 2, m: tiles.length / 2 })} · {t('{n} intentos', { n: intentos })} · {reloj(tiempo)}
          </span>
        )}
        {empezado && (
          <button type="button" className="mem-ico" onClick={empezar} title={t('Barajar de nuevo')} aria-label={t('Barajar de nuevo')}><RotateCcw size={17} /></button>
        )}
        <button type="button" className="mem-ico" onClick={onClose} title={t('Salir')} aria-label={t('Salir')}><X size={20} /></button>
      </div>

      {!empezado ? (
        <div className="mem-setup">
          <p className="mem-setup-q">{t('¿Cuántas parejas?')}</p>
          <div className="mem-pares">
            {(opciones.length ? opciones : [cards.length]).map(n => (
              <button key={n} type="button" className={`mem-par${numPares === n ? ' on' : ''}`} onClick={() => setNumPares(n)}>{n}</button>
            ))}
          </div>
          <button type="button" className="mem-empezar" onClick={empezar}>{t('Empezar')}</button>
        </div>
      ) : (
        <div className="mem-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {tiles.map((tj, i) => {
            const arriba = acertadas.has(i) || volteadas.includes(i);
            const card = cards[tj.card];
            return (
              <button
                key={i} type="button" className={`mem-tile${arriba ? ' up' : ''}${acertadas.has(i) ? ' ok' : ''}`}
                onClick={() => tocar(i)} aria-label={arriba ? (tj.lado === 'imagen' ? card.texto : card.texto) : t('Voltear')}
              >
                <span className="mem-tile-inner">
                  <span className="mem-cara back">?</span>
                  <span className="mem-cara face">
                    {tj.lado === 'imagen'
                      ? <img src={urlDe(card)} alt="" draggable={false} />
                      : <span className="mem-texto">{card.texto}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {terminado && (
        <div className="mem-fin">
          <strong>{t('¡Todas las parejas!')}</strong>
          <span>{t('{n} intentos', { n: intentos })} · {reloj(tiempo)}</span>
          <button type="button" className="mem-empezar" onClick={empezar}>{t('Jugar de nuevo')}</button>
        </div>
      )}
    </div>
  );
}
