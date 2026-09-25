import {
  ELITE_PASS_AMOUNT_PAISE,
  ELITE_PASS_DAYS,
  FREE_PASS_DAYS,
  type CarDto,
  type CategoryOverviewDto,
} from '@zuund/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { ProductArt } from '@/components/ProductArt';
import { CatalogExplorer } from '@/components/landing/CatalogExplorer';
import { CountUp } from '@/components/landing/CountUp';
import { HeroArt } from '@/components/landing/HeroArt';
import { SolarSizer } from '@/components/landing/SolarSizer';
import { categoryOverview } from '@/lib/api';
import { CATEGORY_PAGES, categoryPage, type CategoryPage } from '@/lib/categories';
import { appLink, appPostLink, appSearchLink } from '@/lib/links';

// Must be a literal for Next; the same value as LANDING_REVALIDATE_SECONDS.
export const revalidate = 600;
export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORY_PAGES.map((c) => ({ category: c.slug }));
}

type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = categoryPage((await params).category);
  if (!page) return {};
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      title: `${page.metaTitle} · ZUUND`,
      description: page.metaDescription,
      url: `/${page.slug}`,
      siteName: 'ZUUND',
      type: 'website',
    },
  };
}

/** Headline numbers from the catalog itself, true on day one. */
function catalogFacts(page: CategoryPage, o: CategoryOverviewDto | null) {
  if (!o) return [];
  const segments = new Set(o.items.map((c) => c.segment).filter(Boolean));
  if (page.category === 'CAR')
    return [
      { n: o.items.length, label: 'models to choose from' },
      { n: o.brands.length, label: 'brands, everyday to exotic' },
      { n: o.items.filter((c) => c.segment === 'EV').length, label: 'electric models' },
    ];
  if (page.category === 'SOLAR')
    return [
      { n: o.items.length, label: 'system sizes, 1 kW to 10+ kW' },
      { n: 0, label: 'installers or sellers inside' },
      { n: 0, label: 'rupees to post' },
    ];
  const count = (b: string) => o.brands.find((x) => x.name === b)?.count ?? 0;
  return [
    { n: o.items.length, label: 'destinations' },
    { n: count('Domestic'), label: 'across India' },
    { n: count('International'), label: 'abroad, from India' },
    { n: segments.size, label: 'regions' },
  ];
}

export default async function CategoryLanding({ params }: Props) {
  const page = categoryPage((await params).category);
  if (!page) notFound();
  const overview = await categoryOverview(page.category);
  const demand = overview?.demand ?? null;
  const byId = new Map((overview?.items ?? []).map((c) => [c.id, c]));
  const topItems = (demand?.topItems ?? [])
    .map((t) => ({ ...t, item: byId.get(t.carId) }))
    .filter((t): t is typeof t & { item: CarDto } => !!t.item);
  const hot = topItems.map((t) => t.item.id);
  const facts = catalogFacts(page, overview);
  const others = CATEGORY_PAGES.filter((c) => c.slug !== page.slug);
  const kind = page.category.toLowerCase();

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className={`lp lp-${kind}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      <section className="lp-hero">
        <div className="lp-glow" aria-hidden />
        <div className="wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">
              <span className="lp-live-dot" aria-hidden />
              {page.eyebrow}
            </p>
            <h1>
              {page.title[0]}
              <br />
              <span className="lp-accent-text">{page.title[1]}</span>
            </h1>
            <p className="lead">{page.lead}</p>
            <div className="cta-row">
              <a href={appSearchLink(page.category)} className="btn light lg">
                {page.cta}
                <Icon name="chevron" size={18} />
              </a>
              <a href="#explore" className="link-light">
                Browse every {page.itemNoun}
              </a>
            </div>
            {demand ? (
              <p className="lp-pulse">
                <span className="lp-live-dot" aria-hidden />
                <span>
                  <strong>{demand.buyers.toLocaleString('en-IN')}</strong> people buying {page.noun}{' '}
                  right now, in {demand.cities.toLocaleString('en-IN')}{' '}
                  {demand.cities === 1 ? 'city' : 'cities'}
                  {demand.newThisWeek > 0
                    ? ` · ${demand.newThisWeek.toLocaleString('en-IN')} new this week`
                    : ''}
                </span>
              </p>
            ) : (
              <p className="lp-pulse">
                <Icon name="check" size={16} />
                <span>Free to post · Buyers only · Your number stays private</span>
              </p>
            )}
          </div>
          <HeroArt category={page.category} />
        </div>
      </section>

      {facts.length ? (
        <section className="lp-facts-band" aria-label={`${page.eyebrow} in numbers`}>
          <div className="wrap lp-facts-row">
            {facts.map((f) => (
              <div key={f.label} className="lp-fact">
                <span className="lp-fact-n">
                  <CountUp value={f.n} />
                </span>
                <span className="muted small">{f.label}</span>
              </div>
            ))}
            {demand ? (
              <div className="lp-fact live">
                <span className="lp-fact-n">
                  <CountUp value={demand.buyers} />
                </span>
                <span className="muted small">people buying now</span>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section id="explore" className="section">
        <div className="wrap">
          <div className="lp-section-head">
            <h2 className="section-title">{page.explorerTitle}</h2>
            <p className="lead muted">{page.explorerLead}</p>
          </div>
          {!overview ? (
            <div className="lp-empty">
              <p>
                <a href={appSearchLink(page.category)}>Open the full list in the app</a>.
              </p>
            </div>
          ) : page.category === 'SOLAR' ? (
            <SolarSizer items={overview.items} hot={hot} />
          ) : (
            <CatalogExplorer
              mode={page.category === 'HOLIDAY' ? 'holiday' : 'car'}
              items={overview.items}
              brands={overview.brands}
              hot={hot}
            />
          )}
        </div>
      </section>

      {topItems.length || demand?.topCities.length ? (
        <section className="section tint">
          <div className="wrap lp-wanted">
            {topItems.length ? (
              <div>
                <h2 className="section-title">Most wanted right now</h2>
                <ol className="lp-rank">
                  {topItems.map((t, i) => (
                    <li key={t.carId}>
                      <a href={appPostLink(t.item)}>
                        <span className="lp-rank-n">{i + 1}</span>
                        <ProductArt car={t.item} size="sm" />
                        <span className="lp-rank-name">
                          {t.item.displayName.replace(/ Holiday Package$/, '')}
                          <span
                            className="lp-rank-bar"
                            style={{
                              ['--w' as string]: `${(t.buyers / topItems[0]!.buyers) * 100}%`,
                            }}
                          />
                        </span>
                        <span className="lp-rank-count">
                          {t.buyers} <span className="muted small">buyers</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {demand?.topCities.length ? (
              <div>
                <h2 className="section-title">Busiest cities</h2>
                <ul className="lp-cities">
                  {demand.topCities.map((c) => (
                    <li key={c.name}>
                      <Icon name="pin" size={16} />
                      {c.name}
                      <span className="muted small">{c.buyers}</span>
                    </li>
                  ))}
                </ul>
                <p className="muted small">
                  Counts are people with an active Buying Post. Places with fewer than 3 are not
                  shown.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="wrap">
          <h2 className="section-title">What people do together</h2>
          <div className="lp-together">
            {page.together.map((t) => (
              <div key={t.title} className="lp-card">
                <span className="lp-card-icon">
                  <Icon name={t.icon} size={22} />
                </span>
                <h3>{t.title}</h3>
                <p className="muted">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section tint">
        <div className="wrap">
          <h2 className="section-title">Three steps, about a minute</h2>
          <ol className="lp-steps">
            {page.steps.map((s, i) => (
              <li key={s}>
                <span className="lp-step-n" aria-hidden>
                  {i + 1}
                </span>
                <p>{s}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2 className="section-title">Posting is free. Pick a pass when you join.</h2>
          <div className="lp-passes">
            <div className="lp-pass">
              <p className="lp-pass-name">Free Pass</p>
              <p className="lp-price">
                ₹0 <span className="muted small">for {FREE_PASS_DAYS} days</span>
              </p>
              <ul>
                <li>See who is buying the same, in your city</li>
                <li>Join the collective: discussion, polls, files</li>
                <li>Connect with other buyers</li>
              </ul>
              <a href={appSearchLink(page.category)} className="btn ghost">
                Start free
              </a>
            </div>
            <div className="lp-pass elite">
              <p className="lp-pass-name">
                Elite Pass <span aria-hidden>👑</span>
              </p>
              <p className="lp-price">
                ₹{ELITE_PASS_AMOUNT_PAISE / 100}{' '}
                <span className="muted small">for {ELITE_PASS_DAYS} days, every Buying Post</span>
              </p>
              <ul>
                <li>Buyer details, filters and match scores</li>
                <li>Buyers within 5, 10 or 25 km</li>
                <li>More connections and direct messages</li>
                <li>The Live Buyer Pulse</li>
              </ul>
              <a href={appSearchLink(page.category)} className="btn">
                Get started
              </a>
            </div>
          </div>
          <p className="muted small lp-note">Passes never renew on their own.</p>
        </div>
      </section>

      <section className="section tint">
        <div className="wrap lp-faq-wrap">
          <h2 className="section-title">Questions</h2>
          <div className="lp-faq">
            {page.faq.map((f, i) => (
              <details key={f.q} open={i === 0}>
                <summary>
                  {f.q}
                  <Icon name="plus" size={18} />
                </summary>
                <p className="muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="closing lp-closing">
            <div className="lp-glow" aria-hidden />
            <h2>{page.title[0]}</h2>
            <p className="lead">
              {demand
                ? `${demand.buyers.toLocaleString('en-IN')} people are already comparing notes. Add yours.`
                : 'Be one of the first in your city. The earlier you post, the sooner others find you.'}
            </p>
            <div className="cta-row lp-closing-ctas">
              <a href={appSearchLink(page.category)} className="btn light lg">
                {page.cta}
                <Icon name="chevron" size={18} />
              </a>
              <a href={appLink('/login')} className="link-light">
                I already have an account
              </a>
            </div>
          </div>

          <div className="lp-others">
            <p className="muted small">Also buying together on ZUUND</p>
            <div className="cats">
              {others.map((o) => (
                <Link key={o.slug} href={`/${o.slug}`} className="cat">
                  <ProductArt car={{ category: o.category, imageUrl: null }} size="md" />
                  <div>
                    <h3>{o.eyebrow.replace(' on ZUUND', '')}</h3>
                    <p className="muted small">{o.title.join(' ')}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
