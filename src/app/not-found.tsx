'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">🔍</span>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Página no encontrada
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            Lo sentimos, la página que estás buscando no existe o ha sido movida.
          </p>

          <div className="space-y-2">
            <Link href="/">
              <Button className="w-full bg-red-600 hover:bg-red-700">
                <Home className="w-4 h-4 mr-2" />
                Ir al inicio
              </Button>
            </Link>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver atrás
            </Button>
          </div>

          <div className="pt-4 text-sm text-gray-500">
            <p>Error 404 - DISBATTERY Trade</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 