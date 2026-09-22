import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Nav } from '@/components/Nav';
import { AuthProvider } from '@/lib/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'zuund',
  description: 'Find other people who want to buy the same car as you.',
  metadataBase: new URL('https://zuund.com'),
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Nav />
          <main className="container">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
