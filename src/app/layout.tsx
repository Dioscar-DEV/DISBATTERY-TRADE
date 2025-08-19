import type {Metadata, Viewport} from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster'; // Added Toaster import
import { PWAInstallBanner } from '@/components/PWAInstallBanner';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { NotificationInitializer } from '@/components/NotificationInitializer';
import { AnalyticsInitializer } from '@/components/AnalyticsInitializer';
import { UserStatusChecker } from '@/components/UserStatusChecker';
import OfflineConnectivityBanner from '@/components/OfflineConnectivityBanner';
import OfflineInitializer from '@/components/OfflineInitializer';
import MercaderistaDataLoader from '@/components/MercaderistaDataLoader';
import AutoPrecacheOverlay from '@/components/AutoPrecacheOverlay';

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'], // Added various weights
});

export const metadata: Metadata = {
  title: 'Disbattery Trade App',
  description: 'Aplicación para mercaderistas Disbattery - Visitas, rutas y reportes',
  generator: 'Next.js',
  manifest: '/manifest.json',
  keywords: ['disbattery', 'trade', 'mercaderista', 'visitas', 'rutas', 'shell', 'qualid'],
  authors: [
    { name: 'Disbattery Team' }
  ],
  creator: 'Disbattery',
  publisher: 'Disbattery',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://disbattery-trade-ebv8k9xam-dioscar-salcedos-projects.vercel.app'), // URL de Vercel
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'Disbattery Trade App',
    title: 'Disbattery Trade App',
    description: 'Aplicación para mercaderistas Disbattery',
    images: [
      {
        url: 'https://storage.googleapis.com/iandai/imagenes/Disbattery.png',
        width: 512,
        height: 512,
        alt: 'Disbattery Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Disbattery Trade App',
    description: 'Aplicación para mercaderistas Disbattery',
    images: ['https://storage.googleapis.com/iandai/imagenes/Disbattery.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DisbatteryTrade',
    startupImage: [
      'https://storage.googleapis.com/iandai/imagenes/Disbattery.png',
    ],
  },
  verification: {
    google: 'google-site-verification-code', // Reemplaza con tu código real
  },
};

export const viewport: Viewport = {
  themeColor: '#002D72',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="DisbatteryTrade" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-title" content="DisbatteryTrade" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#002D72" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#002D72" />

        {/* Apple Touch Icon */}
        <link rel="apple-touch-icon" href="https://storage.googleapis.com/iandai/imagenes/Disbattery.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="https://storage.googleapis.com/iandai/imagenes/Disbattery.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="https://storage.googleapis.com/iandai/imagenes/Disbattery.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="https://storage.googleapis.com/iandai/imagenes/Disbattery.png" />

        {/* Standard Favicon */}
        <link rel="icon" type="image/png" sizes="32x32" href="https://storage.googleapis.com/iandai/imagenes/Disbattery.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="https://storage.googleapis.com/iandai/imagenes/Disbattery.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="https://storage.googleapis.com/iandai/imagenes/Disbattery.png" />
        <link rel="icon" href="https://storage.googleapis.com/iandai/imagenes/Disbattery.png" />

        {/* Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Disable automatic phone number detection */}
        <meta name="format-detection" content="telephone=no" />
        
        {/* Viewport for mobile */}
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />
      </head>
      <body className={`${montserrat.variable} font-sans antialiased`}>
        <OfflineInitializer /> {/* Inicializador de servicios offline */}
        <MercaderistaDataLoader /> {/* Descargador automático de datos para mercaderistas */}
        <OfflineConnectivityBanner /> {/* Banner de conectividad offline/online */}
        <PWAInstallBanner /> {/* Banner de instalación PWA persistente */}
        <OfflineIndicator /> {/* Indicador de estado offline */}
        <AutoPrecacheOverlay /> {/* Precarga automática de secciones con progreso */}
        <NotificationInitializer /> {/* Inicializador de notificaciones push */}
        <AnalyticsInitializer /> {/* Inicializador de Google Analytics */}
        <UserStatusChecker /> {/* Verificador de status de usuario en tiempo real */}
        {children}
        <Toaster /> {/* Added Toaster component here */}
      </body>
    </html>
  );
}
