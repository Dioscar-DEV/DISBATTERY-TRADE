/**
 * Servicio de sincronización para arquitectura offline-first
 * Maneja la subida de visitas pendientes a Firebase cuando hay conexión
 */

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestoreClient, getStorageClient } from "@/firebase/clientApp";
import { offlineService, OfflineVisita } from "./offlineService";
import { crearVisita } from "./visitas";
import { updateRoutePointStatus } from "./routes";
import { format } from "date-fns";

interface SyncResult {
  success: boolean;
  processed: number;
  errors: number;
  details: Array<{
    visitaId: string;
    success: boolean;
    error?: string;
  }>;
}

interface VisitaFirestoreData {
  routeId: string;
  pointId: string;
  clienteId: string;
  mercaderistoId: string;
  createdAt: Timestamp;
  gpsLocation: { lat: number; lng: number };
  tipoVisita: "Merchandising" | "Trade (Eventos)" | "Trade (Impulso)";
  marcaTrabajada?: "Shell" | "Qualid";
  formData: any;
  photoUrls: string[];
  isOfflineSync: boolean;
  direccionCorreo?: string;
  nombreMercaderista?: string;
  nombreCliente?: string;
  direccionCliente?: string;
}

class SyncService {
  private isSyncing = false;
  private syncInProgress = new Set<string>();

  /**
   * Verifica si hay conexión a internet
   */
  private async checkConnection(): Promise<boolean> {
    if (!navigator.onLine) return false;

    try {
      // Verificar conexión real con Firebase
      const firestore = getFirestoreClient();
      const testDoc = doc(firestore, "connectivity_test", "test");
      await getDoc(testDoc);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sincroniza todas las visitas pendientes
   */
  async syncPendingVisitas(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log("🔄 Sincronización ya en progreso, omitiendo...");
      return {
        success: false,
        processed: 0,
        errors: 0,
        details: [],
      };
    }

    console.log(
      "🚀 [SyncService] Iniciando sincronización de visitas pendientes..."
    );
    this.isSyncing = true;

    try {
      // Verificar conexión
      const hasConnection = await this.checkConnection();
      if (!hasConnection) {
        console.log("❌ [SyncService] Sin conexión, cancelando sincronización");
        return {
          success: false,
          processed: 0,
          errors: 0,
          details: [],
        };
      }

      // Obtener visitas pendientes
      const pendingVisitas = await offlineService.getPendingVisitas();
      console.log(
        `📊 [SyncService] ${pendingVisitas.length} visitas pendientes encontradas`
      );

      if (pendingVisitas.length === 0) {
        return {
          success: true,
          processed: 0,
          errors: 0,
          details: [],
        };
      }

      const results: SyncResult["details"] = [];
      let processed = 0;
      let errors = 0;

      // Procesar cada visita pendiente
      for (const visita of pendingVisitas) {
        if (this.syncInProgress.has(visita.id)) {
          console.log(
            `⏭️ [SyncService] Visita ${visita.id} ya en proceso, omitiendo...`
          );
          continue;
        }

        try {
          this.syncInProgress.add(visita.id);

          console.log(`🔄 [SyncService] Sincronizando visita ${visita.id}...`);

          // Marcar como en proceso de sincronización
          await offlineService.updateVisitaSyncStatus(visita.id, "syncing");

          // Sincronizar la visita individual
          const syncSuccess = await this.syncSingleVisita(visita);

          if (syncSuccess) {
            // Marcar como sincronizada y eliminar de cola
            await offlineService.removeSyncedVisita(visita.id);
            results.push({ visitaId: visita.id, success: true });
            processed++;
            console.log(
              `✅ [SyncService] Visita ${visita.id} sincronizada exitosamente`
            );
          } else {
            // Marcar como error
            await offlineService.updateVisitaSyncStatus(
              visita.id,
              "error",
              "Error durante la sincronización"
            );
            results.push({
              visitaId: visita.id,
              success: false,
              error: "Error durante la sincronización",
            });
            errors++;
          }
        } catch (error) {
          console.error(
            `❌ [SyncService] Error sincronizando visita ${visita.id}:`,
            error
          );

          const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
          await offlineService.updateVisitaSyncStatus(
            visita.id,
            "error",
            errorMessage
          );
          results.push({
            visitaId: visita.id,
            success: false,
            error: errorMessage,
          });
          errors++;
        } finally {
          this.syncInProgress.delete(visita.id);
        }
      }

      console.log(
        `📊 [SyncService] Sincronización completada: ${processed} exitosas, ${errors} errores`
      );

      return {
        success: errors === 0,
        processed,
        errors,
        details: results,
      };
    } catch (error) {
      console.error(
        "❌ [SyncService] Error general durante la sincronización:",
        error
      );
      return {
        success: false,
        processed: 0,
        errors: 1,
        details: [],
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sincroniza una visita individual
   */
  private async syncSingleVisita(visita: OfflineVisita): Promise<boolean> {
    try {
      console.log(
        `📤 [SyncService] Procesando visita para cliente ${visita.clienteId}`
      );

      // 1. Subir fotos a Firebase Storage
      const photoUrls = await this.uploadPhotos(visita.photos, visita.id);

      // 2. Obtener información adicional del mercaderista
      const mercaderistaInfo = await this.getMercaderistaInfo(
        visita.mercaderistoId
      );

      // 3. Obtener información del cliente
      const clienteInfo = await this.getClienteInfo(visita.clienteId);

      // 4. Preparar datos para Firestore
      const visitaData: VisitaFirestoreData = {
        routeId: visita.routeId,
        pointId: visita.pointId,
        clienteId: visita.clienteId,
        mercaderistoId: visita.mercaderistoId,
        createdAt: Timestamp.fromMillis(visita.timestamp),
        gpsLocation: visita.gpsLocation,
        tipoVisita: visita.tipoVisita,
        marcaTrabajada: visita.marcaTrabajada,
        formData: visita.formData,
        photoUrls,
        isOfflineSync: true, // Marcar que viene de sincronización offline
        direccionCorreo: mercaderistaInfo?.email,
        nombreMercaderista: mercaderistaInfo?.fullName,
        nombreCliente: clienteInfo?.nombre,
        direccionCliente: clienteInfo?.direccion,
      };

      // 5. Guardar en Firestore usando la función centralizada `crearVisita`
      // Construir payload compatible con CreateVisitaData
      const respuestasPayload: any = visita.formData || {};

      const datosN8N = {
        datosSheet: visita.formData || {},
        fotos: photoUrls,
      };

      const crearPayload = {
        rifCliente: clienteInfo?.rif || visita.clienteId,
        nombreEstablecimiento: clienteInfo?.nombre || visita.clienteId,
        tipoVisita: visita.tipoVisita,
        mercaderista: visita.mercaderistoId || mercaderistaInfo?.uid || "mercaderista-offline",
        correoMercaderista: mercaderistaInfo?.email || "",
        ubicacion: {
          lat: visita.gpsLocation?.lat || 0,
          lng: visita.gpsLocation?.lng || 0,
          direccion: clienteInfo?.direccion || "No disponible",
        },
        sucursal: clienteInfo?.sede || "DESCONOCIDA",
        respuestas: respuestasPayload,
        datosN8N,
      } as any;

      const createdId = await crearVisita(crearPayload);
      console.log(`✅ [SyncService] Visita creada con ID (crearVisita): ${createdId}`);

      // 6. Actualizar estado del punto en la ruta
      try {
        const visitDate = format(new Date(visita.timestamp), "yyyy-MM-dd");
        await updateRoutePointStatus(
          visita.mercaderistoId,
          visitDate,
          visita.pointId,
          "visitado",
          visita.clienteId
        );
        console.log(
          `✅ [SyncService] Estado del punto ${visita.pointId} actualizado a 'visitado'`
        );
      } catch (routeError) {
        console.warn(
          `⚠️ [SyncService] No se pudo actualizar estado de ruta:`,
          routeError
        );
        // No es crítico, la visita ya se guardó
      }

      console.log(
        `✅ [SyncService] Visita sincronizada y creada con ID ${createdId} con ${photoUrls.length} fotos`
      );
      return true;
    } catch (error) {
      console.error(
        `❌ [SyncService] Error sincronizando visita individual:`,
        error
      );
      return false;
    }
  }

  /**
   * Sube fotos a Firebase Storage
   */
  private async uploadPhotos(
    photos: File[],
    visitaId: string
  ): Promise<string[]> {
    const photoUrls: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      try {
        // Crear referencia única para la foto
        const fileName = `visitas/${visitaId}/photo_${i + 1}_${Date.now()}.jpg`;
        const photoRef = ref(getStorageClient(), fileName);

        // Subir archivo
        console.log(
          `📸 [SyncService] Subiendo foto ${i + 1}/${photos.length}...`
        );
        await uploadBytes(photoRef, photo);

        // Obtener URL de descarga
        const downloadURL = await getDownloadURL(photoRef);
        photoUrls.push(downloadURL);

        console.log(`✅ [SyncService] Foto ${i + 1} subida exitosamente`);
      } catch (error) {
        console.error(`❌ [SyncService] Error subiendo foto ${i + 1}:`, error);
        // Continuar con las demás fotos
      }
    }

    return photoUrls;
  }

  /**
   * Obtiene información del mercaderista desde localStorage o Firestore
   */
  private async getMercaderistaInfo(mercaderistoId: string): Promise<any> {
    try {
      // Primero intentar desde localStorage
      const currentUser = localStorage.getItem("currentUser");
      if (currentUser) {
        const userData = JSON.parse(currentUser);
        if (userData.uid === mercaderistoId) {
          return userData;
        }
      }

      // Si no está en localStorage, consultar Firestore
      const userDoc = await getDoc(
        doc(getFirestoreClient(), "users", mercaderistoId)
      );
      if (userDoc.exists()) {
        return userDoc.data();
      }

      return null;
    } catch (error) {
      console.error(
        `❌ Error obteniendo info del mercaderista ${mercaderistoId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Obtiene información del cliente desde datos offline o Firestore
   */
  private async getClienteInfo(clienteId: string): Promise<any> {
    try {
      // Primero intentar desde datos offline
      const offlineCliente = await offlineService.getOfflineCliente(clienteId);
      if (offlineCliente) {
        return offlineCliente;
      }

      // Si no está offline, consultar Firestore
      const clienteDoc = await getDoc(
        doc(getFirestoreClient(), "clientes", clienteId)
      );
      if (clienteDoc.exists()) {
        return clienteDoc.data();
      }

      return null;
    } catch (error) {
      console.error(
        `❌ Error obteniendo info del cliente ${clienteId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Determina la colección de Firestore según el tipo de visita
   */
  private getCollectionName(tipoVisita: string): string {
    switch (tipoVisita) {
      case "Merchandising":
        return "visitas_merchandising";
      case "Trade (Eventos)":
        return "visitas_trade_eventos";
      case "Trade (Impulso)":
        return "visitas_trade_impulso";
      default:
        return "visitas_general";
    }
  }

  /**
   * Obtiene estadísticas de sincronización
   */
  async getSyncStats(): Promise<{
    pendingCount: number;
    lastSyncAttempt?: Date;
    isSyncing: boolean;
  }> {
    try {
      const syncStatus = await offlineService.getSyncStatus();
      return {
        pendingCount: syncStatus.pendingVisitas,
        lastSyncAttempt: syncStatus.lastPartialSync
          ? new Date(syncStatus.lastPartialSync)
          : undefined,
        isSyncing: this.isSyncing,
      };
    } catch (error) {
      console.error("❌ Error obteniendo estadísticas de sync:", error);
      return {
        pendingCount: 0,
        isSyncing: this.isSyncing,
      };
    }
  }

  /**
   * Fuerza una sincronización inmediata
   */
  async forcSync(): Promise<SyncResult> {
    console.log("🔄 [SyncService] Forzando sincronización inmediata...");
    return await this.syncPendingVisitas();
  }

  /**
   * Verifica si hay visitas pendientes
   */
  async hasPendingVisitas(): Promise<boolean> {
    try {
      const pendingVisitas = await offlineService.getPendingVisitas();
      return pendingVisitas.length > 0;
    } catch {
      return false;
    }
  }
}

// Exportar instancia singleton
export const syncService = new SyncService();
