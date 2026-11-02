// Lo que /app/assets/ entrega sin sesión (ver api/_puerta.js). Este archivo es un marcador: al publicar,
// web/app/publico.mjs lo sustituye por la lista que saca la compilación (dist-web/publico.json).
// Con `null` la puerta deja pasar todo (así funciona `npm run dev` y nada se rompe si falta la lista).
export default null;
