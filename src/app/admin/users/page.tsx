
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusCircle, Users, Edit3, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/firebase/clientApp'; 
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, getDocs, doc, deleteDoc, query, orderBy, setDoc, getDoc } from 'firebase/firestore';

const newUserSchema = z.object({
  fullName: z.string().min(3, { message: 'El nombre completo es requerido (mínimo 3 caracteres).' }),
  email: z.string().email({ message: 'Por favor, ingrese un email válido.' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
  role: z.enum(['Mercaderista', 'Administrador'], { required_error: 'Por favor, seleccione un rol.' }),
});

type NewUserFormData = z.infer<typeof newUserSchema>;

interface User {
  id: string; // Firebase UID, also Firestore document ID
  fullName: string;
  email: string;
  role: 'Mercaderista' | 'Administrador';
}

export default function UserManagementPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]); 
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const usersCollectionRef = collection(db, 'users');
      const q = query(usersCollectionRef, orderBy('fullName', 'asc')); // Order by name
      const querySnapshot = await getDocs(q);
      const fetchedUsers: User[] = [];
      querySnapshot.forEach((doc) => {
        // doc.data() is never undefined for query doc snapshots
        const data = doc.data();
        fetchedUsers.push({ 
          id: doc.id, // This is the Firebase UID
          fullName: data.fullName, 
          email: data.email, 
          role: data.role 
        });
      });
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users from Firestore: ", error);
      toast({
        variant: 'destructive',
        title: 'Error al Cargar Usuarios',
        description: 'No se pudieron cargar los usuarios. Verifique la consola del navegador para más detalles y asegúrese de que Firestore esté configurado correctamente en su proyecto de Firebase (API Key, reglas de seguridad).',
      });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [toast]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAdmin = localStorage.getItem('isAdminLoggedIn');
      if (isAdmin !== 'true') {
        router.push('/');
      } else {
        fetchUsers();
      }
    }
  }, [router, fetchUsers]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    control,
  } = useForm<NewUserFormData>({
    resolver: zodResolver(newUserSchema),
  });

  const onSubmit: SubmitHandler<NewUserFormData> = async (data) => {
    console.log('Attempting to create user with data:', data);
    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      console.log('User created successfully in Firebase Auth:', user);
      
      // 2. Store user information in Firestore, using UID as document ID
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        fullName: data.fullName,
        email: data.email,
        role: data.role,
        createdAt: new Date().toISOString(), // Optional: store creation date
      });
      console.log('User data stored in Firestore with ID:', user.uid);

      toast({
        title: 'Usuario Creado Exitosamente',
        description: `El usuario ${data.fullName} (${data.email}) ha sido creado y guardado.`,
      });
      
      await fetchUsers(); // Refresh the user list from Firestore
      reset();
      setIsDialogOpen(false);
      setShowPassword(false);
    } catch (error: any) {
      console.error('Firebase Auth Error - Code:', error.code, 'Message:', error.message, 'Full error object:', error);
      let errorMessage = 'Ocurrió un error desconocido al intentar crear el usuario.';
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'Este correo electrónico ya está en uso en Firebase Authentication. Por favor, intente con otro.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'El formato del correo electrónico no es válido.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'La creación de usuarios por correo y contraseña no está habilitada. Por favor, revise la configuración de Firebase Authentication en la consola (Sign-in method).';
            break;
          case 'auth/weak-password':
            errorMessage = 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Error de red al intentar conectar con Firebase. Verifique su conexión a internet.';
            break;
          default:
            errorMessage = `Error inesperado de Firebase: ${error.message} (Código: ${error.code})`;
        }
      } else if (error.message) {
         errorMessage = error.message;
      }
      toast({
        variant: 'destructive',
        title: 'Error al Crear Usuario',
        description: errorMessage,
      });
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string | undefined) => {
    if (!userEmail) {
        toast({ variant: "destructive", title: "Error", description: "No se pudo obtener el email del usuario para eliminar." });
        return;
    }
    console.log('Attempting to delete user from Firestore:', userId);
    try {
      const userDocRef = doc(db, 'users', userId);
      await deleteDoc(userDocRef);
      
      toast({
        title: 'Usuario Eliminado de la Lista',
        description: `El usuario ha sido eliminado de la lista de Firestore. La eliminación real de Firebase Authentication y el borrado de datos asociados (custom claims) requieren Firebase Functions para mayor seguridad y control.`,
      });
      await fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error deleting user from Firestore:', error);
      toast({
        variant: 'destructive',
        title: 'Error al Eliminar Usuario',
        description: 'No se pudo eliminar el usuario de Firestore.',
      });
    }
  };

  const handleEditUser = (userId: string) => {
    const userToEdit = users.find(user => user.id === userId);
    // For now, editing is complex due to Firebase Auth limitations on client-side for email/password
    // and custom claims needing Firebase Functions.
    // We could allow editing fullName and the local 'role' in Firestore.
    toast({
      title: 'Editar Usuario (Simulación)',
      description: `Funcionalidad para editar a ${userToEdit?.fullName} no implementada completamente. La edición de detalles del usuario en Firebase Auth (email, contraseña) o roles (custom claims) generalmente se maneja a través de Firebase Functions.`,
    });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <Card className="shadow-xl bg-white/90 backdrop-blur-sm">
        <CardHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center"
                style={{
                  backgroundImage: 'linear-gradient(to right, hsl(var(--primary-gradient-start)), hsl(var(--primary-gradient-end)))',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.2)',
                }}
              >
                <Users className="mr-3 h-7 w-7" style={{ color: 'hsl(var(--primary-gradient-start))'}} />
                Gestión de Usuarios
              </CardTitle>
              <CardDescription className="text-sm text-gray-500">
                Administra las cuentas de los usuarios y sus roles en el sistema. Los usuarios se listan desde Firestore.
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { reset(); setShowPassword(false); } }}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5" />
                  Crear Nuevo Usuario
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle className="text-xl">Crear Nuevo Usuario</DialogTitle>
                  <DialogDescription>
                    Complete los campos para registrar un nuevo usuario en el sistema. Se creará en Firebase Auth y se guardará en Firestore.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
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
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 transform mt-0.5 text-gray-500 hover:text-gray-700"
                        onClick={togglePasswordVisibility}
                        tabIndex={-1} 
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        <span className="sr-only">{showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</span>
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
                                <SelectTrigger id="role" className="w-full mt-1">
                                    <SelectValue placeholder="Seleccionar un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Mercaderista">Mercaderista</SelectItem>
                                    <SelectItem value="Administrador">Administrador</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role.message}</p>}
                  </div>
                  <DialogFooter className="mt-4">
                    <DialogClose asChild>
                       <Button type="button" variant="outline" onClick={() => { reset(); setIsDialogOpen(false); setShowPassword(false); }}>Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creando...
                        </>
                      ) : 'Crear Usuario'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoadingUsers ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Cargando usuarios...</p>
            </div>
          ) : users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre Completo</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.fullName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'Administrador' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Button variant="ghost" size="icon" className="text-blue-600 hover:text-blue-800" onClick={() => handleEditUser(user.id)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-800" onClick={() => handleDeleteUser(user.id, user.email)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay usuarios</h3>
              <p className="mt-1 text-sm text-gray-500">Crea un nuevo usuario para comenzar o revisa la configuración de Firestore si esperabas ver usuarios.</p>
            </div>
          )}
          <p className="mt-6 text-xs text-gray-500 text-center">
            Nota: La asignación de roles de Firebase (custom claims), la edición completa de usuarios (email/contraseña de Firebase Auth), y la eliminación real de usuarios de Firebase Authentication generalmente requieren configuración adicional y lógica de backend (Firebase Functions) por seguridad y permisos. Por ahora, estas funcionalidades son simuladas o limitadas a los datos en Firestore.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
    
