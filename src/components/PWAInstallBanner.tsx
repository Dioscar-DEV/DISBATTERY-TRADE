'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Verificar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // ✅ LÓGICA MEJORADA: Banner más persistente
    const bannerDismissed = localStorage.getItem('pwa-banner-dismissed');
    const dismissedTime = bannerDismissed ? parseInt(bannerDismissed) : 0;
    const sixHoursInMs = 6 * 60 * 60 * 1000; // ✅ Reducido a solo 6 horas en lugar de 3 días
    const shouldShow = !bannerDismissed || (Date.now() - dismissedTime > sixHoursInMs);

    console.log('🎯 [PWA Banner] Estado del banner:', {
      bannerDismissed: !!bannerDismissed,
      dismissedTime,
      timeSinceDismissed: bannerDismissed ? (Date.now() - dismissedTime) : 0,
      sixHoursInMs,
      shouldShow,
      isInstalled: window.matchMedia('(display-mode: standalone)').matches
    });

    if (shouldShow) {
      // ✅ MEJORA: Mostrar banner más rápido (1.5 segundos en lugar de 3)
      const timer = setTimeout(() => {
        console.log('🎯 [PWA Banner] Mostrando banner después del delay');
        setShowBanner(true);
      }, 1500);

      return () => clearTimeout(timer);
    } else {
      console.log('🎯 [PWA Banner] Banner no se muestra porque fue cerrado recientemente');
    }

    // Escuchar el evento de instalación
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
      if (shouldShow) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as any);

    // Escuchar cuando se instala
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowBanner(false);
      setCanInstall(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as any);
      window.removeEventListener('appinstalled', () => { });
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setShowBanner(false);
        setCanInstall(false);
        setDeferredPrompt(null);
      }
    } else {
      // Fallback: abrir página de instalación
      window.open('/instalar', '_blank');
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    // ✅ MEJORA: Guardar timestamp cuando el usuario cierra el banner (solo 6 horas)
    localStorage.setItem('pwa-banner-dismissed', Date.now().toString());
    console.log('🎯 [PWA Banner] Banner cerrado, reaparecerá en 6 horas');
  };

  const handleOpenInstallPage = () => {
    window.open('/instalar', '_blank');
  };

  // ✅ NUEVA FUNCIÓN: Resetear banner manualmente (útil para debug o soporte)
  const resetBanner = () => {
    localStorage.removeItem('pwa-banner-dismissed');
    setShowBanner(true);
    console.log('🎯 [PWA Banner] Banner reseteado manualmente');
  };

  // ✅ EXPONER FUNCIÓN EN CONSOLE PARA SOPORTE
  useEffect(() => {
    (window as any).resetPWABanner = resetBanner;
    return () => {
      delete (window as any).resetPWABanner;
    };
  }, []);

  // No mostrar si está instalada o no debe mostrar banner
  if (isInstalled || !showBanner) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top-4 duration-500">
      <div className="bg-gradient-to-r from-[#002D72] to-[#D50000] shadow-lg">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Smartphone className="h-4 w-4 text-white flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  📱 Instalar Disbattery Trade App
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                onClick={canInstall ? handleInstallClick : handleOpenInstallPage}
                size="sm"
                variant="secondary"
                className="bg-white/90 hover:bg-white text-[#002D72] text-xs px-3 py-1 h-7 font-medium"
              >
                <Download className="h-3 w-3 mr-1" />
                Instalar
              </Button>

              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-white/20 text-white"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 