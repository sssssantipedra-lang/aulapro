/* AulaPro · the launch switch.
   AulaPro is web-only since 29-10-2026: on launch day, fill in `checkout` and redeploy; the buy button then
   opens the app (app/), where the teacher signs in with Google and buys with the email already filled in.
   `play`, `store` and `downloads` are kept only in case the native apps ever come back.
   With `checkout` empty the site stays in "coming soon": buttons say Próximamente, the waitlist shows,
   and the download page invites people to the waitlist instead of offering the installers.
   With `checkout` filled in, every buy button opens the checkout, the waitlist disappears,
   and the "Descargar" link and the download page go live. */
window.AULA_LAUNCH = {
  // Lemon Squeezy checkout link of the AulaPro product: one licence for Windows, Mac and Android
  checkout: 'https://aulapro.lemonsqueezy.com/checkout/buy/b8296834-4f9d-4563-86e3-c798fb243781?enabled=2308832',
  // Google Play listing of the free Android app (it is activated with the licence)
  play: '',
  // Microsoft Store listing of the free Windows app (Microsoft signs it, so Windows shows no warning).
  // Once set, the Windows buttons open the Store instead of the direct installer below.
  store: '',
  // Lemon Squeezy checkout links of the group packs for 5, 10, 20 and 30 teachers: one key for the whole
  // group, 2 devices per teacher (activation limit 10, 20, 40 and 60). An empty pack says "Próximamente".
  packs: { 5: '', 10: '', 20: '', 30: '' },
  // Vídeo corto de una generación real de AulaPro (sección «En directo»). Vacío = la sección no sale.
  // src: ruta de un .mp4 sin sonido, de unos 15 a 20 segundos y 1280x720; poster: una imagen del primer
  // fotograma. Detalle en docs/WEB.md, apartado 4d.
  video: { src: '', poster: '' },
  // Opiniones reales de docentes, con su permiso por escrito (máximo 3). Vacío = la sección no sale.
  // Cada una: { nombre: 'Marta', rol: 'Maestra de Primaria', texto: '…' }. `rol` y `texto` pueden ser
  // una frase o { es: '…', ca: '…', en: '…' }. Detalle en docs/WEB.md, apartado 4d.
  testimonios: [],
  // Installers. The release pipeline uploads every new version here under these same names.
  downloads: {
    windows: 'https://descargas.aulapro.app/AulaPro-instalador-windows.exe',
    // not offered on the site until the Mac app is signed (docs/WEB.md); kept for whoever already uses it
    mac: 'https://descargas.aulapro.app/AulaPro-mac.dmg'
  },
  // {"version":"1.7.1","fecha":"2026-10-01"}, shown on the download page. Leave it empty until the
  // descargas.aulapro.app bucket answers with "Access-Control-Allow-Origin: https://aulapro.app",
  // then set it to 'https://descargas.aulapro.app/version.json'.
  version: ''
};
