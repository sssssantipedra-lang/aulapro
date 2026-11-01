/**
 * Versión web: AulaPro abierta en una sola pestaña o ventana a la vez (auditoría del 1-11-2026).
 *
 * Cada pestaña tiene su copia del trabajo en memoria y la guarda entera. Con dos abiertas (la app instalada y una
 * pestaña del navegador, o la misma dirección abierta dos veces), lo que se hacía en una lo borraba la otra al guardar
 * cualquier cambio, sin avisar. Ahora la primera pestaña se queda la app con un cerrojo del navegador (Web Locks, en
 * Chrome, Edge, Firefox y Safari desde 2022) y las demás enseñan «AulaPro ya está abierta en otra pestaña», con
 * «Usar aquí». Si se usa aquí, la otra deja de guardar al instante (`guardadoBloqueado`, `espejo.detener`) y pide
 * recargar. Sin Web Locks (navegadores antiguos), todo sigue como antes.
 */
const CERROJO = 'aulapro-datos';

/** Evento de `window` cuando otra pestaña se ha quedado con la app (con «Usar aquí»). */
export const PESTANA_PERDIDA = 'aulapro-pestana-perdida';

type Cerrojos = Pick<LockManager, 'request'>;
const cerrojos = (): Cerrojos | undefined => (typeof navigator !== 'undefined' ? navigator.locks : undefined);

let perdida = false;

/** ¿Otra pestaña se ha quedado con la app? (por si el aviso se monta después de que pase) */
export const pestanaPerdida = () => perdida;

/** Pide el cerrojo y, si lo da, lo sujeta mientras la pestaña esté abierta. `true` si esta pestaña se queda la app. */
function sujetar(opciones: LockOptions, gestor: Cerrojos | undefined): Promise<boolean> {
  if (!gestor) return Promise.resolve(true);
  return new Promise<boolean>(resolve => {
    // Si esta petición llegó a tener el cerrojo: así se distingue «me lo han quitado» de «me cansé de esperar»
    let concedido = false;
    gestor.request(CERROJO, opciones, cerrojo => {
      if (!cerrojo) { resolve(false); return undefined; }
      concedido = true;
      resolve(true);
      // Nunca termina: el navegador lo suelta al cerrar o recargar la pestaña
      return new Promise<void>(() => {});
    }).catch(() => {
      // Otra pestaña lo ha tomado con «Usar aquí» (o se acabó la espera antes de conseguirlo)
      if (concedido) {
        perdida = true;
        if (typeof window !== 'undefined') window.dispatchEvent(new Event(PESTANA_PERDIDA));
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * Al abrir: la app es de esta pestaña si ninguna otra la tiene. Espera un poco por si la otra es esta misma, que se está
 * recargando (una versión nueva, volver de la página de Google o de Microsoft).
 */
export function reservarPestana(espera = 3000, gestor: Cerrojos | undefined = cerrojos()): Promise<boolean> {
  if (!gestor) return Promise.resolve(true);
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), espera);
  return sujetar({ signal: control.signal }, gestor).finally(() => clearTimeout(reloj));
}

/** «Usar aquí»: esta pestaña se queda la app y la otra deja de guardar. */
export function tomarPestana(gestor: Cerrojos | undefined = cerrojos()): Promise<boolean> {
  return sujetar({ steal: true }, gestor);
}

/** Solo para las pruebas. */
export function olvidarPestana() { perdida = false; }
