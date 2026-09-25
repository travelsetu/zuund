import type { CategoryOverviewDto, ProductCategory } from '@zuund/shared';

/** The API, read at build time and when a page revalidates. */
const API_URL = (process.env.ZUUND_API_URL || 'https://api.zuund.com').replace(/\/$/, '');

/** How often a category page picks up new models and live demand. */
export const LANDING_REVALIDATE_SECONDS = 600;

/**
 * A category's catalog and live demand. Null when the API can't be reached, so a
 * build never fails over it: the page renders its evergreen content and fills in
 * on the next revalidation.
 */
export async function categoryOverview(
  category: ProductCategory,
): Promise<CategoryOverviewDto | null> {
  try {
    const res = await fetch(`${API_URL}/api/catalog/overview?category=${category}`, {
      next: { revalidate: LANDING_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as CategoryOverviewDto;
  } catch {
    return null;
  }
}
