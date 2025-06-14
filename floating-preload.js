const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stripAPI', {
  triggerMainAction: (data) => {
      ipcRenderer.send('action-from-strip', data);
  }
});
contextBridge.exposeInMainWorld('floatingAPI', {
  resizeFloatingBar: (height) => ipcRenderer.send('resize-floating-bar', height),
  sendSelectedTemplates: (templates) => ipcRenderer.send('selected-templates-from-strip', templates)
});
contextBridge.exposeInMainWorld('stripMainAPI', {
  onMainMessage: (callback) => {
    ipcRenderer.on('from-main-to-strip', (event, data) => callback(data));
  }
});
contextBridge.exposeInMainWorld('stripSubmitAPI', {
  onMainMessage: (callback) => ipcRenderer.on('from-main-to-strip', (_, data) => callback(data))
});
contextBridge.exposeInMainWorld('stripResponceAPI', {
  onMainMessage: (callback) => ipcRenderer.on('from-main-to-strip', (_, data) => callback(data))
});
contextBridge.exposeInMainWorld('RIS_AVL', {
  onMainMessage: (callback) => ipcRenderer.on('from-main-to-strip', (_, data) => callback(data))
});
