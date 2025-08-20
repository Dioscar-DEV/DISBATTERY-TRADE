'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserCircle, ArrowLeft, TrendingUp, MapPinned, Activity, Menu } from 'lucide-react';
import { collection, onSnapshot, orderBy, limit, query, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/clientApp';
import { getCurrentUserWithPermissions, UserData, UserPermissions, canAccessSede } from '@/services/auth';

type VisitaDoc = {
  id: string;
  rifCliente: string;
  nombreEstablecimiento?: string;
  tipoVisita?: string;
  createdAt?: Timestamp | Date | string;
  direccionCorreo?: string;
  sucursal?: string; // sede
};

type RouteDoc = {
  id: string;
  date?: string | Timestamp | Date;
  status?: 'planificada' | 'en_progreso' | 'completada';
  mercaderistoId?: string;
  sede?: string;
};

export default function DatosVisitasPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [visitas, setVisitas] = useState<VisitaDoc[]>([]);
  const [routes, setRoutes] = useState<RouteDoc[]>([]);
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState('');
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Cargar usuario y permisos
  useEffect(() => {
    const init = async () => {
      const result = await getCurrentUserWithPermissions();
      if (!result) {
        router.push('/');
        return;
      }
      setCurrentUser(result.user);
      setUserPermissions(result.permissions);
      setLoading(false);
    };
    init();
  }, [router]);

  // Suscripción a visitas (en tiempo real). Ordenamos por createdAt desc y limitamos; filtramos por sede y rango en memoria para evitar índices compuestos.
  useEffect(() => {
    if (!userPermissions) return;
    const q = query(collection(db, 'visitas'), orderBy('createdAt', 'desc'), limit(1000));
    const unsubscribe = onSnapshot(q, (snap) => {
      const rows: VisitaDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setVisitas(rows);
    });
    return () => unsubscribe();
  }, [userPermissions]);

  // Suscripción a rutas
  useEffect(() => {
    if (!userPermissions) return;
    const q = query(collection(db, 'routes'), orderBy('date', 'desc'), limit(300));
    const unsubscribe = onSnapshot(q, (snap) => {
      const rows: RouteDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setRoutes(rows);
    });
    return () => unsubscribe();
  }, [userPermissions]);

  // Helpers
  const allowedSedes = useMemo(() => {
    if (!userPermissions) return [] as string[];
    return userPermissions.isAdminMaster ? [] : userPermissions.allowedSedes;
  }, [userPermissions]);

  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [days]);

  const normalizeDate = (v?: any): Date | null => {
    if (!v) return null;
    if (v instanceof Timestamp) return v.toDate();
    if (typeof v === 'string') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    if (v instanceof Date) return v;
    return null;
  };

  const visitasFiltradas = useMemo(() => {
    const sedeFilter = (sede?: string) => {
      if (!userPermissions) return false;
      if (userPermissions.isAdminMaster) return true;
      return !!sede && allowedSedes.includes(sede);
    };

    return visitas
      .filter((v) => sedeFilter(v.sucursal))
      .filter((v) => {
        const d = normalizeDate(v.createdAt);
        return d ? d >= startDate : false;
      })
      .filter((v) =>
        search.trim() === '' ||
        (v.rifCliente || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.nombreEstablecimiento || '').toLowerCase().includes(search.toLowerCase())
      );
  }, [visitas, allowedSedes, userPermissions, startDate, search]);

  const routesFiltradas = useMemo(() => {
    const sedeFilter = (sede?: string) => {
      if (!userPermissions) return false;
      if (userPermissions.isAdminMaster) return true;
      return !!sede && allowedSedes.includes(sede);
    };

    return routes
      .filter((r) => sedeFilter((r as any).sede))
      .filter((r) => {
        const d = normalizeDate(r.date);
        return d ? d >= startDate : false;
      });
  }, [routes, allowedSedes, userPermissions, startDate]);

  // KPIs
  const kpis = useMemo(() => {
    const total = visitasFiltradas.length;
    const porTipo: Record<string, number> = {};
    const porDia: Record<string, number> = {};
    const clientes = new Set<string>();

    visitasFiltradas.forEach((v) => {
      const tv = (v.tipoVisita || '').toString();
      porTipo[tv] = (porTipo[tv] || 0) + 1;
      if (v.rifCliente) clientes.add(v.rifCliente);
      const d = normalizeDate(v.createdAt);
      if (d) {
        const key = d.toISOString().slice(0, 10);
        porDia[key] = (porDia[key] || 0) + 1;
      }
    });

    const merch = (porTipo['Merchandising'] || 0) + (porTipo['merchandising'] || 0);
    const tradeImp =
      (porTipo['Trade (Impulso)'] || 0) +
      (porTipo['trade (impulso)'] || 0) +
      (porTipo['trade-impulso'] || 0);

    // Serie para sparkline (últimos N días)
    const serie: { x: string; y: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      serie.push({ x: key, y: porDia[key] || 0 });
    }

    return {
      total,
      merch,
      tradeImp,
      clientesUnicos: clientes.size,
      serie,
    };
  }, [visitasFiltradas, days, startDate]);

  // Gráfico de línea completo
  const LineChart = ({ data, title }: { data: { x: string; y: number }[]; title: string }) => {
    const w = 600;
    const h = 300;
    const padding = { top: 20, right: 30, bottom: 60, left: 50 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    
    const maxY = Math.max(1, ...data.map(d => d.y));
    const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW;
    
    const points = data.map((d, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + chartH - (d.y / maxY) * chartH;
      return { x, y, value: d.y, date: d.x };
    });
    
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    
    return (
      <div className="bg-white p-4 rounded-lg border overflow-x-auto">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">{title}</h3>
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ minWidth: '500px' }}>
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width={chartW} height={chartH} x={padding.left} y={padding.top} fill="url(#grid)" />
          
          {/* Y-axis labels */}
          {[0, Math.floor(maxY * 0.25), Math.floor(maxY * 0.5), Math.floor(maxY * 0.75), maxY].map((val, i) => (
            <g key={i}>
              <text x={padding.left - 10} y={padding.top + chartH - (val / maxY) * chartH + 5} 
                    textAnchor="end" fontSize="12" fill="#666">
                {val}
              </text>
              <line x1={padding.left} y1={padding.top + chartH - (val / maxY) * chartH} 
                    x2={padding.left + chartW} y2={padding.top + chartH - (val / maxY) * chartH} 
                    stroke="#e0e0e0" strokeWidth="1" />
            </g>
          ))}
          
          {/* Line */}
          <path d={pathData} fill="none" stroke="#b61817" strokeWidth="3" />
          
          {/* Points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#b61817" />
              <title>{`${new Date(p.date).toLocaleDateString()}: ${p.value} visitas`}</title>
            </g>
          ))}
          
          {/* X-axis labels */}
          {points.map((p, i) => {
            if (i % Math.ceil(points.length / 8) === 0) {
              const date = new Date(p.date);
              return (
                <text key={i} x={p.x} y={h - 10} textAnchor="middle" fontSize="11" fill="#666">
                  {date.getDate()}/{date.getMonth() + 1}
                </text>
              );
            }
            return null;
          })}
        </svg>
      </div>
    );
  };

  // Gráfico de barras
  const BarChart = ({ data, title }: { data: { label: string; value: number; color?: string }[]; title: string }) => {
    const w = 400;
    const h = 300;
    const padding = { top: 20, right: 30, bottom: 80, left: 50 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    
    const maxY = Math.max(1, ...data.map(d => d.value));
    const barWidth = chartW / data.length * 0.7;
    const barSpacing = chartW / data.length;
    
    return (
      <div className="bg-white p-4 rounded-lg border overflow-x-auto">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">{title}</h3>
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ minWidth: '350px' }}>
          {/* Y-axis labels */}
          {[0, Math.floor(maxY * 0.5), maxY].map((val, i) => (
            <g key={i}>
              <text x={padding.left - 10} y={padding.top + chartH - (val / maxY) * chartH + 5} 
                    textAnchor="end" fontSize="12" fill="#666">
                {val}
              </text>
              <line x1={padding.left} y1={padding.top + chartH - (val / maxY) * chartH} 
                    x2={padding.left + chartW} y2={padding.top + chartH - (val / maxY) * chartH} 
                    stroke="#e0e0e0" strokeWidth="1" />
            </g>
          ))}
          
          {/* Bars */}
          {data.map((d, i) => {
            const barHeight = (d.value / maxY) * chartH;
            const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
            const y = padding.top + chartH - barHeight;
            
            return (
              <g key={i}>
                <rect x={x} y={y} width={barWidth} height={barHeight} 
                      fill={d.color || '#ffee26'} stroke="#b61817" strokeWidth="1" />
                <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fontSize="12" fill="#333" fontWeight="bold">
                  {d.value}
                </text>
                <text x={x + barWidth / 2} y={h - 10} textAnchor="middle" fontSize="10" fill="#666"
                      transform={`rotate(-45, ${x + barWidth / 2}, ${h - 10})`}>
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  // Sparkline simple para KPIs
  const Sparkline = ({ data, color = '#b61817' }: { data: { x: string; y: number }[]; color?: string }) => {
    const w = 220;
    const h = 56;
    const maxY = Math.max(1, ...data.map((d) => d.y));
    const stepX = data.length > 1 ? w / (data.length - 1) : w;
    const points = data
      .map((d, i) => {
        const x = i * stepX;
        const y = h - (d.y / maxY) * (h - 6) - 3; // padding
        return `${x},${y}`;
      })
      .join(' ');
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
      </svg>
    );
  };

  // Datos para gráfico de línea (últimos 14 días)
  const chartLineData = useMemo(() => {
    const porDia: Record<string, number> = {};
    visitasFiltradas.forEach((v) => {
      const d = normalizeDate(v.createdAt);
      if (d) {
        const key = d.toISOString().slice(0, 10);
        porDia[key] = (porDia[key] || 0) + 1;
      }
    });

    const serie: { x: string; y: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      serie.push({ x: key, y: porDia[key] || 0 });
    }
    return serie;
  }, [visitasFiltradas]);

  // Datos para gráfico de barras por tipo
  const chartBarData = useMemo(() => {
    const porTipo: Record<string, number> = {};
    visitasFiltradas.forEach((v) => {
      const tv = (v.tipoVisita || 'Sin especificar').toString();
      porTipo[tv] = (porTipo[tv] || 0) + 1;
    });

    return [
      { label: 'Merchandising', value: (porTipo['Merchandising'] || 0) + (porTipo['merchandising'] || 0), color: '#ffee26' },
      { label: 'Trade (Impulso)', value: (porTipo['Trade (Impulso)'] || 0) + (porTipo['trade (impulso)'] || 0) + (porTipo['trade-impulso'] || 0), color: '#fbce04' },
      { label: 'Trade (Eventos)', value: (porTipo['Trade (Eventos)'] || 0) + (porTipo['trade (eventos)'] || 0), color: '#f4a261' },
      { label: 'Otros', value: Object.entries(porTipo).reduce((sum, [tipo, count]) => {
        if (!['Merchandising', 'merchandising', 'Trade (Impulso)', 'trade (impulso)', 'trade-impulso', 'Trade (Eventos)', 'trade (eventos)'].includes(tipo)) {
          return sum + count;
        }
        return sum;
      }, 0), color: '#e76f51' }
    ].filter(item => item.value > 0);
  }, [visitasFiltradas]);

  // Top mercaderistas
  const topMercaderistas = useMemo(() => {
    const map = new Map<string, { email: string; count: number }>();
    visitasFiltradas.forEach((v) => {
      const key = v.direccionCorreo || 'Sin especificar';
      if (!map.has(key)) map.set(key, { email: key, count: 0 });
      map.get(key)!.count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [visitasFiltradas]);

  // Top clientes por visitas
  const topClientes = useMemo(() => {
    const map = new Map<string, { rif: string; nombre: string; count: number }>();
    visitasFiltradas.forEach((v) => {
      const key = v.rifCliente || 'N/A';
      if (!map.has(key)) map.set(key, { rif: key, nombre: v.nombreEstablecimiento || '—', count: 0 });
      map.get(key)!.count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [visitasFiltradas]);

  // Rutas finalizadas
  const rutasFinalizadas = useMemo(() => routesFiltradas.filter((r) => r.status === 'completada'), [routesFiltradas]);
  
  // Rutas en progreso y no finalizadas (de días anteriores)
  const rutasEnProgreso = useMemo(() => routesFiltradas.filter((r) => r.status === 'en_progreso'), [routesFiltradas]);
  const rutasNoFinalizadas = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return routesFiltradas.filter((r) => {
      const d = normalizeDate(r.date);
      return d && d < hoy && r.status !== 'completada';
    });
  }, [routesFiltradas]);

  if (loading || !userPermissions || !currentUser) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos...</p>
          </div>
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
            <Button onClick={() => router.back()} variant="ghost" size="sm" className="text-white hover:bg-red-700/50 p-2 rounded-md">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            {/* Desktop User Info */}
            <div className="hidden sm:flex items-center text-white p-2 rounded-md">
              <UserCircle className="w-10 h-10 mr-3" />
              <div className="text-left flex-1">
                <div className="text-xl font-semibold">{currentUser.fullName}</div>
                <div className="text-sm opacity-75">
                  {userPermissions.isAdminMaster ? 'Admin Master' : `${currentUser.role} - ${currentUser.sede}`}
                </div>
              </div>
            </div>
             {/* Mobile Title */}
             <h1 className="sm:hidden text-xl font-semibold text-white">Datos de Visitas</h1>
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
          <img src="https://storage.googleapis.com/iandai/imagenes/disbatterylogo.png" alt="Disbattery Lubricantes Logo" className="max-h-8" />
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
              <div className="text-xl font-semibold truncate">{currentUser.fullName}</div>
              <div className="text-sm opacity-75 truncate">
                {userPermissions.isAdminMaster ? 'Admin Master' : `${currentUser.role} - ${currentUser.sede}`}
              </div>
            </div>
          </div>
          {/* Podrías añadir un LogoutButton aquí si lo tienes como componente */}
        </div>
      )}

      {/* Main */}
      <main style={{ backgroundColor: '#a51717' }} className="flex-grow pt-24">
        <div className="max-w-7xl mx-auto p-2 sm:p-4">
          <Card className="bg-stone-50 shadow-xl">
            <CardHeader className="border-b border-gray-200">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900">Datos de Visitas</CardTitle>
                  <CardDescription className="text-gray-600 mt-1">
                    {userPermissions.isAdminMaster ? 'Todas las sedes' : `Sede: ${currentUser.sede}`} — Últimos {days} días
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por RIF o nombre" className="w-full sm:w-56" />
                  <select className="border rounded px-2 py-2 text-sm w-full sm:w-auto" value={days} onChange={(e) => setDays(parseInt(e.target.value))}>
                    <option value={7}>7 días</option>
                    <option value={14}>14 días</option>
                    <option value={30}>30 días</option>
                    <option value={60}>60 días</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-red-100">
                  <CardContent className="p-4">
                    <div className="text-sm text-gray-500">Visitas Hoy</div>
                    <div className="text-3xl font-bold text-red-600">
                      {visitasFiltradas.filter(v => {
                        const d = normalizeDate(v.createdAt);
                        const hoy = new Date();
                        return d && d.toDateString() === hoy.toDateString();
                      }).length}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">Tiempo real</div>
                  </CardContent>
                </Card>
                <Card className="border-red-100">
                  <CardContent className="p-4">
                    <div className="text-sm text-gray-500">Visitas 7 días</div>
                    <div className="text-3xl font-bold text-red-600">
                      {visitasFiltradas.filter(v => {
                        const d = normalizeDate(v.createdAt);
                        const hace7 = new Date();
                        hace7.setDate(hace7.getDate() - 7);
                        return d && d >= hace7;
                      }).length}
                    </div>
                    <div className="mt-2"><Sparkline data={kpis.serie.slice(-7)} /></div>
                  </CardContent>
                </Card>
                <Card className="border-red-100">
                  <CardContent className="p-4">
                    <div className="text-sm text-gray-500">Visitas Mes</div>
                    <div className="text-3xl font-bold text-red-600">{kpis.total}</div>
                    <div className="mt-2 flex items-center gap-2 text-red-700"><Activity className="w-4 h-4" />Últimos {days} días</div>
                  </CardContent>
                </Card>
                <Card className="border-red-100">
                  <CardContent className="p-4">
                    <div className="text-sm text-gray-500">Clientes únicos</div>
                    <div className="text-3xl font-bold text-red-600">{kpis.clientesUnicos}</div>
                    <div className="mt-2 flex items-center gap-2 text-red-700"><MapPinned className="w-4 h-4" />Cobertura</div>
                  </CardContent>
                </Card>
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LineChart data={chartLineData} title="Visitas por día (14 días)" />
                <BarChart data={chartBarData} title="Visitas por tipo" />
              </div>

              {/* Rutas */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-gray-900">Rutas finalizadas</CardTitle>
                    <CardDescription>Completadas en el período</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-72 overflow-y-auto">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Mercaderista</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rutasFinalizadas.length === 0 ? (
                              <TableRow><TableCell colSpan={2} className="text-gray-500">Sin rutas finalizadas</TableCell></TableRow>
                            ) : rutasFinalizadas.slice(0, 10).map((r) => {
                              const d = normalizeDate(r.date);
                              return (
                                <TableRow key={r.id}>
                                  <TableCell>{d ? d.toLocaleDateString() : '—'}</TableCell>
                                  <TableCell className="font-mono text-sm whitespace-nowrap">{r.mercaderistoId || '—'}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      {rutasFinalizadas.length > 10 && (
                        <div className="text-xs text-gray-500 mt-2 text-center">
                          Y {rutasFinalizadas.length - 10} más...
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-gray-900">Rutas en progreso</CardTitle>
                    <CardDescription>Activas actualmente</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-72 overflow-y-auto">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Mercaderista</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rutasEnProgreso.length === 0 ? (
                              <TableRow><TableCell colSpan={2} className="text-gray-500">Sin rutas en progreso</TableCell></TableRow>
                            ) : rutasEnProgreso.map((r) => {
                              const d = normalizeDate(r.date);
                              return (
                                <TableRow key={r.id}>
                                  <TableCell>{d ? d.toLocaleDateString() : '—'}</TableCell>
                                  <TableCell className="font-mono text-sm whitespace-nowrap">{r.mercaderistoId || '—'}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-gray-900">Rutas no finalizadas</CardTitle>
                    <CardDescription>De días anteriores</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-72 overflow-y-auto">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Mercaderista</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rutasNoFinalizadas.length === 0 ? (
                              <TableRow><TableCell colSpan={2} className="text-gray-500">No hay rutas pendientes</TableCell></TableRow>
                            ) : rutasNoFinalizadas.map((r) => {
                              const d = normalizeDate(r.date);
                              return (
                                <TableRow key={r.id}>
                                  <TableCell>{d ? d.toLocaleDateString() : '—'}</TableCell>
                                  <TableCell className="font-mono text-sm whitespace-nowrap">{r.mercaderistoId || '—'}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top mercaderistas y clientes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-gray-900">Top mercaderistas</CardTitle>
                    <CardDescription>Por número de visitas - Últimos {days} días</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mercaderista</TableHead>
                            <TableHead className="text-right">Visitas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {topMercaderistas.length === 0 ? (
                            <TableRow><TableCell colSpan={2} className="text-gray-500">Sin datos</TableCell></TableRow>
                          ) : topMercaderistas.map((m, i) => (
                            <TableRow key={m.email}>
                              <TableCell className="whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-red-100 text-red-800 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {i + 1}
                                  </div>
                                  <span className="font-mono text-sm">{m.email}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-red-600">{m.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-gray-900">Top clientes por visitas</CardTitle>
                    <CardDescription>Más visitados - Últimos {days} días</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>RIF</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead className="text-right">Visitas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {topClientes.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-gray-500">Sin datos</TableCell></TableRow>
                          ) : topClientes.map((c, i) => (
                            <TableRow key={c.rif}>
                              <TableCell className="whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 bg-yellow-100 text-yellow-800 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {i + 1}
                                  </div>
                                  <span className="font-mono text-sm">{c.rif}</span>
                                </div>
                              </TableCell>
                              <TableCell>{c.nombre}</TableCell>
                              <TableCell className="text-right font-semibold text-red-600">{c.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Bottom Bar */}
      <footer className="flex flex-col sm:flex-row h-14 flex-shrink-0">
        <div style={{ backgroundColor: '#2a2769' }} className="w-full sm:w-1/5 h-full"></div>
        <div style={{ backgroundColor: '#b61817' }} className="w-full sm:w-1/5 h-full"></div>
        <div style={{ backgroundColor: '#fbce04' }} className="w-full sm:w-3/5 h-full"></div>
      </footer>
    </div>
  );
}


