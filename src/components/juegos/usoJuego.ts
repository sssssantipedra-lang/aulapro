/**
 * Lo que comparten los juegos para la clase (26-11-2026, al llegar el segundo juego, «La recta numérica»): salieron
 * de «Tirar de la cuerda» tal como estaban, sin cambiar cómo se comportan.
 *
 * - `Boton` (en `Boton.tsx`): las teclas de un juego actúan al tocarlas (`pointerdown`, que el navegador da aunque haya dos dedos a la
 *   vez); los demás botones (`alSoltar`), con el `click` de siempre, al soltar.
 * - `useJuegoAbierto`: mientras el juego está abierto, la página de debajo no se desplaza, la pantalla no se apaga
 *   (`wakeLock`), los atajos con Ctrl o ⌘ de la app no le llegan, Escape sale y, si el juego se oculta (la pizarra
 *   sigue montada al ir a otra pantalla), se cierra solo. Devuelve el tamaño del juego.
 * - `usePantallaCompleta`, `useConfeti` (en un lienzo dentro del juego, para que se vea a pantalla completa) y
 *   `useSegundoToque` (salir en mitad de una partida pide tocar dos veces).
 * La raíz de cada juego lleva la clase `juego-abierto`: con ella la versión nueva de la app no se instala
 * (`docenteOcupado` en `platform/web.ts`).
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import confetti from 'canvas-confetti';

export interface Tamano { w: number; h: number }

/**
 * Lo de estar abierto, común a todos los juegos. `onClose` puede cambiar en cada pintado. Escape sale del juego salvo
 * que el propio juego esté a pantalla completa (entonces la quita el navegador); quien tenga algo encima que deba
 * cerrar antes con Escape (el teclado de los nombres) lo atiende en la fase de captura y lo para.
 */
export function useJuegoAbierto(rootRef: RefObject<HTMLElement | null>, onClose: () => void): Tamano {
  const [tam, setTam] = useState<Tamano>(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280, h: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    let visto = false;
    const obs = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      // Oculto (la pizarra se queda montada al ir a otra pantalla): el juego se cierra y la música se para
      if (r.width === 0 && r.height === 0) { if (visto) onCloseRef.current(); return; }
      visto = true;
      setTam(v => (Math.abs(v.w - r.width) < 1 && Math.abs(v.h - r.height) < 1 ? v : { w: r.width, h: r.height }));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootRef]);

  /* ── Sin desplazar lo de debajo, sin apagar la pantalla y, al salir, sin pantalla completa ── */
  useEffect(() => {
    const raiz = rootRef.current;
    const html = document.documentElement, body = document.body;
    const antes = [html.style.overflow, body.style.overflow, html.style.overscrollBehavior];
    html.style.overflow = 'hidden'; body.style.overflow = 'hidden'; html.style.overscrollBehavior = 'none';
    let lock: WakeLockSentinel | null = null;
    let fuera = false;
    const pedir = () => {
      if (fuera || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      navigator.wakeLock.request('screen').then(l => { if (fuera) l.release().catch(() => {}); else lock = l; }).catch(() => {});
    };
    const alVolver = () => { if (document.visibilityState === 'visible') pedir(); };
    pedir();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      fuera = true;
      [html.style.overflow, body.style.overflow, html.style.overscrollBehavior] = antes;
      document.removeEventListener('visibilitychange', alVolver);
      lock?.release().catch(() => {});
      if (document.fullscreenElement && raiz?.contains(document.fullscreenElement)) document.exitFullscreen?.().catch(() => {});
    };
  }, [rootRef]);

  /*
   * Los atajos de la app (Ctrl+K abre el buscador, Ctrl+Z deshace un borrado) escuchan en la ventana: con el juego
   * delante harían algo que no se ve. Mientras está abierto, no les llegan.
   */
  useEffect(() => {
    const atajo = (e: KeyboardEvent) => { if (e.ctrlKey || e.metaKey) e.stopPropagation(); };
    window.addEventListener('keydown', atajo, true);
    return () => window.removeEventListener('keydown', atajo, true);
  }, []);

  /* ── Escape sale del juego ── */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      // Con el propio juego en pantalla completa, Escape la quita (lo hace el navegador); con la pizarra en pantalla
      // completa y el juego encima, Escape sale del juego
      if (e.key !== 'Escape' || (document.fullscreenElement && document.fullscreenElement === rootRef.current)) return;
      onCloseRef.current();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [rootRef]);

  return tam;
}

/** La pantalla completa del propio juego. */
export function usePantallaCompleta(rootRef: RefObject<HTMLElement | null>) {
  const [completa, setCompleta] = useState(false);
  const puede = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  useEffect(() => {
    const alCambiar = () => setCompleta(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, [rootRef]);
  const alternar = () => {
    if (document.fullscreenElement === rootRef.current) document.exitFullscreen?.().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  };
  return { completa, puede, alternar };
}

type Disparo = ((o: confetti.Options) => unknown) & { reset?: () => void };

/**
 * El confeti, en un lienzo dentro del juego: el de `canvas-confetti` va al `body`, y con el juego (o la pizarra) en
 * pantalla completa solo se ve lo que hay dentro del elemento en pantalla completa. Con «reducir movimiento», nada.
 */
export function useConfeti(lienzoRef: RefObject<HTMLCanvasElement | null>) {
  const confeti = useRef<Disparo | null>(null);
  useEffect(() => {
    const c = lienzoRef.current;
    const crear = (confetti as { create?: typeof confetti.create }).create;
    confeti.current = c && typeof crear === 'function' ? crear(c, { resize: true, disableForReducedMotion: true }) : confetti;
    return () => { confeti.current?.reset?.(); confeti.current = null; };
  }, [lienzoRef]);
  return confeti;
}

/** Lo que vale el primer toque en salir o volver al inicio en mitad de una partida. */
export const ESPERA_CONFIRMAR = 3000;

/**
 * Salir o volver al inicio en mitad de una partida: con el dedo, al segundo toque (los controles quedan entre los
 * equipos); con el teclado o el botón de atrás (que pulsa «Salir» por código), a la primera.
 */
export function useSegundoToque<Q extends string>(enPartida: boolean, hacer: (que: Q) => void) {
  const [aviso, setAviso] = useState<Q | null>(null);
  useEffect(() => {
    if (!aviso) return;
    const id = window.setTimeout(() => setAviso(null), ESPERA_CONFIRMAR);
    return () => window.clearTimeout(id);
  }, [aviso]);
  const pedir = (que: Q, porTeclado: boolean) => {
    if (enPartida && !porTeclado && aviso !== que) { setAviso(que); return; }
    setAviso(null);
    hacer(que);
  };
  return { aviso, setAviso, pedir };
}

/*
 * ── Huecos de imagen (26-11-2026, petición del dueño: él generará los dibujos) ──
 * Un dibujo importante de un juego se busca en `public/juegos/<juego>/<nombre>.webp`; si está, se usa, y si no, se
 * pinta la versión hecha con código. Se prueba una vez por sesión y archivo (el resultado se recuerda), así que poner
 * o quitar un dibujo no pide cambiar el código. La tabla de huecos de cada juego está en docs/JUEGOS.md.
 */
const huecos = new Map<string, boolean>();

/** La dirección del dibujo si existe; `null` mientras se prueba o si no está (entonces, la versión de código). */
export function useHueco(ruta: string | null): string | null {
  const [, repintar] = useState(0);
  useEffect(() => {
    if (!ruta || huecos.has(ruta) || typeof Image === 'undefined') return;
    let vivo = true;
    const img = new Image();
    const fin = (si: boolean) => { huecos.set(ruta, si); if (vivo) repintar(n => n + 1); };
    // Un servidor que contesta con otra cosa (la página de la app) no decodifica como imagen: cuenta como que no está
    img.onload = () => fin(img.naturalWidth > 0);
    img.onerror = () => fin(false);
    img.src = ruta;
    return () => { vivo = false; };
  }, [ruta]);
  return ruta && huecos.get(ruta) ? ruta : null;
}
