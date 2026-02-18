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

console.log('🔧 [Post-Build] Temporarily skipping sw-custom.js injection to test workbox alone...');

try {
  // TEMPORARILY DISABLED: Skip sw-custom.js injection to test if workbox works alone

  // 1. Just verify sw.js exists
  if (!fs.existsSync(SW_PATH)) {
    console.error('❌ [Post-Build] sw.js not found in out/');
    process.exit(1);
  }

  console.log('✅ [Post-Build] sw.js found - NOT injecting sw-custom.js (testing workbox alone)');
  console.log('🎉 [Post-Build] Done!');
} catch (error) {
  console.error('❌ [Post-Build] Error:', error.message);
  process.exit(1);
}
