/**
 * `electron-updater` es una dependencia de producción normal (viene en el
 * instalador de verdad, generado por electron-builder), pero cualquier copia
 * empaquetada a mano sin su propio `node_modules` —por ejemplo, una carpeta
 * reubicada manualmente para probar cambios sin pasar por el instalador— no
 * la tiene. Antes esto tumbaba TODA la aplicación al arrancar con un error
 * de JavaScript ("Cannot find module 'electron-updater'"), que es justo lo
 * que este archivo dice evitar más abajo para cualquier otro fallo: si no
 * está disponible, la app sigue funcionando igual, solo sin comprobar
 * actualizaciones.
 */
const path = require('path');
const { Notification } = require('electron');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch { /* no instalado en este empaquetado; ver comentario arriba */ }

/* ── Textos del aviso del sistema ──────────────────────────────────────────
 *
 * El proceso principal no puede leer el diccionario de `src/i18n`: vive en el
 * navegador y se compila aparte. Son cuatro frases, así que se repiten aquí
 * en vez de montar un puente para traer el diccionario entero. El idioma lo
 * dice la interfaz al arrancar (`setLanguage`, por IPC).
 */
const TEXTS = {
  es: {
    availableTitle: 'Hay una versión nueva de Aula Pro',
    availableBody: v => `La ${v} se está descargando en segundo plano. Te avisamos cuando esté lista.`,
    readyTitle: v => `Aula Pro ${v} lista para instalar`,
    readyBody: 'Abre Aula Pro y pulsa «Reiniciar y actualizar», o simplemente ciérrala: se instalará sola.',
  },
  en: {
    availableTitle: 'A new version of Aula Pro is available',
    availableBody: v => `Version ${v} is downloading in the background. We'll let you know when it's ready.`,
    readyTitle: v => `Aula Pro ${v} is ready to install`,
    readyBody: 'Open Aula Pro and click “Restart and update”, or just close it: it will install on its own.',
  },
};

/**
 * Idioma de los avisos. Arranca en castellano —el idioma por defecto de la
 * aplicación— y la interfaz lo corrige nada más cargar. En la práctica llega
 * mucho antes que la comprobación de actualizaciones, que espera 3 s.
 */
let lang = 'es';
function setLanguage(next) {
  if (next === 'es' || next === 'en') lang = next;
}

/** Avisos aún en pantalla, para que no se los lleve el recolector de basura. */
const vivos = new Set();
/** Cuánto se sostiene un aviso como mucho, si nunca llega su «close». */
const RELEASE_MS = 5 * 60 * 1000;

/**
 * Lanza un aviso del sistema (el globo de Windows), no un cartel dentro de la
 * aplicación: el docente casi nunca está mirando Aula Pro cuando arranca —está
 * abriendo el ordenador en clase— y el aviso de la interfaz se lo perdía.
 *
 * Nunca es crítico: si el sistema tiene las notificaciones desactivadas, o la
 * copia es portable (Windows solo las muestra con un acceso directo instalado,
 * ver el aviso del final), la aplicación sigue funcionando igual y el cartel
 * de la interfaz continúa apareciendo.
 */
function notify({ title, body, silent, onClick }) {
  try {
    if (!Notification.isSupported()) return;
    const n = new Notification({
      title,
      body,
      silent: !!silent,
      icon: path.join(__dirname, 'icon.ico'),
    });

    // Guardar la referencia NO es opcional: `show()` vuelve enseguida y, si
    // nadie sostiene el objeto, el recolector de basura puede llevárselo antes
    // de que Windows llegue a pintar el globo, que entonces no sale y no da
    // ningún error. Pasó en las pruebas justo con este primer aviso.
    vivos.add(n);
    const soltar = () => vivos.delete(n);
    n.on('close', soltar);
    n.on('failed', soltar);
    n.on('click', () => { soltar(); onClick?.(); });
    // Red de seguridad: en Windows «close» no siempre llega (si el aviso pasa
    // al centro de notificaciones, puede no cerrarse nunca).
    setTimeout(soltar, RELEASE_MS);

    n.show();
  } catch { /* un aviso que no sale no puede romper la actualización */ }
}

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
 * release de GitHub (según el `publish` de package.json) y, si la hay, avisa
 * con una notificación del sistema y la descarga sola en segundo plano. No
 * instala nada sin que el docente lo pida: se queda esperando a que pulse
 * «Reiniciar y actualizar» en el aviso de la interfaz, o a que cierre la
 * aplicación (`autoInstallOnAppQuit`).
 *
 * Probado de verdad contra el release público de GitHub (no solo revisado
 * el código): una copia empaquetada con un número de versión inferior
 * detectó la 1.0.5, la descargó y llegó a `update-downloaded`.
 *
 * IMPORTANTE para que los avisos salgan en Windows: hace falta que
 * `app.setAppUserModelId()` coincida con el `appId` del instalador (se hace
 * en main.cjs). Sin eso, Windows no sabe de qué aplicación viene el globo y
 * lo descarta en silencio. En la versión *portable* pueden no aparecer nunca,
 * porque Windows los ata al acceso directo del menú Inicio que crea el
 * instalador; el cartel de dentro de la aplicación sigue funcionando igual.
 */
function setup(app, { onStatus, onActivate } = {}) {
  if (!autoUpdater) return;
  if (process.platform !== 'win32') return;
  // Sin `app-update.yml` (solo existe en la app empaquetada) esto fallaría
  // sin aportar nada; en desarrollo simplemente no se comprueba.
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = status => onStatus?.(status);
  const T = () => TEXTS[lang];

  autoUpdater.on('update-available', info => {
    send({ state: 'downloading', version: info.version });
    notify({
      title: T().availableTitle,
      body: T().availableBody(info.version),
      // Sin sonido: es informativo y llega mientras el docente está abriendo
      // la clase. El que sí suena es el de «ya puedes actualizar», que es el
      // que le pide hacer algo.
      silent: true,
      onClick: onActivate,
    });
  });

  autoUpdater.on('update-downloaded', info => {
    send({ state: 'ready', version: info.version });
    notify({
      title: T().readyTitle(info.version),
      body: T().readyBody,
      onClick: onActivate,
    });
  });

  // Un fallo al comprobar o descargar no se le cuenta al docente con un globo
  // del sistema: no puede hacer nada al respecto y no ha pedido nada. Se
  // queda en el estado que consume la interfaz, que tampoco lo muestra.
  autoUpdater.on('error', err => send({ state: 'error', message: err?.message || String(err) }));

  // Si falla (sin internet, GitHub caído, repo inaccesible…) la app sigue
  // funcionando exactamente igual, solo que sin avisar de una versión nueva.
  autoUpdater.checkForUpdates().catch(() => { /* no pasa nada, se reintenta en el próximo arranque */ });
}

function installNow() {
  autoUpdater?.quitAndInstall();
}

module.exports = { setup, installNow, setLanguage };
