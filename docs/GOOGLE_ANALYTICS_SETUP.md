# 📊 Configuración de Google Analytics para Disbattery Trade

## 🚀 ¿Qué se ha configurado?

Hemos implementado **Google Analytics 4 (GA4)** completamente integrado con Firebase para trackear usuarios activos, comportamiento y métricas importantes de tu PWA.

### ✅ Funcionalidades implementadas:

1. **Tracking de usuarios activos** - Ver usuarios en tiempo real
2. **Eventos de navegación** - Páginas visitadas y tiempo en página
3. **Eventos de PWA** - Instalaciones, lanzamientos, modo offline
4. **Eventos de negocio** - Visitas a clientes, completación de rutas, fotos capturadas
5. **Tracking de errores** - Errores automáticos y de usuario
6. **Propiedades de usuario** - Rol, ruta, ciudad, departamento

## 🔧 Configuración en Firebase Console

### Paso 1: Habilitar Google Analytics en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto **disbattery-trade**
3. En el menú lateral, busca **Analytics** y haz clic
4. Si no está habilitado, haz clic en **"Habilitar Google Analytics"**
5. Sigue los pasos para vincular o crear una cuenta de Google Analytics

### Paso 2: Verificar el Measurement ID

El código ya está configurado con el ID: `G-ZJ2LRH0HDT`

Si necesitas cambiarlo:
1. Ve a **Configuración del proyecto** > **General**
2. En la sección **"Sus apps"**, encuentra tu app web
3. Copia el **measurementId** desde la configuración
4. Actualízalo en `src/firebase/clientApp.ts`

## 📱 Eventos que se están trackeando

### 🔐 Autenticación
- `login` - Cuando un usuario se autentica
- `logout` - Cuando un usuario cierra sesión
- `sign_up` - Nuevos registros

### 📍 Navegación y Páginas
- `page_view` - Cada vez que se visita una página
- `time_spent` - Tiempo transcurrido en cada página
- `navigation` - Navegación entre secciones

### 🚛 Actividades de Ruta
- `route_activity` - Inicio, pausa, completación de rutas
- `route_completed` - Cuando se completa una ruta (con métricas)
- `visit_route` - Cuando se accede a una ruta específica

### 👥 Interacciones con Clientes
- `client_interaction` - Visitas, fotos, formularios de clientes
- `visit_client` - Cuando se visita un cliente específico

### 📱 Eventos PWA
- `pwa_install` - Cuando se instala la PWA
- `pwa_launch` - Cuando se abre desde la PWA instalada
- `offline_mode_change` - Cambios entre online/offline

### 📸 Funcionalidades Específicas
- `photo_capture` - Captura de fotos (signage, merchandising, etc.)
- `form_submission` - Envío de formularios
- `generate_report` - Generación de reportes
- `search` - Búsquedas dentro de la app

### ⚠️ Errores y Performance
- `error` - Errores de la aplicación
- `performance_metric` - Métricas de rendimiento

## 📊 Dónde ver los datos

### 1. Firebase Console
- Ve a **Analytics** > **Eventos** para ver eventos en tiempo real
- **Analytics** > **Usuarios** para ver usuarios activos
- **Analytics** > **Audience** para demografia y comportamiento

### 2. Google Analytics 4
- Ve a [analytics.google.com](https://analytics.google.com)
- Selecciona tu propiedad **disbattery-trade**
- Ve a **Informes** > **Tiempo real** para usuarios activos AHORA
- **Informes** > **Participación** > **Eventos** para eventos personalizados

### 3. Dashboards Recomendados

#### Dashboard de Mercaderistas Activos:
- **Usuarios activos** (últimos 30 minutos, hoy, 7 días)
- **Eventos de `route_activity`** por día
- **Eventos de `client_interaction`** por mercaderista
- **Eventos de `route_completed`** con número de visitas

#### Dashboard PWA:
- **Eventos de `pwa_install`** por día/semana
- **Eventos de `pwa_launch`** vs navegador web
- **Eventos de `offline_mode_change`** para uso offline

## 💻 Cómo usar Analytics en tu código

### Importar el hook
```typescript
import { useAnalytics } from '@/hooks/useAnalytics';

const analytics = useAnalytics();
```

### Ejemplos de uso

#### Trackear navegación
```typescript
await analytics.trackNavigation('dashboard', 'menu_click');
```

#### Trackear interacción con cliente
```typescript
await analytics.trackClientInteraction(
  clientId,
  clientName,
  'photo',
  { photo_type: 'merchandising' }
);
```

#### Trackear finalización de ruta
```typescript
await analytics.trackRouteActivity(routeId, 'complete', 100);
```

#### Evento personalizado
```typescript
await analytics.logEvent('custom_event', {
  custom_parameter: 'value',
  timestamp: new Date().toISOString()
});
```

### Actualizar propiedades del usuario
```typescript
await analytics.updateUserData(userId, {
  role: 'mercaderista',
  route_name: 'Ruta Centro',
  city: 'Caracas',
  department: 'Distrito Capital'
});
```

## 🎯 Métricas Clave que Puedes Monitorear

### 📈 Engagement
- **Usuarios activos diarios/semanales/mensuales**
- **Tiempo promedio en la app**
- **Páginas más visitadas**
- **Tasa de retención**

### 💼 Métricas de Negocio
- **Rutas completadas por día**
- **Promedio de visitas por mercaderista**
- **Clientes más visitados**
- **Tiempo promedio por visita**
- **Uso de funcionalidades (fotos, formularios, reportes)**

### 📱 Rendimiento PWA
- **Instalaciones de PWA por día**
- **Uso en modo standalone vs browser**
- **Frecuencia de uso offline**
- **Errores más comunes**

### 🗺️ Geográficas
- **Actividad por ciudad/departamento**
- **Rutas más activas**
- **Distribución geográfica de usuarios**

## 🔔 Configurar Alertas Personalizadas

En Google Analytics, puedes crear alertas para:

1. **Caída en usuarios activos** (< 10 usuarios en 24h)
2. **Aumento de errores** (> 5 errores por hora)
3. **Rutas no completadas** (0 route_completed en un día laboral)
4. **Problemas de PWA** (0 pwa_launch en 24h)

## 🚀 Próximos Pasos

1. **Dashboards personalizados**: Crea dashboards específicos para supervisores
2. **Reportes automáticos**: Configura reportes semanales por email
3. **Segmentación avanzada**: Analiza comportamiento por rol, ciudad, ruta
4. **A/B Testing**: Testa nuevas funcionalidades con diferentes grupos de usuarios
5. **Embudos de conversión**: Analiza el flujo de visita completa

## 🛠️ Troubleshooting

### No veo eventos en Analytics
1. Verifica que el measurementId sea correcto
2. Abre las herramientas de desarrollador y ve si hay errores en la consola
3. Los eventos pueden tardar hasta 24h en aparecer en reportes (pero aparecen inmediatamente en tiempo real)

### Los eventos no se disparan
1. Verifica que `AnalyticsInitializer` esté en el layout principal
2. Confirma que el usuario haya dado consentimiento para cookies/tracking
3. Verifica que no esté bloqueado por adblockers

### Datos inconsistentes
1. Los eventos de tiempo real son inmediatos, los reportes tardan 24-48h
2. Firebase Analytics puede mostrar datos ligeramente diferentes a GA4
3. Usuarios offline pueden generar eventos cuando se reconectan

---

## 📞 Soporte

Si necesitas ayuda configurando dashboards específicos o métricas adicionales, contacta con el equipo de desarrollo con ejemplos específicos de lo que quieres trackear.

**¡Tu app ahora está completamente instrumentada con Analytics! 🎉**