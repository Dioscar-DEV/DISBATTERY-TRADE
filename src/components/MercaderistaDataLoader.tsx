"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/services/auth";
import { offlineManager as offlineDataManager } from "@/services/offlineManager";
import { UserData } from "@/services/auth";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  Download,
  CheckCircle2,
  RefreshCw,
  Wifi,
  WifiOff,
  X,
  LogOut,
} from "lucide-react";

interface DownloadProgress {
  step: string;
  percentage: number;
  message: string;
}

interface DataStats {
  routesCount: number;
  clientsCount: number;
  draftsCount: number;
  pendingOpsCount: number;
  lastSync?: Date;
}

export default function MercaderistaDataLoader() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress>({
    step: "",
    percentage: 0,
    message: "",
  });
  const [dataStats, setDataStats] = useState<DataStats | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<
    "needed" | "optional" | "completed" | "error"
  >("needed");
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? navigator.onLine : true
  );

  // Monitorear conectividad
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Escuchar evento de login exitoso de mercaderista
  useEffect(() => {
    const handleMercaderistaLogin = async (event: CustomEvent) => {
      const userData = event.detail;
      if (userData && userData.role === "Mercaderista") {
        await checkUserAndData();
      }
    };

    // Escuchar evento personalizado de login
    window.addEventListener(
      "mercaderista-login-success",
      handleMercaderistaLogin as unknown as EventListenerOrEventListenerObject
    );

    return () => {
      window.removeEventListener(
        "mercaderista-login-success",
        handleMercaderistaLogin as unknown as EventListenerOrEventListenerObject
      );
    };
  }, []);

  const checkUserAndData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Obtener usuario actual
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        console.log("No hay usuario logueado, redirigiendo...");
        router.push("/");
        return;
      }

      setUser(currentUser);

      // Solo proceder si es mercaderista
      if (currentUser.role !== "Mercaderista") {
        console.log("Usuario no es mercaderista, no necesita datos offline");
        setDownloadStatus("completed");
        setIsLoading(false);
        return;
      }

      // Verificar necesidad de descarga
      const downloadCheck =
        await offlineDataManager.shouldDownloadData(currentUser);

      // Obtener estadísticas actuales
      const stats = await offlineDataManager.getDataStats(currentUser);
      setDataStats(stats);

      if (downloadCheck.needsDownload) {
        setDownloadStatus("needed");

        // Auto-descargar si hay conexión y no hay datos existentes
        if (isOnline && !downloadCheck.hasExistingData) {
          console.log("🚀 Auto-iniciando descarga de datos...");
          await handleDownload();
        }
      } else {
        setDownloadStatus("completed");
      }
    } catch (error) {
      console.error("❌ Error verificando usuario y datos:", error);
      setError(error instanceof Error ? error.message : "Error desconocido");
      setDownloadStatus("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!user || !isOnline) return;

    try {
      setIsDownloading(true);
      setError(null);
      setProgress({
        step: "init",
        percentage: 0,
        message: "Iniciando descarga...",
      });

      const result = await offlineDataManager.forceDownloadData(
        user,
        setProgress
      );

      if (result.success) {
        setDownloadStatus("completed");

        // Actualizar estadísticas
        const newStats = await offlineDataManager.getDataStats(user);
        setDataStats(newStats);

        console.log("✅ Descarga completada exitosamente");
      } else {
        setDownloadStatus("error");
        setError(result.error || "Error en la descarga");
      }
    } catch (error) {
      console.error("❌ Error durante descarga:", error);
      setDownloadStatus("error");
      setError(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setIsDownloading(false);
      setProgress({ step: "", percentage: 0, message: "" });
    }
  };

  const handleContinue = () => {
    // Redirigir según el estado
    if (downloadStatus === "completed" || downloadStatus === "optional") {
      router.push("/mi-ruta");
    }
  };

  const handleClose = () => {
    // Si tiene datos existentes, permitir cerrar
    if (dataStats && dataStats.routesCount > 0) {
      router.push("/mi-ruta");
    }
  };

  const handleLogout = () => {
    // Limpiar datos de usuario y redirigir al login
    localStorage.clear();
    router.push("/");
  };

  // No mostrar nada si está cargando inicialmente
  if (isLoading) {
    return null;
  }

  // No mostrar nada si no es mercaderista o ya está completado
  if (!user || user.role !== "Mercaderista") {
    return null;
  }

  // ✅ SOLUCIÓN DIRECTA: Desactivar el diálogo visualmente para siempre.
  // Al no renderizar el componente modal, evitamos la descarga masiva y el bloqueo de la UI.
  return null;
}
