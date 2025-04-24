/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://medusa.bendatsko.com',
    NEXT_PUBLIC_API_URL_PRODUCTION: process.env.NEXT_PUBLIC_API_URL_PRODUCTION || 'https://medusa.bendatsko.com',
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://medusa.bendatsko.com';
    return [
      {
        // First, handle internal proxy routes without rewrites
        source: '/api/proxy/:path*',
        destination: '/api/proxy/:path*',
      },
      {
        // Rewrite other API routes to external API
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: true, // Temporarily ignore build errors
  },
  eslint: {
    ignoreDuringBuilds: true, // Temporarily ignore ESLint errors during build
  }
};

module.exports = nextConfig;