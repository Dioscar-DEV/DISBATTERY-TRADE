import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { collection, addDoc, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/clientApp';

// Configuración de Firebase Cloud Messaging (FCM)
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 'BDCJ8sVw_IJmvCoEFGup7PHFvQKH3i8qzCsepnHWRguS-Wpb9ZsdOx9xCFSyjLM5tXv5YS1YVwB5sac1QAKRUeQ';

export interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  userId?: string;
  userRole?: string;
  sede?: string;
}

export interface UserNotificationToken {
  id?: string;
  userId: string;
  email: string;
  fullName: string;
  role: string;
  sede?: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * Solicita permisos de notificación al usuario
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    console.log('🔔 Solicitando permisos de notificación push...');
    
    if (!('Notification' in window)) {
      console.error('❌ Este navegador no soporta notificaciones');
      return false;
    }

    if (Notification.permission === 'granted') {
      console.log('✅ Permisos de notificación ya concedidos');
      return true;
    }

    if (Notification.permission === 'denied') {
      console.log('❌ Permisos de notificación denegados por el usuario');
      return false;
    }

    // Solicitar permisos
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('✅ Permisos de notificación concedidos');
      return true;
    } else {
      console.log('❌ Usuario denegó los permisos de notificación');
      return false;
    }
  } catch (error) {
    console.error('❌ Error solicitando permisos de notificación:', error);
    return false;
  }
};

/**
 * Obtiene el token FCM del usuario actual
 */
export const getUserNotificationToken = async (): Promise<string | null> => {
  try {
    console.log('🔑 Obteniendo token FCM del usuario...');
    
    // Verificar si tenemos permisos
    if (Notification.permission !== 'granted') {
      console.log('⚠️ No hay permisos de notificación concedidos');
      return null;
    }

    if (typeof window === 'undefined') {
      console.log('⚠️ Ejecutándose en servidor, no se puede obtener token');
      return null;
    }

    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    
    if (token) {
      console.log('✅ Token FCM obtenido exitosamente');
      return token;
    } else {
      console.log('❌ No se pudo obtener el token FCM');
      return null;
    }
  } catch (error) {
    console.error('❌ Error obteniendo token FCM:', error);
    return null;
  }
};

/**
 * Guarda o actualiza el token de notificación del usuario en Firestore
 */
export const saveUserNotificationToken = async (
  userId: string,
  userEmail: string,
  fullName: string,
  role: string,
  sede?: string
): Promise<boolean> => {
  try {
    console.log('💾 Guardando token de notificación del usuario...');
    
    const token = await getUserNotificationToken();
    if (!token) {
      console.log('❌ No se pudo obtener token para guardar');
      return false;
    }

    // Verificar si ya existe un token para este usuario
    const tokensRef = collection(db, 'notificationTokens');
    const q = query(tokensRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);

    const tokenData: UserNotificationToken = {
      userId,
      email: userEmail,
      fullName,
      role,
      sede,
      token,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };

    if (!querySnapshot.empty) {
      // Actualizar token existente
      const existingDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, 'notificationTokens', existingDoc.id), {
        token,
        updatedAt: new Date(),
        isActive: true,
        // Actualizar también datos del usuario por si cambiaron
        email: userEmail,
        fullName,
        role,
        sede
      });
      console.log('✅ Token de notificación actualizado');
    } else {
      // Crear nuevo token
      await addDoc(tokensRef, tokenData);
      console.log('✅ Token de notificación guardado');
    }

    return true;
  } catch (error) {
    console.error('❌ Error guardando token de notificación:', error);
    return false;
  }
};

/**
 * Envía una notificación a usuarios específicos
 */
export const sendNotificationToUsers = async (
  targetUserIds: string[],
  notificationData: NotificationData
): Promise<boolean> => {
  try {
    console.log('📨 Enviando notificación a usuarios:', targetUserIds);
    
    if (!targetUserIds || targetUserIds.length === 0) {
      console.log('⚠️ No se proporcionaron IDs de usuarios objetivo');
      return false;
    }
    
    // Obtener tokens de los usuarios objetivo
    const tokensRef = collection(db, 'notificationTokens');
    const q = query(
      tokensRef, 
      where('userId', 'in', targetUserIds),
      where('isActive', '==', true)
    );
    const querySnapshot = await getDocs(q);

    console.log(`🔍 Buscando tokens para usuarios: ${targetUserIds.join(', ')}`);
    console.log(`📊 Tokens encontrados en base de datos: ${querySnapshot.docs.length}`);

    if (querySnapshot.empty) {
      console.log('⚠️ No se encontraron tokens activos para los usuarios objetivo');
      console.log('💡 Esto significa que los usuarios aún no han abierto la app o dado permisos de notificación');
      
      // Aún así, intentar mostrar notificación local si hay un SW activo
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        console.log('🔔 Intentando mostrar notificación local como fallback');
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          payload: notificationData
        });
      }
      
      return false;
    }

    const tokenData = querySnapshot.docs.map(doc => ({
      token: doc.data().token,
      userId: doc.data().userId,
      fullName: doc.data().fullName,
      email: doc.data().email
    }));
    
    console.log('📱 Usuarios con tokens activos:', tokenData.map(t => `${t.fullName} (${t.email})`));
    
    const tokens = tokenData.map(t => t.token);
    console.log(`📱 Enviando a ${tokens.length} dispositivos`);

    // 🔄 CAMBIO: Envío directo con Service Worker en lugar de Firebase Functions
    console.log('🔔 Enviando notificación directa via Service Worker');
    
    // Mostrar notificación local para cada usuario objetivo
    tokenData.forEach(userData => {
      console.log(`📨 Enviando notificación local a: ${userData.fullName}`);
      
      // Usar la API de notificaciones del navegador directamente
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          payload: {
            ...notificationData,
            targetUser: userData.fullName
          }
        });
      }
      
      // También intentar notificación nativa si hay permisos
      if (Notification.permission === 'granted') {
        showLocalNotification(notificationData);
      }
    });

    // Guardar registro de la notificación para auditoría (opcional)
    try {
      const notificationDoc = {
        ...notificationData,
        targetTokens: tokens,
        targetUserIds,
        status: 'sent-direct',
        sentAt: new Date(),
        method: 'local-notification',
        recipientInfo: tokenData.map(t => ({ userId: t.userId, name: t.fullName, email: t.email }))
      };
      await addDoc(collection(db, 'notificationQueue'), notificationDoc);
      console.log('📝 Registro de notificación guardado para auditoría');
    } catch (auditError) {
      console.log('⚠️ Error guardando registro (no crítico):', auditError);
    }

    return true;
  } catch (error) {
    console.error('❌ Error enviando notificación:', error);
    console.error('❌ Detalles del error:', {
      message: error.message,
      stack: error.stack,
      targetUserIds,
      notificationTitle: notificationData.title
    });
    
    // Fallback: mostrar notificación local si es posible
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        console.log('🔄 Fallback: intentando notificación local');
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          payload: notificationData
        });
      }
    } catch (fallbackError) {
      console.error('❌ También falló el fallback:', fallbackError);
    }
    
    return false;
  }
};

/**
 * Envía notificación a administradores de una sede específica
 */
export const sendNotificationToAdmins = async (
  sede: string,
  notificationData: NotificationData
): Promise<boolean> => {
  try {
    console.log(`📨 Enviando notificación a admins de sede: ${sede}`);
    
    // Obtener tokens de administradores de la sede específica
    const tokensRef = collection(db, 'notificationTokens');
    const q = query(
      tokensRef,
      where('role', 'in', ['Administrador', 'AdminMaster', 'Supervisor']),
      where('isActive', '==', true)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log('⚠️ No se encontraron administradores activos');
      return false;
    }

    // Filtrar por sede si no es AdminMaster
    const adminTokens = querySnapshot.docs
      .filter(doc => {
        const data = doc.data();
        return data.role === 'AdminMaster' || data.sede === sede;
      })
      .map(doc => ({
        token: doc.data().token,
        userId: doc.data().userId
      }));

    if (adminTokens.length === 0) {
      console.log(`⚠️ No se encontraron administradores para la sede: ${sede}`);
      return false;
    }

    const tokens = adminTokens.map(admin => admin.token);
    const userIds = adminTokens.map(admin => admin.userId);

    console.log(`📱 Enviando a ${tokens.length} administradores`);

    // Crear la notificación en Firestore
    const notificationDoc = {
      ...notificationData,
      targetTokens: tokens,
      targetUserIds: userIds,
      targetSede: sede,
      status: 'pending',
      createdAt: new Date(),
      attempts: 0
    };

    await addDoc(collection(db, 'notificationQueue'), notificationDoc);
    console.log('✅ Notificación a administradores agregada a la cola');

    return true;
  } catch (error) {
    console.error('❌ Error enviando notificación a administradores:', error);
    return false;
  }
};

/**
 * Configura el listener de mensajes en primer plano
 */
export const setupForegroundMessageListener = () => {
  try {
    if (typeof window === 'undefined') return;
    
    const messaging = getMessaging();
    
    onMessage(messaging, (payload) => {
      console.log('📨 Mensaje recibido en primer plano:', payload);
      
      const { title, body, icon } = payload.notification || {};
      
      if (title && body) {
        // Mostrar notificación personalizada
        showLocalNotification({
          title,
          body,
          icon: icon || '/icon-base.svg',
          data: payload.data
        });
      }
    });
    
    console.log('✅ Listener de mensajes en primer plano configurado');
  } catch (error) {
    console.error('❌ Error configurando listener de mensajes:', error);
  }
};

/**
 * Muestra una notificación local del navegador
 */
export const showLocalNotification = (data: NotificationData) => {
  try {
    if (Notification.permission === 'granted') {
      const notification = new Notification(data.title, {
        body: data.body,
        icon: data.icon || '/icon-base.svg',
        badge: data.badge || '/icon-base.svg',
        tag: 'disbattery-notification',
        requireInteraction: true,
        data: data.data
      });

      // Auto-cerrar después de 5 segundos
      setTimeout(() => {
        notification.close();
      }, 5000);

      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Navegar según el tipo de notificación
        if (data.data?.type === 'nueva-ruta') {
          window.location.href = '/mi-ruta';
        } else if (data.data?.type === 'ruta-editada') {
          window.location.href = '/mi-ruta';
        } else if (data.data?.type === 'ruta-completada') {
          window.location.href = '/admin/dashboard';
        }
      };
    }
  } catch (error) {
    console.error('❌ Error mostrando notificación local:', error);
  }
};