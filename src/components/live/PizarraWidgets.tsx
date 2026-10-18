import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Plus, Minus, X, Flag, Shuffle, Check } from 'lucide-react';
import { useI18n } from '../../i18n';
import { SessionQR } from '../share/SessionQR';
import {
  SIMBOLOS_TRABAJO, MAX_DADOS, tirarDados, repartirGrupos, formatoCrono, direccionParaQr,
  claveDatos, type ReparticionGrupos,
} from '../../lib/pizarraAula';

/**
 * Los widgets de «Pizarra y herramientas» que acompañan a los de siempre (temporizador, ruleta, calculadora,
 * sonómetro y contenido): reloj, cronómetro, semáforo, dados, símbolos de trabajo, nota, marcador, grupos,
 * código QR y plan del día. Mismo aspecto que los otros: texto claro sobre el cristal oscuro de `WidgetShell`.
 */

const GLASS = 'rgba(var(--pz-rgb),0.07)';
const GLASS_HOVER = 'rgba(var(--pz-rgb),0.14)';

/**
 * Como `useState`, pero recuerda el valor en este dispositivo: una nota, un marcador o un plan del día no
 * deben perderse al cerrar la ventana o la app. Sin almacenamiento (ventana privada), solo dura la sesión.
 */
function usePersistido<T>(clave: string, inicial: T, valida: (x: unknown) => x is T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [valor, setValor] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(clave);
      if (raw) {
        const x: unknown = JSON.parse(raw);
        if (valida(x)) return x;
      }
    } catch { /* sin almacenamiento o dato roto: se parte de cero */ }
    return inicial;
  });
  useEffect(() => {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* solo dura esta sesión */ }
  }, [clave, valor]);
  return [valor, setValor];
}

const esTexto = (x: unknown): x is string => typeof x === 'string';

function IconBtn({ onClick, title, children, disabled }: { onClick: () => void; title: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className="flex items-center justify-center rounded-xl text-[rgba(var(--pz-rgb),0.7)] hover:text-[rgb(var(--pz-rgb))] transition-colors disabled:opacity-30 flex-shrink-0"
      style={{ width: 36, height: 36, background: GLASS }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = GLASS_HOVER; }}
      onMouseLeave={e => { e.currentTarget.style.background = GLASS; }}
    >
      {children}
    </button>
  );
}

function BotonPrincipal({ onClick, children, suave, disabled }: { onClick: () => void; children: React.ReactNode; suave?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 rounded-xl font-bold text-[14px] transition-opacity disabled:opacity-40 hover:opacity-90"
      style={{
        padding: '0 20px', height: 40,
        background: suave ? GLASS_HOVER : 'var(--pz-accent, #e2e8f0)',
        color: suave ? 'rgb(var(--pz-rgb))' : '#0b1220',
      }}
    >
      {children}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════
   RELOJ Y FECHA
   ════════════════════════════════════════════════════════════ */

export function ClockWidget() {
  const { lang } = useI18n();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const locale = lang === 'en' ? 'en-GB' : lang === 'ca' ? 'ca-ES' : 'es-ES';
  const hora = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const segundos = String(now.getSeconds()).padStart(2, '0');
  const fechaLarga = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fecha = fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1);
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-1.5" style={{ containerType: 'inline-size' }}>
      <div className="font-black text-[rgb(var(--pz-rgb))] leading-none" style={{ fontSize: 'clamp(40px, 22cqw, 120px)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
        {hora}<span className="text-[rgba(var(--pz-rgb),0.35)]" style={{ fontSize: '0.4em', marginLeft: 6 }}>{segundos}</span>
      </div>
      <div className="font-semibold text-[rgba(var(--pz-rgb),0.7)]" style={{ fontSize: 'clamp(13px, 6cqw, 28px)' }}>{fecha}</div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   CRONÓMETRO
   ════════════════════════════════════════════════════════════ */

export function StopwatchWidget() {
  const { t } = useI18n();
  const [acum, setAcum] = useState(0);
  const [desde, setDesde] = useState<number | null>(null);
  const [ahora, setAhora] = useState(0);
  const [vueltas, setVueltas] = useState<number[]>([]);

  useEffect(() => {
    if (desde === null) return;
    const id = setInterval(() => setAhora(performance.now()), 40);
    return () => clearInterval(id);
  }, [desde]);

  const ms = acum + (desde === null ? 0 : Math.max(0, ahora - desde));
  const empezar = () => { const t0 = performance.now(); setAhora(t0); setDesde(t0); };
  const pausar = () => { if (desde !== null) { setAcum(ms); setDesde(null); } };
  const reiniciar = () => { setAcum(0); setDesde(null); setVueltas([]); };

  return (
    <div className="h-full flex flex-col items-center gap-3 min-h-0" style={{ containerType: 'inline-size' }}>
      <div className="font-black text-[rgb(var(--pz-rgb))] leading-none pt-2" style={{ fontSize: 'clamp(30px, 17cqw, 90px)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
        {formatoCrono(ms)}
      </div>
      <div className="flex gap-2 items-center">
        {desde === null ? (
          <BotonPrincipal onClick={empezar}><Play size={17} />{t(acum > 0 ? 'Seguir' : 'Iniciar')}</BotonPrincipal>
        ) : (
          <BotonPrincipal onClick={pausar} suave><Pause size={17} />{t('Pausa')}</BotonPrincipal>
        )}
        <IconBtn onClick={() => setVueltas(v => [...v, ms])} title={t('Marcar una vuelta')} disabled={desde === null}><Flag size={16} /></IconBtn>
        <IconBtn onClick={reiniciar} title={t('Reiniciar')} disabled={ms === 0}><RotateCcw size={16} /></IconBtn>
      </div>
      {vueltas.length > 0 && (
        <ol className="w-full flex-1 min-h-0 overflow-y-auto text-[13px] text-[rgba(var(--pz-rgb),0.75)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {vueltas.map((v, i) => (
            <li key={i} className="flex justify-between px-3 py-1 rounded-lg" style={{ background: i % 2 ? 'transparent' : GLASS }}>
              <span className="text-[rgba(var(--pz-rgb),0.45)]">{t('Vuelta {n}', { n: i + 1 })}</span>
              <span>{formatoCrono(v)}</span>
              <span className="text-[rgba(var(--pz-rgb),0.45)]">+{formatoCrono(v - (vueltas[i - 1] ?? 0))}</span>
            </li>
          )).reverse()}
        </ol>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SEMÁFORO
   ════════════════════════════════════════════════════════════ */

const LUCES = [
  { id: 'rojo',     color: '#ef4444', texto: 'Paramos' },
  { id: 'amarillo', color: '#f59e0b', texto: 'Con calma' },
  { id: 'verde',    color: '#22c55e', texto: 'Adelante' },
] as const;

export function TrafficWidget() {
  const { t } = useI18n();
  const [luz, setLuz] = useState<string | null>('verde');
  const actual = LUCES.find(l => l.id === luz);
  return (
    <div className="h-full flex items-center justify-center gap-6 min-h-0">
      <div className="h-full flex flex-col justify-evenly items-center rounded-[28px] px-3 py-3" style={{ aspectRatio: '1 / 2.7', maxHeight: '100%', background: '#0b1220', border: '1px solid rgba(var(--pz-rgb),0.12)' }}>
        {LUCES.map(l => {
          const on = luz === l.id;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setLuz(on ? null : l.id)}
              aria-pressed={on}
              aria-label={t(l.texto)}
              className="rounded-full transition-all"
              style={{
                width: '82%', aspectRatio: '1', maxWidth: 110,
                background: on ? l.color : `${l.color}33`,
                boxShadow: on ? `0 0 22px ${l.color}88` : 'none',
              }}
            />
          );
        })}
      </div>
      <div className="font-black text-[22px] leading-tight min-w-[80px]" style={{ color: actual?.color ?? 'rgba(var(--pz-rgb),0.3)' }}>
        {actual ? t(actual.texto) : t('Toca una luz')}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DADOS
   ════════════════════════════════════════════════════════════ */

/** Dónde van los puntos de cada cara, en una cuadrícula de 3 × 3 (índices 0 a 8). */
const PUNTOS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

function CaraDado({ valor, size }: { valor: number; size: number }) {
  return (
    <div
      role="img"
      aria-label={String(valor)}
      className="grid grid-cols-3 grid-rows-3 rounded-[18%] p-[11%]"
      style={{ width: size, height: size, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.2)', boxShadow: '0 3px 10px rgba(0,0,0,0.25)' }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="flex items-center justify-center">
          {PUNTOS[valor]?.includes(i) && <span className="rounded-full" style={{ width: '70%', height: '70%', background: '#0f172a' }} />}
        </span>
      ))}
    </div>
  );
}

export function DiceWidget() {
  const { t } = useI18n();
  const [cantidad, setCantidad] = useState(1);
  const [caras, setCaras] = useState<number[]>(() => tirarDados(1));
  const [girando, setGirando] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const cambiarCantidad = (n: number) => {
    const c = Math.max(1, Math.min(MAX_DADOS, n));
    setCantidad(c);
    setCaras(tirarDados(c));
  };

  const tirar = () => {
    if (girando) return;
    setGirando(true);
    let veces = 0;
    timer.current = setInterval(() => {
      veces++;
      setCaras(tirarDados(cantidad));
      if (veces >= 9) {
        if (timer.current) clearInterval(timer.current);
        setGirando(false);
      }
    }, 70);
  };

  const lado = cantidad <= 1 ? 120 : cantidad <= 4 ? 84 : 66;
  return (
    <div className="h-full flex flex-col items-center justify-between gap-3 min-h-0">
      <div className="flex-1 min-h-0 w-full flex flex-wrap items-center justify-center content-center gap-3">
        {caras.map((v, i) => <CaraDado key={i} valor={v} size={lado} />)}
      </div>
      {cantidad > 1 && (
        <div className="text-[rgba(var(--pz-rgb),0.7)] text-[13px] font-semibold">{t('Suman {n}', { n: caras.reduce((a, b) => a + b, 0) })}</div>
      )}
      <div className="flex items-center gap-2">
        <IconBtn onClick={() => cambiarCantidad(cantidad - 1)} title={t('Un dado menos')} disabled={cantidad <= 1}><Minus size={15} /></IconBtn>
        <BotonPrincipal onClick={tirar} disabled={girando}><Shuffle size={16} />{t('Tirar')}</BotonPrincipal>
        <IconBtn onClick={() => cambiarCantidad(cantidad + 1)} title={t('Un dado más')} disabled={cantidad >= MAX_DADOS}><Plus size={15} /></IconBtn>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SÍMBOLOS DE TRABAJO
   ════════════════════════════════════════════════════════════ */

const esLista = (x: unknown): x is string[] => Array.isArray(x) && x.every(esTexto);

export function SymbolsWidget({ uid }: { uid: string }) {
  const { t } = useI18n();
  const [elegidos, setElegidos] = usePersistido<string[]>(claveDatos(uid, 'simbolos'), ['silencio'], esLista);
  const [editando, setEditando] = useState(false);
  const validos = SIMBOLOS_TRABAJO.filter(s => elegidos.includes(s.id));

  if (!editando && validos.length > 0) {
    return (
      <div className="h-full flex flex-wrap items-stretch justify-center gap-3 min-h-0" style={{ containerType: 'size' }}>
        {validos.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setEditando(true)}
            title={t('Toca para cambiar')}
            className="flex-1 min-w-[120px] rounded-3xl flex flex-col items-center justify-center gap-2 text-[rgb(var(--pz-rgb))] font-black"
            style={{ background: `${s.color}2b`, border: `2px solid ${s.color}` }}
          >
            <span style={{ fontSize: validos.length === 1 ? 'min(32cqh, 40cqw)' : '14cqh', lineHeight: 1 }}>{s.emoji}</span>
            <span style={{ fontSize: validos.length === 1 ? 'min(8cqh, 10cqw)' : '4.5cqh' }}>{t(s.label)}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      <div className="text-[rgba(var(--pz-rgb),0.55)] text-[12.5px] font-semibold">{t('Elige lo que quieres mostrar')}</div>
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0 overflow-y-auto content-start">
        {SIMBOLOS_TRABAJO.map(s => {
          const on = elegidos.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => setElegidos(p => on ? p.filter(x => x !== s.id) : [...p, s.id])}
              className="flex items-center gap-2 rounded-2xl text-left text-[13px] font-bold"
              style={{ padding: '10px 12px', background: on ? `${s.color}33` : GLASS, color: on ? 'rgb(var(--pz-rgb))' : 'rgba(var(--pz-rgb),0.6)', border: `1.5px solid ${on ? s.color : 'transparent'}` }}
            >
              <span style={{ fontSize: 22 }}>{s.emoji}</span>{t(s.label)}
            </button>
          );
        })}
      </div>
      <BotonPrincipal onClick={() => setEditando(false)} disabled={validos.length === 0}><Check size={16} />{t('Mostrar')}</BotonPrincipal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   NOTA
   ════════════════════════════════════════════════════════════ */

const TAMANOS_NOTA = [16, 20, 26, 34, 44, 58];

export function NoteWidget({ uid }: { uid: string }) {
  const { t } = useI18n();
  const [texto, setTexto] = usePersistido<string>(claveDatos(uid, 'nota'), '', esTexto);
  const [nivel, setNivel] = useState(2);
  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        placeholder={t('Escribe aquí lo que quieras proyectar…')}
        aria-label={t('Nota')}
        className="flex-1 min-h-0 w-full resize-none rounded-2xl text-[rgb(var(--pz-rgb))] placeholder:text-[rgba(var(--pz-rgb),0.3)] outline-none font-semibold"
        style={{ background: GLASS, padding: 14, fontSize: TAMANOS_NOTA[nivel], lineHeight: 1.3 }}
      />
      <div className="flex gap-2 justify-end">
        <IconBtn onClick={() => setNivel(n => Math.max(0, n - 1))} title={t('Letra más pequeña')} disabled={nivel === 0}><Minus size={15} /></IconBtn>
        <IconBtn onClick={() => setNivel(n => Math.min(TAMANOS_NOTA.length - 1, n + 1))} title={t('Letra más grande')} disabled={nivel === TAMANOS_NOTA.length - 1}><Plus size={15} /></IconBtn>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MARCADOR
   ════════════════════════════════════════════════════════════ */

interface Equipo { id: string; nombre: string; puntos: number }
const MAX_EQUIPOS = 8;
const COLORES_EQUIPO = ['#38bdf8', '#f472b6', '#facc15', '#4ade80', '#c084fc', '#fb923c', '#2dd4bf', '#f87171'];

function esEquipos(x: unknown): x is Equipo[] {
  return Array.isArray(x) && x.every(e => e && typeof e === 'object'
    && typeof (e as Equipo).id === 'string' && typeof (e as Equipo).nombre === 'string' && Number.isFinite((e as Equipo).puntos));
}

export function ScoreWidget({ uid }: { uid: string }) {
  const { t } = useI18n();
  const [equipos, setEquipos] = usePersistido<Equipo[]>(claveDatos(uid, 'marcador'), [
    { id: 'e1', nombre: '', puntos: 0 }, { id: 'e2', nombre: '', puntos: 0 },
  ], esEquipos);
  const cambiar = (id: string, f: (e: Equipo) => Equipo) => setEquipos(p => p.map(e => e.id === id ? f(e) : e));

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
        {equipos.map((e, i) => {
          const color = COLORES_EQUIPO[i % COLORES_EQUIPO.length];
          return (
            <div key={e.id} className="flex items-center gap-2 rounded-2xl" style={{ padding: '8px 10px', background: GLASS, borderLeft: `5px solid ${color}` }}>
              <input
                value={e.nombre}
                onChange={ev => cambiar(e.id, x => ({ ...x, nombre: ev.target.value.slice(0, 24) }))}
                placeholder={t('Equipo {n}', { n: i + 1 })}
                aria-label={t('Nombre del equipo')}
                className="flex-1 min-w-0 bg-transparent outline-none text-[rgb(var(--pz-rgb))] font-bold text-[15px] placeholder:text-[rgba(var(--pz-rgb),0.35)]"
              />
              <IconBtn onClick={() => cambiar(e.id, x => ({ ...x, puntos: x.puntos - 1 }))} title={t('Quitar un punto')}><Minus size={15} /></IconBtn>
              <div className="font-black text-[rgb(var(--pz-rgb))] text-center" style={{ fontSize: 30, minWidth: 54, fontVariantNumeric: 'tabular-nums', color }}>{e.puntos}</div>
              <IconBtn onClick={() => cambiar(e.id, x => ({ ...x, puntos: x.puntos + 1 }))} title={t('Sumar un punto')}><Plus size={15} /></IconBtn>
              {equipos.length > 1 && (
                <button type="button" onClick={() => setEquipos(p => p.filter(x => x.id !== e.id))} title={t('Quitar equipo')} aria-label={t('Quitar equipo')} className="text-[rgba(var(--pz-rgb),0.35)] hover:text-[rgba(var(--pz-rgb),0.8)] flex-shrink-0"><X size={15} /></button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 justify-between">
        <button
          type="button"
          onClick={() => setEquipos(p => [...p, { id: 'e' + Date.now(), nombre: '', puntos: 0 }])}
          disabled={equipos.length >= MAX_EQUIPOS}
          className="flex items-center gap-1.5 rounded-xl text-[12.5px] font-bold text-[rgba(var(--pz-rgb),0.7)] hover:text-[rgb(var(--pz-rgb))] disabled:opacity-30"
          style={{ padding: '7px 12px', background: GLASS }}
        ><Plus size={14} />{t('Equipo')}</button>
        <button
          type="button"
          onClick={() => setEquipos(p => p.map(e => ({ ...e, puntos: 0 })))}
          className="flex items-center gap-1.5 rounded-xl text-[12.5px] font-bold text-[rgba(var(--pz-rgb),0.55)] hover:text-[rgb(var(--pz-rgb))]"
          style={{ padding: '7px 12px', background: GLASS }}
        ><RotateCcw size={14} />{t('Poner a cero')}</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   GRUPOS
   ════════════════════════════════════════════════════════════ */

export function GroupsWidget({ names }: { names: string[] }) {
  const { t } = useI18n();
  const [reparto, setReparto] = useState<ReparticionGrupos>({ por: 'tamano', n: 4 });
  const [grupos, setGrupos] = useState<string[][]>([]);
  // Si cambia la clase, lo repartido ya no es de esos alumnos
  const clave = names.join('\u0001');
  const [claveVista, setClaveVista] = useState(clave);
  if (claveVista !== clave) { setClaveVista(clave); setGrupos([]); }

  const formar = () => setGrupos(repartirGrupos(names, reparto));
  const paso = (d: number) => setReparto(r => ({ ...r, n: Math.max(1, Math.min(20, r.n + d)) }));

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-xl overflow-hidden text-[12px] font-bold" style={{ background: GLASS }}>
          {(['tamano', 'numero'] as const).map(p => (
            <button
              key={p}
              type="button"
              aria-pressed={reparto.por === p}
              onClick={() => setReparto(r => ({ ...r, por: p }))}
              style={{ padding: '7px 11px', background: reparto.por === p ? GLASS_HOVER : 'transparent', color: reparto.por === p ? 'rgb(var(--pz-rgb))' : 'rgba(var(--pz-rgb),0.55)' }}
            >{t(p === 'tamano' ? 'Personas por grupo' : 'Número de grupos')}</button>
          ))}
        </div>
        <IconBtn onClick={() => paso(-1)} title={t('Menos')}><Minus size={15} /></IconBtn>
        <span className="font-black text-[rgb(var(--pz-rgb))] text-[20px] text-center" style={{ minWidth: 28 }}>{reparto.n}</span>
        <IconBtn onClick={() => paso(1)} title={t('Más')}><Plus size={15} /></IconBtn>
        <div className="flex-1" />
        <BotonPrincipal onClick={formar} disabled={names.length === 0}><Shuffle size={16} />{t(grupos.length ? 'Mezclar otra vez' : 'Formar grupos')}</BotonPrincipal>
      </div>
      {grupos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center text-[rgba(var(--pz-rgb),0.4)] text-[13px] px-6">
          {t('{n} personas para repartir. Elige cómo y pulsa «Formar grupos».', { n: names.length })}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto grid gap-2.5 content-start" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {grupos.map((g, i) => {
            const color = COLORES_EQUIPO[i % COLORES_EQUIPO.length];
            return (
              <div key={i} className="rounded-2xl" style={{ padding: '10px 12px', background: GLASS, borderTop: `4px solid ${color}` }}>
                <div className="text-[11px] font-black uppercase tracking-wide mb-1" style={{ color }}>{t('Grupo {n}', { n: i + 1 })}</div>
                <ul className="text-[rgb(var(--pz-rgb))] text-[13.5px] font-semibold leading-snug">
                  {g.map(n => <li key={n} className="truncate">{n}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   CÓDIGO QR
   ════════════════════════════════════════════════════════════ */

export function QrWidget({ uid }: { uid: string }) {
  const { t } = useI18n();
  const [texto, setTexto] = usePersistido<string>(claveDatos(uid, 'qr'), '', esTexto);
  const caja = useRef<HTMLDivElement | null>(null);
  const [lado, setLado] = useState(200);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setLado(Math.max(120, Math.min(560, Math.floor(Math.min(el.clientWidth, el.clientHeight) - 28))));
    medir();
    const o = new ResizeObserver(medir);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  const direccion = direccionParaQr(texto);
  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      <input
        value={texto}
        onChange={e => setTexto(e.target.value)}
        placeholder={t('Pega una dirección web o escribe un texto')}
        aria-label={t('Dirección del código QR')}
        className="w-full rounded-xl outline-none text-[rgb(var(--pz-rgb))] placeholder:text-[rgba(var(--pz-rgb),0.35)] text-[14px] font-semibold"
        style={{ background: GLASS, padding: '10px 14px' }}
      />
      <div ref={caja} className="flex-1 min-h-0 flex items-center justify-center">
        {direccion
          ? <SessionQR code={direccion} size={lado} />
          : <div className="text-[rgba(var(--pz-rgb),0.4)] text-[13px] text-center px-6">{t('El alumnado lo escanea con la cámara del móvil.')}</div>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PLAN DEL DÍA
   ════════════════════════════════════════════════════════════ */

interface Tarea { id: string; texto: string; hecha: boolean }
const esTareas = (x: unknown): x is Tarea[] =>
  Array.isArray(x) && x.every(e => e && typeof e === 'object' && typeof (e as Tarea).id === 'string' && typeof (e as Tarea).texto === 'string' && typeof (e as Tarea).hecha === 'boolean');

export function AgendaWidget({ uid }: { uid: string }) {
  const { t } = useI18n();
  const [tareas, setTareas] = usePersistido<Tarea[]>(claveDatos(uid, 'plan'), [], esTareas);
  const [nueva, setNueva] = useState('');
  const añadir = () => {
    const texto = nueva.trim();
    if (!texto) return;
    setTareas(p => [...p, { id: 't' + Date.now(), texto: texto.slice(0, 80), hecha: false }]);
    setNueva('');
  };
  return (
    <div className="h-full flex flex-col gap-2.5 min-h-0">
      <ul className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5">
        {tareas.length === 0 && <li className="text-[rgba(var(--pz-rgb),0.4)] text-[13px] text-center pt-6 px-4">{t('Apunta lo que vais a hacer hoy y ve tachándolo.')}</li>}
        {tareas.map(tarea => (
          <li key={tarea.id} className="flex items-center gap-2.5 rounded-xl" style={{ padding: '8px 10px', background: GLASS }}>
            <button
              type="button"
              role="checkbox"
              aria-checked={tarea.hecha}
              aria-label={tarea.texto}
              onClick={() => setTareas(p => p.map(x => x.id === tarea.id ? { ...x, hecha: !x.hecha } : x))}
              className="flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ width: 26, height: 26, background: tarea.hecha ? '#a3e635' : 'transparent', border: '2px solid #a3e635', color: '#1a2e05' }}
            >{tarea.hecha && <Check size={16} strokeWidth={3} />}</button>
            <span className="flex-1 min-w-0 text-[16px] font-semibold" style={{ color: tarea.hecha ? 'rgba(var(--pz-rgb),0.35)' : 'rgb(var(--pz-rgb))', textDecoration: tarea.hecha ? 'line-through' : 'none' }}>{tarea.texto}</span>
            <button type="button" onClick={() => setTareas(p => p.filter(x => x.id !== tarea.id))} title={t('Quitar')} aria-label={t('Quitar')} className="text-[rgba(var(--pz-rgb),0.3)] hover:text-[rgba(var(--pz-rgb),0.8)] flex-shrink-0"><X size={15} /></button>
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); añadir(); }}>
        <input
          value={nueva}
          onChange={e => setNueva(e.target.value)}
          placeholder={t('Añadir una actividad')}
          aria-label={t('Añadir una actividad')}
          className="flex-1 min-w-0 rounded-xl outline-none text-[rgb(var(--pz-rgb))] placeholder:text-[rgba(var(--pz-rgb),0.35)] text-[14px] font-semibold"
          style={{ background: GLASS, padding: '9px 12px' }}
        />
        <IconBtn onClick={añadir} title={t('Añadir')} disabled={!nueva.trim()}><Plus size={16} /></IconBtn>
      </form>
    </div>
  );
}
