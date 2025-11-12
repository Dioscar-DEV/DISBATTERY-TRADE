"use client";

import { offlineManager } from "@/services/offlineManager";
import { solicitarAlmacenamientoPersistente } from "./offline";
import { serviceWorkerManager } from "@/services/serviceWorkerManager";

// Función para inicializar todos los servicios offline
export async function initializeOfflineServices() {
  try {
    console.log("🚀 Initializing offline services...");

    // 1. Solicitar almacenamiento persistente como primer paso
    await solicitarAlmacenamientoPersistente();

    // 2. Inicializar sistema offline consolidado
    const initResult = await offlineManager.initializeOfflineSystem();
    if (initResult.success) {
      console.log(`✅ Sistema offline inicializado - IndexedDB: ${initResult.indexedDBAvailable}, Fallback: ${initResult.fallbackAvailable}`);
    } else {
      console.warn("⚠️ [OfflineInit] Sistema offline con funcionalidad limitada:", initResult.errors);
    }

    // 3. Registrar Service Worker a través del manager para evitar registros duplicados
    let swRegistered = false;
    if (typeof (window as Window) !== "undefined" && "serviceWorker" in navigator) {
      try {
        swRegistered = await serviceWorkerManager.initialize();
        if (swRegistered) {
          console.log("✅ Service Worker registrado vía serviceWorkerManager");

          // Escuchar actualizaciones mediante navigator.serviceWorker.getRegistration
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            reg.addEventListener("updatefound", () => {
              console.log("🔄 New Service Worker version found");
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (
                    newWorker.state === "installed" &&
                    navigator.serviceWorker.controller
                  ) {
                    console.log(
                      "✅ New Service Worker installed, update available"
                    );
                    showUpdateAvailableNotification();
                  }
                });
              }
            });
          }
        }
      } catch (error) {
        console.warn(
          "⚠️ Service Worker registration failed via manager:",
          error
        );
      }
      
      // Registrar handler para que el Service Worker pueda solicitar que la
      // aplicación procese la cola offline (solo si el SW está activo)
      if (swRegistered) {
        try {
          serviceWorkerManager.onMessage("SYNC_TRIGGER", async (data: any) => {
            try {
              console.log("🔔 [OfflineInit] SW requested sync trigger:", data);
              const result = await offlineManager.forceSync();
              console.log("🔄 [OfflineInit] Sync result:", result);
              // Enviar resultado al SW si es necesario (con timeout corto)
              try {
                await Promise.race([
                  serviceWorkerManager.sendMessage("SYNC_COMPLETE", result),
                  new Promise((_, reject) => setTimeout(() => reject(new Error("SW message timeout")), 3000))
                ]);
              } catch (sendErr) {
                console.warn("⚠️ No se pudo enviar resultado al SW:", sendErr);
              }
            } catch (err) {
              console.error(
                "❌ Error processing offline queue after SW trigger:",
                err
              );
            }
          });
        } catch (handlerError) {
          console.warn("⚠️ No se pudo configurar handler de SW:", handlerError);
        }
      }
    }

    // 4. Configurar listeners de conectividad
    setupConnectivityListeners();

    // 5. Inicializar sincronización automática
    setupAutoSync();

    console.log("✅ All offline services initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Error initializing offline services:", error);
    return false;
  }
}

// Configurar listeners de conectividad
function setupConnectivityListeners() {
  if (typeof (window as Window) === "undefined") return;

  const handleOnline = () => {
    console.log("🌐 Connection restored - starting sync");
    // Aquí se activará la sincronización automática
    triggerAutoSync();
  };

  const handleOffline = () => {
    console.log("📱 Connection lost - switching to offline mode");
    // Aquí se puede mostrar notificación de modo offline
  };

  (window as Window).addEventListener("online", handleOnline);
  (window as Window).addEventListener("offline", handleOffline);

  // Cleanup function (se puede llamar en unmount)
  return () => {
    (window as Window).removeEventListener("online", handleOnline);
    (window as Window).removeEventListener("offline", handleOffline);
  };
}

// Configurar sincronización automática
function setupAutoSync() {
  if (typeof (window as Window) === "undefined") return;

  // Sincronización cada 5 minutos si hay conexión
  const syncInterval = setInterval(() => {
    if (navigator.onLine) {
      triggerAutoSync();
    }
  }, 5 * 60 * 1000); // 5 minutos

  // Sincronización al ganar foco
  const handleFocus = () => {
    if (navigator.onLine) {
      triggerAutoSync();
    }
  };

  (window as Window).addEventListener("focus", handleFocus);

  // Cleanup function
  return () => {
    clearInterval(syncInterval);
    (window as Window).removeEventListener("focus", handleFocus);
  };
}

// Variable para controlar sincronización en progreso
let syncInProgress = false;
let lastSyncTime = 0;
const MIN_SYNC_INTERVAL = 30000; // 30 segundos mínimo entre sincronizaciones

// Función para activar sincronización automática (delegada a offlineManager)
async function triggerAutoSync() {
  const now = Date.now();
  
  // Evitar múltiples sincronizaciones simultáneas
  if (syncInProgress) {
    console.log("⏭️ [OfflineInit] Sincronización ya en progreso, omitiendo...");
    return;
  }

  // Evitar sincronizaciones muy frecuentes
  if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
    console.log("⏭️ [OfflineInit] Sincronización reciente, omitiendo...");
    return;
  }

  try {
    syncInProgress = true;
    lastSyncTime = now;
    console.log("🔄 [OfflineInit] Auto sync triggered - delegando a offlineManager");
    
    // Delegar a offlineManager consolidado
    const result = await offlineManager.forceSync();
    console.log(`✅ [OfflineInit] Auto sync completado: ${result.processed} procesadas, ${result.errors} errores`);
  } catch (error) {
    console.error("❌ [OfflineInit] Error during auto sync:", error);
  } finally {
    syncInProgress = false;
  }
}

// Mostrar notificación de actualización disponible
function showUpdateAvailableNotification() {
  // Esta función se puede integrar con el sistema de notificaciones
  console.log("📢 Update available notification");

  // Crear evento personalizado para que los componentes puedan escucharlo
  if (typeof (window as Window) !== "undefined") {
    const event = new CustomEvent("sw-update-available", {
      detail: { message: "Nueva versión disponible" },
    });
    (window as Window).dispatchEvent(event);
  }
}

// Hook para inicializar servicios offline en componentes
export function useOfflineInitializer() {
  if (typeof (window as Window) !== "undefined") {
    // Solo ejecutar una vez cuando el componente se monta
    initializeOfflineServices();
  }
}

// Función para verificar el estado de los servicios offline
export async function getOfflineServicesStatus() {
  try {
    const status = {
      indexedDB: false,
      serviceWorker: false,
      connectivity: typeof (window as Window) !== "undefined" ? navigator.onLine : false,
      timestamp: Date.now(),
    };

    // Verificar IndexedDB
    try {
      const { db } = await import("@/lib/indexedDB");
      await db.open();
      status.indexedDB = true;
    } catch (error) {
      console.warn("IndexedDB not available:", error);
    }

    // Verificar Service Worker
    if (typeof (window as Window) !== "undefined" && "serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      status.serviceWorker = !!registration?.active;
    }

    return status;
  } catch (error) {
    console.error("Error checking offline services status:", error);
    return null;
  }
}
