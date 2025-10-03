/**
 * Script de emergencia para el error de archivos .txt
 * Usar cuando aparece código de chunks en pantalla
 */

console.log('🚨 SCRIPT DE EMERGENCIA - Corrigiendo error de archivos .txt');

(async function fixTxtError() {
  try {
    // 1. Detectar si estamos en el error
    const bodyText = document.body.textContent || '';
    const isError = bodyText.includes('static/chunks/') && 
                   bodyText.includes('PostHogProvider') &&
                   document.body.children.length < 3;
    
    if (isError) {
      console.log('✅ Error de archivo .txt confirmado');
    } else {
      console.log('ℹ️ No se detectó el error, ejecutando limpieza preventiva');
    }
    
    // 2. Limpiar TODOS los caches agresivamente
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log('🗑️ Eliminando caches:', cacheNames);
      
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
        console.log(`✅ Cache eliminado: ${cacheName}`);
      }
    }
    
    // 3. Desregistrar ALL service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log('✅ Service worker desregistrado');
      }
    }
    
    // 4. Limpiar localStorage problemático
    const problematicKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('workbox') || 
        key.includes('pwa') || 
        key.includes('sw') ||
        key.includes('next') ||
        key.includes('chunk')
      )) {
        problematicKeys.push(key);
      }
    }
    
    problematicKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`✅ LocalStorage limpiado: ${key}`);
    });
    
    // 5. Limpiar sessionStorage también
    sessionStorage.clear();
    console.log('✅ SessionStorage limpiado');
    
    // 6. Forzar recarga completa sin cache
    console.log('🔄 Recargando página sin cache...');
    
    // Usar location.replace para evitar que vuelva atrás al error
    setTimeout(() => {
      window.location.replace(window.location.href + '?t=' + Date.now());
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    // Fallback: recarga forzada
    window.location.reload(true);
  }
})();

// También exportar como función para uso programático
window.fixTxtError = () => {
  fetch('/fix-txt-error.js').then(r => r.text()).then(eval);
};
