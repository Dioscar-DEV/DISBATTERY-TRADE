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
  { tipoVisita: "Merchandising" },
  { formato: "csv", incluirFotos: true }
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
  mercaderista: "Juan Pérez",
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
exportService.descargarArchivo(csvData, "visitas.csv", "text/csv");
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
  mercaderista: "Juan Pérez",
  tipoVisita: "Merchandising",
  ubicacion: { lat: 10.123, lng: -66.456 },
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
  mercaderista: "Juan Pérez",
  fechaDesde: new Date("2024-01-01"),
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
await visitasService.actualizarVisita("visita123", {
  sincronizadoN8N: true,
});
```

### OfflineManager

**Ubicación**: `src/services/offlineManager.ts`

Servicio unificado para la gestión offline, sincronización y manejo de datos locales. Consolida las funcionalidades previamente manejadas por `SyncService` y `OfflineService`.

#### Métodos Principales

##### `saveVisita(visitaData)`

```typescript
async saveVisita(visitaData: any): Promise<SaveResult>
```

Guarda una visita, intentando primero sincronizarla online y haciendo fallback a almacenamiento offline si no hay conexión.

**Parámetros:**

- `visitaData`: Datos completos de la visita

**Retorna:** Objeto `SaveResult` con el resultado de la operación.

**Ejemplo:**

```typescript
const result = await offlineManager.saveVisita({
  clienteData: cliente,
  tipoVisita: "Venta",
  timestamp: Date.now(),
});
```

##### `syncPendingVisitas()`

```typescript
async syncPendingVisitas(): Promise<void>
```

Sincroniza todas las visitas y operaciones pendientes almacenadas localmente con el servidor.

**Ejemplo:**

```typescript
await offlineManager.syncPendingVisitas();
```

##### `initializeOfflineSystem()`

```typescript
async initializeOfflineSystem(): Promise<InitResult>
```

Inicializa todos los sistemas de almacenamiento local (IndexedDB y Fallback).

**Retorna:** Estado de la inicialización.

##### `obtenerEstadoOffline()`

```typescript
async checkConnection(): Promise<boolean>
```

Verifica el estado real de la conexión.

##### `updateOfflineRouteStatus(routeId, newStatus)`

```typescript
async updateOfflineRouteStatus(routeId: string, newStatus: RouteStatus): Promise<void>
```

Actualiza el estado de una ruta localmente.

**Parámetros:**

- `routeId`: ID de la ruta
- `newStatus`: Nuevo estado ('planificada', 'en_progreso', 'completada')

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
const rutas = await routesService.obtenerRutas("mercaderista123");
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
  nombre: "Ruta Centro",
  mercaderista: "Juan Pérez",
  clientes: ["cliente1", "cliente2"],
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
await routesService.actualizarRuta("ruta123", {
  nombre: "Ruta Centro Actualizada",
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
  "usuario@ejemplo.com",
  "Nueva visita asignada",
  "Tienes una nueva visita en tu ruta"
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
await emailService.enviarReporte("admin@ejemplo.com", {
  periodo: "Enero 2024",
  visitas: 150,
  completadas: 120,
});
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
  resetProgress,
} = useExportData();
```

### useOfflineSync

**Ubicación**: `src/hooks/useOfflineSync.ts`

Hook para sincronización offline.

#### Uso

```typescript
const { isOffline, isSyncing, syncProgress, sincronizar, obtenerEstado } =
  useOfflineSync();
```

### useAnalytics

**Ubicación**: `src/hooks/useAnalytics.ts`

Hook para analytics.

#### Uso

```typescript
const { trackearEvento, trackearPagina, configurarUsuario } = useAnalytics();
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
  console.error("Error en exportación:", error);
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
import { exportService } from "@/services/exportService";

describe("ExportService", () => {
  test("debe exportar visitas correctamente", async () => {
    const resultado = await exportService.exportarVisitas(
      { tipoVisita: "Merchandising" },
      { formato: "csv", incluirFotos: false }
    );

    expect(resultado.success).toBe(true);
    expect(resultado.totalRecords).toBeGreaterThan(0);
  });
});
```

### Mocks de Servicios

```typescript
// Mock de servicio
jest.mock("@/services/exportService", () => ({
  exportService: {
    exportarVisitas: jest.fn(),
    obtenerEstadisticasExportacion: jest.fn(),
    descargarArchivo: jest.fn(),
  },
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
    limite,
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
    observaciones: sanitizarTexto(visita.observaciones),
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
  return operacion().then((resultado) => {
    const tiempo = Date.now() - inicio;
    console.log(`Operación completada en ${tiempo}ms`);
    return resultado;
  });
}
```
