
'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Camera, Trash } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const AFICHES_SHELL_TYPES: string[] = [
  'AFICHES CAMPAÑA FERRARI 2023',
  'AFICHES CAMPAÑA HX8',
  'AFICHES CAMPAÑA PRODUCTOS PREMIUM 2024',
  'AFICHES CAMPAÑA SHELL FAMILIA 2023',
  'AFICHES CAMPAÑA SHELL HX7 10W-40',
  'AFICHES CAMPAÑA TABLA DE APLICACION SHELL',
  'AFICHES CAMPAÑA TABLA DE APLICACIÓN SHELL 2024',
  'AFICHE SHELL HELIX',
  'AFICHE SHELL RIMULA',
  'AFICHE SHELL ADVANCE',
  'AFICHE SHELL 5W-30',
  'AFICHE SHELL LIBERA EL VERDADERO PODER',
];

interface AficheColocado {
  tipo: string;
  cantidad: number;
}

export default function ShellMaterialInternoPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [tieneExhibidores, setTieneExhibidores] = useState<string>('');
  const [cantidadExhibidores, setCantidadExhibidores] = useState<number | null>(null);
  const [fotoExhibidoresShell, setFotoExhibidoresShell] = useState<string | null>(null);
  
  const [afichesAgregados, setAfichesAgregados] = useState<AficheColocado[]>([]);
  const [currentTipoAfiche, setCurrentTipoAfiche] = useState<string>('');
  const [currentCantidadAfiche, setCurrentCantidadAfiche] = useState<string>('');
  const [fotoAfichesColocados, setFotoAfichesColocados] = useState<string | null>(null);

  const [colocoBanderines, setColocoBanderines] = useState<string>('');
  const [cantidadTirasBanderines, setCantidadTirasBanderines] = useState<number | null>(null);
  const [fotoBanderines, setFotoBanderines] = useState<string | null>(null);

  const [colocoAvisoAcrilico, setColocoAvisoAcrilico] = useState<string>('');
  const [fotoAvisoAcrilico, setFotoAvisoAcrilico] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [capturingType, setCapturingType] = useState<string | null>(null);

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

  const handleTieneExhibidoresChange = (value: string) => {
    setTieneExhibidores(value);
    if (value === 'No') {
      setCantidadExhibidores(null);
      setFotoExhibidoresShell(null);
    }
  };

  const handleCantidadExhibidoresChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCantidadExhibidores(value === '' ? null : parseInt(value));
  };

  const handleAddAfiche = () => {
    if (!currentTipoAfiche) {
      toast({
        variant: 'destructive',
        title: 'Tipo de Afiche Requerido',
        description: 'Por favor, seleccione un tipo de afiche.',
      });
      return;
    }
    if (currentCantidadAfiche === '' || currentCantidadAfiche === null) {
        toast({
            variant: 'destructive',
            title: 'Cantidad Requerida',
            description: 'Por favor, ingrese la cantidad de afiches.',
        });
        return;
    }
    const cantidadNum = parseInt(currentCantidadAfiche);
    if (isNaN(cantidadNum) || cantidadNum < 0) {
      toast({
        variant: 'destructive',
        title: 'Cantidad Inválida',
        description: 'Por favor, ingrese una cantidad válida (0 o más).',
      });
      return;
    }

    setAfichesAgregados([...afichesAgregados, { tipo: currentTipoAfiche, cantidad: cantidadNum }]);
    setCurrentTipoAfiche('');
    setCurrentCantidadAfiche('');
  };

  const handleRemoveAfiche = (indexToRemove: number) => {
    setAfichesAgregados(afichesAgregados.filter((_, index) => index !== indexToRemove));
  };

  const handleColocoBanderinesChange = (value: string) => {
    setColocoBanderines(value);
    if (value === 'No') {
      setCantidadTirasBanderines(null);
      setFotoBanderines(null);
    }
  };

  const handleCantidadTirasBanderinesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCantidadTirasBanderines(value === '' ? null : parseInt(value));
  };

  const handleColocoAvisoAcrilicoChange = (value: string) => {
    setColocoAvisoAcrilico(value);
    if (value === 'No') {
      setFotoAvisoAcrilico(null);
    }
  };

  const saveDataLocally = (data: any) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const materialInternoData = JSON.parse(localStorage.getItem('shellMaterialInternoData') || '[]');
      materialInternoData.push(data);
      localStorage.setItem('shellMaterialInternoData', JSON.stringify(materialInternoData));
    }
  };

  const handleSubmit = () => {
    if (tieneExhibidores === '') {
      toast({
        variant: 'destructive',
        title: 'Campo Requerido',
        description: 'Por favor, indique si el cliente tiene exhibidores Shell.',
      });
      return;
    }

    if (tieneExhibidores === 'Yes' && (cantidadExhibidores === null || cantidadExhibidores < 0)) {
      toast({
        variant: 'destructive',
        title: 'Campo Requerido',
        description: 'Por favor, ingrese una cantidad válida de exhibidores (0 o más).',
      });
      return;
    }
     if (tieneExhibidores === 'Yes' && !fotoExhibidoresShell) {
      toast({
        variant: 'destructive',
        title: 'Foto Requerida',
        description: 'Por favor, tome una foto del exhibidor Shell.',
      });
      return;
    }


    if (colocoBanderines === '') {
      toast({
        variant: 'destructive',
        title: 'Campo Requerido',
        description: 'Por favor, indique si colocó banderines.',
      });
      return;
    }

    if (colocoBanderines === 'Yes' && (cantidadTirasBanderines === null || cantidadTirasBanderines < 0)) {
      toast({
        variant: 'destructive',
        title: 'Campo Requerido',
        description: 'Por favor, ingrese una cantidad válida de tiras de banderines (0 o más).',
      });
      return;
    }

    if (colocoAvisoAcrilico === '') {
      toast({
        variant: 'destructive',
        title: 'Campo Requerido',
        description: 'Por favor, indique si colocó el aviso acrílico para exteriores.',
      });
      return;
    }
    
    const data = {
      tieneExhibidores,
      cantidadExhibidores: tieneExhibidores === 'Yes' ? (cantidadExhibidores ?? 0) : null,
      fotoExhibidoresShell,
      afichesColocados: afichesAgregados.map(af => ({ nombre: af.tipo, cantidad: af.cantidad })),
      fotoAfichesColocados,
      colocoBanderines,
      cantidadTirasBanderines: colocoBanderines === 'Yes' ? (cantidadTirasBanderines ?? 0) : null,
      fotoBanderines,
      colocoAvisoAcrilico,
      fotoAvisoAcrilico,
      timestamp: new Date().toISOString(),
    };

    saveDataLocally(data);
    toast({
      title: 'Datos de Material Interno Guardados Localmente',
      description: 'Los datos se sincronizarán cuando haya conexión.',
    });

    console.log('Shell Material Interno Data:', data);
    router.push('/qualid-merchandising');
  };

  useEffect(() => {
    const syncData = async () => {
      if (isSyncing || typeof window === 'undefined' || !window.localStorage) return;
      setIsSyncing(true);

      try {
        const localDataString = localStorage.getItem('shellMaterialInternoData');
        if (!localDataString) {
          setIsSyncing(false);
          return;
        }
        const localData = JSON.parse(localDataString);
        if (localData.length === 0) {
          setIsSyncing(false);
          return;
        }

        console.log('Enviando datos de Material Interno Shell al servidor:', localData);
        // Example: await fetch('/api/sync-shell-material-interno', { method: 'POST', body: JSON.stringify(localData) });

        localStorage.removeItem('shellMaterialInternoData');
        toast({
          title: 'Datos de Material Interno Shell Sincronizados',
          description: 'Todos los datos de material interno se han enviado al servidor.',
        });
      } catch (error) {
        console.error('Error al sincronizar los datos de material interno Shell:', error);
        toast({
          variant: 'destructive',
          title: 'Error de Sincronización (Material Interno Shell)',
          description: 'Hubo un problema al sincronizar los datos. Inténtalo de nuevo más tarde.',
        });
      } finally {
        setIsSyncing(false);
      }
    };

    if (typeof window !== 'undefined' && navigator.onLine) {
      syncData();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', syncData);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', syncData);
      }
    };
  }, [isSyncing, toast]);

  const availableAficheTypes = AFICHES_SHELL_TYPES.filter(
    tipo => !afichesAgregados.find(a => a.tipo === tipo)
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
                backgroundImage: 'linear-gradient(to right, #fbce04, #e30a18)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Shell Merchandising
            </span>
          </CardTitle>
          <CardDescription className="text-center">Registre los materiales internos de Shell colocados.</CardDescription>
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
            <Label>¿El cliente tiene exhibidores Shell?</Label>
            <Select onValueChange={handleTieneExhibidoresChange} value={tieneExhibidores} disabled={!!capturingType}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Sí</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tieneExhibidores === 'Yes' && (
            <>
              <div>
                <Label htmlFor="cantidad-exhibidores">¿Cuántos exhibidores Shell tiene?</Label>
                <Input
                  type="number"
                  id="cantidad-exhibidores"
                  placeholder="Ingresar cantidad (0, 1, 2, 3, ...)"
                  value={cantidadExhibidores !== null ? cantidadExhibidores.toString() : ''}
                  onChange={handleCantidadExhibidoresChange}
                  inputMode="numeric"
                  min="0"
                  className="mt-1"
                  disabled={!!capturingType}
                />
              </div>
              <div>
                <Label htmlFor="foto-exhibidores-shell">Foto del Exhibidor Shell</Label>
                 <Button
                    onClick={() => takePhoto(setFotoExhibidoresShell, 'fotoExhibidoresShell')}
                    disabled={!hasCameraPermission || !!capturingType}
                    className="w-full mt-1 text-white"
                    style={{ backgroundImage: 'linear-gradient(to right, #fbce04, #e30a18)' }}
                  >
                    {capturingType === 'fotoExhibidoresShell' ? 'Capturando...' : (hasCameraPermission ? (
                      <>
                        <Camera className="mr-2 h-4 w-4" /> Tomar Foto del Exhibidor Shell
                      </>
                    ) : (
                      'Cámara no permitida'
                    ))}
                  </Button>
                {fotoExhibidoresShell && (
                  <img
                    src={fotoExhibidoresShell}
                    alt="Exhibidor Shell"
                    className="mt-2 rounded-md object-cover w-full h-auto"
                    data-ai-hint="shell display"
                  />
                )}
              </div>
            </>
          )}

          <div className="space-y-4 border-t pt-4">
            <Label className="font-medium">Afiches Shell Colocados</Label>
            <div className="flex items-end space-x-2">
              <div className="flex-grow space-y-1">
                <Label htmlFor="tipo-afiche-select">Tipo de Afiche</Label>
                <Select
                  value={currentTipoAfiche}
                  onValueChange={setCurrentTipoAfiche}
                  disabled={availableAficheTypes.length === 0 || !!capturingType}
                >
                  <SelectTrigger id="tipo-afiche-select">
                    <SelectValue placeholder={availableAficheTypes.length > 0 ? "Seleccionar tipo" : "Todos agregados"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAficheTypes.map(tipo => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-1/3 space-y-1">
                <Label htmlFor="cantidad-afiche-input">Cantidad</Label>
                <Input
                  id="cantidad-afiche-input"
                  type="number"
                  placeholder="Ingresar cantidad"
                  value={currentCantidadAfiche}
                  onChange={(e) => setCurrentCantidadAfiche(e.target.value)}
                  inputMode="numeric"
                  min="0"
                  disabled={!!capturingType}
                />
              </div>
              <Button 
                onClick={handleAddAfiche} 
                disabled={!currentTipoAfiche || currentCantidadAfiche === '' || availableAficheTypes.length === 0 || !!capturingType}
                className="shrink-0"
              >
                Agregar
              </Button>
            </div>

            {afichesAgregados.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label className="text-sm text-muted-foreground">Afiches agregados:</Label>
                <ul className="space-y-1">
                  {afichesAgregados.map((afiche, index) => (
                    <li key={index} className="flex justify-between items-center p-2 border rounded-md bg-background">
                      <span className="text-sm">{afiche.tipo}: {afiche.cantidad}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveAfiche(index)} disabled={!!capturingType}>
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
             {availableAficheTypes.length === 0 && AFICHES_SHELL_TYPES.length > 0 && afichesAgregados.length === AFICHES_SHELL_TYPES.length && (
                <p className="text-sm text-muted-foreground text-center mt-2">Todos los tipos de afiches disponibles han sido agregados.</p>
            )}
          </div>

          {afichesAgregados.length > 0 && (
            <div>
              <Label htmlFor="foto-afiches-colocados">Foto de los Afiches Colocados</Label>
              <Button
                onClick={() => takePhoto(setFotoAfichesColocados, 'fotoAfiches')}
                disabled={!hasCameraPermission || !!capturingType}
                className="w-full mt-1 text-white"
                style={{ backgroundImage: 'linear-gradient(to right, #fbce04, #e30a18)' }}
              >
                {capturingType === 'fotoAfiches' ? 'Capturando...' : (hasCameraPermission ? (
                  <>
                    <Camera className="mr-2 h-4 w-4" /> Tomar Foto de Afiches
                  </>
                ) : (
                  'Cámara no permitida'
                ))}
              </Button>
              {fotoAfichesColocados && (
                <img
                  src={fotoAfichesColocados}
                  alt="Afiches Colocados"
                  className="mt-2 rounded-md object-cover w-full h-auto"
                  data-ai-hint="posters display"
                />
              )}
            </div>
          )}

          {/* Banderines Section */}
          <div className="space-y-2 border-t pt-4">
            <Label>¿Colocó banderines?</Label>
            <Select onValueChange={handleColocoBanderinesChange} value={colocoBanderines} disabled={!!capturingType}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Sí</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {colocoBanderines === 'Yes' && (
            <>
              <div>
                <Label htmlFor="cantidad-tiras-banderines">Cantidad de tiras de banderines</Label>
                <Input
                  type="number"
                  id="cantidad-tiras-banderines"
                  placeholder="Ingresar cantidad"
                  value={cantidadTirasBanderines !== null ? cantidadTirasBanderines.toString() : ''}
                  onChange={handleCantidadTirasBanderinesChange}
                  inputMode="numeric"
                  min="0"
                  className="mt-1"
                  disabled={!!capturingType}
                />
              </div>
              <div>
                <Label htmlFor="foto-banderines">Foto Soporte Banderines</Label>
                <Button
                  onClick={() => takePhoto(setFotoBanderines, 'fotoBanderines')}
                  disabled={!hasCameraPermission || !!capturingType}
                  className="w-full mt-1 text-white"
                  style={{ backgroundImage: 'linear-gradient(to right, #fbce04, #e30a18)' }}
                >
                  {capturingType === 'fotoBanderines' ? 'Capturando...' : (hasCameraPermission ? (
                    <>
                      <Camera className="mr-2 h-4 w-4" /> Tomar Foto de Banderines
                    </>
                  ) : (
                    'Cámara no permitida'
                  ))}
                </Button>
                {fotoBanderines && (
                  <img
                    src={fotoBanderines}
                    alt="Banderines Colocados"
                    className="mt-2 rounded-md object-cover w-full h-auto"
                    data-ai-hint="banners hanging"
                  />
                )}
              </div>
            </>
          )}

          {/* Aviso Acrilico Section */}
          <div className="space-y-2 border-t pt-4">
            <Label>¿Colocaste aviso acrilico para exteriores Shell?</Label>
            <Select onValueChange={handleColocoAvisoAcrilicoChange} value={colocoAvisoAcrilico} disabled={!!capturingType}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Sí</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {colocoAvisoAcrilico === 'Yes' && (
            <div>
              <Label htmlFor="foto-aviso-acrilico">Foto del Aviso Acrílico</Label>
              <Button
                onClick={() => takePhoto(setFotoAvisoAcrilico, 'fotoAvisoAcrilico')}
                disabled={!hasCameraPermission || !!capturingType}
                className="w-full mt-1 text-white"
                style={{ backgroundImage: 'linear-gradient(to right, #fbce04, #e30a18)' }}
              >
                {capturingType === 'fotoAvisoAcrilico' ? 'Capturando...' : (hasCameraPermission ? (
                  <>
                    <Camera className="mr-2 h-4 w-4" /> Tomar Foto del Aviso Acrílico
                  </>
                ) : (
                  'Cámara no permitida'
                ))}
              </Button>
              {fotoAvisoAcrilico && (
                <img
                  src={fotoAvisoAcrilico}
                  alt="Aviso Acrílico Exterior Shell"
                  className="mt-2 rounded-md object-cover w-full h-auto"
                  data-ai-hint="outdoor acrylic sign"
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
            {isSyncing ? 'Sincronizando...' : 'Guardar y Continuar a Qualid'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
