import { useState, useCallback } from "react";
import {
  exportService,
  ExportFilters,
  ExportOptions,
  ExportResult,
} from "@/services/exportService";
import { useToast } from "@/hooks/use-toast";

interface UseExportDataReturn {
  // Estados
  isExporting: boolean;
  progress: number;
  estadisticas: any;

  // Funciones
  exportarVisitas: (
    filtros: ExportFilters,
    opciones: ExportOptions
  ) => Promise<ExportResult>;
  obtenerEstadisticas: (filtros?: ExportFilters) => Promise<void>;
  descargarArchivo: (data: any, filename: string, mimeType: string) => void;

  // Utilidades
  resetProgress: () => void;
}

/**
 * Hook personalizado para manejar la exportación de datos
 * Proporciona una interfaz simplificada para el sistema de exportación
 */
export function useExportData(): UseExportDataReturn {
  const { toast } = useToast();

  // Estados
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [estadisticas, setEstadisticas] = useState<any>(null);

  /**
   * Exporta visitas con filtros y opciones específicas
   */
  const exportarVisitas = useCallback(
    async (
      filtros: ExportFilters,
      opciones: ExportOptions
    ): Promise<ExportResult> => {
      setIsExporting(true);
      setProgress(0);

      try {
        // Simular progreso durante la exportación
        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + 10, 90));
        }, 200);

        const resultado = await exportService.exportarVisitas(
          filtros,
          opciones
        );

        clearInterval(progressInterval);
        setProgress(100);

        if (resultado.success) {
          toast({
            title: "✅ Exportación exitosa",
            description: `Se exportaron ${
              resultado.processedRecords
            } registros en formato ${opciones.formato.toUpperCase()}`,
          });
        } else {
          toast({
            title: "❌ Error en exportación",
            description: resultado.error || "Error desconocido",
            variant: "destructive",
          });
        }

        return resultado;
      } catch (error) {
        console.error("Error en exportación:", error);
        toast({
          title: "❌ Error en exportación",
          description: "Error inesperado durante la exportación",
          variant: "destructive",
        });

        return {
          success: false,
          error: error instanceof Error ? error.message : "Error desconocido",
          totalRecords: 0,
          processedRecords: 0,
        };
      } finally {
        setIsExporting(false);
        // Mantener progreso por un momento antes de resetear
        setTimeout(() => setProgress(0), 1000);
      }
    },
    [toast]
  );

  /**
   * Obtiene estadísticas de exportación
   */
  const obtenerEstadisticas = useCallback(
    async (filtros?: ExportFilters): Promise<void> => {
      try {
        const stats = await exportService.obtenerEstadisticasExportacion(
          filtros
        );
        setEstadisticas(stats);
      } catch (error) {
        console.error("Error obteniendo estadísticas:", error);
        toast({
          title: "❌ Error",
          description: "No se pudieron cargar las estadísticas",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  /**
   * Descarga un archivo
   */
  const descargarArchivo = useCallback(
    (data: any, filename: string, mimeType: string) => {
      exportService.descargarArchivo(data, filename, mimeType);
    },
    []
  );

  /**
   * Resetea el progreso
   */
  const resetProgress = useCallback(() => {
    setProgress(0);
  }, []);

  return {
    // Estados
    isExporting,
    progress,
    estadisticas,

    // Funciones
    exportarVisitas,
    obtenerEstadisticas,
    descargarArchivo,

    // Utilidades
    resetProgress,
  };
}

