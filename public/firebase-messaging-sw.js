// Firebase Messaging Service Worker
// Este archivo es requerido por Firebase Cloud Messaging

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

console.log('🔥 Firebase Messaging Service Worker iniciado');

// Manejar mensajes push en segundo plano
messaging.onBackgroundMessage(function(payload) {
  console.log('📨 [Firebase SW] Mensaje recibido en segundo plano:', payload);
  
  const { title, body, icon } = payload.notification || {};
  const data = payload.data || {};
  
  // Mostrar la notificación
  const notificationTitle = title || 'Disbattery Trade';
  const notificationOptions = {
    body: body || 'Nueva notificación',
    icon: icon || '/icon-base.svg',
    badge: '/icon-base.svg',
    tag: 'disbattery-notification',
    requireInteraction: true,
    data: {
      ...data,
      clickAction: data.clickAction || '/',
      timestamp: Date.now()
    }
  };

  // Agregar acciones según el tipo
  if (data.type === 'nueva-ruta' || data.type === 'ruta-editada') {
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

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', function(event) {
  console.log('🖱️ [Firebase SW] Click en notificación:', event);
  
  const notification = event.notification;
  const data = notification.data || {};
  const action = event.action;
  
  notification.close();
  
  if (action === 'dismiss') {
    console.log('❌ [Firebase SW] Notificación descartada');
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
  
  console.log('🔗 [Firebase SW] Navegando a:', targetUrl);
  
  // Abrir o enfocar la aplicación
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Buscar ventana existente
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        
        // Abrir nueva ventana
        return clients.openWindow(targetUrl);
      })
      .catch(function(error) {
        console.error('❌ [Firebase SW] Error:', error);
      })
  );
});

console.log('✅ Firebase Messaging Service Worker listo');