"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Camera,
  MapPin,
} from "lucide-react";

interface PermissionStatus {
  camera: "granted" | "denied" | "prompt" | "unknown";
  location: "granted" | "denied" | "prompt" | "unknown";
}

interface PermissionCheckerProps {
  onPermissionsReady?: (permissions: PermissionStatus) => void;
  showLocationCheck?: boolean;
  showCameraCheck?: boolean;
  autoRequest?: boolean;
}

export function PermissionChecker({
  onPermissionsReady,
  showLocationCheck = true,
  showCameraCheck = true,
  autoRequest = false,
}: PermissionCheckerProps) {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    camera: "unknown",
    location: "unknown",
  });
  const [isChecking, setIsChecking] = useState(false);
  const attemptedAutoRequest = { current: false } as { current: boolean };

  // Verificar permisos al cargar
  useEffect(() => {
    checkAllPermissions();
  }, []);

  // Llamar a onPermissionsReady cuando cambien los permisos
  useEffect(() => {
    onPermissionsReady?.(permissions);
  }, [permissions, onPermissionsReady]);

  const checkAllPermissions = async () => {
    const newPermissions: PermissionStatus = {
      camera: "unknown",
      location: "unknown",
    };

    // Verificar cámara
    if (showCameraCheck && "permissions" in navigator) {
      try {
        const cameraPermission = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        newPermissions.camera = cameraPermission.state;

        // Escuchar cambios de permisos
        cameraPermission.onchange = () => {
          setPermissions((prev) => ({
            ...prev,
            camera: cameraPermission.state,
          }));
        };
      } catch (error) {
        console.log("No se pudo verificar permiso de cámara:", error);
        newPermissions.camera = "unknown";
      }
    }

    // Verificar ubicación
    if (showLocationCheck && "permissions" in navigator) {
      try {
        const locationPermission = await navigator.permissions.query({
          name: "geolocation" as PermissionName,
        });
        newPermissions.location = locationPermission.state;

        // Escuchar cambios de permisos
        locationPermission.onchange = () => {
          setPermissions((prev) => ({
            ...prev,
            location: locationPermission.state,
          }));
        };
      } catch (error) {
        console.log("No se pudo verificar permiso de ubicación:", error);
        newPermissions.location = "unknown";
      }
    }

    setPermissions(newPermissions);
    onPermissionsReady?.(newPermissions);

    // Si está permitido intentar pedir permisos automáticamente, y no lo hemos intentado aún,
    // intentar solicitar los permisos en estado 'prompt' o 'unknown'. Algunos navegadores
    // pueden bloquear solicitudes automáticas sin interacción del usuario; en ese caso
    // los botones seguirán disponibles para que el usuario acepte manualmente.
    if (autoRequest && !attemptedAutoRequest.current) {
      attemptedAutoRequest.current = true;
      // Intentar primero ubicación (puede lanzar prompt sin gesto en muchos navegadores)
      if (
        showLocationCheck &&
        (newPermissions.location === "prompt" ||
          newPermissions.location === "unknown")
      ) {
        // Slight delay to ensure UI mounted
        setTimeout(() => {
          requestLocationPermission().catch(() => {});
        }, 300);
      }

      // Luego intentar cámara (muchos navegadores requieren gesto, puede ser bloqueado)
      if (
        showCameraCheck &&
        (newPermissions.camera === "prompt" ||
          newPermissions.camera === "unknown")
      ) {
        setTimeout(() => {
          requestCameraPermission().catch(() => {});
        }, 800);
      }
    }
  };

  const requestCameraPermission = async () => {
    setIsChecking(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop()); // Detener el stream inmediatamente
      setPermissions((prev) => ({ ...prev, camera: "granted" }));
    } catch (error: unknown) {
      // Detectar NotAllowedError (bloqueado por navegador o denegado por usuario)
      if (error && typeof error === "object" && "name" in error) {
        const domError = error as { name: string; message: string };
        if (domError.name === "NotAllowedError") {
          // El usuario denegó el permiso o el navegador lo bloqueó
          console.warn(
            "⚠️ Permiso de cámara no permitido - denegado por usuario o bloqueado por navegador"
          );
          setPermissions((prev) => ({ ...prev, camera: "denied" }));
        } else {
          // Otro tipo de error (NotFoundError, etc.)
          console.error(
            "Error solicitando permiso de cámara:",
            domError.message
          );
          setPermissions((prev) => ({ ...prev, camera: "denied" }));
        }
      } else {
        console.error("Error inesperado solicitando permiso de cámara:", error);
        setPermissions((prev) => ({ ...prev, camera: "denied" }));
      }
    } finally {
      setIsChecking(false);
    }
  };

  const requestLocationPermission = async () => {
    setIsChecking(true);
    try {
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000, // Reducido a 5 segundos para mejor UX
          enableHighAccuracy: true,
          maximumAge: 0, // No usar ubicación en caché
        });
      });
      setPermissions((prev) => ({ ...prev, location: "granted" }));
    } catch (error: unknown) {
      // Manejar error de geolocalización con información detallada
      if (error && typeof error === "object" && "code" in error) {
        const geoError = error as GeolocationPositionError;
        switch (geoError.code) {
          case 1: // GeolocationPositionError.PERMISSION_DENIED
            console.warn("⚠️ Permiso de ubicación denegado por el usuario");
            setPermissions((prev) => ({ ...prev, location: "denied" }));
            break;
          case 2: // GeolocationPositionError.POSITION_UNAVAILABLE
            console.warn(
              "⚠️ Ubicación no disponible - GPS apagado o sin señal"
            );
            // No cambiar el estado a 'denied' porque el permiso puede estar concedido
            // El usuario puede reintentar cuando tenga señal
            break;
          case 3: // GeolocationPositionError.TIMEOUT
            console.warn(
              "⏱️ Timeout al obtener ubicación (5s) - señal GPS débil o lenta"
            );
            // Timeout no significa que el permiso fue denegado
            // El usuario puede reintentar
            break;
          default:
            console.error(
              "Error desconocido de geolocalización:",
              geoError.message
            );
            setPermissions((prev) => ({ ...prev, location: "denied" }));
        }
      } else {
        // Error genérico sin estructura de GeolocationPositionError
        console.error(
          "Error inesperado solicitando permiso de ubicación:",
          error
        );
        setPermissions((prev) => ({ ...prev, location: "denied" }));
      }
    } finally {
      setIsChecking(false);
    }
  };

  const getPermissionIcon = (status: string) => {
    switch (status) {
      case "granted":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "denied":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "prompt":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getPermissionText = (status: string) => {
    switch (status) {
      case "granted":
        return "Permitido ✅";
      case "denied":
        return "Denegado ❌";
      case "prompt":
        return "Pendiente ⏳";
      default:
        return "Verificando...";
    }
  };

  const allPermissionsGranted =
    (!showCameraCheck || permissions.camera === "granted") &&
    (!showLocationCheck || permissions.location === "granted");

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-blue-500" />
          Permisos Requeridos
        </CardTitle>
        <CardDescription>
          Para usar todas las funciones de la app, necesitamos estos permisos:
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCameraCheck && (
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Camera className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium">Cámara</p>
                <p className="text-sm text-muted-foreground">
                  Para tomar fotos de visitas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getPermissionIcon(permissions.camera)}
              <span className="text-sm font-medium">
                {getPermissionText(permissions.camera)}
              </span>
            </div>
          </div>
        )}

        {showLocationCheck && (
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">Ubicación</p>
                <p className="text-sm text-muted-foreground">
                  Para registrar coordenadas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getPermissionIcon(permissions.location)}
              <span className="text-sm font-medium">
                {getPermissionText(permissions.location)}
              </span>
            </div>
          </div>
        )}

        {!allPermissionsGranted && (
          <div className="space-y-2">
            {showCameraCheck && permissions.camera !== "granted" && (
              <Button
                onClick={requestCameraPermission}
                disabled={isChecking}
                className="w-full"
                variant="outline"
              >
                <Camera className="mr-2 h-4 w-4" />
                {isChecking ? "Solicitando..." : "Activar Cámara"}
              </Button>
            )}

            {showLocationCheck && permissions.location !== "granted" && (
              <Button
                onClick={requestLocationPermission}
                disabled={isChecking}
                className="w-full"
                variant="outline"
              >
                <MapPin className="mr-2 h-4 w-4" />
                {isChecking ? "Solicitando..." : "Activar Ubicación"}
              </Button>
            )}
          </div>
        )}

        {allPermissionsGranted && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              ✅ Todos los permisos están activados. ¡Ya puedes usar la app
              completamente!
            </AlertDescription>
          </Alert>
        )}

        {(permissions.camera === "denied" ||
          permissions.location === "denied") && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              ⚠️ Algunos permisos fueron denegados. Ve a configuración de tu
              navegador y actívalos manualmente.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
