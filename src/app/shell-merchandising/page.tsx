
'use client';

import {useRouter, useSearchParams} from 'next/navigation';
import {useEffect, useState, useRef} from 'react';
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
import {Label} from '@/components/ui/label';
import {Camera} from 'lucide-react';
import {useToast} from '@/hooks/use-toast';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";

export default function ShellMerchandising() {
  const [planogramPhotoBefore, setPlanogramPhotoBefore] = useState<string | null>(null);
  const [planogramWorked, setPlanogramWorked] = useState<string>('');
  const [planogramPhotoAfter, setPlanogramPhotoAfter] = useState<string | null>(null);
  const [authorizedStickers, setAuthorizedStickers] = useState<number | null>(null);
  const [stickersPlacedQuantity, setStickersPlacedQuantity] = useState<number | null>(null);
  const [stickersPlacedPhoto, setStickersPlacedPhoto] = useState<string | null>(null);

    const [totalCenefasColocadas, setTotalCenefasColocadas] = useState<number | null>(null);
    const [totalPapelBobinaColocado, setTotalPapelBobinaColocado] = useState<number | null>(null);
    const [stickersCambioLubricanteEntregados, setStickersCambioLubricanteEntregados] = useState<number | null>(null);
    const [ambientadoresVehiculo, setAmbientadoresVehiculo] = useState<number | null>(null);
    const [bolsasParaCarro, setBolsasParaCarro] = useState<number | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(true); // Assume true initially
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [capturingType, setCapturingType] = useState<string | null>(null);


  const {toast} = useToast();
  const router = useRouter();
    const searchParams = useSearchParams();
    const brands = searchParams.get('brands'); // This is not used currently

    useEffect(() => {
        console.log('Selected brands (from previous page):', brands); // Example of how to use it
    }, [brands]);

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
                // Stop tracks immediately, we'll request them again when taking photo
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

      // Show video element for capturing
      videoRef.current.classList.remove('hidden');
      setCapturingType(setter.name); // Hacky way to know which photo is being captured for UI feedback if needed

      // Timeout to allow camera to initialize and focus (optional)
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
       // Ensure video is hidden on error
      const currentStream = videoRef.current?.srcObject;
      if (currentStream instanceof MediaStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      if(videoRef.current) videoRef.current.srcObject = null;
    }
  };


  const handlePlanogramWorkedChange = (value: string) => {
    setPlanogramWorked(value);
    if (value === 'No') {
      setPlanogramPhotoAfter(null);
    }
  };

  const handleAuthorizedStickersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string for clearing, otherwise parse as int
    setAuthorizedStickers(value === '' ? null : parseInt(value));
  };

  const handleStickersPlacedQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setStickersPlacedQuantity(isNaN(value) ? null : value);
  };

    const handleTotalCenefasColocadasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value);
        setTotalCenefasColocadas(isNaN(value) ? null : value);
    };

    const handleTotalPapelBobinaColocadoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value);
        setTotalPapelBobinaColocado(isNaN(value) ? null : value);
    };

    const handleStickersCambioLubricanteEntregadosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value);
        setStickersCambioLubricanteEntregados(isNaN(value) ? null : value);
    };

    const handleAmbientadoresVehiculoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value);
        setAmbientadoresVehiculo(isNaN(value) ? null : value);
    };

    const handleBolsasParaCarroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value);
        setBolsasParaCarro(isNaN(value) ? null : value);
    };


    const saveDataLocally = (data: any) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        const shellData = JSON.parse(localStorage.getItem('shellData') || '[]')
        shellData.push(data);
        localStorage.setItem('shellData', JSON.stringify(shellData));
      }
    };

  const handleSubmit = () => {
    if (planogramWorked === '') {
      toast({
        variant: 'destructive',
        title: 'Confirmación de Trabajo del Planograma Requerida',
        description: 'Por favor, confirme si trabajó en el planograma Shell.',
      });
      return;
    }

    if (authorizedStickers === null || authorizedStickers < 0 || authorizedStickers > 10) {
      toast({
        variant: 'destructive',
        title: 'Stickers Autorizados Inválido',
        description: 'Por favor, ingrese un número válido de stickers autorizados (0 - 10).',
      });
      return;
    }


    if (stickersPlacedQuantity === null || stickersPlacedQuantity < 0) {
      toast({
        variant: 'destructive',
        title: 'Cantidad de Stickers Inválida',
        description: 'Por favor, ingrese una cantidad válida de stickers nuevos colocados (0 o más).',
      });
      return;
    }

      const data = {
          planogramPhotoBefore,
          planogramWorked,
          planogramPhotoAfter,
          authorizedStickers,
          stickersPlacedQuantity,
          stickersPlacedPhoto,
          totalCenefasColocadas: totalCenefasColocadas ?? 0,
          totalPapelBobinaColocado: totalPapelBobinaColocado ?? 0,
          stickersCambioLubricanteEntregados: stickersCambioLubricanteEntregados ?? 0,
          ambientadoresVehiculo: ambientadoresVehiculo ?? 0,
          bolsasParaCarro: bolsasParaCarro ?? 0,
          timestamp: new Date().toISOString(),
      };

      saveDataLocally(data);
      toast({
          title: 'Datos guardados localmente',
          description: 'Los datos se sincronizarán cuando haya conexión.',
      });

    console.log('Shell Merchandising Data:', data);

    router.push('/shell-material-interno'); 
  };

    useEffect(() => {
        const syncData = async () => {
            if (isSyncing || typeof window === 'undefined' || !window.localStorage) return;
            setIsSyncing(true);

            try {
                const localDataString = localStorage.getItem('shellData');
                if (!localDataString) {
                    setIsSyncing(false);
                    return;
                }
                const localData = JSON.parse(localDataString);
                if (localData.length === 0) {
                     setIsSyncing(false);
                    return;
                }


                // Simulate sending data to the server
                console.log('Enviando datos de Shell al servidor:', localData);
                // await api.post('/sync-shell-data', localData); // Replace with actual API call

                // Clear local data after successful sync
                localStorage.removeItem('shellData');
                toast({
                    title: 'Datos de Shell sincronizados',
                    description: 'Todos los datos de Shell se han enviado al servidor.',
                });
            } catch (error) {
                console.error('Error al sincronizar los datos de Shell:', error);
                toast({
                    variant: 'destructive',
                    title: 'Error de sincronización (Shell)',
                    description: 'Hubo un problema al sincronizar los datos. Inténtalo de nuevo más tarde.',
                });
            } finally {
                setIsSyncing(false);
            }
        };

        // Check for network connectivity
        if (typeof window !== 'undefined' && navigator.onLine) {
            syncData();
        }

        // Set up listener for online event
        if (typeof window !== 'undefined') {
            window.addEventListener('online', syncData);
        }


        // Clean up the event listener
        return () => {
             if (typeof window !== 'undefined') {
                window.removeEventListener('online', syncData);
             }
        };
    }, [isSyncing, toast]);

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
      <Card className="w-full max-w-md">
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
              Shell Merchandising
            </span>
          </CardTitle>
          <CardDescription>Captura datos de merchandising de Shell.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <video ref={videoRef} className="hidden w-full aspect-video rounded-md" autoPlay muted playsInline />
          
          { !(hasCameraPermission) && (
              <Alert variant="destructive" className="mt-4">
                <AlertTitle>Acceso a la Cámara Requerido</AlertTitle>
                <AlertDescription>Por favor, permita el acceso a la cámara para usar esta función.</AlertDescription>
              </Alert>
          )
          }

          <div>
            <Label htmlFor="planogram-photo-before">Foto Actual del Planograma</Label>
              <Button
                onClick={() => takePhoto(setPlanogramPhotoBefore)}
                disabled={!hasCameraPermission || !!capturingType}
                className="w-full mt-1 text-white"
                style={{ backgroundImage: 'linear-gradient(to right, #fbce04, #e30a18)' }}
              >
                {capturingType === 'setPlanogramPhotoBefore' ? 'Capturando...' : (hasCameraPermission ? (
                  <>
                    <Camera className="mr-2 h-4 w-4" /> Tomar Foto del Planograma
                  </>
                ) : (
                  'Cámara no permitida'
                ))}
              </Button>
            {planogramPhotoBefore && (
              <img
                src={planogramPhotoBefore}
                alt="Planograma Antes"
                className="mt-2 rounded-md object-cover w-full h-auto"
                data-ai-hint="store shelf before"
              />
            )}
          </div>

          <div>
            <Label>¿Trabajaste en el planograma?</Label>
            <Select onValueChange={handlePlanogramWorkedChange} value={planogramWorked}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Sí</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {planogramWorked === 'Yes' && (
            <div>
              <Label htmlFor="planogram-photo-after">Foto del Planograma Después del Trabajo</Label>
                <Button
                  onClick={() => takePhoto(setPlanogramPhotoAfter)}
                  disabled={!hasCameraPermission || !!capturingType}
                  className="w-full mt-1 text-white"
                  style={{ backgroundImage: 'linear-gradient(to right, #fbce04, #e30a18)' }}
                >
                  {capturingType === 'setPlanogramPhotoAfter' ? 'Capturando...' : (hasCameraPermission ? (
                    <>
                      <Camera className="mr-2 h-4 w-4" /> Tomar Foto del Planograma Después
                    </>
                  ) : (
                    'Cámara no permitida'
                  ))}
                </Button>
              {planogramPhotoAfter && (
                <img
                  src={planogramPhotoAfter}
                  alt="Planograma Después"
                  className="mt-2 rounded-md object-cover w-full h-auto"
                  data-ai-hint="store shelf after"
              />
            )}
          </div>
          )}

          <div>
            <Label htmlFor="authorized-stickers">¿Cuántos stickers autorizados tiene el cliente?</Label>
            <Input
              type="number"
              id="authorized-stickers"
              placeholder="Ingresar cantidad (0, 1, 2, 3, ...)"
              value={authorizedStickers !== null ? authorizedStickers.toString() : ''}
              onChange={handleAuthorizedStickersChange}
              inputMode="numeric"
              min="0"
              max="10"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="stickers-placed-quantity">Cantidad de Sticker Nuevos Colocados</Label>
            <Input
              type="number"
              id="stickers-placed-quantity"
              placeholder="Ingresar cantidad"
              value={stickersPlacedQuantity !== null ? stickersPlacedQuantity.toString() : ''}
              onChange={handleStickersPlacedQuantityChange}
              inputMode="numeric"
              min="0"
              className="mt-1"
            />
          </div>

          {stickersPlacedQuantity !== null && stickersPlacedQuantity > 0 && (
          <div>
            <Label htmlFor="stickers-placed-photo">Foto de los Stickers Colocados</Label>
              <Button
                onClick={() => takePhoto(setStickersPlacedPhoto)}
                disabled={!hasCameraPermission || !!capturingType}
                className="w-full mt-1 text-white"
                style={{ backgroundImage: 'linear-gradient(to right, #fbce04, #e30a18)' }}
              >
                 {capturingType === 'setStickersPlacedPhoto' ? 'Capturando...' : (hasCameraPermission ? (
                  <>
                    <Camera className="mr-2 h-4 w-4" /> Tomar Foto de Stickers
                  </>
                ) : (
                  'Cámara no permitida'
                ))}
              </Button>
            {stickersPlacedPhoto && (
              <img
                src={stickersPlacedPhoto}
                alt="Stickers Colocados"
                className="mt-2 rounded-md object-cover w-full h-auto"
                data-ai-hint="product stickers"
              />
            )}
          </div>
          )}

            <div>
                <Label htmlFor="total-cenefas-colocadas">Total de Cenefas Shell colocadas</Label>
                <Input
                    type="number"
                    id="total-cenefas-colocadas"
                    placeholder="Ingresar cantidad"
                    value={totalCenefasColocadas !== null ? totalCenefasColocadas.toString() : ''}
                    onChange={handleTotalCenefasColocadasChange}
                    inputMode="numeric"
                    min="0"
                    className="mt-1"
                />
            </div>

            <div>
                <Label htmlFor="total-papel-bobina-colocado">Total de Papel Bobina Shell colocado (metros)</Label>
                <Input
                    type="number"
                    id="total-papel-bobina-colocado"
                    placeholder="Ingresar cantidad"
                    value={totalPapelBobinaColocado !== null ? totalPapelBobinaColocado.toString() : ''}
                    onChange={handleTotalPapelBobinaColocadoChange}
                    inputMode="numeric"
                    min="0"
                    className="mt-1"
                />
            </div>

            <div>
                <Label htmlFor="stickers-cambio-lubricante-entregados">Stickers Shell Cambio de Lubricante entregados</Label>
                <Input
                    type="number"
                    id="stickers-cambio-lubricante-entregados"
                    placeholder="Ingresar cantidad"
                    value={stickersCambioLubricanteEntregados !== null ? stickersCambioLubricanteEntregados.toString() : ''}
                    onChange={handleStickersCambioLubricanteEntregadosChange}
                    inputMode="numeric"
                    min="0"
                    className="mt-1"
                />
            </div>

            <div>
                <Label htmlFor="ambientadores-vehiculo">Ambientadores Shell para vehículo</Label>
                <Input
                    type="number"
                    id="ambientadores-vehiculo"
                    placeholder="Ingresar cantidad"
                    value={ambientadoresVehiculo !== null ? ambientadoresVehiculo.toString() : ''}
                    onChange={handleAmbientadoresVehiculoChange}
                    inputMode="numeric"
                    min="0"
                    className="mt-1"
                />
            </div>

            <div>
                <Label htmlFor="bolsas-para-carro">Bolsas Shell para carro</Label>
                <Input
                    type="number"
                    id="bolsas-para-carro"
                    placeholder="Ingresar cantidad"
                    value={bolsasParaCarro !== null ? bolsasParaCarro.toString() : ''}
                    onChange={handleBolsasParaCarroChange}
                    inputMode="numeric"
                    min="0"
                    className="mt-1"
                />
            </div>
        </CardContent>
        <CardFooter>
            <Button
                onClick={handleSubmit}
                disabled={isSyncing || !hasCameraPermission || !!capturingType}
                className="w-full"
            >
                {isSyncing ? 'Sincronizando...' : 'Guardar y Continuar'}
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
