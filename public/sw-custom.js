// Custom Service Worker logic — imported into workbox's sw.js via importScripts
// Contains: activation handler, precache logic, Firebase messaging, background sync

// ============================================================
// 1. ACTIVATION: Clear stale runtime caches and notify clients
//    (workbox precache cache is NOT affected — only runtime caches)
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Only clear RUNTIME caches, never the workbox precache
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name === 'next-chunks' || name === 'static-cache' || name === 'pages-cache')
          .map(name => {
            console.log(`[SW-Custom] Clearing runtime cache on activation: ${name}`);
            return caches.delete(name);
          })
      );

      // Notify all open tabs/PWA windows to reload with new assets
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => {
        client.postMessage({ type: 'SW_ACTIVATED_NEW_VERSION' });
      });

      console.log(`[SW-Custom] New SW activated, cleared runtime caches, notified ${clients.length} clients`);
    })()
  );
});

// ============================================================
// NOTE: Do NOT add a fetch event listener here for chunks.
// sw-custom.js is imported BEFORE workbox's routing via importScripts.
// Any event.respondWith() here would BLOCK workbox's precacheAndRoute
// from serving cached chunks offline.
// ============================================================

// ============================================================
// 2. PRECACHE MESSAGES: Handle manual precache requests from client
// ============================================================
self.addEventListener('message', async (event) => {
  if (!event.data) return;

  // --- PRECACHE_URLS: Fetch pages + extract and cache their chunks ---
  if (event.data.type === 'PRECACHE_URLS') {
    const { urls } = event.data.payload || event.data.data || {};
    if (!urls || !Array.isArray(urls)) return;

    console.log('[SW-Custom] Starting manual precache for:', urls);

    const pagesCacheName = 'pages-cache';
    const chunksCacheName = 'next-chunks';

    try {
      const pagesCache = await caches.open(pagesCacheName);
      const chunksCache = await caches.open(chunksCacheName);

      const results = await Promise.all(urls.map(async (url) => {
        try {
          console.log(`[SW-Custom] Fetching page: ${url}`);
          const response = await fetch(url, {
            headers: { 'Cache-Control': 'no-cache' }
          });

          if (!response.ok) throw new Error(`Status ${response.status}`);

          const responseToCache = response.clone();
          const responseForParsing = response.clone();

          await pagesCache.put(url, responseToCache);

          const html = await responseForParsing.text();

          const chunkRegex = /src="(\/_next\/static\/chunks\/[^"]+\.js)"/g;
          const cssRegex = /href="(\/_next\/static\/css\/[^"]+\.css)"/g;

          const resources = new Set();
          let match;

          while ((match = chunkRegex.exec(html)) !== null) {
            resources.add(match[1]);
          }
          while ((match = cssRegex.exec(html)) !== null) {
            resources.add(match[1]);
          }

          console.log(`[SW-Custom] Found ${resources.size} resources for ${url}`);

          await Promise.all(Array.from(resources).map(async (resUrl) => {
            try {
              const targetCache = resUrl.endsWith('.css') ? pagesCache : chunksCache;
              const resResponse = await fetch(resUrl);
              if (resResponse.ok) {
                await targetCache.put(resUrl, resResponse);
              }
            } catch (e) {
              console.warn(`[SW-Custom] Failed to fetch resource ${resUrl}`, e);
            }
          }));

          return { url, success: true };
        } catch (err) {
          console.error(`[SW-Custom] Error precaching ${url}:`, err);
          return { url, success: false, error: err.toString() };
        }
      }));

      console.log('[SW-Custom] Manual precache completed');

      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ type: 'PRECACHE_COMPLETE', success: true, results });
      }
    } catch (error) {
      console.error('[SW-Custom] Critical error in precache handler:', error);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: false, error: error.toString() });
      }
    }
  }

  // --- PRECACHE_APP_SHELL: Acknowledge (workbox handles the actual precache) ---
  if (event.data.type === 'PRECACHE_APP_SHELL') {
    console.log('[SW-Custom] PRECACHE_APP_SHELL received (workbox handles precache)');
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true });
    }
  }

  // --- REGISTER_SYNC: Register background sync tag ---
  if (event.data.type === 'REGISTER_SYNC') {
    try {
      if (self.registration.sync) {
        await self.registration.sync.register('background-sync-visitas');
        console.log('[SW-Custom] Background sync registered');
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      } else {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: false, error: 'Sync API not supported' });
        }
      }
    } catch (err) {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: false, error: err.toString() });
      }
    }
  }

  // --- FORCE_SYNC: Trigger immediate sync ---
  if (event.data.type === 'FORCE_SYNC') {
    try {
      await syncPendingVisitas();
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    } catch (err) {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: false, error: err.toString() });
      }
    }
  }

  // --- PING: Health check ---
  if (event.data.type === 'PING') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true, timestamp: Date.now() });
    }
  }

  // --- CHECK_SW_STATUS: Status check ---
  if (event.data.type === 'CHECK_SW_STATUS') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ type: 'SW_STATUS_RESPONSE', active: true, success: true, timestamp: Date.now() });
    }
  }

  // --- SHOW_NOTIFICATION: Show a local notification ---
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const payload = event.data.data || event.data.payload || {};
    self.registration.showNotification(payload.title || 'Disbattery Trade', {
      body: payload.body || '',
      icon: payload.icon || '/icon-base.svg',
      badge: '/icon-base.svg',
      tag: 'local-notification',
      data: payload.data || {}
    });
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true });
    }
  }
});

// ============================================================
// 3. BACKGROUND SYNC: Sync pending visitas when connection returns
// ============================================================
const SYNC_TAG = 'background-sync-visitas';
const DB_NAME = 'DisbatteryOfflineDB';
const DB_VERSION = 1;

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    // Notify clients to trigger sync from the app (handles heavy uploads)
    event.waitUntil(
      (async () => {
        try {
          const allClients = await self.clients.matchAll({ includeUncontrolled: true });
          allClients.forEach(c => c.postMessage({ type: 'SYNC_TRIGGER', data: { tag: event.tag } }));
          await syncPendingVisitas();
        } catch (err) {
          console.error('[SW-Custom] syncPendingVisitas error:', err);
        }
      })()
    );
  }
});

async function syncPendingVisitas() {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const db = await openIndexedDB();
    if (!db) return;
    const pending = await getPendingVisitasFromDB(db);
    if (!pending || pending.length === 0) return;
    let synced = 0;
    for (const v of pending) {
      try {
        const ok = await syncSingleVisita(v);
        if (ok) { await removeVisitaFromDB(db, v.id); synced++; }
      } catch (e) { console.error('[SW-Custom] Error sync visita', e); }
    }
    if (synced > 0) {
      const allClients = await self.clients.matchAll({ includeUncontrolled: true });
      allClients.forEach(c => c.postMessage({ type: 'sync-complete', data: { syncedCount: synced, totalPending: pending.length } }));
    }
  } catch (err) {
    console.error('[SW-Custom] Error during syncPendingVisitas', err);
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
    try {
      const tx = db.transaction(['visitas_pendientes'], 'readonly');
      const store = tx.objectStore('visitas_pendientes');
      const index = store.index('status');
      const req = index.getAll('pending');
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } catch (e) {
      // Store might not exist yet
      resolve([]);
    }
  });
}

async function syncSingleVisita(visita) {
  try {
    console.log('[SW-Custom] syncing visita', visita.id);
    return true;
  } catch (err) {
    console.error('[SW-Custom] Error syncSingleVisita', err);
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

// ============================================================
// 4. FIREBASE CLOUD MESSAGING: Handle background push notifications
// ============================================================
try {
  importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

  const firebaseConfig = {
    apiKey: "AIzaSyCs73uDqTGuoy2u0fnZgngTqRWhuyIU5l8",
    authDomain: "disbattery-trade.firebaseapp.com",
    projectId: "disbattery-trade",
    storageBucket: "disbattery-trade.firebasestorage.app",
    messagingSenderId: "614937382806",
    appId: "1:614937382806:web:5df489972e5eb4365117b7"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function(payload) {
    const { title, body, icon } = payload.notification || {};
    const data = payload.data || {};
    const notificationOptions = {
      body: body || 'Nueva notificacion',
      icon: icon || '/icon-base.svg',
      badge: '/icon-base.svg',
      tag: 'disbattery-notification',
      requireInteraction: true,
      data: { ...data, clickAction: data.clickAction || '/', timestamp: Date.now() }
    };

    if (data.type === 'nueva-ruta') {
      notificationOptions.actions = [
        { action: 'view-route', title: 'Ver Ruta', icon: '/icon-base.svg' },
        { action: 'dismiss', title: 'Cerrar', icon: '/icon-base.svg' }
      ];
      notificationOptions.data.clickAction = '/mi-ruta';
    }

    self.registration.showNotification(title || 'Disbattery Trade', notificationOptions);
  });

  console.log('[SW-Custom] Firebase Messaging initialized');
} catch (e) {
  console.warn('[SW-Custom] Firebase Messaging init failed (non-critical):', e.message);
}

// ============================================================
// 5. NOTIFICATION CLICK/CLOSE handlers
// ============================================================
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

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }).catch(err => console.error('[SW-Custom] Error handling notification click', err))
  );
});

self.addEventListener('notificationclose', function(event) {
  const data = event.notification.data || {};
  if (data.trackClose) { /* analytics if needed */ }
});

console.log('[SW-Custom] Custom Service Worker loaded (precache + sync + FCM)');
