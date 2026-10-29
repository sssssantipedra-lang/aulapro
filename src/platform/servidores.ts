/**
 * Versión web: a qué servidor se piden la licencia y la búsqueda de compras.
 * Primero al mismo sitio desde el que se abrió la app (aulapro.app, en Netlify
 * desde el 29-10-2026, fuera de los bloqueos de LaLiga a Cloudflare: ver
 * netlify.toml) y, si no responde, a la copia de Cloudflare Pages
 * (aulapro-app.pages.dev). Abierta desde la copia, al revés. Solo cambia de
 * servidor si no hay respuesta, nunca por una respuesta de error.
 */
export const RESPALDO = 'https://aulapro-app.pages.dev';
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
