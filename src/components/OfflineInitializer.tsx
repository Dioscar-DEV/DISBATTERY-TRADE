'use client';

import { useEffect } from 'react';
import { initializeOfflineServices } from '@/services/offlineInitializer';
import { serviceWorkerManager } from '@/services/serviceWorkerManager';

export default function OfflineInitializer() {
  useEffect(() => {
    // Inicializar servicios offline al montar el componente
    initializeOfflineServices();
    // Precargar app shell y URLs clave con el SW (evita contaminar cache con RSC)
    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 1000));
        await serviceWorkerManager.precacheAppShell();
        const urls = [
          '/',
          '/mi-ruta',
          '/visit-capture',
          '/signage-capture',
          '/shell-merchandising',
          '/qualid-merchandising',
          '/observaciones',
          '/reportes-finales',
          '/ventas-productos',
          '/trade-eventos',
          '/trade-impulso',
          '/shell-material-interno'
        ];
        await serviceWorkerManager.precacheUrls(urls);
      } catch {}
    })();
  }, []);

  // Este componente no renderiza nada visible
  return null;
}
