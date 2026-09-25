import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CategoryLanding } from '@/components/landing/CategoryLanding';
import { CATEGORY_PAGES, categoryPage } from '@/lib/categories';

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

export default async function CategoryRoute({ params }: Props) {
  const page = categoryPage((await params).category);
  if (!page) notFound();
  return <CategoryLanding page={page} />;
}
