/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_BASE_URL: 'https://api.dacroq.net',
    NEXT_PUBLIC_API_URL: 'https://api.dacroq.net',
    NEXT_PUBLIC_API_URL_PRODUCTION: 'https://api.dacroq.net',
  },
  async rewrites() {
    return [
      {
        // First, handle internal proxy routes without rewrites
        source: '/api/proxy/:path*',
        destination: '/api/proxy/:path*',
      },
      {
        // Rewrite other API routes to external API (without adding another /api)
        source: '/api/:path*',
        destination: 'https://api.dacroq.net/:path*',
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