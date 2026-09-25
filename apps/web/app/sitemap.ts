import type { MetadataRoute } from 'next';
import { CATEGORY_PAGES } from '@/lib/categories';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://zuund.com';
  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    ...CATEGORY_PAGES.map((c) => ({
      url: `${base}/${c.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
