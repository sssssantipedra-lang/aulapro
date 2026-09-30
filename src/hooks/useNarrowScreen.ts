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

/** Móvil: el menú lateral desaparece y se abre desde una barra superior. */
const PHONE_QUERY = '(max-width: 640px)';
const phoneMq = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(PHONE_QUERY) : null);

function subscribePhone(onChange: () => void) {
  const m = phoneMq();
  m?.addEventListener('change', onChange);
  return () => m?.removeEventListener('change', onChange);
}

export function usePhoneScreen(): boolean {
  return useSyncExternalStore(subscribePhone, () => phoneMq()?.matches ?? false, () => false);
}
