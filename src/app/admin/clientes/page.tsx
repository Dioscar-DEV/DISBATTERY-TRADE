'use client';

import { useState, useEffect } from 'react';
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
import { MapPin, Plus, Edit, Trash2, Search, Filter, UserCircle, ArrowLeft, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Cliente, CreateClienteData, Region, Sede, SEDES_DATA, getSedesByRegion, getCitiesBySede } from '@/types/routes';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/clientApp';
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

export default function GestionClientesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [clientes, setClientes] = useState<ClienteConSeñalizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
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
    // Verificar autenticación y cargar permisos
    if (typeof window !== 'undefined') {
      const isAdmin = localStorage.getItem('isAdminLoggedIn');
      if (isAdmin !== 'true') {
        router.push('/');
        return;
      }
    }

    // Cargar datos del usuario y sus permisos
    const loadUserData = async () => {
      try {
        const result = await getCurrentUserWithPermissions();
        if (result) {
          setCurrentUser(result.user);
          setUserPermissions(result.permissions);
          
          // Si el usuario no puede gestionar clientes, redirigir
          if (!result.permissions.canManageClients) {
            router.push('/admin/dashboard');
            return;
          }
        }
      } catch (error) {
        console.error('Error cargando datos del usuario:', error);
      }
    };

    loadUserData();
    loadClientes();
  }, [router]);

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
      
      const visitasRef = collection(db, 'visitas');
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
        .filter((visita: any) => {
          const tv = (visita.tipoVisita || '').toString();
          const tvLower = tv.toLowerCase();
          // Aceptar tanto variantes antiguas como nuevas
          return tv === 'Merchandising' ||
                 tvLower === 'merchandising' ||
                 tvLower === 'qualid-merchandising' ||
                 tvLower === 'shell-merchandising' ||
                 tvLower === 'signage-capture' ||
                 tv === 'Trade (Merchandising)' ||
                 tvLower === 'trade (merchandising)';
        })
        .sort((a: any, b: any) => {
          const fechaA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt || new Date(0));
          const fechaB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt || new Date(0));
          return fechaB.getTime() - fechaA.getTime();
        });

      // Visitas de trade-impulso
      const visitasTradeImpulso = visitas
        .filter((visita: any) => {
          const tv = (visita.tipoVisita || '').toString();
          const tvLower = tv.toLowerCase();
          return tv === 'Trade (Impulso)' ||
                 tvLower === 'trade-impulso' ||
                 tvLower === 'trade (impulso)';
        })
        .sort((a: any, b: any) => {
          const fechaA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt || new Date(0));
          const fechaB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt || new Date(0));
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
          ? (visitasMerchandising[0] as any).createdAt?.toDate ? (visitasMerchandising[0] as any).createdAt.toDate() : (visitasMerchandising[0] as any).createdAt || null
          : null,
        ultimaVisitaTradeImpulso: visitasTradeImpulso.length > 0
          ? (visitasTradeImpulso[0] as any).createdAt?.toDate ? (visitasTradeImpulso[0] as any).createdAt.toDate() : (visitasTradeImpulso[0] as any).createdAt || null
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
      
      const visitasRef = collection(db, 'visitas');
      
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
          .filter((visita: any) => {
            // Solo visitas de merchandising/señalización (aceptar variantes)
            const tv = (visita.tipoVisita || '').toString();
            const tvLower = tv.toLowerCase();
            return tv === 'Merchandising' ||
                   tvLower === 'merchandising' ||
                   tvLower === 'qualid-merchandising' ||
                   tvLower === 'shell-merchandising' ||
                   tvLower === 'signage-capture';
          })
         .sort((a: any, b: any) => {
           // Ordenar por fecha de creación (más reciente primero)
           const fechaA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt || new Date(0));
           const fechaB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt || new Date(0));
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
         fecha: ultimaVisita.createdAt?.toDate ? ultimaVisita.createdAt.toDate() : ultimaVisita.createdAt,
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
            const valorSeñalizacion = data.señalizacion;
            console.log(`🎯 Campo directo 'señalizacion' encontrado:`, valorSeñalizacion);
            
            if (valorSeñalizacion === true || valorSeñalizacion === 'true' || 
                valorSeñalizacion === 'sí' || valorSeñalizacion === 'si' || 
                valorSeñalizacion === 'yes' || valorSeñalizacion === '1' ||
                valorSeñalizacion === 1) {
              tieneSeñalizacion = true;
              estado = 'Con señalización';
              detalles = `Confirmado: campo 'señalizacion' = ${valorSeñalizacion}`;
            } else if (valorSeñalizacion === false || valorSeñalizacion === 'false' ||
                       valorSeñalizacion === 'no' || valorSeñalizacion === '0' ||
                       valorSeñalizacion === 0) {
              tieneSeñalizacion = false;
              estado = 'Sin señalización';
              detalles = `Confirmado: campo 'señalizacion' = ${valorSeñalizacion}`;
            }
          } else if (data.signage !== undefined) {
            const valorSignage = data.signage;
            console.log(`🎯 Campo directo 'signage' encontrado:`, valorSignage);
            
            if (valorSignage === true || valorSignage === 'true' || 
                valorSignage === 'sí' || valorSignage === 'si' || 
                valorSignage === 'yes' || valorSignage === '1' ||
                valorSignage === 1) {
              tieneSeñalizacion = true;
              estado = 'Con señalización';
              detalles = `Confirmado: campo 'signage' = ${valorSignage}`;
            } else if (valorSignage === false || valorSignage === 'false' ||
                       valorSignage === 'no' || valorSignage === '0' ||
                       valorSignage === 0) {
              tieneSeñalizacion = false;
              estado = 'Sin señalización';
              detalles = `Confirmado: campo 'signage' = ${valorSignage}`;
            }
          }

          // Revisión adicional: algunos formularios guardan 'hasSignage'
          if (estado === 'Sin información' && data.hasSignage !== undefined) {
            const v = data.hasSignage;
            if (v === true || v === 'true' || v === 'sí' || v === 'si' || v === 'yes' || v === '1' || v === 1) {
              tieneSeñalizacion = true;
              estado = 'Con señalización';
              detalles = `Confirmado: campo 'hasSignage' = ${v}`;
            } else if (v === false || v === 'false' || v === 'no' || v === '0' || v === 0) {
              tieneSeñalizacion = false;
              estado = 'Sin señalización';
              detalles = `Confirmado: campo 'hasSignage' = ${v}`;
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
         ultimaVisita: ultimaVisita.createdAt?.toDate ? ultimaVisita.createdAt.toDate() : (ultimaVisita.createdAt || null),
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

  const loadClientes = async () => {
    try {
      setLoading(true);
      const clientesRef = collection(db, 'clientes');
      const q = query(clientesRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const clientesData: Cliente[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        clientesData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          lastVisitDate: data.lastVisitDate ? (typeof data.lastVisitDate === 'string' ? data.lastVisitDate : data.lastVisitDate.toDate()) : undefined,
        } as Cliente);
      });
      
      // Obtener información de señalización y últimas visitas por tipo para cada cliente
      const clientesConSeñalizacion: ClienteConSeñalizacion[] = await Promise.all(
        clientesData.map(async (cliente) => {
          if (!cliente.rif) {
            return { 
              ...cliente, 
              tieneSeñalizacion: null, 
              fechaUltimaVisita: null,
              ultimaVisitaMerchandising: null,
              ultimaVisitaTradeImpulso: null
            };
          }
          
          // ✅ USAR DIRECTAMENTE EL CAMPO signage DEL CLIENTE (más eficiente y preciso)
          const ultimasVisitas = await obtenerUltimasVisitasPorTipo(cliente.rif);
          
          // Determinar señalización desde el campo signage del cliente
          const clienteExtendido = cliente as any; // Cast para acceder a campos adicionales
          let tieneSeñalizacion: boolean | null = null;
          if (clienteExtendido.signage === 'con') {
            tieneSeñalizacion = true;
          } else if (clienteExtendido.signage === 'sin') {
            tieneSeñalizacion = false;
          }
          // Si signage no está definido o es otro valor, mantener null
          
          console.log(`🚩 Cliente ${cliente.rif}: signage="${clienteExtendido.signage}", tieneSeñalizacion=${tieneSeñalizacion}`);
          
          return {
            ...cliente,
            tieneSeñalizacion: tieneSeñalizacion,
            fechaUltimaVisita: cliente.lastVisitDate ? new Date(cliente.lastVisitDate) : null,
            ultimaVisitaMerchandising: ultimasVisitas.ultimaVisitaMerchandising,
            ultimaVisitaTradeImpulso: ultimasVisitas.ultimaVisitaTradeImpulso
          };
        })
      );
      
      setClientes(clientesConSeñalizacion);
    } catch (error) {
      console.error('Error cargando clientes:', error);
    } finally {
      setLoading(false);
    }
  };



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

      if (editingCliente) {
        // Actualizar cliente existente
        const clienteRef = doc(db, 'clientes', editingCliente.id);
        await updateDoc(clienteRef, {
          ...clienteData,
          updatedAt: new Date()
        });
      } else {
        // Crear nuevo cliente
        await addDoc(collection(db, 'clientes'), clienteData);
      }

      setIsDialogOpen(false);
      setEditingCliente(null);
      resetForm();
      loadClientes();
    } catch (error) {
      console.error('Error guardando cliente:', error);
      alert('Error al guardar el cliente');
    }
  };

  const handleEdit = (cliente: Cliente) => {
    // Verificar permisos para editar este cliente
    if (currentUser && !canAccessSede(currentUser, cliente.sede)) {
      alert('No tienes permisos para editar clientes de esta sede');
      return;
    }

    setEditingCliente(cliente);
    
    // Primero actualizar las ciudades disponibles para la sede del cliente
    const cities = getCitiesBySede(cliente.sede);
    setAvailableCities(cities);
    
    setFormData({
      rif: cliente.rif || '',
      nombre: cliente.nombre,
      direccion: cliente.direccion,
      telefono: cliente.telefono || '',
      email: cliente.email || '',
      contacto: cliente.contacto || '',
      region: cliente.region,
      sede: cliente.sede,
      estadoGeografico: cliente.estadoGeografico || '',
      ciudad: cliente.ciudad,
      position: cliente.position,
      tipo: cliente.tipo,
      observaciones: cliente.observaciones || '',
      tipoVisitaPredeterminado: cliente.tipoVisitaPredeterminado
    });
    setSelectedPosition(cliente.position);
    setIsDialogOpen(true);
  };

  // Función para abrir modal de foto de señalización
  const handleViewSignagePhoto = (cliente: ClienteConSeñalizacion) => {
    const clienteExtendido = cliente as any;
    if (clienteExtendido.signagePhoto && clienteExtendido.signagePhoto !== 'No capturada' && clienteExtendido.signagePhoto.startsWith('http')) {
      setSelectedPhotoUrl(clienteExtendido.signagePhoto);
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
        await deleteDoc(doc(db, 'clientes', clienteId));
        loadClientes();
      } catch (error) {
        console.error('Error eliminando cliente:', error);
        alert('Error al eliminar el cliente');
      }
    }
  };

  const resetForm = () => {
    const defaultRegion: Region = 'Centro-capital';
    const defaultSede: Sede = 'GRUPO DISBATTERY';
    
    setFormData({
      rif: '',
      nombre: '',
      direccion: '',
      telefono: '',
      email: '',
      contacto: '',
      region: defaultRegion,
      sede: defaultSede,
      estadoGeografico: '',
      ciudad: '',
      position: { lat: 0, lng: 0 },
      tipo: 'tienda',
      observaciones: '',
      tipoVisitaPredeterminado: undefined
    });
    
    // Actualizar las ciudades disponibles para la configuración por defecto
    const cities = getCitiesBySede(defaultSede);
    setAvailableCities(cities);
    
    setSelectedPosition(null);
  };

  // ========== FUNCIONES PARA CARGA MASIVA ==========

  // Función para parsear CSV mejorada - maneja comillas y saltos de línea
  const parseCSV = (csvText: string): CSVRow[] => {
    // Función helper para parsear CSV con comillas y comas dentro de campos
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"' && !inQuotes) {
          inQuotes = true;
        } else if (char === '"' && inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else if (char === '"' && inQuotes) {
          inQuotes = false;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    // Reconstruir el CSV limpiando saltos de línea problemáticos
    let cleanedCSV = csvText;
    
    // Limpiar el header problemático
    cleanedCSV = cleanedCSV.replace('"nombreVendedor\n"', 'nombreVendedor');
    
    // Unir líneas que fueron cortadas incorrectamente
    const lines = cleanedCSV.split('\n');
    const cleanedLines: string[] = [];
    let currentLine = '';
    let inQuotedField = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      currentLine += (currentLine ? ' ' : '') + line;
      
      // Contar comillas para determinar si estamos dentro de un campo quoted
      const quoteCount = (currentLine.match(/"/g) || []).length;
      inQuotedField = quoteCount % 2 !== 0;
      
      // Si no estamos en un campo quoted y la línea tiene el número esperado de comas
      if (!inQuotedField) {
        // Verificar que tenga al menos 8 comas (9 campos)
        const commaCount = (currentLine.match(/,/g) || []).length;
        if (commaCount >= 8) {
          cleanedLines.push(currentLine);
          currentLine = '';
        }
      }
    }
    
    // Agregar la última línea si quedó algo
    if (currentLine.trim()) {
      cleanedLines.push(currentLine);
    }

    if (cleanedLines.length < 2) return [];

    // Parsear headers
    const headers = parseCSVLine(cleanedLines[0]).map(h => h.replace(/"/g, '').trim());
    const rows: CSVRow[] = [];

    // Parsear datos
    for (let i = 1; i < cleanedLines.length; i++) {
      const values = parseCSVLine(cleanedLines[i]).map(v => v.replace(/"/g, '').trim());
      const row: CSVRow = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      rows.push(row);
    }

    return rows;
  };

  // Función para generar mapeos automáticos de columnas
  const generateAutoMapping = (csvHeaders: string[]): ColumnMapping[] => {
    const mappings: ColumnMapping[] = [];
    
    // Mapeos automáticos basados en nombres comunes - MÁS ESPECÍFICOS
    const autoMappings: { [key: string]: keyof CreateClienteData } = {
      // RIF - variaciones comunes
      'rif': 'rif',
      'nif': 'rif',
      'rnc': 'rif',
      'documento': 'rif',
      'cedula': 'rif',
      'cedulajuridica': 'rif',
      
      // NOMBRE - variaciones comunes
      'nombre': 'nombre',
      'nombrecliente': 'nombre',
      'cliente': 'nombre',
      'razon_social': 'nombre',
      'razonsocial': 'nombre',
      'company': 'nombre',
      'empresa': 'nombre',
      
      // DIRECCION - variaciones comunes
      'direccion': 'direccion',
      'dirección': 'direccion',
      'address': 'direccion',
      'ubicacion': 'direccion',
      'ubicación': 'direccion',
      'domicilio': 'direccion',
      
      // ESTADO GEOGRAFICO - NUEVO CAMPO
      'estado': 'estadoGeografico',
      'state': 'estadoGeografico',
      'provincia': 'estadoGeografico',
      
      // TELEFONO
      'telefono': 'telefono',
      'teléfono': 'telefono',
      'phone': 'telefono',
      'celular': 'telefono',
      'movil': 'telefono',
      
      // EMAIL
      'email': 'email',
      'correo': 'email',
      'mail': 'email',
      'correoelectronico': 'email',
      
      // CONTACTO
      'contacto': 'contacto',
      'persona_contacto': 'contacto',
      'personacontacto': 'contacto',
      'representante': 'contacto',
      
      // REGION
      'region': 'region',
      'región': 'region',
      'zone': 'region',
      'zona': 'region',
      
      // SEDE
      'sede': 'sede',
      'sucursal': 'sede',
      'branch': 'sede',
      'oficina': 'sede',
      
      // CIUDAD
      'ciudad': 'ciudad',
      'city': 'ciudad',
      'municipio': 'ciudad',
      
      // TIPO
      'tipo': 'tipo',
      'type': 'tipo',
      'categoria': 'tipo',
      'category': 'tipo',
      
      // OBSERVACIONES
      'observaciones': 'observaciones',
      'notas': 'observaciones',
      'comments': 'observaciones',
      'comentarios': 'observaciones',
      'descripcion': 'observaciones',
      'detalles': 'observaciones'
    };

    csvHeaders.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      let matchedField = autoMappings[normalizedHeader];
      
      // LÓGICA ESPECIAL PARA TUS COLUMNAS ESPECÍFICAS DE DISBATTERY
      // Mapeo exacto para los headers del CSV de Disbattery
      const originalExact = header.trim();
      
      if (!matchedField) {
        // Mapeo específico para el CSV exacto de Disbattery
        switch (originalExact) {
          case 'CodigoCliente':
            matchedField = 'rif'; // CodigoCliente -> RIF
            break;
          case 'nombreCliente':
            matchedField = 'nombre'; // nombreCliente -> nombre
            break;
          case 'rif':
            matchedField = 'rif'; // rif -> rif (ya existe pero por si acaso)
            break;
          case 'Direccion':
            matchedField = 'direccion'; // Direccion -> direccion
            break;
          case 'Estado':
            matchedField = 'estadoGeografico'; // Estado -> estadoGeografico
            break;
          case 'Nombresucursal':
            matchedField = 'sede'; // Nombresucursal -> sede
            break;
          case 'nombreVendedor':
            matchedField = 'contacto'; // nombreVendedor -> contacto
            break;
          case 'codigo_sucursal':
          case 'CodigoVendedor':
            matchedField = 'skip' as any; // Estos campos no los necesitamos
            break;
          default:
            // Lógica adicional para variaciones
            const originalLower = originalExact.toLowerCase();
            if (originalLower.includes('codigo') && originalLower.includes('cliente')) {
              matchedField = 'rif';
            } else if (originalLower.includes('nombre') && originalLower.includes('cliente')) {
              matchedField = 'nombre';
            } else if (originalLower === 'direccion' || originalLower === 'dirección') {
              matchedField = 'direccion';
            } else if (originalLower === 'estado') {
              matchedField = 'estadoGeografico';
            } else if (originalLower.includes('sucursal') && originalLower.includes('nombre')) {
              matchedField = 'sede';
            } else if (originalLower.includes('vendedor') && originalLower.includes('nombre')) {
              matchedField = 'contacto';
            }
            break;
        }
      }
      
      mappings.push({
        csvColumn: header,
        clienteField: matchedField || 'skip',
        required: matchedField === 'nombre' || matchedField === 'direccion'
      });
    });

    return mappings;
  };

  // Función para validar y procesar datos CSV
  const processCSVData = (csvData: CSVRow[], mappings: ColumnMapping[]): CreateClienteData[] => {
    const processedData: CreateClienteData[] = [];

    csvData.forEach(row => {
      const clienteData: Partial<CreateClienteData> = {};

      // PRIMER PASO: Procesar campos básicos (incluyendo estadoGeografico)
      mappings.forEach(mapping => {
        if (mapping.clienteField === 'skip') return;

        const value = row[mapping.csvColumn]?.trim();
        if (!value && mapping.required) return; // Skip row if required field is empty

        // Procesar campos directos primero (especialmente estadoGeografico)
        const camposDirectos: string[] = ['rif', 'nombre', 'direccion', 'telefono', 'email', 'contacto', 'observaciones', 'estadoGeografico'];
        const fieldName: string = mapping.clienteField;
        if (fieldName !== 'skip' && camposDirectos.includes(fieldName)) {
          (clienteData as any)[fieldName] = value;
        }
      });

      // SEGUNDO PASO: Procesar campos que dependen de otros (region, sede, ciudad, tipo)
      mappings.forEach(mapping => {
        if (mapping.clienteField === 'skip') return;

        const value = row[mapping.csvColumn]?.trim();
        if (!value && mapping.required) return; // Skip row if required field is empty

        // Solo procesar campos complejos que requieren transformación
        const camposDirectosSegundoPaso: string[] = ['rif', 'nombre', 'direccion', 'telefono', 'email', 'contacto', 'observaciones', 'estadoGeografico'];
        const fieldNameSegundo: string = mapping.clienteField;
        if (fieldNameSegundo !== 'skip' && camposDirectosSegundoPaso.includes(fieldNameSegundo)) {
          return; // Ya procesado en el primer paso
        }

        switch (mapping.clienteField) {
          case 'region':
            // La región se determina automáticamente por la sede, no por el estado directamente
            // Esta lógica se ejecutará DESPUÉS de que se haya determinado la sede
            if (clienteData.sede) {
              const regionPorSede: { [sede: string]: Region } = {
                'GRUPO DISBATTERY': 'Centro-capital',
                'DISBATTERY': 'Centro-Los llanos', 
                'BLITZ 2000': 'Centro-Los llanos',  // CORREGIDO: Blitz es Centro-Los llanos
                'GRUPO VICTORIA': 'Oriente'
              };
              clienteData.region = regionPorSede[clienteData.sede] || 'Centro-capital';
              console.log(`🌍 Región asignada por sede "${clienteData.sede}": ${clienteData.region}`);
            } else {
              // Fallback si no hay sede determinada aún
              clienteData.region = 'Centro-capital';
            }
            break;

          case 'sede':
            // Mapear sedes basándose ÚNICAMENTE en el estado geográfico
            if (clienteData.estadoGeografico) {
              const sedesPorEstado: { [estado: string]: Sede } = {
                // GRUPO DISBATTERY - Estados centrales (Caracas y área metropolitana)
                'distrito capital': 'GRUPO DISBATTERY',
                'miranda': 'GRUPO DISBATTERY',
                'vargas': 'GRUPO DISBATTERY',
                
                // DISBATTERY - Estados de cobertura central/regional 
                'aragua': 'DISBATTERY',
                'carabobo': 'DISBATTERY',
                'anzoategui': 'DISBATTERY',
                'anzoátegui': 'DISBATTERY',
                'bolivar': 'DISBATTERY',
                'bolívar': 'DISBATTERY',
                'monagas': 'DISBATTERY',
                'sucre': 'DISBATTERY',
                'nueva esparta': 'DISBATTERY',
                
                // BLITZ 2000 - Estados centro-occidentales (incluyendo Lara)
                'lara': 'BLITZ 2000',
                'yaracuy': 'BLITZ 2000',
                'falcon': 'BLITZ 2000',
                'falcón': 'BLITZ 2000',
                'zulia': 'BLITZ 2000',
                'tachira': 'BLITZ 2000',
                'táchira': 'BLITZ 2000',
                'merida': 'BLITZ 2000',
                'mérida': 'BLITZ 2000',
                'trujillo': 'BLITZ 2000',
                
                // GRUPO VICTORIA - Estados llaneros/orientales
                'guárico': 'GRUPO VICTORIA',
                'cojedes': 'GRUPO VICTORIA',
                'portuguesa': 'GRUPO VICTORIA',
                'barinas': 'GRUPO VICTORIA',
                'apure': 'GRUPO VICTORIA',
                'amazonas': 'GRUPO VICTORIA',
                'delta amacuro': 'GRUPO VICTORIA'
              };
              
              const estadoLower = clienteData.estadoGeografico.toLowerCase();
              const sedeBasadaEnEstado = sedesPorEstado[estadoLower];
              
              console.log(`🏢 Mapeo de sede para estado "${clienteData.estadoGeografico}":`, {
                estadoOriginal: clienteData.estadoGeografico,
                estadoNormalizado: estadoLower,
                sedeEncontrada: sedeBasadaEnEstado,
                nombreSucursalOriginal: value
              });
              
              if (sedeBasadaEnEstado) {
                clienteData.sede = sedeBasadaEnEstado;
                console.log(`✅ Sede asignada por estado: ${sedeBasadaEnEstado}`);
                break;
              }
            }
            
            // Si no hay estado o no se encuentra, usar mapeo de nombres como fallback
            const sedeMap: { [key: string]: Sede } = {
              // Mapeos generales
              'disbattery': 'DISBATTERY',
              'grupo disbattery': 'GRUPO DISBATTERY',
              'blitz': 'BLITZ 2000',
              'blitz 2000': 'BLITZ 2000',
              'victoria': 'GRUPO VICTORIA',
              'grupo victoria': 'GRUPO VICTORIA',
              // Mapeos específicos del CSV de Disbattery
              'disbattery aragua s.a.': 'DISBATTERY',
              'disbattery aragua, s.a.': 'DISBATTERY',
              'disbattery oriente s.a.': 'DISBATTERY',
              'disbattery principal': 'GRUPO DISBATTERY',
              'oceano pacifico pto. la cruz': 'DISBATTERY',
              'principal': 'GRUPO DISBATTERY'
            };
            const normalizedSede = value.toLowerCase().trim();
            const sedeEncontrada = sedeMap[normalizedSede] || 'GRUPO DISBATTERY';
            clienteData.sede = sedeEncontrada;
            
            console.log(`🔄 Sede asignada por nombre (fallback):`, {
              nombreOriginal: value,
              nombreNormalizado: normalizedSede,
              sedeAsignada: sedeEncontrada,
              estado: clienteData.estadoGeografico || 'Sin estado'
            });
            break;

          case 'tipo':
            // Mapear tipos de cliente
            const tipoMap: { [key: string]: 'tienda' | 'distribuidor' | 'cliente_especial' } = {
              'tienda': 'tienda',
              'store': 'tienda',
              'shop': 'tienda',
              'distribuidor': 'distribuidor',
              'distributor': 'distribuidor',
              'especial': 'cliente_especial',
              'special': 'cliente_especial',
              'cliente_especial': 'cliente_especial'
            };
            clienteData.tipo = tipoMap[value.toLowerCase()] || 'tienda';
            break;

          case 'ciudad':
            // Si no hay ciudad específica, usar el estado como ciudad base
            if (value) {
              clienteData.ciudad = value;
            } else if (clienteData.estadoGeografico) {
              // Mapear estado a ciudad principal
              const ciudadPorEstado: { [key: string]: string } = {
                'aragua': 'Maracay',
                'carabobo': 'Valencia',
                'anzoategui': 'Puerto La Cruz',
                'anzoátegui': 'Puerto La Cruz',
                'bolivar': 'Ciudad Bolívar',
                'bolívar': 'Ciudad Bolívar',
                'monagas': 'Maturín',
                'lara': 'Barquisimeto',
                'zulia': 'Maracaibo',
                'tachira': 'San Cristóbal',
                'táchira': 'San Cristóbal',
                'merida': 'Mérida',
                'mérida': 'Mérida',
                'distrito capital': 'Caracas',
                'miranda': 'Los Teques',
                'vargas': 'La Guaira'
              };
              clienteData.ciudad = ciudadPorEstado[clienteData.estadoGeografico.toLowerCase()] || clienteData.estadoGeografico;
            } else {
              clienteData.ciudad = '';
            }
            break;

          default:
            (clienteData as any)[mapping.clienteField] = value;
            break;
        }
      });

      // Solo agregar si tiene los campos mínimos requeridos
      if (clienteData.nombre && clienteData.direccion) {
        // PASO FINAL: Asegurar que la región esté asignada basándose en la sede
        const sede = clienteData.sede || 'GRUPO DISBATTERY';
        let region = clienteData.region;
        
        if (!region) {
          const regionPorSede: { [sede: string]: Region } = {
            'GRUPO DISBATTERY': 'Centro-capital',
            'DISBATTERY': 'Centro-Los llanos', 
            'BLITZ 2000': 'Centro-Los llanos',  // BLITZ 2000 = Centro-Los llanos
            'GRUPO VICTORIA': 'Oriente'
          };
          region = regionPorSede[sede] || 'Centro-capital';
          console.log(`🎯 Región final asignada automáticamente por sede "${sede}": ${region}`);
        }

        processedData.push({
          rif: clienteData.rif || '',
          nombre: clienteData.nombre,
          direccion: clienteData.direccion,
          telefono: clienteData.telefono || '',
          email: clienteData.email || '',
          contacto: clienteData.contacto || '',
          region: region,
          sede: sede,
          estadoGeografico: clienteData.estadoGeografico || '',
          ciudad: clienteData.ciudad || '',
          position: { lat: 0, lng: 0 }, // GPS se capturará en campo
          tipo: clienteData.tipo || 'tienda',
          observaciones: clienteData.observaciones || ''
        });
      }
    });

    return processedData;
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
            await addDoc(collection(db, 'clientes'), firestoreData);
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
    setEditingCliente(null);
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
      const clienteRef = doc(db, 'clientes', selectedClienteForVisitType.id);
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

  // Filtrar clientes basado en permisos y filtros actuales (Ciudad y RIF/Nombre)
  const filteredClientes = clientes.filter(cliente => {
    // Permisos por sede
    if (currentUser && !canAccessSede(currentUser, cliente.sede)) {
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
    return filteredClientes
      .filter(cliente => cliente.position?.lat && cliente.position?.lng)
      .map(cliente => ({
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

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Bar */}
      <header className="flex flex-col sm:flex-row h-16 flex-shrink-0">
        <div style={{ backgroundColor: '#b61817' }} className="w-full sm:w-1/3 flex items-center py-3 px-6 sm:px-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.back()}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-red-700/50 p-2 rounded-md"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center text-white p-2 rounded-md">
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

      {/* Main Content - Scrollable */}
      <main style={{ backgroundColor: '#a51717' }} className="flex-grow overflow-y-auto">
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
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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

                  {/* Tabla - Contenedor con scroll más grande */}
                  <div className="border rounded-lg max-h-[600px] overflow-y-auto">
                    <Table>
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
                              <TableCell>{cliente.direccion}</TableCell>
                              <TableCell>{cliente.ciudad}</TableCell>
                              <TableCell>{cliente.region}</TableCell>
                              <TableCell>{cliente.sede}</TableCell>
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
                                {cliente.tieneSeñalizacion && (cliente as any).signagePhoto && (cliente as any).signagePhoto !== 'No capturada' && (cliente as any).signagePhoto.startsWith('http') ? (
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
                                    onClick={() => handleEdit(cliente)}
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
                </TabsContent>

                <TabsContent value="mapa" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Vista de Mapa</CardTitle>
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
                              <div className="w-4 h-4 rounded" style={{background: 'linear-gradient(90deg, #00ffff 0%, #0000ff 50%, #ff0000 100%)'}}></div>
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
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
            </DialogTitle>
            <DialogDescription>
              {editingCliente ? 'Modifica la información del cliente' : 'Agrega un nuevo punto de venta o cliente'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  key={`region-${editingCliente?.id || 'new'}-${formData.region}`}
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
                  key={`sede-${editingCliente?.id || 'new'}-${formData.region}-${formData.sede}`}
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
                  key={`ciudad-${editingCliente?.id || 'new'}-${formData.sede}-${availableCities.length}`}
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
                initialPosition={editingCliente?.position}
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
                {editingCliente ? 'Actualizar' : 'Crear'} Cliente
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
                    • <strong>DISBATTERY</strong> (Centro-Los llanos): Aragua, Carabobo, Anzoátegui, Bolívar, Monagas, Sucre, Nueva Esparta
                    <br />
                    • <strong>BLITZ 2000</strong> (Centro-Los llanos): Lara, Yaracuy, Falcón, Zulia, Táchira, Mérida, Trujillo
                    <br />
                    • <strong>GRUPO VICTORIA</strong> (Oriente): Guárico, Cojedes, Portuguesa, Barinas, Apure, Amazonas, Delta Amacuro
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
                    <div className="max-h-96 overflow-y-auto border rounded-lg">
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
        <DialogContent className="max-w-2xl">
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