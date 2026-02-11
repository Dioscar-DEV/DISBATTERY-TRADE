"use client";

import { useEffect } from "react";
import { offlineManager } from "@/services/offlineManager";
import { serviceWorkerManager } from "@/services/serviceWorkerManager";

export default function OfflineInitializer() {
  useEffect(() => {
    // Inicializar sistema offline consolidado al montar el componente
    (async () => {
      try {
        await offlineManager.initializeOfflineSystem();
      } catch (error) {
        console.error("❌ Error inicializando sistema offline:", error);
      }
    })();
    // Precargar app shell y URLs clave con el SW (evita contaminar cache con RSC)
    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 1000));
        await serviceWorkerManager.precacheAppShell();
        const urls = [
          "/",
          "/mi-ruta",
          "/visit-capture",
          "/signage-capture",
          "/shell-merchandising",
          "/qualid-merchandising",
          "/observaciones",
          "/reportes-finales",
          "/ventas-productos",
          "/trade-eventos",
          "/trade-impulso",
          "/shell-material-interno",
        ];
        await serviceWorkerManager.precacheUrls(urls);
      } catch {}
    })();
  }, []);

  // Este componente no renderiza nada visible
  return null;
}
