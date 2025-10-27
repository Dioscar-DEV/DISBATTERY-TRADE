"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
// Declaración de tipos para Google Maps en window
declare global {
  interface Window {
    google?: typeof google;
    initMap?: () => void;
  }
}

// Función moderna para cargar Google Maps API sin el Loader deprecado
const loadGoogleMapsAPI = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Verificar si ya está cargado
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      resolve();
      return;
    }

    // Verificar si el script ya está siendo cargado
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      // Esperar a que termine de cargar
      const handleLoad = () => {
        if (window.google && window.google.maps) {
          resolve();
        } else {
          reject(new Error('Google Maps API no se cargó correctamente'));
        }
      };
      
      existingScript.addEventListener('load', handleLoad);
      existingScript.addEventListener('error', () => reject(new Error('Error cargando Google Maps API')));
      return;
    }

    // Crear el script para cargar Google Maps API
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,visualization&region=VE&language=es&v=weekly`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // Pequeña espera para asegurar que la API esté completamente inicializada
      setTimeout(() => {
        if (window.google && window.google.maps) {
          resolve();
        } else {
          reject(new Error('Google Maps API no se cargó correctamente'));
        }
      }, 100);
    };

    script.onerror = () => {
      reject(new Error('Error cargando el script de Google Maps API. Verifica tu API key y conexión.'));
    };

    document.head.appendChild(script);
  });
};

interface GoogleMapsProps {
  center?: google.maps.LatLngLiteral;
  zoom?: number;
  height?: string;
  markers?: Array<{
    position: google.maps.LatLngLiteral;
    title?: string;
    info?: string;
  }>;
  heatmapData?: Array<{
    position: google.maps.LatLngLiteral;
    weight?: number;
  }>;
  showHeatmap?: boolean;
  onMapClick?: (event: google.maps.MapMouseEvent) => void;
  onMarkerClick?: (marker: any, index: number) => void;
}

export function GoogleMaps({
  center = { lat: 10.4806, lng: -66.9036 }, // Caracas, Venezuela por defecto
  zoom = 13,
  height = '400px',
  markers = [],
  heatmapData = [],
  showHeatmap = false,
  onMapClick,
  onMarkerClick
}: GoogleMapsProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapMarkers, setMapMarkers] = useState<google.maps.Marker[]>([]);
  const [heatmap, setHeatmap] = useState<google.maps.visualization.HeatmapLayer | null>(null);

  // Memorizar los puntos del heatmap para evitar recrearlos constantemente
  // Solo si Google Maps está cargado
  const heatmapPoints = useMemo(() => {
    if (!heatmapData || heatmapData.length === 0 || !isGoogleLoaded || typeof window === 'undefined' || !window.google) {
      return [];
    }
    
    try {
      return heatmapData.map(data => 
        new window.google.maps.LatLng(data.position.lat, data.position.lng)
      );
    } catch (error) {
      console.error('Error creando puntos de heatmap:', error);
      return [];
    }
  }, [heatmapData, isGoogleLoaded]);

  // Memorizar la configuración del heatmap
  const heatmapConfig = useMemo(() => ({
    radius: 50,
    opacity: 0.8,
    dissipating: true,
    gradient: [
      'rgba(0, 255, 255, 0)',
      'rgba(0, 255, 255, 1)',
      'rgba(0, 191, 255, 1)',
      'rgba(0, 127, 255, 1)',
      'rgba(0, 63, 255, 1)',
      'rgba(0, 0, 255, 1)',
      'rgba(0, 0, 223, 1)',
      'rgba(0, 0, 191, 1)',
      'rgba(0, 0, 159, 1)',
      'rgba(0, 0, 127, 1)',
      'rgba(63, 0, 91, 1)',
      'rgba(127, 0, 63, 1)',
      'rgba(191, 0, 31, 1)',
      'rgba(255, 0, 0, 1)'
    ]
  }), []);

  useEffect(() => {
    const initMap = async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        setError('Google Maps API key no configurada. Por favor agrega NEXT_PUBLIC_GOOGLE_MAPS_API_KEY a tu archivo .env.local');
        return;
      }

      // Verificar si Google Maps ya está cargado globalmente
      if (typeof window !== 'undefined' && window.google && window.google.maps) {
        setIsGoogleLoaded(true);
        
        if (mapRef.current) {
          const mapInstance = new window.google.maps.Map(mapRef.current, {
            center,
            zoom,
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
            zoomControl: true,
          });

          if (onMapClick) {
            mapInstance.addListener('click', onMapClick);
          }

          setMap(mapInstance);
          setIsLoaded(true);
        }
        return;
      }

      try {
        // Método moderno para cargar Google Maps API
        await loadGoogleMapsAPI(apiKey);
        
        // Verificar que Google Maps esté completamente cargado
        if (typeof window !== 'undefined' && window.google && window.google.maps) {
          setIsGoogleLoaded(true);
          
          if (mapRef.current) {
            const mapInstance = new window.google.maps.Map(mapRef.current, {
              center,
              zoom,
              mapTypeControl: true,
              streetViewControl: true,
              fullscreenControl: true,
              zoomControl: true,
              // Configuraciones adicionales para mejor rendimiento
              gestureHandling: 'cooperative',
              clickableIcons: false,
            });

            if (onMapClick) {
              mapInstance.addListener('click', onMapClick);
            }

            setMap(mapInstance);
            setIsLoaded(true);
          }
        } else {
          throw new Error('Google Maps API no se cargó correctamente');
        }
      } catch (err: any) {
        const errorMessage = err?.message || 'Error desconocido cargando Google Maps';
        setError(`Error cargando Google Maps: ${errorMessage}. Verifica tu API key y conexión.`);
        console.error('Error loading Google Maps:', err);
      }
    };

    // Solo inicializar si el componente está montado y no hay error
    if (mapRef.current && !error) {
      initMap();
    }
  }, [center.lat, center.lng, zoom, onMapClick, error]);

  // Actualizar marcadores cuando cambien
  useEffect(() => {
    if (!map || !isLoaded || !isGoogleLoaded || showHeatmap) return; // No mostrar marcadores si se está mostrando heatmap

    try {
      // Limpiar marcadores existentes
      mapMarkers.forEach(marker => marker.setMap(null));

      // Crear nuevos marcadores
      const newMarkers = markers.map((markerData, index) => {
        const marker = new window.google.maps.Marker({
          position: markerData.position,
          map,
          title: markerData.title,
        });

        if (markerData.info) {
          const infoWindow = new window.google.maps.InfoWindow({
            content: markerData.info,
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
            if (onMarkerClick) {
              onMarkerClick(marker, index);
            }
          });
        } else if (onMarkerClick) {
          marker.addListener('click', () => {
            onMarkerClick(marker, index);
          });
        }

        return marker;
      });

      setMapMarkers(newMarkers);
    } catch (error) {
      console.error('Error creando marcadores:', error);
    }
  }, [map, isLoaded, isGoogleLoaded, markers, onMarkerClick, showHeatmap]);

  // Optimizar el heatmap para evitar parpadeo
  useEffect(() => {
    if (!map || !isLoaded || !isGoogleLoaded || typeof window === 'undefined' || !window.google) return;

    try {
      if (showHeatmap && heatmapPoints.length > 0) {
        // Solo crear nuevo heatmap si no existe o si los datos cambiaron significativamente
        if (!heatmap || (heatmap.getData() && heatmap.getData().getLength() !== heatmapPoints.length)) {
          // Limpiar heatmap existente
          if (heatmap) {
            heatmap.setMap(null);
          }

          // Limpiar marcadores cuando se muestra heatmap
          mapMarkers.forEach(marker => marker.setMap(null));
          setMapMarkers([]);

          // Crear el heatmap con datos estables
          const heatmapLayer = new window.google.maps.visualization.HeatmapLayer({
            data: heatmapPoints,
            map: map,
          });

          // Aplicar configuración del heatmap
          heatmapLayer.setOptions(heatmapConfig);

          setHeatmap(heatmapLayer);
        } else if (heatmap && heatmapPoints.length > 0) {
          // Si ya existe, solo actualizar los datos sin recrear todo el layer
          heatmap.setData(heatmapPoints);
        }
      } else if (!showHeatmap && heatmap) {
        // Limpiar heatmap cuando no se debe mostrar
        heatmap.setMap(null);
        setHeatmap(null);
      }
    } catch (error) {
      console.error('Error manejando heatmap:', error);
    }
  }, [map, isLoaded, isGoogleLoaded, heatmapPoints, showHeatmap, heatmapConfig, heatmap, mapMarkers]);

  // Callback estable para el cambio de centro del mapa
  const updateMapCenter = useCallback(() => {
    if (map && center && isGoogleLoaded) {
      try {
        map.setCenter(center);
        map.setZoom(zoom);
      } catch (error) {
        console.error('Error actualizando centro del mapa:', error);
      }
    }
  }, [map, center.lat, center.lng, zoom, isGoogleLoaded]);

  // Actualizar centro del mapa solo cuando sea necesario
  useEffect(() => {
    if (map && isLoaded && isGoogleLoaded) {
      updateMapCenter();
    }
  }, [updateMapCenter, map, isLoaded, isGoogleLoaded]);

  if (error) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 border border-gray-300 rounded-lg"
        style={{ height }}
      >
        <div className="text-center p-4 max-w-sm">
          <div className="text-red-500 text-4xl mb-2">🗺️</div>
          <p className="text-red-600 font-medium mb-2">Error cargando mapa</p>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <div className="text-xs text-gray-500 space-y-1">
            <p>• Verifica tu conexión a internet</p>
            <p>• Confirma que la API key de Google Maps esté configurada</p>
            <p>• Revisa que la API key tenga permisos para Maps JavaScript API</p>
          </div>
          <button
            onClick={() => {
              setError(null);
              setIsLoaded(false);
              setIsGoogleLoaded(false);
            }}
            className="mt-4 px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div 
        ref={mapRef} 
        style={{ height }}
        className="w-full rounded-lg shadow-md"
      />
      {(!isLoaded || !isGoogleLoaded) && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg"
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">
              {!isGoogleLoaded ? 'Cargando Google Maps API...' : 'Inicializando mapa...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 