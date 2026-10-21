/**
 * El guardado automático de lo que hay en pantalla (petición del dueño,
 * 21-10-2026: «guardado automático en segundo plano para cualquier cambio»).
 *
 * Cada cambio se escribe a disco tras una pausa corta, para agrupar los
 * seguidos. Antes, un cambio hecho en esa pausa se perdía si se cerraba la
 * ventana o se cambiaba de perfil justo después: ahora se escribe al instante
 * al ocultarse o cerrarse la página y al salir del perfil.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Huella de lo último guardado, para no volver a escribir lo mismo. Antes se
 * guardaba aquí el texto entero, una segunda copia del curso que no se soltaba
 * nunca (varios MB con un curso completo); la longitud y el SHA-256 bastan para
 * saber si ha cambiado algo. Si el navegador no tiene `crypto.subtle`, se queda
 * el texto, como antes.
 */
export async function huellaDe(json: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return json;
  try {
    const digest = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(json)));
    return `${json.length}:${Array.from(digest, b => b.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return json;
  }
}

interface Opciones<T> {
  ready: boolean;
  profileId: string | null;
  snapshot: T;
  guardar: (profileId: string, datos: T) => Promise<unknown> | unknown;
  /** Espera tras el último cambio, en ms. */
  retardo: number;
}

export function useGuardadoAutomatico<T>({ ready, profileId, snapshot, guardar, retardo }: Opciones<T>): { saving: boolean } {
  const [saving, setSaving] = useState(false);
  const ultimaHuella = useRef('');
  /** Lo que hay por escribir: el perfil y sus datos, juntos, para no mezclar uno con otro al cambiar de perfil. */
  const pendiente = useRef<{ id: string; datos: T } | null>(null);
  /** Último objeto escrito (por el temporizador o por `volcar`), para que el temporizador no repita lo que ya se escribió al instante. */
  const escrito = useRef<T | null>(null);
  const guardarRef = useRef(guardar);
  useEffect(() => { guardarRef.current = guardar; }, [guardar]);

  useEffect(() => {
    if (!ready || !profileId) return;
    pendiente.current = { id: profileId, datos: snapshot };

    // Serializar es lo caro de todo esto: recorre el curso entero. Va DENTRO
    // del temporizador a propósito, para que se pague una vez por pausa de
    // escritura y no en cada tecla; hacerlo fuera ponía todo el cuaderno en el
    // camino de cada pulsación y se notaba al escribir.
    const timer = setTimeout(async () => {
      if (escrito.current === snapshot) return;
      const huella = await huellaDe(JSON.stringify(snapshot));
      if (huella === ultimaHuella.current) {
        if (pendiente.current?.datos === snapshot) pendiente.current = null;
        return;
      }
      setSaving(true);
      escrito.current = snapshot;
      await guardarRef.current(profileId, snapshot);
      ultimaHuella.current = huella;
      if (pendiente.current?.datos === snapshot) pendiente.current = null;
      setSaving(false);
    }, retardo);
    return () => clearTimeout(timer);
  }, [snapshot, ready, profileId, retardo]);

  /** Escribe ya lo que esté esperando la pausa. */
  const volcar = useCallback(() => {
    const p = pendiente.current;
    if (!p) return;
    pendiente.current = null;
    escrito.current = p.datos;
    void guardarRef.current(p.id, p.datos);
  }, []);

  // Al cerrar la ventana, al pasar a segundo plano (en el móvil, la forma de «cerrar») y al salir de la pantalla
  useEffect(() => {
    const alOcultar = () => { if (document.visibilityState === 'hidden') volcar(); };
    window.addEventListener('pagehide', volcar);
    window.addEventListener('beforeunload', volcar);
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      window.removeEventListener('pagehide', volcar);
      window.removeEventListener('beforeunload', volcar);
      document.removeEventListener('visibilitychange', alOcultar);
      volcar();
    };
  }, [volcar]);

  // Al cambiar de perfil, lo que quedaba sin escribir del anterior se escribe antes
  useEffect(() => () => volcar(), [profileId, volcar]);

  return { saving };
}
