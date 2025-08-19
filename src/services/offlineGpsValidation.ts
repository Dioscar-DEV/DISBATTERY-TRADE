/**
 * Servicio de validación GPS offline para mercaderistas
 * Valida proximidad a puntos de ruta usando datos almacenados localmente
 */

import { offlineService } from './offlineService';
import { RoutePoint } from '@/types/routes';

export interface GpsLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
}

export interface ProximityValidationResult {
  isValid: boolean;
  distance: number;
  point: RoutePoint;
  requiredDistance: number;
  userLocation: GpsLocation;
  validationTimestamp: number;
}

export interface GpsValidationError {
  code: 'LOCATION_DENIED' | 'LOCATION_UNAVAILABLE' | 'TIMEOUT' | 'ACCURACY_LOW' | 'POINT_NOT_FOUND' | 'NO_OFFLINE_DATA';
  message: string;
  details?: any;
}

class OfflineGpsValidation {
  private readonly DEFAULT_TOLERANCE_METERS = 500;
  private readonly MIN_ACCURACY_METERS = 100;
  private readonly LOCATION_TIMEOUT_MS = 30000; // 30 segundos

  /**
   * Obtiene la ubicación actual del usuario con alta precisión
   */
  async getCurrentLocation(): Promise<GpsLocation> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject({
          code: 'LOCATION_UNAVAILABLE',
          message: 'Geolocalización no soportada en este dispositivo'
        } as GpsValidationError);
        return;
      }

      console.log('📍 [OfflineGPS] Obteniendo ubicación actual...');

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: this.LOCATION_TIMEOUT_MS,
        maximumAge: 60000 // Aceptar ubicación de hasta 1 minuto de antigüedad
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: GpsLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };

          console.log('✅ [OfflineGPS] Ubicación obtenida:', {
            lat: location.lat.toFixed(6),
            lng: location.lng.toFixed(6),
            accuracy: location.accuracy ? `${location.accuracy.toFixed(0)}m` : 'desconocida'
          });

          // Verificar precisión mínima
          if (location.accuracy && location.accuracy > this.MIN_ACCURACY_METERS) {
            console.warn(`⚠️ [OfflineGPS] Precisión baja: ${location.accuracy.toFixed(0)}m (requerido: <${this.MIN_ACCURACY_METERS}m)`);
          }

          resolve(location);
        },
        (error) => {
          console.error('❌ [OfflineGPS] Error obteniendo ubicación:', error);
          
          let validationError: GpsValidationError;
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              validationError = {
                code: 'LOCATION_DENIED',
                message: 'Acceso a la ubicación denegado. Habilite la geolocalización para continuar.',
                details: error
              };
              break;
            case error.POSITION_UNAVAILABLE:
              validationError = {
                code: 'LOCATION_UNAVAILABLE',
                message: 'No se puede determinar la ubicación. Verifique que el GPS esté activado.',
                details: error
              };
              break;
            case error.TIMEOUT:
              validationError = {
                code: 'TIMEOUT',
                message: 'Tiempo de espera agotado obteniendo la ubicación. Intente nuevamente.',
                details: error
              };
              break;
            default:
              validationError = {
                code: 'LOCATION_UNAVAILABLE',
                message: 'Error desconocido obteniendo la ubicación.',
                details: error
              };
          }
          
          reject(validationError);
        },
        options
      );
    });
  }

  /**
   * Valida si el usuario está cerca de un punto específico usando datos offline
   */
  async validateProximityToPoint(
    pointId: string,
    routeId: string,
    toleranceMeters: number = this.DEFAULT_TOLERANCE_METERS
  ): Promise<ProximityValidationResult> {
    try {
      console.log(`🎯 [OfflineGPS] Validando proximidad al punto ${pointId}...`);

      // Obtener ubicación actual del usuario
      const userLocation = await this.getCurrentLocation();

      // Validar proximidad usando datos offline
      const validation = await offlineService.validateProximity(
        { lat: userLocation.lat, lng: userLocation.lng },
        pointId,
        routeId,
        toleranceMeters
      );

      if (!validation.isValid || !validation.point) {
        throw {
          code: 'POINT_NOT_FOUND',
          message: `No se encontró el punto ${pointId} en los datos offline o no está dentro del rango permitido`,
          details: validation
        } as GpsValidationError;
      }

      const result: ProximityValidationResult = {
        isValid: validation.isValid,
        distance: validation.distance || 0,
        point: validation.point,
        requiredDistance: toleranceMeters,
        userLocation,
        validationTimestamp: Date.now()
      };

      const status = result.isValid ? '✅' : '❌';
      console.log(`${status} [OfflineGPS] Validación completada: ${result.distance.toFixed(0)}m (límite: ${toleranceMeters}m)`);

      return result;

    } catch (error) {
      console.error('❌ [OfflineGPS] Error en validación de proximidad:', error);
      
      // Si es un error ya formateado, relanזar
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }
      
      // Si no, crear un error genérico
      throw {
        code: 'NO_OFFLINE_DATA',
        message: 'Error validando proximidad con datos offline',
        details: error
      } as GpsValidationError;
    }
  }

  /**
   * Obtiene todos los puntos de una ruta desde datos offline
   */
  async getRoutePointsOffline(routeId: string, mercaderistoId: string): Promise<RoutePoint[]> {
    try {
      const routes = await offlineService.getOfflineRoutes(mercaderistoId);
      const route = routes.find(r => r.id === routeId);
      
      if (!route) {
        console.warn(`⚠️ [OfflineGPS] Ruta ${routeId} no encontrada en datos offline`);
        return [];
      }

      console.log(`📍 [OfflineGPS] ${route.points.length} puntos cargados para ruta ${routeId}`);
      return route.points;

    } catch (error) {
      console.error('❌ [OfflineGPS] Error cargando puntos de ruta offline:', error);
      return [];
    }
  }

  /**
   * Valida múltiples puntos de una ruta y devuelve los que están cerca
   */
  async findNearbyPoints(
    routeId: string,
    mercaderistoId: string,
    toleranceMeters: number = this.DEFAULT_TOLERANCE_METERS
  ): Promise<{
    userLocation: GpsLocation;
    nearbyPoints: Array<{
      point: RoutePoint;
      distance: number;
    }>;
    totalPoints: number;
  }> {
    try {
      console.log(`🔍 [OfflineGPS] Buscando puntos cercanos en ruta ${routeId}...`);

      // Obtener ubicación actual
      const userLocation = await this.getCurrentLocation();

      // Obtener puntos de la ruta
      const routePoints = await this.getRoutePointsOffline(routeId, mercaderistoId);

      if (routePoints.length === 0) {
        return {
          userLocation,
          nearbyPoints: [],
          totalPoints: 0
        };
      }

      const nearbyPoints: Array<{ point: RoutePoint; distance: number }> = [];

      // Evaluar cada punto
      for (const point of routePoints) {
        const distance = this.calculateDistance(
          userLocation.lat,
          userLocation.lng,
          point.position.lat,
          point.position.lng
        );

        if (distance <= toleranceMeters) {
          nearbyPoints.push({ point, distance });
        }
      }

      // Ordenar por distancia (más cerca primero)
      nearbyPoints.sort((a, b) => a.distance - b.distance);

      console.log(`📊 [OfflineGPS] ${nearbyPoints.length} puntos cercanos encontrados de ${routePoints.length} totales`);

      return {
        userLocation,
        nearbyPoints,
        totalPoints: routePoints.length
      };

    } catch (error) {
      console.error('❌ [OfflineGPS] Error buscando puntos cercanos:', error);
      
      throw {
        code: 'NO_OFFLINE_DATA',
        message: 'Error buscando puntos cercanos en datos offline',
        details: error
      } as GpsValidationError;
    }
  }

  /**
   * Calcula la distancia entre dos coordenadas usando la fórmula de Haversine
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distancia en metros
  }

  /**
   * Valida la precisión del GPS del dispositivo
   */
  validateGpsAccuracy(location: GpsLocation): {
    isAccurate: boolean;
    accuracy: number;
    message: string;
  } {
    const accuracy = location.accuracy || 999;
    const isAccurate = accuracy <= this.MIN_ACCURACY_METERS;

    let message: string;
    if (isAccurate) {
      message = `GPS preciso: ${accuracy.toFixed(0)}m`;
    } else if (accuracy <= 200) {
      message = `GPS poco preciso: ${accuracy.toFixed(0)}m (recomendado: <${this.MIN_ACCURACY_METERS}m)`;
    } else {
      message = `GPS muy impreciso: ${accuracy.toFixed(0)}m. Muévase a un área con mejor señal.`;
    }

    return {
      isAccurate,
      accuracy,
      message
    };
  }

  /**
   * Monitorea la ubicación en tiempo real
   */
  watchLocation(
    callback: (location: GpsLocation) => void,
    errorCallback?: (error: GpsValidationError) => void
  ): number | null {
    if (!navigator.geolocation) {
      if (errorCallback) {
        errorCallback({
          code: 'LOCATION_UNAVAILABLE',
          message: 'Geolocalización no soportada'
        });
      }
      return null;
    }

    console.log('👀 [OfflineGPS] Iniciando monitoreo de ubicación...');

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000
    };

    return navigator.geolocation.watchPosition(
      (position) => {
        const location: GpsLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };

        callback(location);
      },
      (error) => {
        if (errorCallback) {
          let validationError: GpsValidationError;
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              validationError = { code: 'LOCATION_DENIED', message: 'Acceso a ubicación denegado' };
              break;
            case error.POSITION_UNAVAILABLE:
              validationError = { code: 'LOCATION_UNAVAILABLE', message: 'Ubicación no disponible' };
              break;
            case error.TIMEOUT:
              validationError = { code: 'TIMEOUT', message: 'Tiempo de espera agotado' };
              break;
            default:
              validationError = { code: 'LOCATION_UNAVAILABLE', message: 'Error desconocido' };
          }
          
          errorCallback(validationError);
        }
      },
      options
    );
  }

  /**
   * Detiene el monitoreo de ubicación
   */
  stopWatchingLocation(watchId: number): void {
    navigator.geolocation.clearWatch(watchId);
    console.log('🛑 [OfflineGPS] Monitoreo de ubicación detenido');
  }
}

// Exportar instancia singleton
export const offlineGpsValidation = new OfflineGpsValidation();