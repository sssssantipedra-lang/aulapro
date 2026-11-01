// Los secretos con que se firman y se comprueban las licencias (_firma.js) y las sesiones (_sesion.js, _puerta.js).
// Auditoría del 1-11-2026.
//
// Hasta ahora todo salía de GOOGLE_CLIENT_SECRET, el secreto del inicio de sesión con Google. Si había que cambiarlo
// (una filtración, o porque Google lo pide), cambiaban a la vez la llave de las licencias y la de las sesiones: las
// sesiones dejaban de valer y la app no podía cargar sus pantallas hasta que cada navegador renovara la licencia (hasta
// un día), y los fundadores tenían que volver a entrar. Ahora:
//
//  - LICENCIA_SECRETO (opcional, en Netlify y en Cloudflare): si está, se firma con él. Si no, con GOOGLE_CLIENT_SECRET,
//    como siempre. Así el secreto de Google se puede cambiar sin tocar las licencias.
//  - LICENCIA_SECRETO_ANTERIOR (opcional): se siguen aceptando las firmas y las sesiones hechas con él. Para pasar a un
//    secreto propio o cambiarlo sin dejar a nadie fuera: se pone el nuevo en LICENCIA_SECRETO y el que se usaba hasta
//    entonces (el de Google, la primera vez) en LICENCIA_SECRETO_ANTERIOR, y pasados 8 días (las firmas caducan a los 7)
//    se quita LICENCIA_SECRETO_ANTERIOR. Ver docs/MANTENIMIENTO.md.
//
// Sin ninguno de los tres, no se firma nada y la puerta deja pasar (mejor la app abierta que la de todos rota).

/** `{ firmar, aceptar }`: el secreto con que se firma ahora y todos los que se aceptan al comprobar. */
export function secretosDeLicencia(env = {}) {
  const firmar = env.LICENCIA_SECRETO || env.GOOGLE_CLIENT_SECRET || '';
  const aceptar = [...new Set([firmar, env.LICENCIA_SECRETO_ANTERIOR].filter(Boolean))];
  return { firmar, aceptar };
}

/** Lo mismo leyendo las variables de Netlify (`Netlify.env.get`). */
export const secretosDeNetlify = get => secretosDeLicencia({
  LICENCIA_SECRETO: get('LICENCIA_SECRETO'),
  LICENCIA_SECRETO_ANTERIOR: get('LICENCIA_SECRETO_ANTERIOR'),
  GOOGLE_CLIENT_SECRET: get('GOOGLE_CLIENT_SECRET'),
});

/**
 * Las funciones aceptan un secreto suelto (las pruebas, y antes de este cambio) o el resultado de `secretosDeLicencia`.
 * Devuelve siempre `{ firmar, aceptar }`.
 */
export function comoSecretos(x) {
  if (x && typeof x === 'object' && !Array.isArray(x)) return { firmar: x.firmar || '', aceptar: (x.aceptar ?? []).filter(Boolean) };
  if (Array.isArray(x)) return { firmar: x.find(Boolean) || '', aceptar: x.filter(Boolean) };
  return { firmar: x || '', aceptar: x ? [x] : [] };
}
