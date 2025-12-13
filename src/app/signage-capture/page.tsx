"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, Suspense } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PermissionChecker } from "@/components/PermissionChecker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { offlineManager } from "@/services/offlineManager";
import { PageWrapper } from "@/components/PageWrapper";

function SignageCaptureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [clientRif, setClientRif] = useState<string>("");
  const [clientName, setClientName] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string>("");
  const [visitType, setVisitType] = useState<string>("");
  const [tradeSubType, setTradeSubType] = useState<string>("");

  const [hasSignage, setHasSignage] = useState<string>("");
  const [signagePhoto, setSignagePhoto] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const [capturingType, setCapturingType] = useState<string | null>(null);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);

  useEffect(() => {
    // 🔴 ERROR CORREGIDO: No leer de searchParams, sino de localStorage.
    const clienteDataString = localStorage.getItem("clienteData");
    if (clienteDataString) {
      const clienteData = JSON.parse(clienteDataString);
      setClientRif(clienteData.rif || "");
      setClientName(clienteData.nombre || null);
      setAddress(clienteData.direccion || "");
      setTimestamp(clienteData.timestamp || new Date().toLocaleString());
      setVisitType(clienteData.tipoVisita || ""); // ✅ LECTURA CORRECTA

      if (!clienteData.tipoVisita) {
        console.error(
          "CRITICAL ERROR: tipoVisita no encontrado en localStorage. Redirigiendo."
        );
        toast({
          variant: "destructive",
          title: "Error Crítico de Flujo",
          description:
            "No se encontró el tipo de visita. Por favor, inicie de nuevo.",
        });
        router.push("/mi-ruta");
      }
    } else {
      console.error(
        "CRITICAL ERROR: clienteData no encontrado en localStorage. Redirigiendo."
      );
      toast({
        variant: "destructive",
        title: "Error Crítico de Datos",
        description:
          "No se encontraron datos del cliente. Por favor, inicie de nuevo.",
      });
      router.push("/mi-ruta");
    }
  }, [router, toast]);

  // ✅ Mostrar mensaje de bienvenida offline
  useEffect(() => {
    if (typeof window !== "undefined" && !navigator.onLine) {
      toast({
        title: "🔄 Modo Offline Activado",
        description:
          "Los formularios funcionan sin internet. Las fotos se guardarán localmente.",
      });
    }
  }, [toast]);

  useEffect(() => {
    const getCameraPermission = async () => {
      // ✅ MEJORA OFFLINE: Verificación más tolerante sin internet
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
          variant: "destructive",
          title: "Cámara no Soportada",
          description: "Su navegador no soporta el acceso a la cámara.",
        });
        setHasCameraPermission(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
          },
        });
        setHasCameraPermission(true);
        stream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        console.error("Error accessing camera:", error);

        // ✅ MEJORA: Manejo específico para modo offline
        if (!navigator.onLine) {
          console.log(
            "📷 Modo offline: asumiendo permisos de cámara disponibles"
          );
          setHasCameraPermission(true); // Asumir que funciona offline
          return;
        }

        setHasCameraPermission(false);
        toast({
          variant: "destructive",
          title: "Acceso a la Cámara Denegado",
          description:
            "Por favor, active los permisos de la cámara en la configuración de su navegador para usar esta aplicación.",
        });
      }
    };
    getCameraPermission();
  }, [toast]);

  const handleSignageChange = (value: string) => {
    setHasSignage(value);
    if (value === "No") {
      setSignagePhoto(null);
    }
  };

  const takePhoto = async (
    setter: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    if (!videoRef.current || !hasCameraPermission) {
      toast({
        variant: "destructive",
        title: "Cámara no lista",
        description: "Permiso de cámara no concedido o cámara no disponible.",
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      videoRef.current.classList.remove("hidden");
      setCapturingType(setter.name);

      await new Promise((resolve) => setTimeout(resolve, 500));

      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const quality = parseFloat(
          process.env.NEXT_PUBLIC_CAMERA_QUALITY || "0.8"
        );
        const photoURL = canvas.toDataURL("image/jpeg", quality);
        setter(photoURL);
      } else {
        throw new Error("Could not get canvas context");
      }

      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      videoRef.current.classList.add("hidden");
      setCapturingType(null);
    } catch (error) {
      console.error("Error accessing camera or taking photo:", error);
      toast({
        variant: "destructive",
        title: "Error al tomar foto",
        description:
          "Asegúrese de que la cámara esté disponible y los permisos habilitados.",
      });
      videoRef.current?.classList.add("hidden");
      setCapturingType(null);
      const currentStream = videoRef.current?.srcObject;
      if (currentStream instanceof MediaStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  };

  const handleNextPage = async () => {
    if (hasSignage === "") {
      toast({
        variant: "destructive",
        title: "Señalización Requerida",
        description: "Por favor, indique si el cliente tiene señalización.",
      });
      return;
    }

    // ✅ VALIDACIÓN OBLIGATORIA: Foto de señalización cuando el cliente SÍ tiene
    if (hasSignage === "Yes" && !signagePhoto) {
      toast({
        variant: "destructive",
        title: "Foto de Señalización Requerida",
        description:
          "Debe tomar una foto de la señalización cuando indica que el cliente SÍ tiene.",
      });
      return;
    }

    const visitData = {
      clientRif,
      clientName,
      address,
      timestamp,
      visitType,
      hasSignage,
      signagePhoto,
    };

    // 🗺️ OBTENER DATOS EXISTENTES DEL CLIENTE PRIMERO (INCLUYENDO COORDENADAS)
    const existingClienteData = localStorage.getItem("clienteData");
    let existingData: any = {};
    if (existingClienteData) {
      existingData = JSON.parse(existingClienteData);
      console.log("🗺️ DATOS EXISTENTES DEL CLIENTE:", existingData);
      console.log("🗺️ COORDENADAS EXISTENTES:", existingData.position);
    }

    // Guardar datos del cliente en localStorage PRESERVANDO las coordenadas existentes
    const clienteData = {
      rif: clientRif || existingData.rif || "",
      nombre: clientName || existingData.nombre || "",
      direccion: address || existingData.direccion || "",
      // 🗺️ PRESERVAR COORDENADAS EXISTENTES - SOLO usar fallback si no hay coordenadas válidas
      position:
        existingData.position &&
        existingData.position.lat !== 0 &&
        existingData.position.lng !== 0
          ? existingData.position
          : existingData.position || { lat: 0, lng: 0 },
      // ✅ PRESERVAR EL IDENTIFICADOR DEL PUNTO PARA ACTUALIZAR STATUS EN LA RUTA
      pointId: existingData.pointId || "",
      sede: existingData.sede || "GRUPO DISBATTERY",
      telefono: existingData.telefono || "",
      email: existingData.email || "",
      contacto: existingData.contacto || "",
      region: existingData.region || "",
      ciudad: existingData.ciudad || "",
      tipo: existingData.tipo || "",
      // ✅ GUARDAR tipoVisita QUE USA EL RESTO DEL FLUJO
      tipoVisita: visitType || existingData.tipoVisita,
      visitType,
      hasSignage, // 'Yes' | 'No'
      signagePhoto, // base64
      timestamp,
    };

    console.log("🗺️ COORDENADAS FINALES PRESERVADAS:", clienteData.position);
    console.log(
      "🔍 DEBUGGING GPS - existingData.position:",
      existingData.position
    );
    console.log(
      "🔍 DEBUGGING GPS - tiene lat/lng válidos?:",
      existingData.position?.lat !== 0 && existingData.position?.lng !== 0
    );
    console.log(
      "🔍 DEBUGGING GPS - lat:",
      existingData.position?.lat,
      "lng:",
      existingData.position?.lng
    );

    console.log("🚩🚩🚩 === DEBUGGING SEÑALIZACIÓN EN SIGNAGE-CAPTURE ===");
    console.log("🚩 hasSignage VALUE:", hasSignage);
    console.log("🚩 hasSignage TYPE:", typeof hasSignage);
    console.log('🚩 hasSignage === "Yes":', hasSignage === "Yes");
    console.log('🚩 hasSignage === "No":', hasSignage === "No");
    console.log(
      "🚩 signagePhoto:",
      signagePhoto ? "FOTO CAPTURADA" : "NO FOTO"
    );
    console.log("🚩 clienteData.hasSignage:", clienteData.hasSignage);
    console.log(
      "🚩 clienteData.signagePhoto:",
      clienteData.signagePhoto
        ? "FOTO EN clienteData"
        : "NO FOTO EN clienteData"
    );

    // Verificar si estamos offline y necesitamos guardar datos de señalización
    if (
      typeof window !== "undefined" &&
      !navigator.onLine &&
      hasSignage === "Yes" &&
      signagePhoto
    ) {
      console.log(
        "🔄 Modo Offline: Guardando datos de señalización con offlineManager..."
      );

      try {
        // Crear datos mínimos para señalización offline
        const signageData = {
          tipoVisita: "Signage Capture",
          clienteData: clienteData,
          hasSignage: true,
          signagePhoto: signagePhoto,
          timestamp: new Date().toISOString(),
        };

        const saveResult = await offlineManager.saveVisita(signageData);

        if (saveResult.success) {
          console.log(
            "✅ Datos de señalización guardados offline:",
            saveResult.visitaId
          );

          toast({
            title: "Señalización Guardada Offline",
            description:
              "Los datos se sincronizarán automáticamente cuando haya conexión.",
          });
        }
      } catch (error) {
        console.warn("⚠️ Error guardando señalización offline:", error);
        // Continuar con el flujo normal aunque falle el guardado offline
      }
    }

    localStorage.setItem("clienteData", JSON.stringify(clienteData));

    // ✅ VERIFICACIÓN FINAL ANTES DE NAVEGAR
    const verificacion = localStorage.getItem("clienteData");
    const clienteVerificado = JSON.parse(verificacion || "{}");
    console.log("🚩🚩🚩 === VERIFICACIÓN FINAL ANTES DE NAVEGAR ===");
    console.log("🚩 DATOS GUARDADOS EN LOCALSTORAGE:");
    console.log("🚩 hasSignage guardado:", clienteVerificado.hasSignage);
    console.log(
      "🚩 signagePhoto guardado:",
      clienteVerificado.signagePhoto ? "SÍ GUARDADA" : "NO GUARDADA"
    );
    console.log("🚩 position guardado:", clienteVerificado.position);
    console.log("🚩 pointId guardado:", clienteVerificado.pointId);

    // 📝 GUARDAR LOG CRÍTICO PARA DEBUGGING
    const debugLog = {
      timestamp: new Date().toISOString(),
      page: "signage-capture",
      hasSignage: hasSignage,
      signagePhoto: signagePhoto ? "FOTO_CAPTURADA" : "NO_FOTO",
      clienteDataSaved: {
        hasSignage: clienteVerificado.hasSignage,
        signagePhoto: clienteVerificado.signagePhoto
          ? "GUARDADA"
          : "NO_GUARDADA",
        position: clienteVerificado.position,
      },
    };
    localStorage.setItem("debugSignageFlow", JSON.stringify(debugLog));
    console.log("📝 DEBUG LOG GUARDADO:", debugLog);

    console.log("Visit Start Data (including signage):", visitData);
    console.log("Cliente data saved to localStorage:", clienteData);
    console.log("🎯 RIF guardado:", clienteData.rif);
    console.log("🎯 Nombre guardado:", clienteData.nombre);

    if (visitType === "Merchandising") {
      router.push("/shell-merchandising");
    } else if (visitType === "Trade (Eventos)") {
      router.push("/trade-eventos");
    } else if (visitType === "Trade (Impulso)") {
      router.push("/trade-impulso");
    } else {
      toast({
        variant: "destructive",
        title: "Tipo de Visita no válido",
        description: "Por favor, regrese y seleccione un tipo de visita.",
      });
      router.push("/visit-capture");
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
        <Card className="w-full max-w-md space-y-4">
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
                Captura de Señalización
              </span>
            </CardTitle>
            {clientName && (
              <CardDescription>
                Cliente:{" "}
                <span
                  className="font-semibold"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, hsl(var(--primary-gradient-start)), hsl(var(--primary-gradient-end)))",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    textShadow: "1px 1px 2px rgba(0,0,0,0.2)",
                  }}
                >
                  {clientName}
                </span>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Botón de verificación de permisos */}
            <div className="flex justify-center">
              <Dialog
                open={showPermissionsDialog}
                onOpenChange={setShowPermissionsDialog}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Verificar Permisos
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Permisos de la Aplicación</DialogTitle>
                    <DialogDescription>
                      Verifica y activa los permisos necesarios para capturar
                      fotos y ubicación
                    </DialogDescription>
                  </DialogHeader>
                  <PermissionChecker
                    onPermissionsReady={(permissions) => {
                      setHasCameraPermission(permissions.camera === "granted");
                    }}
                    showCameraCheck={true}
                    showLocationCheck={true}
                  />
                </DialogContent>
              </Dialog>
            </div>

            <video
              ref={videoRef}
              className="hidden w-full aspect-video rounded-md"
              autoPlay
              muted
              playsInline
            />
            {!hasCameraPermission && (
              <Alert variant="destructive" className="mt-4">
                <AlertTitle>Acceso a la Cámara Requerido</AlertTitle>
                <AlertDescription>
                  Por favor, permita el acceso a la cámara para usar esta
                  función.
                  <br />
                  <Button
                    variant="link"
                    className="p-0 h-auto text-destructive underline mt-1"
                    onClick={() => setShowPermissionsDialog(true)}
                  >
                    🔧 Activar permisos aquí
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label>¿El cliente tienen señalizacion?</Label>
              <Select
                onValueChange={handleSignageChange}
                value={hasSignage}
                disabled={!!capturingType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Sí</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasSignage === "Yes" && (
              <div>
                <Label htmlFor="signage-photo">Foto de la Señalización</Label>
                <Button
                  variant="outline"
                  onClick={() => takePhoto(setSignagePhoto)}
                  disabled={!hasCameraPermission || !!capturingType}
                  className="w-full shadow-md text-white"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, #fbce04, #e30a18)",
                  }}
                >
                  {capturingType === "setSignagePhoto" ? (
                    "Capturando..."
                  ) : hasCameraPermission ? (
                    <>
                      <Camera className="mr-2 h-4 w-4" /> Tomar Foto de la
                      Señalización
                    </>
                  ) : (
                    "Cámara no permitida"
                  )}
                </Button>
                {signagePhoto && (
                  <img
                    src={signagePhoto}
                    alt="Señalización"
                    className="mt-2 rounded-md object-cover w-full h-auto"
                    data-ai-hint="storefront signage"
                  />
                )}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleNextPage}
              className="w-full shadow-md"
              disabled={hasSignage === "" || !!capturingType}
            >
              Siguiente
            </Button>
          </CardFooter>
        </Card>
      </div>
    </PageWrapper>
  );
}

export default function SignageCapturePage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <SignageCaptureContent />
    </Suspense>
  );
}
