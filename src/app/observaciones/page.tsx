
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function ObservacionesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [observacionShellFaltante, setObservacionShellFaltante] = useState<string>('');
  const [observacionQualidFaltante, setObservacionQualidFaltante] = useState<string>('');
  const [observacionesAdicionales, setObservacionesAdicionales] = useState<string>('');
  const [observacionesCompetencia, setObservacionesCompetencia] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  const saveDataLocally = (data: any) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const observacionesData = JSON.parse(localStorage.getItem('observacionesData') || '[]');
      observacionesData.push(data);
      localStorage.setItem('observacionesData', JSON.stringify(observacionesData));
    }
  };

  const handleSubmit = async () => {
    // Basic validation can be added here if needed for any of the observation fields
    // For example, ensuring at least one observation is made, or length checks.

    const data = {
      observacionShellFaltante,
      observacionQualidFaltante,
      observacionesAdicionales,
      observacionesCompetencia,
      timestamp: new Date().toISOString(),
    };

    saveDataLocally(data);
    toast({
      title: 'Observaciones Guardadas Localmente',
      description: 'Los datos se sincronizarán cuando haya conexión.',
    });
    console.log('Observaciones Data:', data);

    router.push('/registro-exitoso'); // Navigate to the new success page
  };
  
  useEffect(() => {
    const syncData = async () => {
      if (isSyncing || typeof window === 'undefined' || !window.localStorage) return;
      setIsSyncing(true);

      try {
        const localDataString = localStorage.getItem('observacionesData');
        if (!localDataString) {
          setIsSyncing(false);
          return;
        }
        const localData = JSON.parse(localDataString);

        if (localData.length === 0) {
          setIsSyncing(false);
          return;
        }

        console.log('Enviando datos de Observaciones al servidor:', localData);
        // Example: await fetch('/api/sync-observaciones', { method: 'POST', body: JSON.stringify(localData) });
        // Replace with actual API call to sync observation data

        localStorage.removeItem('observacionesData');
        toast({
          title: 'Datos de Observaciones Sincronizados',
          description: 'Todas las observaciones se han enviado al servidor.',
        });
      } catch (error) {
        console.error('Error al sincronizar los datos de Observaciones:', error);
        toast({
          variant: 'destructive',
          title: 'Error de Sincronización (Observaciones)',
          description: 'Hubo un problema al sincronizar las observaciones. Inténtalo de nuevo más tarde.',
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
            Observaciones Generales
            </span>
          </CardTitle>
          <CardDescription>Registre sus observaciones y comentarios.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="obs-shell-faltante" className="text-sm">
              Coloca aquí tus observaciones de producto faltante y cualquier comentario adicional para la cartera de productos SHELL:
            </Label>
            <Textarea
              id="obs-shell-faltante"
              value={observacionShellFaltante}
              onChange={(e) => setObservacionShellFaltante(e.target.value)}
              placeholder="Escriba sus observaciones sobre productos Shell..."
              disabled={isSyncing}
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="obs-qualid-faltante" className="text-sm">
              Coloca aquí tus observaciones de producto faltante y cualquier comentario adicional para la cartera de productos QUALID:
            </Label>
            <Textarea
              id="obs-qualid-faltante"
              value={observacionQualidFaltante}
              onChange={(e) => setObservacionQualidFaltante(e.target.value)}
              placeholder="Escriba sus observaciones sobre productos Qualid..."
              disabled={isSyncing}
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="obs-adicionales" className="text-sm">
              Añade aquí todos tus comentarios y observaciones adicionales
            </Label>
            <Textarea
              id="obs-adicionales"
              value={observacionesAdicionales}
              onChange={(e) => setObservacionesAdicionales(e.target.value)}
              placeholder="Comentarios adicionales generales..."
              disabled={isSyncing}
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="obs-competencia" className="text-sm">
              Aquí puedes dejar tus comentarios y observaciones sobre temas importantes como actividades de la competencia, presencia de nuevas marcas, etc.
            </Label>
            <Textarea
              id="obs-competencia"
              value={observacionesCompetencia}
              onChange={(e) => setObservacionesCompetencia(e.target.value)}
              placeholder="Observaciones sobre la competencia..."
              disabled={isSyncing}
              className="mt-1"
              rows={3}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleSubmit} 
            disabled={isSyncing} 
            className="w-full"
          >
            {isSyncing ? 'Sincronizando...' : 'Guardar Observaciones y Finalizar Visita'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
