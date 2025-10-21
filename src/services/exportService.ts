/**
 * Servicio de exportación de datos para Visita Rápida
 * Compatible con la base de datos existente y múltiples formatos de exportación
 */

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreClient } from "@/firebase/clientApp";
import { Visita } from "@/types/visitas";
import { format } from "date-fns";

// Tipos para exportación
export interface ExportFilters {
  fechaDesde?: Date;
  fechaHasta?: Date;
  mercaderista?: string;
  correoMercaderista?: string;
  tipoVisita?: "Merchandising" | "Trade (Eventos)" | "Trade (Impulso)";
  rifCliente?: string;
  sucursal?: string;
  sincronizadoN8N?: boolean;
}

export interface ExportOptions {
  formato: "csv" | "excel" | "json" | "pdf";
  incluirFotos: boolean;
  comprimirFotos: boolean;
  incluirCoordenadas: boolean;
  incluirObservaciones: boolean;
  separarPorTipo: boolean;
  limiteRegistros?: number;
}

export interface ExportResult {
  success: boolean;
  data?: any;
  filename?: string;
  error?: string;
  totalRecords: number;
  processedRecords: number;
}

export interface VisitaExportData {
  id: string;
  fecha: string;
  hora: string;
  mercaderista: string;
  correoMercaderista: string;
  rifCliente: string;
  nombreEstablecimiento: string;
  tipoVisita: string;
  sucursal: string;
  latitud: number;
  longitud: number;
  direccion: string;
  sincronizadoN8N: boolean;
  errorSync?: string;
  observacionesAdicionales?: string;
  // Datos específicos según tipo de visita
  datosVisita: Record<string, any>;
  fotos?: string[];
}

class ExportService {
  private readonly BATCH_SIZE = 100; // Procesar en lotes para evitar timeouts

  /**
   * Exporta visitas con filtros y opciones específicas
   */
  async exportarVisitas(
    filtros: ExportFilters = {},
    opciones: ExportOptions
  ): Promise<ExportResult> {
    try {
      console.log("📊 [ExportService] Iniciando exportación de datos...");
      console.log("🔍 Filtros aplicados:", filtros);
      console.log("⚙️ Opciones de exportación:", opciones);

      // Obtener datos de visitas
      const visitas = await this.obtenerVisitasConFiltros(
        filtros,
        opciones.limiteRegistros
      );
      console.log(`📈 Total de visitas encontradas: ${visitas.length}`);

      if (visitas.length === 0) {
        return {
          success: true,
          data: null,
          totalRecords: 0,
          processedRecords: 0,
        };
      }

      // Procesar datos según formato
      let resultado: any;
      let filename: string;

      switch (opciones.formato) {
        case "csv":
          resultado = await this.exportarCSV(visitas, opciones);
          filename = `visitas_${format(new Date(), "yyyy-MM-dd_HH-mm-ss")}.csv`;
          break;
        case "excel":
          resultado = await this.exportarExcel(visitas, opciones);
          filename = `visitas_${format(
            new Date(),
            "yyyy-MM-dd_HH-mm-ss"
          )}.xlsx`;
          break;
        case "json":
          resultado = await this.exportarJSON(visitas, opciones);
          filename = `visitas_${format(
            new Date(),
            "yyyy-MM-dd_HH-mm-ss"
          )}.json`;
          break;
        case "pdf":
          resultado = await this.exportarPDF(visitas, opciones);
          filename = `visitas_${format(new Date(), "yyyy-MM-dd_HH-mm-ss")}.pdf`;
          break;
        default:
          throw new Error("Formato de exportación no soportado");
      }

      console.log("✅ [ExportService] Exportación completada exitosamente");

      return {
        success: true,
        data: resultado,
        filename,
        totalRecords: visitas.length,
        processedRecords: visitas.length,
      };
    } catch (error) {
      console.error("❌ [ExportService] Error en exportación:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        totalRecords: 0,
        processedRecords: 0,
      };
    }
  }

  /**
   * Obtiene visitas con filtros aplicados
   */
  private async obtenerVisitasConFiltros(
    filtros: ExportFilters,
    limite?: number
  ): Promise<VisitaExportData[]> {
    try {
      let q = query(
        collection(getFirestoreClient(), "visitas"),
        orderBy("createdAt", "desc")
      );

      // Aplicar filtros
      if (filtros.fechaDesde) {
        q = query(
          q,
          where("createdAt", ">=", Timestamp.fromDate(filtros.fechaDesde))
        );
      }
      if (filtros.fechaHasta) {
        q = query(
          q,
          where("createdAt", "<=", Timestamp.fromDate(filtros.fechaHasta))
        );
      }
      if (filtros.mercaderista) {
        q = query(q, where("mercaderista", "==", filtros.mercaderista));
      }
      if (filtros.correoMercaderista) {
        q = query(
          q,
          where("direccionCorreo", "==", filtros.correoMercaderista)
        );
      }
      if (filtros.tipoVisita) {
        q = query(q, where("tipoVisita", "==", filtros.tipoVisita));
      }
      if (filtros.rifCliente) {
        q = query(q, where("rifCliente", "==", filtros.rifCliente));
      }
      if (filtros.sucursal) {
        q = query(q, where("sucursal", "==", filtros.sucursal));
      }
      if (filtros.sincronizadoN8N !== undefined) {
        q = query(q, where("sincronizadoN8N", "==", filtros.sincronizadoN8N));
      }

      // Aplicar límite si se especifica
      if (limite) {
        q = query(q, limit(limite));
      }

      const querySnapshot = await getDocs(q);
      const visitas: VisitaExportData[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const visita: VisitaExportData = {
          id: doc.id,
          fecha: format(data.createdAt?.toDate() || new Date(), "yyyy-MM-dd"),
          hora: format(data.createdAt?.toDate() || new Date(), "HH:mm:ss"),
          mercaderista: data.mercaderista || "",
          correoMercaderista: data.direccionCorreo || "",
          rifCliente: data.rifCliente || "",
          nombreEstablecimiento: data.nombreEstablecimiento || "",
          tipoVisita: data.tipoVisita || "",
          sucursal: data.sucursal || "",
          latitud: data.ubicacion?.lat || data.ubicacion?.latitude || 0,
          longitud: data.ubicacion?.lng || data.ubicacion?.longitude || 0,
          direccion: data.ubicacion?.direccion || data.ubicacion?.address || "",
          sincronizadoN8N: data.sincronizadoN8N || false,
          errorSync: data.errorSync || "",
          observacionesAdicionales: data.observacionesAdicionales || "",
          datosVisita: this.procesarDatosVisita(data),
          fotos: this.extraerFotos(data),
        };
        visitas.push(visita);
      });

      return visitas;
    } catch (error) {
      console.error("❌ Error obteniendo visitas:", error);
      throw error;
    }
  }

  /**
   * Procesa los datos específicos de la visita según su tipo
   */
  private procesarDatosVisita(data: any): Record<string, any> {
    const datosVisita: Record<string, any> = {};

    if (data.respuestas) {
      const respuestas = data.respuestas;

      // Procesar datos de Merchandising
      if (data.tipoVisita === "Merchandising") {
        // Señalización
        datosVisita.clientePoseeSeñalizacion =
          respuestas.clientePoseeSeñalizacion;
        datosVisita.fotoSeñalizacion = respuestas.fotoSeñalizacion;

        // Planograma Shell
        datosVisita.hicistePlanogramaShell = respuestas.hicistePlanogramaShell;
        datosVisita.fotoAntesShell = respuestas.fotoAntesShell;
        datosVisita.fotoDespuesShell = respuestas.fotoDespuesShell;

        // Materiales Shell
        datosVisita.totalCenefasShell = respuestas.totalCenefasShell || 0;
        datosVisita.totalPapelBobinaShell =
          respuestas.totalPapelBobinaShell || 0;
        datosVisita.totalStickersShellCambio =
          respuestas.totalStickersShellCambio || 0;
        datosVisita.totalAmbientadoresShell =
          respuestas.totalAmbientadoresShell || 0;
        datosVisita.totalBolsasShell = respuestas.totalBolsasShell || 0;

        // Afiches Shell
        datosVisita.afichesFerrari2023 = respuestas.afichesFerrari2023 || 0;
        datosVisita.afichesHX8 = respuestas.afichesHX8 || 0;
        datosVisita.afichesProductosPremium2024 =
          respuestas.afichesProductosPremium2024 || 0;
        datosVisita.afichesShellFamilia2023 =
          respuestas.afichesShellFamilia2023 || 0;
        datosVisita.afichesShellHX7 = respuestas.afichesShellHX7 || 0;
        datosVisita.afichesTablaAplicacionShell =
          respuestas.afichesTablaAplicacionShell || 0;

        // Material Qualid
        datosVisita.colocasteQualid = respuestas.colocasteQualid;
        datosVisita.hicistePlanogramaQualid =
          respuestas.hicistePlanogramaQualid;
        datosVisita.totalCenefasQualid = respuestas.totalCenefasQualid || 0;
        datosVisita.totalBolsasQualid = respuestas.totalBolsasQualid || 0;

        // Afiches Qualid
        datosVisita.afiches_FiltrosFluidos2024 =
          respuestas.afiches_FiltrosFluidos2024 || 0;
        datosVisita.afichesQualidCaucho2023 =
          respuestas.afichesQualidCaucho2023 || 0;
        datosVisita.afichesQualidCaucho2024 =
          respuestas.afichesQualidCaucho2024 || 0;

        // Observaciones
        datosVisita.observacionesShell = respuestas.observacionesShell;
        datosVisita.observacionesQualid = respuestas.observacionesQualid;
      }

      // Procesar datos de Trade
      if (
        data.tipoVisita === "Trade (Eventos)" ||
        data.tipoVisita === "Trade (Impulso)"
      ) {
        datosVisita.marcaSeleccionada = respuestas.marcaSeleccionada;
        datosVisita.recursosUtilizados = Array.isArray(
          respuestas.recursosUtilizados
        )
          ? respuestas.recursosUtilizados.join(", ")
          : respuestas.recursosUtilizados;
        datosVisita.entregablesShell = Array.isArray(
          respuestas.entregablesShell
        )
          ? respuestas.entregablesShell.join(", ")
          : respuestas.entregablesShell;
        datosVisita.entregablesQualid = Array.isArray(
          respuestas.entregablesQualid
        )
          ? respuestas.entregablesQualid.join(", ")
          : respuestas.entregablesQualid;
        datosVisita.observaciones = respuestas.observaciones;
      }
    }

    return datosVisita;
  }

  /**
   * Extrae las fotos de la visita
   */
  private extraerFotos(data: any): string[] {
    const fotos: string[] = [];

    if (data.respuestas) {
      const respuestas = data.respuestas;

      // Fotos de señalización
      if (respuestas.fotoSeñalizacion) fotos.push(respuestas.fotoSeñalizacion);

      // Fotos de planograma Shell
      if (respuestas.fotoAntesShell) fotos.push(respuestas.fotoAntesShell);
      if (respuestas.fotoDespuesShell) fotos.push(respuestas.fotoDespuesShell);

      // Fotos de planograma Qualid
      if (respuestas.fotoAntesQualid) fotos.push(respuestas.fotoAntesQualid);
      if (respuestas.fotoDespuesQualid)
        fotos.push(respuestas.fotoDespuesQualid);

      // Fotos de afiches
      if (respuestas.fotosAfichesShell)
        fotos.push(respuestas.fotosAfichesShell);
      if (respuestas.fotosAfichesQualid)
        fotos.push(respuestas.fotosAfichesQualid);

      // Fotos de Trade
      if (respuestas.fotos && Array.isArray(respuestas.fotos)) {
        fotos.push(...respuestas.fotos);
      }
    }

    return fotos;
  }

  /**
   * Exporta datos en formato CSV
   */
  private async exportarCSV(
    visitas: VisitaExportData[],
    opciones: ExportOptions
  ): Promise<string> {
    if (visitas.length === 0) return "";

    // Crear encabezados
    const headers = [
      "ID",
      "Fecha",
      "Hora",
      "Mercaderista",
      "Correo Mercaderista",
      "RIF Cliente",
      "Nombre Establecimiento",
      "Tipo Visita",
      "Sucursal",
      "Latitud",
      "Longitud",
      "Dirección",
      "Sincronizado N8N",
      "Error Sync",
      "Observaciones Adicionales",
    ];

    // Agregar encabezados específicos según el tipo de visita
    const tiposVisita = [...new Set(visitas.map((v) => v.tipoVisita))];

    if (tiposVisita.includes("Merchandising")) {
      headers.push(
        "Cliente Posee Señalización",
        "Foto Señalización",
        "Hiciste Planograma Shell",
        "Foto Antes Shell",
        "Foto Después Shell",
        "Total Cenefas Shell",
        "Total Papel Bobina Shell",
        "Total Stickers Shell Cambio",
        "Total Ambientadores Shell",
        "Total Bolsas Shell",
        "Afiches Ferrari 2023",
        "Afiches HX8",
        "Afiches Productos Premium 2024",
        "Afiches Shell Familia 2023",
        "Afiches Shell HX7",
        "Afiches Tabla Aplicación Shell",
        "Colocaste Qualid",
        "Hiciste Planograma Qualid",
        "Total Cenefas Qualid",
        "Total Bolsas Qualid",
        "Afiches Filtros Fluidos 2024",
        "Afiches Qualid Caucho 2023",
        "Afiches Qualid Caucho 2024",
        "Observaciones Shell",
        "Observaciones Qualid"
      );
    }

    if (
      tiposVisita.includes("Trade (Eventos)") ||
      tiposVisita.includes("Trade (Impulso)")
    ) {
      headers.push(
        "Marca Seleccionada",
        "Recursos Utilizados",
        "Entregables Shell",
        "Entregables Qualid",
        "Observaciones"
      );
    }

    if (opciones.incluirFotos) {
      headers.push("Fotos");
    }

    // Crear filas de datos
    const rows = visitas.map((visita) => {
      const row = [
        visita.id,
        visita.fecha,
        visita.hora,
        visita.mercaderista,
        visita.correoMercaderista,
        visita.rifCliente,
        visita.nombreEstablecimiento,
        visita.tipoVisita,
        visita.sucursal,
        visita.latitud,
        visita.longitud,
        visita.direccion,
        visita.sincronizadoN8N ? "Sí" : "No",
        visita.errorSync || "",
        visita.observacionesAdicionales || "",
      ];

      // Agregar datos específicos según tipo
      if (visita.tipoVisita === "Merchandising") {
        row.push(
          visita.datosVisita.clientePoseeSeñalizacion ? "Sí" : "No",
          visita.datosVisita.fotoSeñalizacion || "",
          visita.datosVisita.hicistePlanogramaShell ? "Sí" : "No",
          visita.datosVisita.fotoAntesShell || "",
          visita.datosVisita.fotoDespuesShell || "",
          visita.datosVisita.totalCenefasShell || 0,
          visita.datosVisita.totalPapelBobinaShell || 0,
          visita.datosVisita.totalStickersShellCambio || 0,
          visita.datosVisita.totalAmbientadoresShell || 0,
          visita.datosVisita.totalBolsasShell || 0,
          visita.datosVisita.afichesFerrari2023 || 0,
          visita.datosVisita.afichesHX8 || 0,
          visita.datosVisita.afichesProductosPremium2024 || 0,
          visita.datosVisita.afichesShellFamilia2023 || 0,
          visita.datosVisita.afichesShellHX7 || 0,
          visita.datosVisita.afichesTablaAplicacionShell || 0,
          visita.datosVisita.colocasteQualid ? "Sí" : "No",
          visita.datosVisita.hicistePlanogramaQualid ? "Sí" : "No",
          visita.datosVisita.totalCenefasQualid || 0,
          visita.datosVisita.totalBolsasQualid || 0,
          visita.datosVisita.afiches_FiltrosFluidos2024 || 0,
          visita.datosVisita.afichesQualidCaucho2023 || 0,
          visita.datosVisita.afichesQualidCaucho2024 || 0,
          visita.datosVisita.observacionesShell || "",
          visita.datosVisita.observacionesQualid || ""
        );
      }

      if (
        visita.tipoVisita === "Trade (Eventos)" ||
        visita.tipoVisita === "Trade (Impulso)"
      ) {
        row.push(
          visita.datosVisita.marcaSeleccionada || "",
          visita.datosVisita.recursosUtilizados || "",
          visita.datosVisita.entregablesShell || "",
          visita.datosVisita.entregablesQualid || "",
          visita.datosVisita.observaciones || ""
        );
      }

      if (opciones.incluirFotos) {
        row.push(visita.fotos?.join("; ") || "");
      }

      return row;
    });

    // Convertir a CSV
    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    return csvContent;
  }

  /**
   * Exporta datos en formato Excel
   */
  private async exportarExcel(
    visitas: VisitaExportData[],
    opciones: ExportOptions
  ): Promise<any> {
    // Para Excel necesitaríamos una librería como xlsx
    // Por ahora retornamos los datos estructurados
    return {
      visitas,
      metadata: {
        totalRecords: visitas.length,
        exportDate: new Date().toISOString(),
        options: opciones,
      },
    };
  }

  /**
   * Exporta datos en formato JSON
   */
  private async exportarJSON(
    visitas: VisitaExportData[],
    opciones: ExportOptions
  ): Promise<any> {
    return {
      visitas,
      metadata: {
        totalRecords: visitas.length,
        exportDate: new Date().toISOString(),
        options: opciones,
      },
    };
  }

  /**
   * Exporta datos en formato PDF
   */
  private async exportarPDF(
    visitas: VisitaExportData[],
    opciones: ExportOptions
  ): Promise<any> {
    // Para PDF necesitaríamos una librería como jsPDF
    // Por ahora retornamos los datos estructurados
    return {
      visitas,
      metadata: {
        totalRecords: visitas.length,
        exportDate: new Date().toISOString(),
        options: opciones,
      },
    };
  }

  /**
   * Obtiene estadísticas de exportación
   */
  async obtenerEstadisticasExportacion(filtros: ExportFilters = {}): Promise<{
    totalVisitas: number;
    porTipoVisita: Record<string, number>;
    porMercaderista: Record<string, number>;
    porSucursal: Record<string, number>;
    sincronizadas: number;
    pendientes: number;
    conErrores: number;
  }> {
    try {
      const visitas = await this.obtenerVisitasConFiltros(filtros);

      const estadisticas = {
        totalVisitas: visitas.length,
        porTipoVisita: {} as Record<string, number>,
        porMercaderista: {} as Record<string, number>,
        porSucursal: {} as Record<string, number>,
        sincronizadas: 0,
        pendientes: 0,
        conErrores: 0,
      };

      visitas.forEach((visita) => {
        // Contar por tipo de visita
        estadisticas.porTipoVisita[visita.tipoVisita] =
          (estadisticas.porTipoVisita[visita.tipoVisita] || 0) + 1;

        // Contar por mercaderista
        estadisticas.porMercaderista[visita.mercaderista] =
          (estadisticas.porMercaderista[visita.mercaderista] || 0) + 1;

        // Contar por sucursal
        estadisticas.porSucursal[visita.sucursal] =
          (estadisticas.porSucursal[visita.sucursal] || 0) + 1;

        // Contar sincronización
        if (visita.sincronizadoN8N) {
          estadisticas.sincronizadas++;
        } else if (visita.errorSync) {
          estadisticas.conErrores++;
        } else {
          estadisticas.pendientes++;
        }
      });

      return estadisticas;
    } catch (error) {
      console.error("❌ Error obteniendo estadísticas:", error);
      throw error;
    }
  }

  /**
   * Descarga un archivo
   */
  descargarArchivo(data: any, filename: string, mimeType: string): void {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Exportar instancia singleton
export const exportService = new ExportService();

