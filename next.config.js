/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyA6Q_8LsOmui-Dcib-w5KD3CiJagTxFHoA",
    NEXT_PUBLIC_FIREBASE_VAPID_KEY: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "AIzaSyCs73uDqTGuoy2u0fnZgngTqRWhuyIU5l8",
    NEXT_PUBLIC_ENABLE_OFFLINE_MODE: process.env.NEXT_PUBLIC_ENABLE_OFFLINE_MODE || "true",
    NEXT_PUBLIC_GPS_TIMEOUT: process.env.NEXT_PUBLIC_GPS_TIMEOUT || "10000",
    NEXT_PUBLIC_CAMERA_QUALITY: process.env.NEXT_PUBLIC_CAMERA_QUALITY || "0.8",
  },
};

if (isProd) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  importScripts: ["sw-custom.js"],
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  // DESACTIVAR PWA EN DESARROLLO es la clave para evitar el error de chunks
  disable: process.env.NODE_ENV === "development",
  // Incluir todas las rutas HTML en el precache para offline
  publicExcludes: ["!*.map", "!*.txt"],
  additionalManifestEntries: [
    { url: "/mi-ruta/index.html", revision: null },
    { url: "/visit-capture/index.html", revision: null },
    { url: "/signage-capture/index.html", revision: null },
    { url: "/shell-merchandising/index.html", revision: null },
    { url: "/qualid-merchandising/index.html", revision: null },
    { url: "/observaciones/index.html", revision: null },
    { url: "/reportes-finales/index.html", revision: null },
    { url: "/ventas-productos/index.html", revision: null },
    { url: "/trade-eventos/index.html", revision: null },
    { url: "/trade-impulso/index.html", revision: null },
    { url: "/shell-material-interno/index.html", revision: null },
    { url: "/registro-exitoso/index.html", revision: null },
    { url: "/instalar/index.html", revision: null },
    { url: "/index.html", revision: null },
  ], 
  fallbacks: {
    document: "/offline.html",
    // fallback para chunks JS (si falla la carga de un chunk)
    // chunk: "/offline.html", // no estándar, pero document cubre navegación
    // Fallback para rutas dinámicas
    // Se recomienda precachear rutas base y usar NetworkFirst para navigate
  },
  buildExcludes: [
    /middleware-manifest\.json$/,
    /.*\.txt$/,
    /.*\.map$/,
    // Excluimos manifiestos que cambian en cada build
    /^.*build-manifest\.json$/,
    /^.*react-loadable-manifest\.json$/,
  ],
  runtimeCaching: [
    {
      // Páginas: NetworkFirst para rutas SPA, incluyendo rutas dinámicas
      urlPattern: /\/visit-capture.*|\/signage-capture.*|\/shell-merchandising.*|\/qualid-merchandising.*|\/observaciones.*|\/reportes-finales.*|\/ventas-productos.*|\/trade-eventos.*|\/trade-impulso.*|\/shell-material-interno.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "pages-cache",
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
        networkTimeoutSeconds: 10,
        // fallback a offline.html si falla
        plugins: [
          {
            handlerDidError: async () => fetch("/offline.html")
          }
        ]
      },
    },
    {
      // Páginas: CacheFirst para servir inmediatamente desde precache offline
      // Esto permite navegación instantánea sin esperar timeout de red
      urlPattern: ({ request }) => request.mode === "navigate",
      handler: "CacheFirst",
      options: {
        cacheName: "pages-cache",
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
    {
      // CHUNKS: CacheFirst para servir inmediatamente desde precache/cache offline
      // Esto evita "Failed to load chunk" cuando offline
      urlPattern: /^\/_next\/static\/chunks\/.*\.js$/,
      handler: "CacheFirst",
      options: {
        cacheName: "next-chunks",
        expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
      },
    },
    {
      // Recursos estáticos generales
      urlPattern: /^\/_next\/static\/.*$/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "static-assets",
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts",
        expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
    {
      urlPattern: /^https:\/\/(?:firebasestorage|storage)\.googleapis\.com\/.*$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "cloud-storage-cache",
        expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ],
});

module.exports = withPWA(nextConfig);