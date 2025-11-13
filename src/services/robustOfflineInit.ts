/**
 * Inicializador robusto para servicios offline
 * Maneja errores de versión y conflictos de IndexedDB automáticamente
 */

import { initializeOfflineDB } from "@/lib/indexedDB";
import { fallbackStorage } from "@/services/fallbackStorage";
import Dexie from "dexie";

interface InitResult {
  success: boolean;
  indexedDBAvailable: boolean;
  fallbackAvailable: boolean;
  errors: string[];
}

class RobustOfflineInitializer {
  private maxRetries = 3;
  private retryDelay = 1000; // 1 segundo

  /**
   * Inicializa los servicios offline de forma robusta
   */
  async initialize(): Promise<InitResult> {
    const result: InitResult = {
      success: false,
      indexedDBAvailable: false,
      fallbackAvailable: false,
      errors: []
    };

    console.log("🚀 [RobustInit] Iniciando inicialización robusta de servicios offline...");

    // 1. Verificar disponibilidad de fallback storage (solo en cliente)
    result.fallbackAvailable = typeof window !== 'undefined' && fallbackStorage.isAvailable();
    if (result.fallbackAvailable) {
      console.log("✅ [RobustInit] Fallback storage (localStorage) disponible");
    } else {
      result.errors.push("localStorage no disponible");
      console.warn("⚠️ [RobustInit] localStorage no disponible");
    }

    // 2. Intentar inicializar IndexedDB con reintentos
    result.indexedDBAvailable = await this.initializeIndexedDBWithRetries();

    // 3. Determinar éxito general
    result.success = result.indexedDBAvailable || result.fallbackAvailable;

    if (result.success) {
      console.log(`✅ [RobustInit] Inicialización exitosa - IndexedDB: ${result.indexedDBAvailable}, Fallback: ${result.fallbackAvailable}`);
    } else {
      console.error("❌ [RobustInit] Falló la inicialización de todos los sistemas de almacenamiento");
      result.errors.push("Todos los sistemas de almacenamiento fallaron");
    }

    return result;
  }

  /**
   * Intenta inicializar IndexedDB con reintentos automáticos
   */
  private async initializeIndexedDBWithRetries(): Promise<boolean> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`🔄 [RobustInit] Intento ${attempt}/${this.maxRetries} de inicialización de IndexedDB`);

      try {
        const success = await initializeOfflineDB();
        if (success) {
          console.log("✅ [RobustInit] IndexedDB inicializado exitosamente");
          return true;
        }
      } catch (error) {
        console.warn(`⚠️ [RobustInit] Intento ${attempt} falló:`, error);

        // Si es un error de versión, intentar limpiar
        if (error instanceof Error && this.isVersionError(error)) {
          console.log("🔄 [RobustInit] Error de versión detectado, limpiando...");
          await this.cleanupVersionConflicts();
        }
      }

      // Esperar antes del siguiente intento (excepto en el último)
      if (attempt < this.maxRetries) {
        await this.delay(this.retryDelay * attempt);
      }
    }

    console.warn("⚠️ [RobustInit] IndexedDB no pudo ser inicializado después de todos los intentos");
    return false;
  }

  /**
   * Verifica si el error es relacionado con versiones
   */
  private isVersionError(error: Error): boolean {
    return error.name === 'VersionError' || 
           error.message.includes('version') ||
           error.message.includes('Version') ||
           error.message.includes('existing version');
  }

  /**
   * Limpia conflictos de versión de IndexedDB
   */
  private async cleanupVersionConflicts(): Promise<void> {
    try {
      console.log("🗑️ [RobustInit] Limpiando conflictos de versión...");

      // Lista de bases de datos a limpiar
      const dbNames = [
        "DisbatteryOfflineDB",
        "DisbatteryOfflineDB_v3",
        "RouteOfflineDB",
        "VisitOfflineDB",
        "ClientOfflineDB",
        "OfflineDataDB"
      ];

      // Eliminar bases de datos problemáticas
      for (const dbName of dbNames) {
        try {
          await Dexie.delete(dbName);
          console.log(`🗑️ [RobustInit] Base de datos eliminada: ${dbName}`);
        } catch (deleteError) {
          // Ignorar errores de eliminación (la DB puede no existir)
          console.log(`ℹ️ [RobustInit] No se pudo eliminar ${dbName} (puede no existir)`);
        }
      }

      // Limpiar localStorage relacionado (solo si está disponible)
      if (typeof window !== 'undefined' && fallbackStorage.isAvailable()) {
        const keysToRemove = Object.keys(localStorage).filter(key => 
          key.includes('indexeddb') || 
          key.includes('offline') ||
          key.includes('migration')
        );

        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          console.log(`🗑️ [RobustInit] localStorage limpiado: ${key}`);
        });
      }

      // Esperar un poco para asegurar que la limpieza se complete
      await this.delay(500);

      console.log("✅ [RobustInit] Limpieza de conflictos completada");
    } catch (error) {
      console.warn("⚠️ [RobustInit] Error durante limpieza:", error);
    }
  }

  /**
   * Función de delay para reintentos
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtiene el estado actual de los servicios offline
   */
  async getStatus(): Promise<{
    indexedDB: boolean;
    localStorage: boolean;
    canSaveOffline: boolean;
  }> {
    const indexedDB = await this.testIndexedDB();
    const localStorage = fallbackStorage.isAvailable();
    
    return {
      indexedDB,
      localStorage,
      canSaveOffline: indexedDB || localStorage
    };
  }

  /**
   * Prueba si IndexedDB está funcionando
   */
  private async testIndexedDB(): Promise<boolean> {
    try {
      const testDB = new Dexie("TestDB");
      testDB.version(1).stores({ test: "id" });
      await testDB.open();
      await testDB.close();
      await Dexie.delete("TestDB");
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Instancia singleton
export const robustOfflineInitializer = new RobustOfflineInitializer();
