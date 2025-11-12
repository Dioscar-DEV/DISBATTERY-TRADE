'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Download, Share2, CheckCircle, Star, Clock, Wifi, Menu } from 'lucide-react';
import { PermissionChecker } from '@/components/PermissionChecker';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Constantes
const APP_CONFIG = {
  name: 'Disbattery Trade App',
  logo: 'https://storage.googleapis.com/iandai/imagenes/disbatterylogo.png',
  description: 'Aplicación oficial para mercaderistas Disbattery',
  shareTitle: 'Disbattery Trade App',
  shareText: '📱 Instala la app de Disbattery para mercaderistas',
  gradient: 'linear-gradient(to right, #002D72, #D50000)',
} as const;

const APP_FEATURES = [
  { icon: Star, text: 'Gestión de rutas y visitas' },
  { icon: Star, text: 'Captura de fotos y reportes' },
  { icon: Star, text: 'Sincronización automática' },
  { icon: Star, text: 'Funciona sin conexión' },
] as const;

const APP_BADGES = [
  { icon: Wifi, text: 'Funciona Offline', color: 'text-blue-600' },
  { icon: Clock, text: 'Sincronización Auto', color: 'text-green-600' },
  { icon: Smartphone, text: 'Instalable', color: 'text-purple-600' },
] as const;

const INSTALLATION_INSTRUCTIONS = {
  chrome: {
    title: '📱 En Chrome/Edge:',
    steps: [
      'Toca el menú (3 puntos)',
      'Busca "Instalar app" o "Agregar a inicio"',
      'Toca "Instalar"'
    ],
    color: 'blue'
  },
  safari: {
    title: '🍎 En Safari (iPhone):',
    steps: [
      'Toca el botón compartir',
      'Desliza y busca "Agregar a inicio"',
      'Toca "Agregar"'
    ],
    color: 'green'
  },
  android: {
    title: '🤖 En Android:',
    steps: [
      'Toca menú del navegador',
      'Selecciona "Agregar a pantalla de inicio"',
      'Confirma "Agregar"'
    ],
    color: 'purple'
  }
} as const;

const UI_TEXTS = {
  installButton: {
    canInstall: '📱 INSTALAR APP AHORA',
    cannotInstall: '📱 INSTALAR EN MI TELÉFONO'
  },
  continueButton: {
    installed: 'Abrir App',
    notInstalled: 'Usar en Navegador'
  },
  shareButton: 'Compartir con Compañeros',
  tipText: '💡 Tip: Si no ves la opción "Instalar", usa el menú de tu navegador',
  instructionsTitle: '📱 Cómo Instalar la App',
  instructionsDescription: 'Sigue estos pasos para instalar Disbattery Trade en tu teléfono',
  permissionsTitle: 'Configurar Permisos',
  permissionsDescription: 'Activa los permisos necesarios para usar todas las funciones',
  backButton: '← Volver',
  continueUsingApp: 'Continuar Usando la App',
  continueToApp: 'Continuar a la App',
  installedMessage: '¡App ya instalada!',
  installedDescription: 'La aplicación está lista para usar',
  featuresTitle: '🚀 Características Principales:',
  instructionsStepByStep: '🔥 INSTRUCCIONES PASO A PASO:',
} as const;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Custom Hook para manejar instalación PWA
const useAppInstallation = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

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
      window.removeEventListener('appinstalled', () => { });
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setCanInstall(false);
      setDeferredPrompt(null);
      return true;
    }

    return false;
  };

  return {
    deferredPrompt,
    isInstalled,
    canInstall,
    installApp,
  };
};

// Custom Hook para manejar acciones de la app
const useAppActions = () => {
  const router = useRouter();

  const shareApp = async () => {
    const shareData = {
      title: APP_CONFIG.shareTitle,
      text: APP_CONFIG.shareText,
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

  const navigateToApp = (isInstalled: boolean) => {
    if (isInstalled) {
      router.push('/');
    }
  };

  return {
    shareApp,
    navigateToApp,
  };
};

// Componentes
interface InstallationInstructionsProps {
  onBack: () => void;
  onContinue: () => void;
}

const InstallationInstructions: React.FC<InstallationInstructionsProps> = ({ onBack, onContinue }) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-xl font-bold text-blue-600">
          {UI_TEXTS.instructionsTitle}
        </CardTitle>
        <CardDescription>
          {UI_TEXTS.instructionsDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Download className="h-4 w-4" />
          <AlertDescription>
            <strong>{UI_TEXTS.instructionsStepByStep}</strong>
          </AlertDescription>
        </Alert>

        <div className="space-y-3 text-sm">
          {Object.entries(INSTALLATION_INSTRUCTIONS).map(([key, instruction]) => (
            <div key={key} className={`bg-${instruction.color}-50 p-3 rounded-lg border-l-4 border-${instruction.color}-500`}>
              <p className="font-bold">{instruction.title}</p>
              {instruction.steps.map((step, index) => (
                <p key={index}>{index + 1}. {step}</p>
              ))}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Button
            onClick={onBack}
            variant="outline"
            className="w-full"
          >
            {UI_TEXTS.backButton}
          </Button>

          <Button
            onClick={onContinue}
            className="w-full"
            style={{ backgroundImage: APP_CONFIG.gradient }}
          >
            {UI_TEXTS.continueUsingApp}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
);

interface PermissionsSetupProps {
  onBack: () => void;
  onContinue: () => void;
}

const PermissionsSetup: React.FC<PermissionsSetupProps> = ({ onBack, onContinue }) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
    <div className="w-full max-w-md">
      <div className="text-center mb-6">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-4"
        >
          {UI_TEXTS.backButton}
        </Button>
        <h1 className="text-2xl font-bold mb-2">{UI_TEXTS.permissionsTitle}</h1>
        <p className="text-muted-foreground">
          {UI_TEXTS.permissionsDescription}
        </p>
      </div>

      <PermissionChecker
        onPermissionsReady={() => { }}
        showCameraCheck={true}
        showLocationCheck={true}
      />

      <div className="mt-6 text-center">
        <Button
          onClick={onContinue}
          className="w-full"
          style={{ backgroundImage: APP_CONFIG.gradient }}
        >
          {UI_TEXTS.continueToApp}
        </Button>
      </div>
    </div>
  </div>
);

interface MainInstallationScreenProps {
  isInstalled: boolean;
  canInstall: boolean;
  onInstall: () => void;
  onContinue: () => void;
  onShare: () => void;
}

const MainInstallationScreen: React.FC<MainInstallationScreenProps> = ({
  isInstalled,
  canInstall,
  onInstall,
  onContinue,
  onShare,
}) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto mb-4">
          <img
            src={APP_CONFIG.logo}
            alt="Disbattery Logo"
            className="max-h-16 mx-auto"
          />
        </div>
        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent">
          {APP_CONFIG.name}
        </CardTitle>
        <CardDescription className="text-center">
          {APP_CONFIG.description}
        </CardDescription>

        <div className="flex flex-wrap gap-2 justify-center mt-3">
          {APP_BADGES.map((badge, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              <badge.icon className="w-3 h-3 mr-1" />
              {badge.text}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isInstalled && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">{UI_TEXTS.installedMessage}</span>
            </div>
            <p className="text-sm text-green-600 mt-1">
              {UI_TEXTS.installedDescription}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="font-semibold text-center">{UI_TEXTS.featuresTitle}</h3>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {APP_FEATURES.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <feature.icon className="h-4 w-4 text-yellow-500" />
                <span>{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={onInstall}
            className="w-full text-lg py-6"
            style={{ backgroundImage: APP_CONFIG.gradient }}
          >
            <Download className="mr-2 h-5 w-5" />
            {canInstall ? UI_TEXTS.installButton.canInstall : UI_TEXTS.installButton.cannotInstall}
          </Button>

          <Button
            onClick={onContinue}
            variant="outline"
            className="w-full"
          >
            <Smartphone className="mr-2 h-4 w-4" />
            {isInstalled ? UI_TEXTS.continueButton.installed : UI_TEXTS.continueButton.notInstalled}
          </Button>

          <Button
            onClick={onShare}
            variant="outline"
            className="w-full"
          >
            <Share2 className="mr-2 h-4 w-4" />
            {UI_TEXTS.shareButton}
          </Button>
        </div>

        <div className="text-center pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> {UI_TEXTS.tipText}
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default function InstalarPage() {
  const [showPermissions, setShowPermissions] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const router = useRouter();

  const { isInstalled, canInstall, installApp } = useAppInstallation();
  const { shareApp, navigateToApp } = useAppActions();

  const handleInstallClick = async () => {
    const installed = await installApp();
    if (!installed) {
      // Si no hay prompt automático, mostrar instrucciones
      setShowInstructions(true);
    }
  };

  const handleContinue = () => {
    if (isInstalled) {
      navigateToApp(true);
    } else {
      setShowPermissions(true);
    }
  };

  if (showInstructions) {
    return (
      <InstallationInstructions
        onBack={() => setShowInstructions(false)}
        onContinue={() => router.push('/')}
      />
    );
  }

  if (showPermissions) {
    return (
      <PermissionsSetup
        onBack={() => setShowPermissions(false)}
        onContinue={() => router.push('/')}
      />
    );
  }

  return (
    <MainInstallationScreen
      isInstalled={isInstalled}
      canInstall={canInstall}
      onInstall={handleInstallClick}
      onContinue={handleContinue}
      onShare={shareApp}
    />
  );
}