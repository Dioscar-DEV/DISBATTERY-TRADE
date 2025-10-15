'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

/**
 * Componente para manejar errores de ChunkLoadError
 * Se debe incluir en el layout principal
 */
export function ChunkErrorHandler() {
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Detectar si se está mostrando contenido de archivo .txt en lugar de HTML
    const detectTxtContentError = () => {
      const bodyText = document.body.textContent || '';
      if (
        bodyText.includes('static/chunks/') &&
        bodyText.includes('PostHogProvider') &&
        bodyText.includes('PWAInstallBanner') &&
        document.body.children.length < 3 // Muy pocos elementos DOM
      ) {
        console.error('🚨 DETECTADO: Archivo .txt siendo servido como HTML');

        toast({
          variant: 'destructive',
          title: 'Error crítico detectado',
          description: 'Limpiando cache y recargando...',
          duration: 2000,
        });

        // Limpiar todo el cache inmediatamente
        if ('caches' in window) {
          caches.keys().then(cacheNames => {
            return Promise.all(cacheNames.map(name => caches.delete(name)));
          }).then(() => {
            window.location.reload();
          });
        } else {
          window.location.reload();
        }

        return true; // Indica que se detectó el error
      }
      return false;
    };

    const handleChunkError = (event: ErrorEvent) => {
      const error = event.error || event;

      // Detectar ChunkLoadError y errores de archivos .txt siendo servidos como HTML
      if (
        error?.name === 'ChunkLoadError' ||
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('ChunkLoadError')
      ) {
        console.warn('🔄 ChunkLoadError detectado, limpiando cache y recargando...', error);

        // Mostrar toast de información
        toast({
          title: 'Actualizando aplicación',
          description: 'Detectamos una nueva versión. Recargando...',
          duration: 3000,
        });

        // Limpiar service worker cache
        if ('serviceWorker' in navigator && 'caches' in window) {
          caches.keys().then(cacheNames => {
            return Promise.all(
              cacheNames.map(cacheName => {
                if (cacheName.includes('next-chunks') || cacheName.includes('static-cache')) {
                  console.log(`🗑️ Limpiando cache: ${cacheName}`);
                  return caches.delete(cacheName);
                }
              })
            );
          }).then(() => {
            // Recargar después de limpiar cache
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          });
        } else {
          // Si no hay service worker, solo recargar
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;

      // Detectar chunk errors en promises
      if (
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('ChunkLoadError')
      ) {
        console.warn('🔄 ChunkLoadError en promise, limpiando cache...', error);
        handleChunkError({ error } as ErrorEvent);
        event.preventDefault(); // Prevenir que aparezca en console
      }
    };

    // Verificar inmediatamente al cargar si hay error de .txt
    setTimeout(() => {
      detectTxtContentError();
    }, 1000);

    // Verificar periódicamente si aparece el error
    const intervalId = setInterval(() => {
      if (detectTxtContentError()) {
        clearInterval(intervalId);
      }
    }, 3000);

    // Agregar listeners
    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [router, toast]);

  return null; // Este componente no renderiza nada
}
