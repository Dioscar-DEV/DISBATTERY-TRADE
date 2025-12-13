/**
 * 🎯 COMPONENTE DE PROGRESO DE GUARDADO
 *
 * Muestra el progreso del guardado offline/online con feedback visual claro
 * para mejorar la UX y evitar que el usuario se sienta "atascado"
 */

"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw,
  Database,
} from "lucide-react";
import { offlineManager, type SyncProgress } from "@/services/offlineManager";
import { useOfflineSync } from "@/hooks/useOfflineSync";

interface SaveProgressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (success: boolean, visitaId?: string) => void;
  visitaData?: any;
}

type SaveState =
  | "idle"
  | "validating"
  | "compressing"
  | "uploading"
  | "saving"
  | "success"
  | "error"
  | "offline_saved";

export default function SaveProgressDialog({
  isOpen,
  onClose,
  onComplete,
  visitaData,
}: SaveProgressDialogProps) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [visitaId, setVisitaId] = useState<string | undefined>(undefined);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  // 🆕 Integrar useOfflineSync completo para funcionalidades avanzadas
  const {
    isOnline,
    isServiceWorkerReady,
    isSyncing: isAutoSyncing,
    pendingVisitas,
    lastSyncAttempt,
    syncError: autoSyncError,
    triggerSync,
    forceSyncThroughSW,
    canSync,
    needsSync,
  } = useOfflineSync();

  // El estado de conexión ahora viene del hook useOfflineSync

  // Suscribirse a actualizaciones de progreso de sincronización
  useEffect(() => {
    const unsubscribe = offlineManager.onProgress((progress) => {
      setSyncProgress(progress);
    });

    return unsubscribe;
  }, []);

  // Iniciar guardado cuando se abra el diálogo
  useEffect(() => {
    if (isOpen && visitaData && saveState === "idle") {
      handleSave();
    }
  }, [isOpen, visitaData, saveState]);

  const handleSave = async () => {
    if (!visitaData) return;

    try {
      setSaveState("validating");
      setCurrentStep("Validando datos...");
      setProgress(10);

      // Simular validación
      await new Promise((resolve) => setTimeout(resolve, 500));

      setSaveState("compressing");
      setCurrentStep("Comprimiendo imágenes...");
      setProgress(30);

      // Simular compresión
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (isOnline) {
        setSaveState("uploading");
        setCurrentStep("Subiendo imágenes...");
        setProgress(60);

        // Simular subida
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      setSaveState("saving");
      setCurrentStep(
        isOnline ? "Guardando en servidor..." : "Guardando localmente..."
      );
      setProgress(80);

      // Guardar usando el OfflineManager
      const result = await offlineManager.saveVisita(visitaData);

      if (result.success) {
        setVisitaId(result.visitaId);
        setSaveState(result.isOffline ? "offline_saved" : "success");
        setProgress(100);
        setCurrentStep(
          result.isOffline ? "Guardado offline exitoso" : "Guardado exitoso"
        );

        // Limpiar datos después del guardado exitoso
        offlineManager.cleanupAfterSave();

        // Notificar éxito después de un breve delay
        setTimeout(() => {
          onComplete(true, result.visitaId || undefined);
        }, 1500);
      } else {
        throw new Error(result.error || "Error desconocido");
      }
    } catch (error) {
      console.error("❌ Error en guardado:", error);
      setSaveState("error");
      setError(error instanceof Error ? error.message : "Error desconocido");
      setCurrentStep("Error al guardar");
    }
  };

  const handleRetry = () => {
    setSaveState("idle");
    setProgress(0);
    setError(null);
    setCurrentStep("");
    handleSave();
  };

  const handleClose = () => {
    if (saveState === "success" || saveState === "offline_saved") {
      onComplete(true, visitaId);
    } else if (saveState === "error") {
      onComplete(false);
    }
    onClose();
  };

  const getStateIcon = () => {
    switch (saveState) {
      case "success":
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case "offline_saved":
        return <CheckCircle className="h-8 w-8 text-blue-500" />;
      case "error":
        return <AlertCircle className="h-8 w-8 text-red-500" />;
      default:
        return <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />;
    }
  };

  const getStateTitle = () => {
    switch (saveState) {
      case "success":
        return "¡Guardado Exitoso!";
      case "offline_saved":
        return "¡Guardado Offline!";
      case "error":
        return "Error al Guardar";
      default:
        return "Guardando Visita...";
    }
  };

  const getStateDescription = () => {
    switch (saveState) {
      case "success":
        return "Los datos se han guardado correctamente en el servidor.";
      case "offline_saved":
        return "Los datos se han guardado en su dispositivo y se sincronizarán automáticamente cuando recupere la conexión.";
      case "error":
        return error || "Hubo un problema al guardar los datos.";
      default:
        return "Por favor espere mientras procesamos su visita...";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {getStateIcon()}
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-orange-500" />
              )}
              <span className="text-sm text-muted-foreground">
                {isOnline ? "En línea" : "Sin conexión"}
              </span>
            </div>
          </div>
          <DialogTitle>{getStateTitle()}</DialogTitle>
          <DialogDescription>{getStateDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progreso principal */}
          {saveState !== "success" &&
            saveState !== "offline_saved" &&
            saveState !== "error" && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{currentStep}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}

          {/* Progreso de sincronización */}
          {syncProgress && syncProgress.total > 0 && (
            <div className="space-y-2 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-blue-800">
                Sincronizando visitas pendientes
              </div>
              <div className="flex justify-between text-sm text-blue-600">
                <span>{syncProgress.current || "Procesando..."}</span>
                <span>
                  {syncProgress.processed}/{syncProgress.total}
                </span>
              </div>
              <Progress
                value={(syncProgress.processed / syncProgress.total) * 100}
                className="w-full"
              />
              {syncProgress.errors > 0 && (
                <div className="text-xs text-red-600">
                  {syncProgress.errors} error(es) encontrado(s)
                </div>
              )}
            </div>
          )}

          {/* Estado de sincronización automática */}
          {(pendingVisitas > 0 || isAutoSyncing) && (
            <div className="space-y-2 p-3 bg-amber-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  Sistema de Sincronización
                </span>
              </div>
              <div className="text-xs text-amber-700 space-y-1">
                {pendingVisitas > 0 && (
                  <div>
                    📊 {pendingVisitas} visita(s) pendiente(s) de sincronizar
                  </div>
                )}
                {isAutoSyncing && (
                  <div className="flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Sincronización automática en progreso...
                  </div>
                )}
                {isServiceWorkerReady && (
                  <div>
                    ⚡ Service Worker activo para sincronización en segundo
                    plano
                  </div>
                )}
                {lastSyncAttempt && (
                  <div>
                    🕒 Último intento: {lastSyncAttempt.toLocaleTimeString()}
                  </div>
                )}
                {autoSyncError && (
                  <div className="text-red-600">❌ Error: {autoSyncError}</div>
                )}
              </div>
            </div>
          )}

          {/* Información adicional para guardado offline */}
          {saveState === "offline_saved" && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>Modo Offline Activado</strong>
              </div>
              <div className="text-xs text-blue-600 mt-1">
                • Los datos están seguros en su dispositivo
                <br />
                • Se sincronizarán automáticamente cuando haya conexión
                <br />• Puede continuar trabajando normalmente
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex flex-col gap-2 pt-4">
            <div className="flex gap-2">
              {saveState === "error" && (
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  className="flex-1"
                >
                  Reintentar
                </Button>
              )}

              {(saveState === "success" ||
                saveState === "offline_saved" ||
                saveState === "error") && (
                <Button
                  onClick={handleClose}
                  className={`flex-1 ${saveState !== "error" ? "bg-gradient-to-r from-brand-blue to-brand-red text-white hover:opacity-90" : ""}`}
                >
                  {saveState === "error" ? "Cerrar" : "Continuar"}
                </Button>
              )}
            </div>

            {/* 🆕 Botones adicionales para funcionalidades avanzadas */}
            {(saveState === "success" || saveState === "offline_saved") && (
              <div className="flex gap-2 pt-2 border-t">
                {canSync && needsSync && (
                  <Button
                    onClick={triggerSync}
                    variant="outline"
                    size="sm"
                    disabled={isAutoSyncing}
                    className="flex-1 text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Sincronizar Pendientes
                  </Button>
                )}

                {isServiceWorkerReady && (
                  <Button
                    onClick={forceSyncThroughSW}
                    variant="outline"
                    size="sm"
                    disabled={isAutoSyncing}
                    className="flex-1 text-xs"
                  >
                    ⚡ Forzar SW
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* ID de visita para referencia */}
          {visitaId && (
            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              ID de visita: {visitaId}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
