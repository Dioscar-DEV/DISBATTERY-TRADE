
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

// Mock function to simulate fetching client data from a database
const fetchClientData = async (rif: string) => {
  return new Promise(resolve => {
    setTimeout(() => {
      if (rif === 'J075852052') {
        resolve({name: 'Blitz 2000'});
      } else {
        resolve(null); 
      }
    }, 500); 
  });
};

export default function VisitCapture() {
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string>(new Date().toLocaleString());
  const [clientRif, setClientRif] = useState('');
  const {toast} = useToast();
  const [clientName, setClientName] = useState<string | null>(null);
  const [isClientIdentified, setIsClientIdentified] = useState(false);
  const [clientNotFound, setClientNotFound] = useState(false);
  const router = useRouter();
  const [isRifValid, setIsRifValid] = useState(false);
  const [visitType, setVisitType] = useState<string>('');
  const [tradeSubType, setTradeSubType] = useState<string>('');

  useEffect(() => {
    const getLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          position => {
            setLocation(position.coords);
            console.log('Latitude:', position.coords.latitude);
            console.log('Longitude:', position.coords.longitude);
          },
          error => {
            console.error('Error getting location:', error);
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


  const handleClientRifChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
      setClientRif(value);
    if (/^[J]\d{9}$/.test(value)) {
      setIsRifValid(true);
      setClientNotFound(false);
      const clientData = await fetchClientData(value) as { name: string } | null;
      if (clientData) {
        setClientName(clientData.name as string);
        setIsClientIdentified(true);
        setClientNotFound(false);
      } else {
        setClientName(null);
        setIsClientIdentified(false);
        setClientNotFound(true);
      }
    } else if (value === '') {
      setClientRif('');
      setClientName(null);
      setIsClientIdentified(false);
      setClientNotFound(false);
      setIsRifValid(false);
    } else {
      setClientName(null);
      setIsClientIdentified(false);
      setClientNotFound(false);
      setIsRifValid(false);
       if (value.length > 0 && !/^[J]\d{0,9}$/.test(value)) {
        toast({
          variant: 'destructive',
          title: 'Formato de RIF Inválido',
          description: 'Por favor, ingrese el RIF en el formato J123456789.',
        });
       }
    }
  };

  const handleVisitTypeChange = (value: string) => {
    setVisitType(value);
    setTradeSubType(''); 
    setClientRif('');
    setClientName(null);
    setIsClientIdentified(false);
    setClientNotFound(false);
    setIsRifValid(false);
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
      
      if (!clientRif) {
          toast({
              variant: 'destructive',
              title: 'RIF Requerido',
              description: 'Por favor, ingrese el RIF del cliente.',
          });
          return;
      }

      if (!isRifValid) {
        toast({
          variant: 'destructive',
          title: 'Formato de RIF Inválido',
          description: 'Por favor, ingrese el RIF en el formato J123456789.',
        });
        return;
      }
      
      if (clientNotFound && !isClientIdentified) {
         toast({
          variant: 'destructive',
          title: 'Cliente No Encontrado',
          description: 'Por favor, revise el RIF o asegúrese de que el cliente esté registrado.',
        });
        return;
      }

      if (!isClientIdentified) {
          toast({
              variant: 'destructive',
              title: 'Identificación del Cliente Requerida',
              description: 'Por favor, identifique al cliente antes de proceder.',
          });
          return;
      }
      
      if (visitType === 'Trade (Eventos)' && !tradeSubType) {
          toast({
              variant: 'destructive',
              title: 'Subtipo de Trade Requerido',
              description: 'Por favor, seleccione si es Impulso o Evento.',
          });
          return;
      }
      
      const queryParams = new URLSearchParams({
          clientRif,
          clientName: clientName || '',
          address: address || '',
          timestamp,
          visitType,
          ...(visitType === 'Trade (Eventos)' && { tradeSubType }),
      });

      router.push(`/signage-capture?${queryParams.toString()}`);
  };

  const canProceedToClientDetails = !!visitType;
  const isFormValid = visitType && isClientIdentified && (visitType !== 'Trade (Eventos)' || tradeSubType);


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
          

          <div>
            <Label htmlFor="visit-type" className="text-gray-700">Tipo de visita</Label>
            <Select onValueChange={handleVisitTypeChange} value={visitType}>
              <SelectTrigger className="w-full mt-1" id="visit-type">
                <SelectValue placeholder="Seleccionar tipo de visita" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Merchandising">Merchandising</SelectItem>
                <SelectItem value="Trade (Eventos)">Trade (Eventos)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {canProceedToClientDetails && (
            <>
              <div className="pt-2">
                <Label htmlFor="client-rif" className="text-gray-700">RIF del Cliente (J123456789)</Label>
                <Input
                  id="client-rif"
                  placeholder="J123456789"
                  value={clientRif}
                  onChange={handleClientRifChange}
                  maxLength={10}
                  className="mt-1"
                />
                  {clientNotFound && !isClientIdentified && (
                      <p className="mt-1 text-xs text-red-500">Cliente no registrado</p>
                  )}
              </div>
            
              {isClientIdentified && (
                <>
                  <div className="mt-2 mb-1 text-center">
                      <p className="text-lg font-bold text-[#0A4B8B]">
                        {clientName}
                      </p>
                  </div>

                  {visitType === 'Trade (Eventos)' && (
                    <div className="mt-2">
                      <Label htmlFor="trade-subtype" className="text-gray-700">Subtipo de Trade</Label>
                      <Select onValueChange={setTradeSubType} value={tradeSubType}>
                        <SelectTrigger className="w-full mt-1" id="trade-subtype">
                          <SelectValue placeholder="Seleccionar subtipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Impulso">Impulso</SelectItem>
                          <SelectItem value="Evento">Evento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          
          <Input
            id="timestamp"
            value={timestamp}
            readOnly
            type="hidden" 
          />

          </CardContent>
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
        </Card>
      </main>

      {/* Footer Section */}
      <footer className="h-14 z-10 flex fixed bottom-0 w-full">
        <div className="w-1/4 h-full bg-[#0033A0]"></div>
        <div className="w-1/4 h-full bg-[#D90429]"></div>
        <div className="w-1/2 h-full bg-[#FFC72C] flex items-center justify-end px-4">
          <img
            src="https://storage.googleapis.com/iandai/imagenes/shell.png"
            alt="Shell Logo"
            className="max-h-[4.5rem]" 
            data-ai-hint="shell pecten"
          />
        </div>
      </footer>
    </div>
  );
}

