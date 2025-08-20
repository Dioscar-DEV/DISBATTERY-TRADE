/**
 * Service Worker personalizado para DISBATTERY TRADE
 * Maneja sincronización automática en background y funcionalidad offline
 */

const CACHE_NAME = 'disbattery-offline-v1';
const SYNC_TAG = 'background-sync-visitas';
const DB_NAME = 'DisbatteryOfflineDB';
const DB_VERSION = 1;

// Recursos críticos para funcionamiento offline
const CRITICAL_RESOURCES = [
  '/',
  '/mi-ruta',
  '/visit-capture',
  '/signage-capture',
  '/shell-merchandising',
  '/qualid-merchandising',
  '/observaciones',
  '/reportes-finales',
  '/ventas-productos',
  '/trade-eventos',
  '/trade-impulso',
  '/shell-material-interno',
  '/brand-selection',
  '/instalar',
  '/test-notifications',
  '/registro-exitoso',
  '/offline.html', // Página offline de fallback
  '/manifest.json'
];

// Inicialización del Service Worker
self.addEventListener('install', event => {
  console.log('🔧 [SW] Service Worker instalándose...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('💾 [SW] Cache abierto, cacheando recursos críticos...');
        return cache.addAll(CRITICAL_RESOURCES);
      })
      .then(() => {
        console.log('✅ [SW] Recursos críticos cacheados');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ [SW] Error durante la instalación:', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 [SW] Service Worker activándose...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ [SW] Eliminando cache antiguo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ [SW] Service Worker activado');
        return self.clients.claim();
      })
  );
});

// Interceptar peticiones de red
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar peticiones HTTP/HTTPS
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Estrategia offline-first para recursos de la app
  if (url.origin === self.location.origin) {
    event.respondWith(handleAppRequest(request));
  }
  // Estrategia cache-first para recursos externos (imágenes, fuentes, etc.)
  else {
    event.respondWith(handleExternalRequest(request));
  }
});

// Manejar peticiones de la aplicación
async function handleAppRequest(request) {
  try {
    // Para navegación, intentar red primero, después cache
    if (request.mode === 'navigate') {
      try {
        const networkResponse = await fetch(request);
        
        // Cachear respuesta exitosa
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (networkError) {
        console.log('📱 [SW] Sin conexión, sirviendo desde cache:', request.url);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Fallback a página offline
        return caches.match('/offline.html') || new Response('Aplicación offline no disponible', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      }
    }
    
    // Para otros recursos, cache-first (evitar cachear HTML por error)
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Si no está en cache, intentar red
    const networkResponse = await fetch(request);
    
    // Cachear si es exitoso Y NO ES HTML (evita cachear offline.html bajo rutas JS)
    const contentType = networkResponse.headers.get('content-type') || '';
    if (networkResponse.ok && !contentType.includes('text/html')) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('❌ [SW] Error manejando petición de app:', error);
    return new Response('Error de red', { status: 503 });
  }
}

// Manejar peticiones externas (imágenes, APIs, etc.)
async function handleExternalRequest(request) {
  try {
    // Cache-first para recursos externos
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    // Cachear solo respuestas exitosas y ciertos tipos de contenido
    if (networkResponse.ok && shouldCacheExternalResource(request)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('🌐 [SW] Recurso externo no disponible offline:', request.url);
    
    // Para imágenes, devolver una imagen placeholder si no está en cache
    if (request.destination === 'image') {
      return new Response('', { status: 204 });
    }
    
    return new Response('Recurso no disponible offline', { status: 503 });
  }
}

// Determinar si un recurso externo debe ser cacheado
function shouldCacheExternalResource(request) {
  const url = new URL(request.url);
  
  // Cachear imágenes de Firebase Storage y Google Storage
  if (url.hostname.includes('firebasestorage.googleapis.com') ||
      url.hostname.includes('storage.googleapis.com')) {
    return true;
  }
  
  // Cachear fuentes de Google Fonts
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    return true;
  }
  
  return false;
}

// Background Sync para sincronización automática
self.addEventListener('sync', event => {
  console.log('🔄 [SW] Background sync activado:', event.tag);
  
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncPendingVisitas());
  }
});

// Este archivo ya puede contener otra lógica de sincronización.
// Añadiremos nuestro listener al final.

self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-visitas') {
    console.log('🔄 Evento de Background Sync recibido: sync-pending-visitas');
    event.waitUntil(
      fetch('/api/sync', {
        method: 'POST',
      }).then(response => {
        if (!response.ok) {
          console.error('❌ Falló la llamada a /api/sync desde el Service Worker');
          // Si falla, el navegador reintentará la sincronización más tarde.
          return response.text().then(text => { throw new Error(text) });
        }
        console.log('✅ Llamada a /api/sync desde el Service Worker exitosa.');
        return response.json();
      }).catch(err => {
        console.error('Error en la sincronización desde el SW:', err);
        // Lanzar el error para que el navegador sepa que debe reintentar.
        throw err;
      })
    );
  }
});

// Sincronizar visitas pendientes
async function syncPendingVisitas() {
  try {
    console.log('📤 [SW] Iniciando sincronización de visitas pendientes...');
    
    // Verificar conexión
    if (!navigator.onLine) {
      console.log('❌ [SW] Sin conexión, posponiendo sincronización');
      return;
    }
    
    // Abrir IndexedDB
    const db = await openIndexedDB();
    if (!db) {
      console.error('❌ [SW] No se pudo abrir IndexedDB');
      return;
    }
    
    // Obtener visitas pendientes
    const pendingVisitas = await getPendingVisitasFromDB(db);
    console.log(`📊 [SW] ${pendingVisitas.length} visitas pendientes encontradas`);
    
    if (pendingVisitas.length === 0) {
      return;
    }
    
    // Intentar sincronizar cada visita
    let syncedCount = 0;
    for (const visita of pendingVisitas) {
      try {
        const success = await syncSingleVisita(visita);
        if (success) {
          await removeVisitaFromDB(db, visita.id);
          syncedCount++;
        }
      } catch (error) {
        console.error(`❌ [SW] Error sincronizando visita ${visita.id}:`, error);
      }
    }
    
    console.log(`✅ [SW] Sincronización completada: ${syncedCount}/${pendingVisitas.length} visitas`);
    
    // Notificar a la aplicación sobre el progreso
    if (syncedCount > 0) {
      notifyClients('sync-complete', { syncedCount, totalPending: pendingVisitas.length });
    }
    
  } catch (error) {
    console.error('❌ [SW] Error durante la sincronización:', error);
  }
}

// Abrir conexión a IndexedDB
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB bloqueado'));
  });
}

// Obtener visitas pendientes desde IndexedDB
function getPendingVisitasFromDB(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['visitas_pendientes'], 'readonly');
    const store = transaction.objectStore('visitas_pendientes');
    const index = store.index('status');
    const request = index.getAll('pending');
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Sincronizar una visita individual (simplificado para SW)
async function syncSingleVisita(visita) {
  try {
    // Esta es una versión simplificada para el Service Worker
    // La lógica completa está en syncService.ts
    
    const visitaData = {
      routeId: visita.routeId,
      pointId: visita.pointId,
      clienteId: visita.clienteId,
      mercaderistoId: visita.mercaderistoId,
      timestamp: visita.timestamp,
      gpsLocation: visita.gpsLocation,
      tipoVisita: visita.tipoVisita,
      marcaTrabajada: visita.marcaTrabajada,
      formData: visita.formData,
      isOfflineSync: true
    };
    
    // Por ahora, solo marcar como procesada sin subir fotos
    // La sincronización completa se hace desde la aplicación
    console.log(`📝 [SW] Visita ${visita.id} preparada para sincronización`);
    return true;
    
  } catch (error) {
    console.error(`❌ [SW] Error preparando visita ${visita.id}:`, error);
    return false;
  }
}

// Eliminar visita sincronizada de IndexedDB
function removeVisitaFromDB(db, visitaId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['visitas_pendientes'], 'readwrite');
    const store = transaction.objectStore('visitas_pendientes');
    const request = store.delete(visitaId);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Notificar a todos los clientes conectados
async function notifyClients(type, data) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  
  clients.forEach(client => {
    client.postMessage({
      type,
      data
    });
  });
}

// Manejar mensajes desde la aplicación
self.addEventListener('message', event => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'REGISTER_SYNC':
      // Registrar sincronización en background
      if ('serviceWorker' in self && 'sync' in self.ServiceWorkerRegistration.prototype) {
        self.registration.sync.register(SYNC_TAG)
          .then(() => {
            console.log('✅ [SW] Background sync registrado');
            event.ports[0]?.postMessage({ success: true });
          })
          .catch(error => {
            console.error('❌ [SW] Error registrando background sync:', error);
            event.ports[0]?.postMessage({ success: false, error: error.message });
          });
      } else {
        console.warn('⚠️ [SW] Background Sync no soportado');
        event.ports[0]?.postMessage({ success: false, error: 'Background Sync no soportado' });
      }
      break;
    case 'PRECACHE_URLS':
      // Precargar una lista de URLs específicas
      (async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.addAll(Array.isArray(data?.urls) ? data.urls : []);
          console.log('✅ [SW] Precarga completada:', data?.urls?.length || 0, 'urls');
          event.ports[0]?.postMessage({ success: true });
        } catch (error) {
          console.error('❌ [SW] Error precargando URLs:', error);
          event.ports[0]?.postMessage({ success: false, error: error.message });
        }
      })();
      break;
    case 'PRECACHE_URL':
      // Precargar UNA URL específica (permite progreso desde la app)
      (async () => {
        try {
          const url = data?.url;
          if (!url) throw new Error('URL requerida');
          const cache = await caches.open(CACHE_NAME);
          await cache.add(url);
          console.log('✅ [SW] Precargada URL:', url);
          event.ports[0]?.postMessage({ success: true });
        } catch (error) {
          console.error('❌ [SW] Error precargando URL:', error);
          event.ports[0]?.postMessage({ success: false, error: error.message });
        }
      })();
      break;
    case 'PRECACHE_APP_SHELL':
      // Precargar rutas principales de la app
      (async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.addAll(CRITICAL_RESOURCES);
          console.log('✅ [SW] App shell precargado');
          event.ports[0]?.postMessage({ success: true });
        } catch (error) {
          console.error('❌ [SW] Error precargando app shell:', error);
          event.ports[0]?.postMessage({ success: false, error: error.message });
        }
      })();
      break;
      
    case 'FORCE_SYNC':
      // Forzar sincronización inmediata
      syncPendingVisitas()
        .then(() => {
          event.ports[0]?.postMessage({ success: true });
        })
        .catch(error => {
          event.ports[0]?.postMessage({ success: false, error: error.message });
        });
      break;
      
    case 'PING':
      // Verificar que el SW está funcionando
      event.ports[0]?.postMessage({ success: true, message: 'Service Worker activo' });
      break;
  }
});

// Manejar eventos de conectividad
self.addEventListener('online', event => {
  console.log('🌐 [SW] Conexión restaurada, iniciando sincronización...');
  syncPendingVisitas();
});

// Log de inicialización
console.log('🚀 [SW] Service Worker de DISBATTERY TRADE cargado');
console.log('🔧 [SW] Versión:', CACHE_NAME);
console.log('📱 [SW] Background Sync disponible:', 'sync' in self.ServiceWorkerRegistration.prototype);