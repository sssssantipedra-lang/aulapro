/**
 * El lienzo de la pizarra de «Pizarra y herramientas»: lápiz, rotulador,
 * subrayador y borrador, con deshacer y rehacer. La lógica de los trazos está
 * en `lib/trazos.ts`.
 *
 * Dos capas: la de abajo con lo ya dibujado y la de arriba con el trazo que se
 * está haciendo. La de arriba solo pinta el tramo nuevo de cada movimiento,
 * así que sale al instante aunque el trazo sea largo, y su opacidad hace el
 * efecto del subrayador. El borrador pinta directamente en la de abajo.
 *
 * Eventos de puntero (ratón, dedo y lápiz en uno solo, sin el doble evento
 * táctil y de ratón de antes) y todos los puntos que el sistema agrupa entre
 * dos fotogramas (`getCoalescedEvents`), para que un movimiento rápido no
 * quede a trozos.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  ALFA_SUBRAYADOR, esTransparente, pintarTrazo, pintarTramos, recolorear, repintar,
  type Herramienta, type Trazo,
} from '../../lib/trazos';

export interface EstadoLienzo { puedeDeshacer: boolean; puedeRehacer: boolean; hayTrazos: boolean }

export interface LienzoHandle {
  deshacer: () => void;
  rehacer: () => void;
  borrarTodo: () => void;
  /** Pasa los trazos de una paleta de colores a la otra (al cambiar de fondo). */
  recolorear: (desde: readonly string[], hasta: readonly string[]) => void;
}

interface Props {
  /** Si la pizarra recibe los toques; si no, deja pasar todo a lo que hay debajo. */
  activo: boolean;
  herramienta: Herramienta;
  color: string;
  ancho: number;
  onEstado?: (e: EstadoLienzo) => void;
}

export const Lienzo = forwardRef<LienzoHandle, Props>(function Lienzo({ activo, herramienta, color, ancho, onEstado }, ref) {
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const vivoRef = useRef<HTMLCanvasElement | null>(null);
  const anilloRef = useRef<HTMLDivElement | null>(null);
  const trazos = useRef<Trazo[]>([]);
  const rehacer = useRef<Trazo[]>([]);
  const borrados = useRef<Trazo[] | null>(null);
  const cfg = useRef({ activo, herramienta, color, ancho });
  cfg.current = { activo, herramienta, color, ancho };
  const aviso = useRef(onEstado);
  aviso.current = onEstado;
  const actual = useRef<{ id: number; trazo: Trazo; pintados: number; enBase: boolean; rect: DOMRect } | null>(null);

  const avisar = useCallback(() => {
    aviso.current?.({
      puedeDeshacer: trazos.current.length > 0 || borrados.current !== null,
      puedeRehacer: rehacer.current.length > 0,
      hayTrazos: trazos.current.length > 0,
    });
  }, []);

  const pintarTodo = useCallback(() => {
    const ctx = baseRef.current?.getContext('2d');
    if (ctx) repintar(ctx, trazos.current);
  }, []);

  /* ── Tamaño: se mide el propio lienzo, no la ventana (la pizarra convive con la barra lateral) ── */
  useEffect(() => {
    const base = baseRef.current;
    const vivo = vivoRef.current;
    if (!base || !vivo) return;
    const ajustar = () => {
      const { width, height } = base.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(width * dpr);
      const h = Math.round(height * dpr);
      if (base.width === w && base.height === h) return;
      for (const c of [base, vivo]) {
        c.width = w; c.height = h;
        c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      pintarTodo();
    };
    ajustar();
    // ResizeObserver y no window.resize: plegar la barra lateral cambia el ancho sin que la ventana cambie
    const obs = new ResizeObserver(ajustar);
    obs.observe(base);
    return () => obs.disconnect();
  }, [pintarTodo]);

  /* ── Dibujar ── */
  useEffect(() => {
    const vivo = vivoRef.current;
    const base = baseRef.current;
    if (!vivo || !base) return;

    const puntoDe = (e: PointerEvent, rect: DOMRect) => ({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      p: e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5,
    });

    const anillo = (e: PointerEvent) => {
      const el = anilloRef.current;
      if (!el) return;
      if (cfg.current.herramienta !== 'borrador' || !cfg.current.activo || e.pointerType === 'touch') { el.style.display = 'none'; return; }
      const rect = vivo.getBoundingClientRect();
      el.style.display = 'block';
      el.style.width = el.style.height = `${cfg.current.ancho}px`;
      el.style.transform = `translate(${e.clientX - rect.left - cfg.current.ancho / 2}px, ${e.clientY - rect.top - cfg.current.ancho / 2}px)`;
    };

    const alBajar = (e: PointerEvent) => {
      const c = cfg.current;
      if (!c.activo || actual.current) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try { vivo.setPointerCapture(e.pointerId); } catch { /* el puntero ya no existe */ }
      const rect = vivo.getBoundingClientRect();
      const trazo: Trazo = { h: c.herramienta, color: c.color, ancho: c.ancho, puntos: [puntoDe(e, rect)] };
      const enBase = c.herramienta === 'borrador';
      actual.current = { id: e.pointerId, trazo, pintados: 1, enBase, rect };
      vivo.style.opacity = esTransparente(c.herramienta) ? String(ALFA_SUBRAYADOR) : '1';
      const ctx = (enBase ? base : vivo).getContext('2d');
      if (ctx) pintarTramos(ctx, trazo);
      anillo(e);
    };

    const alMover = (e: PointerEvent) => {
      const a = actual.current;
      if (!a || e.pointerId !== a.id) { anillo(e); return; }
      const ctx = (a.enBase ? base : vivo).getContext('2d');
      const lista = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      for (const ev of lista.length ? lista : [e]) {
        const p = puntoDe(ev, a.rect);
        const u = a.trazo.puntos[a.trazo.puntos.length - 1];
        // Un movimiento de menos de medio píxel no se nota y solo carga el trazo
        if (Math.abs(p.x - u.x) < 0.5 && Math.abs(p.y - u.y) < 0.5) continue;
        a.trazo.puntos.push(p);
      }
      if (ctx && a.trazo.puntos.length > a.pintados) {
        pintarTramos(ctx, a.trazo, a.pintados);
        a.pintados = a.trazo.puntos.length;
      }
      anillo(e);
    };

    const terminar = (e: PointerEvent) => {
      const a = actual.current;
      if (!a || e.pointerId !== a.id) return;
      actual.current = null;
      try { vivo.releasePointerCapture(e.pointerId); } catch { /* ya soltado */ }
      const vctx = vivo.getContext('2d');
      if (a.enBase) {
        const ctx = base.getContext('2d');
        if (ctx) pintarTramos(ctx, a.trazo, a.pintados, true);
      } else {
        // Lo hecho en la capa de arriba pasa a la de abajo, ya con su opacidad
        vctx?.save(); vctx?.setTransform(1, 0, 0, 1, 0, 0); vctx?.clearRect(0, 0, vivo.width, vivo.height); vctx?.restore();
        vivo.style.opacity = '1';
        const ctx = base.getContext('2d');
        if (ctx) pintarTrazo(ctx, a.trazo);
      }
      trazos.current.push(a.trazo);
      rehacer.current = [];
      borrados.current = null;
      avisar();
    };

    const alSalir = (e: PointerEvent) => { if (!actual.current && anilloRef.current) { anilloRef.current.style.display = 'none'; } void e; };

    vivo.addEventListener('pointerdown', alBajar);
    vivo.addEventListener('pointermove', alMover);
    vivo.addEventListener('pointerup', terminar);
    vivo.addEventListener('pointercancel', terminar);
    vivo.addEventListener('pointerleave', alSalir);
    return () => {
      vivo.removeEventListener('pointerdown', alBajar);
      vivo.removeEventListener('pointermove', alMover);
      vivo.removeEventListener('pointerup', terminar);
      vivo.removeEventListener('pointercancel', terminar);
      vivo.removeEventListener('pointerleave', alSalir);
    };
  }, [avisar]);

  useImperativeHandle(ref, () => ({
    deshacer() {
      const t = trazos.current.pop();
      if (t) {
        rehacer.current.push(t);
      } else if (borrados.current) {
        // Después de «Borrar todo», deshacer lo trae de vuelta
        trazos.current = borrados.current;
        borrados.current = null;
      } else {
        return;
      }
      pintarTodo();
      avisar();
    },
    rehacer() {
      const t = rehacer.current.pop();
      if (!t) return;
      trazos.current.push(t);
      const ctx = baseRef.current?.getContext('2d');
      if (ctx) pintarTrazo(ctx, t);
      avisar();
    },
    borrarTodo() {
      if (trazos.current.length === 0) return;
      borrados.current = trazos.current;
      trazos.current = [];
      rehacer.current = [];
      pintarTodo();
      avisar();
    },
    recolorear(desde, hasta) {
      trazos.current = recolorear(trazos.current, desde, hasta);
      rehacer.current = recolorear(rehacer.current, desde, hasta);
      if (borrados.current) borrados.current = recolorear(borrados.current, desde, hasta);
      pintarTodo();
    },
  }), [pintarTodo, avisar]);

  const capa = { width: '100%', height: '100%' } as const;
  return (
    <>
      <canvas ref={baseRef} className="absolute inset-0 pointer-events-none" style={{ ...capa, zIndex: 5 }} />
      <canvas
        ref={vivoRef}
        className="absolute inset-0"
        data-testid="pizarra-lienzo"
        style={{
          ...capa, zIndex: 6,
          // touch-action: none, para que el dedo dibuje y no desplace ni haga zoom en la página
          touchAction: 'none',
          pointerEvents: activo ? 'auto' : 'none',
          cursor: activo ? 'crosshair' : 'default',
        }}
      />
      <div ref={anilloRef} className="pizarra-anillo" aria-hidden="true" />
    </>
  );
});
