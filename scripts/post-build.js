#!/usr/bin/env node

/**
 * Post-build script to inject sw-custom.js into workbox-generated sw.js
 * This is a workaround for next-pwa@5.6.0 not processing importScripts correctly
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'out');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SW_PATH = path.join(OUT_DIR, 'sw.js');
const SW_CUSTOM_SRC = path.join(PUBLIC_DIR, 'sw-custom.js');
const SW_CUSTOM_DEST = path.join(OUT_DIR, 'sw-custom.js');

console.log('🔧 [Post-Build] Injecting sw-custom.js into sw.js...');

try {
  // 1. Copy sw-custom.js to out/
  if (!fs.existsSync(SW_CUSTOM_SRC)) {
    console.error('❌ [Post-Build] sw-custom.js not found in public/');
    process.exit(1);
  }

  fs.copyFileSync(SW_CUSTOM_SRC, SW_CUSTOM_DEST);
  console.log('✅ [Post-Build] Copied sw-custom.js to out/');

  // 2. Read sw.js
  if (!fs.existsSync(SW_PATH)) {
    console.error('❌ [Post-Build] sw.js not found in out/');
    process.exit(1);
  }

  let swContent = fs.readFileSync(SW_PATH, 'utf8');

  // 3. Check if sw-custom.js is already imported
  if (swContent.includes('importScripts("sw-custom.js")') || swContent.includes("importScripts('sw-custom.js')")) {
    console.log('ℹ️  [Post-Build] sw-custom.js already imported, skipping');
    process.exit(0);
  }

  // 4. Inject at the very beginning of the file (safest approach)
  // Workbox sw.js starts with: if(!self.define){...}
  // We need to inject BEFORE everything, so it executes first

  // Simply prepend to the beginning of the file
  swContent = 'importScripts("sw-custom.js");\n' + swContent;
  fs.writeFileSync(SW_PATH, swContent, 'utf8');
  console.log('✅ [Post-Build] Injected sw-custom.js at the very beginning of sw.js');

  console.log('🎉 [Post-Build] Done!');
} catch (error) {
  console.error('❌ [Post-Build] Error:', error.message);
  process.exit(1);
}
