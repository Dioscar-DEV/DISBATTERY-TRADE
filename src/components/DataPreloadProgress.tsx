/**
 * Componente para mostrar el progreso de precarga de datos offline
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Wifi,
  WifiOff,
  Download,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Database,
  Users,
  MapPin
} from 'lucide-react';

export interface PreloadProgress {
  step: string;
  current: number;
  total: number;
  percentage: number;
  message: string;
}

interface DataPreloadProgressProps {
  isVisible: boolean;
  progress: PreloadProgress | null;
  isComplete: boolean;
  isError: boolean;
  error?: string;
  result?: {
    routesLoaded: number;
    clientesLoaded: number;
    totalSizeMB: number;
    duration: number;
  };
  onComplete?: () => void;
  onRetry?: () => void;
  onSkip?: () => void;
}

export default function DataPreloadProgress({
  isVisible,
  progress,
  isComplete,
  isError,
  error,
  result,
  onComplete,
  onRetry,
  onSkip
}: DataPreloadProgressProps) {
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [timeoutReached, setTimeoutReached] = useState(false);

  // Mostrar botón de saltar después de 10 segundos
  useEffect(() => {
    if (isVisible && !isComplete && !isError) {
      const skipTimer = setTimeout(() => {
        setShowSkipButton(true);
      }, 10000);

      // ✅ TIMEOUT DE EMERGENCIA: Si no se completa en 30 segundos, forzar skip
      const emergencyTimer = setTimeout(() => {
        console.warn('⚠️ [DataPreloadProgress] Timeout de emergencia alcanzado (30s)');
        setTimeoutReached(true);
        if (onSkip) {
          onSkip();
        }
      }, 30000);

      return () => {
        clearTimeout(skipTimer);
        clearTimeout(emergencyTimer);
      };
    }
  }, [isVisible, isComplete, isError, onSkip]);

  // Auto-continuar después de completar exitosamente
  useEffect(() => {
    if (isComplete && !isError && onComplete) {
      console.log('✅ [DataPreloadProgress] Precarga completada, redirigiendo en 1.5 segundos...');
      const timer = setTimeout(() => {
        console.log('🚀 [DataPreloadProgress] Ejecutando redirección automática');
        onComplete();
      }, 1500); // ✅ Reducido a 1.5 segundos para mejor UX
      return () => clearTimeout(timer);
    }
  }, [isComplete, isError, onComplete]);

  // ✅ DEBUGGING: Mostrar cuando cambian los estados importantes
  useEffect(() => {
    console.log('🔧 [DataPreloadProgress] Estado actual:', {
      isVisible,
      isComplete,
      isError,
      hasOnComplete: !!onComplete,
      progressStep: progress?.step,
      progressPercentage: progress?.percentage
    });
  }, [isVisible, isComplete, isError, onComplete, progress]);

  // ✅ FORZAR SALIDA SI HAY TIMEOUT
  useEffect(() => {
    if (timeoutReached && onSkip) {
      console.log('🚨 [DataPreloadProgress] Ejecutando skip por timeout de emergencia');
      onSkip();
    }
  }, [timeoutReached, onSkip]);

  if (!isVisible) return null;

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'init':
        return <Database className="w-5 h-5" />;
      case 'routes':
        return <MapPin className="w-5 h-5" />;
      case 'clients':
        return <Users className="w-5 h-5" />;
      case 'storage':
        return <Download className="w-5 h-5" />;
      default:
        return <RefreshCw className="w-5 h-5 animate-spin" />;
    }
  };

  const getStepTitle = (step: string) => {
    switch (step) {
      case 'init':
        return 'Inicializando base de datos offline';
      case 'routes':
        return 'Descargando rutas asignadas';
      case 'clients':
        return 'Descargando información de clientes';
      case 'storage':
        return 'Almacenando datos localmente';
      case 'complete':
        return '¡Descarga completada!';
      default:
        return 'Preparando datos offline...';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
            {isError ? (
              <AlertCircle className="w-8 h-8 text-red-500" />
            ) : isComplete ? (
              <CheckCircle className="w-8 h-8 text-green-500" />
            ) : (
              <WifiOff className="w-8 h-8 text-blue-500" />
            )}
          </div>
          <CardTitle className="text-lg">
            {isError ? 'Error de descarga' :
              isComplete ? '¡Listo para trabajar offline!' :
                timeoutReached ? 'Continuando sin precarga' :
                  'Preparando modo offline'}
          </CardTitle>
          <CardDescription>
            {isError
              ? 'Hubo un problema descargando los datos'
              : isComplete
                ? 'Todos los datos están listos para uso sin conexión'
                : 'Descargando datos necesarios para trabajar sin conexión'
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isError ? (
            <div className="space-y-4">
              <div className="text-sm bg-red-50 p-3 rounded-md">
                {error?.includes('requires an index') || error?.includes('FirebaseError') ? (
                  <div className="space-y-2">
                    <div className="text-red-600 font-medium">
                      🚨 Problema de configuración de Firebase
                    </div>
                    <div className="text-red-600 text-xs">
                      La base de datos requiere índices especiales que no están configurados.
                      Esto no afecta la funcionalidad offline básica.
                    </div>
                    <div className="text-orange-600 text-xs font-medium">
                      ✅ Recomendación: Usar modo offline sin precarga de datos
                    </div>
                  </div>
                ) : (
                  <div className="text-red-600">
                    {error || 'Error desconocido durante la descarga'}
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded-md">
                💡 <strong>Sin preocupación:</strong> La aplicación funcionará normalmente.
                Los datos se cargarán según sea necesario durante el uso.
              </div>

              <div className="flex space-x-2">
                {!error?.includes('requires an index') && (
                  <Button onClick={onRetry} variant="outline" className="flex-1">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reintentar
                  </Button>
                )}
                <Button onClick={onSkip} className={error?.includes('requires an index') ? 'w-full' : 'flex-1'}>
                  Continuar sin precarga
                </Button>
              </div>
            </div>
          ) : isComplete ? (
            <div className="space-y-4">
              <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Descarga completada exitosamente</span>
                </div>
                {result && (
                  <div className="text-xs space-y-1">
                    <div>📍 {result.routesLoaded} rutas descargadas</div>
                    <div>👥 {result.clientesLoaded} clientes descargados</div>
                    <div>💾 {result.totalSizeMB.toFixed(1)} MB almacenados</div>
                    <div>⏱️ Completado en {(result.duration / 1000).toFixed(1)}s</div>
                  </div>
                )}
              </div>
              <Button onClick={onComplete} className="w-full">
                {result && result.routesLoaded > 0
                  ? `Continuar con ${result.routesLoaded} rutas disponibles`
                  : 'Continuar a la aplicación'
                }
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {progress && (
                <>
                  <div className="flex items-center space-x-3">
                    {getStepIcon(progress.step)}
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {getStepTitle(progress.step)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {progress.message}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Progress value={progress.percentage} className="w-full" />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{progress.current} de {progress.total}</span>
                      <span>{progress.percentage}%</span>
                    </div>
                  </div>
                </>
              )}

              <div className="text-xs text-gray-400 text-center">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <Wifi className="w-3 h-3" />
                  <span>Necesaria conexión a internet para la descarga inicial</span>
                </div>
                <div>Después podrás trabajar completamente offline</div>
              </div>

              {/* ✅ MOSTRAR TIMEOUT WARNING */}
              {timeoutReached && (
                <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded-md text-center">
                  ⏰ La descarga está tomando más tiempo del esperado. Continuando sin precarga...
                </div>
              )}

              {showSkipButton && !timeoutReached && (
                <Button onClick={onSkip} variant="outline" className="w-full">
                  Saltar y continuar online
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}