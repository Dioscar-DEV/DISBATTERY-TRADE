'use client';

import { offlineDataManager } from '@/services/offlineDataManager';
import { offlineQueue } from '@/services/offlineQueue';

// Función para inicializar todos los servicios offline
export async function initializeOfflineServices() {
  try {
    console.log('🔄 Initializing offline services...');
    
    // 1. Inicializar sistema offline unificado
    const dbInitialized = await offlineDataManager.initialize();
    if (!dbInitialized) {
      throw new Error('Failed to initialize offline data manager');
    }
    console.log('✅ Offline data manager initialized and migrated');
    
    // 2. Registrar Service Worker si no está en desarrollo
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('✅ Service Worker registered:', registration.scope);
          
          // Escuchar actualizaciones del SW
          registration.addEventListener('updatefound', () => {
            console.log('🔄 New Service Worker version found');
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('✅ New Service Worker installed, update available');
                  // Aquí se puede mostrar notificación de actualización disponible
                  showUpdateAvailableNotification();
                }
              });
            }
          });
        } catch (error) {
          console.warn('⚠️ Service Worker registration failed:', error);
        }
      } else {
        console.log('🔧 Service Worker disabled in development');
      }
    }
    
    // 3. Configurar listeners de conectividad
    setupConnectivityListeners();
    
    // 4. Inicializar sincronización automática
    setupAutoSync();
    
    console.log('✅ All offline services initialized successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Error initializing offline services:', error);
    return false;
  }
}

// Configurar listeners de conectividad
function setupConnectivityListeners() {
  if (typeof window === 'undefined') return;
  
  const handleOnline = () => {
    console.log('🌐 Connection restored - starting sync');
    // Aquí se activará la sincronización automática
    triggerAutoSync();
  };
  
  const handleOffline = () => {
    console.log('📱 Connection lost - switching to offline mode');
    // Aquí se puede mostrar notificación de modo offline
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Cleanup function (se puede llamar en unmount)
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// Configurar sincronización automática
function setupAutoSync() {
  if (typeof window === 'undefined') return;
  
  // Sincronización cada 5 minutos si hay conexión
  const syncInterval = setInterval(() => {
    if (navigator.onLine) {
      triggerAutoSync();
    }
  }, 5 * 60 * 1000); // 5 minutos
  
  // Sincronización al ganar foco
  const handleFocus = () => {
    if (navigator.onLine) {
      triggerAutoSync();
    }
  };
  
  window.addEventListener('focus', handleFocus);
  
  // Cleanup function
  return () => {
    clearInterval(syncInterval);
    window.removeEventListener('focus', handleFocus);
  };
}

// Función para activar sincronización automática
async function triggerAutoSync() {
  try {
    // Esta función se implementará en el servicio de sincronización
    console.log('🔄 Auto sync triggered');
    await offlineQueue.processQueue();
  } catch (error) {
    console.error('Error during auto sync:', error);
  }
}

// Mostrar notificación de actualización disponible
function showUpdateAvailableNotification() {
  // Esta función se puede integrar con el sistema de notificaciones
  console.log('📢 Update available notification');
  
  // Crear evento personalizado para que los componentes puedan escucharlo
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('sw-update-available', {
      detail: { message: 'Nueva versión disponible' }
    });
    window.dispatchEvent(event);
  }
}

// Hook para inicializar servicios offline en componentes
export function useOfflineInitializer() {
  if (typeof window !== 'undefined') {
    // Solo ejecutar una vez cuando el componente se monta
    initializeOfflineServices();
  }
}

// Función para verificar el estado de los servicios offline
export async function getOfflineServicesStatus() {
  try {
    const status = {
      indexedDB: false,
      serviceWorker: false,
      connectivity: typeof window !== 'undefined' ? navigator.onLine : false,
      timestamp: Date.now()
    };
    
    // Verificar IndexedDB
    try {
      const { db } = await import('@/lib/indexedDB');
      await db.open();
      status.indexedDB = true;
    } catch (error) {
      console.warn('IndexedDB not available:', error);
    }
    
    // Verificar Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      status.serviceWorker = !!registration?.active;
    }
    
    return status;
  } catch (error) {
    console.error('Error checking offline services status:', error);
    return null;
  }
}
