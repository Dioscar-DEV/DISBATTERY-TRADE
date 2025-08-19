"use client";

import { NotificationTester } from '@/components/NotificationTester';

export default function TestNotificationsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Prueba de Notificaciones
          </h1>
          <p className="text-gray-600">
            Panel de pruebas para el sistema de notificaciones push de Disbattery Trade
          </p>
        </div>
        
        <NotificationTester />
        
        <div className="mt-8 text-center">
          <a 
            href="/" 
            className="text-blue-600 hover:text-blue-800 underline"
          >
            ← Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}