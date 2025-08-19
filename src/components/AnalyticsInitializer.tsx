'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { analyticsService } from '@/services/analytics';

export function AnalyticsInitializer() {
  const pathname = usePathname();

  useEffect(() => {
    // Inicializar Analytics al montar el componente
    const initAnalytics = async () => {
      try {
        await analyticsService.initialize();
        
        // Trackear si es PWA launch
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
          await analyticsService.trackPWALaunch();
        }

        // Trackear el estado inicial de conexión
        await analyticsService.trackOfflineMode(!navigator.onLine);

      } catch (error) {
        console.error('Error inicializando Analytics:', error);
      }
    };

    initAnalytics();

    // Eventos de conexión/desconexión
    const handleOnline = () => {
      analyticsService.trackOfflineMode(false);
    };

    const handleOffline = () => {
      analyticsService.trackOfflineMode(true);
    };

    // Event listeners para PWA
    const handleBeforeInstallPrompt = () => {
      // Se muestra el prompt de instalación
      analyticsService.logEvent('pwa_install_prompt_shown');
    };

    const handleAppInstalled = () => {
      analyticsService.trackPWAInstall();
    };

    // Agregar event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Trackear cambios de ruta
  useEffect(() => {
    if (pathname) {
      const pageName = pathname.split('/').filter(Boolean).join('_') || 'home';
      analyticsService.trackPageView(pageName);
    }
  }, [pathname]);

  // Hook para trackear tiempo en página
  useEffect(() => {
    const startTime = Date.now();
    const pageName = pathname.split('/').filter(Boolean).join('_') || 'home';

    return () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      if (timeSpent > 5) { // Solo trackear si estuvo más de 5 segundos
        analyticsService.trackTimeSpent(pageName, timeSpent);
      }
    };
  }, [pathname]);

  // Trackear errores globales
  useEffect(() => {
    const handleUnhandledError = (event: ErrorEvent) => {
      analyticsService.trackError(new Error(event.message), 'unhandled_error');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      analyticsService.trackError(new Error(String(event.reason)), 'unhandled_promise_rejection');
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null; // Este componente no renderiza nada
}