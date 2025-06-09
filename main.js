const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let floatingBar;

function createWindows() {
  // Create the main window
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.setTitle('Trexa App');
  mainWindow.loadURL('http://localhost/primeus/scribe/index');

  mainWindow.on('closed', () => {
    if (floatingBar && !floatingBar.isDestroyed()) {
      floatingBar.close();
    }
    mainWindow = null;
    app.quit();
  });

  // Create the floating bar window
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const barX = 50;
  const barY = 50;

  floatingBar = new BrowserWindow({
    width: 1300,
    height: 300,
    x: barX,
    y: barY,
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

  // Handle messages from the floating strip
  ipcMain.on('action-from-strip', (event, data) => {
    if (mainWindow) {
      mainWindow.webContents.send('perform-action', data);
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
      mainWindow.focus(); // Ensure main window is focused
      mainWindow.webContents.send('trigger-copy');
    }
  });

  ipcMain.handle('restart_app', () => {
    autoUpdater.quitAndInstall();
  });
  

  // Utility: Send structured messages to floating bar
  function sendToStrip(data) {
    if (floatingBar && !floatingBar.isDestroyed()) {
      floatingBar.webContents.send('from-main-to-strip', data);
    }
  }

  // Simulated data update
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

  // Auto-updater integration
  mainWindow.webContents.once('did-finish-load', () => {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
      mainWindow.webContents.send('update_available');
    });

    autoUpdater.on('update-downloaded', () => {
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
