"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNotifications, useNotificationStatus } from '@/hooks/use-notifications';
import { showLocalNotification } from '@/services/notifications';
import { Bell, BellOff, TestTube, CheckCircle, XCircle } from 'lucide-react';

/**
 * Componente para probar el sistema de notificaciones
 */
export const NotificationTester = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { hasPermission, isSupported, canReceiveNotifications } = useNotificationStatus();
  const { requestPermission, initializeNotifications } = useNotifications({ autoSetup: false });

  const handleRequestPermission = async () => {
    setIsLoading(true);
    try {
      await requestPermission();
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitializeNotifications = async () => {
    setIsLoading(true);
    try {
      await initializeNotifications();
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestLocalNotification = () => {
    showLocalNotification({
      title: '🧪 Prueba de Notificación Local',
      body: 'Esta es una notificación de prueba generada localmente.',
      icon: '/icon-base.svg',
      data: {
        type: 'test',
        timestamp: Date.now()
      }
    });
  };

  const handleTestRouteNotification = () => {
    showLocalNotification({
      title: '🗺️ Nueva Ruta Asignada',
      body: 'Tienes una nueva ruta para hoy con 3 puntos de visita. ¡Toca para verla!',
      icon: '/icon-base.svg',
      data: {
        type: 'nueva-ruta',
        routeId: 'test-route-123',
        puntos: 3
      }
    });
  };

  const handleTestCompletedNotification = () => {
    showLocalNotification({
      title: '✅ Ruta Completada',
      body: 'Juan Pérez ha completado su ruta del 15/12/2024 con 5 puntos de visita.',
      icon: '/icon-base.svg',
      data: {
        type: 'ruta-completada',
        mercaderista: 'Juan Pérez',
        fecha: '15/12/2024',
        puntos: 5
      }
    });
  };

  const handleTestServiceWorkerNotification = () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        payload: {
          title: '🔧 Prueba desde Service Worker',
          body: 'Esta notificación fue enviada desde el Service Worker.',
          icon: '/icon-base.svg',
          data: {
            type: 'sw-test',
            timestamp: Date.now()
          }
        }
      });
    } else {
      alert('Service Worker no está activo');
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="w-5 h-5" />
          Prueba de Notificaciones Push
        </CardTitle>
        <CardDescription>
          Herramienta para probar el sistema de notificaciones de la PWA
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Estado del Sistema */}
        <div className="space-y-3">
          <h3 className="font-medium">Estado del Sistema</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant={isSupported ? "default" : "destructive"}>
              {isSupported ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Navegador Compatible
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1" />
                  No Compatible
                </>
              )}
            </Badge>

            <Badge variant={hasPermission ? "default" : "secondary"}>
              {hasPermission ? (
                <>
                  <Bell className="w-3 h-3 mr-1" />
                  Permisos Concedidos
                </>
              ) : (
                <>
                  <BellOff className="w-3 h-3 mr-1" />
                  Sin Permisos
                </>
              )}
            </Badge>

            <Badge variant={canReceiveNotifications ? "default" : "outline"}>
              {canReceiveNotifications ? 'Listo para Recibir' : 'No Configurado'}
            </Badge>
          </div>
        </div>

        {/* Configuración */}
        <div className="space-y-3">
          <h3 className="font-medium">Configuración</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleRequestPermission}
              disabled={isLoading || hasPermission}
              variant={hasPermission ? "outline" : "default"}
              size="sm"
            >
              {hasPermission ? 'Permisos Ya Concedidos' : 'Solicitar Permisos'}
            </Button>

            <Button
              onClick={handleInitializeNotifications}
              disabled={isLoading || !hasPermission}
              variant="secondary"
              size="sm"
            >
              Inicializar Sistema
            </Button>
          </div>
        </div>

        {/* Pruebas de Notificación */}
        <div className="space-y-3">
          <h3 className="font-medium">Pruebas de Notificación</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Button
              onClick={handleTestLocalNotification}
              disabled={!canReceiveNotifications}
              variant="outline"
              size="sm"
              className="justify-start"
            >
              🧪 Prueba Local
            </Button>

            <Button
              onClick={handleTestRouteNotification}
              disabled={!canReceiveNotifications}
              variant="outline"
              size="sm"
              className="justify-start"
            >
              🗺️ Nueva Ruta (Mercaderista)
            </Button>

            <Button
              onClick={handleTestCompletedNotification}
              disabled={!canReceiveNotifications}
              variant="outline"
              size="sm"
              className="justify-start"
            >
              ✅ Ruta Completada (Admin)
            </Button>

            <Button
              onClick={handleTestServiceWorkerNotification}
              disabled={!canReceiveNotifications}
              variant="outline"
              size="sm"
              className="justify-start"
            >
              🔧 Desde Service Worker
            </Button>
          </div>
        </div>

        {/* Información Adicional */}
        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
          <p className="font-medium mb-1">Notas importantes:</p>
          <ul className="space-y-1 text-xs">
            <li>• Las notificaciones requieren HTTPS o localhost</li>
            <li>• Algunos navegadores bloquean notificaciones automáticas</li>
            <li>• Las notificaciones push reales requieren el backend de Firebase</li>
            <li>• En PWAs instaladas, las notificaciones funcionan mejor</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationTester;