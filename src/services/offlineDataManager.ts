"use client";

import { db as newDB, initializeOfflineDB } from "@/lib/indexedDB";
import { UserData } from "@/services/auth";

// Servicio unificado para manejar datos offline del mercaderista
class OfflineDataManager {
  private isInitialized = false;

  /**
   * Inicializa el sistema offline unificado
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      console.log("🔄 [OfflineDataManager] Inicializando sistema offline...");

      // Intentar inicializar la base de datos
      let success = await initializeOfflineDB();
      
      // Si falla por error de versión, limpiar y reintentar
      if (!success) {
        console.log("⚠️ [OfflineDataManager] Fallo inicial, limpiando bases de datos conflictivas...");
        await this.cleanupConflictingDatabases();
        
        // Reintentar después de limpiar
        success = await initializeOfflineDB();
      }

      if (success) {
        this.isInitialized = true;
        console.log(
          "✅ [OfflineDataManager] Sistema offline inicializado correctamente"
        );
        return true;
      } else {
        console.warn("⚠️ [OfflineDataManager] No se pudo inicializar IndexedDB, continuando sin funcionalidad offline completa");
        return false;
      }
    } catch (error) {
      console.error("❌ [OfflineDataManager] Error inicializando:", error);
      
      // Si es un error de versión, intentar limpiar y reintentar una vez más
      if (error instanceof Error && error.name === 'VersionError') {
        console.log("🔄 [OfflineDataManager] Error de versión detectado, intentando limpieza y reintento...");
        try {
          await this.cleanupConflictingDatabases();
          const retrySuccess = await initializeOfflineDB();
          if (retrySuccess) {
            this.isInitialized = true;
            console.log("✅ [OfflineDataManager] Sistema offline inicializado después del reintento");
            return true;
          }
        } catch (retryError) {
          console.error("❌ [OfflineDataManager] Error en reintento:", retryError);
        }
      }
      
      return false;
    }
  }

  /**
   * Limpia bases de datos conflictivas de forma agresiva
   */
  private async cleanupConflictingDatabases(): Promise<void> {
    try {
      console.log("🗑️ Iniciando limpieza agresiva de IndexedDB...");

      // Lista completa de posibles bases de datos conflictivas
      const dbNames = [
        "DisbatteryOfflineDB",
        "DisbatteryOfflineDB_v3", // Agregar la versión actual
        "RouteOfflineDB",
        "VisitOfflineDB",
        "ClientOfflineDB",
        "OfflineDataDB",
        "MercaderistaDB",
        "DebugDB",
        "FirebaseDB",
      ];

      // Limpiar localStorage relacionado
      const storageKeys = Object.keys(localStorage).filter(
        (key) =>
          key.includes("offline") ||
          key.includes("route") ||
          key.includes("visit") ||
          key.includes("client") ||
          key.includes("indexeddb")
      );

      storageKeys.forEach((key) => {
        localStorage.removeItem(key);
        console.log(`🗑️ localStorage limpiado: ${key}`);
      });

      // Eliminar todas las bases de datos
      for (const dbName of dbNames) {
        try {
          await this.forceDeleteDatabase(dbName);
        } catch (error) {
          console.warn(`⚠️ No se pudo eliminar ${dbName}:`, error);
        }
      }

      // Esperar un poco para asegurar limpieza
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("✅ Limpieza agresiva completada");
    } catch (error) {
      console.warn("⚠️ Error limpiando bases de datos:", error);
    }
  }

  /**
   * Fuerza eliminación de una base de datos específica
   */
  private async forceDeleteDatabase(dbName: string): Promise<void> {
    return new Promise<void>((resolve) => {
      try {
        const deleteReq = indexedDB.deleteDatabase(dbName);

        const timeout = setTimeout(() => {
          console.warn(`⏱️ Timeout eliminando ${dbName}`);
          resolve();
        }, 5000);

        deleteReq.onsuccess = () => {
          clearTimeout(timeout);
          console.log(`✅ Base de datos ${dbName} eliminada exitosamente`);
          resolve();
        };

        deleteReq.onerror = (event) => {
          clearTimeout(timeout);
          console.warn(`❌ Error eliminando ${dbName}:`, event);
          resolve(); // Continuar aunque falle
        };

        deleteReq.onblocked = () => {
          clearTimeout(timeout);
          console.warn(`🚫 Base de datos ${dbName} bloqueada, continuando...`);
          resolve(); // Continuar aunque esté bloqueada
        };
      } catch (error) {
        console.warn(`💥 Excepción eliminando ${dbName}:`, error);
        resolve();
      }
    });
  }

  /**
   * Verifica si el usuario necesita descarga de datos
   */
  async shouldDownloadData(user: UserData): Promise<{
    needsDownload: boolean;
    reason: string;
    hasExistingData: boolean;
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Solo mercaderistas necesitan datos offline
      if (user.role !== "Mercaderista") {
        return {
          needsDownload: false,
          reason: "Usuario no es mercaderista",
          hasExistingData: false,
        };
      }

      // Verificar si hay datos existentes
      const routes = await newDB.offlineRoutes
        .where("userId")
        .equals(user.uid)
        .toArray();

      const clients = await newDB.clientSnapshots.count();

      const hasData = routes.length > 0 || clients > 0;

      if (!hasData) {
        return {
          needsDownload: true,
          reason: "No hay datos offline disponibles",
          hasExistingData: false,
        };
      }

      // Verificar si los datos están desactualizados (más de 24 horas)
      const latestRoute = routes.reduce(
        (latest, route) =>
          route.lastSyncAt > latest ? route.lastSyncAt : latest,
        0
      );

      const hoursOld = (Date.now() - latestRoute) / (1000 * 60 * 60);

      if (hoursOld > 24) {
        return {
          needsDownload: true,
          reason: `Datos desactualizados (${Math.floor(hoursOld)}h)`,
          hasExistingData: true,
        };
      }

      return {
        needsDownload: false,
        reason: "Datos offline actualizados",
        hasExistingData: true,
      };
    } catch (error) {
      console.error("❌ Error verificando necesidad de descarga:", error);
      return {
        needsDownload: true,
        reason: "Error verificando datos existentes",
        hasExistingData: false,
      };
    }
  }

  /**
   * Descarga datos para el mercaderista (siempre, sin verificar)
   */
  async forceDownloadData(
    user: UserData,
    onProgress?: (progress: {
      step: string;
      percentage: number;
      message: string;
    }) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      onProgress?.({
        step: "init",
        percentage: 10,
        message: "Preparando descarga...",
      });

      // Importar servicios dinámicamente para evitar problemas de dependencias
      const { dataPreloadService } = await import(
        "@/services/dataPreloadService"
      );

      onProgress?.({
        step: "download",
        percentage: 50,
        message: "Descargando rutas y clientes...",
      });

      // Usar el servicio existente pero con nuestra DB nueva
      const result = await dataPreloadService.preloadDataForMercaderista(user);

      onProgress?.({
        step: "complete",
        percentage: 100,
        message: "Descarga completada",
      });

      if (result.success) {
        console.log("✅ [OfflineDataManager] Datos descargados correctamente");
        return { success: true };
      } else {
        console.error(
          "❌ [OfflineDataManager] Error en descarga:",
          result.error
        );
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("❌ [OfflineDataManager] Error forzando descarga:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  }

  /**
   * Descarga datos solo si es necesario
   */
  async downloadDataIfNeeded(
    user: UserData,
    onProgress?: (progress: {
      step: string;
      percentage: number;
      message: string;
    }) => void
  ): Promise<{ success: boolean; downloaded: boolean; error?: string }> {
    try {
      const check = await this.shouldDownloadData(user);

      if (!check.needsDownload) {
        console.log(
          `ℹ️ [OfflineDataManager] No es necesario descargar: ${check.reason}`
        );
        return { success: true, downloaded: false };
      }

      console.log(
        `⬇️ [OfflineDataManager] Iniciando descarga: ${check.reason}`
      );
      const result = await this.forceDownloadData(user, onProgress);

      return {
        success: result.success,
        downloaded: result.success,
        error: result.error,
      };
    } catch (error) {
      console.error(
        "❌ [OfflineDataManager] Error en descarga condicional:",
        error
      );
      return {
        success: false,
        downloaded: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  }

  /**
   * Obtiene estadísticas de datos offline
   */
  async getDataStats(user: UserData): Promise<{
    routesCount: number;
    clientsCount: number;
    draftsCount: number;
    pendingOpsCount: number;
    lastSync?: Date;
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const routes = await newDB.offlineRoutes
        .where("userId")
        .equals(user.uid)
        .count();

      const clients = await newDB.clientSnapshots.count();
      const drafts = await newDB.visitDrafts.count();
      const pendingOps = await newDB.pendingOps
        .where("status")
        .anyOf(["pending", "processing"])
        .count();

      // Buscar última sincronización
      const latestRoute = await newDB.offlineRoutes
        .where("userId")
        .equals(user.uid)
        .reverse()
        .sortBy("lastSyncAt");

      const lastSync =
        latestRoute.length > 0
          ? new Date(latestRoute[0].lastSyncAt)
          : undefined;

      return {
        routesCount: routes,
        clientsCount: clients,
        draftsCount: drafts,
        pendingOpsCount: pendingOps,
        lastSync,
      };
    } catch (error) {
      console.error("❌ Error obteniendo estadísticas:", error);
      return {
        routesCount: 0,
        clientsCount: 0,
        draftsCount: 0,
        pendingOpsCount: 0,
      };
    }
  }

  /**
   * Limpia todos los datos offline
   */
  async clearAllData(): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      await Promise.all([
        newDB.visitDrafts.clear(),
        newDB.pendingOps.clear(),
        newDB.images.clear(),
        newDB.offlineRoutes.clear(),
        newDB.clientSnapshots.clear(),
        newDB.debugLogs.clear(),
      ]);

      console.log("🗑️ [OfflineDataManager] Todos los datos offline limpiados");
    } catch (error) {
      console.error("❌ Error limpiando datos:", error);
    }
  }
}

// Exportar instancia singleton
export const offlineDataManager = new OfflineDataManager();
