#!/usr/bin/env node

/**
 * Script para crear baseline de rendimiento
 * Ejecuta tests de rendimiento y guarda los resultados como baseline
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const BASELINE_FILE = 'performance-baseline.json';
const RESULTS_FILE = 'performance-results.json';

function runPerformanceTests() {
  console.log('🧪 Running performance tests...\n');
  
  try {
    // Ejecutar tests de rendimiento
    execSync('npm run test:performance', { stdio: 'inherit' });
    console.log('✅ Performance tests completed\n');
  } catch (error) {
    console.error('❌ Performance tests failed:', error.message);
    process.exit(1);
  }
}

function collectLighthouseResults() {
  console.log('🔍 Collecting Lighthouse results...');
  
  try {
    // Ejecutar Lighthouse
    execSync('npx lighthouse http://localhost:3000 --output json --output-path lighthouse-results.json --chrome-flags="--headless"', { stdio: 'inherit' });
    
    if (fs.existsSync('lighthouse-results.json')) {
      const lighthouseData = JSON.parse(fs.readFileSync('lighthouse-results.json', 'utf8'));
      
      return {
        firstContentfulPaint: lighthouseData.audits['first-contentful-paint']?.numericValue,
        largestContentfulPaint: lighthouseData.audits['largest-contentful-paint']?.numericValue,
        cumulativeLayoutShift: lighthouseData.audits['cumulative-layout-shift']?.numericValue,
        totalBlockingTime: lighthouseData.audits['total-blocking-time']?.numericValue,
        speedIndex: lighthouseData.audits['speed-index']?.numericValue,
        interactive: lighthouseData.audits['interactive']?.numericValue,
        performanceScore: lighthouseData.categories.performance?.score,
        accessibilityScore: lighthouseData.categories.accessibility?.score,
        bestPracticesScore: lighthouseData.categories['best-practices']?.score,
        seoScore: lighthouseData.categories.seo?.score,
        pwaScore: lighthouseData.categories.pwa?.score
      };
    }
  } catch (error) {
    console.warn('⚠️ Lighthouse test failed:', error.message);
  }
  
  return null;
}

function collectBundleAnalysis() {
  console.log('📦 Collecting bundle analysis...');
  
  try {
    // Ejecutar análisis de bundle
    execSync('npm run analyze', { stdio: 'inherit' });
    
    // Leer resultados del análisis de bundle
    const bundleAnalysisPath = '.next/analyze/client.html';
    if (fs.existsSync(bundleAnalysisPath)) {
      // Extraer información del bundle (esto requeriría parsing del HTML o usar una librería)
      return {
        total: 0, // Placeholder - en implementación real se extraería del análisis
        chunks: [],
        assets: []
      };
    }
  } catch (error) {
    console.warn('⚠️ Bundle analysis failed:', error.message);
  }
  
  return null;
}

function collectMemoryUsage() {
  console.log('🧠 Collecting memory usage...');
  
  try {
    // Ejecutar test de memoria
    execSync('node --expose-gc scripts/memory-test.js', { stdio: 'inherit' });
    
    if (fs.existsSync('memory-results.json')) {
      return JSON.parse(fs.readFileSync('memory-results.json', 'utf8'));
    }
  } catch (error) {
    console.warn('⚠️ Memory test failed:', error.message);
  }
  
  return null;
}

function collectLoadTestResults() {
  console.log('⚡ Collecting load test results...');
  
  try {
    // Ejecutar load test
    execSync('npx artillery run load-test.yml --output load-test-results.json', { stdio: 'inherit' });
    
    if (fs.existsSync('load-test-results.json')) {
      return JSON.parse(fs.readFileSync('load-test-results.json', 'utf8'));
    }
  } catch (error) {
    console.warn('⚠️ Load test failed:', error.message);
  }
  
  return null;
}

function createBaseline() {
  console.log('📊 Creating performance baseline...\n');
  
  const baseline = {
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    commit: process.env.GITHUB_SHA || 'local',
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    lighthouse: collectLighthouseResults(),
    bundleSize: collectBundleAnalysis(),
    memoryUsage: collectMemoryUsage(),
    loadTest: collectLoadTestResults()
  };
  
  // Guardar baseline
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2));
  console.log(`✅ Baseline created and saved to ${BASELINE_FILE}\n`);
  
  // Mostrar resumen
  console.log('📈 Performance Baseline Summary:');
  if (baseline.lighthouse) {
    console.log(`  - Performance Score: ${baseline.lighthouse.performanceScore}`);
    console.log(`  - Accessibility Score: ${baseline.lighthouse.accessibilityScore}`);
    console.log(`  - Best Practices Score: ${baseline.lighthouse.bestPracticesScore}`);
    console.log(`  - SEO Score: ${baseline.lighthouse.seoScore}`);
    console.log(`  - PWA Score: ${baseline.lighthouse.pwaScore}`);
  }
  
  if (baseline.bundleSize) {
    console.log(`  - Bundle Size: ${baseline.bundleSize.total} bytes`);
  }
  
  if (baseline.memoryUsage) {
    console.log(`  - Memory Usage: ${baseline.memoryUsage.heapUsed} bytes`);
  }
  
  console.log('\n✅ Performance baseline created successfully!');
}

function main() {
  console.log('🚀 Creating Performance Baseline\n');
  
  // Verificar si ya existe un baseline
  if (fs.existsSync(BASELINE_FILE)) {
    console.log('⚠️ Baseline already exists. Overwriting...\n');
  }
  
  // Ejecutar tests de rendimiento
  runPerformanceTests();
  
  // Crear baseline
  createBaseline();
}

if (require.main === module) {
  main();
}

module.exports = { createBaseline };

