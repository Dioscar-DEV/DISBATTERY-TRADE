'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to external service if needed
    // logErrorToService(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleGoHome = () => {
    // Check user role and redirect appropriately
    const currentUser = localStorage.getItem('currentUser');
    let homePath = '/';
    
    if (currentUser) {
      try {
        const userData = JSON.parse(currentUser);
        if (userData.role === 'AdminMaster' || userData.role === 'Administrador') {
          homePath = '/admin/dashboard';
        } else {
          homePath = '/mi-ruta';
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    
    window.location.href = homePath;
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full space-y-4">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                ¡Oops! Algo salió mal
              </h1>
              <p className="text-gray-600 mb-6">
                Se produjo un error inesperado. Por favor, intenta de nuevo.
              </p>
            </div>

            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {this.state.error?.message || 'Error desconocido'}
              </AlertDescription>
            </Alert>

            {/* Error details for development */}
            {this.state.errorInfo && (
              <details className="bg-gray-100 p-4 rounded-lg text-sm">
                <summary className="cursor-pointer font-medium mb-2">
                  Detalles del error
                </summary>
                <pre className="whitespace-pre-wrap text-xs overflow-auto">
                  {this.state.error?.stack}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <Button
                onClick={this.handleRetry}
                variant="default"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </Button>
              
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Ir al Inicio
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook para usar ErrorBoundary de manera programática
export function useErrorHandler() {
  const handleError = (error: Error, context?: string) => {
    console.error(`Error${context ? ` in ${context}` : ''}:`, error);
    
    // You could also trigger a toast notification here
    // toast.error(error.message);
  };

  const withErrorHandling = <T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context?: string
  ) => {
    return async (...args: T): Promise<R | null> => {
      try {
        return await fn(...args);
      } catch (error) {
        handleError(error as Error, context);
        return null;
      }
    };
  };

  return { handleError, withErrorHandling };
}

export default ErrorBoundary;
