/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : 'https://api.dacroq.net',
    NEXT_PUBLIC_API_URL: process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : 'https://api.dacroq.net',
  },
  async rewrites() {
    const apiBaseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : 'https://api.dacroq.net';
    
    return [
      {
        // Proxy API routes to backend
        source: '/api/proxy/:path*',
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  }
};

module.exports = nextConfig;