'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Plus, Edit, Trash2, Search, Filter, UserCircle, ArrowLeft, Upload, FileText, AlertCircle, CheckCircle, Menu } from 'lucide-react';
import { Cliente, CreateClienteData, Region, Sede, SEDES_DATA, getSedesByRegion, getCitiesBySede } from '@/types/routes';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, limit, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { getFirestoreClient } from '@/firebase/clientApp';
import { MapSelector } from '@/components/ui/map-selector';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { obtenerVisitas } from '@/services/visitas';
import { GoogleMaps } from '@/components/ui/google-maps';
import { getCurrentUserWithPermissions, UserData, UserPermissions, canAccessSede } from '@/services/auth';
import { LogoutButton } from '@/components/LogoutButton';
import { Visita, VisitaMerchandising } from '@/types/visitas';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { offlineManager } from '@/services/offlineManager';

// Interfaz extendida para cliente con información de señalización y visitas específicas
interface ClienteConSeñalizacion extends Cliente {
  tieneSeñalizacion?: boolean | null; // null = sin información, true/false = con/sin señalización
  fechaUltimaVisita?: Date | null;
  ultimaVisitaMerchandising?: Date | null; // Nueva: última visita de merchandising
  ultimaVisitaTradeImpulso?: Date | null; // Nueva: última visita de trade-impulso
  signage?: 'con' | 'sin' | string; // Campo de señalización de Firestore
  signagePhoto?: string; // URL de la foto de señalización
}

interface InformacionSeñalizacion {
  tieneSeñalizacion: boolean;
  estado: string;
  ultimaVisita: Date | null;
  detalles: string;
}

// Interfaces para carga masiva
interface CSVRow {
  [key: string]: string;
}

interface ColumnMapping {
  csvColumn: string;
  clienteField: keyof CreateClienteData | 'skip';
  required: boolean;
}

interface BulkUploadResult {
  total: number;
  successful: number;
  failed: number;
  errors: { row: number; error: string }[];
}

interface BulkUploadState {
  isOpen: boolean;
  step: 'upload' | 'mapping' | 'preview' | 'processing' | 'complete';
  file: File | null;
  csvData: CSVRow[];
  columnMappings: ColumnMapping[];
  previewData: CreateClienteData[];
  processing: boolean;
  progress: number;
  result: BulkUploadResult | null;
}

// Función helper para normalizar fechas
const normalizeDate = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  // Manejar Timestamps de Firestore
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

// Utilidades locales para simplificar y unificar lógica repetida
const parseBoolean = (v: any): boolean | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase().trim();
  if (['true', 'sí', 'si', 'yes', '1'].includes(s)) return true;
  if (['false', 'no', '0'].includes(s)) return false;
  return null;
};

const getDateFromCreatedAt = (item: any): Date | null => {
  if (!item) return null;
  if (item.createdAt) return normalizeDate(item.createdAt);
  if (item.created_at) return normalizeDate(item.created_at);
  return null;
};

const isMerchandisingVisit = (visita: any) => {
  const tv = (visita.tipoVisita || '').toString().toLowerCase();
  return tv === 'merchandising' || tv === 'qualid-merchandising' || tv === 'shell-merchandising' || tv === 'signage-capture' || tv === 'trade (merchandising)';
};

const isTradeImpulsoVisit = (visita: any) => {
  const tv = (visita.tipoVisita || '').toString().toLowerCase();
  return tv === 'trade (impulso)' || tv === 'trade-impulso' || tv === 'trade (impulso)';
};

// Constantes para paginación
const CLIENTS_PER_PAGE = 50;
const MAX_CLIENTS_LOAD = 200; // Máximo de clientes a cargar inicialmente

export default function GestionClientesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [clientes, setClientes] = useState<ClienteConSeñalizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreClients, setHasMoreClients] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentCliente, setCurrentCliente] = useState<Cliente | null>(null);
  const [isVisitTypeDialogOpen, setIsVisitTypeDialogOpen] = useState(false);
  const [selectedClienteForVisitType, setSelectedClienteForVisitType] = useState<Cliente | null>(null);
  const [selectedVisitType, setSelectedVisitType] = useState<'Merchandising' | 'Trade (Eventos)' | 'Trade (Impulso)' | 'sin_configurar'>('sin_configurar');
  // Búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCity, setFilterCity] = useState<string>('todas');
  // Eliminamos filtros de región y sede de la vista (se mantiene control de permisos abajo)
  const [filterTipo, setFilterTipo] = useState<'todos' | 'tienda' | 'distribuidor' | 'cliente_especial'>('todos');
  const [filterSinVisita, setFilterSinVisita] = useState<'todos' | '7' | '15' | '30' | '60' | '90'>('todos');
  const [filterSeñalizacion, setFilterSeñalizacion] = useState<'todos' | 'con_señalizacion' | 'sin_señalizacion' | 'sin_informacion'>('todos');
  const [filterRegion, setFilterRegion] = useState<Region | 'all'>('all');
  const [filterSede, setFilterSede] = useState<Sede | 'all'>('all');
  const [filterSignal, setFilterSignal] = useState<'all' | 'si' | 'no'>('all');
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Estados de usuario y permisos
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);

  // Estado para modal de foto de señalización
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>('');
  const [selectedClienteName, setSelectedClienteName] = useState<string>('');

  // Estado para carga masiva
  const [bulkUpload, setBulkUpload] = useState<BulkUploadState>({
    isOpen: false,
    step: 'upload',
    file: null,
    csvData: [],
    columnMappings: [],
    previewData: [],
    processing: false,
    progress: 0,
    result: null
  });

  // Estados del formulario
  const [formData, setFormData] = useState<CreateClienteData>({
    rif: '',
    nombre: '',
    direccion: '',
    telefono: '',
    email: '',
    contacto: '',
    region: 'Centro-capital',
    sede: 'GRUPO DISBATTERY',
    estadoGeografico: '',
    ciudad: '',
    position: { lat: 0, lng: 0 },
    tipo: 'tienda',
    observaciones: ''
  });

  // Estados del mapa
  const [mapCenter, setMapCenter] = useState({ lat: 10.4806, lng: -66.9036 }); // Caracas
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | null>(null);

  // Estado para las ciudades disponibles (para forzar re-render)
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setAuthLoading(true);
        setAuthError(null);

        // Verificar autenticación local
        if (typeof window !== 'undefined') {
          const isAdmin = localStorage.getItem('isAdminLoggedIn');
          if (isAdmin !== 'true') {
            console.log('🔒 Usuario no autenticado, redirigiendo...');
            router.push('/');
            return;
          }
        }

        // Cargar datos del usuario con timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout de autenticación')), 10000);
        });

        const authPromise = getCurrentUserWithPermissions();
        const result = await Promise.race([authPromise, timeoutPromise]) as any;

        if (result) {
          setCurrentUser(result.user);
          setUserPermissions(result.permissions);

          console.log('✅ Usuario autenticado:', result.user?.fullName, 'Permisos:', result.permissions);

          // Si el usuario no puede gestionar clientes, redirigir
          if (!result.permissions.canManageClients) {
            console.log('⚠️ Sin permisos para gestionar clientes, redirigiendo...');
            router.push('/admin/dashboard');
            return;
          }

          // Solo cargar clientes si la autenticación es exitosa
          // loadClientes se llamará después de definirse
        } else {
          throw new Error('No se pudo obtener datos del usuario');
        }
      } catch (error: any) {
        console.error('❌ Error en autenticación:', error);
        setAuthError(error.message || 'Error de autenticación');

        // Si hay error de auth, redirigir después de un delay
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } finally {
        setAuthLoading(false);
      }
    };

    initializeAuth();
  }, [router]); // Remover loadClientes de dependencias para evitar referencia circular

  // Efecto separado para cargar clientes después de la autenticación
  useEffect(() => {
    if (currentUser && userPermissions && userPermissions.canManageClients && !loading) {
      console.log('🔄 Cargando clientes después de autenticación exitosa...');
      loadClientes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, userPermissions]); // loadClientes se define después, evitar referencia circular

  useEffect(() => {
    // Inicializar formulario con datos del usuario actual cuando esté disponible
    if (currentUser && currentUser.sede && formData.sede === 'GRUPO DISBATTERY') {
      console.log('📍 Inicializando formulario con sede del usuario:', currentUser.sede);
      setFormData(prev => ({
        ...prev,
        region: currentUser.region as CreateClienteData['region'],
        sede: currentUser.sede as CreateClienteData['sede'],
        ciudad: '' // Reset ciudad cuando cambie la sede
      }));
    }
  }, [currentUser]);

  useEffect(() => {
    // Actualizar ciudades disponibles cuando cambie la sede
    const cities = getCitiesBySede(formData.sede);
    setAvailableCities(cities);

    console.log('🏙️ Ciudades disponibles para', formData.sede, ':', cities.length, 'ciudades');

    // Si la ciudad actual no está en las nuevas ciudades disponibles, resetearla
    if (formData.ciudad && !cities.includes(formData.ciudad)) {
      setFormData(prev => ({ ...prev, ciudad: '' }));
    }
  }, [formData.sede, formData.ciudad]);

  /**
   * Obtiene las fechas de las últimas visitas por tipo específico
   */
  const obtenerUltimasVisitasPorTipo = async (rifCliente: string): Promise<{
    ultimaVisitaMerchandising: Date | null;
    ultimaVisitaTradeImpulso: Date | null;
  }> => {
    try {
      console.log(`🔍 Buscando últimas visitas por tipo para cliente RIF: ${rifCliente}`);

      const visitasRef = collection(getFirestoreClient(), 'visitas');
      const visitasQuery = query(
        visitasRef,
        where('rifCliente', '==', rifCliente)
      );

      const visitasSnapshot = await getDocs(visitasQuery);

      if (visitasSnapshot.empty) {
        console.log(`⚠️ No se encontraron visitas para el cliente ${rifCliente}`);
        return {
          ultimaVisitaMerchandising: null,
          ultimaVisitaTradeImpulso: null
        };
      }

      // Filtrar y separar visitas por tipo
      const visitas = visitasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      console.log(`🔍 DEBUG VISITAS - Cliente ${rifCliente}:`, visitas.map((v: any) => ({
        id: v.id,
        tipoVisita: v.tipoVisita,
        createdAt: v.createdAt?.toDate ? v.createdAt.toDate().toISOString() : v.createdAt
      })));

      // Visitas de merchandising
      const visitasMerchandising = visitas
        .filter((visita: any) => isMerchandisingVisit(visita))
        .sort((a: any, b: any) => {
          const fechaA = getDateFromCreatedAt(a) || new Date(0);
          const fechaB = getDateFromCreatedAt(b) || new Date(0);
          return fechaB.getTime() - fechaA.getTime();
        });

      // Visitas de trade-impulso
      const visitasTradeImpulso = visitas
        .filter((visita: any) => isTradeImpulsoVisit(visita))
        .sort((a: any, b: any) => {
          const fechaA = getDateFromCreatedAt(a) || new Date(0);
          const fechaB = getDateFromCreatedAt(b) || new Date(0);
          return fechaB.getTime() - fechaA.getTime();
        });

      console.log(`📊 RESULTADOS FILTRADO - Cliente ${rifCliente}:`);
      console.log(`   - Merchandising encontradas: ${visitasMerchandising.length}`);
      console.log(`   - Trade Impulso encontradas: ${visitasTradeImpulso.length}`);
      if (visitasMerchandising.length > 0) {
        console.log(`   - Última Merchandising: ${(visitasMerchandising[0] as any).createdAt?.toDate ? (visitasMerchandising[0] as any).createdAt.toDate().toISOString() : (visitasMerchandising[0] as any).createdAt}`);
      }
      if (visitasTradeImpulso.length > 0) {
        console.log(`   - Última Trade Impulso: ${(visitasTradeImpulso[0] as any).createdAt?.toDate ? (visitasTradeImpulso[0] as any).createdAt.toDate().toISOString() : (visitasTradeImpulso[0] as any).createdAt}`);
      }

      const resultado = {
        ultimaVisitaMerchandising: visitasMerchandising.length > 0
          ? getDateFromCreatedAt(visitasMerchandising[0])
          : null,
        ultimaVisitaTradeImpulso: visitasTradeImpulso.length > 0
          ? getDateFromCreatedAt(visitasTradeImpulso[0])
          : null
      };

      console.log(`📊 Últimas visitas por tipo para cliente ${rifCliente}:`, {
        merchandising: resultado.ultimaVisitaMerchandising ? resultado.ultimaVisitaMerchandising.toLocaleDateString() : 'Sin visitas',
        tradeImpulso: resultado.ultimaVisitaTradeImpulso ? resultado.ultimaVisitaTradeImpulso.toLocaleDateString() : 'Sin visitas'
      });

      return resultado;

    } catch (error: any) {
      console.error(`Error obteniendo últimas visitas por tipo para cliente ${rifCliente}:`, error);
      return {
        ultimaVisitaMerchandising: null,
        ultimaVisitaTradeImpulso: null
      };
    }
  };

  /**
   * Obtiene información de señalización del último merchandising
   */
  const obtenerInformacionSeñalizacion = async (rifCliente: string): Promise<InformacionSeñalizacion> => {
    try {
      console.log(`🔍 Buscando información de señalización para cliente RIF: ${rifCliente}`);

      const visitasRef = collection(getFirestoreClient(), 'visitas');

      // 🔄 CONSULTA SIMPLIFICADA: Solo filtramos por RIF, sin tipoVisita ni ordenamiento
      // Esto evita la necesidad de índices compuestos
      const visitasQuery = query(
        visitasRef,
        where('rifCliente', '==', rifCliente)
      );

      const visitasSnapshot = await getDocs(visitasQuery);

      if (visitasSnapshot.empty) {
        console.log(`⚠️ No se encontraron visitas para el cliente ${rifCliente}`);
        return {
          tieneSeñalizacion: false,
          estado: 'Sin información',
          ultimaVisita: null,
          detalles: 'No se encontraron visitas de merchandising'
        };
      }

      // 🔄 FILTRADO EN MEMORIA: Filtrar y ordenar en JavaScript en lugar de Firestore
      const visitas = visitasSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((visita: any) => isMerchandisingVisit(visita))
        .sort((a: any, b: any) => {
          // Ordenar por fecha de creación (más reciente primero)
          const fechaA = getDateFromCreatedAt(a) || new Date(0);
          const fechaB = getDateFromCreatedAt(b) || new Date(0);
          return fechaB.getTime() - fechaA.getTime();
        });

      if (visitas.length === 0) {
        console.log(`⚠️ No se encontraron visitas de merchandising para el cliente ${rifCliente}`);
        return {
          tieneSeñalizacion: false,
          estado: 'Sin información',
          ultimaVisita: null,
          detalles: 'No se encontraron visitas de merchandising'
        };
      }

      const ultimaVisita = visitas[0] as any;
      console.log(`📊 Última visita de merchandising encontrada:`, {
        id: ultimaVisita.id,
        fecha: getDateFromCreatedAt(ultimaVisita),
        tipo: ultimaVisita.tipoVisita,
        tieneDatos: !!ultimaVisita.data
      });

      // 🔍 EXTRAER INFORMACIÓN DE SEÑALIZACIÓN
      let tieneSeñalizacion = false;
      let estado = 'Sin información';
      let detalles = 'No se pudo determinar el estado de la señalización';

      if (ultimaVisita.data) {
        console.log(`🔍 Analizando datos de la visita:`, ultimaVisita.data);

        try {
          let data = ultimaVisita.data;

          // Si data es un string, intentar parsearlo
          if (typeof data === 'string') {
            try {
              data = JSON.parse(data);
            } catch (e) {
              console.log('📝 Los datos no son JSON válido, tratando como texto');
            }
          }

          // 🔍 BÚSQUEDA MEJORADA DE INFORMACIÓN DE SEÑALIZACIÓN
          const textoCompleto = JSON.stringify(data).toLowerCase();
          console.log(`🔍 Analizando datos de señalización:`, {
            tipoVisita: ultimaVisita.tipoVisita,
            longitudData: textoCompleto.length,
            muestra: textoCompleto.substring(0, 300)
          });

          // 🎯 BÚSQUEDA DIRECTA EN CAMPOS ESPECÍFICOS (PRIORIDAD ALTA)
          if (data.señalizacion !== undefined) {
            const parsed = parseBoolean(data.señalizacion);
            console.log(`🎯 Campo directo 'señalizacion' encontrado:`, data.señalizacion, '→ parsed:', parsed);
            if (parsed === true) {
              tieneSeñalizacion = true;
              estado = 'Con señalización';
              detalles = `Confirmado: campo 'señalizacion' = ${data.señalizacion}`;
            } else if (parsed === false) {
              tieneSeñalizacion = false;
              estado = 'Sin señalización';
              detalles = `Confirmado: campo 'señalizacion' = ${data.señalizacion}`;
            }
          } else if (data.signage !== undefined) {
            const parsed = parseBoolean(data.signage);
            console.log(`🎯 Campo directo 'signage' encontrado:`, data.signage, '→ parsed:', parsed);
            if (parsed === true) {
              tieneSeñalizacion = true;
              estado = 'Con señalización';
              detalles = `Confirmado: campo 'signage' = ${data.signage}`;
            } else if (parsed === false) {
              tieneSeñalizacion = false;
              estado = 'Sin señalización';
              detalles = `Confirmado: campo 'signage' = ${data.signage}`;
            }
          }

          // Revisión adicional: algunos formularios guardan 'hasSignage'
          if (estado === 'Sin información' && data.hasSignage !== undefined) {
            const parsed = parseBoolean(data.hasSignage);
            console.log(`🎯 Campo directo 'hasSignage' encontrado:`, data.hasSignage, '→ parsed:', parsed);
            if (parsed === true) {
              tieneSeñalizacion = true;
              estado = 'Con señalización';
              detalles = `Confirmado: campo 'hasSignage' = ${data.hasSignage}`;
            } else if (parsed === false) {
              tieneSeñalizacion = false;
              estado = 'Sin señalización';
              detalles = `Confirmado: campo 'hasSignage' = ${data.hasSignage}`;
            }
          }

          // 🔍 SI NO HAY CAMPOS DIRECTOS, BUSCAR EN PREGUNTAS Y RESPUESTAS
          if (estado === 'Sin información') {
            console.log(`🔍 Buscando en preguntas y respuestas...`);

            // Buscar en estructura de preguntas/respuestas
            if (data.preguntas || data.questions || data.respuestas || data.answers) {
              const seccionPreguntas = data.preguntas || data.questions || data.respuestas || data.answers;
              console.log(`📋 Sección de preguntas encontrada:`, seccionPreguntas);

              for (const [pregunta, respuesta] of Object.entries(seccionPreguntas)) {
                const preguntaLower = String(pregunta).toLowerCase();
                const respuestaLower = String(respuesta).toLowerCase();

                console.log(`❓ Evaluando: "${pregunta}" = "${respuesta}"`);

                // Si la pregunta es sobre señalización
                if (preguntaLower.includes('señalizacion') || preguntaLower.includes('signage') ||
                  preguntaLower.includes('letrero') || preguntaLower.includes('cartel')) {

                  console.log(`🎯 Pregunta sobre señalización encontrada: ${pregunta} = ${respuesta}`);

                  if (respuestaLower === 'sí' || respuestaLower === 'si' ||
                    respuestaLower === 'yes' || respuestaLower === 'true' ||
                    respuestaLower === '1' || respuesta === true) {
                    tieneSeñalizacion = true;
                    estado = 'Con señalización';
                    detalles = `Detectado en pregunta: "${pregunta}" = "${respuesta}"`;
                    console.log(`✅ Señalización POSITIVA detectada`);
                    break;
                  } else if (respuestaLower === 'no' || respuestaLower === 'false' ||
                    respuestaLower === '0' || respuesta === false) {
                    tieneSeñalizacion = false;
                    estado = 'Sin señalización';
                    detalles = `Detectado en pregunta: "${pregunta}" = "${respuesta}"`;
                    console.log(`❌ Señalización NEGATIVA detectada`);
                    break;
                  }
                }
              }
            }
          }

          // 🔍 BÚSQUEDA POR PATRONES DE TEXTO (ÚLTIMO RECURSO)
          if (estado === 'Sin información') {
            console.log(`🔍 Aplicando búsqueda por patrones...`);

            const patronesSeñalizacionPositiva = [
              /señalización.*(?:sí|si|yes|true|presente|instalada|colocada)/i,
              /signage.*(?:sí|si|yes|true|present|installed|placed)/i,
              /letrero.*(?:sí|si|yes|true|presente|instalado|colocado)/i,
              /tiene.*señalización/i,
              /con.*señalización/i
            ];

            const patronesSeñalizacionNegativa = [
              /señalización.*(?:no|false|ausente|falta|sin|missing)/i,
              /signage.*(?:no|false|absent|missing|without)/i,
              /letrero.*(?:no|false|ausente|falta|sin)/i,
              /sin.*señalización/i,
              /no.*tiene.*señalización/i
            ];

            // Buscar patrones positivos
            for (const patron of patronesSeñalizacionPositiva) {
              if (patron.test(textoCompleto)) {
                tieneSeñalizacion = true;
                estado = 'Con señalización';
                detalles = `Detectado por patrón de texto`;
                console.log(`✅ Patrón positivo encontrado:`, patron);
                break;
              }
            }

            // Si no hay positivos, buscar negativos
            if (estado === 'Sin información') {
              for (const patron of patronesSeñalizacionNegativa) {
                if (patron.test(textoCompleto)) {
                  tieneSeñalizacion = false;
                  estado = 'Sin señalización';
                  detalles = `Detectado por patrón de texto`;
                  console.log(`❌ Patrón negativo encontrado:`, patron);
                  break;
                }
              }
            }
          }

        } catch (error) {
          console.error('❌ Error procesando datos de señalización:', error);
          detalles = 'Error al procesar la información de señalización';
        }
      }

      const resultado = {
        tieneSeñalizacion,
        estado,
        ultimaVisita: getDateFromCreatedAt(ultimaVisita),
        detalles
      };

      console.log(`📊 Resultado final para cliente ${rifCliente}:`, resultado);
      return resultado;

    } catch (error: any) {
      console.error(`Error obteniendo información de señalización para cliente ${rifCliente}:`, error);
      return {
        tieneSeñalizacion: false,
        estado: 'Error',
        ultimaVisita: null,
        detalles: `Error: ${error?.message || 'Error desconocido'}`
      };
    }
  };

  const loadClientes = useCallback(async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setClientes([]);
        setLastDoc(null);
        setHasMoreClients(true);
      }

      console.log(`📄 Cargando clientes... ${loadMore ? '(más)' : '(inicial)'} - Límite: ${CLIENTS_PER_PAGE}`);

      const clientesRef = collection(getFirestoreClient(), 'clientes');
      let q = query(
        clientesRef,
        orderBy('createdAt', 'desc'),
        limit(CLIENTS_PER_PAGE)
      );

      // Si estamos cargando más, usar el último documento como punto de partida
      if (loadMore && lastDoc) {
        q = query(
          clientesRef,
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(CLIENTS_PER_PAGE)
        );
      }

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log('⚠️ No se encontraron más clientes');
        setHasMoreClients(false);
        return;
      }

      console.log(`✅ Obtenidos ${querySnapshot.docs.length} clientes de Firestore`);

      // Guardar el último documento para paginación
      const newLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastDoc(newLastDoc);

      // Si obtuvimos menos documentos del límite, no hay más
      if (querySnapshot.docs.length < CLIENTS_PER_PAGE) {
        setHasMoreClients(false);
      }

      const clientesData: ClienteConSeñalizacion[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        clientesData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          lastVisitDate: data.lastVisitDate ? (typeof data.lastVisitDate === 'string' ? data.lastVisitDate : data.lastVisitDate.toDate()) : undefined,
        } as ClienteConSeñalizacion);
      });

      console.log(`🔄 Procesando información básica para ${clientesData.length} clientes (sin señalización por ahora)...`);

      // OPTIMIZACIÓN CRÍTICA: Cargar clientes SIN información de señalización inicialmente
      // La señalización se cargará bajo demanda o en background
      const clientesBasicos = clientesData.map(cliente => ({
        ...cliente,
        tieneSeñalizacion: null,
        signagePhoto: undefined,
        fechaUltimaVisita: null,
        ultimaVisitaMerchandising: null,
        ultimaVisitaTradeImpulso: null,
        signage: undefined,
      }));

      if (loadMore) {
        setClientes(prev => [...prev, ...clientesBasicos]);
      } else {
        setClientes(clientesBasicos);
      }

      console.log(`✅ Carga básica completada: ${clientesBasicos.length} clientes listos`);

    } catch (error: any) {
      console.error('❌ Error cargando clientes:', error);
      toast({
        variant: 'destructive',
        title: 'Error cargando clientes',
        description: error.message || 'Error desconocido al cargar clientes',
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [lastDoc, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ CAMBIO: La ubicación GPS ya NO es obligatoria
    // Los mercaderistas pueden capturarla en campo cuando visiten al cliente

    // Verificar permisos para la sede seleccionada
    if (currentUser && !canAccessSede(currentUser, formData.sede)) {
      alert('No tienes permisos para crear/editar clientes en esta sede');
      return;
    }

    try {
      // Filtrar campos undefined para evitar errores de Firebase
      const cleanFormData = Object.fromEntries(
        Object.entries(formData).filter(([key, value]) => value !== undefined)
      );

      const clienteData = {
        ...cleanFormData,
        // ✅ CAMBIO: Usar coordenadas por defecto (0,0) si no se seleccionó ubicación
        // Los mercaderistas pueden actualizar esto posteriormente en campo
        position: selectedPosition || { lat: 0, lng: 0 },
        estado: 'activo' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentUser?.email || 'admin', // Usar email del usuario actual
        gpsRequiredInField: !selectedPosition // Marcar si necesita GPS en campo
      };

      // Verificar si estamos offline y usar offlineManager
      if (typeof window !== 'undefined' && !navigator.onLine) {
        console.log('🔄 Modo Offline: Guardando cliente con offlineManager...');

        const clienteOfflineData = {
          tipoVisita: 'Admin - Gestión Cliente',
          accion: currentCliente ? 'actualizar' : 'crear',
          clienteData: clienteData,
          clienteId: currentCliente?.id,
          timestamp: new Date().toISOString()
        };

        const saveResult = await offlineManager.saveVisita(clienteOfflineData);

        if (saveResult.success) {
          console.log('✅ Cliente guardado offline exitosamente:', saveResult.visitaId);

          toast({
            title: 'Cliente Guardado Offline',
            description: 'Los datos se sincronizarán automáticamente cuando haya conexión.',
          });

          setIsDialogOpen(false);
          setCurrentCliente(null);
          resetForm();
        } else {
          throw new Error(saveResult.error || 'Error guardando cliente offline');
        }
      } else {
        // Modo online: operación normal
        if (currentCliente) {
          // Actualizar cliente existente
          const clienteRef = doc(getFirestoreClient(), 'clientes', currentCliente.id);
          await updateDoc(clienteRef, {
            ...clienteData,
            updatedAt: new Date()
          });
        } else {
          // Crear nuevo cliente
          await addDoc(collection(getFirestoreClient(), 'clientes'), clienteData);
        }

        setIsDialogOpen(false);
        setCurrentCliente(null);
        resetForm();
        loadClientes();
      }

    } catch (error) {
      console.error('Error guardando cliente:', error);
      alert('Error al guardar el cliente');
    }
  };

  const handleEditCliente = (cliente: Cliente) => {
    setIsEditMode(true);
    setCurrentCliente(cliente);
    resetForm(cliente);
    setIsDialogOpen(true);
  };

  // Función para abrir modal de foto de señalización
  const handleViewSignagePhoto = (cliente: ClienteConSeñalizacion) => {
    if (cliente.signagePhoto && cliente.nombre) {
      setSelectedPhotoUrl(cliente.signagePhoto);
      setSelectedClienteName(cliente.nombre);
      setPhotoModalOpen(true);
    }
  };

  const handleDelete = async (clienteId: string) => {
    const cliente = clientes.find(c => c.id === clienteId);

    // Verificar permisos para eliminar este cliente
    if (currentUser && cliente && !canAccessSede(currentUser, cliente.sede)) {
      alert('No tienes permisos para eliminar clientes de esta sede');
      return;
    }

    if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
      try {
        await deleteDoc(doc(getFirestoreClient(), 'clientes', clienteId));
        loadClientes();
      } catch (error) {
        console.error('Error eliminando cliente:', error);
        alert('Error al eliminar el cliente');
      }
    }
  };

  const resetForm = (cliente?: Cliente | null) => {
    const defaultRegion: Region = cliente?.region || 'Centro-capital';
    const defaultSede: Sede = cliente?.sede || 'GRUPO DISBATTERY';
    const defaultCities = getCitiesBySede(defaultSede);

    setFormData({
      rif: cliente?.rif || '',
      nombre: cliente?.nombre || '',
      direccion: cliente?.direccion || '',
      telefono: cliente?.telefono || '',
      email: cliente?.email || '',
      contacto: cliente?.contacto || '',
      region: defaultRegion,
      sede: defaultSede,
      ciudad: cliente?.ciudad || '',
      position: cliente?.position || { lat: 0, lng: 0 },
      tipo: cliente?.tipo || 'tienda',
      observaciones: cliente?.observaciones || '',
      tipoVisitaPredeterminado: cliente?.tipoVisitaPredeterminado || 'Merchandising',
    });

    setSelectedPosition(cliente?.position || null);
    setAvailableCities(defaultCities);
  };

  // ========== FUNCIONES PARA CARGA MASIVA ==========
  // --- CSV utilities: small, typed helpers ---

  // Parse a single CSV line respecting quoted fields
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      if (char === '"' && !inQuotes) {
        inQuotes = true;
        continue;
      }
      if (char === '"' && inQuotes && nextChar === '"') {
        current += '"';
        i++; // skip escaped quote
        continue;
      }
      if (char === '"' && inQuotes) {
        inQuotes = false;
        continue;
      }
      if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    result.push(current.trim());
    return result;
  };

  // Normalize and join lines that were broken inside quoted fields
  const cleanAndSplitLines = (csvText: string): string[] => {
    let cleanedCSV = csvText.replace('"nombreVendedor\n"', 'nombreVendedor');
    const rawLines = cleanedCSV.split('\n');
    const cleanedLines: string[] = [];
    let buffer = '';
    for (const raw of rawLines) {
      const line = raw.trim();
      if (!line) continue;
      buffer += (buffer ? ' ' : '') + line;
      const quotes = (buffer.match(/"/g) || []).length;
      const inQuoted = quotes % 2 !== 0;
      if (!inQuoted) {
        // Heuristic: accept lines with at least 1 comma (header/data)
        const commaCount = (buffer.match(/,/g) || []).length;
        if (commaCount >= 1) {
          cleanedLines.push(buffer);
          buffer = '';
        }
      }
    }
    if (buffer.trim()) cleanedLines.push(buffer);
    return cleanedLines;
  };

  // Parse full CSV text into rows (CSVRow[])
  const parseCSV = (csvText: string): CSVRow[] => {
    const lines = cleanAndSplitLines(csvText);
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim());
    const rows: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]).map(v => v.replace(/"/g, '').trim());
      const row: CSVRow = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      rows.push(row);
    }
    return rows;
  };

  // Autogenerar mapeo de columnas con reglas específicas
  const generateAutoMapping = (csvHeaders: string[]): ColumnMapping[] => {
    const autoMappings: Record<string, keyof CreateClienteData> = {
      rif: 'rif', nif: 'rif', rnc: 'rif', documento: 'rif', cedula: 'rif', cedulajuridica: 'rif',
      nombre: 'nombre', nombrecliente: 'nombre', cliente: 'nombre', razon_social: 'nombre', razonsocial: 'nombre', company: 'nombre', empresa: 'nombre',
      direccion: 'direccion', dirección: 'direccion', address: 'direccion', ubicacion: 'direccion', ubicación: 'direccion', domicilio: 'direccion',
      estado: 'estadoGeografico', state: 'estadoGeografico', provincia: 'estadoGeografico',
      telefono: 'telefono', teléfono: 'telefono', phone: 'telefono', celular: 'telefono', movil: 'telefono',
      email: 'email', correo: 'email', mail: 'email', correoelectronico: 'email',
      contacto: 'contacto', persona_contacto: 'contacto', personacontacto: 'contacto', representante: 'contacto',
      region: 'region', región: 'region', zone: 'region', zona: 'region',
      sede: 'sede', sucursal: 'sede', branch: 'sede', oficina: 'sede',
      ciudad: 'ciudad', city: 'ciudad', municipio: 'ciudad',
      tipo: 'tipo', type: 'tipo', categoria: 'tipo', category: 'tipo',
      observaciones: 'observaciones', notas: 'observaciones', comments: 'observaciones', comentarios: 'observaciones', descripcion: 'observaciones', detalles: 'observaciones'
    };

    const mapSpecific = (original: string): keyof CreateClienteData | 'skip' | undefined => {
      switch (original) {
        case 'CodigoCliente': return 'rif';
        case 'nombreCliente': return 'nombre';
        case 'rif': return 'rif';
        case 'Direccion': return 'direccion';
        case 'Estado': return 'estadoGeografico';
        case 'Nombresucursal': return 'sede';
        case 'nombreVendedor': return 'contacto';
        case 'codigo_sucursal':
        case 'CodigoVendedor': return 'skip';
        default: return undefined;
      }
    };

    return csvHeaders.map(header => {
      const originalExact = header.trim();
      const normalized = originalExact.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      const specific = mapSpecific(originalExact);
      const matched = specific === undefined ? autoMappings[normalized] : specific;
      const clienteField = matched || 'skip';
      return {
        csvColumn: header,
        clienteField: clienteField as keyof CreateClienteData | 'skip',
        required: clienteField === 'nombre' || clienteField === 'direccion'
      } as ColumnMapping;
    });
  };

  // Procesa CSV rows en CreateClienteData[], delegando transformaciones a helpers
  const processCSVData = (csvData: CSVRow[], mappings: ColumnMapping[]): CreateClienteData[] => {
    const processed: CreateClienteData[] = [];

    const assignRegionBySede = (sede: string | undefined): Region => {
      const map: Record<string, Region> = {
        'GRUPO DISBATTERY': 'Centro-capital',
        'DISBATTERY': 'Oriente',
        'BLITZ 2000': 'Centro-Los llanos',
        'GRUPO VICTORIA': 'Oriente'
      };
      return map[sede || ''] || 'Centro-capital';
    };

    const mapSedeByEstado = (estado?: string): Sede | undefined => {
      if (!estado) return undefined;
      const s: Record<string, Sede> = {
        'distrito capital': 'GRUPO DISBATTERY', miranda: 'GRUPO DISBATTERY', vargas: 'GRUPO DISBATTERY',
        aragua: 'DISBATTERY', anzoategui: 'DISBATTERY', 'anzoátegui': 'DISBATTERY', bolivar: 'DISBATTERY', 'bolívar': 'DISBATTERY', monagas: 'DISBATTERY', sucre: 'DISBATTERY', 'nueva esparta': 'DISBATTERY',
        carabobo: 'BLITZ 2000', guarico: 'BLITZ 2000', 'guárico': 'BLITZ 2000', lara: 'BLITZ 2000', yaracuy: 'BLITZ 2000', falcon: 'BLITZ 2000', 'falcón': 'BLITZ 2000', zulia: 'BLITZ 2000', tachira: 'BLITZ 2000', 'táchira': 'BLITZ 2000', merida: 'BLITZ 2000', 'mérida': 'BLITZ 2000', trujillo: 'BLITZ 2000',
        cojedes: 'GRUPO VICTORIA', portuguesa: 'GRUPO VICTORIA', barinas: 'GRUPO VICTORIA', apure: 'GRUPO VICTORIA', amazonas: 'GRUPO VICTORIA', 'delta amacuro': 'GRUPO VICTORIA'
      };
      return s[estado.toLowerCase()];
    };

    const mapTipo = (v?: string) => {
      if (!v) return 'tienda';
      const m: Record<string, CreateClienteData['tipo']> = { tienda: 'tienda', store: 'tienda', shop: 'tienda', distribuidor: 'distribuidor', distributor: 'distribuidor', especial: 'cliente_especial', special: 'cliente_especial', cliente_especial: 'cliente_especial' };
      return m[v.toLowerCase()] || 'tienda';
    };

    const ciudadFallback = (estado?: string) => {
      if (!estado) return '';
      const map: Record<string, string> = { aragua: 'Maracay', carabobo: 'Valencia', anzoategui: 'Puerto La Cruz', 'anzoátegui': 'Puerto La Cruz', bolivar: 'Ciudad Bolívar', 'bolívar': 'Ciudad Bolívar', monagas: 'Maturín', lara: 'Barquisimeto', zulia: 'Maracaibo', tachira: 'San Cristóbal', 'táchira': 'San Cristóbal', merida: 'Mérida', 'mérida': 'Mérida', 'distrito capital': 'Caracas', miranda: 'Los Teques', vargas: 'La Guaira' };
      return map[estado.toLowerCase()] || estado;
    };

    for (const row of csvData) {
      const clientePartial: Partial<CreateClienteData> = {};
      let skipRow = false;

      // Primer paso: campos directos
      for (const mapping of mappings) {
        if (mapping.clienteField === 'skip') continue;
        const raw = row[mapping.csvColumn]?.trim() || '';
        if (!raw && mapping.required) { skipRow = true; break; }
        const direct = ['rif', 'nombre', 'direccion', 'telefono', 'email', 'contacto', 'observaciones', 'estadoGeografico'];
        if (direct.includes(mapping.clienteField as string)) {
          (clientePartial as any)[mapping.clienteField] = raw;
        }
      }
      if (skipRow) continue;

      // Segundo paso: campos derivados / transformaciones
      for (const mapping of mappings) {
        if (mapping.clienteField === 'skip') continue;
        const raw = row[mapping.csvColumn]?.trim() || '';
        if (!raw && mapping.required) { skipRow = true; break; }
        const alreadyHandled = ['rif', 'nombre', 'direccion', 'telefono', 'email', 'contacto', 'observaciones', 'estadoGeografico'];
        if (alreadyHandled.includes(mapping.clienteField as string)) continue;

        switch (mapping.clienteField) {
          case 'region':
            clientePartial.region = clientePartial.sede ? assignRegionBySede(clientePartial.sede) : 'Centro-capital';
            break;
          case 'sede':
            // Preferir sede derivada desde estado
            const sedeFromEstado = mapSedeByEstado(clientePartial.estadoGeografico);
            if (sedeFromEstado) {
              clientePartial.sede = sedeFromEstado;
            } else {
              const normalized = raw.toLowerCase().trim();
              const fallbackMap: Record<string, Sede> = { 'disbattery': 'DISBATTERY', 'grupo disbattery': 'GRUPO DISBATTERY', 'blitz': 'BLITZ 2000', 'blitz 2000': 'BLITZ 2000', 'victoria': 'GRUPO VICTORIA', 'grupo victoria': 'GRUPO VICTORIA', 'disbattery aragua s.a.': 'DISBATTERY', 'disbattery aragua, s.a.': 'DISBATTERY', 'disbattery oriente s.a.': 'DISBATTERY', 'disbattery principal': 'GRUPO DISBATTERY', 'oceano pacifico pto. la cruz': 'DISBATTERY', 'principal': 'GRUPO DISBATTERY' };
              clientePartial.sede = (fallbackMap[normalized] || 'GRUPO DISBATTERY');
            }
            break;
          case 'tipo':
            clientePartial.tipo = mapTipo(raw);
            break;
          case 'ciudad':
            if (raw) clientePartial.ciudad = raw;
            else clientePartial.ciudad = clientePartial.estadoGeografico ? ciudadFallback(clientePartial.estadoGeografico) : '';
            break;
          default:
            (clientePartial as any)[mapping.clienteField] = raw;
            break;
        }
      }
      if (skipRow) continue;

      if (clientePartial.nombre && clientePartial.direccion) {
        const sedeFinal = clientePartial.sede || 'GRUPO DISBATTERY';
        const regionFinal = clientePartial.region || assignRegionBySede(sedeFinal);
        processed.push({
          rif: clientePartial.rif || '',
          nombre: clientePartial.nombre || '',
          direccion: clientePartial.direccion || '',
          telefono: clientePartial.telefono || '',
          email: clientePartial.email || '',
          contacto: clientePartial.contacto || '',
          region: regionFinal,
          sede: sedeFinal,
          estadoGeografico: clientePartial.estadoGeografico || '',
          ciudad: clientePartial.ciudad || '',
          position: { lat: 0, lng: 0 },
          tipo: clientePartial.tipo || 'tienda',
          observaciones: clientePartial.observaciones || ''
        });
      }
    }

    return processed;
  };

  // Función para manejar la subida del archivo
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona un archivo CSV válido',
        variant: 'destructive'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const csvData = parseCSV(csvText);

        if (csvData.length === 0) {
          toast({
            title: 'Error',
            description: 'El archivo CSV está vacío o no tiene el formato correcto',
            variant: 'destructive'
          });
          return;
        }

        const headers = Object.keys(csvData[0]);
        const mappings = generateAutoMapping(headers);

        setBulkUpload(prev => ({
          ...prev,
          file,
          csvData,
          columnMappings: mappings,
          step: 'mapping'
        }));

        toast({
          title: 'Archivo cargado',
          description: `Se encontraron ${csvData.length} filas de datos`,
        });

      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast({
          title: 'Error',
          description: 'Error al procesar el archivo CSV',
          variant: 'destructive'
        });
      }
    };

    reader.readAsText(file, 'UTF-8');
  };

  // Función para actualizar mapeo de columnas
  const updateColumnMapping = (index: number, field: keyof CreateClienteData | 'skip') => {
    setBulkUpload(prev => ({
      ...prev,
      columnMappings: prev.columnMappings.map((mapping, i) =>
        i === index ? { ...mapping, clienteField: field } : mapping
      )
    }));
  };

  // Función para procesar preview de datos
  const handlePreviewData = () => {
    const processedData = processCSVData(bulkUpload.csvData, bulkUpload.columnMappings);

    if (processedData.length === 0) {
      toast({
        title: 'Error',
        description: 'No se encontraron datos válidos para procesar. Verifica el mapeo de columnas.',
        variant: 'destructive'
      });
      return;
    }

    setBulkUpload(prev => ({
      ...prev,
      previewData: processedData,
      step: 'preview'
    }));
  };

  // Función para procesar la carga masiva en lotes
  const processBulkUpload = async () => {
    if (!currentUser) {
      toast({
        title: 'Error',
        description: 'Usuario no autenticado',
        variant: 'destructive'
      });
      return;
    }

    setBulkUpload(prev => ({
      ...prev,
      processing: true,
      progress: 0,
      step: 'processing'
    }));

    const batchSize = 10; // Procesar en lotes de 10
    const totalBatches = Math.ceil(bulkUpload.previewData.length / batchSize);
    let successCount = 0;
    let failCount = 0;
    const errors: { row: number; error: string }[] = [];

    try {
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, bulkUpload.previewData.length);
        const batch = bulkUpload.previewData.slice(start, end);

        // Procesar lote actual
        for (let i = 0; i < batch.length; i++) {
          const clienteData = batch[i];
          const rowNumber = start + i + 2; // +2 porque empezamos desde fila 2 del CSV (fila 1 son headers)

          try {
            // Verificar permisos para la sede
            if (!canAccessSede(currentUser, clienteData.sede)) {
              errors.push({
                row: rowNumber,
                error: `Sin permisos para crear clientes en la sede ${clienteData.sede}`
              });
              failCount++;
              continue;
            }

            // Preparar datos para Firestore
            const firestoreData = {
              ...clienteData,
              estado: 'activo' as const,
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: currentUser.email || 'admin',
              gpsRequiredInField: true // Marcar que necesita GPS en campo
            };

            // Insertar en Firestore
            await addDoc(collection(getFirestoreClient(), 'clientes'), firestoreData);
            successCount++;

          } catch (error) {
            console.error(`Error creating client at row ${rowNumber}:`, error);
            errors.push({
              row: rowNumber,
              error: error instanceof Error ? error.message : 'Error desconocido'
            });
            failCount++;
          }
        }

        // Actualizar progreso
        const progress = Math.round(((batchIndex + 1) / totalBatches) * 100);
        setBulkUpload(prev => ({
          ...prev,
          progress
        }));

        // Pequeña pausa entre lotes para no sobrecargar Firebase
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Resultado final
      const result: BulkUploadResult = {
        total: bulkUpload.previewData.length,
        successful: successCount,
        failed: failCount,
        errors
      };

      setBulkUpload(prev => ({
        ...prev,
        processing: false,
        result,
        step: 'complete'
      }));

      // Mostrar resultado
      if (successCount > 0) {
        toast({
          title: 'Carga completada',
          description: `${successCount} clientes cargados exitosamente${failCount > 0 ? `, ${failCount} errores` : ''}`,
        });

        // Recargar lista de clientes
        await loadClientes();
      }

    } catch (error) {
      console.error('Error in bulk upload:', error);
      setBulkUpload(prev => ({
        ...prev,
        processing: false
      }));

      toast({
        title: 'Error',
        description: 'Error durante la carga masiva',
        variant: 'destructive'
      });
    }
  };

  // Función para reiniciar carga masiva
  const resetBulkUpload = () => {
    setBulkUpload({
      isOpen: false,
      step: 'upload',
      file: null,
      csvData: [],
      columnMappings: [],
      previewData: [],
      processing: false,
      progress: 0,
      result: null
    });
  };

  const handleNewCliente = () => {
    setIsEditMode(false);
    setCurrentCliente(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleConfigureVisitType = (cliente: Cliente) => {
    // Verificar permisos para configurar tipo de visita del cliente
    if (currentUser && !canAccessSede(currentUser, cliente.sede)) {
      alert('No tienes permisos para configurar el tipo de visita de clientes de esta sede');
      return;
    }

    setSelectedClienteForVisitType(cliente);
    setSelectedVisitType(cliente.tipoVisitaPredeterminado || 'sin_configurar');
    setIsVisitTypeDialogOpen(true);
  };

  const handleSaveVisitType = async () => {
    if (!selectedClienteForVisitType || !selectedVisitType || selectedVisitType === 'sin_configurar') {
      alert('Debes seleccionar un tipo de visita');
      return;
    }

    try {
      const clienteRef = doc(getFirestoreClient(), 'clientes', selectedClienteForVisitType.id);
      await updateDoc(clienteRef, {
        tipoVisitaPredeterminado: selectedVisitType,
        updatedAt: new Date()
      });

      toast({
        title: 'Tipo de visita configurado',
        description: `El tipo de visita "${selectedVisitType}" ha sido asignado al cliente ${selectedClienteForVisitType.nombre}`,
      });

      setIsVisitTypeDialogOpen(false);
      setSelectedClienteForVisitType(null);
      setSelectedVisitType('sin_configurar');
      loadClientes(); // Recargar la lista de clientes
    } catch (error) {
      console.error('Error configurando tipo de visita:', error);
      alert('Error al configurar el tipo de visita');
    }
  };

  // Función para calcular días desde la última visita
  const getDiasSinVisita = (cliente: Cliente): number | null => {
    if (!cliente.lastVisitDate) return null;

    const fechaVisita = typeof cliente.lastVisitDate === 'string'
      ? new Date(cliente.lastVisitDate)
      : cliente.lastVisitDate;

    const hoy = new Date();
    const diferenciaTiempo = hoy.getTime() - fechaVisita.getTime();
    const diferenciaDias = Math.floor(diferenciaTiempo / (1000 * 3600 * 24));

    return diferenciaDias;
  };

  // Función para formatear tiempo sin visita
  const formatTiempoSinVisita = (cliente: Cliente): string => {
    const dias = getDiasSinVisita(cliente);

    if (dias === null) return 'Nunca visitado';
    if (dias === 0) return 'Visitado hoy';
    if (dias === 1) return 'Hace 1 día';
    if (dias < 30) return `Hace ${dias} días`;
    if (dias < 365) {
      const meses = Math.floor(dias / 30);
      return `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    }

    const años = Math.floor(dias / 365);
    return `Hace ${años} ${años === 1 ? 'año' : 'años'}`;
  };

  // Función para formatear fecha específica de visita
  const formatearFechaVisita = (fecha: Date | null): string => {
    if (!fecha) return 'Sin visitas';

    const hoy = new Date();
    const diferenciaTiempo = hoy.getTime() - fecha.getTime();
    const diferenciaDias = Math.floor(diferenciaTiempo / (1000 * 3600 * 24));

    if (diferenciaDias === 0) return 'Hoy';
    if (diferenciaDias === 1) return 'Ayer';
    if (diferenciaDias < 30) return `Hace ${diferenciaDias} días`;
    if (diferenciaDias < 365) {
      const meses = Math.floor(diferenciaDias / 30);
      return `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    }

    const años = Math.floor(diferenciaDias / 365);
    return `Hace ${años} ${años === 1 ? 'año' : 'años'}`;
  };

  // Función para obtener color basado en días sin visita específica
  const getColorVisitaEspecifica = (fecha: Date | null): string => {
    if (!fecha) return 'text-gray-500';

    const hoy = new Date();
    const diferenciaTiempo = hoy.getTime() - fecha.getTime();
    const diferenciaDias = Math.floor(diferenciaTiempo / (1000 * 3600 * 24));

    if (diferenciaDias <= 7) return 'text-green-600 font-medium';
    if (diferenciaDias <= 30) return 'text-yellow-600 font-medium';
    if (diferenciaDias <= 60) return 'text-orange-600 font-medium';
    return 'text-red-600 font-medium';
  };

  // Función para obtener el color del badge de señalización
  const getSeñalizacionColor = (tieneSeñalizacion: boolean | null) => {
    if (tieneSeñalizacion === null) return 'bg-gray-100 text-gray-800';
    return tieneSeñalizacion ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  // Función para obtener el texto del badge de señalización
  const getSeñalizacionText = (tieneSeñalizacion: boolean | null) => {
    if (tieneSeñalizacion === null) return 'Sin información';
    return tieneSeñalizacion ? 'Con señalización' : 'Sin señalización';
  };

  // Función para cargar coordenadas GPS reales (solo cuando se necesite el mapa)
  const loadClientesWithGPS = useCallback(async () => {
    console.log('🗺️ Cargando coordenadas GPS para el mapa...');

    try {
      const clientesRef = collection(getFirestoreClient(), 'clientes');
      let q = query(clientesRef, orderBy('createdAt', 'desc'));

      // Filtrar por sede si no es AdminMaster
      if (currentUser && !userPermissions?.isAdminMaster) {
        console.log(`🔒 Filtrando clientes por sede: ${currentUser.sede}`);
        // No podemos filtrar por sede en Firestore porque no tenemos índice, 
        // filtraremos en memoria después
      }

      const querySnapshot = await getDocs(q);
      console.log(`📊 Clientes obtenidos de Firestore: ${querySnapshot.docs.length}`);

      const clientesConGPS: ClienteConSeñalizacion[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        // Filtrar por permisos en memoria
        if (currentUser && !canAccessSede(currentUser, data.sede)) {
          return; // Saltar este cliente
        }

        // Solo incluir clientes con GPS válido
        if (data.position?.lat && data.position?.lng &&
          data.position.lat !== 0 && data.position.lng !== 0) {
          clientesConGPS.push({
            id: doc.id,
            rif: data.rif || '',
            nombre: data.nombre || '',
            direccion: data.direccion || '',
            telefono: data.telefono,
            email: data.email,
            contacto: data.contacto,
            region: data.region || 'Centro-capital',
            sede: data.sede || 'GRUPO DISBATTERY',
            estadoGeografico: data.estadoGeografico,
            ciudad: data.ciudad || '',
            position: data.position,
            tipo: data.tipo || 'tienda',
            estado: data.estado || 'activo',
            observaciones: data.observaciones,
            tipoVisitaPredeterminado: data.tipoVisitaPredeterminado,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            createdBy: data.createdBy || 'admin',
            lastVisitDate: data.lastVisitDate ? (typeof data.lastVisitDate === 'string' ? data.lastVisitDate : data.lastVisitDate.toDate()) : undefined,
            // Campos de señalización como null por ahora (solo necesitamos GPS)
            tieneSeñalizacion: null,
            signagePhoto: undefined,
            fechaUltimaVisita: null,
            ultimaVisitaMerchandising: null,
            ultimaVisitaTradeImpulso: null,
            signage: undefined,
          });
        }
      });

      console.log(`📍 Clientes con GPS válido encontrados: ${clientesConGPS.length}`);
      console.log(`🏢 Distribución por sede:`, clientesConGPS.reduce((acc, cliente) => {
        acc[cliente.sede] = (acc[cliente.sede] || 0) + 1;
        return acc;
      }, {} as Record<string, number>));

      // Actualizar solo los clientes que ya tenemos, agregando las coordenadas GPS
      setClientes(prevClientes => {
        return prevClientes.map(cliente => {
          const clienteConGPS = clientesConGPS.find(c => c.id === cliente.id);
          if (clienteConGPS) {
            return { ...cliente, position: clienteConGPS.position };
          }
          return cliente;
        });
      });

      toast({
        title: 'Coordenadas GPS cargadas',
        description: `Se cargaron coordenadas para ${clientesConGPS.length} clientes`,
      });

    } catch (error: any) {
      console.error('❌ Error cargando coordenadas GPS:', error);
      toast({
        variant: 'destructive',
        title: 'Error cargando GPS',
        description: 'No se pudieron cargar las coordenadas para el mapa',
      });
    }
  }, [currentUser, userPermissions, toast]);

  // Botón para cargar más clientes
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMoreClients) {
      loadClientes(true);
    }
  }, [loadClientes, loadingMore, hasMoreClients]);

  // Filtrar clientes basado en permisos y filtros actuales (Ciudad y RIF/Nombre) - MEMOIZADO
  const filteredClientes = useMemo(() => {
    console.log('🔍 Filtrando clientes...');
    console.log(`📊 Total clientes cargados: ${clientes.length}`);
    console.log(`👤 Usuario actual: ${currentUser?.fullName} - Sede: ${currentUser?.sede}`);

    const filtered = clientes.filter(cliente => {
      // Permisos por sede
      if (currentUser && !canAccessSede(currentUser, cliente.sede)) {
        console.log(`🚫 Cliente ${cliente.nombre} EXCLUIDO por permisos - Sede cliente: ${cliente.sede}, Sede usuario: ${currentUser.sede}`);
        return false;
      }

      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = term === '' ||
        (cliente.rif || '').toLowerCase().includes(term) ||
        cliente.nombre.toLowerCase().includes(term);

      const matchesCity = filterCity === 'todas' || cliente.ciudad === filterCity;
      const matchesTipo = filterTipo === 'todos' || cliente.tipo === filterTipo;

      // Filtro por tiempo sin visita
      let matchesSinVisita = true;
      if (filterSinVisita !== 'todos') {
        const dias = getDiasSinVisita(cliente);
        const filtroNumero = parseInt(filterSinVisita);

        if (dias === null) {
          matchesSinVisita = true; // Incluir los que nunca han sido visitados
        } else {
          matchesSinVisita = dias >= filtroNumero;
        }
      }

      // Filtro por señalización
      let matchesSeñalizacion = true;
      if (filterSeñalizacion !== 'todos') {
        if (filterSeñalizacion === 'con_señalizacion') {
          matchesSeñalizacion = cliente.tieneSeñalizacion === true;
        } else if (filterSeñalizacion === 'sin_señalizacion') {
          matchesSeñalizacion = cliente.tieneSeñalizacion === false;
        } else if (filterSeñalizacion === 'sin_informacion') {
          matchesSeñalizacion = cliente.tieneSeñalizacion === null;
        }
      }

      return matchesSearch && matchesCity && matchesTipo && matchesSinVisita && matchesSeñalizacion;
    });

    console.log(`✅ Clientes después del filtrado: ${filtered.length}`);
    console.log(`📍 Clientes con GPS válido en filtrados: ${filtered.filter(c => c.position?.lat && c.position?.lng && c.position.lat !== 0 && c.position.lng !== 0).length}`);

    return filtered;
  }, [clientes, currentUser, searchTerm, filterCity, filterTipo, filterSinVisita, filterSeñalizacion]);

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'tienda': return 'bg-blue-100 text-blue-800';
      case 'distribuidor': return 'bg-green-100 text-green-800';
      case 'cliente_especial': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'activo': return 'bg-green-100 text-green-800';
      case 'inactivo': return 'bg-red-100 text-red-800';
      case 'pendiente': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Preparar datos para el heatmap
  const prepareHeatmapData = () => {
    console.log('🗺️ Preparando datos para heatmap...');
    console.log(`📊 Total clientes filtrados: ${filteredClientes.length}`);

    const clientesConGPS = filteredClientes.filter(cliente => {
      const hasValidGPS = cliente.position?.lat &&
        cliente.position?.lng &&
        cliente.position.lat !== 0 &&
        cliente.position.lng !== 0;

      if (!hasValidGPS) {
        console.log(`📍 Cliente sin GPS válido: ${cliente.nombre} - Coordenadas: (${cliente.position?.lat}, ${cliente.position?.lng})`);
      }

      return hasValidGPS;
    });

    console.log(`📍 Clientes con GPS válido: ${clientesConGPS.length} de ${filteredClientes.length}`);
    console.log(`🎯 Sede del usuario actual: ${currentUser?.sede}`);

    if (clientesConGPS.length === 0) {
      console.log('⚠️ PROBLEMA: No hay clientes con coordenadas GPS válidas para mostrar en el mapa');
      console.log('💡 POSIBLES CAUSAS:');
      console.log('   1. Los clientes se cargaron sin coordenadas (optimización)');
      console.log('   2. Los clientes tienen coordenadas (0,0) por defecto');
      console.log('   3. Filtros de permisos están excluyendo clientes');
      console.log('   4. No hay clientes en la sede del usuario');
    }

    return clientesConGPS.map(cliente => ({
      position: {
        lat: cliente.position.lat,
        lng: cliente.position.lng
      },
      weight: 1 // Todos los clientes tienen el mismo peso por ahora
    }));
  };

  // Calcular centro del mapa basado en los clientes filtrados
  const calculateMapCenter = () => {
    if (filteredClientes.length === 0) return { lat: 10.4806, lng: -66.9036 };

    const validClientes = filteredClientes.filter(cliente => cliente.position?.lat && cliente.position?.lng);
    if (validClientes.length === 0) return { lat: 10.4806, lng: -66.9036 };

    const sumLat = validClientes.reduce((sum, cliente) => sum + cliente.position.lat, 0);
    const sumLng = validClientes.reduce((sum, cliente) => sum + cliente.position.lng, 0);

    return {
      lat: sumLat / validClientes.length,
      lng: sumLng / validClientes.length
    };
  };

  // Mostrar pantalla de carga durante autenticación
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
        <p className="text-gray-600">Verificando autenticación...</p>
      </div>
    );
  }

  // Mostrar error de autenticación
  if (authError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md p-6 bg-white rounded-lg shadow-lg">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Error de Autenticación</h1>
          <p className="text-gray-600 mb-4">{authError}</p>
          <p className="text-sm text-gray-500">Redirigiendo al login...</p>
        </div>
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
                  {userPermissions?.isAdminMaster ? 'Admin Master' : `${currentUser?.role} - ${currentUser?.sede}`}
                </div>
              </div>
              <LogoutButton className="ml-3 bg-red-800 hover:bg-red-900 text-white border-0 px-3 py-1 text-sm" />
            </div>
            {/* Mobile Title */}
            <h1 className="sm:hidden text-xl font-semibold text-white">Gestión de Clientes</h1>
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
                {userPermissions?.isAdminMaster ? 'Admin Master' : `${currentUser?.role} - ${currentUser?.sede}`}
              </div>
            </div>
          </div>
          <LogoutButton className="w-full bg-red-700 hover:bg-red-800 text-white" />
        </div>
      )}

      {/* Main Content - Scrollable */}
      <main style={{ backgroundColor: '#a51717' }} className="flex-grow pt-24">
        <div className="max-w-7xl mx-auto p-4">
          <Card className="bg-stone-50 shadow-xl">
            <CardHeader className="border-b border-gray-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    Gestión de Clientes
                  </CardTitle>
                  <CardDescription>
                    Administra los puntos de venta y clientes autorizados
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        console.log('🔄 Forzando actualización de información de señalización...');
                        await loadClientes(); // Esto recargará todos los clientes con señalización
                        toast({
                          title: '🔄 Actualización completada',
                          description: 'Se actualizó la información de señalización de todos los clientes',
                        });
                      } catch (error) {
                        console.error('Error actualizando señalización:', error);
                        toast({
                          variant: 'destructive',
                          title: 'Error',
                          description: 'No se pudo actualizar la información de señalización',
                        });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    variant="outline"
                    className="text-blue-600 border-blue-600 hover:bg-blue-50"
                  >
                    🔄 Actualizar Señalización
                  </Button>
                  <Button
                    onClick={() => setBulkUpload(prev => ({ ...prev, isOpen: true }))}
                    variant="outline"
                    className="text-green-600 border-green-600 hover:bg-green-50"
                    disabled={!userPermissions?.canManageClients}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Carga Masiva
                  </Button>
                  <Button
                    onClick={handleNewCliente}
                    className="bg-red-600 hover:bg-red-700 text-white"
                    disabled={!userPermissions?.canManageClients}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Cliente
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 max-h-none overflow-visible">
              <Tabs defaultValue="tabla" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="tabla">Tabla de Clientes</TabsTrigger>
                  <TabsTrigger value="mapa">Vista de Mapa</TabsTrigger>
                </TabsList>

                <TabsContent value="tabla" className="space-y-4">
                  {/* Filtros */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                    <div>
                      <Label htmlFor="search">Buscar</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="search"
                          placeholder="Buscar por RIF o nombre..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="ciudad">Ciudad</Label>
                      <Select value={filterCity} onValueChange={(value: string) => setFilterCity(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todas">Todas las ciudades</SelectItem>
                          {/* Derivar lista única de ciudades desde clientes cargados */}
                          {[...new Set(clientes.map(c => c.ciudad).filter(Boolean))]
                            .sort((a, b) => a.localeCompare(b))
                            .map(ci => (
                              <SelectItem key={ci} value={ci}>{ci}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="tipo">Tipo</Label>
                      <Select value={filterTipo} onValueChange={(value: 'todos' | 'tienda' | 'distribuidor' | 'cliente_especial') => setFilterTipo(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos los tipos</SelectItem>
                          <SelectItem value="tienda">Tienda</SelectItem>
                          <SelectItem value="distribuidor">Distribuidor</SelectItem>
                          <SelectItem value="cliente_especial">Cliente Especial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="sin-visita">Sin visita desde</Label>
                      <Select value={filterSinVisita} onValueChange={(value: 'todos' | '7' | '15' | '30' | '60' | '90') => setFilterSinVisita(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos los clientes</SelectItem>
                          <SelectItem value="7">7+ días sin visita</SelectItem>
                          <SelectItem value="15">15+ días sin visita</SelectItem>
                          <SelectItem value="30">30+ días sin visita</SelectItem>
                          <SelectItem value="60">60+ días sin visita</SelectItem>
                          <SelectItem value="90">90+ días sin visita</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="señalizacion">Señalización</Label>
                      <Select value={filterSeñalizacion} onValueChange={(value: 'todos' | 'con_señalizacion' | 'sin_señalizacion' | 'sin_informacion') => setFilterSeñalizacion(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos los clientes</SelectItem>
                          <SelectItem value="con_señalizacion">Con señalización</SelectItem>
                          <SelectItem value="sin_señalizacion">Sin señalización</SelectItem>
                          <SelectItem value="sin_informacion">Sin información</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Tabla - Contenedeor con scroll más grande */}
                  <div className="border rounded-lg max-h-[600px] overflow-y-auto overflow-x-auto">
                    {/* Desktop Table View */}
                    <div className="mobile-table">
                      <Table className="responsive-table">
                        <TableHeader className="sticky top-0 bg-white z-10">
                          <TableRow>
                            <TableHead>RIF</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Dirección</TableHead>
                            <TableHead>Ciudad</TableHead>
                            <TableHead>Región</TableHead>
                            <TableHead>Sede</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Señalización</TableHead>
                            <TableHead>Última Merchandising</TableHead>
                            <TableHead>Última Trade-Impulso</TableHead>
                            <TableHead>Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={12} className="text-center py-8">
                                Cargando clientes...
                              </TableCell>
                            </TableRow>
                          ) : filteredClientes.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={12} className="text-center py-8 text-gray-500">
                                No se encontraron clientes
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredClientes.map((cliente) => (
                              <TableRow key={cliente.id}>
                                <TableCell className="font-mono text-sm">{cliente.rif || 'N/A'}</TableCell>
                                <TableCell className="font-medium">
                                  <Button
                                    variant="ghost"
                                    className="p-0 h-auto font-medium text-left hover:text-blue-600 hover:bg-transparent"
                                    onClick={() => handleConfigureVisitType(cliente)}
                                    disabled={currentUser ? !canAccessSede(currentUser, cliente.sede) : false}
                                  >
                                    {cliente.nombre}
                                  </Button>
                                </TableCell>
                                <TableCell className="text-truncate max-w-[200px]" title={cliente.direccion}>{cliente.direccion}</TableCell>
                                <TableCell className="text-truncate max-w-[120px]" title={cliente.ciudad}>{cliente.ciudad}</TableCell>
                                <TableCell className="text-truncate max-w-[120px]" title={cliente.region}>{cliente.region}</TableCell>
                                <TableCell className="text-truncate max-w-[120px]" title={cliente.sede}>{cliente.sede}</TableCell>
                                <TableCell>
                                  <Badge className={getTipoColor(cliente.tipo)}>
                                    {cliente.tipo}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={getEstadoColor(cliente.estado)}>
                                    {cliente.estado}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {cliente.tieneSeñalizacion && cliente.signagePhoto && cliente.signagePhoto !== 'No capturada' && cliente.signagePhoto.startsWith('http') ? (
                                    <div className="flex items-center gap-2">
                                      <Badge className={getSeñalizacionColor(cliente.tieneSeñalizacion ?? null)}>
                                        {getSeñalizacionText(cliente.tieneSeñalizacion ?? null)}
                                      </Badge>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleViewSignagePhoto(cliente)}
                                        className="h-6 px-2 text-xs"
                                        title="Ver foto de señalización"
                                      >
                                        📷
                                      </Button>
                                    </div>
                                  ) : (
                                    <Badge className={getSeñalizacionColor(cliente.tieneSeñalizacion ?? null)}>
                                      {getSeñalizacionText(cliente.tieneSeñalizacion ?? null)}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className={`text-sm ${getColorVisitaEspecifica(cliente.ultimaVisitaMerchandising || null)}`}>
                                    {formatearFechaVisita(cliente.ultimaVisitaMerchandising || null)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className={`text-sm ${getColorVisitaEspecifica(cliente.ultimaVisitaTradeImpulso || null)}`}>
                                    {formatearFechaVisita(cliente.ultimaVisitaTradeImpulso || null)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditCliente(cliente)}
                                      disabled={currentUser ? !canAccessSede(currentUser, cliente.sede) : false}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDelete(cliente.id)}
                                      className="text-red-600 hover:text-red-700"
                                      disabled={currentUser ? !canAccessSede(currentUser, cliente.sede) : false}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="mobile-card">
                      {loading ? (
                        <div className="text-center py-8">
                          Cargando clientes...
                        </div>
                      ) : filteredClientes.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          No se encontraron clientes
                        </div>
                      ) : (
                        filteredClientes.map((cliente) => (
                          <div key={cliente.id} className="mobile-card-item">
                            <div className="mobile-card-header">
                              <Button
                                variant="ghost"
                                className="p-0 h-auto font-medium text-left hover:text-blue-600 hover:bg-transparent"
                                onClick={() => handleConfigureVisitType(cliente)}
                                disabled={currentUser ? !canAccessSede(currentUser, cliente.sede) : false}
                              >
                                {cliente.nombre}
                              </Button>
                            </div>

                            <div className="space-y-2">
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">RIF:</span>
                                <span className="mobile-card-value font-mono text-sm">{cliente.rif || 'N/A'}</span>
                              </div>

                              <div className="mobile-card-field">
                                <span className="mobile-card-label">Dirección:</span>
                                <span className="mobile-card-value text-truncate text-sm max-w-[200px]" title={cliente.direccion}>{cliente.direccion}</span>
                              </div>

                              <div className="mobile-card-field">
                                <span className="mobile-card-label">Ciudad:</span>
                                <span className="mobile-card-value text-sm">{cliente.ciudad}</span>
                              </div>

                              <div className="mobile-card-field">
                                <span className="mobile-card-label">Región/Sede:</span>
                                <span className="mobile-card-value text-sm">{cliente.region} / {cliente.sede}</span>
                              </div>

                              <div className="mobile-card-field">
                                <span className="mobile-card-label">Tipo:</span>
                                <Badge className={getTipoColor(cliente.tipo)} variant="secondary">
                                  {cliente.tipo}
                                </Badge>
                              </div>

                              <div className="mobile-card-field">
                                <span className="mobile-card-label">Estado:</span>
                                <Badge className={getEstadoColor(cliente.estado)} variant="secondary">
                                  {cliente.estado}
                                </Badge>
                              </div>

                              <div className="mobile-card-field">
                                <span className="mobile-card-label">Señalización:</span>
                                {cliente.tieneSeñalizacion && cliente.signagePhoto && cliente.signagePhoto !== 'No capturada' && cliente.signagePhoto.startsWith('http') ? (
                                  <div className="flex items-center gap-2">
                                    <Badge className={getSeñalizacionColor(cliente.tieneSeñalizacion ?? null)} variant="secondary">
                                      {getSeñalizacionText(cliente.tieneSeñalizacion ?? null)}
                                    </Badge>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleViewSignagePhoto(cliente)}
                                      className="h-6 px-2 text-xs"
                                      title="Ver foto de señalización"
                                    >
                                      📷
                                    </Button>
                                  </div>
                                ) : (
                                  <Badge className={getSeñalizacionColor(cliente.tieneSeñalizacion ?? null)} variant="secondary">
                                    {getSeñalizacionText(cliente.tieneSeñalizacion ?? null)}
                                  </Badge>
                                )}
                              </div>

                              <div className="mobile-card-field">
                                <span className="mobile-card-label">Última Merchandising:</span>
                                <span className={`text-sm font-medium ${getColorVisitaEspecifica(cliente.ultimaVisitaMerchandising || null)}`}>
                                  {formatearFechaVisita(cliente.ultimaVisitaMerchandising || null)}
                                </span>
                              </div>

                              <div className="mobile-card-field">
                                <span className="mobile-card-label">Última Trade-Impulso:</span>
                                <span className={`text-sm font-medium ${getColorVisitaEspecifica(cliente.ultimaVisitaTradeImpulso || null)}`}>
                                  {formatearFechaVisita(cliente.ultimaVisitaTradeImpulso || null)}
                                </span>
                              </div>
                            </div>

                            <div className="mobile-card-actions">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditCliente(cliente)}
                                disabled={currentUser ? !canAccessSede(currentUser, cliente.sede) : false}
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(cliente.id)}
                                className="text-red-600 hover:text-red-700"
                                disabled={currentUser ? !canAccessSede(currentUser, cliente.sede) : false}
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Eliminar
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Botón para cargar más clientes */}
                  {hasMoreClients && (
                    <div className="flex justify-center mt-4">
                      <Button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        variant="outline"
                        className="w-full max-w-xs"
                      >
                        {loadingMore ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                            Cargando más clientes...
                          </>
                        ) : (
                          `Cargar más clientes (${filteredClientes.length} mostrados)`
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Información de paginación */}
                  <div className="text-center text-sm text-gray-500 mt-2">
                    {filteredClientes.length > 0 && (
                      <span>
                        Mostrando {filteredClientes.length} cliente{filteredClientes.length !== 1 ? 's' : ''}
                        {!hasMoreClients && ' (todos cargados)'}
                      </span>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="mapa" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Vista de Mapa</span>
                        <Button
                          onClick={loadClientesWithGPS}
                          variant="outline"
                          size="sm"
                          className="text-blue-600 border-blue-600 hover:bg-blue-50"
                        >
                          📍 Cargar Coordenadas GPS
                        </Button>
                      </CardTitle>
                      <CardDescription>
                        Visualiza la concentración de clientes con un mapa de calor
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <GoogleMaps
                        center={calculateMapCenter()}
                        zoom={filteredClientes.length > 0 ? 10 : 7}
                        height="600px"
                        heatmapData={prepareHeatmapData()}
                        showHeatmap={true}
                      />
                      <div className="mt-4 text-sm text-gray-600">
                        <div className="flex items-center justify-between">
                          <span>Total de clientes mostrados: {filteredClientes.length}</span>
                          <span>Clientes con ubicación: {filteredClientes.filter(c => c.position?.lat && c.position?.lng).length}</span>
                        </div>
                        <div className="mt-2 text-xs">
                          <span className="font-medium">Interpretación del mapa de calor:</span>
                          <div className="flex items-center gap-4 mt-1">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ background: 'linear-gradient(90deg, #00ffff 0%, #0000ff 50%, #ff0000 100%)' }}></div>
                              <span>Azul (menos concentración) → Rojo (mayor concentración)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
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

      {/* Dialog para crear/editar cliente */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[85vw] md:max-w-2xl lg:max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? 'Editar Cliente' : 'Nuevo Cliente'}
            </DialogTitle>
            <DialogDescription>
              {isEditMode ? 'Modifica la información del cliente' : 'Agrega un nuevo punto de venta o cliente'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rif">RIF del Cliente *</Label>
                <Input
                  id="rif"
                  placeholder="J123456789"
                  value={formData.rif}
                  onChange={(e) => setFormData({ ...formData, rif: e.target.value.toUpperCase() })}
                  maxLength={10}
                  pattern="^[J]\d{9}$"
                  title="Formato: J123456789"
                  required
                  className="font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">Formato: J seguido de 9 números</p>
              </div>

              <div>
                <Label htmlFor="nombre">Nombre del Cliente *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="tipo">Tipo *</Label>
                <Select value={formData.tipo} onValueChange={(value: 'tienda' | 'distribuidor' | 'cliente_especial') => setFormData({ ...formData, tipo: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tienda">Tienda</SelectItem>
                    <SelectItem value="distribuidor">Distribuidor</SelectItem>
                    <SelectItem value="cliente_especial">Cliente Especial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="direccion">Dirección *</Label>
                <Input
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="contacto">Contacto</Label>
                <Input
                  id="contacto"
                  value={formData.contacto}
                  onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="region">Región *</Label>
                <Select
                  key={`region-${currentCliente?.id || 'new'}-${formData.region}`}
                  value={formData.region}
                  onValueChange={(value: Region) => {
                    const sedesDisponibles = getSedesByRegion(value);
                    const firstSede = sedesDisponibles[0]?.name || 'GRUPO DISBATTERY';
                    const cities = getCitiesBySede(firstSede);

                    console.log('Cambiando región a:', value);
                    console.log('Sedes disponibles:', sedesDisponibles.map(s => s.name));
                    console.log('Primera sede seleccionada:', firstSede);
                    console.log('Ciudades para la nueva sede:', cities.length, 'ciudades');

                    setFormData({
                      ...formData,
                      region: value,
                      sede: firstSede,
                      ciudad: ''
                    });
                    setAvailableCities(cities);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una región" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Centro-capital">Centro-capital (GRUPO DISBATTERY)</SelectItem>
                    <SelectItem value="Centro-Los llanos">Centro-Los llanos (BLITZ 2000)</SelectItem>
                    <SelectItem value="Occidente">Occidente (GRUPO VICTORIA)</SelectItem>
                    <SelectItem value="Oriente">Oriente (DISBATTERY)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="sede">Sede *</Label>
                <Select
                  key={`sede-${currentCliente?.id || 'new'}-${formData.region}-${formData.sede}`}
                  value={formData.sede}
                  onValueChange={(value: Sede) => {
                    const cities = getCitiesBySede(value);

                    console.log('Cambiando sede a:', value);
                    console.log('Ciudades disponibles para la sede:', cities.length, 'ciudades');
                    console.log('Primeras ciudades:', cities.slice(0, 5));

                    setFormData({ ...formData, sede: value, ciudad: '' });
                    setAvailableCities(cities);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {getSedesByRegion(formData.region)
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
                <Label htmlFor="ciudad">Ciudad *</Label>
                <Combobox
                  key={`ciudad-${currentCliente?.id || 'new'}-${formData.sede}-${availableCities.length}`}
                  options={availableCities.map((ciudad): ComboboxOption => ({
                    value: ciudad,
                    label: ciudad
                  }))}
                  value={formData.ciudad}
                  onValueChange={(value: string) => {
                    console.log('Seleccionando ciudad:', value);
                    console.log('Ciudades disponibles actualmente:', availableCities.length);
                    console.log('¿Ciudad está en la lista?', availableCities.includes(value));
                    setFormData({ ...formData, ciudad: value });
                  }}
                  placeholder="Selecciona una ciudad"
                  searchPlaceholder="Buscar ciudad..."
                  emptyText={`No hay ciudades disponibles para ${formData.sede}`}
                />
                {availableCities.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    No se encontraron ciudades para la sede seleccionada.
                  </p>
                )}
                {availableCities.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {availableCities.length} ciudades disponibles para {formData.sede}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="tipoVisitaPredeterminado">Tipo de Visita Predeterminado</Label>
              <Select
                value={formData.tipoVisitaPredeterminado || 'sin_configurar'}
                onValueChange={(value: 'Merchandising' | 'Trade (Eventos)' | 'Trade (Impulso)' | 'sin_configurar') =>
                  setFormData({ ...formData, tipoVisitaPredeterminado: value === 'sin_configurar' ? undefined : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo de visita (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin_configurar">Sin configurar</SelectItem>
                  <SelectItem value="Merchandising">Merchandising</SelectItem>
                  <SelectItem value="Trade (Eventos)">Trade (Eventos)</SelectItem>
                  <SelectItem value="Trade (Impulso)">Trade (Impulso)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Si se configura, los mercaderistas no tendrán que seleccionar el tipo de visita manualmente
              </p>
            </div>

            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                rows={3}
              />
            </div>

            {/* Selector de mapa - OPCIONAL */}
            <div>
              <Label htmlFor="ubicacion">Ubicación GPS (Opcional)</Label>
              <p className="text-xs text-gray-500 mb-3">
                📍 <strong>¡Nuevo!</strong> Si no tienes las coordenadas exactas, puedes dejar esto vacío.
                Los mercaderistas podrán capturar la ubicación GPS directamente cuando visiten al cliente en campo.
              </p>
              <MapSelector
                onPositionSelect={setSelectedPosition}
                initialPosition={currentCliente?.position}
                className="w-full"
              />
              {!selectedPosition && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-800">
                    <span>💡</span>
                    <span className="font-medium text-sm">Tip: Sin coordenadas GPS</span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    Este cliente aparecerá marcado como "📍 Sin GPS" y los mercaderistas podrán agregar
                    la ubicación cuando lo visiten por primera vez.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-white">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700">
                {isEditMode ? 'Actualizar' : 'Crear'} Cliente
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para configurar tipo de visita */}
      <Dialog open={isVisitTypeDialogOpen} onOpenChange={setIsVisitTypeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Configurar Tipo de Visita
            </DialogTitle>
            <DialogDescription>
              Selecciona el tipo de visita predeterminado para {selectedClienteForVisitType?.nombre}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="visit-type">Tipo de Visita *</Label>
              <Select
                value={selectedVisitType}
                onValueChange={(value: 'Merchandising' | 'Trade (Eventos)' | 'Trade (Impulso)' | 'sin_configurar') => setSelectedVisitType(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo de visita" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin_configurar">Sin configurar</SelectItem>
                  <SelectItem value="Merchandising">Merchandising</SelectItem>
                  <SelectItem value="Trade (Eventos)">Trade (Eventos)</SelectItem>
                  <SelectItem value="Trade (Impulso)">Trade (Impulso)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              <p className="font-medium mb-1">ℹ️ Información:</p>
              <p>
                Al configurar un tipo de visita predeterminado, los mercaderistas no tendrán que seleccionarlo
                manualmente cuando visiten este cliente. El sistema automáticamente usará este tipo de visita.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsVisitTypeDialogOpen(false);
                  setSelectedClienteForVisitType(null);
                  setSelectedVisitType('sin_configurar');
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveVisitType}
                className="bg-red-600 hover:bg-red-700"
                disabled={!selectedVisitType || selectedVisitType === 'sin_configurar'}
              >
                Guardar Configuración
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Carga Masiva */}
      <Dialog open={bulkUpload.isOpen} onOpenChange={(open) => {
        if (!open && !bulkUpload.processing) {
          resetBulkUpload();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Carga Masiva de Clientes
            </DialogTitle>
            <DialogDescription>
              Importa múltiples clientes desde un archivo CSV
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Paso 1: Subir archivo */}
            {bulkUpload.step === 'upload' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Selecciona un archivo CSV</h3>
                    <p className="text-sm text-gray-500">
                      El archivo debe contener las columnas de datos de clientes
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label
                      htmlFor="csv-upload"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Seleccionar Archivo CSV
                    </label>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Formato CSV esperado:</strong> CodigoCliente, nombreCliente, rif, Direccion, Estado, Nombresucursal, nombreVendedor.
                    <br />
                    <strong>🎯 Mapeo automático Estado → Sede → Región:</strong>
                    <br />
                    • <strong>GRUPO DISBATTERY</strong> (Centro-capital): Distrito Capital, Miranda, Vargas
                    <br />
                    • <strong>DISBATTERY</strong> (Oriente): Aragua, Anzoátegui, Bolívar, Monagas, Sucre, Nueva Esparta
                    <br />
                    • <strong>BLITZ 2000</strong> (Centro-Los llanos): Carabobo, Guárico, Lara, Yaracuy, Falcón, Zulia, Táchira, Mérida, Trujillo
                    <br />
                    • <strong>GRUPO VICTORIA</strong> (Oriente): Cojedes, Portuguesa, Barinas, Apure, Amazonas, Delta Amacuro
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Paso 2: Mapear columnas */}
            {bulkUpload.step === 'mapping' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Mapear Columnas del CSV</h3>
                  <Badge variant="outline">
                    {bulkUpload.csvData.length} filas encontradas
                  </Badge>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {bulkUpload.columnMappings.map((mapping, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <Label className="font-medium">{mapping.csvColumn}</Label>
                        <p className="text-sm text-gray-500">
                          Ejemplo: {bulkUpload.csvData[0]?.[mapping.csvColumn] || 'Sin datos'}
                        </p>
                      </div>
                      <div className="w-48">
                        <Select
                          value={mapping.clienteField}
                          onValueChange={(value) => updateColumnMapping(index, value as keyof CreateClienteData | 'skip')}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar campo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">Omitir</SelectItem>
                            <SelectItem value="rif">RIF</SelectItem>
                            <SelectItem value="nombre">Nombre*</SelectItem>
                            <SelectItem value="direccion">Dirección*</SelectItem>
                            <SelectItem value="telefono">Teléfono</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="contacto">Contacto</SelectItem>
                            <SelectItem value="region">Región</SelectItem>
                            <SelectItem value="sede">Sede</SelectItem>
                            <SelectItem value="estadoGeografico">Estado</SelectItem>
                            <SelectItem value="ciudad">Ciudad</SelectItem>
                            <SelectItem value="tipo">Tipo</SelectItem>
                            <SelectItem value="observaciones">Observaciones</SelectItem>
                          </SelectContent>
                        </Select>
                        {mapping.required && (
                          <p className="text-xs text-red-500 mt-1">Campo requerido</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setBulkUpload(prev => ({ ...prev, step: 'upload' }))}
                  >
                    Volver
                  </Button>
                  <Button
                    onClick={handlePreviewData}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Vista Previa
                  </Button>
                </div>
              </div>
            )}

            {/* Paso 3: Vista previa */}
            {bulkUpload.step === 'preview' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Vista Previa de Datos</h3>
                  <Badge variant="outline">
                    {bulkUpload.previewData.length} clientes válidos
                  </Badge>
                </div>

                {bulkUpload.previewData.length > 0 ? (
                  <>
                    <div className="max-h-96 overflow-y-auto border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Dirección</TableHead>
                            <TableHead>RIF</TableHead>
                            <TableHead>Región</TableHead>
                            <TableHead>Sede</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Tipo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bulkUpload.previewData.slice(0, 10).map((cliente, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{cliente.nombre}</TableCell>
                              <TableCell>{cliente.direccion}</TableCell>
                              <TableCell>{cliente.rif || 'Sin RIF'}</TableCell>
                              <TableCell>{cliente.region}</TableCell>
                              <TableCell>{cliente.sede}</TableCell>
                              <TableCell>{cliente.estadoGeografico || 'Sin estado'}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{cliente.tipo}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {bulkUpload.previewData.length > 10 && (
                      <p className="text-sm text-gray-500 text-center">
                        ... y {bulkUpload.previewData.length - 10} clientes más
                      </p>
                    )}

                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Los datos se ven correctos. Los clientes se crearán con GPS en (0,0) y los mercaderistas
                        podrán actualizar las coordenadas cuando visiten cada punto.
                      </AlertDescription>
                    </Alert>

                    <div className="flex justify-between">
                      <Button
                        variant="outline"
                        onClick={() => setBulkUpload(prev => ({ ...prev, step: 'mapping' }))}
                      >
                        Volver al Mapeo
                      </Button>
                      <Button
                        onClick={processBulkUpload}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Procesar Carga ({bulkUpload.previewData.length} clientes)
                      </Button>
                    </div>
                  </>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No se encontraron datos válidos. Verifica que las columnas estén mapeadas correctamente.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Paso 4: Procesando */}
            {bulkUpload.step === 'processing' && (
              <div className="space-y-4 text-center">
                <div className="mx-auto w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <h3 className="text-lg font-medium">Procesando carga masiva...</h3>
                <p className="text-sm text-gray-500">
                  Por favor espera mientras se cargan los clientes
                </p>
                <div className="space-y-2">
                  <Progress value={bulkUpload.progress} className="w-full" />
                  <p className="text-sm">{bulkUpload.progress}% completado</p>
                </div>
              </div>
            )}

            {/* Paso 5: Resultado */}
            {bulkUpload.step === 'complete' && bulkUpload.result && (
              <div className="space-y-4">
                <div className="text-center">
                  <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-medium">Carga Completada</h3>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {bulkUpload.result.successful}
                    </div>
                    <div className="text-sm text-green-700">Exitosos</div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {bulkUpload.result.failed}
                    </div>
                    <div className="text-sm text-red-700">Fallidos</div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {bulkUpload.result.total}
                    </div>
                    <div className="text-sm text-blue-700">Total</div>
                  </div>
                </div>

                {bulkUpload.result.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-red-600">Errores encontrados:</h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {bulkUpload.result.errors.map((error, index) => (
                        <Alert key={index} variant="destructive" className="py-2">
                          <AlertDescription>
                            Fila {error.row}: {error.error}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-center">
                  <Button
                    onClick={resetBulkUpload}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para ver foto de señalización */}
      <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              📷 Foto de Señalización - {selectedClienteName}
            </DialogTitle>
            <DialogDescription>
              Foto capturada durante la visita de merchandising
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            {selectedPhotoUrl && (
              <img
                src={selectedPhotoUrl}
                alt={`Señalización de ${selectedClienteName}`}
                className="max-w-full max-h-96 object-contain rounded-lg shadow-lg"
                onError={(e) => {
                  console.error('Error cargando imagen:', selectedPhotoUrl);
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y5ZmFmYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNHB4IiBmaWxsPSIjNjM3MzgxIj5FcnJvciBjYXJnYW5kbyBpbWFnZW48L3RleHQ+PC9zdmc+';
                }}
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => window.open(selectedPhotoUrl, '_blank')}
              disabled={!selectedPhotoUrl}
            >
              Abrir en nueva pestaña
            </Button>
            <Button onClick={() => setPhotoModalOpen(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 