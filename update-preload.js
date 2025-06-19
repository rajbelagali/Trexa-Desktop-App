const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('updateAPI', {
    onProgress: (cb) => ipcRenderer.on('download_progress', (_, data) => cb(data)),
    onDownloaded: (cb) => ipcRenderer.on('update_downloaded', cb),
    restartApp: () => ipcRenderer.invoke('restart_app')
});
