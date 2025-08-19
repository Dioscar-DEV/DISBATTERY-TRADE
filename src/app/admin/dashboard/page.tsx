'use client';

import { useEffect, useState } from 'react';
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
import { Users, ListChecks, BarChart3, MapPinned, UserCircle, ArrowLeft } from 'lucide-react';
import { getCurrentUserWithPermissions, UserData, UserPermissions, clearUserData } from '@/services/auth';
import { LogoutButton } from '@/components/LogoutButton';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      if (typeof window !== 'undefined') {
        const isAdmin = localStorage.getItem('isAdminLoggedIn');
        if (isAdmin !== 'true') {
          router.push('/');
          return;
        }

        console.log('Dashboard: Cargando datos del usuario...');
        try {
          const result = await getCurrentUserWithPermissions();
          console.log('Dashboard: Resultado de getCurrentUserWithPermissions:', result);
          
          if (result) {
            setCurrentUser(result.user);
            setUserPermissions(result.permissions);
            console.log('Dashboard: Datos del usuario establecidos:', result.user);
            console.log('Dashboard: Permisos establecidos:', result.permissions);
          } else {
            console.warn('Dashboard: No se obtuvieron datos del usuario');
          }
        } catch (error) {
          console.error('Dashboard: Error cargando datos del usuario:', error);
        } finally {
          setLoading(false);
          console.log('Dashboard: Carga finalizada');
        }
      }
    };

    loadUserData();
  }, [router]);



  const getAvailableFeatures = () => {
    console.log('Dashboard: getAvailableFeatures llamada');
    console.log('Dashboard: userPermissions:', userPermissions);
    
    if (!userPermissions) {
      console.log('Dashboard: No hay permisos cargados aún');
      return [];
    }

    const features = [];
    
    if (userPermissions.canManageUsers) {
      console.log('Dashboard: Agregando gestión de usuarios');
      features.push({ 
        name: 'Gestión de Usuarios', 
        href: '/admin/users', 
        icon: Users, 
        description: 'Crear, editar y asignar roles a mercaderistas y administradores.'
      });
    }

    if (userPermissions.canManageRoutes) {
      console.log('Dashboard: Agregando gestión de rutas');
      features.push({ 
        name: 'Gestión de Rutas', 
        href: '/admin/rutas', 
        icon: MapPinned, 
        description: 'Planificar y visualizar rutas de mercaderistas con integración Google Maps.'
      });
    }

    if (userPermissions.canManageClients) {
      console.log('Dashboard: Agregando gestión de clientes');
      features.push({ 
        name: 'Gestión de Clientes', 
        href: '/admin/clientes', 
        icon: ListChecks, 
        description: 'Administrar la información de los clientes visitados.'
      });
    }

    if (userPermissions.canViewReports) {
      console.log('Dashboard: Agregando datos de visitas');
      features.push({ 
        name: 'Datos de Visitas', 
        href: '/admin/datos-visitas', 
        icon: BarChart3, 
        description: 'Visualizar y analizar los datos recolectados en las visitas.'
      });
    }

    console.log('Dashboard: Features disponibles:', features);
    return features;
  };

  if (loading) {
    console.log('Dashboard: Mostrando pantalla de carga');
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando panel de administración...</p>
          </div>
        </div>
      </div>
    );
  }

  const availableFeatures = getAvailableFeatures();
  console.log('Dashboard: Renderizando con', availableFeatures.length, 'features disponibles');
  console.log('Dashboard: Current user para renderizar:', currentUser);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Bar */}
      <header className="flex flex-col sm:flex-row h-16 flex-shrink-0">
        <div style={{ backgroundColor: '#b61817' }} className="w-full sm:w-1/3 flex items-center py-3 px-6 sm:px-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.back()}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-red-700/50 p-2 rounded-md"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center text-white p-2 rounded-md">
              <UserCircle className="w-10 h-10 mr-3" />
              <div className="text-left flex-1">
                <div className="text-xl font-semibold">{currentUser?.fullName || 'Cargando...'}</div>
                <div className="text-sm opacity-75">
                  {loading ? 'Cargando...' :
                   userPermissions?.isAdminMaster ? 'Admin Master' : 
                   `${currentUser?.role || 'N/A'} - ${currentUser?.sede || 'N/A'}`}
                </div>
              </div>
              <LogoutButton className="ml-3 bg-red-800 hover:bg-red-900 text-white border-0 px-3 py-1 text-sm" />
            </div>
          </div>
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

      {/* Main Content - Scrollable */}
      <main style={{ backgroundColor: '#a51717' }} className="flex-grow overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4">
          <Card className="bg-stone-50 shadow-xl">
            <CardHeader className="border-b border-gray-200">
              <CardTitle className="text-3xl font-bold text-gray-900">
                Panel de Administración
              </CardTitle>
              <CardDescription className="text-gray-600">
                {userPermissions?.isAdminMaster 
                  ? 'Acceso completo a todas las funcionalidades del sistema'
                  : `Gestión de ${currentUser?.sede} - Permisos de ${currentUser?.role}`
                }
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              {availableFeatures.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">⚠️</div>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">Sin funcionalidades disponibles</h3>
                  <div className="text-gray-600 space-y-2">
                    <p>Estado de carga: {loading ? 'Cargando...' : 'Completado'}</p>
                    <p>Usuario: {currentUser?.fullName || 'No cargado'}</p>
                    <p>Rol: {currentUser?.role || 'No cargado'}</p>
                    <p>Sede: {currentUser?.sede || 'No cargado'}</p>
                    <p>Email: {currentUser?.email || 'No cargado'}</p>
                    {userPermissions && (
                      <div className="mt-4 p-3 bg-gray-100 rounded text-left text-sm max-h-64 overflow-y-auto">
                        <p><strong>Permisos:</strong></p>
                        <p>• Gestionar usuarios: {userPermissions.canManageUsers ? '✅' : '❌'}</p>
                        <p>• Gestionar rutas: {userPermissions.canManageRoutes ? '✅' : '❌'}</p>
                        <p>• Gestionar clientes: {userPermissions.canManageClients ? '✅' : '❌'}</p>
                        <p>• Ver reportes: {userPermissions.canViewReports ? '✅' : '❌'}</p>
                        <p>• Admin Master: {userPermissions.isAdminMaster ? '✅' : '❌'}</p>
                        <p>• Sedes permitidas: {userPermissions.allowedSedes.join(', ') || 'Ninguna'}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                  {availableFeatures.map((feature) => (
                    <Link key={feature.name} href={feature.href}>
                      <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:scale-105 bg-white border-2 border-transparent hover:border-red-200">
                        <CardContent className="p-6 flex flex-col h-full">
                          <div className="flex items-center mb-4">
                            <div className="p-2 bg-red-100 rounded-lg mr-4">
                              <feature.icon className="h-8 w-8 text-red-600" />
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold text-gray-900">
                                {feature.name}
                              </h3>
                            </div>
                          </div>
                          <p className="text-gray-600 flex-grow">
                            {feature.description}
                          </p>
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <span className="inline-flex items-center text-sm font-medium text-red-600">
                              Acceder
                              <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}

              {/* Información adicional para Admin Master */}
              {userPermissions?.isAdminMaster && (
                <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <UserCircle className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-blue-900">Admin Master</h4>
                      <p className="text-blue-700 text-sm">
                        Tienes acceso completo a todas las sedes y funcionalidades del sistema.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Bottom Bar */}
      <footer className="flex flex-col sm:flex-row h-14 flex-shrink-0">
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
