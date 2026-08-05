const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
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

app.whenReady().then(() => {
  registerClassroomIpc();
  registerStorageIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // La sala nunca queda abierta después de cerrar la app
  classroom.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => classroom.stop());
