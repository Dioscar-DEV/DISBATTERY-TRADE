/**
 * Sistema de almacenamiento de fallback que usa localStorage cuando IndexedDB falla
 */

interface VisitaOffline {
  id: string;
  data: any;
  timestamp: number;
  synced: boolean;
}

class FallbackStorage {
  private readonly STORAGE_KEY = 'disbattery_offline_visitas';
  private readonly MAX_ITEMS = 50; // Límite para evitar llenar localStorage

  /**
   * Guarda una visita en localStorage como fallback
   */
  async saveVisita(visitaData: any): Promise<string> {
    try {
      const visitaId = `visita_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const visita: VisitaOffline = {
        id: visitaId,
        data: visitaData,
        timestamp: Date.now(),
        synced: false
      };

      const existingVisitas = this.getStoredVisitas();
      existingVisitas.push(visita);

      // Mantener solo las últimas MAX_ITEMS visitas
      if (existingVisitas.length > this.MAX_ITEMS) {
        existingVisitas.splice(0, existingVisitas.length - this.MAX_ITEMS);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingVisitas));
      
      console.log(`✅ [FallbackStorage] Visita guardada en localStorage: ${visitaId}`);
      return visitaId;
    } catch (error) {
      console.error('❌ [FallbackStorage] Error guardando en localStorage:', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las visitas pendientes de sincronización
   */
  getPendingVisitas(): VisitaOffline[] {
    try {
      const visitas = this.getStoredVisitas();
      return visitas.filter(v => !v.synced);
    } catch (error) {
      console.error('❌ [FallbackStorage] Error obteniendo visitas pendientes:', error);
      return [];
    }
  }

  /**
   * Marca una visita como sincronizada
   */
  markAsSynced(visitaId: string): boolean {
    try {
      const visitas = this.getStoredVisitas();
      const visitaIndex = visitas.findIndex(v => v.id === visitaId);
      
      if (visitaIndex !== -1) {
        visitas[visitaIndex].synced = true;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(visitas));
        console.log(`✅ [FallbackStorage] Visita marcada como sincronizada: ${visitaId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ [FallbackStorage] Error marcando como sincronizada:', error);
      return false;
    }
  }

  /**
   * Elimina visitas sincronizadas antiguas
   */
  cleanupSyncedVisitas(): number {
    try {
      const visitas = this.getStoredVisitas();
      const now = Date.now();
      const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000); // 7 días

      const initialCount = visitas.length;
      const filteredVisitas = visitas.filter(v => 
        !v.synced || v.timestamp > oneWeekAgo
      );

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredVisitas));
      
      const cleanedCount = initialCount - filteredVisitas.length;
      if (cleanedCount > 0) {
        console.log(`🧹 [FallbackStorage] Limpiadas ${cleanedCount} visitas antiguas`);
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('❌ [FallbackStorage] Error en limpieza:', error);
      return 0;
    }
  }

  /**
   * Obtiene estadísticas del almacenamiento
   */
  getStats(): { total: number; pending: number; synced: number } {
    try {
      const visitas = this.getStoredVisitas();
      const pending = visitas.filter(v => !v.synced).length;
      const synced = visitas.filter(v => v.synced).length;
      
      return {
        total: visitas.length,
        pending,
        synced
      };
    } catch (error) {
      console.error('❌ [FallbackStorage] Error obteniendo estadísticas:', error);
      return { total: 0, pending: 0, synced: 0 };
    }
  }

  /**
   * Obtiene las visitas almacenadas desde localStorage
   */
  private getStoredVisitas(): VisitaOffline[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ [FallbackStorage] Error parseando datos:', error);
      return [];
    }
  }

  /**
   * Verifica si localStorage está disponible
   */
  isAvailable(): boolean {
    try {
      const testKey = 'test_storage';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Limpia completamente el almacenamiento
   */
  clear(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('🧹 [FallbackStorage] Almacenamiento limpiado completamente');
    } catch (error) {
      console.error('❌ [FallbackStorage] Error limpiando almacenamiento:', error);
    }
  }
}

// Instancia singleton
export const fallbackStorage = new FallbackStorage();
