"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Navigation, Search } from "lucide-react";
import { GoogleMaps } from "@/components/ui/google-maps";

interface MapSelectorProps {
  onPositionSelect: (position: { lat: number; lng: number }) => void;
  initialPosition?: { lat: number; lng: number };
  className?: string;
}

export function MapSelector({
  onPositionSelect,
  initialPosition,
  className,
}: MapSelectorProps) {
  const [searchAddress, setSearchAddress] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(initialPosition || null);
  const [isLoading, setIsLoading] = useState(false);
  const [mapKey, setMapKey] = useState(0); // Para forzar re-render del mapa

  // Posiciones predefinidas para Venezuela
  const predefinedLocations = [
    { name: "Caracas", lat: 10.4806, lng: -66.9036 },
    { name: "Valencia", lat: 10.1579, lng: -67.9972 },
    { name: "Maracaibo", lat: 10.6427, lng: -71.6125 },
    { name: "Barquisimeto", lat: 10.067, lng: -69.3467 },
    { name: "Maracay", lat: 10.2469, lng: -67.5958 },
    { name: "Puerto La Cruz", lat: 10.2138, lng: -64.6328 },
    { name: "Ciudad Guayana", lat: 8.3536, lng: -62.641 },
    { name: "San Cristóbal", lat: 7.7669, lng: -72.225 },
  ];

  useEffect(() => {
    if (initialPosition) {
      setSelectedPosition(initialPosition);
    }
  }, [initialPosition]);

  // Forzar re-render del mapa cuando el componente se monta (fix para dialogs)
  useEffect(() => {
    console.log("🗺️ MapSelector montado - iniciando carga del mapa");
    const timer = setTimeout(() => {
      console.log("🗺️ Forzando re-render del mapa para fix de dialog");
      setMapKey((prev) => prev + 1);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleLocationSelect = (lat: number, lng: number) => {
    const position = { lat, lng };
    setSelectedPosition(position);
    onPositionSelect(position);
  };

  const handleManualCoordinates = () => {
    const coords = searchAddress
      .split(",")
      .map((coord) => parseFloat(coord.trim()));
    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
      const position = { lat: coords[0], lng: coords[1] };
      setSelectedPosition(position);
      onPositionSelect(position);
    } else {
      alert(
        "Por favor ingresa las coordenadas en formato: latitud, longitud (ej: 10.4806, -66.9036)"
      );
    }
  };

  const getCurrentLocation = () => {
    setIsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setSelectedPosition(pos);
          onPositionSelect(pos);
          setIsLoading(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("No se pudo obtener tu ubicación actual");
          setIsLoading(false);
        }
      );
    } else {
      alert("Tu navegador no soporta geolocalización");
      setIsLoading(false);
    }
  };

  // Manejar clic en el mapa
  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      const position = { lat, lng };
      console.log("🗺️ Posición seleccionada en el mapa:", position);
      setSelectedPosition(position);
      onPositionSelect(position);
    }
  };

  // Preparar marcadores para mostrar la ubicación seleccionada
  const markers = selectedPosition
    ? [
        {
          position: selectedPosition,
          title: "Ubicación del Cliente",
          info: "Ubicación seleccionada",
        },
      ]
    : [];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Seleccionar Ubicación
        </CardTitle>
        <CardDescription>
          Haz clic en el mapa para seleccionar la ubicación exacta del cliente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ubicación actual */}
        <div>
          <Button
            onClick={getCurrentLocation}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            <Navigation className="w-4 h-4 mr-2" />
            {isLoading ? "Obteniendo ubicación..." : "Usar mi ubicación actual"}
          </Button>
        </div>

        {/* Coordenadas manuales */}
        <div className="space-y-2">
          <Label htmlFor="coordinates">Coordenadas (latitud, longitud)</Label>
          <div className="flex gap-2">
            <Input
              id="coordinates"
              placeholder="10.4806, -66.9036"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
            />
            <Button onClick={handleManualCoordinates} variant="outline">
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Ubicaciones predefinidas */}
        <div>
          <Label>Ubicaciones predefinidas</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {predefinedLocations.map((location) => (
              <Button
                key={location.name}
                variant="outline"
                size="sm"
                onClick={() => handleLocationSelect(location.lat, location.lng)}
                className={`text-xs ${
                  selectedPosition?.lat === location.lat &&
                  selectedPosition?.lng === location.lng
                    ? "bg-blue-100 border-blue-300"
                    : ""
                }`}
              >
                {location.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Mapa interactivo de Google Maps */}
        <div className="space-y-2">
          <Label>Mapa Interactivo - Haz clic donde está el cliente</Label>
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <GoogleMaps
              key={mapKey} // Forzar re-render cuando sea necesario
              center={selectedPosition || { lat: 10.4806, lng: -66.9036 }}
              zoom={selectedPosition ? 16 : 10}
              height="400px" // Aumenté la altura
              markers={markers}
              onMapClick={handleMapClick}
            />
          </div>
          {!selectedPosition && (
            <p className="text-sm text-gray-500 text-center">
              👆 Haz clic en el mapa para marcar la ubicación del cliente
            </p>
          )}
        </div>

        {/* Ubicación seleccionada */}
        {selectedPosition && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800">
              ✅ Ubicación seleccionada:
            </p>
            <p className="text-xs text-green-600">
              Latitud: {selectedPosition.lat.toFixed(6)}, Longitud:{" "}
              {selectedPosition.lng.toFixed(6)}
            </p>
            <p className="text-xs text-green-600 mt-1">
              💡 Puedes hacer clic en otra parte del mapa para cambiar la
              ubicación
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
