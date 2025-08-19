'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Download, Share2, CheckCircle, Star, Clock, Wifi, Menu, Plus } from 'lucide-react';
import { PermissionChecker } from '@/components/PermissionChecker';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function InstalarPage() {
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Verificar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Escuchar el evento de instalación
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as any);

    // Escuchar cuando se instala
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as any);
      window.removeEventListener('appinstalled', () => {});
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Si no hay prompt automático, mostrar instrucciones
      setShowInstructions(true);
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setCanInstall(false);
      setDeferredPrompt(null);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Disbattery Trade App',
      text: '📱 Instala la app de Disbattery para mercaderistas',
      url: window.location.origin
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.log('Error compartiendo:', error);
        // Fallback: copiar al portapapeles
        await navigator.clipboard.writeText(window.location.origin);
        alert('Link copiado al portapapeles');
      }
    } else {
      // Fallback: copiar al portapapeles
      await navigator.clipboard.writeText(window.location.origin);
      alert('Link copiado al portapapeles');
    }
  };

  const handleContinue = () => {
    if (isInstalled) {
      router.push('/');
    } else {
      setShowPermissions(true);
    }
  };

  if (showInstructions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold text-blue-600">
              📱 Cómo Instalar la App
            </CardTitle>
            <CardDescription>
              Sigue estos pasos para instalar Disbattery Trade en tu teléfono
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Download className="h-4 w-4" />
              <AlertDescription>
                <strong>🔥 INSTRUCCIONES PASO A PASO:</strong>
              </AlertDescription>
            </Alert>

            <div className="space-y-3 text-sm">
              <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
                <p className="font-bold">📱 En Chrome/Edge:</p>
                <p>1. Toca el menú <Menu className="inline h-4 w-4" /> (3 puntos)</p>
                <p>2. Busca "Instalar app" o "Agregar a inicio"</p>
                <p>3. Toca "Instalar"</p>
              </div>

              <div className="bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
                <p className="font-bold">🍎 En Safari (iPhone):</p>
                <p>1. Toca el botón <Share2 className="inline h-4 w-4" /> compartir</p>
                <p>2. Desliza y busca "Agregar a inicio"</p>
                <p>3. Toca "Agregar"</p>
              </div>

              <div className="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-500">
                <p className="font-bold">🤖 En Android:</p>
                <p>1. Toca <Menu className="inline h-4 w-4" /> menú del navegador</p>
                <p>2. Selecciona "Agregar a pantalla de inicio"</p>
                <p>3. Confirma "Agregar"</p>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => setShowInstructions(false)}
                variant="outline"
                className="w-full"
              >
                ← Volver
              </Button>
              
              <Button
                onClick={() => router.push('/')}
                className="w-full"
                style={{ backgroundImage: 'linear-gradient(to right, #002D72, #D50000)' }}
              >
                Continuar Usando la App
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showPermissions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <Button
              variant="ghost"
              onClick={() => setShowPermissions(false)}
              className="mb-4"
            >
              ← Volver
            </Button>
            <h1 className="text-2xl font-bold mb-2">Configurar Permisos</h1>
            <p className="text-muted-foreground">
              Activa los permisos necesarios para usar todas las funciones
            </p>
          </div>
          
          <PermissionChecker 
            onPermissionsReady={() => {}}
            showCameraCheck={true}
            showLocationCheck={true}
          />
          
          <div className="mt-6 text-center">
            <Button
              onClick={() => router.push('/')}
              className="w-full"
              style={{ backgroundImage: 'linear-gradient(to right, #002D72, #D50000)' }}
            >
              Continuar a la App
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4">
            <img
              src="https://storage.googleapis.com/iandai/imagenes/disbatterylogo.png"
              alt="Disbattery Logo"
              className="max-h-16 mx-auto"
            />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent">
            Disbattery Trade App
          </CardTitle>
          <CardDescription className="text-center">
            Aplicación oficial para mercaderistas Disbattery
          </CardDescription>
          
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            <Badge variant="secondary" className="text-xs">
              <Wifi className="w-3 h-3 mr-1" />
              Funciona Offline
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              Sincronización Auto
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Smartphone className="w-3 h-3 mr-1" />
              Instalable
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isInstalled && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">¡App ya instalada!</span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                La aplicación está lista para usar
              </p>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-semibold text-center">🚀 Características Principales:</h3>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Gestión de rutas y visitas</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Captura de fotos y reportes</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Sincronización automática</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Funciona sin conexión</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {/* BOTÓN DE INSTALACIÓN SIEMPRE VISIBLE */}
            <Button
              onClick={handleInstallClick}
              className="w-full text-lg py-6"
              style={{ backgroundImage: 'linear-gradient(to right, #002D72, #D50000)' }}
            >
              <Download className="mr-2 h-5 w-5" />
              {canInstall ? '📱 INSTALAR APP AHORA' : '📱 INSTALAR EN MI TELÉFONO'}
            </Button>

            <Button
              onClick={handleContinue}
              variant="outline"
              className="w-full"
            >
              <Smartphone className="mr-2 h-4 w-4" />
              {isInstalled ? 'Abrir App' : 'Usar en Navegador'}
            </Button>

            <Button
              onClick={handleShare}
              variant="outline"
              className="w-full"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Compartir con Compañeros
            </Button>
          </div>

          <div className="text-center pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> Si no ves la opción "Instalar", usa el menú de tu navegador
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 