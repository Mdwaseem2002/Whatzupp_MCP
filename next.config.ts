import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable Server Components (default in Next.js 13+)
  reactStrictMode: true,

  // Pin the Turbopack root to this project directory
  turbopack: {
    root: __dirname,
  },
  
  // Images configuration (using remotePatterns instead of deprecated domains)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.whatsapp.com',
      },
    ],
  },
  
  // Environment variables that will be available to the browser
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  
  // API and webhook endpoints should be serverless functions
  async headers() {
    return [
      {
        // SFMC Journey Builder needs CORS + iframe access for custom activities
        source: '/jb-activity/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://*.exacttarget.com https://*.marketingcloudapps.com https://*.salesforce.com" },
        ],
      },
      {
        // SFMC also calls the JB API routes cross-origin
        source: '/api/jb/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      {
        // Allow cross-origin access for all API routes (e.g. from Salesforce LWC)
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With, bypass-tunnel-reminder, Bypass-Tunnel-Reminder, x-workspace-key, X-Workspace-Key, *' },
        ],
      },
      {
        // General security headers for all other routes
        source: '/((?!jb-activity|api/.*).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://*.exacttarget.com https://*.marketingcloudapps.com https://*.salesforce.com" },
        ],
      },
    ];
  },
};

export default nextConfig;