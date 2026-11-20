/**
 * La clase activa en las pantallas (20-11-2026). La regla está en `lib/claseActiva.ts`; aquí, cómo la
 * usa una pantalla con selector de clase:
 *
 *   const [classId, setClassId, llevarClase] = useClaseActiva(classes);
 *
 * Al abrirse elige la clase con la regla (la de ahora, la última, la primera) y, cuando el docente la
 * cambia, lo anota para que la siguiente pantalla abra la misma. Los datos que la regla necesita
 * (horario, calendario, perfil) llegan por contexto desde `App` (`components/ClaseActiva.tsx`), así
 * que una pantalla nueva no tiene que pedirlos.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Class } from '../types';
import {
  atenderClasePedida, claseAlAbrirAhora, pedirClase, recordarClase,
  type ClaseAlAbrir, type ClaseDeAhora, type DatosDeClaseActiva,
} from '../lib/claseActiva';

export interface ContextoDeClaseActiva extends DatosDeClaseActiva {
  /** La clase de ahora según el horario y el calendario, al día cada medio minuto. */
  ahora: ClaseDeAhora | null;
  /** Vuelve a mirar la hora ya: lo pide cada pantalla al abrirse, para que la marca del selector no vaya por detrás. */
  mirar: () => void;
}

/** Sin proveedor (pruebas de una pantalla suelta) no hay horario ni recuerdo: se abre la primera clase. */
export const ClaseActivaContexto = createContext<ContextoDeClaseActiva | null>(null);

/**
 * La clase elegida de una pantalla y cómo cambiarla.
 * @param classes Las clases que la pantalla ofrece en su selector.
 * @param pedida  La clase que la pantalla recibe de quien la abre, si la hay: manda sobre el horario.
 * @returns La clase, cómo cambiarla y `llevarClase`: se llama antes de pasar a otra pantalla desde un
 *          enlace de esta («Ir al Cuaderno»), para que la otra se abra en la clase que se estaba viendo.
 */
export function useClaseActiva(
  classes: Pick<Class, 'id'>[], pedida?: string | null,
): [id: string, elegir: (id: string) => void, llevarClase: () => void] {
  const ctx = useContext(ClaseActivaContexto);
  const [elegida, setElegida] = useState<ClaseAlAbrir>(() => (
    ctx ? claseAlAbrirAhora(ctx, classes, pedida) : { id: pedida || classes[0]?.id || '', motivo: '' }
  ));
  // Si la pantalla se abrió sin clases (se cargan o se crean después), la regla se aplica al llegar la primera
  if (ctx && !elegida.id && classes.length > 0) setElegida(claseAlAbrirAhora(ctx, classes, pedida));
  // Una clase borrada mientras la pantalla está abierta deja paso a la primera
  const id = classes.some(c => c.id === elegida.id) ? elegida.id : (classes[0]?.id ?? '');
  const perfil = ctx?.perfil;
  // La petición de quien abrió la pantalla ya está atendida: la siguiente pantalla sigue la regla
  useEffect(() => atenderClasePedida(), []);
  const mirar = ctx?.mirar;
  useEffect(() => mirar?.(), [mirar]);
  // Se anota como última la clase con la que de verdad se trabaja: la pedida, la de ahora o la elegida a
  // mano. La que sale por descarte (la siguiente de hoy, la primera) no pisa lo que el docente eligió antes.
  const anotar = elegida.id === id && (elegida.motivo === 'pedida' || elegida.motivo === 'ahora' || elegida.motivo === 'ultima');
  useEffect(() => {
    if (perfil && anotar) recordarClase(perfil, id);
  }, [perfil, anotar, id]);
  const elegir = useCallback((nueva: string) => setElegida({ id: nueva, motivo: 'pedida' }), []);
  const llevarClase = useCallback(() => {
    if (!id) return;
    pedirClase(id);
    if (perfil) recordarClase(perfil, id);
  }, [id, perfil]);
  return [id, elegir, llevarClase];
}

/** La clase de ahora según el horario (para marcarla en el selector); `null` si no hay ninguna. */
export function useClaseDeAhora(): ClaseDeAhora | null {
  return useContext(ClaseActivaContexto)?.ahora ?? null;
}

/**
 * Para quien lleva a otra pantalla con una clase concreta (una tarjeta de clase del Inicio): la fija
 * antes de navegar y la pantalla que se abre la respeta aunque el horario diga otra.
 */
export function useFijarClase(): (id: string | null | undefined) => void {
  const perfil = useContext(ClaseActivaContexto)?.perfil;
  return useCallback((id: string | null | undefined) => {
    if (!id) return;
    pedirClase(id);
    if (perfil) recordarClase(perfil, id);
  }, [perfil]);
}

/**
 * Para los selectores de clase que no usan `useClaseActiva` (la pizarra, que sigue montada entre
 * clases, o Mis clases, que se abre en su portada): anota como última la clase que el docente elige.
 */
export function useRecordarClase(): (id: string | null | undefined) => void {
  const perfil = useContext(ClaseActivaContexto)?.perfil;
  return useCallback((id: string | null | undefined) => {
    if (id && perfil) recordarClase(perfil, id);
  }, [perfil]);
}
