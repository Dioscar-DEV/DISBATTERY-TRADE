/**
 * Hook para manejar funcionalidad offline y sincronización automática
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { serviceWorkerManager } from "@/services/serviceWorkerManager";
import { syncService } from "@/services/syncService";
import { offlineService } from "@/services/offlineService";

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
      const syncStatus = await offlineService.getSyncStatus();

      setState((prev) => ({
        ...prev,
        pendingVisitas: syncStatus.pendingVisitas,
        lastSyncAttempt: syncStatus.lastPartialSync
          ? new Date(syncStatus.lastPartialSync)
          : undefined,
      }));
    } catch (error) {
      console.error("❌ Error actualizando estado de sync:", error);
    }
  }, []);

  /**
   * Inicializa el Service Worker y la sincronización automática
   */
  const initializeServiceWorker = useCallback(async () => {
    try {
      console.log("🔧 [useOfflineSync] Inicializando Service Worker...");

      const success = await serviceWorkerManager.initialize();
      if (success) {
        setState((prev) => ({ ...prev, isServiceWorkerReady: true }));

        // Registrar background sync
        await serviceWorkerManager.registerBackgroundSync();

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
        console.warn(
          "⚠️ [useOfflineSync] Service Worker no pudo ser inicializado"
        );
      }
    } catch (error) {
      console.error(
        "❌ [useOfflineSync] Error inicializando Service Worker:",
        error
      );
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

      const result = await syncService.syncPendingVisitas();

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

      return {
        success: result.success,
        processed: result.processed,
        errors: result.errors,
      };
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

  // Efectos
  useEffect(() => {
    // Inicializar Service Worker
    initializeServiceWorker();

    // Configurar listeners de conectividad
    window.addEventListener("online", handleConnectionChange);
    window.addEventListener("offline", handleConnectionChange);

    return () => {
      window.removeEventListener("online", handleConnectionChange);
      window.removeEventListener("offline", handleConnectionChange);
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

    // Utilidades
    hasServiceWorker: state.isServiceWorkerReady,
    canSync: state.isOnline && !state.isSyncing,
    needsSync: state.pendingVisitas > 0,
  };
}
