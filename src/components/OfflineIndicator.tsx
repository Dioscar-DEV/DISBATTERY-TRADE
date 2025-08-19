'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

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

    // Verificar al cargar
    checkConnectivity();

    // Escuchar eventos de conexión del navegador
    const handleOnline = () => {
      checkConnectivity();
      setShowOfflineMessage(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
      
      // Ocultar mensaje después de 5 segundos
      setTimeout(() => {
        setShowOfflineMessage(false);
      }, 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificar conectividad cada 30 segundos
    const interval = setInterval(checkConnectivity, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Solo mostrar cuando está offline
  if (isOnline && !showOfflineMessage) {
    return null;
  }

  return (
    <>
      {/* Indicador fijo en la esquina */}
      <div className="fixed bottom-4 right-4 z-40">
        <div className="bg-orange-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
          <WifiOff className="h-4 w-4" />
          <span>Modo Offline</span>
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