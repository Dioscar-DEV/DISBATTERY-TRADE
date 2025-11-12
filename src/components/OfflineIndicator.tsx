'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);
  const [pendingData, setPendingData] = useState(0);

  useEffect(() => {
    // Función para verificar conectividad real
    const checkConnectivity = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }

      try {
        const response = await fetch('/favicon.ico', {
          method: 'HEAD',
          cache: 'no-cache',
          mode: 'no-cors'
        });
        setIsOnline(true);
      } catch {
        setIsOnline(false);
      }
    };

    // Función para verificar datos pendientes
    const checkPendingData = async () => {
      try {
        const { offlineManager } = await import('@/services/offlineManager');
        const stats = await offlineManager.getSyncStats();
        setPendingData(stats.pending);
      } catch (error) {
        console.warn('Error checking pending data:', error);
      }
    };

    // Verificar al cargar
    checkConnectivity();
    checkPendingData();

    // Escuchar eventos de conexión del navegador
    const handleOnline = () => {
      checkConnectivity();
      checkPendingData();
      setShowOfflineMessage(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
      checkPendingData();

      // Ocultar mensaje después de 5 segundos
      setTimeout(() => {
        setShowOfflineMessage(false);
      }, 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificar conectividad cada 30 segundos
    const interval = setInterval(() => {
      checkConnectivity();
      checkPendingData();
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Solo mostrar cuando está offline o hay datos pendientes
  if (isOnline && !showOfflineMessage && pendingData === 0) {
    return null;
  }

  return (
    <>
      {/* Indicador fijo en la esquina */}
      <div className="fixed bottom-4 right-4 z-40">
        <div className={`text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm ${
          !isOnline ? 'bg-orange-500' : 'bg-blue-500'
        }`}>
          {!isOnline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
          <span>
            {!isOnline ? 'Modo Offline' : `${pendingData} pendientes`}
          </span>
        </div>
      </div>

      {/* Mensaje temporal cuando se pierde la conexión */}
      {showOfflineMessage && (
        <div className="fixed top-20 left-4 right-4 z-50 animate-in slide-in-from-top-4 duration-300">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <WifiOff className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-orange-800">
                  Sin conexión a internet
                </h4>
                <p className="text-xs text-orange-600 mt-1">
                  La app sigue funcionando offline. Los datos se sincronizarán cuando se restaure la conexión.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 