/**
 * Sistema de recuperación de base de datos para manejar errores de DatabaseClosedError
 */

import { db } from '@/lib/indexedDB';
import { initializeOfflineDB } from '@/lib/indexedDB';

class DatabaseRecoveryManager {
  private recoveryInProgress = false;
  private maxRecoveryAttempts = 3;
  private recoveryAttempts = 0;

  /**
   * Verifica si la base de datos está disponible y la recupera si es necesario
   */
  async ensureDatabaseAvailable(): Promise<boolean> {
    try {
      // Verificar si la base de datos está abierta
      if (db.isOpen()) {
        return true;
      }

      console.warn("⚠️ [DatabaseRecovery] Base de datos cerrada, iniciando recuperación...");
      return await this.recoverDatabase();
    } catch (error) {
      console.error("❌ [DatabaseRecovery] Error verificando estado de la base de datos:", error);
      return await this.recoverDatabase();
    }
  }

  /**
   * Intenta recuperar la base de datos
   */
  private async recoverDatabase(): Promise<boolean> {
    if (this.recoveryInProgress) {
      console.log("⏳ [DatabaseRecovery] Recuperación ya en progreso, esperando...");
      // Esperar hasta que termine la recuperación actual
      while (this.recoveryInProgress && this.recoveryAttempts < this.maxRecoveryAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return db.isOpen();
    }

    this.recoveryInProgress = true;
    this.recoveryAttempts++;

    try {
      console.log(`🔄 [DatabaseRecovery] Intento de recuperación ${this.recoveryAttempts}/${this.maxRecoveryAttempts}`);

      // Cerrar la conexión actual si existe
      if (db.isOpen()) {
        db.close();
      }

      // Esperar un poco antes de reabrir
      await new Promise(resolve => setTimeout(resolve, 500));

      // Intentar reabrir la base de datos
      const success = await initializeOfflineDB();
      
      if (success) {
        console.log("✅ [DatabaseRecovery] Base de datos recuperada exitosamente");
        this.recoveryAttempts = 0; // Resetear contador en caso de éxito
        return true;
      } else {
        console.warn(`⚠️ [DatabaseRecovery] Intento ${this.recoveryAttempts} falló`);
        
        if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
          console.error("❌ [DatabaseRecovery] Máximo número de intentos alcanzado");
          return false;
        }

        // Esperar antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, 2000 * this.recoveryAttempts));
        return await this.recoverDatabase();
      }
    } catch (error) {
      console.error(`❌ [DatabaseRecovery] Error en intento ${this.recoveryAttempts}:`, error);
      
      if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
        console.error("❌ [DatabaseRecovery] Máximo número de intentos alcanzado");
        return false;
      }

      // Esperar antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, 2000 * this.recoveryAttempts));
      return await this.recoverDatabase();
    } finally {
      this.recoveryInProgress = false;
    }
  }

  /**
   * Ejecuta una operación de base de datos con recuperación automática
   */
  async executeWithRecovery<T>(operation: () => Promise<T>): Promise<T | null> {
    try {
      // Asegurar que la base de datos esté disponible
      const dbAvailable = await this.ensureDatabaseAvailable();
      if (!dbAvailable) {
        console.error("❌ [DatabaseRecovery] No se pudo recuperar la base de datos");
        return null;
      }

      // Ejecutar la operación
      return await operation();
    } catch (error) {
      // Si es un error de base de datos cerrada, intentar recuperar
      if (error instanceof Error && (
        error.name === 'DatabaseClosedError' || 
        error.message.includes('Database has been closed') ||
        error.message.includes('database connection is closing')
      )) {
        console.warn("⚠️ [DatabaseRecovery] Error de base de datos cerrada detectado, intentando recuperar...");
        
        const recovered = await this.recoverDatabase();
        if (recovered) {
          try {
            // Reintentar la operación
            return await operation();
          } catch (retryError) {
            console.error("❌ [DatabaseRecovery] Error en reintento después de recuperación:", retryError);
            return null;
          }
        } else {
          console.error("❌ [DatabaseRecovery] No se pudo recuperar la base de datos");
          return null;
        }
      } else {
        // Re-lanzar otros tipos de errores
        throw error;
      }
    }
  }

  /**
   * Resetea el contador de intentos de recuperación
   */
  resetRecoveryAttempts(): void {
    this.recoveryAttempts = 0;
  }

  /**
   * Obtiene el estado actual del sistema de recuperación
   */
  getRecoveryStatus(): {
    recoveryInProgress: boolean;
    recoveryAttempts: number;
    maxRecoveryAttempts: number;
    databaseOpen: boolean;
  } {
    return {
      recoveryInProgress: this.recoveryInProgress,
      recoveryAttempts: this.recoveryAttempts,
      maxRecoveryAttempts: this.maxRecoveryAttempts,
      databaseOpen: db.isOpen()
    };
  }
}

// Instancia singleton
export const databaseRecovery = new DatabaseRecoveryManager();
