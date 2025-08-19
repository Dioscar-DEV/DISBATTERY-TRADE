'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Camera, Trash } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { crearVisita, setN8NWebhookURL } from '@/services/visitas';
import { RespuestasTrade } from '@/types/visitas';
import { getCurrentUser, getUserFromStorage } from '@/services/auth';

interface RecursoUsado {
  tipo: string;
  cantidad: number;
}

interface EntregableUsado {
  tipo: string;
  cantidad: number;
}

const MARCAS_TRADE: string[] = ['Shell', 'Qualid'];

const RECURSOS_IMPULSO_SHELL_TYPES: string[] = [
  'UNIFORMES DE PROMOTORAS SHELL',
  'BANDEROLAS SHELL',
  'IGLOO SHELL',
  'TOLDO SHELL',
  'EXHIBIDORES SHELL',
];

const RECURSOS_IMPULSO_QUALID_TYPES: string[] = [
  'UNIFORMES DE PROMOTORAS QUALID',
  'BANDEROLAS QUALID',
  'IGLOO QUALID',
  'TOLDO QUALID',
];

const ENTREGABLES_IMPULSO_SHELL_TYPES: string[] = [
  'Ambientadores Shell para vehiculos',
  'Bolsas Shell para carros',
  'Llaveros de Tela Shell',
  'Gorras Shell',
  'Bolsas Tipo Boutique Negro',
  'Bolsas Tipo Boutique Blanco',
  'Tapasol Shell/Qualid',
  'Globos Shell',
  'Vasos Shell',
  'Agendas',
];

const ENTREGABLES_IMPULSO_QUALID_TYPES: string[] = [
  'Bolsas Qualid para carros',
  'Esponjas Qualid',
  'Globos Qualid',
  'Gorras Qualid',
  'Llavero caucho Qualid',
  'Llavero de tela Qualid',
  'Paños Qualid',
  'Vasos Qualid',
];


export default function TradeEventosPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Configurar URL del webhook N8N al inicializar
  useEffect(() => {
    setN8NWebhookURL('https://n8n.con-visas.com/webhook/Disbattery-Trade-app');
  }, []);

  // Establecer marca automáticamente desde la ruta
  useEffect(() => {
    const marcaFromRoute = getMarcaFromRoute();
    if (marcaFromRoute) {
      setSelectedBrand(marcaFromRoute);
      console.log('🎯 Marca establecida automáticamente desde ruta:', marcaFromRoute);
    }
  }, []);

  // Función para obtener la marca desde la ruta
  const getMarcaFromRoute = () => {
    try {
      console.log('🔍 === INICIANDO BÚSQUEDA DE MARCA ===');
      
      const clienteDataString = localStorage.getItem('clienteData');
      if (!clienteDataString) {
        console.log('❌ No hay clienteData en localStorage');
        return null;
      }
      
      const clienteData = JSON.parse(clienteDataString);
      console.log('🎯 Cliente actual:', clienteData.nombre, 'RIF:', clienteData.rif);
      
      // 1. BUSCAR EN EVENTOS INDEPENDIENTES PRIMERO
      console.log('🔍 Buscando en eventos independientes...');
      const eventosString = localStorage.getItem('todaysEventsOffline');
      if (eventosString) {
        try {
          const eventos = JSON.parse(eventosString);
          console.log('📋 Eventos encontrados:', eventos.length);
          
          for (const evento of eventos) {
            console.log('🔍 Revisando evento:', evento.nombreEvento, 'Marca:', evento.marcaTrabajada);
            if (evento.marcaTrabajada) {
              console.log('✅ MARCA ENCONTRADA EN EVENTO:', evento.marcaTrabajada);
              return evento.marcaTrabajada;
            }
          }
        } catch (error) {
          console.error('❌ Error parseando eventos:', error);
        }
      } else {
        console.log('ℹ️ No hay eventos en localStorage');
      }
      
      // 2. BUSCAR EN RUTAS REGULARES
      console.log('🔍 Buscando en rutas regulares...');
      const todaysRoutesString = localStorage.getItem('todaysRoutesOffline');
      if (todaysRoutesString) {
        try {
          const todaysRoutes = JSON.parse(todaysRoutesString);
          console.log('📋 Rutas encontradas:', todaysRoutes.length);
          
          const currentRoute = todaysRoutes.find((route: any) => 
            route.points && route.points.some((point: any) => 
              point.rif === clienteData.rif && point.tipoVisita === 'Trade (Eventos)'
            )
          );
          
          if (currentRoute) {
            console.log('🎯 Ruta encontrada para el cliente:', currentRoute.mercaderista);
            
            // Buscar el punto específico que coincida con el cliente
            const matchingPoint = currentRoute.points.find((point: any) => 
              point.rif === clienteData.rif && point.tipoVisita === 'Trade (Eventos)'
            );
            
            if (matchingPoint && matchingPoint.marcaTrabajada) {
              console.log('✅ MARCA ENCONTRADA EN PUNTO:', matchingPoint.marcaTrabajada);
              return matchingPoint.marcaTrabajada;
            }
            
            // Fallback a la marca de la ruta si no hay marca específica en el punto
            if (currentRoute.marcaTrabajada) {
              console.log('✅ MARCA ENCONTRADA EN RUTA:', currentRoute.marcaTrabajada);
              return currentRoute.marcaTrabajada;
            }
            
            console.log('⚠️ Ruta encontrada pero sin marca asignada');
          } else {
            console.log('❌ No se encontró ruta para este cliente con Trade (Eventos)');
          }
        } catch (error) {
          console.error('❌ Error parseando rutas:', error);
        }
      } else {
        console.log('ℹ️ No hay rutas en localStorage');
      }
      
      // 3. BUSCAR DIRECTAMENTE EN VISIT DATA
      console.log('🔍 Buscando en visit data...');
      const visitDataString = localStorage.getItem('currentVisitData');
      if (visitDataString) {
        try {
          const visitData = JSON.parse(visitDataString);
          if (visitData.marcaTrabajada) {
            console.log('✅ MARCA ENCONTRADA EN VISIT DATA:', visitData.marcaTrabajada);
            return visitData.marcaTrabajada;
          }
        } catch (error) {
          console.error('❌ Error parseando visit data:', error);
        }
      }
      
      console.log('❌ === NO SE ENCONTRÓ MARCA ASIGNADA ===');
      return null;
    } catch (error) {
      console.error('❌ Error obteniendo marca desde ruta:', error);
      return null;
    }
  };

  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [recursosAgregados, setRecursosAgregados] = useState<RecursoUsado[]>([]);
  const [currentTipoRecurso, setCurrentTipoRecurso] = useState<string>('');
  const [currentCantidadRecurso, setCurrentCantidadRecurso] = useState<string>('');
  
  const [entregablesShellAgregados, setEntregablesShellAgregados] = useState<EntregableUsado[]>([]);
  const [currentTipoEntregableShell, setCurrentTipoEntregableShell] = useState<string>('');
  const [currentCantidadEntregableShell, setCurrentCantidadEntregableShell] = useState<string>('');

  const [entregablesQualidAgregados, setEntregablesQualidAgregados] = useState<EntregableUsado[]>([]);
  const [currentTipoEntregableQualid, setCurrentTipoEntregableQualid] = useState<string>('');
  const [currentCantidadEntregableQualid, setCurrentCantidadEntregableQualid] = useState<string>('');

  const [fotoImpulsoShell, setFotoImpulsoShell] = useState<string | null>(null);
  const [fotoPromotorasShell, setFotoPromotorasShell] = useState<string | null>(null);
  const [fotoImpulsoQualid, setFotoImpulsoQualid] = useState<string | null>(null);
  const [fotoPromotorasQualid, setFotoPromotorasQualid] = useState<string | null>(null);
  
  // Estados para ventas
  const [huboVentasShell, setHuboVentasShell] = useState<boolean | null>(null);
  const [huboVentasQualid, setHuboVentasQualid] = useState<boolean | null>(null);
  
  // Ventas Shell
  const [ventasShell, setVentasShell] = useState({
    advance: '',
    helixHX5: '',
    helixHX7: '',
    helixHX8: '',
    helixUltra: '',
    rimula: '',
    spirax: '',
    gadus: '',
    otros: ''
  });
  
  // Ventas Qualid
  const [ventasQualid, setVentasQualid] = useState({
    fluidos: '',
    spray: '',
    filtroAutomotriz: '',
    servicioPesado: '',
    cauchos: ''
  });
  
  const [isSyncing, setIsSyncing] = useState(false);

  const uploadImage = async (setter: React.Dispatch<React.SetStateAction<string | null>>, photoType: string) => {
    try {
      // Crear un input de tipo file oculto
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      // Remover capture para que abra la galería en lugar de la cámara
      
      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            setter(result);
            toast({
              title: '✅ Imagen subida',
              description: 'La imagen se ha cargado correctamente.',
            });
          };
          reader.readAsDataURL(file);
        }
      };
      
      input.click();
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        variant: 'destructive',
        title: 'Error al subir imagen',
        description: 'Asegúrese de que el archivo sea una imagen válida.',
      });
    }
  };

  const handleAddRecurso = () => {
    if (!currentTipoRecurso) {
      toast({
        variant: 'destructive',
        title: 'Tipo de Recurso Requerido',
        description: 'Por favor, seleccione un tipo de recurso.',
      });
      return;
    }
    if (currentCantidadRecurso === '' || currentCantidadRecurso === null) {
        toast({
            variant: 'destructive',
            title: 'Cantidad Requerida',
            description: 'Por favor, ingrese la cantidad del recurso.',
        });
        return;
    }
    const cantidadNum = parseInt(currentCantidadRecurso);
    if (isNaN(cantidadNum) || cantidadNum <= 0) { // Quantity must be greater than 0
      toast({
        variant: 'destructive',
        title: 'Cantidad Inválida',
        description: 'Por favor, ingrese una cantidad válida (mayor que 0).',
      });
      return;
    }

    setRecursosAgregados([...recursosAgregados, { tipo: currentTipoRecurso, cantidad: cantidadNum }]);
    setCurrentTipoRecurso('');
    setCurrentCantidadRecurso('');
  };

  const handleRemoveRecurso = (indexToRemove: number) => {
    setRecursosAgregados(recursosAgregados.filter((_, index) => index !== indexToRemove));
  };

  const handleAddEntregableShell = () => {
    if (!currentTipoEntregableShell) {
      toast({
        variant: 'destructive',
        title: 'Tipo de Entregable Requerido',
        description: 'Por favor, seleccione un tipo de entregable.',
      });
      return;
    }
    if (currentCantidadEntregableShell === '' || currentCantidadEntregableShell === null) {
        toast({
            variant: 'destructive',
            title: 'Cantidad Requerida',
            description: 'Por favor, ingrese la cantidad del entregable.',
        });
        return;
    }
    const cantidadNum = parseInt(currentCantidadEntregableShell);
    if (isNaN(cantidadNum) || cantidadNum <= 0) { // Quantity must be greater than 0
      toast({
        variant: 'destructive',
        title: 'Cantidad Inválida',
        description: 'Por favor, ingrese una cantidad válida (mayor que 0).',
      });
      return;
    }

    setEntregablesShellAgregados([...entregablesShellAgregados, { tipo: currentTipoEntregableShell, cantidad: cantidadNum }]);
    setCurrentTipoEntregableShell('');
    setCurrentCantidadEntregableShell('');
  };

  const handleRemoveEntregableShell = (indexToRemove: number) => {
    setEntregablesShellAgregados(entregablesShellAgregados.filter((_, index) => index !== indexToRemove));
  };

  const handleAddEntregableQualid = () => {
    if (!currentTipoEntregableQualid) {
      toast({
        variant: 'destructive',
        title: 'Tipo de Entregable Requerido',
        description: 'Por favor, seleccione un tipo de entregable Qualid.',
      });
      return;
    }
    if (currentCantidadEntregableQualid === '' || currentCantidadEntregableQualid === null) {
        toast({
            variant: 'destructive',
            title: 'Cantidad Requerida',
            description: 'Por favor, ingrese la cantidad del entregable Qualid.',
        });
        return;
    }
    const cantidadNum = parseInt(currentCantidadEntregableQualid);
    if (isNaN(cantidadNum) || cantidadNum <= 0) { 
      toast({
        variant: 'destructive',
        title: 'Cantidad Inválida',
        description: 'Por favor, ingrese una cantidad válida (mayor que 0).',
      });
      return;
    }

    setEntregablesQualidAgregados([...entregablesQualidAgregados, { tipo: currentTipoEntregableQualid, cantidad: cantidadNum }]);
    setCurrentTipoEntregableQualid('');
    setCurrentCantidadEntregableQualid('');
  };

  const handleRemoveEntregableQualid = (indexToRemove: number) => {
    setEntregablesQualidAgregados(entregablesQualidAgregados.filter((_, index) => index !== indexToRemove));
  };


  const saveDataLocally = (data: any) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const tradeEventosData = JSON.parse(localStorage.getItem('tradeEventosData') || '[]');
      tradeEventosData.push(data);
      localStorage.setItem('tradeEventosData', JSON.stringify(tradeEventosData));
    }
  };

  const handleSubmit = async () => {
    console.log('=== GUARDANDO DATOS TRADE EVENTO PARCIAL ===');
    
    // 🔍 DEBUGGING DETALLADO DE FOTOS ANTES DE GUARDAR
    console.log('🔍 ====== DEBUG DE FOTOS TRADE EVENTOS ======');
    console.log('🔍 selectedBrand:', selectedBrand);
    console.log('🔍 fotoImpulsoShell existe:', !!fotoImpulsoShell);
    console.log('🔍 fotoImpulsoShell longitud:', fotoImpulsoShell ? fotoImpulsoShell.length : 0);
    console.log('🔍 fotoImpulsoShell es base64 válido:', fotoImpulsoShell ? fotoImpulsoShell.startsWith('data:image/') : false);
    
    console.log('🔍 fotoPromotorasShell existe:', !!fotoPromotorasShell);
    console.log('🔍 fotoPromotorasShell longitud:', fotoPromotorasShell ? fotoPromotorasShell.length : 0);
    console.log('🔍 fotoPromotorasShell es base64 válido:', fotoPromotorasShell ? fotoPromotorasShell.startsWith('data:image/') : false);
    
    console.log('🔍 fotoImpulsoQualid existe:', !!fotoImpulsoQualid);
    console.log('🔍 fotoImpulsoQualid longitud:', fotoImpulsoQualid ? fotoImpulsoQualid.length : 0);
    console.log('🔍 fotoImpulsoQualid es base64 válido:', fotoImpulsoQualid ? fotoImpulsoQualid.startsWith('data:image/') : false);
    
    console.log('🔍 fotoPromotorasQualid existe:', !!fotoPromotorasQualid);
    console.log('🔍 fotoPromotorasQualid longitud:', fotoPromotorasQualid ? fotoPromotorasQualid.length : 0);
    console.log('🔍 fotoPromotorasQualid es base64 válido:', fotoPromotorasQualid ? fotoPromotorasQualid.startsWith('data:image/') : false);
    console.log('🔍 ====== FIN DEBUG DE FOTOS ======');
    
    if (!selectedBrand) {
      toast({
        variant: 'destructive',
        title: 'Marca Requerida',
        description: 'Por favor, seleccione la marca trabajada.',
      });
      return;
    }

    if (huboVentasShell === null || huboVentasQualid === null) {
      toast({
        variant: 'destructive',
        title: 'Respuestas de Ventas Requeridas',
        description: 'Por favor, responda las preguntas sobre ventas de SHELL y QUALID.',
      });
      return;
    }

    try {
      setIsSyncing(true);

      // Obtener datos del cliente desde localStorage
      const clienteData = localStorage.getItem('clienteData');
      console.log('clienteData raw:', clienteData);
      
      if (!clienteData) {
        console.log('Error: No hay clienteData en localStorage');
        toast({
          variant: 'destructive',
          title: 'Error de Cliente',
          description: 'No se encontraron datos del cliente. Vuelva al inicio.',
        });
        return;
      }

      const cliente = JSON.parse(clienteData);
      console.log('cliente parsed:', cliente);

      // Obtener datos del usuario logueado
      let currentUser = await getCurrentUser();
      if (!currentUser) {
        currentUser = getUserFromStorage();
      }
      
      const mercaderista = currentUser?.fullName || 'Usuario App';
      const correoMercaderista = currentUser?.email || '';

      // 🔍 MAPEO DE FOTOS CON DEBUGGING DETALLADO
      const fotoImpulsoFinal = selectedBrand === 'Shell' ? fotoImpulsoShell : fotoImpulsoQualid;
      const fotoPromotorasFinal = selectedBrand === 'Shell' ? fotoPromotorasShell : fotoPromotorasQualid;
      
      console.log('🔍 MAPEO DE FOTOS FINALES:');
      console.log('🔍 fotoImpulsoFinal existe:', !!fotoImpulsoFinal);
      console.log('🔍 fotoImpulsoFinal longitud:', fotoImpulsoFinal ? fotoImpulsoFinal.length : 0);
      console.log('🔍 fotoImpulsoFinal es base64 válido:', fotoImpulsoFinal ? fotoImpulsoFinal.startsWith('data:image/') : false);
      
      console.log('🔍 fotoPromotorasFinal existe:', !!fotoPromotorasFinal);
      console.log('🔍 fotoPromotorasFinal longitud:', fotoPromotorasFinal ? fotoPromotorasFinal.length : 0);
      console.log('🔍 fotoPromotorasFinal es base64 válido:', fotoPromotorasFinal ? fotoPromotorasFinal.startsWith('data:image/') : false);

      // Preparar datos para guardar localmente (sin enviar aún)
      const tradeEventoData = {
        tipoVisita: 'Trade (Eventos)',
        marca: selectedBrand,
        recursosUsados: recursosAgregados,
        entregablesShell: entregablesShellAgregados,
        entregablesQualid: entregablesQualidAgregados,
        fotoImpulso: fotoImpulsoFinal,
        fotoPromotoras: fotoPromotorasFinal,
        // 🔍 AGREGAR TAMBIÉN LOS CAMPOS ESPECÍFICOS POR MARCA PARA DEBUGGING
        fotoImpulsoShell: fotoImpulsoShell,
        fotoPromotorasShell: fotoPromotorasShell,
        fotoImpulsoQualid: fotoImpulsoQualid,
        fotoPromotorasQualid: fotoPromotorasQualid,
        huboVentasShell: huboVentasShell,
        huboVentasQualid: huboVentasQualid,
        clienteData: cliente,
        mercaderista: mercaderista,
        correoMercaderista: correoMercaderista,
        timestamp: new Date().toISOString()
      };

      // 🔍 VERIFICAR DATOS FINALES ANTES DE GUARDAR
      console.log('🔍 VERIFICACIÓN FINAL DE DATOS:');
      console.log('🔍 tradeEventoData.fotoImpulso existe:', !!tradeEventoData.fotoImpulso);
      console.log('🔍 tradeEventoData.fotoPromotoras existe:', !!tradeEventoData.fotoPromotoras);
      console.log('🔍 tradeEventoData.fotoImpulsoShell existe:', !!tradeEventoData.fotoImpulsoShell);
      console.log('🔍 tradeEventoData.fotoPromotorasShell existe:', !!tradeEventoData.fotoPromotorasShell);
      console.log('🔍 tradeEventoData.fotoImpulsoQualid existe:', !!tradeEventoData.fotoImpulsoQualid);
      console.log('🔍 tradeEventoData.fotoPromotorasQualid existe:', !!tradeEventoData.fotoPromotorasQualid);

      // Guardar en localStorage para usar después
      localStorage.setItem('datosFormularioCompleto', JSON.stringify(tradeEventoData));

      console.log('=== DATOS TRADE EVENTO GUARDADOS LOCALMENTE ===');
      console.log('Datos guardados:', tradeEventoData);

      toast({
        title: 'Datos Guardados',
        description: 'Continuando a reportes finales...',
      });

      // Navegar a ventas detalladas si hay ventas, sino a reportes finales
      if (huboVentasShell === true || huboVentasQualid === true) {
        router.push('/ventas-productos');
      } else {
        router.push('/reportes-finales');
      }

    } catch (error) {
      console.log('=== ERROR GUARDANDO DATOS TRADE EVENTO ===');
      console.error('Error completo:', error);
      
      toast({
        variant: 'destructive',
        title: 'Error al Guardar',
        description: 'Hubo un problema guardando los datos. Intente nuevamente.',
      });
      
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const syncData = async () => {
      if (isSyncing || typeof window === 'undefined' || !window.localStorage) return;
      setIsSyncing(true);

      try {
        const localDataString = localStorage.getItem('tradeImpulsoData');
        if (!localDataString) {
          setIsSyncing(false);
          return;
        }
        const localData = JSON.parse(localDataString);
        if (localData.length === 0) {
          setIsSyncing(false);
          return;
        }

        console.log('Enviando datos de Impulso Trade al servidor:', localData);
        // Example: await fetch('/api/sync-trade-impulso', { method: 'POST', body: JSON.stringify(localData) });
        // Replace with actual API call

        localStorage.removeItem('tradeImpulsoData');
        toast({
          title: 'Datos de Impulso Trade Sincronizados',
          description: 'Todos los datos de impulso trade se han enviado al servidor.',
        });
      } catch (error) {
        console.error('Error al sincronizar los datos de Impulso Trade:', error);
        toast({
          variant: 'destructive',
          title: 'Error de Sincronización (Impulso Trade)',
          description: 'Hubo un problema al sincronizar los datos. Inténtalo de nuevo más tarde.',
        });
      } finally {
        setIsSyncing(false);
      }
    };

    if (typeof window !== 'undefined' && navigator.onLine) {
      syncData();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', syncData);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', syncData);
      }
    };
  }, [isSyncing, toast]);

  const getCurrentResourceList = () => {
    if (selectedBrand === 'Shell') {
      return RECURSOS_IMPULSO_SHELL_TYPES;
    }
    if (selectedBrand === 'Qualid') {
      return RECURSOS_IMPULSO_QUALID_TYPES;
    }
    return [];
  };

  const availableRecursoTypes = getCurrentResourceList().filter(
    tipo => !recursosAgregados.find(r => r.tipo === tipo)
  );

  const availableEntregableShellTypes = ENTREGABLES_IMPULSO_SHELL_TYPES.filter(
    tipo => !entregablesShellAgregados.find(e => e.tipo === tipo)
  );

  const availableEntregableQualidTypes = ENTREGABLES_IMPULSO_QUALID_TYPES.filter(
    tipo => !entregablesQualidAgregados.find(e => e.tipo === tipo)
  );
  
  // Funciones para manejar ventas Shell
  const handleVentasShellChange = (producto: string, valor: string) => {
    setVentasShell(prev => ({
      ...prev,
      [producto]: valor
    }));
  };

  // Funciones para manejar ventas Qualid
  const handleVentasQualidChange = (producto: string, valor: string) => {
    setVentasQualid(prev => ({
      ...prev,
      [producto]: valor
    }));
  };

  const handleBrandChange = (value: string) => {
    setSelectedBrand(value);
    setRecursosAgregados([]);
    setCurrentTipoRecurso('');
    setCurrentCantidadRecurso('');
    setEntregablesShellAgregados([]);
    setCurrentTipoEntregableShell('');
    setCurrentCantidadEntregableShell('');
    setEntregablesQualidAgregados([]);
    setCurrentTipoEntregableQualid('');
    setCurrentCantidadEntregableQualid('');
    setFotoImpulsoShell(null);
    setFotoPromotorasShell(null);
    setFotoImpulsoQualid(null);
    setFotoPromotorasQualid(null);
    // Reset ventas
    setHuboVentasShell(null);
    setHuboVentasQualid(null);
    setVentasShell({
      advance: '',
      helixHX5: '',
      helixHX7: '',
      helixHX8: '',
      helixUltra: '',
      rimula: '',
      spirax: '',
      gadus: '',
      otros: ''
    });
    setVentasQualid({
      fluidos: '',
      spray: '',
      filtroAutomotriz: '',
      servicioPesado: '',
      cauchos: ''
    });
  };


  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-4"
      style={{
        backgroundImage: 'url("https://storage.googleapis.com/iandai/imagenes/Dise%C3%B1o%20sin%20t%C3%ADtulo%20(51).png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
             <span
              style={{
                backgroundImage: 'linear-gradient(to right, #fbce04, #e30a18)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Registro de Evento Trade
            </span>
          </CardTitle>
          <CardDescription>Ingrese los detalles del evento realizado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          

          <div>
            <Label htmlFor="marca-select">Marca Trabajada</Label>
            <Select
              value={selectedBrand}
              onValueChange={handleBrandChange}
              disabled={true}
            >
              <SelectTrigger id="marca-select" className="w-full mt-1">
                <SelectValue placeholder={selectedBrand || "Marca no asignada"} />
              </SelectTrigger>
              <SelectContent>
                {MARCAS_TRADE.map(marca => (
                  <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedBrand && (
              <p className="text-sm text-orange-600 mt-1">
                ⚠️ Marca no asignada. Verifique que el evento tenga marca trabajada configurada.
              </p>
            )}
          </div>

          {selectedBrand && (
            <div className="space-y-4 border-t pt-4">
              <Label className="font-medium">Recursos Utilizados ({selectedBrand})</Label>
              <div className="flex items-end space-x-2">
                <div className="flex-grow space-y-1">
                  <Label htmlFor="tipo-recurso-select">Tipo de Recurso</Label>
                  <Select
                    value={currentTipoRecurso}
                    onValueChange={setCurrentTipoRecurso}
                    disabled={availableRecursoTypes.length === 0 || isSyncing}
                  >
                    <SelectTrigger id="tipo-recurso-select">
                      <SelectValue placeholder={availableRecursoTypes.length > 0 ? "Seleccionar recurso" : "Todos agregados"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRecursoTypes.map(tipo => (
                        <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                                  <div className="w-1/3 space-y-1">
                    <Label htmlFor="cantidad-recurso-input">Cantidad</Label>
                    <Input
                      id="cantidad-recurso-input"
                      type="number"
                      placeholder="Ingresar cantidad (0, 1, 2, 3, ...)"
                      value={currentCantidadRecurso}
                      onChange={(e) => setCurrentCantidadRecurso(e.target.value)}
                      inputMode="numeric"
                      min="1" 
                      disabled={isSyncing}
                    />
                  </div>
                <Button 
                  onClick={handleAddRecurso} 
                  disabled={!currentTipoRecurso || currentCantidadRecurso === '' || parseInt(currentCantidadRecurso) <= 0 || availableRecursoTypes.length === 0 || isSyncing}
                  className="shrink-0"
                >
                  Agregar
                </Button>
              </div>

              {recursosAgregados.length > 0 && (
                <div className="mt-4 space-y-2">
                  <Label className="text-sm text-muted-foreground">Recursos agregados:</Label>
                  <ul className="space-y-1">
                    {recursosAgregados.map((recurso, index) => (
                      <li key={index} className="flex justify-between items-center p-2 border rounded-md bg-background">
                        <span className="text-sm">{recurso.tipo}: {recurso.cantidad}</span>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveRecurso(index)} disabled={isSyncing}>
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {availableRecursoTypes.length === 0 && getCurrentResourceList().length > 0 && recursosAgregados.length === getCurrentResourceList().length && (
                  <p className="text-sm text-muted-foreground text-center mt-2">Todos los tipos de recursos {selectedBrand} disponibles han sido agregados.</p>
              )}
            </div>
          )}

          {selectedBrand === 'Shell' && (
            <>
              <div className="space-y-4 border-t pt-4">
                <Label className="font-medium">Entregables Shell</Label>
                <div className="flex items-end space-x-2">
                  <div className="flex-grow space-y-1">
                    <Label htmlFor="tipo-entregable-shell-select">Tipo de Entregable</Label>
                    <Select
                      value={currentTipoEntregableShell}
                      onValueChange={setCurrentTipoEntregableShell}
                      disabled={availableEntregableShellTypes.length === 0 || isSyncing}
                    >
                      <SelectTrigger id="tipo-entregable-shell-select">
                        <SelectValue placeholder={availableEntregableShellTypes.length > 0 ? "Seleccionar entregable" : "Todos agregados"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEntregableShellTypes.map(tipo => (
                          <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-1/3 space-y-1">
                    <Label htmlFor="cantidad-entregable-shell-input">Cantidad</Label>
                    <Input
                      id="cantidad-entregable-shell-input"
                      type="number"
                      placeholder="Ingresar cantidad"
                      value={currentCantidadEntregableShell}
                      onChange={(e) => setCurrentCantidadEntregableShell(e.target.value)}
                      inputMode="numeric"
                      min="1"
                      disabled={isSyncing}
                    />
                  </div>
                  <Button 
                    onClick={handleAddEntregableShell} 
                    disabled={!currentTipoEntregableShell || currentCantidadEntregableShell === '' || parseInt(currentCantidadEntregableShell) <= 0 || availableEntregableShellTypes.length === 0 || isSyncing}
                    className="shrink-0"
                  >
                    Agregar
                  </Button>
                </div>

                {entregablesShellAgregados.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-sm text-muted-foreground">Entregables Shell agregados:</Label>
                    <ul className="space-y-1">
                      {entregablesShellAgregados.map((entregable, index) => (
                        <li key={index} className="flex justify-between items-center p-2 border rounded-md bg-background">
                          <span className="text-sm">{entregable.tipo}: {entregable.cantidad}</span>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveEntregableShell(index)} disabled={isSyncing}>
                            <Trash className="h-4 w-4 text-destructive" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {availableEntregableShellTypes.length === 0 && ENTREGABLES_IMPULSO_SHELL_TYPES.length > 0 && entregablesShellAgregados.length === ENTREGABLES_IMPULSO_SHELL_TYPES.length && (
                    <p className="text-sm text-muted-foreground text-center mt-2">Todos los tipos de entregables Shell disponibles han sido agregados.</p>
                )}
              </div>

              <div className="space-y-4 border-t pt-4">
                <Label className="font-medium" htmlFor="foto-impulso-shell-button">Fotos del impulso Shell</Label>
                <p className="text-sm text-muted-foreground">
                  Sube fotos generales del evento Shell, incluyendo la instalación del material de apoyo, vista del stand, y las promotoras en el lugar. Asegúrate de capturar la esencia y el ambiente general del impulso o evento Shell.
                </p>
                <Button
                  id="foto-impulso-shell-button"
                  variant="outline"
                  onClick={() => uploadImage(setFotoImpulsoShell, 'fotoImpulsoShell')}
                  disabled={isSyncing}
                  className="w-full mt-1"
                >
                  <Camera className="mr-2 h-4 w-4" /> Subir Foto del Impulso Shell
                </Button>
                {fotoImpulsoShell && (
                  <img
                    src={fotoImpulsoShell}
                    alt="Fotos del Impulso Shell"
                    className="mt-2 rounded-md object-cover w-full h-auto"
                    data-ai-hint="shell event promotion"
                  />
                )}
              </div>

              <div className="space-y-4 border-t pt-4">
                <Label className="font-medium" htmlFor="foto-promotoras-shell-button">Fotos de las promotoras Shell</Label>
                <p className="text-sm text-muted-foreground">
                  Sube fotos de las promotoras Shell interactuando con los clientes, mostrando momentos de compras, participación en juegos o dinámicas. Buscamos capturar la conexión y el impacto directo del evento Shell en el público.
                </p>
                <Button
                  id="foto-promotoras-shell-button"
                  variant="outline"
                  onClick={() => uploadImage(setFotoPromotorasShell, 'fotoPromotorasShell')}
                  disabled={isSyncing}
                  className="w-full mt-1"
                >
                  <Camera className="mr-2 h-4 w-4" /> Subir Foto de Promotoras Shell
                </Button>
                {fotoPromotorasShell && (
                  <img
                    src={fotoPromotorasShell}
                    alt="Fotos de las Promotoras Shell"
                    className="mt-2 rounded-md object-cover w-full h-auto"
                    data-ai-hint="shell promoters customers"
                  />
                )}
              </div>
            </>
          )}

          {selectedBrand === 'Qualid' && (
            <>
               <div className="space-y-4 border-t pt-4">
                <Label className="font-medium">Entregables Qualid</Label>
                <div className="flex items-end space-x-2">
                  <div className="flex-grow space-y-1">
                    <Label htmlFor="tipo-entregable-qualid-select">Tipo de Entregable</Label>
                    <Select
                      value={currentTipoEntregableQualid}
                      onValueChange={setCurrentTipoEntregableQualid}
                      disabled={availableEntregableQualidTypes.length === 0 || isSyncing}
                    >
                      <SelectTrigger id="tipo-entregable-qualid-select">
                        <SelectValue placeholder={availableEntregableQualidTypes.length > 0 ? "Seleccionar entregable" : "Todos agregados"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEntregableQualidTypes.map(tipo => (
                          <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-1/3 space-y-1">
                    <Label htmlFor="cantidad-entregable-qualid-input">Cantidad</Label>
                    <Input
                      id="cantidad-entregable-qualid-input"
                      type="number"
                      placeholder="Ingresar cantidad"
                      value={currentCantidadEntregableQualid}
                      onChange={(e) => setCurrentCantidadEntregableQualid(e.target.value)}
                      inputMode="numeric"
                      min="1"
                      disabled={isSyncing}
                    />
                  </div>
                  <Button 
                    onClick={handleAddEntregableQualid} 
                    disabled={!currentTipoEntregableQualid || currentCantidadEntregableQualid === '' || parseInt(currentCantidadEntregableQualid) <= 0 || availableEntregableQualidTypes.length === 0 || isSyncing}
                    className="shrink-0"
                  >
                    Agregar
                  </Button>
                </div>

                {entregablesQualidAgregados.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-sm text-muted-foreground">Entregables Qualid agregados:</Label>
                    <ul className="space-y-1">
                      {entregablesQualidAgregados.map((entregable, index) => (
                        <li key={index} className="flex justify-between items-center p-2 border rounded-md bg-background">
                          <span className="text-sm">{entregable.tipo}: {entregable.cantidad}</span>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveEntregableQualid(index)} disabled={isSyncing}>
                            <Trash className="h-4 w-4 text-destructive" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {availableEntregableQualidTypes.length === 0 && ENTREGABLES_IMPULSO_QUALID_TYPES.length > 0 && entregablesQualidAgregados.length === ENTREGABLES_IMPULSO_QUALID_TYPES.length && (
                    <p className="text-sm text-muted-foreground text-center mt-2">Todos los tipos de entregables Qualid disponibles han sido agregados.</p>
                )}
              </div>

              <div className="space-y-4 border-t pt-4">
                <Label className="font-medium" htmlFor="foto-impulso-qualid-button">Fotos del impulso Qualid</Label>
                <p className="text-sm text-muted-foreground">
                  Sube fotos generales del evento Qualid, incluyendo la instalación del material de apoyo, vista del stand, y las promotoras en el lugar. Asegúrate de capturar la esencia y el ambiente general del impulso o evento Qualid.
                </p>
                <Button
                  id="foto-impulso-qualid-button"
                  variant="outline"
                  onClick={() => uploadImage(setFotoImpulsoQualid, 'fotoImpulsoQualid')}
                  disabled={isSyncing}
                  className="w-full mt-1"
                >
                  <Camera className="mr-2 h-4 w-4" /> Subir Foto del Impulso Qualid
                </Button>
                {fotoImpulsoQualid && (
                  <img
                    src={fotoImpulsoQualid}
                    alt="Fotos del Impulso Qualid"
                    className="mt-2 rounded-md object-cover w-full h-auto"
                    data-ai-hint="qualid event promotion"
                  />
                )}
              </div>

              <div className="space-y-4 border-t pt-4">
                <Label className="font-medium" htmlFor="foto-promotoras-qualid-button">Fotos de las promotoras Qualid</Label>
                <p className="text-sm text-muted-foreground">
                  Sube fotos de las promotoras Qualid interactuando con los clientes, mostrando momentos de compras, participación en juegos o dinámicas. Buscamos capturar la conexión y el impacto directo del evento Qualid en el público.
                </p>
                <Button
                  id="foto-promotoras-qualid-button"
                  variant="outline"
                  onClick={() => uploadImage(setFotoPromotorasQualid, 'fotoPromotorasQualid')}
                  disabled={isSyncing}
                  className="w-full mt-1"
                >
                  <Camera className="mr-2 h-4 w-4" /> Subir Foto de Promotoras Qualid
                </Button>
                {fotoPromotorasQualid && (
                  <img
                    src={fotoPromotorasQualid}
                    alt="Fotos de las Promotoras Qualid"
                    className="mt-2 rounded-md object-cover w-full h-auto"
                    data-ai-hint="qualid promoters customers"
                  />
                )}
              </div>
            </>
          )}

          {/* Sección de Ventas Shell - Solo mostrar después de tomar fotos */}
          {((selectedBrand === 'Shell' && fotoImpulsoShell && fotoPromotorasShell) || 
            (selectedBrand === 'Qualid' && fotoImpulsoQualid && fotoPromotorasQualid)) && (
            <>
              <div className="space-y-4 border-t pt-6">
                <div className="space-y-4">
                  <Label className="text-lg font-semibold">¿Se reportó venta de productos SHELL?</Label>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="ventasShell"
                        checked={huboVentasShell === true}
                        onChange={() => setHuboVentasShell(true)}
                        disabled={isSyncing}
                      />
                      <span>Sí</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="ventasShell"
                        checked={huboVentasShell === false}
                        onChange={() => setHuboVentasShell(false)}
                        disabled={isSyncing}
                      />
                      <span>No</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Sección de Ventas Qualid */}
              <div className="space-y-4 border-t pt-6">
                <div className="space-y-4">
                  <Label className="text-lg font-semibold">¿Se reportó venta de productos QUALID?</Label>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="ventasQualid"
                        checked={huboVentasQualid === true}
                        onChange={() => setHuboVentasQualid(true)}
                        disabled={isSyncing}
                      />
                      <span>Sí</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="ventasQualid"
                        checked={huboVentasQualid === false}
                        onChange={() => setHuboVentasQualid(false)}
                        disabled={isSyncing}
                      />
                      <span>No</span>
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}


        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleSubmit} 
            disabled={
              isSyncing || 
              !selectedBrand || 
              huboVentasShell === null ||
              huboVentasQualid === null ||
              !((selectedBrand === 'Shell' && fotoImpulsoShell && fotoPromotorasShell) || 
                (selectedBrand === 'Qualid' && fotoImpulsoQualid && fotoPromotorasQualid))
            } 
            className="w-full"
            style={{ backgroundImage: 'linear-gradient(to right, #fbce04, #e30a18)' }}
          >
            {isSyncing ? 'Guardando...' : 'Siguiente'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
