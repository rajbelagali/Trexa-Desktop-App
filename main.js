const { app, BrowserWindow, screen, ipcMain, clipboard, globalShortcut} = require('electron');
const { machineIdSync } = require('node-machine-id');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const net = require('net');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');
let isSyncing = false; 

// Fix potential network issues
app.commandLine.appendSwitch('disable-http2'); // WebSocket/HTTP2 conflicts
app.commandLine.appendSwitch('disable-quic');  // Disable QUIC protocol
app.commandLine.appendSwitch('ignore-certificate-errors'); // If certs are an issue
app.commandLine.appendSwitch('ssl-version-fallback-min', 'tls1.2'); // Enforce TLS 1.2+

// Optional: Force socket buffer size (can help with unstable or fragmented data)
app.commandLine.appendSwitch('socket-buffer-size', '65536');

ipcMain.handle('get-auto-key', async () => {
  const machineId = machineIdSync();
  const res = await fetch('https://trexascribe.medreport360.com/keylicence.php?action=generate', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer 78sdfjhgfd9808sdfl-kjdasd32445bkj35',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ machine_id: machineId })
  });

  const text = await res.text();
  // console.log('Raw response:', text);

  let data = {};
  try {
    data = JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse JSON:', err);
    return { error: 'Invalid JSON response from server' };
  }

  return { productKey: data.product_key, machineId };
});
ipcMain.handle('validate-product-key', async (_, { productKey }) => {
  const machineId = machineIdSync();
  try {
    const res = await fetch('https://trexascribe.medreport360.com/keylicence.php?action=validate', {
      method: 'POST',
      headers: {
        "Authorization": `Bearer 78sdfjhgfd9808sdfl-kjdasd32445bkj35`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `product_key=${encodeURIComponent(productKey)}&machine_id=${encodeURIComponent(machineId)}`
    });

    const text = await res.text();
    // console.log("Raw response:", text); // helpful for debugging

    const result = JSON.parse(text);
    if (result.valid) {
      const data = { activated: true, expiry: result.expiry_date };
      fs.writeFileSync(path.join(app.getPath('userData'), 'activation.json'), JSON.stringify(data));
      return true;
    }

    return false;

  } catch (error) {
    console.error("Validation error:", error);
    return false;
  }
});

let mainWindow;
let floatingBar;
let updateWindow = null;

function createUpdateWindow(info = {}) {
  updateWindow = new BrowserWindow({
    width: 450,
    height: 500,
    frame: false,
    transparent: true,
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

function checkLocalLicense() {
  const licensePath = path.join(app.getPath('userData'), 'activation.json');
  if (fs.existsSync(licensePath)) {
    const data = JSON.parse(fs.readFileSync(licensePath));
    if (new Date(data.expiry) > new Date()) {
      return true;
    }
  }
  return false;
}
ipcMain.handle('isLicenseExpired', () => {
  const licensePath = path.join(app.getPath('userData'), 'activation.json');
  if (fs.existsSync(licensePath)) {
    const data = JSON.parse(fs.readFileSync(licensePath));
    return new Date(data.expiry) < new Date();
  }
  return false;
});
ipcMain.on('open-login-page', () => {
  // console.log('➡️ open-login-page received');

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL('https://trexascribe.medreport360.com/login');
    return;
  }

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
    mainWindow = null;
  });

  // Close all other windows (like activation)
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (win !== mainWindow) {
      win.close();
    }
  }
});

function createWindows(initialAccession = null) {
  const licensePath = path.join(app.getPath('userData'), 'activation.json');
  if (!fs.existsSync(licensePath)) {
    // Show product key entry UI if activation file is missing
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const activationWindow = new BrowserWindow({
      width,
      height,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true
      }
    });
    activationWindow.loadFile('activation.html');
    // activationWindow.webContents.openDevTools();
    return;
  }
  const data = JSON.parse(fs.readFileSync(licensePath));
  if (new Date(data.expiry) < new Date()) {
    // License expired, show activation UI again
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const activationWindow = new BrowserWindow({
      width,
      height,
      frame:true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true
      }
    });
    activationWindow.loadFile('activation.html');
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
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
    height: 38,
    x: 10,
    y: 10,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    roundedCorners: true,
    show: false,
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

  function checkExpiryWarning(mainWindow) {
    try {
      const file = fs.readFileSync(path.join(app.getPath('userData'), 'activation.json'));
      const { expiry } = JSON.parse(file);
      const daysLeft = (new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24);
      console.log('expiry is checking');
      console.log(daysLeft);
      if (daysLeft <= 0) {
        mainWindow.webContents.send('license-expired');
      } else if (daysLeft < 7) {
        mainWindow.webContents.send('license-expiry-warning', Math.ceil(daysLeft));
      }
    } catch {}
  }

  ipcMain.on('trigger-copy', () => {
    mainWindow.focus();
    mainWindow.webContents.send('trigger-copy');
  });
  ipcMain.on('close-app', () => {
    app.quit();
  });
  ipcMain.handle('restart_app', () => {
    autoUpdater.quitAndInstall();
  });
  let isMainWindowMaximized = false;

  // ipcMain.on('toggle-main-window', () => {
  //   if (!mainWindow || mainWindow.isDestroyed()) return;
  
  //   if (mainWindow.isMinimized()) {
  //     mainWindow.restore();
  //     mainWindow.focus();
  //     isMainWindowMaximized = true;
  //     mainWindow.maximize();
  //     syncFloatingBarToMain();
  //   } else if (mainWindow.isMaximized() || isMainWindowMaximized) {
  //     mainWindow.unmaximize();  // Restore to normal size instead of minimizing
  //     isMainWindowMaximized = false;
  //     // syncFloatingBarToMain();
  //   } else {
  //     mainWindow.maximize();
  //     isMainWindowMaximized = true;
  //     syncFloatingBarToMain();
  //   }
  // });
  
  ipcMain.on('toggle-main-window', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
      mainWindow.focus();
      isMainWindowMaximized = true;
      mainWindow.maximize();
      return;
    }

    if (isMainWindowMaximized) {
      mainWindow.minimize();
      isMainWindowMaximized = false;
    } else {
      mainWindow.maximize();
      isMainWindowMaximized = true;
    }
  });
  ipcMain.on('login-success', () => {
    if (mainWindow) {
      console.log('Login success - disabling main window input');
      mainWindow.setIgnoreMouseEvents(true);
      mainWindow.minimize();
    }

    if (floatingBar && !floatingBar.isDestroyed()) {
      floatingBar.show();
    }
  });

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
  mainWindow.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
  );
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('Checking for updates...');
    checkExpiryWarning(mainWindow);
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
 // Listen for move events
  mainWindow.on('move', () => {
    if (isSyncing) return;
    syncFloatingBarToMain();
  });

  floatingBar.on('move', () => {
    if (isSyncing) return;
    syncMainToFloatingBar();
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
  if (checkLocalLicense()) {
    createWindows();
    startTelnetServer();
  } else {
    // Show activation screen instead or prompt to enter key
    // Optionally: createActivationWindow();
    createWindows();
  }

  globalShortcut.register('Control+Alt+Shift+X', () => {
    if (floatingBar && !floatingBar.isDestroyed()) {
      floatingBar.webContents.send('shortcut-x-pressed');
    }
  });
  globalShortcut.register('Control+Alt+Shift+Y', () => {
    if (floatingBar && !floatingBar.isDestroyed()) {
      floatingBar.webContents.send('shortcut-y-pressed');
    }
  });
  globalShortcut.register('Control+Alt+Shift+Z', () => {
    if (floatingBar && !floatingBar.isDestroyed()) {
      floatingBar.webContents.send('shortcut-z-pressed');
    }
  });
  globalShortcut.register('Control+Alt+Shift+W', () => {
    if (floatingBar && !floatingBar.isDestroyed()) {
      floatingBar.webContents.send('shortcut-w-pressed');
    }
  });
});
function syncFloatingBarToMain() {
  if (!mainWindow || !floatingBar || floatingBar.isDestroyed()) return;

  const [mainX, mainY] = mainWindow.getPosition();
  const [mainW, mainH] = mainWindow.getSize();
  const [floatW, floatH] = floatingBar.getSize();
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // Place floating bar just below mainWindow
  const newX = mainX + (mainW - floatW) / 2;
  const newY = mainY + mainH + 10;

  isSyncing = true;
  floatingBar.setBounds({
    x: 10,
    y: 10,
    width: width,
    height: 38
  });
  isSyncing = false;
}

function syncMainToFloatingBar() {
  if (!mainWindow || !floatingBar || mainWindow.isDestroyed()) return;

  const [floatX, floatY] = floatingBar.getPosition();
  const [mainW, mainH] = mainWindow.getSize();
  const [floatW, floatH] = floatingBar.getSize();

  // Move main window just above floating bar
  const newX = floatX - (mainW - floatW) / 2;
  const newY = floatY - mainH - 10;

  isSyncing = true;
  mainWindow.setBounds({
    x: Math.round(newX),
    y: Math.round(newY),
    width: mainW,
    height: mainH
  });
  isSyncing = false;
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
app.on('activate', () => {
  if (mainWindow === null) createWindows();
});
