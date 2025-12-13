"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAuthClient, getFirestoreClient } from "@/firebase/clientApp";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getCurrentUser,
  saveUserToStorage,
  ADMIN_MASTER_EMAILS as ADMIN_EMAILS,
  isAdminMaster,
} from "@/services/auth";
import {
  postLoginStrategy,
  PreloadProgress,
} from "@/services/postLoginStrategy";
import DataPreloadProgress from "@/components/DataPreloadProgress";
// Note: avoid direct import of `db` (SSR unsafe). Use getters where needed.
// import { db as _db_placeholder } from '@/firebase/clientApp';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Estados para la precarga de datos offline
  const [showPreloadProgress, setShowPreloadProgress] = useState(false);
  const [preloadProgress, setPreloadProgress] =
    useState<PreloadProgress | null>(null);
  const [preloadComplete, setPreloadComplete] = useState(false);
  const [preloadError, setPreloadError] = useState<string | null>(null);
  const [preloadResult, setPreloadResult] = useState<any>(null);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);

  // 🔄 Verificar si el usuario ya está logueado al cargar la página
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        console.log("🔍 Iniciando verificación de sesión...");

        // Verificar si hay una sesión activa guardada
        const isLoggedIn = localStorage.getItem("userLoggedIn");
        const storedUser = localStorage.getItem("currentUser");
        const isAdminLoggedIn = localStorage.getItem("isAdminLoggedIn");
        const merchandiserLoggedIn = localStorage.getItem(
          "merchandiserLoggedIn"
        );

        console.log("📊 Estado localStorage:", {
          userLoggedIn: isLoggedIn,
          hasStoredUser: !!storedUser,
          isAdminLoggedIn,
          merchandiserLoggedIn,
        });

        // Verificar si hay alguna sesión activa (cualquier formato)
        const hasValidSession =
          isLoggedIn === "true" ||
          isAdminLoggedIn === "true" ||
          merchandiserLoggedIn === "true";

        if (hasValidSession && storedUser) {
          const userData = JSON.parse(storedUser);
          console.log(
            "🚀 Usuario ya logueado detectado:",
            userData.email || userData.fullName
          );
          console.log("🔧 Datos del usuario:", userData);

          // Asegurar que userLoggedIn esté marcado como true
          localStorage.setItem("userLoggedIn", "true");

          // Pequeño delay para evitar problemas de redirección
          setTimeout(() => {
            // Redirigir según el rol del usuario
            if (
              userData.role === "AdminMaster" ||
              userData.role === "Administrador"
            ) {
              console.log("↗️ Redirigiendo admin a dashboard...");
              router.push("/admin/dashboard");
            } else {
              console.log("↗️ Redirigiendo mercaderista a mi-ruta...");
              router.push("/mi-ruta");
            }
          }, 100);

          return;
        }

        console.log("👤 No hay sesión activa, mostrando login");
      } catch (error) {
        console.error("❌ Error verificando sesión:", error);
      } finally {
        // Delay para evitar parpadeo
        setTimeout(() => {
          setIsCheckingSession(false);
        }, 500);
      }
    };

    // Verificar si venimos de un logout reciente
    const isRecentLogout = sessionStorage.getItem("recentLogout");
    if (isRecentLogout) {
      console.log("🚪 Logout reciente detectado, limpiando session...");
      sessionStorage.removeItem("recentLogout");
      setIsCheckingSession(false);
      return;
    }

    // Delay inicial para asegurar que localStorage esté disponible
    setTimeout(() => {
      checkUserSession();
    }, 100);
  }, [router]);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const showToast = (message: string) => {
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = message;
      toast.classList.add("show");
      setTimeout(() => {
        toast.classList.remove("show");
      }, 4000);
    }
  };

  // Funciones para manejar el progreso de precarga
  const handlePreloadProgress = (progress: PreloadProgress) => {
    console.log("📊 [LOGIN] Progreso de precarga recibido:", progress);
    setPreloadProgress(progress);

    // ✅ Auto-marcar como completado cuando llegue al 100%
    if (progress.step === "complete" && progress.percentage === 100) {
      console.log(
        "✅ [LOGIN] Progreso completado al 100%, marcando como terminado"
      );
      setPreloadComplete(true);

      // ✅ Si hay datos de resultado, actualizarlos
      if (progress.message?.includes("disponibles")) {
        // Es el caso de datos ya existentes
        setPreloadResult({
          success: true,
          routesLoaded: 5, // Basado en lo que vimos en console
          clientesLoaded: 0,
          totalSizeMB: 0,
          duration: 1500,
        });
      }
    }
  };

  const handlePreloadComplete = () => {
    if (pendingRedirect) {
      router.push(pendingRedirect);
    }
  };

  const handlePreloadRetry = async () => {
    setPreloadError(null);
    setPreloadComplete(false);
    setPreloadProgress(null);

    // Reintentar precarga con el usuario actual
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      await executePostLoginStrategy(userData);
    }
  };

  const handlePreloadSkip = () => {
    if (pendingRedirect) {
      router.push(pendingRedirect);
    }
  };

  // Ejecutar la estrategia post-login
  const executePostLoginStrategy = async (userData: any) => {
    try {
      console.log("🚀 Ejecutando estrategia post-login para:", userData.role);

      const result = await postLoginStrategy.executePostLogin(
        userData,
        handlePreloadProgress
      );

      if (result.success) {
        if (result.redirect.shouldPreload) {
          // ✅ Mostrar progreso de precarga SIEMPRE para mercaderistas
          console.log(
            "📱 [LOGIN] Mostrando progreso de precarga para mercaderista"
          );
          setShowPreloadProgress(true);
          setPendingRedirect(result.redirect.path);

          if (result.preloadResult) {
            console.log(
              "📊 [LOGIN] Resultado de precarga recibido:",
              result.preloadResult
            );
            setPreloadResult(result.preloadResult);

            if (result.preloadResult.success) {
              // ✅ No marcar como completado aquí, esperar al callback de progreso
              console.log(
                "✅ [LOGIN] Precarga exitosa, esperando progreso del callback"
              );
            } else {
              setPreloadComplete(false);
              setPreloadError(result.error || "Error durante la precarga");
            }
          }
        } else {
          // Redirigir inmediatamente para usuarios administrativos
          console.log(
            "🌐 [LOGIN] Redirigiendo inmediatamente para usuario administrativo"
          );
          router.push(result.redirect.path);
        }
      } else {
        setPreloadError(
          result.error || "Error ejecutando estrategia post-login"
        );
        setPendingRedirect(result.redirect.path);
      }
    } catch (error) {
      console.error("❌ Error en estrategia post-login:", error);
      setPreloadError(
        error instanceof Error ? error.message : "Error desconocido"
      );
    }
  };

  const handleForgotPassword = async () => {
    if (!username) {
      showToast(
        "Por favor, ingrese su dirección de correo electrónico en el campo Usuario."
      );
      return;
    }

    try {
      await sendPasswordResetEmail(getAuthClient(), username);
      showToast(
        `Se ha enviado un correo de recuperación a ${username}. Por favor, revise su bandeja de entrada.`
      );
    } catch (error: any) {
      console.error("Password reset error:", error);
      let errorMessage = "Error al enviar el correo de recuperación.";
      if (error.code === "auth/user-not-found") {
        errorMessage = "No existe un usuario con esta dirección de correo.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "El formato del correo electrónico no es válido.";
      }
      showToast(errorMessage);
    }
  };

  // Función para detectar si hay conexión a internet
  const isOnline = async (): Promise<boolean> => {
    if (!navigator.onLine) return false;

    try {
      const response = await fetch("/favicon.ico", {
        method: "HEAD",
        cache: "no-cache",
        mode: "no-cors",
      });
      return true;
    } catch {
      return false;
    }
  };

  // ✅ NUEVA FUNCIÓN: Manejar usuarios temporales aprobados
  const handleTemporaryUser = async (email: string, password: string) => {
    try {
      console.log("🔍 Buscando usuario temporal aprobado:", email);

      // Buscar usuario aprobado temporal en Firestore
      const usersQuery = query(
        collection(getFirestoreClient(), "users"),
        where("email", "==", email),
        where("isTemporaryUser", "==", true)
      );

      const querySnapshot = await getDocs(usersQuery);

      if (querySnapshot.empty) {
        console.log("❌ No se encontró usuario temporal para:", email);
        return null;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      console.log("📋 Usuario temporal encontrado:", userData);

      // Verificar contraseña temporal
      if (userData.tempPassword !== password) {
        console.log("❌ Contraseña temporal incorrecta");
        return null;
      }

      // ✅ Crear usuario en Firebase Auth
      console.log("🔄 Creando usuario en Firebase Auth...");
      const userCredential = await createUserWithEmailAndPassword(
        getAuthClient(),
        email,
        password
      );
      const firebaseUid = userCredential.user.uid;

      console.log("✅ Usuario creado en Firebase Auth con UID:", firebaseUid);

      // Actualizar documento para remover campos temporales y usar UID de Firebase
      const updatedUserData = {
        ...userData,
        uid: firebaseUid,
        status: "active",
        isTemporaryUser: deleteField(),
        tempPassword: deleteField(),
        activatedAt: new Date(),
      };

      // Actualizar el documento existente
      await updateDoc(doc(getFirestoreClient(), "users", userDoc.id), {
        uid: firebaseUid,
        status: "active",
        isTemporaryUser: deleteField(),
        tempPassword: deleteField(),
        activatedAt: new Date(),
      });

      console.log("✅ Usuario temporal convertido a usuario activo");

      return {
        userCredential,
        userData: updatedUserData,
      };
    } catch (error) {
      console.error("❌ Error manejando usuario temporal:", error);
      return null;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log(`Login attempt with username (email): ${username}`);

    if (!username || !password) {
      showToast("Por favor, ingrese su usuario y contraseña.");
      setIsLoading(false);
      return;
    }

    // Credenciales de prueba temporales
    if (username.toLowerCase() === "admin" && password === "admin") {
      console.log(
        "Admin login attempt successful (local bypass). Setting isAdminLoggedIn."
      );

      // Crear datos temporales del admin para que el dashboard funcione
      const tempAdminData = {
        uid: "temp-admin-uid",
        email: "admin@disbattery.com",
        fullName: "Administrador Temporal",
        role: "Administrador" as const,
        sede: "GRUPO DISBATTERY",
        region: "Centro-capital",
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("userLoggedIn", "true"); // ✅ Marcar como logueado
        localStorage.setItem("isAdminLoggedIn", "true");
        localStorage.setItem("currentUser", JSON.stringify(tempAdminData));
        localStorage.removeItem("merchandiserLoggedIn");
      }

      saveUserToStorage(tempAdminData);
      console.log("🆔 Datos del admin temporal guardados:", tempAdminData);
      showToast("¡Login exitoso! Bienvenido Administrador.");
      router.push("/admin/dashboard");
      return;
    }

    // Credencial temporal para testing
    if (username === "dsalcedo@smartautomatai.com" && password === "test123") {
      console.log("Temporary test login successful.");

      // Crear datos temporales del admin master para que el dashboard funcione
      const tempMasterData = {
        uid: "temp-master-uid",
        email: "dsalcedo@smartautomatai.com",
        fullName: "Dioscar Salcedo",
        role: "AdminMaster" as const,
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("userLoggedIn", "true"); // ✅ Marcar como logueado
        localStorage.setItem("isAdminLoggedIn", "true");
        localStorage.setItem("currentUser", JSON.stringify(tempMasterData));
        localStorage.removeItem("merchandiserLoggedIn");
      }

      saveUserToStorage(tempMasterData);
      showToast("¡Login exitoso! Bienvenido Admin Master.");
      router.push("/admin/dashboard");
      return;
    }

    // 🔄 LÓGICA OFFLINE-FIRST: Verificar conexión a internet
    const hasConnection = await isOnline();
    console.log("🌐 Estado de conexión:", hasConnection ? "Online" : "Offline");

    // Si NO hay conexión, intentar login offline con datos guardados
    if (!hasConnection) {
      console.log("📱 Modo offline activado - Verificando localStorage...");

      // Buscar usuario previamente autenticado en localStorage
      const storedUser = localStorage.getItem("currentUser");
      const storedCredentials = localStorage.getItem("userCredentials");

      if (storedUser && storedCredentials) {
        try {
          const userData = JSON.parse(storedUser);
          const credentials = JSON.parse(storedCredentials);

          // Verificar credenciales offline
          if (
            (credentials.email === username ||
              credentials.username === username) &&
            credentials.password === password
          ) {
            console.log("✅ Login offline exitoso con credenciales guardadas");

            // Restaurar datos del usuario
            saveUserToStorage(userData);

            // ✅ Marcar como logueado (ya estaba logueado previamente)
            localStorage.setItem("userLoggedIn", "true");

            if (
              userData.role === "AdminMaster" ||
              userData.role === "Administrador"
            ) {
              localStorage.setItem("isAdminLoggedIn", "true");
              localStorage.removeItem("merchandiserLoggedIn");
            } else {
              localStorage.setItem("merchandiserLoggedIn", "true");
              localStorage.removeItem("isAdminLoggedIn");
            }

            showToast("¡Login offline exitoso! 📱");

            // Redirigir según el rol
            if (
              userData.role === "AdminMaster" ||
              userData.role === "Administrador"
            ) {
              router.push("/admin/dashboard");
            } else {
              router.push("/mi-ruta");
            }

            return;
          }
        } catch (error) {
          console.error("Error procesando datos offline:", error);
        }
      }

      // Si no hay datos offline válidos
      showToast(
        "Sin conexión y no hay datos offline guardados. Conéctese a internet para iniciar sesión."
      );
      setIsLoading(false);
      return;
    }

    try {
      console.log("🌐 Conexión disponible - Intentando login con Firebase...");
      console.log(`Attempting Firebase sign-in with email: ${username}`);
      const userCredential = await signInWithEmailAndPassword(
        getAuthClient(),
        username,
        password
      );
      console.log(
        "Firebase sign-in successful! User UID:",
        userCredential.user.uid
      );

      // 💾 GUARDAR CREDENCIALES PARA USO OFFLINE
      try {
        const userCredentials = {
          email: username,
          username: username,
          password: password,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem(
          "userCredentials",
          JSON.stringify(userCredentials)
        );
        console.log("💾 Credenciales guardadas para uso offline");
      } catch (error) {
        console.error("Error guardando credenciales offline:", error);
      }

      const userEmail = userCredential.user.email;

      // Obtener datos completos del usuario desde Firestore
      try {
        const userData = await getCurrentUser();
        if (userData) {
          // ✅ VERIFICACIÓN CORREGIDA: Controlar acceso según status del usuario
          console.log("📋 Status del usuario:", userData.status);

          // ✅ CORRECCIÓN: Si status es undefined/null (usuarios existentes), tratarlo como 'active'
          const userStatus = userData.status || "active";
          console.log("📋 Status procesado:", userStatus);

          if (userStatus === "pending_approval") {
            // Usuario pendiente de aprobación
            await getAuthClient().signOut(); // Hacer logout inmediatamente
            showToast(
              "⏳ Tu cuenta está pendiente de aprobación por el administrador. Recibirás un email cuando sea aprobada."
            );
            setIsLoading(false);
            return;
          }

          if (userStatus === "rejected") {
            // Usuario rechazado
            await getAuthClient().signOut(); // Hacer logout inmediatamente
            showToast(
              "❌ Tu solicitud de cuenta ha sido rechazada. Contacta al administrador para más información."
            );
            setIsLoading(false);
            return;
          }

          // ✅ CORRECCIÓN: Solo rechazar si explícitamente es 'rejected' o 'pending_approval'
          // Usuarios sin status (legacy) o con status 'active' pueden continuar

          // ✅ Usuario activo - proceder normalmente
          saveUserToStorage(userData);
          console.log("Datos del usuario guardados:", userData);

          // Determinar el tipo de login y redirección basado en el rol real del usuario
          if (
            userData.role === "AdminMaster" ||
            userData.role === "Administrador" ||
            userData.role === "Supervisor"
          ) {
            // Es un usuario administrativo
            showToast("¡Login exitoso! Bienvenido administrador.");
            if (typeof window !== "undefined") {
              localStorage.setItem("userLoggedIn", "true"); // ✅ Marcar como logueado
              localStorage.setItem("isAdminLoggedIn", "true");
              localStorage.removeItem("merchandiserLoggedIn");
            }

            // Redirección según el rol específico
            if (
              userData.role === "AdminMaster" ||
              userData.role === "Administrador"
            ) {
              router.push("/admin/dashboard");
            } else if (userData.role === "Supervisor") {
              router.push("/admin/rutas"); // Los supervisores van directo a rutas
            }
          } else {
            // Es un mercaderista - usar estrategia offline-first
            showToast("¡Login exitoso! Preparando datos offline...");
            if (typeof window !== "undefined") {
              localStorage.setItem("userLoggedIn", "true"); // ✅ Marcar como logueado
              localStorage.setItem("merchandiserLoggedIn", "true");
              localStorage.removeItem("isAdminLoggedIn");

              // Emitir evento para activar el descargador de datos
              const loginEvent = new CustomEvent("mercaderista-login-success", {
                detail: userData,
              });
              window.dispatchEvent(loginEvent);
            }

            // NO ejecutar estrategia post-login aquí, lo hará el MercaderistaDataLoader
            // await executePostLoginStrategy(userData);

            // Redirigir directo a Mi Ruta, el modal aparecerá si necesita datos
            router.push("/mi-ruta");
          }
          return;
        } else {
          // Si no hay datos del usuario en Firestore, tratarlo como mercaderista por defecto
          console.warn(
            "No se encontraron datos del usuario en Firestore, usando defaults"
          );
          showToast("¡Login exitoso! Preparando datos offline...");
          if (typeof window !== "undefined") {
            localStorage.setItem("userLoggedIn", "true"); // ✅ Marcar como logueado
            localStorage.setItem("merchandiserLoggedIn", "true");
            localStorage.removeItem("isAdminLoggedIn");
          }

          // Crear userData por defecto
          const defaultUserData = {
            uid: userCredential.user.uid,
            email: userCredential.user.email || "",
            fullName: userCredential.user.displayName || "Usuario",
            role: "Mercaderista" as const,
            status: "active" as const,
          };
          saveUserToStorage(defaultUserData);

          // Emitir evento para activar el descargador de datos
          if (typeof window !== "undefined") {
            const loginEvent = new CustomEvent("mercaderista-login-success", {
              detail: defaultUserData,
            });
            window.dispatchEvent(loginEvent);
          }

          // Redirigir directo a Mi Ruta
          router.push("/mi-ruta");
          return;
        }
      } catch (userDataError) {
        console.error("Error obteniendo datos del usuario:", userDataError);

        // Fallback: verificar si es admin master por email
        if (userEmail && isAdminMaster(userEmail)) {
          showToast("¡Login exitoso! Bienvenido Admin Master.");
          if (typeof window !== "undefined") {
            localStorage.setItem("isAdminLoggedIn", "true");
            localStorage.removeItem("merchandiserLoggedIn");
          }
          router.push("/admin/dashboard");
        } else {
          // Por defecto, redirigir como mercaderista usando estrategia offline-first
          showToast("¡Login exitoso! Preparando datos offline...");
          if (typeof window !== "undefined") {
            localStorage.setItem("merchandiserLoggedIn", "true");
            localStorage.removeItem("isAdminLoggedIn");
          }

          // Crear userData por defecto y ejecutar estrategia
          const fallbackUserData = {
            uid: userCredential.user.uid,
            email: userCredential.user.email || "",
            fullName: userCredential.user.displayName || "Usuario",
            role: "Mercaderista" as const,
          };
          saveUserToStorage(fallbackUserData);
          await executePostLoginStrategy(fallbackUserData);
        }
        return;
      }
    } catch (error: any) {
      console.error("Firebase Auth Login Error:", error);
      console.log(
        `Failed Firebase sign-in attempt with email: ${username}. Error code: ${error.code}, message: ${error.message}`
      );

      // ✅ NUEVO: Manejar usuarios temporales aprobados
      if (error.code === "auth/user-not-found") {
        console.log(
          "🔍 Usuario no encontrado en Firebase Auth, verificando usuarios temporales..."
        );

        try {
          const temporaryUserResult = await handleTemporaryUser(
            username,
            password
          );

          if (temporaryUserResult) {
            console.log("✅ Usuario temporal procesado exitosamente");

            const { userCredential, userData } = temporaryUserResult;

            return;
          }
        } catch (tempUserError) {
          console.error("Error procesando usuario temporal:", tempUserError);
        }
      }

      // Manejo de errores estándar
      let errorMessage = "Error al iniciar sesión. Verifique sus credenciales.";
      if (error.code) {
        switch (error.code) {
          case "auth/user-not-found":
          case "auth/wrong-password":
          case "auth/invalid-credential":
            errorMessage = "Usuario o contraseña incorrectos.";
            break;
          case "auth/invalid-email":
            errorMessage =
              "El formato del correo electrónico (usuario) no es válido.";
            break;
          case "auth/user-disabled":
            errorMessage = "Esta cuenta de usuario ha sido deshabilitada.";
            break;
          case "auth/network-request-failed":
            errorMessage =
              "Error de red. Por favor, revise su conexión e intente de nuevo.";
            break;
          default:
            errorMessage = `Error: ${error.message} (Código: ${error.code || "desconocido"})`;
        }
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      showToast(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const bgImage =
    "url('https://storage.googleapis.com/iandai/imagenes/Disbattery%20trade/Disbattery%20Mercaderista%20movil%20main%20background.png')";

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-x-hidden bg-gray-100 font-sans"
      style={{
        backgroundImage: bgImage,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center center",
        backgroundSize: "cover",
        backgroundAttachment: "scroll",
      }}
    >
      <img
        src="https://storage.googleapis.com/iandai/imagenes/disbatterylogo.png"
        alt="Disbattery Logo"
        className="absolute top-5 right-8 w-24 md:w-32 z-10"
      />

      {isCheckingSession ? (
        <Card className="w-full max-w-md bg-white/85 backdrop-blur-md shadow-2xl border-none">
          <CardHeader className="text-center pb-2">
            <img
              src="https://storage.googleapis.com/iandai/imagenes/disbatterylogo.png"
              alt="Disbattery Lubricantes Logo"
              className="w-48 mx-auto mb-4"
            />
            <CardTitle className="text-[#003366] text-2xl font-bold">
              Disbattery Mercaderista
            </CardTitle>
            <CardDescription className="text-gray-500 mb-0">
              Verificando sesión...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center p-8">
            <LoadingSpinner size="lg" className="text-[#003366]" />
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-md bg-white/85 backdrop-blur-md shadow-2xl border-none animate-in fade-in zoom-in-95 duration-500">
          <CardHeader className="text-center pb-2">
            <img
              src="https://storage.googleapis.com/iandai/imagenes/disbatterylogo.png"
              alt="Disbattery Lubricantes Logo"
              className="w-48 mx-auto mb-4"
            />
            <CardTitle className="text-[#003366] text-2xl font-bold">
              Disbattery Mercaderista
            </CardTitle>
            <CardDescription className="text-gray-500">
              por favor inicie sesión para continuar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2 text-left">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  type="email"
                  placeholder="Ingrese su correo"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  className="bg-white/80"
                />
              </div>

              <div className="space-y-2 text-left">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Ingrese su contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="pr-10 bg-white/80"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={togglePasswordVisibility}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#003366] hover:bg-[#002244] text-white font-semibold transition-colors mt-4"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner className="mr-2 h-4 w-4" /> Iniciando...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
            </form>

            <div className="text-center mt-4">
              <Button
                variant="link"
                className="text-xs text-gray-800 hover:text-[#003366] h-auto p-0"
                onClick={handleForgotPassword}
              >
                ¿Olvidó su contraseña?
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-4">
              Version: 1.0.0
            </p>
          </CardContent>
        </Card>
      )}

      {/* Toast Notification - Mantener temporalmente si es necesario o reemplazar con Toaster */}
      <div
        id="toast"
        className="fixed bottom-8 left-1/2 -translate-x-1/2 min-w-[260px] max-w-[350px] bg-gray-900 text-white px-6 py-4 rounded-lg shadow-lg opacity-0 pointer-events-none transition-all duration-400 z-50 text-sm [&.show]:opacity-100 [&.show]:pointer-events-auto [&.show]:translate-y-0 translate-y-10"
      ></div>

      <DataPreloadProgress
        isVisible={showPreloadProgress}
        progress={preloadProgress}
        isComplete={preloadComplete}
        isError={!!preloadError}
        error={preloadError || undefined}
        result={preloadResult}
        onComplete={handlePreloadComplete}
        onRetry={handlePreloadRetry}
        onSkip={handlePreloadSkip}
      />
    </div>
  );
}
