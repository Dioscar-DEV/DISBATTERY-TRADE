"use client";

import { useRouter } from "next/navigation";
import { getAuthClient } from "@/firebase/clientApp";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface LogoutButtonProps {
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
  showText?: boolean;
}

export function LogoutButton({
  className = "",
  variant = "destructive",
  size = "default",
  showText = true,
}: LogoutButtonProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      console.log("Iniciando proceso de logout...");

      // Marcar que es un logout reciente para evitar loops
      sessionStorage.setItem("recentLogout", "true");

      // 1. Limpiar COMPLETAMENTE el localStorage PRIMERO
      localStorage.removeItem("userLoggedIn");
      localStorage.removeItem("currentUser");
      localStorage.removeItem("userCredentials");
      localStorage.removeItem("isAdminLoggedIn");
      localStorage.removeItem("merchandiserLoggedIn");

      // Limpiar cualquier otro dato que pueda existir
      if (typeof window !== "undefined") {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.includes("user") ||
              key.includes("admin") ||
              key.includes("mercaderista"))
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      }

      console.log("✅ localStorage limpiado completamente");

      // 2. Cerrar sesión en Firebase DESPUÉS
      await getAuthClient().signOut();
      console.log("✅ Firebase signOut completado");

      // 3. Forzar recarga de la página para evitar estados inconsistentes
      console.log("🔄 Redirigiendo a login...");
      window.location.href = "/";
    } catch (error) {
      console.error("❌ Error cerrando sesión:", error);
      // Si hay error, forzar recarga igual
      window.location.href = "/";
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLogout}
      className={className}
    >
      <LogOut className={`h-4 w-4 ${showText ? "mr-2" : ""}`} />
      {showText && "Cerrar Sesión"}
    </Button>
  );
}
