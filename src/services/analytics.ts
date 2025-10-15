import {
  logEvent,
  setUserId,
  setUserProperties,
  type Analytics,
} from "firebase/analytics";
import { initializeAnalytics, getFirestoreClient } from "@/firebase/clientApp";

// Tipos para eventos personalizados
export interface AnalyticsEvent {
  name: string;
  parameters?: Record<string, any>;
}

export interface UserProperties {
  [key: string]: any; // index signature to satisfy analytics API
  role?: string;
  route_name?: string;
  city?: string;
  department?: string;
  client_count?: number;
  last_visit_date?: string;
}

class AnalyticsService {
  private analytics: Analytics | null = null;
  private initialized = false;

  async initialize() {
    if (!this.initialized) {
      this.analytics = await initializeAnalytics();
      this.initialized = true;
    }
    return this.analytics;
  }

  // Eventos de usuario y autenticación
  async trackLogin(method: string = "firebase") {
    await this.logEvent("login", {
      method,
      timestamp: new Date().toISOString(),
    });
  }

  async trackLogout() {
    await this.logEvent("logout", {
      timestamp: new Date().toISOString(),
    });
  }

  async trackSignUp(method: string = "firebase") {
    await this.logEvent("sign_up", {
      method,
      timestamp: new Date().toISOString(),
    });
  }

  // Eventos de navegación y páginas
  async trackPageView(
    pageName: string,
    additionalParams?: Record<string, any>
  ) {
    await this.logEvent("page_view", {
      page_title: pageName,
      page_location: window.location.href,
      page_path: window.location.pathname,
      ...additionalParams,
    });
  }

  async trackRouteVisit(routeId: string, routeName: string) {
    await this.logEvent("visit_route", {
      route_id: routeId,
      route_name: routeName,
      timestamp: new Date().toISOString(),
    });
  }

  async trackClientVisit(
    clientId: string,
    clientName: string,
    routeId?: string
  ) {
    await this.logEvent("visit_client", {
      client_id: clientId,
      client_name: clientName,
      route_id: routeId,
      timestamp: new Date().toISOString(),
    });
  }

  // Eventos específicos de la app
  async trackFormSubmission(formType: string, success: boolean = true) {
    await this.logEvent("form_submission", {
      form_type: formType,
      success,
      timestamp: new Date().toISOString(),
    });
  }

  async trackPhotoCapture(photoType: string) {
    await this.logEvent("photo_capture", {
      photo_type: photoType,
      timestamp: new Date().toISOString(),
    });
  }

  async trackReportGeneration(reportType: string) {
    await this.logEvent("generate_report", {
      report_type: reportType,
      timestamp: new Date().toISOString(),
    });
  }

  async trackOfflineAction(actionType: string) {
    await this.logEvent("offline_action", {
      action_type: actionType,
      timestamp: new Date().toISOString(),
    });
  }

  // Eventos PWA específicos
  async trackPWAInstall() {
    await this.logEvent("pwa_install", {
      platform: navigator.platform,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  async trackPWALaunch() {
    await this.logEvent("pwa_launch", {
      display_mode: window.matchMedia("(display-mode: standalone)").matches
        ? "standalone"
        : "browser",
      timestamp: new Date().toISOString(),
    });
  }

  async trackOfflineMode(isOffline: boolean) {
    await this.logEvent("offline_mode_change", {
      is_offline: isOffline,
      timestamp: new Date().toISOString(),
    });
  }

  // Eventos de engagement
  async trackSearchAction(searchTerm: string, resultCount: number) {
    await this.logEvent("search", {
      search_term: searchTerm,
      result_count: resultCount,
    });
  }

  async trackTimeSpent(pageName: string, timeInSeconds: number) {
    await this.logEvent("time_spent", {
      page_name: pageName,
      time_seconds: timeInSeconds,
      timestamp: new Date().toISOString(),
    });
  }

  // Configuración de usuario
  async setUser(userId: string, properties?: UserProperties) {
    await this.initialize();
    if (this.analytics) {
      setUserId(this.analytics, userId);
      if (properties) {
        setUserProperties(this.analytics, properties as any);
      }
    }
  }

  async updateUserProperties(properties: UserProperties) {
    await this.initialize();
    if (this.analytics) {
      setUserProperties(this.analytics, properties as any);
    }
  }

  // Método genérico para eventos personalizados
  async logEvent(eventName: string, parameters?: Record<string, any>) {
    await this.initialize();
    if (this.analytics) {
      logEvent(this.analytics, eventName, parameters);
    }
  }

  // Método para trackear errores
  async trackError(error: Error, context?: string) {
    await this.logEvent("error", {
      error_message: error.message,
      error_stack: error.stack,
      context: context || "unknown",
      timestamp: new Date().toISOString(),
    });
  }

  // Método para trackear performance
  async trackPerformance(
    metricName: string,
    value: number,
    unit: string = "ms"
  ) {
    await this.logEvent("performance_metric", {
      metric_name: metricName,
      value,
      unit,
      timestamp: new Date().toISOString(),
    });
  }
}

// Singleton instance
export const analyticsService = new AnalyticsService();

// Función helper para usar en componentes
export const useAnalytics = () => {
  return analyticsService;
};

export default analyticsService;
