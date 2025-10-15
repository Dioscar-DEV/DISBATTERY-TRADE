'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCircle, MapPin, Loader2 } from 'lucide-react';
import { getGPSLocation, GPSCoordinates } from '@/services/gpsService';

const VISIT_TYPES = [
  'Trade (Eventos)',
  'Trade (Impulso)',
  'Merchandising (Material Interno)',
  'Merchandising (Externo)',
];

// Componente interno que usa useSearchParams
function VisitCaptureContent() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Estados unificados para el componente
  const [pointId, setPointId] = useState<string | null>(null);
  const [pointName, setPointName] = useState<string | null>(null);
  const [pointType, setPointType] = useState<string | null>(null);

  const [selectedVisitType, setSelectedVisitType] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [gpsCoordinates, setGpsCoordinates] = useState<GPSCoordinates | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isCheckingClientVisitType, setIsCheckingClientVisitType] = useState(true);
  const [showVisitTypeSelector, setShowVisitTypeSelector] = useState(false);

  // Efecto para obtener los datos del punto desde la URL
  useEffect(() => {
    if (searchParams) {
      const pId = searchParams.get('pointId');
      const pName = searchParams.get('pointName');
      const pType = searchParams.get('pointType');
      if (pId) setPointId(pId);
      if (pName) setPointName(pName);
      if (pType) setPointType(pType);
    }
    setIsLoading(false);
  }, [searchParams]);

  // Efecto para verificar si la visita tiene un tipo predefinido
  useEffect(() => {
    const checkClientVisitType = async () => {
      try {
        setIsCheckingClientVisitType(true);
        const clienteDataString = localStorage.getItem('clienteData');

        if (!clienteDataString) {
          setShowVisitTypeSelector(true);
          return;
        }

        const clienteData = JSON.parse(clienteDataString);

        if (clienteData.tipoVisita) {
          toast({
            title: 'Tipo de visita definido',
            description: `Procesando visita: ${clienteData.tipoVisita}`,
          });

          // Capturar GPS y redirigir
          await handleRedirection(clienteData.tipoVisita);
        } else {
          setShowVisitTypeSelector(true);
        }
      } catch (error) {
        console.error('Error verificando tipo de visita:', error);
        setShowVisitTypeSelector(true);
      } finally {
        setIsCheckingClientVisitType(false);
      }
    };

    checkClientVisitType();
  }, [router, toast]);

  // Función unificada para capturar GPS, guardar datos y redirigir
  const handleRedirection = async (visitType: string) => {
    setIsSubmitting(true);
    try {
      // Guarda el tipo de visita inmediatamente
      setSelectedVisitType(visitType);

      // 1. Capturar GPS
      const location = await getGPSLocation();
      if (location) {
        setGpsCoordinates(location);
        toast({
          title: 'Ubicación GPS Capturada',
          description: `Lat: ${location.latitude.toFixed(4)}, Lon: ${location.longitude.toFixed(4)}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Advertencia de Ubicación',
          description: 'No se pudo obtener la ubicación GPS. El reporte se guardará sin esta información.',
        });
      }

      // 2. Guardar datos en localStorage
      const clienteDataString = localStorage.getItem('clienteData');
      if (clienteDataString) {
        const clienteData = JSON.parse(clienteDataString);
        clienteData.tipoVisita = visitType; // ✅ LÍNEA CRÍTICA RESTAURADA
        clienteData.gpsCoordinates = location; // Añadir coordenadas GPS a los datos del cliente
        localStorage.setItem('clienteData', JSON.stringify(clienteData));
      }

      // 3. Redirigir
      if (visitType === 'Trade (Eventos)') {
        router.push('/trade-eventos');
      } else {
        router.push('/signage-capture');
      }
    } catch (error) {
      console.error("Error al continuar con la visita:", error);
      toast({
        variant: 'destructive',
        title: 'Error Inesperado',
        description: 'Ocurrió un error al procesar la visita. Intente de nuevo.',
      });
      setIsSubmitting(false);
    }
  };

  const isFormValid = showVisitTypeSelector && selectedVisitType;

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 relative overflow-hidden">
      {/* Decorative SVG Background */}
      <div className="absolute top-0 left-0 w-full h-full z-0 pointer-events-none">
        <svg viewBox="0 0 500 800" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          <path d="M0,0 L0,700 Q150,800 500,600 V0 Z" fill="#D90429" />
        </svg>
      </div>

      {/* Header Area */}
      <header className="relative z-20 h-20 flex items-center justify-between px-4 sm:px-6 bg-gradient-to-r from-gray-200 to-gray-400 shadow-md">
        <Button
          variant="ghost"
          className="flex items-center text-gray-700 hover:bg-gray-300/50 p-2 rounded-md text-lg font-semibold"
        >
          <UserCircle className="w-7 h-7 mr-2 text-black" />
          <span className="text-black">Usuario</span>
        </Button>
        <img
          src="https://storage.googleapis.com/iandai/imagenes/disbatterylogo.png"
          alt="Disbattery Lubricantes Logo"
          className="max-h-8"
          data-ai-hint="company logo darktext"
        />
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col items-center justify-center p-4 z-10">
        <Card className="w-full max-w-md bg-white shadow-[0px_4px_12px_rgba(0,0,0,0.1)] border border-gray-100 rounded-2xl">
          <CardHeader className="text-center pt-6 pb-4 px-6">
            <CardTitle className="text-xl font-bold text-[#0A4B8B]">
              Ejecucion de Visita o Accion
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-gray-700">
              {pointName ? `Cliente: ${pointName}` : 'Favor ingresa los datos del cliente a ejecutar'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="location"
                value={address || (gpsCoordinates ? `Lat: ${gpsCoordinates.latitude.toFixed(4)}...` : 'Capturando ubicación...')}
                readOnly
                type="text"
                className="pl-10 placeholder:italic"
              />
            </div>

            {isCheckingClientVisitType || isLoading ? (
              <div className="text-center py-4">
                <Loader2 className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Verificando configuración del cliente...</p>
              </div>
            ) : showVisitTypeSelector ? (
              <div>
                <Label htmlFor="visit-type" className="text-gray-700">Tipo de visita</Label>
                <Select onValueChange={setSelectedVisitType} value={selectedVisitType || ''}>
                  <SelectTrigger className="w-full mt-1" id="visit-type">
                    <SelectValue placeholder="Seleccionar tipo de visita" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Merchandising (Externo)">Merchandising (Externo)</SelectItem>
                    <SelectItem value="Merchandising (Material Interno)">Merchandising (Material Interno)</SelectItem>
                    <SelectItem value="Trade (Impulso)">Trade (Impulso)</SelectItem>
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
                onClick={() => selectedVisitType && handleRedirection(selectedVisitType)}
                className={cn(
                  "w-full text-white font-semibold py-3 rounded-full",
                  isFormValid && !isSubmitting
                    ? "bg-gradient-to-r from-[#007BFF] to-[#0056b3]"
                    : "bg-gray-400 cursor-not-allowed"
                )}
                disabled={!isFormValid || isSubmitting}
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Siguiente'}
              </Button>
            </CardFooter>
          )}
        </Card>
      </main>

      {/* Footer Section */}
      <footer className="h-14 z-10 flex fixed bottom-0 w-full">
        <div className="w-1/4 h-full bg-[#0033A0]"></div>
        <div className="w-1/4 h-full bg-[#D90429]"></div>
        <div className="w-1/2 h-full bg-[#FFC72C] flex items-center justify-end px-4">
          {/* Logo de Shell removido */}
        </div>
      </footer>
    </div>
  );
}

// Componente principal con Suspense boundary
export default function VisitCapturePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <VisitCaptureContent />
    </Suspense>
  );
}

