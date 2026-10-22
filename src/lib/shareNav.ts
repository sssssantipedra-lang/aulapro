/**
 * Código de sesión que llega desde fuera de la aplicación, por un enlace
 * `aulapro://c/XXXXXX` (Android). Lo escribe `main.tsx` al recibir el enlace y
 * lo consume la pantalla de «Trabajo compartido» al montarse, para conectarse
 * como invitado sin tener que elegir clase.
 */
let pending: string | null = null;

export function requestShareCode(code: string) {
  pending = code;
}

/** Lo mira sin consumirlo: sirve para que la app sepa que hay que ir a Compartir. */
export function peekShareCode(): string | null {
  return pending;
}

/** Lo devuelve una sola vez y lo borra. */
export function takeShareCode(): string | null {
  const c = pending;
  pending = null;
  return c;
}
