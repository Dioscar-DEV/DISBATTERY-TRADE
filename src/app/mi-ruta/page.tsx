'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { format, isSameDay, startOfWeek, startOfMonth, subDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// Firebase
import { auth, db } from '@/firebase/clientApp';

// Services
import { getCurrentUserWithPermissions, UserData, UserPermissions } from '@/services/auth';
import { 
  listenToMercaderistaRoutes, 
  autoUpdateRouteStatus
} from '@/services/routes';
import { obtenerVisitas } from '@/services/visitas';
import { useAnalytics } from '@/hooks/useAnalytics';
import { offlineService } from '@/services/offlineService';
import { dualRouteLoader } from '@/services/dualRouteLoader';
import { offlineDataManager } from '@/services/offlineDataManager';
import { getGPSLocation } from '@/services/gpsService';

// Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogoutButton } from '@/components/LogoutButton';

// Icons
import {
  MapPin,
  UserCheck,
  Calendar,
  ArrowRight,
  Clock,
  Building,
  CheckCircle,
  XCircle,
  Target,
  Star,
  UserIcon,
  CalendarDays,
  Phone,
  Mail,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Navigation,
  MapIcon,
  Camera,
  DoorClosed,
  UserPlus
} from 'lucide-react';

// Types
import { Route, RoutePoint } from '@/types/routes';

// Helper functions
const getStatusColor = (status: Route['status']) => {
  switch (status) {
    case 'planificada':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'en_progreso':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'completada':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusText = (status: Route['status']) => {
  switch (status) {
    case 'planificada':
      return 'Planificada';
    case 'en_progreso':
      return 'En Progreso';
    case 'completada':
      return 'Completada';
    default:
      return status;
  }
};

// Interfaz para eventos independientes
interface EventoIndependiente {
  id: string;
  nombreEvento: string;
  mercaderistas: string[];
  mercaderistasIds: string[];
  fechaInicio: string;
  fechaFin: string;
  duracionDias: number;
  ubicacion: { lat: number; lng: number };
  direccion: string;
  descripcion?: string;
  tipoEvento: string;
  status: 'planificado' | 'en_progreso' | 'completado';
  marcaTrabajada?: string;
  createdAt?: Date;
  createdBy?: string;
}

// Interfaz para métricas del mercaderista
interface MercaderistaMetrics {
  visitasHoy: number;
  visitasSemana: number;
  visitasMes: number;
  clientesUnicos: number;
  promedioVisitasDiarias: number;
  rutasCompletadas: number;
  hasData: boolean; // Para verificar si hay datos disponibles
}

// Interfaz para el calendario de rutas
interface RutaCalendario {
  fecha: string;
  rutasCompletadas: number;
  visitasRealizadas: number;
  status: 'completada' | 'en_progreso' | 'planificada';
}

export default function MyRoutePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [todaysRoutes, setTodaysRoutes] = useState<Route[]>([]);
  const [todaysEvents, setTodaysEvents] = useState<EventoIndependiente[]>([]);
  const [metrics, setMetrics] = useState<MercaderistaMetrics | null>(null);
  const [selectedClient, setSelectedClient] = useState<RoutePoint | null>(null);
  const [historicalRoutes, setHistoricalRoutes] = useState<Route[]>([]);
  const [calendarData, setCalendarData] = useState<RutaCalendario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previousStatus, setPreviousStatus] = useState<Route['status'] | null>(null);
  // Botón de preparar offline removido: ahora la preparación es automática

  // Estados para manejo de ubicación GPS
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [currentPointForLocation, setCurrentPointForLocation] = useState<RoutePoint | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Estados para cliente cerrado
  const [isClienteSerradoDialogOpen, setIsClienteSerradoDialogOpen] = useState(false);
  const [currentPointForCerrado, setCurrentPointForCerrado] = useState<RoutePoint | null>(null);
  const [fotoCerrado, setFotoCerrado] = useState<string | null>(null);
  const [razonCerrado, setRazonCerrado] = useState('');
  const [comentariosCerrado, setComentariosCerrado] = useState('');

  // Estados para cliente prospecto
  const [isClienteProspectoDialogOpen, setIsClienteProspectoDialogOpen] = useState(false);
  const [nombreProspecto, setNombreProspecto] = useState('');
  const [direccionProspecto, setDireccionProspecto] = useState('');
  const [telefonoProspecto, setTelefonoProspecto] = useState('');
  const [tipoNegocioProspecto, setTipoNegocioProspecto] = useState('');
  const [fotoProspecto, setFotoProspecto] = useState<string | null>(null);
  const [comentariosProspecto, setComentariosProspecto] = useState('');

  const { toast } = useToast();
  const analytics = useAnalytics();


  useEffect(() => {
    // Escuchar cambios en la autenticación para obtener el usuario
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        // Cargar datos completos del usuario
        try {
          const result = await getCurrentUserWithPermissions();
          if (result) {
            setUserData(result.user);
            setUserPermissions(result.permissions);

            // Track user login with role information
            await analytics.updateUserData(currentUser.uid, {
              role: result.user.role,
              city: result.user.city
            });

            // Track route page view
            await analytics.trackPageView('mi_ruta', {
              user_role: result.user.role,
              city: result.user.city,
              sede: result.user.sede
            });
          }
        } catch (error) {
          console.error('Error cargando datos del usuario:', error);
          await analytics.trackUserError('user_data_load_error', error instanceof Error ? error.message : 'Unknown error', 'mi_ruta_auth');
        }
      } else {
        // Si no hay usuario, redirigir al login
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Función para cargar eventos del día actual donde el usuario es mercaderista
  // ✅ FUNCIÓN INTELIGENTE: Auto-completar ruta solo cuando hay visitas reales
  const checkAndAutoCompleteRoute = async (ruta: any, userId: string) => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // 1. Obtener visitas reales del día para este mercaderista
      const visitasReales = await obtenerVisitas({
        correoMercaderista: user?.email?.toLowerCase() || undefined,
      });
      const visitasDeHoy = visitasReales.filter((visita: any) => {
        const visitaDate = visita.createdAt instanceof Date ? 
          visita.createdAt : 
          (visita.createdAt as any)?.toDate ? (visita.createdAt as any).toDate() : new Date(visita.createdAt);

        return (
          format(visitaDate, 'yyyy-MM-dd') === today &&
          visita.direccionCorreo?.toLowerCase() === user?.email?.toLowerCase()
        );
      });

      console.log(`📊 Visitas reales encontradas hoy: ${visitasDeHoy.length}`);
      console.log(`📍 Puntos en la ruta: ${ruta.points.length}`);

      // 2. Verificar si hay suficientes visitas para auto-completar
      if (visitasDeHoy.length > 0) {
        // Obtener RIFs únicos visitados
        const rifsVisitados = new Set(visitasDeHoy.map((v: any) => v.rifCliente).filter(Boolean));
        const puntosConRif = ruta.points.filter((p: any) => p.rif && p.rif.trim() !== '');
        const puntosVisitados = puntosConRif.filter((p: any) => rifsVisitados.has(p.rif));

        console.log(`🎯 RIFs únicos visitados: ${rifsVisitados.size}`);
        console.log(`📋 Puntos con RIF en ruta: ${puntosConRif.length}`);
        console.log(`✅ Puntos realmente visitados: ${puntosVisitados.length}`);

        // 3. Auto-completar si se visitó al menos el 80% de los puntos con RIF, o si hay 2+ visitas
        const porcentajeVisitado = puntosConRif.length > 0 ? (puntosVisitados.length / puntosConRif.length) * 100 : 0;
        const deberiaAutoCompletar = porcentajeVisitado >= 80 || visitasDeHoy.length >= 2;

        console.log(`📊 Porcentaje visitado: ${porcentajeVisitado.toFixed(1)}%`);
        console.log(`🤔 ¿Debería auto-completar?: ${deberiaAutoCompletar}`);

        if (deberiaAutoCompletar) {
          console.log('🎉 AUTO-COMPLETANDO RUTA CON VISITAS REALES');

          const result = await autoUpdateRouteStatus(userId, today, 'complete');

          if (result.updated) {
            toast({
              title: '🎉 ¡Ruta completada automáticamente!',
              description: `${result.reason}. Registraste ${visitasDeHoy.length} visita${visitasDeHoy.length > 1 ? 's' : ''} hoy.`,
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Error en auto-completación inteligente:', error);
    }
  };

  const loadTodaysEvents = async () => {
    if (!user || !userData) {
      console.log('⚠️ No se puede cargar eventos: falta user o userData');
      return;
    }

    try {
      const todayString = format(new Date(), 'yyyy-MM-dd');
      console.log('🎪 Cargando eventos para:', userData.fullName);

      const eventosRef = collection(db, 'eventos');
      const querySnapshot = await getDocs(eventosRef);

      const eventosDelDia: EventoIndependiente[] = [];

      querySnapshot.forEach(doc => {
        const data = doc.data();

        // Verificar si el evento está activo hoy
        const fechaInicio = data.fechaInicio;
        const fechaFin = data.fechaFin;
        const isDateInRange = fechaInicio <= todayString && fechaFin >= todayString;

        if (isDateInRange) {
          // Verificar si el usuario actual está asignado como mercaderista en este evento
          const mercaderistas = data.mercaderistas || [data.mercaderista] || [];
          const nombreUsuario = userData.fullName?.trim();

          let isAssigned = false;

          // 1. Búsqueda exacta por nombre
          if (nombreUsuario && mercaderistas.includes(nombreUsuario)) {
            isAssigned = true;
          }

          // 2. Búsqueda case-insensitive
          if (!isAssigned && nombreUsuario) {
            const nombreNormalizado = nombreUsuario.toLowerCase().trim();
            const encontrado = mercaderistas.find((m: any) => 
              m && typeof m === 'string' && m.toLowerCase().trim() === nombreNormalizado
            );
            if (encontrado) {
              isAssigned = true;
            }
          }

          // 3. Búsqueda por coincidencia parcial de nombres
          if (!isAssigned && nombreUsuario) {
            const partesNombre = nombreUsuario.toLowerCase().split(' ');
            const encontrado = mercaderistas.find((m: any) => {
              if (!m || typeof m !== 'string') return false;
              const mercNormalizado = m.toLowerCase();
              return partesNombre.some((parte: string) => 
                parte.length > 2 && mercNormalizado.includes(parte)
              );
            });
            if (encontrado) {
              isAssigned = true;
            }
          }

          if (isAssigned) {
            console.log('✅ Evento encontrado:', data.nombreEvento);

            // Calcular duración real basándose en las fechas
            const fechaInicioDate = new Date(data.fechaInicio);
            const fechaFinDate = new Date(data.fechaFin);
            const duracionReal = Math.floor((fechaFinDate.getTime() - fechaInicioDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

            eventosDelDia.push({
              id: doc.id,
              nombreEvento: data.nombreEvento,
              mercaderistas: mercaderistas,
              mercaderistasIds: data.mercaderistasIds || [data.mercaderistoId],
              fechaInicio: data.fechaInicio,
              fechaFin: data.fechaFin,
              duracionDias: duracionReal,
              ubicacion: data.ubicacion,
              direccion: data.direccion,
              descripcion: data.descripcion,
              tipoEvento: 'Trade (Eventos)',
              status: data.status || 'planificado',
              marcaTrabajada: data.marcaTrabajada, // ✅ INCLUIR MARCA TRABAJADA
              createdAt: data.createdAt?.toDate(),
              createdBy: data.createdBy
            });
          }
        }
      });

      console.log(`🎪 Eventos del día encontrados: ${eventosDelDia.length}`);
      setTodaysEvents(eventosDelDia);

      // ✅ GUARDAR EVENTOS EN LOCALSTORAGE PARA ACCESO OFFLINE
      if (eventosDelDia.length > 0) {
        localStorage.setItem('todaysEventsOffline', JSON.stringify(eventosDelDia));
        console.log('💾 Eventos guardados en localStorage para acceso offline');
      }

    } catch (error) {
      console.error('❌ Error cargando eventos del día:', error);
      setTodaysEvents([]);
    }
  };

  useEffect(() => {
    // ✅ CORRECCIÓN: Esperar a que tanto user como userData estén disponibles
    if (!user || !userData) {
      console.log('⏳ Esperando user y userData...', { hasUser: !!user, hasUserData: !!userData });
      return;
    }

    setIsLoading(true);
    const todayString = format(new Date(), 'yyyy-MM-dd');

    console.log('🚀 [ROUTE LOADER] Iniciando carga de rutas para:', {
      uid: userData.uid,
      role: userData.role,
      email: userData.email,
      online: navigator.onLine
    });

    // ✅ Función asíncrona para manejar TODA la lógica de carga
    const loadRoutesWithStrategy = async () => {
      try {
        // 🔧 DEBUG: Diagnosticar estado de IndexedDB
        console.log('🔧 [DEBUG] Ejecutando diagnóstico de IndexedDB...');
        const debugInfo = await offlineService.debugOfflineData(userData.uid);
        console.log('🔧 [DEBUG] Resultado diagnóstico:', debugInfo);

        // ✅ ESTRATEGIA 1: Intentar cargar con dualRouteLoader (offline-first para mercaderistas)
        console.log('📱 [DUAL LOADER] Intentando carga con estrategia dual...');
        
        const routeResult = await dualRouteLoader.getTodayRoutes(userData);
        
        console.log(`📋 [${routeResult.source.toUpperCase()}] ${routeResult.routes.length} rutas encontradas`);
        console.log('📊 Detalles de carga:', {
          source: routeResult.source,
          totalCount: routeResult.totalCount,
          offlineCount: routeResult.offlineCount,
          onlineCount: routeResult.onlineCount
        });
        
        if (routeResult.routes.length > 0) {
          console.log('📍 Primera ruta:', {
            id: routeResult.routes[0].id,
            status: routeResult.routes[0].status,
            pointsCount: routeResult.routes[0].points.length,
            date: routeResult.routes[0].date
          });
          
          // ✅ Guardar en localStorage como backup
          localStorage.setItem('todaysRoutesOffline', JSON.stringify(routeResult.routes));
          console.log('💾 Rutas guardadas en localStorage para uso offline');
          
          // ⚠️ CRÍTICO: Validar con servidor si el estado es "planificada" pero existen visitas del día
          let finalRoutes = routeResult.routes;
          try {
            const email = user.email?.toLowerCase();
            if (email) {
              const visitasHoy = (await obtenerVisitas({ correoMercaderista: email }))
                .filter((v: any) => format(v.createdAt, 'yyyy-MM-dd') === todayString);
              if (visitasHoy.length > 0 && finalRoutes[0] && finalRoutes[0].status === 'planificada') {
                console.log('🩹 Corrigiendo estado local a en_progreso por visitas existentes');
                finalRoutes = finalRoutes.map(r => ({ ...r, status: 'en_progreso' }));
                localStorage.setItem('todaysRoutesOffline', JSON.stringify(finalRoutes));
              }
            }
          } catch (e) {
            console.warn('⚠️ No se pudo validar visitas para corregir estado local', e);
          }

          setTodaysRoutes(finalRoutes);
          setIsLoading(false);
          return;
        }

        // ✅ ESTRATEGIA 2: Si no hay rutas del dual loader, intentar localStorage
        console.log('📦 [FALLBACK] No hay rutas del dual loader, intentando localStorage...');
        
        const savedRoutes = localStorage.getItem('todaysRoutesOffline');
        if (savedRoutes) {
          try {
            const routes = JSON.parse(savedRoutes);
            if (routes && routes.length > 0) {
              setTodaysRoutes(routes);
              console.log(`📦 [LOCALSTORAGE] ${routes.length} rutas restauradas desde localStorage`);
              setIsLoading(false);
              return;
            }
          } catch (parseError) {
            console.error('❌ Error parseando rutas de localStorage:', parseError);
          }
        }

        // ✅ ESTRATEGIA 3: Si aún no hay nada y hay conexión, intentar directo de Firebase
        if (navigator.onLine && userData.role === 'Mercaderista') {
          console.log('🌐 [FIREBASE DIRECT] Último intento: carga directa desde Firebase...');
          
          try {
            const routesRef = collection(db, 'routes');
            const q = query(
              routesRef,
              where('mercaderistoId', '==', userData.uid),
              where('date', '==', todayString)
            );
            
            const snapshot = await getDocs(q);
            const directRoutes: Route[] = [];
            
            snapshot.forEach(doc => {
              const data = doc.data();
              directRoutes.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
              } as Route);
            });
            
            if (directRoutes.length > 0) {
              console.log(`🎯 [FIREBASE DIRECT] ${directRoutes.length} rutas encontradas directamente`);
              localStorage.setItem('todaysRoutesOffline', JSON.stringify(directRoutes));
              setTodaysRoutes(directRoutes);
              setIsLoading(false);
              return;
            }
          } catch (directError) {
            console.error('❌ Error en carga directa de Firebase:', directError);
          }
        }

        // ✅ ESTRATEGIA 4: No hay rutas disponibles
        console.log('📭 [NO ROUTES] No se encontraron rutas para hoy');
        setTodaysRoutes([]);
        setIsLoading(false);

      } catch (error) {
        console.error('❌ [ROUTE LOADER] Error crítico cargando rutas:', error);
        
        // ✅ ÚLTIMO RECURSO: localStorage
        const savedRoutes = localStorage.getItem('todaysRoutesOffline');
        if (savedRoutes) {
          try {
            const routes = JSON.parse(savedRoutes);
            setTodaysRoutes(routes);
            console.log('🆘 [EMERGENCY] Rutas restauradas de localStorage tras error crítico');
          } catch {
            setTodaysRoutes([]);
          }
        } else {
          setTodaysRoutes([]);
        }
        
        setIsLoading(false);
      }
    };

    // ✅ Ejecutar la carga con estrategias múltiples
    loadRoutesWithStrategy();

    // ✅ No hay listeners que limpiar
    return () => {
      console.log('🧹 [CLEANUP] Limpieza de efecto de carga de rutas');
    };
  }, [user, userData]); // ✅ CORRECCIÓN: Incluir userData en dependencias

  // Listener en tiempo real para mantener actualizados los estados de puntos de la ruta
  useEffect(() => {
    if (!user || !userData) return;
    const todayString = format(new Date(), 'yyyy-MM-dd');

    const unsubscribe = listenToMercaderistaRoutes(
      userData.uid,
      todayString,
      (routes) => {
        setTodaysRoutes(routes);
        try {
          localStorage.setItem('todaysRoutesOffline', JSON.stringify(routes));
        } catch {}
      },
      (error) => {
        console.error('Listener de rutas (mi-ruta) error:', error);
      }
    );

    return () => {
      try { unsubscribe && unsubscribe(); } catch {}
    };
  }, [user, userData]);

  // Cargar eventos cuando userData esté disponible
  useEffect(() => {
    if (user && userData) {
      // ✅ MEJORA OFFLINE: Solo cargar eventos si hay internet
      if (navigator.onLine) {
        loadTodaysEvents();
      } else {
        console.log('🔄 Modo offline: saltando carga de eventos de Firebase');
      }
    }
  }, [user, userData]);

  // ✅ LISTENER PARA ACTUALIZACIONES DE EVENTOS EN LOCALSTORAGE
  useEffect(() => {
    const handleStorageChange = () => {
      // Reaccionar a eventos personalizados disparados por marcarPuntoComoCompletado
      if (userData) {
        console.log('🔄 [STORAGE EVENT] Eventos actualizados, recargando desde localStorage...');
        
        // Cargar eventos desde localStorage directamente
        const todaysEventsStr = localStorage.getItem('todaysEventsOffline');
        if (todaysEventsStr) {
          try {
            const events = JSON.parse(todaysEventsStr);
            setTodaysEvents(events);
            console.log('✅ [STORAGE EVENT] Eventos actualizados en UI');
          } catch (error) {
            console.error('❌ Error parseando eventos de localStorage:', error);
          }
        }
      }
    };

    // Escuchar eventos personalizados de storage
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [userData]);

  // Cargar métricas y datos históricos cuando userData esté disponible
  useEffect(() => {
    if (user && userData) {
      // ✅ MEJORA OFFLINE: Solo cargar datos si hay internet
      if (navigator.onLine) {
        loadMetrics();
        loadHistoricalData();
      } else {
        console.log('🔄 Modo offline: saltando carga de métricas y datos históricos');

        // ✅ Cargar datos básicos desde localStorage si existen
        const routesOffline = localStorage.getItem('todaysRoutesOffline');
        if (routesOffline) {
          setTodaysRoutes(JSON.parse(routesOffline));
          console.log('📦 Rutas cargadas desde localStorage offline');
        }
      }
    }
  }, [user, userData]);

  // Detectar cambios de estado de ruta y mostrar notificaciones
  useEffect(() => {
    if (todaysRoutes.length > 0) {
      const currentStatus = todaysRoutes[0].status;

      // Si hay un estado anterior y es diferente al actual, mostrar toast
      if (previousStatus && previousStatus !== currentStatus) {
        console.log(`🔄 Estado de ruta cambió: ${previousStatus} → ${currentStatus}`);

        let title = '';
        let description = '';
        let variant: 'default' | 'destructive' = 'default';

        switch (currentStatus) {
          case 'en_progreso':
            title = '🚀 ¡Ruta iniciada!';
            description = 'Tu ruta está ahora en proceso. ¡Comienza tus visitas!';
            break;
          case 'completada':
            title = '🎉 ¡Ruta completada!';
            description = '¡Excelente trabajo! Has terminado tu ruta del día.';
            break;
          case 'planificada':
            title = '📋 Ruta reiniciada';
            description = 'Tu ruta volvió al estado planificada.';
            break;
        }

        if (title) {
          toast({
            title,
            description,
            variant,
          });
        }
      }

      // Actualizar el estado anterior
      setPreviousStatus(currentStatus);
    }
  }, [todaysRoutes, previousStatus, toast]);

  // Cargar métricas REALES del mercaderista
  const loadMetrics = async () => {
    console.log('🚨 FUNCIÓN loadMetrics INICIADA - SIEMPRE DEBERÍA APARECER');

    if (!user || !userData) {
      console.log('❌ No hay user o userData:', { user: !!user, userData: !!userData });
      return;
    }

    console.log('✅ User y userData OK, continuando...');

    try {
      console.log('📊 Cargando métricas para:', userData.fullName, 'Email:', user.email);

      const today = new Date();
      const startWeek = startOfWeek(today, { weekStartsOn: 1 }); // Lunes como primer día
      const startMonth = startOfMonth(today);
      const last30Days = subDays(today, 30);

      console.log('📊 Obteniendo todas las visitas...');

      // 🔍 DEBUG: Obtener visitas SOLO del mercaderista actual (según reglas de seguridad)
      const todasLasVisitas = await obtenerVisitas({
        correoMercaderista: user.email?.toLowerCase() || undefined,
      });
      console.log('🔍 [DEBUG] Total de visitas en BD:', todasLasVisitas.length);

      if (todasLasVisitas.length > 0) {
        console.log('🔍 [DEBUG] Ejemplo de visita:', {
          direccionCorreo: todasLasVisitas[0].direccionCorreo,
          mercaderista: todasLasVisitas[0].mercaderista,
          rifCliente: todasLasVisitas[0].rifCliente,
          nombreEstablecimiento: todasLasVisitas[0].nombreEstablecimiento
        });

        // Mostrar todos los emails únicos para comparar
        const emailsUnicos = [...new Set(todasLasVisitas.map((v: any) => v.direccionCorreo))];
        console.log('🔍 [DEBUG] Emails únicos en visitas:', emailsUnicos);

        // Mostrar todos los mercaderistas únicos para comparar  
        const mercaderistasUnicos = [...new Set(todasLasVisitas.map((v: any) => v.mercaderista))];
        console.log('🔍 [DEBUG] Mercaderistas únicos en visitas:', mercaderistasUnicos);
      }

      // ✅ MEJORADO: Buscar visitas de forma más eficiente
      // Prioridad 1: Buscar por email (más confiable)
      let allVisitas = await obtenerVisitas({
        correoMercaderista: user.email?.toLowerCase() || undefined,
      });

      // Si no encuentra por email, intentar por nombre
      if (allVisitas.length === 0 && userData.fullName) {
        console.log('📊 No se encontraron visitas por email, intentando por nombre...');
        const visitasPorNombre = await obtenerVisitas({
          mercaderista: userData.fullName
        });
        allVisitas = visitasPorNombre;
      }

      console.log('📊 Total visitas encontradas:', allVisitas.length);
      console.log('📊 Método de búsqueda usado:', 
        allVisitas.length > 0 ? 
          (allVisitas[0].direccionCorreo === user.email ? 'Email' : 'Nombre') : 
          'Ninguno'
      );

      if (allVisitas.length === 0) {
        // Si no hay visitas, mostrar métricas vacías
        setMetrics({
          visitasHoy: 0,
          visitasSemana: 0,
          visitasMes: 0,
          clientesUnicos: 0,
          promedioVisitasDiarias: 0,
          rutasCompletadas: todaysRoutes.filter(r => r.status === 'completada').length,
          hasData: false
        });
        return;
      }

      // Calcular métricas reales
      const visitasHoy = allVisitas.filter((v: any) => 
        isSameDay(v.createdAt, today)
      ).length;

      const visitasSemana = allVisitas.filter((v: any) => v.createdAt >= startWeek).length;
      const visitasMes = allVisitas.filter((v: any) => v.createdAt >= startMonth).length;

      // Clientes únicos (por RIF)
      const clientesUnicos = new Set(
        allVisitas
          .filter((v: any) => v.rifCliente && v.rifCliente.trim() !== '')
          .map((v: any) => v.rifCliente.trim().toUpperCase())
      ).size;

      // Promedio de visitas diarias (últimos 30 días)
      const visitasUltimos30Dias = allVisitas.filter((v: any) => v.createdAt >= last30Days).length;
      const promedioVisitasDiarias = visitasUltimos30Dias > 0 
        ? Math.round((visitasUltimos30Dias / 30) * 10) / 10 
        : 0;

      // Contar rutas completadas hoy
      const rutasCompletadas = todaysRoutes.filter(r => r.status === 'completada').length;

      const calculatedMetrics = {
        visitasHoy,
        visitasSemana,
        visitasMes,
        clientesUnicos,
        promedioVisitasDiarias,
        rutasCompletadas,
        hasData: true
      };

      console.log('📊 Métricas cargadas correctamente');
      setMetrics(calculatedMetrics);

    } catch (error) {
      console.error('Error cargando métricas:', error);
      // En caso de error, mostrar métricas vacías
      setMetrics({
        visitasHoy: 0,
        visitasSemana: 0,
        visitasMes: 0,
        clientesUnicos: 0,
        promedioVisitasDiarias: 0,
        rutasCompletadas: 0,
        hasData: false
      });
    }
  };

  // Cargar datos históricos para el calendario con visitas reales
  const loadHistoricalData = async () => {
    if (!user || !userData) return;

    try {
      console.log('📅 Cargando datos históricos con visitas reales...');

      // Generar fechas de los últimos 30 días para consultar
      const fechasConsulta: string[] = [];
      for (let i = 0; i < 30; i++) {
        const fecha = subDays(new Date(), i);
        fechasConsulta.push(format(fecha, 'yyyy-MM-dd'));
      }

      // 1. Obtener rutas históricas
      const routesRef = collection(db, 'routes');
      const allHistoricalRoutes: Route[] = [];

      for (const fecha of fechasConsulta) {
        const q = query(
          routesRef,
          where('mercaderistoId', '==', user.uid),
          where('date', '==', fecha)
        );

        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(doc => {
          const data = doc.data();
          allHistoricalRoutes.push({
            id: doc.id,
            mercaderista: data.mercaderista,
            mercaderistoId: data.mercaderistoId,
            date: data.date,
            points: data.points || [],
            status: data.status || 'planificada',
            totalDistance: data.totalDistance || 0,
            totalTime: data.totalTime || 0,
            createdAt: data.createdAt?.toDate(),
            createdBy: data.createdBy
          });
        });
      }

      // 2. Obtener visitas históricas del mercaderista
      let allVisitas = await obtenerVisitas({
        correoMercaderista: user.email?.toLowerCase() || undefined,
      });

      console.log('📅 Visitas históricas encontradas:', allVisitas.length);

      setHistoricalRoutes(allHistoricalRoutes);

      // 3. Crear datos del calendario con visitas reales
      const calendarInfo: RutaCalendario[] = fechasConsulta.map(fecha => {
        const rutasDeLaFecha = allHistoricalRoutes.filter(r => r.date === fecha);
        const rutasCompletadas = rutasDeLaFecha.filter(r => r.status === 'completada').length;

        // ✅ NUEVO: Calcular visitas reales del día
        const fechaDate = parseISO(fecha);
        const visitasDelDia = allVisitas.filter((visita: any) => 
          isSameDay(visita.createdAt, fechaDate)
        ).length;

        // Obtener el status general del día
        let status: 'completada' | 'en_progreso' | 'planificada' = 'planificada';
        if (rutasCompletadas > 0 || visitasDelDia > 0) {
          status = 'completada';
        } else if (rutasDeLaFecha.some(r => r.status === 'en_progreso')) {
          status = 'en_progreso';
        }

        return {
          fecha,
          rutasCompletadas,
          visitasRealizadas: visitasDelDia, // ✅ AHORA CON DATOS REALES
          status
        };
      });

      setCalendarData(calendarInfo);
      console.log('📅 Datos históricos cargados:', {
        días: calendarInfo.length,
        rutasTotal: allHistoricalRoutes.length,
        visitasTotal: allVisitas.length,
        díasConActividad: calendarInfo.filter(c => c.rutasCompletadas > 0 || c.visitasRealizadas > 0).length
      });

    } catch (error) {
      console.error('Error cargando datos históricos:', error);
    }
  };

  // Convertir eventos en puntos visitables
  const convertEventToPoint = (evento: EventoIndependiente): RoutePoint => {
    // ✅ NUEVO: Mapear el estado del evento al estado del punto de ruta
    let pointStatus: RoutePoint['status'] = 'pendiente';

    if (evento.status === 'completado') {
      pointStatus = 'visitado';
    } else if (evento.status === 'en_progreso') {
      pointStatus = 'pendiente'; // Mantener como pendiente para que se pueda completar
    } else {
      pointStatus = 'pendiente';
    }

    return {
      id: `evento-${evento.id}`,
      name: evento.nombreEvento,
      address: evento.direccion || 'Ubicación del evento',
      position: evento.ubicacion || { lat: 0, lng: 0 },
      type: 'oficina', // Usar 'oficina' para eventos
      estimatedTime: 60, // Tiempo estimado por defecto para eventos
      status: pointStatus, // ✅ USAR ESTADO REAL DEL EVENTO
      tipoVisita: 'Trade (Eventos)',
      // Campos adicionales para eventos
      nombreCliente: evento.nombreEvento,
      rif: '', // Los eventos no tienen RIF
      telefono: '',
      email: '',
      contacto: evento.mercaderistas.join(', '),
      region: '',
      sede: '',
      ciudad: '',
      tipo: 'evento',
      _isEvent: true,
      _eventId: evento.id,
      _routeId: '',
      _routeName: 'Evento Independiente'
    };
  };

  // Unir todos los puntos de todas las rutas y eventos
  const routePoints: RoutePoint[] = todaysRoutes.flatMap(route => 
    route.points.map(point => ({ ...point, _routeId: route.id, _routeName: route.mercaderista, _isEvent: false }))
  );

  const eventPoints: RoutePoint[] = todaysEvents.map(evento => convertEventToPoint(evento));

  const allPoints: RoutePoint[] = [...routePoints, ...eventPoints];

  // Función para verificar si las coordenadas GPS son válidas
  const hasValidCoordinates = (point: RoutePoint): boolean => {
    console.log('🔍 ========= VERIFICANDO COORDENADAS GPS =========');
    console.log('🔍 Cliente:', point.name);
    console.log('🔍 Position object:', point.position);

    if (!point.position) {
      console.log('❌ NO HAY OBJECT POSITION - Coordenadas inválidas');
      return false;
    }

    const { lat, lng } = point.position;
    console.log('🔍 Latitud:', lat, 'Tipo:', typeof lat);
    console.log('🔍 Longitud:', lng, 'Tipo:', typeof lng);

    // Verificar que no sean 0,0 (coordenadas por defecto inválidas)
    if (lat === 0 && lng === 0) {
      console.log('❌ COORDENADAS SON 0,0 - Inválidas (cliente sin GPS)');
      return false;
    }

    // Verificar que estén dentro de rangos válidos para Venezuela
    // Venezuela: lat entre 0.5 y 15.8, lng entre -73.5 y -59.8
    if (lat < 0.5 || lat > 15.8 || lng < -73.5 || lng > -59.8) {
      console.warn('❌ COORDENADAS FUERA DE VENEZUELA:', { lat, lng });
      console.warn('   Rango válido: lat 0.5-15.8, lng -73.5 a -59.8');
      return false;
    }

    console.log('✅ COORDENADAS VÁLIDAS - Cliente tiene GPS correcto');
    return true;
  };

  // Función para obtener la ubicación actual del usuario
  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('La geolocalización no está soportada en este navegador'));
        return;
      }

      // ✅ CONFIGURACIÓN GPS PURO (sin red celular/WiFi)
      const options = {
        enableHighAccuracy: true,      // ✅ Fuerza uso de GPS cuando esté disponible
        timeout: 15000,               // ✅ Más tiempo para GPS puro (15 segundos)
        maximumAge: 0                 // ✅ Sin cache - ubicación fresca siempre
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } = position.coords;
          
          // ✅ INFORMACIÓN DETALLADA DE GPS
          console.log('📍 ========= UBICACIÓN GPS OBTENIDA =========');
          console.log('📍 Coordenadas:', { lat: latitude, lng: longitude });
          console.log('📍 Precisión GPS:', accuracy ? `${accuracy.toFixed(0)} metros` : 'Desconocida');
          console.log('📍 Fuente probable:', accuracy < 50 ? 'GPS Satelital' : 'Red Celular/WiFi');
          console.log('📍 Altitud:', altitude ? `${altitude.toFixed(0)}m` : 'No disponible');
          console.log('📍 Timestamp:', new Date(position.timestamp).toLocaleString());
          console.log('📍 ==========================================');
          
          // ✅ Advertir si la precisión es baja (probablemente red en lugar de GPS)
          if (accuracy && accuracy > 100) {
            console.warn('⚠️ PRECISIÓN BAJA - Posible uso de red en lugar de GPS puro');
          }
          
          resolve({ lat: latitude, lng: longitude });
        },
        (error) => {
          console.error('❌ Error obteniendo ubicación:', error);
          let errorMessage = 'Error desconocido al obtener ubicación';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permiso de ubicación denegado. Por favor, habilita la ubicación en tu navegador.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Ubicación no disponible. Verifica tu conexión GPS/WiFi.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Tiempo de espera agotado. Intenta nuevamente.';
              break;
          }

          reject(new Error(errorMessage));
        },
        options
      );
    });
  };

  // ✅ FUNCIÓN OFFLINE: Guardar coordenadas en cola de sincronización
  const updateClientCoordinates = async (clienteRif: string, position: { lat: number; lng: number }) => {
    if (!clienteRif || !position) return false;

    try {
      console.log('📱 [OFFLINE] Guardando coordenadas en cola de sincronización...');

      // ✅ Guardar en cola de sincronización usando offlineService
      const updateData = {
        type: 'client_coordinates_update',
        clienteRif: clienteRif,
        position: position,
        timestamp: Date.now(),
        updatedBy: user?.email || 'mercaderista',
        gpsUpdatedInField: true,
        mercaderistoId: user?.uid || '',
        routeId: 'coordinates_update', // Identificador especial para actualizaciones de coordenadas
        pointId: clienteRif, // Usar RIF como identificador único
        clienteId: clienteRif,
        gpsLocation: position,
        tipoVisita: 'coordinate_update' as any,
        formData: {
          action: 'update_coordinates',
          clienteRif: clienteRif,
          newPosition: position,
          updatedBy: user?.email || 'mercaderista',
          updatedAt: new Date().toISOString()
        },
        photos: [] // Sin fotos para actualización de coordenadas
      };

      // ✅ Añadir a la cola de sincronización
      await offlineService.queueVisitaForSync(updateData);

      console.log('✅ ========= COORDENADAS EN COLA DE SINCRONIZACIÓN =========');
      console.log('✅ Cliente RIF:', clienteRif);
      console.log('✅ Coordenadas:', position);
      console.log('✅ Se subirán automáticamente cuando haya conexión');
      console.log('✅ =========================================================');
      
      return true;
    } catch (error) {
      console.error('❌ [OFFLINE] Error guardando coordenadas en cola:', error);
      return false;
    }
  };

  // ✅ FUNCIÓN OFFLINE: Obtener ubicación GPS y guardar localmente
  const handleUseCurrentLocation = async () => {
    if (!currentPointForLocation) return;

    setIsGettingLocation(true);

    try {
      console.log('📱 [OFFLINE] Obteniendo ubicación GPS...');
      
      // ✅ Solo usar navigator.geolocation - completamente local
      const currentPosition = await getCurrentLocation();
      
      console.log('✅ [OFFLINE] Ubicación obtenida:', currentPosition);

      // ✅ OFFLINE: Solo guardar para sincronización posterior (no Firebase)
      if (currentPointForLocation.rif) {
        // ✅ Actualizar coordenadas localmente (sin Firebase)
        const updateSuccess = await updateClientCoordinates(currentPointForLocation.rif, currentPosition);

        if (updateSuccess) {
          toast({
            title: '📱 Ubicación GPS Guardada (Offline)',
            description: `Las coordenadas de ${currentPointForLocation.name} se guardaron localmente. Se sincronizarán automáticamente cuando haya conexión.`,
          });
        }
      }

      // ✅ Actualizar las coordenadas del punto actual en memoria
      const updatedPoint = {
        ...currentPointForLocation,
        position: currentPosition
      };

      console.log('✅ [OFFLINE] Continuando con visita offline...');
      
      // ✅ Continuar con la visita usando las nuevas coordenadas
      proceedWithVisit(updatedPoint);

    } catch (error: any) {
      console.error('❌ [OFFLINE] Error obteniendo ubicación GPS:', error);
      
      // ✅ Manejo de errores offline específico
      let errorMessage = 'No se pudo obtener la ubicación GPS';
      
      if (error.message?.includes('User denied')) {
        errorMessage = 'Acceso a ubicación denegado. Habilite la geolocalización para continuar.';
      } else if (error.message?.includes('Position unavailable')) {
        errorMessage = 'Ubicación no disponible. Verifique que el GPS esté activado.';
      } else if (error.message?.includes('Timeout')) {
        errorMessage = 'Tiempo de espera agotado. Intente nuevamente.';
      }
      
      toast({
        variant: 'destructive',
        title: '📱 Error de ubicación GPS',
        description: errorMessage,
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Función para proceder con la visita (después de resolver las coordenadas)
  const proceedWithVisit = (point: RoutePoint) => {
    // Cerrar diálogos
    setIsLocationDialogOpen(false);
    setCurrentPointForLocation(null);

    // Continuar con el flujo normal de visita
    continueWithVisit(point);
  };

  // Función separada para continuar con la visita (lógica original de handleStartVisit)
  const continueWithVisit = async (point: RoutePoint) => {
    console.log('🚀 Continuando con visita a:', point.name);
    console.log('🔍 Es evento:', point._isEvent ? 'Sí' : 'No');
    console.log('🆔 Point ID:', point.id || 'Sin ID');

    // ✅ OFFLINE: Solo iniciar ruta si HAY CONEXIÓN (no en modo offline)
    if (user && todaysRoutes.length > 0 && !point._isEvent && navigator.onLine) {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        console.log('🔄 [ONLINE] Auto-iniciando ruta para el día:', today);

        // Cambiar estado de todas las rutas del día a 'en_progreso'
        const result = await autoUpdateRouteStatus(user.uid, today, 'start');

        if (result.updated) {
          console.log('✅ Ruta iniciada automáticamente:', result.reason);
          toast({
            title: '🚀 ¡Ruta iniciada!',
            description: `${result.reason}. ¡Comienza tu jornada!`,
          });
        } else {
          console.log('ℹ️ No se inició ruta:', result.reason);
        }
      } catch (error) {
        console.error('❌ Error iniciando ruta automáticamente:', error);
        // Continuar con la visita aunque falle el cambio de estado
      }
    } else if (!navigator.onLine) {
      console.log('📱 [OFFLINE] Omitiendo auto-inicio de ruta - Sin conexión');
      toast({
        title: '📱 Modo Offline',
        description: 'Continuando en modo offline. Los datos se sincronizarán cuando haya conexión.',
      });
    }

    // ✅ GENERAR ID ÚNICO SI NO EXISTE
    const finalPointId = point.id || `punto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('🆔 Point ID final:', finalPointId);

    const clienteData = {
      pointId: finalPointId, // ✅ USAR ID FINAL (original o generado)
      id: finalPointId, // ✅ AÑADIR ID PARA CONSISTENCIA
      rif: point.rif || '',
      nombre: point.nombreCliente || point.name,
      direccion: point.address,
      position: point.position,
      telefono: point.telefono || '',
      email: point.email || '',
      contacto: point.contacto || '',
      region: point.region || '',
      sede: point.sede || '',
      ciudad: point.ciudad || '',
      tipo: point.tipo || '',
      isEvent: point._isEvent || false,
      eventId: point._eventId || '', // ✅ IMPORTANTE: Pasar el eventId para eventos
      tipoVisita: point.tipoVisita || ''
    };

    console.log('💾 Guardando datos del cliente en localStorage');
    localStorage.setItem('clienteData', JSON.stringify(clienteData));

    // Verificar que se guardó correctamente
    const saved = localStorage.getItem('clienteData');
    const parsed = JSON.parse(saved || '{}');

    if (!parsed.pointId) {
      console.error('❌ Error: PointId no se guardó correctamente');
    } else {
      console.log('✅ Datos guardados correctamente - PointId:', parsed.pointId);
    }

    // Usar parámetros únicos para cada punto para evitar conflictos
    const pointType = point._isEvent ? 'evento' : 'cliente';
    const uniqueId = point._isEvent ? point._eventId : finalPointId;

    console.log('🔗 Navegando a captura de visita:', point.name);

    // ✅ OFFLINE: Solo enviar analytics si HAY CONEXIÓN
    if (navigator.onLine) {
      try {
        console.log('📊 [ONLINE] Enviando datos de analytics...');
        await analytics.trackClientInteraction(
          uniqueId || 'unknown',
          point.nombreCliente || point.name,
          'visit',
          {
            point_type: pointType,
            is_event: point._isEvent,
            route_name: userData?.sede || 'unknown',
            city: userData?.city || 'unknown'
          }
        );
      } catch (error) {
        console.warn('⚠️ Error enviando analytics (no crítico):', error);
      }
    } else {
      console.log('📱 [OFFLINE] Omitiendo analytics - Sin conexión');
    }

    router.push(`/visit-capture?pointId=${uniqueId}&pointName=${encodeURIComponent(point.name)}&pointType=${pointType}`);
  };

  // ✅ Función mejorada para completar manualmente la ruta con validación de visitas
  const handleCompleteRoute = async () => {
    if (!user) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // 1. Verificar visitas reales antes de completar (filtradas por email para cumplir reglas)
      const email = user.email?.toLowerCase();
      const visitasReales = await obtenerVisitas({
        correoMercaderista: email,
      });
      const visitasDeHoy = visitasReales.filter((visita: any) => {
        try {
          const visitaDate = visita.createdAt instanceof Date ? 
            visita.createdAt : 
            new Date(visita.createdAt);

          return (
            format(visitaDate, 'yyyy-MM-dd') === today &&
            visita.direccionCorreo?.toLowerCase() === user?.email?.toLowerCase()
          );
        } catch {
          return false;
        }
      });

      console.log(`📊 Visitas encontradas para completar ruta: ${visitasDeHoy.length}`);

      if (visitasDeHoy.length === 0) {
        toast({
          title: '⚠️ No hay visitas registradas',
          description: 'Debes registrar al menos una visita antes de completar la ruta.',
          variant: 'destructive',
        });
        return;
      }

      // 2. Proceder con la completación
      const result = await autoUpdateRouteStatus(user.uid, today, 'complete');

      if (result.updated) {
        // Track route completion
        await analytics.trackRouteActivity(
          userData?.sede || 'unknown_route',
          'complete',
          100 // 100% progress on completion
        );

        await analytics.logEvent('route_completed', {
          visit_count: visitasDeHoy.length,
          user_role: userData?.role,
          route_name: userData?.sede,
          city: userData?.city,
          completion_date: today
        });

        toast({
          title: '🎉 ¡Ruta completada!',
          description: `${result.reason}. Registraste ${visitasDeHoy.length} visita${visitasDeHoy.length > 1 ? 's' : ''} hoy. ¡Excelente trabajo!`,
        });
      } else {
        toast({
          title: 'ℹ️ Información',
          description: result.reason,
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Error completando ruta:', error);
      toast({
        title: '❌ Error',
        description: 'No se pudo completar la ruta. Intenta nuevamente.',
        variant: 'destructive',
      });
    }
  };

  const handleStartVisit = async (point: RoutePoint) => {
    console.log('🚀 ========= INICIANDO VISITA =========');
    console.log('🚀 Cliente:', point.name);
    console.log('🔍 Es evento:', point._isEvent ? 'Sí' : 'No');
    console.log('🆔 Point ID:', point.id || 'Sin ID');
    console.log('📍 Coordenadas completas:', point.position);

    if (point.position) {
      console.log('📍 Latitud:', point.position.lat);
      console.log('📍 Longitud:', point.position.lng);
    } else {
      console.log('❌ NO HAY COORDENADAS (position es null/undefined)');
    }

    // ✅ VERIFICAR COORDENADAS GPS ANTES DE PROCEDER
    const hasValidGPS = hasValidCoordinates(point);
    console.log('🔍 ¿Tiene coordenadas válidas?', hasValidGPS);

    if (!point._isEvent && !hasValidGPS) {
      console.log('⚠️ ========= CLIENTE SIN GPS VÁLIDO =========');
      console.log('⚠️ Mostrando diálogo de opciones de ubicación');

      // Mostrar diálogo para obtener coordenadas
      setCurrentPointForLocation(point);
      setIsLocationDialogOpen(true);
      return; // Detener el flujo hasta que se resuelvan las coordenadas
    }

    console.log('✅ Coordenadas válidas o es evento, continuando normalmente');
    // Si tiene coordenadas válidas o es un evento, continuar normalmente
    continueWithVisit(point);
  };

  const getPointTypeIcon = (point: RoutePoint) => {
    if (point._isEvent) {
      return <Star className="w-5 h-5 text-orange-500" />; // Icono especial para eventos
    }

    switch (point.type) {
      case 'cliente': return <UserCheck className="w-5 h-5 text-green-500" />;
      case 'distribuidor': return <Building className="w-5 h-5 text-blue-500" />;
      case 'oficina': return <CheckCircle className="w-5 h-5 text-purple-500" />;
    }
  };

  // Función para manejar cliente cerrado
  const handleClienteCerrado = (point: RoutePoint) => {
    setCurrentPointForCerrado(point);
    setIsClienteSerradoDialogOpen(true);
    setFotoCerrado(null);
    setRazonCerrado('');
    setComentariosCerrado('');
  };

  // Función para tomar foto del cliente cerrado
  const tomarFotoCerrado = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      // Crear canvas para capturar la foto
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const photoURL = canvas.toDataURL('image/jpeg', 0.8);
        setFotoCerrado(photoURL);
        
        toast({
          title: '📸 Foto Capturada',
          description: 'Foto del cliente cerrado guardada correctamente.',
        });
      }

      // Detener el stream
      stream.getTracks().forEach(track => track.stop());
      
    } catch (error) {
      console.error('Error tomando foto:', error);
      toast({
        variant: 'destructive',
        title: 'Error de Cámara',
        description: 'No se pudo acceder a la cámara. Verifique los permisos.',
      });
    }
  };

  // Función para guardar cliente cerrado
  const guardarClienteCerrado = async () => {
    if (!currentPointForCerrado || !fotoCerrado || !razonCerrado.trim()) {
      toast({
        variant: 'destructive',
        title: 'Datos Incompletos',
        description: 'Debe capturar una foto y especificar la razón del cierre.',
      });
      return;
    }

    try {
      console.log('🚪 INICIANDO PROCESO DE CLIENTE CERRADO:', {
        punto: currentPointForCerrado.name,
        razon: razonCerrado,
        comentarios: comentariosCerrado,
        foto: fotoCerrado ? 'Capturada' : 'No capturada'
      });

      // 1. Subir la foto a Firebase Storage
      const { uploadImageToStorage } = await import('@/services/images');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `cliente-cerrado-${currentPointForCerrado.name.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}.jpg`;
      
      console.log('📸 Subiendo foto de cliente cerrado...');
      const fotoUrl = await uploadImageToStorage(fotoCerrado, 'clientes-cerrados', fileName);
      console.log('✅ Foto subida exitosamente:', fotoUrl);

      // 2. Preparar datos para n8n
      const datosSheet = {
        'Tipo de Registro:': 'Cliente Cerrado',
        'Nombre del Cliente:': currentPointForCerrado.name,
        'RIF del Cliente:': currentPointForCerrado.rif || 'N/A',
        'Dirección:': currentPointForCerrado.address || 'N/A',
        'Tipo de Visita:': currentPointForCerrado.tipoVisita || 'N/A',
        'Marca Trabajada:': currentPointForCerrado.marcaTrabajada || 'N/A',
        'Razón del Cierre:': razonCerrado,
        'Comentarios Adicionales:': comentariosCerrado || 'Sin comentarios',
        'Foto del Cliente Cerrado:': fotoUrl,
        'Fecha y Hora:': new Date().toLocaleString('es-VE'),
        'Mercaderista:': userData?.displayName || 'N/A',
        'Correo Mercaderista:': userData?.email || 'N/A'
      };

      // 3. Crear visita especial para cliente cerrado
      const { crearVisita } = await import('@/services/visitas');
      
      const visitaId = await crearVisita({
        rifCliente: currentPointForCerrado.rif || '',
        nombreEstablecimiento: currentPointForCerrado.name,
        tipoVisita: 'Cliente Cerrado',
        mercaderista: userData?.displayName || 'N/A',
        correoMercaderista: userData?.email || 'N/A',
        ubicacion: currentPointForCerrado.position || { lat: 0, lng: 0 },
        sucursal: userData?.sede || 'GRUPO DISBATTERY',
        respuestas: {
          razonCierre: razonCerrado,
          comentarios: comentariosCerrado,
          fotoUrl: fotoUrl
        },
        observacionesAdicionales: `Cliente cerrado: ${razonCerrado}`,
        datosN8N: {
          datosSheet: datosSheet,
          tipoVisita: 'Cliente Cerrado'
        }
      });

      console.log('✅ Visita de cliente cerrado creada:', visitaId);

      // 4. Actualizar status en Firestore
      const { updateRoutePointStatus } = await import('@/services/routes');
      const today = format(new Date(), 'yyyy-MM-dd');
      
      if (userData?.uid && currentPointForCerrado.id) {
        console.log('🔄 Actualizando status del punto en Firestore...');
        const result = await updateRoutePointStatus(
          userData.uid,
          today,
          currentPointForCerrado.id,
          'cerrado' as any, // Añadimos 'cerrado' como nuevo status
          currentPointForCerrado.rif
        );
        
        if (result.updated) {
          console.log('✅ Status actualizado en Firestore:', result.reason);
        } else {
          console.warn('⚠️ No se pudo actualizar status en Firestore:', result.reason);
        }
      }

      // 5. Actualizar localStorage para reflejar el cambio inmediatamente
      const todaysRoutesStr = localStorage.getItem('todaysRoutesOffline');
      if (todaysRoutesStr) {
        try {
          const routes = JSON.parse(todaysRoutesStr);
          const updatedRoutes = routes.map((route: any) => ({
            ...route,
            points: route.points?.map((point: any) => 
              point.id === currentPointForCerrado.id 
                ? { ...point, status: 'cerrado' }
                : point
            ) || []
          }));
          localStorage.setItem('todaysRoutesOffline', JSON.stringify(updatedRoutes));
          console.log('✅ LocalStorage actualizado con status cerrado');
          
          // Disparar evento para actualizar la UI
          window.dispatchEvent(new Event('storage'));
        } catch (error) {
          console.error('❌ Error actualizando localStorage:', error);
        }
      }

      toast({
        title: '✅ Cliente Cerrado Registrado',
        description: `${currentPointForCerrado.name} marcado como cerrado y enviado a n8n.`,
      });

      // Cerrar el diálogo
      setIsClienteSerradoDialogOpen(false);
      setCurrentPointForCerrado(null);
      setFotoCerrado(null);
      setRazonCerrado('');
      setComentariosCerrado('');

    } catch (error) {
      console.error('❌ Error guardando cliente cerrado:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo registrar el cliente cerrado. Intente nuevamente.',
      });
    }
  };

  // Función para manejar cliente prospecto
  const handleClienteProspecto = () => {
    setIsClienteProspectoDialogOpen(true);
    setNombreProspecto('');
    setDireccionProspecto('');
    setTelefonoProspecto('');
    setTipoNegocioProspecto('');
    setFotoProspecto(null);
    setComentariosProspecto('');
  };

  // Función para tomar foto del cliente prospecto
  const tomarFotoProspecto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      // Crear canvas para capturar la foto
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const photoURL = canvas.toDataURL('image/jpeg', 0.8);
        setFotoProspecto(photoURL);
        
        toast({
          title: '📸 Foto Capturada',
          description: 'Foto del cliente prospecto guardada correctamente.',
        });
      }

      // Detener el stream
      stream.getTracks().forEach(track => track.stop());
      
    } catch (error) {
      console.error('Error tomando foto:', error);
      toast({
        variant: 'destructive',
        title: 'Error de Cámara',
        description: 'No se pudo acceder a la cámara. Verifique los permisos.',
      });
    }
  };

  // Función para guardar cliente prospecto
  const guardarClienteProspecto = async () => {
    if (!nombreProspecto.trim() || !direccionProspecto.trim() || !tipoNegocioProspecto) {
      toast({
        variant: 'destructive',
        title: 'Datos Incompletos',
        description: 'Debe completar nombre, dirección y tipo de negocio.',
      });
      return;
    }

    try {
      console.log('👤 INICIANDO PROCESO DE CLIENTE PROSPECTO:', {
        nombre: nombreProspecto,
        direccion: direccionProspecto,
        telefono: telefonoProspecto,
        tipoNegocio: tipoNegocioProspecto,
        comentarios: comentariosProspecto,
        foto: fotoProspecto ? 'Capturada' : 'No capturada'
      });

      // 1. Capturar ubicación GPS actual
      console.log('📍 Capturando ubicación GPS del prospecto...');
      const gpsLocation = await getGPSLocation();
      console.log('✅ Ubicación GPS capturada:', gpsLocation);

      // 2. Subir la foto a Firebase Storage (si existe)
      let fotoUrl = '';
      if (fotoProspecto) {
        const { uploadImageToStorage } = await import('@/services/images');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `cliente-prospecto-${nombreProspecto.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}.jpg`;
        
        console.log('📸 Subiendo foto de cliente prospecto...');
        fotoUrl = await uploadImageToStorage(fotoProspecto, 'clientes-prospectos', fileName);
        console.log('✅ Foto subida exitosamente:', fotoUrl);
      } else {
        console.log('📸 No se proporcionó foto para el prospecto');
      }

      // 3. Preparar datos para n8n
      const datosSheet = {
        'Tipo de Registro:': 'Cliente Prospecto',
        'Nombre del Negocio:': nombreProspecto,
        'Dirección:': direccionProspecto,
        'Teléfono:': telefonoProspecto || 'No proporcionado',
        'Tipo de Negocio:': tipoNegocioProspecto,
        'Comentarios:': comentariosProspecto || 'Sin comentarios',
        'Foto del Negocio:': fotoUrl || 'No proporcionada',
        'Latitud:': gpsLocation.latitude,
        'Longitud:': gpsLocation.longitude,
        'Dirección GPS:': `${gpsLocation.latitude}, ${gpsLocation.longitude}`,
        'Fecha y Hora:': new Date().toLocaleString('es-VE'),
        'Mercaderista:': userData?.displayName || 'N/A',
        'Correo Mercaderista:': userData?.email || 'N/A',
        'Sede:': userData?.sede || 'GRUPO DISBATTERY'
      };

      // 4. Crear visita especial para cliente prospecto
      const { crearVisita } = await import('@/services/visitas');
      
      const visitaId = await crearVisita({
        rifCliente: '', // Los prospectos no tienen RIF aún
        nombreEstablecimiento: nombreProspecto,
        tipoVisita: 'Cliente Prospecto',
        mercaderista: userData?.displayName || 'N/A',
        correoMercaderista: userData?.email || 'N/A',
        ubicacion: { lat: gpsLocation.latitude, lng: gpsLocation.longitude },
        sucursal: userData?.sede || 'GRUPO DISBATTERY',
        respuestas: {
          nombreNegocio: nombreProspecto,
          direccion: direccionProspecto,
          telefono: telefonoProspecto,
          tipoNegocio: tipoNegocioProspecto,
          comentarios: comentariosProspecto,
          fotoUrl: fotoUrl,
          gpsCoordinates: gpsLocation
        },
        observacionesAdicionales: `Cliente prospecto: ${tipoNegocioProspecto} - ${nombreProspecto}`,
        datosN8N: {
          datosSheet: datosSheet,
          tipoVisita: 'Cliente Prospecto'
        }
      });

      console.log('✅ Visita de cliente prospecto creada:', visitaId);

      toast({
        title: '✅ Cliente Prospecto Registrado',
        description: `${nombreProspecto} registrado exitosamente como prospecto.`,
      });

      // Cerrar el diálogo
      setIsClienteProspectoDialogOpen(false);
      setNombreProspecto('');
      setDireccionProspecto('');
      setTelefonoProspecto('');
      setTipoNegocioProspecto('');
      setFotoProspecto(null);
      setComentariosProspecto('');

    } catch (error) {
      console.error('❌ Error guardando cliente prospecto:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo registrar el cliente prospecto. Intente nuevamente.',
      });
    }
  };

  const handleSelectClient = (point: RoutePoint) => {
    setSelectedClient(point);
  };

  // Función para obtener el color del día en el calendario
  const getCalendarDayColor = (rutaInfo: RutaCalendario) => {
    const tieneActividad = rutaInfo.rutasCompletadas > 0 || rutaInfo.visitasRealizadas > 0;

    if (tieneActividad) {
      return 'bg-green-100 border-green-300 text-green-800';
    }
    if (rutaInfo.status === 'en_progreso') {
      return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    }
    return 'bg-gray-50 border-gray-200 text-gray-500';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-6xl">
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header con información del mercaderista */}
        <Card className="shadow-xl border-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 p-3 rounded-full">
                  <UserIcon className="w-8 h-8" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold">
                    ¡Hola, {userData?.fullName || user?.displayName || 'Mercaderista'}!
                  </CardTitle>
                  <CardDescription className="text-blue-100 text-lg">
                    {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: es })}
                  </CardDescription>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-blue-100">
                  {userData?.sede && (
                    <p>📍 {userData.sede}</p>
                  )}
                  {userData?.region && (
                    <p>🗺️ {userData.region}</p>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Layout responsive mejorado */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">

          {/* Métricas del mercaderista - Responsive */}
          <div className="xl:col-span-1 order-2 xl:order-1">
            <Card className="shadow-lg h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Mis Métricas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {metrics ? (
                  metrics.hasData ? (
                    <>
                      {/* Grid responsive para métricas */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-3">
                        <div className="bg-green-50 p-3 rounded-lg text-center">
                          <div className="text-xl sm:text-2xl font-bold text-green-600">{metrics.visitasHoy}</div>
                          <div className="text-xs text-green-800">Visitas Hoy</div>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg text-center">
                          <div className="text-xl sm:text-2xl font-bold text-blue-600">{metrics.visitasSemana}</div>
                          <div className="text-xs text-blue-800">Esta Semana</div>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-lg text-center">
                          <div className="text-xl sm:text-2xl font-bold text-purple-600">{metrics.visitasMes}</div>
                          <div className="text-xs text-purple-800">Este Mes</div>
                        </div>
                        <div className="bg-orange-50 p-3 rounded-lg text-center">
                          <div className="text-xl sm:text-2xl font-bold text-orange-600">{metrics.clientesUnicos}</div>
                          <div className="text-xs text-orange-800">Clientes Únicos</div>
                        </div>
                      </div>
                      
                      <div className="border-t pt-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <TrendingUp className="w-4 h-4" />
                          Rendimiento
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Promedio diario:</span>
                            <span className="font-semibold">{metrics.promedioVisitasDiarias} visitas</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Rutas completadas:</span>
                            <span className="font-semibold">{metrics.rutasCompletadas}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <BarChart3 className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                      <h3 className="text-base font-semibold text-gray-700 mb-2">Sin datos disponibles</h3>
                      <p className="text-xs text-gray-500">
                        Aún no tienes visitas registradas. ¡Comienza tu primera visita para ver tus métricas!
                      </p>
                    </div>
                  )
                ) : (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Contenido principal - Responsive */}
          <div className="xl:col-span-2 order-1 xl:order-2">
            <Card className="shadow-lg h-full">
              <CardContent className="p-6">
                <Tabs defaultValue="ruta" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 h-auto p-1">
                    <TabsTrigger value="ruta" className="text-xs sm:text-sm px-2 py-2 min-h-[2.5rem] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span className="hidden sm:inline">Mi Ruta</span>
                        <span className="sm:hidden">Ruta</span>
                      </div>
                    </TabsTrigger>
                    <TabsTrigger value="cliente" disabled={!selectedClient} className="text-xs sm:text-sm px-2 py-2 min-h-[2.5rem] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1">
                        <UserCheck className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          {selectedClient ? 'Detalles Cliente' : 'Selecciona Cliente'}
                        </span>
                        <span className="sm:hidden">
                          {selectedClient ? 'Cliente' : 'Cliente'}
                        </span>
                      </div>
                    </TabsTrigger>
                    <TabsTrigger value="calendario" className="text-xs sm:text-sm px-2 py-2 min-h-[2.5rem] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span className="hidden sm:inline">Historial de Rutas</span>
                        <span className="sm:hidden">Historial</span>
                      </div>
                    </TabsTrigger>
                    <TabsTrigger value="prospecto" className="text-xs sm:text-sm px-2 py-2 min-h-[2.5rem] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1">
                        <UserPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">Nuevo Prospecto</span>
                        <span className="sm:hidden">Prospecto</span>
                      </div>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="ruta" className="space-y-4 mt-6">
                    {/* Eventos del día */}
                    {todaysEvents.length > 0 && (
                      <div className="mb-6">
                        <h3 className="font-semibold text-lg mb-3 flex items-center">
                          <Star className="w-5 h-5 text-orange-500 mr-2" />
                          Eventos del Día ({todaysEvents.length})
                        </h3>
                        <div className="grid gap-3">
                          {todaysEvents.map(evento => {
                            const eventoPoint = convertEventToPoint(evento);
                            return (
                              <Card key={evento.id} className="border-l-4 border-l-orange-500 bg-orange-50">
                                <CardContent className="p-3 sm:p-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-orange-900 text-sm sm:text-base truncate">{evento.nombreEvento}</h4>
                                      <p className="text-xs sm:text-sm text-orange-700 mt-1 truncate">{evento.direccion || 'Ubicación del evento'}</p>
                                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs text-orange-600">
                                        <span className="whitespace-nowrap">📅 {format(new Date(evento.fechaInicio), 'dd/MM', { locale: es })} - {format(new Date(evento.fechaFin), 'dd/MM', { locale: es })}</span>
                                        <span className="whitespace-nowrap">⏱️ {evento.duracionDias} día{evento.duracionDias !== 1 ? 's' : ''}</span>
                                        <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                                          Trade (Eventos)
                                        </Badge>
                                        {evento.marcaTrabajada && (
                                          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs">
                                            🏷️ {evento.marcaTrabajada}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    {evento.status !== 'completado' ? (
                                      <Button
                                        onClick={() => handleStartVisit(eventoPoint)}
                                        className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto"
                                        size="sm"
                                      >
                                        <span className="hidden sm:inline">Iniciar Evento</span>
                                        <span className="sm:hidden">Iniciar</span>
                                        <ArrowRight className="w-4 h-4 ml-1 sm:ml-2" />
                                      </Button>
                                    ) : (
                                      <div className="flex items-center gap-2 text-green-600">
                                        <CheckCircle className="w-4 h-4" />
                                        <span className="text-sm font-medium">Completado</span>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {allPoints.length > 0 ? (
                      <div className="space-y-4">
                        {/* Información de formularios múltiples */}
                        <div className="bg-blue-50 border-l-4 border-l-blue-500 p-4 rounded-md">
                          <div className="flex items-center">
                            <UserCheck className="w-5 h-5 text-blue-600 mr-2" />
                            <h3 className="font-semibold text-blue-900">
                              Puntos de Ruta ({allPoints.length} formularios)
                            </h3>
                          </div>
                          <p className="text-sm text-blue-700 mt-1">
                            Cada punto requiere un formulario independiente según su tipo de visita
                          </p>
                        </div>

                        {/* Estado de la ruta */}
                        {todaysRoutes.length > 0 && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold text-gray-800">Estado de mi ruta:</h3>
                                <p className="text-sm text-gray-600">Ruta de {todaysRoutes[0].mercaderista}</p>
                              </div>
                              <Badge className={`${getStatusColor(todaysRoutes[0].status)} text-sm px-3 py-1`}>
                                {getStatusText(todaysRoutes[0].status)}
                              </Badge>
                            </div>
                            
                            {/* Información adicional según el estado */}
                            {todaysRoutes[0].status === 'planificada' && (
                              <div className="mt-2 text-sm text-blue-700 bg-blue-100 rounded p-2">
                                💡 Tu ruta se iniciará automáticamente cuando comiences tu primera visita
                              </div>
                            )}
                            {todaysRoutes[0].status === 'en_progreso' && (
                              <div className="mt-2 text-sm text-yellow-700 bg-yellow-100 rounded p-2">
                                🚀 ¡Ruta en proceso! Continúa visitando tus puntos programados
                              </div>
                            )}
                            {todaysRoutes[0].status === 'completada' && (
                              <div className="mt-2 text-sm text-green-700 bg-green-100 rounded p-2">
                                ✅ ¡Excelente! Ruta completada - Puedes continuar visitando clientes
                              </div>
                            )}
                            
                            {/* Botón para completar manualmente la ruta - solo si está en progreso */}
                            {todaysRoutes[0].status === 'en_progreso' && (
                              <div className="mt-3 flex justify-center">
                                <Button 
                                  onClick={handleCompleteRoute}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  size="sm"
                                >
                                  🏁 Finalizar mi ruta
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <h2 className="text-xl font-semibold text-gray-700">Puntos de Visita:</h2>
                        
                        {/* Mostrar contador de eventos y rutas */}
                        <div className="flex gap-4 mb-4 text-sm">
                          {routePoints.length > 0 && (
                            <div className="flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-green-500" />
                              <span className="text-gray-600">{routePoints.length} cliente{routePoints.length !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                          {eventPoints.length > 0 && (
                            <div className="flex items-center gap-2">
                              <Star className="w-4 h-4 text-orange-500" />
                              <span className="text-gray-600">{eventPoints.length} evento{eventPoints.length !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </div>
                        
                        <ul className="space-y-3 max-h-96 overflow-y-auto">
                          {allPoints.map((point) => {
                            const isPendiente = point.status === 'pendiente';
                            const isVisitado = point.status === 'visitado';
                            const isOmitido = point.status === 'omitido';
                            const isCerrado = point.status === 'cerrado';
                            const isRouteCompleted = todaysRoutes[0]?.status === 'completada';
                            
                            // ✅ CORRECCIÓN: Solo permitir clicks si está pendiente AND la ruta no está completada AND no está cerrado
                            const isClickable = isPendiente && !isRouteCompleted && !isCerrado;
                            
                            return (
                              <li key={point.id}>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                  <button
                                    onClick={() => isClickable && handleStartVisit(point)}
                                    className={`flex-1 text-left ${
                                      !isClickable 
                                        ? 'opacity-60 cursor-not-allowed' 
                                        : 'hover:bg-gray-50 hover:shadow-md transition-all duration-200'
                                    } ${isRouteCompleted ? 'bg-gray-100 border-gray-300' : ''}`}
                                    disabled={!isClickable}
                                  >
                                    <Card className={isRouteCompleted ? 'border-gray-300 bg-gray-50' : ''}>
                                      <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 gap-3">
                                        <div className="flex items-start sm:items-center gap-2 sm:gap-4">
                                          {getPointTypeIcon(point)}
                                          <div className="min-w-0 flex-1">
                                            <p className={`font-bold text-base sm:text-lg flex flex-wrap items-center gap-1 sm:gap-2 ${
                                              isRouteCompleted ? 'text-gray-500' : 'text-gray-900'
                                            }`}>
                                              <span className="truncate">{point.name}</span>
                                              {point._isEvent && (
                                                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                                                  🎪 Evento
                                                </Badge>
                                              )}
                                              {!point._isEvent && !hasValidCoordinates(point) && (
                                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                                  📍 Sin GPS
                                                </Badge>
                                              )}
                                              {isVisitado && <span className="text-green-600 text-base">✓</span>}
                                              {isOmitido && <span className="text-amber-600 text-base">⨉</span>}
                                              {isCerrado && <span className="text-red-600 text-base">🚪</span>}
                                              {isRouteCompleted && <span className="text-gray-500 text-sm ml-2 font-medium">🔒</span>}
                                            </p>
                                            <div className={`flex items-center text-xs sm:text-sm mt-1 ${
                                              isRouteCompleted ? 'text-gray-400' : 'text-gray-500'
                                            }`}>
                                              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                              <span className="truncate">{point.address}</span>
                                            </div>
                                            
                                            {/* Mostrar tipo de visita y marca trabajada */}
                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                              {point.tipoVisita && (
                                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                                  {point.tipoVisita}
                                                </Badge>
                                              )}
                                              {point.marcaTrabajada && (
                                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                  🏷️ {point.marcaTrabajada}
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
                                          <Badge variant="outline" className={`flex items-center space-x-1 text-xs ${
                                            isRouteCompleted ? 'border-gray-300 text-gray-500' : ''
                                          }`}>
                                            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                            <span>{point.estimatedTime} min</span>
                                          </Badge>
                                          <span className={`text-xs font-semibold ${
                                            isRouteCompleted 
                                              ? 'text-gray-500' 
                                              : isPendiente 
                                                ? 'text-blue-600' 
                                                : isVisitado 
                                                  ? 'text-green-600' 
                                                  : isCerrado
                                                    ? 'text-red-600'
                                                    : 'text-amber-600'
                                          }`}>
                                            {isRouteCompleted 
                                              ? 'No Disponible' 
                                              : isPendiente 
                                                ? 'Pendiente' 
                                                : isVisitado 
                                                  ? 'Visitado' 
                                                  : isCerrado
                                                    ? 'Cerrado'
                                                    : 'Omitido'
                                            }
                                          </span>
                                          <div className="flex items-center gap-1">
                                            {isClickable && <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />}
                                            {(isRouteCompleted || isVisitado) && <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />}
                                            {isCerrado && <DoorClosed className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />}
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </button>
                                  
                                  {/* Botón para ver detalles del cliente - siempre disponible */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSelectClient(point)}
                                    className="px-2 sm:px-3 h-8 sm:h-9"
                                  >
                                    <UserCheck className="w-3 h-3 sm:w-4 sm:h-4" />
                                  </Button>

                                  {/* Botón Cliente Cerrado - solo para Merchandising y Trade (Impulso) */}
                                  {!point._isEvent && 
                                   (point.tipoVisita?.includes('Merchandising') || point.tipoVisita?.includes('Trade (Impulso)')) && 
                                   isPendiente && !isRouteCompleted && !isCerrado && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleClienteCerrado(point)}
                                      className="px-2 sm:px-3 h-8 sm:h-9 border-red-200 text-red-600 hover:bg-red-50"
                                      title="Marcar cliente como cerrado"
                                    >
                                      <DoorClosed className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </Button>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <XCircle className="mx-auto h-16 w-16 text-gray-300" />
                        <h2 className="mt-4 text-xl font-semibold text-gray-700">No hay ruta asignada para hoy</h2>
                        <p className="mt-2 text-gray-500">
                          Contacta a tu supervisor si crees que esto es un error.
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="cliente" className="space-y-4 mt-6">
                    {selectedClient ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-4">
                          {getPointTypeIcon(selectedClient)}
                          <h2 className="text-2xl font-bold text-gray-800">{selectedClient.name}</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center gap-2">
                                <Building className="w-5 h-5 text-blue-600" />
                                Información General
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div>
                                <label className="text-sm font-medium text-gray-500">RIF:</label>
                                <p className="font-mono">{selectedClient.rif || 'No disponible'}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Tipo:</label>
                                <Badge className="ml-2">{selectedClient.type}</Badge>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Región:</label>
                                <p>{selectedClient.region || 'No especificada'}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Sede:</label>
                                <p>{selectedClient.sede || 'No especificada'}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Ciudad:</label>
                                <p>{selectedClient.ciudad || 'No especificada'}</p>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-green-600" />
                                Ubicación y Contacto
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div>
                                <label className="text-sm font-medium text-gray-500">Dirección:</label>
                                <p className="flex items-start gap-2">
                                  <MapIcon className="w-4 h-4 mt-1 text-gray-400" />
                                  {selectedClient.address}
                                </p>
                              </div>
                              {selectedClient.telefono && (
                                <div>
                                  <label className="text-sm font-medium text-gray-500">Teléfono:</label>
                                  <p className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-gray-400" />
                                    {selectedClient.telefono}
                                  </p>
                                </div>
                              )}
                              {selectedClient.email && (
                                <div>
                                  <label className="text-sm font-medium text-gray-500">Email:</label>
                                  <p className="flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-gray-400" />
                                    {selectedClient.email}
                                  </p>
                                </div>
                              )}
                              {selectedClient.contacto && (
                                <div>
                                  <label className="text-sm font-medium text-gray-500">Contacto:</label>
                                  <p className="flex items-center gap-2">
                                    <UserCheck className="w-4 h-4 text-gray-400" />
                                    {selectedClient.contacto}
                                  </p>
                                </div>
                              )}
                              <div>
                                <label className="text-sm font-medium text-gray-500">Tiempo estimado:</label>
                                <Badge variant="outline" className="ml-2">
                                  <Clock className="w-4 h-4 mr-1" />
                                  {selectedClient.estimatedTime} min
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="flex justify-center pt-4">
                          <Button
                            onClick={() => handleStartVisit(selectedClient)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2"
                            disabled={selectedClient.status !== 'pendiente'}
                          >
                            <Target className="w-5 h-5 mr-2" />
                            {selectedClient.status === 'pendiente' ? 'Iniciar Visita' : 'Ya Visitado'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <UserCheck className="mx-auto h-16 w-16 text-gray-300" />
                        <h3 className="mt-4 text-lg font-semibold text-gray-700">Selecciona un cliente</h3>
                        <p className="mt-2 text-gray-500">
                          Haz clic en el botón de detalles junto a cualquier cliente para ver su información completa.
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="calendario" className="space-y-4 mt-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 mb-4">
                        <CalendarDays className="w-6 h-6 text-blue-600" />
                        <h2 className="text-2xl font-bold text-gray-800">Historial de Rutas</h2>
                      </div>
                      
                      {calendarData.length > 0 ? (
                        <>
                          <div className="grid grid-cols-7 gap-2 mb-4">
                            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dia => (
                              <div key={dia} className="text-center text-sm font-semibold text-gray-500 p-2">
                                {dia}
                              </div>
                            ))}
                          </div>
                          
                          <div className="grid grid-cols-7 gap-2 max-h-96 overflow-y-auto">
                            {calendarData.slice().reverse().map((rutaInfo, index) => {
                              const fecha = parseISO(rutaInfo.fecha);
                              const diaDelMes = format(fecha, 'd');
                              const esHoy = isSameDay(fecha, new Date());
                              const tieneActividad = rutaInfo.rutasCompletadas > 0 || rutaInfo.visitasRealizadas > 0;
                              
                              return (
                                <div
                                  key={rutaInfo.fecha}
                                  className={`
                                    p-2 rounded-lg border-2 text-center relative cursor-pointer hover:scale-105 transition-transform
                                    ${getCalendarDayColor(rutaInfo)}
                                    ${esHoy ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                                  `}
                                  title={`${format(fecha, 'EEEE, dd MMMM', { locale: es })}${tieneActividad ? 
                                    `\n✅ ${rutaInfo.rutasCompletadas} rutas completadas\n📋 ${rutaInfo.visitasRealizadas} visitas realizadas` : 
                                    '\nSin actividad registrada'}`}
                                >
                                  <div className="text-lg font-bold">{diaDelMes}</div>
                                  {tieneActividad && (
                                    <div className="text-xs mt-1 space-y-0.5">
                                      {rutaInfo.rutasCompletadas > 0 && (
                                        <div className="flex items-center justify-center gap-1">
                                          <span>🛣️</span>
                                          <span>{rutaInfo.rutasCompletadas}</span>
                                        </div>
                                      )}
                                      {rutaInfo.visitasRealizadas > 0 && (
                                        <div className="flex items-center justify-center gap-1">
                                          <span>📋</span>
                                          <span>{rutaInfo.visitasRealizadas}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {esHoy && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full"></div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Leyenda mejorada */}
                          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <h4 className="font-semibold text-sm text-gray-700 mb-3">Leyenda del Calendario:</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              <div>
                                <h5 className="font-medium text-gray-600 mb-2">Estados:</h5>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded"></div>
                                    <span>Con actividad completada</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-300 rounded"></div>
                                    <span>Rutas en progreso</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 bg-gray-50 border-2 border-gray-200 rounded"></div>
                                    <span>Sin actividad</span>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <h5 className="font-medium text-gray-600 mb-2">Símbolos:</h5>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span>🛣️</span>
                                    <span>Rutas completadas</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span>📋</span>
                                    <span>Visitas realizadas</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    <span>Día actual</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
                              💡 <strong>Tip:</strong> Pasa el cursor sobre cualquier día para ver detalles de tu actividad
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-12">
                          <CalendarDays className="mx-auto h-16 w-16 text-gray-300" />
                          <h3 className="mt-4 text-lg font-semibold text-gray-700">Sin historial disponible</h3>
                          <p className="mt-2 text-gray-500">
                            Aún no tienes rutas registradas en el historial.
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="prospecto" className="space-y-4 mt-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 mb-4">
                        <UserPlus className="w-6 h-6 text-green-600" />
                        <h2 className="text-2xl font-bold text-gray-800">Registrar Cliente Prospecto</h2>
                      </div>
                      
                      <Card>
                        <CardContent className="p-4 sm:p-6">
                          <div className="text-center space-y-3 sm:space-y-4">
                            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                              <UserPlus className="w-8 h-8 text-green-600" />
                            </div>
                            <div>
                              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                                ¿Encontraste un nuevo punto de venta?
                              </h3>
                              <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 px-2">
                                Registra clientes potenciales que encuentres durante tu ruta para futuras visitas
                              </p>
                            </div>
                            <Button 
                              onClick={handleClienteProspecto}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base w-full max-w-xs mx-auto"
                              size="sm"
                            >
                              <UserPlus className="w-4 h-4 mr-1 sm:mr-2" />
                              <span className="hidden sm:inline">Registrar Nuevo Prospecto</span>
                              <span className="sm:hidden">Nuevo Prospecto</span>
                            </Button>
                          </div>
                          
                          <div className="mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg">
                            <h4 className="font-semibold text-blue-800 mb-2 text-sm sm:text-base">¿Qué información necesitas capturar?</h4>
                            <ul className="text-xs sm:text-sm text-blue-700 space-y-1">
                              <li>• 🏪 Nombre del negocio *</li>
                              <li>• 📍 Dirección exacta *</li>
                              <li>• 🏷️ Tipo de negocio *</li>
                              <li>• 📞 Teléfono (opcional)</li>
                              <li>• 📸 Foto del establecimiento (opcional)</li>
                              <li>• 📝 Comentarios adicionales (opcional)</li>
                              <li>• 🗺️ Ubicación GPS automática</li>
                            </ul>
                            <p className="text-xs text-blue-600 mt-2 font-medium">* Campos obligatorios</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <Card className="shadow-lg">
          <CardFooter className="flex justify-center p-4">
            <LogoutButton className="w-full max-w-xs" />
          </CardFooter>
        </Card>
      </div>

      {/* Diálogo para Cliente Cerrado */}
      <Dialog open={isClienteSerradoDialogOpen} onOpenChange={setIsClienteSerradoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DoorClosed className="w-5 h-5 text-red-500" />
              Cliente Cerrado
            </DialogTitle>
            <DialogDescription>
              Registra que el cliente {currentPointForCerrado?.name} está cerrado
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Foto del cliente cerrado */}
            <div className="space-y-2">
              <Label>Foto del Cliente Cerrado *</Label>
              {fotoCerrado ? (
                <div className="space-y-2">
                  <img 
                    src={fotoCerrado} 
                    alt="Cliente cerrado" 
                    className="w-full h-48 object-cover rounded-md border"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFotoCerrado(null)}
                    className="w-full"
                  >
                    Tomar Nueva Foto
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={tomarFotoCerrado}
                  className="w-full"
                  variant="outline"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Tomar Foto
                </Button>
              )}
            </div>

            {/* Razón del cierre */}
            <div className="space-y-2">
              <Label htmlFor="razon-cerrado">Razón del Cierre *</Label>
              <Select value={razonCerrado} onValueChange={setRazonCerrado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una razón" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cerrado-horario">Cerrado por horario</SelectItem>
                  <SelectItem value="cerrado-vacaciones">Cerrado por vacaciones</SelectItem>
                  <SelectItem value="cerrado-inventario">Cerrado por inventario</SelectItem>
                  <SelectItem value="cerrado-mantenimiento">Cerrado por mantenimiento</SelectItem>
                  <SelectItem value="no-atiende">No atiende/No responde</SelectItem>
                  <SelectItem value="otro">Otro motivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Comentarios adicionales */}
            <div className="space-y-2">
              <Label htmlFor="comentarios-cerrado">Comentarios Adicionales</Label>
              <Textarea
                id="comentarios-cerrado"
                placeholder="Detalles adicionales sobre el cierre..."
                value={comentariosCerrado}
                onChange={(e) => setComentariosCerrado(e.target.value)}
                rows={3}
              />
            </div>

            {/* Botones */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsClienteSerradoDialogOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={guardarClienteCerrado}
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={!fotoCerrado || !razonCerrado}
              >
                Registrar Cierre
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo para Cliente Prospecto */}
      <Dialog open={isClienteProspectoDialogOpen} onOpenChange={setIsClienteProspectoDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto mx-2">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              Registrar Cliente Prospecto
            </DialogTitle>
            <DialogDescription className="text-sm">
              Captura información de un nuevo punto de venta potencial
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 sm:space-y-4">
            {/* Foto del prospecto */}
            <div className="space-y-2">
              <Label className="text-sm">Foto del Establecimiento (Opcional)</Label>
              {fotoProspecto ? (
                <div className="space-y-2">
                  <img 
                    src={fotoProspecto} 
                    alt="Cliente prospecto" 
                    className="w-full h-48 object-cover rounded-md border"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFotoProspecto(null)}
                    className="w-full"
                  >
                    Tomar Nueva Foto
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={tomarFotoProspecto}
                  className="w-full"
                  variant="outline"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Tomar Foto
                </Button>
              )}
            </div>

            {/* Nombre del negocio */}
            <div className="space-y-2">
              <Label htmlFor="nombre-prospecto" className="text-sm font-medium">Nombre del Negocio *</Label>
              <Input
                id="nombre-prospecto"
                placeholder="Ej: Farmacia San José"
                value={nombreProspecto}
                onChange={(e) => setNombreProspecto(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Dirección */}
            <div className="space-y-2">
              <Label htmlFor="direccion-prospecto" className="text-sm font-medium">Dirección *</Label>
              <Textarea
                id="direccion-prospecto"
                placeholder="Dirección completa del establecimiento"
                value={direccionProspecto}
                onChange={(e) => setDireccionProspecto(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            {/* Teléfono */}
            <div className="space-y-2">
              <Label htmlFor="telefono-prospecto" className="text-sm font-medium">Teléfono (Opcional)</Label>
              <Input
                id="telefono-prospecto"
                placeholder="Ej: 0414-1234567"
                value={telefonoProspecto}
                onChange={(e) => setTelefonoProspecto(e.target.value)}
                className="text-sm"
                type="tel"
              />
            </div>

            {/* Tipo de negocio */}
            <div className="space-y-2">
              <Label htmlFor="tipo-negocio" className="text-sm font-medium">Tipo de Negocio *</Label>
              <Select value={tipoNegocioProspecto} onValueChange={setTipoNegocioProspecto}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Selecciona el tipo de negocio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="farmacia">Farmacia</SelectItem>
                  <SelectItem value="supermercado">Supermercado</SelectItem>
                  <SelectItem value="abastos">Abastos</SelectItem>
                  <SelectItem value="licoreria">Licorería</SelectItem>
                  <SelectItem value="ferreteria">Ferretería</SelectItem>
                  <SelectItem value="autorepuestos">Autorepuestos</SelectItem>
                  <SelectItem value="taller">Taller Mecánico</SelectItem>
                  <SelectItem value="estacion-servicio">Estación de Servicio</SelectItem>
                  <SelectItem value="minimarket">Minimarket</SelectItem>
                  <SelectItem value="bodega">Bodega</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Comentarios adicionales */}
            <div className="space-y-2">
              <Label htmlFor="comentarios-prospecto" className="text-sm font-medium">Comentarios Adicionales</Label>
              <Textarea
                id="comentarios-prospecto"
                placeholder="Observaciones, horarios, contactos, etc..."
                value={comentariosProspecto}
                onChange={(e) => setComentariosProspecto(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            {/* Botones */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsClienteProspectoDialogOpen(false)}
                className="flex-1 text-sm h-9"
              >
                Cancelar
              </Button>
              <Button
                onClick={guardarClienteProspecto}
                className="flex-1 bg-green-600 hover:bg-green-700 text-sm h-9"
                disabled={!nombreProspecto.trim() || !direccionProspecto.trim() || !tipoNegocioProspecto}
              >
                Registrar Prospecto
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo para seleccionar ubicación GPS */}
      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Ubicación GPS Requerida
            </DialogTitle>
            <DialogDescription>
              El cliente <strong>{currentPointForLocation?.name}</strong> no tiene coordenadas GPS guardadas. 
              Usa tu ubicación actual para registrar la visita:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Única opción: Usar ubicación actual */}
            <Card className="cursor-pointer hover:bg-blue-50 border-blue-200 transition-colors">
              <CardContent className="p-4">
                <Button
                  onClick={handleUseCurrentLocation}
                  disabled={isGettingLocation}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  size="lg"
                >
                  {isGettingLocation ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Obteniendo ubicación...
                    </>
                  ) : (
                    <>
                      <Navigation className="w-5 h-5 mr-2" />
                      Usar Mi Ubicación Actual
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-600 mt-2 text-center">
                  Utiliza el GPS de tu dispositivo para obtener tu ubicación actual
                </p>
              </CardContent>
            </Card>

            {/* Información adicional */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <p className="font-medium mb-1">¿Por qué necesitamos la ubicación?</p>
                  <p>Las coordenadas GPS son necesarias para registrar la visita correctamente y actualizar la base de datos del cliente para futuras rutas.</p>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsLocationDialogOpen(false);
                  setCurrentPointForLocation(null);
                }}
                className="text-gray-600"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}