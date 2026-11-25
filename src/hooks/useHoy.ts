import { useEffect, useState } from 'react';
import { isoDate } from '../lib/utils';

/**
 * Hoy, en AAAA-MM-DD local (`isoDate`), que cambia solo al pasar la medianoche con la app abierta: lo que depende
 * del día (cuánto falta para un evento, los avisos) no se queda en ayer. Se mira cada minuto y, además, al volver a
 * la pestaña o al despertar el equipo (los temporizadores se paran en reposo); solo se vuelve a pintar cuando el día
 * cambia.
 */
export function useHoy(): string {
  const [hoy, setHoy] = useState(() => isoDate());
  useEffect(() => {
    const mirar = () => setHoy(isoDate());
    const id = window.setInterval(mirar, 60_000);
    const alVolver = () => { if (document.visibilityState === 'visible') mirar(); };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', mirar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', mirar);
    };
  }, []);
  return hoy;
}
