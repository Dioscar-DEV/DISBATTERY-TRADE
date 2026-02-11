import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getStorageClient } from "@/firebase/clientApp";

/**
 * Convierte una imagen base64 a un archivo blob
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64.split(",")[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Sube una imagen base64 a Firebase Storage y retorna la URL de descarga
 */
export async function uploadImageToStorage(
  base64Image: string,
  path: string,
  fileName: string
): Promise<string> {
  try {
    // Validar que sea una imagen base64
    if (!base64Image.startsWith("data:image/")) {
      throw new Error("El archivo no es una imagen válida");
    }

    // Extraer el tipo MIME
    const mimeType = base64Image.split(";")[0].split(":")[1];

    // Convertir base64 a blob
    const blob = base64ToBlob(base64Image, mimeType);

    // Crear referencia en Firebase Storage
    const storageClient = getStorageClient();
    const imageRef = ref(storageClient, `${path}/${fileName}`);

    // Subir el archivo
    console.log(`🔄 Subiendo imagen a Firebase Storage: ${path}/${fileName}`);
    const snapshot = await uploadBytes(imageRef, blob);

    // Obtener URL de descarga
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log(`✅ Imagen subida exitosamente: ${downloadURL}`);

    return downloadURL;
  } catch (error) {
    console.error("❌ Error subiendo imagen a Firebase Storage:", error);
    throw new Error(
      `Error subiendo imagen: ${
        error instanceof Error ? error.message : "Error desconocido"
      }`
    );
  }
}

/**
 * Genera un nombre de archivo único basado en timestamp
 */
export function generateFileName(
  prefix: string,
  extension: string = "jpg"
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}.${extension}`;
}

/**
 * Genera una ruta organizada para Firebase Storage
 */
export function generateOrganizedPath(
  tipoVisita: string,
  clienteInfo: { rif?: string; nombre?: string; nombreEvento?: string },
  tipoFoto: string
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  // Limpiar nombres para usar en rutas (sin caracteres especiales)
  const cleanString = (str: string) =>
    str
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase();

  let basePath = `visitas/${year}/${month}/${day}`;

  if (tipoVisita.includes("Merchandising")) {
    const clienteId =
      clienteInfo.rif || cleanString(clienteInfo.nombre || "cliente");
    basePath += `/merchandising/${clienteId}`;

    // Subcarpetas por tipo de foto
    if (tipoFoto.includes("planograma")) {
      basePath += "/planograma";
    } else if (tipoFoto.includes("sticker")) {
      basePath += "/stickers";
    } else if (tipoFoto.includes("afiche")) {
      basePath += "/afiches";
    } else if (tipoFoto.includes("banderin")) {
      basePath += "/banderines";
    } else if (tipoFoto.includes("exhibidor")) {
      basePath += "/exhibidores";
    } else if (tipoFoto.includes("senalizacion")) {
      basePath = `visitas/${year}/${month}/${day}/senalizacion/${clienteId}`;
    } else {
      basePath += "/otros";
    }
  } else if (tipoVisita.includes("Trade (Eventos)")) {
    const eventoId = cleanString(clienteInfo.nombreEvento || "evento");
    basePath += `/trade-eventos/${eventoId}`;

    // Subcarpetas por marca
    if (tipoFoto.includes("shell")) {
      basePath += "/shell";
    } else if (tipoFoto.includes("qualid")) {
      basePath += "/qualid";
    } else if (tipoFoto.includes("video")) {
      basePath += "/videos";
    } else {
      basePath += "/general";
    }
  } else if (tipoVisita.includes("Trade (Impulso)")) {
    const clienteId =
      clienteInfo.rif || cleanString(clienteInfo.nombre || "cliente");
    basePath += `/trade-impulso/${clienteId}`;

    // Subcarpetas por marca
    if (tipoFoto.includes("shell")) {
      basePath += "/shell";
    } else if (tipoFoto.includes("qualid")) {
      basePath += "/qualid";
    } else {
      basePath += "/general";
    }
  } else {
    // Fallback para otros tipos de visita
    const clienteId =
      clienteInfo.rif || cleanString(clienteInfo.nombre || "cliente");
    basePath += `/otros/${clienteId}`;
  }

  return basePath;
}

/**
 * Sube múltiples imágenes a Firebase Storage (versión legacy)
 */
export async function uploadMultipleImages(
  images: { base64: string; path: string; prefix: string }[]
): Promise<string[]> {
  try {
    const uploadPromises = images.map(async (image) => {
      if (!image.base64) {
        console.warn(`⚠️ [ImageService] Imagen omitida: ${image.prefix} (base64 vacío)`);
        return null;
      }
      try {
        const fileName = generateFileName(image.prefix);
        return await uploadImageToStorage(image.base64, image.path, fileName);
      } catch (innerError) {
        console.error(`❌ [ImageService] Error subiendo imagen ${image.prefix}:`, innerError);
        return null; // Devolver null para esta imagen fallida
      }
    });

    const results = await Promise.allSettled(uploadPromises);
    const urls: string[] = [];
    let failedUploads = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value !== null) {
        urls.push(result.value);
      } else {
        failedUploads++;
        const imageInfo = images[index] ? `(${images[index].prefix})` : '';
        console.error(`❌ [ImageService] Falló la subida de la imagen ${index + 1}${imageInfo}. Razón: ${result.status === 'rejected' ? result.reason : 'Valor nulo'}`);
      }
    });

    if (failedUploads > 0) {
      console.warn(`⚠️ [ImageService] ${failedUploads} imágenes no se pudieron subir.`);
    }

    return urls;
  } catch (error) {
    console.error("❌ [ImageService] Error general en uploadMultipleImages:", error);
    throw error; // Re-lanzar el error general si lo hay
  }
}

/**
 * Comprime una imagen base64 a un tamaño y calidad razonable (max 1024px, calidad 0.7, WebP si es posible)
 */
export async function compressBase64Image(base64: string, maxSize = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height *= maxSize / width));
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width *= maxSize / height));
          height = maxSize;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No se pudo obtener el contexto del canvas');
      ctx.drawImage(img, 0, 0, width, height);
      // Intentar WebP, si no, usar el tipo original
      let outputType = 'image/webp';
      if (!canvas.toDataURL('image/webp').startsWith('data:image/webp')) {
        outputType = base64.split(';')[0].split(':')[1];
      }
      const compressed = canvas.toDataURL(outputType, quality);
      resolve(compressed);
    };
    img.onerror = (e) => reject(e);
    img.src = base64;
  });
}

/**
 * Sube múltiples imágenes con estructura organizada
 */
export async function uploadOrganizedImages(
  images: Record<string, string>, // { 'foto_shell_0': 'data:image/...', ... }
  tipoVisita: string,
  clienteInfo: { rif?: string; nombre?: string; nombreEvento?: string }
): Promise<string[]> {
  try {
    console.log(
      `📁 Organizando ${Object.keys(images).length} imágenes para ${tipoVisita}`
    );

    const uploadPromises = Object.entries(images).map(async ([key, base64]) => {
      if (!base64 || !base64.startsWith("data:image/")) return null;

      // Generar ruta organizada basada en el tipo de foto
      const organizedPath = generateOrganizedPath(tipoVisita, clienteInfo, key);

      // Generar nombre de archivo descriptivo
      const fileName = generateFileName(key);

      console.log(`📸 Subiendo ${key} a: ${organizedPath}/${fileName}`);

      return await uploadImageToStorage(base64, organizedPath, fileName);
    });

    const results = await Promise.all(uploadPromises);
    const urls = results.filter(Boolean) as string[];

    console.log(`✅ ${urls.length} imágenes organizadas subidas exitosamente`);
    return urls;
  } catch (error) {
    console.error("❌ Error subiendo imágenes organizadas:", error);
    throw error;
  }
}
