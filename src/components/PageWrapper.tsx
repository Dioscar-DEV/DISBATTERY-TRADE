"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Home,
  Menu,
  UserCircle,
} from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  getCurrentUserWithPermissions,
  UserData,
  UserPermissions,
} from "@/services/auth";

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
  className = "",
  loading: externalLoading = false,
  error: externalError = null,
  onRetry,
}: PageWrapperProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [userPermissions, setUserPermissions] =
    useState<UserPermissions | null>(null);
  const [authLoading, setAuthLoading] = useState(requireAuth);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false); // Kept for backward compatibility if needed, but Sheet manages its own state usually.

  // Create a safer toggle for the sheet if needed, or rely on Sheet's onOpenChange
  const [sheetOpen, setSheetOpen] = useState(false);

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
          console.log("❌ No hay usuario autenticado, redirigiendo al login");
          router.push("/");
          return;
        }

        setCurrentUser(result.user);
        setUserPermissions(result.permissions);

        // Verificar permisos específicos si se requieren
        if (requiredPermissions.length > 0) {
          const hasAllPermissions = requiredPermissions.every(
            (permission) =>
              result.permissions[permission as keyof UserPermissions]
          );

          if (!hasAllPermissions) {
            console.log("❌ Usuario sin permisos suficientes");
            setAuthError("No tienes permisos para acceder a esta página");
            return;
          }
        }

        setAuthLoading(false);
      } catch (error) {
        console.error("❌ Error verificando autenticación:", error);
        setAuthError("Error verificando permisos de usuario");
        setAuthLoading(false);
      }
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requireAuth, JSON.stringify(requiredPermissions), router]);

  const handleBack = () => {
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.back();
    }
  };

  const handleHome = () => {
    if (
      currentUser?.role === "AdminMaster" ||
      currentUser?.role === "Administrador"
    ) {
      router.push("/admin/dashboard");
    } else {
      router.push("/mi-ruta");
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
            <Button onClick={() => router.push("/")} variant="default">
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
        <header className="bg-white shadow-sm border-b sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
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
                    <p className="text-sm text-gray-500 truncate">{subtitle}</p>
                  )}
                </div>
              )}

              {/* Desktop User Info & Logout */}
              {currentUser && (
                <div className="hidden md:flex items-center gap-4">
                  <div className="flex items-center text-gray-700">
                    <UserCircle className="w-8 h-8 mr-2 text-gray-500" />
                    <div className="text-right">
                      <div className="text-sm font-semibold leading-none">
                        {currentUser.fullName}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {currentUser.role}
                        {currentUser.sede && ` - ${currentUser.sede}`}
                      </div>
                    </div>
                  </div>
                  <LogoutButton
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  />
                </div>
              )}

              {/* Menú móvil con Sheet */}
              <div className="md:hidden flex items-center">
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden">
                      <Menu className="h-5 w-5" />
                      <span className="sr-only">Menú</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="w-[300px] sm:w-[350px] p-0"
                  >
                    <SheetHeader className="p-6 border-b bg-muted/10">
                      <SheetTitle className="text-left flex items-center gap-2">
                        <img
                          src="https://storage.googleapis.com/iandai/imagenes/disbatterylogo.png"
                          alt="Disbattery"
                          className="h-8 w-auto object-contain"
                        />
                      </SheetTitle>
                      {currentUser && (
                        <div className="mt-4 text-left">
                          <div className="font-semibold">
                            {currentUser.fullName}
                          </div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {currentUser.role}
                          </div>
                          {currentUser.sede && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {currentUser.sede}
                            </div>
                          )}
                        </div>
                      )}
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100vh-180px)]">
                      <div className="flex flex-col p-4 gap-2">
                        {showHomeButton && (
                          <Button
                            onClick={() => {
                              handleHome();
                              setSheetOpen(false);
                            }}
                            variant="ghost"
                            className="w-full justify-start text-base"
                          >
                            <Home className="h-5 w-5 mr-3" />
                            Inicio
                          </Button>
                        )}

                        {/* Aquí se podrían agregar más items de navegación específicos del rol si fuera necesario */}
                      </div>
                    </ScrollArea>
                    <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
                      <div className="mb-4">
                        <LogoutButton
                          variant="ghost"
                          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                          showText={true}
                        />
                      </div>
                      <div className="text-xs text-center text-muted-foreground mb-2">
                        Version 1.0.0
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Contenido principal */}
      <main className="flex-1">{children}</main>
    </div>
  );
}

export default PageWrapper;
