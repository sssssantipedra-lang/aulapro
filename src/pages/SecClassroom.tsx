import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import {
  Clock3, Mic, MicOff, Play, Pause, RotateCcw, TimerReset, Volume2,
  Plus, Minus, Palette, Eraser, ExternalLink, X, Disc3, Trophy,
  RefreshCw, Link as LinkIcon, PenLine, Calculator, Delete,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

/* ════════════════════════════════════════════════════════════
   Aula Live — panel de herramientas para proyectar en clase
   ════════════════════════════════════════════════════════════ */

type WidgetType = 'wheel' | 'timer' | 'noise' | 'embed' | 'calc';

interface WidgetConfig {
  id: WidgetType;
  title: string;
  icon: React.ReactNode;
  accent: string;
}

const APPS: WidgetConfig[] = [
  { id: 'timer', title: 'Temporizador', icon: <Clock3 size={19} />,       accent: '#22d3ee' },
  { id: 'wheel', title: 'Ruleta',       icon: <Disc3 size={19} />,        accent: '#a78bfa' },
  { id: 'calc',  title: 'Calculadora',  icon: <Calculator size={19} />,   accent: '#f472b6' },
  { id: 'noise', title: 'Sonómetro',    icon: <Volume2 size={19} />,      accent: '#34d399' },
  { id: 'embed', title: 'Contenido',    icon: <ExternalLink size={19} />, accent: '#fbbf24' },
];

/** Nombres de relleno cuando aún no hay alumnos creados. */
const DEFAULT_NAMES = ['Ana', 'Luis', 'Carlos', 'María', 'Jorge', 'Lucía'];

const PEN_COLORS = ['#f8fafc', '#38bdf8', '#f472b6', '#facc15', '#4ade80'];

const WHEEL_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
];

/* ── Utilidades ── */

/** Punto en un círculo. Ángulo en grados, 0 = arriba, sentido horario. */
function pointAt(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

/** Pitido corto sin necesidad de archivos de audio. */
function beep(times = 3) {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.28;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.start(t);
      osc.stop(t + 0.24);
    }
    setTimeout(() => ctx.close(), times * 300 + 400);
  } catch {
    // Sin audio disponible: el aviso visual es suficiente.
  }
}

/* ════════════════════════════════════════════════════════════
   Marco de ventana
   ════════════════════════════════════════════════════════════ */

function WidgetShell({
  title, icon, accent, onClose, children,
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="w-full h-full overflow-hidden rounded-[26px] flex flex-col"
      style={{
        background: 'linear-gradient(160deg, rgba(30,41,59,0.82), rgba(15,23,42,0.92))',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: `0 24px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14), 0 0 0 1px ${accent}22`,
      }}
    >
      <div
        className="drag-handle cursor-move flex items-center gap-3 px-5 py-3.5 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.035)' }}
      >
        <span
          className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ width: 30, height: 30, background: `${accent}22`, color: accent }}
        >
          {icon}
        </span>
        <h2 className="text-white font-bold text-[15px] tracking-tight flex-1 min-w-0 truncate">
          {title}
        </h2>
        <button
          onClick={onClose}
          title="Cerrar"
          className="flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
          style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.55)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 min-h-0 p-5">{children}</div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TEMPORIZADOR
   ════════════════════════════════════════════════════════════ */

/** Presets en segundos. */
const PRESETS: { label: string; secs: number }[] = [
  { label: '30 s',  secs: 30 },
  { label: '1 min', secs: 60 },
  { label: '5 min', secs: 300 },
  { label: '10 min', secs: 600 },
];

const MAX_SECONDS = 99 * 60 + 59;

function TimerWidget() {
  const [total, setTotal]     = useState(300);  // duración configurada
  const [seconds, setSeconds] = useState(300);  // restante
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  // Edición manual del tiempo
  const [editing, setEditing] = useState(false);
  const [draftMin, setDraftMin] = useState('05');
  const [draftSec, setDraftSec] = useState('00');
  const minRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          setRunning(false);
          setFinished(true);
          beep();
          confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const setDuration = useCallback((secs: number) => {
    const v = Math.max(0, Math.min(MAX_SECONDS, Math.round(secs)));
    setTotal(v);
    setSeconds(v);
    setRunning(false);
    setFinished(false);
  }, []);

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  /** Abre la edición manual con el tiempo actual. */
  function startEditing() {
    if (running) return;
    setDraftMin(String(Math.floor(total / 60)).padStart(2, '0'));
    setDraftSec(String(total % 60).padStart(2, '0'));
    setEditing(true);
    setTimeout(() => minRef.current?.select(), 20);
  }

  /** Acepta lo escrito. Los segundos por encima de 59 se pasan a minutos. */
  function commitEditing() {
    const m = Math.max(0, parseInt(draftMin || '0', 10) || 0);
    const s = Math.max(0, parseInt(draftSec || '0', 10) || 0);
    setDuration(m * 60 + s);
    setEditing(false);
  }

  const pct = total > 0 ? seconds / total : 0;
  const color = finished ? '#f43f5e' : pct <= 0.1 ? '#f43f5e' : pct <= 0.25 ? '#fbbf24' : '#22d3ee';

  const R = 78;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="flex flex-col items-center justify-between h-full">
      {/* Presets */}
      <div className="flex gap-1.5 flex-wrap justify-center">
        {PRESETS.map(p => {
          const active = total === p.secs;
          return (
            <button
              key={p.secs}
              onClick={() => setDuration(p.secs)}
              className="rounded-full text-[12px] font-bold transition-all"
              style={{
                padding: '5px 12px',
                background: active ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.06)',
                color: active ? '#67e8f9' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${active ? 'rgba(34,211,238,0.45)' : 'transparent'}`,
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Anillo + dígitos */}
      <motion.div
        className="relative flex items-center justify-center"
        animate={finished ? { scale: [1, 1.05, 1] } : {}}
        transition={{ repeat: finished ? Infinity : 0, duration: 1.1 }}
      >
        <svg width={190} height={190} className="-rotate-90">
          <circle cx={95} cy={95} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={11} />
          <motion.circle
            cx={95} cy={95} r={R} fill="none" stroke={color} strokeWidth={11} strokeLinecap="round"
            strokeDasharray={CIRC}
            animate={{ strokeDashoffset: CIRC * (1 - pct) }}
            transition={{ duration: 0.4, ease: 'linear' }}
            style={{ filter: `drop-shadow(0 0 9px ${color}88)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {editing ? (
            <div className="flex items-center gap-0.5">
              {[
                { ref: minRef, value: draftMin, set: setDraftMin, label: 'min' },
                { ref: undefined, value: draftSec, set: setDraftSec, label: 'seg' },
              ].map((f, i) => (
                <React.Fragment key={f.label}>
                  {i === 1 && <span className="text-white/50 font-black" style={{ fontSize: 38 }}>:</span>}
                  <div className="flex flex-col items-center">
                    <input
                      ref={f.ref}
                      value={f.value}
                      onChange={e => f.set(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitEditing();
                        if (e.key === 'Escape') setEditing(false);
                      }}
                      onFocus={e => e.currentTarget.select()}
                      inputMode="numeric"
                      className="font-black text-white text-center outline-none rounded-lg"
                      style={{
                        fontSize: 38, width: 62, padding: '2px 0',
                        fontVariantNumeric: 'tabular-nums',
                        background: 'rgba(255,255,255,0.09)',
                        border: '1.5px solid rgba(34,211,238,0.5)',
                      }}
                    />
                    <span className="text-white/35 text-[10px] font-bold mt-0.5">{f.label}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <>
              <button
                onClick={startEditing}
                disabled={running}
                title={running ? undefined : 'Haz clic para escribir el tiempo'}
                className="font-black text-white leading-none rounded-xl transition-colors"
                style={{
                  fontSize: 46, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                  background: 'transparent', padding: '2px 8px',
                  cursor: running ? 'default' : 'pointer',
                }}
                onMouseEnter={e => { if (!running) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {mins}:{secs}
              </button>
              {finished ? (
                <div className="text-[13px] font-bold mt-1" style={{ color: '#fb7185' }}>¡Tiempo!</div>
              ) : !running && (
                <div className="text-[10px] font-semibold mt-0.5 text-white/25">toca para editar</div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {editing && (
        <div className="flex gap-2">
          <button
            onClick={commitEditing}
            className="rounded-lg font-bold text-[12.5px]"
            style={{ padding: '6px 18px', background: 'rgba(34,211,238,0.22)', color: '#67e8f9' }}
          >
            Aceptar
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg font-bold text-[12.5px] text-white/50"
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.06)' }}
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Controles */}
      <div className="flex flex-col items-center gap-2.5 w-full" style={{ display: editing ? 'none' : undefined }}>
        <div className="flex gap-2 items-center justify-center">
          <button
            onClick={() => setDuration(total - 60)}
            title="Un minuto menos"
            className="flex items-center justify-center rounded-xl text-white/70 hover:text-white transition-colors"
            style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.07)' }}
          >
            <Minus size={17} />
          </button>

          <button
            onClick={() => { setFinished(false); setRunning(r => !r); }}
            disabled={seconds === 0}
            className="flex items-center justify-center gap-2 rounded-xl font-bold text-[14px] transition-all disabled:opacity-40"
            style={{
              padding: '0 26px', height: 44, color: '#04141a',
              background: running
                ? 'linear-gradient(135deg,#fbbf24,#f59e0b)'
                : 'linear-gradient(135deg,#34d399,#22d3ee)',
              boxShadow: `0 6px 20px ${running ? 'rgba(245,158,11,0.4)' : 'rgba(34,211,238,0.35)'}`,
            }}
          >
            {running ? <><Pause size={17} />Pausa</> : <><Play size={17} />Iniciar</>}
          </button>

          <button
            onClick={() => setDuration(total + 60)}
            title="Un minuto más"
            className="flex items-center justify-center rounded-xl text-white/70 hover:text-white transition-colors"
            style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.07)' }}
          >
            <Plus size={17} />
          </button>
        </div>

        <button
          onClick={() => setDuration(total)}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-white/45 hover:text-white/80 transition-colors"
        >
          <TimerReset size={13} />Reiniciar
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SONÓMETRO
   ════════════════════════════════════════════════════════════ */

type MicState = 'idle' | 'asking' | 'on' | 'denied';

const BAR_COUNT = 22;

function NoiseWidget() {
  const [micState, setMicState] = useState<MicState>('idle');
  const [level, setLevel]       = useState(0);      // 0-100 suavizado
  const [spectrum, setSpectrum] = useState<number[]>(() => new Array(BAR_COUNT).fill(0));
  const [limit, setLimit]       = useState(55);
  const [overLimit, setOverLimit] = useState(false);

  const cleanupRef = useRef<(() => void) | null>(null);
  const overSinceRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setMicState('idle');
    setLevel(0);
    setSpectrum(new Array(BAR_COUNT).fill(0));
    setOverLimit(false);
  }, []);

  const start = useCallback(async () => {
    setMicState('asking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      let raf = 0;
      let smooth = 0;

      const tick = () => {
        analyser.getByteFrequencyData(data);

        // Media general → nivel suavizado
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const raw = Math.min(100, (sum / data.length) * 1.9);
        smooth = smooth * 0.82 + raw * 0.18;
        setLevel(smooth);

        // Reparte el espectro en barras
        const step = Math.floor(data.length / BAR_COUNT);
        const bars: number[] = [];
        for (let b = 0; b < BAR_COUNT; b++) {
          let s = 0;
          for (let i = 0; i < step; i++) s += data[b * step + i];
          bars.push(Math.min(100, (s / step) * 1.5));
        }
        setSpectrum(bars);

        raf = requestAnimationFrame(tick);
      };
      tick();

      cleanupRef.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach(t => t.stop());
        ctx.close().catch(() => {});
      };
      setMicState('on');
    } catch {
      setMicState('denied');
    }
  }, []);

  // Apaga el micrófono al cerrar el widget
  useEffect(() => () => { cleanupRef.current?.(); }, []);

  // Alerta solo si se mantiene por encima del límite un rato
  useEffect(() => {
    if (micState !== 'on') return;
    if (level > limit) {
      if (overSinceRef.current === null) overSinceRef.current = Date.now();
      else if (Date.now() - overSinceRef.current > 1200) setOverLimit(true);
    } else {
      overSinceRef.current = null;
      setOverLimit(false);
    }
  }, [level, limit, micState]);

  const face = overLimit ? '🤫' : level > limit * 0.7 ? '😐' : level > 12 ? '🙂' : '😴';
  const stateColor = overLimit ? '#f43f5e' : level > limit * 0.7 ? '#fbbf24' : '#34d399';
  const stateLabel = overLimit ? 'Demasiado ruido' : level > limit * 0.7 ? 'Va subiendo' : level > 12 ? 'Buen ambiente' : 'En silencio';

  if (micState !== 'on') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4">
        <div
          className="flex items-center justify-center rounded-3xl"
          style={{ width: 68, height: 68, background: 'rgba(52,211,153,0.13)' }}
        >
          {micState === 'denied' ? <MicOff size={30} color="#fb7185" /> : <Mic size={30} color="#34d399" />}
        </div>
        <div>
          <div className="text-white font-bold text-[15px]">
            {micState === 'denied' ? 'Sin acceso al micrófono' : 'Medidor de ruido'}
          </div>
          <p className="text-white/50 text-[12.5px] mt-1.5 leading-relaxed" style={{ maxWidth: 230 }}>
            {micState === 'denied'
              ? 'Permite el micrófono en el navegador y vuelve a intentarlo. El sonido no se graba ni sale de este equipo.'
              : 'Mide el nivel de ruido de la clase en tiempo real. El sonido no se graba ni se envía a ningún sitio.'}
          </p>
        </div>
        <button
          onClick={start}
          disabled={micState === 'asking'}
          className="rounded-xl font-bold text-[13.5px] disabled:opacity-50"
          style={{ padding: '10px 22px', background: 'linear-gradient(135deg,#34d399,#10b981)', color: '#04231a' }}
        >
          {micState === 'asking' ? 'Pidiendo permiso…' : 'Activar micrófono'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Cabecera de estado */}
      <div className="flex items-center gap-3">
        <motion.span
          className="text-[34px] leading-none"
          animate={overLimit ? { rotate: [0, -9, 9, 0] } : {}}
          transition={{ repeat: overLimit ? Infinity : 0, duration: 0.65 }}
        >
          {face}
        </motion.span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[14px]" style={{ color: stateColor }}>{stateLabel}</div>
          <div className="text-white/40 text-[11.5px]">Límite: {limit}</div>
        </div>
        <div
          className="font-black text-white leading-none"
          style={{ fontSize: 34, fontVariantNumeric: 'tabular-nums' }}
        >
          {Math.round(level)}
        </div>
      </div>

      {/* Espectro */}
      <div className="relative flex-1 min-h-0 flex items-end gap-[3px]">
        {/* Línea del límite */}
        <div
          className="absolute left-0 right-0 pointer-events-none z-10 flex items-center"
          style={{ bottom: `${limit}%` }}
        >
          <div className="flex-1 border-t border-dashed" style={{ borderColor: `${stateColor}70` }} />
        </div>

        {spectrum.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-full transition-[height] duration-75"
            style={{
              height: `${Math.max(3, v)}%`,
              background: `linear-gradient(to top, ${stateColor}44, ${stateColor})`,
              boxShadow: overLimit ? `0 0 8px ${stateColor}77` : 'none',
            }}
          />
        ))}
      </div>

      {/* Ajuste del límite */}
      <div className="flex items-center gap-3">
        <input
          type="range" min={20} max={95} value={limit}
          onChange={e => setLimit(Number(e.target.value))}
          className="flex-1 cursor-pointer"
          style={{ accentColor: stateColor }}
          title="Ajusta a partir de qué nivel avisa"
        />
        <button
          onClick={stop}
          title="Apagar micrófono"
          className="flex items-center justify-center rounded-lg text-white/50 hover:text-white transition-colors flex-shrink-0"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.07)' }}
        >
          <MicOff size={15} />
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   RULETA
   ════════════════════════════════════════════════════════════ */

function WheelWidget({ names }: { names: string[] }) {
  const [pool, setPool]         = useState<string[]>(names);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner]     = useState<string | null>(null);

  // Se compara el contenido, no la identidad del array: el padre crea una lista
  // nueva en cada render y depender de ella reiniciaría el giro a mitad de vuelta.
  const namesKey = names.join('\u0000');
  useEffect(() => {
    setPool(namesKey ? namesKey.split('\u0000') : []);
    setWinner(null);
    setRotation(0);
  }, [namesKey]);

  const n = pool.length;
  const step = n > 0 ? 360 / n : 360;

  const spin = useCallback(() => {
    if (spinning || n === 0) return;
    setSpinning(true);
    setWinner(null);

    const idx = Math.floor(Math.random() * n);
    // Deja el centro del sector elegido justo bajo la aguja (arriba)
    const targetMod = (360 - (idx + 0.5) * step + 360) % 360;
    const currentMod = ((rotation % 360) + 360) % 360;
    const delta = (targetMod - currentMod + 360) % 360;
    const next = rotation + 360 * 5 + delta;

    setRotation(next);
    setTimeout(() => {
      setWinner(pool[idx]);
      setSpinning(false);
      confetti({ particleCount: 130, spread: 95, origin: { y: 0.55 } });
    }, 4100);
  }, [spinning, n, step, rotation, pool]);

  const removeWinner = useCallback(() => {
    if (!winner) return;
    setPool(prev => prev.filter(x => x !== winner));
    setWinner(null);
  }, [winner]);

  const SIZE = 250;
  const C = SIZE / 2;
  const R = C - 6;

  const sectors = useMemo(() => pool.map((name, i) => {
    const a0 = i * step;
    const a1 = a0 + step;
    const [x0, y0] = pointAt(C, C, R, a0);
    const [x1, y1] = pointAt(C, C, R, a1);
    const large = step > 180 ? 1 : 0;
    const d = n === 1
      ? `M ${C} ${C} m ${-R} 0 a ${R} ${R} 0 1 0 ${R * 2} 0 a ${R} ${R} 0 1 0 ${-R * 2} 0`
      : `M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;

    const mid = a0 + step / 2;
    const [lx, ly] = pointAt(C, C, R * 0.64, mid);
    // Mantiene el texto legible en la mitad izquierda
    const rot = mid > 180 ? mid + 90 : mid - 90;
    const short = name.length > 11 ? name.slice(0, 10) + '…' : name;

    return { name, d, lx, ly, rot, short, color: WHEEL_COLORS[i % WHEEL_COLORS.length] };
  }), [pool, step, n, C, R]);

  if (n === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4">
        <Trophy size={34} color="rgba(255,255,255,0.25)" />
        <p className="text-white/50 text-[13px] leading-relaxed" style={{ maxWidth: 210 }}>
          Ya han salido todos. Reinicia para volver a empezar.
        </p>
        <button
          onClick={() => { setPool(names); setWinner(null); }}
          className="rounded-xl font-bold text-[13px]"
          style={{ padding: '9px 20px', background: 'rgba(167,139,250,0.2)', color: '#c4b5fd' }}
        >
          <RefreshCw size={13} className="inline mr-1.5" />Reiniciar lista
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between h-full gap-2">
      <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
        {/* Aguja */}
        <div
          className="absolute z-20"
          style={{
            top: -4, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '11px solid transparent',
            borderRight: '11px solid transparent',
            borderTop: '20px solid #f8fafc',
            filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.6))',
          }}
        />

        <motion.div
          animate={{ rotate: rotation }}
          transition={{ duration: 4, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: SIZE, height: SIZE, borderRadius: '50%', boxShadow: '0 14px 40px rgba(0,0,0,0.5)' }}
        >
          <svg width={SIZE} height={SIZE}>
            {sectors.map((s, i) => (
              <g key={`${s.name}-${i}`}>
                <path d={s.d} fill={s.color} stroke="rgba(15,23,42,0.55)" strokeWidth={1.5} />
                <text
                  x={s.lx} y={s.ly}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="white" fontSize={n > 10 ? 10 : 12} fontWeight={800}
                  fontFamily="var(--font)"
                  transform={`rotate(${s.rot} ${s.lx} ${s.ly})`}
                  style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                >
                  {s.short}
                </text>
              </g>
            ))}
            <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={3} />
          </svg>
        </motion.div>

        {/* Botón central */}
        <button
          onClick={spin}
          disabled={spinning}
          className="absolute rounded-full flex items-center justify-center font-black transition-transform hover:scale-105 disabled:hover:scale-100 z-10"
          style={{
            width: 66, height: 66,
            background: 'linear-gradient(150deg,#ffffff,#e2e8f0)',
            color: '#1e293b', fontSize: 12,
            boxShadow: '0 6px 22px rgba(0,0,0,0.45)',
            cursor: spinning ? 'default' : 'pointer',
          }}
        >
          {spinning
            ? <RotateCcw size={22} className="animate-spin" />
            : 'GIRAR'}
        </button>
      </div>

      {/* Resultado */}
      <div className="w-full text-center" style={{ minHeight: 74 }}>
        <AnimatePresence mode="wait">
          {winner ? (
            <motion.div
              key={winner}
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-1.5"
            >
              <div
                className="rounded-2xl font-black text-white truncate max-w-full"
                style={{
                  padding: '9px 22px', fontSize: 21,
                  background: 'linear-gradient(135deg,rgba(167,139,250,0.28),rgba(236,72,153,0.28))',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                {winner}
              </div>
              <button
                onClick={removeWinner}
                className="text-[11.5px] font-semibold text-white/45 hover:text-white/80 transition-colors"
              >
                Quitar del sorteo ({n - 1 === 1 ? 'queda 1' : `quedan ${n - 1}`})
              </button>
            </motion.div>
          ) : (
            <motion.p
              key="idle"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-white/35 text-[12.5px] pt-4"
            >
              {spinning ? 'Girando…' : n === 1 ? '1 participante' : `${n} participantes`}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   CALCULADORA
   ════════════════════════════════════════════════════════════ */

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

/**
 * Evalúa una expresión respetando la prioridad de operaciones y los paréntesis
 * (algoritmo shunting-yard). No se usa eval() para no ejecutar texto arbitrario.
 * Devuelve null si la expresión está incompleta o es inválida.
 */
function evaluateExpression(expr: string): number | null {
  const tokens = expr.match(/(\d+\.?\d*|[+\-*/()])/g);
  if (!tokens) return null;

  const output: (number | string)[] = [];
  const ops: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (/^\d/.test(t)) {
      output.push(parseFloat(t));
    } else if (t === '(') {
      ops.push(t);
    } else if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') output.push(ops.pop()!);
      if (!ops.length) return null; // paréntesis sin abrir
      ops.pop();
    } else {
      // Signo negativo al principio o tras otro operador → número negativo
      const prev = tokens[i - 1];
      if (t === '-' && (i === 0 || prev === '(' || prev in PRECEDENCE)) {
        const next = tokens[i + 1];
        if (next && /^\d/.test(next)) { output.push(-parseFloat(next)); i++; continue; }
        return null;
      }
      while (ops.length && ops[ops.length - 1] !== '(' &&
             PRECEDENCE[ops[ops.length - 1]] >= PRECEDENCE[t]) {
        output.push(ops.pop()!);
      }
      ops.push(t);
    }
  }
  while (ops.length) {
    const op = ops.pop()!;
    if (op === '(') return null; // paréntesis sin cerrar
    output.push(op);
  }

  const stack: number[] = [];
  for (const item of output) {
    if (typeof item === 'number') { stack.push(item); continue; }
    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) return null;
    if (item === '+') stack.push(a + b);
    else if (item === '-') stack.push(a - b);
    else if (item === '*') stack.push(a * b);
    else if (item === '/') { if (b === 0) return null; stack.push(a / b); }
  }
  return stack.length === 1 && Number.isFinite(stack[0]) ? stack[0] : null;
}

/**
 * Formatea con coma decimal y sin los residuos de la coma flotante.
 * Se usa toPrecision y no un redondeo con multiplicaciones, porque con
 * números grandes ese cálculo se sale del entero seguro y falsea el resultado.
 */
function formatResult(n: number): string {
  if (!Number.isFinite(n)) return 'Error';
  const clean = parseFloat(n.toPrecision(12));
  return clean.toLocaleString('es-ES', { maximumFractionDigits: 10 });
}

/** Muestra la expresión con los símbolos que espera ver el alumnado. */
function prettyExpr(expr: string): string {
  return expr.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ')
             .replace(/\+/g, ' + ').replace(/(\d)-/g, '$1 − ')
             .replace(/\s+/g, ' ').trim();
}

const CALC_KEYS: { label: string; value: string; kind: 'num' | 'op' | 'eq' | 'fn' }[] = [
  { label: 'C',  value: 'clear', kind: 'fn' },
  { label: '( )', value: 'paren', kind: 'fn' },
  { label: '%',  value: 'pct',   kind: 'fn' },
  { label: '÷',  value: '/',     kind: 'op' },
  { label: '7',  value: '7', kind: 'num' },
  { label: '8',  value: '8', kind: 'num' },
  { label: '9',  value: '9', kind: 'num' },
  { label: '×',  value: '*', kind: 'op' },
  { label: '4',  value: '4', kind: 'num' },
  { label: '5',  value: '5', kind: 'num' },
  { label: '6',  value: '6', kind: 'num' },
  { label: '−',  value: '-', kind: 'op' },
  { label: '1',  value: '1', kind: 'num' },
  { label: '2',  value: '2', kind: 'num' },
  { label: '3',  value: '3', kind: 'num' },
  { label: '+',  value: '+', kind: 'op' },
  { label: '0',  value: '0', kind: 'num' },
  { label: ',',  value: '.', kind: 'num' },
  { label: '⌫',  value: 'back', kind: 'fn' },
  { label: '=',  value: 'eq',   kind: 'eq' },
];

function CalcWidget() {
  const [expr, setExpr]       = useState('');
  const [result, setResult]   = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const live = useMemo(() => {
    if (!expr) return null;
    const v = evaluateExpression(expr);
    return v === null ? null : formatResult(v);
  }, [expr]);

  /** Lo que se ve en grande: el resultado si lo hay, si no la expresión. */
  const shown = result === 'error' ? 'Error' : (result ?? (expr ? prettyExpr(expr) : '0'));

  const press = useCallback((value: string) => {
    if (value === 'clear') { setExpr(''); setResult(null); return; }
    if (value === 'back')  { setExpr(e => e.slice(0, -1)); setResult(null); return; }

    if (value === 'eq') {
      const v = evaluateExpression(expr);
      if (v === null) { setResult(expr ? 'error' : null); return; }
      const out = formatResult(v);
      setResult(out);
      setHistory(h => [`${prettyExpr(expr)} = ${out}`, ...h].slice(0, 4));
      setExpr(String(v));
      return;
    }

    if (value === 'paren') {
      // Cierra si hay paréntesis pendientes y lo último no es un operador
      const open = (expr.match(/\(/g) || []).length;
      const close = (expr.match(/\)/g) || []).length;
      const last = expr.slice(-1);
      const canClose = open > close && last !== '' && !(last in PRECEDENCE) && last !== '(';
      setExpr(e => e + (canClose ? ')' : '('));
      setResult(null);
      return;
    }

    if (value === 'pct') {
      // Convierte el último número en su equivalente decimal (50 → 0.5)
      const m = expr.match(/(\d+\.?\d*)$/);
      if (!m) return;
      const pct = parseFloat(m[1]) / 100;
      setExpr(e => e.slice(0, -m[1].length) + String(pct));
      setResult(null);
      return;
    }

    // Evita dos operadores seguidos y puntos decimales duplicados
    const last = expr.slice(-1);
    if (value in PRECEDENCE) {
      if (expr === '' && value !== '-') return;
      if (last in PRECEDENCE) { setExpr(e => e.slice(0, -1) + value); setResult(null); return; }
    }
    if (value === '.') {
      const currentNumber = expr.split(/[+\-*/()]/).pop() ?? '';
      if (currentNumber.includes('.')) return;
      if (currentNumber === '') { setExpr(e => e + '0.'); setResult(null); return; }
    }

    setExpr(e => e + value);
    setResult(null);
  }, [expr]);

  // Teclado físico (solo cuando la calculadora tiene el foco)
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const k = e.key;
    if (/^[0-9]$/.test(k))            { e.preventDefault(); press(k); }
    else if (k === '.' || k === ',')  { e.preventDefault(); press('.'); }
    else if ('+-*/'.includes(k))      { e.preventDefault(); press(k); }
    else if (k === 'Enter' || k === '=') { e.preventDefault(); press('eq'); }
    else if (k === 'Backspace')       { e.preventDefault(); press('back'); }
    else if (k === 'Escape')          { e.preventDefault(); press('clear'); }
    else if (k === '(' || k === ')')  { e.preventDefault(); press('paren'); }
  }, [press]);

  const styleFor = (kind: string, active: boolean) => {
    if (kind === 'eq') return { background: 'linear-gradient(135deg,#f472b6,#ec4899)', color: '#fff' };
    if (kind === 'op') return { background: active ? 'rgba(244,114,182,0.3)' : 'rgba(244,114,182,0.16)', color: '#fbcfe8' };
    if (kind === 'fn') return { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.72)' };
    return { background: 'rgba(255,255,255,0.1)', color: '#fff' };
  };

  return (
    <div
      className="flex flex-col h-full gap-2.5 outline-none"
      tabIndex={0}
      onKeyDown={onKeyDown}
      title="Puedes usar el teclado"
    >
      {/* Pantalla */}
      <div
        className="rounded-2xl px-4 py-3 flex flex-col justify-end flex-shrink-0"
        style={{ background: 'rgba(0,0,0,0.32)', border: '1px solid rgba(255,255,255,0.09)', minHeight: 92 }}
      >
        <div
          className="text-right text-white/45 text-[12.5px] truncate"
          style={{ minHeight: 17 }}
        >
          {history[0] ?? ''}
        </div>
        <div
          className="text-right text-white font-black"
          style={{
            // El tamaño se adapta al largo para que nunca se corte el resultado
            fontSize: shown.length > 22 ? 16 : shown.length > 17 ? 19 : shown.length > 12 ? 23 : 30,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.25,
            wordBreak: 'break-all',
          }}
        >
          {shown}
        </div>
        <div className="text-right text-[12.5px] font-semibold" style={{ minHeight: 17, color: '#f9a8d4' }}>
          {result === null && live !== null && expr ? `= ${live}` : ''}
        </div>
      </div>

      {/* Teclado */}
      <div className="grid grid-cols-4 gap-1.5 flex-1 min-h-0">
        {CALC_KEYS.map(k => (
          <button
            key={k.label}
            onClick={() => press(k.value)}
            className="rounded-xl font-bold flex items-center justify-center transition-transform active:scale-95"
            style={{ fontSize: k.kind === 'num' ? 18 : 16, minHeight: 34, ...styleFor(k.kind, false) }}
          >
            {k.value === 'back' ? <Delete size={17} /> : k.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   CONTENIDO EMBEBIDO
   ════════════════════════════════════════════════════════════ */

/** Convierte enlaces de YouTube a su forma incrustable. */
function normalizeUrl(raw: string): string {
  let value = raw.trim();
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) value = 'https://' + value;

  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      const t = u.searchParams.get('t');
      return `https://www.youtube.com/embed/${id}${t ? `?start=${parseInt(t)}` : ''}`;
    }
    if (host.endsWith('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) return u.toString();
      if (u.pathname.startsWith('/shorts/')) {
        return `https://www.youtube.com/embed/${u.pathname.split('/')[2]}`;
      }
      const id = u.searchParams.get('v');
      if (id) {
        const t = u.searchParams.get('t');
        return `https://www.youtube.com/embed/${id}${t ? `?start=${parseInt(t)}` : ''}`;
      }
    }
    return u.toString();
  } catch {
    return value;
  }
}

function EmbedWidget() {
  const [url, setUrl]             = useState('');
  const [activeUrl, setActiveUrl] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  function open() {
    const normalized = normalizeUrl(url);
    if (normalized) { setActiveUrl(normalized); setReloadKey(k => k + 1); }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <LinkIcon
            size={14}
            className="absolute pointer-events-none"
            style={{ left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)' }}
          />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') open(); }}
            placeholder="Pega un enlace de YouTube o una web…"
            className="w-full rounded-xl text-white text-[13px] outline-none transition-colors"
            style={{
              padding: '10px 14px 10px 34px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
          />
        </div>
        <button
          onClick={open}
          disabled={!url.trim()}
          className="rounded-xl font-bold text-[13px] disabled:opacity-40 flex-shrink-0"
          style={{ padding: '0 20px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: '#2a1a00' }}
        >
          Abrir
        </button>
        {activeUrl && (
          <>
            <button
              onClick={() => setReloadKey(k => k + 1)}
              title="Recargar"
              className="flex items-center justify-center rounded-xl text-white/55 hover:text-white transition-colors flex-shrink-0"
              style={{ width: 40, background: 'rgba(255,255,255,0.07)' }}
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => window.open(activeUrl, '_blank', 'noopener')}
              title="Abrir en el navegador"
              className="flex items-center justify-center rounded-xl text-white/55 hover:text-white transition-colors flex-shrink-0"
              style={{ width: 40, background: 'rgba(255,255,255,0.07)' }}
            >
              <ExternalLink size={15} />
            </button>
          </>
        )}
      </div>

      <div
        className="flex-1 min-h-0 rounded-2xl overflow-hidden"
        style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {activeUrl ? (
          <iframe
            key={reloadKey}
            src={activeUrl}
            className="w-full h-full"
            style={{ border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2.5 px-8 text-center">
            <ExternalLink size={26} color="rgba(255,255,255,0.2)" />
            <p className="text-white/40 text-[12.5px] leading-relaxed">
              Proyecta un vídeo o una web sin salir de Aula Pro.
            </p>
            <p className="text-white/25 text-[11.5px] leading-relaxed">
              Algunas webs no permiten incrustarse; en ese caso usa el botón de abrir en el navegador.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PANEL PRINCIPAL
   ════════════════════════════════════════════════════════════ */

/**
 * Posiciones iniciales pensadas para el área útil de un portátil de 1366×768
 * (1110 px una vez descontada la barra lateral), sin que nada quede pegado al
 * borde ni tapado por el dock inferior.
 */
const DEFAULTS: Record<WidgetType, { x: number; y: number; width: number; height: number }> = {
  timer: { x: 24,  y: 70,  width: 316, height: 404 },
  wheel: { x: 356, y: 70,  width: 376, height: 452 },
  calc:  { x: 748, y: 70,  width: 302, height: 438 },
  noise: { x: 356, y: 296, width: 330, height: 372 },
  embed: { x: 110, y: 286, width: 600, height: 378 },
};

export default function SecClassroom({ studentNames = [] }: { studentNames?: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // El trazo se guarda en una referencia, no en estado: React agrupa las
  // actualizaciones y los primeros movimientos del ratón se perderían.
  const drawingRef = useRef(false);
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [penOn, setPenOn] = useState(false);

  const wheelNames = useMemo(
    () => (studentNames.length > 0 ? studentNames : DEFAULT_NAMES),
    [studentNames],
  );

  const [widgets, setWidgets] = useState<Record<WidgetType, boolean>>({
    timer: true, wheel: true, calc: false, noise: false, embed: false,
  });

  /* ── Pizarra ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Se mide el propio lienzo, no la ventana: Aula Live convive con la barra
    // lateral, así que usar innerWidth desplazaría todos los trazos.
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0 || height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const nextW = Math.round(width * dpr);
      const nextH = Math.round(height * dpr);
      if (canvas.width === nextW && canvas.height === nextH) return;

      // Conserva lo dibujado al cambiar el tamaño (redimensionar limpia el lienzo)
      const previous = canvas.width > 0 && canvas.height > 0
        ? canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height)
        : null;

      canvas.width  = nextW;
      canvas.height = nextH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (previous) ctx.putImageData(previous, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    resize();
    // ResizeObserver y no window.resize: plegar la barra lateral cambia el
    // ancho del panel sin que la ventana cambie de tamaño.
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const posOf = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const p = 'touches' in e ? e.touches[0] : e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!penOn) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = posOf(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    // Un punto suelto también debe verse, sin necesidad de arrastrar
    ctx.lineTo(x, y);
    ctx.stroke();
    drawingRef.current = true;
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current || !penOn) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = posOf(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => { drawingRef.current = false; };

  const clearBoard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // El contexto está escalado por dpr, así que se limpia en píxeles CSS
    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
  };

  const toggle = (id: WidgetType) => setWidgets(p => ({ ...p, [id]: !p[id] }));

  const renderWidget = (cfg: WidgetConfig) => {
    if (!widgets[cfg.id]) return null;
    const body =
      cfg.id === 'timer' ? <TimerWidget /> :
      cfg.id === 'wheel' ? <WheelWidget names={wheelNames} /> :
      cfg.id === 'calc'  ? <CalcWidget /> :
      cfg.id === 'noise' ? <NoiseWidget /> :
                           <EmbedWidget />;

    return (
      <Rnd
        key={cfg.id}
        default={DEFAULTS[cfg.id]}
        minWidth={270}
        minHeight={300}
        bounds="parent"
        dragHandleClassName="drag-handle"
        style={{ zIndex: 30 }}
      >
        <WidgetShell title={cfg.title} icon={cfg.icon} accent={cfg.accent} onClose={() => toggle(cfg.id)}>
          {body}
        </WidgetShell>
      </Rnd>
    );
  };

  return (
    <div className="relative w-full overflow-hidden" style={{ height: '100vh', background: '#080f21' }}>
      {/* Fondo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 20% 0%, rgba(99,102,241,0.22), transparent 45%), radial-gradient(circle at 85% 25%, rgba(236,72,153,0.13), transparent 42%), radial-gradient(circle at 50% 100%, rgba(34,211,238,0.13), transparent 50%)' }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
        }}
      />

      {/* Pizarra */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          // width/height explícitos: <canvas> es un elemento reemplazado y con
          // inset:0 no se estira solo, se quedaría en su tamaño intrínseco.
          width: '100%',
          height: '100%',
          touchAction: 'none',
          pointerEvents: penOn ? 'auto' : 'none',
          cursor: penOn ? 'crosshair' : 'default',
          zIndex: 5,
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />

      {/* Barra de dibujo */}
      <div
        className="absolute flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5"
        style={{
          top: 18, left: 18, zIndex: 50,
          background: 'rgba(15,23,42,0.72)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(255,255,255,0.11)',
          boxShadow: '0 12px 34px rgba(0,0,0,0.42)',
        }}
      >
        <button
          onClick={() => setPenOn(v => !v)}
          title={penOn ? 'Desactivar lápiz' : 'Dibujar sobre la pantalla'}
          className="flex items-center gap-2 rounded-xl text-[12.5px] font-bold transition-all"
          style={{
            padding: '6px 12px',
            background: penOn ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.07)',
            color: penOn ? '#7dd3fc' : 'rgba(255,255,255,0.6)',
          }}
        >
          <PenLine size={15} />{penOn ? 'Dibujando' : 'Lápiz'}
        </button>

        {penOn && (
          <>
            <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.12)' }} />
            <Palette size={15} color="rgba(255,255,255,0.4)" />
            {PEN_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                title="Color del lápiz"
                className="rounded-full transition-transform"
                style={{
                  width: 21, height: 21, background: c,
                  border: color === c ? '2.5px solid white' : '2.5px solid transparent',
                  transform: color === c ? 'scale(1.16)' : 'scale(1)',
                }}
              />
            ))}
            <button
              onClick={clearBoard}
              title="Borrar todo"
              className="flex items-center justify-center rounded-lg text-white/60 hover:text-white transition-colors"
              style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.07)' }}
            >
              <Eraser size={15} />
            </button>
          </>
        )}
      </div>

      {/* Widgets */}
      {APPS.map(renderWidget)}

      {/* Dock */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 20, zIndex: 60 }}>
        <div
          className="flex gap-2 rounded-3xl px-3 py-2.5"
          style={{
            background: 'rgba(15,23,42,0.76)',
            backdropFilter: 'blur(22px)',
            border: '1px solid rgba(255,255,255,0.11)',
            boxShadow: '0 16px 44px rgba(0,0,0,0.5)',
          }}
        >
          {APPS.map(app => {
            const on = widgets[app.id];
            return (
              <motion.button
                key={app.id}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => toggle(app.id)}
                title={on ? `Cerrar ${app.title}` : `Abrir ${app.title}`}
                className="relative flex flex-col items-center gap-1 rounded-2xl transition-colors"
                style={{
                  padding: '9px 15px',
                  background: on ? `${app.accent}1f` : 'transparent',
                  color: on ? app.accent : 'rgba(255,255,255,0.55)',
                }}
              >
                {app.icon}
                <span className="text-[10.5px] font-bold tracking-tight">{app.title}</span>
                {on && (
                  <motion.div
                    layoutId={`dot-${app.id}`}
                    className="absolute rounded-full"
                    style={{ bottom: 3, width: 4, height: 4, background: app.accent }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
