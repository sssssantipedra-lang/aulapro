// Los orígenes desde los que corre la versión web de AulaPro (los mismos de VUELTAS en
// api/google/_comun.js y de connect-src en el Content-Security-Policy): las funciones de la licencia
// dejan de aceptar peticiones del navegador desde cualquier otro sitio. No es una defensa contra quien
// llama directamente con curl o Postman (eso no lo evita CORS, lo evita el límite de peticiones de
// _limite.js), pero cierra la puerta a que una web ajena use el navegador de una víctima para llamar
// a estas funciones sin que ella se entere.
export const ORIGENES = new Set([
  'https://aulapro.app',
  'https://www.aulapro.app',
  'https://aulapro-app.pages.dev',
  'https://prueba.aulapro-app.pages.dev',
  'https://aulapro-respaldo.netlify.app',
  'http://localhost:5173',
]);

/** Las cabeceras CORS para la petición: el origen, si se reconoce, y nada si no (el navegador la bloquea). */
export function corsPara(origen, metodos = 'POST, OPTIONS') {
  const base = { 'Access-Control-Allow-Methods': metodos, 'Access-Control-Allow-Headers': 'Content-Type, Accept', Vary: 'Origin' };
  return origen && ORIGENES.has(origen) ? { ...base, 'Access-Control-Allow-Origin': origen } : base;
}
