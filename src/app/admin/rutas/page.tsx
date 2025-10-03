"use client";

import { useState, useEffect, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { GoogleMaps } from '@/components/ui/google-maps';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { collection, getDocs, query, orderBy, where, addDoc, doc, setDoc, Timestamp, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/clientApp';
import { useToast } from '@/hooks/use-toast';
import { type Route, type RoutePoint, type Cliente, type EventoIndependiente } from '@/types/routes';
import { obtenerUltimasVisitasUsuarios } from '@/services/visitas';
import type { Visita } from '@/types/visitas';
import { getCurrentUserWithPermissions, UserData, UserPermissions, canAccessSede } from '@/services/auth';
import { sendNotificationToUsers } from '@/services/notifications';
import { sendNuevaRutaEmail } from '@/services/emailNotifications';
import { PlusCircle, Loader2, Filter, UserCircle, Search, MapPin, Trash2, Edit3, AlertCircle, ChevronUp, ChevronDown, ArrowLeft } from 'lucide-react';

// Coordenadas por sede para centrar el mapa
const SEDE_COORDINATES: Record<string, { lat: number; lng: number; zoom: number }> = {
  'GRUPO DISBATTERY': { lat: 10.4806, lng: -66.9036, zoom: 11 }, // Caracas
  'BLITZ 2000': { lat: 10.1621, lng: -68.0077, zoom: 10 }, // Valencia
  'GRUPO VICTORIA': { lat: 10.6427, lng: -71.6125, zoom: 9 }, // Maracaibo
  'DISBATTERY': { lat: 8.2976, lng: -62.7176, zoom: 9 }, // Puerto Ordaz (Oriente)
};

// Coordenadas para toda Venezuela (vista general)
const VENEZUELA_CENTER = { lat: 6.4238, lng: -66.5897, zoom: 6 };

// Interfaz para usuarios de Firestore
interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'Mercaderista' | 'Administrador';
  sede: string;
  status?: 'active' | 'pending_approval' | 'rejected'; // ✅ Campo status
}

// Datos iniciales vacíos - las rutas se cargarán desde Firestore
const initialRoutes: Route[] = [];

export default function RutasPage() {
  const [routes, setRoutes] = useState<Route[]>(initialRoutes);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  // Removidos estados innecesarios que causaban conflictos
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoadingClientes, setIsLoadingClientes] = useState(true);
  const [isSelectingCliente, setIsSelectingCliente] = useState(false);
  const { toast } = useToast();

  // Nueva ruta
  const [newRoute, setNewRoute] = useState({
    mercaderista: '',
    mercaderistoId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    points: [] as RoutePoint[]
  });

  // Estado para filtros y ordenamiento en el modal de clientes
  const [filterRif, setFilterRif] = useState('');
  const [filterNombre, setFilterNombre] = useState('');
  const [filterCiudad, setFilterCiudad] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterLastVisit, setFilterLastVisit] = useState('todos'); // '7', '15', '30', 'todos'
  const [orderAsc, setOrderAsc] = useState(false);
  const [ultimasVisitasClientes, setUltimasVisitasClientes] = useState<Record<string, Visita | null>>({});

  // Estado para edición de ruta
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [routeToEdit, setRouteToEdit] = useState<Route | null>(null);

  // Estado para selección de tipo de visita al agregar cliente
  const [isSelectingVisitType, setIsSelectingVisitType] = useState(false);
  const [selectedClienteForVisitType, setSelectedClienteForVisitType] = useState<Cliente | null>(null);
  const [selectedVisitTypeForClient, setSelectedVisitTypeForClient] = useState<'Merchandising' | 'Trade (Eventos)' | 'Trade (Impulso)'>('Merchandising');
  const [selectedMarcaForVisitType, setSelectedMarcaForVisitType] = useState<'Shell' | 'Qualid' | ''>('');

  // Estados para gestión de eventos independientes
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [eventos, setEventos] = useState<EventoIndependiente[]>([]);
  const [selectedEvento, setSelectedEvento] = useState<EventoIndependiente | null>(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    nombreEvento: '',
    mercaderistas: [] as string[],
    mercaderistasIds: [] as string[],
    fechaInicio: format(new Date(), 'yyyy-MM-dd'),
    fechaFin: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    duracionDias: 1,
    direccion: '',
    descripcion: '',
    marcasTrabajadas: [] as ('Shell' | 'Qualid')[]
  });

  // Estados para usuario actual y permisos
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);

  // Cargar datos del usuario actual
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const result = await getCurrentUserWithPermissions();
        if (result) {
          setCurrentUser(result.user);
          setUserPermissions(result.permissions);
          console.log('✅ USUARIO ACTUAL CARGADO:');
          console.log('   - Nombre:', result.user.fullName);
          console.log('   - Email:', result.user.email);
          console.log('   - Rol:', result.user.role);
          console.log('   - Sede:', result.user.sede);
          console.log('   - Región:', result.user.region);
          console.log('   - Es Admin Master:', result.permissions.isAdminMaster);
          console.log('   - Sedes permitidas:', result.permissions.allowedSedes);
        }
      } catch (error) {
        console.error('Error cargando datos del usuario:', error);
      }
    };

    loadUserData();
  }, []);

  // Cargar usuarios de Firestore filtrados por sede
  useEffect(() => {
    const fetchUsers = async () => {
      // Solo cargar usuarios si ya tenemos datos del usuario actual
      if (!currentUser || !userPermissions) {
        console.log('⏳ Esperando datos del usuario actual antes de cargar mercaderistas...');
        return;
      }

      try {
        console.log('🔄 Cargando usuarios de Firestore...');
        console.log('🔐 Usuario actual:', currentUser);
        console.log('🔐 Permisos actuales:', userPermissions);
        
        const usersCollectionRef = collection(db, 'users');
        const q = query(usersCollectionRef, orderBy('fullName', 'asc'));
        const querySnapshot = await getDocs(q);
        const fetchedUsers: User[] = [];
        
        console.log(`📊 Encontrados ${querySnapshot.docs.length} documentos en la colección users`);
        
        querySnapshot.forEach((userDoc) => {
          const data = userDoc.data();
          
          // ✅ FILTRO CRÍTICO: Solo usuarios con cuenta activa
          const userStatus = data.status || 'active'; // Usuarios viejos sin status = activos
          if (userStatus !== 'active') {
            console.log(`🚫 Usuario ${data.fullName} con status "${userStatus}" - EXCLUIDO (solo usuarios activos pueden recibir rutas)`);
            return; // Saltar este usuario
          }
          
          // Solo incluir usuarios que el usuario actual puede gestionar
          let canIncludeUser = false;
          
          console.log(`🔍 Evaluando usuario:`, {
            fullName: data.fullName,
            role: data.role,
            status: userStatus,
            sede: data.sede || 'SIN_SEDE',
            sedeDelUsuarioActual: currentUser.sede,
            isAdminMaster: userPermissions.isAdminMaster
          });
          
          if (userPermissions.isAdminMaster) {
            // Admin Master ve todo
            canIncludeUser = true;
            console.log(`👑 Admin Master - Incluyendo usuario:`, data.fullName);
          } else if (data.role === 'Mercaderista') {
            if (!data.sede) {
              // Si el mercaderista no tiene sede, EXCLUIRLO (no incluir automáticamente)
              console.log(`❌ Mercaderista ${data.fullName} SIN sede - EXCLUIDO (falta asignación de sede)`);
              canIncludeUser = false;
            } else {
              // Para mercaderistas con sede, verificar si están en una sede permitida
              canIncludeUser = canAccessSede(currentUser, data.sede);
              console.log(`🎯 Verificando mercaderista ${data.fullName} de sede "${data.sede}" vs sede actual "${currentUser.sede}": ${canIncludeUser ? 'INCLUIDO' : 'EXCLUIDO'}`);
            }
          }
          
          if (canIncludeUser) {
            fetchedUsers.push({
              id: userDoc.id,
              fullName: data.fullName,
              email: data.email,
              role: data.role,
              sede: data.sede,
              status: userStatus // ✅ Incluir status
            });
          }
        });
        
        console.log(`✅ Total usuarios cargados tras filtro: ${fetchedUsers.length}`);
        console.log(`🎯 Mercaderistas filtrados:`, fetchedUsers.filter(u => u.role === 'Mercaderista'));
        
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("❌ Error fetching users:", error);
        toast({
          variant: 'destructive',
          title: 'Error al Cargar Usuarios',
          description: 'No se pudieron cargar los usuarios de Firestore. Revisa la consola para más detalles.',
        });
      } finally {
        setIsLoadingUsers(false);
      }
    };
    
    fetchUsers();
  }, [toast, currentUser, userPermissions]); // Dependencias actualizadas

  // Filtrar solo mercaderistas usando useMemo para evitar re-renderizado infinito
  const mercaderistas = useMemo(() => {
    return users.filter(user => user.role === 'Mercaderista');
  }, [users]);

  // Cargar clientes de Firestore filtrados por sede
  useEffect(() => {
    const fetchClientes = async () => {
      // Solo cargar clientes si ya tenemos datos del usuario actual
      if (!currentUser || !userPermissions) {
        console.log('⏳ Esperando datos del usuario actual antes de cargar clientes...');
        return;
      }

      try {
        console.log('🔄 Cargando clientes de Firestore...');
        console.log('🔐 Usuario actual para clientes:', currentUser);
        console.log('🔐 Permisos actuales para clientes:', userPermissions);
        
        const clientesCollectionRef = collection(db, 'clientes');
        const q = query(clientesCollectionRef, orderBy('nombre', 'asc'));
        const querySnapshot = await getDocs(q);
        const fetchedClientes: Cliente[] = [];
        
        console.log(`📊 Encontrados ${querySnapshot.docs.length} documentos en la colección clientes`);
        
        querySnapshot.forEach((clienteDoc) => {
          const data = clienteDoc.data();
          
          // Solo incluir clientes que el usuario actual puede gestionar
          let canIncludeCliente = false;
          
          console.log(`🔍 Evaluando cliente:`, {
            rif: data.rif,
            nombre: data.nombre,
            sede: data.sede || 'SIN_SEDE',
            sedeDelUsuarioActual: currentUser.sede,
            isAdminMaster: userPermissions.isAdminMaster
          });
          
          if (userPermissions.isAdminMaster) {
            // Admin Master ve todos los clientes
            canIncludeCliente = true;
            console.log(`👑 Admin Master - Incluyendo cliente:`, data.nombre);
          } else if (!data.sede) {
            // Si el cliente no tiene sede, EXCLUIRLO (no incluir automáticamente)
            console.log(`❌ Cliente ${data.nombre} SIN sede - EXCLUIDO (falta asignación de sede)`);
            canIncludeCliente = false;
          } else {
            // Para administradores de sede, verificar si el cliente pertenece a una sede permitida
            canIncludeCliente = canAccessSede(currentUser, data.sede);
            console.log(`🏢 Verificando cliente ${data.nombre} de sede "${data.sede}" vs sede actual "${currentUser.sede}": ${canIncludeCliente ? 'INCLUIDO' : 'EXCLUIDO'}`);
          }
          
          if (canIncludeCliente) {
            fetchedClientes.push({
              id: clienteDoc.id,
              rif: data.rif,
              nombre: data.nombre,
              direccion: data.direccion,
              telefono: data.telefono,
              email: data.email,
              contacto: data.contacto,
              region: data.region,
              sede: data.sede,
              ciudad: data.ciudad,
              position: data.position,
              tipo: data.tipo,
              estado: data.estado,
              observaciones: data.observaciones,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
              createdBy: data.createdBy,
              lastVisitDate: data.lastVisitDate
            });
          }
        });
        
        console.log(`✅ Total clientes cargados tras filtro: ${fetchedClientes.length}`);
        
        setClientes(fetchedClientes);

        // Por ahora comentamos la carga de visitas para evitar errores
        // TODO: Implementar correctamente la carga de visitas por cliente
        console.log('Clientes cargados exitosamente:', fetchedClientes.length);
      } catch (error) {
        console.error("❌ Error fetching clientes:", error);
        toast({
          variant: 'destructive',
          title: 'Error al Cargar Clientes',
          description: 'No se pudieron cargar los clientes de Firestore. Revisa la consola para más detalles.',
        });
      } finally {
        setIsLoadingClientes(false);
      }
    };
    
    fetchClientes();
  }, [toast, currentUser, userPermissions]); // Dependencias actualizadas para clientes

  // Cargar rutas en tiempo real con Firebase filtradas por sede
  useEffect(() => {
    // Solo cargar rutas si ya tenemos datos del usuario actual y mercaderistas
    if (!currentUser || !userPermissions || mercaderistas.length === 0) {
      console.log('⏳ Esperando datos del usuario y mercaderistas antes de cargar rutas...');
      return;
    }

    console.log('🔄 Configurando listener de rutas en tiempo real filtradas por sede...');
    console.log('🔐 Usuario actual para rutas:', currentUser.fullName, 'Sede:', currentUser.sede);
    console.log('🎯 Mercaderistas disponibles:', mercaderistas.map(m => `${m.fullName} (${m.sede})`));
    
    const routesCollectionRef = collection(db, 'routes');
    const q = query(routesCollectionRef, orderBy('date', 'desc'));
    
    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        console.log(`📊 Rutas encontradas en base de datos: ${querySnapshot.docs.length}`);
        
        const fetchedRoutes: Route[] = [];
        const allowedMercaderistasIds = new Set(mercaderistas.map(m => m.id));
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          
          // ✅ FILTRO CRÍTICO: Solo incluir rutas de mercaderistas que el usuario puede gestionar
          const canIncludeRoute = userPermissions.isAdminMaster || allowedMercaderistasIds.has(data.mercaderistoId);
          
          console.log(`🔍 Evaluando ruta: ${data.mercaderista} (ID: ${data.mercaderistoId}) - ${canIncludeRoute ? 'INCLUIDA' : 'EXCLUIDA'}`);
          
          if (canIncludeRoute) {
            fetchedRoutes.push({
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
          }
        });
        
        setRoutes(fetchedRoutes);
        console.log(`✅ ${fetchedRoutes.length} rutas cargadas tras filtro de sede`);
      },
      (error) => {
        console.error('❌ Error en listener de rutas:', error);
        toast({
          variant: 'destructive',
          title: 'Error en Tiempo Real',
          description: 'No se pudieron cargar las rutas en tiempo real.',
        });
      }
    );
    
    // Cleanup listener cuando el componente se desmonte
    return () => {
      console.log('🧹 Limpiando listener de rutas');
      unsubscribe();
    };
  }, [toast, currentUser, userPermissions, mercaderistas]);

  // Cargar eventos independientes en tiempo real
  useEffect(() => {
    // Solo cargar eventos si ya tenemos datos del usuario actual
    if (!currentUser || !userPermissions) {
      console.log('⏳ Esperando datos del usuario actual antes de cargar eventos...');
      return;
    }

    console.log('🔄 Configurando listener de eventos en tiempo real filtrados por sede...');
    console.log('🔐 Usuario actual para eventos:', currentUser.fullName, 'Sede:', currentUser.sede);
    console.log('🎯 Mercaderistas disponibles:', mercaderistas.map(m => `${m.fullName} (${m.sede})`));
    
    const eventosCollectionRef = collection(db, 'eventos');
    const q = query(eventosCollectionRef, orderBy('fechaInicio', 'desc'));
    
    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        console.log(`📊 Eventos encontrados en base de datos: ${querySnapshot.docs.length}`);
        
        const fetchedEventos: EventoIndependiente[] = [];
        const allowedMercaderistasIds = new Set(mercaderistas.map(m => m.id));
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          
          // ✅ FILTRO CRÍTICO: Solo incluir eventos de mercaderistas que el usuario puede gestionar
          const mercaderistasIds = data.mercaderistasIds || [data.mercaderistoId]; // Compatibilidad con formato anterior
          const canIncludeEvento = userPermissions.isAdminMaster || 
            mercaderistasIds.some((id: string) => allowedMercaderistasIds.has(id));
          
          console.log(`🔍 Evaluando evento: ${data.nombreEvento} (Mercaderistas IDs: ${mercaderistasIds.join(', ')}) - ${canIncludeEvento ? 'INCLUIDO' : 'EXCLUIDO'}`);
          
          if (canIncludeEvento) {
            fetchedEventos.push({
              id: doc.id,
              nombreEvento: data.nombreEvento,
              mercaderistas: data.mercaderistas || [data.mercaderista], // Compatibilidad con formato anterior
              mercaderistasIds: data.mercaderistasIds || [data.mercaderistoId], // Compatibilidad con formato anterior
              fechaInicio: data.fechaInicio,
              fechaFin: data.fechaFin,
              duracionDias: data.duracionDias || 1,
              ubicacion: data.ubicacion,
              direccion: data.direccion,
              descripcion: data.descripcion,
              tipoEvento: 'Trade (Eventos)',
              status: data.status || 'planificado',
              createdAt: data.createdAt?.toDate(),
              createdBy: data.createdBy
            });
          }
        });
        
        setEventos(fetchedEventos);
        console.log(`✅ ${fetchedEventos.length} eventos cargados tras filtro de sede`);
      },
      (error) => {
        console.error('❌ Error en listener de eventos:', error);
        toast({
          variant: 'destructive',
          title: 'Error en Tiempo Real',
          description: 'No se pudieron cargar los eventos en tiempo real.',
        });
      }
    );
    
    // Cleanup listener cuando el componente se desmonte
    return () => {
      console.log('🧹 Limpiando listener de eventos');
      unsubscribe();
    };
  }, [toast, currentUser, userPermissions, mercaderistas]);

  // Filtrar rutas por fecha seleccionada usando useMemo para optimizar rendimiento
  const routesForSelectedDate = useMemo(() => {
    return routes.filter(
      route => route.date === format(selectedDate, 'yyyy-MM-dd')
    );
  }, [routes, selectedDate]);

  // Convertir cliente a punto de ruta con tipo de visita
  const convertClienteToRoutePoint = (cliente: Cliente, tipoVisita: 'Merchandising' | 'Trade (Eventos)' | 'Trade (Impulso)'): RoutePoint => {
    // ✅ CORRECCIÓN CRÍTICA: Generar ID súper único que incluya fecha de la ruta
    const timestamp = Date.now();
    const routeDate = newRoute.date.replace(/-/g, ''); // Remover guiones de la fecha
    const tipoVisitaSlug = tipoVisita.toLowerCase().replace(/[^a-z]/g, '');
    const uniqueId = `cliente-${cliente.id}-${routeDate}-${tipoVisitaSlug}-${timestamp}`;
    
    console.log('🔧 [Admin] Generando punto de ruta ÚNICO:', {
      clienteId: cliente.id,
      uniqueId: uniqueId,
      tipoVisita: tipoVisita,
      clienteNombre: cliente.nombre,
      fechaRuta: newRoute.date,
      timestamp: timestamp
    });
    
    // Determinar marca trabajada para este punto específico
    const marcaTrabajada = tipoVisita === 'Trade (Impulso)' 
      ? selectedMarcaForVisitType 
      : undefined;
    
    return {
      id: uniqueId, // ✅ ID súper único con fecha de ruta incluida
      name: cliente.nombre,
      address: cliente.direccion,
      position: cliente.position,
      type: 'cliente',
      estimatedTime: 30, // tiempo por defecto
      status: 'pendiente',
      tipoVisita: tipoVisita, // Agregar tipo de visita seleccionado
      ...(marcaTrabajada && { marcaTrabajada }), // Solo incluir si no es undefined
      // Incluir todos los datos del cliente
      rif: cliente.rif,
      nombreCliente: cliente.nombre,
      telefono: cliente.telefono,
      email: cliente.email,
      contacto: cliente.contacto,
      region: cliente.region,
      sede: cliente.sede,
      ciudad: cliente.ciudad,
      tipo: cliente.tipo
    };
  };

  // Iniciar selección de tipo de visita para cliente
  const initiateClienteSelection = (cliente: Cliente) => {
    // ✅ Permitir agregar el mismo cliente múltiples veces en una ruta
    // Comentado: validación que impedía duplicar clientes
    // const isAlreadyInRoute = newRoute.points.some(point => 
    //   point.rif && cliente.rif && point.rif.trim().toUpperCase() === cliente.rif.trim().toUpperCase()
    // );
    // if (isAlreadyInRoute) {
    //   toast({
    //     variant: 'destructive',
    //     title: 'Cliente ya agregado',
    //     description: 'Este cliente ya está en la ruta.',
    //   });
    //   return;
    // }

    setSelectedClienteForVisitType(cliente);
    setSelectedVisitTypeForClient('Merchandising'); // Valor por defecto
    setSelectedMarcaForVisitType(''); // Resetear marca
    setIsSelectingVisitType(true);
  };

  // Agregar cliente existente a la ruta con tipo de visita
  const addExistingClienteToRoute = (cliente: Cliente, tipoVisita: 'Merchandising' | 'Trade (Eventos)' | 'Trade (Impulso)') => {
    const routePoint = convertClienteToRoutePoint(cliente, tipoVisita);

    setNewRoute(currentRoute => ({
      ...currentRoute,
      points: [...currentRoute.points, routePoint]
    }));

    setIsSelectingCliente(false);
    setIsSelectingVisitType(false);
    setSelectedClienteForVisitType(null);
    
    toast({
      title: 'Cliente agregado',
      description: `${cliente.nombre} ha sido agregado a la ruta con tipo de visita: ${tipoVisita}.`,
    });
  };

  // Función handleMapClick removida - ya no se necesita

  // Función para obtener el centro del mapa según el mercaderista seleccionado
  const getMapCenter = () => {
    if (!newRoute.mercaderista) {
      return VENEZUELA_CENTER;
    }
    
    const selectedUser = users.find(user => user.fullName === newRoute.mercaderista);
    if (selectedUser?.sede && SEDE_COORDINATES[selectedUser.sede]) {
      return SEDE_COORDINATES[selectedUser.sede];
    }
    
    return VENEZUELA_CENTER;
  };

  // Funciones para reordenar puntos de la ruta
  const movePointUp = (index: number) => {
    if (index === 0) return;
    setNewRoute(prev => {
      const newPoints = [...prev.points];
      [newPoints[index - 1], newPoints[index]] = [newPoints[index], newPoints[index - 1]];
      return { ...prev, points: newPoints };
    });
  };

  const movePointDown = (index: number) => {
    if (index === newRoute.points.length - 1) return;
    setNewRoute(prev => {
      const newPoints = [...prev.points];
      [newPoints[index], newPoints[index + 1]] = [newPoints[index + 1], newPoints[index]];
      return { ...prev, points: newPoints };
    });
  };

  // Funciones auxiliares para la gestión de rutas
  const removePointFromRoute = (pointId: string) => {
    setNewRoute(prev => ({
      ...prev,
      points: prev.points.filter(p => p.id !== pointId)
    }));
  };

  const editRoute = (route: Route) => {
    setRouteToEdit(route);
    setNewRoute({
      mercaderista: route.mercaderista,
      mercaderistoId: route.mercaderistoId,
      date: route.date,
      points: route.points
    });
    setIsEditingRoute(true);
    setIsDialogOpen(true);
  };

  const deleteRoute = async (routeId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta ruta?')) return;
    
    try {
      await deleteDoc(doc(db, 'routes', routeId));
      toast({
        title: 'Ruta eliminada',
        description: 'La ruta ha sido eliminada correctamente.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al eliminar ruta',
        description: 'No se pudo eliminar la ruta.',
      });
    }
  };

  const addClienteWithVisitType = () => {
    if (!selectedClienteForVisitType || !selectedVisitTypeForClient) {
      toast({
        variant: 'destructive',
        title: 'Datos Incompletos',
        description: 'Selecciona un cliente y tipo de visita.',
      });
      return;
    }

    // Validar marca para tipos de visita Trade
    if (selectedVisitTypeForClient === 'Trade (Impulso)' && !selectedMarcaForVisitType) {
      toast({
        variant: 'destructive',
        title: 'Marca Requerida',
        description: 'Debes seleccionar una marca para eventos Trade.',
      });
      return;
    }

    // ✅ PERMITIR CLIENTES DUPLICADOS: Comentado para permitir agregar el mismo cliente múltiples veces
    // Esto es útil cuando un cliente maneja múltiples marcas (Shell + Qualid) y necesita visitas separadas
    // const isAlreadyInRoute = newRoute.points.some(point => 
    //   point.rif && selectedClienteForVisitType.rif && 
    //   point.rif.trim().toUpperCase() === selectedClienteForVisitType.rif.trim().toUpperCase()
    // );
    // if (isAlreadyInRoute) {
    //   toast({
    //     variant: 'destructive',
    //     title: 'Cliente ya agregado',
    //     description: 'Este cliente ya está en la ruta.',
    //   });
    //   return;
    // }

    const routePoint = convertClienteToRoutePoint(selectedClienteForVisitType, selectedVisitTypeForClient);
    
    setNewRoute(currentRoute => ({
      ...currentRoute,
      points: [...currentRoute.points, routePoint]
    }));

    setIsSelectingVisitType(false);
    setSelectedClienteForVisitType(null);
    setSelectedMarcaForVisitType('');
    // Verificar si es un cliente duplicado para personalizar el mensaje
    const duplicateCount = newRoute.points.filter(p => 
      p.rif && selectedClienteForVisitType.rif && 
      p.rif.trim().toUpperCase() === selectedClienteForVisitType.rif.trim().toUpperCase()
    ).length;
    
    const isMultipleVisit = duplicateCount > 0;
    
    toast({
      title: isMultipleVisit ? 'Cliente agregado nuevamente' : 'Cliente agregado',
      description: isMultipleVisit 
        ? `${selectedClienteForVisitType.nombre} ha sido agregado como punto adicional (${duplicateCount + 1}° visita) con tipo: ${selectedVisitTypeForClient}.`
        : `${selectedClienteForVisitType.nombre} ha sido agregado a la ruta con tipo de visita: ${selectedVisitTypeForClient}.`,
    });
  };

  // Funciones para gestión de eventos
  const deleteEvento = async (eventoId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este evento?')) return;
    
    try {
      await deleteDoc(doc(db, 'eventos', eventoId));
      toast({
        title: 'Evento eliminado',
        description: 'El evento ha sido eliminado correctamente.',
      });
      setSelectedEvento(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al eliminar evento',
        description: 'No se pudo eliminar el evento.',
      });
    }
  };

  const editEvento = (evento: EventoIndependiente) => {
    // Migración: si existe marcaTrabajada (singular), convertir a marcasTrabajadas (plural)
    let marcasTrabajadas: ('Shell' | 'Qualid')[] = [];
    if (evento.marcasTrabajadas) {
      marcasTrabajadas = evento.marcasTrabajadas;
    } else if ((evento as any).marcaTrabajada) {
      // Migrar datos antiguos
      marcasTrabajadas = [(evento as any).marcaTrabajada];
    }
    
    setNewEvent({
      nombreEvento: evento.nombreEvento,
      mercaderistas: evento.mercaderistas,
      mercaderistasIds: evento.mercaderistasIds,
      fechaInicio: evento.fechaInicio,
      fechaFin: evento.fechaFin,
      duracionDias: evento.duracionDias,
      direccion: evento.direccion || '',
      descripcion: evento.descripcion || '',
      marcasTrabajadas: marcasTrabajadas
    });
    setIsEditingEvent(true);
    setIsEventDialogOpen(true);
  };

  // Crear nueva ruta y guardar en Firestore
  const createNewRoute = async () => {
    if (!newRoute.mercaderista || newRoute.points.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Datos Incompletos',
        description: 'Selecciona un mercaderista y agrega al menos un punto.',
      });
      return;
    }

    if (newRoute.points.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No hay Puntos de Venta',
            description: 'Debes agregar al menos un punto a la ruta antes de crearla.',
        });
        return;
    }

    try {
      // Buscar el ID del mercaderista seleccionado
      const selectedUser = mercaderistas.find(user => user.fullName === newRoute.mercaderista);
      if (!selectedUser) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se encontró el mercaderista seleccionado.',
        });
        return;
      }

      // Determinar si la ruta tiene eventos y asignar marca trabajada
      const hasTradeEvents = newRoute.points.some(point => 
        point.tipoVisita === 'Trade (Impulso)'
      );
      
              // Si hay eventos, no asignar marca por defecto
        const marcaTrabajada = undefined;

      const routeData = {
        mercaderista: newRoute.mercaderista,
        mercaderistoId: selectedUser.id,
        date: newRoute.date,
        points: newRoute.points,
        status: 'planificada' as const,
        totalDistance: Math.random() * 50 + 10, // Simulado por ahora
        totalTime: newRoute.points.reduce((total, point) => total + point.estimatedTime, 0),
        ...(marcaTrabajada ? { marcaTrabajada } : {}), // Solo incluir si no es undefined
        createdAt: Timestamp.now(),
        createdBy: 'admin' // Por ahora hardcodeado
      };

      // Guardar en Firestore
      const docRef = await addDoc(collection(db, 'routes'), routeData);
      
      // ✅ MEJORA: Guardar también en localStorage para uso offline
      const routeWithId = {
        ...routeData,
        id: docRef.id
      };
      
      // Guardar en localStorage bajo la clave que usa el merchandiser
      const savedRoutes = localStorage.getItem('todaysRoutesOffline');
      let existingRoutes = [];
      if (savedRoutes) {
        existingRoutes = JSON.parse(savedRoutes);
      }
      
      // Agregar la nueva ruta a las existentes
      existingRoutes.push(routeWithId);
      localStorage.setItem('todaysRoutesOffline', JSON.stringify(existingRoutes));
      
      console.log('💾 Ruta guardada en localStorage para uso offline:', routeWithId);
      
      // 🔔 Enviar notificación al mercaderista
      try {
        console.log('📨 Intentando enviar notificación de nueva ruta');
        console.log('👤 Datos del mercaderista seleccionado:', {
          id: selectedUser.id,
          name: selectedUser.fullName,
          email: selectedUser.email,
          role: selectedUser.role,
          sede: selectedUser.sede
        });
        
        // 📧 NUEVA FUNCIONALIDAD: Enviar notificación por EMAIL
        const emailData = {
          mercaderista_nombre: selectedUser.fullName,
          mercaderista_email: selectedUser.email,
          admin_nombre: currentUser?.fullName || 'Administrador',
          admin_email: currentUser?.email || '',
          fecha_ruta: format(parseISO(newRoute.date), 'dd/MM/yyyy', { locale: es }),
          puntos_cantidad: newRoute.points.length,
          sede: selectedUser.sede || 'GRUPO DISBATTERY'
        };
        
        console.log('📧 Enviando email de nueva ruta con datos:', emailData);
        
        const emailSent = await sendNuevaRutaEmail(emailData);
        
        if (emailSent) {
          console.log('✅ Email enviado correctamente al mercaderista');
          toast({
            title: 'Ruta Creada',
            description: `✅ Ruta creada y email enviado a ${selectedUser.fullName}`,
          });
        } else {
          console.log('⚠️ Ruta creada pero no se pudo enviar email');
          toast({
            title: 'Ruta Creada',
            description: `✅ Ruta creada correctamente. ⚠️ Hubo un problema enviando el email.`,
          });
        }
      } catch (emailError) {
        console.error('❌ Error enviando email:', emailError);
        toast({
          title: 'Ruta Creada',
          description: `✅ Ruta creada correctamente. Las notificaciones por email están en configuración.`,
        });
      }

      // Las rutas se actualizarán automáticamente en tiempo real
      // await fetchRoutes(); // Ya no necesario con listener en tiempo real
      setNewRoute({
        mercaderista: '',
        mercaderistoId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        points: []
      });
      setIsDialogOpen(false);
      setIsEditingRoute(false);
      setRouteToEdit(null);

    } catch (error) {
      console.error("Error creating route:", error);
      toast({
        variant: 'destructive',
        title: 'Error al Crear Ruta',
        description: 'No se pudo guardar la ruta en Firestore.',
      });
    }
  };

  // Obtener color del estado
  const getStatusColor = (status: Route['status']) => {
    switch (status) {
      case 'planificada': return 'bg-blue-100 text-blue-800';
      case 'en_progreso': return 'bg-yellow-100 text-yellow-800';
      case 'completada': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Obtener texto legible del estado  
  const getStatusText = (status: Route['status']) => {
    switch (status) {
      case 'planificada': return 'Planificada';
      case 'en_progreso': return 'En Proceso';
      case 'completada': return 'Finalizada';
      default: return 'Desconocido';
    }
  };

  // Función para actualizar el status de una ruta
  const updateRouteStatus = async (routeId: string, newStatus: Route['status']) => {
    try {
      console.log(`🔄 Cambiando status de ruta ${routeId} a: ${newStatus}`);
      
      const routeRef = doc(db, 'routes', routeId);
      await updateDoc(routeRef, {
        status: newStatus,
        updatedAt: Timestamp.now(),
        [`${newStatus}At`]: Timestamp.now() // Guardar timestamp del cambio
      });

      toast({
        title: 'Estado actualizado',
        description: `La ruta cambió a: ${getStatusText(newStatus)}`,
      });

      console.log(`✅ Status actualizado a: ${newStatus}`);
    } catch (error) {
      console.error('❌ Error actualizando status:', error);
      toast({
        variant: 'destructive',
        title: 'Error al actualizar',
        description: 'No se pudo cambiar el estado de la ruta.',
      });
    }
  };

  // Función para iniciar una ruta (cambiar a 'en_progreso')
  const startRoute = async (routeId: string) => {
    await updateRouteStatus(routeId, 'en_progreso');
  };

  // Función para completar una ruta (cambiar a 'completada')  
  const completeRoute = async (routeId: string) => {
    await updateRouteStatus(routeId, 'completada');
  };

  // Función para volver a planificada (si es necesario)
  const resetRouteToPlanned = async (routeId: string) => {
    await updateRouteStatus(routeId, 'planificada');
  };

  // Obtener color del tipo de punto
  const getPointTypeColor = (type: RoutePoint['type']) => {
    switch (type) {
      case 'cliente': return 'bg-green-100 text-green-800';
      case 'distribuidor': return 'bg-blue-100 text-blue-800';
      case 'oficina': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Función para filtrar y ordenar clientes usando useMemo para optimizar rendimiento
  const filteredClientes = useMemo(() => {
    return clientes
      .filter(cliente => {
        // Filtro por RIF
        if (filterRif && !cliente.rif?.toLowerCase().includes(filterRif.toLowerCase())) return false;
        // Filtro por nombre
        if (filterNombre && !cliente.nombre?.toLowerCase().includes(filterNombre.toLowerCase())) return false;
        // Filtro por ciudad
        if (filterCiudad && !cliente.ciudad?.toLowerCase().includes(filterCiudad.toLowerCase())) return false;
        // Filtro por fecha de última visita (rango)
        if (filterDateFrom && cliente.lastVisitDate) {
          if (new Date(cliente.lastVisitDate) < new Date(filterDateFrom)) return false;
        }
        if (filterDateTo && cliente.lastVisitDate) {
          if (new Date(cliente.lastVisitDate) > new Date(filterDateTo)) return false;
        }
        // Filtro por tiempo desde la última visita
        if (filterLastVisit && filterLastVisit !== 'todos') {
          if (filterLastVisit === 'nunca') {
            // Solo mostrar clientes que nunca han sido visitados
            if (cliente.lastVisitDate) return false;
          } else {
            // Filtrar por días desde la última visita
            if (!cliente.lastVisitDate) return true; // Sin fecha = nunca visitado, incluir en filtros de tiempo
            const dias = parseInt(filterLastVisit, 10);
            const diff = (Date.now() - new Date(cliente.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24);
            if (diff < dias) return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        // Priorizar clientes sin visitas (nunca visitados) al principio cuando orderAsc = false
        if (!a.lastVisitDate && !b.lastVisitDate) return 0; // Ambos sin visitas
        if (!a.lastVisitDate) return orderAsc ? 1 : -1; // A sin visitas: al final si asc, al principio si desc
        if (!b.lastVisitDate) return orderAsc ? -1 : 1; // B sin visitas: al final si asc, al principio si desc
        
        // Ambos tienen fechas, ordenar normalmente
        const dateA = new Date(a.lastVisitDate).getTime();
        const dateB = new Date(b.lastVisitDate).getTime();
        return orderAsc ? dateA - dateB : dateB - dateA;
      });
  }, [clientes, filterRif, filterNombre, filterCiudad, filterDateFrom, filterDateTo, filterLastVisit, orderAsc]);

  // Función para eliminar ruta
  const handleDeleteRoute = async (routeId: string) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta ruta?')) return;
    try {
      await deleteDoc(doc(db, 'routes', routeId));
      
      // ✅ MEJORA: Eliminar también de localStorage para uso offline
      const savedRoutes = localStorage.getItem('todaysRoutesOffline');
      if (savedRoutes) {
        let existingRoutes = JSON.parse(savedRoutes);
        existingRoutes = existingRoutes.filter((r: any) => r.id !== routeId);
        localStorage.setItem('todaysRoutesOffline', JSON.stringify(existingRoutes));
        console.log('💾 Ruta eliminada de localStorage para uso offline');
      }
      
      toast({ title: 'Ruta eliminada', description: 'La ruta fue eliminada correctamente. ✅ Sincronizado offline.' });
      // Actualización automática en tiempo real - sin necesidad de recargar
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al eliminar ruta', description: 'No se pudo eliminar la ruta.' });
    }
  };

  // Función para iniciar edición de ruta
  const handleEditRoute = (route: Route) => {
    setRouteToEdit(route);
    setNewRoute({
      mercaderista: route.mercaderista,
      mercaderistoId: route.mercaderistoId,
      date: route.date,
      points: route.points
    });
    setIsEditingRoute(true);
    setIsDialogOpen(true);
  };

  // Guardar cambios de edición
  const saveEditedRoute = async () => {
    if (!routeToEdit) return;
    try {
      await updateDoc(doc(db, 'routes', routeToEdit.id), {
        mercaderista: newRoute.mercaderista,
        mercaderistoId: newRoute.mercaderistoId,
        date: newRoute.date,
        points: newRoute.points,
        status: 'planificada',
        totalDistance: Math.random() * 50 + 10,
        totalTime: newRoute.points.reduce((total, point) => total + point.estimatedTime, 0),
        updatedAt: Timestamp.now()
      });
      
      // ✅ MEJORA: Actualizar también en localStorage para uso offline
      const savedRoutes = localStorage.getItem('todaysRoutesOffline');
      if (savedRoutes) {
        let existingRoutes = JSON.parse(savedRoutes);
        
        // Buscar y actualizar la ruta específica
        const routeIndex = existingRoutes.findIndex((r: any) => r.id === routeToEdit.id);
        if (routeIndex !== -1) {
          existingRoutes[routeIndex] = {
            ...existingRoutes[routeIndex],
            mercaderista: newRoute.mercaderista,
            mercaderistoId: newRoute.mercaderistoId,
            date: newRoute.date,
            points: newRoute.points,
            status: 'planificada',
            totalDistance: Math.random() * 50 + 10,
            totalTime: newRoute.points.reduce((total, point) => total + point.estimatedTime, 0),
            updatedAt: Timestamp.now()
          };
          
          localStorage.setItem('todaysRoutesOffline', JSON.stringify(existingRoutes));
          console.log('💾 Ruta actualizada en localStorage para uso offline');
        }
      }
      
      // 🔔 NUEVA FUNCIONALIDAD: Enviar notificación al mercaderista sobre la edición de la ruta
      try {
        const selectedUser = mercaderistas.find(user => user.fullName === newRoute.mercaderista);
        if (selectedUser) {
          console.log('📨 Enviando notificación de ruta editada al mercaderista:', selectedUser.fullName);
          
          const notificationData = {
            title: '✏️ Ruta Actualizada',
            body: `Tu ruta del ${newRoute.date} ha sido modificada. Revisa los cambios en la app.`,
            icon: '/icon-base.svg',
            badge: '/icon-base.svg',
            data: {
              type: 'ruta-editada',
              routeId: routeToEdit.id,
              mercaderista: selectedUser.fullName,
              fecha: newRoute.date,
              puntos: newRoute.points.length,
              sede: selectedUser.sede || 'GRUPO DISBATTERY'
            }
          };
          
          console.log('📨 Datos de notificación de edición preparados:', notificationData);
          
          const notificationSent = await sendNotificationToUsers([selectedUser.id], notificationData);
          
          if (notificationSent) {
            console.log('✅ Notificación de edición enviada correctamente');
            toast({ 
              title: 'Ruta actualizada', 
              description: `✅ Ruta actualizada y notificación enviada a ${selectedUser.fullName}. Disponible offline.` 
            });
          } else {
            console.log('⚠️ Ruta actualizada pero no se pudo notificar');
            toast({ 
              title: 'Ruta actualizada', 
              description: `✅ Ruta actualizada correctamente. ⚠️ ${selectedUser.fullName} debe abrir la app para recibir notificaciones. Disponible offline.` 
            });
          }
        }
      } catch (notificationError) {
        console.error('❌ Error enviando notificación de edición:', notificationError);
        toast({ 
          title: 'Ruta actualizada', 
          description: 'La ruta fue actualizada correctamente. Las notificaciones están en configuración. ✅ Disponible offline.' 
        });
      }
      
      setIsEditingRoute(false);
      setRouteToEdit(null);
      setIsDialogOpen(false);
      // Actualización automática en tiempo real - sin necesidad de recargar
      setNewRoute({ mercaderista: '', mercaderistoId: '', date: format(new Date(), 'yyyy-MM-dd'), points: [] });
      setIsEditingRoute(false);
      setRouteToEdit(null);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al actualizar ruta', description: 'No se pudo actualizar la ruta.' });
    }
  };

  // Función para limpiar el estado de la nueva ruta
  const resetNewRoute = () => {
    setNewRoute({
      mercaderista: '',
      mercaderistoId: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      points: []
    });
  };

  // Modificar setIsDialogOpen para limpiar el estado al cerrar
  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setIsEditingRoute(false);
      setRouteToEdit(null);
      resetNewRoute();
    }
  };

  // Al abrir el modal para crear nueva ruta, limpiar el estado
  const handleNewRoute = () => {
    resetNewRoute();
    setIsEditingRoute(false);
    setRouteToEdit(null);
    setIsDialogOpen(true);
  };

  // Funciones para manejar eventos independientes
  const resetNewEvent = () => {
    setNewEvent({
      nombreEvento: '',
      mercaderistas: [],
      mercaderistasIds: [],
      fechaInicio: format(new Date(), 'yyyy-MM-dd'),
      fechaFin: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      duracionDias: 1,
      direccion: '',
      descripcion: '',
      marcasTrabajadas: []
    });
  };

  const handleNewEvent = () => {
    resetNewEvent();
    setIsEditingEvent(false); // ✅ Asegurar que es modo crear, no editar
    setSelectedEvento(null);
    setIsEventDialogOpen(true);
  };

  const createOrUpdateEvent = async () => {
    if (!newEvent.nombreEvento || newEvent.mercaderistas.length === 0 || newEvent.marcasTrabajadas.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Datos Incompletos',
        description: 'Completa el nombre del evento, selecciona al menos un mercaderista y al menos una marca.',
      });
      return;
    }

    try {
      // Crear fechas en zona horaria local para evitar problemas de UTC
      const fechaInicioLocal = new Date(newEvent.fechaInicio + 'T00:00:00');
      const fechaFinLocal = new Date(newEvent.fechaFin + 'T23:59:59');
      
      // Calcular duración en días usando fechas locales
      const duracionDias = Math.max(1, Math.ceil((fechaFinLocal.getTime() - fechaInicioLocal.getTime()) / (1000 * 60 * 60 * 24)));

      const eventoData = {
        nombreEvento: newEvent.nombreEvento,
        mercaderistas: newEvent.mercaderistas,
        mercaderistasIds: newEvent.mercaderistasIds,
        // Guardar como strings para mantener la fecha exacta seleccionada
        fechaInicio: newEvent.fechaInicio,
        fechaFin: newEvent.fechaFin,
        duracionDias: duracionDias,
        direccion: newEvent.direccion || '',
        descripcion: newEvent.descripcion || '',
        marcasTrabajadas: newEvent.marcasTrabajadas,
        tipoEvento: 'Trade (Eventos)' as const,
        status: isEditingEvent ? selectedEvento?.status || 'planificado' : 'planificado' as const,
        ...(isEditingEvent ? {} : { createdAt: Timestamp.now() }),
        createdBy: currentUser?.email || 'admin'
      };

      if (isEditingEvent && selectedEvento) {
        // Actualizar evento existente
        await updateDoc(doc(db, 'eventos', selectedEvento.id), eventoData);
        toast({
          title: 'Evento Actualizado',
          description: `El evento "${newEvent.nombreEvento}" ha sido actualizado exitosamente.`,
        });
      } else {
        // Crear nuevo evento
        await addDoc(collection(db, 'eventos'), eventoData);
        toast({
          title: 'Evento Creado',
          description: `El evento "${newEvent.nombreEvento}" ha sido creado exitosamente.`,
        });
      }

      resetNewEvent();
      setIsEventDialogOpen(false);
      setIsEditingEvent(false);
      setSelectedEvento(null);

    } catch (error) {
      console.error("Error saving event:", error);
      toast({
        variant: 'destructive',
        title: `Error al ${isEditingEvent ? 'Actualizar' : 'Crear'} Evento`,
        description: 'No se pudo guardar el evento.',
      });
    }
  };

  // Filtrar eventos por fecha seleccionada usando useMemo para optimizar rendimiento
  const eventsForSelectedDate = useMemo(() => {
    return eventos.filter(evento => {
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      return selectedDateStr >= evento.fechaInicio && selectedDateStr <= evento.fechaFin;
    });
  }, [eventos, selectedDate]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = '/admin/dashboard'}
            className="flex items-center gap-2 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Gestión de Rutas y Eventos</h1>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button onClick={handleNewRoute}>📍 Nueva Ruta</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Crear Nueva Ruta</DialogTitle>
                <DialogDescription>
                  Selecciona un mercaderista y fecha para crear una nueva ruta.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Formulario de nueva ruta */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="mercaderista">Mercaderista *</Label>
                    <Select
                      value={newRoute.mercaderista}
                      onValueChange={(value) => {
                        const selectedUser = users.find(user => user.fullName === value);
                        setNewRoute({
                          ...newRoute,
                          mercaderista: value,
                          mercaderistoId: selectedUser?.id || ''
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar mercaderista" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.fullName}>
                            <div className="flex items-center space-x-2">
                              <UserCircle className="h-4 w-4" />
                              <span>{user.fullName}</span>
                              {user.sede && (
                                <Badge variant="outline" className="text-xs">
                                  {user.sede}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="route-date">Fecha de la Ruta *</Label>
                    <Input
                      id="route-date"
                      type="date"
                      value={newRoute.date}
                      onChange={(e) => setNewRoute({ ...newRoute, date: e.target.value })}
                    />
                  </div>



                  {/* Vista previa de puntos de ruta */}
                  <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-blue-900">Puntos de la Ruta</h3>
                          <p className="text-sm text-blue-600">
                            {newRoute.points.length} punto{newRoute.points.length !== 1 ? 's' : ''} agregado{newRoute.points.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => setIsSelectingCliente(true)}
                        variant="outline"
                        size="sm"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Agregar Cliente
                      </Button>
                    </div>
                  </div>

                  {/* Lista de puntos agregados */}
                  <div className="space-y-4">
                    {newRoute.points.length === 0 ? (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">No hay puntos agregados</span>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        Tiempo estimado total: {newRoute.points.reduce((total, point) => total + point.estimatedTime, 0)} minutos
                      </div>
                    )}

                    {newRoute.points.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                        <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">No hay puntos en la ruta</p>
                        <p className="text-gray-500 text-sm">Haz clic en "Agregar Cliente" para comenzar</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {newRoute.points.map((point, index) => (
                          <div key={point.id} className="flex items-center bg-white border border-gray-200 p-4 rounded-lg hover:shadow-sm transition-shadow">
                            {/* Número de orden */}
                            <div className="flex items-center space-x-2 mr-4">
                              <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">
                                {index + 1}
                              </div>
                              <div className="flex flex-col">
                                <ChevronUp 
                                  className={`h-4 w-4 cursor-pointer hover:text-blue-600 ${index === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500'}`}
                                  onClick={() => index > 0 && movePointUp(index)}
                                />
                                <ChevronDown 
                                  className={`h-4 w-4 cursor-pointer hover:text-blue-600 ${index === newRoute.points.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500'}`}
                                  onClick={() => index < newRoute.points.length - 1 && movePointDown(index)}
                                />
                              </div>
                            </div>

                            {/* Información del punto */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-900 truncate">{point.name}</h4>
                                {/* Indicador de cliente duplicado */}
                                {(() => {
                                  const duplicateCount = newRoute.points.filter(p => p.rif && point.rif && p.rif === point.rif).length;
                                  if (duplicateCount > 1) {
                                    const duplicateIndex = newRoute.points.filter((p, idx) => p.rif && point.rif && p.rif === point.rif && idx <= index).length;
                                    return (
                                      <Badge className="bg-purple-100 text-purple-800 text-xs">
                                        🔄 Visita {duplicateIndex}/{duplicateCount}
                                      </Badge>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <p className="text-sm text-gray-500 line-clamp-1">{point.address}</p>
                              {point.rif && (
                                <p className="text-xs text-gray-400 font-mono">{point.rif}</p>
                              )}
                              {point.telefono && (
                                <p className="text-xs text-gray-500">📞 {point.telefono}</p>
                              )}
                            </div>
                            
                            {/* Badges y acciones */}
                            <div className="flex items-center space-x-2 ml-4">
                              <div className="flex flex-col space-y-1">
                                <Badge className={`${getPointTypeColor(point.type)} text-xs`}>
                                  {point.type}
                                </Badge>
                                {point.tipoVisita && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                    {point.tipoVisita}
                                  </Badge>
                                )}
                                {/* Mostrar marca trabajada si existe */}
                                {point.marcaTrabajada && (
                                  <Badge className={`text-xs ${
                                    point.marcaTrabajada === 'Shell' 
                                      ? 'bg-yellow-100 text-yellow-800' 
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {point.marcaTrabajada === 'Shell' ? '🐚 Shell' : '🔧 Qualid'}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                                {point.estimatedTime}min
                              </span>
                              <Button
                                onClick={() => removePointFromRoute(point.id)}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between">
                      <Button 
                        variant="outline" 
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      
                      <div className="space-x-2">
                        {isEditingRoute && (
                          <Button 
                            onClick={saveEditedRoute}
                            disabled={!newRoute.mercaderista || !newRoute.date || newRoute.points.length === 0}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Guardar Cambios
                          </Button>
                        )}
                        
                        {!isEditingRoute && (
                          <Button 
                            onClick={createNewRoute}
                            disabled={!newRoute.mercaderista || !newRoute.date || newRoute.points.length === 0}
                          >
                            Crear Ruta
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mapa de vista previa */}
                <div>
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 mb-2">Vista Previa de la Ruta</h3>
                    <GoogleMaps
                      center={VENEZUELA_CENTER}
                      zoom={6}
                      markers={newRoute.points.map((point, index) => ({
                        id: point.id,
                        position: point.position,
                        title: `${index + 1}. ${point.name}`,
                        info: `<div class="p-2">
                          <h4 class="font-semibold">${point.name}</h4>
                          <p class="text-sm text-gray-600">${point.address}</p>
                          ${point.rif ? `<p class="text-xs text-gray-500">RIF: ${point.rif}</p>` : ''}
                          ${point.telefono ? `<p class="text-xs text-gray-500">Tel: ${point.telefono}</p>` : ''}
                          ${point.tipoVisita ? `<div class="mt-1"><span class="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">${point.tipoVisita}</span></div>` : ''}
                        </div>`
                      }))}
                    />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNewEvent} variant="outline">
                🎪 Nuevo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {isEditingEvent ? '✏️ Editar Evento Trade' : '🎪 Crear Nuevo Evento'}
                </DialogTitle>
                <DialogDescription>
                  {isEditingEvent 
                    ? 'Modifica los detalles del evento Trade seleccionado.' 
                    : 'Crea un evento Trade independiente (no asociado a clientes específicos)'
                  }
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="nombreEvento">Nombre del Evento *</Label>
                    <Input
                      id="nombreEvento"
                      value={newEvent.nombreEvento}
                      onChange={(e) => setNewEvent({ ...newEvent, nombreEvento: e.target.value })}
                      placeholder="Ej: Lanzamiento Producto XYZ"
                    />
                  </div>

                                     <div>
                     <Label htmlFor="mercaderistas-evento">Mercaderistas Asociados *</Label>
                     <div className="space-y-2">
                       {newEvent.mercaderistas.length > 0 && (
                         <div className="flex flex-wrap gap-2">
                           {newEvent.mercaderistas.map((mercaderista, index) => (
                             <Badge key={index} variant="outline" className="flex items-center gap-1">
                               {mercaderista}
                               <button
                                 type="button"
                                 onClick={() => {
                                   const newMercaderistas = newEvent.mercaderistas.filter((_, i) => i !== index);
                                   const newMercaderistasIds = newEvent.mercaderistasIds.filter((_, i) => i !== index);
                                   setNewEvent({
                                     ...newEvent,
                                     mercaderistas: newMercaderistas,
                                     mercaderistasIds: newMercaderistasIds
                                   });
                                 }}
                                 className="ml-1 text-red-500 hover:text-red-700"
                               >
                                 ×
                               </button>
                             </Badge>
                           ))}
                         </div>
                       )}
                       <Select
                         onValueChange={(value) => {
                           const selectedUser = users.find(user => user.fullName === value);
                           if (selectedUser && !newEvent.mercaderistas.includes(value)) {
                             setNewEvent({
                               ...newEvent,
                               mercaderistas: [...newEvent.mercaderistas, value],
                               mercaderistasIds: [...newEvent.mercaderistasIds, selectedUser.id]
                             });
                           }
                         }}
                       >
                         <SelectTrigger>
                           <SelectValue placeholder="Agregar mercaderista" />
                         </SelectTrigger>
                         <SelectContent>
                           {users
                             .filter(user => !newEvent.mercaderistas.includes(user.fullName))
                             .map((user) => (
                             <SelectItem key={user.id} value={user.fullName}>
                               <div className="flex items-center space-x-2">
                                 <UserCircle className="h-4 w-4" />
                                 <span>{user.fullName}</span>
                                 {user.sede && (
                                   <Badge variant="outline" className="text-xs">
                                     {user.sede}
                                   </Badge>
                                 )}
                               </div>
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     </div>
                   </div>

                  <div>
                    <Label htmlFor="fechaInicio">Fecha de Inicio *</Label>
                    <Input
                      id="fechaInicio"
                      type="date"
                      value={newEvent.fechaInicio}
                      onChange={(e) => setNewEvent({ ...newEvent, fechaInicio: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="fechaFin">Fecha de Fin *</Label>
                    <Input
                      id="fechaFin"
                      type="date"
                      value={newEvent.fechaFin}
                      onChange={(e) => setNewEvent({ ...newEvent, fechaFin: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="direccion-evento">Dirección del Evento</Label>
                    <Input
                      id="direccion-evento"
                      value={newEvent.direccion}
                      onChange={(e) => setNewEvent({ ...newEvent, direccion: e.target.value })}
                      placeholder="Ej: Centro Comercial XYZ, Local 123"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label className="font-medium">Marcas a Trabajar *</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Seleccione las marcas que se trabajarán en este evento. Puede seleccionar ambas.
                    </p>
                    <div className="space-y-3">
                      {['Shell', 'Qualid'].map(marca => (
                        <label key={marca} className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={newEvent.marcasTrabajadas.includes(marca as 'Shell' | 'Qualid')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewEvent({
                                  ...newEvent,
                                  marcasTrabajadas: [...newEvent.marcasTrabajadas, marca as 'Shell' | 'Qualid']
                                });
                              } else {
                                setNewEvent({
                                  ...newEvent,
                                  marcasTrabajadas: newEvent.marcasTrabajadas.filter(m => m !== marca)
                                });
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium">{marca}</span>
                        </label>
                      ))}
                    </div>
                    {newEvent.marcasTrabajadas.length === 0 && (
                      <p className="text-sm text-red-600 mt-2">
                        ⚠️ Seleccione al menos una marca.
                      </p>
                    )}
                    {newEvent.marcasTrabajadas.length > 0 && (
                      <p className="text-sm text-green-600 mt-2">
                        ✓ Marcas seleccionadas: {newEvent.marcasTrabajadas.join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="descripcion-evento">Descripción</Label>
                    <Input
                      id="descripcion-evento"
                      value={newEvent.descripcion}
                      onChange={(e) => setNewEvent({ ...newEvent, descripcion: e.target.value })}
                      placeholder="Descripción del evento (opcional)"
                    />
                  </div>
                </div>

                <div className="text-sm text-gray-600 bg-orange-50 p-3 rounded-lg">
                  <strong>Nota:</strong> Los eventos Trade son independientes y no están asociados a clientes específicos. 
                  Se mostrarán en el calendario como actividades separadas.
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsEventDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                     onClick={createOrUpdateEvent}
                     disabled={!newEvent.nombreEvento || newEvent.mercaderistas.length === 0 || newEvent.marcasTrabajadas.length === 0}
                   >
                     {isEditingEvent ? 'Actualizar Evento' : 'Crear Evento'}
                   </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendario */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>📅 Calendario</span>
            </CardTitle>
            <CardDescription>
              Selecciona una fecha para ver las rutas programadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              locale={es}
              className="rounded-md"
            />
            
            <div className="mt-4 space-y-2">
              {routesForSelectedDate.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">Rutas del día</h4>
                  {routesForSelectedDate.map(route => (
                    <div key={route.id} className="text-sm flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="font-medium">{route.mercaderista}</span>
                      </div>
                      <Badge 
                        className={route.status === 'completada' ? 'bg-green-100 text-green-800' : 
                                   route.status === 'en_progreso' ? 'bg-blue-100 text-blue-800' : 
                                   'bg-gray-100 text-gray-800'}
                      >
                        {route.status === 'completada' ? '✓ Completada' : 
                         route.status === 'en_progreso' ? '⏳ En Progreso' : 
                         '📋 Planificada'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {eventsForSelectedDate.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">Eventos del día</h4>
                  {eventsForSelectedDate.map(evento => (
                    <div key={evento.id} className="text-sm flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="font-medium">{evento.nombreEvento}</span>
                      </div>
                      <Badge className="bg-orange-100 text-orange-800">
                        🎪 Evento
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de rutas del día seleccionado */}
        <Card>
          <CardHeader>
            <CardTitle>
              Rutas - {format(selectedDate, 'dd/MM/yyyy', { locale: es })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {routesForSelectedDate.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="font-medium">No hay rutas programadas</p>
                <p className="text-sm">para esta fecha</p>
              </div>
            ) : (
              <div className="space-y-4">
                {routesForSelectedDate.map(route => (
                  <div 
                    key={route.id} 
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedRoute?.id === route.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedRoute(route)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{route.mercaderista}</h3>
                        <p className="text-sm text-gray-600">{route.points.length} puntos</p>
                        {route.marcaTrabajada && (
                          <Badge className="bg-blue-100 text-blue-800 text-xs mt-1">
                            🏷️ {route.marcaTrabajada}
                          </Badge>
                        )}
                      </div>
                      <Badge 
                        className={route.status === 'completada' ? 'bg-green-100 text-green-800' : 
                                   route.status === 'en_progreso' ? 'bg-blue-100 text-blue-800' : 
                                   'bg-gray-100 text-gray-800'}
                      >
                        {route.status === 'completada' ? 'Completada' : 
                         route.status === 'en_progreso' ? 'En Progreso' : 
                         'Planificada'}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {route.points.slice(0, 3).map((point, index) => (
                        <div key={point.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs">
                              {index + 1}
                            </span>
                            <span>{point.name}</span>
                            <Badge className={`text-xs ${getPointTypeColor(point.type)}`}>
                              {point.type}
                            </Badge>
                            <div className="flex flex-col gap-1">
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
                          <div className="flex space-x-1">
                            <span className="text-gray-500">{point.estimatedTime}min</span>
                          </div>
                        </div>
                      ))}
                      {route.points.length > 3 && (
                        <div className="text-xs text-gray-500">
                          ... y {route.points.length - 3} puntos más
                        </div>
                      )}
                    </div>

                    <div className="mt-2 space-x-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          editRoute(route);
                        }}
                        variant="outline"
                        size="sm"
                      >
                        <Edit3 className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detalles de la ruta seleccionada */}
        <div className="col-span-full">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>
                    {selectedRoute ? `Detalles: ${selectedRoute.mercaderista}` : 'Selecciona una ruta para ver detalles'}
                  </CardTitle>
                  <CardDescription>
                    {selectedRoute && `${format(parseISO(selectedRoute.date), 'dd/MM/yyyy', { locale: es })} • ${selectedRoute.points.length} puntos`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  {selectedRoute && (
                    <>
                      <Badge className="text-sm">
                        {selectedRoute.status === 'completada' ? '✓ Completada' : 
                         selectedRoute.status === 'en_progreso' ? '⏳ En Progreso' : 
                         '📋 Planificada'}
                      </Badge>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => editRoute(selectedRoute)}
                          variant="outline"
                          size="sm"
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          onClick={() => deleteRoute(selectedRoute.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedRoute ? (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="font-medium">Selecciona una ruta del calendario</p>
                  <p className="text-sm">para ver sus detalles completos</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
                  {/* Lista detallada de puntos */}
                  <div className="lg:col-span-1">
                    <h3 className="font-semibold mb-4">Puntos de la Ruta</h3>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {selectedRoute.points.map((point, index) => (
                        <div key={point.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                              {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-medium text-gray-900 truncate">{point.name}</h4>
                              <p className="text-sm text-gray-600 line-clamp-2">{point.address}</p>
                              
                              {point.rif && (
                                <p className="text-xs text-gray-500 font-mono mt-1">RIF: {point.rif}</p>
                              )}
                              
                              {point.telefono && (
                                <p className="text-xs text-gray-500">📞 {point.telefono}</p>
                              )}
                              
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex space-x-2">
                                  <Badge className={getPointTypeColor(point.type)}>
                                    {point.type}
                                  </Badge>
                                  {point.tipoVisita && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                      {point.tipoVisita}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-gray-600 font-medium">
                                  {point.estimatedTime}min
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mapa */}
                  <div className="lg:col-span-2">
                    <h3 className="font-semibold mb-4">Mapa de la Ruta</h3>
                    <GoogleMaps
                      center={selectedRoute.points.length > 0 ? selectedRoute.points[0].position : VENEZUELA_CENTER}
                      zoom={selectedRoute.points.length > 0 ? 12 : 6}
                      markers={selectedRoute.points.map((point, index) => ({
                        id: point.id,
                        position: point.position,
                        title: `${index + 1}. ${point.name}`,
                        info: `<div class="p-3">
                          <h4 class="font-semibold">${point.name}</h4>
                          <p class="text-sm text-gray-600">${point.address}</p>
                          ${point.rif ? `<p class="text-xs text-gray-500">RIF: ${point.rif}</p>` : ''}
                          ${point.telefono ? `<p class="text-xs text-gray-500">Tel: ${point.telefono}</p>` : ''}
                          <div class="flex items-center justify-between mt-2">
                            <span class="inline-block px-2 py-1 text-xs bg-gray-200 rounded">${point.type}</span>
                            ${point.tipoVisita ? `<span class="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">${point.tipoVisita}</span>` : ''}
                            <span class="text-xs text-gray-600">${point.estimatedTime}min</span>
                          </div>
                        </div>`
                      }))}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Resumen estadístico mejorado */}
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-8 mb-8 border border-blue-100 shadow-lg">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              📊 Dashboard de Rendimiento
            </h2>
            <p className="text-lg text-gray-700">
              Resumen del {format(selectedDate, 'dd \'de\' MMMM \'de\' yyyy', { locale: es })}
            </p>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <MapPin className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-blue-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <MapPin className="h-6 w-6 text-blue-600" />
              </div>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200">Programadas</Badge>
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {routesForSelectedDate.length}
            </div>
            <div className="text-sm font-medium text-gray-600">Rutas Programadas</div>
          </div>
          
                     <div className="bg-white rounded-xl p-6 shadow-sm border border-green-200 hover:shadow-md transition-shadow">
             <div className="flex items-center justify-between mb-4">
               <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                 <span className="text-green-600 text-xl">✓</span>
               </div>
               <Badge className="bg-green-50 text-green-700 border-green-200">Completadas</Badge>
             </div>
             <div className="text-3xl font-bold text-green-600 mb-1">
               {routesForSelectedDate.filter(r => r.status === 'completada').length}
             </div>
             <div className="text-sm font-medium text-gray-600">Completadas</div>
           </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-orange-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-orange-600" />
              </div>
              <Badge className="bg-orange-50 text-orange-700 border-orange-200">En Proceso</Badge>
            </div>
            <div className="text-3xl font-bold text-orange-600 mb-1">
              {routesForSelectedDate.filter(r => r.status === 'en_progreso').length}
            </div>
            <div className="text-sm font-medium text-gray-600">En Progreso</div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-purple-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <UserCircle className="h-6 w-6 text-purple-600" />
              </div>
              <Badge className="bg-purple-50 text-purple-700 border-purple-200">Puntos</Badge>
            </div>
            <div className="text-3xl font-bold text-purple-600 mb-1">
              {routesForSelectedDate.reduce((total, route) => total + route.points.length, 0)}
            </div>
            <div className="text-sm font-medium text-gray-600">Total Puntos</div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-indigo-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <PlusCircle className="h-6 w-6 text-indigo-600" />
              </div>
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">Eventos</Badge>
            </div>
            <div className="text-3xl font-bold text-indigo-600 mb-1">
              {eventsForSelectedDate.length}
            </div>
            <div className="text-sm font-medium text-gray-600">Eventos Trade</div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-red-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <Badge className="bg-red-50 text-red-700 border-red-200">Tiempo</Badge>
            </div>
            <div className="text-3xl font-bold text-red-600 mb-1">
              {routesForSelectedDate.reduce((total, route) => 
                total + route.points.reduce((pointTotal, point) => pointTotal + point.estimatedTime, 0), 0
              )}
            </div>
            <div className="text-sm font-medium text-gray-600">Minutos Totales</div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-teal-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                <UserCircle className="h-6 w-6 text-teal-600" />
              </div>
              <Badge className="bg-teal-50 text-teal-700 border-teal-200">Personal</Badge>
            </div>
            <div className="text-3xl font-bold text-teal-600 mb-1">
              {new Set(routesForSelectedDate.map(r => r.mercaderista)).size}
            </div>
            <div className="text-sm font-medium text-gray-600">Mercaderistas</div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-pink-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
                <Filter className="h-6 w-6 text-pink-600" />
              </div>
              <Badge className="bg-pink-50 text-pink-700 border-pink-200">Merchandising</Badge>
            </div>
            <div className="text-3xl font-bold text-pink-600 mb-1">
              {routesForSelectedDate.reduce((total, route) => 
                total + route.points.filter(point => point.tipoVisita === 'Merchandising').length, 0
              )}
            </div>
            <div className="text-sm font-medium text-gray-600">Merchandising</div>
          </div>
        </div>
        
        {/* Barra de progreso general */}
        <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">📈 Progreso del Día</h3>
            <span className="text-sm text-gray-600">
              {routesForSelectedDate.filter(r => r.status === 'completada').length} de {routesForSelectedDate.length} rutas completadas
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ 
                width: routesForSelectedDate.length > 0 ? 
                  `${(routesForSelectedDate.filter(r => r.status === 'completada').length / routesForSelectedDate.length) * 100}%` : 
                  '0%' 
              }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Lista de eventos del día */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                🎪 Eventos Trade del Día
              </h3>
              <p className="text-gray-600">
                {format(selectedDate, 'dd/MM/yyyy', { locale: es })} • {eventsForSelectedDate.length} eventos programados
              </p>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                <PlusCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="overflow-y-auto max-h-96">
            {eventsForSelectedDate.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
                    <PlusCircle className="h-10 w-10 text-orange-500" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">No hay eventos programados</h4>
                  <p className="text-gray-500 mb-4">para esta fecha</p>
                  <Button variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50">
                    Crear Nuevo Evento
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {eventsForSelectedDate.map((evento) => (
                  <div
                    key={evento.id}
                    className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-orange-300"
                    onClick={() => setSelectedEvento(evento)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-bold text-gray-900 line-clamp-2 text-lg">
                        {evento.nombreEvento}
                      </h4>
                      <Badge className="bg-orange-100 text-orange-700 border-orange-300 ml-2">
                        🎪 Evento
                      </Badge>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center text-gray-700">
                        <UserCircle className="h-5 w-5 mr-3 text-orange-600" />
                        <span className="font-medium">{evento.mercaderistas.join(', ')}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-gray-700">
                          <span className="mr-3 text-lg">📅</span>
                          <span className="font-medium">
                            {format(new Date(evento.fechaInicio), 'dd/MM', { locale: es })} - 
                            {format(new Date(evento.fechaFin), 'dd/MM', { locale: es })}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs bg-white border-orange-200">
                          {evento.duracionDias} día{evento.duracionDias !== 1 ? 's' : ''}
                        </Badge>
                      </div>

                      {evento.direccion && (
                        <div className="flex items-center text-gray-700">
                          <MapPin className="h-5 w-5 mr-3 text-orange-600" />
                          <span className="line-clamp-1 font-medium">{evento.direccion}</span>
                        </div>
                      )}

                      {evento.descripcion && (
                        <p className="text-gray-600 text-sm line-clamp-2 mt-3 bg-white bg-opacity-60 p-3 rounded-lg">
                          {evento.descripcion}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-orange-200 mt-4">
                      <Badge 
                        className={
                          evento.status === 'completado' ? 'bg-green-100 text-green-800 border-green-200' : 
                          evento.status === 'en_progreso' ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                          'bg-gray-100 text-gray-800 border-gray-200'
                        }
                      >
                        {evento.status === 'completado' ? '✅ Completado' : 
                         evento.status === 'en_progreso' ? '⏳ En Progreso' : 
                         '📋 Planificado'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

       {/* Dialog para seleccionar clientes - Movido fuera de tabs */}
       <Dialog open={isSelectingCliente} onOpenChange={setIsSelectingCliente}>
         <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
           <DialogHeader className="pb-4 border-b">
             <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
               Seleccionar Cliente Existente
             </DialogTitle>
             <DialogDescription className="text-base text-gray-600">
               Busca y selecciona clientes de tu base de datos para agregarlos a la ruta. 
               Usa los filtros para encontrar rápidamente lo que necesitas.
               <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                 <p className="text-sm text-blue-800 font-medium">
                   💡 <strong>Tip:</strong> Puedes agregar el mismo cliente múltiples veces para diferentes marcas (Shell/Qualid) o tipos de visita.
                 </p>
               </div>
             </DialogDescription>
           </DialogHeader>
           
           <div className="flex-1 flex flex-col overflow-hidden">
             {/* Filtros mejorados */}
             <div className="bg-gray-50 rounded-xl p-6 mb-6">
               <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                 <Filter className="mr-2 h-5 w-5 text-blue-600" />
                 Filtros de Búsqueda
               </h3>
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                 <div>
                   <Label className="text-sm font-medium text-gray-700 mb-2 block">Buscar por nombre</Label>
                   <Input 
                     type="text" 
                     value={filterNombre} 
                     onChange={e => setFilterNombre(e.target.value)} 
                     placeholder="Nombre del cliente..." 
                     className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                   />
                 </div>
                 <div>
                   <Label className="text-sm font-medium text-gray-700 mb-2 block">Buscar por RIF</Label>
                   <Input 
                     type="text" 
                     value={filterRif} 
                     onChange={e => setFilterRif(e.target.value)} 
                     placeholder="Ej: J123456789" 
                     className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                   />
                 </div>
                 <div>
                   <Label className="text-sm font-medium text-gray-700 mb-2 block">Ciudad</Label>
                   <Input 
                     type="text" 
                     value={filterCiudad} 
                     onChange={e => setFilterCiudad(e.target.value)} 
                     placeholder="Caracas, Maracay, Valencia..." 
                     className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                   />
                 </div>
                 <div>
                   <Label className="text-sm font-medium text-gray-700 mb-2 block">Tiempo sin visita</Label>
                   <Select 
                     value={filterLastVisit} 
                     onValueChange={setFilterLastVisit}
                   >
                     <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                       <SelectValue placeholder="Filtrar por visita" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="todos">Todos los clientes</SelectItem>
                       <SelectItem value="nunca">🔴 Nunca visitados</SelectItem>
                       <SelectItem value="7">🟡 +7 días sin visita</SelectItem>
                       <SelectItem value="15">🟠 +15 días sin visita</SelectItem>
                       <SelectItem value="30">🔴 +30 días sin visita</SelectItem>
                       <SelectItem value="60">⚫ +60 días sin visita</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div>
                   <Label className="text-sm font-medium text-gray-700 mb-2 block">Ordenar por visita</Label>
                   <Select 
                     value={orderAsc ? "asc" : "desc"} 
                     onValueChange={(value) => setOrderAsc(value === "asc")}
                   >
                     <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="desc">🔽 Más antiguos primero</SelectItem>
                       <SelectItem value="asc">🔼 Más recientes primero</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>
             </div>

             {/* Lista de clientes mejorada */}
             <div className="flex-1 overflow-hidden flex flex-col">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-semibold text-gray-800">
                   Clientes Disponibles ({filteredClientes.length})
                 </h3>
                 <div className="flex items-center gap-4">
                   {/* Resumen de prioridades */}
                   <div className="flex items-center gap-2 text-xs">
                     {(() => {
                       const neverVisited = filteredClientes.filter(c => !c.lastVisitDate).length;
                       const over60Days = filteredClientes.filter(c => c.lastVisitDate && Math.floor((Date.now() - new Date(c.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24)) >= 60).length;
                       const over30Days = filteredClientes.filter(c => c.lastVisitDate && Math.floor((Date.now() - new Date(c.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24)) >= 30 && Math.floor((Date.now() - new Date(c.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24)) < 60).length;
                       const over15Days = filteredClientes.filter(c => c.lastVisitDate && Math.floor((Date.now() - new Date(c.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24)) >= 15 && Math.floor((Date.now() - new Date(c.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24)) < 30).length;
                       const over7Days = filteredClientes.filter(c => c.lastVisitDate && Math.floor((Date.now() - new Date(c.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24)) >= 7 && Math.floor((Date.now() - new Date(c.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24)) < 15).length;
                       
                       return (
                         <>
                           {neverVisited > 0 && <Badge className="bg-red-100 text-red-800">🔴 {neverVisited} nunca</Badge>}
                           {over60Days > 0 && <Badge className="bg-red-100 text-red-800">⚫ {over60Days} +60d</Badge>}
                           {over30Days > 0 && <Badge className="bg-red-100 text-red-800">🔴 {over30Days} +30d</Badge>}
                           {over15Days > 0 && <Badge className="bg-orange-100 text-orange-800">🟠 {over15Days} +15d</Badge>}
                           {over7Days > 0 && <Badge className="bg-yellow-100 text-yellow-800">🟡 {over7Days} +7d</Badge>}
                         </>
                       );
                     })()}
                   </div>
                   <div className="text-sm text-gray-500">
                     {filteredClientes.length !== clientes.length && (
                       <span>Mostrando {filteredClientes.length} de {clientes.length}</span>
                     )}
                   </div>
                 </div>
               </div>

               <div className="flex-1 overflow-y-auto">
                 {isLoadingClientes ? (
                   <div className="flex items-center justify-center py-12">
                     <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                     <p className="ml-3 text-gray-600">Cargando clientes...</p>
                   </div>
                 ) : clientes.length === 0 ? (
                   <div className="text-center py-12">
                     <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                       <UserCircle className="h-12 w-12 text-gray-400" />
                     </div>
                     <p className="text-lg font-medium text-gray-900 mb-2">No hay clientes disponibles</p>
                     <p className="text-sm text-gray-500">
                       Ve a "Gestión de Clientes" para crear nuevos clientes
                     </p>
                   </div>
                 ) : filteredClientes.length === 0 ? (
                   <div className="text-center py-12">
                     <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                       <Search className="h-12 w-12 text-gray-400" />
                     </div>
                     <p className="text-lg font-medium text-gray-900 mb-2">No se encontraron clientes</p>
                     <p className="text-sm text-gray-500">
                       Intenta ajustar los filtros de búsqueda
                     </p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
                     {filteredClientes.map((cliente) => (
                       <div
                         key={cliente.id}
                         className="group border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-blue-300 hover:shadow-lg transition-all duration-200 bg-white"
                         onClick={() => initiateClienteSelection(cliente)}
                       >
                         <div className="flex justify-between items-start mb-3">
                           <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-2">
                             {cliente.nombre}
                           </h3>
                           <Badge className={`ml-2 flex-shrink-0 ${
                             cliente.tipo === 'tienda' ? 'bg-blue-100 text-blue-800' :
                             cliente.tipo === 'distribuidor' ? 'bg-green-100 text-green-800' :
                             'bg-purple-100 text-purple-800'
                           }`}>
                             {cliente.tipo}
                           </Badge>
                         </div>
                         
                         <div className="space-y-2 text-sm">
                           <p className="text-gray-600 flex items-center">
                             <MapPin className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
                             <span className="line-clamp-1">{cliente.direccion}</span>
                           </p>
                           
                           <div className="flex items-center justify-between">
                             <p className="text-gray-500 text-xs">
                               {cliente.ciudad}, {cliente.region}
                             </p>
                             {cliente.sede && (
                               <Badge variant="outline" className="text-xs">
                                 {cliente.sede}
                               </Badge>
                             )}
                           </div>
                           
                           {cliente.telefono && (
                             <p className="text-gray-500 text-xs flex items-center">
                               📞 {cliente.telefono}
                             </p>
                           )}

                           {cliente.rif && (
                             <p className="text-gray-500 text-xs font-mono">
                               RIF: {cliente.rif}
                             </p>
                           )}
                           
                           <div className="pt-2 border-t border-gray-100">
                             {(() => {
                               if (!cliente.lastVisitDate) {
                                 return (
                                   <div className="flex items-center gap-2">
                                     <Badge className="bg-red-100 text-red-800 text-xs">
                                       🔴 NUNCA VISITADO
                                     </Badge>
                                     <span className="text-xs text-red-600 font-medium">¡Prioridad alta!</span>
                                   </div>
                                 );
                               }
                               
                               const daysSinceVisit = Math.floor((Date.now() - new Date(cliente.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24));
                               let priorityColor = 'text-green-600';
                               let priorityBadge = null;
                               
                               if (daysSinceVisit >= 60) {
                                 priorityColor = 'text-red-800';
                                 priorityBadge = <Badge className="bg-red-100 text-red-800 text-xs">⚫ +60 días</Badge>;
                               } else if (daysSinceVisit >= 30) {
                                 priorityColor = 'text-red-600';
                                 priorityBadge = <Badge className="bg-red-100 text-red-800 text-xs">🔴 +30 días</Badge>;
                               } else if (daysSinceVisit >= 15) {
                                 priorityColor = 'text-orange-600';
                                 priorityBadge = <Badge className="bg-orange-100 text-orange-800 text-xs">🟠 +15 días</Badge>;
                               } else if (daysSinceVisit >= 7) {
                                 priorityColor = 'text-yellow-600';
                                 priorityBadge = <Badge className="bg-yellow-100 text-yellow-800 text-xs">🟡 +7 días</Badge>;
                               }
                               
                               return (
                                 <div className="flex items-center justify-between">
                                   <span className={`text-xs font-medium ${priorityColor}`}>
                                     Última visita: {new Date(cliente.lastVisitDate).toLocaleDateString('es-VE', { 
                                       day: '2-digit', 
                                       month: '2-digit', 
                                       year: 'numeric' 
                                     })}
                                   </span>
                                   {priorityBadge}
                                 </div>
                               );
                             })()}
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </div>
           </div>
         </DialogContent>
       </Dialog>

       {/* Dialog para seleccionar tipo de visita */}
       <Dialog open={isSelectingVisitType} onOpenChange={setIsSelectingVisitType}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle>Seleccionar Tipo de Visita</DialogTitle>
             <DialogDescription>
               Selecciona el tipo de visita que se realizará en: {selectedClienteForVisitType?.nombre}
             </DialogDescription>
           </DialogHeader>

           <div className="space-y-4">
             <div>
               <Label htmlFor="visit-type">Tipo de Visita *</Label>
               <Select 
                 value={selectedVisitTypeForClient} 
                 onValueChange={(value: 'Merchandising' | 'Trade (Eventos)' | 'Trade (Impulso)') => {
                   setSelectedVisitTypeForClient(value);
                   // Resetear marca cuando cambia el tipo de visita
                   if (value === 'Merchandising') {
                     setSelectedMarcaForVisitType('');
                   }
                 }}
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Seleccionar tipo de visita" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="Merchandising">Merchandising</SelectItem>
                   <SelectItem value="Trade (Impulso)">Trade (Impulso)</SelectItem>
                 </SelectContent>
               </Select>
             </div>

             {/* Selector de marca solo para tipos Trade */}
             {selectedVisitTypeForClient === 'Trade (Impulso)' && (
               <div>
                 <Label htmlFor="marca-visit-type">Marca a Trabajar *</Label>
                 <Select
                   value={selectedMarcaForVisitType}
                   onValueChange={(value) => setSelectedMarcaForVisitType(value as 'Shell' | 'Qualid')}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Seleccionar marca a trabajar" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="Shell">Shell</SelectItem>
                     <SelectItem value="Qualid">Qualid</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
             )}

                            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                 <strong>Nota:</strong> El tipo de visita determina las actividades y objetivos específicos para este cliente.
                 {selectedVisitTypeForClient === 'Trade (Impulso)' && (
                   <div className="mt-2">
                     <strong>Para eventos Trade:</strong> Debes seleccionar la marca que se trabajará en este cliente.
                   </div>
                 )}
               </div>

             <div className="flex justify-end gap-2 pt-4 border-t">
               <Button variant="outline" onClick={() => setIsSelectingVisitType(false)}>
                 Cancelar
               </Button>
               <Button 
                 onClick={addClienteWithVisitType}
                 disabled={!selectedVisitTypeForClient || 
                   (selectedVisitTypeForClient === 'Trade (Impulso)' && !selectedMarcaForVisitType)}
               >
                 Agregar a Ruta
               </Button>
             </div>
           </div>
         </DialogContent>
                </Dialog>

         {/* Modal para detalles del evento seleccionado */}
         {selectedEvento && (
           <Dialog open={!!selectedEvento} onOpenChange={() => setSelectedEvento(null)}>
             <DialogContent className="max-w-2xl">
               <DialogHeader>
                 <DialogTitle>Detalles del Evento</DialogTitle>
                 <DialogDescription>
                   {selectedEvento.nombreEvento}
                 </DialogDescription>
               </DialogHeader>

               <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <Label className="text-sm font-medium">Nombre del Evento</Label>
                     <p className="text-sm text-gray-700">{selectedEvento.nombreEvento}</p>
                   </div>
                   <div>
                     <Label className="text-sm font-medium">Estado</Label>
                     <Badge className={
                       selectedEvento.status === 'completado' ? 'bg-green-100 text-green-800' : 
                       selectedEvento.status === 'en_progreso' ? 'bg-blue-100 text-blue-800' : 
                       'bg-gray-100 text-gray-800'
                     }>
                       {selectedEvento.status === 'completado' ? '✓ Completado' : 
                        selectedEvento.status === 'en_progreso' ? '⏳ En Progreso' : 
                        '📋 Planificado'}
                     </Badge>
                   </div>
                 </div>

                 <div>
                   <Label className="text-sm font-medium">Mercaderistas Asignados</Label>
                   <div className="flex flex-wrap gap-2 mt-1">
                     {selectedEvento.mercaderistas.map((mercaderista, index) => (
                       <Badge key={index} variant="outline">
                         {mercaderista}
                       </Badge>
                     ))}
                   </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <Label className="text-sm font-medium">Fecha de Inicio</Label>
                     <p className="text-sm text-gray-700">{format(new Date(selectedEvento.fechaInicio), 'dd/MM/yyyy')}</p>
                   </div>
                   <div>
                     <Label className="text-sm font-medium">Fecha de Fin</Label>
                     <p className="text-sm text-gray-700">{format(new Date(selectedEvento.fechaFin), 'dd/MM/yyyy')}</p>
                   </div>
                 </div>

                 <div>
                   <Label className="text-sm font-medium">Duración</Label>
                   <p className="text-sm text-gray-700">{selectedEvento.duracionDias} día{selectedEvento.duracionDias !== 1 ? 's' : ''}</p>
                 </div>

                 {selectedEvento.direccion && (
                   <div>
                     <Label className="text-sm font-medium">Dirección</Label>
                     <p className="text-sm text-gray-700">{selectedEvento.direccion}</p>
                   </div>
                 )}

                {selectedEvento.marcasTrabajadas && selectedEvento.marcasTrabajadas.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Marcas a Trabajar</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedEvento.marcasTrabajadas.map((marca, index) => (
                        <Badge key={index} className="bg-blue-100 text-blue-800">
                          {marca === 'Shell' ? '🐚 Shell' : '🔧 Qualid'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                 {selectedEvento.descripcion && (
                   <div>
                     <Label className="text-sm font-medium">Descripción</Label>
                     <p className="text-sm text-gray-700">{selectedEvento.descripcion}</p>
                   </div>
                 )}

                 <div className="flex justify-end gap-2 pt-4 border-t">
                   <Button variant="outline" onClick={() => setSelectedEvento(null)}>
                     Cerrar
                   </Button>
                   <Button variant="outline" onClick={() => editEvento(selectedEvento)}>
                     Editar
                   </Button>
                   <Button 
                     variant="destructive" 
                     onClick={() => deleteEvento(selectedEvento.id)}
                   >
                     Eliminar
                   </Button>
                 </div>
               </div>
             </DialogContent>
           </Dialog>
         )}
       </div>
     );
   }