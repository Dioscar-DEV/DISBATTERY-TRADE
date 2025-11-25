/**
 * 🚀 SERVICIO UNIFICADO DE GESTIÓN OFFLINE - VERSIÓN CONSOLIDADA
 *
 * Este servicio centraliza TODA la lógica offline de la aplicación:
 * - Guardado offline/online unificado
 * - Sincronización automática robusta
 * - Manejo de IndexedDB + fallback a localStorage
 * - Eliminación de servicios duplicados
 * - Sistema de cola unificado
 *
 * REEMPLAZA A:
 * - syncService.ts (eliminado)
 * - sync.ts (eliminado)
 * - Lógica duplicada en offlineService.ts
 */

import { db } from "@/db/database";
import { crearVisita } from "./visitas";
import { uploadMultipleImages } from "./images";
import { getCurrentUser, getUserFromStorage } from "./auth";
import { updateRoutePointStatus } from "./routes";
import { format } from "date-fns";
import { fallbackStorage } from "@/services/fallbackStorage";
import { robustOfflineInitializer } from "@/services/robustOfflineInit";
import { databaseRecovery } from "@/services/databaseRecovery";
import { db as indexedDB } from "@/lib/indexedDB";

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

class OfflineManager {
  private syncInProgress = false;
  private progressCallbacks: ((progress: SyncProgress) => void)[] = [];

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
        await db.visitas.add({
          visitaId: visitaId,
          clienteRif: visitaData.clienteData?.rif,
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

      // Marcar punto como completado inmediatamente
      await this.markPointAsCompleted(visitaData);

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

      // Marcar punto como completado
      await this.markPointAsCompleted(visitaData);

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
        pendingVisitas = await db.visitas
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
          await db.visitas.update(visita.id!, { syncStatus: "syncing" });

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
          await db.visitas.update(visita.id!, { syncStatus: "synced" });

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
          await db.visitas.update(visita.id!, {
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

    if (!visitaData.clienteData) {
      errors.push("Datos del cliente requeridos");
    }

    if (!visitaData.tipoVisita) {
      errors.push("Tipo de visita requerido");
    }

    if (!visitaData.clienteData?.rif) {
      errors.push("RIF del cliente requerido");
    }

    if (!visitaData.clienteData?.nombre) {
      errors.push("Nombre del cliente requerido");
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
        const allVisitas = await db.visitas.toArray();

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
      data.accion ||
      data.clienteData ||
      data.userData ||
      data.routeData ||
      data.eventoData
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
   * ⚡ Inicialización robusta del sistema offline
   * Reemplaza: robustOfflineInitializer.initialize()
   */
  async initializeOfflineSystem(): Promise<{
    success: boolean;
    indexedDBAvailable: boolean;
    fallbackAvailable: boolean;
    errors: string[];
  }> {
    console.log(
      "🚀 [OfflineManager] Inicializando sistema offline consolidado..."
    );

    const result = await robustOfflineInitializer.initialize();

    if (result.success) {
      console.log(
        `✅ [OfflineManager] Sistema offline inicializado - IndexedDB: ${result.indexedDBAvailable}, Fallback: ${result.fallbackAvailable}`
      );

      // Configurar listeners de conectividad
      this.setupConnectivityListeners();

      // Iniciar sincronización automática
      this.setupAutoSync();
    }

    return result;
  }

  /**
   * 🌐 Configurar listeners de conectividad
   */
  private setupConnectivityListeners(): void {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      console.log(
        "🌐 [OfflineManager] Conexión restaurada - iniciando sincronización"
      );
      this.syncPendingVisitas();
    };

    const handleOffline = () => {
      console.log(
        "📱 [OfflineManager] Conexión perdida - modo offline activado"
      );
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }

  /**
   * ⏰ Configurar sincronización automática
   */
  private setupAutoSync(): void {
    if (typeof window === "undefined") return;

    // Sincronización cada 5 minutos si hay conexión
    setInterval(
      () => {
        if (navigator.onLine && !this.syncInProgress) {
          console.log(
            "⏰ [OfflineManager] Sincronización automática programada"
          );
          this.syncPendingVisitas();
        }
      },
      5 * 60 * 1000
    ); // 5 minutos

    // Sincronización al ganar foco
    window.addEventListener("focus", () => {
      if (navigator.onLine && !this.syncInProgress) {
        console.log("👁️ [OfflineManager] Sincronización por foco de ventana");
        this.syncPendingVisitas();
      }
    });

    // Sincronización cuando la página se vuelve visible
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && navigator.onLine && !this.syncInProgress) {
        console.log("👀 [OfflineManager] Sincronización por visibilidad");
        this.syncPendingVisitas();
      }
    });

    // Sincronización inicial después de 10 segundos
    setTimeout(() => {
      if (navigator.onLine && !this.syncInProgress) {
        console.log("🚀 [OfflineManager] Sincronización inicial");
        this.syncPendingVisitas();
      }
    }, 10000);
  }

  /**
   * 🔄 Forzar sincronización inmediata
   * Reemplaza: syncService.forcSync()
   */
  async forceSync(): Promise<SyncResult> {
    console.log("🔄 [OfflineManager] Forzando sincronización inmediata...");

    if (this.syncInProgress) {
      console.log("⏭️ [OfflineManager] Sincronización ya en progreso");
      return { success: false, processed: 0, errors: 0 };
    }

    const isOnline = await this.checkConnection();
    if (!isOnline) {
      console.log("❌ [OfflineManager] Sin conexión - no se puede sincronizar");
      return { success: false, processed: 0, errors: 0 };
    }

    await this.syncPendingVisitas();

    const stats = await this.getSyncStats();
    return {
      success: stats.errors === 0,
      processed: stats.synced,
      errors: stats.errors,
    };
  }

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
      return await robustOfflineInitializer.getStatus();
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
        await db.visitas.clear();
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
                const { uploadImageToStorage, generateFileName } = await import(
                  "@/services/images"
                );
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
                const { getFirestoreClient } = await import(
                  "@/firebase/clientApp"
                );
                const { collection, addDoc } = await import(
                  "firebase/firestore"
                );
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
                const { getFirestoreClient } = await import(
                  "@/firebase/clientApp"
                );
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
                const { getFirestoreClient } = await import(
                  "@/firebase/clientApp"
                );
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
}

// Exportar instancia singleton
export const offlineManager = new OfflineManager();
export default offlineManager;
