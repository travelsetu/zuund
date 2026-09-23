import type { NextConfig } from 'next';

/**
 * zuund.com is the marketing site; the product is the Expo app served at
 * app.zuund.com (web) and in the iOS/Android apps. Old product URLs from the
 * previous web app redirect to the same screen in the app, so links in emails
 * and notifications keep working.
 */
const app = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.zuund.com').replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    const to = (source: string, path: string) => ({
      source,
      destination: `${app}${path}`,
      permanent: false,
    });
    return [
      to('/login', '/login'),
      to('/register', '/register'),
      to('/posts', '/my-posts'),
      to('/posts/new', '/search'),
      to('/posts/:id/pay/success', '/posts/:id/success'),
      to('/posts/:id/pay/failed', '/posts/:id/failed'),
      to('/posts/:id/pay', '/posts/:id/pay'),
      to('/posts/:id', '/posts/:id'),
      to('/collectives/:path*', '/collectives/:path*'),
      to('/buyers/:id', '/users/:id'),
      to('/messages/:path*', '/messages/:path*'),
      to('/connections', '/connections'),
      to('/notifications', '/notifications'),
      to('/profile', '/profile'),
      to('/settings', '/settings'),
    ];
  },
};

export default nextConfig;
