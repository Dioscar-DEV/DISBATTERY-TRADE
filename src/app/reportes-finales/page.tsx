"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { crearVisita, setN8NWebhookURL } from "@/services/visitas";
import { RespuestasTrade } from "@/types/visitas";
import { getCurrentUser, getUserFromStorage } from "@/services/auth";
import { uploadMultipleImages, uploadOrganizedImages } from "@/services/images";
import { doc, updateDoc } from "firebase/firestore";
import { getFirestoreClient } from "@/firebase/clientApp";
import { useOfflineSync } from "@/hooks/useOfflineSync"; // Importar hook de sincronización offline
import { offlineManager } from "@/services/offlineManager";
import SaveProgressDialog from "@/components/SaveProgressDialog"; // Importar hook de sincronización offline

// 🗜️ FUNCIÓN PARA COMPRIMIR IMÁGENES BASE64
const comprimirImagenBase64 = (
  base64String: string,
  calidad: number = 0.6
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      // Calcular nuevas dimensiones (máximo 800px de ancho)
      const maxWidth = 800;
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
      const newWidth = img.width * ratio;
      const newHeight = img.height * ratio;

      canvas.width = newWidth;
      canvas.height = newHeight;

      // Dibujar imagen redimensionada
      ctx?.drawImage(img, 0, 0, newWidth, newHeight);

      // Convertir a JPEG con calidad reducida
      const comprimida = canvas.toDataURL("image/jpeg", calidad);
      console.log(
        `📸 Imagen comprimida: ${base64String.length} → ${comprimida.length} chars (${Math.round((1 - comprimida.length / base64String.length) * 100)}% reducción)`
      );
      resolve(comprimida);
    };

    img.src = base64String;
  });
};

// ✅ FUNCIÓN PARA ACTUALIZAR EL STATUS DEL EVENTO EN FIRESTORE
const actualizarStatusEventoEnFirestore = async (eventId: string) => {
  try {
    console.log(`🔥 Actualizando status del evento ${eventId} en Firestore...`);

    const eventoRef = doc(getFirestoreClient(), "eventos", eventId);
    await updateDoc(eventoRef, {
      status: "completado",
    });

    console.log(
      `✅ Status del evento ${eventId} actualizado a 'completado' en Firestore`
    );
  } catch (error) {
    console.error(
      "❌ Error actualizando status del evento en Firestore:",
      error
    );
    // No lanzar error para no interrumpir el flujo principal
  }
};

// ✅ FUNCIÓN PARA MARCAR UN PUNTO DE RUTA O EVENTO COMO COMPLETADO
const marcarPuntoComoCompletado = (puntoId: string) => {
  try {
    console.log(`🔄 Marcando punto ${puntoId} como completado...`);

    // 1. ACTUALIZAR EN RUTAS REGULARES
    const todaysRoutesStr = localStorage.getItem("todaysRoutesOffline");
    if (todaysRoutesStr) {
      console.log("📋 Verificando rutas regulares...");
      const todaysRoutes = JSON.parse(todaysRoutesStr);
      let puntoActualizado = false;

      const updatedRoutes = todaysRoutes.map((route: any) => {
        if (route.points) {
          route.points = route.points.map((point: any) => {
            if (point.id === puntoId) {
              console.log(
                `✅ Punto encontrado en ruta regular: ${point.nombre}. Cambiando estado.`
              );
              point.estado = "visitado";
              puntoActualizado = true;
            }
            return point;
          });
        }
        return route;
      });

      if (puntoActualizado) {
        localStorage.setItem(
          "todaysRoutesOffline",
          JSON.stringify(updatedRoutes)
        );
        console.log("✅ Rutas regulares actualizadas en localStorage.");
      } else {
        console.log("⚠️ No se encontró el punto en rutas regulares");
      }
    } else {
      console.log("⚠️ No hay rutas regulares en localStorage");
    }

    // 2. ACTUALIZAR EN EVENTOS INDEPENDIENTES
    const todaysEventsStr = localStorage.getItem("todaysEventsOffline");
    if (todaysEventsStr) {
      console.log("🎪 Verificando eventos independientes...");
      const todaysEvents = JSON.parse(todaysEventsStr);
      console.log(`🔍 Eventos disponibles: ${todaysEvents.length}`);

      // Debug: Mostrar todos los IDs de eventos disponibles
      todaysEvents.forEach((evento: any, index: number) => {
        console.log(
          `🎯 Evento ${index}: ID="${evento.id}", Nombre="${evento.nombreEvento}"`
        );
      });

      let eventoActualizado = false;

      const updatedEvents = todaysEvents.map((evento: any) => {
        // ✅ BÚSQUEDA ROBUSTA: Comprobar el ID principal del evento y el ID de punto (evento-{id})
        console.log(
          `🔍 Comparando: evento.id="${evento.id}" vs puntoId="${puntoId}"`
        );

        if (evento.id === puntoId || `evento-${evento.id}` === puntoId) {
          console.log(
            `✅ EVENTO ENCONTRADO: ${evento.nombreEvento}. Cambiando estado de "${evento.estado || "undefined"}" a "visitado".`
          );
          evento.estado = "visitado";
          eventoActualizado = true;
        }
        return evento;
      });

      if (eventoActualizado) {
        localStorage.setItem(
          "todaysEventsOffline",
          JSON.stringify(updatedEvents)
        );
        console.log("✅ Eventos independientes actualizados en localStorage.");

        // Disparar evento para actualizar la UI
        window.dispatchEvent(new Event("storage"));
        console.log("📡 Evento storage disparado para actualizar UI");
      } else {
        console.warn(`⚠️ NO SE ENCONTRÓ EL EVENTO con ID: ${puntoId}`);
        console.warn(
          "🔍 IDs disponibles:",
          todaysEvents.map((e: any) => e.id)
        );
      }
    } else {
      console.log("⚠️ No hay eventos independientes en localStorage");
    }
  } catch (error) {
    console.error(
      "❌ Error al marcar el punto como completado en localStorage:",
      error
    );
  }
};

import { PageWrapper } from "@/components/PageWrapper";

export default function ReportesFinalesPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Estados para los 3 reportes
  const [reporteShellFaltante, setReporteShellFaltante] = useState("");
  const [reporteQualidFaltante, setReporteQualidFaltante] = useState("");
  const [reporteComentariosAdicionales, setReporteComentariosAdicionales] =
    useState("");

  const [isSyncing, setIsSyncing] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [visitaDataToSave, setVisitaDataToSave] = useState<any>(null);

  // Hook de sincronización offline
  useOfflineSync();

  // Configurar URL del webhook N8N al inicializar
  useEffect(() => {
    setN8NWebhookURL("https://n8n.con-visas.com/webhook/Disbattery-Trade-app");
  }, []);

  const handleSaveComplete = (success: boolean, visitaId?: string) => {
    setShowSaveDialog(false);
    setVisitaDataToSave(null);

    if (success) {
      toast({
        title: "✅ Visita Guardada",
        description: visitaId
          ? `Visita guardada exitosamente (ID: ${visitaId})`
          : "Visita guardada exitosamente",
      });

      // Navegar a la página de éxito (forzar con window.location si router.push no funciona)
      try {
        router.push("/registro-exitoso");
        setTimeout(() => {
          if (window.location.pathname !== "/registro-exitoso") {
            window.location.href = "/registro-exitoso";
          }
        }, 1200);
      } catch (navError) {
        window.location.href = "/registro-exitoso";
      }
    } else {
      toast({
        variant: "destructive",
        title: "Error al Guardar",
        description:
          "Hubo un problema guardando la visita. Intente nuevamente.",
      });
    }
  };

  const handleGuardarYContinuar = async () => {
    //
    // =================================================================
    // INICIO DE LA MODIFICACIÓN PARA FUNCIONALIDAD OFFLINE
    // =================================================================
    //
    if (typeof window !== "undefined" && !navigator.onLine) {
      try {
        setIsSyncing(true);
        console.log("🔄 Modo Offline: Guardando reporte localmente...");

        const datosAcumulados = JSON.parse(
          localStorage.getItem("datosFormularioCompleto") || "{}"
        );
        if (!datosAcumulados.clienteData) {
          toast({
            variant: "destructive",
            title: "Error de Datos",
            description:
              "No se encontraron datos del cliente. Reinicie el proceso.",
          });
          return;
        }

        // Agregar los reportes finales a los datos acumulados
        datosAcumulados.reporteShellFaltante = reporteShellFaltante;
        datosAcumulados.reporteQualidFaltante = reporteQualidFaltante;
        datosAcumulados.reporteComentariosAdicionales =
          reporteComentariosAdicionales;

        // Agregar información del mercaderista si no existe
        let currentUser = await getCurrentUser();
        if (!currentUser) {
          currentUser = getUserFromStorage();
        }

        if (!datosAcumulados.mercaderista) {
          datosAcumulados.mercaderista = currentUser?.fullName || "Usuario App";
        }
        if (!datosAcumulados.correoMercaderista) {
          datosAcumulados.correoMercaderista = currentUser?.email || "";
        }
        if (!datosAcumulados.mercaderistoId) {
          datosAcumulados.mercaderistoId = currentUser?.uid || "";
        }

        // Usar el offlineManager para guardar los datos
        const saveResult = await offlineManager.saveVisita(datosAcumulados);

        if (saveResult.success) {
          console.log(
            "✅ Datos guardados offline exitosamente:",
            saveResult.visitaId
          );

          // Marcar punto como completado en rutas offline
          const puntoId = datosAcumulados.clienteData?.id || datosAcumulados.clienteData?.rif;
          if (puntoId) {
            // Actualizar rutas regulares
            const todaysRoutesStr = localStorage.getItem("todaysRoutesOffline");
            if (todaysRoutesStr) {
              const todaysRoutes = JSON.parse(todaysRoutesStr);
              let updated = false;
              const updatedRoutes = todaysRoutes.map((route) => {
                if (route.points) {
                  route.points = route.points.map((point) => {
                    if (point.id === puntoId) {
                      point.estado = "visitado";
                      updated = true;
                    }
                    return point;
                  });
                }
                return route;
              });
              if (updated) {
                localStorage.setItem("todaysRoutesOffline", JSON.stringify(updatedRoutes));
              }
            }
            // Actualizar eventos
            const todaysEventsStr = localStorage.getItem("todaysEventsOffline");
            if (todaysEventsStr) {
              const todaysEvents = JSON.parse(todaysEventsStr);
              let updated = false;
              const updatedEvents = todaysEvents.map((evento) => {
                if (evento.id === puntoId || `evento-${evento.id}` === puntoId) {
                  evento.estado = "visitado";
                  updated = true;
                }
                return evento;
              });
              if (updated) {
                localStorage.setItem("todaysEventsOffline", JSON.stringify(updatedEvents));
                window.dispatchEvent(new Event("storage"));
              }
            }
          }

          // Limpiar datos temporales
          localStorage.removeItem("datosFormularioCompleto");

          toast({
            title: "Guardado Offline Exitoso",
            description: `Visita guardada localmente. Se sincronizará automáticamente cuando haya conexión.`,
          });

          // Redirigir a página de éxito
          router.push("/registro-exitoso");
        } else {
          throw new Error(saveResult.error || "Error guardando offline");
        }
      } catch (error) {
        console.error("Error guardando el reporte offline:", error);
        toast({
          variant: "destructive",
          title: "Error al Guardar Offline",
          description:
            "Hubo un problema al guardar los datos en el dispositivo. Por favor, intente de nuevo.",
        });
      } finally {
        setIsSyncing(false);
      }
      return; // Detener la ejecución si estamos offline
    }
    //
    // =================================================================
    // FIN DE LA MODIFICACIÓN PARA FUNCIONALIDAD OFFLINE
    // =================================================================
    //

    try {
      setIsSyncing(true);

      // Obtener datos acumulados
      const datosAcumulados = JSON.parse(
        localStorage.getItem("datosFormularioCompleto") || "{}"
      );

      if (!datosAcumulados.clienteData) {
        toast({
          variant: "destructive",
          title: "Error de Datos",
          description:
            "No se encontraron datos del cliente. Reinicie el proceso.",
        });
        return;
      }

      // Agregar los reportes finales a los datos acumulados
      datosAcumulados.reporteShellFaltante = reporteShellFaltante;
      datosAcumulados.reporteQualidFaltante = reporteQualidFaltante;
      datosAcumulados.reporteComentariosAdicionales =
        reporteComentariosAdicionales;

      const cliente = datosAcumulados.clienteData;

      // Obtener datos del usuario logueado
      let currentUser = await getCurrentUser();
      if (!currentUser) {
        currentUser = getUserFromStorage();
      }

      // Agregar información del mercaderista si no existe
      if (!datosAcumulados.mercaderista) {
        datosAcumulados.mercaderista = currentUser?.fullName || "Usuario App";
      }
      if (!datosAcumulados.correoMercaderista) {
        datosAcumulados.correoMercaderista = currentUser?.email || "";
      }
      if (!datosAcumulados.mercaderistoId) {
        datosAcumulados.mercaderistoId = currentUser?.uid || "";
      }

      const mercaderista = datosAcumulados.mercaderista;
      const correoMercaderista = datosAcumulados.correoMercaderista;

      console.log("🚀 [ReportesFinales] Iniciando proceso de guardado...");

      // Asegurar que los datos acumulados tengan toda la información necesaria
      const datosFinales = {
        ...datosAcumulados,
        // Agregar reportes finales
        reporteShellFaltante,
        reporteQualidFaltante,
        reporteComentariosAdicionales,
        // Asegurar metadatos
        mercaderista,
        correoMercaderista,
        mercaderistoId:
          datosAcumulados.mercaderistoId || currentUser?.uid || "",
        timestamp: new Date().toISOString(),
      };

      // Establecer datos para el diálogo y mostrarlo
      setVisitaDataToSave(datosFinales);
      setShowSaveDialog(true);
      setIsSyncing(false);
    } catch (error) {
      console.error("Error al preparar datos para guardar:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "Hubo un problema al preparar los datos. Intente nuevamente.",
      });
      setIsSyncing(false);
    }
  };

  return (
    <PageWrapper>
      <div
        className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4"
        style={{
          backgroundImage:
            'url("https://storage.googleapis.com/iandai/imagenes/Dise%C3%B1o%20sin%20t%C3%ADtulo%20(51).png")',
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>
              <span
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #fbce04, #e30a18)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                Reportes Finales
              </span>
            </CardTitle>
            <CardDescription>
              Complete los reportes finales antes de finalizar la visita.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Sección 13: Reporte de producto faltante SHELL */}
            <div className="space-y-2">
              <div className="bg-yellow-50 p-2 rounded-md border-l-4 border-yellow-400">
                <Label className="text-sm font-semibold text-yellow-800">
                  Sección 13 de 15
                </Label>
              </div>
              <Label
                htmlFor="reporte-shell-faltante"
                className="text-sm font-medium"
              >
                Reporte de producto faltante de las familias SHELL
              </Label>
              <p className="text-xs text-muted-foreground">
                Descripción (opcional)
              </p>
              <p className="text-xs text-muted-foreground">
                Añade aquí todos los detalles de producto faltante por familia
                de productos SHELL
              </p>
              <Textarea
                id="reporte-shell-faltante"
                value={reporteShellFaltante}
                onChange={(e) => setReporteShellFaltante(e.target.value)}
                placeholder="Escriba su reporte de productos SHELL faltantes..."
                disabled={isSyncing}
                className="mt-1 min-h-[80px]"
                rows={4}
              />
            </div>

            {/* Sección 14: Reporte de producto faltante QUALID */}
            <div className="space-y-2">
              <div className="bg-yellow-50 p-2 rounded-md border-l-4 border-yellow-400">
                <Label className="text-sm font-semibold text-yellow-800">
                  Sección 14 de 15
                </Label>
              </div>
              <Label
                htmlFor="reporte-qualid-faltante"
                className="text-sm font-medium"
              >
                Reporte de producto faltante de las familias QUALID
              </Label>
              <p className="text-xs text-muted-foreground">
                Descripción (opcional)
              </p>
              <p className="text-xs text-muted-foreground">
                Añade aquí todos los detalles de producto faltante por familia
                de productos QUALID
              </p>
              <Textarea
                id="reporte-qualid-faltante"
                value={reporteQualidFaltante}
                onChange={(e) => setReporteQualidFaltante(e.target.value)}
                placeholder="Escriba su reporte de productos QUALID faltantes..."
                disabled={isSyncing}
                className="mt-1 min-h-[80px]"
                rows={4}
              />
            </div>

            {/* Sección 15: Reporte de comentarios adicionales */}
            <div className="space-y-2">
              <div className="bg-yellow-50 p-2 rounded-md border-l-4 border-yellow-400">
                <Label className="text-sm font-semibold text-yellow-800">
                  Sección 15 de 15
                </Label>
              </div>
              <Label
                htmlFor="reporte-comentarios-adicionales"
                className="text-sm font-medium"
              >
                Reporte de comentarios adicionales
              </Label>
              <p className="text-xs text-muted-foreground">
                Aquí puedes dejar tus comentarios y observaciones sobre temas
                importantes como actividades de la competencia, presencia de
                nuevas marcas, etc.
              </p>
              <Textarea
                id="reporte-comentarios-adicionales"
                value={reporteComentariosAdicionales}
                onChange={(e) =>
                  setReporteComentariosAdicionales(e.target.value)
                }
                placeholder="Añade aquí todos tus comentarios y observaciones adicionales..."
                disabled={isSyncing}
                className="mt-1 min-h-[80px]"
                rows={4}
              />
            </div>
          </CardContent>

          <CardFooter>
            <Button
              onClick={handleGuardarYContinuar}
              disabled={isSyncing}
              className="w-full"
              style={{
                background: "linear-gradient(to right, #fcce05, #ff0000)",
                color: "white",
                fontWeight: "bold",
              }}
            >
              {isSyncing
                ? "Guardando..."
                : "Guardar Reportes y Finalizar Visita"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Diálogo de progreso de guardado mejorado */}
      <SaveProgressDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onComplete={handleSaveComplete}
        visitaData={visitaDataToSave}
      />
    </PageWrapper>
  );
}
