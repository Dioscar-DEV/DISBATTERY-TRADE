/**
 * Servicio de carga dual de rutas
 * Implementa estrategia offline-first para mercaderistas y online para administradores
 */

import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";
import { getFirestoreClient } from "@/firebase/clientApp";
import { Route, RoutePoint } from "@/types/routes";
import { UserData } from "./auth";
import { offlineManager, OfflineRoute } from "./offlineManager";
import { format } from "date-fns";

interface RouteLoadOptions {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  status?: Route["status"][];
  includeCompleted?: boolean;
  forceOnline?: boolean;
}

interface RouteLoadResult {
  routes: Route[];
  source: "offline" | "online" | "hybrid";
  loadedAt: Date;
  totalCount: number;
  offlineCount?: number;
  onlineCount?: number;
}

class DualRouteLoader {
  /**
   * Carga rutas según la estrategia apropiada para el usuario
   */
  async loadRoutes(
    user: UserData,
    options: RouteLoadOptions = {}
  ): Promise<RouteLoadResult> {
    console.log(
      `🔄 [DualRouteLoader] Cargando rutas para ${user.role}: ${user.fullName}`
    );

    // Determinar estrategia de carga
    if (this.shouldUseOfflineStrategy(user) && !options.forceOnline) {
      return await this.loadRoutesOfflineFirst(user, options);
    } else {
      return await this.loadRoutesOnline(user, options);
    }
  }

  /**
   * Determina si debe usar estrategia offline-first
   */
  private shouldUseOfflineStrategy(user: UserData): boolean {
    return user.role === "Mercaderista";
  }

  /**
   * Estrategia offline-first para mercaderistas
   */
  private async loadRoutesOfflineFirst(
    user: UserData,
    options: RouteLoadOptions
  ): Promise<RouteLoadResult> {
    try {
      console.log("📱 [DualRouteLoader] Usando estrategia offline-first...");

      // Intentar cargar desde datos offline primero
      const offlineRoutes = await this.loadOfflineRoutes(user, options);

      if (offlineRoutes.length > 0) {
        console.log(
          `✅ [DualRouteLoader] ${offlineRoutes.length} rutas cargadas desde offline`
        );

        // Verificar si hay conexión para complementar con datos online
        const hasConnection = navigator.onLine;

        if (hasConnection) {
          try {
            // Intentar complementar con datos online más recientes
            const hybridResult = await this.mergeWithOnlineData(
              user,
              offlineRoutes,
              options
            );
            return hybridResult;
          } catch (onlineError) {
            console.warn(
              "⚠️ [DualRouteLoader] Error cargando datos online, usando solo offline:",
              onlineError
            );
            // Continuar con datos offline solamente
          }
        }

        return {
          routes: this.convertOfflineRoutes(offlineRoutes),
          source: "offline",
          loadedAt: new Date(),
          totalCount: offlineRoutes.length,
          offlineCount: offlineRoutes.length,
        };
      } else {
        console.log(
          "📭 [DualRouteLoader] No hay rutas offline, intentando online..."
        );

        // Si no hay datos offline, intentar online como fallback
        try {
          const onlineResult = await this.loadRoutesOnline(user, options);
          return {
            ...onlineResult,
            source: "online", // Aunque sea mercaderista, tuvo que usar online por falta de datos offline
          };
        } catch (onlineError) {
          console.error(
            "❌ [DualRouteLoader] Error cargando rutas online como fallback:",
            onlineError
          );

          // Devolver resultado vacío
          return {
            routes: [],
            source: "offline",
            loadedAt: new Date(),
            totalCount: 0,
            offlineCount: 0,
          };
        }
      }
    } catch (error) {
      console.error(
        "❌ [DualRouteLoader] Error en estrategia offline-first:",
        error
      );

      // Fallback a online si es posible
      if (navigator.onLine) {
        console.log("🌐 [DualRouteLoader] Fallback a estrategia online...");
        return await this.loadRoutesOnline(user, options);
      }

      throw new Error(
        "No se pudieron cargar las rutas offline y no hay conexión para fallback"
      );
    }
  }

  /**
   * Estrategia online para administradores
   */
  private async loadRoutesOnline(
    user: UserData,
    options: RouteLoadOptions
  ): Promise<RouteLoadResult> {
    try {
      console.log("🌐 [DualRouteLoader] Usando estrategia online...");

      const routes = await this.fetchRoutesFromFirestore(user, options);

      console.log(
        `✅ [DualRouteLoader] ${routes.length} rutas cargadas desde Firestore`
      );

      return {
        routes,
        source: "online",
        loadedAt: new Date(),
        totalCount: routes.length,
        onlineCount: routes.length,
      };
    } catch (error) {
      console.error("❌ [DualRouteLoader] Error cargando rutas online:", error);
      throw new Error(`Error cargando rutas desde servidor: ${error}`);
    }
  }

  /**
   * Carga rutas desde almacenamiento offline
   */
  private async loadOfflineRoutes(
    user: UserData,
    options: RouteLoadOptions
  ): Promise<OfflineRoute[]> {
    try {
      await offlineManager.initDB();
      let routes = await offlineManager.getOfflineRoutes(user.uid);

      // Filtrar por rango de fechas si se especifica
      if (options.dateRange) {
        routes = routes.filter((route) => {
          return (
            route.date >= options.dateRange!.startDate &&
            route.date <= options.dateRange!.endDate
          );
        });
      }

      // Filtrar por estado si se especifica
      if (options.status && options.status.length > 0) {
        routes = routes.filter((route) =>
          options.status!.includes(route.status)
        );
      }

      // Filtrar rutas completadas si no se quieren incluir
      if (!options.includeCompleted) {
        routes = routes.filter((route) => route.status !== "completada");
      }

      return routes;
    } catch (error) {
      console.error(
        "❌ [DualRouteLoader] Error cargando rutas offline:",
        error
      );
      return [];
    }
  }

  /**
   * Obtiene rutas desde Firestore
   */
  private async fetchRoutesFromFirestore(
    user: UserData,
    options: RouteLoadOptions
  ): Promise<Route[]> {
    const firestore = getFirestoreClient();
    const routesRef = collection(firestore, "routes");
    let q = query(routesRef);

    // Filtrar por mercaderista si es mercaderista
    if (user.role === "Mercaderista") {
      q = query(routesRef, where("mercaderistoId", "==", user.uid));
    } else if (user.sede && user.role !== "AdminMaster") {
      // Filtrar por sede si no es AdminMaster
      q = query(routesRef, where("sede", "==", user.sede));
    }

    // Agregar filtros adicionales
    if (options.dateRange) {
      q = query(
        q,
        where("date", ">=", options.dateRange.startDate),
        where("date", "<=", options.dateRange.endDate)
      );
    }

    if (options.status && options.status.length > 0) {
      q = query(q, where("status", "in", options.status));
    }

    const querySnapshot = await getDocs(q);
    const routes: Route[] = [];

    querySnapshot.forEach((doc) => {
      const routeData = doc.data();
      routes.push({
        id: doc.id,
        ...routeData,
        createdAt: routeData.createdAt?.toDate
          ? routeData.createdAt.toDate()
          : new Date(routeData.createdAt),
      } as Route);
    });

    return routes;
  }

  /**
   * Combina datos offline con datos online más recientes
   */
  private async mergeWithOnlineData(
    user: UserData,
    offlineRoutes: OfflineRoute[],
    options: RouteLoadOptions
  ): Promise<RouteLoadResult> {
    try {
      console.log(
        "🔄 [DualRouteLoader] Combinando datos offline con online..."
      );

      // Obtener datos online
      const onlineRoutes = await this.fetchRoutesFromFirestore(user, options);

      // Crear mapa de rutas offline por ID
      const offlineRoutesMap = new Map(
        offlineRoutes.map((route) => [route.id, route])
      );

      // Combinar datos: usar online si es más reciente, sino offline
      const mergedRoutes: Route[] = [];
      const seenRouteIds = new Set<string>();

      // Procesar rutas online (más recientes)
      for (const onlineRoute of onlineRoutes) {
        const offlineRoute = offlineRoutesMap.get(onlineRoute.id);

        if (offlineRoute) {
          // Usar la versión más reciente
          const onlineUpdated = onlineRoute.updatedAt?.getTime() || 0;
          const offlineUpdated = offlineRoute.lastSyncedAt || 0;

          if (onlineUpdated > offlineUpdated) {
            mergedRoutes.push(onlineRoute);
          } else {
            mergedRoutes.push(this.convertOfflineRoute(offlineRoute));
          }
        } else {
          // Nueva ruta online que no existe offline
          mergedRoutes.push(onlineRoute);
        }

        seenRouteIds.add(onlineRoute.id);
      }

      // Agregar rutas offline que no existen online
      for (const offlineRoute of offlineRoutes) {
        if (!seenRouteIds.has(offlineRoute.id)) {
          mergedRoutes.push(this.convertOfflineRoute(offlineRoute));
        }
      }

      console.log(
        `✅ [DualRouteLoader] Datos combinados: ${mergedRoutes.length} rutas (${onlineRoutes.length} online, ${offlineRoutes.length} offline)`
      );

      return {
        routes: mergedRoutes,
        source: "hybrid",
        loadedAt: new Date(),
        totalCount: mergedRoutes.length,
        offlineCount: offlineRoutes.length,
        onlineCount: onlineRoutes.length,
      };
    } catch (error) {
      console.warn(
        "⚠️ [DualRouteLoader] Error combinando datos, usando solo offline:",
        error
      );

      // Fallback a solo datos offline
      return {
        routes: this.convertOfflineRoutes(offlineRoutes),
        source: "offline",
        loadedAt: new Date(),
        totalCount: offlineRoutes.length,
        offlineCount: offlineRoutes.length,
      };
    }
  }

  /**
   * Convierte rutas offline a formato estándar
   */
  private convertOfflineRoutes(offlineRoutes: OfflineRoute[]): Route[] {
    return offlineRoutes.map((route) => this.convertOfflineRoute(route));
  }

  /**
   * Convierte una ruta offline a formato estándar
   */
  private convertOfflineRoute(offlineRoute: OfflineRoute): Route {
    const { downloadedAt, lastSyncedAt, ...routeData } = offlineRoute;
    return routeData as Route;
  }

  /**
   * Obtiene rutas del día actual para un mercaderista
   */
  async getTodayRoutes(user: UserData): Promise<RouteLoadResult> {
    const today = format(new Date(), "yyyy-MM-dd");

    return await this.loadRoutes(user, {
      dateRange: {
        startDate: today,
        endDate: today,
      },
      includeCompleted: true,
    });
  }

  /**
   * Obtiene rutas pendientes para un mercaderista
   */
  async getPendingRoutes(user: UserData): Promise<RouteLoadResult> {
    return await this.loadRoutes(user, {
      status: ["planificada", "en_progreso"],
      includeCompleted: false,
    });
  }

  /**
   * Obtiene una ruta específica
   */
  async getRouteById(routeId: string, user: UserData): Promise<Route | null> {
    try {
      // Si es mercaderista, intentar desde offline primero
      if (this.shouldUseOfflineStrategy(user)) {
        const offlineRoutes = await offlineManager.getOfflineRoutes(user.uid);
        const offlineRoute = offlineRoutes.find(
          (route) => route.id === routeId
        );

        if (offlineRoute) {
          return this.convertOfflineRoute(offlineRoute);
        }
      }

      // Si no se encuentra offline o es admin, buscar online
      if (navigator.onLine) {
        const routes = await this.fetchRoutesFromFirestore(user, {});
        return routes.find((route) => route.id === routeId) || null;
      }

      return null;
    } catch (error) {
      console.error(
        "❌ [DualRouteLoader] Error obteniendo ruta por ID:",
        error
      );
      return null;
    }
  }

  /**
   * Escucha cambios en tiempo real (solo para administradores)
   */
  subscribeToRouteChanges(
    user: UserData,
    callback: (routes: Route[]) => void,
    options: RouteLoadOptions = {}
  ): (() => void) | null {
    // Solo para usuarios administrativos en modo online
    if (this.shouldUseOfflineStrategy(user)) {
      console.log(
        "📱 [DualRouteLoader] Mercaderistas usan datos offline, no hay suscripción en tiempo real"
      );
      return null;
    }

    try {
      const routesRef = collection(getFirestoreClient(), "routes");
      let q = query(routesRef);

      // Aplicar filtros según el rol
      if (user.sede && user.role !== "AdminMaster") {
        q = query(routesRef, where("sede", "==", user.sede));
      }

      console.log(
        "👂 [DualRouteLoader] Iniciando suscripción en tiempo real para admin..."
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const routes: Route[] = [];

        querySnapshot.forEach((doc) => {
          const routeData = doc.data();
          routes.push({
            id: doc.id,
            ...routeData,
            createdAt: routeData.createdAt?.toDate
              ? routeData.createdAt.toDate()
              : new Date(routeData.createdAt),
          } as Route);
        });

        console.log(
          `📊 [DualRouteLoader] ${routes.length} rutas actualizadas en tiempo real`
        );
        callback(routes);
      });

      return unsubscribe;
    } catch (error) {
      console.error(
        "❌ [DualRouteLoader] Error configurando suscripción en tiempo real:",
        error
      );
      return null;
    }
  }
}

// Exportar instancia singleton
export const dualRouteLoader = new DualRouteLoader();
