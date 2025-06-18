
'use client';

import { useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, ListChecks, BarChart3, MapPinned, UserCircle } from 'lucide-react';

export default function AdminDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAdmin = localStorage.getItem('isAdminLoggedIn');
      if (isAdmin !== 'true') {
        router.push('/');
      }
    }
  }, [router]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isAdminLoggedIn');
    }
    router.push('/');
  };

  const features = [
    { name: 'Gestión de Usuarios', href: '/admin/users', icon: Users, description: 'Crear, editar y asignar roles a mercaderistas y administradores.' },
    { name: 'Gestión de Clientes', href: '#', icon: ListChecks, description: 'Administrar la información de los clientes visitados.' },
    { name: 'Datos de Visitas', href: '#', icon: BarChart3, description: 'Visualizar y analizar los datos recolectados en las visitas.' },
    { name: 'Gestión de Rutas (Futuro)', href: '#', icon: MapPinned, description: 'Planificar y visualizar rutas de mercaderistas (Integración con Google Maps).' },
  ];

  return (
    <div className="flex flex-col min-h-screen overflow-hidden"> {/* Added overflow-hidden */}
      {/* Top Bar */}
      <header className="flex flex-col sm:flex-row h-14">
        <div style={{ backgroundColor: '#b61817' }} className="w-full sm:w-1/3 flex items-center py-3 px-6 sm:px-8">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="flex items-center text-white hover:bg-red-700/50 p-2 rounded-md -ml-2"
          >
            <UserCircle className="w-10 h-10 mr-3" />
            <span className="text-xl font-semibold">Usuario</span>
          </Button>
        </div>
        <div style={{ backgroundColor: '#ffee26' }} className="w-full sm:w-2/3 flex items-center justify-center sm:justify-end py-3 px-6 sm:px-8">
          <img
            src="https://storage.googleapis.com/iandai/imagenes/disbatterylogo.png"
            alt="Disbattery Lubricantes Logo"
            className="max-h-8"
            data-ai-hint="company logo darktext"
          />
        </div>
      </header>

      {/* Main Content Area (Dark Disbattery Red Background) */}
      <main style={{ backgroundColor: '#a51717' }} className="relative flex-grow flex items-center justify-center p-4 md:p-8">
        {/* Yellow Triangle Background Element */}
        <div
          className="absolute top-0 right-0 h-full w-3/4 bg-[#ffee26] z-[1]"
          style={{ clipPath: 'polygon(100% 0, 0% 100%, 100% 100%)' }}
        />
        
        <Card className="w-full max-w-2xl bg-stone-50 shadow-xl rounded-lg relative z-[2]"> {/* Ensure card is above triangle element */}
          <CardHeader className="flex flex-col items-center text-center p-6 pb-4 border-b border-gray-200">
            <img
                src="https://storage.googleapis.com/iandai/imagenes/disbatterylogo.png"
                alt="Disbattery Lubricantes S.A. Logo"
                className="max-h-12 mb-6"
                data-ai-hint="disbattery sa logo"
              />
            <div>
              <CardTitle>
                <span
                  className="text-4xl font-bold"
                  style={{
                    backgroundImage: 'linear-gradient(to right, hsl(var(--primary-gradient-start)), hsl(var(--primary-gradient-end)))',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.2)',
                  }}
                >
                  Panel de Administración
                </span>
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 mt-2">
                Bienvenido al panel de control. Desde aquí podrás gestionar la aplicación.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {features.map((feature) => (
                <Link href={feature.href} key={feature.name} passHref>
                  <Card className="bg-stone-50 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 cursor-pointer h-full flex flex-col p-4">
                    <CardHeader className="flex-row items-center gap-3 pb-2">
                      <feature.icon
                        className="w-7 h-7"
                        style={{ color: 'hsl(var(--primary-gradient-start))' }}
                      />
                      <CardTitle
                        className="text-xl"
                        style={{
                            backgroundImage: 'linear-gradient(to right, hsl(var(--primary-gradient-start)), hsl(var(--primary-gradient-end)))',
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.2)',
                        }}
                      >
                        {feature.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow pt-1">
                      <p className="text-sm text-gray-500">{feature.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Bottom Bar */}
      <footer className="flex flex-col sm:flex-row h-14 relative z-[1]">
        <div style={{ backgroundColor: '#2a2769' }} className="w-full sm:w-1/5 h-full"></div>
        <div style={{ backgroundColor: '#b61817' }} className="w-full sm:w-1/5 h-full"></div>
        <div style={{ backgroundColor: '#fbce04' }} className="w-full sm:w-3/5 h-full flex items-end justify-end px-4 sm:px-6">
            <img
              src="https://storage.googleapis.com/iandai/imagenes/shelllogo.png"
              alt="Shell Logo"
              className="max-h-14" 
              data-ai-hint="shell pecten"
            />
        </div>
      </footer>
    </div>
  );
}
