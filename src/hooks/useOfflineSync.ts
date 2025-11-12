/**
 * Hook para manejar funcionalidad offline y sincronización automática
 * VERSIÓN CONSOLIDADA - Usa offlineManager unificado
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { serviceWorkerManager } from "@/services/serviceWorkerManager";
import { offlineManager } from "@/services/offlineManager";
import { fallbackStorage } from "@/services/fallbackStorage";

interface OfflineSyncState {
  isOnline: boolean;
  isServiceWorkerReady: boolean;
  isSyncing: boolean;
  pendingVisitas: number;
  lastSyncAttempt?: Date;
  syncError?: string;
}

interface SyncResult {
  success: boolean;
  processed: number;
  errors: number;
}

export function useOfflineSync() {
  const [state, setState] = useState<OfflineSyncState>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isServiceWorkerReady: false,
    isSyncing: false,
    pendingVisitas: 0,
  });

  const syncIntervalRef = useRef<NodeJS.Timeout>();
  const lastSyncAttemptRef = useRef<Date>();

  /**
   * Actualiza el estado de sincronización
   */
  const updateSyncStatus = useCallback(async () => {
    try {
      // Usar offlineManager consolidado
      const stats = await offlineManager.getSyncStats();
      
      setState((prev) => ({
        ...prev,
        pendingVisitas: stats.pending,
        lastSyncAttempt: stats.lastSync,
      }));
    } catch (error) {
      console.error("❌ Error actualizando estado de sync:", error);
    }
  }, []);

  /**
   * Inicializa el sistema offline consolidado y Service Worker
   */
  const initializeServiceWorker = useCallback(async () => {
    // Verificar si estamos en un entorno que soporta Service Workers
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log("ℹ️ [useOfflineSync] Service Workers no disponibles en este entorno");
      return;
    }

    // En desarrollo, ser más tolerante con errores
    const isDevelopment = process.env.NODE_ENV === 'development';

    try {
      console.log("🔧 [useOfflineSync] Inicializando sistema offline consolidado...");

      // Inicializar sistema offline usando offlineManager consolidado
      const initResult = await offlineManager.initializeOfflineSystem();
      if (initResult.success) {
        console.log(`✅ [useOfflineSync] Sistema offline inicializado - IndexedDB: ${initResult.indexedDBAvailable}, Fallback: ${initResult.fallbackAvailable}`);
      } else {
        console.warn("⚠️ [useOfflineSync] Sistema offline con funcionalidad limitada:", initResult.errors);
      }

      // Inicializar Service Worker
      const success = await serviceWorkerManager.initialize();
      if (success) {
        setState((prev) => ({ ...prev, isServiceWorkerReady: true }));

        // Registrar background sync (con manejo de errores mejorado)
        try {
          const syncRegistered = await serviceWorkerManager.registerBackgroundSync();
          if (syncRegistered) {
            console.log("✅ [useOfflineSync] Background sync configurado");
          } else {
            console.warn("⚠️ [useOfflineSync] Background sync no pudo ser configurado, pero el SW está activo");
          }
        } catch (syncError) {
          if (isDevelopment) {
            console.warn("⚠️ [useOfflineSync] Background sync falló en desarrollo:", syncError);
          } else {
            console.error("❌ [useOfflineSync] Error configurando background sync:", syncError);
          }
        }

        // Configurar listeners de mensajes del Service Worker
        serviceWorkerManager.onMessage("sync-complete", (data) => {
          console.log(
            "✅ [useOfflineSync] Sincronización completada desde SW:",
            data
          );
          updateSyncStatus();
        });

        console.log(
          "✅ [useOfflineSync] Service Worker configurado exitosamente"
        );
      } else {
        const message = "⚠️ [useOfflineSync] Service Worker no pudo ser inicializado";
        if (isDevelopment) {
          console.warn(message + " (normal en desarrollo)");
        } else {
          console.warn(message);
        }
      }
    } catch (error) {
      const message = "❌ [useOfflineSync] Error inicializando sistema offline:";
      if (isDevelopment) {
        console.warn(message, error, "(normal en desarrollo)");
      } else {
        console.error(message, error);
      }
    }
  }, [updateSyncStatus]);

  /**
   * Ejecuta sincronización manual
   */
  const triggerSync = useCallback(async (): Promise<SyncResult> => {
    if (state.isSyncing) {
      console.log("🔄 [useOfflineSync] Sincronización ya en progreso");
      return { success: false, processed: 0, errors: 0 };
    }

    try {
      setState((prev) => ({ ...prev, isSyncing: true, syncError: undefined }));
      console.log("🚀 [useOfflineSync] Iniciando sincronización manual...");

      const result = await offlineManager.forceSync();

      setState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncAttempt: new Date(),
      }));

      // Actualizar estado después de la sincronización
      await updateSyncStatus();

      console.log(
        `✅ [useOfflineSync] Sincronización completada: ${result.processed} procesadas, ${result.errors} errores`
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      setState((prev) => ({
        ...prev,
        isSyncing: false,
        syncError: errorMessage,
      }));

      console.error("❌ [useOfflineSync] Error durante sincronización:", error);

      return { success: false, processed: 0, errors: 1 };
    }
  }, [state.isSyncing, updateSyncStatus]);

  /**
   * Programa sincronización automática
   */
  const scheduleAutoSync = useCallback(() => {
    // Limpiar intervalo existente
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }

    // Programar sincronización cada 5 minutos si hay conexión
    syncIntervalRef.current = setInterval(async () => {
      if (state.isOnline && !state.isSyncing && state.pendingVisitas > 0) {
        console.log(
          "⏰ [useOfflineSync] Ejecutando sincronización automática..."
        );

        // Evitar sincronización si se hizo una reciente (menos de 2 minutos)
        const now = new Date();
        if (lastSyncAttemptRef.current) {
          const timeSinceLastSync =
            now.getTime() - lastSyncAttemptRef.current.getTime();
          if (timeSinceLastSync < 2 * 60 * 1000) {
            // 2 minutos
            console.log(
              "⏭️ [useOfflineSync] Sincronización reciente, omitiendo..."
            );
            return;
          }
        }

        lastSyncAttemptRef.current = now;
        await triggerSync();
      }
    }, 5 * 60 * 1000); // 5 minutos
  }, [state.isOnline, state.isSyncing, state.pendingVisitas, triggerSync]);

  /**
   * Maneja cambios en el estado de conexión
   */
  const handleConnectionChange = useCallback(async () => {
    const isOnline = navigator.onLine;

    setState((prev) => ({ ...prev, isOnline }));

    if (isOnline && state.pendingVisitas > 0) {
      console.log(
        "🌐 [useOfflineSync] Conexión restaurada, iniciando sincronización..."
      );

      // Esperar un poco antes de sincronizar para asegurar conectividad estable
      setTimeout(() => {
        triggerSync();
      }, 2000);
    }
  }, [state.pendingVisitas, triggerSync]);

  /**
   * Fuerza sincronización a través del Service Worker
   */
  const forceSyncThroughSW = useCallback(async (): Promise<boolean> => {
    if (!state.isServiceWorkerReady) {
      console.warn("⚠️ [useOfflineSync] Service Worker no está listo");
      return false;
    }

    try {
      await serviceWorkerManager.forceSync();
      await updateSyncStatus();
      return true;
    } catch (error) {
      console.error(
        "❌ [useOfflineSync] Error forzando sync a través de SW:",
        error
      );
      return false;
    }
  }, [state.isServiceWorkerReady, updateSyncStatus]);

  /**
   * Obtiene el estado del sistema offline consolidado
   */
  const getOfflineSystemStatus = useCallback(async () => {
    try {
      return await offlineManager.getOfflineSystemStatus();
    } catch (error) {
      console.error("❌ [useOfflineSync] Error obteniendo estado del sistema:", error);
      return {
        indexedDB: false,
        localStorage: fallbackStorage.isAvailable(),
        canSaveOffline: fallbackStorage.isAvailable()
      };
    }
  }, []);

  // Efectos
  useEffect(() => {
    // Inicializar Service Worker
    initializeServiceWorker();

    // Configurar listeners de conectividad
    (window as Window).addEventListener("online", handleConnectionChange);
    (window as Window).addEventListener("offline", handleConnectionChange);

    return () => {
      (window as Window).removeEventListener("online", handleConnectionChange);
      (window as Window).removeEventListener("offline", handleConnectionChange);
    };
  }, [initializeServiceWorker, handleConnectionChange]);

  useEffect(() => {
    // Actualizar estado inicial
    updateSyncStatus();
  }, [updateSyncStatus]);

  useEffect(() => {
    // Programar sincronización automática
    scheduleAutoSync();

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [scheduleAutoSync]);

  return {
    // Estado
    ...state,

    // Acciones
    triggerSync,
    forceSyncThroughSW,
    updateSyncStatus,
    getOfflineSystemStatus,

    // Utilidades
    hasServiceWorker: state.isServiceWorkerReady,
    canSync: state.isOnline && !state.isSyncing,
    needsSync: state.pendingVisitas > 0,
  };
}
