import type { Metadata, Viewport } from 'next';
import { Schibsted_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

// One typeface for the whole product, the same as the app.
const sans = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'ZUUND — buy alongside people who want the same thing',
    template: '%s · ZUUND',
  },
  description:
    'Tell us the car or rooftop solar system you plan to buy. Meet the real people in your city buying the same, and decide together.',
  metadataBase: new URL('https://zuund.com'),
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0a1e4f' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
