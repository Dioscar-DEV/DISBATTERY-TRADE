# Documentación de Servicios y APIs

## Descripción General

Esta documentación describe los servicios y APIs desarrollados para el sistema Visita Rápida, incluyendo servicios de datos, autenticación, notificaciones, y más.

## Servicios de Datos

### ExportService

**Ubicación**: `src/services/exportService.ts`

Servicio principal para la exportación de datos de visitas.

#### Métodos

##### `exportarVisitas(filtros, opciones)`

```typescript
async exportarVisitas(
  filtros: ExportFilters = {},
  opciones: ExportOptions
): Promise<ExportResult>
```

**Parámetros:**
- `filtros`: Filtros de búsqueda (opcional)
- `opciones`: Opciones de exportación

**Retorna:** Promesa con resultado de exportación

**Ejemplo:**
```typescript
const resultado = await exportService.exportarVisitas(
  { tipoVisita: 'Merchandising' },
  { formato: 'csv', incluirFotos: true }
);
```

##### `obtenerEstadisticasExportacion(filtros)`

```typescript
async obtenerEstadisticasExportacion(
  filtros: ExportFilters = {}
): Promise<EstadisticasExportacion>
```

**Parámetros:**
- `filtros`: Filtros de búsqueda (opcional)

**Retorna:** Promesa con estadísticas

**Ejemplo:**
```typescript
const stats = await exportService.obtenerEstadisticasExportacion({
  mercaderista: 'Juan Pérez'
});
```

##### `descargarArchivo(data, filename, mimeType)`

```typescript
descargarArchivo(data: any, filename: string, mimeType: string): void
```

**Parámetros:**
- `data`: Datos del archivo
- `filename`: Nombre del archivo
- `mimeType`: Tipo MIME

**Ejemplo:**
```typescript
exportService.descargarArchivo(csvData, 'visitas.csv', 'text/csv');
```

### VisitasService

**Ubicación**: `src/services/visitas.ts`

Servicio para el manejo de visitas.

#### Métodos

##### `crearVisita(visita)`

```typescript
async crearVisita(visita: Visita): Promise<string>
```

**Parámetros:**
- `visita`: Datos de la visita

**Retorna:** ID de la visita creada

**Ejemplo:**
```typescript
const visitaId = await visitasService.crearVisita({
  mercaderista: 'Juan Pérez',
  tipoVisita: 'Merchandising',
  ubicacion: { lat: 10.123, lng: -66.456 }
});
```

##### `obtenerVisitas(filtros)`

```typescript
async obtenerVisitas(filtros?: FiltrosVisita): Promise<Visita[]>
```

**Parámetros:**
- `filtros`: Filtros de búsqueda (opcional)

**Retorna:** Array de visitas

**Ejemplo:**
```typescript
const visitas = await visitasService.obtenerVisitas({
  mercaderista: 'Juan Pérez',
  fechaDesde: new Date('2024-01-01')
});
```

##### `actualizarVisita(id, datos)`

```typescript
async actualizarVisita(id: string, datos: Partial<Visita>): Promise<void>
```

**Parámetros:**
- `id`: ID de la visita
- `datos`: Datos a actualizar

**Ejemplo:**
```typescript
await visitasService.actualizarVisita('visita123', {
  sincronizadoN8N: true
});
```

### SyncService

**Ubicación**: `src/services/syncService.ts`

Servicio para sincronización de datos.

#### Métodos

##### `sincronizarVisitas()`

```typescript
async sincronizarVisitas(): Promise<SyncResult>
```

**Retorna:** Resultado de sincronización

**Ejemplo:**
```typescript
const resultado = await syncService.sincronizarVisitas();
console.log(`Sincronizadas: ${resultado.sincronizadas}`);
```

##### `obtenerEstadoSincronizacion()`

```typescript
async obtenerEstadoSincronizacion(): Promise<EstadoSincronizacion>
```

**Retorna:** Estado actual de sincronización

**Ejemplo:**
```typescript
const estado = await syncService.obtenerEstadoSincronizacion();
console.log(`Pendientes: ${estado.pendientes}`);
```

## Servicios de Autenticación

### AuthService

**Ubicación**: `src/services/auth.ts`

Servicio para autenticación de usuarios.

#### Métodos

##### `iniciarSesion(email, password)`

```typescript
async iniciarSesion(email: string, password: string): Promise<Usuario>
```

**Parámetros:**
- `email`: Correo electrónico
- `password`: Contraseña

**Retorna:** Datos del usuario

**Ejemplo:**
```typescript
const usuario = await authService.iniciarSesion(
  'usuario@ejemplo.com',
  'password123'
);
```

##### `cerrarSesion()`

```typescript
async cerrarSesion(): Promise<void>
```

**Ejemplo:**
```typescript
await authService.cerrarSesion();
```

##### `obtenerUsuarioActual()`

```typescript
async obtenerUsuarioActual(): Promise<Usuario | null>
```

**Retorna:** Usuario actual o null

**Ejemplo:**
```typescript
const usuario = await authService.obtenerUsuarioActual();
if (usuario) {
  console.log(`Usuario: ${usuario.nombre}`);
}
```

##### `verificarPermisos(permiso)`

```typescript
async verificarPermisos(permiso: string): Promise<boolean>
```

**Parámetros:**
- `permiso`: Permiso a verificar

**Retorna:** true si tiene el permiso

**Ejemplo:**
```typescript
const puedeExportar = await authService.verificarPermisos('exportar_datos');
```

## Servicios de Notificaciones

### NotificationService

**Ubicación**: `src/services/notifications.ts`

Servicio para notificaciones push.

#### Métodos

##### `solicitarPermisos()`

```typescript
async solicitarPermisos(): Promise<boolean>
```

**Retorna:** true si se concedieron permisos

**Ejemplo:**
```typescript
const permisos = await notificationService.solicitarPermisos();
if (permisos) {
  console.log('Permisos concedidos');
}
```

##### `enviarNotificacion(titulo, mensaje)`

```typescript
async enviarNotificacion(titulo: string, mensaje: string): Promise<void>
```

**Parámetros:**
- `titulo`: Título de la notificación
- `mensaje`: Mensaje de la notificación

**Ejemplo:**
```typescript
await notificationService.enviarNotificacion(
  'Nueva visita',
  'Tienes una nueva visita asignada'
);
```

##### `configurarNotificaciones(config)`

```typescript
async configurarNotificaciones(config: ConfiguracionNotificaciones): Promise<void>
```

**Parámetros:**
- `config`: Configuración de notificaciones

**Ejemplo:**
```typescript
await notificationService.configurarNotificaciones({
  visitas: true,
  recordatorios: true,
  actualizaciones: false
});
```

## Servicios de Imágenes

### ImagesService

**Ubicación**: `src/services/images.ts`

Servicio para manejo de imágenes.

#### Métodos

##### `comprimirImagen(archivo, calidad, ancho, alto)`

```typescript
async comprimirImagen(
  archivo: File,
  calidad: number = 0.8,
  ancho?: number,
  alto?: number
): Promise<Blob>
```

**Parámetros:**
- `archivo`: Archivo de imagen
- `calidad`: Calidad de compresión (0-1)
- `ancho`: Ancho máximo (opcional)
- `alto`: Alto máximo (opcional)

**Retorna:** Blob comprimido

**Ejemplo:**
```typescript
const imagenComprimida = await imagesService.comprimirImagen(
  archivo,
  0.8,
  800,
  600
);
```

##### `redimensionarImagen(archivo, ancho, alto)`

```typescript
async redimensionarImagen(
  archivo: File,
  ancho: number,
  alto?: number
): Promise<Blob>
```

**Parámetros:**
- `archivo`: Archivo de imagen
- `ancho`: Ancho deseado
- `alto`: Alto deseado (opcional)

**Retorna:** Blob redimensionado

**Ejemplo:**
```typescript
const imagenRedimensionada = await imagesService.redimensionarImagen(
  archivo,
  400,
  300
);
```

##### `convertirABase64(archivo)`

```typescript
async convertirABase64(archivo: File): Promise<string>
```

**Parámetros:**
- `archivo`: Archivo a convertir

**Retorna:** String en base64

**Ejemplo:**
```typescript
const base64 = await imagesService.convertirABase64(archivo);
```

## Servicios de GPS

### GPSService

**Ubicación**: `src/services/gpsService.ts`

Servicio para geolocalización.

#### Métodos

##### `obtenerPosicionActual(opciones)`

```typescript
async obtenerPosicionActual(
  opciones?: OpcionesGeolocalizacion
): Promise<PosicionGPS>
```

**Parámetros:**
- `opciones`: Opciones de geolocalización (opcional)

**Retorna:** Posición GPS

**Ejemplo:**
```typescript
const posicion = await gpsService.obtenerPosicionActual({
  enableHighAccuracy: true,
  timeout: 10000
});
```

##### `iniciarSeguimiento(callback, opciones)`

```typescript
iniciarSeguimiento(
  callback: (posicion: PosicionGPS) => void,
  opciones?: OpcionesGeolocalizacion
): number
```

**Parámetros:**
- `callback`: Función a ejecutar en cada actualización
- `opciones`: Opciones de geolocalización (opcional)

**Retorna:** ID del seguimiento

**Ejemplo:**
```typescript
const watchId = gpsService.iniciarSeguimiento(
  (posicion) => console.log('Nueva posición:', posicion),
  { enableHighAccuracy: true }
);
```

##### `calcularDistancia(punto1, punto2)`

```typescript
calcularDistancia(punto1: Coordenadas, punto2: Coordenadas): number
```

**Parámetros:**
- `punto1`: Primer punto
- `punto2`: Segundo punto

**Retorna:** Distancia en kilómetros

**Ejemplo:**
```typescript
const distancia = gpsService.calcularDistancia(
  { lat: 10.123, lng: -66.456 },
  { lat: 10.133, lng: -66.466}
);
```

##### `validarCoordenadas(coordenadas)`

```typescript
validarCoordenadas(coordenadas: Coordenadas): boolean
```

**Parámetros:**
- `coordenadas`: Coordenadas a validar

**Retorna:** true si son válidas

**Ejemplo:**
```typescript
const esValida = gpsService.validarCoordenadas({
  lat: 10.123,
  lng: -66.456
});
```

## Servicios de Analytics

### AnalyticsService

**Ubicación**: `src/services/analytics.ts`

Servicio para analytics y métricas.

#### Métodos

##### `trackearEvento(evento, propiedades)`

```typescript
async trackearEvento(
  evento: string,
  propiedades?: Record<string, any>
): Promise<void>
```

**Parámetros:**
- `evento`: Nombre del evento
- `propiedades`: Propiedades del evento (opcional)

**Ejemplo:**
```typescript
await analyticsService.trackearEvento('visita_creada', {
  tipo: 'Merchandising',
  mercaderista: 'Juan Pérez'
});
```

##### `trackearPagina(nombre, url)`

```typescript
async trackearPagina(nombre: string, url: string): Promise<void>
```

**Parámetros:**
- `nombre`: Nombre de la página
- `url`: URL de la página

**Ejemplo:**
```typescript
await analyticsService.trackearPagina('Dashboard', '/dashboard');
```

##### `configurarUsuario(usuario)`

```typescript
async configurarUsuario(usuario: Usuario): Promise<void>
```

**Parámetros:**
- `usuario`: Datos del usuario

**Ejemplo:**
```typescript
await analyticsService.configurarUsuario({
  id: 'user123',
  nombre: 'Juan Pérez',
  rol: 'Mercaderista'
});
```

## Servicios de Offline

### OfflineService

**Ubicación**: `src/services/offlineService.ts`

Servicio para funcionalidades offline.

#### Métodos

##### `inicializarOffline()`

```typescript
async inicializarOffline(): Promise<void>
```

**Ejemplo:**
```typescript
await offlineService.inicializarOffline();
```

##### `obtenerEstadoOffline()`

```typescript
obtenerEstadoOffline(): boolean
```

**Retorna:** true si está offline

**Ejemplo:**
```typescript
const estaOffline = offlineService.obtenerEstadoOffline();
```

##### `sincronizarDatos()`

```typescript
async sincronizarDatos(): Promise<ResultadoSincronizacion>
```

**Retorna:** Resultado de sincronización

**Ejemplo:**
```typescript
const resultado = await offlineService.sincronizarDatos();
console.log(`Sincronizados: ${resultado.sincronizados}`);
```

##### `obtenerDatosOffline()`

```typescript
async obtenerDatosOffline(): Promise<DatosOffline>
```

**Retorna:** Datos almacenados offline

**Ejemplo:**
```typescript
const datos = await offlineService.obtenerDatosOffline();
console.log(`Visitas offline: ${datos.visitas.length}`);
```

## Servicios de Rutas

### RoutesService

**Ubicación**: `src/services/routes.ts`

Servicio para manejo de rutas.

#### Métodos

##### `obtenerRutas(mercaderista)`

```typescript
async obtenerRutas(mercaderista: string): Promise<Ruta[]>
```

**Parámetros:**
- `mercaderista`: ID del mercaderista

**Retorna:** Array de rutas

**Ejemplo:**
```typescript
const rutas = await routesService.obtenerRutas('mercaderista123');
```

##### `crearRuta(ruta)`

```typescript
async crearRuta(ruta: Ruta): Promise<string>
```

**Parámetros:**
- `ruta`: Datos de la ruta

**Retorna:** ID de la ruta creada

**Ejemplo:**
```typescript
const rutaId = await routesService.crearRuta({
  nombre: 'Ruta Centro',
  mercaderista: 'Juan Pérez',
  clientes: ['cliente1', 'cliente2']
});
```

##### `actualizarRuta(id, datos)`

```typescript
async actualizarRuta(id: string, datos: Partial<Ruta>): Promise<void>
```

**Parámetros:**
- `id`: ID de la ruta
- `datos`: Datos a actualizar

**Ejemplo:**
```typescript
await routesService.actualizarRuta('ruta123', {
  nombre: 'Ruta Centro Actualizada'
});
```

## Servicios de Email

### EmailService

**Ubicación**: `src/services/emailNotifications.ts`

Servicio para notificaciones por email.

#### Métodos

##### `enviarEmail(destinatario, asunto, contenido)`

```typescript
async enviarEmail(
  destinatario: string,
  asunto: string,
  contenido: string
): Promise<void>
```

**Parámetros:**
- `destinatario`: Correo del destinatario
- `asunto`: Asunto del email
- `contenido`: Contenido del email

**Ejemplo:**
```typescript
await emailService.enviarEmail(
  'usuario@ejemplo.com',
  'Nueva visita asignada',
  'Tienes una nueva visita en tu ruta'
);
```

##### `enviarReporte(destinatario, datos)`

```typescript
async enviarReporte(
  destinatario: string,
  datos: DatosReporte
): Promise<void>
```

**Parámetros:**
- `destinatario`: Correo del destinatario
- `datos`: Datos del reporte

**Ejemplo:**
```typescript
await emailService.enviarReporte(
  'admin@ejemplo.com',
  {
    periodo: 'Enero 2024',
    visitas: 150,
    completadas: 120
  }
);
```

## Hooks Personalizados

### useExportData

**Ubicación**: `src/hooks/useExportData.ts`

Hook para manejo de exportación de datos.

#### Uso

```typescript
const {
  isExporting,
  progress,
  estadisticas,
  exportarVisitas,
  obtenerEstadisticas,
  descargarArchivo,
  resetProgress
} = useExportData();
```

### useOfflineSync

**Ubicación**: `src/hooks/useOfflineSync.ts`

Hook para sincronización offline.

#### Uso

```typescript
const {
  isOffline,
  isSyncing,
  syncProgress,
  sincronizar,
  obtenerEstado
} = useOfflineSync();
```

### useAnalytics

**Ubicación**: `src/hooks/useAnalytics.ts`

Hook para analytics.

#### Uso

```typescript
const {
  trackearEvento,
  trackearPagina,
  configurarUsuario
} = useAnalytics();
```

## Manejo de Errores

### Tipos de Error

```typescript
interface ErrorServicio {
  codigo: string;
  mensaje: string;
  detalles?: any;
  timestamp: Date;
}
```

### Manejo de Errores

```typescript
try {
  const resultado = await exportService.exportarVisitas(filtros, opciones);
  if (!resultado.success) {
    throw new Error(resultado.error);
  }
} catch (error) {
  console.error('Error en exportación:', error);
  // Manejar error
}
```

## Configuración

### Variables de Entorno

```typescript
// Configuración de servicios
const config = {
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 
  },
  n8n: {
    webhookUrl: process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL
  },
  maps: {
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  }
};
```

## Testing

### Tests de Servicios

```typescript
// Ejemplo de test de servicio
import { exportService } from '@/services/exportService';

describe('ExportService', () => {
  test('debe exportar visitas correctamente', async () => {
    const resultado = await exportService.exportarVisitas(
      { tipoVisita: 'Merchandising' },
      { formato: 'csv', incluirFotos: false }
    );
    
    expect(resultado.success).toBe(true);
    expect(resultado.totalRecords).toBeGreaterThan(0);
  });
});
```

### Mocks de Servicios

```typescript
// Mock de servicio
jest.mock('@/services/exportService', () => ({
  exportService: {
    exportarVisitas: jest.fn(),
    obtenerEstadisticasExportacion: jest.fn(),
    descargarArchivo: jest.fn()
  }
}));
```

## Consideraciones de Rendimiento

### Caching

```typescript
// Cache de resultados
const cache = new Map();

async function obtenerDatosConCache(clave: string) {
  if (cache.has(clave)) {
    return cache.get(clave);
  }
  
  const datos = await obtenerDatos(clave);
  cache.set(clave, datos);
  return datos;
}
```

### Debouncing

```typescript
// Debounce para búsquedas
const debouncedSearch = debounce(async (termino: string) => {
  const resultados = await buscarVisitas(termino);
  setResultados(resultados);
}, 300);
```

### Paginación

```typescript
// Paginación de resultados
async function obtenerVisitasPagina(pagina: number, limite: number) {
  const offset = (pagina - 1) * limite;
  return await visitasService.obtenerVisitas({
    offset,
    limite
  });
}
```

## Seguridad

### Validación de Datos

```typescript
// Validar datos de entrada
function validarVisita(visita: any): boolean {
  if (!visita.mercaderista || !visita.tipoVisita) {
    return false;
  }
  
  if (!visita.ubicacion?.lat || !visita.ubicacion?.lng) {
    return false;
  }
  
  return true;
}
```

### Sanitización

```typescript
// Sanitizar datos
function sanitizarVisita(visita: any): Visita {
  return {
    ...visita,
    mercaderista: sanitizarTexto(visita.mercaderista),
    observaciones: sanitizarTexto(visita.observaciones)
  };
}
```

## Monitoreo

### Logging

```typescript
// Log de operaciones
function logOperacion(operacion: string, datos: any) {
  console.log(`[${new Date().toISOString()}] ${operacion}:`, datos);
}
```

### Métricas

```typescript
// Métricas de rendimiento
function medirTiempo<T>(operacion: () => Promise<T>): Promise<T> {
  const inicio = Date.now();
  return operacion().then(resultado => {
    const tiempo = Date.now() - inicio;
    console.log(`Operación completada en ${tiempo}ms`);
    return resultado;
  });
}
```

