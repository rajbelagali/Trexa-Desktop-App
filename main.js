const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { clipboard } = require('electron');

let mainWindow;
let floatingBar;

function createWindows() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.setTitle('Trexa App');
  mainWindow.loadURL('https://trexascribe.medreport360.com/login');

  mainWindow.on('closed', () => {
    if (floatingBar && !floatingBar.isDestroyed()) {
      floatingBar.close();
    }
    mainWindow = null;
    app.quit();
  });

  floatingBar = new BrowserWindow({
    width: width,
    height: 300,
    x: 10,
    y: 10,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, 'floating-preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  floatingBar.setAlwaysOnTop(true, 'screen-saver');
  floatingBar.loadFile('index.html');

  floatingBar.on('closed', () => {
    floatingBar = null;
  });

  ipcMain.on('action-from-strip', (event, data) => {
    if (mainWindow) {
      mainWindow.webContents.send('perform-action', data);
    }
  });
  ipcMain.on('copy-to-clipboard', (_, text) => {
    clipboard.writeText(text || '');
  });
  ipcMain.on('resize-floating-bar', (event, newHeight) => {
    if (floatingBar && !floatingBar.isDestroyed()) {
      const [width] = floatingBar.getSize();
      floatingBar.setSize(width, newHeight);
    }
  });

  ipcMain.on('selected-templates-from-strip', (event, templates) => {
    if (mainWindow) {
      mainWindow.webContents.send('templates-selected', templates);
    }
  });

  ipcMain.on('send-to-strip', (event, data) => {
    if (floatingBar && !floatingBar.isDestroyed()) {
      floatingBar.webContents.send('from-main-to-strip', data);
    }
  });

  ipcMain.on('trigger-copy', () => {
    if (mainWindow) {
      mainWindow.focus();
      mainWindow.webContents.send('trigger-copy');
    }
  });

  ipcMain.handle('restart_app', () => {
    autoUpdater.quitAndInstall();
  });

  function sendToStrip(data) {
    if (floatingBar && !floatingBar.isDestroyed()) {
      floatingBar.webContents.send('from-main-to-strip', data);
    }
  }

  setTimeout(() => {
    sendToStrip({
      type: 'updatePatientInfo',
      payload: {
        name: 'John Doe233324',
        age: 34,
        dob: '33453'
      }
    });
  }, 2000);

  // 🟢 AutoUpdater: Trigger and log events
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('Checking for updates...');
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info);
      mainWindow.webContents.send('update_available');
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('No updates available:', info);
    });

    autoUpdater.on('error', (err) => {
      console.error('Update error:', err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent.toFixed(2)}%`;
      console.log(logMessage);
      mainWindow.webContents.send('download_progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info);
      mainWindow.webContents.send('update_downloaded');
    });

    // mainWindow.webContents.openDevTools();
  });
}

app.whenReady().then(createWindows);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindows();
});
