"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CacheInfo {
  name: string;
  urls: string[];
}

export default function SWDebugPage() {
  const [swStatus, setSWStatus] = useState<string>("Verificando...");
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [caches, setCaches] = useState<CacheInfo[]>([]);
  const [controller, setController] = useState<string>("No controlador");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    setIsOnline(navigator.onLine);
    checkServiceWorker();
    checkCaches();

    const handleOnline = () => {
      setIsOnline(true);
      addLog("✅ Conexión restaurada");
    };
    const handleOffline = () => {
      setIsOnline(false);
      addLog("❌ Sin conexión");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const checkServiceWorker = async () => {
    addLog("🔍 Verificando Service Worker...");

    if (!("serviceWorker" in navigator)) {
      setSWStatus("❌ Service Workers no soportados");
      addLog("❌ Service Workers no soportados en este navegador");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();

      if (!registration) {
        setSWStatus("❌ No hay Service Worker registrado");
        addLog("❌ No hay Service Worker registrado");
        return;
      }

      const sw = registration.active || registration.waiting || registration.installing;

      if (sw) {
        setSWStatus(`✅ Service Worker ${sw.state}`);
        addLog(`✅ Service Worker encontrado: ${sw.state}`);
        addLog(`📄 SW URL: ${sw.scriptURL}`);
      } else {
        setSWStatus("⚠️ Service Worker registrado pero no activo");
        addLog("⚠️ Service Worker registrado pero no activo");
      }

      if (navigator.serviceWorker.controller) {
        setController(`✅ Controlando: ${navigator.serviceWorker.controller.scriptURL}`);
        addLog(`✅ SW controlando la página`);
      } else {
        setController("❌ No hay controlador activo");
        addLog("❌ SW no está controlando la página");
      }

    } catch (error) {
      setSWStatus(`❌ Error: ${error}`);
      addLog(`❌ Error verificando SW: ${error}`);
    }
  };

  const checkCaches = async () => {
    addLog("🔍 Verificando caches...");

    if (!("caches" in window)) {
      addLog("❌ Cache API no disponible");
      return;
    }

    try {
      const cacheNames = await window.caches.keys();
      addLog(`📦 Encontradas ${cacheNames.length} caches`);

      if (cacheNames.length === 0) {
        addLog("⚠️ NO HAY CACHES. El precache no se ejecutó o falló.");
        addLog("🔍 Verificando si Cache API funciona...");

        // Test manual de Cache API
        try {
          const testCache = await window.caches.open("test-cache");
          await testCache.put(
            new Request("/test"),
            new Response("test", { status: 200 })
          );
          const testResponse = await testCache.match("/test");
          if (testResponse) {
            addLog("✅ Cache API funciona correctamente");
            await window.caches.delete("test-cache");
          } else {
            addLog("❌ Cache API no funciona correctamente");
          }
        } catch (testError) {
          addLog(`❌ Error probando Cache API: ${testError}`);
        }
      }

      const cacheInfoPromises = cacheNames.map(async (name) => {
        const cache = await window.caches.open(name);
        const keys = await cache.keys();
        return {
          name,
          urls: keys.map((req) => req.url),
        };
      });

      const cacheInfo = await Promise.all(cacheInfoPromises);
      setCaches(cacheInfo);

      cacheInfo.forEach((cache) => {
        addLog(`📦 Cache "${cache.name}": ${cache.urls.length} recursos`);
      });
    } catch (error) {
      addLog(`❌ Error verificando caches: ${error}`);
    }
  };

  const testNavigation = () => {
    addLog("🧪 Probando navegación a /shell-material-interno...");
    setTimeout(() => {
      window.location.replace("/shell-material-interno");
    }, 100);
  };

  const clearAllCaches = async () => {
    addLog("🗑️ Limpiando todas las caches...");
    try {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
      addLog("✅ Todas las caches eliminadas");
      await checkCaches();
    } catch (error) {
      addLog(`❌ Error limpiando caches: ${error}`);
    }
  };

  const updateSW = async () => {
    addLog("🔄 Actualizando Service Worker...");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        addLog("✅ Service Worker actualizado");
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      addLog(`❌ Error actualizando SW: ${error}`);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">🔧 Diagnóstico Service Worker</h1>

      {/* Estado general */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Estado General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <strong>Conexión:</strong>{" "}
            {isOnline ? "🟢 Online" : "🔴 Offline (navigator.onLine)"}
          </div>
          <div>
            <strong>Service Worker:</strong> {swStatus}
          </div>
          <div>
            <strong>Controlador:</strong> {controller}
          </div>
        </CardContent>
      </Card>

      {/* Caches */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Caches ({caches.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {caches.length === 0 ? (
            <p className="text-gray-500">No hay caches disponibles</p>
          ) : (
            <div className="space-y-4">
              {caches.map((cache) => (
                <div key={cache.name} className="border-b pb-2">
                  <strong className="text-sm">{cache.name}</strong>
                  <p className="text-xs text-gray-600">
                    {cache.urls.length} recursos
                  </p>
                  <details className="mt-1">
                    <summary className="text-xs cursor-pointer text-blue-600">
                      Ver URLs ({cache.urls.length})
                    </summary>
                    <ul className="text-xs mt-2 max-h-40 overflow-y-auto">
                      {cache.urls.slice(0, 20).map((url, idx) => (
                        <li key={idx} className="truncate">
                          {url.replace(window.location.origin, "")}
                        </li>
                      ))}
                      {cache.urls.length > 20 && (
                        <li className="text-gray-500 italic">
                          ... y {cache.urls.length - 20} más
                        </li>
                      )}
                    </ul>
                  </details>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acciones */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={checkServiceWorker} className="w-full">
            🔄 Verificar Service Worker
          </Button>
          <Button onClick={checkCaches} className="w-full">
            🔄 Verificar Caches
          </Button>
          <Button onClick={testNavigation} className="w-full" variant="outline">
            🧪 Probar navegación a Shell Material Interno
          </Button>
          <Button onClick={updateSW} className="w-full" variant="outline">
            🔄 Actualizar Service Worker
          </Button>
          <Button
            onClick={clearAllCaches}
            className="w-full"
            variant="destructive"
          >
            🗑️ Limpiar todas las caches
          </Button>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Logs ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-black text-green-400 p-3 rounded text-xs font-mono max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p>No hay logs aún...</p>
            ) : (
              logs.map((log, idx) => <div key={idx}>{log}</div>)
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
