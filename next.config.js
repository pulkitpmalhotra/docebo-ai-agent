/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Disable server components optimization that might cause issues
    serverComponentsExternalPackages: ['@google/generative-ai']
  },
  typescript: {
    // Don't fail build on TypeScript errors during deployment
    ignoreBuildErrors: false,
  },
  eslint: {
    // Don't fail build on ESLint errors during deployment  
    ignoreDuringBuilds: true,
  },
  // Optimize for deployment
  swcMinify: true,
  // Environment variables that should be available on client side
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  // Headers for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ]
      }
    ]
  }
}

module.exports = nextConfig
