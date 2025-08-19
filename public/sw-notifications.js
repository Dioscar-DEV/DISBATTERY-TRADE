// Service Worker para Notificaciones Push - Disbattery Trade
// Este archivo maneja las notificaciones cuando la app está en segundo plano

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuración de Firebase (debe coincidir con tu configuración)
const firebaseConfig = {
  apiKey: "AIzaSyCs73uDqTGuoy2u0fnZgngTqRWhuyIU5l8",
  authDomain: "disbattery-trade.firebaseapp.com",
  projectId: "disbattery-trade",
  storageBucket: "disbattery-trade.firebasestorage.app",
  messagingSenderId: "614937382806",
  appId: "1:614937382806:web:5df489972e5eb4365117b7"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

console.log('🔔 Service Worker de notificaciones iniciado');

/**
 * Maneja mensajes push cuando la app está en segundo plano
 */
messaging.onBackgroundMessage(function(payload) {
  console.log('📨 [SW] Mensaje push recibido en segundo plano:', payload);
  
  const { title, body, icon } = payload.notification || {};
  const data = payload.data || {};
  
  // Configurar opciones de la notificación
  const notificationOptions = {
    body: body || 'Nueva notificación de Disbattery Trade',
    icon: icon || '/icon-base.svg',
    badge: '/icon-base.svg',
    tag: 'disbattery-notification',
    requireInteraction: true,
    actions: [],
    data: {
      ...data,
      clickAction: data.clickAction || '/',
      timestamp: Date.now()
    }
  };
  
  // Agregar acciones específicas según el tipo de notificación
  if (data.type === 'nueva-ruta') {
    notificationOptions.actions = [
      {
        action: 'view-route',
        title: '👀 Ver Ruta',
        icon: '/icon-base.svg'
      },
      {
        action: 'dismiss',
        title: '✖️ Cerrar',
        icon: '/icon-base.svg'
      }
    ];
    notificationOptions.data.clickAction = '/mi-ruta';
  } else if (data.type === 'ruta-editada') {
    notificationOptions.actions = [
      {
        action: 'view-route',
        title: '👀 Ver Cambios',
        icon: '/icon-base.svg'
      },
      {
        action: 'dismiss',
        title: '✖️ Cerrar',
        icon: '/icon-base.svg'
      }
    ];
    notificationOptions.data.clickAction = '/mi-ruta';
  } else if (data.type === 'ruta-completada') {
    notificationOptions.actions = [
      {
        action: 'view-dashboard',
        title: '📊 Ver Dashboard',
        icon: '/icon-base.svg'
      },
      {
        action: 'dismiss',
        title: '✖️ Cerrar',
        icon: '/icon-base.svg'
      }
    ];
    notificationOptions.data.clickAction = '/admin/dashboard';
  }
  
  // Mostrar la notificación
  self.registration.showNotification(
    title || 'Disbattery Trade',
    notificationOptions
  );
});

/**
 * Maneja clics en las notificaciones
 */
self.addEventListener('notificationclick', function(event) {
  console.log('🖱️ [SW] Click en notificación:', event);
  
  const notification = event.notification;
  const data = notification.data || {};
  const action = event.action;
  
  notification.close(); // Cerrar la notificación
  
  // Manejar acciones específicas
  if (action === 'dismiss') {
    console.log('❌ [SW] Notificación descartada por el usuario');
    return;
  }
  
  // Determinar URL de destino
  let targetUrl = '/';
  
  if (action === 'view-route') {
    targetUrl = '/mi-ruta';
  } else if (action === 'view-dashboard') {
    targetUrl = '/admin/dashboard';
  } else if (data.clickAction) {
    targetUrl = data.clickAction;
  }
  
  console.log('🔗 [SW] Abriendo URL:', targetUrl);
  
  // Abrir o enfocar la aplicación
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Buscar si ya hay una ventana abierta de la app
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin)) {
            // Si encontramos una ventana, enfocarla y navegar
            console.log('🪟 [SW] Enfocando ventana existente y navegando a:', targetUrl);
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        
        // Si no hay ventanas abiertas, abrir una nueva
        console.log('🪟 [SW] Abriendo nueva ventana en:', targetUrl);
        return clients.openWindow(targetUrl);
      })
      .catch(function(error) {
        console.error('❌ [SW] Error manejando click de notificación:', error);
      })
  );
});

/**
 * Maneja cierre de notificaciones
 */
self.addEventListener('notificationclose', function(event) {
  console.log('🔕 [SW] Notificación cerrada:', event.notification.tag);
  
  // Aquí podrías enviar analytics o métricas si es necesario
  const data = event.notification.data || {};
  if (data.trackClose) {
    console.log('📊 [SW] Registrando cierre de notificación para analytics');
    // Implementar tracking si es necesario
  }
});

/**
 * Maneja mensajes desde la aplicación principal
 */
self.addEventListener('message', function(event) {
  console.log('📩 [SW] Mensaje recibido desde la app:', event.data);
  
  const { type, payload } = event.data || {};
  
  if (type === 'SHOW_NOTIFICATION' && payload) {
    // Mostrar notificación local solicitada por la app
    const notificationOptions = {
      body: payload.body || 'Notificación de Disbattery Trade',
      icon: payload.icon || '/icon-base.svg',
      badge: '/icon-base.svg',
      tag: 'local-notification',
      requireInteraction: false,
      data: payload.data || {}
    };
    
    self.registration.showNotification(
      payload.title || 'Disbattery Trade',
      notificationOptions
    );
  } else if (type === 'CHECK_SW_STATUS') {
    // Responder con el estado del SW
    event.ports[0].postMessage({
      type: 'SW_STATUS_RESPONSE',
      active: true,
      timestamp: Date.now()
    });
  }
});

/**
 * Evento de instalación del Service Worker
 */
self.addEventListener('install', function(event) {
  console.log('⚙️ [SW] Service Worker de notificaciones instalado');
  self.skipWaiting();
});

/**
 * Evento de activación del Service Worker
 */
self.addEventListener('activate', function(event) {
  console.log('✅ [SW] Service Worker de notificaciones activado');
  event.waitUntil(self.clients.claim());
});

/**
 * Función auxiliar para crear notificaciones de prueba (desarrollo)
 */
function createTestNotification(type = 'test') {
  const notifications = {
    'nueva-ruta': {
      title: '🗺️ Nueva Ruta Asignada',
      body: 'Tienes una nueva ruta para hoy. ¡Toca para verla!',
      data: { type: 'nueva-ruta', clickAction: '/mi-ruta' }
    },
    'ruta-editada': {
      title: '✏️ Ruta Actualizada',
      body: 'Tu ruta ha sido modificada. Revisa los cambios.',
      data: { type: 'ruta-editada', clickAction: '/mi-ruta' }
    },
    'ruta-completada': {
      title: '✅ Ruta Completada',
      body: 'Un mercaderista ha completado su ruta.',
      data: { type: 'ruta-completada', clickAction: '/admin/dashboard' }
    },
    'test': {
      title: '🧪 Notificación de Prueba',
      body: 'El sistema de notificaciones está funcionando correctamente.',
      data: { type: 'test', clickAction: '/' }
    }
  };
  
  const notification = notifications[type] || notifications['test'];
  
  self.registration.showNotification(notification.title, {
    body: notification.body,
    icon: '/icon-base.svg',
    badge: '/icon-base.svg',
    tag: `test-${Date.now()}`,
    requireInteraction: true,
    data: notification.data
  });
  
  console.log(`🧪 [SW] Notificación de prueba "${type}" creada`);
}

// Exponer función de prueba globalmente para debugging
self.createTestNotification = createTestNotification;

console.log('🎯 [SW] Service Worker de notificaciones completamente cargado y listo');