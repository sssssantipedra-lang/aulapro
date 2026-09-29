/**
 * Proyectar una ficha en clase, a pantalla completa y con el tema de la
 * ficha: la portada con el personaje y la misión, una pantalla por bloque
 * (o por sala del escape room) y el final con la insignia.
 *
 * En un escape room cada sala termina en un candado digital: la clase dice
 * el código, el docente lo teclea y, si es el bueno, la sala se abre. Abajo
 * va el mapa de la aventura, con cada paso marcado al completarlo, y arriba
 * un temporizador opcional. Las tarjetas recortables se proyectan de una en
 * una y se giran para ver la respuesta.
 *
 * Teclado: ← → para moverse, S para ver u ocultar las soluciones (solo si el
 * docente lo pide), F para pantalla completa y Esc para salir.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { X, ChevronLeft, ChevronRight, Maximize2, Eye, EyeOff, Play, Pause, Shuffle, RotateCcw } from 'lucide-react';
import type { Ficha } from '../../types';
import type { FichaExercise } from '../../services/resources';
import { cleanCode, shuffleApart } from '../../services/resources';
import { fichaTheme } from '../../lib/fichaThemes';
import { buildFigureSvg } from '../../lib/geometryFigures';
import { useI18n } from '../../i18n';

const TIME_OPTIONS = [0, 10, 15, 20, 30, 45];

function beep(times = 3) {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      const t = ctx.currentTime + i * 0.3;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.26);
    }
    setTimeout(() => ctx.close(), times * 320 + 400);
  } catch { /* sin audio: basta el aviso en pantalla */ }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Un ejercicio en grande, para leerlo desde el fondo del aula. */
function ProjExercise({ ex, n, showSol, color, t }: {
  ex: FichaExercise; n: number; showSol: boolean; color: string; t: (k: string) => string;
}) {
  const letra = (i: number) => String.fromCharCode(97 + i);
  return (
    <div className="cp-ex">
      <div className="cp-ex-q"><span className="cp-ex-n" style={{ background: color }}>{n}</span>{ex.enunciado}</div>
      {ex.figura && (
        <div className="cp-fig" dangerouslySetInnerHTML={{ __html: buildFigureSvg(ex.figura.forma, ex.figura.medidas, color) }} />
      )}
      {!!ex.opciones?.length && (
        <div className="cp-items">{ex.opciones.map((o, i) => <span key={i} className="cp-item"><b>{letra(i)})</b> {o}</span>)}</div>
      )}
      {!!ex.afirmaciones?.length && (
        <div className="cp-list">{ex.afirmaciones.map((a, i) => <div key={i} className="cp-row">{a}<span className="cp-vf">{t('V')} / {t('F')}</span></div>)}</div>
      )}
      {!!ex.elementos?.length && (
        <div className="cp-items">{ex.elementos.map((e, i) => <span key={i} className="cp-item">{e}</span>)}</div>
      )}
      {ex.tipo === 'relacionar' && !!ex.izquierda?.length && (
        <div className="cp-two">
          <div>{ex.izquierda.map((x, i) => <div key={i} className="cp-row">{i + 1}. {x}</div>)}</div>
          <div>{(ex.derecha ?? []).map((x, i) => <div key={i} className="cp-row">{letra(i).toUpperCase()}. {x}</div>)}</div>
        </div>
      )}
      {ex.tipo === 'tabla_rellenar' && !!ex.columnas?.length && (
        <table className="cp-table">
          <thead><tr>{ex.columnas.map((c, i) => <th key={i} style={{ background: color }}>{c}</th>)}</tr></thead>
          <tbody>{(ex.filas ?? []).map((f, r) => <tr key={r}>{f.map((c, i) => <td key={i}>{c || '…'}</td>)}</tr>)}</tbody>
        </table>
      )}
      {ex.tipo === 'colorear' && (
        <div className="cp-items">
          {(ex.leyenda ?? []).map((l, i) => <span key={`l${i}`} className="cp-item">🎨 {l.color}: {l.criterio}</span>)}
          {(ex.itemsColorear ?? []).map((x, i) => <span key={i} className="cp-item">{x}</span>)}
        </div>
      )}
      {ex.tipo === 'comic' && !!ex.vinetas?.length && (
        <div className="cp-comic">
          {ex.vinetas.map((v, i) => (
            <div key={i} className="cp-panel">
              <div className={`cp-bubble${v.texto ? '' : ' empty'}`}>{v.texto || '…?'}</div>
              <div className="cp-who">{v.personaje}</div>
            </div>
          ))}
        </div>
      )}
      {(ex.tipo === 'sopa_letras' || ex.tipo === 'crucigrama') && (
        <div className="cp-note">📄 {t('Resuélvelo en tu hoja')}</div>
      )}
      {showSol && ex.solucion && <div className="cp-sol">✅ {ex.solucion}</div>}
    </div>
  );
}

interface Props {
  ficha: Ficha;
  onClose: () => void;
}

export function ChallengePresenter({ ficha, onClose }: Props) {
  const { t } = useI18n();
  const c = ficha.content;
  const theme = fichaTheme(c.estilo);
  const story = theme.id !== 'clasico' ? c.historia : undefined;
  const escape = c.formato === 'escape';
  const cards = c.formato === 'tarjetas';
  const acts = useMemo(() => (cards ? [] : c.actividades ?? []), [cards, c.actividades]);
  const lastStep = cards ? 1 : acts.length + 1;
  const paso = escape ? 'Sala' : theme.paso;

  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const [showSol, setShowSol] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  /* ── Temporizador ── */
  const [minutes, setMinutes] = useState(escape ? 30 : 0);
  const [left, setLeft] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running || left === null || left <= 0) return;
    const id = window.setTimeout(() => {
      setLeft(left - 1);
      if (left - 1 <= 0) { setRunning(false); beep(4); }
    }, 1000);
    return () => window.clearTimeout(id);
  }, [running, left]);

  function start() {
    if (minutes > 0) { setLeft(minutes * 60); setRunning(true); }
    setStep(1);
  }

  /* ── Candado ── */
  const [code, setCode] = useState<string[]>([]);
  const [lockState, setLockState] = useState<'idle' | 'wrong' | 'open'>('idle');
  const [tries, setTries] = useState(0);
  const boxesRef = useRef<(HTMLInputElement | null)[]>([]);
  const act = step >= 1 && step <= acts.length ? acts[step - 1] : undefined;
  const lockLen = act?.candado ? Math.max(3, act.candado.codigo.length) : 0;

  function celebrate(big = false) {
    const colors = theme.bloques.map(b => `#${b.bg}`).concat(`#${theme.claro}`);
    confetti({ particleCount: big ? 220 : 110, spread: big ? 120 : 80, origin: { y: 0.6 }, colors, zIndex: 100000 });
  }

  function go(s: number) {
    const next = Math.max(0, Math.min(lastStep, s));
    if (next === step) return;
    setStep(next);
    setCode([]); setLockState('idle'); setTries(0);
    // Al llegar al final, la gran celebración y el reloj se para
    if (next === lastStep && !cards) { celebrate(true); setRunning(false); }
  }

  function completeStep(i: number) {
    setDone(d => new Set(d).add(i));
    celebrate();
  }

  function checkCode() {
    if (!act?.candado) return;
    if (cleanCode(code.join('')) === act.candado.codigo) {
      setLockState('open');
      completeStep(step);
    } else {
      setLockState('wrong');
      setTries(n => n + 1);
      window.setTimeout(() => setLockState('idle'), 700);
    }
  }


  /* ── Tarjetas ── */
  const [order, setOrder] = useState<number[]>(() => (c.tarjetas ?? []).map((_, i) => i));
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const deck = c.tarjetas ?? [];
  const card = deck[order[cardIdx]];
  function moveCard(d: number) {
    setFlipped(false);
    setCardIdx(i => Math.max(0, Math.min(deck.length - 1, i + d)));
  }
  function shuffle() {
    setOrder(shuffleApart(order)); setCardIdx(0); setFlipped(false);
  }

  /* ── Teclado y pantalla completa ── */
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  }

  // El manejador cambia en cada render (usa el paso actual); se escucha una sola vez y se llama al último
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyRef.current = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT';
      if (e.key === 'Escape' && !document.fullscreenElement) { onClose(); return; }
      if (typing) return;
      if (cards && step === 1) {
        if (e.key === 'ArrowRight') moveCard(1);
        else if (e.key === 'ArrowLeft') moveCard(-1);
        else if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f); }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') go(e.key === 'ArrowUp' ? 0 : 1);
      } else {
        if (e.key === 'ArrowRight') go(step + 1);
        else if (e.key === 'ArrowLeft') go(step - 1);
      }
      if (e.key.toLowerCase() === 's') setShowSol(v => !v);
      if (e.key.toLowerCase() === 'f') toggleFull();
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (lockLen) boxesRef.current[0]?.focus(); }, [step, lockLen]);

  const vars = {
    '--cp-c': `#${theme.color}`, '--cp-cd': `#${theme.oscuro}`, '--cp-cl': `#${theme.claro}`,
    '--cp-font': theme.fuenteTitulo,
  } as React.CSSProperties;
  const blockColor = (i: number) => `#${theme.bloques[i % theme.bloques.length].bg}`;
  const actEmoji = (i: number) => acts[i]?.emoji || theme.iconos[i % theme.iconos.length];

  return (
    <div ref={rootRef} className="cp" style={vars} role="dialog" aria-modal="true" aria-label={c.titulo}>
      <div className="cp-bg" aria-hidden="true">
        {theme.adornos.concat(theme.adornos).map((a, i) => (
          <motion.span
            key={i} className="cp-deco"
            style={{ left: `${(i * 37 + 7) % 92}%`, top: `${(i * 53 + 11) % 80}%`, fontSize: 26 + (i % 3) * 12 }}
            animate={{ y: [0, -14, 0], rotate: [0, i % 2 ? 8 : -8, 0] }}
            transition={{ duration: 5 + (i % 4), repeat: Infinity, ease: 'easeInOut' }}
          >{a}</motion.span>
        ))}
      </div>

      {/* Barra superior */}
      <div className="cp-top">
        <span className="cp-kicker">{t(theme.nombre)}</span>
        <span className="cp-top-title">{c.titulo}</span>
        <span style={{ flex: 1 }} />
        {left !== null && (
          <button type="button" className={`cp-timer${left <= 60 ? ' low' : ''}${left <= 0 ? ' over' : ''}`} onClick={() => setRunning(r => !r)} title={t(running ? 'Pausar' : 'Seguir')}>
            {running ? <Pause size={16} /> : <Play size={16} />}{left <= 0 ? t('¡Tiempo!') : mmss(left)}
          </button>
        )}
        {!cards && (
          <button type="button" className="cp-ico" onClick={() => setShowSol(v => !v)} title={t(showSol ? 'Ocultar soluciones (S)' : 'Ver soluciones (S)')} aria-pressed={showSol}>
            {showSol ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
        <button type="button" className="cp-ico" onClick={toggleFull} title={t('Pantalla completa (F)')}><Maximize2 size={18} /></button>
        <button type="button" className="cp-ico" onClick={onClose} title={t('Salir (Esc)')} aria-label={t('Salir')}><X size={20} /></button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={cards && step === 1 ? 'deck' : step}
          className="cp-stage"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.35 }}
        >
          {/* Portada */}
          {step === 0 && (
            <div className="cp-cover">
              <motion.div className="cp-hero" animate={{ y: [0, -10, 0] }} transition={{ duration: 2.4, repeat: Infinity }}>
                {story?.emoji || theme.personaje}
              </motion.div>
              <h1 className="cp-h1">{c.titulo}</h1>
              {story?.mision && (
                <div className="cp-mission">
                  <div className="cp-mission-who">{story.personaje}</div>
                  {story.mision}
                </div>
              )}
              {cards && c.instrucciones && <div className="cp-mission"><div className="cp-mission-who">{t('Cómo se juega')}</div>{c.instrucciones}</div>}
              {!cards && (
                <div className="cp-time-pick">
                  <span>⏱️ {t('Tiempo')}:</span>
                  {TIME_OPTIONS.map(m => (
                    <button key={m} type="button" className={`cp-chip${minutes === m ? ' on' : ''}`} onClick={() => setMinutes(m)}>
                      {m ? `${m} min` : t('Sin tiempo')}
                    </button>
                  ))}
                </div>
              )}
              <motion.button type="button" className="cp-start" onClick={start} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                {cards ? t('Empezar el juego') : escape ? t('¡Empezar a escapar!') : t('¡Empezar la misión!')}
              </motion.button>
            </div>
          )}

          {/* Bloques / salas */}
          {act && (
            <div className="cp-room">
              <div className="cp-room-hd" style={{ background: blockColor(step - 1) }}>
                <span className="cp-room-emoji">{actEmoji(step - 1)}</span>
                <span>{t(paso)} {step} · {act.titulo}</span>
                {done.has(step) && <span className="cp-done-badge">✓</span>}
              </div>
              {act.narrativa && <div className="cp-narr">{act.narrativa}</div>}
              <div className="cp-exs">
                {act.ejercicios.map((ex, i) => (
                  <ProjExercise key={i} ex={ex} n={i + 1} showSol={showSol} color={blockColor(step - 1)} t={t} />
                ))}
              </div>

              {act.candado ? (
                <div className={`cp-lock ${lockState}`}>
                  <motion.div
                    className="cp-lock-ico"
                    animate={lockState === 'wrong' ? { x: [0, -12, 12, -8, 8, 0] } : lockState === 'open' ? { rotate: [0, -15, 0], scale: [1, 1.25, 1] } : {}}
                    transition={{ duration: 0.5 }}
                  >{lockState === 'open' ? '🔓' : '🔒'}</motion.div>
                  <div className="cp-lock-body">
                    {act.candado.pista && <div className="cp-lock-hint">{act.candado.pista}</div>}
                    {lockState === 'open' ? (
                      <div className="cp-lock-ok">{step < acts.length ? t('¡Abierto! Pasad a la sala {n}', { n: step + 1 }) : t('¡Abierto! Solo queda el cofre final')}</div>
                    ) : (
                      <form className="cp-lock-boxes" onSubmit={e => { e.preventDefault(); checkCode(); }}>
                        {Array.from({ length: lockLen }, (_, i) => (
                          <input
                            key={i}
                            ref={el => { boxesRef.current[i] = el; }}
                            className="cp-box" maxLength={1} value={code[i] ?? ''} aria-label={t('Carácter {n} del código', { n: i + 1 })}
                            onChange={e => {
                              const v = cleanCode(e.target.value).slice(-1);
                              setCode(cd => { const n = [...cd]; n[i] = v; return n; });
                              if (v && i < lockLen - 1) boxesRef.current[i + 1]?.focus();
                            }}
                            onKeyDown={e => { if (e.key === 'Backspace' && !code[i] && i > 0) boxesRef.current[i - 1]?.focus(); }}
                          />
                        ))}
                        <button type="submit" className="cp-check" disabled={code.filter(Boolean).length < lockLen}>{t('Abrir')}</button>
                      </form>
                    )}
                    {lockState !== 'open' && tries > 0 && <div className="cp-lock-bad">{t('Código incorrecto. Intentos: {n}', { n: tries })}</div>}
                  </div>
                </div>
              ) : (
                <div className="cp-complete-row">
                  <button type="button" className={`cp-complete${done.has(step) ? ' on' : ''}`} onClick={() => completeStep(step)}>
                    {done.has(step) ? `✓ ${t('¡Completado!')}` : t('Marcar como completado')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Final */}
          {!cards && step === lastStep && (
            <div className="cp-final">
              <motion.div className="cp-badge" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 12 }}>
                <span>{story?.emoji || '🏆'}</span>
              </motion.div>
              <h1 className="cp-h1">{t(escape ? '¡Habéis escapado!' : '¡Misión cumplida!')}</h1>
              {story?.insignia && <div className="cp-insignia">{story.insignia}</div>}
              {story?.cierre && <p className="cp-cierre">{story.cierre}</p>}
              {left !== null && minutes > 0 && (
                <div className="cp-time-used">⏱️ {t('Tiempo usado: {t}', { t: mmss(Math.max(0, minutes * 60 - left)) })}</div>
              )}
            </div>
          )}

          {/* Tarjetas */}
          {cards && step === 1 && card && (
            <div className="cp-deck">
              <div className="cp-deck-count">{cardIdx + 1} / {deck.length}</div>
              <button type="button" className={`cp-card${flipped ? ' flipped' : ''}`} onClick={() => setFlipped(f => !f)} aria-label={t(flipped ? 'Ver la pregunta' : 'Ver la respuesta')}>
                <span className="cp-card-inner">
                  <span className="cp-card-face front" style={{ borderColor: blockColor(order[cardIdx]) }}>
                    <span className="cp-card-emoji">{theme.iconos[order[cardIdx] % theme.iconos.length]}</span>
                    <span className="cp-card-q">{card.pregunta}</span>
                    <span className="cp-card-hint">{t('Clic o espacio para girar')}</span>
                  </span>
                  <span className="cp-card-face back" style={{ background: blockColor(order[cardIdx]) }}>
                    <span className="cp-card-lbl">{t('Respuesta')}</span>
                    <span className="cp-card-a">{card.respuesta}</span>
                  </span>
                </span>
              </button>
              <div className="cp-deck-nav">
                <button type="button" className="cp-ico big" onClick={() => moveCard(-1)} disabled={cardIdx === 0} aria-label={t('Anterior')}><ChevronLeft size={26} /></button>
                <button type="button" className="cp-chip" onClick={shuffle}><Shuffle size={15} />{t('Barajar')}</button>
                <button type="button" className="cp-chip" onClick={() => { setOrder(deck.map((_, i) => i)); setCardIdx(0); setFlipped(false); }}><RotateCcw size={15} />{t('En orden')}</button>
                <button type="button" className="cp-ico big" onClick={() => moveCard(1)} disabled={cardIdx === deck.length - 1} aria-label={t('Siguiente')}><ChevronRight size={26} /></button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Mapa de la aventura */}
      {!cards && (
        <nav className="cp-map" aria-label={t('Mapa de la aventura')}>
          <button type="button" className="cp-nav" onClick={() => go(step - 1)} disabled={step === 0} aria-label={t('Anterior')}><ChevronLeft size={22} /></button>
          <button type="button" className={`cp-dot${step === 0 ? ' cur' : ''} done`} onClick={() => go(0)} title={t('Portada')}>⭐</button>
          {acts.map((_, i) => (
            <span key={i} className="cp-map-seg">
              <span className={`cp-line${done.has(i + 1) ? ' done' : ''}`} />
              <button
                type="button" className={`cp-dot${step === i + 1 ? ' cur' : ''}${done.has(i + 1) ? ' done' : ''}`}
                onClick={() => go(i + 1)} title={`${t(paso)} ${i + 1}: ${acts[i].titulo}`}
              >
                {done.has(i + 1) ? '✓' : actEmoji(i)}
              </button>
            </span>
          ))}
          <span className="cp-map-seg">
            <span className={`cp-line${done.size >= acts.length && acts.length > 0 ? ' done' : ''}`} />
            <button type="button" className={`cp-dot${step === lastStep ? ' cur' : ''}`} onClick={() => go(lastStep)} title={t('Final')}>{escape ? '🧰' : '🏆'}</button>
          </span>
          <button type="button" className="cp-nav" onClick={() => go(step + 1)} disabled={step === lastStep} aria-label={t('Siguiente')}><ChevronRight size={22} /></button>
        </nav>
      )}
      {cards && step === 1 && (
        <button type="button" className="cp-back-cover" onClick={() => go(0)}>{t('Volver a la portada')}</button>
      )}
    </div>
  );
}
