const b = require('fs').readFileSync('electron/assets/icon.ico');
console.log('size=' + b.length + ' header=' + b.slice(0,4).toString('hex'));
