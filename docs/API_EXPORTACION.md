# API de Exportación de Datos

## Descripción General

El sistema de exportación de datos permite a los administradores exportar información de visitas en múltiples formatos (CSV, Excel, JSON, PDF) con filtros personalizables y opciones avanzadas.

## Servicios.

### ExportService

**Ubicación**: `src/services/exportService.ts`

Servicio principal para la exportación de datos de visitas.

#### Métodos Principales

##### `exportarVisitas(filtros, opciones)`

Exporta visitas con filtros y opciones específicas.

**Parámetros:**
- `filtros` (ExportFilters): Filtros de búsqueda
- `opciones` (ExportOptions): Opciones de exportación

**Retorna:** `Promise<ExportResult>`

**Ejemplo:**
```typescript
const resultado = await exportService.exportarVisitas(
  {
    fechaDesde: new Date('2024-01-01'),
    fechaHasta: new Date('2024-01-31'),
    tipoVisita: 'Merchandising'
  },
  {
    formato: 'csv',
    incluirFotos: true,
    comprimirFotos: true,
    incluirCoordenadas: true,
    incluirObservaciones: true,
    separarPorTipo: false
  }
);
```

##### `obtenerEstadisticasExportacion(filtros)`

Obtiene estadísticas de exportación para los filtros especificados.

**Parámetros:**
- `filtros` (ExportFilters, opcional): Filtros de búsqueda

**Retorna:** `Promise<EstadisticasExportacion>`

**Ejemplo:**
```typescript
const estadisticas = await exportService.obtenerEstadisticasExportacion({
  mercaderista: 'Juan Pérez'
});
```

##### `descargarArchivo(data, filename, mimeType)`

Descarga un archivo con los datos especificados.

**Parámetros:**
- `data`: Datos del archivo
- `filename`: Nombre del archivo
- `mimeType`: Tipo MIME del archivo

## Tipos de Datos

### ExportFilters

```typescript
interface ExportFilters {
  fechaDesde?: Date;
  fechaHasta?: Date;
  mercaderista?: string;
  correoMercaderista?: string;
  tipoVisita?: "Merchandising" | "Trade (Eventos)" | "Trade (Impulso)";
  rifCliente?: string;
  sucursal?: string;
  sincronizadoN8N?: boolean;
}
```

### ExportOptions

```typescript
interface ExportOptions {
  formato: "csv" | "excel" | "json" | "pdf";
  incluirFotos: boolean;
  comprimirFotos: boolean;
  incluirCoordenadas: boolean;
  incluirObservaciones: boolean;
  separarPorTipo: boolean;
  limiteRegistros?: number;
}
```

### ExportResult

```typescript
interface ExportResult {
  success: boolean;
  data?: any;
  filename?: string;
  error?: string;
  totalRecords: number;
  processedRecords: number;
}
```

### EstadisticasExportacion

```typescript
interface EstadisticasExportacion {
  totalVisitas: number;
  porTipoVisita: Record<string, number>;
  porMercaderista: Record<string, number>;
  porSucursal: Record<string, number>;
  sincronizadas: number;
  pendientes: number;
  conErrores: number;
}
```

## Hook useExportData

**Ubicación**: `src/hooks/useExportData.ts`

Hook personalizado para manejar la exportación de datos.

### Uso

```typescript
import { useExportData } from '@/hooks/useExportData';

function ExportComponent() {
  const {
    isExporting,
    progress,
    estadisticas,
    exportarVisitas,
    obtenerEstadisticas,
    descargarArchivo,
    resetProgress
  } = useExportData();

  // Usar las funciones y estados...
}
```

### Estados

- `isExporting`: Indica si se está realizando una exportación
- `progress`: Progreso de la exportación (0-100)
- `estadisticas`: Estadísticas de exportación

### Funciones

- `exportarVisitas(filtros, opciones)`: Exporta visitas
- `obtenerEstadisticas(filtros?)`: Obtiene estadísticas
- `descargarArchivo(data, filename, mimeType)`: Descarga archivo
- `resetProgress()`: Resetea el progreso

## Componente ExportDataDialog

**Ubicación**: `src/components/ExportDataDialog.tsx`

Componente de diálogo para configurar y ejecutar exportaciones.

### Props

```typescript
interface ExportDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialFilters?: ExportFilters;
}
```

### Uso

```typescript
import { ExportDataDialog } from '@/components/ExportDataDialog';

function AdminPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <ExportDataDialog
      isOpen={isDialogOpen}
      onClose={() => setIsDialogOpen(false)}
      initialFilters={{
        tipoVisita: 'Merchandising'
      }}
    />
  );
}
```

## Página de Administración

**Ubicación**: `src/app/admin/exportar-datos/page.tsx`

Página completa para la administración de exportaciones.

### Características

- **Estadísticas en tiempo real**: Muestra métricas de visitas
- **Distribución por tipo**: Gráficos de distribución
- **Formatos disponibles**: Información sobre formatos
- **Exportaciones rápidas**: Filtros predefinidos
- **Consejos de uso**: Guías para cada formato

## Formatos de Exportación

### CSV
- **Uso**: Análisis en Excel o Google Sheets
- **Ventajas**: Compatible con herramientas de análisis
- **Desventajas**: Limitado para datos complejos

### Excel
- **Uso**: Presentaciones con formato
- **Ventajas**: Formato nativo de Excel
- **Desventajas**: Requiere librerías adicionales

### JSON
- **Uso**: Integraciones técnicas
- **Ventajas**: Estructura de datos completa
- **Desventajas**: No es legible para usuarios finales

### PDF
- **Uso**: Reportes ejecutivos
- **Ventajas**: Formato de presentación
- **Desventajas**: Requiere librerías adicionales

## Filtros Disponibles

### Filtros de Fecha
- `fechaDesde`: Fecha de inicio
- `fechaHasta`: Fecha de fin

### Filtros de Usuario
- `mercaderista`: Nombre del mercaderista
- `correoMercaderista`: Correo del mercaderista

### Filtros de Visita
- `tipoVisita`: Tipo de visita
- `rifCliente`: RIF del cliente
- `sucursal`: Sucursal

### Filtros de Sincronización
- `sincronizadoN8N`: Estado de sincronización

## Opciones de Exportación

### Incluir Datos
- `incluirFotos`: Incluir fotos en la exportación
- `incluirCoordenadas`: Incluir coordenadas GPS
- `incluirObservaciones`: Incluir observaciones detalladas

### Procesamiento
- `comprimirFotos`: Comprimir fotos para reducir tamaño
- `separarPorTipo`: Separar datos por tipo de visita
- `limiteRegistros`: Límite de registros a exportar

## Manejo de Errores

### Errores Comunes

1. **Error de conexión**: Problemas de red
2. **Error de permisos**: Falta de permisos de usuario
3. **Error de formato**: Formato no soportado
4. **Error de datos**: Datos corruptos o faltantes

### Soluciones

1. **Verificar conexión**: Comprobar conectividad
2. **Revisar permisos**: Verificar permisos de usuario
3. **Validar formato**: Usar formatos soportados
4. **Limpiar datos**: Verificar integridad de datos

## Ejemplos de Uso

### Exportación Básica

```typescript
const resultado = await exportService.exportarVisitas(
  {},
  {
    formato: 'csv',
    incluirFotos: false,
    comprimirFotos: false,
    incluirCoordenadas: true,
    incluirObservaciones: true,
    separarPorTipo: false
  }
);
```

### Exportación con Filtros

```typescript
const resultado = await exportService.exportarVisitas(
  {
    fechaDesde: new Date('2024-01-01'),
    fechaHasta: new Date('2024-01-31'),
    tipoVisita: 'Merchandising',
    mercaderista: 'Juan Pérez'
  },
  {
    formato: 'excel',
    incluirFotos: true,
    comprimirFotos: true,
    incluirCoordenadas: true,
    incluirObservaciones: true,
    separarPorTipo: true,
    limiteRegistros: 1000
  }
);
```

### Obtención de Estadísticas

```typescript
const estadisticas = await exportService.obtenerEstadisticasExportacion({
  tipoVisita: 'Merchandising'
});

console.log(`Total visitas: ${estadisticas.totalVisitas}`);
console.log(`Sincronizadas: ${estadisticas.sincronizadas}`);
console.log(`Pendientes: ${estadisticas.pendientes}`);
```

## Consideraciones de Rendimiento

### Límites Recomendados

- **CSV**: Hasta 10,000 registros
- **Excel**: Hasta 5,000 registros
- **JSON**: Hasta 15,000 registros
- **PDF**: Hasta 2,000 registros

### Optimizaciones

1. **Usar filtros**: Reducir el conjunto de datos
2. **Limitar registros**: Usar `limiteRegistros`
3. **Comprimir fotos**: Reducir tamaño de archivos
4. **Exportar por lotes**: Dividir exportaciones grandes

## Seguridad

### Validaciones

1. **Permisos de usuario**: Verificar rol de administrador
2. **Filtros de datos**: Validar parámetros de entrada
3. **Límites de tamaño**: Controlar tamaño de exportaciones
4. **Sanitización**: Limpiar datos sensibles

### Mejores Prácticas

1. **Autenticación**: Verificar usuario autenticado
2. **Autorización**: Verificar permisos de exportación
3. **Validación**: Validar todos los parámetros
4. **Logging**: Registrar actividades de exportación

## Monitoreo

### Métricas

- **Tiempo de exportación**: Duración del proceso
- **Tamaño de archivos**: Tamaño de exportaciones
- **Errores**: Frecuencia de errores
- **Uso**: Frecuencia de uso por usuario

### Alertas

1. **Exportaciones fallidas**: Notificar errores
2. **Archivos grandes**: Alertar sobre tamaños
3. **Uso excesivo**: Monitorear frecuencia
4. **Errores de sistema**: Alertar sobre problemas

## Mantenimiento

### Tareas Regulares

1. **Limpiar archivos temporales**: Eliminar archivos antiguos
2. **Optimizar consultas**: Mejorar rendimiento
3. **Actualizar dependencias**: Mantener librerías actualizadas
4. **Revisar logs**: Analizar errores y rendimiento

### Actualizaciones

1. **Nuevos formatos**: Agregar formatos de exportación
2. **Mejoras de rendimiento**: Optimizar procesos
3. **Nuevos filtros**: Agregar opciones de filtrado
4. **Mejoras de UI**: Actualizar interfaz de usuario


