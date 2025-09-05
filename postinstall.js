const fs = require('fs'); const path = require('path');
try {
  const sw = `importScripts('https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js');`;
  const p = path.join(__dirname, '..', 'public', 'OneSignalSDKWorker.js');
  if (!fs.existsSync(p)) fs.writeFileSync(p, sw);
} catch(e) { console.error('postinstall:', e) }
