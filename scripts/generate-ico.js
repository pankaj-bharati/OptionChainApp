/**
 * Generates electron/assets/icon.ico from the 512x512 PNG.
 * Run once before building: node scripts/generate-ico.js
 */
const pngToIco = require('png-to-ico');
const fs       = require('fs');
const path     = require('path');

const src  = path.join(__dirname, '..', 'client', 'public', 'icons', 'android-chrome-512x512.png');
const dest = path.join(__dirname, '..', 'electron', 'assets', 'icon.ico');

fs.mkdirSync(path.dirname(dest), { recursive: true });

pngToIco(src)
  .then(buf => {
    fs.writeFileSync(dest, buf);
    console.log('Generated:', dest);
  })
  .catch(err => {
    console.error('Failed to generate icon:', err.message);
    process.exit(1);
  });
