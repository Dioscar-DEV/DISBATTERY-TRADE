'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusCircle, Users, Edit3, Trash2, Eye, EyeOff, Loader2, UserCircle, ArrowLeft, Menu } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuthClient, getFirestoreClient } from '@/firebase/clientApp';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, getDocs, doc, deleteDoc, query, orderBy, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { Region, Sede, SEDES_DATA, getSedesByRegion, getCitiesBySede } from '@/types/routes';
import { UserData } from '@/services/auth';
import { LogoutButton } from '@/components/LogoutButton';
import { offlineManager } from '@/services/offlineManager';
import { obtenerUltimasVisitasUsuarios } from '@/services/visitas';
import { Visita } from '@/types/visitas';
import { getCurrentUserWithPermissions, UserPermissions, canAccessSede, isAdminMaster as isUserAdminMaster, ADMIN_MASTER_EMAILS } from '@/services/auth';
import { sendNuevoUsuarioAprobacionEmail } from '@/services/emailNotifications';

const newUserSchema = z.object({
  fullName: z.string().min(3, { message: 'El nombre completo es requerido (mínimo 3 caracteres).' }),
  email: z.string().email({ message: 'Por favor, ingrese un email válido.' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
  role: z.enum(['Mercaderista', 'Administrador', 'Supervisor'], { required_error: 'Por favor, seleccione un rol.' }),
  phone: z.string().min(8, { message: 'El número telefónico es obligatorio.' }),
  city: z.string().min(1, { message: 'Por favor, seleccione una ciudad.' }),
  // ✅ Campos opcionales para AdminMaster
  region: z.enum(['Centro-capital', 'Centro-Los llanos', 'Occidente', 'Oriente']).optional(),
  sede: z.enum(['GRUPO DISBATTERY', 'BLITZ 2000', 'GRUPO VICTORIA', 'DISBATTERY']).optional(),
});

type NewUserFormData = z.infer<typeof newUserSchema>;

interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'Mercaderista' | 'Administrador' | 'Supervisor';
  region: Region;
  sede: Sede;
  city: string;
  createdAt: Date;
}

function UserManagementPageContent() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<Region | ''>('');
  const [selectedSede, setSelectedSede] = useState<Sede | ''>('');
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'Mercaderista' as 'Mercaderista' | 'Administrador' | 'Supervisor',
    region: 'Centro-capital' as Region,
    sede: 'GRUPO DISBATTERY' as Sede,
    city: ''
  });

  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'todos' | 'Mercaderista' | 'Administrador' | 'Supervisor'>('todos');
  const [filterRegion, setFilterRegion] = useState<'todos' | Region>('todos');
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Estados para visitas y permisos
  const [ultimasVisitas, setUltimasVisitas] = useState<{ [email: string]: Visita | null }>({});
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);

  // ✅ Usar la función centralizada de auth.ts
  const isCurrentUserAdminMaster = currentUser ? isUserAdminMaster(currentUser.email) : false;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset: resetForm,
    watch,
    setValue
  } = useForm<NewUserFormData>({
    resolver: zodResolver(newUserSchema),
  });

  const watchedRegion = watch('region');
  const watchedSede = watch('sede');

  // ✅ NUEVA FUNCIONALIDAD: Procesar aprobación/rechazo desde email
  const searchParams = useSearchParams();

  // Función para aprobar usuario (cambiar status de pending_approval a active)
  const approveUser = async (userId: string) => {
    try {
      console.log('🔄 Aprobando usuario:', userId);

      // 1. Obtener datos del usuario en la colección 'users'
      const userDoc = await getDoc(doc(getFirestoreClient(), 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('Usuario no encontrado');
      }

      const userData = userDoc.data();
      console.log('📋 Datos del usuario:', userData);

      // 2. ✅ SIMPLE: Solo cambiar el status a 'active'
      await updateDoc(doc(getFirestoreClient(), 'users', userId), {
        status: 'active',
        approvedAt: new Date(),
        approvedBy: currentUser?.email || 'admin'
      });

      console.log('✅ Usuario aprobado - status cambiado a active');

      toast({
        title: "Usuario aprobado",
        description: `Usuario ${userData.fullName} ha sido aprobado y puede hacer login.`,
      });

      // Recargar usuarios
      loadUsers();

      return true;
    } catch (error: any) {
      console.error('❌ Error aprobando usuario:', error);

      // Debugging más específico
      if (error.code === 'permission-denied') {
        console.error('🚨 Error de permisos específico:', {
          email: currentUser?.email,
          action: 'approveUser',
          step: 'firestore_operation'
        });
      }

      toast({
        title: "Error",
        description: error.code === 'permission-denied'
          ? "Sin permisos para aprobar usuarios. Contacta al administrador."
          : error.message || "No se pudo aprobar el usuario.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Función para rechazar usuario (cambiar status a rejected)
  const rejectUser = async (userId: string) => {
    try {
      console.log('❌ Rechazando usuario:', userId);

      // 1. Obtener datos del usuario
      const userDoc = await getDoc(doc(getFirestoreClient(), 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('Usuario no encontrado');
      }

      const userData = userDoc.data();

      // 2. ✅ SIMPLE: Solo cambiar el status a 'rejected'
      await updateDoc(doc(getFirestoreClient(), 'users', userId), {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: currentUser?.email || 'admin'
      });

      console.log('✅ Usuario rechazado - status cambiado a rejected');

      // 3. ✅ CRÍTICO: Limpiar cualquier sesión activa del usuario rechazado
      if (typeof window !== 'undefined') {
        // Si el usuario rechazado es el mismo que está logueado, hacer logout
        const currentLoggedUser = localStorage.getItem('currentUser');
        if (currentLoggedUser) {
          const loggedUserData = JSON.parse(currentLoggedUser);
          if (loggedUserData.id === userId) {
            // Es el mismo usuario - forzar logout
            localStorage.clear();
            window.location.reload();
          }
        }
      }

      toast({
        title: "Usuario rechazado",
        description: `Solicitud de ${userData.fullName} ha sido rechazada.`,
        variant: "destructive",
      });

      // Recargar usuarios
      loadUsers();

      return true;
    } catch (error: any) {
      console.error('❌ Error rechazando usuario:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo rechazar el usuario.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Procesar automáticamente los parámetros de aprobación/rechazo
  useEffect(() => {
    if (!searchParams) return;
    const action = searchParams.get('action');
    const userId = searchParams.get('id');

    if (action && userId) {
      console.log('🎯 Procesando acción desde email:', { action, userId });

      if (action === 'approve') {
        approveUser(userId).then(() => {
          // Limpiar parámetros de URL después de procesar
          router.replace('/admin/users');
        });
      } else if (action === 'reject') {
        rejectUser(userId).then(() => {
          // Limpiar parámetros de URL después de procesar
          router.replace('/admin/users');
        });
      }
    }
  }, [searchParams, router]);

  // Cargar datos del usuario actual y permisos
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await getCurrentUserWithPermissions();
        if (userData) {
          setCurrentUser(userData.user);
          setUserPermissions(userData.permissions);

          // Verificar permisos
          if (!userData.permissions.canManageUsers) {
            toast({
              title: "Acceso denegado",
              description: "No tienes permisos para gestionar usuarios.",
              variant: "destructive",
            });
            router.push('/admin/dashboard');
            return;
          }
        } else {
          router.push('/');
        }
      } catch (error) {
        console.error('Error cargando datos del usuario:', error);
        router.push('/');
      }
    };

    loadUserData();
  }, [router, toast]);

  // Cargar usuarios desde Firestore
  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const usersCollection = collection(getFirestoreClient(), 'users');
      const usersSnapshot = await getDocs(query(usersCollection, orderBy('fullName', 'asc')));
      const usersData = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        let createdAtDate = new Date();

        // Manejo seguro de timestamps
        if (data.createdAt) {
          if (typeof data.createdAt.toDate === 'function') {
            // Es un timestamp de Firestore
            createdAtDate = data.createdAt.toDate();
          } else if (data.createdAt instanceof Date) {
            // Ya es un objeto Date
            createdAtDate = data.createdAt;
          } else if (typeof data.createdAt === 'string') {
            // Es un string, intentar parsear
            createdAtDate = new Date(data.createdAt);
          }
        }

        return {
          id: doc.id,
          ...data,
          createdAt: createdAtDate,
        };
      }) as User[];

      console.log('Usuarios cargados exitosamente:', usersData);
      setUsers(usersData);

      // Cargar últimas visitas
      try {
        const correosMercaderistas = usersData
          .filter(user => user.role === 'Mercaderista')
          .map(user => user.email);

        if (correosMercaderistas.length > 0) {
          const visitas = await obtenerUltimasVisitasUsuarios(correosMercaderistas);
          setUltimasVisitas(visitas);
        }
      } catch (visitasError) {
        console.error('Error cargando últimas visitas:', visitasError);
        // No mostramos error aquí, las visitas son opcionales
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUser && userPermissions) {
      loadUsers();
    }
  }, [currentUser, userPermissions, loadUsers]);

  // Manejar cambios de región y sede en el formulario
  const handleRegionChange = (region: Region) => {
    const sedes = getSedesByRegion(region);
    setValue('sede', sedes[0]?.name || 'GRUPO DISBATTERY');
    setSelectedRegion(region);
  };

  const handleSedeChange = (sede: Sede) => {
    const cities = getCitiesBySede(sede);
    setAvailableCities(cities);
    setValue('city', '');
    setSelectedSede(sede);
  };

  useEffect(() => {
    if (watchedRegion) {
      handleRegionChange(watchedRegion);
    }
  }, [watchedRegion]);

  useEffect(() => {
    if (watchedSede) {
      handleSedeChange(watchedSede);
    }
  }, [watchedSede]);

  // Crear nuevo usuario
  const onSubmit: SubmitHandler<NewUserFormData> = async (data) => {
    try {
      if (!currentUser) {
        throw new Error('No hay usuario logueado');
      }

      // ✅ Usar la función centralizada de auth.ts
      const isAdminMasterUser = isUserAdminMaster(currentUser.email);

      // ✅ NUEVA LÓGICA: AdminMaster elige sede, Admin regular hereda
      let sedeHeredada, regionHeredada;

      if (isAdminMasterUser) {
        // AdminMaster puede crear usuarios de cualquier sede
        sedeHeredada = data.sede; // Del formulario
        regionHeredada = data.region; // Del formulario
        console.log('👑 AdminMaster creando usuario con sede elegida:', {
          adminLogueado: currentUser.fullName,
          sedeElegida: sedeHeredada,
          regionElegida: regionHeredada
        });
      } else {
        // Admin regular solo puede crear de su propia sede
        sedeHeredada = currentUser.sede || 'GRUPO DISBATTERY';
        regionHeredada = getRegionBySede(sedeHeredada);
        console.log('👤 Admin regular creando usuario con sede heredada:', {
          adminLogueado: currentUser.fullName,
          sedeAdmin: currentUser.sede,
          sedeHeredada,
          regionHeredada
        });
      }

      console.log('🔍 VERIFICANDO ADMINMASTER:', {
        currentUserEmail: currentUser.email,
        isAdminMasterDetected: isAdminMasterUser,
        expectedEmails: ADMIN_MASTER_EMAILS
      });

      if (isAdminMasterUser) {
        // ✅ ADMINMASTER: Crear directamente en Firebase Auth SIN EMAIL
        console.log('👑 AdminMaster detectado - creando usuario directamente SIN EMAIL DE APROBACIÓN');

        const userCredential = await createUserWithEmailAndPassword(getAuthClient(), data.email, data.password);
        const { uid } = userCredential.user;

        // Guardar datos adicionales en Firestore
        await setDoc(doc(getFirestoreClient(), 'users', uid), {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          role: data.role,
          region: regionHeredada,
          sede: sedeHeredada,
          city: data.city,
          createdAt: new Date(),
          createdBy: currentUser.email,
          status: 'active'
        });

        toast({
          title: "Usuario creado directamente",
          description: `Usuario ${data.fullName} creado exitosamente por AdminMaster. ¡LISTO PARA USAR!`,
        });

        resetForm();
        setIsDialogOpen(false);
        loadUsers();

      } else {
        // ✅ ADMINISTRADOR REGULAR: Crear en Firebase Auth pero con status pendiente
        console.log('👤 Administrador regular - creando usuario con status pendiente');

        // ✅ CREAR SIEMPRE EN FIREBASE AUTH (como sugiere el usuario)
        const userCredential = await createUserWithEmailAndPassword(getAuthClient(), data.email, data.password);
        const { uid } = userCredential.user;
        console.log('✅ Usuario creado en Firebase Auth:', uid);

        // Guardar en colección "users" con status pending_approval
        const userData = {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          role: data.role,
          region: regionHeredada,
          sede: sedeHeredada,
          city: data.city,
          createdAt: new Date(),
          createdBy: currentUser.email,
          status: 'pending_approval', // ✅ Estado pendiente - se controla en LOGIN
          approvedAt: null,
          approvedBy: null
        };

        // Verificar si estamos offline y usar offlineManager
        if (typeof window !== 'undefined' && !navigator.onLine) {
          console.log('🔄 Modo Offline: Guardando usuario con offlineManager...');
          
          const userOfflineData = {
            tipoVisita: 'Admin - Gestión Usuario',
            accion: 'crear',
            userData: userData,
            userId: uid,
            timestamp: new Date().toISOString()
          };

          const saveResult = await offlineManager.saveVisita(userOfflineData);
          
          if (saveResult.success) {
            console.log('✅ Usuario guardado offline exitosamente:', saveResult.visitaId);
            
            toast({
              title: 'Usuario Guardado Offline',
              description: 'Los datos se sincronizarán automáticamente cuando haya conexión.',
            });

            resetForm();
            setIsDialogOpen(false);
          } else {
            throw new Error(saveResult.error || 'Error guardando usuario offline');
          }
        } else {
          // Modo online: operación normal
          await setDoc(doc(getFirestoreClient(), 'users', uid), userData);
          console.log('✅ Usuario guardado en Firestore con status pending_approval');

          // Enviar email de aprobación a AdminMaster
          const emailData = {
            usuario_nombre: data.fullName,
            usuario_email: data.email,
            usuario_rol: data.role,
            usuario_telefono: data.phone,
            usuario_ciudad: data.city,
            admin_creador: currentUser.fullName,
            fecha_solicitud: new Date().toLocaleDateString('es-VE'),
            sede: sedeHeredada,
            user_id: uid // ✅ Usar UID real de Firebase Auth
          };

          sendNuevoUsuarioAprobacionEmail(emailData).catch(error => {
            console.error('Error enviando email de aprobación:', error);
          });

          toast({
            title: "Usuario creado - Pendiente aprobación",
            description: `Usuario ${data.fullName} creado. Pendiente de aprobación por AdminMaster.`,
          });

          resetForm();
          setIsDialogOpen(false);
          loadUsers();
        }
      }

    } catch (error: any) {
      console.error('Error creando usuario:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el usuario.",
        variant: "destructive",
      });
    }
  };

  // Función helper para obtener región por sede
  const getRegionBySede = (sede: string): string => {
    const mapping: Record<string, string> = {
      'GRUPO DISBATTERY': 'Centro-capital',
      'BLITZ 2000': 'Centro-Los llanos',
      'GRUPO VICTORIA': 'Occidente',
      'DISBATTERY': 'Oriente'
    };
    return mapping[sede] || 'Centro-capital';
  };

  // Editar usuario
  const handleEditUser = (user: User) => {
    setUserToEdit(user);
    setEditForm({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      region: user.region,
      sede: user.sede,
      city: user.city
    });
    setEditDialogOpen(true);
  };

  const handleSaveEditUser = async () => {
    if (!userToEdit) return;

    try {
      const updateData = {
        ...editForm,
        updatedAt: new Date(),
      };

      // Verificar si estamos offline y usar offlineManager
      if (typeof window !== 'undefined' && !navigator.onLine) {
        console.log('🔄 Modo Offline: Actualizando usuario con offlineManager...');
        
        const userOfflineData = {
          tipoVisita: 'Admin - Gestión Usuario',
          accion: 'actualizar',
          userData: updateData,
          userId: userToEdit.id,
          timestamp: new Date().toISOString()
        };

        const saveResult = await offlineManager.saveVisita(userOfflineData);
        
        if (saveResult.success) {
          console.log('✅ Usuario actualizado offline exitosamente:', saveResult.visitaId);
          
          toast({
            title: 'Usuario Actualizado Offline',
            description: 'Los cambios se sincronizarán automáticamente cuando haya conexión.',
          });

          setEditDialogOpen(false);
          setUserToEdit(null);
        } else {
          throw new Error(saveResult.error || 'Error actualizando usuario offline');
        }
      } else {
        // Modo online: operación normal
        await setDoc(doc(getFirestoreClient(), 'users', userToEdit.id), updateData, { merge: true });

        toast({
          title: "Usuario actualizado",
          description: `Usuario ${editForm.fullName} actualizado exitosamente.`,
        });

        setEditDialogOpen(false);
        setUserToEdit(null);
        loadUsers();
      }
    } catch (error: any) {
      console.error('Error actualizando usuario:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el usuario.",
        variant: "destructive",
      });
    }
  };

  // Eliminar usuario
  const handleDeleteUser = async (user: User) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar al usuario ${user.fullName}?`)) {
      return;
    }

    // Verificar permisos
    if (currentUser && !userPermissions?.isAdminMaster && !canAccessSede(currentUser, user.sede as Sede)) {
      toast({
        title: "Acceso denegado",
        description: "No tienes permisos para eliminar usuarios de esta sede.",
        variant: "destructive",
      });
      return;
    }

    if (isUserAdminMaster(user.email)) {
      toast({
        title: "Acción no permitida",
        description: "No se puede eliminar al administrador master.",
        variant: "destructive",
      });
      return;
    }

    try {
      await deleteDoc(doc(getFirestoreClient(), 'users', user.id));
      toast({
        title: "Usuario eliminado",
        description: `Usuario ${user.fullName} eliminado exitosamente.`,
      });
      loadUsers();
    } catch (error: any) {
      console.error('Error eliminando usuario:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el usuario.",
        variant: "destructive",
      });
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Función para formatear última visita
  const formatLastVisit = (timestamp?: any) => {
    if (!timestamp) return 'Sin visitas';

    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('es-VE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  const getRoleColor = (role: 'Mercaderista' | 'Administrador' | 'Supervisor') => {
    switch (role) {
      case 'Administrador':
        return 'bg-blue-100 text-blue-800';
      case 'Supervisor':
        return 'bg-purple-100 text-purple-800';
      case 'Mercaderista':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // ✅ Función para obtener color del status de cuenta
  const getStatusColor = (status?: 'active' | 'pending_approval' | 'rejected') => {
    const userStatus = status || 'active'; // Usuarios viejos sin status = activos
    switch (userStatus) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // ✅ Función para obtener texto del status
  const getStatusText = (status?: 'active' | 'pending_approval' | 'rejected') => {
    const userStatus = status || 'active'; // Usuarios viejos sin status = activos
    switch (userStatus) {
      case 'active':
        return 'Activa';
      case 'pending_approval':
        return 'Pendiente';
      case 'rejected':
        return 'Rechazada';
      default:
        return 'Activa';
    }
  };

  // Filtrar usuarios
  const filteredUsers = users.filter(user => {
    // Filtro por permisos de sede
    if (currentUser && !userPermissions?.isAdminMaster && !canAccessSede(currentUser, user.sede)) {
      return false;
    }

    const matchesSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'todos' || user.role === filterRole;
    const matchesRegion = filterRegion === 'todos' || user.region === filterRegion;

    return matchesSearch && matchesRole && matchesRegion;
  });

  if (currentUser?.role === 'Supervisor') {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
        <Card className="shadow-xl bg-white/90 backdrop-blur-sm">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-2xl font-bold">Acceso restringido</CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Los supervisores solo pueden gestionar rutas y monitorear mercaderistas. No tienen acceso a la gestión de usuarios.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Bar */}
      <header className="flex flex-col sm:flex-row h-16 flex-shrink-0 fixed top-0 w-full z-50">
        <div style={{ backgroundColor: '#b61817' }} className="w-full sm:w-1/3 flex items-center justify-between sm:justify-start py-3 px-6 sm:px-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.back()}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-red-700/50 p-2 rounded-md"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            {/* Desktop User Info */}
            <div className="hidden sm:flex items-center text-white p-2 rounded-md">
              <UserCircle className="w-10 h-10 mr-3" />
              <div className="text-left flex-1">
                <div className="text-xl font-semibold">{currentUser?.fullName || 'Usuario'}</div>
                <div className="text-sm opacity-75">
                  {userPermissions?.isAdminMaster ? 'Admin Master' :
                    `${currentUser?.role} - ${currentUser?.sede}`}
                </div>
              </div>
              <LogoutButton className="ml-3 bg-red-800 hover:bg-red-900 text-white border-0 px-3 py-1 text-sm" />
            </div>
            {/* Mobile Title */}
            <h1 className="sm:hidden text-xl font-semibold text-white">Gestión de Usuarios</h1>
          </div>
          {/* Mobile Hamburger Button */}
          <div className="sm:hidden">
            <Button
              onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-red-700/50 p-2 rounded-md"
            >
              <Menu className="w-6 h-6" />
            </Button>
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

      {/* Collapsible Mobile Menu */}
      {isMobileMenuOpen && (
        <div
          className="sm:hidden fixed top-16 left-0 w-full bg-red-800/95 backdrop-blur-sm z-40 p-4 text-white animate-in slide-in-from-top-4 duration-300"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="flex items-center p-2 rounded-md mb-4">
            <UserCircle className="w-10 h-10 mr-3 flex-shrink-0" />
            <div className="text-left flex-1 overflow-hidden">
              <div className="text-xl font-semibold truncate">{currentUser?.fullName || 'Usuario'}</div>
              <div className="text-sm opacity-75 truncate">
                {userPermissions?.isAdminMaster ? 'Admin Master' :
                  `${currentUser?.role} - ${currentUser?.sede}`}
              </div>
            </div>
          </div>
          <LogoutButton className="w-full bg-red-700 hover:bg-red-800 text-white" />
        </div>
      )}

      {/* Main Content */}
      <main style={{ backgroundColor: '#a51717' }} className="flex-grow pt-24">
        <div className="container mx-auto py-8 px-2 sm:px-4 md:px-6 lg:px-8">
          <Card className="shadow-xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="border-b pb-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center">
                    <Users className="mr-3 h-7 w-7" />
                    Gestión de Usuarios
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-500">
                    Administra las cuentas de los usuarios y sus roles en el sistema.
                  </CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2 w-full md:w-auto" disabled={!userPermissions?.canManageUsers}>
                      <PlusCircle className="h-5 w-5" />
                      Crear Nuevo Usuario
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Crear Nuevo Usuario</DialogTitle>
                      <DialogDescription>
                        Complete los campos para registrar un nuevo usuario en el sistema.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-2">
                      <div>
                        <Label htmlFor="fullName">Nombre Completo</Label>
                        <Input
                          id="fullName"
                          {...register('fullName')}
                          placeholder="Ej: Juan Pérez"
                          className="mt-1"
                        />
                        {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName.message}</p>}
                      </div>

                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          {...register('email')}
                          placeholder="usuario@dominio.com"
                          className="mt-1"
                        />
                        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                      </div>

                      <div>
                        <Label htmlFor="password">Contraseña</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            {...register('password')}
                            placeholder="Mínimo 6 caracteres"
                            className="mt-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 transform mt-0.5"
                            onClick={togglePasswordVisibility}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
                      </div>

                      <div>
                        <Label htmlFor="role">Rol</Label>
                        <Controller
                          name="role"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger className="w-full mt-1">
                                <SelectValue placeholder="Seleccionar un rol" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Mercaderista">Mercaderista</SelectItem>
                                <SelectItem value="Administrador">Administrador</SelectItem>
                                <SelectItem value="Supervisor">Supervisor</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role.message}</p>}
                      </div>

                      {/* ✅ Campos de Región y Sede SOLO para AdminMaster */}
                      {isCurrentUserAdminMaster ? (
                        <>
                          <div>
                            <Label htmlFor="region">Región</Label>
                            <Controller
                              name="region"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={(value) => {
                                  field.onChange(value);
                                  handleRegionChange(value as Region);
                                }} defaultValue={field.value}>
                                  <SelectTrigger className="w-full mt-1">
                                    <SelectValue placeholder="Seleccionar región" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Centro-capital">Centro-capital</SelectItem>
                                    <SelectItem value="Centro-Los llanos">Centro-Los llanos</SelectItem>
                                    <SelectItem value="Occidente">Occidente</SelectItem>
                                    <SelectItem value="Oriente">Oriente</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            {errors.region && <p className="text-xs text-red-500 mt-1">{errors.region.message}</p>}
                          </div>

                          <div>
                            <Label htmlFor="sede">Sede</Label>
                            <Controller
                              name="sede"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={(value) => {
                                  field.onChange(value);
                                  handleSedeChange(value as Sede);
                                }} defaultValue={field.value}>
                                  <SelectTrigger className="w-full mt-1">
                                    <SelectValue placeholder="Seleccionar sede" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="GRUPO DISBATTERY">GRUPO DISBATTERY</SelectItem>
                                    <SelectItem value="BLITZ 2000">BLITZ 2000</SelectItem>
                                    <SelectItem value="GRUPO VICTORIA">GRUPO VICTORIA</SelectItem>
                                    <SelectItem value="DISBATTERY">DISBATTERY</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            {errors.sede && <p className="text-xs text-red-500 mt-1">{errors.sede.message}</p>}
                          </div>
                        </>
                      ) : (
                        /* Información automática de sede y región para Admin regulares */
                        <div className="col-span-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <p className="text-sm font-medium text-blue-900">Sede y Región asignadas automáticamente</p>
                          </div>
                          <p className="text-xs text-blue-700 mt-1">
                            <strong>Sede:</strong> {currentUser?.sede || 'GRUPO DISBATTERY'} •
                            <strong> Región:</strong> {getRegionBySede(currentUser?.sede || 'GRUPO DISBATTERY')}
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            El usuario heredará automáticamente la misma sede y región que tienes asignada como administrador.
                          </p>
                        </div>
                      )}

                      <div>
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input
                          id="phone"
                          {...register('phone')}
                          placeholder="+58 412-123-4567"
                          className="mt-1"
                        />
                        {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
                      </div>

                      <div>
                        <Label htmlFor="city">Ciudad</Label>
                        <Controller
                          name="city"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger className="w-full mt-1">
                                <SelectValue placeholder="Seleccionar ciudad" />
                              </SelectTrigger>
                              <SelectContent className="max-h-48 overflow-y-auto">
                                {(isCurrentUserAdminMaster ? availableCities : getCitiesBySede(currentUser?.sede as Sede || 'GRUPO DISBATTERY' as Sede)).map((city) => (
                                  <SelectItem key={city} value={city}>
                                    {city}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city.message}</p>}
                      </div>

                      <div className="flex justify-end space-x-2 pt-4 border-t sticky bottom-0 bg-white">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsDialogOpen(false)}
                          disabled={isSubmitting}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {isSubmitting ? 'Creando...' : 'Crear Usuario'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Filtros */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <Label htmlFor="search">Buscar Usuario</Label>
                  <Input
                    id="search"
                    placeholder="Buscar por nombre o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="filterRole">Filtrar por Rol</Label>
                  <Select value={filterRole} onValueChange={(value: typeof filterRole) => setFilterRole(value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los roles</SelectItem>
                      <SelectItem value="Mercaderista">Mercaderista</SelectItem>
                      <SelectItem value="Administrador">Administrador</SelectItem>
                      <SelectItem value="Supervisor">Supervisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="filterRegion">Filtrar por Región</Label>
                  <Select value={filterRegion} onValueChange={(value: typeof filterRegion) => setFilterRegion(value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas las regiones</SelectItem>
                      <SelectItem value="Centro-capital">Centro-capital</SelectItem>
                      <SelectItem value="Centro-Los llanos">Centro-Los llanos</SelectItem>
                      <SelectItem value="Occidente">Occidente</SelectItem>
                      <SelectItem value="Oriente">Oriente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tabla de usuarios */}
              {isLoadingUsers ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Cargando usuarios...</span>
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow>
                        <TableHead>Nombre Completo</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Status de Cuenta</TableHead>
                        <TableHead>Región</TableHead>
                        <TableHead>Ciudad</TableHead>
                        <TableHead>Última Visita</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                            No se encontraron usuarios que coincidan con los filtros
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium whitespace-nowrap">{user.fullName}</TableCell>
                            <TableCell className="whitespace-nowrap">{user.email}</TableCell>
                            <TableCell className="whitespace-nowrap">{user.phone || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge className={getRoleColor(user.role)}>
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor((user as any).status)}>
                                {getStatusText((user as any).status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{user.region || 'N/A'}</TableCell>
                            <TableCell className="whitespace-nowrap">{user.city || 'N/A'}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              <span className="text-sm text-gray-600">
                                {formatLastVisit(ultimasVisitas[user.email]?.marcaTemporal)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditUser(user)}
                                  disabled={
                                    (currentUser && !userPermissions?.isAdminMaster && !canAccessSede(currentUser, user.sede as Sede)) ||
                                    isUserAdminMaster(user.email)
                                  }
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteUser(user)}
                                  className="text-red-600 hover:text-red-700"
                                  disabled={
                                    (currentUser && !userPermissions?.isAdminMaster && !canAccessSede(currentUser, user.sede as Sede)) ||
                                    isUserAdminMaster(user.email)
                                  }
                                >
                                  <Trash2 className="w-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
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

      {/* Dialog de edición */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Modifica la información del usuario. Los cambios se guardarán en Firestore.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-2">
            <div>
              <Label htmlFor="editFullName">Nombre Completo</Label>
              <Input
                id="editFullName"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                disabled
                className="bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">El email no se puede modificar</p>
            </div>

            <div>
              <Label htmlFor="editPhone">Teléfono</Label>
              <Input
                id="editPhone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="editRole">Rol</Label>
              <Select
                value={editForm.role}
                onValueChange={(value: 'Mercaderista' | 'Administrador' | 'Supervisor') => setEditForm({ ...editForm, role: value })}
                disabled={userToEdit ? isUserAdminMaster(userToEdit.email) : false}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mercaderista">Mercaderista</SelectItem>
                  <SelectItem value="Administrador">Administrador</SelectItem>
                  <SelectItem value="Supervisor">Supervisor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="editRegion">Región</Label>
              <Select
                value={editForm.region}
                onValueChange={(value: Region) => {
                  const sedesDisponibles = getSedesByRegion(value);
                  setEditForm({
                    ...editForm,
                    region: value,
                    sede: sedesDisponibles[0]?.name || 'GRUPO DISBATTERY',
                    city: ''
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Centro-capital">Centro-capital</SelectItem>
                  <SelectItem value="Centro-Los llanos">Centro-Los llanos</SelectItem>
                  <SelectItem value="Occidente">Occidente</SelectItem>
                  <SelectItem value="Oriente">Oriente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="editSede">Sede</Label>
              <Select
                value={editForm.sede}
                onValueChange={(value: Sede) => setEditForm({ ...editForm, sede: value, city: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(editForm.region ? getSedesByRegion(editForm.region as Region) : [])
                    .filter(sede => !userPermissions || userPermissions.canAccessAllSedes || userPermissions.allowedSedes.includes(sede.name))
                    .map((sede) => (
                      <SelectItem key={sede.name} value={sede.name}>
                        {sede.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="editCity">Ciudad</Label>
              <Select
                value={editForm.city}
                onValueChange={(value: string) => setEditForm({ ...editForm, city: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48 overflow-y-auto">
                  {(editForm.sede ? getCitiesBySede(editForm.sede as Sede) : []).map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-white">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEditUser}>
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componente principal con Suspense wrapper
export default function UserManagementPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando...</div>}>
      <UserManagementPageContent />
    </Suspense>
  );
}

