/**
 * El autoguardado de una pantalla que genera cosas (ver `services/borradores.ts`).
 *
 * `pendiente` es el estado que hay que conservar mientras no se haya guardado
 * de verdad, o `null` cuando no hay nada sin guardar. Mientras no sea `null`,
 * se guarda una copia poco después de cada cambio, al cambiar de pantalla y
 * al cerrar la ventana. Cuando vuelve a ser `null` (se guardó o se descartó
 * a propósito) la copia se borra.
 *
 * Al abrir la pantalla, `encontrado` trae la copia de la última vez, si quedó
 * alguna: la pantalla ofrece continuar (`continuar()` la entrega y la quita
 * del aviso) o descartarla.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ESPERA_MS, borrarBorrador, guardarBorrador, leerBorrador, type Borrador, type TipoBorrador } from '../services/borradores';

export function useBorrador<T>(tipo: TipoBorrador, pendiente: T | null, titulo: string) {
  const [encontrado, setEncontrado] = useState<Borrador<T> | null>(() => leerBorrador<T>(tipo));
  const [guardadoEn, setGuardadoEn] = useState<string | null>(null);
  // Lo último que hay, para guardarlo al cambiar de pantalla o cerrar la ventana
  const ultimo = useRef({ pendiente, titulo });
  useEffect(() => { ultimo.current = { pendiente, titulo }; });
  const habiaPendiente = useRef(false);

  useEffect(() => {
    if (pendiente === null) return;
    const id = window.setTimeout(() => {
      const en = guardarBorrador(tipo, pendiente, titulo);
      if (en) setGuardadoEn(en);
    }, ESPERA_MS);
    return () => window.clearTimeout(id);
  }, [tipo, pendiente, titulo]);

  // De «hay algo sin guardar» a «no hay nada»: se guardó o se descartó a propósito
  useEffect(() => {
    if (pendiente === null && habiaPendiente.current) {
      borrarBorrador(tipo);
      setGuardadoEn(null);
    }
    habiaPendiente.current = pendiente !== null;
  }, [pendiente, tipo]);

  useEffect(() => {
    const volcar = () => {
      const { pendiente: p, titulo: t } = ultimo.current;
      if (p !== null) guardarBorrador(tipo, p, t);
    };
    window.addEventListener('pagehide', volcar);
    return () => {
      window.removeEventListener('pagehide', volcar);
      // Al salir de la pantalla con cambios sin guardar, la copia queda hecha
      volcar();
    };
  }, [tipo]);

  const continuar = useCallback((): T | null => {
    const d = encontrado?.datos ?? null;
    setEncontrado(null);
    return d;
  }, [encontrado]);

  const descartar = useCallback(() => {
    borrarBorrador(tipo);
    setEncontrado(null);
  }, [tipo]);

  return { encontrado, guardadoEn, continuar, descartar };
}

/**
 * Lo mismo para una ventana emergente (rúbrica, diana): la ventana cuenta lo
 * que hay en ella con `cambiar(datos)` y, al guardar de verdad, con
 * `cambiar(null)`. Cerrarla sin guardar no borra nada: lo hecho se queda y la
 * pantalla ofrece continuar (`restos`), tanto en esta sesión como en la
 * siguiente.
 */
export function useBorradorVentana<P>(tipo: TipoBorrador, abierta: boolean, titulo: (p: P) => string) {
  const [datos, setDatos] = useState<P | null>(null);
  const [instante, setInstante] = useState('');
  const b = useBorrador<P>(tipo, datos, datos ? titulo(datos) : '');

  const cambiar = useCallback((p: P | null) => {
    if (p) setInstante(new Date().toISOString());
    setDatos(p);
  }, []);

  const restos: Borrador<P> | null = b.encontrado
    ?? (datos && !abierta ? { datos, titulo: titulo(datos), guardadoEn: b.guardadoEn ?? instante } : null);

  /** Lo que había, para volver a abrir la ventana con ello. */
  const continuar = useCallback((): P | null => (b.encontrado ? b.continuar() : datos), [b, datos]);
  const descartar = useCallback(() => { b.descartar(); setDatos(null); }, [b]);

  return { cambiar, restos, continuar, descartar, guardadoEn: b.guardadoEn };
}
