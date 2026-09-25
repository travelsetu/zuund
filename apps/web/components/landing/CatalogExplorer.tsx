'use client';

import type { BrandDto, CarDto } from '@zuund/shared';
import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { VehicleArt } from '@/components/VehicleArt';
import { SUPPORT_EMAIL, appPostLink, appSearchLink } from '@/lib/links';

/** The brands most Indian buyers start from (same as the app). */
const POPULAR_BRANDS = ['Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'Kia', 'Toyota'];

/** Chips in the order people think of them (same as the app); the rest alphabetically. */
const SEGMENT_ORDER = [
  'SUV',
  'Hatchback',
  'Sedan',
  'MUV',
  'EV',
  'North India',
  'South India',
  'West India',
  'East & North-East',
  'Central India',
  'Islands',
  'Southeast Asia',
  'Middle East',
  'Indian Ocean',
  'South Asia',
  'East Asia',
  'Europe',
];
const bySegmentOrder = (a: string, b: string) =>
  (SEGMENT_ORDER.indexOf(a) + 1 || 99) - (SEGMENT_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b);

const FIRST_PAGE = 12;

/** A calm tint per region, so destination cards read as places without photos. */
function regionHue(segment: string | null) {
  let h = 0;
  for (const ch of segment ?? '') h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/**
 * Browse the whole catalog of a category and jump into the app with one pick.
 * Cars: brand → body type → model. Holidays: Domestic/International → region → destination.
 */
export function CatalogExplorer({
  mode,
  items,
  brands,
  hot,
}: {
  mode: 'car' | 'holiday';
  items: CarDto[];
  brands: BrandDto[];
  /** Ids of the most-wanted items right now. */
  hot: string[];
}) {
  const holiday = mode === 'holiday';
  const [brand, setBrand] = useState<string | null>(holiday ? (brands[0]?.name ?? null) : null);
  const [segment, setSegment] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const hotSet = useMemo(() => new Set(hot), [hot]);

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  // Typing searches every car brand (like the app); a holiday search stays in its trip type.
  const scoped = items.filter((c) => (words.length && !holiday) || !brand || c.brand === brand);
  const segments = useMemo(
    () =>
      [...new Set(scoped.map((c) => c.segment).filter((s): s is string => !!s))].sort(
        bySegmentOrder,
      ),
    [scoped],
  );
  const shown = scoped
    .filter((c) => !segment || c.segment === segment)
    .filter((c) => {
      const hay = `${c.displayName} ${c.brand} ${c.model}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    // Most-wanted first, then the catalog's order.
    .sort((a, b) => Number(hotSet.has(b.id)) - Number(hotSet.has(a.id)));
  const visible = all ? shown : shown.slice(0, FIRST_PAGE);

  const pickBrand = (name: string | null) => {
    setBrand(name);
    setSegment(null);
    setAll(false);
  };

  const popular = POPULAR_BRANDS.filter((b) => brands.some((x) => x.name === b));
  const others = brands.filter((b) => !popular.includes(b.name));

  return (
    <div className="lp-explorer">
      <div className="lp-controls">
        {holiday ? (
          <div className="lp-tabs" role="tablist" aria-label="Trip type">
            {brands.map((b) => (
              <button
                key={b.name}
                role="tab"
                aria-selected={brand === b.name}
                className={brand === b.name ? 'on' : ''}
                onClick={() => pickBrand(b.name)}
              >
                {b.name}
                <span className="lp-count">{b.count}</span>
              </button>
            ))}
          </div>
        ) : null}
        <label className="lp-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setAll(false);
            }}
            placeholder={
              holiday
                ? brand === 'International'
                  ? 'Search a destination, e.g. Bali'
                  : 'Search a destination, e.g. Goa'
                : 'Search a model, e.g. Creta'
            }
            aria-label={holiday ? 'Search destinations' : 'Search models'}
          />
        </label>
      </div>

      {holiday ? null : (
        <div className="lp-chips" aria-label="Brands">
          <button className={!brand ? 'chip on' : 'chip'} onClick={() => pickBrand(null)}>
            All brands
          </button>
          {popular.map((b) => (
            <button
              key={b}
              className={brand === b ? 'chip on' : 'chip'}
              onClick={() => pickBrand(brand === b ? null : b)}
            >
              {b}
            </button>
          ))}
          <select
            className={brand && !popular.includes(brand) ? 'chip on' : 'chip'}
            value={brand && !popular.includes(brand) ? brand : ''}
            onChange={(e) => pickBrand(e.target.value || null)}
            aria-label="More brands"
          >
            <option value="">More brands…</option>
            {others.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name} ({b.count})
              </option>
            ))}
          </select>
        </div>
      )}

      {segments.length > 1 ? (
        <div className="lp-chips soft" aria-label={holiday ? 'Regions' : 'Body types'}>
          <button className={!segment ? 'chip on' : 'chip'} onClick={() => setSegment(null)}>
            {holiday ? 'All regions' : 'All types'}
          </button>
          {segments.map((s) => (
            <button
              key={s}
              className={segment === s ? 'chip on' : 'chip'}
              onClick={() => {
                setSegment(segment === s ? null : s);
                setAll(false);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <p className="lp-result-line muted small" aria-live="polite">
        {shown.length === 0
          ? 'Nothing matches that.'
          : `${shown.length} ${holiday ? (shown.length === 1 ? 'destination' : 'destinations') : shown.length === 1 ? 'model' : 'models'}${brand && !(words.length && !holiday) ? ` · ${brand}` : ''}${segment ? ` · ${segment}` : ''}`}
      </p>

      {shown.length === 0 ? (
        <div className="lp-empty">
          <p>
            Can&apos;t find yours? Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{' '}
            and we&apos;ll add it.
          </p>
        </div>
      ) : (
        <ul className="lp-grid">
          {visible.map((c) => (
            <li key={c.id}>
              <a className="lp-item" href={appPostLink(c)}>
                {holiday ? (
                  <span
                    className="lp-item-art place"
                    style={{ ['--h' as string]: regionHue(c.segment) }}
                    aria-hidden
                  >
                    <Icon name="pin" size={18} />
                    <span className="lp-place-name">{c.model}</span>
                  </span>
                ) : (
                  <span className="lp-item-art" aria-hidden>
                    <VehicleArt segment={c.segment} width="82%" />
                  </span>
                )}
                <span className="lp-item-body">
                  <span className="lp-item-top">
                    <span className="muted small">{holiday ? c.segment : c.brand}</span>
                    {hotSet.has(c.id) ? <span className="lp-hot">In demand</span> : null}
                  </span>
                  {holiday ? null : <span className="lp-item-name">{c.model}</span>}
                  <span className="lp-item-meta">
                    {holiday ? c.brand : c.segment}
                    <span className="lp-item-go">
                      {holiday ? 'I’m going' : 'I’m buying this'}
                      <Icon name="chevron" size={16} />
                    </span>
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="lp-explorer-foot">
        {shown.length > FIRST_PAGE && !all ? (
          <button className="btn ghost" onClick={() => setAll(true)}>
            Show all {shown.length}
          </button>
        ) : null}
        <a
          className="lp-inline-link"
          href={appSearchLink(holiday ? 'HOLIDAY' : 'CAR', brand ?? undefined)}
        >
          Open {brand ?? (holiday ? 'destinations' : 'all brands')} in the app
          <Icon name="chevron" size={16} />
        </a>
      </div>
    </div>
  );
}
