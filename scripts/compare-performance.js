#!/usr/bin/env node

/**
 * Script para comparar métricas de rendimiento con baseline
 * Ejecuta tests de rendimiento y compara con valores de referencia
 */

const fs = require('fs');
const path = require('path');

const BASELINE_FILE = 'performance-baseline.json';
const CURRENT_RESULTS_FILE = 'performance-results.json';

// Umbrales de regresión (en porcentaje)
const THRESHOLDS = {
  firstContentfulPaint: 10, // 10% de regresión permitida
  largestContentfulPaint: 10,
  cumulativeLayoutShift: 20,
  totalBlockingTime: 15,
  speedIndex: 10,
  interactive: 10,
  bundleSize: 5, // 5% de aumento en tamaño de bundle
  memoryUsage: 10 // 10% de aumento en uso de memoria
};

function loadJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.warn(`Warning: Could not load ${filePath}:`, error.message);
  }
  return null;
}

function compareMetrics(baseline, current) {
  const regressions = [];
  const improvements = [];
  
  // Comparar métricas de Lighthouse
  if (baseline.lighthouse && current.lighthouse) {
    const lighthouseMetrics = [
      'firstContentfulPaint',
      'largestContentfulPaint',
      'cumulativeLayoutShift',
      'totalBlockingTime',
      'speedIndex',
      'interactive'
    ];
    
    lighthouseMetrics.forEach(metric => {
      const baselineValue = baseline.lighthouse[metric];
      const currentValue = current.lighthouse[metric];
      
      if (baselineValue && currentValue) {
        const change = ((currentValue - baselineValue) / baselineValue) * 100;
        const threshold = THRESHOLDS[metric] || 10;
        
        if (change > threshold) {
          regressions.push({
            metric,
            baseline: baselineValue,
            current: currentValue,
            change: change.toFixed(2),
            threshold
          });
        } else if (change < -5) { // Mejora significativa
          improvements.push({
            metric,
            baseline: baselineValue,
            current: currentValue,
            change: change.toFixed(2)
          });
        }
      }
    });
  }
  
  // Comparar tamaño de bundle
  if (baseline.bundleSize && current.bundleSize) {
    const baselineSize = baseline.bundleSize.total;
    const currentSize = current.bundleSize.total;
    const change = ((currentSize - baselineSize) / baselineSize) * 100;
    const threshold = THRESHOLDS.bundleSize;
    
    if (change > threshold) {
      regressions.push({
        metric: 'bundleSize',
        baseline: baselineSize,
        current: currentSize,
        change: change.toFixed(2),
        threshold
      });
    }
  }
  
  // Comparar uso de memoria
  if (baseline.memoryUsage && current.memoryUsage) {
    const baselineMemory = baseline.memoryUsage.heapUsed;
    const currentMemory = current.memoryUsage.heapUsed;
    const change = ((currentMemory - baselineMemory) / baselineMemory) * 100;
    const threshold = THRESHOLDS.memoryUsage;
    
    if (change > threshold) {
      regressions.push({
        metric: 'memoryUsage',
        baseline: baselineMemory,
        current: currentMemory,
        change: change.toFixed(2),
        threshold
      });
    }
  }
  
  return { regressions, improvements };
}

function generateReport(comparison) {
  const { regressions, improvements } = comparison;
  
  let report = '# Performance Comparison Report\n\n';
  report += `Generated on: ${new Date().toISOString()}\n\n`;
  
  if (regressions.length > 0) {
    report += '## 🚨 Performance Regressions\n\n';
    report += '| Metric | Baseline | Current | Change | Threshold |\n';
    report += '|--------|----------|---------|--------|----------|\n';
    
    regressions.forEach(regression => {
      report += `| ${regression.metric} | ${regression.baseline} | ${regression.current} | ${regression.change}% | ${regression.threshold}% |\n`;
    });
    
    report += '\n';
  }
  
  if (improvements.length > 0) {
    report += '## ✅ Performance Improvements\n\n';
    report += '| Metric | Baseline | Current | Change |\n';
    report += '|--------|----------|---------|-------|\n';
    
    improvements.forEach(improvement => {
      report += `| ${improvement.metric} | ${improvement.baseline} | ${improvement.current} | ${improvement.change}% |\n`;
    });
    
    report += '\n';
  }
  
  if (regressions.length === 0 && improvements.length === 0) {
    report += '## ✅ No significant performance changes detected\n\n';
  }
  
  // Resumen
  report += '## Summary\n\n';
  report += `- **Regressions**: ${regressions.length}\n`;
  report += `- **Improvements**: ${improvements.length}\n`;
  report += `- **Status**: ${regressions.length > 0 ? '⚠️ Performance regressions detected' : '✅ Performance within acceptable limits'}\n\n`;
  
  return report;
}

function main() {
  console.log('🔍 Comparing performance metrics...\n');
  
  // Cargar baseline y resultados actuales
  const baseline = loadJSON(BASELINE_FILE);
  const current = loadJSON(CURRENT_RESULTS_FILE);
  
  if (!baseline) {
    console.log('❌ No baseline found. Creating new baseline...');
    if (current) {
      fs.writeFileSync(BASELINE_FILE, JSON.stringify(current, null, 2));
      console.log('✅ Baseline created successfully');
    } else {
      console.log('❌ No current results found. Please run performance tests first.');
      process.exit(1);
    }
    return;
  }
  
  if (!current) {
    console.log('❌ No current results found. Please run performance tests first.');
    process.exit(1);
  }
  
  // Comparar métricas
  const comparison = compareMetrics(baseline, current);
  
  // Generar reporte
  const report = generateReport(comparison);
  
  // Guardar reporte
  fs.writeFileSync('performance-comparison-report.md', report);
  console.log('📊 Performance comparison report generated');
  
  // Mostrar resumen en consola
  console.log('\n📈 Performance Comparison Summary:');
  console.log(`- Regressions: ${comparison.regressions.length}`);
  console.log(`- Improvements: ${comparison.improvements.length}`);
  
  if (comparison.regressions.length > 0) {
    console.log('\n🚨 Performance regressions detected:');
    comparison.regressions.forEach(regression => {
      console.log(`  - ${regression.metric}: ${regression.change}% (threshold: ${regression.threshold}%)`);
    });
  }
  
  if (comparison.improvements.length > 0) {
    console.log('\n✅ Performance improvements detected:');
    comparison.improvements.forEach(improvement => {
      console.log(`  - ${improvement.metric}: ${improvement.change}%`);
    });
  }
  
  // Exit code basado en regresiones
  if (comparison.regressions.length > 0) {
    console.log('\n❌ Performance regressions detected. Consider reviewing changes.');
    process.exit(1);
  } else {
    console.log('\n✅ Performance within acceptable limits.');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { compareMetrics, generateReport };

