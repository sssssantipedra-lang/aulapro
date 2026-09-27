import { useSyncExternalStore } from 'react';

/** Por debajo de este ancho el menú lateral se pliega solo a iconos. */
const QUERY = '(max-width: 960px)';

const mq = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null);

function subscribe(onChange: () => void) {
  const m = mq();
  m?.addEventListener('change', onChange);
  return () => m?.removeEventListener('change', onChange);
}

/** Si la ventana es estrecha (portátil pequeño, ventana a media pantalla, tableta). */
export function useNarrowScreen(): boolean {
  return useSyncExternalStore(subscribe, () => mq()?.matches ?? false, () => false);
}
