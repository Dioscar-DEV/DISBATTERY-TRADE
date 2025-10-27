'use client';

import { useEffect, useState } from 'react';
import { PermissionChecker } from './PermissionChecker';

interface PermissionStatus {
  camera: 'granted' | 'denied' | 'prompt' | 'unknown';
  location: 'granted' | 'denied' | 'prompt' | 'unknown';
}

export function PermissionInitializer() {
  const [showPermissionChecker, setShowPermissionChecker] = useState(false);
  const [permissionsChecked, setPermissionsChecked] = useState(false);

  useEffect(() => {
    // Solo verificar permisos en el navegador
    if (typeof window === 'undefined') return;

    // Verificar si ya se verificaron los permisos en esta sesión
    const permissionsAlreadyChecked = sessionStorage.getItem('permissions_checked');
    if (permissionsAlreadyChecked) {
      setPermissionsChecked(true);
      return;
    }

    // Verificar permisos automáticamente
    checkPermissionsStatus();
  }, []);

  const checkPermissionsStatus = async () => {
    try {
      let needsPermissions = false;

      // Verificar cámara
      if ('permissions' in navigator) {
        try {
          const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (cameraPermission.state === 'prompt' || cameraPermission.state === 'denied') {
            needsPermissions = true;
          }
        } catch (error) {
          // Si no se puede verificar, asumir que necesita permisos
          needsPermissions = true;
        }

        // Verificar ubicación
        try {
          const locationPermission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (locationPermission.state === 'prompt' || locationPermission.state === 'denied') {
            needsPermissions = true;
          }
        } catch (error) {
          // Si no se puede verificar, asumir que necesita permisos
          needsPermissions = true;
        }
      } else {
        // Navegador sin soporte para Permissions API
        needsPermissions = true;
      }

      if (needsPermissions) {
        setShowPermissionChecker(true);
      } else {
        // Marcar como verificado
        sessionStorage.setItem('permissions_checked', 'true');
        setPermissionsChecked(true);
      }
    } catch (error) {
      console.warn('Error checking permissions:', error);
      // En caso de error, mostrar el checker por seguridad
      setShowPermissionChecker(true);
    }
  };

  const handlePermissionsReady = (permissions: PermissionStatus) => {
    // Si ambos permisos están concedidos, ocultar el checker
    if (permissions.camera === 'granted' && permissions.location === 'granted') {
      sessionStorage.setItem('permissions_checked', 'true');
      setShowPermissionChecker(false);
      setPermissionsChecked(true);
    }
  };

  // No mostrar nada si ya se verificaron los permisos
  if (permissionsChecked && !showPermissionChecker) {
    return null;
  }

  // Mostrar el checker de permisos si es necesario
  if (showPermissionChecker) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-center">
              Configuración Inicial
            </h2>
            <p className="text-sm text-muted-foreground mb-6 text-center">
              Para usar todas las funciones de la aplicación, necesitamos configurar algunos permisos.
            </p>
            <PermissionChecker
              onPermissionsReady={handlePermissionsReady}
              showLocationCheck={true}
              showCameraCheck={true}
              // Intentar solicitar permisos automáticamente cuando se muestre
              autoRequest={true}
            />
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  sessionStorage.setItem('permissions_checked', 'true');
                  setShowPermissionChecker(false);
                  setPermissionsChecked(true);
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Continuar sin configurar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
