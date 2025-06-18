
'use client';

import {useRouter}from 'next/navigation';
import {useEffect, useState}from 'react';

import {Button}from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {Input}from '@/components/ui/input';
import {Label}from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/firebase/clientApp';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Eye, EyeOff } from 'lucide-react'; 

const ADMIN_EMAILS = ['dsalcedo@smartautomatai.com', 'admin@example.com']; 

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); 

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleLogin = async () => {
    setIsLoading(true);
    console.log(`Login attempt with username (email): ${username}`);

    if (!username || !password) {
      toast({
        variant: 'destructive',
        title: 'Campos Incompletos',
        description: 'Por favor, ingrese su usuario y contraseña.',
      });
      setIsLoading(false);
      return;
    }

    if (username.toLowerCase() === 'admin' && password === 'admin') {
      console.log('Admin login attempt successful (local bypass). Setting isAdminLoggedIn.');
      if (typeof window !== 'undefined') {
        localStorage.setItem('isAdminLoggedIn', 'true');
        localStorage.removeItem('merchandiserLoggedIn');
      }
      router.push('/admin/dashboard');
      return; 
    }

    try {
      console.log('Preparing for Firebase login...');
      
      console.log(`Attempting Firebase sign-in with email: ${username}`);
      const userCredential = await signInWithEmailAndPassword(auth, username, password);
      console.log('Firebase sign-in successful! User UID:', userCredential.user.uid);
      
      const userEmail = userCredential.user.email;

      if (userEmail && ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
        toast({
          title: 'Inicio de Sesión de Administrador Exitoso',
          description: 'Bienvenido administrador.',
        });
        if (typeof window !== 'undefined') {
          localStorage.setItem('isAdminLoggedIn', 'true'); 
          localStorage.removeItem('merchandiserLoggedIn'); 
        }
        console.log('Admin user detected. Attempting to redirect to /admin/dashboard...');
        router.push('/admin/dashboard');
        console.log('Redirection to /admin/dashboard initiated for admin user.');
      } else {
        toast({
          title: 'Inicio de Sesión Exitoso',
          description: 'Bienvenido mercaderista.',
        });
        if (typeof window !== 'undefined') {
          localStorage.setItem('merchandiserLoggedIn', 'true'); 
          localStorage.removeItem('isAdminLoggedIn'); 
        }
        console.log('Merchandiser user detected. Attempting to redirect to /visit-capture...');
        router.push('/visit-capture');
        console.log('Redirection to /visit-capture initiated for merchandiser.');
      }
    } catch (error: any) {
      console.error('Firebase Auth Login Error:', error);
      console.log(`Failed Firebase sign-in attempt with email: ${username}. Error code: ${error.code}, message: ${error.message}`);
      let errorMessage = 'Error al iniciar sesión. Verifique sus credenciales.';
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = 'Usuario o contraseña incorrectos.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'El formato del correo electrónico (usuario) no es válido.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'Esta cuenta de usuario ha sido deshabilitada.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Error de red. Por favor, revise su conexión e intente de nuevo.';
            break;
          default:
            errorMessage = `Error: ${error.message} (Código: ${error.code || 'desconocido'})`;
        }
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      toast({
        variant: 'destructive',
        title: 'Error de Inicio de Sesión',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header Bar */}
      <header className="flex items-center h-14 shadow-md"> {/* Reduced height */}
        <div className="w-1/3 h-full bg-red-600"></div> {/* Adjusted width */}
        <div className="w-2/3 h-full bg-gray-200 flex items-center justify-end pr-6"> {/* Adjusted width and padding */}
          <img
            src="https://storage.googleapis.com/iandai/imagenes/disbatterylogo.png" 
            alt="Disbattery Logo Header"
            className="max-h-6"
            data-ai-hint="company logo"
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm shadow-xl bg-white">
          <CardHeader className="flex flex-col items-center pt-8 pb-4">
            <img
              src="https://storage.googleapis.com/iandai/imagenes/disbatterylogo.png"
              alt="Disbattery Lubricantes Logo"
              className="mb-6 max-h-10" 
              data-ai-hint="company logo"
            />
            <h1 
              className="text-2xl font-bold" 
              style={{
                backgroundImage: 'linear-gradient(to right, hsl(var(--primary-gradient-start)), hsl(var(--primary-gradient-end)))',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                textShadow: '1px 1px 2px rgba(0,0,0,0.2)',
              }}
            > 
              Disbattery Mercaderista
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              por favor inicie sesión para continuar
            </p>
          </CardHeader>
          <CardContent className="space-y-6 px-6 pb-8">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-700">Usuario</Label>
              <Input
                id="username"
                placeholder="Ingrese su usuario"
                value={username}
                onChange={e => setUsername(e.target.value)}
                type="email"
                autoComplete="email"
                className="rounded-md border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="rounded-md border-gray-300 pr-10" 
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 transform text-gray-500 hover:text-gray-700"
                  onClick={togglePasswordVisibility}
                  tabIndex={-1} 
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">{showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</span>
                </Button>
              </div>
            </div>
            <Button 
              onClick={handleLogin} 
              className="w-full !mt-8 shadow-md text-white font-semibold py-3 rounded-md" 
              disabled={isLoading}
              style={{background: 'linear-gradient(to bottom, hsl(var(--primary-gradient-start)), hsl(var(--primary-gradient-end)))'}}
            >
              {isLoading ? 'Iniciando...' : 'Iniciar Sesión'}
            </Button>
          </CardContent>
        </Card>
      </main>

      {/* Footer Bar */}
      <footer className="flex items-center h-14">
        <div 
          className="w-1/5 h-full flex items-center justify-end pr-4" 
          style={{background: 'linear-gradient(to right, hsl(210, 100%, 15%), hsl(210, 100%, 25%))'}}
        >
        </div>
        <div 
          className="w-1/5 h-full flex items-center justify-end pr-4" 
          style={{backgroundColor: '#e30a18'}}
        >
          {/* Qualid Logo Removed */}
        </div>
        <div 
          className="w-3/5 h-full flex items-center justify-end pr-4" 
          style={{background: 'linear-gradient(to right, hsl(45, 95%, 45%), hsl(45, 95%, 55%))'}}
        >
           <img
              src="https://storage.googleapis.com/iandai/imagenes/shell.png" 
              alt="Shell Logo"
              className="max-h-20"
              data-ai-hint="shell logo"
            />
        </div>
      </footer>
    </div>
  );
}

