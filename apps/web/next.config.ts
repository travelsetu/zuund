import type { NextConfig } from 'next';

// In development the API is proxied same-origin so the httpOnly auth cookies
// work without CORS. In production NEXT_PUBLIC_API_BASE_URL points straight at
// api.zuund.com (same site as zuund.com, so cookies still flow).
const apiTarget = (process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_BASE_URL) return [];
    return [
      { source: '/api/:path*', destination: `${apiTarget}/api/:path*` },
      { source: '/uploads/:path*', destination: `${apiTarget}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
