const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('mainAPI', {
  onAction: (callback) => ipcRenderer.on('perform-action', (_, data) => callback(data)),
  onTemplatesSelected: (callback) => ipcRenderer.on('templates-selected', (_, data) => callback(data))
});

contextBridge.exposeInMainWorld('electronAPI', {
  sendToStrip: (data) => ipcRenderer.send('send-to-strip', data),
  sendToStrip1: (data) => ipcRenderer.send('send-to-strip', data),
  sendToStrip2: (data) => ipcRenderer.send('send-to-strip', data),
  onPerformCopy: (callback) => ipcRenderer.on('perform-copy-summernote', () => callback()),
  onTriggerCopy: (callback) => ipcRenderer.on('trigger-copy', () => callback()),
  onUpdateAvailable: (callback) => ipcRenderer.on('update_available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update_downloaded', callback),
  notifyLoginSuccess: () => ipcRenderer.send('login-success'),
  restartApp: () => ipcRenderer.send('restart_app'),
  writeClipboardHtml: (html, plain) => {
    clipboard.write({
      html: html,
      text: plain,
    });
  },

  copyToClipboard: (text) => ipcRenderer.send('copy-to-clipboard', text)
});
