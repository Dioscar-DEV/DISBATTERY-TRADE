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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { offlineManager } from "@/services/offlineManager";
import { PageWrapper } from "@/components/PageWrapper";

export default function VentasProductosPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [datosFormulario, setDatosFormulario] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Estados para ventas Shell
  const [ventasShell, setVentasShell] = useState({
    advance: "",
    helixHX5: "",
    helixHX7: "",
    helixHX8: "",
    helixUltra: "",
    rimula: "",
    spirax: "",
    gadus: "",
    otros: "",
  });

  // Estados para ventas Qualid
  const [ventasQualid, setVentasQualid] = useState({
    fluidos: "",
    spray: "",
    filtroAutomotriz: "",
    servicioPesado: "",
    cauchos: "",
  });

  useEffect(() => {
    // Cargar datos del formulario desde localStorage
    const datos = localStorage.getItem("datosFormularioCompleto");
    if (!datos) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "No se encontraron datos del formulario. Regresando al inicio.",
      });
      router.push("/");
      return;
    }

    const datosParseados = JSON.parse(datos);
    setDatosFormulario(datosParseados);

    // Si no hay ventas para reportar, saltar esta página
    if (
      datosParseados.huboVentasShell !== true &&
      datosParseados.huboVentasQualid !== true
    ) {
      router.push("/reportes-finales");
    }
  }, [router, toast]);

  const handleVentasShellChange = (producto: string, valor: string) => {
    setVentasShell((prev) => ({ ...prev, [producto]: valor }));
  };

  const handleVentasQualidChange = (producto: string, valor: string) => {
    setVentasQualid((prev) => ({ ...prev, [producto]: valor }));
  };

  const handleContinuar = async () => {
    if (!datosFormulario) return;

    try {
      setIsSyncing(true);

      // Validar que se hayan llenado los campos requeridos si hubo ventas
      if (datosFormulario.huboVentasShell === true) {
        const shellVacio = Object.values(ventasShell).every(
          (val) => val === ""
        );
        if (shellVacio) {
          toast({
            variant: "destructive",
            title: "Ventas SHELL Requeridas",
            description:
              "Por favor, complete al menos un campo de ventas SHELL.",
          });
          return;
        }
      }

      if (datosFormulario.huboVentasQualid === true) {
        const qualidVacio = Object.values(ventasQualid).every(
          (val) => val === ""
        );
        if (qualidVacio) {
          toast({
            variant: "destructive",
            title: "Ventas QUALID Requeridas",
            description:
              "Por favor, complete al menos un campo de ventas QUALID.",
          });
          return;
        }
      }

      // Agregar datos de ventas detalladas al formulario
      const datosCompletos = {
        ...datosFormulario,
        ventasShellDetalladas:
          datosFormulario.huboVentasShell === true ? ventasShell : null,
        ventasQualidDetalladas:
          datosFormulario.huboVentasQualid === true ? ventasQualid : null,
        timestamp: new Date().toISOString(),
      };

      // Verificar si estamos offline y usar offlineManager
      if (typeof window !== "undefined" && !navigator.onLine) {
        console.log("🔄 Modo Offline: Guardando con offlineManager...");

        const saveResult = await offlineManager.saveVisita(datosCompletos);

        if (saveResult.success) {
          console.log(
            "✅ Datos guardados offline exitosamente:",
            saveResult.visitaId
          );

          toast({
            title: "Datos Guardados Offline",
            description:
              "Los datos se sincronizarán automáticamente cuando haya conexión.",
          });

          // Redirigir a página de éxito
          router.push("/registro-exitoso");
        } else {
          throw new Error(saveResult.error || "Error guardando offline");
        }
      } else {
        // Modo online: continuar con el flujo normal
        localStorage.setItem(
          "datosFormularioCompleto",
          JSON.stringify(datosCompletos)
        );

        toast({
          title: "Datos de Ventas Guardados",
          description: "Continuando a reportes finales...",
        });

        // Navegar a reportes finales
        if (!navigator.onLine) {
          window.location.href = "/reportes-finales";
        } else {
          router.push("/reportes-finales");
        }
      }
    } catch (error) {
      console.error("Error guardando ventas:", error);
      toast({
        variant: "destructive",
        title: "Error al Guardar",
        description:
          "Hubo un problema guardando los datos. Intente nuevamente.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!datosFormulario) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div>Cargando...</div>
      </div>
    );
  }

  const mostrarVentasShell = datosFormulario.huboVentasShell === true;
  const mostrarVentasQualid = datosFormulario.huboVentasQualid === true;

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
                Reporte de Ventas
              </span>
            </CardTitle>
            <CardDescription>
              Complete los detalles de ventas de los productos reportados.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Ventas Shell Detalladas */}
            {mostrarVentasShell && (
              <div className="space-y-4 border rounded-lg p-4 bg-yellow-50">
                <Label className="text-lg font-semibold">
                  Reporte de ventas productos SHELL
                </Label>
                <p className="text-sm text-muted-foreground">
                  Registra las cantidades en litros de los productos Shell por
                  familia de productos vendidos durante el impulso o evento.
                </p>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shell-advance">
                      Total en litros de SHELL ADVANCE vendidos: *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Responde únicamente con un valor numérico, 0-999
                    </p>
                    <Input
                      id="shell-advance"
                      type="number"
                      min="0"
                      max="999"
                      value={ventasShell.advance}
                      onChange={(e) =>
                        handleVentasShellChange("advance", e.target.value)
                      }
                      disabled={isSyncing}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shell-hx5">
                      Total en litros de SHELL HELIX HX5 vendidos: *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Responde únicamente con un valor numérico, 0-999
                    </p>
                    <Input
                      id="shell-hx5"
                      type="number"
                      min="0"
                      max="999"
                      value={ventasShell.helixHX5}
                      onChange={(e) =>
                        handleVentasShellChange("helixHX5", e.target.value)
                      }
                      disabled={isSyncing}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shell-hx7">
                      Total en litros de SHELL HELIX HX7 vendidos: *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Responde únicamente con un valor numérico, 0-999
                    </p>
                    <Input
                      id="shell-hx7"
                      type="number"
                      min="0"
                      max="999"
                      value={ventasShell.helixHX7}
                      onChange={(e) =>
                        handleVentasShellChange("helixHX7", e.target.value)
                      }
                      disabled={isSyncing}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shell-hx8">
                      Total en litros de SHELL HELIX HX8 vendidos: *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Responde únicamente con un valor numérico, 0-999
                    </p>
                    <Input
                      id="shell-hx8"
                      type="number"
                      min="0"
                      max="999"
                      value={ventasShell.helixHX8}
                      onChange={(e) =>
                        handleVentasShellChange("helixHX8", e.target.value)
                      }
                      disabled={isSyncing}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shell-ultra">
                      Total en litros de SHELL HELIX ULTRA vendidos: *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Responde únicamente con un valor numérico, 0-999
                    </p>
                    <Input
                      id="shell-ultra"
                      type="number"
                      min="0"
                      max="999"
                      value={ventasShell.helixUltra}
                      onChange={(e) =>
                        handleVentasShellChange("helixUltra", e.target.value)
                      }
                      disabled={isSyncing}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shell-rimula">
                      Total en litros de SHELL RIMULA vendidos: *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Responde únicamente con un valor numérico, 0-999
                    </p>
                    <Input
                      id="shell-rimula"
                      type="number"
                      min="0"
                      max="999"
                      value={ventasShell.rimula}
                      onChange={(e) =>
                        handleVentasShellChange("rimula", e.target.value)
                      }
                      disabled={isSyncing}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shell-spirax">
                      Total en litros de SHELL SPIRAX vendidos: *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Responde únicamente con un valor numérico, 0-999
                    </p>
                    <Input
                      id="shell-spirax"
                      type="number"
                      min="0"
                      max="999"
                      value={ventasShell.spirax}
                      onChange={(e) =>
                        handleVentasShellChange("spirax", e.target.value)
                      }
                      disabled={isSyncing}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shell-gadus">
                      Total en cartuchos de SHELL GADUS vendidos: *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Responde únicamente con un valor numérico, 0-999
                    </p>
                    <Input
                      id="shell-gadus"
                      type="number"
                      min="0"
                      max="999"
                      value={ventasShell.gadus}
                      onChange={(e) =>
                        handleVentasShellChange("gadus", e.target.value)
                      }
                      disabled={isSyncing}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shell-otros">
                      Total en litros de OTROS vendidos: *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      OTROS representa productos como: Nautilus, Hydraulic,
                      Tellus, etc. Responde únicamente con un valor numérico,
                      0-999
                    </p>
                    <Input
                      id="shell-otros"
                      type="number"
                      min="0"
                      max="999"
                      value={ventasShell.otros}
                      onChange={(e) =>
                        handleVentasShellChange("otros", e.target.value)
                      }
                      disabled={isSyncing}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Ventas Qualid Detalladas */}
            {mostrarVentasQualid && (
              <div className="space-y-4 border rounded-lg p-4 bg-blue-50">
                <Label className="text-lg font-semibold">
                  Reporte de ventas productos QUALID
                </Label>
                <p className="text-sm text-muted-foreground">
                  Registra las cantidades en litros y en unidades de los
                  productos Qualid vendidos durante el impulso o evento.
                </p>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="qualid-fluidos">
                      Total en litros de QUALID FLUIDOS vendidos: *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Responde únicamente con un valor numérico, 0-999
                    </p>
                    <Input
                      id="qualid-fluidos"
                      type="number"
                      min="0"
                      max="999"
                      value={ventasQualid.fluidos}
                      onChange={(e) =>
                        handleVentasQualidChange("fluidos", e.target.value)
                      }
                      disabled={isSyncing}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="qualid-spray">
                      Total en unidades de QUALID SPRAY vendido: *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Responde únicamente con un valor numérico, 0-999
                    </p>
                    <Input
                      id="qualid-spray"
                      type="number"
                      min="0"
                      max="999"
                      value={ventasQualid.spray}
                      onChange={(e) =>
                        handleVentasQualidChange("spray", e.target.value)
                      }
                      disabled={isSyncing}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="qualid-filtro">
                      Total en unidades de QUALID FILTRO AUTOMOTRIZ vendidos: *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Responde únicamente con un valor numérico, 0-999
                    </p>
                    <Input
                      id="qualid-filtro"
                      type="number"
                      min="0"
                      max="999"
                      value={ventasQualid.filtroAutomotriz}
                      onChange={(e) =>
                        handleVentasQualidChange(
                          "filtroAutomotriz",
                          e.target.value
                        )
                      }
                      disabled={isSyncing}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="qualid-pesado">
                      Total en unidades de productos QUALID SERVICIO PESADO
                      vendidos: *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Responde únicamente con un valor numérico, 0-999
                    </p>
                    <Input
                      id="qualid-pesado"
                      type="number"
                      min="0"
                      max="999"
                      value={ventasQualid.servicioPesado}
                      onChange={(e) =>
                        handleVentasQualidChange(
                          "servicioPesado",
                          e.target.value
                        )
                      }
                      disabled={isSyncing}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="qualid-cauchos">
                      Total en unidades de CAUCHOS QUALID vendidos: *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Responde únicamente con un valor numérico, 0-999
                    </p>
                    <Input
                      id="qualid-cauchos"
                      type="number"
                      min="0"
                      max="999"
                      value={ventasQualid.cauchos}
                      onChange={(e) =>
                        handleVentasQualidChange("cauchos", e.target.value)
                      }
                      disabled={isSyncing}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button
              onClick={handleContinuar}
              disabled={isSyncing}
              className="w-full"
              style={{
                background: "linear-gradient(to right, #fcce05, #ff0000)",
                color: "white",
                fontWeight: "bold",
              }}
            >
              {isSyncing ? "Guardando..." : "Continuar a Reportes Finales"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </PageWrapper>
  );
}
