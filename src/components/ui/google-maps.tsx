"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

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
    if (!heatmapData || heatmapData.length === 0 || !isGoogleLoaded || typeof google === 'undefined') {
      return [];
    }
    
    try {
      return heatmapData.map(data => 
        new google.maps.LatLng(data.position.lat, data.position.lng)
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

      try {
        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['places', 'geometry', 'visualization'] // Agregamos visualization para heatmap
        });

        await loader.load();
        
        // Verificar que Google Maps esté completamente cargado
        if (typeof google !== 'undefined' && google.maps) {
          setIsGoogleLoaded(true);
          
          if (mapRef.current) {
            const mapInstance = new google.maps.Map(mapRef.current, {
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
        } else {
          throw new Error('Google Maps API no se cargó correctamente');
        }
      } catch (err) {
        setError('Error cargando Google Maps. Verifica tu API key.');
        console.error('Error loading Google Maps:', err);
      }
    };

    initMap();
  }, [center.lat, center.lng, zoom, onMapClick]);

  // Actualizar marcadores cuando cambien
  useEffect(() => {
    if (!map || !isLoaded || !isGoogleLoaded || showHeatmap) return; // No mostrar marcadores si se está mostrando heatmap

    try {
      // Limpiar marcadores existentes
      mapMarkers.forEach(marker => marker.setMap(null));

      // Crear nuevos marcadores
      const newMarkers = markers.map((markerData, index) => {
        const marker = new google.maps.Marker({
          position: markerData.position,
          map,
          title: markerData.title,
        });

        if (markerData.info) {
          const infoWindow = new google.maps.InfoWindow({
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
    if (!map || !isLoaded || !isGoogleLoaded || typeof google === 'undefined') return;

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
          const heatmapLayer = new google.maps.visualization.HeatmapLayer({
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
        <div className="text-center p-4">
          <p className="text-red-600 font-medium">Error:</p>
          <p className="text-sm text-gray-600 mt-1">{error}</p>
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