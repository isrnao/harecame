import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enable the React Compiler (stable in React 19)
    reactCompiler: true,
    // Enable optimized package imports
    optimizePackageImports: ['@livekit/components-react', 'lucide-react'],
  },

  outputFileTracingRoot: process.cwd(),

  // Next.js 15: Pages Router も一括バンドル
  bundlePagesRouterDependencies: true,

  // Next.js 15: Node.js ネイティブ機能を使う SDK だけ除外
  serverExternalPackages: ['livekit-server-sdk', 'aws-sdk'],

  // Performance optimizations
  compiler: {
    // The LiveKit recorder uses START_RECORDING/END_RECORDING console signals.
    removeConsole: false,
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    // Allow data URLs for QR codes and other dynamically generated images
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Configure domains for external images if needed
    domains: [],
    // Configure remote patterns for external images
    remotePatterns: [
      // Add patterns for external image sources if needed in the future
    ],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Image sizes for different breakpoints
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Enable TypeScript strict mode
  typescript: {
    ignoreBuildErrors: false,
  },

  // Configure for React 19.1.0
  reactStrictMode: true,

  // Headers for performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store',
          },
        ],
      },
    ];
  },
};

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true', openAnalyzer: false,
});
export default withBundleAnalyzer(nextConfig);
