"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

const RELOAD_KEY = "chunk_error_reload";
const RELOAD_MAX = 2; // Max auto-reloads to prevent infinite loops
const RELOAD_WINDOW_MS = 30_000; // Reset counter after 30 seconds

/**
 * Componente para manejar errores de ChunkLoadError.
 * - Escucha mensajes del Service Worker (nueva versión activada, chunk 404)
 * - Detecta ChunkLoadError en window.onerror y unhandledrejection
 * - Protección anti-loop: máximo 2 reloads en 30 segundos
 * Se debe incluir en el layout principal.
 */
export function ChunkErrorHandler() {
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // --- Anti-loop protection ---
    function canReload(): boolean {
      try {
        const raw = sessionStorage.getItem(RELOAD_KEY);
        if (!raw) return true;
        const data = JSON.parse(raw) as { count: number; timestamp: number };
        // Reset counter if window has passed
        if (Date.now() - data.timestamp > RELOAD_WINDOW_MS) return true;
        return data.count < RELOAD_MAX;
      } catch {
        return true;
      }
    }

    function recordReload(): void {
      try {
        const raw = sessionStorage.getItem(RELOAD_KEY);
        let data = { count: 0, timestamp: Date.now() };
        if (raw) {
          data = JSON.parse(raw);
          if (Date.now() - data.timestamp > RELOAD_WINDOW_MS) {
            data = { count: 0, timestamp: Date.now() };
          }
        }
        data.count++;
        sessionStorage.setItem(RELOAD_KEY, JSON.stringify(data));
      } catch {
        // sessionStorage not available, allow reload anyway
      }
    }

    // --- Core reload logic ---
    async function clearCachesAndReload(reason: string): Promise<void> {
      if (!canReload()) {
        console.warn(
          `[ChunkErrorHandler] Suppressed reload (anti-loop). Reason: ${reason}`
        );
        toast({
          variant: "destructive",
          title: "Error de versión",
          description:
            "Cierra la app completamente y vuelve a abrirla para actualizar.",
          duration: 8000,
        });
        return;
      }

      console.warn(`[ChunkErrorHandler] Clearing caches and reloading. Reason: ${reason}`);
      recordReload();

      toast({
        title: "Actualizando aplicación",
        description: "Detectamos una nueva versión. Recargando...",
        duration: 2000,
      });

      // Delete all SW caches
      if ("caches" in window) {
        try {
          const names = await caches.keys();
          await Promise.all(names.map((name) => caches.delete(name)));
        } catch (e) {
          console.warn("[ChunkErrorHandler] Error clearing caches:", e);
        }
      }

      // Force unregister + re-register SW to get a clean slate
      if ("serviceWorker" in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((r) => r.unregister()));
        } catch (e) {
          console.warn("[ChunkErrorHandler] Error unregistering SW:", e);
        }
      }

      // Small delay so toast is visible
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }

    // --- 1. Listen for Service Worker messages ---
    function handleSWMessage(event: MessageEvent): void {
      if (!event.data) return;

      if (
        event.data.type === "SW_ACTIVATED_NEW_VERSION" ||
        event.data.type === "CHUNK_NOT_FOUND"
      ) {
        clearCachesAndReload(`SW message: ${event.data.type}`);
      }
    }

    let swMessageCleanup: (() => void) | null = null;
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener("message", handleSWMessage);
      swMessageCleanup = () =>
        navigator.serviceWorker.removeEventListener("message", handleSWMessage);
    }

    // --- 2. Listen for window errors (ChunkLoadError) ---
    function isChunkError(error: unknown): boolean {
      if (!error || typeof error !== "object") return false;
      const e = error as { name?: string; message?: string };
      const name = e.name || "";
      const msg = e.message || "";
      return (
        name === "ChunkLoadError" ||
        msg.includes("Loading chunk") ||
        msg.includes("ChunkLoadError") ||
        msg.includes("Failed to load chunk") ||
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("chunk no longer available after deployment") ||
        msg.includes("chunk unavailable offline")
      );
    }

    function handleError(event: ErrorEvent): void {
      if (isChunkError(event.error)) {
        clearCachesAndReload(`window error: ${event.error?.message}`);
      }
    }

    function handleRejection(event: PromiseRejectionEvent): void {
      if (isChunkError(event.reason)) {
        event.preventDefault();
        clearCachesAndReload(`unhandled rejection: ${event.reason?.message}`);
      }
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    // --- 3. Detect .txt content served as HTML (existing logic) ---
    function detectTxtContentError(): boolean {
      const bodyText = document.body.textContent || "";
      if (
        bodyText.includes("static/chunks/") &&
        bodyText.includes("PostHogProvider") &&
        bodyText.includes("PWAInstallBanner") &&
        document.body.children.length < 3
      ) {
        clearCachesAndReload("TXT content detected as HTML");
        return true;
      }
      return false;
    }

    const timeout = setTimeout(() => detectTxtContentError(), 1000);
    const interval = setInterval(() => {
      if (detectTxtContentError()) clearInterval(interval);
    }, 5000);

    // --- Cleanup ---
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      swMessageCleanup?.();
    };
  }, [router, toast]);

  return null;
}
