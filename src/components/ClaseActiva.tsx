/**
 * Pone al alcance de todas las pantallas lo que la regla de la clase activa necesita (horario,
 * calendario escolar, perfil) y la clase de ahora, que se vuelve a mirar cada medio minuto y al volver
 * a la app. Ver `lib/claseActiva.ts` y `hooks/useClaseActiva.ts`.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Class, ScheduleBlock } from '../types';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import type { ProvinciaId } from '../lib/provincias';
import { claseDeAhora, hayClaseHoy } from '../lib/claseActiva';
import { useCalendarioEscolar } from '../hooks/useCalendarioEscolar';
import { ClaseActivaContexto, type ContextoDeClaseActiva } from '../hooks/useClaseActiva';

interface Props {
  perfil: string;
  classes: Class[];
  blocks: ScheduleBlock[];
  comunidad?: ComunidadId;
  provincia?: ProvinciaId | null;
  children: ReactNode;
}

export function ClaseActiva({ perfil, classes, blocks, comunidad, provincia, children }: Props) {
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());
  const mirar = useCallback(() => setAhoraMs(Date.now()), []);
  useEffect(() => {
    const alVolver = () => { if (!document.hidden) mirar(); };
    const id = window.setInterval(mirar, 30_000);
    document.addEventListener('visibilitychange', alVolver);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', alVolver); };
  }, [mirar]);
  const archivo = useCalendarioEscolar();
  const ahora = useMemo(() => {
    const now = new Date(ahoraMs);
    return claseDeAhora(classes, blocks, now, hayClaseHoy(archivo, classes, comunidad, provincia, now));
  }, [ahoraMs, archivo, classes, blocks, comunidad, provincia]);
  // El valor solo cambia cuando cambia la clase de ahora, no cada medio minuto: las pantallas no se repintan de más
  const { id, enMarcha, desde, hasta } = ahora ?? { id: '', enMarcha: false, desde: '', hasta: '' };
  const valor = useMemo<ContextoDeClaseActiva>(() => ({
    perfil, classes, blocks, comunidad, provincia,
    ahora: id ? { id, enMarcha, desde, hasta } : null,
    mirar,
  }), [perfil, classes, blocks, comunidad, provincia, id, enMarcha, desde, hasta, mirar]);
  return <ClaseActivaContexto.Provider value={valor}>{children}</ClaseActivaContexto.Provider>;
}
