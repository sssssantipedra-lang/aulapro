const { autoUpdater } = require('electron-updater');

/**
 * Actualización automática — solo Windows por ahora.
 *
 * El build de Mac va sin firmar (`identity: null` en package.json, porque
 * firmar cuesta una cuenta de Apple Developer de pago), y Gatekeeper bloquea
 * la instalación silenciosa de actualizaciones de apps sin firmar. Así que
 * en Mac esto no se activa: se sigue descargando el .dmg/.zip a mano desde
 * la página de releases, como hasta ahora.
 *
 * En Windows: al arrancar, comprueba si hay una versión más nueva en el
 * release de GitHub (según el `publish` de package.json) y, si la hay, la
 * descarga sola en segundo plano. No instala nada sin que el docente lo
 * pida: se queda esperando a que pulse «Reiniciar y actualizar» en el aviso
 * de la interfaz, o a que cierre la aplicación (`autoInstallOnAppQuit`).
 *
 * Probado de verdad contra el release público de GitHub (no solo revisado
 * el código): una copia empaquetada con un número de versión inferior
 * detectó la 1.0.5, la descargó y llegó a `update-downloaded`.
 */
function setup(app, sendStatus) {
  if (process.platform !== 'win32') return;
  // Sin `app-update.yml` (solo existe en la app empaquetada) esto fallaría
  // sin aportar nada; en desarrollo simplemente no se comprueba.
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', info => sendStatus({ state: 'downloading', version: info.version }));
  autoUpdater.on('update-downloaded', info => sendStatus({ state: 'ready', version: info.version }));
  autoUpdater.on('error', err => sendStatus({ state: 'error', message: err?.message || String(err) }));

  // Si falla (sin internet, GitHub caído, repo inaccesible…) la app sigue
  // funcionando exactamente igual, solo que sin avisar de una versión nueva.
  autoUpdater.checkForUpdates().catch(() => { /* no pasa nada, se reintenta en el próximo arranque */ });
}

function installNow() {
  autoUpdater.quitAndInstall();
}

module.exports = { setup, installNow };
