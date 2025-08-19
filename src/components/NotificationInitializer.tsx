"use client";

import { useEffect } from 'react';
import { getCurrentUser } from '@/services/auth';
import { 
  requestNotificationPermission, 
  saveUserNotificationToken, 
  setupForegroundMessageListener 
} from '@/services/notifications';

/**
 * Componente que inicializa el sistema de notificaciones cuando el usuario está logueado
 */
export const NotificationInitializer = () => {
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        console.log('🔔 [NotificationInitializer] Iniciando configuración...');

        // Obtener datos del usuario actual
        const currentUser = await getCurrentUser();
        
        if (!currentUser) {
          console.log('👤 No hay usuario logueado, omitiendo configuración de notificaciones');
          return;
        }

        // Verificar que tenemos los datos mínimos necesarios
        if (!currentUser.uid || !currentUser.email || !currentUser.fullName) {
          console.log('⚠️ Datos del usuario incompletos para notificaciones:', {
            uid: !!currentUser.uid,
            email: !!currentUser.email,
            fullName: !!currentUser.fullName,
            role: currentUser.role
          });
          return;
        }

        console.log('🔔 Configurando notificaciones para usuario:', {
          uid: currentUser.uid,
          name: currentUser.fullName,
          email: currentUser.email,
          role: currentUser.role,
          sede: currentUser.sede || 'Sin sede'
        });

        // 1. Solicitar permisos de notificación
        console.log('🔐 Solicitando permisos de notificación...');
        const hasPermission = await requestNotificationPermission();
        
        if (!hasPermission) {
          console.log('⚠️ Usuario no concedió permisos de notificación');
          return;
        }

        console.log('✅ Permisos de notificación concedidos');

        // 2. Guardar token del usuario
        console.log('💾 Guardando token de notificación del usuario...');
        const tokenSaved = await saveUserNotificationToken(
          currentUser.uid,
          currentUser.email,
          currentUser.fullName,
          currentUser.role,
          currentUser.sede
        );

        if (!tokenSaved) {
          console.log('❌ No se pudo guardar el token de notificación');
          return;
        }

        console.log('✅ Token de notificación guardado correctamente');

        // 3. Configurar listener para mensajes en primer plano
        console.log('👂 Configurando listener de mensajes en primer plano...');
        setupForegroundMessageListener();

        // 4. Registrar Service Worker si no está registrado
        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.register('/sw-notifications.js');
            console.log('✅ Service Worker de notificaciones registrado:', registration.scope);
          } catch (swError) {
            console.log('⚠️ Service Worker ya está registrado o hay un error menor:', swError.message);
          }
        }

        console.log('🎉 Sistema de notificaciones configurado exitosamente para', currentUser.fullName);

      } catch (error) {
        console.error('❌ Error configurando notificaciones:', error);
        console.log('🔄 Las notificaciones se pueden configurar manualmente desde /test-notifications');
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