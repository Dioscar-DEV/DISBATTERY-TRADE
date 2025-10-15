
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { autoUpdateRouteStatus } from '@/services/routes';
import { onAuthStateChanged } from 'firebase/auth';
import { getAuthClient, getFirestoreClient } from '@/firebase/clientApp';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

export default function RegistroExitosoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [countdown, setCountdown] = useState(5); // ✅ Contador de 5 segundos

  // ✅ LOGGING DETALLADO AL CARGAR LA PÁGINA DE ÉXITO
  useEffect(() => {
    console.log('🎉 ========= PÁGINA DE REGISTRO EXITOSO CARGADA =========');

    // Verificar qué hay en localStorage
    const clienteDataString = localStorage.getItem('clienteData');
    const currentUserString = localStorage.getItem('currentUser');

    console.log('📊 [REGISTRO-EXITOSO] ClienteData en localStorage:', clienteDataString);
    console.log('👤 [REGISTRO-EXITOSO] CurrentUser en localStorage:', currentUserString);

    if (clienteDataString) {
      try {
        const clienteData = JSON.parse(clienteDataString);
        console.log('📋 [REGISTRO-EXITOSO] Datos del cliente procesado:', {
          pointId: clienteData.pointId,
          rif: clienteData.rif,
          nombre: clienteData.nombre,
          tipoVisita: clienteData.tipoVisita,
          isEvent: clienteData.isEvent,
          eventId: clienteData.eventId
        });

        if (!clienteData.pointId) {
          console.error('❌ [PROBLEMA DETECTADO] El pointId está vacío en el clienteData:', clienteData.pointId);
        } else {
          console.log('✅ [ÉXITO] PointId correcto encontrado:', clienteData.pointId);
        }


      } catch (error) {
        console.error('❌ [ERROR] No se pudo parsear clienteData:', error);
      }
    } else {
      console.warn('⚠️ [ADVERTENCIA] No se encontró clienteData en localStorage');
    }

    console.log('🎉 ========= INICIANDO COUNTDOWN DE REDIRECCIÓN =========');
  }, [toast]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          console.log('🔄 [REDIRECT] Redirigiendo a /mi-ruta después de countdown');
          clearInterval(timer);
          router.push('/mi-ruta');
          return 0;
        }
        console.log(`⏱️ [COUNTDOWN] ${prev - 1} segundos restantes para redirección`);
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      console.log('🧹 [CLEANUP] Timer de countdown limpiado');
    };
  }, [router]);

  const handleRegistrarVisitaMerchandising = () => {
    router.push('/visit-capture');
  };

  const handleRegistrarVisitaTrade = () => {
    console.log('🔄 [REDIRECT] Navegando a /mi-ruta desde botón (sin autocompletado automático)');
    router.push('/mi-ruta');
  };

  const handleVolverAlInicio = () => {
    router.push('/');
  };

  // Configurar listener de autenticación y verificar auto-completación de ruta
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuthClient(), (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // ✅ FUNCIÓN REMOVIDA: La función checkAndCompleteRoute causaba que rutas nuevas 
        // aparecieran como completadas incorrectamente. El autocompletado debe ser manual
        // o más específico para evitar confusiones entre rutas diferentes del mismo día.
      }
    });
    return () => unsubscribe();
  }, []);

  // Función para verificar y auto-completar ruta SOLO si TODOS los puntos están visitados
  // ✅ FUNCIÓN REMOVIDA: checkAndCompleteRoute causaba que rutas nuevas 
  // aparecieran como completadas incorrectamente. El autocompletado automático
  // se deshabilitó para evitar confusiones entre rutas diferentes del mismo día.

  const handleGoToMyRoute = () => {
    console.log('🔄 [REDIRECT] Navegando manualmente a /mi-ruta (sin autocompletado automático)');
    router.push('/mi-ruta');
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-white overflow-hidden">
      {/* Background color blocks */}
      <div
        className="absolute top-0 left-0 h-[60vh] w-[55vw] sm:h-[70vh] sm:w-[50vw] bg-[#002D72] -z-0" // Disbattery Blue
        style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
      />
      <div
        className="absolute bottom-0 right-0 h-[75vh] w-[70vw] sm:h-[80vh] sm:w-[65vw] bg-[#D50000] -z-0" // Disbattery Red
        style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
      />
      <div
        className="absolute bottom-0 right-0 h-[60vh] w-[55vw] sm:h-[65vh] sm:w-[50vw] bg-[#FFC72C] -z-0" // Disbattery Yellow
        style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-end h-16 sm:h-20 px-4 sm:px-6 bg-transparent">
        <img
          src="https://storage.googleapis.com/iandai/imagenes/disbatterylogo.png"
          alt="Disbattery Lubricantes Logo Header"
          className="max-h-6 sm:max-h-8"
          data-ai-hint="company logo darktext"
        />
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-grow flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md py-4 shadow-xl text-center bg-white/95 backdrop-blur-sm rounded-lg">
          <CardHeader className="flex flex-col items-center p-6 pb-3">
            <img
              src="https://storage.googleapis.com/iandai/imagenes/Dise%C3%B1o%20sin%20t%C3%ADtulo%20(45).png"
              alt="Disbattery Lubricantes S.A. Logo"
              className="mb-4 max-h-10" // Adjusted size
              data-ai-hint="disbattery sa logo"
            />
            <CheckCircle className="h-16 w-16 text-green-500 mb-3" />
            <CardTitle className="text-3xl font-bold mb-1">
              ¡Registro Exitoso!
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Sus datos han sido guardados correctamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            {/* ✅ INFORMACIÓN DE REDIRECCIÓN AUTOMÁTICA */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
              <div className="flex items-center">
                <div className="ml-3">
                  <p className="text-sm text-blue-800 font-medium">
                    🔄 Regresando a tu ruta automáticamente en {countdown} segundo{countdown !== 1 ? 's' : ''}...
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Puedes continuar con el siguiente punto de tu ruta
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 px-6 pt-2">
            <Button
              onClick={handleRegistrarVisitaTrade}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md"
            >
              ⚡ Ir Ahora a Mi Ruta
            </Button>
            <Button
              onClick={handleRegistrarVisitaMerchandising}
              variant="outline"
              className="w-full shadow-md"
            >
              Registrar Nueva Visita
            </Button>
            <Button
              onClick={handleVolverAlInicio}
              variant="ghost"
              className="w-full text-muted-foreground"
            >
              Volver al Inicio
            </Button>
            <div className="flex justify-between items-center w-full pt-5 mt-3 border-t border-gray-200">
              {/* Logo y texto de Shell removido */}
              <img
                src="https://placehold.co/100x30.png" // Placeholder for Qualid Logo
                alt="Qualid Logo"
                className="max-h-8"
                data-ai-hint="qualid text logo"
              />
            </div>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
