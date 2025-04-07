import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // redirects: async () => {
  //   return [
  //     {
  //       source: "/",
  //       destination: "/login",
  //       permanent: true,
  //     },
  //   ]
  // },
  
  // Disable ESLint during builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript type checking during builds
  typescript: {
    // This allows production builds to succeed even with TypeScript errors
    ignoreBuildErrors: true,
  }
}

export default nextConfig