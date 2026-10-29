// Licencia de la versión web (aulapro.app/app/): una función de Cloudflare Pages que pasa a
// Lemon Squeezy la activación, la comprobación o la desactivación de una clave. Hace falta porque
// el navegador no puede llamar a la tienda directamente desde aulapro.app (CORS); la app de
// escritorio y la de Android sí, y por eso no pasan por aquí.
//
// Solo viajan la clave, el nombre genérico del dispositivo («AulaPro · Navegador») y el número de
// activación: nada del trabajo del docente. No se guarda ni se registra nada. Ver src/platform/web.ts.
//
// Cloudflare busca las funciones en una carpeta `functions/` junto a donde se publica: el workflow
// copia esta carpeta ahí antes de publicar (ver .github/workflows/web.yml).
const ACCIONES = new Set(['activate', 'validate', 'deactivate']);
const CAMPOS = ['license_key', 'instance_name', 'instance_id'];

export async function onRequestPost({ request, params }) {
  if (!ACCIONES.has(params.accion)) return new Response('Not found', { status: 404 });
  const entrada = new URLSearchParams(await request.text());
  const salida = new URLSearchParams();
  for (const c of CAMPOS) {
    const v = entrada.get(c);
    if (v) salida.set(c, v.slice(0, 200));
  }
  const res = await fetch(`https://api.lemonsqueezy.com/v1/licenses/${params.accion}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: salida,
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
