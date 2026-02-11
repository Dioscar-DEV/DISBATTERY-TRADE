import { crearVisita } from "./visitas";
import { uploadMultipleImages } from "./images";
import { getCurrentUser, getUserFromStorage } from "./auth";
import { updateRoutePointStatus } from "./routes";
import { format } from "date-fns";
import { fallbackStorage } from "@/services/fallbackStorage";
import { databaseRecovery } from "@/services/databaseRecovery";
import { db as indexedDB } from "@/lib/indexedDB";
import { Route, RoutePoint, Cliente } from "@/types/routes";
import { UserData } from "./auth";

// Tipos para el manejo de datos offline
export interface OfflineVisitaData {
  id: string;
  clienteData: any;
  formData: any;
  fotos: Record<string, string>; // Base64 images
  tipoVisita: string;
  mercaderistoId: string;
  timestamp: number;
  gpsLocation?: { lat: number; lng: number };
  status: "pending" | "processing" | "synced" | "error";
  retryCount: number;
  lastError?: string;
}

export interface SyncProgress {
  total: number;
  processed: number;
  current?: string;
  errors: number;
}

export interface SaveResult {
  success: boolean;
  visitaId?: string;
  error?: string;
  isOffline?: boolean;
}

export interface SyncResult {
  success: boolean;
  processed: number;
  errors: number;
}

// Tipos para el sistema de cola consolidado
export interface QueueOperation {
  id: string;
  type:
    | "uploadImage"
    | "createVisita"
    | "webhook"
    | "updateCliente"
    | "updateRoute";
  payload: any;
  dependencies: string[];
  status: "pending" | "processing" | "completed" | "failed";
  retries: number;
  maxRetries: number;
  lastError?: string;
  idempotencyKey: string;
  createdAt: number;
  updatedAt: number;
  draftId?: string;
}

// Tipos compatibles con offlineService para migración
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

// Interface compatible con la cola de visitas de offlineService
export interface OfflineVisita {
  id: string;
  routeId: string;
  pointId: string;
  clienteId: string;
  mercaderistoId: string;
  timestamp: number;
  gpsLocation: { lat: number; lng: number };
  formData: any;
  photos: File[];
  tipoVisita: "Merchandising" | "Trade (Eventos)" | "Trade (Impulso)";
  marcaTrabajada?: "Shell" | "Qualid";
  status: "pending" | "syncing" | "synced" | "error";
  syncAttempts: number;
  lastSyncAttempt?: number;
  errorMessage?: string;
}

// Interface para resultado de inicialización
export interface InitResult {
  success: boolean;
  indexedDBAvailable: boolean;
  fallbackAvailable: boolean;
  errors: string[];
}

// Configuración para inicialización y sincronización
const INIT_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  VERSION_ERROR_NAMES: [
    "VersionError",
    "version",
    "Version",
    "existing version",
  ],
  DB_NAMES_TO_CLEANUP: [
    "DisbatteryOfflineDB",
    "DisbatteryOfflineDB_v3",
    "RouteOfflineDB",
    "VisitOfflineDB",
    "ClientOfflineDB",
    "OfflineDataDB",
  ],
} as const;

const SYNC_CONFIG = {
  MIN_SYNC_INTERVAL_MS: 30000, // 30 segundos
  AUTO_SYNC_INTERVAL_MS: 5 * 60 * 1000, // 5 minutos
  SW_MESSAGE_TIMEOUT_MS: 3000,
} as const;

class OfflineManager {
  private syncInProgress = false;
  private progressCallbacks: ((progress: SyncProgress) => void)[] = [];

  // Variables para control de auto-sync
  private autoSyncInProgress = false;
  private lastAutoSyncTime = 0;
  private autoSyncInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  /**
   * 🎯 MÉTODO PRINCIPAL: Guardar visita (online u offline)
   */
  async saveVisita(visitaData: any): Promise<SaveResult> {
    try {
      console.log("🚀 [OfflineManager] Iniciando guardado de visita...");

      // Validar datos antes de guardar
      const validationResult = this.validateVisitaData(visitaData);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: `Datos inválidos: ${validationResult.errors.join(", ")}`,
        };
      }

      // Verificar conexión
      const isOnline = await this.checkConnection();

      if (isOnline) {
        // Guardar directamente online
        console.log(
          "🌐 [OfflineManager] Conexión disponible - guardando online"
        );
        return await this.saveOnline(visitaData);
      } else {
        // Guardar offline
        console.log("📱 [OfflineManager] Sin conexión - guardando offline");
        return await this.saveOffline(visitaData);
      }
    } catch (error) {
      console.error("❌ [OfflineManager] Error en saveVisita:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  }

  /**
   * 💾 Guardar visita offline
   */
  private async saveOffline(visitaData: any): Promise<SaveResult> {
    try {
      const visitaId = this.generateVisitaId();

      // Intentar guardar en IndexedDB, usar fallback si falla
      try {
        await indexedDB.visitas.add({
          id: visitaId,
          visitaId: visitaId,
          clienteRif: visitaData.clienteData?.rif || "unknown",
          data: visitaData,
          fotos: this.extractPhotos(visitaData),
          timestamp: Date.now(),
          syncStatus: "pending",
        });
        console.log(
          "✅ [OfflineManager] Visita guardada en IndexedDB:",
          visitaId
        );
      } catch (dbError) {
        console.warn(
          "⚠️ [OfflineManager] IndexedDB falló, usando fallback storage:",
          dbError
        );

        // Usar fallback storage (localStorage)
        if (fallbackStorage.isAvailable()) {
          await fallbackStorage.saveVisita(visitaData);
          console.log(
            "✅ [OfflineManager] Visita guardada en fallback storage:",
            visitaId
          );
        } else {
          throw new Error(
            "No hay almacenamiento disponible (IndexedDB y localStorage fallaron)"
          );
        }
      }

      // NO marcar punto como completado aquí. Solo al finalizar la ruta (último formulario).
      // await this.markPointAsCompleted(visitaData);

      // Registrar para sincronización automática
      this.scheduleSync();

      return {
        success: true,
        visitaId: visitaId,
        isOffline: true,
      };
    } catch (error) {
      console.error("❌ [OfflineManager] Error guardando offline:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Error guardando offline",
      };
    }
  }

  /**
   * 🌐 Guardar visita online
   */
  private async saveOnline(visitaData: any): Promise<SaveResult> {
    try {
      console.log("🌐 [OfflineManager] Procesando guardado online...");

      // Comprimir y subir imágenes
      const fotosUrls = await this.processAndUploadImages(visitaData);

      // Preparar datos para Firebase
      const firebaseData = await this.prepareFirebaseData(
        visitaData,
        fotosUrls
      );

      // Crear visita en Firebase
      const visitaId = await crearVisita(firebaseData);

      console.log("✅ [OfflineManager] Visita guardada online:", visitaId);

      // NO marcar punto como completado aquí. Solo al finalizar la ruta (último formulario).
      // await this.markPointAsCompleted(visitaData);

      return {
        success: true,
        visitaId: visitaId,
        isOffline: false,
      };
    } catch (error) {
      console.error("❌ [OfflineManager] Error guardando online:", error);

      // Si falla online, intentar guardar offline como fallback
      console.log("🔄 [OfflineManager] Fallback a guardado offline...");
      return await this.saveOffline(visitaData);
    }
  }

  /**
   * 🔄 Sincronizar visitas pendientes
   */
  async syncPendingVisitas(): Promise<void> {
    if (this.syncInProgress) {
      console.log("🔄 [OfflineManager] Sincronización ya en progreso");
      return;
    }

    const isOnline = await this.checkConnection();
    if (!isOnline) {
      console.log(
        "📱 [OfflineManager] Sin conexión - sincronización pospuesta"
      );
      return;
    }

    this.syncInProgress = true;
    console.log(
      "🚀 [OfflineManager] Iniciando sincronización de visitas pendientes..."
    );

    try {
      // Obtener visitas pendientes de IndexedDB
      let pendingVisitas: any[] = [];
      let fallbackVisitas: any[] = [];

      try {
        pendingVisitas = await indexedDB.visitas
          .where("syncStatus")
          .equals("pending")
          .toArray();
      } catch (dbError) {
        console.warn(
          "⚠️ [OfflineManager] Error accediendo a IndexedDB:",
          dbError
        );
      }

      // También obtener visitas del fallback storage
      if (fallbackStorage.isAvailable()) {
        fallbackVisitas = fallbackStorage.getPendingVisitas();
      }

      // Eliminar duplicados entre IndexedDB y fallback storage
      const { uniqueIndexedDB, uniqueFallback, duplicatesRemoved } =
        this.deduplicateVisitas(pendingVisitas, fallbackVisitas);

      if (duplicatesRemoved > 0) {
        console.log(
          `🔄 [OfflineManager] ${duplicatesRemoved} duplicados eliminados durante deduplicación`
        );
        pendingVisitas = uniqueIndexedDB;
        fallbackVisitas = uniqueFallback;
      }

      const totalPending = pendingVisitas.length + fallbackVisitas.length;

      if (totalPending === 0) {
        console.log("✅ [OfflineManager] No hay visitas pendientes");
        return;
      }

      console.log(
        `📊 [OfflineManager] ${totalPending} visitas pendientes encontradas (${pendingVisitas.length} IndexedDB, ${fallbackVisitas.length} fallback)`
      );

      const progress: SyncProgress = {
        total: totalPending,
        processed: 0,
        errors: 0,
      };

      // Notificar progreso inicial
      this.notifyProgress(progress);

      // Procesar visitas de IndexedDB
      for (const visita of pendingVisitas) {
        try {
          progress.current = `${visita.data.clienteData?.nombre || "Cliente"} - ${visita.data.tipoVisita}`;
          this.notifyProgress(progress);

          // Marcar como procesando
          await indexedDB.visitas.update(visita.id!, { syncStatus: "syncing" });

          // Verificar tipo de datos y procesar según corresponda
          if (this.isAdminData(visita.data)) {
            // Procesar datos administrativos (clientes, usuarios, rutas, eventos)
            await this.syncAdminData(visita.data);
          } else {
            // Procesar visitas normales (merchandising)
            const fotosUrls = await this.processAndUploadImages(visita.data);
            const firebaseData = await this.prepareFirebaseData(
              visita.data,
              fotosUrls
            );
            const visitaId = await crearVisita(firebaseData);
          }

          // Marcar como sincronizada
          await indexedDB.visitas.update(visita.id!, { syncStatus: "synced" });

          progress.processed++;
          console.log(
            `✅ [OfflineManager] Datos sincronizados: ${visita.visitaId}`
          );
        } catch (error) {
          console.error(
            `❌ [OfflineManager] Error sincronizando visita ${visita.visitaId}:`,
            error
          );

          // Marcar como error
          await indexedDB.visitas.update(visita.id!, {
            syncStatus: "error",
            lastError:
              error instanceof Error ? error.message : "Error desconocido",
          });

          progress.errors++;
        }

        this.notifyProgress(progress);
      }

      // Procesar visitas del fallback storage
      for (const fallbackVisita of fallbackVisitas) {
        try {
          progress.current = `${fallbackVisita.data.clienteData?.nombre || "Cliente"} - ${fallbackVisita.data.tipoVisita} (fallback)`;
          this.notifyProgress(progress);

          // Verificar tipo de datos y procesar según corresponda
          if (this.isAdminData(fallbackVisita.data)) {
            // Procesar datos administrativos (clientes, usuarios, rutas, eventos)
            await this.syncAdminData(fallbackVisita.data);
          } else {
            // Procesar visitas normales (merchandising)
            const fotosUrls = await this.processAndUploadImages(
              fallbackVisita.data
            );
            const firebaseData = await this.prepareFirebaseData(
              fallbackVisita.data,
              fotosUrls
            );
            const visitaId = await crearVisita(firebaseData);
          }

          // Marcar como sincronizada en fallback storage
          fallbackStorage.markAsSynced(fallbackVisita.id);

          progress.processed++;
          console.log(
            `✅ [OfflineManager] Datos fallback sincronizados: ${fallbackVisita.id}`
          );
        } catch (error) {
          console.error(
            `❌ [OfflineManager] Error sincronizando visita fallback ${fallbackVisita.id}:`,
            error
          );
          progress.errors++;
        }

        this.notifyProgress(progress);
      }

      console.log(
        `📊 [OfflineManager] Sincronización completada: ${progress.processed} exitosas, ${progress.errors} errores`
      );
    } catch (error) {
      console.error(
        "❌ [OfflineManager] Error general en sincronización:",
        error
      );
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 🔍 Validar datos de visita
   */
  private validateVisitaData(visitaData: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Si es una operación administrativa o de sistema, tiene validación diferente
    if (this.isAdminData(visitaData)) {
      if (!visitaData.tipoVisita) {
        errors.push("Tipo de visita requerido para operación admin");
      }
      if (!visitaData.accion) {
        errors.push("Acción requerida para operación admin");
      }
      // Verificar que tenga al menos un objeto de datos relevante
      if (
        !visitaData.routeData &&
        !visitaData.clienteData &&
        !visitaData.eventoData &&
        !visitaData.userData
      ) {
        errors.push(
          "Datos de operación requeridos (route/cliente/evento/user)"
        );
      }
    } else {
      // Validación estricta para visitas normales (Merchandising/Trade)
      if (!visitaData.clienteData) {
        errors.push("Datos del cliente requeridos");
      }

      if (!visitaData.tipoVisita) {
        errors.push("Tipo de visita requerido");
      }

      if (visitaData.clienteData && !visitaData.clienteData.rif) {
        errors.push("RIF del cliente requerido");
      }

      if (visitaData.clienteData && !visitaData.clienteData.nombre) {
        errors.push("Nombre del cliente requerido");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 📸 Extraer fotos del objeto de datos (VERSIÓN COMPLETA CON FUNCIONALIDAD CRÍTICA)
   */
  private extractPhotos(visitaData: any): Record<string, string> {
    const fotos: Record<string, string> = {};

    console.log("📷 [OfflineManager] Iniciando extracción de fotos...");
    console.log("🔍 DEBUG: Datos completos:", visitaData);
    console.log("🔍 DEBUG: Tipo de visita:", visitaData.tipoVisita);
    console.log("🔍 DEBUG: Marca seleccionada:", visitaData.marca);

    // 🔍 DEBUGGING ESPECÍFICO PARA FOTOS DE TRADE
    console.log("🔍 DEBUG: Verificando fotos de Trade...");
    console.log(
      "  - fotoImpulso:",
      visitaData.fotoImpulso ? "EXISTE" : "NO EXISTE"
    );
    console.log(
      "  - fotoPromotoras:",
      visitaData.fotoPromotoras ? "EXISTE" : "NO EXISTE"
    );
    console.log(
      "  - fotoImpulsoShell:",
      visitaData.fotoImpulsoShell ? "EXISTE" : "NO EXISTE"
    );
    console.log(
      "  - fotoPromotorasShell:",
      visitaData.fotoPromotorasShell ? "EXISTE" : "NO EXISTE"
    );
    console.log(
      "  - fotoImpulsoQualid:",
      visitaData.fotoImpulsoQualid ? "EXISTE" : "NO EXISTE"
    );
    console.log(
      "  - fotoPromotorasQualid:",
      visitaData.fotoPromotorasQualid ? "EXISTE" : "NO EXISTE"
    );

    // ✅ NUEVO: Extracción de fotos de evento por marca
    if (visitaData.fotosShell && Array.isArray(visitaData.fotosShell)) {
      console.log(
        `📸 Extrayendo ${visitaData.fotosShell.length} fotos de Shell...`
      );
      visitaData.fotosShell.forEach((fotoBase64: string, index: number) => {
        if (fotoBase64 && fotoBase64.startsWith("data:image/")) {
          fotos[`foto_shell_${index}`] = fotoBase64;
        }
      });
    }

    if (visitaData.fotosQualid && Array.isArray(visitaData.fotosQualid)) {
      console.log(
        `📸 Extrayendo ${visitaData.fotosQualid.length} fotos de Qualid...`
      );
      visitaData.fotosQualid.forEach((fotoBase64: string, index: number) => {
        if (fotoBase64 && fotoBase64.startsWith("data:image/")) {
          fotos[`foto_qualid_${index}`] = fotoBase64;
        }
      });
    }

    // FOTOS DE TRADE (EVENTOS) - hasta 6 fotos
    if (visitaData.fotosEvento && Array.isArray(visitaData.fotosEvento)) {
      console.log(
        `📸 Extrayendo ${visitaData.fotosEvento.length} fotos de evento...`
      );
      visitaData.fotosEvento.forEach((fotoBase64: string, index: number) => {
        if (fotoBase64 && fotoBase64.startsWith("data:image/")) {
          fotos[`foto_evento_${index + 1}`] = fotoBase64;
        }
      });
    }

    // 🆕 FOTO DE SEÑALIZACIÓN (VISIT-CAPTURE)
    console.log("🚩 === DEBUGGING FOTO SEÑALIZACIÓN ===");
    console.log(
      "🚩 visitaData.signagePhoto existe:",
      !!visitaData.signagePhoto
    );
    console.log(
      "🚩 visitaData.clienteData?.signagePhoto existe:",
      !!visitaData.clienteData?.signagePhoto
    );

    const fotoSeñalizacion =
      visitaData.signagePhoto || visitaData.clienteData?.signagePhoto;
    if (
      fotoSeñalizacion &&
      fotoSeñalizacion.trim() !== "" &&
      fotoSeñalizacion.startsWith("data:image/")
    ) {
      console.log("✅ EXTRAYENDO FOTO DE SEÑALIZACIÓN");
      fotos.foto_senalizacion = fotoSeñalizacion;
    }

    // FOTOS DE TRADE-IMPULSO/EVENTOS
    if (
      visitaData.fotoImpulso &&
      visitaData.fotoImpulso.trim() !== "" &&
      visitaData.fotoImpulso.startsWith("data:image/")
    ) {
      fotos.foto_impulso = visitaData.fotoImpulso;
    } else {
      // Recuperar fotos específicas por marca
      if (
        visitaData.fotoImpulsoShell &&
        visitaData.fotoImpulsoShell.trim() !== "" &&
        visitaData.fotoImpulsoShell.startsWith("data:image/")
      ) {
        fotos.foto_impulso_shell = visitaData.fotoImpulsoShell;
      }
      if (
        visitaData.fotoImpulsoQualid &&
        visitaData.fotoImpulsoQualid.trim() !== "" &&
        visitaData.fotoImpulsoQualid.startsWith("data:image/")
      ) {
        fotos.foto_impulso_qualid = visitaData.fotoImpulsoQualid;
      }
    }

    if (
      visitaData.fotoPromotoras &&
      visitaData.fotoPromotoras.trim() !== "" &&
      visitaData.fotoPromotoras.startsWith("data:image/")
    ) {
      fotos.foto_promotoras = visitaData.fotoPromotoras;
    } else {
      // Recuperar fotos específicas por marca
      if (
        visitaData.fotoPromotorasShell &&
        visitaData.fotoPromotorasShell.trim() !== "" &&
        visitaData.fotoPromotorasShell.startsWith("data:image/")
      ) {
        fotos.foto_promotoras_shell = visitaData.fotoPromotorasShell;
      }
      if (
        visitaData.fotoPromotorasQualid &&
        visitaData.fotoPromotorasQualid.trim() !== "" &&
        visitaData.fotoPromotorasQualid.startsWith("data:image/")
      ) {
        fotos.foto_promotoras_qualid = visitaData.fotoPromotorasQualid;
      }
    }

    // FOTOS DE MERCHANDISING SHELL
    if (visitaData.shellMerchandising) {
      const shell = visitaData.shellMerchandising;
      console.log("📸 EXTRAYENDO FOTOS DE MERCHANDISING SHELL:");

      if (
        shell.fotoAntesShell &&
        shell.fotoAntesShell.trim() !== "" &&
        shell.fotoAntesShell.startsWith("data:image/")
      ) {
        fotos.foto_antes_planograma = shell.fotoAntesShell;
        console.log("✅ EXTRAÍDA FOTO ANTES DEL PLANOGRAMA");
      }

      if (
        shell.fotoDespuesShell &&
        shell.fotoDespuesShell.trim() !== "" &&
        shell.fotoDespuesShell.startsWith("data:image/")
      ) {
        fotos.foto_despues_planograma = shell.fotoDespuesShell;
        console.log("✅ EXTRAÍDA FOTO DESPUÉS DEL PLANOGRAMA");
      }

      if (
        shell.fotoStickerShell &&
        shell.fotoStickerShell.trim() !== "" &&
        shell.fotoStickerShell.startsWith("data:image/")
      ) {
        fotos.foto_sticker_shell = shell.fotoStickerShell;
        console.log("✅ EXTRAÍDA FOTO STICKER SHELL");
      }
    }

    // 🆕 FOTOS DE MATERIAL INTERNO SHELL
    if (visitaData.shellMaterialInterno) {
      const material = visitaData.shellMaterialInterno;
      console.log("📸 EXTRAYENDO FOTOS DE MATERIAL INTERNO SHELL:");

      if (
        material.fotoExhibidoresShell &&
        material.fotoExhibidoresShell.trim() !== "" &&
        material.fotoExhibidoresShell.startsWith("data:image/")
      ) {
        fotos.foto_exhibidores_shell = material.fotoExhibidoresShell;
      }
      if (
        material.fotoAfichesColocadosShell &&
        material.fotoAfichesColocadosShell.trim() !== "" &&
        material.fotoAfichesColocadosShell.startsWith("data:image/")
      ) {
        fotos.foto_afiches_shell = material.fotoAfichesColocadosShell;
      }
      if (
        material.fotoBanderinesShell &&
        material.fotoBanderinesShell.trim() !== "" &&
        material.fotoBanderinesShell.startsWith("data:image/")
      ) {
        fotos.foto_banderines_shell = material.fotoBanderinesShell;
      }
      if (
        material.fotoAvisoAcrilicoShell &&
        material.fotoAvisoAcrilicoShell.trim() !== "" &&
        material.fotoAvisoAcrilicoShell.startsWith("data:image/")
      ) {
        fotos.foto_aviso_acrilico_shell = material.fotoAvisoAcrilicoShell;
      }
    }

    // 🆕 FOTOS DE MERCHANDISING QUALID
    if (visitaData.qualidMerchandising) {
      const qualid = visitaData.qualidMerchandising;
      console.log("📸 EXTRAYENDO FOTOS DE MERCHANDISING QUALID:");

      if (
        qualid.fotoAntesPlanogramaQualid &&
        qualid.fotoAntesPlanogramaQualid.trim() !== "" &&
        qualid.fotoAntesPlanogramaQualid.startsWith("data:image/")
      ) {
        fotos.foto_antes_planograma_qualid = qualid.fotoAntesPlanogramaQualid;
      }
      if (
        qualid.fotoDespuesPlanogramaQualid &&
        qualid.fotoDespuesPlanogramaQualid.trim() !== "" &&
        qualid.fotoDespuesPlanogramaQualid.startsWith("data:image/")
      ) {
        fotos.foto_despues_planograma_qualid =
          qualid.fotoDespuesPlanogramaQualid;
      }
      if (
        qualid.fotoAfichesQualid &&
        qualid.fotoAfichesQualid.trim() !== "" &&
        qualid.fotoAfichesQualid.startsWith("data:image/")
      ) {
        fotos.foto_afiches_qualid = qualid.fotoAfichesQualid;
      }
      if (
        qualid.fotoExhibidoresCauchoQualid &&
        qualid.fotoExhibidoresCauchoQualid.trim() !== "" &&
        qualid.fotoExhibidoresCauchoQualid.startsWith("data:image/")
      ) {
        fotos.foto_exhibidores_caucho_qualid =
          qualid.fotoExhibidoresCauchoQualid;
      }
    }

    // Función recursiva para encontrar cualquier imagen base64 adicional
    const findBase64Images = (obj: any, prefix = "") => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string" && value.startsWith("data:image/")) {
          const fotoKey = prefix ? `${prefix}_${key}` : key;
          if (!fotos[fotoKey]) {
            // Solo agregar si no existe ya
            fotos[fotoKey] = value;
          }
        } else if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          findBase64Images(value, prefix ? `${prefix}_${key}` : key);
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === "string" && item.startsWith("data:image/")) {
              const fotoKey = `${prefix ? `${prefix}_${key}` : key}_${index}`;
              if (!fotos[fotoKey]) {
                // Solo agregar si no existe ya
                fotos[fotoKey] = item;
              }
            }
          });
        }
      }
    };

    // Buscar imágenes adicionales que no hayamos capturado específicamente
    findBase64Images(visitaData);

    console.log(
      `📊 [OfflineManager] TOTAL DE FOTOS EXTRAÍDAS: ${Object.keys(fotos).length} imágenes`
    );
    console.log("🎯 [OfflineManager] FOTOS EXTRAÍDAS:", Object.keys(fotos));

    return fotos;
  }

  /**
   * 🖼️ Procesar y subir imágenes
   */
  private async processAndUploadImages(visitaData: any): Promise<string[]> {
    const fotos = this.extractPhotos(visitaData);
    const fotosArray = Object.entries(fotos);

    if (fotosArray.length === 0) {
      return [];
    }

    console.log(
      `📸 [OfflineManager] Procesando ${fotosArray.length} imágenes...`
    );

    // Comprimir imágenes
    const fotosComprimidas = await Promise.all(
      fotosArray.map(async ([key, base64]) => ({
        base64: await this.compressImage(base64),
        path: `visitas/${visitaData.clienteData?.rif || "unknown"}/${Date.now()}`,
        prefix: key,
      }))
    );

    // Subir a Firebase Storage
    const urls = await uploadMultipleImages(fotosComprimidas);
    console.log(`✅ [OfflineManager] ${urls.length} imágenes subidas`);

    return urls;
  }

  /**
   * 🗜️ Comprimir imagen
   */
  private async compressImage(base64: string, quality = 0.6): Promise<string> {
    return new Promise((resolve) => {
      if (typeof window === "undefined") {
        resolve(base64);
        return;
      }

      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      img.onload = () => {
        const maxWidth = 800;
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        const newWidth = img.width * ratio;
        const newHeight = img.height * ratio;

        canvas.width = newWidth;
        canvas.height = newHeight;

        ctx?.drawImage(img, 0, 0, newWidth, newHeight);
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      };

      img.onerror = () => resolve(base64);
      img.src = base64;
    });
  }

  /**
   * 🔥 Preparar datos para Firebase (VERSIÓN COMPLETA CON TODA LA FUNCIONALIDAD)
   */
  private async prepareFirebaseData(
    visitaData: any,
    fotosUrls: string[]
  ): Promise<any> {
    const currentUser = (await getCurrentUser()) || getUserFromStorage();
    const cliente = visitaData.clienteData;

    // Preparar datos de ventas para las observaciones (FUNCIONALIDAD CRÍTICA RESTAURADA)
    const ventasData: string[] = [];

    // Agregar ventas Shell si hubo
    if (
      visitaData.huboVentasShell === true &&
      visitaData.ventasShellDetalladas
    ) {
      const ventas = visitaData.ventasShellDetalladas;
      ventasData.push("VENTAS SHELL:");
      ventasData.push(`- ADVANCE: ${ventas.advance || "0"} litros`);
      ventasData.push(`- HELIX HX5: ${ventas.helixHX5 || "0"} litros`);
      ventasData.push(`- HELIX HX7: ${ventas.helixHX7 || "0"} litros`);
      ventasData.push(`- HELIX HX8: ${ventas.helixHX8 || "0"} litros`);
      ventasData.push(`- HELIX ULTRA: ${ventas.helixUltra || "0"} litros`);
      ventasData.push(`- RIMULA: ${ventas.rimula || "0"} litros`);
      ventasData.push(`- SPIRAX: ${ventas.spirax || "0"} litros`);
      ventasData.push(`- GADUS: ${ventas.gadus || "0"} cartuchos`);
      ventasData.push(`- OTROS: ${ventas.otros || "0"} litros`);
    } else if (visitaData.huboVentasShell === false) {
      ventasData.push("No hubo ventas de productos SHELL");
    }

    // Agregar ventas Qualid si hubo
    if (
      visitaData.huboVentasQualid === true &&
      visitaData.ventasQualidDetalladas
    ) {
      const ventas = visitaData.ventasQualidDetalladas;
      ventasData.push("VENTAS QUALID:");
      ventasData.push(`- FLUIDOS: ${ventas.fluidos || "0"} litros`);
      ventasData.push(`- SPRAY: ${ventas.spray || "0"} unidades`);
      ventasData.push(
        `- FILTRO AUTOMOTRIZ: ${ventas.filtroAutomotriz || "0"} unidades`
      );
      ventasData.push(
        `- SERVICIO PESADO: ${ventas.servicioPesado || "0"} unidades`
      );
      ventasData.push(`- CAUCHOS: ${ventas.cauchos || "0"} unidades`);
    } else if (visitaData.huboVentasQualid === false) {
      ventasData.push("No hubo ventas de productos QUALID");
    }

    // Preparar datos completos para Google Sheets (FUNCIONALIDAD CRÍTICA RESTAURADA)
    const datosSheet = this.prepareCompleteSheetData(
      visitaData,
      currentUser,
      ventasData
    );

    return {
      rifCliente: cliente.rif,
      nombreEstablecimiento: cliente.nombre,
      tipoVisita: visitaData.tipoVisita,
      mercaderista:
        currentUser?.fullName || visitaData.mercaderista || "Usuario App",
      correoMercaderista:
        currentUser?.email || visitaData.correoMercaderista || "",
      ubicacion: visitaData.gpsCoordinates ||
        visitaData.location || {
          lat: 0,
          lng: 0,
          direccion: cliente.direccion || "No disponible",
        },
      sucursal: cliente.sede || currentUser?.sede || "DESCONOCIDA",
      respuestas: visitaData,
      datosN8N: {
        datosSheet: datosSheet,
        fotos: fotosUrls,
      },
    };
  }

  /**
   * 📊 Preparar datos COMPLETOS para Google Sheets (FUNCIONALIDAD CRÍTICA RESTAURADA)
   */
  private prepareCompleteSheetData(
    visitaData: any,
    currentUser: any,
    ventasData: string[]
  ): Record<string, any> {
    const cliente = visitaData.clienteData;

    // 🗂️ ESTRUCTURA ORGANIZADA CON PREGUNTAS Y RESPUESTAS (FUNCIONALIDAD CRÍTICA)
    const observacionesOrganizadas = [];

    // INFORMACIÓN BÁSICA
    observacionesOrganizadas.push(
      `TIPO DE VISITA: ${visitaData.tipoVisita || "No especificado"}`
    );
    observacionesOrganizadas.push(
      `MARCA SELECCIONADA: ${visitaData.marca || "No especificada"}`
    );
    observacionesOrganizadas.push(
      `MERCADERISTA: ${currentUser?.fullName || visitaData.mercaderista || "Usuario App"}`
    );
    observacionesOrganizadas.push(
      `ESTABLECIMIENTO: ${cliente.nombre} (${cliente.rif})`
    );
    observacionesOrganizadas.push(
      `SUCURSAL: ${cliente.sede || currentUser?.sede || "No especificada"}`
    );

    // 🆕 AÑADIR DATO DE SEÑALIZACIÓN
    if (visitaData.hasSignage) {
      observacionesOrganizadas.push(
        `¿EL CLIENTE TIENE SEÑALIZACIÓN?: ${visitaData.hasSignage === "Yes" ? "Sí" : "No"}`
      );
    }

    // RECURSOS UTILIZADOS
    if ((visitaData.recursosUsados || []).length > 0) {
      observacionesOrganizadas.push(`RECURSOS UTILIZADOS:`);
      visitaData.recursosUsados.forEach((r: any) => {
        observacionesOrganizadas.push(`  - ${r.tipo}: ${r.cantidad} unidades`);
      });
    } else {
      observacionesOrganizadas.push(`RECURSOS UTILIZADOS: Ninguno reportado`);
    }

    // ENTREGABLES SHELL
    if ((visitaData.entregablesShell || []).length > 0) {
      observacionesOrganizadas.push(`ENTREGABLES SHELL DISTRIBUIDOS:`);
      visitaData.entregablesShell.forEach((e: any) => {
        observacionesOrganizadas.push(`  - ${e.tipo}: ${e.cantidad} unidades`);
      });
    } else {
      observacionesOrganizadas.push(
        `ENTREGABLES SHELL DISTRIBUIDOS: Ninguno reportado`
      );
    }

    // ENTREGABLES QUALID
    if ((visitaData.entregablesQualid || []).length > 0) {
      observacionesOrganizadas.push(`ENTREGABLES QUALID DISTRIBUIDOS:`);
      visitaData.entregablesQualid.forEach((e: any) => {
        observacionesOrganizadas.push(`  - ${e.tipo}: ${e.cantidad} unidades`);
      });
    } else {
      observacionesOrganizadas.push(
        `ENTREGABLES QUALID DISTRIBUIDOS: Ninguno reportado`
      );
    }

    // AGREGAR DATOS DE VENTAS
    if (ventasData.length > 0) {
      observacionesOrganizadas.push("");
      observacionesOrganizadas.push("=== INFORMACIÓN DE VENTAS ===");
      ventasData.forEach((venta) => observacionesOrganizadas.push(venta));
    }

    // REPORTES FINALES
    if (visitaData.reporteShellFaltante) {
      observacionesOrganizadas.push("");
      observacionesOrganizadas.push(
        "=== REPORTE PRODUCTOS SHELL FALTANTES ==="
      );
      observacionesOrganizadas.push(visitaData.reporteShellFaltante);
    }

    if (visitaData.reporteQualidFaltante) {
      observacionesOrganizadas.push("");
      observacionesOrganizadas.push(
        "=== REPORTE PRODUCTOS QUALID FALTANTES ==="
      );
      observacionesOrganizadas.push(visitaData.reporteQualidFaltante);
    }

    if (visitaData.reporteComentariosAdicionales) {
      observacionesOrganizadas.push("");
      observacionesOrganizadas.push("=== COMENTARIOS ADICIONALES ===");
      observacionesOrganizadas.push(visitaData.reporteComentariosAdicionales);
    }

    return {
      "Marca temporal": new Date().toLocaleString("es-ES"),
      "Dirección de correo electrónico":
        currentUser?.email || visitaData.correoMercaderista || "",
      "Rif del cliente:": cliente.rif,
      "Nombre del establecimiento:": cliente.nombre,
      "Desde que sucursal se realiza el registro":
        cliente.sede || currentUser?.sede || "No especificada",
      "Tipo de visita": visitaData.tipoVisita,
      Mercaderista:
        currentUser?.fullName || visitaData.mercaderista || "Usuario App",
      "Observaciones completas": observacionesOrganizadas.join("\n"),
      // Campos adicionales específicos
      "Marca trabajada": visitaData.marca || "No especificada",
      "Tiene señalización": visitaData.hasSignage === "Yes" ? "Sí" : "No",
      "Coordenadas GPS": visitaData.gpsCoordinates
        ? `${visitaData.gpsCoordinates.lat}, ${visitaData.gpsCoordinates.lng}`
        : "No capturadas",
    };
  }

  /**
   * 📊 Preparar datos básicos para Google Sheets (versión simple)
   */
  private prepareSheetData(
    visitaData: any,
    currentUser: any
  ): Record<string, any> {
    const cliente = visitaData.clienteData;

    return {
      "Marca temporal": new Date().toLocaleString("es-ES"),
      "Dirección de correo electrónico": currentUser?.email || "",
      "Rif del cliente:": cliente.rif,
      "Nombre del establecimiento:": cliente.nombre,
      "Desde que sucursal se realiza el registro":
        cliente.sede || currentUser?.sede || "No especificada",
      "Tipo de visita": visitaData.tipoVisita,
      Mercaderista:
        currentUser?.fullName || visitaData.mercaderista || "Usuario App",
      // Agregar más campos según sea necesario
      ...visitaData,
    };
  }

  /**
   * ✅ Marcar punto como completado
   */
  private async markPointAsCompleted(visitaData: any): Promise<void> {
    try {
      const cliente = visitaData.clienteData;
      let pointId = null;

      // Determinar el ID del punto
      if (cliente.isEvent && cliente.eventId) {
        pointId = cliente.eventId;
      } else if (cliente.id) {
        pointId = cliente.id;
      } else if (cliente.pointId) {
        pointId = cliente.pointId;
      }

      if (!pointId) {
        console.warn(
          "⚠️ [OfflineManager] No se encontró ID de punto para marcar como completado"
        );
        return;
      }

      // Actualizar en localStorage
      this.updateLocalStorageRoutes(pointId);

      // Actualizar en Firebase si hay conexión
      if ((await this.checkConnection()) && visitaData.mercaderistoId) {
        const visitDate = format(new Date(), "yyyy-MM-dd");
        await updateRoutePointStatus(
          visitaData.mercaderistoId,
          visitDate,
          pointId,
          "visitado",
          cliente.rif
        );
      }

      console.log(
        `✅ [OfflineManager] Punto ${pointId} marcado como completado`
      );
    } catch (error) {
      console.error(
        "❌ [OfflineManager] Error marcando punto como completado:",
        error
      );
    }
  }

  /**
   * 🔄 Actualizar rutas en localStorage
   */
  private updateLocalStorageRoutes(pointId: string): void {
    try {
      // Actualizar rutas regulares
      const todaysRoutesStr = localStorage.getItem("todaysRoutesOffline");
      if (todaysRoutesStr) {
        const todaysRoutes = JSON.parse(todaysRoutesStr);
        let updated = false;

        const updatedRoutes = todaysRoutes.map((route: any) => {
          if (route.points) {
            route.points = route.points.map((point: any) => {
              if (point.id === pointId) {
                point.estado = "visitado";
                updated = true;
              }
              return point;
            });
          }
          return route;
        });

        if (updated) {
          localStorage.setItem(
            "todaysRoutesOffline",
            JSON.stringify(updatedRoutes)
          );
        }
      }

      // Actualizar eventos
      const todaysEventsStr = localStorage.getItem("todaysEventsOffline");
      if (todaysEventsStr) {
        const todaysEvents = JSON.parse(todaysEventsStr);
        let updated = false;

        const updatedEvents = todaysEvents.map((evento: any) => {
          if (evento.id === pointId || `evento-${evento.id}` === pointId) {
            evento.estado = "visitado";
            updated = true;
          }
          return evento;
        });

        if (updated) {
          localStorage.setItem(
            "todaysEventsOffline",
            JSON.stringify(updatedEvents)
          );
          // Disparar evento para actualizar UI
          window.dispatchEvent(new Event("storage"));
        }
      }
    } catch (error) {
      console.error(
        "❌ [OfflineManager] Error actualizando localStorage:",
        error
      );
    }
  }

  /**
   * 🌐 Verificar conexión
   */
  private async checkConnection(): Promise<boolean> {
    if (!navigator.onLine) return false;

    try {
      const response = await fetch("https://www.google.com/favicon.ico", {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-cache",
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ⏰ Programar sincronización
   */
  private scheduleSync(): void {
    // Intentar sincronización inmediata si hay conexión
    if (navigator.onLine) {
      setTimeout(() => this.syncPendingVisitas(), 1000);
    }

    // Registrar para Background Sync si está disponible
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      navigator.serviceWorker.ready
        .then((registration) => {
          (registration as any).sync.register("sync-pending-visitas");
        })
        .catch((error) => {
          console.error(
            "❌ [OfflineManager] Error registrando Background Sync:",
            error
          );
        });
    }

    // Listener para cuando se recupere la conexión
    window.addEventListener("online", () => {
      console.log(
        "🌐 [OfflineManager] Conexión recuperada - iniciando sincronización"
      );
      this.syncPendingVisitas();
    });
  }

  /**
   * 📊 Suscribirse a actualizaciones de progreso
   */
  onProgress(callback: (progress: SyncProgress) => void): () => void {
    this.progressCallbacks.push(callback);

    // Retornar función para desuscribirse
    return () => {
      const index = this.progressCallbacks.indexOf(callback);
      if (index > -1) {
        this.progressCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 📢 Notificar progreso
   */
  private notifyProgress(progress: SyncProgress): void {
    this.progressCallbacks.forEach((callback) => {
      try {
        callback(progress);
      } catch (error) {
        console.error(
          "❌ [OfflineManager] Error en callback de progreso:",
          error
        );
      }
    });
  }

  /**
   * 🆔 Generar ID único para visita
   */
  private generateVisitaId(): string {
    return `visita_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 📊 Obtener estadísticas de sincronización
   */
  async getSyncStats(): Promise<{
    pending: number;
    synced: number;
    errors: number;
    lastSync?: Date;
  }> {
    try {
      let stats = {
        pending: 0,
        synced: 0,
        errors: 0,
        lastSync: undefined as Date | undefined,
      };

      // Obtener estadísticas de IndexedDB
      try {
        const allVisitas = await indexedDB.visitas.toArray();

        stats.pending += allVisitas.filter(
          (v: any) => v.syncStatus === "pending"
        ).length;
        stats.synced += allVisitas.filter(
          (v: any) => v.syncStatus === "synced"
        ).length;
        stats.errors += allVisitas.filter(
          (v: any) => v.syncStatus === "error"
        ).length;

        const lastSyncedVisita = allVisitas
          .filter((v: any) => v.syncStatus === "synced")
          .sort((a: any, b: any) => b.timestamp - a.timestamp)[0];

        if (lastSyncedVisita) {
          stats.lastSync = new Date(lastSyncedVisita.timestamp);
        }
      } catch (dbError) {
        console.warn(
          "⚠️ [OfflineManager] Error accediendo a IndexedDB para estadísticas:",
          dbError
        );
      }

      // Agregar estadísticas del fallback storage
      if (fallbackStorage.isAvailable()) {
        const fallbackStats = fallbackStorage.getStats();
        stats.pending += fallbackStats.pending;
        stats.synced += fallbackStats.synced;
      }

      return stats;
    } catch (error) {
      console.error(
        "❌ [OfflineManager] Error obteniendo estadísticas:",
        error
      );
      return { pending: 0, synced: 0, errors: 0 };
    }
  }

  /**
   * 🔍 Deduplicar visitas entre IndexedDB y fallback storage
   */
  private deduplicateVisitas(
    indexedDBVisitas: any[],
    fallbackVisitas: any[]
  ): {
    uniqueIndexedDB: any[];
    uniqueFallback: any[];
    duplicatesRemoved: number;
  } {
    console.log("🔍 [OfflineManager] Iniciando deduplicación de visitas...");

    let duplicatesRemoved = 0;
    const uniqueFallback: any[] = [];

    // Crear un Set de hashes únicos de las visitas de IndexedDB
    const indexedDBHashes = new Set(
      indexedDBVisitas.map((visita) => this.generateVisitaHash(visita.data))
    );

    // Filtrar fallback visitas, manteniendo solo las que no están en IndexedDB
    for (const fallbackVisita of fallbackVisitas) {
      const fallbackHash = this.generateVisitaHash(fallbackVisita.data);

      if (indexedDBHashes.has(fallbackHash)) {
        console.log(
          `🗑️ [OfflineManager] Duplicado encontrado y eliminado: ${fallbackHash.substring(0, 8)}...`
        );
        duplicatesRemoved++;

        // Marcar como sincronizada en fallback storage para limpiarlo
        if (fallbackStorage.isAvailable()) {
          fallbackStorage.markAsSynced(fallbackVisita.id);
        }
      } else {
        uniqueFallback.push(fallbackVisita);
      }
    }

    console.log(
      `✅ [OfflineManager] Deduplicación completada: ${duplicatesRemoved} duplicados eliminados`
    );

    return {
      uniqueIndexedDB: indexedDBVisitas, // IndexedDB tiene prioridad
      uniqueFallback,
      duplicatesRemoved,
    };
  }

  /**
   * 🔑 Generar hash único para una visita
   */
  private generateVisitaHash(data: any): string {
    // Crear un hash basado en campos únicos de la visita
    const hashData = {
      tipoVisita: data.tipoVisita,
      timestamp: data.timestamp,
      clienteRif: data.clienteData?.rif || data.rifCliente,
      mercaderista: data.mercaderista || data.correoMercaderista,
      // Para datos administrativos
      accion: data.accion,
      userId: data.userId,
      clienteId: data.clienteId,
      eventoId: data.eventoId,
    };

    // Generar hash simple pero efectivo
    const hashString = JSON.stringify(hashData);
    let hash = 0;
    for (let i = 0; i < hashString.length; i++) {
      const char = hashString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * 🔍 Verificar si los datos son administrativos
   */
  private isAdminData(data: any): boolean {
    return (
      data.tipoVisita?.includes("Admin -") ||
      data.accion !== undefined || // Existencia explícita de acción
      // Eliminado data.clienteData para evitar falsos positivos con visitas normales
      data.routeData !== undefined ||
      data.eventoData !== undefined ||
      data.userData !== undefined
    );
  }

  /**
   * 🔄 Sincronizar datos administrativos
   */
  private async syncAdminData(data: any): Promise<void> {
    console.log(
      "🔄 [OfflineManager] Sincronizando datos administrativos:",
      data.tipoVisita
    );

    const { getFirestoreClient } = await import("@/firebase/clientApp");
    const {
      collection,
      addDoc,
      updateDoc,
      doc,
      setDoc,
      query,
      where,
      getDocs,
    } = await import("firebase/firestore");

    try {
      if (data.tipoVisita?.includes("Admin - Gestión Cliente")) {
        // Sincronizar cliente
        if (data.accion === "crear") {
          // 🔍 Verificar si el cliente ya existe para evitar duplicados
          const existingClientQuery = query(
            collection(getFirestoreClient(), "clientes"),
            where("rif", "==", data.clienteData.rif)
          );
          const existingClients = await getDocs(existingClientQuery);

          if (existingClients.empty) {
            await addDoc(
              collection(getFirestoreClient(), "clientes"),
              data.clienteData
            );
            console.log(
              "✅ [OfflineManager] Cliente creado (no existía duplicado)"
            );
          } else {
            console.log(
              "⚠️ [OfflineManager] Cliente ya existe, omitiendo creación duplicada"
            );
          }
        } else if (data.accion === "actualizar" && data.clienteId) {
          await updateDoc(
            doc(getFirestoreClient(), "clientes", data.clienteId),
            {
              ...data.clienteData,
              updatedAt: new Date(),
            }
          );
        }
        console.log("✅ [OfflineManager] Cliente sincronizado");
      } else if (data.tipoVisita?.includes("Admin - Gestión Ruta")) {
        // Sincronizar ruta
        await addDoc(
          collection(getFirestoreClient(), "routes"),
          data.routeData
        );
        console.log("✅ [OfflineManager] Ruta sincronizada");
      } else if (data.tipoVisita?.includes("Admin - Gestión Evento")) {
        // Sincronizar evento
        if (data.accion === "crear") {
          await addDoc(
            collection(getFirestoreClient(), "eventos"),
            data.eventoData
          );
        } else if (data.accion === "actualizar" && data.eventoId) {
          await updateDoc(
            doc(getFirestoreClient(), "eventos", data.eventoId),
            data.eventoData
          );
        }
        console.log("✅ [OfflineManager] Evento sincronizado");
      } else if (data.tipoVisita?.includes("Admin - Gestión Usuario")) {
        // Sincronizar usuario
        if (data.accion === "crear") {
          // 🔍 Verificar si el usuario ya existe para evitar duplicados
          const existingUserQuery = query(
            collection(getFirestoreClient(), "users"),
            where("email", "==", data.userData.email)
          );
          const existingUsers = await getDocs(existingUserQuery);

          if (existingUsers.empty) {
            await setDoc(
              doc(getFirestoreClient(), "users", data.userId),
              data.userData
            );
            console.log(
              "✅ [OfflineManager] Usuario creado (no existía duplicado)"
            );
          } else {
            console.log(
              "⚠️ [OfflineManager] Usuario ya existe, omitiendo creación duplicada"
            );
          }
        } else if (data.accion === "actualizar" && data.userId) {
          await setDoc(
            doc(getFirestoreClient(), "users", data.userId),
            data.userData,
            { merge: true }
          );
          console.log("✅ [OfflineManager] Usuario actualizado");
        }
      } else {
        console.warn(
          "⚠️ [OfflineManager] Tipo de dato administrativo no reconocido:",
          data.tipoVisita
        );
      }
    } catch (error) {
      console.error(
        "❌ [OfflineManager] Error sincronizando datos administrativos:",
        error
      );
      throw error;
    }
  }

  /**
   * 🧹 Limpiar datos después del guardado exitoso
   */
  cleanupAfterSave(): void {
    try {
      // Limpiar localStorage
      localStorage.removeItem("clienteData");
      localStorage.removeItem("datosFormularioCompleto");
      localStorage.removeItem("tradeEventosData");
      localStorage.removeItem("tradeImpulsoData");
      localStorage.removeItem("merchandisingData");

      console.log("🧹 [OfflineManager] Datos temporales limpiados");
    } catch (error) {
      console.error("❌ [OfflineManager] Error limpiando datos:", error);
    }
  }

  /**
   * 🔧 MÉTODOS CONSOLIDADOS - Reemplazan funcionalidad de servicios eliminados
   */

  /**
   * 📊 Verificar si hay visitas pendientes
   * Reemplaza: syncService.hasPendingVisitas()
   */
  async hasPendingVisitas(): Promise<boolean> {
    try {
      const stats = await this.getSyncStats();
      return stats.pending > 0;
    } catch {
      return false;
    }
  }

  /**
   * 📈 Obtener estado del sistema offline
   * Reemplaza: robustOfflineInitializer.getStatus()
   */
  async getOfflineSystemStatus(): Promise<{
    indexedDB: boolean;
    localStorage: boolean;
    canSaveOffline: boolean;
  }> {
    try {
      const status = await this.getOfflineStatus();
      return {
        indexedDB: status.indexedDBAvailable,
        localStorage: status.localStorageAvailable,
        canSaveOffline:
          status.indexedDBAvailable || status.localStorageAvailable,
      };
    } catch (error) {
      console.error(
        "❌ [OfflineManager] Error obteniendo estado del sistema:",
        error
      );
      return {
        indexedDB: false,
        localStorage: fallbackStorage.isAvailable(),
        canSaveOffline: fallbackStorage.isAvailable(),
      };
    }
  }

  /**
   * 🧹 Limpiar todos los datos offline
   */
  async clearAllOfflineData(): Promise<void> {
    try {
      console.log("🧹 [OfflineManager] Limpiando todos los datos offline...");

      // Limpiar IndexedDB
      try {
        await indexedDB.visitas.clear();
        console.log("✅ [OfflineManager] IndexedDB limpiado");
      } catch (dbError) {
        console.warn("⚠️ [OfflineManager] Error limpiando IndexedDB:", dbError);
      }

      // Limpiar fallback storage
      if (fallbackStorage.isAvailable()) {
        fallbackStorage.clear();
        console.log("✅ [OfflineManager] Fallback storage limpiado");
      }

      // Limpiar datos temporales
      this.cleanupAfterSave();

      console.log("✅ [OfflineManager] Limpieza completa finalizada");
    } catch (error) {
      console.error("❌ [OfflineManager] Error durante limpieza:", error);
    }
  }

  /**
   * SISTEMA DE COLA CONSOLIDADO - Migrado de offlineQueue.ts
   */

  /**
   * 🆔 Generar UUID para operaciones
   */
  private generateUUID(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * ➕ Agregar operación a la cola
   */
  async queueOperation(
    op: Omit<
      QueueOperation,
      "id" | "status" | "retries" | "maxRetries" | "createdAt" | "updatedAt"
    >
  ): Promise<string> {
    const now = Date.now();
    const operation: QueueOperation = {
      id: this.generateUUID("op"),
      type: op.type,
      payload: op.payload,
      dependencies: op.dependencies || [],
      status: "pending",
      retries: 0,
      maxRetries: 5,
      lastError: undefined,
      idempotencyKey: op.idempotencyKey || this.generateUUID("idem"),
      createdAt: now,
      updatedAt: now,
      draftId: op.draftId,
    };

    return (
      (await databaseRecovery.executeWithRecovery(async () => {
        await indexedDB.pendingOps.put(operation);
        console.log(
          `✅ [OfflineManager] Operación encolada: ${operation.type} (${operation.id})`
        );
        return operation.id;
      })) || operation.id
    );
  }

  /**
   * 📤 Encolar subida de imagen
   */
  async queueUploadImage(params: {
    draftId: string;
    fieldKey: string;
    base64: string;
    storagePath: string;
  }): Promise<string> {
    const { draftId, fieldKey, base64, storagePath } = params;
    return this.queueOperation({
      type: "uploadImage",
      payload: { draftId, fieldKey, base64, storagePath },
      dependencies: [],
      draftId,
      idempotencyKey: `${draftId}:${fieldKey}`,
    });
  }

  /**
   * 📝 Encolar creación de visita
   */
  async queueCreateVisita(params: {
    draftId: string;
    collection: string;
    data: any;
  }): Promise<string> {
    const { draftId, collection: coll, data } = params;
    return this.queueOperation({
      type: "createVisita",
      payload: { coll, data },
      dependencies: [],
      draftId,
      idempotencyKey: `${draftId}:createVisita`,
    });
  }

  /**
   * 🌐 Encolar webhook N8N
   */
  async queueWebhookN8N(params: {
    draftId: string;
    url: string;
    body: any;
  }): Promise<string> {
    const { draftId, url, body } = params;
    return this.queueOperation({
      type: "webhook",
      payload: { url, body },
      dependencies: [],
      draftId,
      idempotencyKey: `${draftId}:webhook`,
    });
  }

  /**
   * ⚙️ Procesar cola de operaciones
   */
  async processOperationQueue(): Promise<{
    processed: number;
    errors: number;
  }> {
    return (
      (await databaseRecovery.executeWithRecovery(async () => {
        console.log("🔄 [OfflineManager] Procesando cola de operaciones...");

        const pending = await indexedDB.pendingOps
          .where("status")
          .equals("pending")
          .sortBy("createdAt");

        let processed = 0;
        let errors = 0;

        for (const op of pending) {
          try {
            await indexedDB.pendingOps.update(op.id, {
              status: "processing",
              updatedAt: Date.now(),
            });

            switch (op.type) {
              case "uploadImage": {
                const { draftId, fieldKey, base64, storagePath } =
                  op.payload || {};
                const { uploadImageToStorage, generateFileName } =
                  await import("@/services/images");
                const fileName = generateFileName(`${draftId}_${fieldKey}`);
                const url = await uploadImageToStorage(
                  base64,
                  storagePath,
                  fileName
                );

                // Guardar URL vinculada al draft
                await indexedDB.images.put({
                  id: this.generateUUID("img"),
                  draftId,
                  fieldKey,
                  blob: new Blob(),
                  base64,
                  filename: fileName,
                  size: base64?.length || 0,
                  type: "image/jpeg",
                  compressed: true,
                  uploadedUrl: url,
                  createdAt: Date.now(),
                } as any);

                await indexedDB.pendingOps.update(op.id, {
                  status: "completed",
                  updatedAt: Date.now(),
                });
                processed++;
                break;
              }
              case "createVisita": {
                const { coll, data } = op.payload || {};
                const { getFirestoreClient } =
                  await import("@/firebase/clientApp");
                const { collection, addDoc } =
                  await import("firebase/firestore");
                const fs = getFirestoreClient();
                await addDoc(collection(fs, coll), data);

                await indexedDB.pendingOps.update(op.id, {
                  status: "completed",
                  updatedAt: Date.now(),
                });
                processed++;
                break;
              }
              case "updateCliente": {
                const { path, data } = op.payload || {};
                const { getFirestoreClient } =
                  await import("@/firebase/clientApp");
                const { doc, updateDoc } = await import("firebase/firestore");
                const fs = getFirestoreClient();
                await updateDoc(doc(fs, path), data);

                await indexedDB.pendingOps.update(op.id, {
                  status: "completed",
                  updatedAt: Date.now(),
                });
                processed++;
                break;
              }
              case "updateRoute": {
                const { path, data } = op.payload || {};
                const { getFirestoreClient } =
                  await import("@/firebase/clientApp");
                const { doc, updateDoc } = await import("firebase/firestore");
                const fs = getFirestoreClient();
                await updateDoc(doc(fs, path), data);

                await indexedDB.pendingOps.update(op.id, {
                  status: "completed",
                  updatedAt: Date.now(),
                });
                processed++;
                break;
              }
              case "webhook": {
                const { url, body } = op.payload || {};
                await fetch(url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                });

                await indexedDB.pendingOps.update(op.id, {
                  status: "completed",
                  updatedAt: Date.now(),
                });
                processed++;
                break;
              }
              default: {
                await indexedDB.pendingOps.update(op.id, {
                  status: "failed",
                  updatedAt: Date.now(),
                  lastError: "Tipo no soportado",
                });
                errors++;
              }
            }
          } catch (e: any) {
            const retries = (op.retries || 0) + 1;
            const failed = retries >= (op.maxRetries || 5);

            await indexedDB.pendingOps.update(op.id, {
              status: failed ? "failed" : "pending",
              retries,
              lastError: e?.message || String(e),
              updatedAt: Date.now(),
            });

            if (failed) {
              console.error(
                `❌ [OfflineManager] Operación ${op.id} falló después de ${retries} intentos:`,
                e
              );
              errors++;
            } else {
              console.warn(
                `⚠️ [OfflineManager] Operación ${op.id} falló, reintentando (${retries}/${op.maxRetries}):`,
                e
              );
            }
          }
        }

        console.log(
          `✅ [OfflineManager] Cola procesada: ${processed} exitosas, ${errors} errores`
        );
        return { processed, errors };
      })) || { processed: 0, errors: 1 }
    );
  }

  /**
   * ========================================================================
   * MÉTODOS DE COMPATIBILIDAD CON offlineService
   * ========================================================================
   */

  /**
   * 📦 Almacena rutas del mercaderista para uso offline
   */
  async storeRoutes(routes: Route[]): Promise<void> {
    try {
      console.log(`💾 [OfflineManager] Almacenando ${routes.length} rutas...`);

      if (routes.length === 0) {
        console.log("ℹ️ [OfflineManager] No hay rutas para almacenar");
        return;
      }

      const offlineRoutes: OfflineRoute[] = routes.map((route) => ({
        ...route,
        downloadedAt: Date.now(),
        lastSyncedAt: Date.now(),
      }));

      for (const route of offlineRoutes) {
        await indexedDB.offlineRoutes.put(route as any);
      }

      console.log(`✅ [OfflineManager] ${routes.length} rutas almacenadas`);
    } catch (error) {
      console.error("❌ [OfflineManager] Error almacenando rutas:", error);
      throw error;
    }
  }

  /**
   * 📱 Obtiene rutas del mercaderista desde almacenamiento local
   */
  async getOfflineRoutes(mercaderistoId: string): Promise<OfflineRoute[]> {
    try {
      console.log(
        `📱 [OfflineManager] Buscando rutas para mercaderista: ${mercaderistoId}`
      );

      const routes = await indexedDB.offlineRoutes
        .where("mercaderistoId")
        .equals(mercaderistoId)
        .toArray();

      console.log(`📱 [OfflineManager] ${routes.length} rutas encontradas`);
      return routes as unknown as OfflineRoute[];
    } catch (error) {
      console.error("❌ [OfflineManager] Error obteniendo rutas:", error);
      return [];
    }
  }

  /**
   * 🔄 Actualiza el status de una ruta en IndexedDB
   */
  async updateOfflineRouteStatus(
    routeId: string,
    newStatus: Route["status"]
  ): Promise<void> {
    try {
      const route = await indexedDB.offlineRoutes.get(routeId);
      if (!route) {
        console.warn(`⚠️ [OfflineManager] Ruta ${routeId} no encontrada`);
        return;
      }

      await indexedDB.offlineRoutes.update(routeId, {
        status: newStatus,
        lastSyncedAt: Date.now(),
      });

      console.log(
        `✅ [OfflineManager] Ruta ${routeId} actualizada a ${newStatus}`
      );
    } catch (error) {
      console.warn(
        "[OfflineManager] No se pudo actualizar status de ruta:",
        error
      );
    }
  }

  /**
   * 📦 Almacena clientes para uso offline
   */
  async storeClientes(clientes: Cliente[]): Promise<void> {
    try {
      const offlineClientes: OfflineCliente[] = clientes.map((cliente) => ({
        ...cliente,
        downloadedAt: Date.now(),
        lastSyncedAt: Date.now(),
      }));

      for (const cliente of offlineClientes) {
        await indexedDB.clientSnapshots.put(cliente as any);
      }

      console.log(
        `✅ [OfflineManager] ${clientes.length} clientes almacenados`
      );
    } catch (error) {
      console.error("❌ [OfflineManager] Error almacenando clientes:", error);
      throw error;
    }
  }

  /**
   * 🔍 Obtiene cliente específico desde almacenamiento local
   */
  async getOfflineCliente(clienteId: string): Promise<OfflineCliente | null> {
    try {
      const cliente = await indexedDB.clientSnapshots.get(clienteId);
      return (cliente as unknown as OfflineCliente) || null;
    } catch (error) {
      console.error("❌ [OfflineManager] Error obteniendo cliente:", error);
      return null;
    }
  }

  /**
   * 📍 Valida si el usuario está cerca de un punto de la ruta (GPS offline)
   */
  async validateProximity(
    currentLocation: { lat: number; lng: number },
    pointId: string,
    routeId: string,
    toleranceMeters: number = 500
  ): Promise<{ isValid: boolean; distance?: number; point?: RoutePoint }> {
    try {
      const route = await indexedDB.offlineRoutes.get(routeId);
      if (!route) {
        return { isValid: false };
      }

      const point = route.points.find((p) => p.id === pointId);
      if (!point) {
        return { isValid: false };
      }

      const distance = this.calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        (point as any).position.lat,
        (point as any).position.lng
      );

      const isValid = distance <= toleranceMeters;

      console.log(
        `📍 [OfflineManager] Validación GPS: ${isValid ? "✅" : "❌"} (${distance.toFixed(0)}m)`
      );

      return { isValid, distance, point: point as unknown as RoutePoint };
    } catch (error) {
      console.error("❌ [OfflineManager] Error en validación GPS:", error);
      return { isValid: false };
    }
  }

  /**
   * 📐 Calcula la distancia entre dos puntos GPS (Haversine)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distancia en metros
  }

  /**
   * 🔧 Función de debugging para diagnosticar problemas offline
   */
  async debugOfflineData(mercaderistoId: string): Promise<{
    dbInitialized: boolean;
    totalRoutes: number;
    todayRoutes: number;
    mercaderistaRoutes: number;
    routeDetails: Array<{
      id: string;
      date: string;
      status: Route["status"];
      pointsCount: number;
      downloadedAt: string;
      lastSyncedAt: string;
    }>;
    indexedDBError?: string;
  }> {
    const debug = {
      dbInitialized: true,
      totalRoutes: 0,
      todayRoutes: 0,
      mercaderistaRoutes: 0,
      routeDetails: [] as Array<{
        id: string;
        date: string;
        status: Route["status"];
        pointsCount: number;
        downloadedAt: string;
        lastSyncedAt: string;
      }>,
      indexedDBError: undefined as string | undefined,
    };

    try {
      console.log(
        `🔧 [OfflineManager] Debugging para mercaderista: ${mercaderistoId}`
      );

      const allRoutes = await indexedDB.offlineRoutes.toArray();
      debug.totalRoutes = allRoutes.length;

      const mercaderistaRoutes = allRoutes.filter(
        (route: any) => route.mercaderistoId === mercaderistoId
      );
      debug.mercaderistaRoutes = mercaderistaRoutes.length;

      const today = new Date().toISOString().split("T")[0];
      const todayRoutes = mercaderistaRoutes.filter(
        (route: any) => route.date === today
      );
      debug.todayRoutes = todayRoutes.length;

      debug.routeDetails = mercaderistaRoutes.map((route: any) => ({
        id: route.id,
        date: route.date,
        status: route.status,
        pointsCount: route.points?.length || 0,
        downloadedAt: new Date(route.downloadedAt).toLocaleString(),
        lastSyncedAt: route.lastSyncedAt
          ? new Date(route.lastSyncedAt).toLocaleString()
          : "N/A",
      }));

      console.log("🔧 [OfflineManager] Debug info:", debug);
      return debug;
    } catch (error) {
      debug.indexedDBError =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("❌ [OfflineManager] Error en debugging:", error);
      return debug;
    }
  }

  /**
   * 🧹 Limpia todos los datos offline (logout o reset)
   */
  async clearOfflineData(): Promise<void> {
    try {
      await Promise.all([
        indexedDB.visitDrafts.clear(),
        indexedDB.pendingOps.clear(),
        indexedDB.images.clear(),
        indexedDB.offlineRoutes.clear(),
        indexedDB.clientSnapshots.clear(),
        indexedDB.visitas.clear(),
      ]);

      console.log("🧹 [OfflineManager] Datos offline limpiados completamente");
    } catch (error) {
      console.error(
        "❌ [OfflineManager] Error limpiando datos offline:",
        error
      );
      throw error;
    }
  }

  /**
   * ✅ Verifica si el usuario debe usar modo offline-first
   */
  shouldUseOfflineMode(user: UserData): boolean {
    return user.role === "Mercaderista";
  }

  /**
   * 📋 Cola una visita para sincronización (compatibilidad con offlineService)
   */
  async queueVisitaForSync(
    visita: Omit<OfflineVisita, "id" | "status" | "syncAttempts">
  ): Promise<string> {
    const visitaCompleta: OfflineVisita = {
      ...visita,
      id: `visita_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: "pending",
      syncAttempts: 0,
    };

    // Guardar usando la estructura de Dexie
    await indexedDB.visitas.add({
      id: visitaCompleta.id,
      visitaId: visitaCompleta.id,
      clienteRif: visitaCompleta.clienteId || "unknown",
      data: visitaCompleta.formData,
      fotos: {},
      timestamp: visitaCompleta.timestamp,
      syncStatus: "pending",
    });

    console.log(`✅ [OfflineManager] Visita ${visitaCompleta.id} encolada`);
    return visitaCompleta.id;
  }

  /**
   * 🔄 Actualiza el estado de una visita en la cola (compatibilidad)
   */
  async updateVisitaSyncStatus(
    visitaId: string,
    status: OfflineVisita["status"],
    errorMessage?: string
  ): Promise<void> {
    try {
      const updates: any = {
        syncStatus: status,
      };

      if (errorMessage) {
        updates.lastError = errorMessage;
      }

      await indexedDB.visitas.update(visitaId, updates);
      console.log(
        `✅ [OfflineManager] Visita ${visitaId} actualizada a ${status}`
      );
    } catch (error) {
      console.error("❌ [OfflineManager] Error actualizando visita:", error);
    }
  }

  /**
   * 🗑️ Elimina una visita ya sincronizada (compatibilidad)
   */
  async removeSyncedVisita(visitaId: string): Promise<void> {
    try {
      await indexedDB.visitas.delete(visitaId);
      console.log(`✅ [OfflineManager] Visita ${visitaId} eliminada tras sync`);
    } catch (error) {
      console.error("❌ [OfflineManager] Error eliminando visita:", error);
    }
  }

  /**
   * 📊 Inicializa IndexedDB (compatibilidad con offlineService)
   */
  async initDB(): Promise<void> {
    // Dexie se auto-inicializa, este método es solo para compatibilidad
    console.log("✅ [OfflineManager] IndexedDB ya inicializada (Dexie)");
  }

  /**
   * ========================================================================
   * MÓDULO DE INICIALIZACIÓN ROBUSTA (CONSOLIDADO)
   * Funcionalidades de offlineInitializer.ts y robustOfflineInit.ts
   * ========================================================================
   */

  /**
   * 🚀 Inicializa el sistema offline completo de forma robusta
   * Aplica SRP: Coordina la inicialización pero delega a métodos específicos
   */
  async initializeOfflineSystem(): Promise<InitResult> {
    const result: InitResult = {
      success: false,
      indexedDBAvailable: false,
      fallbackAvailable: false,
      errors: [],
    };

    try {
      console.log("🚀 [OfflineManager] Iniciando sistema offline robusto...");

      // 1. Verificar fallback storage (localStorage)
      result.fallbackAvailable = this.checkFallbackAvailability();

      // 2. Inicializar IndexedDB con reintentos automáticos
      result.indexedDBAvailable = await this.initializeIndexedDBWithRetries();

      // 3. Determinar éxito general
      result.success = result.indexedDBAvailable || result.fallbackAvailable;

      if (result.success) {
        this.isInitialized = true;
        console.log(
          `✅ [OfflineManager] Sistema inicializado - IndexedDB: ${result.indexedDBAvailable}, Fallback: ${result.fallbackAvailable}`
        );
      } else {
        result.errors.push("Todos los sistemas de almacenamiento fallaron");
        console.error("❌ [OfflineManager] Falló inicialización completa");
      }

      return result;
    } catch (error) {
      console.error(
        "❌ [OfflineManager] Error fatal en inicialización:",
        error
      );
      result.errors.push(
        error instanceof Error ? error.message : "Error desconocido"
      );
      return result;
    }
  }

  /**
   * Verifica disponibilidad de fallback storage
   * Aplica SRP: Solo verifica, no modifica estado
   */
  private checkFallbackAvailability(): boolean {
    const available =
      typeof window !== "undefined" && fallbackStorage.isAvailable();

    if (available) {
      console.log("✅ [OfflineManager] Fallback storage disponible");
    } else {
      console.warn("⚠️ [OfflineManager] Fallback storage no disponible");
    }

    return available;
  }

  /**
   * Inicializa IndexedDB con reintentos automáticos
   * Aplica Clean Code: Función enfocada, lógica clara
   */
  private async initializeIndexedDBWithRetries(): Promise<boolean> {
    for (let attempt = 1; attempt <= INIT_CONFIG.MAX_RETRIES; attempt++) {
      console.log(
        `🔄 [OfflineManager] Intento ${attempt}/${INIT_CONFIG.MAX_RETRIES} de inicialización`
      );

      try {
        const success = await this.attemptIndexedDBInit();
        if (success) {
          console.log("✅ [OfflineManager] IndexedDB inicializado");
          return true;
        }
      } catch (error) {
        console.warn(`⚠️ [OfflineManager] Intento ${attempt} falló:`, error);

        if (error instanceof Error && this.isVersionError(error)) {
          console.log("🔄 [OfflineManager] Error de versión, limpiando...");
          await this.cleanupVersionConflicts();
        }
      }

      // Delay antes del siguiente intento (exponential backoff)
      if (attempt < INIT_CONFIG.MAX_RETRIES) {
        await this.delay(INIT_CONFIG.RETRY_DELAY_MS * attempt);
      }
    }

    console.warn("⚠️ [OfflineManager] IndexedDB no disponible tras reintentos");
    return false;
  }

  /**
   * Intenta inicializar IndexedDB
   * Aplica SRP: Solo inicializa, no maneja reintentos
   */
  private async attemptIndexedDBInit(): Promise<boolean> {
    const { initializeOfflineDB } = await import("@/lib/indexedDB");
    return await initializeOfflineDB();
  }

  /**
   * Verifica si un error es de versión de DB
   * Aplica Clean Code: Nombre descriptivo, lógica clara
   */
  private isVersionError(error: Error): boolean {
    return INIT_CONFIG.VERSION_ERROR_NAMES.some(
      (name) => error.name === name || error.message.includes(name)
    );
  }

  /**
   * Limpia conflictos de versión de IndexedDB
   * Aplica DRY: Centraliza lógica de limpieza
   */
  private async cleanupVersionConflicts(): Promise<void> {
    try {
      console.log("🗑️ [OfflineManager] Limpiando conflictos...");

      const Dexie = (await import("dexie")).default;

      // Eliminar bases de datos conflictivas
      for (const dbName of INIT_CONFIG.DB_NAMES_TO_CLEANUP) {
        try {
          await Dexie.delete(dbName);
          console.log(`🗑️ [OfflineManager] Eliminada: ${dbName}`);
        } catch {
          // DB puede no existir, continuar
        }
      }

      // Limpiar localStorage relacionado
      if (typeof window !== "undefined" && fallbackStorage.isAvailable()) {
        this.cleanupOfflineLocalStorage();
      }

      await this.delay(500); // Asegurar que limpieza se complete
      console.log("✅ [OfflineManager] Limpieza completada");
    } catch (error) {
      console.warn("⚠️ [OfflineManager] Error en limpieza:", error);
    }
  }

  /**
   * Limpia keys de localStorage relacionadas con offline
   * Aplica SRP: Solo limpia localStorage
   */
  private cleanupOfflineLocalStorage(): void {
    const keysToRemove = Object.keys(localStorage).filter(
      (key) =>
        key.includes("indexeddb") ||
        key.includes("offline") ||
        key.includes("migration")
    );

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
      console.log(`🗑️ [OfflineManager] localStorage limpiado: ${key}`);
    });
  }

  /**
   * Delay helper para reintentos
   * Aplica Clean Code: Función pequeña y reutilizable
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * ========================================================================
   * MÓDULO DE AUTO-SYNC Y CONECTIVIDAD
   * ========================================================================
   */

  /**
   * Configura listeners de conectividad
   * Aplica OCP: Extensible sin modificar código existente
   */
  setupConnectivityListeners(): () => void {
    if (typeof window === "undefined") {
      return () => {}; // No-op en servidor
    }

    const handleOnline = () => {
      console.log("🌐 [OfflineManager] Conexión restaurada");
      this.triggerAutoSync();
    };

    const handleOffline = () => {
      console.log("📱 [OfflineManager] Modo offline activado");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Retornar función de cleanup
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }

  /**
   * Configura sincronización automática
   * Aplica SRP: Solo setup, no ejecuta sync
   */
  setupAutoSync(): () => void {
    if (typeof window === "undefined") {
      return () => {}; // No-op en servidor
    }

    // Auto-sync cada 5 minutos si hay conexión
    this.autoSyncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.triggerAutoSync();
      }
    }, SYNC_CONFIG.AUTO_SYNC_INTERVAL_MS);

    // Sync al ganar foco
    const handleFocus = () => {
      if (navigator.onLine) {
        this.triggerAutoSync();
      }
    };

    window.addEventListener("focus", handleFocus);

    // Retornar función de cleanup
    return () => {
      if (this.autoSyncInterval) {
        clearInterval(this.autoSyncInterval);
        this.autoSyncInterval = null;
      }
      window.removeEventListener("focus", handleFocus);
    };
  }

  /**
   * Activa sincronización automática con throttling
   * Aplica Clean Code: Lógica de throttling clara y explícita
   */
  private async triggerAutoSync(): Promise<void> {
    const now = Date.now();

    // Evitar sync simultáneas
    if (this.autoSyncInProgress) {
      console.log("⏭️ [OfflineManager] Auto-sync omitida (en progreso)");
      return;
    }

    // Throttling: evitar syncs muy frecuentes
    if (now - this.lastAutoSyncTime < SYNC_CONFIG.MIN_SYNC_INTERVAL_MS) {
      console.log("⏭️ [OfflineManager] Auto-sync omitida (throttling)");
      return;
    }

    try {
      this.autoSyncInProgress = true;
      this.lastAutoSyncTime = now;

      console.log("🔄 [OfflineManager] Auto-sync iniciada");
      const result = await this.forceSync();
      console.log(
        `✅ [OfflineManager] Auto-sync completada: ${result.processed} procesadas, ${result.errors} errores`
      );
    } catch (error) {
      console.error("❌ [OfflineManager] Error en auto-sync:", error);
    } finally {
      this.autoSyncInProgress = false;
    }
  }

  /**
   * Fuerza sincronización inmediata (sin throttling)
   * Aplica ISP: Interface para force sync separada de auto-sync
   */
  async forceSync(): Promise<{ processed: number; errors: number }> {
    try {
      console.log("🔄 [OfflineManager] Force sync iniciada");

      // Sincronizar visitas pendientes
      await this.syncPendingVisitas();

      // Procesar cola de operaciones
      const result = await this.processOperationQueue();

      console.log(`✅ [OfflineManager] Force sync completada`);
      return result;
    } catch (error) {
      console.error("❌ [OfflineManager] Error en force sync:", error);
      return { processed: 0, errors: 1 };
    }
  }

  /**
   * Obtiene estado de servicios offline
   * Aplica SRP: Solo consulta, no modifica
   */
  async getOfflineStatus(): Promise<{
    isInitialized: boolean;
    indexedDBAvailable: boolean;
    localStorageAvailable: boolean;
    isOnline: boolean;
  }> {
    return {
      isInitialized: this.isInitialized,
      indexedDBAvailable: await this.testIndexedDBAvailability(),
      localStorageAvailable: fallbackStorage.isAvailable(),
      isOnline: typeof window !== "undefined" ? navigator.onLine : false,
    };
  }

  /**
   * Prueba si IndexedDB está disponible
   * Aplica Clean Code: Test aislado, no afecta estado
   */
  private async testIndexedDBAvailability(): Promise<boolean> {
    try {
      const Dexie = (await import("dexie")).default;
      const testDB = new Dexie("OfflineManagerTestDB");
      testDB.version(1).stores({ test: "id" });
      await testDB.open();
      await testDB.close();
      await Dexie.delete("OfflineManagerTestDB");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ========================================================================
   * MÓDULO DE GESTIÓN DE DATOS OFFLINE (CONSOLIDADO)
   * Funcionalidades de offlineDataManager.ts
   * ========================================================================
   */

  /**
   * Verifica si el mercaderista necesita descargar datos
   * Aplica SRP: Solo verifica necesidad, no descarga
   */
  async shouldDownloadData(user: UserData): Promise<{
    needsDownload: boolean;
    reason: string;
    hasExistingData: boolean;
  }> {
    try {
      // Solo mercaderistas necesitan datos offline
      if (user.role !== "Mercaderista") {
        return {
          needsDownload: false,
          reason: "Usuario no es mercaderista",
          hasExistingData: false,
        };
      }

      // Verificar datos existentes
      const routes = await indexedDB.offlineRoutes
        .where("userId")
        .equals(user.uid)
        .toArray();

      const clients = await indexedDB.clientSnapshots.count();
      const hasData = routes.length > 0 || clients > 0;

      if (!hasData) {
        return {
          needsDownload: true,
          reason: "No hay datos offline disponibles",
          hasExistingData: false,
        };
      }

      // Verificar antigüedad (>24h = desactualizado)
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
      console.error("❌ [OfflineManager] Error verificando datos:", error);
      return {
        needsDownload: true,
        reason: "Error verificando datos existentes",
        hasExistingData: false,
      };
    }
  }

  /**
   * Descarga datos forzadamente (sin verificar)
   * Aplica Clean Code: Función enfocada en descarga
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
      onProgress?.({
        step: "init",
        percentage: 10,
        message: "Preparando descarga...",
      });

      // Importar dinámicamente para evitar dependencias circulares
      const { dataPreloadService } =
        await import("@/services/dataPreloadService");

      onProgress?.({
        step: "download",
        percentage: 50,
        message: "Descargando rutas y clientes...",
      });

      const result = await dataPreloadService.preloadDataForMercaderista(user);

      onProgress?.({
        step: "complete",
        percentage: 100,
        message: "Descarga completada",
      });

      if (result.success) {
        console.log("✅ [OfflineManager] Datos descargados");
        return { success: true };
      } else {
        console.error("❌ [OfflineManager] Error en descarga:", result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("❌ [OfflineManager] Error forzando descarga:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  }

  /**
   * Descarga datos solo si es necesario
   * Aplica DIP: Depende de abstracción (shouldDownloadData)
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
        console.log(`ℹ️ [OfflineManager] No necesario: ${check.reason}`);
        return { success: true, downloaded: false };
      }

      console.log(`⬇️ [OfflineManager] Iniciando descarga: ${check.reason}`);
      const result = await this.forceDownloadData(user, onProgress);

      return {
        success: result.success,
        downloaded: result.success,
        error: result.error,
      };
    } catch (error) {
      console.error("❌ [OfflineManager] Error en descarga:", error);
      return {
        success: false,
        downloaded: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  }

  /**
   * Obtiene estadísticas de datos offline
   * Aplica Clean Code: Función pequeña, retorno claro
   */
  async getDataStats(user: UserData): Promise<{
    routesCount: number;
    clientsCount: number;
    draftsCount: number;
    pendingOpsCount: number;
    lastSync?: Date;
  }> {
    try {
      const routes = await indexedDB.offlineRoutes
        .where("userId")
        .equals(user.uid)
        .count();

      const clients = await indexedDB.clientSnapshots.count();
      const drafts = await indexedDB.visitDrafts.count();
      const pendingOps = await indexedDB.pendingOps
        .where("status")
        .anyOf(["pending", "processing"])
        .count();

      // Buscar última sincronización
      const latestRoute = await indexedDB.offlineRoutes
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
      console.error("❌ [OfflineManager] Error obteniendo stats:", error);
      return {
        routesCount: 0,
        clientsCount: 0,
        draftsCount: 0,
        pendingOpsCount: 0,
      };
    }
  }
}

// Exportar instancia singleton
export const offlineManager = new OfflineManager();

export default offlineManager;
