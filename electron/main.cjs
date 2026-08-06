const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fsp = require('fs/promises');
const os = require('os');
const { ClassroomServer } = require('./classroom.cjs');
const { Storage } = require('./storage.cjs');

let mainWindow = null;
const classroom = new ClassroomServer();
const storage = new Storage(app.getPath('userData'));

function registerStorageIpc() {
  ipcMain.handle('store:listProfiles',  () => storage.listProfiles());
  ipcMain.handle('store:createProfile', (_e, p) => storage.createProfile(p || {}));
  ipcMain.handle('store:updateProfile', (_e, id, patch) => storage.updateProfile(id, patch));
  ipcMain.handle('store:touchProfile',  (_e, id) => storage.touchProfile(id));
  ipcMain.handle('store:deleteProfile', (_e, id) => storage.deleteProfile(id));
  ipcMain.handle('store:loadData',      (_e, id) => storage.loadData(id));
  ipcMain.handle('store:saveData',      (_e, id, data) => storage.saveData(id, data));
  ipcMain.handle('store:backup',        (_e, id) => storage.backup(id));
  ipcMain.handle('store:listBackups',   (_e, id) => storage.listBackups(id));
  ipcMain.handle('store:restoreBackup', (_e, id, file) => storage.restoreBackup(id, file));
  ipcMain.handle('store:clearBackups',  (_e, id) => storage.clearBackups(id));
  ipcMain.handle('store:folderInfo',    (_e, id) => storage.folderInfo(id));
  ipcMain.handle('store:openFolder', async (_e, id) => {
    const info = await storage.folderInfo(id);
    shell.openPath(info.path);
    return info.path;
  });
}

// Cada respuesta que llega de un móvil se envía a la interfaz del docente
classroom.onChange = snapshot => {
  mainWindow?.webContents.send('classroom:update', snapshot);
};

/**
 * Documentos imprimibles (las actas).
 *
 * El documento se abre en una ventana oculta que contiene SOLO el acta, sin
 * la aplicación alrededor. Eso permite dos cosas que desde la propia interfaz
 * no se podían: guardar el PDF sin pasar por el diálogo de impresora, y que
 * la vista previa de impresión deje de salir en blanco (salía así porque el
 * truco de ocultar el resto de la página con `visibility` confunde al
 * renderizador de la previsualización).
 */
async function withDocumentWindow(html, fn) {
  // Archivo temporal en vez de data: URL: no depende del límite de longitud
  // y un acta de treinta alumnos puede ocupar bastante.
  const file = path.join(os.tmpdir(), `aulapro-doc-${Date.now()}.html`);
  await fsp.writeFile(file, html, 'utf8');

  const win = new BrowserWindow({
    show: false,
    webPreferences: { javascript: false, sandbox: true },
  });
  try {
    await win.loadFile(file);
    return await fn(win);
  } finally {
    if (!win.isDestroyed()) win.destroy();
    fsp.unlink(file).catch(() => { /* da igual si ya no está */ });
  }
}

function registerDocumentIpc() {
  ipcMain.handle('docs:savePdf', async (_e, { html, suggestedName }) => {
    try {
      return await withDocumentWindow(html, async win => {
        // Horizontal: el acta lleva una columna por categoría y en vertical se
        // queda estrecha en cuanto hay tres o cuatro.
        const pdf = await win.webContents.printToPDF({
          pageSize: 'A4',
          landscape: true,
          printBackground: true,
          margins: { top: 0.5, bottom: 0.5, left: 0.55, right: 0.55 },
        });

        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
          title: 'Guardar acta en PDF',
          defaultPath: suggestedName || 'acta.pdf',
          filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
        });
        if (canceled || !filePath) return { canceled: true };

        await fsp.writeFile(filePath, pdf);
        return { ok: true, path: filePath };
      });
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('docs:print', async (_e, { html }) => {
    try {
      return await withDocumentWindow(html, win => new Promise(resolve => {
        win.webContents.print({ printBackground: true, landscape: true }, (success, reason) => {
          // `reason` es 'cancelled' si el docente cierra el diálogo
          resolve(success ? { ok: true } : { canceled: reason === 'cancelled', reason });
        });
      }));
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('docs:reveal', (_e, filePath) => {
    if (filePath) shell.showItemInFolder(filePath);
  });
}

function registerClassroomIpc() {
  ipcMain.handle('classroom:start', async (_e, opts) => {
    try {
      return await classroom.start(opts || {});
    } catch (err) {
      return { error: err.message, ...classroom.snapshot() };
    }
  });
  ipcMain.handle('classroom:stop', () => classroom.stop());
  ipcMain.handle('classroom:state', () => classroom.snapshot());
  ipcMain.handle('classroom:setActivity', (_e, activity) => classroom.setActivity(activity));
  ipcMain.handle('classroom:setRoster', (_e, roster, label) => classroom.setRoster(roster, label));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 830,
    minWidth: 1024,
    minHeight: 700,
    title: 'AulaPro - Gestión Escolar de Escritorio',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    autoHideMenuBar: true
  });

  // Ocultar la barra de menú por defecto para un aspecto moderno
  Menu.setApplicationMenu(null);

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Una sola copia abierta a la vez.
 *
 * Sin esto, dos ventanas de Aula Pro cargan el mismo perfil y las dos guardan
 * `datos.json` cada 700 ms: la última en escribir se lleva por delante el
 * trabajo de la otra, en silencio y con las notas dentro. Es fácil que pase
 * sin querer, con un doble clic de más en el acceso directo.
 */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Si intentan abrirla de nuevo, traemos al frente la ventana que ya existe.
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    registerClassroomIpc();
    registerStorageIpc();
    registerDocumentIpc();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  // La sala nunca queda abierta después de cerrar la app
  classroom.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => classroom.stop());
