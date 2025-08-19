import { db, DebugLog } from '@/lib/indexedDB';

export interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GPSError {
  code: number;
  message: string;
  timestamp: number;
}

// Función GPS offline pura - SOLO captura y guarda local
export async function captureGPSOffline(visitDraftId?: string): Promise<GPSCoordinates | null> {
  return new Promise((resolve) => {
    // Verificar si el navegador soporta geolocalización
    if (!navigator.geolocation) {
      console.error('GPS: Geolocation not supported');
      logGPSEvent('error', 'Geolocation not supported', null, visitDraftId);
      resolve(null);
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000, // 15 segundos
      maximumAge: 60000 // Cache por 1 minuto
    };

    logGPSEvent('info', 'GPS capture started', null, visitDraftId);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords: GPSCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        };

        try {
          // Guardar en IndexedDB si hay un draft asociado
          if (visitDraftId) {
            const draft = await db.visitDrafts.get(visitDraftId);
            if (draft) {
              await db.visitDrafts.update(visitDraftId, {
                gpsData: coords,
                updatedAt: Date.now()
              });
              logGPSEvent('info', 'GPS saved to draft', coords, visitDraftId);
            }
          }

          logGPSEvent('info', 'GPS capture successful', coords, visitDraftId);
          resolve(coords);
        } catch (error) {
          console.error('Error saving GPS to IndexedDB:', error);
          logGPSEvent('error', 'Error saving GPS to IndexedDB', error, visitDraftId);
          // Aún así devolver las coordenadas
          resolve(coords);
        }
      },
      (error) => {
        const gpsError: GPSError = {
          code: error.code,
          message: getGPSErrorMessage(error.code),
          timestamp: Date.now()
        };

        console.error('GPS Error:', gpsError);
        logGPSEvent('error', 'GPS capture failed', gpsError, visitDraftId);
        resolve(null);
      },
      options
    );
  });
}

// Función para obtener GPS sin asociarlo a un draft
export async function getGPSLocation(): Promise<GPSCoordinates | null> {
  return captureGPSOffline();
}

// Función para validar si las coordenadas son válidas
export function validateGPSCoordinates(coords: GPSCoordinates | null): boolean {
  if (!coords) return false;
  
  const { latitude, longitude, accuracy } = coords;
  
  // Validaciones básicas
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  if (accuracy < 0) return false;
  
  // Validar que no sean coordenadas por defecto (0,0)
  if (latitude === 0 && longitude === 0) return false;
  
  return true;
}

// Función para calcular distancia entre dos puntos GPS
export function calculateDistance(
  coords1: GPSCoordinates,
  coords2: GPSCoordinates
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRadians(coords2.latitude - coords1.latitude);
  const dLon = toRadians(coords2.longitude - coords1.longitude);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coords1.latitude)) * Math.cos(toRadians(coords2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000; // Retornar en metros
}

// Función para verificar si el GPS está dentro del rango esperado
export function isGPSWithinRange(
  capturedGPS: GPSCoordinates,
  expectedGPS: GPSCoordinates,
  maxDistanceMeters: number = 500
): boolean {
  if (!validateGPSCoordinates(capturedGPS) || !validateGPSCoordinates(expectedGPS)) {
    return false;
  }
  
  const distance = calculateDistance(capturedGPS, expectedGPS);
  return distance <= maxDistanceMeters;
}

// Función helper para logging de eventos GPS
async function logGPSEvent(
  level: 'info' | 'warn' | 'error',
  message: string,
  data: any,
  visitDraftId?: string
) {
  try {
    const logEntry: DebugLog = {
      id: `gps_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      message: `GPS: ${message}`,
      data,
      timestamp: Date.now(),
      source: 'gpsService',
      visitId: visitDraftId
    };
    
    await db.debugLogs.add(logEntry);
  } catch (error) {
    console.error('Error logging GPS event:', error);
  }
}

// Función helper para convertir a radianes
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Función helper para obtener mensaje de error GPS
function getGPSErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return 'Permission denied - El usuario denegó el acceso a la ubicación';
    case 2:
      return 'Position unavailable - No se pudo determinar la ubicación';
    case 3:
      return 'Timeout - Se agotó el tiempo de espera para obtener la ubicación';
    default:
      return `Unknown GPS error (code: ${code})`;
  }
}

// Función para limpiar datos GPS antiguos
export async function cleanupOldGPSLogs() {
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  try {
    await db.debugLogs
      .where('source').equals('gpsService')
      .and(log => log.timestamp < oneWeekAgo)
      .delete();
      
    console.log('GPS logs cleanup completed');
  } catch (error) {
    console.error('Error cleaning up GPS logs:', error);
  }
}
