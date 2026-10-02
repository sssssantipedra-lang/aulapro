/* AulaPro · the launch switch.
   On launch day, fill in `checkout` (and `play` when the Android app is on Google Play) and redeploy.
   With `checkout` empty the site stays in "coming soon": buttons say Próximamente, the waitlist shows,
   and the download page invites people to the waitlist instead of offering the installers.
   With `checkout` filled in, every buy button opens the checkout, the waitlist disappears,
   and the "Descargar" link and the download page go live. */
window.AULA_LAUNCH = {
  // Lemon Squeezy checkout link of the AulaPro product: one licence for Windows, Mac and Android
  checkout: '',
  // Google Play listing of the free Android app (it is activated with the licence)
  play: '',
  // Microsoft Store listing of the free Windows app (Microsoft signs it, so Windows shows no warning).
  // Once set, the Windows buttons open the Store instead of the direct installer below.
  store: '',
  // Lemon Squeezy checkout links of the group packs for 5, 10, 20 and 30 teachers: one key for the whole
  // group, 2 devices per teacher (activation limit 10, 20, 40 and 60). An empty pack says "Próximamente".
  packs: { 5: '', 10: '', 20: '', 30: '' },
  // Installers. The release pipeline uploads every new version here under these same names.
  downloads: {
    windows: 'https://descargas.aulapro.app/AulaPro-instalador-windows.exe',
    mac: 'https://descargas.aulapro.app/AulaPro-mac.dmg'
  },
  // {"version":"1.7.1","fecha":"2026-10-01"}, shown on the download page. Leave it empty until the
  // descargas.aulapro.app bucket answers with "Access-Control-Allow-Origin: https://aulapro.app",
  // then set it to 'https://descargas.aulapro.app/version.json'.
  version: ''
};
