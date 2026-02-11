#!/usr/bin/env node

/**
 * Script para testing de memoria
 * Mide el uso de memoria durante la ejecución de la aplicación
 */

const fs = require('fs');
const path = require('path');

// Función para medir uso de memoria
function measureMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss, // Resident Set Size
    heapTotal: usage.heapTotal,
    heapUsed: usage.heapUsed,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers
  };
}

// Función para simular carga de trabajo
function simulateWorkload() {
  console.log('🔄 Simulating application workload...');
  
  // Simular operaciones típicas de la aplicación
  const operations = [
    () => {
      // Simular carga de datos
      const data = new Array(1000).fill(0).map((_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random() * 1000
      }));
      return data;
    },
    () => {
      // Simular procesamiento de imágenes
      const images = new Array(100).fill(0).map(() => ({
        data: Buffer.alloc(1024 * 1024), // 1MB por imagen
        metadata: { width: 1920, height: 1080 }
      }));
      return images;
    },
    () => {
      // Simular operaciones de base de datos
      const records = new Array(5000).fill(0).map((_, i) => ({
        id: `record_${i}`,
        timestamp: new Date(),
        data: `Data for record ${i}`.repeat(100)
      }));
      return records;
    }
  ];
  
  // Ejecutar operaciones
  operations.forEach((operation, index) => {
    console.log(`  - Running operation ${index + 1}/${operations.length}`);
    const result = operation();
    
    // Forzar garbage collection si está disponible
    if (global.gc) {
      global.gc();
    }
    
    // Medir memoria después de cada operación
    const memory = measureMemoryUsage();
    console.log(`    Memory after operation: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  });
}

// Función para medir memoria durante un período de tiempo
function measureMemoryOverTime(duration = 30000) { // 30 segundos por defecto
  console.log(`📊 Measuring memory usage over ${duration / 1000} seconds...`);
  
  const measurements = [];
  const startTime = Date.now();
  
  const interval = setInterval(() => {
    const memory = measureMemoryUsage();
    const timestamp = Date.now() - startTime;
    
    measurements.push({
      timestamp,
      memory
    });
    
    console.log(`  [${(timestamp / 1000).toFixed(1)}s] Heap: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  }, 1000); // Medir cada segundo
  
  return new Promise((resolve) => {
    setTimeout(() => {
      clearInterval(interval);
      resolve(measurements);
    }, duration);
  });
}

// Función para detectar memory leaks
function detectMemoryLeaks(measurements) {
  console.log('🔍 Analyzing memory usage for leaks...');
  
  if (measurements.length < 10) {
    console.log('⚠️ Not enough measurements for leak detection');
    return null;
  }
  
  // Calcular tendencia de uso de memoria
  const heapUsages = measurements.map(m => m.memory.heapUsed);
  const firstHalf = heapUsages.slice(0, Math.floor(heapUsages.length / 2));
  const secondHalf = heapUsages.slice(Math.floor(heapUsages.length / 2));
  
  const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  const trend = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
  
  const leakDetection = {
    trend: trend * 100, // Porcentaje de cambio
    isLeak: trend > 0.1, // Más del 10% de aumento indica posible leak
    firstHalfAvg: firstHalfAvg,
    secondHalfAvg: secondHalfAvg,
    maxUsage: Math.max(...heapUsages),
    minUsage: Math.min(...heapUsages),
    variance: calculateVariance(heapUsages)
  };
  
  return leakDetection;
}

// Función para calcular varianza
function calculateVariance(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance); // Desviación estándar
}

// Función principal
async function runMemoryTest() {
  console.log('🧠 Starting Memory Test\n');
  
  // Medir memoria inicial
  const initialMemory = measureMemoryUsage();
  console.log('📊 Initial Memory Usage:');
  console.log(`  - RSS: ${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - Heap Total: ${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - Heap Used: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - External: ${(initialMemory.external / 1024 / 1024).toFixed(2)} MB\n`);
  
  // Simular carga de trabajo
  simulateWorkload();
  
  // Medir memoria después de la carga
  const afterWorkloadMemory = measureMemoryUsage();
  console.log('\n📊 Memory Usage After Workload:');
  console.log(`  - RSS: ${(afterWorkloadMemory.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - Heap Total: ${(afterWorkloadMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - Heap Used: ${(afterWorkloadMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - External: ${(afterWorkloadMemory.external / 1024 / 1024).toFixed(2)} MB\n`);
  
  // Medir memoria durante un período de tiempo
  const measurements = await measureMemoryOverTime(30000); // 30 segundos
  
  // Detectar memory leaks
  const leakDetection = detectMemoryLeaks(measurements);
  
  // Crear reporte de resultados
  const results = {
    timestamp: new Date().toISOString(),
    initialMemory,
    afterWorkloadMemory,
    measurements: measurements.slice(-10), // Solo las últimas 10 mediciones
    leakDetection,
    summary: {
      maxHeapUsed: Math.max(...measurements.map(m => m.memory.heapUsed)),
      minHeapUsed: Math.min(...measurements.map(m => m.memory.heapUsed)),
      avgHeapUsed: measurements.reduce((sum, m) => sum + m.memory.heapUsed, 0) / measurements.length,
      memoryIncrease: afterWorkloadMemory.heapUsed - initialMemory.heapUsed
    }
  };
  
  // Guardar resultados
  fs.writeFileSync('memory-results.json', JSON.stringify(results, null, 2));
  
  // Mostrar resumen
  console.log('\n📈 Memory Test Summary:');
  console.log(`  - Initial Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - After Workload: ${(afterWorkloadMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - Memory Increase: ${(results.summary.memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - Max Heap Used: ${(results.summary.maxHeapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - Avg Heap Used: ${(results.summary.avgHeapUsed / 1024 / 1024).toFixed(2)} MB`);
  
  if (leakDetection) {
    console.log(`  - Memory Trend: ${leakDetection.trend.toFixed(2)}%`);
    console.log(`  - Potential Leak: ${leakDetection.isLeak ? 'Yes' : 'No'}`);
  }
  
  console.log('\n✅ Memory test completed successfully!');
  console.log('📄 Results saved to memory-results.json');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runMemoryTest().catch(console.error);
}

module.exports = { runMemoryTest, measureMemoryUsage, detectMemoryLeaks };

