'use client'

import { useEffect, useMemo, useState } from 'react';
import { serviceWorkerManager } from '@/services/serviceWorkerManager';

interface ProgressState {
  total: number;
  done: number;
  percentage: number;
  message: string;
}

export default function AutoPrecacheOverlay() {
  const [visible, setVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState>({ total: 0, done: 0, percentage: 0, message: 'Preparando...' });

  const urls = useMemo(() => (
    [
      '/',
      '/mi-ruta/',
      '/visit-capture/',
      '/signage-capture/',
      '/shell-merchandising/',
      '/qualid-merchandising/',
      '/observaciones/',
      '/reportes-finales/',
      '/ventas-productos/',
      '/trade-eventos/',
      '/trade-impulso/',
      '/shell-material-interno/',
    ]
  ), []);

  useEffect(() => {
    // Evitar repetir si ya se preparó antes
    const ready = localStorage.getItem('precache_ready_v1') === 'true';
    if (ready) return;
    setVisible(true);

    let cancelled = false;
    (async () => {
      try {
        // Asegurar que el SW esté listo
        await new Promise((r) => setTimeout(r, 500));
        const total = urls.length;
        let done = 0;
        setProgress({ total, done, percentage: 0, message: 'Precargando secciones...' });

        const missing: string[] = [];

        for (const url of urls) {
          if (cancelled) break;
          // Si ya está en cache, avanzar
          try {
            const match = await caches.match(url);
            if (match) {
              done += 1;
              setProgress({ total, done, percentage: Math.round((done / total) * 100), message: `En cache: ${url}` });
              continue;
            }
          } catch {}

          if (navigator.onLine) {
            // Cargar en iframe oculto para forzar descarga de HTML + assets (_next/static/*)
            await new Promise<void>((resolve) => {
              const iframe = document.createElement('iframe');
              iframe.style.display = 'none';
              iframe.src = url;
              const timer = setTimeout(() => {
                try { document.body.removeChild(iframe); } catch {}
                resolve();
              }, 4000); // 4s máximo por página
              iframe.onload = () => {
                clearTimeout(timer);
                try { document.body.removeChild(iframe); } catch {}
                resolve();
              };
              document.body.appendChild(iframe);
            });
            done += 1;
            setProgress({ total, done, percentage: Math.round((done / total) * 100), message: `Descargado: ${url}` });
          } else {
            missing.push(url);
          }
        }

        if (missing.length === 0) {
          localStorage.setItem('precache_ready_v1', 'true');
          setProgress({ total, done, percentage: 100, message: 'Listo' });
          setTimeout(() => setVisible(false), 400);
        } else {
          setErrorMsg('Necesitas conexión para completar la preparación offline');
        }
      } catch (e) {
        setErrorMsg('Error preparando modo offline');
      }
    })();

    return () => { cancelled = true; };
  }, [urls]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4">
        <div className="text-center mb-3">
          <div className="text-lg font-semibold">Preparando modo offline</div>
          <div className="text-sm text-gray-600">{progress.message}</div>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded">
          <div className="h-2 bg-blue-600 rounded" style={{ width: `${progress.percentage}%` }} />
        </div>
        <div className="mt-2 text-xs text-gray-500 text-right">{progress.percentage}%</div>
        {errorMsg && (
          <div className="mt-3 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded p-2 text-center">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}


