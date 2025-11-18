"use client";

import { useEffect, useCallback } from "react";
import { analyticsService, type UserProperties } from "@/services/analytics";

export function useAnalytics() {
  // Función para trackear eventos de navegación
  const trackNavigation = useCallback(
    async (destination: string, context?: string) => {
      await analyticsService.logEvent("navigation", {
        destination,
        context,
        timestamp: new Date().toISOString(),
      });
    },
    []
  );

  // Función para trackear interacciones con botones
  const trackButtonClick = useCallback(
    async (buttonName: string, context?: string) => {
      await analyticsService.logEvent("button_click", {
        button_name: buttonName,
        context,
        timestamp: new Date().toISOString(),
      });
    },
    []
  );

  // Función para trackear formularios
  const trackFormInteraction = useCallback(
    async (
      formName: string,
      action: "start" | "complete" | "error",
      additionalData?: Record<string, any>
    ) => {
      await analyticsService.logEvent("form_interaction", {
        form_name: formName,
        action,
        ...additionalData,
        timestamp: new Date().toISOString(),
      });
    },
    []
  );

  // Función para trackear visitas a clientes
  const trackClientInteraction = useCallback(
    async (
      clientId: string,
      clientName: string,
      action: "visit" | "photo" | "form_submit",
      additionalData?: Record<string, any>
    ) => {
      await analyticsService.logEvent("client_interaction", {
        client_id: clientId,
        client_name: clientName,
        action,
        ...additionalData,
        timestamp: new Date().toISOString(),
      });
    },
    []
  );

  // Función para trackear actividades de ruta
  const trackRouteActivity = useCallback(
    async (
      routeId: string,
      activity: "start" | "complete" | "pause",
      additionalData?: Record<string, any>
    ) => {
      await analyticsService.logEvent("route_activity", {
        route_id: routeId,
        activity,
        ...additionalData,
        timestamp: new Date().toISOString(),
      });
    },
    []
  );

  // Función para trackear uso de características específicas
  const trackFeatureUsage = useCallback(
    async (featureName: string, usage: "start" | "complete" | "error") => {
      await analyticsService.logEvent("feature_usage", {
        feature_name: featureName,
        usage,
        timestamp: new Date().toISOString(),
      });
    },
    []
  );

  // Función para trackear búsquedas
  const trackSearch = useCallback(
    async (searchTerm: string, resultCount: number, context?: string) => {
      await analyticsService.trackSearchAction(searchTerm, resultCount);
      if (context) {
        await analyticsService.logEvent("search_context", {
          search_term: searchTerm,
          context,
          result_count: resultCount,
        });
      }
    },
    []
  );

  // Función para trackear errores de usuario
  const trackUserError = useCallback(
    async (errorType: string, errorMessage: string, context?: string) => {
      await analyticsService.logEvent("user_error", {
        error_type: errorType,
        error_message: errorMessage,
        context,
        timestamp: new Date().toISOString(),
      });
    },
    []
  );

  // Función para actualizar propiedades del usuario
  const updateUserData = useCallback(
    async (userId: string, properties: UserProperties) => {
      await analyticsService.setUser(userId, properties);
    },
    []
  );

  return {
    // Funciones básicas del servicio
    trackLogin: analyticsService.trackLogin.bind(analyticsService),
    trackLogout: analyticsService.trackLogout.bind(analyticsService),
    trackPageView: analyticsService.trackPageView.bind(analyticsService),

    // Funciones personalizadas
    trackNavigation,
    trackButtonClick,
    trackFormInteraction,
    trackClientInteraction,
    trackRouteActivity,
    trackFeatureUsage,
    trackSearch,
    trackUserError,
    updateUserData,

    // Funciones específicas de la app
    trackPhotoCapture:
      analyticsService.trackPhotoCapture.bind(analyticsService),
    trackReportGeneration:
      analyticsService.trackReportGeneration.bind(analyticsService),
    trackOfflineAction:
      analyticsService.trackOfflineAction.bind(analyticsService),

    // Función genérica
    logEvent: analyticsService.logEvent.bind(analyticsService),
  };
}

// Hook para trackear tiempo en componente específico
export function usePageTimer(pageName: string) {
  useEffect(() => {
    const startTime = Date.now();

    return () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      if (timeSpent > 3) {
        // Solo trackear si estuvo más de 3 segundos
        analyticsService.trackTimeSpent(pageName, timeSpent);
      }
    };
  }, [pageName]);
}

// Hook para trackear errores en componentes
export function useErrorTracking(componentName: string) {
  const trackError = useCallback(
    (error: Error, context?: string) => {
      analyticsService.trackError(
        error,
        `${componentName}${context ? `_${context}` : ""}`
      );
    },
    [componentName]
  );

  return { trackError };
}
