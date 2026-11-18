import { useCallback, useMemo, useState } from 'react';
import { marcarSugerenciaVista, sugerenciasVistas } from '../lib/sugerencias';

/** Las sugerencias ya vistas en este dispositivo y cómo apuntar una más. */
export function useSugerencias(): { vista: (clave: string) => boolean; marcar: (clave: string) => void } {
  const [vistas, setVistas] = useState<string[]>(sugerenciasVistas);
  const marcar = useCallback((clave: string) => setVistas(marcarSugerenciaVista(clave)), []);
  return useMemo(() => ({ vista: (clave: string) => vistas.includes(clave), marcar }), [vistas, marcar]);
}
