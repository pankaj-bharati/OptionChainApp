/**
 * Electron main process — NSE Option Chain Windows App
 *
 * Responsibilities:
 *  1. Spawn the Express server (server/server.js) as a child process
 *  2. Wait for the server to be ready (polls /health)
 *  3. Open a BrowserWindow loading the built React app (client/dist/index.html)
 *  4. Handle app lifecycle: single-instance lock, tray icon, clean shutdown
 */

const { app, BrowserWindow, Menu, Tray, shell, dialog, nativeImage } = require('electron');
const path   = require('path');
const { spawn }  = require('child_process');
const http   = require('http');
const fs     = require('fs');

// ── Constants ─────────────────────────────────────────────────────────────────
const SERVER_PORT   = 3000;
const SERVER_URL    = `http://localhost:${SERVER_PORT}`;
const HEALTH_URL    = `${SERVER_URL}/health`;
const CLIENT_DIST   = path.join(__dirname, '..', 'client', 'dist', 'index.html');
const SERVER_ENTRY  = path.join(__dirname, '..', 'server', 'server.js');
const ICON_PATH     = path.join(__dirname, '..', 'client', 'public', 'icons', 'favicon-32x32.png');
const POLL_INTERVAL = 500;   // ms between health checks
const POLL_TIMEOUT  = 30000; // ms before giving up

// ── Single-instance lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// ── State ─────────────────────────────────────────────────────────────────────
let mainWindow  = null;
let tray        = null;
let serverProc  = null;
let isQuitting  = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Poll /health until the server responds or timeout is reached */
function waitForServer(timeout = POLL_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      http.get(HEALTH_URL, res => {
        if (res.statusCode === 200) return resolve();
        retry();
      }).on('error', retry);
    }
    function retry() {
      if (Date.now() - start > timeout) return reject(new Error('Server did not start in time'));
      setTimeout(check, POLL_INTERVAL);
    }
    check();
  });
}

/** Resolve the path to the bundled Node.js binary (works both in dev and packaged) */
function getNodePath() {
  // In a packaged app, electron-builder unpacks node_modules into resources/app.asar.unpacked
  // We use the system Node for dev, and the bundled one for production.
  if (app.isPackaged) {
    // electron-builder copies the node binary next to the app
    const candidates = [
      path.join(process.resourcesPath, 'node.exe'),
      path.join(process.resourcesPath, 'bin', 'node.exe'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }
  return process.execPath.includes('electron') ? 'node' : process.execPath;
}

/** Start the Express server as a child process */
function startServer() {
  const nodePath = getNodePath();

  serverProc = spawn(nodePath, [SERVER_ENTRY], {
    cwd: path.join(__dirname, '..', 'server'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(SERVER_PORT),
      // Tell server.js where to find auth.json when packaged
      ELECTRON_RESOURCES_PATH: app.isPackaged ? process.resourcesPath : '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  serverProc.stdout.on('data', d => console.log('[server]', d.toString().trim()));
  serverProc.stderr.on('data', d => console.error('[server]', d.toString().trim()));

  serverProc.on('exit', (code, signal) => {
    console.log(`[server] exited code=${code} signal=${signal}`);
    if (!isQuitting && mainWindow) {
      dialog.showErrorBox(
        'Server stopped',
        `The backend server exited unexpectedly (code ${code}).\nThe app will close.`
      );
      app.quit();
    }
  });
}

/** Kill the server process cleanly */
function stopServer() {
  if (serverProc && !serverProc.killed) {
    serverProc.kill('SIGTERM');
    serverProc = null;
  }
}

/** Create the main BrowserWindow */
function createWindow() {
  const icon = fs.existsSync(ICON_PATH) ? nativeImage.createFromPath(ICON_PATH) : undefined;

  mainWindow = new BrowserWindow({
    width:  1400,
    height: 900,
    minWidth:  900,
    minHeight: 600,
    title: 'NSE Option Chain',
    icon,
    backgroundColor: '#f1f5f9',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // No preload needed — the React app talks to localhost:3000 via HTTP
    },
    show: false, // show after ready-to-show to avoid white flash
  });

  // Load the built React app
  mainWindow.loadFile(CLIENT_DIST);

  // Show once content is ready
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Minimise to tray instead of closing
  mainWindow.on('close', e => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      if (tray) tray.displayBalloon?.({
        title: 'NSE Option Chain',
        content: 'App is still running in the system tray.',
      });
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

/** Create the system tray icon */
function createTray() {
  const icon = fs.existsSync(ICON_PATH)
    ? nativeImage.createFromPath(ICON_PATH)
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('NSE Option Chain');

  const menu = Menu.buildFromTemplate([
    { label: 'Open',  click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Quit',  click: () => { isQuitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(menu);
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

/** Build the application menu */
function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => { isQuitting = true; app.quit(); } },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Developer',
      submenu: [
        { role: 'toggleDevTools' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.on('second-instance', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});

app.whenReady().then(async () => {
  buildMenu();
  createTray();

  // Show a loading window while the server starts
  const splash = new BrowserWindow({
    width: 420, height: 260,
    frame: false, resizable: false, center: true,
    backgroundColor: '#0f172a',
    webPreferences: { nodeIntegration: false },
  });
  splash.loadURL(`data:text/html,
    <html><body style="margin:0;display:flex;flex-direction:column;align-items:center;
      justify-content:center;height:100vh;background:#0f172a;color:#38bdf8;
      font-family:system-ui,sans-serif;gap:16px">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
      <div style="font-size:1.4rem;font-weight:800;letter-spacing:.04em">NSE Option Chain</div>
      <div style="font-size:.85rem;color:rgba(56,189,248,.7)">Starting server…</div>
    </body></html>
  `);

  startServer();

  try {
    await waitForServer();
  } catch (err) {
    dialog.showErrorBox('Startup failed', `Could not start the backend server:\n${err.message}`);
    isQuitting = true;
    app.quit();
    return;
  }

  splash.close();
  createWindow();
});

app.on('window-all-closed', () => {
  // On Windows keep running in tray — do not quit
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
  else { mainWindow.show(); mainWindow.focus(); }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopServer();
});
