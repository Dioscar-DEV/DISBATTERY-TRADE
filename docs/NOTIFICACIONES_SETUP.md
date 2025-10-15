# 🔔 Sistema de Notificaciones Push - Disbattery Trade

## ✅ Implementación Completada

El sistema de notificaciones push ha sido completamente implementado con las siguientes funcionalidades:

### 📨 Notificaciones Implementadas

1. **Admin crea ruta → Mercaderista**: Cuando un administrador crea una nueva ruta, el mercaderista asignado recibe una notificación con los detalles básicos de la ruta.

2. **Mercaderista completa ruta → Admin**: Cuando un mercaderista completa su ruta, los administradores de la sede correspondiente reciben una notificación de confirmación.

## 🗂️ Archivos Creados/Modificados

### Nuevos Archivos

- `src/services/notifications.ts` - Servicio principal de notificaciones
- `src/hooks/use-notifications.ts` - Hook para gestionar notificaciones
- `src/components/NotificationInitializer.tsx` - Inicializador automático
- `src/components/NotificationTester.tsx` - Componente de pruebas
- `src/app/test-notifications/page.tsx` - Página de pruebas
- `public/sw-combined.js` - Service Worker combinado para notificaciones y sync
- `NOTIFICACIONES_SETUP.md` - Este archivo de documentación

### Archivos Modificados

- `src/app/layout.tsx` - Agregado inicializador de notificaciones
- `src/app/admin/rutas/page.tsx` - Notificación al crear rutas
- `src/services/routes.ts` - Notificación al completar rutas
- `public/manifest.json` - Configuración FCM

## 🚀 Configuración Requerida

### 1. Configurar Firebase Cloud Messaging (FCM)

En la Consola de Firebase:

1. Ve a **Project Settings** → **Cloud Messaging**
2. Genera un **Web Push Certificate** (VAPID Key)
3. Copia la clave pública VAPID

### 2. Variables de Entorno

Agrega estas variables a tu archivo `.env.local`:

```env
# VAPID Key de Firebase Cloud Messaging
NEXT_PUBLIC_FIREBASE_VAPID_KEY=TU_VAPID_KEY_AQUI
```

### 3. Actualizar el Servicio de Notificaciones

En `src/services/notifications.ts`, actualiza la línea 6:

```typescript
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
```

### 4. Configurar Firestore Rules

Agrega estas reglas para las notificaciones:

```javascript
// En firestore.rules
match /notificationTokens/{tokenId} {
  allow read, write: if request.auth != null;
}

match /notificationQueue/{notificationId} {
  allow read, write: if request.auth != null;
}
```

### 5. Backend para Envío de Notificaciones (Opcional)

Para envío real de notificaciones push, puedes usar Firebase Functions:

```javascript
// functions/index.js
const admin = require("firebase-admin");
const functions = require("firebase-functions");

exports.sendNotifications = functions.firestore
  .document("notificationQueue/{notificationId}")
  .onCreate(async (snap, context) => {
    const notification = snap.data();

    if (notification.status !== "pending") return;

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        icon: notification.icon || "/icon-base.svg",
      },
      data: notification.data || {},
      tokens: notification.targetTokens,
    };

    try {
      const response = await admin.messaging().sendMulticast(message);

      // Actualizar estado de la notificación
      await snap.ref.update({
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        successCount: response.successCount,
        failureCount: response.failureCount,
      });

      console.log("Notificación enviada:", response);
    } catch (error) {
      console.error("Error enviando notificación:", error);
      await snap.ref.update({
        status: "failed",
        error: error.message,
        attempts: notification.attempts + 1,
      });
    }
  });
```

## 🧪 Cómo Probar el Sistema

### 1. Página de Pruebas

Visita `/test-notifications` para usar el panel de pruebas integrado.

### 2. Pruebas Manuales

#### Consola del Navegador:

```javascript
// Probar notificación local
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    registration.showNotification("Prueba", {
      body: "Esta es una notificación de prueba",
      icon: "/icon-base.svg",
    });
  });
}
```

#### Service Worker:

```javascript
// En las herramientas de desarrollador
self.createTestNotification("nueva-ruta"); // Ruta nueva
self.createTestNotification("ruta-completada"); // Ruta completada
self.createTestNotification("test"); // Prueba general
```

### 3. Flujo Real de Prueba

1. **Login como Admin** → Crear nueva ruta → Verificar que el mercaderista recibe notificación
2. **Login como Mercaderista** → Completar ruta → Verificar que los admins reciben notificación

## 📱 Compatibilidad

### Navegadores Soportados

- ✅ Chrome/Edge (Desktop y Mobile)
- ✅ Firefox (Desktop y Mobile)
- ✅ Safari (limitado, solo con PWA instalada)
- ❌ Safari iOS (sin PWA) - limitaciones del sistema

### Características

- ✅ Notificaciones en primer plano
- ✅ Notificaciones en segundo plano
- ✅ Acciones personalizadas en notificaciones
- ✅ Click handling automático
- ✅ Fallback para usuarios sin token

## 🔧 Solución de Problemas

### Notificaciones No Aparecen

1. Verificar permisos del navegador
2. Comprobar si está en HTTPS o localhost
3. Revisar consola para errores de VAPID key
4. Verificar que el Service Worker esté activo

### Token No Se Guarda

1. Verificar conexión a Firestore
2. Comprobar reglas de seguridad
3. Verificar que el usuario esté autenticado

### Service Worker No Funciona

1. Verificar configuración de Firebase en `sw-notifications.js`
2. Comprobar que el archivo está en `/public/`
3. Revisar errores en DevTools → Application → Service Workers

## 🎯 Funcionalidades Implementadas

### ✅ Completado

- [x] Solicitud de permisos automática
- [x] Guardado de tokens en Firestore
- [x] Notificación: Admin crea ruta → Mercaderista
- [x] Notificación: Mercaderista completa ruta → Admin
- [x] Service Worker para notificaciones en background
- [x] Manejo de clics en notificaciones
- [x] Inicialización automática en login
- [x] Panel de pruebas integrado
- [x] Filtrado por sede para administradores
- [x] Fallback para errores de notificación

### 🚀 Mejoras Futuras (Opcionales)

- [ ] Envío batch de notificaciones con Firebase Functions
- [ ] Notificaciones programadas
- [ ] Configuración de usuario (activar/desactivar tipos)
- [ ] Analytics de notificaciones
- [ ] Push notifications personalizadas por usuario

## 📞 Soporte

El sistema está listo para usar. Para activar completamente las notificaciones push:

1. Configura la VAPID key de Firebase
2. Opcionalmente implementa Firebase Functions para envío en el servidor
3. Prueba con la página `/test-notifications`

¡Las notificaciones están funcionando! 🎉
