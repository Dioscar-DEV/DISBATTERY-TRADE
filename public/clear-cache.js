/**
 * Script para limpiar cache manualmente
 * Usar en la consola del navegador cuando hay problemas de chunk
 */

(async function clearPWACache() {
  console.log('🧹 Iniciando limpieza de cache PWA...');
  
  try {
    // 1. Limpiar todos los caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log('📦 Caches encontrados:', cacheNames);
      
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
        console.log(`✅ Cache eliminado: ${cacheName}`);
      }
    }
    
    // 2. Desregistrar service worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log('✅ Service worker desregistrado');
      }
    }
    
    // 3. Limpiar localStorage relacionado
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('workbox') || key.includes('pwa') || key.includes('sw'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`✅ LocalStorage limpiado: ${key}`);
    });
    
    console.log('🎉 Limpieza completada. Recarga la página para ver los cambios.');
    
    // 4. Recargar automáticamente después de 2 segundos
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  }
})();
