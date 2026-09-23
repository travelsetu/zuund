import type { Metadata, Viewport } from 'next';
import { Schibsted_Grotesk } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { SUPPORT_EMAIL, appLink } from '@/lib/links';
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
      <body>
        <header className="site-header">
          <div className="wrap row-between">
            <Link href="/" aria-label="ZUUND home">
              <Logo size={26} />
            </Link>
            <nav className="site-nav" aria-label="Main">
              <Link href="/#how-it-works" className="hide-sm">
                How it works
              </Link>
              <Link href="/about" className="hide-sm">
                About
              </Link>
              <a href={appLink('/login')}>Log in</a>
              <a href={appLink('/register')} className="btn">
                Get started
              </a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="wrap footer-grid">
            <div className="stack-sm">
              <Logo size={22} />
              <p className="muted small">
                Buy alongside people who want the same thing. Each member decides and buys for
                themselves.
              </p>
            </div>
            <nav className="stack-sm small" aria-label="Footer">
              <Link href="/about">About</Link>
              <a href={appLink('/login')}>Log in</a>
              <a href={appLink('/register')}>Create an account</a>
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </nav>
          </div>
          <div className="wrap small muted" style={{ marginTop: 32 }}>
            © {new Date().getFullYear()} ZUUND. City data from GeoNames (CC BY 4.0).
          </div>
        </footer>
      </body>
    </html>
  );
}
