/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://dacroq-api.bendatsko.com',
    NEXT_PUBLIC_API_URL_PRODUCTION: process.env.NEXT_PUBLIC_API_URL_PRODUCTION || 'https://dacroq-api.bendatsko.com',
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://dacroq-api.bendatsko.com';
    return [
      {
        // First, handle internal proxy routes without rewrites
        source: '/api/proxy/:path*',
        destination: '/api/proxy/:path*',
      },
      {
        // Rewrite other API routes to external API (without adding another /api)
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
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