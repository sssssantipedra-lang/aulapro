/**
 * Versión web: a qué servidor se piden la licencia y la búsqueda de compras.
 * Primero al mismo sitio desde el que se abrió la app (aulapro.app, en
 * Cloudflare) y, si no responde, al respaldo en Netlify
 * (respaldo.aulapro.app, ver netlify.toml): durante los partidos de LaLiga los
 * operadores españoles bloquean direcciones de Cloudflare. Abierta desde el
 * respaldo, al revés. Solo cambia de servidor si no hay respuesta, nunca por
 * una respuesta de error.
 */
export const RESPALDO = 'https://respaldo.aulapro.app';
export const PRINCIPAL = 'https://aulapro.app';
const ESPERA = 6000;

export function servidores(origen = typeof location !== 'undefined' ? location.origin : PRINCIPAL): string[] {
  if (origen === RESPALDO) return [RESPALDO, PRINCIPAL];
  return [origen, RESPALDO];
}

/** `fetch` de una ruta de la API (`/api/...`) con el paso al otro servidor. Falla solo si no responde ninguno. */
export async function pedirApi(ruta: string, init: RequestInit, opts: { origenes?: string[]; fetcher?: typeof fetch } = {}): Promise<Response> {
  const f = opts.fetcher ?? fetch;
  let ultimo: unknown = new Error('sin-conexion');
  for (const base of opts.origenes ?? servidores()) {
    const control = new AbortController();
    const t = setTimeout(() => control.abort(), ESPERA);
    try {
      return await f(`${base}${ruta}`, { ...init, signal: control.signal });
    } catch (err) {
      ultimo = err;
    } finally {
      clearTimeout(t);
    }
  }
  throw ultimo;
}
