import type {NextConfig} from 'next';

// @ts-ignore
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Deshabilitado en desarrollo para evitar cache issues
  fallbacks: {
    document: '/offline.html', // Fallback para navegación offline
  },
  publicExcludes: ['!offline.html'], // No cachear la página offline
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    // TODOS los navegations de la app: interceptar siempre (offline-first con fallback)
    {
      urlPattern: ({ request }: { request: any }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'all-pages',
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
        },
      },
    },
    // Chunks JS/CSS de Next: CacheFirst para evitar errores de chunk al volver de offline
    {
      urlPattern: /^\/_next\/static\/(?!.*\.json$).*$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-chunks',
        expiration: {
          maxEntries: 300,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    // Páginas estáticas Next.js
    {
      urlPattern: /^\/_next\/static\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-cache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
        },
      },
    },
    // Fonts
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-cache',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 año
        },
      },
    },
    // Firebase Storage - imágenes
    {
      urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'firebase-images-cache',
        expiration: {
          maxEntries: 1000,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
        },
      },
    },
    // Google Storage
    {
      urlPattern: /^https:\/\/storage\.googleapis\.com\/.*/i,
      handler: 'StaleWhileRevalidate', 
      options: {
        cacheName: 'google-storage-cache',
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 7 días
        },
      },
    },
    // APIs de Firestore - NetworkFirst con fallback
    {
      urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'firestore-api-cache',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 5, // 5 minutos
        },
      },
    }
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  output: 'export', // Necesario para Firebase Hosting
  trailingSlash: true, // Necesario para export mode
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'AIzaSyA6Q_8LsOmui-Dcib-w5KD3CiJagTxFHoA',
  },
  // Configuración específica para Vercel
  experimental: {
    // Optimizaciones para Vercel
  },
};

export default withPWA(nextConfig);
