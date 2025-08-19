// Tipos de datos para las rutas que serán usados en toda la aplicación

export interface RoutePoint {
    id: string;
    name: string;
    address: string;
    position: { lat: number; lng: number };
    type: 'cliente' | 'distribuidor' | 'oficina';
    estimatedTime: number; // minutos
    status: 'pendiente' | 'visitado' | 'omitido';
    tipoVisita?: 'Merchandising' | 'Trade (Eventos)' | 'Trade (Impulso)'; // Tipo de visita asignado en la ruta
    marcaTrabajada?: 'Shell' | 'Qualid'; // Marca trabajada para este punto específico
    // Campos adicionales del cliente
    rif?: string;
    nombreCliente?: string;
    telefono?: string;
    email?: string;
    contacto?: string;
    region?: string;
    sede?: string;
    ciudad?: string;
    tipo?: string;
    
    // Campos adicionales para manejo interno
    _routeId?: string;
    _routeName?: string;
    _isEvent?: boolean;
    _eventId?: string;
}
  
// Interfaz para eventos independientes (Trade-Eventos)
export interface EventoIndependiente {
  id: string;
  nombreEvento: string;
  mercaderistas: string[]; // Cambiado a array para múltiples mercaderistas
  mercaderistasIds: string[]; // Cambiado a array para múltiples IDs
  fechaInicio: string;
  fechaFin: string;
  duracionDias: number;
  ubicacion?: { lat: number; lng: number };
  direccion?: string;
  descripcion?: string;
  tipoEvento: 'Trade (Eventos)';
  status: 'planificado' | 'en_progreso' | 'completado';
      marcaTrabajada?: 'Shell' | 'Qualid'; // Marca trabajada
  createdAt?: Date;
  createdBy?: string;
}

export interface Route {
  id: string;
  mercaderista: string;
  mercaderistoId: string;
  date: string;
  points: RoutePoint[];
  status: 'planificada' | 'en_progreso' | 'completada';
  totalDistance: number; // km
  totalTime: number; // minutos
      marcaTrabajada?: 'Shell' | 'Qualid'; // Marca trabajada
  createdAt?: Date;
  updatedAt?: Date;
  planificadaAt?: Date;
  en_progresoAt?: Date;
  completadaAt?: Date;
  createdBy?: string;
}

// Tipos para regiones y sedes
export type Region = 'Centro-capital' | 'Centro-Los llanos' | 'Occidente' | 'Oriente';

export type Sede = 'GRUPO DISBATTERY' | 'BLITZ 2000' | 'GRUPO VICTORIA' | 'DISBATTERY';

export interface SedeInfo {
  name: Sede;
  region: Region;
  cities: string[];
}

export const SEDES_DATA: SedeInfo[] = [
  {
    name: 'GRUPO DISBATTERY',
    region: 'Centro-capital',
    cities: [
      'Falcon',
      'Aragua', 
      'Lara',
      'Caracas'
    ]
  },
  {
    name: 'BLITZ 2000',
    region: 'Centro-Los llanos',
    cities: [
      'Valencia',
      'Calabozo'
    ]
  },
  {
    name: 'GRUPO VICTORIA',
    region: 'Occidente',
    cities: [
      'San Cristobal',
      'Maracaibo',
      'Valera',
      'VG - SBZ',
      'Barinas',
      'Merida'
    ]
  },
  {
    name: 'DISBATTERY',
    region: 'Oriente',
    cities: [
      'El tigre',
      'Puerto la cruz',
      'Maturin',
      'Puerto Ordaz',
      'Margarita'
    ]
  }
];

// Función helper para obtener sedes por región
export const getSedesByRegion = (region: Region): SedeInfo[] => {
  return SEDES_DATA.filter(sede => sede.region === region);
};

// Función helper para obtener ciudades por sede
export const getCitiesBySede = (sedeName: Sede): string[] => {
  const sede = SEDES_DATA.find(s => s.name === sedeName);
  return sede ? sede.cities : [];
};

// Tipos para puntos/clientes
export interface Cliente {
  id: string;
  rif: string;
  nombre: string;
  direccion: string;
  telefono?: string;
  email?: string;
  contacto?: string;
  region: Region;
  sede: Sede;
  estadoGeografico?: string;
  ciudad: string;
  position: { lat: number; lng: number };
  tipo: 'tienda' | 'distribuidor' | 'cliente_especial';
  estado: 'activo' | 'inactivo' | 'pendiente';
  observaciones?: string;
  tipoVisitaPredeterminado?: 'Merchandising' | 'Trade (Eventos)' | 'Trade (Impulso)';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastVisitDate?: Date | null;
  tieneSeñalizacion?: boolean | null;
  ultimaVisitaMerchandising?: Date | null;
  ultimaVisitaTradeImpulso?: Date | null;
  fechaUltimaVisita?: Date | null;
  signage?: 'con' | 'sin' | string;
  signagePhotoUrl?: string;
}

// Tipo para crear un nuevo cliente
export interface CreateClienteData {
  rif: string;
  nombre: string;
  direccion: string;
  telefono?: string;
  email?: string;
  contacto?: string;
  region: Region;
  sede: Sede;
  estadoGeografico?: string;
  ciudad: string;
  position: { lat: number; lng: number };
  tipo: 'tienda' | 'distribuidor' | 'cliente_especial';
  observaciones?: string;
  tipoVisitaPredeterminado?: 'Merchandising' | 'Trade (Eventos)' | 'Trade (Impulso)';
}

// Tipo para actualizar un cliente
export interface UpdateClienteData {
  rif?: string;
  nombre?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  contacto?: string;
  region?: Region;
  sede?: Sede;
  estadoGeografico?: string;
  ciudad?: string;
  position?: { lat: number; lng: number };
  tipo?: 'tienda' | 'distribuidor' | 'cliente_especial';
  estado?: 'activo' | 'inactivo' | 'pendiente';
  observaciones?: string;
} 