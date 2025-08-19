# 🚀 PLAN PWA - DISBATTERY TRADE APP

## 📋 OBJETIVOS
- ✅ Funcionamiento 100% offline
- ✅ Carga de rutas sin conexión
- ✅ Sincronización automática cuando hay internet
- ✅ Escalabilidad para múltiples usuarios
- ✅ Instalación como app nativa

---

## 🏗️ FASE 1: CONFIGURACIÓN PWA BASE (2-3 días)

### 1.1 Instalación de dependencias
```bash
npm install next-pwa workbox-webpack-plugin
npm install dexie  # Base de datos offline
npm install idb    # IndexedDB wrapper
```

### 1.2 Configuración next.config.ts
```typescript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-cache',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 año
        },
      },
    },
    {
      urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'firebase-images-cache',
        expiration: {
          maxEntries: 1000,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
        },
      },
    },
  ],
});

module.exports = withPWA({
  // configuración existente
});
```

### 1.3 Web App Manifest (public/manifest.json)
```json
{
  "name": "Disbattery Trade App",
  "short_name": "DisbatteryTrade",
  "description": "App para mercaderistas Disbattery",
  "theme_color": "#002D72",
  "background_color": "#ffffff",
  "display": "standalone",
  "orientation": "portrait",
  "scope": "/",
  "start_url": "/",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## 🗄️ FASE 2: BASE DE DATOS OFFLINE (3-4 días)

### 2.1 Estructura IndexedDB con Dexie
```typescript
// src/db/database.ts
import Dexie, { Table } from 'dexie';

export interface Cliente {
  id?: number;
  rif: string;
  nombre: string;
  direccion: string;
  position: { lat: number; lng: number };
  sede: string;
  // ... otros campos
}

export interface Ruta {
  id?: number;
  fecha: string;
  puntos: Cliente[];
  estado: 'planificada' | 'en_progreso' | 'completada';
  syncStatus: 'synced' | 'pending' | 'error';
}

export interface VisitaOffline {
  id?: number;
  visitaId: string;
  clienteRif: string;
  data: any;
  fotos: { [key: string]: string }; // fotos en base64
  timestamp: number;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
}

class DisbatteryDB extends Dexie {
  clientes!: Table<Cliente>;
  rutas!: Table<Ruta>;
  visitas!: Table<VisitaOffline>;

  constructor() {
    super('DisbatteryTradeDB');
    this.version(1).stores({
      clientes: '++id, rif, nombre, sede',
      rutas: '++id, fecha, estado, syncStatus',
      visitas: '++id, visitaId, clienteRif, syncStatus, timestamp'
    });
  }
}

export const db = new DisbatteryDB();
```

### 2.2 Servicios de Sincronización
```typescript
// src/services/sync.ts
export class SyncService {
  static async syncPendingVisitas() {
    const pendingVisitas = await db.visitas
      .where('syncStatus')
      .equals('pending')
      .toArray();

    for (const visita of pendingVisitas) {
      try {
        await this.uploadVisita(visita);
        await db.visitas.update(visita.id!, { syncStatus: 'synced' });
      } catch (error) {
        await db.visitas.update(visita.id!, { syncStatus: 'error' });
      }
    }
  }

  static async saveVisitaOffline(visitaData: any) {
    const visita: VisitaOffline = {
      visitaId: generateUniqueId(),
      clienteRif: visitaData.cliente.rif,
      data: visitaData,
      fotos: visitaData.fotos || {},
      timestamp: Date.now(),
      syncStatus: 'pending'
    };

    await db.visitas.add(visita);
    
    // Intentar sincronizar inmediatamente si hay conexión
    if (navigator.onLine) {
      this.syncPendingVisitas();
    }
  }
}
```

---

## 📱 FASE 3: GESTIÓN OFFLINE DE RUTAS (2-3 días)

### 3.1 Precarga de Rutas
```typescript
// src/hooks/useOfflineRoutes.ts
export function useOfflineRoutes() {
  const downloadRoutesForOffline = async (fechas: string[]) => {
    for (const fecha of fechas) {
      const ruta = await fetchRutaFromFirebase(fecha);
      await db.rutas.put({
        fecha,
        puntos: ruta.puntos,
        estado: ruta.estado,
        syncStatus: 'synced'
      });
      
      // Precargar datos de clientes
      for (const cliente of ruta.puntos) {
        await db.clientes.put(cliente);
      }
    }
  };

  const getRutaOffline = async (fecha: string) => {
    return await db.rutas.where('fecha').equals(fecha).first();
  };

  return { downloadRoutesForOffline, getRutaOffline };
}
```

### 3.2 Componente de Gestión Offline
```typescript
// src/components/OfflineManager.tsx
export function OfflineManager() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      SyncService.syncPendingVisitas();
    }
  }, [isOnline]);

  return (
    <div className="offline-indicator">
      {!isOnline && (
        <div className="bg-orange-500 text-white p-2 text-center">
          📴 Modo Offline - Los datos se sincronizarán cuando tengas conexión
        </div>
      )}
      {pendingSync > 0 && (
        <div className="bg-blue-500 text-white p-2 text-center">
          📤 Sincronizando {pendingSync} visitas pendientes...
        </div>
      )}
    </div>
  );
}
```

---

## 🔄 FASE 4: SINCRONIZACIÓN INTELIGENTE (3-4 días)

### 4.1 Background Sync
```typescript
// public/sw.js (Service Worker personalizado)
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync-visitas') {
    event.waitUntil(syncVisitas());
  }
});

async function syncVisitas() {
  // Lógica de sincronización en background
  const response = await fetch('/api/sync-visitas', {
    method: 'POST',
    body: JSON.stringify({ action: 'sync-pending' })
  });
  return response;
}
```

### 4.2 API Route para Sincronización
```typescript
// src/pages/api/sync-visitas.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    // Procesar visitas pendientes
    // Subir imágenes a Firebase Storage
    // Guardar datos en Firestore
    
    res.status(200).json({ success: true });
  }
}
```

---

## 📸 FASE 5: MANEJO DE IMÁGENES OFFLINE (2-3 días)

### 5.1 Compresión y Almacenamiento Local
```typescript
// src/utils/imageCache.ts
export class ImageCacheService {
  static async saveImageOffline(base64Image: string, key: string): Promise<string> {
    // Comprimir imagen
    const compressedImage = await this.compressImage(base64Image);
    
    // Guardar en IndexedDB
    await db.images.put({
      key,
      data: compressedImage,
      timestamp: Date.now()
    });
    
    return key;
  }

  static async getImageOffline(key: string): Promise<string | null> {
    const image = await db.images.where('key').equals(key).first();
    return image?.data || null;
  }

  static async compressImage(base64: string, quality: number = 0.7): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        // Redimensionar si es muy grande
        const maxWidth = 1024;
        const maxHeight = 1024;
        
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      
      img.src = base64;
    });
  }
}
```

---

## 🎯 FASE 6: TESTING Y OPTIMIZACIÓN (2-3 días)

### 6.1 Testing Offline
- ✅ Probar formularios sin conexión
- ✅ Verificar sincronización automática
- ✅ Validar caché de imágenes
- ✅ Probar con múltiples usuarios

### 6.2 Optimizaciones
- ✅ Lazy loading de componentes
- ✅ Precarga inteligente de datos
- ✅ Limpieza automática de caché antigua
- ✅ Compresión de datos almacenados

---

## 📊 MÉTRICAS Y MONITORING

### 6.3 Dashboard de Estado
```typescript
// Componente para mostrar estado offline
export function OfflineStatus() {
  const [stats, setStats] = useState({
    pendingVisitas: 0,
    cachedRoutes: 0,
    storageUsed: 0
  });

  return (
    <div className="offline-dashboard">
      <h3>📊 Estado Offline</h3>
      <p>Visitas pendientes: {stats.pendingVisitas}</p>
      <p>Rutas cacheadas: {stats.cachedRoutes}</p>
      <p>Almacenamiento usado: {formatBytes(stats.storageUsed)}</p>
    </div>
  );
}
```

---

## 🚀 CRONOGRAMA TOTAL: 15-20 días

| Fase | Días | Descripción |
|------|------|-------------|
| 1 | 2-3 | Configuración PWA base |
| 2 | 3-4 | Base de datos offline |
| 3 | 2-3 | Gestión offline de rutas |
| 4 | 3-4 | Sincronización inteligente |
| 5 | 2-3 | Manejo de imágenes offline |
| 6 | 2-3 | Testing y optimización |

---

## 💡 VENTAJAS DE ESTA SOLUCIÓN

✅ **Offline First**: Funciona sin conexión desde el primer momento
✅ **Sincronización Automática**: Se sincroniza en background cuando hay conexión
✅ **Escalable**: IndexedDB maneja grandes volúmenes de datos
✅ **Instalable**: Se puede instalar como app nativa
✅ **Progresiva**: Mejora la experiencia cuando hay mejor conexión
✅ **Fácil Mantenimiento**: Construida sobre tecnologías web estándar

---

## 🎯 PRÓXIMOS PASOS

1. **Decidir**: ¿Procedemos con este plan?
2. **Priorizar**: ¿Qué fase es más crítica?
3. **Recursos**: ¿Cuántos desarrolladores disponibles?
4. **Timeline**: ¿Hay fecha límite específica?

¿Te parece bien este enfoque? ¿Hay alguna fase que quieras que detalle más? 