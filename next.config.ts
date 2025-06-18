import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  // Configuración para Firebase App Hosting
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin']
  }
};

export default nextConfig;
