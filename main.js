const { app, BrowserWindow, screen, ipcMain, clipboard } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const net = require('net');

let mainWindow;
let floatingBar;
let updateWindow = null;

function createUpdateWindow(info = {}) {
  updateWindow = new BrowserWindow({
    width: 450,
    height: 450,
    frame: false,
    alwaysOnTop: true,
    modal: true,
    resizable: false,
    closable: false,
    movable: true,
    show: false,
    parent: mainWindow,
    webPreferences: {
      preload: path.join(__dirname, 'update-preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  updateWindow.loadFile('update.html');
  updateWindow.once('ready-to-show', () => {
    updateWindow.show();
    updateWindow.webContents.send('update_info', {
      version: info.version || 'Unknown',
      notes: info.releaseNotes || 'No changelog available.',
      date: info.releaseDate || new Date().toISOString()
    });
  });
}

function createWindows(initialAccession = null) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 68,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      sandbox: false,
      contextIsolation: true,
    }
  });

  mainWindow.setTitle('Trexa App');

  const targetURL = initialAccession
    ? `https://trexascribe.medreport360.com/worksheets/scribe/index?ano=${initialAccession}`
    : 'https://trexascribe.medreport360.com/login';

  mainWindow.loadURL(targetURL);

  mainWindow.on('closed', () => {
    if (floatingBar && !floatingBar.isDestroyed()) floatingBar.close();
    mainWindow = null;
    app.quit();
  });

  floatingBar = new BrowserWindow({
    width,
    height: 60,
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

  floatingBar.loadFile('index.html');
  floatingBar.on('closed', () => {
    floatingBar = null;
  });

  ipcMain.on('action-from-strip', (_, data) => {
    mainWindow.webContents.send('perform-action', data);
  });

  ipcMain.on('copy-to-clipboard', (_, text) => {
    clipboard.writeText(text || '');
  });

  ipcMain.on('stripe-copy-request', () => {
    mainWindow.webContents.send('perform-copy-summernote');
  });

  ipcMain.on('resize-floating-bar', (_, newHeight) => {
    if (floatingBar && !floatingBar.isDestroyed()) {
      const [w] = floatingBar.getSize();
      floatingBar.setSize(w, newHeight);
    }
  });

  ipcMain.on('expand-floating-bar', () => animateHeight(300));
  ipcMain.on('collapse-floating-bar', () => animateHeight(60));

  ipcMain.on('selected-templates-from-strip', (_, templates) => {
    mainWindow.webContents.send('templates-selected', templates);
  });

  ipcMain.on('send-to-strip', (_, data) => {
    if (floatingBar && !floatingBar.isDestroyed()) {
      floatingBar.webContents.send('from-main-to-strip', data);
    }
  });

  ipcMain.on('trigger-copy', () => {
    mainWindow.focus();
    mainWindow.webContents.send('trigger-copy');
  });

  ipcMain.handle('restart_app', () => {
    autoUpdater.quitAndInstall();
  });

  // Dummy patient info
  setTimeout(() => {
    if (floatingBar && !floatingBar.isDestroyed()) {
      floatingBar.webContents.send('from-main-to-strip', {
        type: 'updatePatientInfo',
        payload: {
          name: 'John Doe233324',
          age: 34,
          dob: '33453'
        }
      });
    }
  }, 2000);

  mainWindow.webContents.once('did-finish-load', () => {
    console.log('Checking for updates...');
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('Update available');
      if (mainWindow) mainWindow.setEnabled(false);
      if (floatingBar && !floatingBar.isDestroyed()) floatingBar.close();
      createUpdateWindow(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('No updates available:', info);
    });

    autoUpdater.on('error', (err) => {
      console.error('Update error:', err);
    });

    autoUpdater.on('download-progress', (progress) => {
      if (updateWindow && updateWindow.webContents) {
        updateWindow.webContents.send('download_progress', progress);
      }
    });

    autoUpdater.on('update-downloaded', () => {
      if (updateWindow && updateWindow.webContents) {
        updateWindow.webContents.send('update_downloaded');
      }
    });
  });
}

function animateHeight(targetHeight) {
  if (!floatingBar || floatingBar.isDestroyed()) return;
  const { x, y } = floatingBar.getBounds();
  let { width, height } = floatingBar.getBounds();
  const step = targetHeight > height ? 10 : -10;

  const interval = setInterval(() => {
    height += step;
    floatingBar.setBounds({ x, y, width, height });
    if ((step > 0 && height >= targetHeight) || (step < 0 && height <= targetHeight)) {
      floatingBar.setBounds({ x, y, width, height: targetHeight });
      clearInterval(interval);
    }
  }, 10);
}

function startTelnetServer() {
  const server = net.createServer((socket) => {
    console.log(`Telnet client connected: ${socket.remoteAddress}:${socket.remotePort}`);
    socket.write('Welcome to the Trexa Telnet Server\r\n');

    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();
      if (buffer.includes('\n')) {
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        for (let line of lines) {
          const input = line.trim();
          console.log('Received from Telnet:', input);

          if (input.startsWith('OPEN')) {
            const accession = input.split(' ')[1].trim();
            const url = `https://trexascribe.medreport360.com/worksheets/scribe/index?ano=${accession}`;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(url);
            } else {
              createWindows(accession);
            }
            socket.write(`Loading accession ${accession}...\r\n`);
          } else {
            socket.write('Invalid command. Use ACCESSION:<number>\r\n');
          }
        }
      }
    });

    socket.on('end', () => {
      console.log('Telnet client disconnected');
    });

    socket.on('error', (err) => {
      console.error('Telnet socket error:', err);
    });
  });

  server.listen(13689, () => {
    console.log('Telnet server listening on port 13689');
  });
}

app.whenReady().then(() => {
  createWindows();
  startTelnetServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindows();
});
