"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showOnlyWhenInstallable?: boolean;
}

export function PWAInstallButton({
  variant = "default",
  size = "default",
  className = "",
  showOnlyWhenInstallable = false,
}: PWAInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Verificar si ya está instalada
    if ((window as Window).matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Escuchar el evento de instalación
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt as unknown as EventListenerOrEventListenerObject
    );

    // Escuchar cuando se instala
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt as unknown as EventListenerOrEventListenerObject
      );
      window.removeEventListener("appinstalled", () => {});
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setCanInstall(false);
      setDeferredPrompt(null);
    }
  };

  const handleOpenInstallPage = () => {
    window.open("/instalar", "_blank");
  };

  // Si solo mostrar cuando es instalable y no puede instalarse, no mostrar nada
  if (showOnlyWhenInstallable && !canInstall && !isInstalled) {
    return null;
  }

  // Si ya está instalada, mostrar estado
  if (isInstalled) {
    return (
      <Button
        variant="outline"
        size={size}
        className={`${className} opacity-70 cursor-default`}
        disabled
      >
        <Smartphone className="mr-2 h-4 w-4" />
        App Instalada ✅
      </Button>
    );
  }

  // Si puede instalarse directamente
  if (canInstall) {
    return (
      <Button
        onClick={handleInstallClick}
        variant={variant}
        size={size}
        className={`${className} ${variant === "default" ? "bg-gradient-to-r from-brand-blue to-brand-red text-white border-0 hover:opacity-90 transition-opacity" : ""}`}
      >
        <Download className="mr-2 h-4 w-4" />
        Instalar App
      </Button>
    );
  }

  // Fallback: abrir página de instalación
  return (
    <Button
      onClick={handleOpenInstallPage}
      variant={variant}
      size={size}
      className={`${className} ${variant === "default" ? "bg-gradient-to-r from-brand-blue to-brand-red text-white border-0 hover:opacity-90 transition-opacity" : ""}`}
    >
      <Download className="mr-2 h-4 w-4" />
      Instalar App
    </Button>
  );
}
