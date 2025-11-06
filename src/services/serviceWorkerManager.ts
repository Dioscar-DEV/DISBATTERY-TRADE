/**
 * Gestor del Service Worker para funcionalidad offline y sincronización
 */

export interface ServiceWorkerMessage {
  type: string;
  data?: any;
}

export interface SyncStatus {
  isRegistered: boolean;
  isSupported: boolean;
  lastSync?: Date;
  pendingCount?: number;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isRegistered = false;
  private messageHandlers = new Map<string, (data: any) => void>();
  private listenersSetup = false;
  private readonly DEFAULT_SW = "/sw-combined.js";
  // Use combined as fallback too to avoid outdated fallback references
  private readonly FALLBACK_SW = "/sw-combined.js";

  /**
   * Inicializa el Service Worker
   */
  /**
   * Inicializa el Service Worker de forma idempotente.
   * Intenta registrar el SW principal (`/sw.js`) y en caso de no existir
   * usa un fallback (`/sw-sync.js`). Evita registros duplicados y configura
   * listeners una sola vez.
   */
  async initialize(): Promise<boolean> {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      console.warn("⚠️ [SWManager] Service Workers no soportados");
      return false;
    }

    if (this.isRegistered) {
      console.log("ℹ️ [SWManager] Ya inicializado (idempotente)");
      return true;
    }

    try {
      console.log("🔧 [SWManager] Registrando Service Worker...");

      // Intentar registrar el SW principal; si falla, usar fallback.
      const swToRegister = await this.selectServiceWorkerUrl();

      this.registration = await navigator.serviceWorker.register(swToRegister, {
        scope: "/",
      });

      console.log(`✅ [SWManager] Service Worker registrado: ${swToRegister}`);

      // Configurar listeners de mensajes (solo una vez)
      this.setupMessageListeners();

      // Verificar estado del Service Worker
      await this.checkServiceWorkerState();

      this.isRegistered = true;
      return true;
    } catch (error) {
      console.error("❌ [SWManager] Error registrando Service Worker:", error);
      return false;
    }
  }

  /**
   * Decide cuál Service Worker registrar: intenta el default y si no está
   * disponible usa el fallback.
   */
  private async selectServiceWorkerUrl(): Promise<string> {
    // Probar si el archivo existe (fetch HEAD) para elegir el SW
    try {
      const resp = await fetch(this.DEFAULT_SW, {
        method: "HEAD",
        cache: "no-cache",
      });
      if (resp.ok) return this.DEFAULT_SW;
    } catch (e) {
      // ignore
    }

    // fallback
    return this.FALLBACK_SW;
  }

  /**
   * Configura los listeners de mensajes del Service Worker
   */
  private setupMessageListeners(): void {
    if (!navigator.serviceWorker || this.listenersSetup) return;

    navigator.serviceWorker.addEventListener("message", (event) => {
      const payload = event.data || {};
      const type = payload.type || "unknown";
      const data = payload.data;
      console.log(`📨 [SWManager] Mensaje recibido del SW: ${type}`, data);

      const handler = this.messageHandlers.get(type);
      if (handler) handler(data);
    });

    this.listenersSetup = true;
  }

  /**
   * Verifica el estado del Service Worker
   */
  private async checkServiceWorkerState(): Promise<void> {
    if (!this.registration) return;

    const sw =
      this.registration.active ||
      this.registration.waiting ||
      this.registration.installing;

    if (sw) {
      console.log(`🔍 [SWManager] Service Worker estado: ${sw.state}`);

      if (sw.state === "activated") {
        console.log("✅ [SWManager] Service Worker activo y listo");
      }
    }
  }

  /**
   * Registra un handler para mensajes del Service Worker
   */
  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Envía un mensaje al Service Worker
   */
  async sendMessage(type: string, data?: any): Promise<any> {
    if (!this.registration?.active) {
      console.warn("⚠️ [ServiceWorkerManager] Service Worker no está activo, omitiendo mensaje");
      return { success: false, error: "Service Worker no activo" };
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      let timeoutCleared = false;
      
      // Timeout para evitar que se cuelgue indefinidamente
      const timeout = setTimeout(() => {
        if (!timeoutCleared) {
          timeoutCleared = true;
          console.warn("⚠️ [ServiceWorkerManager] Timeout del Service Worker, continuando sin respuesta");
          resolve({ success: false, error: "Timeout" }); // Resolver en lugar de rechazar
        }
      }, 3000); // 3 segundos para mejor UX

      messageChannel.port1.onmessage = (event) => {
        if (!timeoutCleared) {
          timeoutCleared = true;
          clearTimeout(timeout);
          if (event.data.success) {
            resolve(event.data);
          } else {
            resolve({ success: false, error: event.data.error || "Error en Service Worker" });
          }
        }
      };

      // Manejar errores de conexión del puerto
      messageChannel.port1.onmessageerror = () => {
        if (!timeoutCleared) {
          timeoutCleared = true;
          clearTimeout(timeout);
          console.warn("⚠️ [ServiceWorkerManager] Error de comunicación con Service Worker");
          resolve({ success: false, error: "Error de comunicación" });
        }
      };

      try {
        this.registration!.active!.postMessage({ type, data }, [
          messageChannel.port2,
        ]);
      } catch (error) {
        if (!timeoutCleared) {
          timeoutCleared = true;
          clearTimeout(timeout);
          console.warn("⚠️ [ServiceWorkerManager] Error enviando mensaje:", error);
          resolve({ success: false, error: `Error enviando mensaje: ${error}` });
        }
      }
    });
  }

  /**
   * Registra background sync para sincronización automática
   */
  async registerBackgroundSync(): Promise<boolean> {
    if (!this.isRegistered) {
      console.warn("⚠️ [SWManager] Service Worker no registrado");
      return false;
    }

    // Esperar a que el Service Worker esté activo
    if (!this.registration?.active) {
      console.log("⏳ [SWManager] Esperando a que Service Worker esté activo...");
      
      // Esperar hasta 5 segundos para que el SW esté activo
      for (let i = 0; i < 50; i++) {
        if (this.registration?.active) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!this.registration?.active) {
        console.warn("⚠️ [SWManager] Service Worker no se activó en el tiempo esperado");
        return false;
      }
    }

    try {
      const result = await this.sendMessage("REGISTER_SYNC");
      if (result.success) {
        console.log("✅ [SWManager] Background sync registrado");
        return true;
      } else {
        console.warn("⚠️ [SWManager] Background sync no pudo ser registrado:", result.error);
        return false;
      }
    } catch (error) {
      console.error("❌ [SWManager] Error registrando background sync:", error);
      return false;
    }
  }

  /**
   * Fuerza una sincronización inmediata
   */
  async forceSync(): Promise<boolean> {
    if (!this.isRegistered) {
      console.warn("⚠️ [SWManager] Service Worker no registrado");
      return false;
    }

    try {
      await this.sendMessage("FORCE_SYNC");
      console.log("✅ [SWManager] Sincronización forzada completada");
      return true;
    } catch (error) {
      console.error("❌ [SWManager] Error en sincronización forzada:", error);
      return false;
    }
  }

  /**
   * Precarga rutas principales (app shell)
   */
  async precacheAppShell(): Promise<boolean> {
    if (!this.isRegistered) return false;
    try {
      await this.sendMessage("PRECACHE_APP_SHELL");
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Precarga una lista de URLs específicas
   */
  async precacheUrls(urls: string[]): Promise<boolean> {
    if (!this.isRegistered) return false;
    try {
      await this.sendMessage("PRECACHE_URLS", { urls });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Precarga una sola URL (permite mostrar progreso granular en UI)
   */
  async precacheUrl(url: string): Promise<boolean> {
    if (!this.isRegistered) return false;
    try {
      await this.sendMessage("PRECACHE_URL", { url });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Verifica si el Service Worker está funcionando
   */
  async ping(): Promise<boolean> {
    if (!this.isRegistered) {
      return false;
    }

    try {
      await this.sendMessage("PING");
      return true;
    } catch (error) {
      console.error("❌ [SWManager] Service Worker no responde:", error);
      return false;
    }
  }

  /**
   * Obtiene el estado de sincronización
   */
  getSyncStatus(): SyncStatus {
    const isSupported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "sync" in window.ServiceWorkerRegistration.prototype;

    return {
      isRegistered: this.isRegistered,
      isSupported,
      lastSync: undefined, // Se puede implementar más tarde
      pendingCount: undefined, // Se puede implementar más tarde
    };
  }

  /**
   * Desregistra el Service Worker
   */
  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return true;
    }

    try {
      const success = await this.registration.unregister();
      console.log("🗑️ [SWManager] Service Worker desregistrado:", success);
      this.registration = null;
      this.isRegistered = false;
      return success;
    } catch (error) {
      console.error(
        "❌ [SWManager] Error desregistrando Service Worker:",
        error
      );
      return false;
    }
  }

  /**
   * Actualiza el Service Worker si hay una nueva versión
   */
  async update(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      await this.registration.update();
      console.log("🔄 [SWManager] Service Worker actualizado");
      return true;
    } catch (error) {
      console.error("❌ [SWManager] Error actualizando Service Worker:", error);
      return false;
    }
  }

  /**
   * Verifica si hay actualizaciones del Service Worker
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    const initialSW = this.registration.active;
    await this.registration.update();

    return this.registration.active !== initialSW;
  }
}

// Exportar instancia singleton
export const serviceWorkerManager = new ServiceWorkerManager();
