/**
 * Servicio de gestión offline para PWA DISBATTERY TRADE
 * Implementa almacenamiento local con IndexedDB para funcionamiento offline-first
 */

import { Route, RoutePoint, Cliente } from '@/types/routes';
import { UserData } from './auth';

// Interfaces para el almacenamiento offline
export interface OfflineVisita {
  id: string;
  routeId: string;
  pointId: string;
  clienteId: string;
  mercaderistoId: string;
  timestamp: number;
  gpsLocation: { lat: number; lng: number };
  formData: any; // Datos del formulario específico
  photos: File[]; // Archivos de fotos capturadas
  tipoVisita: 'Merchandising' | 'Trade (Eventos)' | 'Trade (Impulso)';
  marcaTrabajada?: 'Shell' | 'Qualid';
  status: 'pending' | 'syncing' | 'synced' | 'error';
  syncAttempts: number;
  lastSyncAttempt?: number;
  errorMessage?: string;
}

export interface OfflineRoute extends Route {
  downloadedAt: number;
  lastSyncedAt?: number;
}

export interface OfflineCliente extends Cliente {
  downloadedAt: number;
  lastSyncedAt?: number;
}

export interface SyncStatus {
  lastFullSync?: number;
  lastPartialSync?: number;
  pendingVisitas: number;
  isOnline: boolean;
  isSyncing: boolean;
}

class OfflineService {
  // Usar el mismo nombre que Dexie para evitar colisiones y trabajar sobre una base limpia
  private dbName = 'DisbatteryOfflineDB_v3';
  // La versión previa llegó a valores muy altos en algunos clientes.
  // Para evitar VersionError, abrimos sin especificar versión y solo
  // hacemos upgrade si detectamos stores faltantes.
  private dbVersion = undefined as number | undefined;
  private db: IDBDatabase | null = null;

  // ObjectStore names
  private readonly STORES = {
    ROUTES: 'routes',
    CLIENTES: 'clientes',
    VISITAS_PENDIENTES: 'visitas_pendientes',
    SYNC_STATUS: 'sync_status',
    USER_DATA: 'user_data'
  };

  /**
   * Inicializa la base de datos IndexedDB
   */
  async initDB(): Promise<void> {
    const openWithUpgradeIfNeeded = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName);

        request.onerror = () => {
          console.error('❌ Error abriendo IndexedDB:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          this.db = request.result;
          const db = this.db as IDBDatabase;
          const needsUpgrade = !db.objectStoreNames.contains(this.STORES.ROUTES)
            || !db.objectStoreNames.contains(this.STORES.CLIENTES)
            || !db.objectStoreNames.contains(this.STORES.VISITAS_PENDIENTES)
            || !db.objectStoreNames.contains(this.STORES.SYNC_STATUS)
            || !db.objectStoreNames.contains(this.STORES.USER_DATA);

          if (!needsUpgrade) {
            console.log('✅ IndexedDB inicializada correctamente');
            resolve();
            return;
          }

          // Necesitamos upgrade: cerrar y reabrir con versión + 1
          const currentVersion = db.version || 1;
          db.close();

          const upgradeRequest = indexedDB.open(this.dbName, currentVersion + 1);
          upgradeRequest.onerror = () => {
            console.error('❌ Error abriendo IndexedDB para upgrade:', upgradeRequest.error);
            reject(upgradeRequest.error);
          };
          upgradeRequest.onupgradeneeded = (event) => {
            const udb = (event.target as IDBOpenDBRequest).result;
            console.log('🔄 Actualizando esquema de IndexedDB (upgrade controlado)...');

            if (!udb.objectStoreNames.contains(this.STORES.ROUTES)) {
              const routesStore = udb.createObjectStore(this.STORES.ROUTES, { keyPath: 'id' });
              routesStore.createIndex('mercaderistoId', 'mercaderistoId', { unique: false });
              routesStore.createIndex('date', 'date', { unique: false });
              routesStore.createIndex('status', 'status', { unique: false });
            }
            if (!udb.objectStoreNames.contains(this.STORES.CLIENTES)) {
              const clientesStore = udb.createObjectStore(this.STORES.CLIENTES, { keyPath: 'id' });
              clientesStore.createIndex('sede', 'sede', { unique: false });
              clientesStore.createIndex('region', 'region', { unique: false });
              clientesStore.createIndex('tipo', 'tipo', { unique: false });
            }
            if (!udb.objectStoreNames.contains(this.STORES.VISITAS_PENDIENTES)) {
              const visitasStore = udb.createObjectStore(this.STORES.VISITAS_PENDIENTES, { keyPath: 'id' });
              visitasStore.createIndex('mercaderistoId', 'mercaderistoId', { unique: false });
              visitasStore.createIndex('status', 'status', { unique: false });
              visitasStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            if (!udb.objectStoreNames.contains(this.STORES.SYNC_STATUS)) {
              udb.createObjectStore(this.STORES.SYNC_STATUS, { keyPath: 'id' });
            }
            if (!udb.objectStoreNames.contains(this.STORES.USER_DATA)) {
              udb.createObjectStore(this.STORES.USER_DATA, { keyPath: 'uid' });
            }
          };
          upgradeRequest.onsuccess = () => {
            this.db = upgradeRequest.result;
            console.log('✅ IndexedDB inicializada y esquema verificado');
            resolve();
          };
        };
      });
    };

    // Intento principal sin versión (evita VersionError en clientes previos)
    return openWithUpgradeIfNeeded();
  }

  /**
   * Verifica si el usuario debe usar modo offline-first
   */
  shouldUseOfflineMode(user: UserData): boolean {
    return user.role === 'Mercaderista';
  }

  /**
   * Función de debugging para diagnosticar problemas offline
   */
  async debugOfflineData(mercaderistoId: string): Promise<{
    dbInitialized: boolean;
    totalRoutes: number;
    todayRoutes: number;
    mercaderistaRoutes: number;
    routeDetails: Array<{
      id: string;
      date: string;
      status: Route['status'];
      pointsCount: number;
      downloadedAt: string;
      lastSyncedAt: string;
    }>;
    indexedDBError?: string;
  }> {
    const debug = {
      dbInitialized: false,
      totalRoutes: 0,
      todayRoutes: 0,
      mercaderistaRoutes: 0,
      routeDetails: [] as Array<{
        id: string;
        date: string;
        status: Route['status'];
        pointsCount: number;
        downloadedAt: string;
        lastSyncedAt: string;
      }>,
      indexedDBError: undefined as string | undefined
    };

    try {
      console.log(`🔧 [DEBUG] Iniciando debugging para mercaderista: ${mercaderistoId}`);
      
      // Verificar si IndexedDB está inicializada
      if (!this.db) {
        console.log('🔧 [DEBUG] Inicializando IndexedDB...');
        await this.initDB();
      }
      
      debug.dbInitialized = !!this.db;
      
      if (!this.db) {
        debug.indexedDBError = 'No se pudo inicializar IndexedDB';
        return debug;
      }

      // Contar todas las rutas
      const allRoutes = await new Promise<OfflineRoute[]>((resolve, reject) => {
        const transaction = this.db!.transaction([this.STORES.ROUTES], 'readonly');
        const store = transaction.objectStore(this.STORES.ROUTES);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      debug.totalRoutes = allRoutes.length;
      console.log(`🔧 [DEBUG] Total de rutas en IndexedDB: ${debug.totalRoutes}`);

      // Filtrar rutas del mercaderista
      const mercaderistaRoutes = allRoutes.filter(route => route.mercaderistoId === mercaderistoId);
      debug.mercaderistaRoutes = mercaderistaRoutes.length;
      console.log(`🔧 [DEBUG] Rutas del mercaderista ${mercaderistoId}: ${debug.mercaderistaRoutes}`);

      // Filtrar rutas de hoy
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const todayRoutes = mercaderistaRoutes.filter(route => route.date === today);
      debug.todayRoutes = todayRoutes.length;
      console.log(`🔧 [DEBUG] Rutas de hoy (${today}): ${debug.todayRoutes}`);

      // Detalles de rutas
      debug.routeDetails = mercaderistaRoutes.map(route => ({
        id: route.id,
        date: route.date,
        status: route.status,
        pointsCount: route.points?.length || 0,
        downloadedAt: new Date(route.downloadedAt).toLocaleString(),
        lastSyncedAt: route.lastSyncedAt ? new Date(route.lastSyncedAt).toLocaleString() : 'N/A'
      }));

      console.log('🔧 [DEBUG] Detalles de rutas:', debug.routeDetails);
      return debug;

    } catch (error) {
      debug.indexedDBError = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ [DEBUG] Error en debugging:', error);
      return debug;
    }
  }

  /**
   * Almacena rutas del mercaderista para uso offline
   */
  async storeRoutes(routes: Route[]): Promise<void> {
    try {
      console.log(`💾 [OfflineService] Iniciando almacenamiento de ${routes.length} rutas...`);
      
      if (!this.db) {
        console.log('🔄 [OfflineService] Inicializando IndexedDB...');
        await this.initDB();
      }

      if (!this.db) {
        throw new Error('No se pudo inicializar IndexedDB');
      }

      // ✅ VALIDAR QUE HAY RUTAS PARA ALMACENAR
      if (routes.length === 0) {
        console.log('ℹ️ [OfflineService] No hay rutas para almacenar (array vacío)');
        return;
      }

      const transaction = this.db.transaction([this.STORES.ROUTES], 'readwrite');
      const store = transaction.objectStore(this.STORES.ROUTES);

      const offlineRoutes: OfflineRoute[] = routes.map(route => ({
        ...route,
        downloadedAt: Date.now(),
        lastSyncedAt: Date.now()
      }));

      // ✅ ALMACENAR CON MEJOR LOGGING
      for (const [index, route] of offlineRoutes.entries()) {
        await new Promise<void>((resolve, reject) => {
          const request = store.put(route);
          
          request.onsuccess = () => {
            console.log(`✅ [OfflineService] Ruta ${index + 1}/${routes.length} almacenada: ${route.id} (${route.date})`);
            resolve();
          };

          request.onerror = () => {
            console.error(`❌ [OfflineService] Error almacenando ruta ${route.id}:`, request.error);
            reject(request.error);
          };
        });
      }

      console.log(`✅ [OfflineService] ${routes.length} rutas almacenadas exitosamente en IndexedDB`);

      // ✅ VERIFICAR QUE SE ALMACENARON CORRECTAMENTE
      if (routes.length > 0) {
        const mercaderistoId = routes[0].mercaderistoId;
        if (mercaderistoId) {
          const storedRoutes = await this.getOfflineRoutes(mercaderistoId);
          console.log(`🔍 [OfflineService] Verificación: ${storedRoutes.length} rutas totales disponibles para mercaderista ${mercaderistoId}`);
        }
      }

    } catch (error) {
      console.error('❌ [OfflineService] Error crítico almacenando rutas:', error);
      throw error;
    }
  }

  /**
   * Actualiza el status de una ruta en IndexedDB (best-effort)
   */
  async updateOfflineRouteStatus(routeId: string, newStatus: Route['status']): Promise<void> {
    try {
      if (!this.db) {
        await this.initDB();
      }
      if (!this.db) return;

      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([this.STORES.ROUTES], 'readwrite');
        const store = transaction.objectStore(this.STORES.ROUTES);
        const getReq = store.get(routeId);
        getReq.onsuccess = () => {
          const route = getReq.result as OfflineRoute | undefined;
          if (!route) {
            resolve();
            return;
          }
          const now = Date.now();
          const updated: OfflineRoute = {
            ...route,
            status: newStatus,
            lastSyncedAt: now,
            // Anotar timestamps de estado si el objeto los maneja
            ...(newStatus === 'en_progreso' ? { en_progresoAt: new Date(now) as unknown as Date } : {}),
            ...(newStatus === 'completada' ? { completadaAt: new Date(now) as unknown as Date } : {}),
          } as any;
          const putReq = store.put(updated);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
      });
    } catch (error) {
      console.warn('[OfflineService] No se pudo actualizar status offline de la ruta:', error);
    }
  }

  /**
   * Almacena clientes para uso offline
   */
  async storeClientes(clientes: Cliente[]): Promise<void> {
    if (!this.db) await this.initDB();

    const transaction = this.db!.transaction([this.STORES.CLIENTES], 'readwrite');
    const store = transaction.objectStore(this.STORES.CLIENTES);

    const offlineClientes: OfflineCliente[] = clientes.map(cliente => ({
      ...cliente,
      downloadedAt: Date.now(),
      lastSyncedAt: Date.now()
    }));

    for (const cliente of offlineClientes) {
      await new Promise<void>((resolve, reject) => {
        const request = store.put(cliente);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    console.log(`✅ ${clientes.length} clientes almacenados en IndexedDB`);
  }

  /**
   * Obtiene rutas del mercaderista desde almacenamiento local
   */
  async getOfflineRoutes(mercaderistoId: string): Promise<OfflineRoute[]> {
    try {
      console.log(`📱 [OfflineService] Buscando rutas offline para mercaderista: ${mercaderistoId}`);
      
      if (!this.db) {
        console.log('🔄 [OfflineService] Inicializando IndexedDB para lectura...');
        await this.initDB();
      }

      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error('IndexedDB no disponible'));
          return;
        }

        const transaction = this.db.transaction([this.STORES.ROUTES], 'readonly');
        const store = transaction.objectStore(this.STORES.ROUTES);
        const index = store.index('mercaderistoId');
        const request = index.getAll(mercaderistoId);

        request.onsuccess = () => {
          const routes = request.result as OfflineRoute[];
          console.log(`📱 [OfflineService] ${routes.length} rutas encontradas en IndexedDB para mercaderista ${mercaderistoId}`);
          
          if (routes.length > 0) {
            console.log('📋 [OfflineService] Rutas encontradas:', routes.map(r => ({
              id: r.id,
              date: r.date,
              status: r.status,
              pointsCount: r.points?.length || 0
            })));
          } else {
            console.warn('⚠️ [OfflineService] No se encontraron rutas offline - IndexedDB vacío o mercaderistoId incorrecto');
          }
          
          resolve(routes);
        };

        request.onerror = () => {
          console.error('❌ [OfflineService] Error leyendo rutas desde IndexedDB:', request.error);
          reject(request.error);
        };
      });

    } catch (error) {
      console.error('❌ [OfflineService] Error crítico obteniendo rutas offline:', error);
      return [];
    }
  }

  /**
   * Obtiene cliente específico desde almacenamiento local
   */
  async getOfflineCliente(clienteId: string): Promise<OfflineCliente | null> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.CLIENTES], 'readonly');
      const store = transaction.objectStore(this.STORES.CLIENTES);
      const request = store.get(clienteId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Guarda una visita en la cola de sincronización
   */
  async queueVisitaForSync(visita: Omit<OfflineVisita, 'id' | 'status' | 'syncAttempts'>): Promise<string> {
    if (!this.db) await this.initDB();

    const visitaCompleta: OfflineVisita = {
      ...visita,
      id: `visita_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      syncAttempts: 0
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.VISITAS_PENDIENTES], 'readwrite');
      const store = transaction.objectStore(this.STORES.VISITAS_PENDIENTES);
      const request = store.add(visitaCompleta);

      request.onsuccess = () => {
        console.log(`✅ Visita ${visitaCompleta.id} añadida a cola de sincronización`);
        this.updateSyncStatus();
        resolve(visitaCompleta.id);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtiene visitas pendientes de sincronización
   */
  async getPendingVisitas(): Promise<OfflineVisita[]> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.VISITAS_PENDIENTES], 'readonly');
      const store = transaction.objectStore(this.STORES.VISITAS_PENDIENTES);
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => {
        resolve(request.result as OfflineVisita[]);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Actualiza el estado de una visita en la cola de sincronización
   */
  async updateVisitaSyncStatus(
    visitaId: string, 
    status: OfflineVisita['status'], 
    errorMessage?: string
  ): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.VISITAS_PENDIENTES], 'readwrite');
      const store = transaction.objectStore(this.STORES.VISITAS_PENDIENTES);
      
      const getRequest = store.get(visitaId);
      getRequest.onsuccess = () => {
        const visita = getRequest.result as OfflineVisita;
        if (visita) {
          visita.status = status;
          visita.syncAttempts += 1;
          visita.lastSyncAttempt = Date.now();
          if (errorMessage) visita.errorMessage = errorMessage;

          const putRequest = store.put(visita);
          putRequest.onsuccess = () => {
            this.updateSyncStatus();
            resolve();
          };
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Visita no encontrada'));
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Elimina una visita ya sincronizada
   */
  async removeSyncedVisita(visitaId: string): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.VISITAS_PENDIENTES], 'readwrite');
      const store = transaction.objectStore(this.STORES.VISITAS_PENDIENTES);
      const request = store.delete(visitaId);

      request.onsuccess = () => {
        console.log(`✅ Visita ${visitaId} eliminada tras sincronización exitosa`);
        this.updateSyncStatus();
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Actualiza el estado general de sincronización
   */
  private async updateSyncStatus(): Promise<void> {
    if (!this.db) return;

    const pendingVisitas = await this.getPendingVisitas();
    const isOnline = navigator.onLine;

    const syncStatus: SyncStatus = {
      lastPartialSync: Date.now(),
      pendingVisitas: pendingVisitas.length,
      isOnline,
      isSyncing: false
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.SYNC_STATUS], 'readwrite');
      const store = transaction.objectStore(this.STORES.SYNC_STATUS);
      const request = store.put({ id: 'main', ...syncStatus });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtiene el estado actual de sincronización
   */
  async getSyncStatus(): Promise<SyncStatus> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.SYNC_STATUS], 'readonly');
      const store = transaction.objectStore(this.STORES.SYNC_STATUS);
      const request = store.get('main');

      request.onsuccess = () => {
        const status = request.result;
        resolve(status || {
          pendingVisitas: 0,
          isOnline: navigator.onLine,
          isSyncing: false
        });
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Valida si el usuario está cerca de un punto de la ruta (GPS offline)
   */
  async validateProximity(
    currentLocation: { lat: number; lng: number },
    pointId: string,
    routeId: string,
    toleranceMeters: number = 500
  ): Promise<{ isValid: boolean; distance?: number; point?: RoutePoint }> {
    try {
      // Obtener la ruta desde almacenamiento local
      const routes = await this.getOfflineRoutes(''); // Buscar en todas las rutas
      const route = routes.find(r => r.id === routeId);
      
      if (!route) {
        return { isValid: false };
      }

      const point = route.points.find(p => p.id === pointId);
      if (!point) {
        return { isValid: false };
      }

      // Calcular distancia usando fórmula de Haversine
      const distance = this.calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        point.position.lat,
        point.position.lng
      );

      const isValid = distance <= toleranceMeters;

      console.log(`📍 Validación GPS offline: ${isValid ? '✅' : '❌'} (${distance.toFixed(0)}m)`);

      return {
        isValid,
        distance,
        point
      };
    } catch (error) {
      console.error('❌ Error en validación GPS offline:', error);
      return { isValid: false };
    }
  }

  /**
   * Calcula la distancia entre dos puntos GPS usando la fórmula de Haversine
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distancia en metros
  }

  /**
   * Limpia todos los datos offline (útil para logout o reset)
   */
  async clearOfflineData(): Promise<void> {
    if (!this.db) await this.initDB();

    const stores = Object.values(this.STORES);
    const transaction = this.db!.transaction(stores, 'readwrite');

    for (const storeName of stores) {
      const store = transaction.objectStore(storeName);
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    console.log('🧹 Datos offline limpiados completamente');
  }
}

// Exportar instancia singleton
export const offlineService = new OfflineService();