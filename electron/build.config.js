/**
 * electron-builder configuration
 * Produces three Windows artefacts in dist-electron/:
 *   NSE-Option-Chain-Setup-1.0.0.exe   ← NSIS installer (.exe)
 *   NSE-Option-Chain-1.0.0.msi         ← MSI installer
 *   NSE-Option-Chain-1.0.0-win.zip     ← Portable ZIP (no install needed)
 *
 * NOTE: "main" is NOT a valid electron-builder key — it lives in package.json.
 */

module.exports = {
  appId:       'com.nse.optionchain',
  productName: 'NSE Option Chain',
  copyright:   'Copyright © 2025',

  // ── Files to include in the package ───────────────────────────────────────
  files: [
    'electron/main.js',
    'client/dist/**/*',
    'server/server.js',
    'server/auth.json',
    'server/package.json',
    'server/node_modules/**/*',
    '!server/node_modules/.bin/**',
    '!server/__tests__/**',
    '!server/jest.setup.js',
    '!**/*.map',
    '!**/test/**',
    '!**/tests/**',
    '!**/__tests__/**',
    '!**/coverage/**',
  ],

  // ── Output directory ──────────────────────────────────────────────────────
  directories: {
    output: 'dist-electron',
    buildResources: 'electron/assets',
  },

  // ── Windows targets ───────────────────────────────────────────────────────
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'msi',  arch: ['x64'] },
      { target: 'zip',  arch: ['x64'] },
    ],
    icon: 'electron/assets/icon.ico',
    requestedExecutionLevel: 'asInvoker',
  },

  // ── NSIS installer (.exe) ─────────────────────────────────────────────────
  nsis: {
    oneClick:                           false,
    allowToChangeInstallationDirectory: true,
    allowElevation:                     true,
    createDesktopShortcut:              true,
    createStartMenuShortcut:            true,
    shortcutName:                       'NSE Option Chain',
    runAfterFinish:                     true,
    deleteAppDataOnUninstall:           false,
  },

  // ── MSI installer ─────────────────────────────────────────────────────────
  msi: {
    createDesktopShortcut:   true,
    createStartMenuShortcut: true,
    shortcutName:            'NSE Option Chain',
  },

  // ── asar packaging ────────────────────────────────────────────────────────
  asar: true,
  asarUnpack: [
    'server/node_modules/bcrypt/**',
    'server/node_modules/node-gyp-build/**',
  ],

  // ── Extra resources outside asar (writable at runtime) ───────────────────
  extraResources: [
    {
      from: 'server/auth.json',
      to:   'auth.json',
    },
  ],

  // ── No auto-update publishing ─────────────────────────────────────────────
  publish: null,
};
