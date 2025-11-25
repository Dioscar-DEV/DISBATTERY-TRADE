/**
 * Componente para mostrar el estado offline y gestionar sincronización
 */

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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  Clock,
  CheckCircle,
  AlertTriangle,
  Download,
  Upload,
  Smartphone,
  Globe,
  Zap,
} from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { postLoginStrategy } from "@/services/postLoginStrategy";
import { getCurrentUser } from "@/services/auth";

interface OfflineStatusManagerProps {
  className?: string;
  compact?: boolean;
}

export default function OfflineStatusManager({
  className = "",
  compact = false,
}: OfflineStatusManagerProps) {
  const {
    isOnline,
    isServiceWorkerReady,
    isSyncing,
    pendingVisitas,
    lastSyncAttempt,
    syncError,
    triggerSync,
    forceSyncThroughSW,
    updateSyncStatus,
    needsSync,
    canSync,
  } = useOfflineSync();

  const [offlineStats, setOfflineStats] = useState<{
    hasData: boolean;
    routesCount: number;
    clientesCount: number;
    lastSync?: Date;
    dataAge?: string;
  }>({
    hasData: false,
    routesCount: 0,
    clientesCount: 0,
  });

  const [isRefreshingData, setIsRefreshingData] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cargar estadísticas offline
  useEffect(() => {
    const loadOfflineStats = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          const stats = await postLoginStrategy.getOfflineStats(user);
          setOfflineStats(stats);
        }
      } catch (error) {
        console.error("Error cargando estadísticas offline:", error);
      }
    };

    loadOfflineStats();
  }, [lastSyncAttempt]);

  // Actualizar estadísticas periódicamente
  useEffect(() => {
    const interval = setInterval(async () => {
      await updateSyncStatus();
    }, 30000); // Cada 30 segundos

    return () => clearInterval(interval);
  }, [updateSyncStatus]);

  const handleManualSync = async () => {
    try {
      const result = await triggerSync();
      if (result.success) {
        console.log(
          `✅ Sincronización exitosa: ${result.processed} procesadas`
        );
      }
    } catch (error) {
      console.error("❌ Error en sincronización manual:", error);
    }
  };

  const handleForceSyncThroughSW = async () => {
    try {
      await forceSyncThroughSW();
    } catch (error) {
      console.error("❌ Error forzando sync a través de SW:", error);
    }
  };

  const handleRefreshOfflineData = async () => {
    setIsRefreshingData(true);
    try {
      const user = await getCurrentUser();
      if (user) {
        const result = await postLoginStrategy.forceDataRefresh(user);
        if (result.success) {
          const stats = await postLoginStrategy.getOfflineStats(user);
          setOfflineStats(stats);
        }
      }
    } catch (error) {
      console.error("❌ Error actualizando datos offline:", error);
    } finally {
      setIsRefreshingData(false);
    }
  };

  const getConnectionIcon = () => {
    if (!mounted) {
      return <Wifi className="w-4 h-4 text-gray-400" />;
    }

    if (isOnline) {
      return <Wifi className="w-4 h-4 text-green-500" />;
    } else {
      return <WifiOff className="w-4 h-4 text-red-500" />;
    }
  };

  const getConnectionStatus = () => {
    if (!mounted) {
      return { text: "Conexión...", color: "bg-gray-100 text-gray-800" };
    }

    if (isOnline) {
      return { text: "Conectado", color: "bg-green-100 text-green-800" };
    } else {
      return { text: "Sin conexión", color: "bg-red-100 text-red-800" };
    }
  };

  const getSyncStatus = () => {
    if (isSyncing) {
      return { text: "Sincronizando...", color: "bg-blue-100 text-blue-800" };
    } else if (pendingVisitas > 0) {
      return {
        text: `${pendingVisitas} pendientes`,
        color: "bg-yellow-100 text-yellow-800",
      };
    } else {
      return { text: "Sincronizado", color: "bg-green-100 text-green-800" };
    }
  };

  if (compact) {
    if (isOnline) return null;

    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {getConnectionIcon()}
        <Badge variant="outline" className={getConnectionStatus().color}>
          {getConnectionStatus().text}
        </Badge>
        {pendingVisitas > 0 && (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
            {pendingVisitas} pendientes
          </Badge>
        )}
        {canSync && needsSync && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="text-xs"
          >
            <Upload className="w-3 h-3 mr-1" />
            Sincronizar
          </Button>
        )}
      </div>
    );
  }

  return !isOnline && mounted ? (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5" />
            <span>Estado Offline</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            {getConnectionIcon()}
            <Badge className={getConnectionStatus().color}>
              {getConnectionStatus().text}
            </Badge>
          </div>
        </div>
        <CardDescription>
          Gestión de datos offline y sincronización automática
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Estado de conexión y Service Worker */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-gray-500" />
            <span className="text-sm">Conexión:</span>
            <Badge variant="outline" className={getConnectionStatus().color}>
              {getConnectionStatus().text}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-gray-500" />
            <span className="text-sm">Service Worker:</span>
            <Badge
              variant="outline"
              className={
                isServiceWorkerReady
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }
            >
              {isServiceWorkerReady ? "Activo" : "Inicializando..."}
            </Badge>
          </div>
        </div>

        {/* Datos offline disponibles */}
        {offlineStats.hasData && (
          <div className="bg-blue-50 p-3 rounded-md">
            <div className="flex items-center space-x-2 mb-2">
              <Database className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-800">
                Datos Offline Disponibles
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
              <div>📍 {offlineStats.routesCount} rutas</div>
              <div>👥 {offlineStats.clientesCount} clientes</div>
              {offlineStats.lastSync && (
                <div className="col-span-2">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Última actualización:{" "}
                  {mounted ? offlineStats.dataAge || "reciente" : "reciente"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Estado de sincronización */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Sincronización</span>
            <Badge className={getSyncStatus().color}>
              {getSyncStatus().text}
            </Badge>
          </div>

          {isSyncing && (
            <div className="space-y-1">
              <Progress value={undefined} className="w-full h-2" />
              <p className="text-xs text-gray-500">
                Subiendo visitas pendientes...
              </p>
            </div>
          )}

          {syncError && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {syncError}
              </AlertDescription>
            </Alert>
          )}

          {lastSyncAttempt && (
            <p className="text-xs text-gray-500">
              Último intento:{" "}
              {mounted
                ? lastSyncAttempt.toLocaleString()
                : lastSyncAttempt.toISOString()}
            </p>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualSync}
            disabled={isSyncing || !canSync}
            className="flex-1"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isSyncing ? "Sincronizando..." : "Sincronizar Ahora"}
          </Button>

          {isServiceWorkerReady && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleForceSyncThroughSW}
              disabled={isSyncing}
            >
              <Zap className="w-4 h-4 mr-2" />
              Forzar SW
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleRefreshOfflineData}
            disabled={isRefreshingData || !isOnline}
            className="flex-1"
          >
            <Download className="w-4 h-4 mr-2" />
            {isRefreshingData ? "Actualizando..." : "Actualizar Datos"}
          </Button>
        </div>

        {/* Información adicional */}
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center space-x-1">
            <CheckCircle className="w-3 h-3" />
            <span>La sincronización es automática cuando hay conexión</span>
          </div>
          <div className="flex items-center space-x-1">
            <Database className="w-3 h-3" />
            <span>Los datos se almacenan localmente para uso offline</span>
          </div>
          {!offlineStats.hasData && isOnline && (
            <div className="flex items-center space-x-1 text-blue-600">
              <Download className="w-3 h-3" />
              <span>
                Actualiza los datos para habilitar funcionalidad offline
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  ) : null;
}
