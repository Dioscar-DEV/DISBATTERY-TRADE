"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, Trash, Video, X, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { setN8NWebhookURL } from "@/services/visitas";
import { RespuestasTrade } from "@/types/visitas";
import { getCurrentUser, getUserFromStorage } from "@/services/auth";
import { getGPSLocation, GPSCoordinates } from "@/services/gpsService";

interface RecursoUsado {
  tipo: string;
  cantidad: number;
}

interface EntregableUsado {
  tipo: string;
  cantidad: number;
}

const MARCAS_TRADE: string[] = ["Shell", "Qualid"];

const RECURSOS_IMPULSO_SHELL_TYPES: string[] = [
  "UNIFORMES DE PROMOTORAS SHELL",
  "BANDEROLAS SHELL",
  "IGLOO SHELL",
  "TOLDO SHELL",
  "EXHIBIDORES SHELL",
];

const RECURSOS_IMPULSO_QUALID_TYPES: string[] = [
  "UNIFORMES DE PROMOTORAS QUALID",
  "BANDEROLAS QUALID",
  "IGLOO QUALID",
  "TOLDO QUALID",
];

const ENTREGABLES_IMPULSO_SHELL_TYPES: string[] = [
  "Ambientadores Shell para vehiculos",
  "Bolsas Shell para carros",
  "Llaveros de Tela Shell",
  "Gorras Shell",
  "Bolsas Tipo Boutique Negro",
  "Bolsas Tipo Boutique Blanco",
  "Tapasol Shell/Qualid",
  "Globos Shell",
  "Vasos Shell",
  "Agendas",
];

const ENTREGABLES_IMPULSO_QUALID_TYPES: string[] = [
  "Bolsas Qualid para carros",
  "Esponjas Qualid",
  "Globos Qualid",
  "Gorras Qualid",
  "Llavero caucho Qualid",
  "Llavero de tela Qualid",
  "Paños Qualid",
  "Vasos Qualid",
];

const FOTO_LABELS = ["Stand", "Promotoras", "Ambiente"];

export default function TradeEventosPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Configurar URL del webhook N8N al inicializar
  useEffect(() => {
    setN8NWebhookURL("https://n8n.con-visas.com/webhook/Disbattery-Trade-app");
  }, []);

  // Establecer marcas automáticamente desde la ruta
  useEffect(() => {
    const marcasFromRoute = getMarcasFromRoute();
    if (marcasFromRoute && marcasFromRoute.length > 0) {
      setSelectedBrands(marcasFromRoute);
      console.log(
        "🎯 Marcas establecidas automáticamente desde ruta:",
        marcasFromRoute
      );
    }
  }, []);

  // Función para obtener las marcas desde la ruta
  const getMarcasFromRoute = () => {
    try {
      console.log("🔍 === INICIANDO BÚSQUEDA DE MARCA ===");

      const clienteDataString = localStorage.getItem("clienteData");
      if (!clienteDataString) {
        console.log("❌ No hay clienteData en localStorage");
        return null;
      }

      const clienteData = JSON.parse(clienteDataString);
      console.log(
        "🎯 Cliente actual:",
        clienteData.nombre,
        "RIF:",
        clienteData.rif
      );

      // 1. BUSCAR EN EVENTOS INDEPENDIENTES PRIMERO
      console.log("🔍 Buscando en eventos independientes...");
      const eventosString = localStorage.getItem("todaysEventsOffline");
      if (eventosString) {
        try {
          const eventos = JSON.parse(eventosString);
          console.log("📋 Eventos encontrados:", eventos.length);

          for (const evento of eventos) {
            console.log(
              "🔍 Revisando evento:",
              evento.nombreEvento,
              "Marcas:",
              evento.marcasTrabajadas || evento.marcaTrabajada
            );

            // Priorizar el nuevo formato con múltiples marcas
            if (evento.marcasTrabajadas && evento.marcasTrabajadas.length > 0) {
              console.log(
                "✅ MARCAS ENCONTRADAS EN EVENTO (NUEVO):",
                evento.marcasTrabajadas
              );
              return evento.marcasTrabajadas;
            }

            // Compatibilidad con formato anterior (una sola marca)
            if (evento.marcaTrabajada) {
              console.log(
                "✅ MARCA ENCONTRADA EN EVENTO (LEGADO):",
                evento.marcaTrabajada
              );
              return [evento.marcaTrabajada]; // Convertir a array para consistencia
            }
          }
        } catch (error) {
          console.error("❌ Error parseando eventos:", error);
        }
      } else {
        console.log("ℹ️ No hay eventos en localStorage");
      }

      // 2. BUSCAR EN RUTAS REGULARES
      console.log("🔍 Buscando en rutas regulares...");
      const todaysRoutesString = localStorage.getItem("todaysRoutesOffline");
      if (todaysRoutesString) {
        try {
          const todaysRoutes = JSON.parse(todaysRoutesString);
          console.log("📋 Rutas encontradas:", todaysRoutes.length);

          const currentRoute = todaysRoutes.find(
            (route: any) =>
              route.points &&
              route.points.some(
                (point: any) =>
                  point.rif === clienteData.rif &&
                  point.tipoVisita === "Trade (Eventos)"
              )
          );

          if (currentRoute) {
            console.log(
              "🎯 Ruta encontrada para el cliente:",
              currentRoute.mercaderista
            );

            // Buscar el punto específico que coincida con el cliente
            const matchingPoint = currentRoute.points.find(
              (point: any) =>
                point.rif === clienteData.rif &&
                point.tipoVisita === "Trade (Eventos)"
            );

            if (matchingPoint) {
              // Priorizar formato nuevo con múltiples marcas en el punto
              if (
                matchingPoint.marcasTrabajadas &&
                matchingPoint.marcasTrabajadas.length > 0
              ) {
                console.log(
                  "✅ MARCAS ENCONTRADAS EN PUNTO (NUEVO):",
                  matchingPoint.marcasTrabajadas
                );
                return matchingPoint.marcasTrabajadas;
              }
              // Compatibilidad con formato anterior en el punto
              if (matchingPoint.marcaTrabajada) {
                console.log(
                  "✅ MARCA ENCONTRADA EN PUNTO (LEGADO):",
                  matchingPoint.marcaTrabajada
                );
                return [matchingPoint.marcaTrabajada];
              }
            }

            // Fallback a la marca de la ruta si no hay marca específica en el punto
            if (
              currentRoute.marcasTrabajadas &&
              currentRoute.marcasTrabajadas.length > 0
            ) {
              console.log(
                "✅ MARCAS ENCONTRADAS EN RUTA (NUEVO):",
                currentRoute.marcasTrabajadas
              );
              return currentRoute.marcasTrabajadas;
            }
            if (currentRoute.marcaTrabajada) {
              console.log(
                "✅ MARCA ENCONTRADA EN RUTA (LEGADO):",
                currentRoute.marcaTrabajada
              );
              return [currentRoute.marcaTrabajada];
            }

            console.log("⚠️ Ruta encontrada pero sin marca asignada");
          } else {
            console.log(
              "❌ No se encontró ruta para este cliente con Trade (Eventos)"
            );
          }
        } catch (error) {
          console.error("❌ Error parseando rutas:", error);
        }
      } else {
        console.log("ℹ️ No hay rutas en localStorage");
      }

      // 3. BUSCAR DIRECTAMENTE EN VISIT DATA
      console.log("🔍 Buscando en visit data...");
      const visitDataString = localStorage.getItem("currentVisitData");
      if (visitDataString) {
        try {
          const visitData = JSON.parse(visitDataString);
          if (
            visitData.marcasTrabajadas &&
            visitData.marcasTrabajadas.length > 0
          ) {
            console.log(
              "✅ MARCAS ENCONTRADAS EN VISIT DATA (NUEVO):",
              visitData.marcasTrabajadas
            );
            return visitData.marcasTrabajadas;
          }
          if (visitData.marcaTrabajada) {
            console.log(
              "✅ MARCA ENCONTRADA EN VISIT DATA (LEGADO):",
              visitData.marcaTrabajada
            );
            return [visitData.marcaTrabajada];
          }
        } catch (error) {
          console.error("❌ Error parseando visit data:", error);
        }
      }

      console.log("❌ === NO SE ENCONTRÓ MARCA ASIGNADA ===");
      return null;
    } catch (error) {
      console.error("❌ Error obteniendo marca desde ruta:", error);
      return null;
    }
  };

  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [recursosAgregados, setRecursosAgregados] = useState<RecursoUsado[]>(
    []
  );
  const [currentTipoRecurso, setCurrentTipoRecurso] = useState<string>("");
  const [currentCantidadRecurso, setCurrentCantidadRecurso] =
    useState<string>("");

  const [entregablesShellAgregados, setEntregablesShellAgregados] = useState<
    EntregableUsado[]
  >([]);
  const [currentTipoEntregableShell, setCurrentTipoEntregableShell] =
    useState<string>("");
  const [currentCantidadEntregableShell, setCurrentCantidadEntregableShell] =
    useState<string>("");

  const [entregablesQualidAgregados, setEntregablesQualidAgregados] = useState<
    EntregableUsado[]
  >([]);
  const [currentTipoEntregableQualid, setCurrentTipoEntregableQualid] =
    useState<string>("");
  const [currentCantidadEntregableQualid, setCurrentCantidadEntregableQualid] =
    useState<string>("");

  // Estados para las 6 fotos del evento
  const [fotosEvento, setFotosEvento] = useState<(string | null)[]>(
    Array(6).fill(null)
  );

  // ✅ NUEVO: Estados de fotos separados por marca
  const [fotosShell, setFotosShell] = useState<(string | null)[]>(
    Array(3).fill(null)
  );
  const [fotosQualid, setFotosQualid] = useState<(string | null)[]>(
    Array(3).fill(null)
  );

  // Estados para videos del evento
  const [videosEvento, setVideosEvento] = useState<string[]>([]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [gpsCoordinates, setGpsCoordinates] = useState<GPSCoordinates | null>(
    null
  );

  const uploadImage = async (
    setter: React.Dispatch<React.SetStateAction<string | null>>,
    photoType: string
  ) => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            setter(result);
            toast({
              title: "✅ Imagen subida",
              description: "La imagen se ha cargado correctamente.",
            });
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        variant: "destructive",
        title: "Error al subir imagen",
        description: "Asegúrese de que el archivo sea una imagen válida.",
      });
    }
  };

  const uploadEventPhoto = async (index: number) => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            const newFotos = [...fotosEvento];
            newFotos[index] = result;
            setFotosEvento(newFotos);
            toast({
              title: `✅ Foto ${index + 1} subida`,
              description: "La imagen del evento se ha cargado correctamente.",
            });
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    } catch (error) {
      console.error("Error uploading event photo:", error);
      toast({
        variant: "destructive",
        title: "Error al subir foto del evento",
        description: "Asegúrese de que el archivo sea una imagen válida.",
      });
    }
  };

  // ✅ NUEVAS FUNCIONES PARA CARGAR FOTOS POR MARCA
  const uploadBrandPhoto = async (brand: "Shell" | "Qualid", index: number) => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            if (brand === "Shell") {
              const newFotos = [...fotosShell];
              newFotos[index] = result;
              setFotosShell(newFotos);
            } else {
              const newFotos = [...fotosQualid];
              newFotos[index] = result;
              setFotosQualid(newFotos);
            }
            toast({
              title: `✅ Foto ${index + 1} (${brand}) subida`,
              description: "La imagen del evento se ha cargado correctamente.",
            });
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    } catch (error) {
      console.error(`Error uploading ${brand} photo:`, error);
      toast({
        variant: "destructive",
        title: `Error al subir foto de ${brand}`,
        description: "Asegúrese de que el archivo sea una imagen válida.",
      });
    }
  };

  const removeBrandPhoto = (brand: "Shell" | "Qualid", index: number) => {
    if (brand === "Shell") {
      const newFotos = [...fotosShell];
      newFotos[index] = null;
      setFotosShell(newFotos);
    } else {
      const newFotos = [...fotosQualid];
      newFotos[index] = null;
      setFotosQualid(newFotos);
    }
    toast({
      title: "Foto eliminada",
      description: `La foto ${index + 1} de ${brand} ha sido eliminada.`,
    });
  };

  const uploadVideo = async () => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "video/*";

      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            setVideosEvento([...videosEvento, result]);
            toast({
              title: "✅ Video subido",
              description: "El video del evento se ha cargado correctamente.",
            });
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    } catch (error) {
      console.error("Error uploading video:", error);
      toast({
        variant: "destructive",
        title: "Error al subir video",
        description: "Asegúrese de que el archivo sea un video válido.",
      });
    }
  };

  const removeVideo = (index: number) => {
    const newVideos = videosEvento.filter((_, i) => i !== index);
    setVideosEvento(newVideos);
    toast({
      title: "Video eliminado",
      description: "El video ha sido eliminado.",
    });
  };

  const handleAddRecurso = () => {
    if (!currentTipoRecurso) {
      toast({
        variant: "destructive",
        title: "Tipo de Recurso Requerido",
        description: "Por favor, seleccione un tipo de recurso.",
      });
      return;
    }
    if (currentCantidadRecurso === "" || currentCantidadRecurso === null) {
      toast({
        variant: "destructive",
        title: "Cantidad Requerida",
        description: "Por favor, ingrese la cantidad del recurso.",
      });
      return;
    }
    const cantidadNum = parseInt(currentCantidadRecurso);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      // Quantity must be greater than 0
      toast({
        variant: "destructive",
        title: "Cantidad Inválida",
        description: "Por favor, ingrese una cantidad válida (mayor que 0).",
      });
      return;
    }

    setRecursosAgregados([
      ...recursosAgregados,
      { tipo: currentTipoRecurso, cantidad: cantidadNum },
    ]);
    setCurrentTipoRecurso("");
    setCurrentCantidadRecurso("");
  };

  const handleRemoveRecurso = (indexToRemove: number) => {
    setRecursosAgregados(
      recursosAgregados.filter((_, index) => index !== indexToRemove)
    );
  };

  const handleAddEntregableShell = () => {
    if (!currentTipoEntregableShell) {
      toast({
        variant: "destructive",
        title: "Tipo de Entregable Requerido",
        description: "Por favor, seleccione un tipo de entregable.",
      });
      return;
    }
    if (
      currentCantidadEntregableShell === "" ||
      currentCantidadEntregableShell === null
    ) {
      toast({
        variant: "destructive",
        title: "Cantidad Requerida",
        description: "Por favor, ingrese la cantidad del entregable.",
      });
      return;
    }
    const cantidadNum = parseInt(currentCantidadEntregableShell);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      // Quantity must be greater than 0
      toast({
        variant: "destructive",
        title: "Cantidad Inválida",
        description: "Por favor, ingrese una cantidad válida (mayor que 0).",
      });
      return;
    }

    setEntregablesShellAgregados([
      ...entregablesShellAgregados,
      { tipo: currentTipoEntregableShell, cantidad: cantidadNum },
    ]);
    setCurrentTipoEntregableShell("");
    setCurrentCantidadEntregableShell("");
  };

  const handleRemoveEntregableShell = (indexToRemove: number) => {
    setEntregablesShellAgregados(
      entregablesShellAgregados.filter((_, index) => index !== indexToRemove)
    );
  };

  const handleAddEntregableQualid = () => {
    if (!currentTipoEntregableQualid) {
      toast({
        variant: "destructive",
        title: "Tipo de Entregable Requerido",
        description: "Por favor, seleccione un tipo de entregable Qualid.",
      });
      return;
    }
    if (
      currentCantidadEntregableQualid === "" ||
      currentCantidadEntregableQualid === null
    ) {
      toast({
        variant: "destructive",
        title: "Cantidad Requerida",
        description: "Por favor, ingrese la cantidad del entregable Qualid.",
      });
      return;
    }
    const cantidadNum = parseInt(currentCantidadEntregableQualid);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      toast({
        variant: "destructive",
        title: "Cantidad Inválida",
        description: "Por favor, ingrese una cantidad válida (mayor que 0).",
      });
      return;
    }

    setEntregablesQualidAgregados([
      ...entregablesQualidAgregados,
      { tipo: currentTipoEntregableQualid, cantidad: cantidadNum },
    ]);
    setCurrentTipoEntregableQualid("");
    setCurrentCantidadEntregableQualid("");
  };

  const handleRemoveEntregableQualid = (indexToRemove: number) => {
    setEntregablesQualidAgregados(
      entregablesQualidAgregados.filter((_, index) => index !== indexToRemove)
    );
  };

  const handleSubmit = async () => {
    console.log("=== GUARDANDO DATOS TRADE EVENTO PARCIAL ===");

    if (selectedBrands.length === 0) {
      toast({
        variant: "destructive",
        title: "Marca Requerida",
        description: "Por favor, seleccione al menos una marca.",
      });
      return;
    }

    // Verificar que al menos 3 fotos hayan sido subidas
    const fotosSubidas =
      fotosShell.filter((f) => f).length + fotosQualid.filter((f) => f).length;
    if (fotosSubidas < 3) {
      toast({
        variant: "destructive",
        title: "Fotos Requeridas",
        description: "Por favor, suba al menos 3 fotos del evento.",
      });
      return;
    }

    try {
      setIsSyncing(true);

      // OBTENER DATOS DEL CLIENTE Y UBICACIÓN (YA CAPTURADA) DESDE LOCALSTORAGE
      const clienteDataString = localStorage.getItem("clienteData");
      if (!clienteDataString) {
        toast({
          variant: "destructive",
          title: "Error de Cliente",
          description: "No se encontraron datos del cliente. Vuelva al inicio.",
        });
        setIsSyncing(false);
        return;
      }

      const cliente = JSON.parse(clienteDataString);
      const location = cliente.gpsCoordinates; // Usar la ubicación ya guardada

      // Obtener datos del usuario logueado
      let currentUser = await getCurrentUser();
      if (!currentUser) {
        currentUser = getUserFromStorage();
      }

      const mercaderista = currentUser?.fullName || "Usuario App";
      const correoMercaderista = currentUser?.email || "";

      // Preparar datos para guardar localmente (sin enviar aún)
      const tradeEventoData = {
        tipoVisita: "Trade (Eventos)",
        marcas: selectedBrands,
        recursosUsados: recursosAgregados,
        entregablesShell: entregablesShellAgregados,
        entregablesQualid: entregablesQualidAgregados,
        fotosEvento: fotosEvento.filter((foto) => foto !== null), // MANTENER PARA COMPATIBILIDAD
        fotosShell: fotosShell.filter((f) => f !== null), // NUEVO
        fotosQualid: fotosQualid.filter((f) => f !== null), // NUEVO
        videosEvento: videosEvento,
        gpsCoordinates: location,
        clienteData: cliente,
        mercaderista: mercaderista,
        correoMercaderista: correoMercaderista,
        timestamp: new Date().toISOString(),
      };

      // Guardar en localStorage para reportes finales (SIEMPRE, online u offline)
      localStorage.setItem(
        "datosFormularioCompleto",
        JSON.stringify(tradeEventoData)
      );

      console.log("=== DATOS TRADE EVENTO GUARDADOS LOCALMENTE ===");
      console.log("Datos guardados:", tradeEventoData);

      toast({
        title: "Datos Guardados",
        description: "Continuando a reportes finales...",
      });

      // Ir directamente a reportes finales
      router.push("/reportes-finales");
    } catch (error) {
      console.log("=== ERROR GUARDANDO DATOS TRADE EVENTO ===");
      console.error("Error completo:", error);

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

  const getCurrentResourceList = () => {
    let allResources: string[] = [];
    if (selectedBrands.includes("Shell")) {
      allResources = [...allResources, ...RECURSOS_IMPULSO_SHELL_TYPES];
    }
    if (selectedBrands.includes("Qualid")) {
      allResources = [...allResources, ...RECURSOS_IMPULSO_QUALID_TYPES];
    }
    return allResources;
  };

  const availableRecursoTypes = getCurrentResourceList().filter(
    (tipo) => !recursosAgregados.find((r) => r.tipo === tipo)
  );

  const availableEntregableShellTypes = ENTREGABLES_IMPULSO_SHELL_TYPES.filter(
    (tipo) => !entregablesShellAgregados.find((e) => e.tipo === tipo)
  );

  const availableEntregableQualidTypes =
    ENTREGABLES_IMPULSO_QUALID_TYPES.filter(
      (tipo) => !entregablesQualidAgregados.find((e) => e.tipo === tipo)
    );

  const fotosSubidas =
    fotosShell.filter((f) => f).length + fotosQualid.filter((f) => f).length;

  // Función para determinar si se puede continuar
  const canProceed = () => {
    const fotosSubidas =
      fotosShell.filter((f) => f).length + fotosQualid.filter((f) => f).length;

    return selectedBrands.length > 0 && fotosSubidas >= 3;
  };

  const handleBrandChange = (brand: string, checked: boolean) => {
    if (checked) {
      setSelectedBrands((prev) => [...prev, brand]);
    } else {
      setSelectedBrands((prev) => prev.filter((b) => b !== brand));
      // Si se desmarca Shell, limpiar sus entregables
      if (brand === "Shell") {
        setEntregablesShellAgregados([]);
        setCurrentTipoEntregableShell("");
        setCurrentCantidadEntregableShell("");
      }
      // Si se desmarca Qualid, limpiar sus entregables
      if (brand === "Qualid") {
        setEntregablesQualidAgregados([]);
        setCurrentTipoEntregableQualid("");
        setCurrentCantidadEntregableQualid("");
      }
    }
    // Limpiar recursos cuando cambie la selección
    setRecursosAgregados([]);
    setCurrentTipoRecurso("");
    setCurrentCantidadRecurso("");
  };

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-4 pt-safe"
      style={{
        backgroundImage:
          'url("https://storage.googleapis.com/iandai/imagenes/Dise%C3%B1o%20sin%20t%C3%ADtulo%20(51).png")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <span
              style={{
                backgroundImage: "linear-gradient(to right, #fbce04, #e30a18)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Registro de Evento Trade
            </span>
          </CardTitle>
          <CardDescription>
            Ingrese los detalles del evento realizado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="font-medium">Marcas Trabajadas</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Seleccione las marcas que trabajará en este evento. Puede
              seleccionar ambas.
            </p>
            <div className="space-y-3">
              {MARCAS_TRADE.map((marca) => (
                <label key={marca} className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedBrands.includes(marca)}
                    onChange={(e) => handleBrandChange(marca, e.target.checked)}
                    disabled={isSyncing}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">{marca}</span>
                </label>
              ))}
            </div>
            {selectedBrands.length === 0 && (
              <p className="text-sm text-orange-600 mt-2">
                ⚠️ Seleccione al menos una marca para continuar.
              </p>
            )}
            {selectedBrands.length > 0 && (
              <p className="text-sm text-green-600 mt-2">
                ✓ Marcas seleccionadas: {selectedBrands.join(", ")}
              </p>
            )}
          </div>

          {selectedBrands.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <Label className="font-medium">
                Recursos Utilizados ({selectedBrands.join(" y ")})
              </Label>
              <div className="flex items-end space-x-2">
                <div className="flex-grow space-y-1">
                  <Label htmlFor="tipo-recurso-select">Tipo de Recurso</Label>
                  <Select
                    value={currentTipoRecurso}
                    onValueChange={setCurrentTipoRecurso}
                    disabled={availableRecursoTypes.length === 0 || isSyncing}
                  >
                    <SelectTrigger id="tipo-recurso-select">
                      <SelectValue
                        placeholder={
                          availableRecursoTypes.length > 0
                            ? "Seleccionar recurso"
                            : "Todos agregados"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRecursoTypes.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-1/3 space-y-1">
                  <Label htmlFor="cantidad-recurso-input">Cantidad</Label>
                  <Input
                    id="cantidad-recurso-input"
                    type="number"
                    placeholder="Ingresar cantidad (0, 1, 2, 3, ...)"
                    value={currentCantidadRecurso}
                    onChange={(e) => setCurrentCantidadRecurso(e.target.value)}
                    inputMode="numeric"
                    min="1"
                    disabled={isSyncing}
                  />
                </div>
                <Button
                  onClick={handleAddRecurso}
                  disabled={
                    !currentTipoRecurso ||
                    currentCantidadRecurso === "" ||
                    parseInt(currentCantidadRecurso) <= 0 ||
                    availableRecursoTypes.length === 0 ||
                    isSyncing
                  }
                  className="shrink-0"
                >
                  Agregar
                </Button>
              </div>

              {recursosAgregados.length > 0 && (
                <div className="mt-4 space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Recursos agregados:
                  </Label>
                  <ul className="space-y-1">
                    {recursosAgregados.map((recurso, index) => (
                      <li
                        key={index}
                        className="flex justify-between items-center p-2 border rounded-md bg-background"
                      >
                        <span className="text-sm">
                          {recurso.tipo}: {recurso.cantidad}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRecurso(index)}
                          disabled={isSyncing}
                        >
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {availableRecursoTypes.length === 0 &&
                getCurrentResourceList().length > 0 &&
                recursosAgregados.length ===
                  getCurrentResourceList().length && (
                  <p className="text-sm text-muted-foreground text-center mt-2">
                    Todos los tipos de recursos {selectedBrands.join(" y ")}{" "}
                    disponibles han sido agregados.
                  </p>
                )}
            </div>
          )}

          {selectedBrands.includes("Shell") && (
            <div className="space-y-4 border-t pt-4">
              <Label className="font-medium">Entregables Shell</Label>
              <div className="flex items-end space-x-2">
                <div className="flex-grow space-y-1">
                  <Label htmlFor="tipo-entregable-shell-select">
                    Tipo de Entregable
                  </Label>
                  <Select
                    value={currentTipoEntregableShell}
                    onValueChange={setCurrentTipoEntregableShell}
                    disabled={
                      availableEntregableShellTypes.length === 0 || isSyncing
                    }
                  >
                    <SelectTrigger id="tipo-entregable-shell-select">
                      <SelectValue
                        placeholder={
                          availableEntregableShellTypes.length > 0
                            ? "Seleccionar entregable"
                            : "Todos agregados"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEntregableShellTypes.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-1/3 space-y-1">
                  <Label htmlFor="cantidad-entregable-shell-input">
                    Cantidad
                  </Label>
                  <Input
                    id="cantidad-entregable-shell-input"
                    type="number"
                    placeholder="Ingresar cantidad"
                    value={currentCantidadEntregableShell}
                    onChange={(e) =>
                      setCurrentCantidadEntregableShell(e.target.value)
                    }
                    inputMode="numeric"
                    min="1"
                    disabled={isSyncing}
                  />
                </div>
                <Button
                  onClick={handleAddEntregableShell}
                  disabled={
                    !currentTipoEntregableShell ||
                    currentCantidadEntregableShell === "" ||
                    parseInt(currentCantidadEntregableShell) <= 0 ||
                    availableEntregableShellTypes.length === 0 ||
                    isSyncing
                  }
                  className="shrink-0"
                >
                  Agregar
                </Button>
              </div>

              {entregablesShellAgregados.length > 0 && (
                <div className="mt-4 space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Entregables Shell agregados:
                  </Label>
                  <ul className="space-y-1">
                    {entregablesShellAgregados.map((entregable, index) => (
                      <li
                        key={index}
                        className="flex justify-between items-center p-2 border rounded-md bg-background"
                      >
                        <span className="text-sm">
                          {entregable.tipo}: {entregable.cantidad}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveEntregableShell(index)}
                          disabled={isSyncing}
                        >
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {availableEntregableShellTypes.length === 0 &&
                ENTREGABLES_IMPULSO_SHELL_TYPES.length > 0 &&
                entregablesShellAgregados.length ===
                  ENTREGABLES_IMPULSO_SHELL_TYPES.length && (
                  <p className="text-sm text-muted-foreground text-center mt-2">
                    Todos los tipos de entregables Shell disponibles han sido
                    agregados.
                  </p>
                )}
            </div>
          )}

          {selectedBrands.includes("Qualid") && (
            <div className="space-y-4 border-t pt-4">
              <Label className="font-medium">Entregables Qualid</Label>
              <div className="flex items-end space-x-2">
                <div className="flex-grow space-y-1">
                  <Label htmlFor="tipo-entregable-qualid-select">
                    Tipo de Entregable
                  </Label>
                  <Select
                    value={currentTipoEntregableQualid}
                    onValueChange={setCurrentTipoEntregableQualid}
                    disabled={
                      availableEntregableQualidTypes.length === 0 || isSyncing
                    }
                  >
                    <SelectTrigger id="tipo-entregable-qualid-select">
                      <SelectValue
                        placeholder={
                          availableEntregableQualidTypes.length > 0
                            ? "Seleccionar entregable"
                            : "Todos agregados"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEntregableQualidTypes.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-1/3 space-y-1">
                  <Label htmlFor="cantidad-entregable-qualid-input">
                    Cantidad
                  </Label>
                  <Input
                    id="cantidad-entregable-qualid-input"
                    type="number"
                    placeholder="Ingresar cantidad"
                    value={currentCantidadEntregableQualid}
                    onChange={(e) =>
                      setCurrentCantidadEntregableQualid(e.target.value)
                    }
                    inputMode="numeric"
                    min="1"
                    disabled={isSyncing}
                  />
                </div>
                <Button
                  onClick={handleAddEntregableQualid}
                  disabled={
                    !currentTipoEntregableQualid ||
                    currentCantidadEntregableQualid === "" ||
                    parseInt(currentCantidadEntregableQualid) <= 0 ||
                    availableEntregableQualidTypes.length === 0 ||
                    isSyncing
                  }
                  className="shrink-0"
                >
                  Agregar
                </Button>
              </div>

              {entregablesQualidAgregados.length > 0 && (
                <div className="mt-4 space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Entregables Qualid agregados:
                  </Label>
                  <ul className="space-y-1">
                    {entregablesQualidAgregados.map((entregable, index) => (
                      <li
                        key={index}
                        className="flex justify-between items-center p-2 border rounded-md bg-background"
                      >
                        <span className="text-sm">
                          {entregable.tipo}: {entregable.cantidad}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveEntregableQualid(index)}
                          disabled={isSyncing}
                        >
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {availableEntregableQualidTypes.length === 0 &&
                ENTREGABLES_IMPULSO_QUALID_TYPES.length > 0 &&
                entregablesQualidAgregados.length ===
                  ENTREGABLES_IMPULSO_QUALID_TYPES.length && (
                  <p className="text-sm text-muted-foreground text-center mt-2">
                    Todos los tipos de entregables Qualid disponibles han sido
                    agregados.
                  </p>
                )}
            </div>
          )}

          {/* Sección de Fotos del Evento */}
          {selectedBrands.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <Label className="font-medium">
                Fotos del Evento (Mínimo 3 en total)
              </Label>
              <p className="text-sm text-muted-foreground">
                Sube fotos del evento, incluyendo la instalación, promotoras y
                ambiente general.
              </p>
              <p className="text-sm text-muted-foreground font-semibold">
                Fotos subidas:{" "}
                {fotosShell.filter((f) => f).length +
                  fotosQualid.filter((f) => f).length}
                /6
              </p>
            </div>
          )}

          {/* SECCIÓN DE FOTOS SHELL */}
          {selectedBrands.includes("Shell") && (
            <div className="space-y-4 border-t pt-4">
              <Label className="font-medium text-lg">
                📷 Fotos del Evento Shell
              </Label>
              <div className="grid grid-cols-2 gap-4">
                {fotosShell.map((foto, index) => (
                  <div key={`shell-${index}`} className="space-y-2">
                    <Label className="text-sm">
                      Foto {FOTO_LABELS[index]} (Shell)
                    </Label>
                    {foto ? (
                      <div className="relative">
                        <img
                          src={foto}
                          alt={`Foto de Shell ${index + 1}`}
                          className="w-full h-32 object-cover rounded-md border"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => removeBrandPhoto("Shell", index)}
                          disabled={isSyncing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full h-32 border-2 border-dashed"
                        onClick={() => uploadBrandPhoto("Shell", index)}
                        disabled={isSyncing}
                      >
                        <Camera className="mr-2 h-4 w-4" /> Subir Foto
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECCIÓN DE FOTOS QUALID */}
          {selectedBrands.includes("Qualid") && (
            <div className="space-y-4 border-t pt-4">
              <Label className="font-medium text-lg">
                📷 Fotos del Evento Qualid
              </Label>
              <div className="grid grid-cols-2 gap-4">
                {fotosQualid.map((foto, index) => (
                  <div key={`qualid-${index}`} className="space-y-2">
                    <Label className="text-sm">
                      Foto {FOTO_LABELS[index]} (Qualid)
                    </Label>
                    {foto ? (
                      <div className="relative">
                        <img
                          src={foto}
                          alt={`Foto de Qualid ${index + 1}`}
                          className="w-full h-32 object-cover rounded-md border"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => removeBrandPhoto("Qualid", index)}
                          disabled={isSyncing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full h-32 border-2 border-dashed"
                        onClick={() => uploadBrandPhoto("Qualid", index)}
                        disabled={isSyncing}
                      >
                        <Camera className="mr-2 h-4 w-4" /> Subir Foto
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sección de Videos del Evento */}
          {selectedBrands.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <Label className="font-medium">
                Videos del Evento (Opcional)
              </Label>
              <p className="text-sm text-muted-foreground">
                Sube videos cortos que capturen la dinámica del evento,
                interacción con clientes o momentos destacados.
              </p>
              <Button
                variant="outline"
                onClick={uploadVideo}
                disabled={isSyncing}
                className="w-full"
              >
                <Video className="mr-2 h-4 w-4" /> Subir Video
              </Button>
              {videosEvento.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Videos subidos:
                  </Label>
                  <ul className="space-y-2">
                    {videosEvento.map((video, index) => (
                      <li
                        key={index}
                        className="flex justify-between items-center p-2 border rounded-md bg-background"
                      >
                        <span className="text-sm">Video {index + 1}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVideo(index)}
                          disabled={isSyncing}
                        >
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleSubmit}
            disabled={!canProceed() || isSyncing}
            className="w-full"
            style={{
              backgroundImage: "linear-gradient(to right, #fbce04, #e30a18)",
            }}
          >
            {isSyncing ? "Guardando..." : "Siguiente"}
          </Button>

          {/* Indicador de progreso */}
          {selectedBrands.length > 0 && (
            <div className="ml-4 mt-0 p-3 bg-gray-50 rounded-md">
              <p className="text-sm font-medium mb-2">
                Progreso del formulario:
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className={"text-green-600"}>
                    Marcas seleccionadas ({selectedBrands.join(", ")})
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {fotosSubidas >= 3 ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span
                    className={
                      fotosSubidas >= 3 ? "text-green-600" : "text-gray-500"
                    }
                  >
                    Fotos del evento ({fotosSubidas}/6 - mínimo 3)
                  </span>
                </div>
                {videosEvento.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-600">
                      Video(s) añadido(s)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
