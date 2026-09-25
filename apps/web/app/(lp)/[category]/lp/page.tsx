import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LandingHeader, SiteFooter } from '@/components/SiteChrome';
import { CategoryLanding } from '@/components/landing/CategoryLanding';
import { CATEGORY_PAGES, categoryPage } from '@/lib/categories';
import { appSearchLink } from '@/lib/links';

/**
 * /<category>/lp: the category page for ads and campaigns. Same content; the header
 * keeps only "Get started", straight into the app's picker for the category.
 */
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
    // A copy of /<category> for campaigns: search engines should list the original.
    alternates: { canonical: `/${page.slug}` },
    robots: { index: false, follow: true },
  };
}

export default async function CategoryAdRoute({ params }: Props) {
  const page = categoryPage((await params).category);
  if (!page) notFound();
  return (
    <>
      <LandingHeader cta={appSearchLink(page.category)} />
      <main>
        <CategoryLanding page={page} />
      </main>
      <SiteFooter />
    </>
  );
}
