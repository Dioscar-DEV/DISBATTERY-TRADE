import type { NextConfig } from "next";

// @ts-ignore
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development", // Deshabilitado en desarrollo para evitar cache issues
  fallbacks: {
    document: "/offline.html", // Fallback para navegación offline
  },
  publicExcludes: ["!offline.html"], // No cachear la página offline
  buildExcludes: [
    /middleware-manifest\.json$/,
    /.*\.txt$/, // CRÍTICO: Excluir archivos .txt que causan el error
    /.*\.map$/, // Excluir source maps
  ],
  runtimeCaching: [
    // TODOS los navegations de la app: interceptar siempre (offline-first con fallback)
    {
      urlPattern: ({ request, url }: { request: any; url: URL }) => {
        return request.mode === "navigate" && !url.pathname.endsWith(".txt");
      },
      handler: "NetworkFirst",
      options: {
        cacheName: "all-pages",
        networkTimeoutSeconds: 5, // Más tiempo para evitar timeouts
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
        },
      },
    },
    // Chunks JS/CSS de Next: NetworkFirst con fallback para evitar ChunkLoadError
    {
      urlPattern: /^\/_next\/static\/chunks\/.*$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "next-chunks",
        networkTimeoutSeconds: 10, // Más tiempo para chunks grandes
        expiration: {
          maxEntries: 300,
          maxAgeSeconds: 60 * 60 * 24 * 7, // Solo 7 días para forzar actualizaciones
        },
      },
    },
    // Páginas estáticas Next.js
    {
      urlPattern: /^\/_next\/static\/.*/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-cache",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
        },
      },
    },
    // Fonts
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-cache",
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 año
        },
      },
    },
    // Firebase Storage - imágenes
    {
      urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "firebase-images-cache",
        expiration: {
          maxEntries: 1000,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
        },
      },
    },
    // Google Storage
    {
      urlPattern: /^https:\/\/storage\.googleapis\.com\/.*/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "google-storage-cache",
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 7 días
        },
      },
    },
    // APIs de Firestore - NetworkFirst con fallback
    {
      urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "firestore-api-cache",
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 5, // 5 minutos
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  output: "export", // Necesario para Firebase Hosting
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
    // Move secrets to environment variables; do NOT commit production keys.
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_FIREBASE_VAPID_KEY:
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    NEXT_PUBLIC_ENABLE_OFFLINE_MODE:
      process.env.NEXT_PUBLIC_ENABLE_OFFLINE_MODE,
    NEXT_PUBLIC_GPS_TIMEOUT:
      process.env.NEXT_PUBLIC_GPS_TIMEOUT,
    NEXT_PUBLIC_CAMERA_QUALITY:
      process.env.NEXT_PUBLIC_CAMERA_QUALITY,
  },
  
  // Configuración para forzar HTTPS en producción
  async redirects() {
    return [
      {
        source: '/(.*)',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://disbattery-trade.web.app',
        permanent: true,
      },
    ];
  },
  
};

// PWA habilitado con manejo mejorado de chunks
export default withPWA(nextConfig);
