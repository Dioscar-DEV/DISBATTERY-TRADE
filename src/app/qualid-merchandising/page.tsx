
'use client';

import {useRouter} from 'next/navigation';
import {useEffect, useState, useRef } from 'react';
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
import {useToast} from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Trash } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AficheColocado {
  tipo: string;
  cantidad: number;
}

interface ExhibidorCauchoColocado {
  tipo: string;
  cantidad: number;
}

const AFICHES_QUALID_TYPES: string[] = [
  'AFICHES CAMPAÑA QUALID CAUCHO 2023',
  'AFICHES CAMPAÑA QUALID CAUCHO 2024',
  'AFICHES CAMPAÑA QUALID CUIDADO AUTOMOTRIZ 2022',
  'AFICHES CAMPAÑA QUALID FF 2022',
  'AFICHES CAMPAÑA QUALID FILTROS 2022',
  'AFICHES CAMPAÑA QUALID MANTENIMIENTO 2022',
  'AFICHES CAMPAÑA QUALID TABLA CROSS REFERENCE SERVICIO PESADO 2024',
  'AFICHES CAMPAÑA QUALID TABLA DE APLICACIÓN',
  'AFICHES CAMPAÑA QUALID TABLA DE FILTRO AUTOMOTRIZ 2024',
  'AFICHE QUALID FILTROS AUTOMOTRIZ',
  'AFICHE QUALID FAMILY CAR CARE',
];

const EXHIBIDORES_CAUCHO_QUALID_TYPES: string[] = [
  'Exhibidor de caucho Pequeno',
  'Exhibidor de caucho grande',
];

export default function QualidMerchandising() {
  const [totalCenefasQualid, setTotalCenefasQualid] = useState<number | null>(null);
  const [bolsasQualidCarro, setBolsasQualidCarro] = useState<number | null>(null);
  
  const [afichesQualidAgregados, setAfichesQualidAgregados] = useState<AficheColocado[]>([]);
  const [currentTipoAficheQualid, setCurrentTipoAficheQualid] = useState<string>('');
  const [currentCantidadAficheQualid, setCurrentCantidadAficheQualid] = useState<string>('');
  const [fotoAfichesQualidColocados, setFotoAfichesQualidColocados] = useState<string | null>(null);

  const [exhibidoresCauchoQualidAgregados, setExhibidoresCauchoQualidAgregados] = useState<ExhibidorCauchoColocado[]>([]);
  const [currentTipoExhibidorCauchoQualid, setCurrentTipoExhibidorCauchoQualid] = useState<string>('');
  const [currentCantidadExhibidorCauchoQualid, setCurrentCantidadExhibidorCauchoQualid] = useState<string>('');
  const [fotoExhibidoresCauchoQualid, setFotoExhibidoresCauchoQualid] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [capturingType, setCapturingType] = useState<string | null>(null);

  const {toast} = useToast();
  const router = useRouter();

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

  const takePhoto = async (setter: React.Dispatch<React.SetStateAction<string | null>>, photoType: string) => {
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
      setCapturingType(photoType); 

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


  const handleTotalCenefasQualidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTotalCenefasQualid(value === '' ? null : parseInt(value));
  };

  const handleBolsasQualidCarroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBolsasQualidCarro(value === '' ? null : parseInt(value));
  };

  const handleAddAficheQualid = () => {
    if (!currentTipoAficheQualid) {
      toast({
        variant: 'destructive',
        title: 'Tipo de Afiche Qualid Requerido',
        description: 'Por favor, seleccione un tipo de afiche Qualid.',
      });
      return;
    }
    if (currentCantidadAficheQualid === '' || currentCantidadAficheQualid === null) {
        toast({
            variant: 'destructive',
            title: 'Cantidad Requerida',
            description: 'Por favor, ingrese la cantidad de afiches Qualid.',
        });
        return;
    }
    const cantidadNum = parseInt(currentCantidadAficheQualid);
    if (isNaN(cantidadNum) || cantidadNum < 0) {
      toast({
        variant: 'destructive',
        title: 'Cantidad Inválida',
        description: 'Por favor, ingrese una cantidad válida (0 o más).',
      });
      return;
    }

    setAfichesQualidAgregados([...afichesQualidAgregados, { tipo: currentTipoAficheQualid, cantidad: cantidadNum }]);
    setCurrentTipoAficheQualid('');
    setCurrentCantidadAficheQualid('');
  };

  const handleRemoveAficheQualid = (indexToRemove: number) => {
    setAfichesQualidAgregados(afichesQualidAgregados.filter((_, index) => index !== indexToRemove));
  };

  const handleAddExhibidorCauchoQualid = () => {
    if (!currentTipoExhibidorCauchoQualid) {
      toast({
        variant: 'destructive',
        title: 'Tipo de Exhibidor de Caucho Requerido',
        description: 'Por favor, seleccione un tipo de exhibidor de caucho Qualid.',
      });
      return;
    }
    if (currentCantidadExhibidorCauchoQualid === '' || currentCantidadExhibidorCauchoQualid === null) {
        toast({
            variant: 'destructive',
            title: 'Cantidad Requerida',
            description: 'Por favor, ingrese la cantidad de exhibidores de caucho.',
        });
        return;
    }
    const cantidadNum = parseInt(currentCantidadExhibidorCauchoQualid);
    if (isNaN(cantidadNum) || cantidadNum < 0) {
      toast({
        variant: 'destructive',
        title: 'Cantidad Inválida',
        description: 'Por favor, ingrese una cantidad válida (0 o más).',
      });
      return;
    }

    setExhibidoresCauchoQualidAgregados([...exhibidoresCauchoQualidAgregados, { tipo: currentTipoExhibidorCauchoQualid, cantidad: cantidadNum }]);
    setCurrentTipoExhibidorCauchoQualid('');
    setCurrentCantidadExhibidorCauchoQualid('');
  };

  const handleRemoveExhibidorCauchoQualid = (indexToRemove: number) => {
    setExhibidoresCauchoQualidAgregados(exhibidoresCauchoQualidAgregados.filter((_, index) => index !== indexToRemove));
  };

  const saveDataLocally = (data: any) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const qualidData = JSON.parse(localStorage.getItem('qualidData') || '[]')
      qualidData.push(data);
      localStorage.setItem('qualidData', JSON.stringify(qualidData));
    }
  };

  const handleSubmit = async () => {
    if (totalCenefasQualid === null || totalCenefasQualid < 0) {
      toast({
        variant: 'destructive',
        title: 'Cantidad de Cenefas Inválida',
        description: 'Por favor, ingrese un número válido para el total de cenefas Qualid colocadas (0 o más).',
      });
      return;
    }

    if (bolsasQualidCarro === null || bolsasQualidCarro < 0) {
      toast({
        variant: 'destructive',
        title: 'Cantidad de Bolsas Inválida',
        description: 'Por favor, ingrese un número válido para las bolsas Qualid para carros entregadas (0 o más).',
      });
      return;
    }

    const data = {
      totalCenefasQualid,
      bolsasQualidCarro,
      afichesQualidColocados: afichesQualidAgregados.map(af => ({ nombre: af.tipo, cantidad: af.cantidad })),
      fotoAfichesQualidColocados,
      exhibidoresCauchoQualid: exhibidoresCauchoQualidAgregados.map(ex => ({ tipo: ex.tipo, cantidad: ex.cantidad })),
      fotoExhibidoresCauchoQualid,
      timestamp: new Date().toISOString(),
    };

    saveDataLocally(data);
    toast({
      title: 'Datos de Qualid guardados localmente',
      description: 'Los datos se sincronizarán cuando haya conexión.',
    });
    console.log('Qualid Merchandising Data:', data);

    router.push('/observaciones'); 
  };

  useEffect(() => {
    const syncData = async () => {
      if (isSyncing || typeof window === 'undefined' || !window.localStorage) return;
      setIsSyncing(true);

      try {
        const localDataString = localStorage.getItem('qualidData');
        if (!localDataString) {
          setIsSyncing(false);
          return;
        }
        const localData = JSON.parse(localDataString);

        if (localData.length === 0) {
          setIsSyncing(false);
          return;
        }

        console.log('Enviando datos de Qualid al servidor:', localData);
        // await api.post('/sync-qualid-data', localData); // Replace with actual API call

        localStorage.removeItem('qualidData');
        toast({
          title: 'Datos de Qualid sincronizados',
          description: 'Todos los datos de Qualid se han enviado al servidor.',
        });
      } catch (error) {
        console.error('Error al sincronizar los datos de Qualid:', error);
        toast({
          variant: 'destructive',
          title: 'Error de sincronización (Qualid)',
          description: 'Hubo un problema al sincronizar los datos. Inténtalo de nuevo más tarde.',
        });
      } finally {
        setIsSyncing(false);
      }
    };

    if (typeof window !== 'undefined' && navigator.onLine) {
      syncData();
    }

    if(typeof window !== 'undefined') {
      window.addEventListener('online', syncData);
    }

    return () => {
      if(typeof window !== 'undefined') {
        window.removeEventListener('online', syncData);
      }
    };
  }, [isSyncing, toast]);

  const availableAficheQualidTypes = AFICHES_QUALID_TYPES.filter(
    tipo => !afichesQualidAgregados.find(a => a.tipo === tipo)
  );

  const availableExhibidorCauchoQualidTypes = EXHIBIDORES_CAUCHO_QUALID_TYPES.filter(
    tipo => !exhibidoresCauchoQualidAgregados.find(ex => ex.tipo === tipo)
  );

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
                backgroundImage: 'linear-gradient(to right, #fcce05, #ff0000)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Qualid Merchandising
            </span>
          </CardTitle>
          <CardDescription>Captura datos de merchandising de Qualid.</CardDescription>
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
            <Label htmlFor="total-cenefas-qualid">Total cenefas Qualid colocadas</Label>
            <Input
              id="total-cenefas-qualid"
              type="number"
              placeholder="Ingresar cantidad (0, 1, 2, 3, ...)"
              value={totalCenefasQualid !== null ? totalCenefasQualid.toString() : ''}
              onChange={handleTotalCenefasQualidChange}
              inputMode="numeric"
              min="0"
              className="mt-1"
              disabled={isSyncing || !!capturingType}
            />
          </div>

          <div>
            <Label htmlFor="bolsas-qualid-carro">Bolsas Qualid para carros entregadas</Label>
            <Input
              id="bolsas-qualid-carro"
              type="number"
              placeholder="Ingresar cantidad"
              value={bolsasQualidCarro !== null ? bolsasQualidCarro.toString() : ''}
              onChange={handleBolsasQualidCarroChange}
              inputMode="numeric"
              min="0"
              className="mt-1"
              disabled={isSyncing || !!capturingType}
            />
          </div>

          <div className="space-y-4 border-t pt-4">
            <Label className="font-medium">Afiches Qualid Colocados</Label>
            <div className="flex items-end space-x-2">
              <div className="flex-grow space-y-1">
                <Label htmlFor="tipo-afiche-qualid-select">Tipo de Afiche Qualid</Label>
                <Select
                  value={currentTipoAficheQualid}
                  onValueChange={setCurrentTipoAficheQualid}
                  disabled={availableAficheQualidTypes.length === 0 || isSyncing || !!capturingType}
                >
                  <SelectTrigger id="tipo-afiche-qualid-select">
                    <SelectValue placeholder={availableAficheQualidTypes.length > 0 ? "Seleccionar tipo" : "Todos agregados"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAficheQualidTypes.map(tipo => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-1/3 space-y-1">
                <Label htmlFor="cantidad-afiche-qualid-input">Cantidad</Label>
                <Input
                  id="cantidad-afiche-qualid-input"
                  type="number"
                  placeholder="Ingresar cantidad"
                  value={currentCantidadAficheQualid}
                  onChange={(e) => setCurrentCantidadAficheQualid(e.target.value)}
                  inputMode="numeric"
                  min="0"
                  disabled={isSyncing || !!capturingType}
                />
              </div>
              <Button 
                onClick={handleAddAficheQualid} 
                disabled={!currentTipoAficheQualid || currentCantidadAficheQualid === '' || availableAficheQualidTypes.length === 0 || isSyncing || !!capturingType}
                className="shrink-0"
              >
                Agregar
              </Button>
            </div>

            {afichesQualidAgregados.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label className="text-sm text-muted-foreground">Afiches Qualid agregados:</Label>
                <ul className="space-y-1">
                  {afichesQualidAgregados.map((afiche, index) => (
                    <li key={index} className="flex justify-between items-center p-2 border rounded-md bg-background">
                      <span className="text-sm">{afiche.tipo}: {afiche.cantidad}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveAficheQualid(index)} disabled={isSyncing || !!capturingType}>
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
             {availableAficheQualidTypes.length === 0 && AFICHES_QUALID_TYPES.length > 0 && afichesQualidAgregados.length === AFICHES_QUALID_TYPES.length && (
                <p className="text-sm text-muted-foreground text-center mt-2">Todos los tipos de afiches Qualid disponibles han sido agregados.</p>
            )}
          </div>

          {afichesQualidAgregados.length > 0 && (
            <div>
              <Label htmlFor="foto-afiches-qualid">Foto de los Afiches Qualid Colocados</Label>
              <Button
                onClick={() => takePhoto(setFotoAfichesQualidColocados, 'fotoAfichesQualid')}
                disabled={!hasCameraPermission || !!capturingType || isSyncing}
                className="w-full mt-1 text-white"
                style={{ backgroundImage: 'linear-gradient(to right, #fcce05, #ff0000)' }}
              >
                {capturingType === 'fotoAfichesQualid' ? 'Capturando...' : (hasCameraPermission ? (
                  <>
                    <Camera className="mr-2 h-4 w-4" /> Tomar Foto de Afiches Qualid
                  </>
                ) : (
                  'Cámara no permitida'
                ))}
              </Button>
              {fotoAfichesQualidColocados && (
                <img
                  src={fotoAfichesQualidColocados}
                  alt="Afiches Qualid Colocados"
                  className="mt-2 rounded-md object-cover w-full h-auto"
                  data-ai-hint="qualid posters display"
                />
              )}
            </div>
          )}

          <div className="space-y-4 border-t pt-4">
            <Label className="font-medium">Exhibidores de Cauchos Qualid</Label>
            <div className="flex items-end space-x-2">
              <div className="flex-grow space-y-1">
                <Label htmlFor="tipo-exhibidor-caucho-qualid-select">Tipo de Exhibidor de Caucho</Label>
                <Select
                  value={currentTipoExhibidorCauchoQualid}
                  onValueChange={setCurrentTipoExhibidorCauchoQualid}
                  disabled={availableExhibidorCauchoQualidTypes.length === 0 || isSyncing || !!capturingType}
                >
                  <SelectTrigger id="tipo-exhibidor-caucho-qualid-select">
                    <SelectValue placeholder={availableExhibidorCauchoQualidTypes.length > 0 ? "Seleccionar tipo" : "Todos agregados"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableExhibidorCauchoQualidTypes.map(tipo => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-1/3 space-y-1">
                <Label htmlFor="cantidad-exhibidor-caucho-qualid-input">Cantidad</Label>
                <Input
                  id="cantidad-exhibidor-caucho-qualid-input"
                  type="number"
                  placeholder="Ingresar cantidad"
                  value={currentCantidadExhibidorCauchoQualid}
                  onChange={(e) => setCurrentCantidadExhibidorCauchoQualid(e.target.value)}
                  inputMode="numeric"
                  min="0"
                  disabled={isSyncing || !!capturingType}
                />
              </div>
              <Button 
                onClick={handleAddExhibidorCauchoQualid} 
                disabled={!currentTipoExhibidorCauchoQualid || currentCantidadExhibidorCauchoQualid === '' || availableExhibidorCauchoQualidTypes.length === 0 || isSyncing || !!capturingType}
                className="shrink-0"
              >
                Agregar
              </Button>
            </div>

            {exhibidoresCauchoQualidAgregados.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label className="text-sm text-muted-foreground">Exhibidores de Cauchos Qualid agregados:</Label>
                <ul className="space-y-1">
                  {exhibidoresCauchoQualidAgregados.map((exhibidor, index) => (
                    <li key={index} className="flex justify-between items-center p-2 border rounded-md bg-background">
                      <span className="text-sm">{exhibidor.tipo}: {exhibidor.cantidad}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveExhibidorCauchoQualid(index)} disabled={isSyncing || !!capturingType}>
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {availableExhibidorCauchoQualidTypes.length === 0 && EXHIBIDORES_CAUCHO_QUALID_TYPES.length > 0 && exhibidoresCauchoQualidAgregados.length === EXHIBIDORES_CAUCHO_QUALID_TYPES.length && (
                <p className="text-sm text-muted-foreground text-center mt-2">Todos los tipos de exhibidores de caucho Qualid disponibles han sido agregados.</p>
            )}
          </div>

          {exhibidoresCauchoQualidAgregados.length > 0 && (
            <div>
              <Label htmlFor="foto-exhibidores-caucho-qualid">Foto de los Exhibidores de Cauchos Qualid</Label>
              <Button
                onClick={() => takePhoto(setFotoExhibidoresCauchoQualid, 'fotoExhibidoresCauchoQualid')}
                disabled={!hasCameraPermission || !!capturingType || isSyncing}
                className="w-full mt-1 text-white"
                style={{ backgroundImage: 'linear-gradient(to right, #fcce05, #ff0000)' }}
              >
                {capturingType === 'fotoExhibidoresCauchoQualid' ? 'Capturando...' : (hasCameraPermission ? (
                  <>
                    <Camera className="mr-2 h-4 w-4" /> Tomar Foto de Exhibidores de Cauchos
                  </>
                ) : (
                  'Cámara no permitida'
                ))}
              </Button>
              {fotoExhibidoresCauchoQualid && (
                <img
                  src={fotoExhibidoresCauchoQualid}
                  alt="Exhibidores de Cauchos Qualid Colocados"
                  className="mt-2 rounded-md object-cover w-full h-auto"
                  data-ai-hint="tire display qualid"
                />
              )}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleSubmit} 
            disabled={isSyncing || !!capturingType} 
            className="w-full"
          >
            {isSyncing ? 'Sincronizando...' : 'Guardar y Continuar a Observaciones'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
