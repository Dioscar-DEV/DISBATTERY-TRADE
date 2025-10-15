import Dexie, { Table } from "dexie";

// Esquemas de datos para IndexedDB
export interface VisitDraft {
  id: string;
  routePointId: string;
  clienteId: string;
  brand: "shell" | "qualid";
  status: "draft" | "completed" | "synced";
  createdAt: number;
  updatedAt: number;
  version: number;

  // Datos del formulario por pasos
  step1?: {
    visitType: string;
    observations?: string;
  };
  step2?: {
    signageData?: any;
    signagePhotos?: string[];
  };
  step3?: {
    merchandisingData?: any;
    merchandisingPhotos?: string[];
  };
  step4?: {
    salesData?: any;
  };
  step5?: {
    finalObservations?: string;
    additionalPhotos?: string[];
  };

  // GPS capturado
  gpsData?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  };
}

export interface PendingOperation {
  id: string;
  type:
    | "uploadImage"
    | "createVisita"
    | "updateCliente"
    | "updateRoute"
    | "webhook";
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

export interface OfflineImage {
  id: string;
  draftId: string;
  fieldKey: string;
  blob: Blob;
  base64?: string;
  filename: string;
  size: number;
  type: string;
  compressed: boolean;
  uploadedUrl?: string;
  createdAt: number;
}

export interface OfflineRoute {
  id: string;
  routeId: string;
  userId: string;
  date: string;
  points: OfflineRoutePoint[];
  status: "pending" | "started" | "completed";
  lastSyncAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface OfflineRoutePoint {
  id: string;
  routeId: string;
  clienteId: string;
  cliente: {
    rif: string;
    nombre: string;
    direccion: string;
    latitude?: number;
    longitude?: number;
  };
  status: "pending" | "visited" | "omitted";
  visitedAt?: number;
  localVisitId?: string;
}

export interface ClientSnapshot {
  id: string;
  rif: string;
  nombre: string;
  direccion: string;
  latitude?: number;
  longitude?: number;
  signage?: boolean;
  signagePhoto?: string;
  lastVisitDate?: number;
  lastSyncAt: number;
}

export interface DebugLog {
  id: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  data?: any;
  timestamp: number;
  source: string;
  visitId?: string;
  userId?: string;
}

// Base de datos IndexedDB
class DisbatteryDB extends Dexie {
  visitDrafts!: Table<VisitDraft>;
  pendingOps!: Table<PendingOperation>;
  images!: Table<OfflineImage>;
  offlineRoutes!: Table<OfflineRoute>;
  clientSnapshots!: Table<ClientSnapshot>;
  debugLogs!: Table<DebugLog>;

  constructor() {
    // Nombre fijo de la base para evitar recreaciones innecesarias
    super("DisbatteryOfflineDB_v3");

    // Usar una versión fija y controlada. Incrementar manualmente cuando
    // se necesite una migración (NO usar Date.now()).
    const DB_VERSION = 3;

    // Definir stores y proporcionar un handler de migración minimalista.
    // Añadir nuevas versiones con this.version(n).stores(...).upgrade(tx => { ... })
    this.version(DB_VERSION)
      .stores({
        visitDrafts:
          "id, routePointId, clienteId, status, createdAt, updatedAt",
        pendingOps: "id, type, status, draftId, createdAt, idempotencyKey",
        images: "id, draftId, fieldKey, createdAt, size",
        offlineRoutes: "id, routeId, userId, date, status, lastSyncAt",
        clientSnapshots: "id, rif, nombre, lastSyncAt",
        debugLogs: "id, timestamp, level, source, visitId, userId",
      })
      .upgrade(async (trans) => {
        // Migration hook: aquí podemos normalizar datos si migramos desde
        // una versión anterior. Mantener ligero para minimizar riesgos.
        try {
          // example: ensure all visitDrafts have 'version' and timestamps
          const drafts = await trans.table("visitDrafts").toArray();
          for (const d of drafts) {
            if (!("version" in d)) d.version = DB_VERSION;
            if (!d.createdAt) d.createdAt = Date.now();
            if (!d.updatedAt) d.updatedAt = Date.now();
            await trans.table("visitDrafts").put(d);
          }
        } catch (err) {
          console.warn("IndexedDB migration warning:", err);
        }
      });
  }
}

export const db = new DisbatteryDB();

// Funciones de utilidad para migración desde localStorage
export async function migrateFromLocalStorage() {
  try {
    // Migrar datos existentes de localStorage a IndexedDB
    const keys = Object.keys(localStorage);

    for (const key of keys) {
      try {
        if (key.startsWith("visitDraft_")) {
          const data = JSON.parse(localStorage.getItem(key) || "{}");
          if (data.id) {
            await db.visitDrafts.put({
              ...data,
              version: data.version || Date.now(),
              updatedAt: Date.now(),
            });
            console.log(`Migrated visit draft: ${data.id}`);
          }
        }

        if (key.startsWith("routeData_")) {
          const data = JSON.parse(localStorage.getItem(key) || "{}");
          if (data.id) {
            await db.offlineRoutes.put({
              ...data,
              lastSyncAt: data.lastSyncAt || 0,
              createdAt: data.createdAt || Date.now(),
              updatedAt: Date.now(),
            });
            console.log(`Migrated route data: ${data.id}`);
          }
        }

        if (key.startsWith("pendingImage_")) {
          const data = JSON.parse(localStorage.getItem(key) || "{}");
          if (data.id && data.base64) {
            // Convertir base64 a Blob
            const response = await fetch(data.base64);
            const blob = await response.blob();

            await db.images.put({
              id: data.id,
              draftId: data.draftId || "",
              fieldKey: data.fieldKey || "",
              blob: blob,
              base64: data.base64,
              filename: data.filename || "image.jpg",
              size: blob.size,
              type: blob.type,
              compressed: data.compressed || false,
              createdAt: data.createdAt || Date.now(),
            });
            console.log(`Migrated image: ${data.id}`);
          }
        }
      } catch (error) {
        console.warn(`Error migrating ${key}:`, error);
      }
    }

    // Marcar migración como completada
    localStorage.setItem("indexeddb_migration_completed", "true");
    console.log("Migration from localStorage to IndexedDB completed");
  } catch (error) {
    console.error("Error during localStorage migration:", error);
  }
}

// Función para limpiar datos antiguos
export async function cleanupOldData() {
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  try {
    // Limpiar logs antiguos
    await db.debugLogs.where("timestamp").below(oneWeekAgo).delete();

    // Limpiar drafts antiguos completados
    await db.visitDrafts
      .where("status")
      .equals("synced")
      .and((draft) => draft.updatedAt < oneWeekAgo)
      .delete();

    // Limpiar imágenes huérfanas
    const allImages = await db.images.toArray();
    const allDrafts = await db.visitDrafts.toArray();
    const draftIds = new Set(allDrafts.map((d) => d.id));

    for (const image of allImages) {
      if (!draftIds.has(image.draftId)) {
        await db.images.delete(image.id);
      }
    }

    console.log("Cleanup completed");
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}

// Inicializar DB y migración
export async function initializeOfflineDB() {
  try {
    await db.open();

    // Verificar si ya se migró
    const migrationCompleted = localStorage.getItem(
      "indexeddb_migration_completed"
    );
    if (!migrationCompleted) {
      await migrateFromLocalStorage();
    }

    // Cleanup periódico
    await cleanupOldData();

    console.log("Offline database initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing offline database:", error);
    return false;
  }
}
