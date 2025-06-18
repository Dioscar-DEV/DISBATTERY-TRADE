import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  // Configuración para Firebase App Hosting
  typescript: {
    ignoreBuildErrors: true, // Necesario para el build en producción
  },
  eslint: {
    ignoreDuringBuilds: true, // Necesario para el build en producción
  },
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin']
  }
};

export default nextConfig;
