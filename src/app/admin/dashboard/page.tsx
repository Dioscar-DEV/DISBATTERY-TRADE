"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  ListChecks,
  BarChart3,
  MapPinned,
  UserCircle,
  ArrowLeft,
  Menu,
} from "lucide-react";
import {
  getCurrentUserWithPermissions,
  UserData,
  UserPermissions,
} from "@/services/auth";
import { LogoutButton } from "@/components/LogoutButton";
import OfflineStatusManager from "@/components/OfflineStatusManager";
import { PageWrapper } from "@/components/PageWrapper";
import { usePageState } from "@/hooks/usePageState";

// Constants
const COLORS = {
  primary: "#b61717",
  secondary: "#ffee26",
  background: "#a51717",
  footer1: "#2a2769",
  footer2: "#b61817",
  footer3: "#fbce04",
};

const FEATURES = [
  {
    name: "Gestión de Usuarios",
    href: "/admin/users",
    icon: Users,
    description:
      "Crear, editar y asignar roles a mercaderistas y administradores.",
    permission: "canManageUsers",
  },
  {
    name: "Gestión de Rutas",
    href: "/admin/rutas",
    icon: MapPinned,
    description:
      "Planificar y visualizar rutas de mercaderistas con integración Google Maps.",
    permission: "canManageRoutes",
  },
  {
    name: "Gestión de Clientes",
    href: "/admin/clientes",
    icon: ListChecks,
    description: "Administrar la información de los clientes visitados.",
    permission: "canManageClients",
  },
  {
    name: "Datos de Visitas",
    href: "/admin/datos-visitas",
    icon: BarChart3,
    description: "Visualizar y analizar los datos recolectados en las visitas.",
    permission: "canViewReports",
  },
];

// Helper functions
const getUserDisplayRole = (
  user: UserData | null,
  permissions: UserPermissions | null,
  loading: boolean
) => {
  if (loading) return "Cargando...";
  if (permissions?.isAdminMaster) return "Admin Master";
  return `${user?.role || "N/A"} - ${user?.sede || "N/A"}`;
};

const getAvailableFeatures = (permissions: UserPermissions | null) => {
  if (!permissions) return [];
  return FEATURES.filter(
    (feature) => permissions[feature.permission as keyof UserPermissions]
  );
};

// Inner Components
const LoadingSpinner: React.FC = () => (
  <div className="flex flex-col min-h-screen">
    <div className="flex-grow flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando panel de administración...</p>
      </div>
    </div>
  </div>
);

interface HeaderProps {
  currentUser: UserData | null;
  userPermissions: UserPermissions | null;
  loading: boolean;
  onBack: () => void;
  onToggleMobileMenu: () => void;
  isMobileMenuOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({
  currentUser,
  userPermissions,
  loading,
  onBack,
  onToggleMobileMenu,
  isMobileMenuOpen,
}) => (
  <header className="flex flex-col sm:flex-row h-16 flex-shrink-0 fixed top-0 w-full z-50">
    <div
      style={{ backgroundColor: COLORS.primary }}
      className="w-full sm:w-1/3 flex items-center justify-between sm:justify-start py-3 px-6 sm:px-8"
    >
      <div className="flex items-center gap-4">
        <Button
          onClick={onBack}
          variant="ghost"
          size="sm"
          className="text-white hover:bg-red-700/50 p-2 rounded-md"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="hidden sm:flex items-center text-white p-2 rounded-md">
          <UserCircle className="w-10 h-10 mr-3" />
          <div className="text-left flex-1">
            <div className="text-xl font-semibold">
              {currentUser?.fullName || "Cargando..."}
            </div>
            <div className="text-sm opacity-75">
              {getUserDisplayRole(currentUser, userPermissions, loading)}
            </div>
          </div>
          <LogoutButton className="ml-3 bg-red-800 hover:bg-red-900 text-white border-0 px-3 py-1 text-sm" />
        </div>
        <h1 className="sm:hidden text-xl font-semibold text-white">
          Dashboard
        </h1>
      </div>
      <div className="sm:hidden">
        <Button
          onClick={onToggleMobileMenu}
          variant="ghost"
          size="sm"
          className="text-white hover:bg-red-700/50 p-2 rounded-md"
        >
          <Menu className="w-6 h-6" />
        </Button>
      </div>
    </div>
    <div
      style={{ backgroundColor: COLORS.secondary }}
      className="w-full sm:w-2/3 flex items-center justify-center sm:justify-end py-3 px-6 sm:px-8"
    >
      <img
        src="https://storage.googleapis.com/iandai/imagenes/disbatterylogo.png"
        alt="Disbattery Lubricantes Logo"
        className="max-h-8"
        data-ai-hint="company logo darktext"
      />
    </div>
  </header>
);

interface MobileMenuProps {
  currentUser: UserData | null;
  userPermissions: UserPermissions | null;
  loading: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const MobileMenu: React.FC<MobileMenuProps> = ({
  currentUser,
  userPermissions,
  loading,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="sm:hidden fixed top-16 left-0 w-full bg-red-800/95 backdrop-blur-sm z-40 p-4 text-white animate-in slide-in-from-top-4 duration-300"
      onClick={onClose}
    >
      <div className="flex items-center p-2 rounded-md mb-4">
        <UserCircle className="w-10 h-10 mr-3 flex-shrink-0" />
        <div className="text-left flex-1 overflow-hidden">
          <div className="text-xl font-semibold truncate">
            {currentUser?.fullName || "Cargando..."}
          </div>
          <div className="text-sm opacity-75 truncate">
            {getUserDisplayRole(currentUser, userPermissions, loading)}
          </div>
        </div>
      </div>
      <LogoutButton className="w-full bg-red-700 hover:bg-red-800 text-white" />
    </div>
  );
};

interface FeatureCardProps {
  feature: (typeof FEATURES)[0];
}

const FeatureCard: React.FC<FeatureCardProps> = ({ feature }) => (
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
        <p className="text-gray-600 flex-grow">{feature.description}</p>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <span className="inline-flex items-center text-sm font-medium text-red-600">
            Acceder
            <svg
              className="ml-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </span>
        </div>
      </CardContent>
    </Card>
  </Link>
);

interface FeatureGridProps {
  features: typeof FEATURES;
  currentUser: UserData | null;
  userPermissions: UserPermissions | null;
}

const FeatureGrid: React.FC<FeatureGridProps> = ({
  features,
  currentUser,
  userPermissions,
}) => {
  if (features.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-medium text-gray-900 mb-2">
          Sin funcionalidades disponibles
        </h3>
        <div className="text-gray-600 space-y-2">
          <p>Usuario: {currentUser?.fullName || "No cargado"}</p>
          <p>Rol: {currentUser?.role || "No cargado"}</p>
          <p>Sede: {currentUser?.sede || "No cargado"}</p>
          <p>Email: {currentUser?.email || "No cargado"}</p>
          {userPermissions && (
            <div className="mt-4 p-3 bg-gray-100 rounded text-left text-sm max-h-64 overflow-y-auto">
              <p>
                <strong>Permisos:</strong>
              </p>
              <p>
                • Gestionar usuarios:{" "}
                {userPermissions.canManageUsers ? "✅" : "❌"}
              </p>
              <p>
                • Gestionar rutas:{" "}
                {userPermissions.canManageRoutes ? "✅" : "❌"}
              </p>
              <p>
                • Gestionar clientes:{" "}
                {userPermissions.canManageClients ? "✅" : "❌"}
              </p>
              <p>
                • Ver reportes: {userPermissions.canViewReports ? "✅" : "❌"}
              </p>
              <p>
                • Admin Master: {userPermissions.isAdminMaster ? "✅" : "❌"}
              </p>
              <p>
                • Sedes permitidas:{" "}
                {userPermissions.allowedSedes.join(", ") || "Ninguna"}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
      {features.map((feature) => (
        <FeatureCard key={feature.name} feature={feature} />
      ))}
    </div>
  );
};

const AdminMasterInfo: React.FC = () => (
  <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="flex items-center">
      <div className="p-2 bg-blue-100 rounded-lg mr-3">
        <UserCircle className="h-6 w-6 text-blue-600" />
      </div>
      <div>
        <h4 className="text-lg font-semibold text-blue-900">Admin Master</h4>
        <p className="text-blue-700 text-sm">
          Tienes acceso completo a todas las sedes y funcionalidades del
          sistema.
        </p>
      </div>
    </div>
  </div>
);

const Footer: React.FC = () => (
  <footer className="flex flex-col sm:flex-row h-14 flex-shrink-0">
    <div
      style={{ backgroundColor: COLORS.footer1 }}
      className="w-full sm:w-1/5 h-full"
    ></div>
    <div
      style={{ backgroundColor: COLORS.footer2 }}
      className="w-full sm:w-1/5 h-full"
    ></div>
    <div
      style={{ backgroundColor: COLORS.footer3 }}
      className="w-full sm:w-3/5 h-full flex items-end justify-end px-4 sm:px-6"
    >
      <img
        src="https://storage.googleapis.com/iandai/imagenes/shelllogo.png"
        alt="Shell Logo"
        className="max-h-14"
        data-ai-hint="shell pecten"
      />
    </div>
  </footer>
);

export default function AdminDashboard() {
  const router = useRouter();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { loading, executeAsync } = usePageState({ initialLoading: true });

  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [userPermissions, setUserPermissions] =
    useState<UserPermissions | null>(null);

  useEffect(() => {
    const loadUserData = async () => {
      const result = await executeAsync(async () => {
        const authResult = await getCurrentUserWithPermissions();
        if (authResult) {
          setCurrentUser(authResult.user);
          setUserPermissions(authResult.permissions);
          return authResult;
        }
        throw new Error("No se pudieron cargar los datos del usuario");
      }, "Error cargando datos del dashboard");
    };

    loadUserData();
  }, [executeAsync]);

  const availableFeatures = getAvailableFeatures(userPermissions);

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        currentUser={currentUser}
        userPermissions={userPermissions}
        loading={loading}
        onBack={() => router.back()}
        onToggleMobileMenu={() => setMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      <MobileMenu
        currentUser={currentUser}
        userPermissions={userPermissions}
        loading={loading}
        isOpen={isMobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main
        style={{ backgroundColor: COLORS.background }}
        className="flex-grow pt-24"
      >
        <div className="max-w-6xl mx-auto p-4">
          <Card className="bg-stone-50 shadow-xl">
            <CardHeader className="border-b border-gray-200">
              <CardTitle className="text-3xl font-bold text-gray-900">
                Panel de Administración
              </CardTitle>
              <CardDescription className="text-gray-600">
                {userPermissions?.isAdminMaster
                  ? "Acceso completo a todas las funcionalidades del sistema"
                  : `Gestión de ${currentUser?.sede} - Permisos de ${currentUser?.role}`}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              <FeatureGrid
                features={availableFeatures}
                currentUser={currentUser}
                userPermissions={userPermissions}
              />

              {/* Panel de gestión offline para administradores */}
              <div className="mt-8">
                <OfflineStatusManager />
              </div>

              {userPermissions?.isAdminMaster && <AdminMasterInfo />}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
