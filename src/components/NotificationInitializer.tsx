"use client";

import { useEffect } from "react";
import { getCurrentUser } from "@/services/auth";
import {
  requestNotificationPermission,
  saveUserNotificationToken,
  setupForegroundMessageListener,
} from "@/services/notifications";

/**
 * Componente que inicializa el sistema de notificaciones cuando el usuario está logueado
 */
export const NotificationInitializer = () => {
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        // Obtener datos del usuario actual
        const currentUser = await getCurrentUser();

        if (!currentUser) return;

        // Verificar que tenemos los datos mínimos necesarios
        if (!currentUser.uid || !currentUser.email || !currentUser.fullName)
          return;

        // 1. Solicitar permisos de notificación
        const hasPermission = await requestNotificationPermission();

        if (!hasPermission) return;

        // 2. Guardar token del usuario
        await saveUserNotificationToken(
          currentUser.uid,
          currentUser.email,
          currentUser.fullName,
          currentUser.role,
          currentUser.sede
        );

        // 3. Configurar listener para mensajes en primer plano
        setupForegroundMessageListener();

        // 4. Registrar Service Worker combinado si no está registrado
        if ("serviceWorker" in navigator) {
          try {
            await navigator.serviceWorker.register("/sw-combined.js");
          } catch (swError) {
            console.warn("Service Worker registration failed:", swError);
          }
        }
      } catch (error) {
        console.error("Error setting up notifications:", error);
      }
    };

    // Configurar con un retraso para permitir que todo se cargue
    const timer = setTimeout(() => {
      setupNotifications();
    }, 2000);

    return () => clearTimeout(timer);
  }, []); // Sin dependencias para evitar re-ejecuciones

  // Este componente no renderiza nada visible
  return null;
};

export default NotificationInitializer;
