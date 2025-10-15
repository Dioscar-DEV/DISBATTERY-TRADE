/**
 * Utilidades para limpiar cache de la PWA
 */

/**
 * Limpia todos los caches del service worker
 */
export async function clearAllCaches(): Promise<void> {
  if (!("caches" in window)) {
    console.warn("Cache API no disponible");
    return;
  }

  try {
    const cacheNames = await caches.keys();
    console.log("🗑️ Limpiando caches:", cacheNames);

    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));

    console.log("✅ Todos los caches limpiados");
  } catch (error) {
    console.error("❌ Error limpiando caches:", error);
  }
}

/**
 * Limpia solo los caches de chunks y estáticos
 */
export async function clearStaticCaches(): Promise<void> {
  if (!("caches" in window)) {
    console.warn("Cache API no disponible");
    return;
  }

  try {
    const cacheNames = await caches.keys();
    const staticCacheNames = cacheNames.filter(
      (name) =>
        name.includes("next-chunks") ||
        name.includes("static-cache") ||
        name.includes("webpack")
    );

    console.log("🗑️ Limpiando caches estáticos:", staticCacheNames);

    await Promise.all(
      staticCacheNames.map((cacheName) => caches.delete(cacheName))
    );

    console.log("✅ Caches estáticos limpiados");
  } catch (error) {
    console.error("❌ Error limpiando caches estáticos:", error);
  }
}

/**
 * Fuerza la actualización del service worker
 */
export async function updateServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service Worker no disponible");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();

    if (registration) {
      console.log("🔄 Actualizando Service Worker...");
      await registration.update();

      // Si hay un worker esperando, activarlo
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      console.log("✅ Service Worker actualizado");
    }
  } catch (error) {
    console.error("❌ Error actualizando Service Worker:", error);
  }
}

/**
 * Función completa para resolver problemas de chunk
 */
export async function fixChunkError(): Promise<void> {
  console.log("🔧 Resolviendo error de chunk...");

  // 1. Limpiar caches estáticos
  await clearStaticCaches();

  // 2. Actualizar service worker
  await updateServiceWorker();

  // 3. Esperar un poco y recargar
  setTimeout(() => {
    console.log("🔄 Recargando página...");
    window.location.reload();
  }, 1000);
}
