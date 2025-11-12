'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle, Home, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getCurrentUserWithPermissions, UserData, UserPermissions } from '@/services/auth';

interface PageWrapperProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  backUrl?: string;
  requireAuth?: boolean;
  requiredPermissions?: string[];
  showHomeButton?: boolean;
  className?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function PageWrapper({
  children,
  title,
  subtitle,
  showBackButton = true,
  backUrl,
  requireAuth = true,
  requiredPermissions = [],
  showHomeButton = false,
  className = '',
  loading: externalLoading = false,
  error: externalError = null,
  onRetry
}: PageWrapperProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [authLoading, setAuthLoading] = useState(requireAuth);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Verificar autenticación y permisos
  useEffect(() => {
    if (!requireAuth) {
      setAuthLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const result = await getCurrentUserWithPermissions();
        
        if (!result) {
          console.log('❌ No hay usuario autenticado, redirigiendo al login');
          router.push('/');
          return;
        }

        setCurrentUser(result.user);
        setUserPermissions(result.permissions);

        // Verificar permisos específicos si se requieren
        if (requiredPermissions.length > 0) {
          const hasAllPermissions = requiredPermissions.every(permission => 
            result.permissions[permission as keyof UserPermissions]
          );

          if (!hasAllPermissions) {
            console.log('❌ Usuario sin permisos suficientes');
            setAuthError('No tienes permisos para acceder a esta página');
            return;
          }
        }

        setAuthLoading(false);
      } catch (error) {
        console.error('❌ Error verificando autenticación:', error);
        setAuthError('Error verificando permisos de usuario');
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, [requireAuth, requiredPermissions, router]);

  const handleBack = () => {
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.back();
    }
  };

  const handleHome = () => {
    if (currentUser?.role === 'AdminMaster' || currentUser?.role === 'Administrador') {
      router.push('/admin/dashboard');
    } else {
      router.push('/mi-ruta');
    }
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!isMobileMenuOpen);
  };

  // Estado de carga
  if (authLoading || externalLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Estado de error
  if (authError || externalError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {authError || externalError}
            </AlertDescription>
          </Alert>
          
          <div className="mt-4 flex gap-2 justify-center">
            {onRetry && (
              <Button onClick={onRetry} variant="outline">
                Reintentar
              </Button>
            )}
            <Button onClick={() => router.push('/')} variant="default">
              Volver al Inicio
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Header de navegación */}
      {(showBackButton || showHomeButton || title) && (
        <header className="bg-white shadow-sm border-b sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Navegación izquierda */}
              <div className="flex items-center gap-4">
                {showBackButton && (
                  <Button
                    onClick={handleBack}
                    variant="ghost"
                    size="sm"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Atrás
                  </Button>
                )}
                
                {showHomeButton && (
                  <Button
                    onClick={handleHome}
                    variant="ghost"
                    size="sm"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Inicio
                  </Button>
                )}
              </div>

              {/* Título central */}
              {title && (
                <div className="flex-1 text-center px-4">
                  <h1 className="text-lg font-semibold text-gray-900 truncate">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="text-sm text-gray-500 truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
              )}

              {/* Menú móvil */}
              <div className="flex items-center">
                <Button
                  onClick={toggleMobileMenu}
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                >
                  {isMobileMenuOpen ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Menu className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Menú móvil desplegable */}
          {isMobileMenuOpen && (
            <div className="md:hidden bg-white border-t">
              <div className="px-4 py-2 space-y-2">
                {currentUser && (
                  <div className="text-sm text-gray-600 border-b pb-2">
                    {currentUser.fullName} - {currentUser.role}
                  </div>
                )}
                
                {showHomeButton && (
                  <Button
                    onClick={() => {
                      handleHome();
                      setMobileMenuOpen(false);
                    }}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Ir al Inicio
                  </Button>
                )}
              </div>
            </div>
          )}
        </header>
      )}

      {/* Contenido principal */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}

export default PageWrapper;
