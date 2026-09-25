import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { SUPPORT_EMAIL, appLink } from '@/lib/links';

/** The marketing site's header: every page but the ad landing pages (/<category>/lp). */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap row-between">
        <Link href="/" aria-label="ZUUND home">
          <Logo size={26} />
        </Link>
        <nav className="site-nav" aria-label="Main">
          <Link href="/cars" className="hide-md">
            Cars
          </Link>
          <Link href="/solar" className="hide-md">
            Solar
          </Link>
          <Link href="/holidays" className="hide-md">
            Holidays
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
  );
}

/**
 * Ad landing pages: the logo (not a link) and one button, so every click leads into the app.
 */
export function LandingHeader({ cta }: { cta: string }) {
  return (
    <header className="site-header">
      <div className="wrap row-between">
        <Logo size={26} />
        <nav className="site-nav" aria-label="Main">
          <a href={cta} className="btn">
            Get started
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
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
          <Link href="/cars">Cars</Link>
          <Link href="/solar">Rooftop solar</Link>
          <Link href="/holidays">Holiday packages</Link>
          <Link href="/about">About</Link>
          <a href={appLink('/login')}>Log in</a>
          <a href={appLink('/register')}>Create an account</a>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </nav>
      </div>
      <div className="wrap small muted" style={{ marginTop: 32 }}>
        © {new Date().getFullYear()} ZUUND. City data from GeoNames (CC BY 4.0).{' '}
        <a href="https://db-ip.com">IP Geolocation by DB-IP</a> (CC BY 4.0).
      </div>
    </footer>
  );
}
