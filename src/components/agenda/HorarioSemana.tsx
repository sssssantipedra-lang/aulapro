/**
 * El horario de la semana (pestaña «Semanal» de la Agenda), como una
 * cuadrícula con la hora en vertical: cada bloque está a su hora y mide lo que
 * dura, y los que coinciden van lado a lado. Se mueven arrastrándolos a otro
 * día u otra hora (ver `lib/horarioSemana.ts`, donde está la cuenta).
 *
 * Ratón o lápiz: se arrastra desde cualquier parte del bloque. Con el dedo, desde el asa
 * de arriba a la derecha, para que el resto del bloque siga dejando
 * desplazar la pantalla. Con teclado, Alt y las flechas (Mayús, de 15 en 15
 * minutos). Un toque, o Intro, abre el bloque para editarlo, como siempre. Lo
 * de apoyo (PT y AL) no se mueve aquí: se cambia en su grupo.
 */
import { useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import type { CalEvent, ScheduleBlock } from '../../types';
import { useI18n } from '../../i18n';
import {
  PASO_MIN, PX_POR_MIN, aMin, cambioDeArrastre, colocarDia, deMin, moverBloque, rangoHorario,
} from '../../lib/horarioSemana';

interface Props {
  dias: Date[];
  etiquetas: string[];
  /** AAAA-MM-DD de hoy, para marcar su columna. */
  hoy: string;
  bloques: ScheduleBlock[];
  apoyo: ScheduleBlock[];
  eventosPorFecha: Record<string, CalEvent[]>;
  isoDe: (d: Date) => string;
  onEditar: (b: ScheduleBlock) => void;
  onMover: (b: ScheduleBlock) => void;
  onAbrirApoyo: (b: ScheduleBlock) => void;
  onEditarEvento: (ev: CalEvent) => void;
}

interface Arrastre { id: string; nuevo: ScheduleBlock }

export function HorarioSemana({
  dias, etiquetas, hoy, bloques, apoyo, eventosPorFecha, isoDe, onEditar, onMover, onAbrirApoyo, onEditarEvento,
}: Props) {
  const { t } = useI18n();
  const rango = rangoHorario([...bloques, ...apoyo]);
  const alto = (rango.hasta - rango.desde) * PX_POR_MIN;
  const horas = Array.from({ length: (rango.hasta - rango.desde) / 60 + 1 }, (_, i) => rango.desde + i * 60);
  const apoyoIds = new Set(apoyo.map(b => b.id));

  const columnas = useRef<(HTMLDivElement | null)[]>([]);
  const gesto = useRef<{ b: ScheduleBlock; x: number; y: number; activo: boolean; cols: { izq: number; der: number }[]; nuevo?: ScheduleBlock } | null>(null);
  const sinClic = useRef(false);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);

  const medir = () => columnas.current.map(c => {
    const r = c?.getBoundingClientRect();
    return { izq: r?.left ?? 0, der: r?.right ?? 0 };
  });

  function alBajar(e: React.PointerEvent<HTMLDivElement>, b: ScheduleBlock) {
    if (e.button !== 0 || apoyoIds.has(b.id)) return;
    // Con el dedo, solo desde el asa: el resto del bloque deja desplazar la pantalla
    if (e.pointerType === 'touch' && !(e.target as HTMLElement).closest('.wk-asa')) return;
    gesto.current = { b, x: e.clientX, y: e.clientY, activo: false, cols: medir() };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* el puntero ya no existe */ }
  }

  function alMover(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesto.current;
    if (!g) return;
    const dy = e.clientY - g.y;
    // Un toque con la mano algo temblorosa no es un arrastre
    if (!g.activo && Math.hypot(e.clientX - g.x, dy) < 6) return;
    g.activo = true;
    // Se guarda también aquí: soltar puede llegar antes de que se repinte
    g.nuevo = moverBloque(g.b, cambioDeArrastre(dy, e.clientX, g.cols, g.b.day), rango);
    setArrastre({ id: g.b.id, nuevo: g.nuevo });
  }

  function alSoltar(cancelar = false) {
    const g = gesto.current;
    gesto.current = null;
    if (!g?.activo) { setArrastre(null); return; }
    // El clic que sigue a soltar no debe abrir el bloque
    sinClic.current = true;
    window.setTimeout(() => { sinClic.current = false; }, 0);
    const nuevo = g.nuevo;
    setArrastre(null);
    if (!cancelar && nuevo && (nuevo.day !== g.b.day || nuevo.time_start !== g.b.time_start)) onMover(nuevo);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLDivElement>, b: ScheduleBlock) {
    if (e.key === 'Escape' && gesto.current) { alSoltar(true); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEditar(b); return; }
    if (!e.altKey) return;
    const paso = e.shiftKey ? 15 : PASO_MIN;
    const cambio = e.key === 'ArrowUp' ? { minutos: -paso } : e.key === 'ArrowDown' ? { minutos: paso }
      : e.key === 'ArrowLeft' ? { dias: -1 } : e.key === 'ArrowRight' ? { dias: 1 } : null;
    if (!cambio) return;
    e.preventDefault();
    const nuevo = moverBloque(b, cambio, rango);
    if (nuevo.day !== b.day || nuevo.time_start !== b.time_start) onMover(nuevo);
  }

  const estilo = (arriba: number, altoBloque: number, carril: number, carriles: number): React.CSSProperties => ({
    top: arriba * PX_POR_MIN + 1,
    height: Math.max(altoBloque * PX_POR_MIN - 2, 18),
    left: `calc(${(carril / carriles) * 100}% + 2px)`,
    width: `calc(${100 / carriles}% - 4px)`,
  });

  const contenido = (b: ScheduleBlock, altoPx: number) => (
    altoPx < 44
      ? <div className="wk-bloque-1"><span>{b.time_start}–{b.time_end}</span> <b>{b.subject}</b></div>
      : (
        <>
          <div className="wk-bloque-h">{b.time_start}–{b.time_end}</div>
          <div className="wk-bloque-n">{b.subject}</div>
          {b.room && <div className="wk-bloque-r">{b.room}</div>}
        </>
      )
  );

  return (
    <div className="wk" style={{ gridTemplateColumns: '56px repeat(5, minmax(0, 1fr))' }}>
      {/* Cabecera: el día y sus eventos, encima de las clases */}
      <div />
      {dias.map((d, di) => {
        const ds = isoDe(d);
        return (
          <div key={di} className={`wk-dia${ds === hoy ? ' hoy' : ''}`}>
            <div className="wk-dia-n">{etiquetas[di]}</div>
            <div className="wk-dia-f">{d.getDate()}</div>
            {(eventosPorFecha[ds] ?? []).map(ev => (
              <button
                key={ev.id} type="button" className="wk-event"
                style={{ '--ev-c': ev.color || 'var(--accent-d)' } as React.CSSProperties}
                onClick={() => onEditarEvento(ev)} title={ev.desc || ev.name}
              >
                {ev.time && <b>{ev.time}</b>} {ev.name}
              </button>
            ))}
          </div>
        );
      })}

      {/* Las horas */}
      <div className="wk-horas" style={{ height: alto }} aria-hidden="true">
        {horas.map(h => <span key={h} style={{ top: (h - rango.desde) * PX_POR_MIN }}>{deMin(h)}</span>)}
      </div>

      {/* Un día por columna */}
      {dias.map((d, di) => {
        const dayNum = di + 1;
        const colocados = colocarDia([...bloques, ...apoyo].filter(b => b.day === dayNum), rango.desde);
        const destino = arrastre?.nuevo.day === dayNum ? arrastre.nuevo : null;
        return (
          <div
            key={`col-${dayNum}`} ref={el => { columnas.current[di] = el; }}
            className={`wk-col${isoDe(d) === hoy ? ' hoy' : ''}`}
            style={{ height: alto, backgroundSize: `100% ${60 * PX_POR_MIN}px` }}
          >
            {colocados.map(({ bloque: b, arriba, alto: durPx, carril, carriles }) => {
              const esApoyo = apoyoIds.has(b.id);
              const movido = arrastre?.id === b.id;
              const e = estilo(arriba, durPx, carril, carriles);
              return (
                <div
                  key={b.id} role="button" tabIndex={0}
                  className={`wk-bloque${esApoyo ? ' apoyo' : ''}${movido ? ' origen' : ''}`}
                  style={{ ...e, background: b.color }}
                  data-inicio={b.time_start} data-dia={b.day}
                  aria-label={`${b.subject}, ${b.time_start}–${b.time_end}`}
                  title={esApoyo ? undefined : t('Arrastra para cambiar el día o la hora. Con Alt y las flechas, también con el teclado.')}
                  onClick={() => { if (sinClic.current) return; if (esApoyo) onAbrirApoyo(b); else onEditar(b); }}
                  onKeyDown={ev => (esApoyo ? (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onAbrirApoyo(b)) : alTeclear(ev, b))}
                  onPointerDown={ev => alBajar(ev, b)} onPointerMove={alMover}
                  onPointerUp={() => alSoltar()} onPointerCancel={() => alSoltar(true)}
                >
                  {contenido(b, durPx * PX_POR_MIN)}
                  {!esApoyo && (
                    <span className="wk-asa" aria-hidden="true"><GripVertical size={13} /></span>
                  )}
                </div>
              );
            })}
            {/* Dónde caería el bloque que se está arrastrando */}
            {destino && (
              <div
                className="wk-bloque fantasma" aria-hidden="true"
                style={{
                  ...estilo(aMin(destino.time_start) - rango.desde, aMin(destino.time_end) - aMin(destino.time_start), 0, 1),
                  background: destino.color,
                }}
              >
                {contenido(destino, 99)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
