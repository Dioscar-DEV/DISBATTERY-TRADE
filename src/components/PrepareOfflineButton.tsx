"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { serviceWorkerManager } from "@/services/serviceWorkerManager";

export function PrepareOfflineButton() {
  const [ready, setReady] = useState(false);
  const [precaching, setPrecaching] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await serviceWorkerManager.ping().catch(() => false);
      setReady(ok);
    })();
  }, []);

  const handlePrepareOffline = async () => {
    try {
      setPrecaching(true);
      await serviceWorkerManager.precacheAppShell();
      await serviceWorkerManager.precacheUrls([
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
      ]);
      setDone(true);
    } finally {
      setPrecaching(false);
    }
  };

  if (!ready) return null;

  return (
    <Button size="sm" disabled={precaching} onClick={handlePrepareOffline}>
      {precaching ? "Preparando…" : done ? "Listo" : "Descargar secciones"}
    </Button>
  );
}
