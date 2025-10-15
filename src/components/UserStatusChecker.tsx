'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthClient, getFirestoreClient } from '@/firebase/clientApp';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from '@/hooks/use-toast';

/**
 * Componente que verifica en tiempo real el status del usuario logueado
 * Si el usuario es rechazado o suspendido, lo desloguea automáticamente
 */
export function UserStatusChecker() {
  const router = useRouter();

  useEffect(() => {
    // Verificar status cada 30 segundos para usuarios logueados
    const interval = setInterval(async () => {
      try {
        // Solo verificar si hay usuario en localStorage
        const currentUserStr = localStorage.getItem('currentUser');
        if (!currentUserStr) return;

        const currentUser = JSON.parse(currentUserStr);
        if (!currentUser.id) return;

        // Obtener status actualizado desde Firestore
        const firestore = getFirestoreClient();
        const userDoc = await getDoc(doc(firestore, 'users', currentUser.id));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        const userStatus = userData.status || 'active';

        // Verificar si el usuario fue rechazado o está pendiente
        if (userStatus === 'rejected') {
          console.log('🚫 Usuario rechazado detectado - forzando logout');

          // Limpiar todo y desloguear
          localStorage.clear();
          await getAuthClient().signOut();

          toast({
            title: "Cuenta Rechazada",
            description: "Tu cuenta ha sido rechazada por el administrador.",
            variant: "destructive",
          });

          // Redirigir al login
          router.push('/');
          return;
        }

        if (userStatus === 'pending_approval') {
          console.log('⏳ Usuario pendiente detectado - forzando logout');

          // Limpiar todo y desloguear
          localStorage.clear();
          await getAuthClient().signOut();

          toast({
            title: "Cuenta Pendiente",
            description: "Tu cuenta está pendiente de aprobación.",
            variant: "default",
          });

          // Redirigir al login
          router.push('/');
          return;
        }

      } catch (error) {
        console.warn('Error verificando status del usuario:', error);
        // No hacer nada en caso de error de red
      }
    }, 30000); // Verificar cada 30 segundos

    // También verificar cuando cambia el estado de autenticación
    const unsubscribe = onAuthStateChanged(getAuthClient(), async (user) => {
      if (!user) {
        // Usuario no autenticado, limpiar localStorage
        localStorage.clear();
        return;
      }

      // Usuario autenticado, verificar su status una vez
      try {
        const currentUserStr = localStorage.getItem('currentUser');
        if (!currentUserStr) return;

        const currentUser = JSON.parse(currentUserStr);
        if (!currentUser.id) return;

        const firestore = getFirestoreClient();
        const userDoc = await getDoc(doc(firestore, 'users', currentUser.id));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        const userStatus = userData.status || 'active';

        if (userStatus === 'rejected' || userStatus === 'pending_approval') {
          localStorage.clear();
          await getAuthClient().signOut();
          router.push('/');
        }
      } catch (error) {
        console.warn('Error en verificación de auth:', error);
      }
    });

    // Cleanup
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [router]);

  return null; // Este componente no renderiza nada
}