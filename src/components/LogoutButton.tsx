'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/firebase/clientApp';

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className = '' }: LogoutButtonProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      console.log('🚪 Iniciando proceso de logout...');
      
      // Marcar que es un logout reciente para evitar loops
      sessionStorage.setItem('recentLogout', 'true');
      
      // 1. Limpiar COMPLETAMENTE el localStorage PRIMERO
      localStorage.removeItem('userLoggedIn');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('userCredentials');
      localStorage.removeItem('isAdminLoggedIn');
      localStorage.removeItem('merchandiserLoggedIn');
      
      // Limpiar cualquier otro dato que pueda existir
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('user') || key.includes('admin') || key.includes('mercaderista'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      console.log('✅ localStorage limpiado completamente');
      
      // 2. Cerrar sesión en Firebase DESPUÉS
      await signOut(auth);
      console.log('✅ Firebase signOut completado');
      
      // 3. Forzar recarga de la página para evitar estados inconsistentes
      console.log('🔄 Redirigiendo a login...');
      window.location.href = '/';
      
    } catch (error) {
      console.error('❌ Error cerrando sesión:', error);
      // Si hay error, forzar recarga igual
      window.location.href = '/';
    }
  };

  return (
    <button
      onClick={handleLogout}
      className={`logout-button ${className}`}
      style={{
        background: '#D50000',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold'
      }}
    >
      🚪 Cerrar Sesión
    </button>
  );
}