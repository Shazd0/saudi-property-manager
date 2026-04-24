const { app, BrowserWindow, shell, Menu, nativeTheme } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { fork } = require('node:child_process');

let zatcaProcess = null;

function startZatcaService() {
  const servicePath = isDev 
    ? path.join(__dirname, '..', 'fcm-server', 'zatca-service.js') 
    : path.join(process.resourcesPath, 'app', 'fcm-server', 'zatca-service.js'); // Assuming typical packaging
    
  // Simple check, or just try to fork the local one if not packaged in asar
  const targetPath = path.join(__dirname, '..', 'fcm-server', 'zatca-service.js');
  if (fs.existsSync(targetPath)) {
    zatcaProcess = fork(targetPath, [], { stdio: 'pipe' });
  }
}

const isDev = !app.isPackaged;

// Force dark mode to match the app's dark theme
nativeTheme.themeSource = 'dark';

function getIconPath() {
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', 'public', 'images', 'logo-512.png'),
    path.join(__dirname, '..', 'images', 'logo.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function createWindow() {
  const iconPath = getIconPath();

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a1628',
    show: false,          // Hidden until ready-to-show fires (no white flash)
    autoHideMenuBar: true,
    frame: true,
    icon: iconPath,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a1628',
      symbolColor: '#10b981',
      height: 40,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,       // Disabled sandbox so renderer can load local files
      webSecurity: !isDev,  // Relaxed in dev only
      allowRunningInsecureContent: false,
    }
  });

  // Remove default application menu
  Menu.setApplicationMenu(null);

  // Open external links in the system browser, not in Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Show window gracefully once content is loaded — no white flash
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  // Fallback show after 5s in case ready-to-show never fires
  setTimeout(() => {
    if (!win.isVisible()) {
      win.show();
    }
  }, 5000);

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
    win.loadFile(distIndex).catch(err => {
      console.error('Failed to load app:', err);
    });
  }

  // Log renderer errors for easier debugging
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`Load failed [${code}] ${desc} — ${url}`);
  });
}

app.whenReady().then(() => {
  startZatcaService();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (zatcaProcess) {
    zatcaProcess.kill();
  }
});
