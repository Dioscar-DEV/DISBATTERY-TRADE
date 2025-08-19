'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/indexedDB';

interface ConnectivityStatus {
  isOnline: boolean;
  isFirebaseConnected: boolean;
  pendingOperations: number;
  lastSyncAt?: number;
}

export default function OfflineConnectivityBanner() {
  const [status, setStatus] = useState<ConnectivityStatus>({
    isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
    isFirebaseConnected: false,
    pendingOperations: 0
  });
  const [isVisible, setIsVisible] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Monitorear conectividad
  useEffect(() => {
    const updateOnlineStatus = () => {
      setStatus(prev => ({
        ...prev,
        isOnline: navigator.onLine
      }));
    };

    const updatePendingOperations = async () => {
      try {
        const pendingOps = await db.pendingOps
          .where('status')
          .anyOf(['pending', 'processing'])
          .count();
        
        setStatus(prev => ({
          ...prev,
          pendingOperations: pendingOps
        }));
      } catch (error) {
        console.error('Error counting pending operations:', error);
      }
    };

    // Event listeners para conectividad
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Actualizar operaciones pendientes cada 30 segundos
    const interval = setInterval(updatePendingOperations, 30000);
    
    // Actualización inicial
    updatePendingOperations();

    // Cleanup
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(interval);
    };
  }, []);

  // Función para forzar sincronización
  const handleForceSync = async () => {
    if (!status.isOnline) return;
    
    setIsSyncing(true);
    try {
      // Aquí se implementará la lógica de sincronización
      // Por ahora solo simular el proceso
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setStatus(prev => ({
        ...prev,
        lastSyncAt: Date.now(),
        pendingOperations: 0
      }));
    } catch (error) {
      console.error('Error during sync:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Función para obtener el mensaje de estado
  const getStatusMessage = () => {
    if (!status.isOnline) {
      return {
        type: 'warning' as const,
        icon: <WifiOff className="h-4 w-4" />,
        title: 'Sin conexión a internet',
        description: 'Trabajando en modo offline. Los datos se sincronizarán cuando vuelva la conexión.'
      };
    }

    if (status.pendingOperations > 0) {
      return {
        type: 'info' as const,
        icon: <Cloud className="h-4 w-4" />,
        title: 'Sincronización pendiente',
        description: `${status.pendingOperations} operación${status.pendingOperations > 1 ? 'es' : ''} pendiente${status.pendingOperations > 1 ? 's' : ''} de sincronizar.`
      };
    }

    if (status.lastSyncAt) {
      const timeSinceSync = Date.now() - status.lastSyncAt;
      const minutesAgo = Math.floor(timeSinceSync / (1000 * 60));
      
      return {
        type: 'success' as const,
        icon: <Wifi className="h-4 w-4" />,
        title: 'Conectado y sincronizado',
        description: `Última sincronización: ${minutesAgo === 0 ? 'ahora' : `hace ${minutesAgo} min`}`
      };
    }

    return {
      type: 'info' as const,
      icon: <Wifi className="h-4 w-4" />,
      title: 'Conectado',
      description: 'Conexión activa. Datos sincronizados automáticamente.'
    };
  };

  // No mostrar si está minimizado y todo está bien
  if (!isVisible && status.isOnline && status.pendingOperations === 0) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsVisible(true)}
          className="bg-white/90 backdrop-blur-sm"
        >
          <Wifi className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const statusInfo = getStatusMessage();

  return (
    <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto">
      <Alert className={`
        transition-all duration-300 bg-white/95 backdrop-blur-sm border shadow-lg
        ${statusInfo.type === 'warning' ? 'border-orange-200 bg-orange-50/95' : ''}
        ${statusInfo.type === 'success' ? 'border-green-200 bg-green-50/95' : ''}
        ${statusInfo.type === 'info' ? 'border-blue-200 bg-blue-50/95' : ''}
      `}>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div className={`
              mt-0.5
              ${statusInfo.type === 'warning' ? 'text-orange-600' : ''}
              ${statusInfo.type === 'success' ? 'text-green-600' : ''}
              ${statusInfo.type === 'info' ? 'text-blue-600' : ''}
            `}>
              {statusInfo.icon}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm">{statusInfo.title}</h4>
                {status.pendingOperations > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {status.pendingOperations}
                  </Badge>
                )}
              </div>
              
              <AlertDescription className="text-xs text-gray-600">
                {statusInfo.description}
              </AlertDescription>
            </div>
          </div>

          <div className="flex items-center gap-1 ml-2">
            {status.isOnline && status.pendingOperations > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleForceSync}
                disabled={isSyncing}
                className="h-8 px-2 text-xs"
              >
                {isSyncing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  'Sincronizar'
                )}
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="h-8 w-8 p-0"
            >
              ×
            </Button>
          </div>
        </div>
      </Alert>
    </div>
  );
}
