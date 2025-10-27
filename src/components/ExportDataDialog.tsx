"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarIcon, Download, FileText, FileSpreadsheet, FileJson, FileImage } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { exportService, ExportFilters, ExportOptions, ExportResult } from "@/services/exportService";
import { useToast } from "@/hooks/use-toast";

interface ExportDataDialogProps {
    isOpen: boolean;
    onClose: () => void;
    initialFilters?: Partial<ExportFilters>;
}

export function ExportDataDialog({ isOpen, onClose, initialFilters = {} }: ExportDataDialogProps) {
    const { toast } = useToast();

    // Estados para filtros
    const [filtros, setFiltros] = useState<ExportFilters>({
        fechaDesde: initialFilters.fechaDesde,
        fechaHasta: initialFilters.fechaHasta,
        mercaderista: initialFilters.mercaderista || "",
        correoMercaderista: initialFilters.correoMercaderista || "",
        tipoVisita: initialFilters.tipoVisita,
        rifCliente: initialFilters.rifCliente || "",
        sucursal: initialFilters.sucursal || "",
        sincronizadoN8N: initialFilters.sincronizadoN8N,
    });

    // Estados para opciones de exportación
    const [opciones, setOpciones] = useState<ExportOptions>({
        formato: "csv",
        incluirFotos: false,
        comprimirFotos: false,
        incluirCoordenadas: true,
        incluirObservaciones: true,
        separarPorTipo: false,
        limiteRegistros: undefined,
    });

    // Estados de UI
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [estadisticas, setEstadisticas] = useState<any>(null);
    const [showCalendar, setShowCalendar] = useState<"desde" | "hasta" | null>(null);

    // Cargar estadísticas al abrir el diálogo
    useEffect(() => {
        if (isOpen) {
            cargarEstadisticas();
        }
    }, [isOpen]);

    const cargarEstadisticas = async () => {
        try {
            const stats = await exportService.obtenerEstadisticasExportacion(filtros);
            setEstadisticas(stats);
        } catch (error) {
            console.error("Error cargando estadísticas:", error);
        }
    };

    const handleFiltroChange = (key: keyof ExportFilters, value: any) => {
        setFiltros(prev => ({ ...prev, [key]: value }));
    };

    const handleOpcionChange = (key: keyof ExportOptions, value: any) => {
        setOpciones(prev => ({ ...prev, [key]: value }));
    };

    const handleExportar = async () => {
        setIsExporting(true);
        setProgress(0);

        try {
            // Simular progreso
            const progressInterval = setInterval(() => {
                setProgress(prev => Math.min(prev + 10, 90));
            }, 200);

            const resultado = await exportService.exportarVisitas(filtros, opciones);

            clearInterval(progressInterval);
            setProgress(100);

            if (resultado.success) {
                // Descargar archivo
                if (resultado.data && resultado.filename) {
                    let mimeType = "text/csv";
                    if (opciones.formato === "json") mimeType = "application/json";
                    if (opciones.formato === "excel") mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                    if (opciones.formato === "pdf") mimeType = "application/pdf";

                    exportService.descargarArchivo(resultado.data, resultado.filename, mimeType);

                    toast({
                        title: "✅ Exportación exitosa",
                        description: `Se exportaron ${resultado.processedRecords} registros en formato ${opciones.formato.toUpperCase()}`,
                    });
                }

                onClose();
            } else {
                toast({
                    title: "❌ Error en exportación",
                    description: resultado.error || "Error desconocido",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Error en exportación:", error);
            toast({
                title: "❌ Error en exportación",
                description: "Error inesperado durante la exportación",
                variant: "destructive",
            });
        } finally {
            setIsExporting(false);
            setProgress(0);
        }
    };

    const formatosDisponibles = [
        { value: "csv", label: "CSV", icon: FileText, description: "Formato compatible con Excel" },
        { value: "excel", label: "Excel", icon: FileSpreadsheet, description: "Archivo Excel nativo" },
        { value: "json", label: "JSON", icon: FileJson, description: "Datos estructurados" },
        { value: "pdf", label: "PDF", icon: FileImage, description: "Documento PDF" },
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        Exportar Datos de Visitas
                    </CardTitle>
                    <CardDescription>
                        Configura los filtros y opciones para exportar los datos de visitas en el formato deseado
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Estadísticas */}
                    {estadisticas && (
                        <Alert>
                            <AlertDescription>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <strong>Total:</strong> {estadisticas.totalVisitas} visitas
                                    </div>
                                    <div>
                                        <strong>Sincronizadas:</strong> {estadisticas.sincronizadas}
                                    </div>
                                    <div>
                                        <strong>Pendientes:</strong> {estadisticas.pendientes}
                                    </div>
                                    <div>
                                        <strong>Con errores:</strong> {estadisticas.conErrores}
                                    </div>
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Filtros */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Filtros de Datos</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Fecha desde */}
                            <div className="space-y-2">
                                <Label htmlFor="fechaDesde">Fecha desde</Label>
                                <Popover open={showCalendar === "desde"} onOpenChange={(open) => setShowCalendar(open ? "desde" : null)}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !filtros.fechaDesde && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {filtros.fechaDesde ? format(filtros.fechaDesde, "PPP", { locale: es }) : "Seleccionar fecha"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={filtros.fechaDesde}
                                            onSelect={(date: Date | undefined) => date && handleFiltroChange("fechaDesde", date)}
                                            initialFocus
                                            required={false}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Fecha hasta */}
                            <div className="space-y-2">
                                <Label htmlFor="fechaHasta">Fecha hasta</Label>
                                <Popover open={showCalendar === "hasta"} onOpenChange={(open) => setShowCalendar(open ? "hasta" : null)}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !filtros.fechaHasta && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {filtros.fechaHasta ? format(filtros.fechaHasta, "PPP", { locale: es }) : "Seleccionar fecha"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={filtros.fechaHasta}
                                            onSelect={(date: Date | undefined) => date && handleFiltroChange("fechaHasta", date)}
                                            initialFocus
                                            required={false}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Mercaderista */}
                            <div className="space-y-2">
                                <Label htmlFor="mercaderista">Mercaderista</Label>
                                <Input
                                    id="mercaderista"
                                    value={filtros.mercaderista}
                                    onChange={(e) => handleFiltroChange("mercaderista", e.target.value)}
                                    placeholder="Nombre del mercaderista"
                                />
                            </div>

                            {/* Correo mercaderista */}
                            <div className="space-y-2">
                                <Label htmlFor="correoMercaderista">Correo del mercaderista</Label>
                                <Input
                                    id="correoMercaderista"
                                    type="email"
                                    value={filtros.correoMercaderista}
                                    onChange={(e) => handleFiltroChange("correoMercaderista", e.target.value)}
                                    placeholder="correo@ejemplo.com"
                                />
                            </div>

                            {/* Tipo de visita */}
                            <div className="space-y-2">
                                <Label htmlFor="tipoVisita">Tipo de visita</Label>
                                <Select
                                    value={filtros.tipoVisita || ""}
                                    onValueChange={(value) => handleFiltroChange("tipoVisita", value || undefined)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Todos los tipos</SelectItem>
                                        <SelectItem value="Merchandising">Merchandising</SelectItem>
                                        <SelectItem value="Trade (Eventos)">Trade (Eventos)</SelectItem>
                                        <SelectItem value="Trade (Impulso)">Trade (Impulso)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* RIF Cliente */}
                            <div className="space-y-2">
                                <Label htmlFor="rifCliente">RIF Cliente</Label>
                                <Input
                                    id="rifCliente"
                                    value={filtros.rifCliente}
                                    onChange={(e) => handleFiltroChange("rifCliente", e.target.value)}
                                    placeholder="J-12345678-9"
                                />
                            </div>

                            {/* Sucursal */}
                            <div className="space-y-2">
                                <Label htmlFor="sucursal">Sucursal</Label>
                                <Input
                                    id="sucursal"
                                    value={filtros.sucursal}
                                    onChange={(e) => handleFiltroChange("sucursal", e.target.value)}
                                    placeholder="Nombre de la sucursal"
                                />
                            </div>

                            {/* Estado de sincronización */}
                            <div className="space-y-2">
                                <Label htmlFor="sincronizadoN8N">Estado de sincronización</Label>
                                <Select
                                    value={filtros.sincronizadoN8N === undefined ? "" : filtros.sincronizadoN8N.toString()}
                                    onValueChange={(value) => handleFiltroChange("sincronizadoN8N", value === "" ? undefined : value === "true")}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos los estados" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Todos los estados</SelectItem>
                                        <SelectItem value="true">Sincronizadas</SelectItem>
                                        <SelectItem value="false">No sincronizadas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Opciones de exportación */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Opciones de Exportación</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Formato */}
                            <div className="space-y-2">
                                <Label>Formato de archivo</Label>
                                <Select
                                    value={opciones.formato}
                                    onValueChange={(value) => handleOpcionChange("formato", value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {formatosDisponibles.map((formato) => (
                                            <SelectItem key={formato.value} value={formato.value}>
                                                <div className="flex items-center gap-2">
                                                    <formato.icon className="h-4 w-4" />
                                                    <div>
                                                        <div className="font-medium">{formato.label}</div>
                                                        <div className="text-xs text-muted-foreground">{formato.description}</div>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Límite de registros */}
                            <div className="space-y-2">
                                <Label htmlFor="limiteRegistros">Límite de registros (opcional)</Label>
                                <Input
                                    id="limiteRegistros"
                                    type="number"
                                    value={opciones.limiteRegistros || ""}
                                    onChange={(e) => handleOpcionChange("limiteRegistros", e.target.value ? parseInt(e.target.value) : undefined)}
                                    placeholder="Sin límite"
                                />
                            </div>
                        </div>

                        {/* Opciones adicionales */}
                        <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="incluirFotos"
                                    checked={opciones.incluirFotos}
                                    onCheckedChange={(checked) => handleOpcionChange("incluirFotos", checked)}
                                />
                                <Label htmlFor="incluirFotos">Incluir fotos en la exportación</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="comprimirFotos"
                                    checked={opciones.comprimirFotos}
                                    onCheckedChange={(checked) => handleOpcionChange("comprimirFotos", checked)}
                                />
                                <Label htmlFor="comprimirFotos">Comprimir fotos para reducir tamaño</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="incluirCoordenadas"
                                    checked={opciones.incluirCoordenadas}
                                    onCheckedChange={(checked) => handleOpcionChange("incluirCoordenadas", checked)}
                                />
                                <Label htmlFor="incluirCoordenadas">Incluir coordenadas GPS</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="incluirObservaciones"
                                    checked={opciones.incluirObservaciones}
                                    onCheckedChange={(checked) => handleOpcionChange("incluirObservaciones", checked)}
                                />
                                <Label htmlFor="incluirObservaciones">Incluir observaciones detalladas</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="separarPorTipo"
                                    checked={opciones.separarPorTipo}
                                    onCheckedChange={(checked) => handleOpcionChange("separarPorTipo", checked)}
                                />
                                <Label htmlFor="separarPorTipo">Separar por tipo de visita</Label>
                            </div>
                        </div>
                    </div>

                    {/* Progreso de exportación */}
                    {isExporting && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>Exportando datos...</span>
                                <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="w-full" />
                        </div>
                    )}

                    {/* Botones de acción */}
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose} disabled={isExporting}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleExportar}
                            disabled={isExporting}
                            className="min-w-[120px]"
                        >
                            {isExporting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                    Exportando...
                                </>
                            ) : (
                                <>
                                    <Download className="h-4 w-4 mr-2" />
                                    Exportar
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

