import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/clientApp';

// Tipos de roles expandidos
export type UserRole = 'Mercaderista' | 'Administrador' | 'Supervisor' | 'AdminMaster';

// Emails de los admin master que tienen acceso completo
export const ADMIN_MASTER_EMAILS = [
  'dsalcedo@smartautomatai.com',
  'karen.gomez@disbatterylubricantes.com',
  'genesis.alvarado@disbatterylubricantes.com',
  'dioscar05@gmail.com'
];

// Interface para datos de usuario completos
export interface UserData {
  uid: string;
  id?: string; // ✅ ID del documento en Firestore
  email: string;
  fullName: string;
  role: UserRole;
  region?: string;
  sede?: string;
  city?: string;
  status?: 'active' | 'pending_approval' | 'rejected'; // ✅ Agregado campo status
}

// Interface para permisos calculados
export interface UserPermissions {
  canAccessAllSedes: boolean;
  allowedSedes: string[];
  canManageUsers: boolean;
  canManageRoutes: boolean;
  canManageClients: boolean;
  canViewReports: boolean;
  isAdminMaster: boolean;
}

// Función para determinar si un usuario es admin master
export const isAdminMaster = (email: string): boolean => {
  if (!email) return false;
  return ADMIN_MASTER_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase());
};

// Función para calcular permisos basados en el rol y sede
export const calculatePermissions = (userData: UserData): UserPermissions => {
  const isAM = isAdminMaster(userData.email);
  
  // Debug logging
  console.log('Calculando permisos para:', {
    email: userData.email,
    role: userData.role,
    sede: userData.sede,
    isAdminMaster: isAM
  });
  
  const permissions = {
    canAccessAllSedes: isAM,
    allowedSedes: isAM ? ['GRUPO DISBATTERY', 'BLITZ 2000', 'GRUPO VICTORIA', 'DISBATTERY'] : 
                  (userData.sede ? [userData.sede] : []),
    canManageUsers: isAM || userData.role === 'Administrador',
    canManageRoutes: isAM || userData.role === 'Administrador' || userData.role === 'Supervisor',
    canManageClients: isAM || userData.role === 'Administrador' || userData.role === 'Supervisor',
    canViewReports: true, // Todos pueden ver reportes, pero filtrados por sede
    isAdminMaster: isAM
  };
  
  console.log('Permisos calculados:', permissions);
  return permissions;
};

// Obtener datos del usuario logueado
export const getCurrentUser = async (): Promise<UserData | null> => {
  try {
    const auth = getAuth();
    
    // Esperar a que Firebase Auth restaure la sesión
    const currentUser = await new Promise<User | null>((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
    
    // Si no hay usuario autenticado en Firebase, intentar obtener desde localStorage
    if (!currentUser) {
      console.log('No hay usuario logueado en Firebase Auth, intentando localStorage...');
      const storageUser = getUserFromStorage();
      if (storageUser) {
        console.log('Usuario encontrado en localStorage:', storageUser);
        return storageUser;
      }
      console.log('No hay usuario en localStorage tampoco');
      return null;
    }

    console.log('Usuario autenticado encontrado:', {
      uid: currentUser.uid,
      email: currentUser.email
    });

    // Verificar si es admin master
    const isMaster = isAdminMaster(currentUser.email || '');
    console.log('¿Es admin master?', isMaster);
    
    // Obtener datos adicionales de Firestore
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    
    if (!userDoc.exists()) {
      console.log('No se encontraron datos del usuario en Firestore');
      // Fallback con datos básicos de Auth
      const fallbackData = {
        uid: currentUser.uid,
        id: currentUser.uid, // ✅ ID del documento
        email: currentUser.email || '',
        fullName: currentUser.displayName || 'Usuario',
        role: isMaster ? 'AdminMaster' as UserRole : 'Mercaderista' as UserRole,
        status: 'active' as const // ✅ Status por defecto para usuarios sin datos en Firestore
      };
      console.log('Usando datos fallback:', fallbackData);
      saveUserToStorage(fallbackData); // Guardar en localStorage
      return fallbackData;
    }

    const userData = userDoc.data();
    console.log('Datos obtenidos de Firestore:', userData);
    
    const finalUserData = {
      uid: currentUser.uid,
      id: currentUser.uid, // ✅ ID del documento (mismo que uid)
      email: currentUser.email || '',
      fullName: userData.fullName || currentUser.displayName || 'Usuario',
      role: isMaster ? 'AdminMaster' as UserRole : (userData.role || 'Mercaderista') as UserRole,
      region: userData.region,
      sede: userData.sede,
      city: userData.city,
      status: userData.status // ✅ CRÍTICO: Incluir el campo status
    };
    
    console.log('Datos finales del usuario:', finalUserData);
    saveUserToStorage(finalUserData); // Guardar en localStorage
    return finalUserData;
    
  } catch (error) {
    console.error('Error obteniendo datos del usuario:', error);
    // En caso de error, intentar localStorage como último recurso
    const storageUser = getUserFromStorage();
    if (storageUser) {
      console.log('Usando datos de localStorage tras error:', storageUser);
      return storageUser;
    }
    return null;
  }
};

// Obtener datos completos del usuario con permisos
export const getCurrentUserWithPermissions = async (): Promise<{user: UserData; permissions: UserPermissions} | null> => {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    
    const permissions = calculatePermissions(user);
    
    return { user, permissions };
  } catch (error) {
    console.error('Error obteniendo usuario con permisos:', error);
    return null;
  }
};

// Verificar si el usuario está logueado
export const isUserLoggedIn = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(!!user);
    });
  });
};

// Obtener usuario desde localStorage como fallback
export const getUserFromStorage = (): UserData | null => {
  try {
    if (typeof window === 'undefined') return null;
    
    const userData = localStorage.getItem('currentUser');
    if (!userData) return null;
    
    return JSON.parse(userData);
  } catch (error) {
    console.error('Error obteniendo usuario del localStorage:', error);
    return null;
  }
};

// Guardar datos del usuario en localStorage
export const saveUserToStorage = (userData: UserData): void => {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem('currentUser', JSON.stringify(userData));
  } catch (error) {
    console.error('Error guardando usuario en localStorage:', error);
  }
};

// Limpiar datos del usuario
export const clearUserData = (): void => {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('currentUser');
  } catch (error) {
    console.error('Error limpiando datos del usuario:', error);
  }
};

// Función para verificar permisos de acceso a una sede específica
export const canAccessSede = (userData: UserData, sede: string): boolean => {
  const permissions = calculatePermissions(userData);
  return permissions.canAccessAllSedes || permissions.allowedSedes.includes(sede);
};

// Función para verificar permisos generales de administración
export const hasAdminPermissions = (userData: UserData): boolean => {
  const permissions = calculatePermissions(userData);
  return permissions.canManageUsers || permissions.isAdminMaster;
}; 