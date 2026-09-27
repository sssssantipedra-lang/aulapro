import { useCallback, useEffect, useRef, useState } from 'react';

/** Cada cuánto pasa al siguiente panel. */
export const ROTATE_MS = 6_000;
/** Duración del fundido. Debe cuadrar con la del CSS (.dash-panel). */
export const FADE_MS = 420;

/**
 * Rotación automática compartida por las tarjetas del inicio.
 *
 * Con una sola página no rota ni enseña controles: el número de páginas sale
 * de cuántos datos haya, así que una agenda con tres eventos se queda quieta y
 * una con quince va pasando sola.
 *
 * Se detiene mientras el ratón está encima. Varias tarjetas tienen casillas y
 * botones, y cambiar la lista justo cuando alguien va a pulsar es la forma más
 * rápida de que marque lo que no era.
 */
export function useCarousel(count: number) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timers = useRef<number[]>([]);

  // Si desaparecen datos (se borra una clase), el índice puede quedar fuera
  const safeIndex = count ? index % count : 0;

  const goTo = useCallback((next: number) => {
    if (count < 1) return;
    timers.current.forEach(clearTimeout);
    setVisible(false);
    const t = window.setTimeout(() => {
      setIndex(((next % count) + count) % count);
      setVisible(true);
    }, FADE_MS);
    timers.current = [t];
  }, [count]);

  // El intervalo se crea una sola vez, así que debe leer el índice actual y no
  // el que hubiera cuando se creó.
  const indexRef = useRef(safeIndex);
  useEffect(() => { indexRef.current = safeIndex; }, [safeIndex]);

  useEffect(() => {
    if (paused || hovered || count < 2) return;
    const id = window.setInterval(() => goTo(indexRef.current + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, hovered, count, goTo]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return {
    index: safeIndex,
    visible,
    paused,
    setPaused,
    goTo,
    /** Se reparte sobre la tarjeta para que el ratón encima detenga el paso. */
    hoverProps: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
    },
  };
}

/** Parte una lista en páginas de como mucho `perPage` elementos. */
export function paginate<T>(items: T[], perPage: number): T[][] {
  if (items.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) out.push(items.slice(i, i + perPage));
  return out;
}
