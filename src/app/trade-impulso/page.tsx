
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
import { Textarea } from '@/components/ui/textarea';

interface RecursoUsado {
  tipo: string;
  cantidad: number;
}

interface EntregableUsado {
  tipo: string;
  cantidad: number;
}

const MARCAS_TRADE: string[] = ['Shell', 'Qualid'];

const RECURSOS_IMPULSO_SHELL_TYPES: string[] = [
  'UNIFORMES DE PROMOTORAS SHELL',
  'BANDEROLAS SHELL',
  'IGLOO SHELL',
  'TOLDO SHELL',
  'EXHIBIDORES SHELL',
];

const RECURSOS_IMPULSO_QUALID_TYPES: string[] = [
  'UNIFORMES DE PROMOTORAS QUALID',
  'BANDEROLAS QUALID',
  'IGLOO QUALID',
  'TOLDO QUALID',
];

const ENTREGABLES_IMPULSO_SHELL_TYPES: string[] = [
  'Ambientadores Shell para vehiculos',
  'Bolsas Shell para carros',
  'Llaveros de Tela Shell',
  'Gorras Shell',
  'Bolsas Tipo Boutique Negro',
  'Bolsas Tipo Boutique Blanco',
  'Tapasol Shell/Qualid',
  'Globos Shell',
  'Vasos Shell',
  'Agendas',
];

const ENTREGABLES_IMPULSO_QUALID_TYPES: string[] = [
  'Bolsas Qualid para carros',
  'Esponjas Qualid',
  'Globos Qualid',
  'Gorras Qualid',
  'Llavero caucho Qualid',
  'Llavero de tela Qualid',
  'Paños Qualid',
  'Vasos Qualid',
];


export default function TradeImpulsoPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [recursosAgregados, setRecursosAgregados] = useState<RecursoUsado[]>([]);
  const [currentTipoRecurso, setCurrentTipoRecurso] = useState<string>('');
  const [currentCantidadRecurso, setCurrentCantidadRecurso] = useState<string>('');
  
  const [entregablesShellAgregados, setEntregablesShellAgregados] = useState<EntregableUsado[]>([]);
  const [currentTipoEntregableShell, setCurrentTipoEntregableShell] = useState<string>('');
  const [currentCantidadEntregableShell, setCurrentCantidadEntregableShell] = useState<string>('');

  const [entregablesQualidAgregados, setEntregablesQualidAgregados] = useState<EntregableUsado[]>([]);
  const [currentTipoEntregableQualid, setCurrentTipoEntregableQualid] = useState<string>('');
  const [currentCantidadEntregableQualid, setCurrentCantidadEntregableQualid] = useState<string>('');

  const [fotoImpulsoShell, setFotoImpulsoShell] = useState<string | null>(null);
  const [fotoPromotorasShell, setFotoPromotorasShell] = useState<string | null>(null);
  const [fotoImpulsoQualid, setFotoImpulsoQualid] = useState<string | null>(null);
  const [fotoPromotorasQualid, setFotoPromotorasQualid] = useState<string | null>(null);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
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

  const handleAddRecurso = () => {
    if (!currentTipoRecurso) {
      toast({
        variant: 'destructive',
        title: 'Tipo de Recurso Requerido',
        description: 'Por favor, seleccione un tipo de recurso.',
      });
      return;
    }
    if (currentCantidadRecurso === '' || currentCantidadRecurso === null) {
        toast({
            variant: 'destructive',
            title: 'Cantidad Requerida',
            description: 'Por favor, ingrese la cantidad del recurso.',
        });
        return;
    }
    const cantidadNum = parseInt(currentCantidadRecurso);
    if (isNaN(cantidadNum) || cantidadNum <= 0) { // Quantity must be greater than 0
      toast({
        variant: 'destructive',
        title: 'Cantidad Inválida',
        description: 'Por favor, ingrese una cantidad válida (mayor que 0).',
      });
      return;
    }

    setRecursosAgregados([...recursosAgregados, { tipo: currentTipoRecurso, cantidad: cantidadNum }]);
    setCurrentTipoRecurso('');
    setCurrentCantidadRecurso('');
  };

  const handleRemoveRecurso = (indexToRemove: number) => {
    setRecursosAgregados(recursosAgregados.filter((_, index) => index !== indexToRemove));
  };

  const handleAddEntregableShell = () => {
    if (!currentTipoEntregableShell) {
      toast({
        variant: 'destructive',
        title: 'Tipo de Entregable Requerido',
        description: 'Por favor, seleccione un tipo de entregable.',
      });
      return;
    }
    if (currentCantidadEntregableShell === '' || currentCantidadEntregableShell === null) {
        toast({
            variant: 'destructive',
            title: 'Cantidad Requerida',
            description: 'Por favor, ingrese la cantidad del entregable.',
        });
        return;
    }
    const cantidadNum = parseInt(currentCantidadEntregableShell);
    if (isNaN(cantidadNum) || cantidadNum <= 0) { // Quantity must be greater than 0
      toast({
        variant: 'destructive',
        title: 'Cantidad Inválida',
        description: 'Por favor, ingrese una cantidad válida (mayor que 0).',
      });
      return;
    }

    setEntregablesShellAgregados([...entregablesShellAgregados, { tipo: currentTipoEntregableShell, cantidad: cantidadNum }]);
    setCurrentTipoEntregableShell('');
    setCurrentCantidadEntregableShell('');
  };

  const handleRemoveEntregableShell = (indexToRemove: number) => {
    setEntregablesShellAgregados(entregablesShellAgregados.filter((_, index) => index !== indexToRemove));
  };

  const handleAddEntregableQualid = () => {
    if (!currentTipoEntregableQualid) {
      toast({
        variant: 'destructive',
        title: 'Tipo de Entregable Requerido',
        description: 'Por favor, seleccione un tipo de entregable Qualid.',
      });
      return;
    }
    if (currentCantidadEntregableQualid === '' || currentCantidadEntregableQualid === null) {
        toast({
            variant: 'destructive',
            title: 'Cantidad Requerida',
            description: 'Por favor, ingrese la cantidad del entregable Qualid.',
        });
        return;
    }
    const cantidadNum = parseInt(currentCantidadEntregableQualid);
    if (isNaN(cantidadNum) || cantidadNum <= 0) { 
      toast({
        variant: 'destructive',
        title: 'Cantidad Inválida',
        description: 'Por favor, ingrese una cantidad válida (mayor que 0).',
      });
      return;
    }

    setEntregablesQualidAgregados([...entregablesQualidAgregados, { tipo: currentTipoEntregableQualid, cantidad: cantidadNum }]);
    setCurrentTipoEntregableQualid('');
    setCurrentCantidadEntregableQualid('');
  };

  const handleRemoveEntregableQualid = (indexToRemove: number) => {
    setEntregablesQualidAgregados(entregablesQualidAgregados.filter((_, index) => index !== indexToRemove));
  };


  const saveDataLocally = (data: any) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const tradeImpulsoData = JSON.parse(localStorage.getItem('tradeImpulsoData') || '[]');
      tradeImpulsoData.push(data);
      localStorage.setItem('tradeImpulsoData', JSON.stringify(tradeImpulsoData));
    }
  };

  const handleSubmit = () => {
    if (!selectedBrand) {
      toast({
        variant: 'destructive',
        title: 'Marca Requerida',
        description: 'Por favor, seleccione la marca trabajada.',
      });
      return;
    }
    
    const data = {
      marca: selectedBrand,
      recursosUsados: recursosAgregados.map(r => ({ nombre: r.tipo, cantidad: r.cantidad })),
      entregablesShell: selectedBrand === 'Shell' ? entregablesShellAgregados.map(e => ({ nombre: e.tipo, cantidad: e.cantidad })) : [],
      entregablesQualid: selectedBrand === 'Qualid' ? entregablesQualidAgregados.map(e => ({ nombre: e.tipo, cantidad: e.cantidad })) : [],
      fotoImpulso: selectedBrand === 'Shell' ? fotoImpulsoShell : (selectedBrand === 'Qualid' ? fotoImpulsoQualid : null),
      fotoPromotoras: selectedBrand === 'Shell' ? fotoPromotorasShell : (selectedBrand === 'Qualid' ? fotoPromotorasQualid : null),
      timestamp: new Date().toISOString(),
    };

    saveDataLocally(data);
    toast({
      title: 'Datos de Impulso Guardados Localmente',
      description: 'Los datos se sincronizarán cuando haya conexión.',
    });

    console.log('Trade Impulso Data:', data);
    router.push('/visit-capture'); // Navigate back to Visit Capture page
  };

  useEffect(() => {
    const syncData = async () => {
      if (isSyncing || typeof window !== 'undefined' || !window.localStorage) return;
      setIsSyncing(true);

      try {
        const localDataString = localStorage.getItem('tradeImpulsoData');
        if (!localDataString) {
          setIsSyncing(false);
          return;
        }
        const localData = JSON.parse(localDataString);
        if (localData.length === 0) {
          setIsSyncing(false);
          return;
        }

        console.log('Enviando datos de Impulso Trade al servidor:', localData);
        // Example: await fetch('/api/sync-trade-impulso', { method: 'POST', body: JSON.stringify(localData) });
        // Replace with actual API call

        localStorage.removeItem('tradeImpulsoData');
        toast({
          title: 'Datos de Impulso Trade Sincronizados',
          description: 'Todos los datos de impulso trade se han enviado al servidor.',
        });
      } catch (error) {
        console.error('Error al sincronizar los datos de Impulso Trade:', error);
        toast({
          variant: 'destructive',
          title: 'Error de Sincronización (Impulso Trade)',
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

  const getCurrentResourceList = () => {
    if (selectedBrand === 'Shell') {
      return RECURSOS_IMPULSO_SHELL_TYPES;
    }
    if (selectedBrand === 'Qualid') {
      return RECURSOS_IMPULSO_QUALID_TYPES;
    }
    return [];
  };

  const availableRecursoTypes = getCurrentResourceList().filter(
    tipo => !recursosAgregados.find(r => r.tipo === tipo)
  );

  const availableEntregableShellTypes = ENTREGABLES_IMPULSO_SHELL_TYPES.filter(
    tipo => !entregablesShellAgregados.find(e => e.tipo === tipo)
  );

  const availableEntregableQualidTypes = ENTREGABLES_IMPULSO_QUALID_TYPES.filter(
    tipo => !entregablesQualidAgregados.find(e => e.tipo === tipo)
  );
  
  const handleBrandChange = (value: string) => {
    setSelectedBrand(value);
    setRecursosAgregados([]);
    setCurrentTipoRecurso('');
    setCurrentCantidadRecurso('');
    setEntregablesShellAgregados([]);
    setCurrentTipoEntregableShell('');
    setCurrentCantidadEntregableShell('');
    setEntregablesQualidAgregados([]);
    setCurrentTipoEntregableQualid('');
    setCurrentCantidadEntregableQualid('');
    setFotoImpulsoShell(null);
    setFotoPromotorasShell(null);
    setFotoImpulsoQualid(null);
    setFotoPromotorasQualid(null);
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
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
             <span
              style={{
                backgroundImage: 'linear-gradient(to right, #fbce04, #e30a18)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Registro de Impulso Trade
            </span>
          </CardTitle>
          <CardDescription>Ingrese los detalles del impulso realizado.</CardDescription>
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
            <Label htmlFor="marca-select">Marca Trabajada</Label>
            <Select
              value={selectedBrand}
              onValueChange={handleBrandChange}
              disabled={isSyncing || !!capturingType}
            >
              <SelectTrigger id="marca-select" className="w-full mt-1">
                <SelectValue placeholder="Seleccionar marca" />
              </SelectTrigger>
              <SelectContent>
                {MARCAS_TRADE.map(marca => (
                  <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedBrand && (
            <div className="space-y-4 border-t pt-4">
              <Label className="font-medium">Recursos Utilizados ({selectedBrand})</Label>
              <div className="flex items-end space-x-2">
                <div className="flex-grow space-y-1">
                  <Label htmlFor="tipo-recurso-select">Tipo de Recurso</Label>
                  <Select
                    value={currentTipoRecurso}
                    onValueChange={setCurrentTipoRecurso}
                    disabled={availableRecursoTypes.length === 0 || isSyncing || !!capturingType}
                  >
                    <SelectTrigger id="tipo-recurso-select">
                      <SelectValue placeholder={availableRecursoTypes.length > 0 ? "Seleccionar recurso" : "Todos agregados"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRecursoTypes.map(tipo => (
                        <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
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
                    disabled={isSyncing || !!capturingType}
                  />
                </div>
                <Button 
                  onClick={handleAddRecurso} 
                  disabled={!currentTipoRecurso || currentCantidadRecurso === '' || parseInt(currentCantidadRecurso) <= 0 || availableRecursoTypes.length === 0 || isSyncing || !!capturingType}
                  className="shrink-0"
                >
                  Agregar
                </Button>
              </div>

              {recursosAgregados.length > 0 && (
                <div className="mt-4 space-y-2">
                  <Label className="text-sm text-muted-foreground">Recursos agregados:</Label>
                  <ul className="space-y-1">
                    {recursosAgregados.map((recurso, index) => (
                      <li key={index} className="flex justify-between items-center p-2 border rounded-md bg-background">
                        <span className="text-sm">{recurso.tipo}: {recurso.cantidad}</span>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveRecurso(index)} disabled={isSyncing || !!capturingType}>
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {availableRecursoTypes.length === 0 && getCurrentResourceList().length > 0 && recursosAgregados.length === getCurrentResourceList().length && (
                  <p className="text-sm text-muted-foreground text-center mt-2">Todos los tipos de recursos {selectedBrand} disponibles han sido agregados.</p>
              )}
            </div>
          )}

          {selectedBrand === 'Shell' && (
            <>
              <div className="space-y-4 border-t pt-4">
                <Label className="font-medium">Entregables Shell</Label>
                <div className="flex items-end space-x-2">
                  <div className="flex-grow space-y-1">
                    <Label htmlFor="tipo-entregable-shell-select">Tipo de Entregable</Label>
                    <Select
                      value={currentTipoEntregableShell}
                      onValueChange={setCurrentTipoEntregableShell}
                      disabled={availableEntregableShellTypes.length === 0 || isSyncing || !!capturingType}
                    >
                      <SelectTrigger id="tipo-entregable-shell-select">
                        <SelectValue placeholder={availableEntregableShellTypes.length > 0 ? "Seleccionar entregable" : "Todos agregados"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEntregableShellTypes.map(tipo => (
                          <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-1/3 space-y-1">
                    <Label htmlFor="cantidad-entregable-shell-input">Cantidad</Label>
                    <Input
                      id="cantidad-entregable-shell-input"
                      type="number"
                      placeholder="Ingresar cantidad"
                      value={currentCantidadEntregableShell}
                      onChange={(e) => setCurrentCantidadEntregableShell(e.target.value)}
                      inputMode="numeric"
                      min="1"
                      disabled={isSyncing || !!capturingType}
                    />
                  </div>
                  <Button 
                    onClick={handleAddEntregableShell} 
                    disabled={!currentTipoEntregableShell || currentCantidadEntregableShell === '' || parseInt(currentCantidadEntregableShell) <= 0 || availableEntregableShellTypes.length === 0 || isSyncing || !!capturingType}
                    className="shrink-0"
                  >
                    Agregar
                  </Button>
                </div>

                {entregablesShellAgregados.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-sm text-muted-foreground">Entregables Shell agregados:</Label>
                    <ul className="space-y-1">
                      {entregablesShellAgregados.map((entregable, index) => (
                        <li key={index} className="flex justify-between items-center p-2 border rounded-md bg-background">
                          <span className="text-sm">{entregable.tipo}: {entregable.cantidad}</span>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveEntregableShell(index)} disabled={isSyncing || !!capturingType}>
                            <Trash className="h-4 w-4 text-destructive" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {availableEntregableShellTypes.length === 0 && ENTREGABLES_IMPULSO_SHELL_TYPES.length > 0 && entregablesShellAgregados.length === ENTREGABLES_IMPULSO_SHELL_TYPES.length && (
                    <p className="text-sm text-muted-foreground text-center mt-2">Todos los tipos de entregables Shell disponibles han sido agregados.</p>
                )}
              </div>

              <div className="space-y-4 border-t pt-4">
                <Label className="font-medium" htmlFor="foto-impulso-shell-button">Fotos del impulso Shell</Label>
                <p className="text-sm text-muted-foreground">
                  Sube fotos generales del evento Shell, incluyendo la instalación del material de apoyo, vista del stand, y las promotoras en el lugar. Asegúrate de capturar la esencia y el ambiente general del impulso o evento Shell.
                </p>
                <Button
                  id="foto-impulso-shell-button"
                  variant="outline"
                  onClick={() => takePhoto(setFotoImpulsoShell, 'fotoImpulsoShell')}
                  disabled={!hasCameraPermission || !!capturingType || isSyncing}
                  className="w-full mt-1"
                >
                  {capturingType === 'fotoImpulsoShell' ? 'Capturando...' : (hasCameraPermission ? (
                    <>
                      <Camera className="mr-2 h-4 w-4" /> Tomar Foto del Impulso Shell
                    </>
                  ) : (
                    'Cámara no permitida'
                  ))}
                </Button>
                {fotoImpulsoShell && (
                  <img
                    src={fotoImpulsoShell}
                    alt="Fotos del Impulso Shell"
                    className="mt-2 rounded-md object-cover w-full h-auto"
                    data-ai-hint="shell event promotion"
                  />
                )}
              </div>

              <div className="space-y-4 border-t pt-4">
                <Label className="font-medium" htmlFor="foto-promotoras-shell-button">Fotos de las promotoras Shell</Label>
                <p className="text-sm text-muted-foreground">
                  Sube fotos de las promotoras Shell interactuando con los clientes, mostrando momentos de compras, participación en juegos o dinámicas. Buscamos capturar la conexión y el impacto directo del evento Shell en el público.
                </p>
                <Button
                  id="foto-promotoras-shell-button"
                  variant="outline"
                  onClick={() => takePhoto(setFotoPromotorasShell, 'fotoPromotorasShell')}
                  disabled={!hasCameraPermission || !!capturingType || isSyncing}
                  className="w-full mt-1"
                >
                  {capturingType === 'fotoPromotorasShell' ? 'Capturando...' : (hasCameraPermission ? (
                    <>
                      <Camera className="mr-2 h-4 w-4" /> Tomar Foto de Promotoras Shell
                    </>
                  ) : (
                    'Cámara no permitida'
                  ))}
                </Button>
                {fotoPromotorasShell && (
                  <img
                    src={fotoPromotorasShell}
                    alt="Fotos de las Promotoras Shell"
                    className="mt-2 rounded-md object-cover w-full h-auto"
                    data-ai-hint="shell promoters customers"
                  />
                )}
              </div>
            </>
          )}

          {selectedBrand === 'Qualid' && (
            <>
               <div className="space-y-4 border-t pt-4">
                <Label className="font-medium">Entregables Qualid</Label>
                <div className="flex items-end space-x-2">
                  <div className="flex-grow space-y-1">
                    <Label htmlFor="tipo-entregable-qualid-select">Tipo de Entregable</Label>
                    <Select
                      value={currentTipoEntregableQualid}
                      onValueChange={setCurrentTipoEntregableQualid}
                      disabled={availableEntregableQualidTypes.length === 0 || isSyncing || !!capturingType}
                    >
                      <SelectTrigger id="tipo-entregable-qualid-select">
                        <SelectValue placeholder={availableEntregableQualidTypes.length > 0 ? "Seleccionar entregable" : "Todos agregados"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEntregableQualidTypes.map(tipo => (
                          <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-1/3 space-y-1">
                    <Label htmlFor="cantidad-entregable-qualid-input">Cantidad</Label>
                    <Input
                      id="cantidad-entregable-qualid-input"
                      type="number"
                      placeholder="Ingresar cantidad"
                      value={currentCantidadEntregableQualid}
                      onChange={(e) => setCurrentCantidadEntregableQualid(e.target.value)}
                      inputMode="numeric"
                      min="1"
                      disabled={isSyncing || !!capturingType}
                    />
                  </div>
                  <Button 
                    onClick={handleAddEntregableQualid} 
                    disabled={!currentTipoEntregableQualid || currentCantidadEntregableQualid === '' || parseInt(currentCantidadEntregableQualid) <= 0 || availableEntregableQualidTypes.length === 0 || isSyncing || !!capturingType}
                    className="shrink-0"
                  >
                    Agregar
                  </Button>
                </div>

                {entregablesQualidAgregados.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-sm text-muted-foreground">Entregables Qualid agregados:</Label>
                    <ul className="space-y-1">
                      {entregablesQualidAgregados.map((entregable, index) => (
                        <li key={index} className="flex justify-between items-center p-2 border rounded-md bg-background">
                          <span className="text-sm">{entregable.tipo}: {entregable.cantidad}</span>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveEntregableQualid(index)} disabled={isSyncing || !!capturingType}>
                            <Trash className="h-4 w-4 text-destructive" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {availableEntregableQualidTypes.length === 0 && ENTREGABLES_IMPULSO_QUALID_TYPES.length > 0 && entregablesQualidAgregados.length === ENTREGABLES_IMPULSO_QUALID_TYPES.length && (
                    <p className="text-sm text-muted-foreground text-center mt-2">Todos los tipos de entregables Qualid disponibles han sido agregados.</p>
                )}
              </div>

              <div className="space-y-4 border-t pt-4">
                <Label className="font-medium" htmlFor="foto-impulso-qualid-button">Fotos del impulso Qualid</Label>
                <p className="text-sm text-muted-foreground">
                  Sube fotos generales del evento Qualid, incluyendo la instalación del material de apoyo, vista del stand, y las promotoras en el lugar. Asegúrate de capturar la esencia y el ambiente general del impulso o evento Qualid.
                </p>
                <Button
                  id="foto-impulso-qualid-button"
                  variant="outline"
                  onClick={() => takePhoto(setFotoImpulsoQualid, 'fotoImpulsoQualid')}
                  disabled={!hasCameraPermission || !!capturingType || isSyncing}
                  className="w-full mt-1"
                >
                  {capturingType === 'fotoImpulsoQualid' ? 'Capturando...' : (hasCameraPermission ? (
                    <>
                      <Camera className="mr-2 h-4 w-4" /> Tomar Foto del Impulso Qualid
                    </>
                  ) : (
                    'Cámara no permitida'
                  ))}
                </Button>
                {fotoImpulsoQualid && (
                  <img
                    src={fotoImpulsoQualid}
                    alt="Fotos del Impulso Qualid"
                    className="mt-2 rounded-md object-cover w-full h-auto"
                    data-ai-hint="qualid event promotion"
                  />
                )}
              </div>

              <div className="space-y-4 border-t pt-4">
                <Label className="font-medium" htmlFor="foto-promotoras-qualid-button">Fotos de las promotoras Qualid</Label>
                <p className="text-sm text-muted-foreground">
                  Sube fotos de las promotoras Qualid interactuando con los clientes, mostrando momentos de compras, participación en juegos o dinámicas. Buscamos capturar la conexión y el impacto directo del evento Qualid en el público.
                </p>
                <Button
                  id="foto-promotoras-qualid-button"
                  variant="outline"
                  onClick={() => takePhoto(setFotoPromotorasQualid, 'fotoPromotorasQualid')}
                  disabled={!hasCameraPermission || !!capturingType || isSyncing}
                  className="w-full mt-1"
                >
                  {capturingType === 'fotoPromotorasQualid' ? 'Capturando...' : (hasCameraPermission ? (
                    <>
                      <Camera className="mr-2 h-4 w-4" /> Tomar Foto de Promotoras Qualid
                    </>
                  ) : (
                    'Cámara no permitida'
                  ))}
                </Button>
                {fotoPromotorasQualid && (
                  <img
                    src={fotoPromotorasQualid}
                    alt="Fotos de las Promotoras Qualid"
                    className="mt-2 rounded-md object-cover w-full h-auto"
                    data-ai-hint="qualid promoters customers"
                  />
                )}
              </div>
            </>
          )}


        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleSubmit} 
            disabled={isSyncing || !selectedBrand || !!capturingType} 
            className="w-full"
            style={{ backgroundImage: 'linear-gradient(to right, #fbce04, #e30a18)' }}
          >
            {isSyncing ? 'Sincronizando...' : 'Guardar Datos de Impulso y Finalizar'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
