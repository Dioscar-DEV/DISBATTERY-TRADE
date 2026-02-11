'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface PageState {
  loading: boolean;
  error: string | null;
  data: any;
}

export interface UsePageStateOptions {
  initialLoading?: boolean;
  onError?: (error: string) => void;
  autoRetry?: boolean;
  retryDelay?: number;
  maxRetries?: number;
}

export function usePageState(options: UsePageStateOptions = {}) {
  const {
    initialLoading = false,
    onError,
    autoRetry = false,
    retryDelay = 3000,
    maxRetries = 3
  } = options;

  const router = useRouter();
  const [state, setState] = useState<PageState>({
    loading: initialLoading,
    error: null,
    data: null
  });
  const [retryCount, setRetryCount] = useState(0);

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error, loading: false }));
    if (error && onError) {
      onError(error);
    }
  }, [onError]);

  const setData = useCallback((data: any) => {
    setState(prev => ({ ...prev, data, loading: false, error: null }));
    setRetryCount(0); // Reset retry count on success
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      data: null
    });
    setRetryCount(0);
  }, []);

  // Función para ejecutar operaciones async con manejo de errores
  const executeAsync = useCallback(async <T>(
    operation: () => Promise<T>,
    errorMessage?: string
  ): Promise<T | null> => {
    try {
      setLoading(true);
      clearError();
      const result = await operation();
      setData(result);
      return result;
    } catch (error) {
      const message = errorMessage || 
        (error instanceof Error ? error.message : 'Error desconocido');
      setError(message);
      console.error('Error en executeAsync:', error);
      return null;
    }
  }, [setLoading, clearError, setData, setError]);

  // Auto-retry logic
  useEffect(() => {
    if (autoRetry && state.error && retryCount < maxRetries) {
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        // Trigger retry by clearing error
        clearError();
      }, retryDelay);

      return () => clearTimeout(timer);
    }
  }, [state.error, autoRetry, retryCount, maxRetries, retryDelay, clearError]);

  // Navigation helpers
  const safeNavigate = useCallback(async (path: string, description = '', fallback?: string) => {
    setLoading(true); // Siempre activar loading antes de navegar
    console.log(`🔄 [NAVIGATION] Intentando navegar a ${path}${description ? ` - ${description}` : ''}...`);
    try {
      await router.push(path);
      console.log(`✅ [NAVIGATION] Navegación exitosa a ${path}`);
    } catch (error) {
      console.error(`❌ [NAVIGATION ERROR] Error navegando a ${path}:`, error);
      if (fallback && path !== fallback) {
        console.log(`🔄 [NAVIGATION FALLBACK] Usando window.location.href para ${fallback}`);
        // Pequeño retraso para que el mensaje de carga sea visible
        await new Promise(resolve => setTimeout(resolve, 300)); 
        window.location.href = fallback;
      } else if (path !== '/') {
        console.log(`🔄 [NAVIGATION FALLBACK] Fallback a /`);
        await new Promise(resolve => setTimeout(resolve, 300)); 
        window.location.href = '/'; // Fallback a la raíz si no hay otro fallback
      }
    } finally {
      setLoading(false); // Desactivar loading después de intentar navegar
    }
  }, [router, setLoading]);

  const navigateWithLoading = useCallback(async (path: string, delay = 0, description = '') => {
    setLoading(true);
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    await safeNavigate(path, description);
  }, [setLoading, safeNavigate]);

  return {
    ...state,
    setLoading,
    setError,
    setData,
    clearError,
    reset,
    executeAsync,
    safeNavigate,
    navigateWithLoading,
    retryCount,
    isRetrying: autoRetry && retryCount > 0 && retryCount < maxRetries
  };
}

// Hook específico para páginas con autenticación
export function useAuthenticatedPageState(options: UsePageStateOptions = {}) {
  const pageState = usePageState(options);
  const router = useRouter();

  const checkAuthAndExecute = useCallback(async <T>(
    operation: () => Promise<T>,
    errorMessage?: string
  ): Promise<T | null> => {
    // Verificar si hay sesión activa
    const isLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
    
    if (!isLoggedIn) {
      pageState.setError('Sesión expirada. Por favor, inicia sesión nuevamente.');
      setTimeout(() => {
        router.push('/');
      }, 2000);
      return null;
    }

    return pageState.executeAsync(operation, errorMessage);
  }, [pageState, router]);

  return {
    ...pageState,
    checkAuthAndExecute
  };
}

export default usePageState;
