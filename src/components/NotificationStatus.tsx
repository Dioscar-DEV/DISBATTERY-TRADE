"use client";

import { useNotificationStatus } from "@/hooks/use-notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Settings, CheckCircle, XCircle } from "lucide-react";

/**
 * Componente que muestra el estado actual de las notificaciones
 */
export const NotificationStatus = () => {
  const { hasPermission, isSupported, canReceiveNotifications } =
    useNotificationStatus();

  const handleOpenSettings = () => {
    // Abrir página de pruebas de notificaciones
    window.open("/test-notifications", "_blank");
  };

  const getStatusBadge = () => {
    if (!isSupported) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" />
          No Compatible
        </Badge>
      );
    }

    if (canReceiveNotifications) {
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle className="w-3 h-3" />
          Activo
        </Badge>
      );
    }

    if (hasPermission) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Bell className="w-3 h-3" />
          Configurando
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="gap-1">
        <BellOff className="w-3 h-3" />
        Sin Configurar
      </Badge>
    );
  };

  const getStatusText = () => {
    if (!isSupported) {
      return "Tu navegador no soporta notificaciones push";
    }

    if (canReceiveNotifications) {
      return "Recibirás notificaciones de rutas y actualizaciones";
    }

    if (hasPermission) {
      return "Configuración en progreso...";
    }

    return "Haz clic para configurar notificaciones";
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
      <div className="flex items-center gap-2">
        {canReceiveNotifications ? (
          <Bell className="w-4 h-4 text-green-600" />
        ) : (
          <BellOff className="w-4 h-4 text-gray-400" />
        )}
        <span className="text-sm font-medium">Notificaciones:</span>
        {getStatusBadge()}
      </div>

      <div className="flex-1">
        <p className="text-xs text-gray-600">{getStatusText()}</p>
      </div>

      {!canReceiveNotifications && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleOpenSettings}
          className="gap-1"
        >
          <Settings className="w-3 h-3" />
          Configurar
        </Button>
      )}
    </div>
  );
};

export default NotificationStatus;
