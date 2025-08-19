import { useEffect, useState } from 'react';
import { useToast } from './use-toast';
import { 
  requestNotificationPermission, 
  saveUserNotificationToken, 
  setupForegroundMessageListener 
} from '@/services/notifications';

export interface UseNotificationsProps {
  userId?: string;
  userEmail?: string;
  fullName?: string;
  role?: string;
  sede?: string;
  autoSetup?: boolean;
}

export interface UseNotificationsReturn {
  hasPermission: boolean;
  isInitialized: boolean;
  requestPermission: () => Promise<boolean>;
  initializeNotifications: () => Promise<boolean>;
}

/**
 * Hook para gestionar las notificaciones push en la aplicación
 */
export const useNotifications = ({
  userId,
  userEmail,
  fullName,
  role,
  sede,
  autoSetup = true
}: UseNotificationsProps = {}): UseNotificationsReturn => {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const { toast } = useToast();

  // Verificar estado inicial de permisos
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setHasPermission(Notification.permission === 'granted');
    }
  }, []);

  // Auto-inicializar si se tienen todos los datos del usuario
  useEffect(() => {
    if (autoSetup && userId && userEmail && fullName && role && !isInitialized) {
      console.log('🔔 Auto-inicializando sistema de notificaciones...');
      initializeNotifications();
    }
  }, [userId, userEmail, fullName, role, autoSetup, isInitialized]);

  /**
   * Solicita permisos de notificación al usuario
   */
  const requestPermission = async (): Promise<boolean> => {
    try {
      console.log('🔔 Solicitando permisos de notificación...');
      
      const granted = await requestNotificationPermission();
      setHasPermission(granted);
      
      if (granted) {
        toast({
          title: '🔔 Notificaciones Habilitadas',
          description: 'Recibirás notificaciones sobre nuevas rutas y actualizaciones.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: '❌ Permisos Denegados',
          description: 'No podrás recibir notificaciones push. Puedes habilitarlas desde la configuración del navegador.',
        });
      }
      
      return granted;
    } catch (error) {
      console.error('❌ Error solicitando permisos de notificación:', error);
      toast({
        variant: 'destructive',
        title: 'Error en Notificaciones',
        description: 'No se pudieron configurar las notificaciones push.',
      });
      return false;
    }
  };

  /**
   * Inicializa completamente el sistema de notificaciones
   */
  const initializeNotifications = async (): Promise<boolean> => {
    try {
      if (!userId || !userEmail || !fullName || !role) {
        console.log('⚠️ Faltan datos del usuario para inicializar notificaciones');
        return false;
      }

      console.log('🔄 Inicializando sistema de notificaciones para:', {
        userId,
        email: userEmail,
        role,
        sede
      });

      // 1. Solicitar permisos si no los tenemos
      let permissionGranted = hasPermission;
      if (!permissionGranted) {
        permissionGranted = await requestPermission();
        if (!permissionGranted) {
          console.log('❌ No se pueden inicializar notificaciones sin permisos');
          return false;
        }
      }

      // 2. Guardar token del usuario
      console.log('💾 Guardando token de notificación...');
      const tokenSaved = await saveUserNotificationToken(
        userId,
        userEmail,
        fullName,
        role,
        sede
      );

      if (!tokenSaved) {
        console.log('❌ No se pudo guardar el token de notificación');
        toast({
          variant: 'destructive',
          title: 'Error Guardando Token',
          description: 'No se pudo registrar tu dispositivo para notificaciones.',
        });
        return false;
      }

      // 3. Configurar listener para mensajes en primer plano
      console.log('👂 Configurando listener de mensajes...');
      setupForegroundMessageListener();

      // 4. Registrar Service Worker si no está registrado
      if ('serviceWorker' in navigator) {
        try {
          // Registrar el service worker de Firebase para notificaciones
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('✅ Firebase Service Worker registrado:', registration.scope);
          
          // También registrar nuestro service worker personalizado para otras funciones
          try {
            const customRegistration = await navigator.serviceWorker.register('/sw-notifications.js');
            console.log('✅ Service Worker personalizado registrado:', customRegistration.scope);
          } catch (customError) {
            console.log('⚠️ Service Worker personalizado ya registrado o error menor:', customError.message);
          }
        } catch (swError) {
          console.error('❌ Error registrando Service Worker de Firebase:', swError);
        }
      }

      setIsInitialized(true);
      console.log('✅ Sistema de notificaciones inicializado correctamente');

      toast({
        title: '✅ Notificaciones Configuradas',
        description: 'Recibirás notificaciones sobre rutas y actualizaciones importantes.',
      });

      return true;
    } catch (error) {
      console.error('❌ Error inicializando notificaciones:', error);
      toast({
        variant: 'destructive',
        title: 'Error de Configuración',
        description: 'No se pudo configurar el sistema de notificaciones.',
      });
      return false;
    }
  };

  return {
    hasPermission,
    isInitialized,
    requestPermission,
    initializeNotifications
  };
};

/**
 * Hook simplificado para usuarios que solo necesitan verificar el estado
 */
export const useNotificationStatus = () => {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supported = 'Notification' in window && 'serviceWorker' in navigator;
      setIsSupported(supported);
      
      if (supported) {
        setHasPermission(Notification.permission === 'granted');
      }
    }
  }, []);

  return {
    hasPermission,
    isSupported,
    canReceiveNotifications: isSupported && hasPermission
  };
};