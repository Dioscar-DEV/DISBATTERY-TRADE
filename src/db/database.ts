import Dexie, { Table } from 'dexie';

export interface Cliente {
  id?: number;
  rif: string;
  nombre: string;
  direccion: string;
  position: { lat: number; lng: number };
  sede: string;
}

export interface Ruta {
  id?: number;
  fecha: string;
  puntos: Cliente[];
  estado: 'planificada' | 'en_progreso' | 'completada';
  syncStatus: 'synced' | 'pending' | 'error';
}

export interface VisitaOffline {
  id?: number;
  visitaId: string;
  clienteRif: string;
  data: any;
  fotos: { [key: string]: string };
  timestamp: number;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
}

export class DisbatteryDB extends Dexie {
  clientes!: Table<Cliente>;
  rutas!: Table<Ruta>;
  visitas!: Table<VisitaOffline>;

  constructor() {
    super('DisbatteryTradeDB');
    this.version(1).stores({
      clientes: '++id, rif, nombre, sede',
      rutas: '++id, fecha, estado, syncStatus',
      visitas: '++id, visitaId, clienteRif, syncStatus, timestamp'
    });
  }
}

export const db = new DisbatteryDB();
