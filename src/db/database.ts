import Dexie, { Table } from "dexie";

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
  estado: "pending" | "started" | "completed";
  syncStatus: "synced" | "pending" | "error";
}

export interface VisitaOffline {
  id?: number;
  visitaId: string;
  clienteRif: string;
  data: any;
  fotos: { [key: string]: string };
  timestamp: number;
  syncStatus: "pending" | "syncing" | "synced" | "error";
}

export class DisbatteryDB extends Dexie {
  clientes!: Table<Cliente>;
  rutas!: Table<Ruta>;
  visitas!: Table<VisitaOffline>;

  constructor() {
    super("DisbatteryTradeDB");
    this.version(1).stores({
      clientes: "++id, rif, nombre, sede",
      rutas: "++id, fecha, estado, syncStatus",
      visitas: "++id, visitaId, clienteRif, syncStatus, timestamp",
    });
  }
}

export const db = new DisbatteryDB();

// Fallback helpers para localStorage
function saveToLocalStorage<T>(key: string, value: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("❌ Error guardando en localStorage:", e);
  }
}

function getFromLocalStorage<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("❌ Error leyendo de localStorage:", e);
    return [];
  }
}

// Métodos seguros para guardar clientes, rutas y visitas
export async function safeAddCliente(cliente: Cliente) {
  try {
    await db.clientes.add(cliente);
  } catch (error) {
    console.warn("⚠️ IndexedDB falló, usando localStorage para clientes");
    const clientes = getFromLocalStorage<Cliente>("clientes_fallback");
    clientes.push(cliente);
    saveToLocalStorage("clientes_fallback", clientes);
  }
}

export async function safeAddRuta(ruta: Ruta) {
  try {
    await db.rutas.add(ruta);
  } catch (error) {
    console.warn("⚠️ IndexedDB falló, usando localStorage para rutas");
    const rutas = getFromLocalStorage<Ruta>("rutas_fallback");
    rutas.push(ruta);
    saveToLocalStorage("rutas_fallback", rutas);
  }
}

export async function safeAddVisita(visita: VisitaOffline) {
  try {
    await db.visitas.add(visita);
  } catch (error) {
    console.warn("⚠️ IndexedDB falló, usando localStorage para visitas");
    const visitas = getFromLocalStorage<VisitaOffline>("visitas_fallback");
    visitas.push(visita);
    saveToLocalStorage("visitas_fallback", visitas);
  }
}
