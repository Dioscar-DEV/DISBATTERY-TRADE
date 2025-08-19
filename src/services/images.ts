import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/firebase/clientApp';

/**
 * Convierte una imagen base64 a un archivo blob
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64.split(',')[1]);
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
    if (!base64Image.startsWith('data:image/')) {
      throw new Error('El archivo no es una imagen válida');
    }
    
    // Extraer el tipo MIME
    const mimeType = base64Image.split(';')[0].split(':')[1];
    
    // Convertir base64 a blob
    const blob = base64ToBlob(base64Image, mimeType);
    
    // Crear referencia en Firebase Storage
    const imageRef = ref(storage, `${path}/${fileName}`);
    
    // Subir el archivo
    console.log(`🔄 Subiendo imagen a Firebase Storage: ${path}/${fileName}`);
    const snapshot = await uploadBytes(imageRef, blob);
    
    // Obtener URL de descarga
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log(`✅ Imagen subida exitosamente: ${downloadURL}`);
    
    return downloadURL;
    
  } catch (error) {
    console.error('❌ Error subiendo imagen a Firebase Storage:', error);
    throw new Error(`Error subiendo imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

/**
 * Genera un nombre de archivo único basado en timestamp
 */
export function generateFileName(prefix: string, extension: string = 'jpg'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}.${extension}`;
}

/**
 * Sube múltiples imágenes a Firebase Storage
 */
export async function uploadMultipleImages(
  images: { base64: string; path: string; prefix: string }[]
): Promise<string[]> {
  try {
    const uploadPromises = images.map(async (image) => {
      if (!image.base64) return null;
      
      const fileName = generateFileName(image.prefix);
      return await uploadImageToStorage(image.base64, image.path, fileName);
    });
    
    const results = await Promise.all(uploadPromises);
    return results.filter(Boolean) as string[];
    
  } catch (error) {
    console.error('❌ Error subiendo múltiples imágenes:', error);
    throw error;
  }
} 