
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
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

  const handleRegistrarVisita = () => {
    router.push('/visit-capture');
  };

  const handleVolverAlInicio = () => {
    router.push('/');
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
            {/* Content can be added here if needed in the future */}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 px-6 pt-2">
            <Button
              onClick={handleRegistrarVisita}
              className="w-full shadow-md"
              // Default primary blue gradient will be applied
            >
              Registrar Visita Merchandising
            </Button>
            <Button
              onClick={handleRegistrarVisita} // Points to the same handler for now
              className="w-full shadow-md"
            >
              Registrar Visita Trade
            </Button>
            <Button
              onClick={handleVolverAlInicio}
              className="w-full shadow-md" // Changed from outline
            >
              Volver al Inicio y Cerrar Sesión
            </Button>
            <div className="flex justify-between items-center w-full pt-5 mt-3 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <img
                  src="https://storage.googleapis.com/iandai/imagenes/shell.png"
                  alt="Shell Logo"
                  className="max-h-8"
                  data-ai-hint="shell logo"
                />
                <span className="text-xs text-gray-600">Macro Distribuidor<br/>de Lubricantes Shell</span>
              </div>
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
