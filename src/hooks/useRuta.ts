/**
 * La pantalla abierta, unida a la dirección y al historial del navegador (20-11-2026). La lógica y el porqué están
 * en `lib/ruta.ts`; esto la conecta con React y con `window.history`.
 *
 *   - Cambiar de pantalla (`setSection`) añade una entrada al historial con su dirección («#/cuaderno»).
 *   - Atrás y adelante cambian de pantalla. Si hay una ventana abierta, atrás la cierra y la pantalla se queda
 *     (`lib/loAbierto.ts`): el salto del navegador se deshace volviendo a la entrada en la que se estaba.
 *   - Recargar deja en la misma pantalla y abrir una dirección lleva a la suya.
 *   - Una pantalla que no está en el menú del perfil, o una dirección que no existe, lleva al Inicio.
 *   - Cambiar de perfil vuelve al Inicio; el primer perfil que se abre en la visita respeta la dirección.
 *
 * `setSection` se llama igual que el de `useState` que sustituye: quien ya cambiaba de pantalla con él no tiene
 * que saber nada de direcciones.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Section } from '../types';
import type { TipoDocente } from '../lib/tipoDocente';
import { enMenu, nombreDePantalla } from '../lib/navigation';
import { alVolver, entradaDeLaPagina, guardarSalida, hashDe, leerEntrada, pantallaDeHash, resolver, type Entrada } from '../lib/ruta';
import { cerrarLoAbierto } from '../lib/loAbierto';
import { requestAlumno, takeAlumno, type AlumnoPedido } from '../lib/apoyoNav';
import { useI18n } from '../i18n';

/**
 * La parte «#» con la que se abre la app. Se mira al cargar la página, antes de que la vuelta de Google o de
 * Microsoft limpie la dirección, y al irse se apunta la pantalla por si se vuelve de una de las dos.
 */
const ENTRADA = typeof window === 'undefined' ? '' : entradaDeLaPagina(window.location, window.sessionStorage);
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => guardarSalida(window.location.hash, window.sessionStorage));
}

/** La dirección con la que se abre la app ya se ha usado: un perfil que se monte después empieza por la suya. */
let entradaUsada = false;

/** El alumno pedido para su página, sin gastarlo: la página lo sigue leyendo al abrirse. */
function mirarAlumno(): AlumnoPedido | undefined {
  const p = takeAlumno();
  if (!p) return undefined;
  requestAlumno(p.alumnoId, p.pestana);
  return p;
}

function escribir(modo: 'pushState' | 'replaceState', entrada: Entrada, hash: string): boolean {
  // Safari corta a quien cambia el historial cien veces en medio minuto: la pantalla cambia igual
  try { window.history[modo](entrada, '', hash); return true; } catch { return false; }
}

/** Quita la pantalla de la dirección (al salir de la cuenta: quien entre después empieza por el Inicio). */
export function olvidarRuta(): void {
  try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* sin historial */ }
}

export interface OpcionesDeIr {
  /** Sustituye la entrada del historial en vez de añadir otra: para un salto que el docente no ha pedido. */
  sustituir?: boolean;
}

export function useRuta({ profileId, tipo }: {
  /** El perfil abierto, o `null` en la bienvenida. */
  profileId: string | null;
  /** El tipo de docente del perfil ya cargado, o `null` mientras no lo esté. */
  tipo: TipoDocente | null;
}): { section: Section; setSection: (s: Section, op?: OpcionesDeIr) => void } {
  const { t } = useI18n();
  const [section, setSectionState] = useState<Section>(() => {
    const hash = entradaUsada ? window.location.hash : ENTRADA;
    const d = resolver(hash, leerEntrada(window.history.state), null);
    // La página del alumno la abre quien la pide: se vuelve a pedir el de esa entrada (recargar con ella abierta)
    if (d.alumno) requestAlumno(d.alumno.alumnoId, d.alumno.pestana);
    return d.section;
  });

  // Al cambiar de perfil se vuelve al Inicio, no a la pantalla del docente anterior; el primero que se abre en la
  // visita (se llegó con una dirección y hubo que elegir perfil) respeta la dirección. Y una pantalla que el menú
  // de ese perfil no tiene lleva al Inicio. Se ajusta durante el pintado, no en un efecto: así no se ve ni un
  // instante la pantalla que no toca.
  const [dueno, setDueno] = useState(profileId);
  const [primerPerfil, setPrimerPerfil] = useState(profileId === null);
  if (dueno !== profileId) {
    setDueno(profileId);
    if (profileId !== null && primerPerfil) setPrimerPerfil(false);
    else if (section !== 'dashboard') setSectionState('dashboard');
  } else if (tipo && !enMenu(section, tipo)) {
    setSectionState('dashboard');
  }

  /** El orden de la entrada del historial en la que está la app. */
  const ap = useRef(0);
  /** La pantalla y el tipo, para leerlos desde los avisos del navegador. */
  const actual = useRef(section);
  const tipoActual = useRef(tipo);
  /**
   * El docente no ha tocado nada desde que se llegó a esta entrada (al abrir la app o por el historial). Si en ese
   * rato una pantalla manda a otra (la página de un alumno que ya no existe manda a la lista), es un rebote suyo y
   * no una visita: sustituye la entrada. Si añadiera otra, «atrás» volvería a la que rebota y no se podría salir.
   */
  const sinTocar = useRef(true);
  /** Lo que «atrás» intentó cerrar la última vez, mientras no se toque nada (ver `cerrarLoAbierto`). */
  const intentado = useRef<Element | null>(null);
  const cerrando = useRef(false);

  // Primero el orden de la entrada en la que se abre; después (los efectos van en orden) la dirección
  useEffect(() => {
    entradaUsada = true;
    const e = leerEntrada(window.history.state);
    if (e) ap.current = e.ap;
    else { ap.current = 0; escribir('replaceState', { ap: 0 }, window.location.href); }

    const alCambiar = () => {
      const r = alVolver({ hash: window.location.hash, estado: window.history.state, ap: ap.current, actual: actual.current, tipo: tipoActual.current });
      if (r.hacer === 'nada') return;
      if (r.pasos !== 0) {
        cerrando.current = true;
        const cerrado = cerrarLoAbierto(document, intentado.current);
        cerrando.current = false;
        // Había una ventana abierta: se cierra y se vuelve a la entrada en la que se estaba
        if (cerrado) { intentado.current = cerrado; window.history.go(r.pasos); return; }
      }
      const { section: s, alumno } = r.destino;
      if (alumno) requestAlumno(alumno.alumnoId, alumno.pestana);
      // Una dirección escrita a mano es una entrada nueva, detrás de la que había: se le pone su orden. Y si lleva
      // a otra pantalla que la que dice (no existe, no es de este perfil), se corrige.
      if (r.ap === null) ap.current += 1; else ap.current = r.ap;
      if (r.ap === null || pantallaDeHash(window.location.hash) !== s) {
        escribir('replaceState', alumno ? { ap: ap.current, alumno } : { ap: ap.current }, hashDe(s));
      }
      sinTocar.current = true;
      actual.current = s;
      setSectionState(s);
    };
    const alTocar = (e: Event) => {
      // Ni el Escape que manda `cerrarLoAbierto` ni Alt+← (que es «atrás») son el docente tocando la pantalla
      if (cerrando.current || (e instanceof KeyboardEvent && (e.altKey || e.key === 'Alt' || e.key === 'BrowserBack'))) return;
      sinTocar.current = false;
      intentado.current = null;
    };
    window.addEventListener('popstate', alCambiar);
    window.addEventListener('hashchange', alCambiar);
    // «click» también: un lector de pantalla pulsa un botón sin puntero ni teclado
    const TOQUES = ['pointerdown', 'keydown', 'click'] as const;
    for (const ev of TOQUES) window.addEventListener(ev, alTocar, true);
    return () => {
      window.removeEventListener('popstate', alCambiar);
      window.removeEventListener('hashchange', alCambiar);
      for (const ev of TOQUES) window.removeEventListener(ev, alTocar, true);
    };
  }, []);

  // La dirección sigue a la pantalla cuando esta cambia sin pasar por `setSection` (otro perfil, una pantalla que
  // este perfil no tiene, una dirección que no existe): se corrige sin añadir una entrada.
  useEffect(() => {
    actual.current = section;
    if (pantallaDeHash(window.location.hash) !== section) escribir('replaceState', { ap: ap.current }, hashDe(section));
  }, [section]);
  useEffect(() => { tipoActual.current = tipo; }, [tipo]);

  // El título de la pestaña dice la pantalla: así se leen los marcadores y la lista de «atrás» del navegador
  useEffect(() => {
    const nombre = tipo && section !== 'dashboard' ? nombreDePantalla(section, tipo) : undefined;
    document.title = nombre ? `${t(nombre)} · AulaPro` : 'AulaPro';
    return () => { document.title = 'AulaPro'; };
  }, [section, tipo, t]);

  const setSection = useCallback((s: Section, op?: OpcionesDeIr) => {
    if (s === actual.current) return;
    const alumno = s === 'apoyo-alumno' ? mirarAlumno() : undefined;
    const sustituir = op?.sustituir === true || sinTocar.current;
    const entrada: Entrada = { ap: sustituir ? ap.current : ap.current + 1, ...(alumno ? { alumno } : {}) };
    if (escribir(sustituir ? 'replaceState' : 'pushState', entrada, hashDe(s))) ap.current = entrada.ap;
    actual.current = s;
    setSectionState(s);
  }, []);

  return { section, setSection };
}
