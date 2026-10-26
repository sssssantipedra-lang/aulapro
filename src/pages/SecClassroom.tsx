import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import {
  Clock3, Mic, MicOff, Play, Pause, RotateCcw, TimerReset, Volume2,
  Plus, Minus, Eraser, ExternalLink, X, Disc3, Trophy,
  RefreshCw, Link as LinkIcon, PenLine, Calculator, Delete, Flag, Users,
  Timer as TimerIcon, Dices, Car, Hand, StickyNote, Medal, QrCode, ListChecks, Image as ImageIcon,
  Maximize, Minimize, LayoutTemplate, Save, Trash2, GripHorizontal,
  Highlighter, PenTool, Pencil, Undo2, Redo2, Minus as MinusIcon, ChevronsDownUp, ChevronsUpDown, PanelTopClose, PanelTop,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useResetOnChange } from '../lib/useResetOnChange';
import { guardarSalidos, leerSalidos, marcarSalido, sinSalir } from '../lib/ruleta';
import type { Ficha } from '../types';
import { ChallengePresenter } from '../components/live/ChallengePresenter';
import { fichaTheme } from '../lib/fichaThemes';
import { ThemeArt } from '../components/fichas/ThemeArt';
import { useI18n } from '../i18n';
import { Lienzo, type EstadoLienzo, type LienzoHandle } from '../components/pizarra/Lienzo';
import { ANCHOS, HERRAMIENTAS, type Grosor, type Herramienta } from '../lib/trazos';
import {
  ClockWidget, StopwatchWidget, TrafficWidget, DiceWidget, SymbolsWidget, NoteWidget, ScoreWidget,
  GroupsWidget, QrWidget, AgendaWidget,
} from '../components/live/PizarraWidgets';
import {
  FONDOS, fondoPorId, leerVentanas, leerEscenas, ajustarRect, siguienteId, enCascada, huecoLibre, rectVisible, LADO_MINIMIZADA, borrarDatosDeVentana, MAX_ESCENAS, MAX_VENTANAS,
  type FondoId, type Rect, type Escena,
} from '../lib/pizarraAula';

/* ════════════════════════════════════════════════════════════
   Aula Live — panel de herramientas para proyectar en clase
   ════════════════════════════════════════════════════════════ */

type WidgetType =
  | 'wheel' | 'timer' | 'noise' | 'embed' | 'calc'
  | 'clock' | 'stopwatch' | 'traffic' | 'dice' | 'symbols' | 'note' | 'score' | 'groups' | 'qr' | 'agenda';

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
  { id: 'clock',     title: 'Reloj y fecha',       icon: <Clock3 size={19} />,       accent: '#60a5fa' },
  { id: 'stopwatch', title: 'Cronómetro',          icon: <TimerIcon size={19} />,    accent: '#fb923c' },
  { id: 'traffic',   title: 'Semáforo',            icon: <Car size={19} />,          accent: '#4ade80' },
  { id: 'symbols',   title: 'Símbolos de trabajo', icon: <Hand size={19} />,         accent: '#c084fc' },
  { id: 'dice',      title: 'Dados',               icon: <Dices size={19} />,        accent: '#f87171' },
  { id: 'groups',    title: 'Grupos',              icon: <Users size={19} />,        accent: '#f472b6' },
  { id: 'score',     title: 'Marcador',            icon: <Medal size={19} />,        accent: '#2dd4bf' },
  { id: 'agenda',    title: 'Plan del día',        icon: <ListChecks size={19} />,   accent: '#a3e635' },
  { id: 'note',      title: 'Nota',                icon: <StickyNote size={19} />,   accent: '#facc15' },
  { id: 'qr',        title: 'Código QR',           icon: <QrCode size={19} />,       accent: '#e2e8f0' },
];

const APP_IDS = APPS.map(a => a.id);

/** Cómo se agrupan en la barra inferior: tiempo, clase, participación y recursos. */
const DOCK_GRUPOS: WidgetType[][] = [
  ['timer', 'stopwatch', 'clock'],
  ['traffic', 'symbols', 'agenda', 'note'],
  ['wheel', 'groups', 'dice', 'score'],
  ['calc', 'noise', 'embed', 'qr'],
];

/** Nombres de relleno cuando aún no hay alumnos creados. */
const DEFAULT_NAMES = ['Alumno 1', 'Alumno 2', 'Alumno 3', 'Alumno 4', 'Alumno 5', 'Alumno 6'];

/**
 * Colores del lápiz según el fondo: en una pizarra blanca el blanco y el
 * amarillo claro no se ven, y en la oscura pasa lo mismo con el negro.
 */
const PEN_COLORS = {
  light: ['#0f172a', '#2563eb', '#dc2626', '#16a34a', '#ea580c'],
  dark:  ['#f8fafc', '#38bdf8', '#f472b6', '#facc15', '#4ade80'],
} as const;
type BoardTheme = keyof typeof PEN_COLORS;
/** El subrayador es translúcido: sus colores valen igual en la pizarra blanca y en la oscura. */
const MARKER_COLORS = ['#fde047', '#86efac', '#7dd3fc', '#f9a8d4', '#fdba74'] as const;

const TOOLS: Record<Herramienta, { label: string; icon: React.ReactNode }> = {
  lapiz: { label: 'Lápiz', icon: <Pencil size={17} /> },
  rotulador: { label: 'Rotulador', icon: <PenTool size={17} /> },
  subrayador: { label: 'Subrayador', icon: <Highlighter size={17} /> },
  borrador: { label: 'Borrador', icon: <Eraser size={17} /> },
};
const GROSORES: readonly { id: Grosor; label: string; dot: number }[] = [
  { id: 0, label: 'Fino', dot: 5 }, { id: 1, label: 'Medio', dot: 9 }, { id: 2, label: 'Grueso', dot: 14 },
];
const BOARD_KEY = 'aulapro_board_theme';

const FONDO_KEY = 'aulapro_pizarra_fondo';
const ESCENAS_KEY = 'aulapro_pizarra_escenas';
const ACTUAL_KEY = 'aulapro_pizarra_actual';

function readFondo(): FondoId {
  // Blanco por defecto: en la pantalla del aula (proyector o panel) el fondo
  // oscuro se ve mal con luz ambiente. Quien ya había elegido pizarra oscura
  // (`BOARD_KEY`, de antes de que hubiera más fondos) la conserva.
  try {
    const guardado = localStorage.getItem(FONDO_KEY);
    if (guardado) return fondoPorId(guardado).id;
    return localStorage.getItem(BOARD_KEY) === 'dark' ? 'oscuro' : 'blanco';
  } catch { return 'blanco'; }
}

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
  title, accent, icono, minimizada, onMinimizar, onClose, children,
}: {
  title: string;
  accent: string;
  icono: React.ReactNode;
  minimizada: boolean;
  onMinimizar: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const boton = { width: 22, height: 22 } as const;
  const realzar = (e: React.MouseEvent<HTMLButtonElement>, on: boolean) => {
    e.currentTarget.style.background = on ? 'rgba(255,255,255,0.18)' : 'transparent';
    e.currentTarget.style.color = on ? '#fff' : 'inherit';
  };
  return (
    <div
      className="pz-ventana relative w-full h-full"
      style={{
        // El color de la herramienta se usa solo en el botón principal; `--pz-ac` es esa misma tinta
        // ajustada al fondo (más oscura sobre blanco, más clara sobre oscuro) para poder escribir con ella
        ['--pz-accent' as string]: accent,
        ['--pz-ac' as string]: `color-mix(in srgb, ${accent} 62%, rgb(var(--pz-rgb)))`,
        color: 'rgb(var(--pz-rgb))',
      }}
    >
      {/* Sin tarjeta: la herramienta va directamente sobre la pizarra. Se arrastra desde cualquier parte que no sea un
          control. Minimizada se oculta pero sigue montada, para que un temporizador siga contando. */}
      <div className="h-full w-full min-h-0" style={minimizada ? { display: 'none' } : undefined}>{children}</div>
      {minimizada ? (
        <button
          type="button"
          onClick={onMinimizar}
          title={t('Restaurar {title}', { title })}
          aria-label={t('Restaurar {title}', { title })}
          className="absolute inset-0 flex items-center justify-center rounded-2xl transition-transform hover:scale-105"
          style={{ background: '#1e2433', color: accent, boxShadow: '0 1px 2px rgba(15,23,42,0.25), 0 6px 16px rgba(15,23,42,0.22)' }}
        >
          {icono}
        </button>
      ) : (
        <div
          className="pz-barra absolute flex items-center gap-0.5 rounded-full"
          style={{ top: 2, right: 2, padding: 2, background: 'rgba(15,23,42,0.88)', color: 'rgba(255,255,255,0.7)', zIndex: 5 }}
          title={title}
        >
          <span className="flex items-center justify-center" style={boton} aria-hidden="true"><GripHorizontal size={14} /></span>
          <button
            onClick={onMinimizar}
            title={t('Minimizar')}
            aria-label={t('Minimizar')}
            className="flex items-center justify-center rounded-full transition-colors"
            style={boton}
            onMouseEnter={e => realzar(e, true)}
            onMouseLeave={e => realzar(e, false)}
          >
            <MinusIcon size={14} />
          </button>
          <button
            onClick={onClose}
            title={t('Cerrar')}
            aria-label={t('Cerrar')}
            className="widget-cerrar flex items-center justify-center rounded-full transition-colors"
            style={boton}
            onMouseEnter={e => realzar(e, true)}
            onMouseLeave={e => realzar(e, false)}
          >
            <X size={14} />
          </button>
        </div>
      )}
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
  const { t } = useI18n();
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
                background: active ? 'rgba(34,211,238,0.2)' : 'rgba(var(--pz-rgb),0.06)',
                color: active ? 'var(--pz-ac)' : 'rgba(var(--pz-rgb),0.6)',
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
          <circle cx={95} cy={95} r={R} fill="none" stroke="rgba(var(--pz-rgb),0.08)" strokeWidth={11} />
          <motion.circle
            cx={95} cy={95} r={R} fill="none" stroke={color} strokeWidth={11} strokeLinecap="round"
            strokeDasharray={CIRC}
            animate={{ strokeDashoffset: CIRC * (1 - pct) }}
            transition={{ duration: 0.4, ease: 'linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {editing ? (
            <div className="flex items-center gap-0.5">
              {[
                { ref: minRef, value: draftMin, set: setDraftMin, label: t('min') },
                { ref: undefined, value: draftSec, set: setDraftSec, label: t('seg') },
              ].map((f, i) => (
                <React.Fragment key={f.label}>
                  {i === 1 && <span className="text-[rgba(var(--pz-rgb),0.5)] font-black" style={{ fontSize: 38 }}>:</span>}
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
                      className="font-black text-[rgb(var(--pz-rgb))] text-center outline-none rounded-lg"
                      style={{
                        fontSize: 38, width: 62, padding: '2px 0',
                        fontVariantNumeric: 'tabular-nums',
                        background: 'rgba(var(--pz-rgb),0.09)',
                        border: '1.5px solid rgba(34,211,238,0.5)',
                      }}
                    />
                    <span className="text-[rgba(var(--pz-rgb),0.35)] text-[10px] font-bold mt-0.5">{f.label}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <>
              <button
                onClick={startEditing}
                disabled={running}
                title={running ? undefined : t('Haz clic para escribir el tiempo')}
                className="font-black text-[rgb(var(--pz-rgb))] leading-none rounded-xl transition-colors"
                style={{
                  fontSize: 46, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                  background: 'transparent', padding: '2px 8px',
                  cursor: running ? 'default' : 'pointer',
                }}
                onMouseEnter={e => { if (!running) e.currentTarget.style.background = 'rgba(var(--pz-rgb),0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {mins}:{secs}
              </button>
              {finished ? (
                <div className="text-[13px] font-bold mt-1" style={{ color: '#fb7185' }}>{t('¡Tiempo!')}</div>
              ) : !running && (
                <div className="text-[10px] font-semibold mt-0.5 text-[rgba(var(--pz-rgb),0.25)]">{t('toca para editar')}</div>
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
            style={{ padding: '6px 18px', background: 'rgba(var(--pz-rgb),0.1)', color: 'var(--pz-ac)' }}
          >
            {t('Aceptar')}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg font-bold text-[12.5px] text-[rgba(var(--pz-rgb),0.5)]"
            style={{ padding: '6px 14px', background: 'rgba(var(--pz-rgb),0.06)' }}
          >
            {t('Cancelar')}
          </button>
        </div>
      )}

      {/* Controles */}
      <div className="flex flex-col items-center gap-2.5 w-full" style={{ display: editing ? 'none' : undefined }}>
        <div className="flex gap-2 items-center justify-center">
          <button
            onClick={() => setDuration(total - 60)}
            title={t('Un minuto menos')}
            className="flex items-center justify-center rounded-xl text-[rgba(var(--pz-rgb),0.7)] hover:text-[rgb(var(--pz-rgb))] transition-colors"
            style={{ width: 38, height: 38, background: 'rgba(var(--pz-rgb),0.07)' }}
          >
            <Minus size={17} />
          </button>

          <button
            onClick={() => { setFinished(false); setRunning(r => !r); }}
            disabled={seconds === 0}
            className="flex items-center justify-center gap-2 rounded-xl font-bold text-[14px] transition-all disabled:opacity-40"
            style={{
              padding: '0 26px', height: 44,
              background: running ? 'rgba(var(--pz-rgb),0.14)' : 'var(--pz-accent, #22d3ee)',
              color: running ? 'rgb(var(--pz-rgb))' : '#0b1220',
            }}
          >
            {running ? <><Pause size={17} />{t('Pausa')}</> : <><Play size={17} />{t('Iniciar')}</>}
          </button>

          <button
            onClick={() => setDuration(total + 60)}
            title={t('Un minuto más')}
            className="flex items-center justify-center rounded-xl text-[rgba(var(--pz-rgb),0.7)] hover:text-[rgb(var(--pz-rgb))] transition-colors"
            style={{ width: 38, height: 38, background: 'rgba(var(--pz-rgb),0.07)' }}
          >
            <Plus size={17} />
          </button>
        </div>

        <button
          onClick={() => setDuration(total)}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-[rgba(var(--pz-rgb),0.45)] hover:text-[rgba(var(--pz-rgb),0.8)] transition-colors"
        >
          <TimerReset size={13} />{t('Reiniciar')}
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
  const { t } = useI18n();
  const [micState, setMicState] = useState<MicState>('idle');
  const [level, setLevel]       = useState(0);      // 0-100 suavizado
  const [spectrum, setSpectrum] = useState<number[]>(() => new Array(BAR_COUNT).fill(0));
  const [limit, setLimit]       = useState(55);
  const [overLimit, setOverLimit] = useState(false);

  const cleanupRef = useRef<(() => void) | null>(null);
  const overSinceRef = useRef<number | null>(null);
  // El bucle de audio se crea una vez: lee el límite actual por esta copia.
  const limitRef = useRef(limit);
  useEffect(() => { limitRef.current = limit; }, [limit]);

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

        // Alerta solo si se mantiene por encima del límite un rato
        if (smooth > limitRef.current) {
          const now = performance.now();
          if (overSinceRef.current === null) overSinceRef.current = now;
          else if (now - overSinceRef.current > 1200) setOverLimit(true);
        } else {
          overSinceRef.current = null;
          setOverLimit(false);
        }

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


  const face = overLimit ? '🤫' : level > limit * 0.7 ? '😐' : level > 12 ? '🙂' : '😴';
  const stateColor = overLimit ? '#f43f5e' : level > limit * 0.7 ? '#fbbf24' : '#34d399';
  const stateLabel = t(overLimit ? 'Demasiado ruido' : level > limit * 0.7 ? 'Va subiendo' : level > 12 ? 'Buen ambiente' : 'En silencio');

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
          <div className="text-[rgb(var(--pz-rgb))] font-bold text-[15px]">
            {t(micState === 'denied' ? 'Sin acceso al micrófono' : 'Medidor de ruido')}
          </div>
          <p className="text-[rgba(var(--pz-rgb),0.5)] text-[12.5px] mt-1.5 leading-relaxed" style={{ maxWidth: 230 }}>
            {t(micState === 'denied'
              ? (window.electronAPI?.app?.openSettings
                ? 'Activa el micrófono en Permisos, dentro de los ajustes de AulaPro, y vuelve a intentarlo. El sonido no se graba ni sale de este equipo.'
                : 'Permite el micrófono en el navegador y vuelve a intentarlo. El sonido no se graba ni sale de este equipo.')
              : 'Mide el nivel de ruido de la clase en tiempo real. El sonido no se graba ni se envía a ningún sitio.')}
          </p>
        </div>
        <button
          onClick={start}
          disabled={micState === 'asking'}
          className="rounded-xl font-bold text-[13.5px] disabled:opacity-50"
          style={{ padding: '10px 22px', background: 'var(--pz-accent, #34d399)', color: '#0b1220' }}
        >
          {t(micState === 'asking' ? 'Pidiendo permiso…' : micState === 'denied' ? 'Volver a intentarlo' : 'Activar micrófono')}
        </button>
        {micState === 'denied' && window.electronAPI?.app?.openSettings && (
          <button
            onClick={() => { window.electronAPI?.app?.openSettings?.()?.catch(() => {}); }}
            className="rounded-xl font-semibold text-[12.5px]"
            style={{ padding: '8px 18px', background: 'rgba(var(--pz-rgb),0.1)', color: 'rgb(var(--pz-rgb))' }}
          >
            {t('Abrir los ajustes de AulaPro')}
          </button>
        )}
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
          <div className="text-[rgba(var(--pz-rgb),0.4)] text-[11.5px]">{t('Límite: {n}', { n: limit })}</div>
        </div>
        <div
          className="font-black text-[rgb(var(--pz-rgb))] leading-none"
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
          title={t('Ajusta a partir de qué nivel avisa')}
        />
        <button
          onClick={stop}
          title={t('Apagar micrófono')}
          className="flex items-center justify-center rounded-lg text-[rgba(var(--pz-rgb),0.5)] hover:text-[rgb(var(--pz-rgb))] transition-colors flex-shrink-0"
          style={{ width: 32, height: 32, background: 'rgba(var(--pz-rgb),0.07)' }}
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

/**
 * `memoria` es la clave de la clase: quien sale queda guardado en el dispositivo
 * y no vuelve a salir hasta «Reiniciar lista» (decisión del dueño, 18-10-2026).
 * El círculo no cambia al salir alguien, solo al girar de nuevo: así no se
 * recolocan los sectores justo cuando se enseña el resultado.
 */
function WheelWidget({ names, memoria }: { names: string[]; memoria: string }) {
  const { t } = useI18n();
  const [salidos, setSalidos]   = useState<string[]>([]);
  const [pool, setPool]         = useState<string[]>(names);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner]     = useState<string | null>(null);

  // Se compara el contenido, no la identidad del array: el padre crea una lista
  // nueva en cada render y depender de ella reiniciaría el giro a mitad de vuelta.
  const namesKey = names.join('\u0000');
  useResetOnChange(`${memoria}\u0001${namesKey}`, () => {
    const todos = namesKey ? namesKey.split('\u0000') : [];
    const ya = leerSalidos(memoria);
    setSalidos(ya);
    setPool(sinSalir(todos, ya));
    setWinner(null);
    setRotation(0);
  });

  const n = pool.length;
  const step = n > 0 ? 360 / n : 360;
  const quedan = sinSalir(names, salidos).length;
  const hanSalido = names.length - quedan;

  const spin = useCallback(() => {
    if (spinning) return;
    // El círculo se rehace con quien aún no ha salido (el último ya ha salido y sigue en él hasta ahora)
    const vivo = sinSalir(names, salidos);
    setPool(vivo);
    setWinner(null);
    if (vivo.length === 0) return;
    setSpinning(true);

    const m = vivo.length;
    const paso = 360 / m;
    const idx = Math.floor(Math.random() * m);
    // Deja el centro del sector elegido justo bajo la aguja (arriba)
    const targetMod = (360 - (idx + 0.5) * paso + 360) % 360;
    const currentMod = ((rotation % 360) + 360) % 360;
    const delta = (targetMod - currentMod + 360) % 360;
    const next = rotation + 360 * 5 + delta;

    setRotation(next);
    setTimeout(() => {
      const elegido = vivo[idx];
      const ya = marcarSalido(names, salidos, elegido);
      setSalidos(ya);
      guardarSalidos(memoria, ya);
      setWinner(elegido);
      setSpinning(false);
      confetti({ particleCount: 130, spread: 95, origin: { y: 0.55 } });
    }, 4100);
  }, [spinning, names, salidos, rotation, memoria]);

  /** Quien acaba de salir vuelve al sorteo (por si salió sin querer o va a repetir). */
  const volverAMeter = useCallback(() => {
    if (!winner) return;
    const ya = salidos.filter(x => x !== winner);
    setSalidos(ya);
    guardarSalidos(memoria, ya);
    setWinner(null);
  }, [winner, salidos, memoria]);

  const reiniciar = useCallback(() => {
    setSalidos([]);
    guardarSalidos(memoria, []);
    setPool(names);
    setWinner(null);
  }, [memoria, names]);

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
        <Trophy size={34} color="rgba(var(--pz-rgb),0.25)" />
        <p className="text-[rgba(var(--pz-rgb),0.5)] text-[13px] leading-relaxed" style={{ maxWidth: 210 }}>
          {t('Ya han salido todos. Reinicia para volver a empezar.')}
        </p>
        <button
          onClick={reiniciar}
          className="rounded-xl font-bold text-[13px]"
          style={{ padding: '9px 20px', background: 'rgba(var(--pz-rgb),0.1)', color: 'var(--pz-ac)' }}
        >
          <RefreshCw size={13} className="inline mr-1.5" />{t('Reiniciar lista')}
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
            borderTop: '20px solid rgb(var(--pz-rgb))',
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
            <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(var(--pz-rgb),0.22)" strokeWidth={3} />
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
            : t('GIRAR')}
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
                className="rounded-2xl font-black text-[rgb(var(--pz-rgb))] truncate max-w-full"
                style={{
                  padding: '9px 22px', fontSize: 21,
                  background: 'linear-gradient(135deg,rgba(167,139,250,0.28),rgba(236,72,153,0.28))',
                  border: '1px solid rgba(var(--pz-rgb),0.18)',
                }}
              >
                {winner}
              </div>
              <p className="text-[rgba(var(--pz-rgb),0.45)] text-[11.5px] font-semibold">
                {quedan === 0
                  ? t('Era el último: ya han salido todos')
                  : quedan === 1 ? t('Queda 1 por salir') : t('Quedan {n} por salir', { n: quedan })}
              </p>
              <button
                onClick={volverAMeter}
                className="text-[11.5px] font-semibold text-[rgba(var(--pz-rgb),0.45)] hover:text-[rgba(var(--pz-rgb),0.8)] transition-colors underline underline-offset-2"
              >
                {t('Volver a meter en el sorteo')}
              </button>
            </motion.div>
          ) : (
            <motion.p
              key="idle"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-[rgba(var(--pz-rgb),0.35)] text-[12.5px] pt-4"
            >
              {spinning ? t('Girando…') : hanSalido === 0
                ? (names.length === 1 ? t('1 participante') : t('{n} participantes', { n: names.length }))
                : t('Quedan {n} de {total}', { n: quedan, total: names.length })}
              {!spinning && hanSalido > 0 && (
                <button
                  onClick={reiniciar}
                  className="ml-2 font-semibold text-[rgba(var(--pz-rgb),0.55)] hover:text-[rgba(var(--pz-rgb),0.85)] transition-colors underline underline-offset-2"
                >
                  {t('Reiniciar lista')}
                </button>
              )}
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
function formatResult(n: number, locale = 'es-ES'): string {
  if (!Number.isFinite(n)) return 'Error';
  const clean = parseFloat(n.toPrecision(12));
  return clean.toLocaleString(locale, { maximumFractionDigits: 10 });
}

/** Muestra la expresión con los símbolos que espera ver el alumnado. */
function prettyExpr(expr: string): string {
  return expr.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ')
             .replace(/\+/g, ' + ').replace(/(\d)-/g, '$1 − ')
             .replace(/\s+/g, ' ').trim();
}

function calcKeys(lang: 'es' | 'en' | 'ca'): { label: string; value: string; kind: 'num' | 'op' | 'eq' | 'fn' }[] {
  return [
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
    { label: lang === 'en' ? '.' : ',', value: '.', kind: 'num' },
    { label: '⌫',  value: 'back', kind: 'fn' },
    { label: '=',  value: 'eq',   kind: 'eq' },
  ];
}

function CalcWidget() {
  const { t, lang, locale } = useI18n();
  const CALC_KEYS = useMemo(() => calcKeys(lang), [lang]);
  const [expr, setExpr]       = useState('');
  const [result, setResult]   = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const live = useMemo(() => {
    if (!expr) return null;
    const v = evaluateExpression(expr);
    return v === null ? null : formatResult(v, locale);
  }, [expr, locale]);

  /** Lo que se ve en grande: el resultado si lo hay, si no la expresión. */
  const shown = result === 'error' ? 'Error' : (result ?? (expr ? prettyExpr(expr) : '0'));

  const press = useCallback((value: string) => {
    if (value === 'clear') { setExpr(''); setResult(null); return; }
    if (value === 'back')  { setExpr(e => e.slice(0, -1)); setResult(null); return; }

    if (value === 'eq') {
      const v = evaluateExpression(expr);
      if (v === null) { setResult(expr ? 'error' : null); return; }
      const out = formatResult(v, locale);
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
  }, [expr, locale]);

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
    if (kind === 'eq') return { background: 'var(--pz-accent, #f472b6)', color: '#0b1220' };
    if (kind === 'op') return { background: active ? 'rgba(var(--pz-rgb),0.22)' : 'rgba(var(--pz-rgb),0.13)', color: 'rgb(var(--pz-rgb))' };
    if (kind === 'fn') return { background: 'rgba(var(--pz-rgb),0.07)', color: 'rgba(var(--pz-rgb),0.72)' };
    return { background: 'rgba(var(--pz-rgb),0.1)', color: 'rgb(var(--pz-rgb))' };
  };

  return (
    <div
      className="flex flex-col h-full gap-2.5 outline-none"
      tabIndex={0}
      onKeyDown={onKeyDown}
      title={t('Puedes usar el teclado')}
    >
      {/* Pantalla */}
      <div
        className="rounded-2xl px-4 py-3 flex flex-col justify-end flex-shrink-0"
        style={{ background: 'rgba(0,0,0,0.32)', border: '1px solid rgba(var(--pz-rgb),0.09)', minHeight: 92 }}
      >
        <div
          className="text-right text-[rgba(var(--pz-rgb),0.45)] text-[12.5px] truncate"
          style={{ minHeight: 17 }}
        >
          {history[0] ?? ''}
        </div>
        <div
          className="text-right text-[rgb(var(--pz-rgb))] font-black"
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
        <div className="text-right text-[12.5px] font-semibold" style={{ minHeight: 17, color: 'var(--pz-ac)' }}>
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

/** Segundos que admite YouTube en `start`, venga «90», «1m30s» o «1h2m3s». */
function parseStart(raw: string | null): number | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!m || !m.slice(1).some(Boolean)) return null;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

/**
 * Convierte un enlace normal en su forma incrustable.
 *
 * Muchos servicios sirven una página pensada para verse suelta, que se niega
 * a cargar dentro de un marco, y otra distinta pensada para incrustar. Pegar
 * el enlace de la barra del navegador es lo natural, así que la traducción se
 * hace aquí en vez de pedirle al docente que busque el «código de inserción».
 */
function normalizeUrl(raw: string): string {
  let value = raw.trim();
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) value = 'https://' + value;

  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./, '');
    const yt = (id: string, start: number | null) =>
      `https://www.youtube.com/embed/${id}${start ? `?start=${start}` : ''}`;

    /* ── YouTube ── */
    if (host === 'youtu.be') {
      return yt(u.pathname.slice(1), parseStart(u.searchParams.get('t')));
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (u.pathname.startsWith('/embed/')) return u.toString();
      // Vídeos sueltos: /watch?v=, /shorts/ID, /live/ID, /v/ID
      const porRuta = u.pathname.match(/^\/(?:shorts|live|v)\/([^/?#]+)/);
      if (porRuta) return yt(porRuta[1], parseStart(u.searchParams.get('t')));
      const id = u.searchParams.get('v');
      if (id) return yt(id, parseStart(u.searchParams.get('t')));
      // Listas de reproducción completas
      const lista = u.searchParams.get('list');
      if (lista) return `https://www.youtube.com/embed/videoseries?list=${lista}`;
    }

    /* ── Vimeo ── */
    if (host === 'vimeo.com') {
      const id = u.pathname.match(/^\/(\d+)/);
      if (id) return `https://player.vimeo.com/video/${id[1]}`;
    }

    /* ── Google Drive: vista previa incrustable ── */
    if (host === 'drive.google.com') {
      const id = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (id) return `https://drive.google.com/file/d/${id[1]}/preview`;
    }

    /* ── Documentos de Google: /edit no se incrusta, /preview sí ── */
    if (host === 'docs.google.com') {
      if (/\/(edit|view)\b/.test(u.pathname)) {
        // Las presentaciones tienen su propio modo incrustado
        if (u.pathname.includes('/presentation/')) {
          return u.toString().replace(/\/(edit|view)\b.*$/, '/embed?start=false&loop=false');
        }
        return u.toString().replace(/\/(edit|view)\b.*$/, '/preview');
      }
    }

    return u.toString();
  } catch {
    return value;
  }
}

/**
 * Servicios que rechazan de plano ser incrustados.
 *
 * No es una limitación de AulaPro: lo impide el propio servicio con las
 * cabeceras `X-Frame-Options` o `Content-Security-Policy`, y el navegador
 * obedece. No hay forma de saltárselo, así que más vale avisar antes de
 * enseñar un marco en negro que parece un fallo de la aplicación.
 */
const NO_SE_DEJAN = [
  'google.com', 'gemini.google.com', 'accounts.google.com',
  'chatgpt.com', 'openai.com', 'claude.ai',
  'instagram.com', 'facebook.com', 'x.com', 'twitter.com',
  'moodle.org', 'outlook.com', 'office.com', 'linkedin.com',
];

function rechazaIncrustarse(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    // El buscador de Google no, pero sus documentos y Drive sí se incrustan
    if (host === 'docs.google.com' || host === 'drive.google.com') return null;
    // Se devuelve el dominio tal cual lo pegó el docente («gemini.google.com»),
    // no el de la lista («google.com»): reconoce antes lo que acaba de escribir.
    return NO_SE_DEJAN.some(d => host === d || host.endsWith('.' + d)) ? host : null;
  } catch {
    return null;
  }
}

function EmbedWidget() {
  const { t } = useI18n();
  const [url, setUrl]             = useState('');
  const [activeUrl, setActiveUrl] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [bloqueado, setBloqueado] = useState<string | null>(null);

  function open() {
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    setBloqueado(rechazaIncrustarse(normalized));
    setActiveUrl(normalized);
    setReloadKey(k => k + 1);
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <LinkIcon
            size={14}
            className="absolute pointer-events-none"
            style={{ left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(var(--pz-rgb),0.35)' }}
          />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') open(); }}
            placeholder={t('Pega un enlace de YouTube o una web…')}
            className="w-full rounded-xl text-[rgb(var(--pz-rgb))] text-[13px] outline-none transition-colors"
            style={{
              padding: '10px 14px 10px 34px',
              background: 'rgba(var(--pz-rgb),0.07)',
              border: '1px solid rgba(var(--pz-rgb),0.12)',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(var(--pz-rgb),0.12)'; }}
          />
        </div>
        <button
          onClick={open}
          disabled={!url.trim()}
          className="rounded-xl font-bold text-[13px] disabled:opacity-40 flex-shrink-0"
          style={{ padding: '0 20px', background: 'var(--pz-accent, #fbbf24)', color: '#0b1220' }}
        >
          {t('Abrir')}
        </button>
        {activeUrl && (
          <>
            <button
              onClick={() => setReloadKey(k => k + 1)}
              title={t('Recargar')}
              className="flex items-center justify-center rounded-xl text-[rgba(var(--pz-rgb),0.55)] hover:text-[rgb(var(--pz-rgb))] transition-colors flex-shrink-0"
              style={{ width: 40, background: 'rgba(var(--pz-rgb),0.07)' }}
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => window.open(activeUrl, '_blank', 'noopener')}
              title={t('Abrir en el navegador')}
              className="flex items-center justify-center rounded-xl text-[rgba(var(--pz-rgb),0.55)] hover:text-[rgb(var(--pz-rgb))] transition-colors flex-shrink-0"
              style={{ width: 40, background: 'rgba(var(--pz-rgb),0.07)' }}
            >
              <ExternalLink size={15} />
            </button>
          </>
        )}
      </div>

      <div
        className="flex-1 min-h-0 rounded-2xl overflow-hidden"
        style={{ background: '#000', border: '1px solid rgba(var(--pz-rgb),0.1)' }}
      >
        {activeUrl && bloqueado ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
            <ExternalLink size={26} color="rgba(251,191,36,0.6)" />
            <p className="text-[rgba(var(--pz-rgb),0.7)] text-[13px] leading-relaxed">
              {t('{sitio} no permite verse dentro de otra aplicación.', { sitio: bloqueado })}
            </p>
            <p className="text-[rgba(var(--pz-rgb),0.4)] text-[11.5px] leading-relaxed" style={{ maxWidth: 340 }}>
              {t('Lo bloquea el propio servicio, no AulaPro. Ábrelo en el navegador y compártelo desde ahí.')}
            </p>
            <button
              onClick={() => window.open(activeUrl, '_blank', 'noopener')}
              className="rounded-xl font-bold text-[12.5px]"
              style={{ padding: '9px 18px', background: 'var(--pz-accent, #fbbf24)', color: '#0b1220' }}
            >
              {t('Abrir en el navegador')}
            </button>
          </div>
        ) : activeUrl ? (
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
            <ExternalLink size={26} color="rgba(var(--pz-rgb),0.2)" />
            <p className="text-[rgba(var(--pz-rgb),0.4)] text-[12.5px] leading-relaxed">
              {t('Proyecta un vídeo o una web sin salir de AulaPro.')}
            </p>
            <p className="text-[rgba(var(--pz-rgb),0.25)] text-[11.5px] leading-relaxed">
              {t('Algunas webs no permiten incrustarse; en ese caso usa el botón de abrir en el navegador.')}
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
const DEFAULTS: Record<WidgetType, Rect> = {
  timer: { x: 24,  y: 70,  width: 290, height: 350 },
  wheel: { x: 330, y: 70,  width: 290, height: 340 },
  calc:  { x: 640, y: 70,  width: 270, height: 380 },
  noise: { x: 330, y: 300, width: 300, height: 330 },
  embed: { x: 110, y: 286, width: 560, height: 360 },
  clock:     { x: 60,  y: 90,  width: 380, height: 160 },
  stopwatch: { x: 120, y: 130, width: 300, height: 300 },
  traffic:   { x: 200, y: 90,  width: 220, height: 330 },
  symbols:   { x: 300, y: 100, width: 380, height: 300 },
  dice:      { x: 260, y: 150, width: 300, height: 260 },
  groups:    { x: 140, y: 90,  width: 520, height: 360 },
  score:     { x: 420, y: 110, width: 380, height: 280 },
  agenda:    { x: 640, y: 110, width: 340, height: 340 },
  note:      { x: 180, y: 120, width: 340, height: 240 },
  qr:        { x: 600, y: 90,  width: 300, height: 340 },
};

/** Tamaño mínimo de cada ventana: las hay que caben en poco (el reloj) y otras que no (el contenido). */
const MIN_BASE = { width: 220, height: 200 };
const MINIMOS: Partial<Record<WidgetType, { width: number; height: number }>> = {
  timer: { width: 250, height: 300 },
  wheel: { width: 260, height: 300 },
  calc: { width: 240, height: 340 },
  noise: { width: 260, height: 260 },
  embed: { width: 300, height: 240 },
  clock: { width: 200, height: 100 },
  traffic: { width: 140, height: 220 },
  note: { width: 200, height: 120 },
  symbols: { width: 200, height: 140 },
  score: { width: 260, height: 160 },
  agenda: { width: 240, height: 160 },
  groups: { width: 300, height: 220 },
  qr: { width: 200, height: 240 },
};
const minDe = (id: WidgetType) => MINIMOS[id] ?? MIN_BASE;

interface ClassroomProps {
  /** Nombres para la ruleta cuando no hay clases (el de PT y AL: su alumnado de apoyo). */
  studentNames?: string[];
  /** Las clases, cada una con los nombres de su alumnado: la ruleta es de la clase elegida. */
  clases?: { id: string; name: string; nombres: string[] }[];
  /** La clase con que se abre: la que toca según el horario. */
  claseInicial?: string;
  /** Fichas guardadas, para proyectarlas como reto. */
  fichas?: Ficha[];
  /** Ficha que se pidió proyectar desde Recursos: se abre al entrar. */
  projectFicha?: Ficha | null;
  onProjectDone?: () => void;
}

/** Ventana para elegir qué ficha proyectar como reto. */
function ChallengePicker({ fichas, onPick, onClose }: { fichas: Ficha[]; onPick: (f: Ficha) => void; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="cp-picker" role="dialog" aria-modal="true" aria-label={t('Proyectar un reto')} onClick={onClose}>
      <div className="cp-picker-box" onClick={e => e.stopPropagation()}>
        <div className="cp-picker-hd">
          <Flag size={18} color="var(--accent-d)" />
          <h2>{t('Proyectar un reto')}</h2>
          <button type="button" className="ico-btn" onClick={onClose} aria-label={t('Cerrar')}><X size={16} /></button>
        </div>
        {fichas.length === 0 ? (
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', padding: '10px 0 16px' }}>
            {t('Todavía no tienes fichas guardadas. Crea una en Documentos › Recursos (una misión, un escape room o unas tarjetas) y vuelve aquí para proyectarla.')}
          </p>
        ) : (
          <div className="cp-picker-list">
            {fichas.map(f => {
              const th = fichaTheme(f.content.estilo);
              const kind = f.content.formato === 'escape' ? t('Escape room') : f.content.formato === 'tarjetas' ? t('Tarjetas') : t(th.nombre);
              return (
                <button key={f.id} type="button" className="cp-pick" onClick={() => onPick(f)}>
                  <ThemeArt id={th.id} className="cp-pick-art" />
                  <span><strong>{f.title}</strong><em>{kind}</em></span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Una ventana abierta: una instancia (`id`) de una herramienta (`tipo`). Hay tantas como el docente quiera. */
interface Ventana { id: string; tipo: WidgetType; rect: Rect; min?: boolean }

/** Las ventanas que había abiertas la última vez (`null`: nunca se ha guardado nada). */
function leerActual(): Ventana[] | null {
  try {
    const raw = localStorage.getItem(ACTUAL_KEY);
    if (raw === null) return null;
    return leerVentanas(JSON.parse(raw), APP_IDS) as Ventana[];
  } catch { return null; }
}

function leerEscenasGuardadas(): Escena[] {
  try { return leerEscenas(localStorage.getItem(ESCENAS_KEY), APP_IDS); } catch { return []; }
}

/** Superficie de las barras y los menús: plana, de un solo color, sin transparencias ni brillos. */
const SUPERFICIE: React.CSSProperties = {
  background: '#1e2433',
  boxShadow: '0 1px 2px rgba(15,23,42,0.25), 0 10px 28px rgba(15,23,42,0.22), inset 0 0 0 1px rgba(255,255,255,0.08)',
};

/** Botón cuadrado, solo con icono, de las barras. El nombre sale al pasar el ratón y lo leen los lectores de pantalla. */
function BotonBarra({ icono, nombre, activo, color, cuenta, onClick, disabled, pulsado }: {
  icono: React.ReactNode; nombre: string; activo?: boolean; color?: string; cuenta?: number;
  onClick: () => void; disabled?: boolean; pulsado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={nombre}
      aria-label={nombre}
      aria-pressed={pulsado}
      className="relative flex items-center justify-center rounded-xl transition-colors flex-shrink-0 disabled:opacity-35"
      style={{
        width: 40, height: 40,
        background: activo ? 'rgba(255,255,255,0.14)' : 'transparent',
        color: activo ? '#fff' : (color ?? 'rgba(255,255,255,0.62)'),
      }}
      onMouseEnter={e => { if (!activo && !disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = activo ? 'rgba(255,255,255,0.14)' : 'transparent'; }}
    >
      {icono}
      {!!cuenta && (
        <span
          className="absolute flex items-center justify-center rounded-full font-bold"
          style={{ top: 3, right: 3, minWidth: 14, height: 14, padding: '0 3px', fontSize: 9, background: color ?? '#fff', color: '#0b1220' }}
        >{cuenta}</span>
      )}
    </button>
  );
}

const Separador = () => <span className="flex-shrink-0" style={{ width: 1, height: 22, margin: '0 5px', background: 'rgba(255,255,255,0.12)' }} aria-hidden="true" />;

export default function SecClassroom({ studentNames = [], clases = [], claseInicial, fichas = [], projectFicha = null, onProjectDone }: ClassroomProps) {
  const { t } = useI18n();
  const [claseId, setClaseId] = useState(claseInicial ?? '');
  const clase = clases.find(c => c.id === claseId) ?? clases[0];
  const [picking, setPicking] = useState(false);
  const [presenting, setPresenting] = useState<Ficha | null>(projectFicha);
  const closePresenter = () => { setPresenting(null); onProjectDone?.(); };
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lienzo = useRef<LienzoHandle | null>(null);
  const [fondoId, setFondoId] = useState<FondoId>(readFondo);
  const fondo = fondoPorId(fondoId);
  const light = fondo.tono === 'claro';
  const board: BoardTheme = light ? 'light' : 'dark';
  const penColors = PEN_COLORS[board];
  const [color, setColor] = useState<string>(() => PEN_COLORS[board][0]);
  const [colorSub, setColorSub] = useState<string>(MARKER_COLORS[0]);
  const [penOn, setPenOn] = useState(false);
  const [herramienta, setHerramienta] = useState<Herramienta>('lapiz');
  const [grosor, setGrosor] = useState<Grosor>(1);
  const [estado, setEstado] = useState<EstadoLienzo>({ puedeDeshacer: false, puedeRehacer: false, hayTrazos: false });
  const [menu, setMenu] = useState<null | 'fondos' | 'escenas'>(null);
  /** Barras ocultas: solo queda un botón diminuto para volver a verlas, y la pizarra aprovecha toda la pantalla. */
  const [barrasOcultas, setBarrasOcultas] = useState(false);

  /** Cambia el fondo; si cambia entre claro y oscuro, lo ya dibujado y el color del lápiz pasan a su equivalente. */
  function elegirFondo(id: FondoId) {
    const nuevo = fondoPorId(id);
    if (nuevo.tono !== fondo.tono) {
      const next: BoardTheme = nuevo.tono === 'claro' ? 'light' : 'dark';
      // El color elegido puede no verse en el fondo nuevo: se pasa al equivalente.
      const i = (PEN_COLORS[board] as readonly string[]).indexOf(color);
      setColor(PEN_COLORS[next][i >= 0 ? i : 0]);
      lienzo.current?.recolorear(PEN_COLORS[board], PEN_COLORS[next]);
    }
    setFondoId(nuevo.id);
    try { localStorage.setItem(FONDO_KEY, nuevo.id); } catch { /* sin almacenamiento: solo dura esta sesión */ }
  }

  const nombresClase = clase?.nombres;
  const wheelNames = useMemo(() => {
    const base = nombresClase ?? studentNames;
    return base.length > 0 ? base : DEFAULT_NAMES;
  }, [nombresClase, studentNames]);

  /* ── Ventanas: el orden de la lista es el orden de apilado (la última, delante) ── */
  const [ventanas, setVentanas] = useState<Ventana[]>(() =>
    leerActual() ?? (['timer', 'wheel'] as WidgetType[]).map(tipo => ({ id: tipo, tipo, rect: DEFAULTS[tipo] })));

  const areaPizarra = useCallback(() => {
    const r = rootRef.current?.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0 ? { width: r.width, height: r.height } : { width: 1110, height: 700 };
  }, []);

  // Lo guardado en otro monitor (o una ventana que se encoge) puede no caber: se mete todo en el área visible
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ajustar = () => {
      const area = areaPizarra();
      setVentanas(prev => {
        const next = prev.map(v => ({ ...v, rect: ajustarRect(v.rect, area, minDe(v.tipo)) }));
        return next.every((v, i) => JSON.stringify(v.rect) === JSON.stringify(prev[i].rect)) ? prev : next;
      });
    };
    const observer = new ResizeObserver(ajustar);
    observer.observe(el);
    return () => observer.disconnect();
  }, [areaPizarra]);

  useEffect(() => {
    try { localStorage.setItem(ACTUAL_KEY, JSON.stringify(ventanas)); } catch { /* sin almacenamiento */ }
  }, [ventanas]);

  const alFrente = useCallback((id: string) => {
    setVentanas(prev => (prev[prev.length - 1]?.id === id ? prev : [...prev.filter(v => v.id !== id), ...prev.filter(v => v.id === id)]));
  }, []);
  const ponerRect = useCallback((id: string, rect: Partial<Rect>) => {
    setVentanas(prev => prev.map(v => v.id === id ? { ...v, rect: { ...v.rect, ...rect } } : v));
  }, []);
  /**
   * Abre otra ventana de la herramienta, aunque ya haya una: cada una funciona por su cuenta. Va en un hueco libre
   * de la pizarra y, si no queda ninguno, en cascada sobre las demás.
   */
  const anadir = (tipo: WidgetType) => setVentanas(prev => {
    if (prev.length >= MAX_VENTANAS) return prev;
    const area = areaPizarra();
    const base = ajustarRect(DEFAULTS[tipo], area, minDe(tipo));
    const libre = huecoLibre(base, prev.map(rectVisible), area);
    const mismas = prev.filter(v => v.tipo === tipo).length;
    return [...prev, {
      id: siguienteId(tipo, prev.map(v => v.id)),
      tipo,
      rect: libre ?? ajustarRect(enCascada(base, mismas), area, minDe(tipo)),
    }];
  });
  const cerrar = (id: string) => {
    borrarDatosDeVentana(id);
    setVentanas(prev => prev.filter(v => v.id !== id));
  };
  /** Minimiza una ventana a su icono, o la restaura; no pierde lo que estuviera haciendo. */
  const alternarMin = useCallback((id: string) => {
    setVentanas(prev => prev.map(v => v.id === id ? { ...v, min: v.min ? undefined : true } : v));
  }, []);
  /** Con alguna a la vista, minimiza todas; si ya están todas minimizadas, las restaura. */
  const hayAlgunaVisible = ventanas.some(v => !v.min);
  const minimizarTodas = () => setVentanas(prev => {
    const minimizar = prev.some(v => !v.min);
    return prev.map(v => ({ ...v, min: minimizar ? true : undefined }));
  });
  const llena = ventanas.length >= MAX_VENTANAS;

  /* ── Escenas: una disposición con nombre que se puede recuperar con un clic ── */
  const [escenas, setEscenas] = useState<Escena[]>(leerEscenasGuardadas);
  const [nombreEscena, setNombreEscena] = useState('');
  useEffect(() => {
    try { localStorage.setItem(ESCENAS_KEY, JSON.stringify(escenas)); } catch { /* sin almacenamiento */ }
  }, [escenas]);

  function guardarEscena() {
    if (escenas.length >= MAX_ESCENAS) return;
    const nombre = nombreEscena.trim().slice(0, 40) || t('Escena {n}', { n: escenas.length + 1 });
    setEscenas(p => [...p, { id: 'sc' + Date.now(), nombre, fondo: fondoId, ventanas: ventanas.map(v => ({ id: v.id, tipo: v.tipo, rect: v.rect, ...(v.min ? { min: true } : {}) })) }]);
    setNombreEscena('');
  }
  /** Una escena guarda la disposición, no lo escrito dentro: al recuperarla las ventanas salen limpias. */
  function cargarEscena(e: Escena) {
    const area = areaPizarra();
    ventanas.forEach(v => borrarDatosDeVentana(v.id));
    elegirFondo(e.fondo);
    const ids: string[] = [];
    setVentanas(e.ventanas.map(v => {
      const tipo = v.tipo as WidgetType;
      const id = siguienteId(tipo, ids);
      ids.push(id);
      return { id, tipo, rect: ajustarRect(v.rect, area, minDe(tipo)), ...(v.min ? { min: true } : {}) };
    }));
    setMenu(null);
  }

  /* ── Pantalla completa ── */
  const [pantallaCompleta, setPantallaCompleta] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const f = () => setPantallaCompleta(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  const puedePantallaCompleta = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  function alternarPantallaCompleta() {
    // Si el sistema no la permite (el WebView de algunos móviles), simplemente no pasa nada
    const hecho = document.fullscreenElement ? document.exitFullscreen() : rootRef.current?.requestFullscreen();
    hecho?.catch(() => { /* rechazada */ });
  }

  const cuerpo = (v: Ventana) => {
    switch (v.tipo) {
      case 'timer':     return <TimerWidget />;
      case 'wheel':     return <WheelWidget names={wheelNames} memoria={clase?.id ?? 'sin-clase'} />;
      case 'calc':      return <CalcWidget />;
      case 'noise':     return <NoiseWidget />;
      case 'embed':     return <EmbedWidget />;
      case 'clock':     return <ClockWidget />;
      case 'stopwatch': return <StopwatchWidget />;
      case 'traffic':   return <TrafficWidget />;
      case 'dice':      return <DiceWidget />;
      case 'symbols':   return <SymbolsWidget uid={v.id} />;
      case 'note':      return <NoteWidget uid={v.id} />;
      case 'score':     return <ScoreWidget uid={v.id} />;
      case 'groups':    return <GroupsWidget names={wheelNames} />;
      case 'qr':        return <QrWidget uid={v.id} />;
      case 'agenda':    return <AgendaWidget uid={v.id} />;
    }
  };

  const renderWidget = (v: Ventana, apilado: number) => {
    const cfg = APPS.find(a => a.id === v.tipo);
    if (!cfg) return null;
    const { rect } = v;
    const min = v.min ? { width: LADO_MINIMIZADA, height: LADO_MINIMIZADA } : minDe(v.tipo);

    return (
      <Rnd
        key={v.id}
        position={{ x: rect.x, y: rect.y }}
        size={v.min ? min : { width: rect.width, height: rect.height }}
        minWidth={min.width}
        minHeight={min.height}
        enableResizing={!v.min}
        bounds="parent"
        // Se arrastra desde cualquier parte que no sea un control: sin esto un botón, un campo de texto o el
        // contenido incrustado empezarían un arrastre en vez de recibir el clic (y, en el móvil, la X nunca cerraría)
        cancel=".widget-cerrar, button, input, textarea, select, a, label, iframe, canvas, [role=checkbox]"
        onMouseDown={() => alFrente(v.id)}
        onDragStop={(_e, d) => ponerRect(v.id, { x: d.x, y: d.y })}
        onResizeStop={(_e, _dir, ref, _delta, p) => ponerRect(v.id, { x: p.x, y: p.y, width: ref.offsetWidth, height: ref.offsetHeight })}
        style={{ zIndex: 30 + apilado }}
      >
        <WidgetShell title={t(cfg.title)} accent={cfg.accent} icono={cfg.icon} minimizada={!!v.min} onMinimizar={() => alternarMin(v.id)} onClose={() => cerrar(v.id)}>
          {cuerpo(v)}
        </WidgetShell>
      </Rnd>
    );
  };

  // Siempre en el mismo orden del DOM, aunque cambie el apilado: mover un nodo recargaría un contenido incrustado
  const enOrdenFijo = ventanas.map((v, i) => ({ v, i })).sort((a, b) => (a.v.id < b.v.id ? -1 : 1));

  return (
    <div
      ref={rootRef}
      className="relative w-full overflow-hidden"
      style={{
        height: pantallaCompleta ? '100vh' : 'calc(100vh - var(--hub-h, 0px))', background: fondo.css,
        // Tinta de las herramientas: blanca sobre fondos oscuros y azul pizarra sobre claros
        ['--pz-rgb' as string]: light ? '15,23,42' : '255,255,255',
      }}
    >
      {/* Fondo */}
      {fondo.id === 'oscuro' && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 20% 0%, rgba(99,102,241,0.22), transparent 45%), radial-gradient(circle at 85% 25%, rgba(236,72,153,0.13), transparent 42%), radial-gradient(circle at 50% 100%, rgba(34,211,238,0.13), transparent 50%)' }}
        />
      )}
      {fondo.cuadricula && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: light
              ? 'linear-gradient(rgba(15,23,42,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.055) 1px, transparent 1px)'
              : 'linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
          }}
        />
      )}

      {/* Pizarra: lápiz, rotulador, subrayador y borrador (`components/pizarra/Lienzo.tsx`) */}
      <Lienzo ref={lienzo} activo={penOn} herramienta={herramienta} color={herramienta === 'subrayador' ? colorSub : color} ancho={ANCHOS[herramienta][grosor]} onEstado={setEstado} />

      {!barrasOcultas && (
        <>
      {/* Cierra el menú abierto al tocar fuera */}
      {menu && <div className="absolute inset-0" style={{ zIndex: 54 }} onClick={() => setMenu(null)} aria-hidden="true" />}

      {/* Barra superior: solo iconos */}
      <div className="absolute flex items-center gap-0.5 rounded-2xl p-1" style={{ top: 14, left: 14, zIndex: 56, maxWidth: 'calc(100% - 28px)', ...SUPERFICIE }}>
        {clases.length > 0 && (
          <>
            <label className="cl-clase" title={t('La ruleta usa los nombres de esta clase')}>
              <Users size={15} aria-hidden="true" />
              <span className="sr-only">{t('Clase')}</span>
              <select value={clase?.id ?? ''} onChange={e => setClaseId(e.target.value)}>
                {clases.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <Separador />
          </>
        )}
        <BotonBarra icono={<PenLine size={19} />} nombre={t(penOn ? 'Dejar de dibujar' : 'Dibujar sobre la pantalla')} activo={penOn} pulsado={penOn} onClick={() => setPenOn(v => !v)} />
        <BotonBarra icono={<ImageIcon size={19} />} nombre={t('Cambiar el fondo')} activo={menu === 'fondos'} onClick={() => setMenu(m => m === 'fondos' ? null : 'fondos')} />
        <BotonBarra icono={<LayoutTemplate size={19} />} nombre={t('Guardar y recuperar la disposición de la pizarra')} activo={menu === 'escenas'} onClick={() => setMenu(m => m === 'escenas' ? null : 'escenas')} />
        {puedePantallaCompleta && (
          <BotonBarra
            icono={pantallaCompleta ? <Minimize size={19} /> : <Maximize size={19} />}
            nombre={t(pantallaCompleta ? 'Salir de la pantalla completa' : 'Pantalla completa')}
            onClick={alternarPantallaCompleta}
          />
        )}
        <Separador />
        <BotonBarra
          icono={hayAlgunaVisible ? <ChevronsDownUp size={19} /> : <ChevronsUpDown size={19} />}
          nombre={t(hayAlgunaVisible ? 'Minimizar todas las ventanas' : 'Restaurar todas las ventanas')}
          onClick={minimizarTodas}
          disabled={ventanas.length === 0}
        />
        <BotonBarra icono={<PanelTopClose size={19} />} nombre={t('Ocultar las barras')} onClick={() => { setMenu(null); setBarrasOcultas(true); }} />
      </div>

      {/* Herramientas de dibujo: aparte y solo mientras se dibuja */}
      {penOn && (
        <div
          className="absolute flex flex-wrap items-center justify-center gap-1 rounded-2xl p-1.5"
          style={{ top: 66, left: '50%', transform: 'translateX(-50%)', zIndex: 56, maxWidth: 'calc(100% - 28px)', ...SUPERFICIE }}
          role="toolbar"
          aria-label={t('Dibujar sobre la pantalla')}
        >
          <div role="group" aria-label={t('Herramienta')} className="flex items-center gap-0.5">
            {HERRAMIENTAS.map(h => (
              <BotonBarra key={h} icono={TOOLS[h].icon} nombre={t(TOOLS[h].label)} activo={herramienta === h} pulsado={herramienta === h} onClick={() => setHerramienta(h)} />
            ))}
          </div>
          <Separador />
          <div role="group" aria-label={t('Grosor')} className="flex items-center gap-0.5">
            {GROSORES.map(g => (
              <button
                key={g.id}
                onClick={() => setGrosor(g.id)}
                title={t(g.label)}
                aria-label={t(g.label)}
                aria-pressed={grosor === g.id}
                className="flex items-center justify-center rounded-xl"
                style={{ width: 32, height: 40, background: grosor === g.id ? 'rgba(255,255,255,0.14)' : 'transparent' }}
              >
                <span style={{ width: g.dot, height: g.dot, borderRadius: '50%', background: grosor === g.id ? '#fff' : 'rgba(255,255,255,0.55)' }} />
              </button>
            ))}
          </div>
          {herramienta !== 'borrador' && (
            <>
              <Separador />
              <div role="group" aria-label={t('Color')} className="flex items-center gap-2 px-1">
                {(herramienta === 'subrayador' ? MARKER_COLORS : penColors).map(c => {
                  const actual = herramienta === 'subrayador' ? colorSub : color;
                  return (
                    <button
                      key={c}
                      onClick={() => (herramienta === 'subrayador' ? setColorSub(c) : setColor(c))}
                      title={t('Color')}
                      aria-label={t('Color')}
                      aria-pressed={actual === c}
                      className="rounded-full transition-transform"
                      style={{
                        width: 22, height: 22, background: c,
                        border: actual === c ? '2.5px solid white' : '2.5px solid transparent',
                        boxShadow: c === '#0f172a' ? 'inset 0 0 0 1px rgba(255,255,255,0.35)' : undefined,
                        transform: actual === c ? 'scale(1.12)' : 'scale(1)',
                      }}
                    />
                  );
                })}
              </div>
            </>
          )}
          <Separador />
          <div className="flex items-center gap-0.5">
            <BotonBarra icono={<Undo2 size={17} />} nombre={t('Deshacer')} onClick={() => lienzo.current?.deshacer()} disabled={!estado.puedeDeshacer} />
            <BotonBarra icono={<Redo2 size={17} />} nombre={t('Rehacer')} onClick={() => lienzo.current?.rehacer()} disabled={!estado.puedeRehacer} />
            <BotonBarra icono={<Trash2 size={17} />} nombre={t('Borrar todo')} onClick={() => lienzo.current?.borrarTodo()} disabled={!estado.hayTrazos} />
          </div>
        </div>
      )}

      {/* Menú de fondos */}
      {menu === 'fondos' && (
        <div className="absolute rounded-2xl p-3" style={{ top: 66, left: 14, zIndex: 57, width: 300, maxWidth: 'calc(100% - 28px)', ...SUPERFICIE }} role="dialog" aria-label={t('Fondo')}>
          <div className="grid grid-cols-4 gap-2.5">
            {FONDOS.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => elegirFondo(f.id)}
                aria-pressed={fondoId === f.id}
                aria-label={t(f.label)}
                title={t(f.label)}
                className="block rounded-xl transition-transform hover:scale-105"
                style={{
                  height: 44, background: f.css,
                  border: fondoId === f.id ? '2.5px solid #fff' : '1px solid rgba(255,255,255,0.22)',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Menú de escenas */}
      {menu === 'escenas' && (
        <div className="absolute rounded-2xl p-3 flex flex-col gap-3" style={{ top: 66, left: 14, zIndex: 57, width: 320, maxWidth: 'calc(100% - 28px)', ...SUPERFICIE }} role="dialog" aria-label={t('Escenas')}>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); guardarEscena(); }}>
            <input
              value={nombreEscena}
              onChange={e => setNombreEscena(e.target.value)}
              maxLength={40}
              placeholder={t('Nombre de la escena')}
              aria-label={t('Nombre de la escena')}
              className="flex-1 min-w-0 rounded-xl outline-none text-white placeholder:text-white/35 text-[13px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.08)', padding: '8px 11px' }}
            />
            <button
              type="submit"
              disabled={escenas.length >= MAX_ESCENAS}
              title={t('Guardar')}
              aria-label={t('Guardar')}
              className="flex items-center justify-center rounded-xl disabled:opacity-40"
              style={{ width: 38, background: 'rgba(255,255,255,0.14)', color: '#fff' }}
            ><Save size={16} /></button>
          </form>
          {escenas.length === 0 && (
            <p className="text-[12px] text-white/45 leading-snug">{t('Una escena guarda qué herramientas hay abiertas, dónde están y el fondo. Úsalas para pasar de la entrada a la tarea y al cierre con un clic.')}</p>
          )}
          {escenas.length >= MAX_ESCENAS && <p className="text-[11.5px] text-amber-300/90">{t('Has llegado al máximo de escenas. Borra alguna para guardar otra.')}</p>}
          {escenas.length > 0 && (
            <ul className="flex flex-col gap-1 max-h-[260px] overflow-y-auto">
              {escenas.map(e => (
                <li key={e.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => cargarEscena(e)}
                    className="flex-1 min-w-0 flex items-center gap-2.5 rounded-xl text-left text-[13px] font-semibold text-white/85 hover:text-white hover:bg-white/5"
                    style={{ padding: '8px 10px' }}
                  >
                    <span className="inline-block rounded-md flex-shrink-0" style={{ width: 16, height: 16, background: fondoPorId(e.fondo).css, border: '1px solid rgba(255,255,255,0.3)' }} />
                    <span className="truncate">{e.nombre}</span>
                    <span className="ml-auto text-[11px] font-medium text-white/35 flex-shrink-0">{e.ventanas.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEscenas(p => p.filter(x => x.id !== e.id))}
                    title={t('Borrar escena')}
                    aria-label={t('Borrar escena')}
                    className="flex items-center justify-center rounded-lg text-white/35 hover:text-rose-300 flex-shrink-0"
                    style={{ width: 30, height: 30 }}
                  ><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
        </>
      )}

      {/* Ventanas */}
      {enOrdenFijo.map(({ v, i }) => renderWidget(v, i))}

      {picking && <ChallengePicker fichas={fichas} onClose={() => setPicking(false)} onPick={f => { setPicking(false); setPresenting(f); }} />}
      {presenting && <ChallengePresenter ficha={presenting} onClose={closePresenter} />}

      {!barrasOcultas && (
        <>
      {/* Barra inferior: solo iconos, en cuatro grupos. Cada pulsación abre otra ventana de esa herramienta. */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 16, zIndex: 60, maxWidth: 'calc(100% - 140px)' }}>
        <div className="flex items-center rounded-2xl p-1 overflow-x-auto" style={{ ...SUPERFICIE, scrollbarWidth: 'none' }}>
          {DOCK_GRUPOS.map((grupo, gi) => (
            <div key={gi} className="flex items-center flex-shrink-0">
              {gi > 0 && <Separador />}
              {grupo.map(id => {
                const app = APPS.find(a => a.id === id)!;
                const abiertas = ventanas.filter(v => v.tipo === id).length;
                return (
                  <BotonBarra
                    key={id}
                    icono={app.icon}
                    nombre={t(llena ? 'Hay demasiadas ventanas abiertas. Cierra alguna.' : 'Añadir {title}', { title: t(app.title) })}
                    color={abiertas > 0 ? app.accent : undefined}
                    cuenta={abiertas > 1 ? abiertas : undefined}
                    onClick={() => anadir(id)}
                    disabled={llena}
                  />
                );
              })}
            </div>
          ))}
          <Separador />
          <BotonBarra icono={<Flag size={19} />} nombre={t('Proyectar una ficha, un escape room o unas tarjetas')} color="#fb923c" onClick={() => setPicking(true)} />
        </div>
      </div>
        </>
      )}

      {/* Con las barras ocultas solo queda este botón, discreto, para volver a verlas */}
      {barrasOcultas && (
        <button
          type="button"
          onClick={() => setBarrasOcultas(false)}
          title={t('Mostrar las barras')}
          aria-label={t('Mostrar las barras')}
          className="absolute flex items-center justify-center rounded-xl transition-opacity opacity-40 hover:opacity-100 focus-visible:opacity-100"
          style={{ top: 10, left: 10, width: 36, height: 36, zIndex: 56, color: '#fff', ...SUPERFICIE }}
        >
          <PanelTop size={18} />
        </button>
      )}
    </div>
  );
}
