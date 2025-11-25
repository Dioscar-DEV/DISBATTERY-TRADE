/**
 * Servicio de precarga de datos para arquitectura offline-first
 * Gestiona la descarga inteligente de datos según el rol del usuario
 */

import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreClient } from "@/firebase/clientApp";
import { Route, Cliente, RoutePoint } from "@/types/routes";
import { UserData } from "./auth";
import { offlineManager } from "./offlineManager";
import { format } from "date-fns";

interface PreloadProgress {
  step: string;
  current: number;
  total: number;
  percentage: number;
  message: string;
}

interface PreloadResult {
  success: boolean;
  routesLoaded: number;
  clientesLoaded: number;
  totalSizeMB: number;
  duration: number;
  error?: string;
}

class DataPreloadService {
  private onProgressCallback?: (progress: PreloadProgress) => void;

  /**
   * Registra callback para reportar progreso de precarga
   */
  onProgress(callback: (progress: PreloadProgress) => void): void {
    this.onProgressCallback = callback;
  }

  /**
   * Reporta progreso actual
   */
  private reportProgress(
    step: string,
    current: number,
    total: number,
    message: string
  ): void {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    const progress: PreloadProgress = {
      step,
      current,
      total,
      percentage,
      message,
    };

    console.log(
      `📊 [DataPreload] ${step}: ${current}/${total} (${percentage}%) - ${message}`
    );

    if (this.onProgressCallback) {
      this.onProgressCallback(progress);
    }
  }

  /**
   * Determina si es necesario precargar datos según el rol
   */
  shouldPreloadData(user: UserData): boolean {
    return user.role === "Mercaderista";
  }

  /**
   * Precarga completa de datos para mercaderistas (con manejo robusto de errores)
   */
  async preloadDataForMercaderista(user: UserData): Promise<PreloadResult> {
    const startTime = Date.now();
    let routes: Route[] = [];
    let clientes: Cliente[] = [];

    try {
      console.log(
        `🚀 [DataPreload] Iniciando precarga para mercaderista: ${user.fullName}`
      );

      // Paso 1: Inicializar base de datos offline
      this.reportProgress(
        "init",
        0,
        4,
        "Inicializando base de datos offline..."
      );
      try {
        await offlineManager.initDB();
        console.log("✅ [DataPreload] IndexedDB inicializada correctamente");
      } catch (dbError) {
        console.error(
          "❌ [DataPreload] Error inicializando IndexedDB:",
          dbError
        );
        throw new Error("No se pudo inicializar la base de datos local");
      }

      // Paso 2: Cargar rutas del mercaderista (con manejo de errores)
      this.reportProgress("routes", 1, 4, "Descargando rutas asignadas...");
      try {
        routes = await this.loadMercaderistaRoutes(user);
        console.log(`✅ [DataPreload] ${routes.length} rutas obtenidas`);
      } catch (routesError) {
        console.error(
          "⚠️ [DataPreload] Error cargando rutas (continuando con array vacío):",
          routesError
        );
        routes = [];
      }

      // Paso 3: Cargar clientes de las rutas (solo si hay rutas)
      this.reportProgress(
        "clients",
        2,
        4,
        "Descargando información de clientes..."
      );
      if (routes.length > 0) {
        try {
          clientes = await this.loadClientesFromRoutes(routes, user);
          console.log(`✅ [DataPreload] ${clientes.length} clientes obtenidos`);
        } catch (clientesError) {
          console.error(
            "⚠️ [DataPreload] Error cargando clientes (continuando con array vacío):",
            clientesError
          );
          clientes = [];
        }
      } else {
        console.log(
          "ℹ️ [DataPreload] Sin rutas disponibles, omitiendo carga de clientes"
        );
        clientes = [];
      }

      // Paso 4: Almacenar datos en IndexedDB (siempre intentar, incluso con arrays vacíos)
      this.reportProgress("storage", 3, 4, "Almacenando datos localmente...");
      try {
        await offlineManager.storeRoutes(routes);
        await offlineManager.storeClientes(clientes);
        console.log("✅ [DataPreload] Datos almacenados en IndexedDB");
      } catch (storageError) {
        console.error(
          "❌ [DataPreload] Error almacenando datos:",
          storageError
        );
        // Este error es más crítico, pero aún podemos continuar
      }

      // Calcular estadísticas
      const duration = Date.now() - startTime;
      const totalSizeMB = this.calculateDataSize(routes, clientes);

      // Determinar si la precarga fue exitosa (al menos IndexedDB debe funcionar)
      const isSuccess = routes.length > 0 || clientes.length > 0;
      const message = isSuccess
        ? "¡Precarga completada exitosamente!"
        : "Precarga completada con datos limitados";

      // ✅ ASEGURAR QUE SIEMPRE SE REPORTE PROGRESO FINAL
      this.reportProgress("complete", 4, 4, message);

      // ✅ DELAY PEQUEÑO PARA ASEGURAR QUE EL CALLBACK SE EJECUTE
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log(`✅ [DataPreload] Precarga completada en ${duration}ms`);
      console.log(
        `📊 [DataPreload] Estadísticas: ${routes.length} rutas, ${
          clientes.length
        } clientes, ${totalSizeMB.toFixed(2)}MB`
      );

      return {
        success: true, // ✅ Siempre exitoso si llegamos aquí (IndexedDB funciona)
        routesLoaded: routes.length,
        clientesLoaded: clientes.length,
        totalSizeMB,
        duration,
      };
    } catch (error) {
      console.error(
        "❌ [DataPreload] Error crítico durante la precarga:",
        error
      );

      // ✅ SIEMPRE REPORTAR ERROR FINAL PARA NO DEJAR LA UI COLGADA
      this.reportProgress(
        "complete",
        4,
        4,
        "Error en precarga - Continuando con datos locales"
      );

      // ✅ DELAY PARA ASEGURAR QUE EL CALLBACK SE EJECUTE
      await new Promise((resolve) => setTimeout(resolve, 100));

      // ✅ INTENTAR ALMACENAR AL MENOS DATOS PARCIALES
      try {
        await offlineManager.storeRoutes(routes);
        await offlineManager.storeClientes(clientes);
        console.log("✅ [DataPreload] Datos parciales almacenados tras error");
      } catch (finalError) {
        console.error(
          "❌ [DataPreload] Error final almacenando datos parciales:",
          finalError
        );
      }

      const duration = Date.now() - startTime;

      return {
        success: false,
        routesLoaded: routes.length,
        clientesLoaded: clientes.length,
        totalSizeMB: this.calculateDataSize(routes, clientes),
        duration,
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido en precarga",
      };
    }
  }

  /**
   * Carga rutas asignadas al mercaderista (consultas simplificadas sin índices)
   */
  private async loadMercaderistaRoutes(user: UserData): Promise<Route[]> {
    try {
      // Calcular rango de fechas (7 días atrás + 14 días adelante)
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);

      const endDate = new Date(now);
      endDate.setDate(now.getDate() + 14);

      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      console.log(
        `📅 [DataPreload] Buscando rutas del ${startDateStr} al ${endDateStr}`
      );

      const routes: Route[] = [];
      const firestore = getFirestoreClient();
      const routesRef = collection(firestore, "routes");

      try {
        // ✅ CONSULTA SIMPLIFICADA 1: Solo por mercaderistoId (sin rango de fechas)
        console.log(
          `🔍 [DataPreload] Cargando rutas por mercaderistoId: ${user.uid}`
        );
        const mercaderistaQuery = query(
          routesRef,
          where("mercaderistoId", "==", user.uid)
        );
        const mercaderistaSnapshot = await getDocs(mercaderistaQuery);

        mercaderistaSnapshot.forEach((doc) => {
          const routeData = doc.data();
          const routeDate = routeData.date;

          // ✅ FILTRO LOCAL: Solo incluir rutas dentro del rango de fechas
          if (routeDate >= startDateStr && routeDate <= endDateStr) {
            routes.push({
              id: doc.id,
              ...routeData,
              createdAt: routeData.createdAt?.toDate
                ? routeData.createdAt.toDate()
                : new Date(routeData.createdAt),
            } as Route);
          }
        });

        console.log(
          `📱 [DataPreload] ${routes.length} rutas encontradas por mercaderistoId`
        );
      } catch (mercaderistaError) {
        console.error(
          "⚠️ [DataPreload] Error cargando rutas por mercaderistoId:",
          mercaderistaError
        );
        // Continuar con otras consultas aunque esta falle
      }

      // ✅ CONSULTA SIMPLIFICADA 2: Solo por sede (si existe)
      if (user.sede) {
        try {
          console.log(`🔍 [DataPreload] Cargando rutas por sede: ${user.sede}`);
          const sedeQuery = query(routesRef, where("sede", "==", user.sede));
          const sedeSnapshot = await getDocs(sedeQuery);

          sedeSnapshot.forEach((doc) => {
            const routeData = doc.data();
            const routeDate = routeData.date;

            // ✅ FILTRO LOCAL: Solo incluir rutas dentro del rango y evitar duplicados
            if (
              routeDate >= startDateStr &&
              routeDate <= endDateStr &&
              !routes.find((r) => r.id === doc.id)
            ) {
              routes.push({
                id: doc.id,
                ...routeData,
                createdAt: routeData.createdAt?.toDate
                  ? routeData.createdAt.toDate()
                  : new Date(routeData.createdAt),
              } as Route);
            }
          });

          console.log(
            `📱 [DataPreload] ${routes.length} rutas totales después de agregar por sede`
          );
        } catch (sedeError) {
          console.error(
            "⚠️ [DataPreload] Error cargando rutas por sede:",
            sedeError
          );
          // Continuar aunque la consulta por sede falle
        }
      }

      // ✅ FALLBACK: Si no se encontraron rutas, intentar cargar rutas recientes generales
      if (routes.length === 0 && user.region) {
        try {
          console.log(
            `🔍 [DataPreload] Fallback: Cargando rutas por región: ${user.region}`
          );
          const regionQuery = query(
            routesRef,
            where("region", "==", user.region)
          );
          const regionSnapshot = await getDocs(regionQuery);

          regionSnapshot.forEach((doc) => {
            const routeData = doc.data();
            const routeDate = routeData.date;

            // ✅ FILTRO LOCAL: Solo incluir rutas recientes (últimos 3 días)
            const threeDaysAgo = format(
              new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
              "yyyy-MM-dd"
            );
            if (routeDate >= threeDaysAgo) {
              routes.push({
                id: doc.id,
                ...routeData,
                createdAt: routeData.createdAt?.toDate
                  ? routeData.createdAt.toDate()
                  : new Date(routeData.createdAt),
              } as Route);
            }
          });

          console.log(
            `📱 [DataPreload] ${routes.length} rutas totales después de fallback por región`
          );
        } catch (regionError) {
          console.error(
            "⚠️ [DataPreload] Error en fallback por región:",
            regionError
          );
        }
      }

      console.log(
        `✅ [DataPreload] ${routes.length} rutas cargadas exitosamente para ${user.fullName}`
      );
      return routes;
    } catch (error) {
      console.error("❌ [DataPreload] Error crítico cargando rutas:", error);

      // ✅ RETURN EMPTY ARRAY EN LUGAR DE THROW - Permitir continuar con datos vacíos
      console.log(`⚠️ [DataPreload] Continuando con 0 rutas debido al error`);
      return [];
    }
  }

  /**
   * Carga información detallada de clientes desde las rutas (con manejo robusto de errores)
   */
  private async loadClientesFromRoutes(
    routes: Route[],
    user: UserData
  ): Promise<Cliente[]> {
    const clientes: Cliente[] = [];

    try {
      // Validar que hay rutas para procesar
      if (!routes || routes.length === 0) {
        console.log(
          "ℹ️ [DataPreload] No hay rutas disponibles para extraer clientes"
        );
        return [];
      }

      // Extraer IDs únicos de clientes de todas las rutas
      const clienteIds = new Set<string>();
      routes.forEach((route) => {
        if (route.points && Array.isArray(route.points)) {
          route.points.forEach((point) => {
            if (point.id && point.type === "cliente") {
              clienteIds.add(point.id);
            }
          });
        }
      });

      if (clienteIds.size === 0) {
        console.log(
          "ℹ️ [DataPreload] No se encontraron IDs de clientes en las rutas"
        );
        return [];
      }

      console.log(
        `👥 [DataPreload] Extrayendo ${clienteIds.size} clientes únicos de las rutas...`
      );

      const clientesRef = collection(getFirestoreClient(), "clientes");
      const clienteIdsArray = Array.from(clienteIds);
      const batchSize = 10;

      // ✅ CARGAR CLIENTES POR LOTES CON MANEJO DE ERRORES
      for (let i = 0; i < clienteIdsArray.length; i += batchSize) {
        try {
          const batch = clienteIdsArray.slice(i, i + batchSize);

          console.log(
            `👥 [DataPreload] Procesando lote ${
              Math.floor(i / batchSize) + 1
            }: IDs ${batch.join(", ")}`
          );

          const q = query(clientesRef, where("id", "in", batch));
          const querySnapshot = await getDocs(q);

          querySnapshot.forEach((doc) => {
            try {
              const clienteData = doc.data();
              clientes.push({
                id: doc.id,
                ...clienteData,
                createdAt: clienteData.createdAt?.toDate
                  ? clienteData.createdAt.toDate()
                  : new Date(clienteData.createdAt || Date.now()),
                updatedAt: clienteData.updatedAt?.toDate
                  ? clienteData.updatedAt.toDate()
                  : new Date(clienteData.updatedAt || Date.now()),
              } as Cliente);
            } catch (docError) {
              console.error(
                `⚠️ [DataPreload] Error procesando documento cliente ${doc.id}:`,
                docError
              );
              // Continuar con otros documentos
            }
          });

          // Reportar progreso por lotes
          this.reportProgress(
            "clients",
            Math.min(i + batchSize, clienteIdsArray.length),
            clienteIdsArray.length,
            `Clientes: ${clientes.length}/${clienteIdsArray.length} descargados`
          );
        } catch (batchError) {
          console.error(
            `⚠️ [DataPreload] Error cargando lote de clientes (${i}-${
              i + batchSize
            }):`,
            batchError
          );
          // Continuar con el siguiente lote
        }
      }

      // ✅ CARGAR CLIENTES ADICIONALES POR SEDE/REGIÓN (CON MANEJO DE ERRORES)
      if (user.sede || user.region) {
        try {
          console.log(
            `👥 [DataPreload] Cargando clientes adicionales por ${
              user.sede ? "sede" : "región"
            }...`
          );

          const additionalQuery = user.sede
            ? query(clientesRef, where("sede", "==", user.sede))
            : query(clientesRef, where("region", "==", user.region));

          const additionalSnapshot = await getDocs(additionalQuery);
          let additionalCount = 0;

          additionalSnapshot.forEach((doc) => {
            try {
              const clienteData = doc.data();
              // Evitar duplicados
              if (!clientes.find((c) => c.id === doc.id)) {
                clientes.push({
                  id: doc.id,
                  ...clienteData,
                  createdAt: clienteData.createdAt?.toDate
                    ? clienteData.createdAt.toDate()
                    : new Date(clienteData.createdAt || Date.now()),
                  updatedAt: clienteData.updatedAt?.toDate
                    ? clienteData.updatedAt.toDate()
                    : new Date(clienteData.updatedAt || Date.now()),
                } as Cliente);
                additionalCount++;
              }
            } catch (additionalDocError) {
              console.error(
                `⚠️ [DataPreload] Error procesando cliente adicional ${doc.id}:`,
                additionalDocError
              );
              // Continuar con otros documentos
            }
          });

          console.log(
            `👥 [DataPreload] ${additionalCount} clientes adicionales agregados por ${
              user.sede ? "sede" : "región"
            }`
          );
        } catch (additionalError) {
          console.error(
            "⚠️ [DataPreload] Error cargando clientes adicionales por sede/región:",
            additionalError
          );
          // Continuar sin clientes adicionales
        }
      }

      console.log(
        `✅ [DataPreload] ${clientes.length} clientes cargados exitosamente de ${clienteIdsArray.length} solicitados`
      );
      return clientes;
    } catch (error) {
      console.error("❌ [DataPreload] Error crítico cargando clientes:", error);

      // ✅ RETURN ARRAY PARCIAL EN LUGAR DE THROW
      console.log(
        `⚠️ [DataPreload] Retornando ${clientes.length} clientes parciales debido al error`
      );
      return clientes;
    }
  }

  /**
   * Calcula el tamaño aproximado de los datos en MB
   */
  private calculateDataSize(routes: Route[], clientes: Cliente[]): number {
    try {
      const routesJson = JSON.stringify(routes);
      const clientesJson = JSON.stringify(clientes);
      const totalBytes = new Blob([routesJson, clientesJson]).size;
      return totalBytes / (1024 * 1024); // Convertir a MB
    } catch {
      return 0;
    }
  }

  /**
   * Verifica si hay datos offline disponibles
   */
  async hasOfflineData(userId: string): Promise<boolean> {
    try {
      await offlineManager.initDB();
      const routes = await offlineManager.getOfflineRoutes(userId);
      return routes.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene estadísticas de datos offline almacenados
   */
  async getOfflineDataStats(userId: string): Promise<{
    routesCount: number;
    clientesCount: number;
    lastSync?: number;
    dataAge?: number;
  }> {
    try {
      await offlineManager.initDB();
      const routes = await offlineManager.getOfflineRoutes(userId);

      let clientesCount = 0;
      let lastSync = 0;

      // Contar clientes únicos y encontrar la fecha de sincronización más reciente
      const clienteIds = new Set<string>();
      routes.forEach((route) => {
        if (route.lastSyncedAt && route.lastSyncedAt > lastSync) {
          lastSync = route.lastSyncedAt;
        }
        route.points.forEach((point) => {
          if (point.id && point.type === "cliente") {
            clienteIds.add(point.id);
          }
        });
      });

      clientesCount = clienteIds.size;
      const dataAge = lastSync ? Date.now() - lastSync : undefined;

      return {
        routesCount: routes.length,
        clientesCount,
        lastSync: lastSync || undefined,
        dataAge,
      };
    } catch (error) {
      console.error("❌ Error obteniendo estadísticas offline:", error);
      return {
        routesCount: 0,
        clientesCount: 0,
      };
    }
  }

  /**
   * Limpia datos offline caducados (más de 30 días)
   */
  async cleanupOldOfflineData(): Promise<void> {
    try {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

      // Esta funcionalidad se puede implementar más tarde si es necesaria
      console.log(
        `🧹 [DataPreload] Limpieza de datos antiguos (anterior a ${new Date(
          thirtyDaysAgo
        ).toISOString()})`
      );

      // TODO: Implementar limpieza de datos offline antiguos
    } catch (error) {
      console.error("❌ Error limpiando datos offline antiguos:", error);
    }
  }
}

// Exportar instancia singleton
export const dataPreloadService = new DataPreloadService();
