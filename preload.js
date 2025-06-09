const { contextBridge, ipcRenderer, clipboard } = require('electron');


contextBridge.exposeInMainWorld('mainAPI', {
  onAction: (callback) => ipcRenderer.on('perform-action', (_, data) => callback(data)),
  onTemplatesSelected: (callback) => ipcRenderer.on('templates-selected', (_, data) => callback(data))
});

contextBridge.exposeInMainWorld('electronAPI', {
  sendToStrip: (data) => ipcRenderer.send('send-to-strip', data),
  sendToStrip1: (data) => ipcRenderer.send('send-to-strip', data),
  sendToStrip2: (data) => ipcRenderer.send('send-to-strip', data),
  onUpdateAvailable: (callback) => ipcRenderer.on('update_available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update_downloaded', callback),
  restartApp: () => ipcRenderer.invoke('restart_app'), // ✅ Now properly placed
  copyToClipboard: (text) => clipboard.writeText(text)
  
});
