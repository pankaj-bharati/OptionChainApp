# NSE Option Chain — Windows App Build Guide

This branch (`windows-app`) packages the app as a native Windows desktop application using **Electron** + **electron-builder**.

## What you get

| File | Type | Description |
|---|---|---|
| `NSE-Option-Chain-Setup-1.0.0.exe` | NSIS installer | Full installer with Start Menu + Desktop shortcut, uninstaller |
| `NSE-Option-Chain-1.0.0.msi` | MSI installer | Enterprise-friendly Windows Installer package |
| `NSE-Option-Chain-1.0.0-win.zip` | Portable ZIP | No installation needed — unzip and run |

All outputs land in `dist-electron/`.

## Prerequisites

- **Node.js 18+** installed on the build machine
- **Windows 10/11 x64** (builds must be run on Windows for Windows targets)
- **Visual Studio Build Tools** (for native `bcrypt` module recompilation)
  - Install from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
  - Select: "Desktop development with C++"

## Build steps

```bat
REM 1. Install all dependencies
npm run install-all

REM 2. Build all three Windows formats (exe + msi + zip)
npm run build:win

REM 3. Or build individually:
npm run build:exe    REM NSIS .exe installer only
npm run build:msi    REM MSI only
npm run build:zip    REM Portable ZIP only
```

Output files will be in `dist-electron/`.

## Run in development (Electron without packaging)

```bat
npm run electron:dev
```

This builds the React app then launches Electron pointing at `client/dist/`.

## How it works

```
Electron main process (electron/main.js)
  │
  ├── Spawns  server/server.js  as a child Node process on port 3000
  ├── Polls   http://localhost:3000/health  until server is ready
  ├── Shows   splash screen while waiting
  └── Opens   BrowserWindow  loading  client/dist/index.html
                │
                └── React app calls http://localhost:3000/api/* as normal
```

- The Express server runs as a hidden background process — no terminal window
- The app minimises to the system tray instead of closing
- Single-instance lock prevents multiple copies running simultaneously
- `auth.json` is stored in `%APPDATA%\NSE Option Chain\` (via `process.resourcesPath`) so it survives app updates

## Troubleshooting

**"bcrypt" native module error on first build**
Run `npm rebuild bcrypt` inside the `server/` directory, then retry the build.

**Blank white window on launch**
The server may not have started in time. Check the Electron DevTools console (Ctrl+Shift+I) for errors.

**"App is already running" on startup**
The single-instance lock is active. Check the system tray for the existing instance.
