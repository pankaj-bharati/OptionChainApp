/**
 * Workaround for electron-builder winCodeSign symlink error on Windows
 * without Developer Mode enabled.
 *
 * The winCodeSign package contains macOS .dylib symlinks that 7-Zip cannot
 * extract on Windows without the SeCreateSymbolicLinkPrivilege privilege.
 *
 * This script pre-creates the cache directory with empty placeholder files
 * in place of the symlinks so 7-Zip skips them, then patches the extracted
 * directory so electron-builder finds what it needs.
 *
 * Run once before building: node scripts/setup-wincosign-cache.js
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const https = require('https');
const { execSync } = require('child_process');

const CACHE_DIR   = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign');
const VERSION     = 'winCodeSign-2.6.0';
const MARKER_FILE = path.join(CACHE_DIR, VERSION, '.patched');

// Symlinks that cause the error — replace with empty files
const PROBLEM_SYMLINKS = [
  'darwin/10.12/lib/libcrypto.dylib',
  'darwin/10.12/lib/libssl.dylib',
];

if (fs.existsSync(MARKER_FILE)) {
  console.log('winCodeSign cache already patched — skipping.');
  process.exit(0);
}

const targetDir = path.join(CACHE_DIR, VERSION);

if (!fs.existsSync(targetDir)) {
  console.log('winCodeSign cache not found — downloading via electron-builder...');
  // Let electron-builder download it first by running a dummy build that will fail
  // at the symlink step, then we patch the partial extraction.
  try {
    execSync(
      'node -e "require(\'electron-builder/out/cli/cli\').app([\'--version\'])"',
      { stdio: 'ignore', cwd: path.join(__dirname, '..') }
    );
  } catch (_) {}
}

// Create the target dir if it still doesn't exist
fs.mkdirSync(targetDir, { recursive: true });

// Create placeholder files for the problematic symlinks
for (const rel of PROBLEM_SYMLINKS) {
  const full = path.join(targetDir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (!fs.existsSync(full)) {
    fs.writeFileSync(full, '');
    console.log('Created placeholder:', rel);
  }
}

// Write marker so we don't re-run
fs.writeFileSync(MARKER_FILE, new Date().toISOString());
console.log('winCodeSign cache patched successfully.');
