const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stripAPI', {
  triggerMainAction: (data) => {
      ipcRenderer.send('action-from-strip', data);
  }
});
contextBridge.exposeInMainWorld('stripeAPI', {
  requestCopy: () => ipcRenderer.send('trigger-copy'),
  onPerformCopy: (callback) => ipcRenderer.on('trigger-copy', (_, data) => callback(data))
});
contextBridge.exposeInMainWorld('floatingAPI', {
  onShortcutX: (callback) => ipcRenderer.on('shortcut-x-pressed', callback),
  onShortcutY: (callback) => ipcRenderer.on('shortcut-y-pressed', callback),
  onShortcutZ: (callback) => ipcRenderer.on('shortcut-z-pressed', callback),
  onShortcutW: (callback) => ipcRenderer.on('shortcut-w-pressed', callback),
  resizeFloatingBar: (height) => ipcRenderer.send('resize-floating-bar', height),
  sendSelectedTemplates: (templates) => ipcRenderer.send('selected-templates-from-strip', templates),
  expand: () => ipcRenderer.send('expand-floating-bar'),
  collapse: () => ipcRenderer.send('collapse-floating-bar')
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
contextBridge.exposeInMainWorld('windowControlAPI', {
  toggleMainWindow: () => ipcRenderer.send('toggle-main-window')
});
contextBridge.exposeInMainWorld('floatingAppControl', {
  closeApp: () => ipcRenderer.send('close-app')
});
