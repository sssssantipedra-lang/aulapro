/**
 * Versión web: cuánto se usa AulaPro de verdad, para el registro de usuarios del servidor (`web/funciones/api/_usuarios.js`,
 * petición del dueño del 9-11-2026: «un motor que mida el uso real de cada uno»).
 *
 * Solo cuenta el **uso activo**: un minuto cuenta si la app está a la vista (la pestaña delante) y el docente la ha tocado
 * (ratón, teclado, dedo o rueda) en los últimos 5 minutos. Una pestaña olvidada en segundo plano no suma nada.
 *
 * Qué sale de aquí: cada 15 minutos con uso, y al ocultar la pestaña, un aviso a `licencia/uso` con la licencia firmada de
 * la cuenta y los minutos. Nada más: ni qué pantalla, ni qué se hace, ni nada del trabajo o del alumnado. Lo que no se pudo
 * mandar se intenta en el siguiente aviso (como mucho, 30 minutos). El servidor solo lo apunta si el registro está
 * encendido (`REGISTRO_USUARIOS`), y la privacidad lo explica (versión web, apartado 5).
 */
import { pedirApi } from './servidores';

export const MINUTO = 60_000;
export const AVISO_CADA = 15 * MINUTO;
/** Sin tocar la app más de esto, deja de contar como uso activo. */
export const INACTIVO_TRAS = 5 * MINUTO;
/** Lo que se guarda sin poder mandarlo: lo que acepta el servidor en un aviso. */
export const MAX_PENDIENTES = 30;

export interface MedidaDeUso {
  /** El docente ha tocado la app. */
  interaccion(): void;
  /** Cada minuto: suma uno si la app está a la vista y se usa. */
  tic(): void;
  /** Manda lo pendiente (cada 15 minutos y al ocultar la pestaña). */
  avisar(): Promise<void>;
  pendientes(): number;
}

export function crearMedidaDeUso(opts: {
  enviar: (minutos: number) => Promise<boolean>;
  visible: () => boolean;
  ahora?: () => number;
}): MedidaDeUso {
  const ahora = opts.ahora ?? Date.now;
  let ultimaInteraccion = ahora();
  let pendientes = 0;
  let enviando = false;
  return {
    interaccion() { ultimaInteraccion = ahora(); },
    tic() {
      if (opts.visible() && ahora() - ultimaInteraccion < INACTIVO_TRAS) pendientes = Math.min(MAX_PENDIENTES, pendientes + 1);
    },
    async avisar() {
      if (enviando || pendientes < 1) return;
      enviando = true;
      const minutos = pendientes;
      try {
        if (await opts.enviar(minutos).catch(() => false)) pendientes = Math.max(0, pendientes - minutos);
      } finally {
        enviando = false;
      }
    },
    pendientes: () => pendientes,
  };
}

let firmaActual: string | null = null;
let iniciada = false;

/**
 * La firma con la que se mandan los avisos: la de la licencia de la cuenta que acaba de valer (`alValer` en `web.ts`), o
 * `null` si se pierde la licencia o no es de una cuenta (una clave escrita a mano no se registra).
 */
export function usarFirmaParaUso(firma: string | null) {
  firmaActual = firma;
  if (firma) iniciarMedidaDeUso();
}

function iniciarMedidaDeUso() {
  if (iniciada || typeof window === 'undefined') return;
  iniciada = true;
  const medida = crearMedidaDeUso({
    visible: () => document.visibilityState === 'visible',
    enviar: async minutos => {
      if (!firmaActual) return false;
      try {
        const res = await pedirApi('/api/licencia/uso', {
          method: 'POST', keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firma: firmaActual, minutos }),
        });
        return res.ok;
      } catch {
        return false;   // sin conexión: se intenta en el siguiente aviso
      }
    },
  });
  const tocar = () => medida.interaccion();
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, tocar, { passive: true, capture: true });
  setInterval(() => medida.tic(), MINUTO);
  setInterval(() => { void medida.avisar(); }, AVISO_CADA);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void medida.avisar(); });
}
