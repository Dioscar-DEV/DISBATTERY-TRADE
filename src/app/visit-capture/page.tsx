'use client';

import {useRouter} from 'next/navigation';
import {useEffect, useState, useRef} from 'react';

import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {Input}from '@/components/ui/input';
import {Label}from '@/components/ui/label';
import {cn}from '@/lib/utils';
// import {getAddressForCoordinate}from '@/services/geography'; // Not used in current logic
import {useToast}from '@/hooks/use-toast';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue}from '@/components/ui/select';
import { UserCircle, MapPin } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/clientApp';

// Function to fetch client data from Firestore by RIF
const fetchClientData = async (rif: string) => {
  try {
    const clientesRef = collection(db, 'clientes');
    const q = query(clientesRef, where('rif', '==', rif));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const clientDoc = querySnapshot.docs[0];
      const clientData = clientDoc.data();
      return {
        id: clientDoc.id,
        name: clientData.nombre,
        rif: clientData.rif,
        direccion: clientData.direccion,
        telefono: clientData.telefono,
        email: clientData.email
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching client data:', error);
    return null;
  }
};

export default function VisitCapture() {
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string>(new Date().toLocaleString());
  const {toast} = useToast();
  const [visitType, setVisitType] = useState<string>('');
  const [isCheckingClientVisitType, setIsCheckingClientVisitType] = useState(true);
  const [showVisitTypeSelector, setShowVisitTypeSelector] = useState(false);
  const router = useRouter();

  // ✅ Mostrar mensaje de bienvenida offline
  useEffect(() => {
    if (!navigator.onLine) {
      toast({
        title: '🔄 Modo Offline Activado',
        description: 'Los formularios funcionan sin internet. Los datos se guardarán localmente.',
      });
    }
  }, [toast]);

  useEffect(() => {
    const getLocation = () => {
      // ✅ MEJORA OFFLINE: Solo intentar ubicación si hay internet
      if (!navigator.onLine) {
        console.log('🔄 Modo offline: saltando obtención de ubicación GPS');
        return;
      }

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          position => {
            setLocation(position.coords);
            console.log('Latitude:', position.coords.latitude);
            console.log('Longitude:', position.coords.longitude);
          },
          error => {
            console.error('Error getting location:', error);
            // ✅ MEJORA: Mensaje menos alarmante si no hay internet
            if (!navigator.onLine) {
              console.log('📍 Ubicación no disponible en modo offline');
              return;
            }
            toast({
              variant: 'destructive',
              title: 'Acceso a la Ubicación Denegado',
              description: 'Por favor, active los permisos de ubicación en la configuración de su navegador para usar esta aplicación.',
            });
          }
        );
      } else {
        console.error('La geolocalización no es soportada por este navegador.');
      }
    };

    getLocation();
  }, [toast]);

  // Verificar si el cliente tiene un tipo de visita predeterminado
  useEffect(() => {
    const checkClientVisitType = async () => {
      try {
        setIsCheckingClientVisitType(true);
        
        // Obtener datos del cliente desde localStorage
        const clienteDataString = localStorage.getItem('clienteData');
        if (!clienteDataString) {
          console.log('No hay datos del cliente en localStorage');
          setShowVisitTypeSelector(true);
          setIsCheckingClientVisitType(false);
          return;
        }

        const clienteData = JSON.parse(clienteDataString);
        console.log('🔍 Datos del cliente desde localStorage:', clienteData);
        
        // ✅ CORREGIDO: Usar directamente el tipoVisita de la ruta
        if (clienteData.tipoVisita) {
          console.log('✅ Tipo de visita ya definido en la ruta:', clienteData.tipoVisita);
          
          toast({
            title: '✅ Tipo de visita definido',
            description: `Procesando visita: ${clienteData.tipoVisita}`,
          });

          // Redirigir automáticamente con el tipo de visita de la ruta
          const queryParams = new URLSearchParams({
            visitType: clienteData.tipoVisita,
          });

          router.push(`/signage-capture?${queryParams.toString()}`);
          return;
        }
        
        // ✅ FALLBACK: Solo si no hay tipoVisita definido, verificar si es evento
        if (clienteData.isEvent === true) {
          console.log('🎪 Es un evento sin tipoVisita - usando Trade (Eventos)');
          
          toast({
            title: '🎪 Evento detectado',
            description: `Procesando evento: ${clienteData.nombre}`,
          });

          const queryParams = new URLSearchParams({
            visitType: 'Trade (Eventos)',
          });

          router.push(`/signage-capture?${queryParams.toString()}`);
          return;
        }
        
        // ✅ ÚLTIMO RECURSO: Solo preguntar si no hay tipoVisita definido
        console.log('⚠️ No se encontró tipoVisita definido, preguntando al usuario');
        setShowVisitTypeSelector(true);
        
      } catch (error) {
        console.error('❌ Error verificando tipo de visita del cliente:', error);
        setShowVisitTypeSelector(true);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Hubo un error al verificar la configuración del cliente. Seleccione el tipo de visita manualmente.',
        });
      } finally {
        setIsCheckingClientVisitType(false);
      }
    };

    checkClientVisitType();
  }, [router, toast]);

  useEffect(() => {
    const fetchAddress = async () => {
      if (location) {
        try {
          setAddress(`Lat: ${location.latitude.toFixed(5)}, Lon: ${location.longitude.toFixed(5)}`);
        } catch (error) {
          console.error('Error al obtener la dirección:', error);
          setAddress('No se pudo recuperar la dirección');
        }
      }
    };

    fetchAddress();
  }, [location]);

  const handleVisitTypeChange = (value: string) => {
    setVisitType(value);
  };

  const handleNextPage = () => {
      if (!visitType) {
        toast({
            variant: 'destructive',
            title: 'Tipo de Visita Requerido',
            description: 'Por favor, seleccione el tipo de visita.',
        });
        return;
      }
      
      const queryParams = new URLSearchParams({
          visitType,
      });

      router.push(`/signage-capture?${queryParams.toString()}`);
  };

  const canProceedToClientDetails = !!visitType;
  const isFormValid = showVisitTypeSelector && visitType;


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
              Favor ingresa los datos del cliente a ejecutar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
           <div className="relative">
             <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
             <Input
                id="location"
                value={address || 'Capturando ubicación...'}
                readOnly
                type="text"
                className="pl-10 placeholder:italic"
              />
           </div>
          
          {isCheckingClientVisitType ? (
            <div className="text-center py-4">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Verificando configuración del cliente...</p>
            </div>
          ) : showVisitTypeSelector ? (
            <div>
              <Label htmlFor="visit-type" className="text-gray-700">Tipo de visita</Label>
              <Select onValueChange={handleVisitTypeChange} value={visitType}>
                <SelectTrigger className="w-full mt-1" id="visit-type">
                  <SelectValue placeholder="Seleccionar tipo de visita" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Merchandising">Merchandising</SelectItem>
                  <SelectItem value="Trade (Impulso)">Trade (Impulso)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Configurando visita...</p>
            </div>
          )}
          
          <Input
            id="timestamp"
            value={timestamp}
            readOnly
            type="hidden" 
          />

          </CardContent>
          {showVisitTypeSelector && (
            <CardFooter className="px-6 pb-6">
              <Button 
                onClick={handleNextPage} 
                className={cn(
                  "w-full text-white font-semibold py-3 rounded-full",
                  isFormValid 
                    ? "bg-gradient-to-r from-[#007BFF] to-[#0056b3]" 
                    : "bg-gradient-to-r from-[#A9C9E8] to-[#B0B9D1]"
                )}
                disabled={!isFormValid}
              >
                Siguiente
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

