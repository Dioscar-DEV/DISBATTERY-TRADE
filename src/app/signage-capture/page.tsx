
'use client';

import {useRouter, useSearchParams} from 'next/navigation';
import {useEffect, useState, useRef, Suspense} from 'react';

import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Label}from '@/components/ui/label';
import {Camera} from 'lucide-react';
import {useToast}from '@/hooks/use-toast';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function SignageCaptureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {toast} = useToast();

  const [clientRif, setClientRif] = useState<string>('');
  const [clientName, setClientName] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string>('');
  const [visitType, setVisitType] = useState<string>('');
  const [tradeSubType, setTradeSubType] = useState<string>('');
  
  const [hasSignage, setHasSignage] = useState<string>('');
  const [signagePhoto, setSignagePhoto] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const [capturingType, setCapturingType] = useState<string | null>(null);

  useEffect(() => {
    setClientRif(searchParams.get('clientRif') || '');
    setClientName(searchParams.get('clientName') || null);
    setAddress(searchParams.get('address') || '');
    setTimestamp(searchParams.get('timestamp') || new Date().toLocaleString());
    setVisitType(searchParams.get('visitType') || '');
    setTradeSubType(searchParams.get('tradeSubType') || '');
  }, [searchParams]);

  useEffect(() => {
    const getCameraPermission = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
             toast({
                variant: 'destructive',
                title: 'Cámara no Soportada',
                description: 'Su navegador no soporta el acceso a la cámara.',
            });
            setHasCameraPermission(false);
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment"
                },
            });
            setHasCameraPermission(true);
            stream.getTracks().forEach(track => track.stop());
        } catch (error) {
            console.error('Error accessing camera:', error);
            setHasCameraPermission(false);
            toast({
                variant: 'destructive',
                title: 'Acceso a la Cámara Denegado',
                description: 'Por favor, active los permisos de la cámara en la configuración de su navegador para usar esta aplicación.',
            });
        }
    };
    getCameraPermission();
  }, [toast]);

  const handleSignageChange = (value: string) => {
    setHasSignage(value);
    if (value === 'No') {
      setSignagePhoto(null);
    }
  };

  const takePhoto = async (setter: React.Dispatch<React.SetStateAction<string | null>>) => {
    if (!videoRef.current || !hasCameraPermission) {
        toast({
            variant: 'destructive',
            title: 'Cámara no lista',
            description: 'Permiso de cámara no concedido o cámara no disponible.',
        });
        return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      videoRef.current.classList.remove('hidden');
      setCapturingType(setter.name); 

      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
       if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const photoURL = canvas.toDataURL('image/png');
        setter(photoURL);
      } else {
        throw new Error('Could not get canvas context');
      }

      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      videoRef.current.classList.add('hidden');
      setCapturingType(null);

    } catch (error) {
      console.error("Error accessing camera or taking photo:", error);
      toast({
        variant: 'destructive',
        title: 'Error al tomar foto',
        description: 'Asegúrese de que la cámara esté disponible y los permisos habilitados.',
      });
      videoRef.current?.classList.add('hidden');
      setCapturingType(null);
      const currentStream = videoRef.current?.srcObject;
      if (currentStream instanceof MediaStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      if(videoRef.current) videoRef.current.srcObject = null;
    }
  };

  const handleNextPage = () => {
    if (hasSignage === '') {
        toast({
            variant: 'destructive',
            title: 'Señalización Requerida',
            description: 'Por favor, indique si el cliente tiene señalización.',
        });
        return;
    }
    
    const visitData = {
        clientRif,
        clientName,
        address,
        timestamp,
        visitType,
        tradeSubType: visitType === 'Trade (Eventos)' ? tradeSubType : null,
        hasSignage,
        signagePhoto,
    };
    console.log("Visit Start Data (including signage):", visitData);

    if (visitType === 'Merchandising') {
        router.push('/shell-merchandising');
    } else if (visitType === 'Trade (Eventos)') {
        if (tradeSubType === 'Impulso') {
            router.push('/trade-impulso');
        } else if (tradeSubType === 'Evento') {
             toast({
                title: `Flujo para ${tradeSubType} en Desarrollo`,
                description: `El flujo de Trade (${tradeSubType}) aún no está implementado.`,
            });
            router.push('/visit-capture');
        } else {
            toast({
              variant: 'destructive',
              title: 'Subtipo de Trade no válido',
              description: 'Por favor, regrese y seleccione un subtipo de Trade.',
            });
            router.push('/visit-capture');
        }
    } else {
        toast({
          variant: 'destructive',
          title: 'Tipo de Visita no válido',
          description: 'Por favor, regrese y seleccione un tipo de visita.',
        });
        router.push('/visit-capture');
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-4"
      style={{
        backgroundImage: 'url("https://storage.googleapis.com/iandai/imagenes/Dise%C3%B1o%20sin%20t%C3%ADtulo%20(51).png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Card className="w-full max-w-md space-y-4">
        <CardHeader className="text-center">
          <CardTitle>
             <span
              style={{
                backgroundImage: 'linear-gradient(to right, #fbce04, #e30a18)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Captura de Señalización
            </span>
          </CardTitle>
          {clientName && (
            <CardDescription>
              Cliente: <span className="font-semibold" style={{
                backgroundImage: 'linear-gradient(to right, hsl(var(--primary-gradient-start)), hsl(var(--primary-gradient-end)))',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                textShadow: '1px 1px 2px rgba(0,0,0,0.2)',
              }}>{clientName}</span>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <video ref={videoRef} className="hidden w-full aspect-video rounded-md" autoPlay muted playsInline />
          { !(hasCameraPermission) && (
              <Alert variant="destructive" className="mt-4">
                <AlertTitle>Acceso a la Cámara Requerido</AlertTitle>
                <AlertDescription>Por favor, permita el acceso a la cámara para usar esta función.</AlertDescription>
              </Alert>
          )}

          <div>
            <Label>¿El cliente tienen señalizacion?</Label>
            <Select onValueChange={handleSignageChange} value={hasSignage} disabled={!!capturingType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Sí</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasSignage === 'Yes' && (
            <div>
              <Label htmlFor="signage-photo">Foto de la Señalización</Label>
              <Button
                variant="outline"
                onClick={() => takePhoto(setSignagePhoto)}
                disabled={!hasCameraPermission || !!capturingType}
                className="w-full shadow-md text-white" 
                style={{ backgroundImage: 'linear-gradient(to right, #fbce04, #e30a18)' }}
              >
                {capturingType === 'setSignagePhoto' ? 'Capturando...' : (hasCameraPermission ? (
                <>
                  <Camera className="mr-2 h-4 w-4" /> Tomar Foto de la Señalización
                </>
              ) : (
                'Cámara no permitida'
              ))}
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
            disabled={hasSignage === '' || !!capturingType}
          >
            Siguiente
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}


export default function SignageCapturePage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <SignageCaptureContent />
    </Suspense>
  );
}

    
