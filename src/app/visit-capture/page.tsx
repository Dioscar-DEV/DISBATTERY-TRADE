"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

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
import { cn } from "@/lib/utils";
import { GPSCoordinates, getGPSLocation } from "@/services/gpsService";
import { Loader2, MapPin } from "lucide-react";
import { PageWrapper } from "@/components/PageWrapper";

const LOCAL_STORAGE_KEYS = {
  clienteData: "clienteData",
} as const;

const VISIT_TYPES = {
  EVENT: "Trade (Eventos)",
  IMPULSO: "Trade (Impulso)",
  MERCH_INTERNAL: "Merchandising (Material Interno)",
  MERCH_EXTERNAL: "Merchandising (Externo)",
} as const;

const SELECTABLE_VISIT_TYPES = [
  VISIT_TYPES.MERCH_EXTERNAL,
  VISIT_TYPES.MERCH_INTERNAL,
  VISIT_TYPES.IMPULSO,
] as const;

const VISIT_TYPE_ROUTES: Record<VisitType, string> = {
  [VISIT_TYPES.EVENT]: "/trade-eventos",
  [VISIT_TYPES.IMPULSO]: "/signage-capture",
  [VISIT_TYPES.MERCH_INTERNAL]: "/signage-capture",
  [VISIT_TYPES.MERCH_EXTERNAL]: "/signage-capture",
};

type VisitType = (typeof VISIT_TYPES)[keyof typeof VISIT_TYPES];

type ClienteData = {
  tipoVisita?: VisitType;
  gpsCoordinates?: GPSCoordinates | null;
  [key: string]: unknown;
};

// Componente interno que usa useSearchParams
function VisitCaptureContent() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const { pointName, isLoading: isPointLoading } = usePointData(searchParams);
  const {
    gpsCoordinates,
    handleRedirection,
    isCheckingClientVisitType,
    isSubmitting,
    selectedVisitType,
    setSelectedVisitType,
    showVisitTypeSelector,
  } = useVisitFlow({ router, toast });

  const locationDisplay = formatLocationDisplay(gpsCoordinates);
  const isFormValid = showVisitTypeSelector && Boolean(selectedVisitType);

  return (
    <PageWrapper title="Ejecución de Visita o Acción">
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4">
        <Card className="w-full max-w-md bg-white shadow-[0px_4px_12px_rgba(0,0,0,0.1)] border border-gray-100 rounded-2xl">
          <CardHeader className="text-center pt-6 pb-4 px-6">
            <CardTitle className="text-xl font-bold text-[#0A4B8B]">
              Ejecución de Visita o Acción
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-gray-700">
              {pointName
                ? `Cliente: ${pointName}`
                : "Favor ingresa los datos del cliente a ejecutar"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="location"
                value={locationDisplay}
                readOnly
                type="text"
                className="pl-10 placeholder:italic"
              />
            </div>

            {isCheckingClientVisitType || isPointLoading ? (
              <div className="text-center py-4">
                <Loader2 className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Verificando configuración del cliente...
                </p>
              </div>
            ) : showVisitTypeSelector ? (
              <div>
                <Label htmlFor="visit-type" className="text-gray-700">
                  Tipo de visita
                </Label>
                <Select
                  onValueChange={(value) =>
                    setSelectedVisitType(value as VisitType)
                  }
                  value={selectedVisitType ?? ""}
                >
                  <SelectTrigger className="w-full mt-1" id="visit-type">
                    <SelectValue placeholder="Seleccionar tipo de visita" />
                  </SelectTrigger>
                  <SelectContent>
                    {SELECTABLE_VISIT_TYPES.map((visitType) => (
                      <SelectItem key={visitType} value={visitType}>
                        {visitType}
                      </SelectItem>
                    ))}
                    {/* Eventos no se selecciona manualmente */}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="text-center py-4">
                <Loader2 className="animate-spin h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Configurando visita...</p>
              </div>
            )}
          </CardContent>
          {showVisitTypeSelector && (
            <CardFooter className="px-6 pb-6">
              <Button
                onClick={() =>
                  selectedVisitType && handleRedirection(selectedVisitType)
                }
                className={cn(
                  "w-full text-white font-semibold py-3 rounded-full",
                  isFormValid && !isSubmitting
                    ? "bg-gradient-to-r from-[#007BFF] to-[#0056b3]"
                    : "bg-gray-400 cursor-not-allowed"
                )}
                disabled={!isFormValid || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  "Siguiente"
                )}
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </PageWrapper>
  );
}

// Componente principal con Suspense boundary
export default function VisitCapturePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Cargando...</p>
          </div>
        </div>
      }
    >
      <VisitCaptureContent />
    </Suspense>
  );
}

function usePointData(searchParams: ReturnType<typeof useSearchParams> | null) {
  const [state, setState] = useState({
    pointId: null as string | null,
    pointName: null as string | null,
    pointType: null as string | null,
    isLoading: true,
  });

  useEffect(() => {
    if (!searchParams) {
      setState({
        pointId: null,
        pointName: null,
        pointType: null,
        isLoading: false,
      });
      return;
    }

    setState({
      pointId: searchParams.get("pointId"),
      pointName: searchParams.get("pointName"),
      pointType: searchParams.get("pointType"),
      isLoading: false,
    });
  }, [searchParams]);

  return state;
}

function useVisitFlow({
  router,
  toast,
}: {
  router: ReturnType<typeof useRouter>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [selectedVisitType, setSelectedVisitType] = useState<VisitType | null>(
    null
  );
  const [gpsCoordinates, setGpsCoordinates] = useState<GPSCoordinates | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingClientVisitType, setIsCheckingClientVisitType] =
    useState(true);
  const [showVisitTypeSelector, setShowVisitTypeSelector] = useState(false);

  const handleRedirection = useCallback(
    async (visitType: VisitType) => {
      setIsSubmitting(true);
      setSelectedVisitType(visitType);

      try {
        const location = await getGPSLocation();
        setGpsCoordinates(location ?? null);

        if (location) {
          toast({
            title: "Ubicación GPS Capturada",
            description: `Lat: ${location.latitude.toFixed(4)}, Lon: ${location.longitude.toFixed(4)}`,
          });
        } else {
          toast({
            variant: "destructive",
            title: "Advertencia de Ubicación",
            description:
              "No se pudo obtener la ubicación GPS. El reporte se guardará sin esta información.",
          });
        }

        const clienteData = loadClienteData();
        if (clienteData) {
          const updatedClienteData: ClienteData = {
            ...clienteData,
            tipoVisita: visitType,
            gpsCoordinates: location ?? null,
          };
          persistClienteData(updatedClienteData);
        }

        router.push(getRouteForVisitType(visitType));
      } catch (error) {
        console.error("Error al continuar con la visita:", error);
        toast({
          variant: "destructive",
          title: "Error Inesperado",
          description:
            "Ocurrió un error al procesar la visita. Intente de nuevo.",
        });
        setIsSubmitting(false);
      }
    },
    [router, toast]
  );

  useEffect(() => {
    const checkClientVisitType = async () => {
      try {
        setIsCheckingClientVisitType(true);

        const clienteData = loadClienteData();
        const prefilledVisitType = clienteData?.tipoVisita as
          | VisitType
          | undefined;

        if (!clienteData) {
          setShowVisitTypeSelector(true);
          return;
        }

        if (prefilledVisitType) {
          toast({
            title: "Tipo de visita definido",
            description: `Procesando visita: ${prefilledVisitType}`,
          });

          await handleRedirection(prefilledVisitType);
        } else {
          setShowVisitTypeSelector(true);
        }
      } catch (error) {
        console.error("Error verificando tipo de visita:", error);
        setShowVisitTypeSelector(true);
      } finally {
        setIsCheckingClientVisitType(false);
      }
    };

    checkClientVisitType();
  }, [handleRedirection, toast]);

  return {
    gpsCoordinates,
    handleRedirection,
    isCheckingClientVisitType,
    isSubmitting,
    selectedVisitType,
    setSelectedVisitType,
    showVisitTypeSelector,
  };
}

function loadClienteData(): ClienteData | null {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.clienteData);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ClienteData;
  } catch (error) {
    console.error("Error parsing clienteData from localStorage:", error);
    return null;
  }
}

function persistClienteData(data: ClienteData) {
  localStorage.setItem(LOCAL_STORAGE_KEYS.clienteData, JSON.stringify(data));
}

function getRouteForVisitType(visitType: VisitType) {
  return VISIT_TYPE_ROUTES[visitType] ?? "/signage-capture";
}

function formatLocationDisplay(gpsCoordinates: GPSCoordinates | null) {
  return gpsCoordinates
    ? `Lat: ${gpsCoordinates.latitude.toFixed(4)}...`
    : "Capturando ubicación...";
}
