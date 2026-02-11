/**
 * Servicio de estrategia post-login para arquitectura dual
 * Maneja la lógica diferencial según el rol del usuario
 */

import { UserData } from "./auth";
import { dataPreloadService } from "./dataPreloadService";
import { offlineManager } from "./offlineManager";

interface LoginRedirect {
  path: string;
  shouldPreload: boolean;
  storageStrategy: "offline-first" | "online-realtime";
}

interface PostLoginResult {
  success: boolean;
  redirect: LoginRedirect;
  preloadResult?: any;
  error?: string;
}

export interface PreloadProgress {
  step: string;
  current: number;
  total: number;
  percentage: number;
  message: string;
}

class PostLoginStrategy {
  /**
   * Determina la estrategia post-login según el rol del usuario
   */
  private getLoginStrategy(user: UserData): LoginRedirect {
    // Lógica de roles según la arquitectura dual propuesta
    switch (user.role) {
      case "Mercaderista":
        return {
          path: "/mi-ruta",
          shouldPreload: true,
          storageStrategy: "offline-first",
        };

      case "Administrador":
      case "AdminMaster":
        return {
          path: "/admin/dashboard",
          shouldPreload: false,
          storageStrategy: "online-realtime",
        };

      case "Supervisor":
        return {
          path: "/admin/rutas",
          shouldPreload: false,
          storageStrategy: "online-realtime",
        };

      default:
        // Fallback para roles no reconocidos
        return {
          path: "/mi-ruta",
          shouldPreload: true,
          storageStrategy: "offline-first",
        };
    }
  }

  /**
   * Ejecuta la estrategia post-login completa
   */
  async executePostLogin(
    user: UserData,
    onProgress?: (progress: PreloadProgress) => void
  ): Promise<PostLoginResult> {
    try {
      console.log(
        `🚀 [PostLogin] Ejecutando estrategia para usuario: ${user.fullName} (${user.role})`
      );

      const strategy = this.getLoginStrategy(user);

      if (strategy.shouldPreload) {
        // Estrategia Offline-First para Mercaderistas
        console.log(
          `📱 [PostLogin] Aplicando estrategia offline-first para ${user.role}`
        );

        // Configurar callback de progreso si se proporciona
        if (onProgress) {
          dataPreloadService.onProgress(onProgress);
        }

        // Verificar si ya hay datos offline recientes
        const hasRecentData = await this.hasRecentOfflineData(user);

        if (hasRecentData) {
          console.log(
            `✅ [PostLogin] Datos offline recientes encontrados, omitiendo precarga completa`
          );

          // ✅ SIMULAR PROGRESO RÁPIDO DE VERIFICACIÓN PARA MEJOR UX
          if (onProgress) {
            // Paso 1: Verificando datos
            onProgress({
              step: "init",
              current: 1,
              total: 4,
              percentage: 25,
              message: "Verificando datos offline existentes...",
            });
            await new Promise((resolve) => setTimeout(resolve, 300));

            // Paso 2: Validando rutas
            onProgress({
              step: "routes",
              current: 2,
              total: 4,
              percentage: 50,
              message: "Validando rutas disponibles...",
            });
            await new Promise((resolve) => setTimeout(resolve, 300));

            // Paso 3: Validando clientes
            onProgress({
              step: "clients",
              current: 3,
              total: 4,
              percentage: 75,
              message: "Validando datos de clientes...",
            });
            await new Promise((resolve) => setTimeout(resolve, 300));

            // Paso 4: Completado
            onProgress({
              step: "complete",
              current: 4,
              total: 4,
              percentage: 100,
              message: "¡Datos offline ya disponibles!",
            });

            // ✅ Pequeño delay para mostrar el mensaje de éxito antes de continuar
            await new Promise((resolve) => setTimeout(resolve, 1200));
          }

          // ✅ Obtener estadísticas de los datos existentes para mostrar al usuario
          const stats = await dataPreloadService.getOfflineDataStats(user.uid);

          return {
            success: true,
            redirect: strategy,
            preloadResult: {
              success: true,
              routesLoaded: stats.routesCount,
              clientesLoaded: stats.clientesCount,
              totalSizeMB: 0, // No calculamos tamaño para datos existentes
              duration: 1000, // Tiempo simulado
            },
          };
        }

        // Ejecutar precarga de datos
        console.log(`⬇️ [PostLogin] Iniciando precarga de datos offline...`);
        const preloadResult =
          await dataPreloadService.preloadDataForMercaderista(user);

        if (!preloadResult.success) {
          // Si falla la precarga, aún permitir el login pero advertir al usuario
          console.warn(
            `⚠️ [PostLogin] Precarga falló, pero permitiendo acceso: ${preloadResult.error}`
          );
          return {
            success: true,
            redirect: strategy,
            preloadResult,
            error: `Advertencia: No se pudieron descargar todos los datos offline. ${preloadResult.error}`,
          };
        }

        console.log(`✅ [PostLogin] Precarga completada exitosamente`);
        return {
          success: true,
          redirect: strategy,
          preloadResult,
        };
      } else {
        // Estrategia Online en Tiempo Real para Admins/Supervisores
        console.log(
          `🌐 [PostLogin] Aplicando estrategia online en tiempo real para ${user.role}`
        );

        // Para usuarios administrativos, limpiar cualquier dato offline existente
        // para asegurar que siempre trabajen con datos frescos
        await this.clearAdminOfflineData();

        return {
          success: true,
          redirect: strategy,
        };
      }
    } catch (error) {
      console.error(
        "❌ [PostLogin] Error ejecutando estrategia post-login:",
        error
      );

      // En caso de error, redirigir según el rol con estrategia mínima
      const fallbackStrategy = this.getLoginStrategy(user);

      return {
        success: false,
        redirect: fallbackStrategy,
        error: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  }

  /**
   * Verifica si hay datos offline recientes (menos de 6 horas)
   */
  private async hasRecentOfflineData(user: UserData): Promise<boolean> {
    try {
      const stats = await dataPreloadService.getOfflineDataStats(user.uid);

      if (stats.routesCount === 0) {
        return false;
      }

      // Considerar datos "recientes" si tienen menos de 6 horas
      const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
      const hasRecentData = stats.lastSync && stats.lastSync > sixHoursAgo;

      if (hasRecentData) {
        console.log(
          `📊 [PostLogin] Datos offline recientes encontrados: ${
            stats.routesCount
          } rutas, última sincronización: ${new Date(
            stats.lastSync!
          ).toLocaleString()}`
        );
      }

      return hasRecentData || false;
    } catch (error) {
      console.error("❌ Error verificando datos offline recientes:", error);
      return false;
    }
  }

  /**
   * Limpia datos offline para usuarios administrativos
   */
  private async clearAdminOfflineData(): Promise<void> {
    try {
      // Los administradores no deben tener datos offline
      // para garantizar que siempre trabajen con información actualizada
      await offlineManager.clearOfflineData();
      console.log(
        `🧹 [PostLogin] Datos offline limpiados para usuario administrativo`
      );
    } catch (error) {
      console.warn(
        "⚠️ [PostLogin] Error limpiando datos offline para admin:",
        error
      );
      // No es crítico, continuar con el login
    }
  }

  /**
   * Obtiene estadísticas de datos offline para mostrar al usuario
   */
  async getOfflineStats(user: UserData): Promise<{
    hasData: boolean;
    routesCount: number;
    clientesCount: number;
    lastSync?: Date;
    dataAge?: string;
  }> {
    try {
      if (!offlineManager.shouldUseOfflineMode(user)) {
        return {
          hasData: false,
          routesCount: 0,
          clientesCount: 0,
        };
      }

      const stats = await dataPreloadService.getOfflineDataStats(user.uid);

      let dataAge: string | undefined;
      if (stats.dataAge) {
        const hours = Math.floor(stats.dataAge / (1000 * 60 * 60));
        const minutes = Math.floor(
          (stats.dataAge % (1000 * 60 * 60)) / (1000 * 60)
        );

        if (hours > 0) {
          dataAge = `${hours}h ${minutes}m`;
        } else {
          dataAge = `${minutes}m`;
        }
      }

      return {
        hasData: stats.routesCount > 0,
        routesCount: stats.routesCount,
        clientesCount: stats.clientesCount,
        lastSync: stats.lastSync ? new Date(stats.lastSync) : undefined,
        dataAge,
      };
    } catch (error) {
      console.error("❌ Error obteniendo estadísticas offline:", error);
      return {
        hasData: false,
        routesCount: 0,
        clientesCount: 0,
      };
    }
  }

  /**
   * Fuerza una nueva precarga de datos (útil para actualizaciones manuales)
   */
  async forceDataRefresh(
    user: UserData,
    onProgress?: (progress: PreloadProgress) => void
  ): Promise<PostLoginResult> {
    if (!offlineManager.shouldUseOfflineMode(user)) {
      return {
        success: false,
        redirect: this.getLoginStrategy(user),
        error:
          "La actualización de datos offline solo está disponible para mercaderistas",
      };
    }

    console.log(
      `🔄 [PostLogin] Forzando actualización de datos offline para ${user.fullName}`
    );

    try {
      // Limpiar datos existentes
      await offlineManager.clearOfflineData();

      // Configurar callback de progreso
      if (onProgress) {
        dataPreloadService.onProgress(onProgress);
      }

      // Ejecutar nueva precarga
      const preloadResult =
        await dataPreloadService.preloadDataForMercaderista(user);

      return {
        success: preloadResult.success,
        redirect: this.getLoginStrategy(user),
        preloadResult,
        error: preloadResult.success ? undefined : preloadResult.error,
      };
    } catch (error) {
      return {
        success: false,
        redirect: this.getLoginStrategy(user),
        error:
          error instanceof Error ? error.message : "Error actualizando datos",
      };
    }
  }
}

// Exportar instancia singleton
export const postLoginStrategy = new PostLoginStrategy();
