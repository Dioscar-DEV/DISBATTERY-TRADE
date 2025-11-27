/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Configuración vacía de turbopack para silenciar el warning
  turbopack: {},
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyA6Q_8LsOmui-Dcib-w5KD3CiJagTxFHoA",
    NEXT_PUBLIC_FIREBASE_VAPID_KEY: 
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "AIzaSyCs73uDqTGuoy2u0fnZgngTqRWhuyIU5l8",
    NEXT_PUBLIC_ENABLE_OFFLINE_MODE:
      process.env.NEXT_PUBLIC_ENABLE_OFFLINE_MODE || "true",
    NEXT_PUBLIC_GPS_TIMEOUT: process.env.NEXT_PUBLIC_GPS_TIMEOUT || "10000",
    NEXT_PUBLIC_CAMERA_QUALITY: process.env.NEXT_PUBLIC_CAMERA_QUALITY || "0.8",
  },
};



if (isProd) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.redirects = async () => [
    {
      source: "/(.*)",
      has: [
        {
          type: "header",
          key: "x-forwarded-proto",
          value: "http",
        },
      ],
      destination: "https://disbattery-trade.web.app",
      permanent: true,
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const withPWA = require("next-pwa")({
  dest: "public",
  register: false,
  skipWaiting: true,
  disable: false, // Habilitar PWA en desarrollo para probar offline
  // fallbacks: {
  //   document: "/offline.html",
  // },
  publicExcludes: ["!offline.html"],
  buildExcludes: [
    /middleware-manifest\.json$/,
    /.*\.txt$/,
    /.*\.map$/,
  ],
  runtimeCaching: [
    {
      urlPattern: ({ request, url }) => {
        return request.mode === "navigate" && !url.pathname.endsWith(".txt");
      },
      handler: "StaleWhileRevalidate", // Cambiado de NetworkFirst a StaleWhileRevalidate para offline-first
      options: {
        cacheName: "all-pages",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    {
      urlPattern: /^\/_next\/static\/chunks\/.*$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "next-chunks",
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 300,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
      },
    },
    {
      urlPattern: /^\/_next\/static\/.*$/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-cache",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-cache",
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365,
        },
      },
    },
    {
      urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "firebase-images-cache",
        expiration: {
          maxEntries: 1000,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    {
      urlPattern: /^https:\/\/storage\.googleapis\.com\/.*$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "google-storage-cache",
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
      },
    },
    {
      urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*$/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "firestore-api-cache",
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 5,
        },
      },
    },
  ],
});

module.exports = withPWA(nextConfig);
