const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('updateAPI', {
    onProgress: (cb) => ipcRenderer.on('download_progress', (_, data) => cb(data)),
    onDownloaded: (cb) => ipcRenderer.on('update_downloaded', cb),
    onInfo: (cb) => ipcRenderer.on('update_info', (_, data) => cb(data)),
    restartApp: () => ipcRenderer.invoke('restart_app')
});
