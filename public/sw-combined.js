/**
 * Service Worker combinado para DISBATTERY TRADE
 * - Contiene la lógica principal de sincronización y cache (sw-sync.js)
 * - Integra el manejo de notificaciones push (sw-notifications.js)
 *
 * Documentación: este archivo actúa como único Service Worker de la app
 * para evitar registros duplicados y mantener una única fuente de verdad.
 * Comentarios en español; nombres y funciones en inglés.
 */

/* ===== Guard to avoid double-initialization when imported multiple times ===== */
if (self.__DISBATTERY_SW_INITIALIZED) {
  console.log('⚠️ [SW] sw-combined already initialized — skipping re-registration');
} else {
  self.__DISBATTERY_SW_INITIALIZED = true;

  /* ===== SW: cache y background sync (base tomada de sw-sync.js) ===== */
const CACHE_NAME = 'disbattery-offline-v1';
const SYNC_TAG = 'background-sync-visitas';
const DB_NAME = 'DisbatteryOfflineDB';
const DB_VERSION = 1;

  const CRITICAL_RESOURCES = [
  '/',
  '/mi-ruta', '/mi-ruta/',
  '/visit-capture', '/visit-capture/',
  '/signage-capture', '/signage-capture/',
  '/shell-merchandising', '/shell-merchandising/',
  '/qualid-merchandising', '/qualid-merchandising/',
  '/observaciones', '/observaciones/',
  '/reportes-finales', '/reportes-finales/',
  '/ventas-productos', '/ventas-productos/',
  '/trade-eventos', '/trade-eventos/',
  '/trade-impulso', '/trade-impulso/',
  '/shell-material-interno', '/shell-material-interno/',
  '/instalar', '/instalar/',
  '/registro-exitoso', '/registro-exitoso/',
  '/offline.html',
  '/manifest.json'
  ];

  self.addEventListener('install', event => {
    console.log('🔧 [SW] Service Worker instalándose...');
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(CRITICAL_RESOURCES))
        .then(() => self.skipWaiting())
        .catch(err => console.error('❌ [SW] Install error:', err))
    );
  });

  self.addEventListener('activate', event => {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))).then(() => self.clients.claim())
    );
  });

  self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    if (!url.protocol.startsWith('http')) return;

    if (url.origin === self.location.origin) {
      event.respondWith(handleAppRequest(request));
    } else {
      event.respondWith(handleExternalRequest(request));
    }
  });

async function handleAppRequest(request) {
  try {
    if (request.mode === 'navigate') {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        // Estrategia de Cache con normalización de URL y ignoreSearch
        const cache = await caches.open(CACHE_NAME);
        const matchOptions = { ignoreSearch: true };
        
        // 1. Intentar match exacto
        let cached = await cache.match(request, matchOptions);
        if (cached) return cached;

        // 2. Intentar normalizando slash (si tiene, quitarlo; si no, ponerlo)
        const url = new URL(request.url);
        const hasSlash = url.pathname.endsWith('/');
        const altPath = hasSlash ? url.pathname.slice(0, -1) : url.pathname + '/';
        const altUrl = new URL(altPath, url.origin).toString();
        
        cached = await cache.match(altUrl, matchOptions);
        if (cached) return cached;

        // 3. Fallback a App Shell (/) para mantener la SPA funcionando
        const appShell = await cache.match('/');
        if (appShell) return appShell;

        // 4. Fallback a offline.html si todo falla
        return cache.match('/offline.html') || new Response('Aplicación offline', { status: 503 });
      }
    }

    const cached = await caches.match(request);
    if (cached) return cached;
    const net = await fetch(request);
    const contentType = net.headers.get('content-type') || '';
    if (net.ok && !contentType.includes('text/html')) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, net.clone());
    }
    return net;
  } catch (err) {
    return new Response('Error de red', { status: 503 });
  }
}

async function handleExternalRequest(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;
    const net = await fetch(request);
    if (net.ok && shouldCacheExternalResource(request)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, net.clone());
    }
    return net;
  } catch (err) {
    if (request.destination === 'image') return new Response('', { status: 204 });
    return new Response('Recurso no disponible offline', { status: 503 });
  }
}

function shouldCacheExternalResource(request) {
  const url = new URL(request.url);
  if (url.hostname.includes('firebasestorage.googleapis.com') || url.hostname.includes('storage.googleapis.com')) return true;
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) return true;
  return false;
}

// Background sync listeners
self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG) {
    // Notificar a las páginas controladas para que procesen la cola (upload pesado)
    notifyClients('SYNC_TRIGGER', { tag: event.tag });

    // Intentar sincronización ligera desde el SW (fallback)
    event.waitUntil(
      (async () => {
        try {
          await syncPendingVisitas();
        } catch (err) {
          console.error('❌ [SW] syncPendingVisitas error:', err);
        }
      })()
    );
  }
});

// También escuchar evento online global en el SW y notificar a clientes
  self.addEventListener('online', () => {
    notifyClients('SYNC_TRIGGER', { source: 'online' });
  });

/* ===== Lógica de sincronización (simplificada) ===== */
  async function syncPendingVisitas() {
  try {
    if (!navigator.onLine) return;
    const db = await openIndexedDB();
    if (!db) return;
    const pending = await getPendingVisitasFromDB(db);
    if (!pending || pending.length === 0) return;
    let synced = 0;
    for (const v of pending) {
      try {
        const ok = await syncSingleVisita(v);
        if (ok) { await removeVisitaFromDB(db, v.id); synced++; }
      } catch (e) { console.error('❌ [SW] Error sync visita', e); }
    }
    if (synced > 0) notifyClients('sync-complete', { syncedCount: synced, totalPending: pending.length });
  } catch (err) {
    console.error('❌ [SW] Error during syncPendingVisitas', err);
  }
  }

  function openIndexedDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
  }

  function getPendingVisitasFromDB(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['visitas_pendientes'], 'readonly');
      const store = tx.objectStore('visitas_pendientes');
      const index = store.index('status');
      const req = index.getAll('pending');
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function syncSingleVisita(visita) {
  try {
    // Lógica simplificada: marcar como procesada (sin subir fotos en SW)
    console.log('[SW] syncing visita', visita.id);
    return true;
  } catch (err) {
    console.error('❌ [SW] Error syncSingleVisita', err);
    return false;
  }
  }

  function removeVisitaFromDB(db, visitaId) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['visitas_pendientes'], 'readwrite');
      const store = tx.objectStore('visitas_pendientes');
      const req = store.delete(visitaId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function notifyClients(type, data) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(c => c.postMessage({ type, data }));
  }

/* ===== Integración de notificaciones (base tomada de sw-notifications.js) ===== */
// Importar Firebase Messaging compat para manejar mensajes en background
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuración Firebase mínima (debe coincidir con cliente)
const firebaseConfig = {
  apiKey: "AIzaSyCs73uDqTGuoy2u0fnZgngTqRWhuyIU5l8",
  authDomain: "disbattery-trade.firebaseapp.com",
  projectId: "disbattery-trade",
  storageBucket: "disbattery-trade.firebasestorage.app",
  messagingSenderId: "614937382806",
  appId: "1:614937382806:web:5df489972e5eb4365117b7"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function(payload) {
    const { title, body, icon } = payload.notification || {};
    const data = payload.data || {};
    const notificationOptions = {
      body: body || 'Nueva notificación',
      icon: icon || '/icon-base.svg',
      badge: '/icon-base.svg',
      tag: 'disbattery-notification',
      requireInteraction: true,
      data: { ...data, clickAction: data.clickAction || '/', timestamp: Date.now() }
    };

    if (data.type === 'nueva-ruta') {
      notificationOptions.actions = [{ action: 'view-route', title: '👀 Ver Ruta', icon: '/icon-base.svg' }, { action: 'dismiss', title: '✖️ Cerrar', icon: '/icon-base.svg' }];
      notificationOptions.data.clickAction = '/mi-ruta';
    }

    self.registration.showNotification(title || 'Disbattery Trade', notificationOptions);
  });

  self.addEventListener('notificationclick', function(event) {
    const notification = event.notification;
    const data = notification.data || {};
    const action = event.action;
    notification.close();
    if (action === 'dismiss') return;
    let targetUrl = '/';
    if (action === 'view-route') targetUrl = '/mi-ruta';
    else if (action === 'view-dashboard') targetUrl = '/admin/dashboard';
    else if (data.clickAction) targetUrl = data.clickAction;

    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    }).catch(err => console.error('❌ [SW] Error handling notification click', err)));
  });

  self.addEventListener('notificationclose', function(event) {
    const data = event.notification.data || {};
    if (data.trackClose) { /* enviar analytics si se requiere */ }
  });

  // Mensajes desde la aplicación
  self.addEventListener('message', function(event) {
    const { type, payload } = event.data || {};
    if (type === 'SHOW_NOTIFICATION' && payload) {
      self.registration.showNotification(payload.title || 'Disbattery Trade', { body: payload.body || '', icon: payload.icon || '/icon-base.svg', badge: '/icon-base.svg', tag: 'local-notification', data: payload.data || {} });
    } else if (type === 'CHECK_SW_STATUS') {
      event.ports[0]?.postMessage({ type: 'SW_STATUS_RESPONSE', active: true, timestamp: Date.now() });
    }
  });

  console.log('🎯 [SW] Combined Service Worker loaded');

} // end init guard


