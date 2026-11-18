const fs = require('fs');

// Check if pngjs or sharp or Jimp is available, or use pure JS PNG decoder
let PNG;
try {
  PNG = require('pngjs').PNG;
} catch (e) {
  console.log('pngjs not found directly, checking installed packages...');
}

if (!PNG) {
  // Let's inspect package.json or node_modules
  console.log('Checking available modules...');
}
