import { db, VisitaOffline } from "../db/database";
import { crearVisita } from "./visitas"; // Asumimos que podemos importar esto
import { uploadMultipleImages } from "./images"; // Asumimos que podemos importar esto
import { getFirestoreClient, getStorageClient } from "@/firebase/clientApp";

function generateUniqueId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Lógica de compresión de imagen (movida aquí para centralizar)
const comprimirImagenBase64 = (
  base64String: string,
  calidad: number = 0.6
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      // No se puede comprimir en el servidor o en un worker sin canvas
      return resolve(base64String);
    }
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      const maxWidth = 800;
      const ratio = Math.min(maxWidth / img.width, 1); // No agrandar, solo reducir
      const newWidth = img.width * ratio;
      const newHeight = img.height * ratio;

      canvas.width = newWidth;
      canvas.height = newHeight;

      ctx?.drawImage(img, 0, 0, newWidth, newHeight);

      const comprimida = canvas.toDataURL("image/jpeg", calidad);
      resolve(comprimida);
    };
    img.onerror = (err) => {
      console.error("Error al cargar imagen para compresión:", err);
      reject(err);
    };
    img.src = base64String;
  });
};

// Lógica para subir una visita a Firebase (extraída de reportes-finales)
async function uploadVisitaToFirebase(visita: VisitaOffline) {
  const datosAcumulados = visita.data;
  const cliente = datosAcumulados.clienteData;

  // Aquí iría toda la lógica de `handleGuardarYContinuar`
  // 1. Comprimir imágenes
  let fotosComprimidas: Record<string, string> = {};
  const compresiones: Promise<void>[] = [];

  // Extraer todas las fotos en base64 de `datosAcumulados` y comprimirlas
  // Esta parte necesita una implementación robusta que recorra el objeto
  // y encuentre todas las propiedades que son imágenes base64.
  // Por simplicidad, aquí solo mostramos un ejemplo:
  if (
    datosAcumulados.signagePhoto &&
    datosAcumulados.signagePhoto.startsWith("data:image/")
  ) {
    compresiones.push(
      comprimirImagenBase64(datosAcumulados.signagePhoto).then((c) => {
        fotosComprimidas.foto_senalizacion = c;
      })
    );
  }
  // ... aquí se añadirían compresiones para TODAS las demás fotos ...

  await Promise.all(compresiones);

  // 2. Subir imágenes a Firebase Storage
  const imagesToUpload = Object.entries(fotosComprimidas).map(
    ([key, base64]) => ({
      base64: base64,
      path: `visitas/${cliente.rif}/${Date.now()}`,
      prefix: key,
    })
  );
  const fotosUrls = await uploadMultipleImages(imagesToUpload);

  // 3. Preparar el objeto de datos final con URLs
  // Esta lógica de mapeo también debe ser extraída de `reportes-finales`
  const datosSheet = {
    /* ... objeto de datos mapeado con URLs ... */
  };

  // 4. Enviar a Firestore y N8N
  // Construir payloads respetando los tipos esperados por crearVisita
  const respuestasPayload: any = datosAcumulados.respuestas ?? {};

  // datosN8N contiene la estructura organizada para N8N/Sheets (incluye fotos como URLs)
  const datosN8NPayload = {
    datosSheet: datosSheet,
    fotos: fotosUrls,
  };

  const visitaId = await crearVisita({
    rifCliente: cliente.rif,
    nombreEstablecimiento: cliente.nombre,
    tipoVisita: datosAcumulados.tipoVisita,
    mercaderista:
      datosAcumulados.mercaderista || datosAcumulados.nombreMercaderista ||
      cliente?.mercaderista || "mercaderista-offline",
    correoMercaderista:
      datosAcumulados.correoMercaderista || datosAcumulados.email || "",
    ubicacion:
      datosAcumulados.ubicacion || datosAcumulados.location || {
        lat: 0,
        lng: 0,
        direccion: "No capturada",
      },
    sucursal: datosAcumulados.sucursal,
    // ... resto de los datos ...
    respuestas: respuestasPayload as any,
    datosN8N: datosN8NPayload,
  });

  return visitaId;
}

export class SyncService {
  static async syncPendingVisitas() {
    if (typeof window !== "undefined" && !navigator.onLine) {
      console.log("Offline: La sincronización se pospone.");
      return;
    }

    const pendingVisitas = await db.visitas
      .where("syncStatus")
      .equals("pending")
      .toArray();

    if (pendingVisitas.length === 0) {
      console.log("No hay visitas pendientes para sincronizar.");
      return;
    }

    console.log(`Sincronizando ${pendingVisitas.length} visitas pendientes...`);

    for (const visita of pendingVisitas) {
      try {
        await db.visitas.update(visita.id!, { syncStatus: "syncing" });

        // Aquí iría la lógica para subir los datos a Firebase
        console.log("Subiendo visita a Firebase:", visita.visitaId);
        await uploadVisitaToFirebase(visita); // Lógica de subida real

        await db.visitas.update(visita.id!, { syncStatus: "synced" });
        console.log("Visita sincronizada con éxito:", visita.visitaId);
      } catch (error) {
        console.error("Error al sincronizar visita:", visita.visitaId, error);
        await db.visitas.update(visita.id!, { syncStatus: "error" });
      }
    }
  }

  static async saveVisitaOffline(visitaData: any) {
    const visita: VisitaOffline = {
      visitaId: generateUniqueId(),
      clienteRif: visitaData.cliente.rif,
      data: visitaData,
      fotos: visitaData.fotos || {},
      timestamp: Date.now(),
      syncStatus: "pending",
    };

    try {
      const id = await db.visitas.add(visita);
      console.log("Visita guardada offline con éxito. ID:", id);

      // Registrar para Background Sync
      if ("serviceWorker" in navigator && "SyncManager" in window) {
        navigator.serviceWorker.ready
          .then((registration) => {
            (registration as any).sync.register("sync-pending-visitas");
            console.log(
              "✅ Tarea de sincronización en segundo plano registrada."
            );
          })
          .catch((err) => {
            console.error(
              "❌ No se pudo registrar la tarea de sincronización:",
              err
            );
            // Si falla el registro, intentar sincronización manual si hay conexión
            if (navigator.onLine) {
              this.syncPendingVisitas();
            }
          });
      } else {
        // Fallback para navegadores sin Background Sync
        console.log(
          "⚠️ Background Sync no soportado. Se intentará sincronización manual."
        );
        if (navigator.onLine) {
          this.syncPendingVisitas();
        }
      }
      return id;
    } catch (error) {
      console.error("Error al guardar la visita offline:", error);
    }
  }
}
