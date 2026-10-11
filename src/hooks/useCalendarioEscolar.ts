import { useSyncExternalStore } from 'react';
import { calendarios, suscribir, type ArchivoCalendarios } from '../lib/calendarioEscolar';

/** Los calendarios escolares de serie o los últimos descargados; se repinta al llegar uno nuevo. */
export function useCalendarioEscolar(): ArchivoCalendarios {
  return useSyncExternalStore(suscribir, calendarios, calendarios);
}
