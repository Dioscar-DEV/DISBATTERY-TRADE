"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    Clock
} from "lucide-react";
import { ExportDataDialog } from "@/components/ExportDataDialog";
import { useExportData } from "@/hooks/useExportData";
import { ExportFilters } from "@/services/exportService";

export default function ExportarDatosPage() {
    const {
        isExporting,
        progress,
        estadisticas,
        obtenerEstadisticas
    } = useExportData();

    const [showExportDialog, setShowExportDialog] = useState(false);
    const [filtrosActivos, setFiltrosActivos] = useState<ExportFilters>({});

    // Cargar estadísticas al montar el componente
    useEffect(() => {
        obtenerEstadisticas();
    }, [obtenerEstadisticas]);

    const formatosDisponibles = [
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

    const handleExportarConFiltros = (filtros: ExportFilters) => {
        setFiltrosActivos(filtros);
        setShowExportDialog(true);
    };

    const handleExportarRapido = (tipoVisita?: string) => {
        const filtros: ExportFilters = {};
        if (tipoVisita) {
            filtros.tipoVisita = tipoVisita as any;
        }
        handleExportarConFiltros(filtros);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Exportar Datos</h1>
                    <p className="text-muted-foreground">
                        Exporta los datos de visitas en diferentes formatos y con filtros personalizados
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
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Visitas</CardTitle>
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{estadisticas.totalVisitas}</div>
                            <p className="text-xs text-muted-foreground">
                                Registros en la base de datos
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Sincronizadas</CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{estadisticas.sincronizadas}</div>
                            <p className="text-xs text-muted-foreground">
                                Enviadas a N8N exitosamente
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                            <Clock className="h-4 w-4 text-yellow-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-yellow-600">{estadisticas.pendientes}</div>
                            <p className="text-xs text-muted-foreground">
                                Esperando sincronización
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Con Errores</CardTitle>
                            <XCircle className="h-4 w-4 text-red-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{estadisticas.conErrores}</div>
                            <p className="text-xs text-muted-foreground">
                                Requieren revisión
                            </p>
                        </CardContent>
                    </Card>
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
                            {Object.entries(estadisticas.porTipoVisita).map(([tipo, cantidad]) => (
                                <div key={tipo} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-blue-500 rounded-full" />
                                        <span className="font-medium">{tipo}</span>
                                    </div>
                                    <Badge variant="secondary">{cantidad as number}</Badge>
                                </div>
                            ))}
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
                        {formatosDisponibles.map((formato) => (
                            <div
                                key={formato.formato}
                                className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => handleExportarRapido()}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <formato.icon className="h-6 w-6" />
                                    <span className="font-medium capitalize">{formato.formato}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-3">
                                    {formato.description}
                                </p>
                                <Badge className={formato.color}>
                                    {formato.formato.toUpperCase()}
                                </Badge>
                            </div>
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
                        <Button
                            variant="outline"
                            onClick={() => handleExportarRapido()}
                            className="h-auto p-4 flex flex-col items-start"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar className="h-4 w-4" />
                                <span className="font-medium">Todas las visitas</span>
                            </div>
                            <p className="text-xs text-muted-foreground text-left">
                                Exportar todos los registros sin filtros
                            </p>
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => handleExportarRapido("Merchandising")}
                            className="h-auto p-4 flex flex-col items-start"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <MapPin className="h-4 w-4" />
                                <span className="font-medium">Solo Merchandising</span>
                            </div>
                            <p className="text-xs text-muted-foreground text-left">
                                Visitas de merchandising únicamente
                            </p>
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => handleExportarRapido("Trade (Eventos)")}
                            className="h-auto p-4 flex flex-col items-start"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Users className="h-4 w-4" />
                                <span className="font-medium">Solo Eventos</span>
                            </div>
                            <p className="text-xs text-muted-foreground text-left">
                                Visitas de eventos únicamente
                            </p>
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => handleExportarRapido("Trade (Impulso)")}
                            className="h-auto p-4 flex flex-col items-start"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <BarChart3 className="h-4 w-4" />
                                <span className="font-medium">Solo Impulso</span>
                            </div>
                            <p className="text-xs text-muted-foreground text-left">
                                Visitas de impulso únicamente
                            </p>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Información adicional */}
            <Alert>
                <AlertDescription>
                    <div className="space-y-2">
                        <p className="font-medium">💡 Consejos para la exportación:</p>
                        <ul className="text-sm space-y-1 ml-4">
                            <li>• <strong>CSV:</strong> Ideal para análisis en Excel o Google Sheets</li>
                            <li>• <strong>Excel:</strong> Mejor para presentaciones con formato</li>
                            <li>• <strong>JSON:</strong> Perfecto para integraciones técnicas</li>
                            <li>• <strong>PDF:</strong> Ideal para reportes ejecutivos</li>
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

