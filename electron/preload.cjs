const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,

  /** Guardado en disco, con una carpeta por perfil de docente. */
  store: {
    listProfiles:  ()             => ipcRenderer.invoke('store:listProfiles'),
    createProfile: p              => ipcRenderer.invoke('store:createProfile', p),
    updateProfile: (id, patch)    => ipcRenderer.invoke('store:updateProfile', id, patch),
    touchProfile:  id             => ipcRenderer.invoke('store:touchProfile', id),
    deleteProfile: id             => ipcRenderer.invoke('store:deleteProfile', id),
    loadData:      id             => ipcRenderer.invoke('store:loadData', id),
    saveData:      (id, data)     => ipcRenderer.invoke('store:saveData', id, data),
    backup:        id             => ipcRenderer.invoke('store:backup', id),
    listBackups:   id             => ipcRenderer.invoke('store:listBackups', id),
    restoreBackup: (id, file)     => ipcRenderer.invoke('store:restoreBackup', id, file),
    clearBackups:  id             => ipcRenderer.invoke('store:clearBackups', id),
    folderInfo:    id             => ipcRenderer.invoke('store:folderInfo', id),
    openFolder:    id             => ipcRenderer.invoke('store:openFolder', id),
  },

  /** Sala de alumnos: servidor local para que se conecten desde el móvil. */
  classroom: {
    start:       opts     => ipcRenderer.invoke('classroom:start', opts),
    stop:        ()       => ipcRenderer.invoke('classroom:stop'),
    state:       ()       => ipcRenderer.invoke('classroom:state'),
    setActivity: activity => ipcRenderer.invoke('classroom:setActivity', activity),
    setRoster:   (roster, label) => ipcRenderer.invoke('classroom:setRoster', roster, label),

    /** Avisa cuando llega una respuesta. Devuelve una función para dejar de escuchar. */
    onUpdate: callback => {
      const handler = (_event, snapshot) => callback(snapshot);
      ipcRenderer.on('classroom:update', handler);
      return () => ipcRenderer.removeListener('classroom:update', handler);
    },
  },
});
