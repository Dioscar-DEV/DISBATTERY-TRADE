'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/services/auth';
import { offlineDataManager } from '@/services/offlineDataManager';
import { UserData } from '@/types/visitas';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Download, CheckCircle2, RefreshCw, Wifi, WifiOff, X, LogOut } from 'lucide-react';

interface DownloadProgress {
  step: string;
  percentage: number;
  message: string;
}

interface DataStats {
  routesCount: number;
  clientsCount: number;
  draftsCount: number;
  pendingOpsCount: number;
  lastSync?: Date;
}

export default function MercaderistaDataLoader() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress>({ step: '', percentage: 0, message: '' });
  const [dataStats, setDataStats] = useState<DataStats | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<'needed' | 'optional' | 'completed' | 'error'>('needed');
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);

  // Monitorear conectividad
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Escuchar evento de login exitoso de mercaderista
  useEffect(() => {
    const handleMercaderistaLogin = async (event: CustomEvent) => {
      const userData = event.detail;
      if (userData && userData.role === 'Mercaderista') {
        console.log('🎯 [MercaderistaDataLoader] Login de mercaderista detectado:', userData);
        await checkUserAndData();
      }
    };

    // Escuchar evento personalizado de login
    window.addEventListener('mercaderista-login-success', handleMercaderistaLogin as EventListener);
    
    return () => {
      window.removeEventListener('mercaderista-login-success', handleMercaderistaLogin as EventListener);
    };
  }, []);

  const checkUserAndData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Obtener usuario actual
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        console.log('No hay usuario logueado, redirigiendo...');
        router.push('/');
        return;
      }
      
      setUser(currentUser);
      
      // Solo proceder si es mercaderista
      if (currentUser.role !== 'Mercaderista') {
        console.log('Usuario no es mercaderista, no necesita datos offline');
        setDownloadStatus('completed');
        setIsLoading(false);
        return;
      }
      
      // Verificar necesidad de descarga
      const downloadCheck = await offlineDataManager.shouldDownloadData(currentUser);
      
      // Obtener estadísticas actuales
      const stats = await offlineDataManager.getDataStats(currentUser);
      setDataStats(stats);
      
      if (downloadCheck.needsDownload) {
        setDownloadStatus('needed');
        
        // Auto-descargar si hay conexión y no hay datos existentes
        if (isOnline && !downloadCheck.hasExistingData) {
          console.log('🚀 Auto-iniciando descarga de datos...');
          await handleDownload();
        }
      } else {
        setDownloadStatus('completed');
      }
      
    } catch (error) {
      console.error('❌ Error verificando usuario y datos:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
      setDownloadStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!user || !isOnline) return;
    
    try {
      setIsDownloading(true);
      setError(null);
      setProgress({ step: 'init', percentage: 0, message: 'Iniciando descarga...' });
      
      const result = await offlineDataManager.forceDownloadData(user, setProgress);
      
      if (result.success) {
        setDownloadStatus('completed');
        
        // Actualizar estadísticas
        const newStats = await offlineDataManager.getDataStats(user);
        setDataStats(newStats);
        
        console.log('✅ Descarga completada exitosamente');
      } else {
        setDownloadStatus('error');
        setError(result.error || 'Error en la descarga');
      }
      
    } catch (error) {
      console.error('❌ Error durante descarga:', error);
      setDownloadStatus('error');
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsDownloading(false);
      setProgress({ step: '', percentage: 0, message: '' });
    }
  };

  const handleContinue = () => {
    // Redirigir según el estado
    if (downloadStatus === 'completed' || downloadStatus === 'optional') {
      router.push('/mi-ruta');
    }
  };

  const handleClose = () => {
    // Si tiene datos existentes, permitir cerrar
    if (dataStats && dataStats.routesCount > 0) {
      router.push('/mi-ruta');
    }
  };

  const handleLogout = () => {
    // Limpiar datos de usuario y redirigir al login
    localStorage.clear();
    router.push('/');
  };

  // No mostrar nada si está cargando inicialmente
  if (isLoading) {
    return null;
  }

  // No mostrar nada si no es mercaderista o ya está completado
  if (!user || user.role !== 'Mercaderista' || downloadStatus === 'completed') {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md relative">
        {/* Botón X para cerrar */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          disabled={!dataStats || dataStats.routesCount === 0}
          className="absolute top-2 right-2 h-8 w-8 p-0 rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>

        <CardHeader className="text-center pr-10">
          <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
            {downloadStatus === 'error' ? (
              <AlertCircle className="h-8 w-8 text-red-600" />
            ) : downloadStatus === 'needed' ? (
              <Download className="h-8 w-8 text-blue-600" />
            ) : (
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            )}
          </div>
          <CardTitle className="text-xl">
            {downloadStatus === 'error' ? 'Error de Descarga' :
             downloadStatus === 'needed' ? 'Descarga de Datos' :
             'Datos Listos'}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Estado de conectividad */}
          <div className="flex items-center gap-2 text-sm">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Conectado</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-orange-600" />
                <span className="text-orange-600">Sin conexión</span>
              </>
            )}
          </div>

          {/* Estadísticas actuales */}
          {dataStats && (
            <div className="bg-gray-50 p-3 rounded-lg text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>Rutas: {dataStats.routesCount}</div>
                <div>Clientes: {dataStats.clientsCount}</div>
                <div>Borradores: {dataStats.draftsCount}</div>
                <div>Pendientes: {dataStats.pendingOpsCount}</div>
              </div>
              {dataStats.lastSync && (
                <div className="mt-2 text-gray-600">
                  Última sync: {dataStats.lastSync.toLocaleString()}
                </div>
              )}
            </div>
          )}

          {/* Contenido según estado */}
          {downloadStatus === 'needed' && (
            <>
              <p className="text-gray-600 text-center">
                {dataStats?.routesCount === 0 
                  ? 'Necesitas descargar tus rutas y datos para trabajar offline.'
                  : 'Hay nuevos datos disponibles para descargar.'
                }
              </p>
              
              {isDownloading ? (
                <div className="space-y-3">
                  <Progress value={progress.percentage} className="w-full" />
                  <p className="text-sm text-center text-gray-600">
                    {progress.message}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {!isOnline && (
                    <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                      <p className="text-sm text-orange-700">
                        ⚠️ Sin conexión a internet. Necesitas conectarte para descargar datos.
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDownload}
                      disabled={!isOnline}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Descargar Datos
                    </Button>
                    
                    {dataStats && dataStats.routesCount > 0 && (
                      <Button
                        variant="outline"
                        onClick={handleContinue}
                      >
                        Continuar
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {downloadStatus === 'error' && (
            <>
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                <p className="text-sm text-red-700">
                  {error || 'Error desconocido durante la descarga'}
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleDownload}
                  disabled={!isOnline}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reintentar
                </Button>
                
                {dataStats && dataStats.routesCount > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleContinue}
                  >
                    Continuar
                  </Button>
                )}
              </div>
            </>
          )}

          {downloadStatus === 'completed' && (
            <>
              <p className="text-green-600 text-center">
                ✅ Todos tus datos están listos para trabajar offline
              </p>
              
              <Button onClick={handleContinue} className="w-full">
                Ir a Mi Ruta
              </Button>
            </>
          )}

          {/* Botón de cerrar sesión siempre disponible */}
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full text-red-600 border-red-200 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
