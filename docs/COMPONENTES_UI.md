# Documentación de Componentes UI

## Descripción General

Esta documentación describe los componentes de interfaz de usuario desarrollados para el sistema Visita Rápida, incluyendo componentes base, especializados y de integración.

## Componentes Base

### Button

**Ubicación**: `src/components/ui/button.tsx`

Componente de botón con variantes y tamaños.

#### Props

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}
```

#### Uso

```typescript
import { Button } from '@/components/ui/button';

// Botón básico
<Button>Click me</Button>

// Botón con variante
<Button variant="destructive">Eliminar</Button>

// Botón con tamaño
<Button size="lg">Botón grande</Button>
```

### Input

**Ubicación**: `src/components/ui/input.tsx`

Componente de entrada de texto.

#### Props

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // Hereda todas las props de input HTML
}
```

#### Uso

```typescript
import { Input } from '@/components/ui/input';

<Input placeholder="Ingresa tu texto" />
<Input type="email" placeholder="correo@ejemplo.com" />
```

### Card

**Ubicación**: `src/components/ui/card.tsx`

Componente de tarjeta para contener contenido.

#### Uso

```typescript
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Título de la tarjeta</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Contenido de la tarjeta</p>
  </CardContent>
  <CardFooter>
    <Button>Acción</Button>
  </CardFooter>
</Card>
```

### Badge

**Ubicación**: `src/components/ui/badge.tsx`

Componente de etiqueta para mostrar estados o categorías.

#### Props

```typescript
interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}
```

#### Uso

```typescript
import { Badge } from '@/components/ui/badge';

<Badge>Default</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="secondary">Secundario</Badge>
```

## Componentes Especializados

### GoogleMaps

**Ubicación**: `src/components/ui/google-maps.tsx`

Componente de integración con Google Maps.

#### Props

```typescript
interface GoogleMapsProps {
  center: { lat: number; lng: number };
  zoom: number;
  markers?: Marker[];
  onMapClick?: (position: { lat: number; lng: number }) => void;
  onMarkerClick?: (marker: Marker) => void;
  onError?: (error: Error) => void;
  mapTypeId?: string;
  disableDefaultUI?: boolean;
  zoomControl?: boolean;
  streetViewControl?: boolean;
  fullscreenControl?: boolean;
  mapTypeControl?: boolean;
}

interface Marker {
  id: string;
  position: { lat: number; lng: number };
  title?: string;
  info?: string;
}
```

#### Uso

```typescript
import { GoogleMaps } from '@/components/ui/google-maps';

const markers = [
  {
    id: 'marker-1',
    position: { lat: 10.123456, lng: -66.789012 },
    title: 'Ubicación 1',
    info: 'Información de la ubicación'
  }
];

<GoogleMaps
  center={{ lat: 10.123456, lng: -66.789012 }}
  zoom={15}
  markers={markers}
  onMapClick={(position) => console.log('Click en mapa:', position)}
  onMarkerClick={(marker) => console.log('Click en marcador:', marker)}
/>
```

### ExportDataDialog

**Ubicación**: `src/components/ExportDataDialog.tsx`

Diálogo para configurar exportaciones de datos.

#### Props

```typescript
interface ExportDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialFilters?: ExportFilters;
}
```

#### Uso

```typescript
import { ExportDataDialog } from '@/components/ExportDataDialog';

<ExportDataDialog
  isOpen={isDialogOpen}
  onClose={() => setIsDialogOpen(false)}
  initialFilters={{
    tipoVisita: 'Merchandising'
  }}
/>
```

## Componentes de Estado

### OfflineIndicator

**Ubicación**: `src/components/OfflineIndicator.tsx`

Indicador de estado de conexión.

#### Props

```typescript
interface OfflineIndicatorProps {
  className?: string;
}
```

#### Uso

```typescript
import { OfflineIndicator } from '@/components/OfflineIndicator';

<OfflineIndicator />
```

### NotificationStatus

**Ubicación**: `src/components/NotificationStatus.tsx`

Indicador de estado de notificaciones.

#### Props

```typescript
interface NotificationStatusProps {
  className?: string;
}
```

#### Uso

```typescript
import { NotificationStatus } from '@/components/NotificationStatus';

<NotificationStatus />
```

### DataPreloadProgress

**Ubicación**: `src/components/DataPreloadProgress.tsx`

Barra de progreso para precarga de datos.

#### Props

```typescript
interface DataPreloadProgressProps {
  progress: number;
  message?: string;
  className?: string;
}
```

#### Uso

```typescript
import { DataPreloadProgress } from '@/components/DataPreloadProgress';

<DataPreloadProgress 
  progress={75} 
  message="Cargando datos..." 
/>
```

## Componentes de Instalación PWA

### PWAInstallBanner

**Ubicación**: `src/components/PWAInstallBanner.tsx`

Banner para promocionar la instalación de la PWA.

#### Props

```typescript
interface PWAInstallBannerProps {
  onInstall?: () => void;
  onDismiss?: () => void;
  className?: string;
}
```

#### Uso

```typescript
import { PWAInstallBanner } from '@/components/PWAInstallBanner';

<PWAInstallBanner 
  onInstall={() => console.log('Instalando PWA')}
  onDismiss={() => console.log('Ocultando banner')}
/>
```

### PWAInstallButton

**Ubicación**: `src/components/PWAInstallButton.tsx`

Botón para instalar la PWA.

#### Props

```typescript
interface PWAInstallButtonProps {
  onInstall?: () => void;
  className?: string;
  children?: React.ReactNode;
}
```

#### Uso

```typescript
import { PWAInstallButton } from '@/components/PWAInstallButton';

<PWAInstallButton onInstall={() => console.log('Instalando')}>
  Instalar App
</PWAInstallButton>
```

## Componentes de Autenticación

### LogoutButton

**Ubicación**: `src/components/LogoutButton.tsx`

Botón de cierre de sesión con confirmación.

#### Props

```typescript
interface LogoutButtonProps {
  onLogout?: () => void;
  className?: string;
  children?: React.ReactNode;
}
```

#### Uso

```typescript
import { LogoutButton } from '@/components/LogoutButton';

<LogoutButton onLogout={() => console.log('Cerrando sesión')}>
  Cerrar Sesión
</LogoutButton>
```

### UserStatusChecker

**Ubicación**: `src/components/UserStatusChecker.tsx`

Verificador de estado del usuario.

#### Props

```typescript
interface UserStatusCheckerProps {
  onStatusChange?: (status: UserStatus) => void;
  children?: React.ReactNode;
}
```

#### Uso

```typescript
import { UserStatusChecker } from '@/components/UserStatusChecker';

<UserStatusChecker onStatusChange={(status) => console.log('Estado:', status)}>
  <div>Contenido que depende del estado del usuario</div>
</UserStatusChecker>
```

## Componentes de Notificaciones

### NotificationTester

**Ubicación**: `src/components/NotificationTester.tsx`

Componente para probar notificaciones push.

#### Props

```typescript
interface NotificationTesterProps {
  onTest?: (type: string) => void;
  className?: string;
}
```

#### Uso

```typescript
import { NotificationTester } from '@/components/NotificationTester';

<NotificationTester onTest={(type) => console.log('Probando:', type)} />
```

### NotificationInitializer

**Ubicación**: `src/components/NotificationInitializer.tsx`

Inicializador de notificaciones push.

#### Props

```typescript
interface NotificationInitializerProps {
  onInitialized?: () => void;
  onError?: (error: Error) => void;
  children?: React.ReactNode;
}
```

#### Uso

```typescript
import { NotificationInitializer } from '@/components/NotificationInitializer';

<NotificationInitializer 
  onInitialized={() => console.log('Notificaciones inicializadas')}
  onError={(error) => console.error('Error:', error)}
>
  <div>Contenido de la app</div>
</NotificationInitializer>
```

## Componentes de Datos

### MercaderistaDataLoader

**Ubicación**: `src/components/MercaderistaDataLoader.tsx`

Cargador de datos para mercaderistas.

#### Props

```typescript
interface MercaderistaDataLoaderProps {
  mercaderistaId: string;
  onDataLoaded?: (data: any) => void;
  onError?: (error: Error) => void;
  children?: React.ReactNode;
}
```

#### Uso

```typescript
import { MercaderistaDataLoader } from '@/components/MercaderistaDataLoader';

<MercaderistaDataLoader 
  mercaderistaId="user123"
  onDataLoaded={(data) => console.log('Datos cargados:', data)}
  onError={(error) => console.error('Error:', error)}
>
  <div>Contenido que usa los datos del mercaderista</div>
</MercaderistaDataLoader>
```

### PrepareOfflineButton

**Ubicación**: `src/components/PrepareOfflineButton.tsx`

Botón para preparar datos offline.

#### Props

```typescript
interface PrepareOfflineButtonProps {
  onPrepare?: () => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  className?: string;
  children?: React.ReactNode;
}
```

#### Uso

```typescript
import { PrepareOfflineButton } from '@/components/PrepareOfflineButton';

<PrepareOfflineButton 
  onPrepare={() => console.log('Preparando datos offline')}
  onComplete={() => console.log('Datos preparados')}
  onError={(error) => console.error('Error:', error)}
>
  Preparar Datos Offline
</PrepareOfflineButton>
```

## Componentes de Manejo de Errores

### ChunkErrorHandler

**Ubicación**: `src/components/ChunkErrorHandler.tsx`

Manejador de errores de chunks de JavaScript.

#### Props

```typescript
interface ChunkErrorHandlerProps {
  onError?: (error: Error) => void;
  onRetry?: () => void;
  children?: React.ReactNode;
}
```

#### Uso

```typescript
import { ChunkErrorHandler } from '@/components/ChunkErrorHandler';

<ChunkErrorHandler 
  onError={(error) => console.error('Error de chunk:', error)}
  onRetry={() => window.location.reload()}
>
  <div>Contenido de la app</div>
</ChunkErrorHandler>
```

### AutoPrecacheOverlay

**Ubicación**: `src/components/AutoPrecacheOverlay.tsx`

Overlay para precarga automática.

#### Props

```typescript
interface AutoPrecacheOverlayProps {
  isVisible: boolean;
  progress: number;
  message?: string;
  onClose?: () => void;
}
```

#### Uso

```typescript
import { AutoPrecacheOverlay } from '@/components/AutoPrecacheOverlay';

<AutoPrecacheOverlay 
  isVisible={isPrecaching}
  progress={precacheProgress}
  message="Precargando recursos..."
  onClose={() => setIsPrecaching(false)}
/>
```

## Componentes de Inicialización

### AnalyticsInitializer

**Ubicación**: `src/components/AnalyticsInitializer.tsx`

Inicializador de analytics (GA4, PostHog).

#### Props

```typescript
interface AnalyticsInitializerProps {
  onInitialized?: () => void;
  onError?: (error: Error) => void;
  children?: React.ReactNode;
}
```

#### Uso

```typescript
import { AnalyticsInitializer } from '@/components/AnalyticsInitializer';

<AnalyticsInitializer 
  onInitialized={() => console.log('Analytics inicializado')}
  onError={(error) => console.error('Error:', error)}
>
  <div>Contenido de la app</div>
</AnalyticsInitializer>
```

### OfflineInitializer

**Ubicación**: `src/components/OfflineInitializer.tsx`

Inicializador de funcionalidades offline.

#### Props

```typescript
interface OfflineInitializerProps {
  onInitialized?: () => void;
  onError?: (error: Error) => void;
  children?: React.ReactNode;
}
```

#### Uso

```typescript
import { OfflineInitializer } from '@/components/OfflineInitializer';

<OfflineInitializer 
  onInitialized={() => console.log('Offline inicializado')}
  onError={(error) => console.error('Error:', error)}
>
  <div>Contenido de la app</div>
</OfflineInitializer>
```

### OfflineStatusManager

**Ubicación**: `src/components/OfflineStatusManager.tsx`

Gestor de estado offline.

#### Props

```typescript
interface OfflineStatusManagerProps {
  onStatusChange?: (isOffline: boolean) => void;
  children?: React.ReactNode;
}
```

#### Uso

```typescript
import { OfflineStatusManager } from '@/components/OfflineStatusManager';

<OfflineStatusManager 
  onStatusChange={(isOffline) => console.log('Estado offline:', isOffline)}
>
  <div>Contenido de la app</div>
</OfflineStatusManager>
```

## Componentes de Permisos

### PermissionChecker

**Ubicación**: `src/components/PermissionChecker.tsx`

Verificador de permisos de cámara y GPS.

#### Props

```typescript
interface PermissionCheckerProps {
  permissions: ('camera' | 'geolocation')[];
  onPermissionGranted?: (permission: string) => void;
  onPermissionDenied?: (permission: string) => void;
  children?: React.ReactNode;
}
```

#### Uso

```typescript
import { PermissionChecker } from '@/components/PermissionChecker';

<PermissionChecker 
  permissions={['camera', 'geolocation']}
  onPermissionGranted={(permission) => console.log('Permiso concedido:', permission)}
  onPermissionDenied={(permission) => console.log('Permiso denegado:', permission)}
>
  <div>Contenido que requiere permisos</div>
</PermissionChecker>
```

## Patrones de Uso

### Composición de Componentes

```typescript
// Ejemplo de composición
function App() {
  return (
    <AnalyticsInitializer>
      <OfflineInitializer>
        <NotificationInitializer>
          <UserStatusChecker>
            <PermissionChecker permissions={['camera', 'geolocation']}>
              <div className="app-content">
                <OfflineIndicator />
                <NotificationStatus />
                <PWAInstallBanner />
                {/* Contenido principal */}
              </div>
            </PermissionChecker>
          </UserStatusChecker>
        </NotificationInitializer>
      </OfflineInitializer>
    </AnalyticsInitializer>
  );
}
```

### Manejo de Estados

```typescript
// Ejemplo de manejo de estados
function DataPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  return (
    <div>
      {isLoading && (
        <DataPreloadProgress 
          progress={progress} 
          message="Cargando datos..." 
        />
      )}
      {error && <div className="error">{error}</div>}
      {/* Contenido */}
    </div>
  );
}
```

### Integración con Hooks

```typescript
// Ejemplo de integración con hooks
function ExportPage() {
  const { isExporting, progress, exportarVisitas } = useExportData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setIsDialogOpen(true)}>
        Exportar Datos
      </Button>
      
      <ExportDataDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
      
      {isExporting && (
        <DataPreloadProgress 
          progress={progress} 
          message="Exportando datos..." 
        />
      )}
    </div>
  );
}
```

## Consideraciones de Rendimiento

### Lazy Loading

```typescript
// Cargar componentes de forma diferida
const ExportDataDialog = lazy(() => import('@/components/ExportDataDialog'));

function App() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <ExportDataDialog />
    </Suspense>
  );
}
```

### Memoización

```typescript
// Memoizar componentes costosos
const ExpensiveComponent = memo(({ data }) => {
  // Procesamiento costoso
  return <div>{data}</div>;
});
```

### Optimización de Re-renders

```typescript
// Usar useCallback para funciones
const handleClick = useCallback(() => {
  // Lógica del click
}, [dependencies]);

// Usar useMemo para valores calculados
const expensiveValue = useMemo(() => {
  // Cálculo costoso
  return result;
}, [dependencies]);
```

## Accesibilidad

### ARIA Labels

```typescript
<Button aria-label="Cerrar diálogo">
  <X />
</Button>
```

### Navegación por Teclado

```typescript
<Button 
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  Accionar
</Button>
```

### Contraste y Colores

```typescript
// Usar colores con buen contraste
<Badge variant="destructive">Error</Badge>
<Badge variant="secondary">Info</Badge>
```

## Testing

### Tests de Componentes

```typescript
// Ejemplo de test de componente
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

test('Button renders correctly', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});

test('Button handles click', () => {
  const handleClick = jest.fn();
  render(<Button onClick={handleClick}>Click me</Button>);
  fireEvent.click(screen.getByText('Click me'));
  expect(handleClick).toHaveBeenCalled();
});
```

### Tests de Integración

```typescript
// Ejemplo de test de integración
test('ExportDataDialog integration', () => {
  render(
    <ExportDataDialog
      isOpen={true}
      onClose={jest.fn()}
    />
  );
  
  expect(screen.getByText('Exportar Datos')).toBeInTheDocument();
  expect(screen.getByText('Configura los filtros')).toBeInTheDocument();
});
```

## Mantenimiento

### Actualizaciones

1. **Dependencias**: Mantener librerías actualizadas
2. **Props**: Documentar cambios en props
3. **Estilos**: Mantener consistencia visual
4. **Accesibilidad**: Verificar cumplimiento de estándares

### Depuración

1. **React DevTools**: Usar herramientas de desarrollo
2. **Console**: Revisar logs de errores
3. **Network**: Verificar requests
4. **Performance**: Monitorear rendimiento

### Documentación

1. **Props**: Documentar todas las props
2. **Ejemplos**: Proporcionar ejemplos de uso
3. **Casos de uso**: Documentar casos comunes
4. **Limitaciones**: Especificar limitaciones conocidas

