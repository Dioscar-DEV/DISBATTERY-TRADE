"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Download,
  FileText,
  FileSpreadsheet,
  FileJson,
  FileImage,
  BarChart3,
  Calendar,
  Users,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { ExportDataDialog } from "@/components/ExportDataDialog";
import { useExportData } from "@/hooks/useExportData";
import { ExportFilters } from "@/services/exportService";

// Interfaces para mejorar el tipado
interface StatCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}

interface FormatConfig {
  formato: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
}

interface QuickExportConfig {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tipoVisita?: string;
}

// Configuraciones extraídas para aplicar DRY
const EXPORT_FORMATS: FormatConfig[] = [
  {
    formato: "csv",
    icon: FileText,
    color: "bg-green-100 text-green-800",
    description: "Compatible con Excel y Google Sheets",
  },
  {
    formato: "excel",
    icon: FileSpreadsheet,
    color: "bg-blue-100 text-blue-800",
    description: "Archivo Excel nativo con formato",
  },
  {
    formato: "json",
    icon: FileJson,
    color: "bg-yellow-100 text-yellow-800",
    description: "Datos estructurados para desarrolladores",
  },
  {
    formato: "pdf",
    icon: FileImage,
    color: "bg-red-100 text-red-800",
    description: "Documento PDF para presentaciones",
  },
];

const QUICK_EXPORT_OPTIONS: QuickExportConfig[] = [
  {
    title: "Todas las visitas",
    description: "Exportar todos los registros sin filtros",
    icon: Calendar,
  },
  {
    title: "Solo Merchandising",
    description: "Visitas de merchandising únicamente",
    icon: MapPin,
    tipoVisita: "Merchandising",
  },
  {
    title: "Solo Eventos",
    description: "Visitas de eventos únicamente",
    icon: Users,
    tipoVisita: "Trade (Eventos)",
  },
  {
    title: "Solo Impulso",
    description: "Visitas de impulso únicamente",
    icon: BarChart3,
    tipoVisita: "Trade (Impulso)",
  },
];

const STATS_CONFIG = [
  {
    key: "totalVisitas" as const,
    title: "Total Visitas",
    icon: BarChart3,
    description: "Registros en la base de datos",
  },
  {
    key: "sincronizadas" as const,
    title: "Sincronizadas",
    icon: CheckCircle,
    description: "Enviadas a N8N exitosamente",
    color: "text-green-600",
  },
  {
    key: "pendientes" as const,
    title: "Pendientes",
    icon: Clock,
    description: "Esperando sincronización",
    color: "text-yellow-600",
  },
  {
    key: "conErrores" as const,
    title: "Con Errores",
    icon: XCircle,
    description: "Requieren revisión",
    color: "text-red-600",
  },
];

const EXPORT_TIPS = [
  {
    format: "CSV",
    description: "Ideal para análisis en Excel o Google Sheets",
  },
  { format: "Excel", description: "Mejor para presentaciones con formato" },
  { format: "JSON", description: "Perfecto para integraciones técnicas" },
  { format: "PDF", description: "Ideal para reportes ejecutivos" },
];

// Componentes reutilizables aplicando Single Responsibility Principle
const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  color,
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className={`h-4 w-4 ${color || "text-muted-foreground"}`} />
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-bold ${color || ""}`}>{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

const FormatCard: React.FC<{ format: FormatConfig; onSelect: () => void }> = ({
  format,
  onSelect,
}) => (
  <div
    className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
    onClick={onSelect}
  >
    <div className="flex items-center gap-3 mb-2">
      <format.icon className="h-6 w-6" />
      <span className="font-medium capitalize">{format.formato}</span>
    </div>
    <p className="text-sm text-muted-foreground mb-3">{format.description}</p>
    <Badge className={format.color}>{format.formato.toUpperCase()}</Badge>
  </div>
);

const QuickExportButton: React.FC<{
  config: QuickExportConfig;
  onExport: (tipo?: string) => void;
}> = ({ config, onExport }) => (
  <Button
    variant="outline"
    onClick={() => onExport(config.tipoVisita)}
    className="h-auto p-4 flex flex-col items-start"
  >
    <div className="flex items-center gap-2 mb-2">
      <config.icon className="h-4 w-4" />
      <span className="font-medium">{config.title}</span>
    </div>
    <p className="text-xs text-muted-foreground text-left">
      {config.description}
    </p>
  </Button>
);

export default function ExportarDatosPage() {
  const { isExporting, progress, estadisticas, obtenerEstadisticas } =
    useExportData();

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [filtrosActivos, setFiltrosActivos] = useState<ExportFilters>({});

  // Cargar estadísticas al montar el componente
  useEffect(() => {
    obtenerEstadisticas();
  }, [obtenerEstadisticas]);

  // Handlers optimizados con useCallback
  const handleExportarConFiltros = useCallback((filtros: ExportFilters) => {
    setFiltrosActivos(filtros);
    setShowExportDialog(true);
  }, []);

  const handleExportarRapido = useCallback(
    (tipoVisita?: string) => {
      const filtros: ExportFilters = tipoVisita
        ? { tipoVisita: tipoVisita as any }
        : {};
      handleExportarConFiltros(filtros);
    },
    [handleExportarConFiltros]
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Exportar Datos</h1>
          <p className="text-muted-foreground">
            Exporta los datos de visitas en diferentes formatos y con filtros
            personalizados
          </p>
        </div>
        <Button
          onClick={() => setShowExportDialog(true)}
          disabled={isExporting}
          className="min-w-[140px]"
        >
          {isExporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Exportando...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Exportar Datos
            </>
          )}
        </Button>
      </div>

      {/* Progreso de exportación */}
      {isExporting && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Exportando datos...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estadísticas generales */}
      {estadisticas && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS_CONFIG.map((stat) => (
            <StatCard
              key={stat.key}
              title={stat.title}
              value={estadisticas[stat.key]}
              description={stat.description}
              icon={stat.icon}
              color={stat.color}
            />
          ))}
        </div>
      )}

      {/* Distribución por tipo de visita */}
      {estadisticas?.porTipoVisita && (
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Tipo de Visita</CardTitle>
            <CardDescription>
              Cantidad de visitas registradas por cada tipo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(estadisticas.porTipoVisita).map(
                ([tipo, cantidad]) => (
                  <div
                    key={tipo}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full" />
                      <span className="font-medium">{tipo}</span>
                    </div>
                    <Badge variant="secondary">{cantidad as number}</Badge>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formatos de exportación disponibles */}
      <Card>
        <CardHeader>
          <CardTitle>Formatos de Exportación</CardTitle>
          <CardDescription>
            Selecciona el formato más adecuado para tus necesidades
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {EXPORT_FORMATS.map((format) => (
              <FormatCard
                key={format.formato}
                format={format}
                onSelect={() => handleExportarRapido()}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Exportaciones rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Exportaciones Rápidas</CardTitle>
          <CardDescription>
            Exporta datos con filtros predefinidos para casos comunes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_EXPORT_OPTIONS.map((option) => (
              <QuickExportButton
                key={option.title}
                config={option}
                onExport={handleExportarRapido}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Información adicional */}
      <Alert>
        <AlertDescription>
          <div className="space-y-2">
            <span className="font-medium">
              💡 Consejos para la exportación:
            </span>
            <ul className="text-sm space-y-1 ml-4">
              {EXPORT_TIPS.map((tip) => (
                <li key={tip.format}>
                  • <strong>{tip.format}:</strong> {tip.description}
                </li>
              ))}
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      {/* Diálogo de exportación */}
      <ExportDataDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        initialFilters={filtrosActivos}
      />
    </div>
  );
}
