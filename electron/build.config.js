/**
 * electron-builder configuration
 * Produces three Windows artefacts:
 *   dist-electron/
 *     NSE-Option-Chain-Setup-x.x.x.exe   ← NSIS installer
 *     NSE-Option-Chain-x.x.x.msi         ← MSI installer
 *     NSE-Option-Chain-x.x.x-win.zip     ← portable zip (no install needed)
 */

module.exports = {
  appId:       'com.nse.optionchain',
  productName: 'NSE Option Chain',
  copyright:   'Copyright © 2025',

  // ── What to include in the package ────────────────────────────────────────
  files: [
    // Electron entry point
    'electron/main.js',

    // Built React app
    'client/dist/**/*',

    // Express server (source + node_modules, excluding dev deps)
    'server/server.js',
    'server/auth.json',
    'server/package.json',
    'server/node_modules/**/*',

    // Exclude things we don't need
    '!server/node_modules/.bin',
    '!server/__tests__/**',
    '!server/jest.setup.js',
    '!**/*.map',
    '!**/test/**',
    '!**/tests/**',
    '!**/__tests__/**',
    '!**/coverage/**',
  ],

  // ── Directories ───────────────────────────────────────────────────────────
  directories: {
    output: 'dist-electron',
    buildResources: 'electron/assets',
  },

  // ── Electron main entry ───────────────────────────────────────────────────
  main: 'electron/main.js',

  // ── Windows targets ───────────────────────────────────────────────────────
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'msi',  arch: ['x64'] },
      { target: 'zip',  arch: ['x64'] },
    ],
    icon: 'client/public/icons/android-chrome-512x512.png',
    requestedExecutionLevel: 'asInvoker',
  },

  // ── NSIS installer options ────────────────────────────────────────────────
  nsis: {
    oneClick:              false,
    allowToChangeInstallationDirectory: true,
    allowElevation:        true,
    installerIcon:         'client/public/icons/android-chrome-512x512.png',
    uninstallerIcon:       'client/public/icons/android-chrome-512x512.png',
    installerHeaderIcon:   'client/public/icons/android-chrome-512x512.png',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName:          'NSE Option Chain',
    runAfterFinish:        true,
    deleteAppDataOnUninstall: false,
  },

  // ── MSI options ───────────────────────────────────────────────────────────
  msi: {
    oneClick:              false,
    perMachine:            false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName:          'NSE Option Chain',
  },

  // ── asar — pack app code but unpack native modules ────────────────────────
  asar: true,
  asarUnpack: [
    'server/node_modules/bcrypt/**',
    'server/node_modules/node-gyp-build/**',
  ],

  // ── Extra resources bundled outside asar (accessible via process.resourcesPath)
  extraResources: [
    // auth.json needs to be writable at runtime — keep it outside asar
    {
      from: 'server/auth.json',
      to:   'auth.json',
    },
  ],

  // ── Publish (disabled — local builds only) ────────────────────────────────
  publish: null,
};
