const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let floatingBar;

function createWindows() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.setTitle('Trexa App11');
  mainWindow.loadURL('http://localhost/primeus/scribelogin/login');

  mainWindow.on('closed', () => {
    if (floatingBar && !floatingBar.isDestroyed()) {
      floatingBar.close();
    }
    mainWindow = null;
    app.quit();
  });

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  floatingBar = new BrowserWindow({
    width: 1300,
    height:300,
    x: 50,
    y: 50,
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
  // floatingBar.webContents.openDevTools();

  floatingBar.on('closed', () => {
    floatingBar = null;
  });

  ipcMain.on('action-from-strip', (event, data) => {
    if (mainWindow) {
      mainWindow.webContents.send('perform-action', data);
    }
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

  ipcMain.on('resize-floating-bar', (event, newHeight) => {
    if (floatingBar && !floatingBar.isDestroyed()) {
      const [width] = floatingBar.getSize();
      floatingBar.setSize(width, newHeight);
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
  });
}

app.whenReady().then(createWindows);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindows();
});
