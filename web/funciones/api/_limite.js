// Límite de peticiones por IP o por clave de licencia, en Cloudflare KV. No evita que alguien con
// Ed25519 y paciencia se salte la licencia en su propio navegador (eso no tiene arreglo en el
// servidor: ver docs/APP_WEB.md, «Qué protege y qué no la licencia firmada»); evita dos abusos
// concretos de estas funciones: agotar a propósito el cupo de dispositivos de una clave ajena
// llamando a «activate» muchas veces, y aporrear la cuota de Lemon Squeezy o Google llamando a
// «cuenta» o «activate» sin parar.
//
// Hace falta un espacio de nombres KV enlazado como `LIMITE` (en el proyecto de Cloudflare Pages:
// Settings → Functions → KV namespace bindings → LIMITE). Sin él, `dentroDelLimite` no bloquea nada
// (mejor no limitar que tumbar la licencia de todo el mundo por un enlace olvidado).

/**
 * Las cifras (por ventana de 10 minutos). Son generosas a propósito: un colegio entero comparte la misma
 * dirección de internet, y un claustro de 30 docentes puede entrar a la vez en una jornada de formación
 * (cada entrada son 2 o 3 llamadas) o activar la misma clave de un pack. Frenan a un programa que llama sin
 * parar, no a un centro. OJO: no impiden agotar el cupo de dispositivos de una clave filtrada (bastan 2
 * llamadas); eso solo lo arregla quien administra la clave en Lemon Squeezy.
 */
export const LIMITES = { ventana: 600, clave: 60, ip: 150, microsoft: 250 };

/**
 * La huella de un identificador (IP o clave de licencia): el contador no guarda ni la IP ni la clave en claro
 * (30-10-2026; antes, el nombre de cada contador las llevaba escritas). Sigue siendo un dato personal, sin
 * secreto: la privacidad lo describe como contador temporal.
 */
export async function huella(texto) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
  return [...h.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** De una lista de contadores (`huella:ventana`), los de ventanas ya pasadas: hay que borrarlos. */
export const caducados = (claves, ventanaActual) => claves.filter(k => Number(k.slice(k.lastIndexOf(':') + 1)) < ventanaActual - 1);

export async function dentroDelLimite(kv, clave, maximo, ventanaSeg) {
  if (!kv) return true;
  const ventana = Math.floor(Date.now() / 1000 / ventanaSeg);
  const k = `${await huella(clave)}:${ventana}`;
  const actual = Number((await kv.get(k).catch(() => null)) ?? '0');
  if (actual >= maximo) return false;
  await kv.put(k, String(actual + 1), { expirationTtl: ventanaSeg * 2 }).catch(() => {});
  return true;
}

/** La respuesta cuando se supera el límite: 429, sin más detalle del motivo. */
export const respuestaLimite = headers => new Response(JSON.stringify({ error: 'limite' }), {
  status: 429, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
