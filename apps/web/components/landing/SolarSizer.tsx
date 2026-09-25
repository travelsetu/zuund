'use client';

import type { CarDto } from '@zuund/shared';
import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { appPostLink } from '@/lib/links';

/** Rough rules of thumb for much of India; the page says they are rough. */
const UNITS_PER_KW_MONTH = 120;
const SQFT_PER_KW = 100;

/** "3 kW" → 3; "10+ kW" → 11 (above 10). */
const kwOf = (c: CarDto) => {
  const n = parseFloat(c.model);
  return c.model.includes('+') ? n + 1 : n;
};

/** Monthly units → a rough system size, then straight into a Buying Post for it. */
export function SolarSizer({ items, hot }: { items: CarDto[]; hot: string[] }) {
  const sizes = useMemo(() => [...items].sort((a, b) => kwOf(a) - kwOf(b)), [items]);
  const [units, setUnits] = useState(360);
  const suggestedKw = Math.max(1, Math.ceil(units / UNITS_PER_KW_MONTH));
  const suggested = sizes.find((c) => kwOf(c) === suggestedKw) ?? sizes[sizes.length - 1] ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const current = sizes.find((c) => c.id === picked) ?? suggested;
  const hotSet = new Set(hot);
  if (!current) return null;
  const kw = kwOf(current);
  const above = current.model.includes('+');

  return (
    <div className="lp-sizer">
      <div className="lp-sizer-input">
        <label htmlFor="units" className="lp-sizer-label">
          Your usual electricity use
        </label>
        <output htmlFor="units" className="lp-sizer-value">
          {units >= 1500 ? '1,500+' : units.toLocaleString('en-IN')} <span>units a month</span>
        </output>
        <input
          id="units"
          type="range"
          min={60}
          max={1500}
          step={20}
          value={units}
          onChange={(e) => {
            setUnits(Number(e.target.value));
            setPicked(null);
          }}
          style={{ ['--p' as string]: `${((units - 60) / (1500 - 60)) * 100}%` }}
        />
        <div className="lp-sizer-scale muted small" aria-hidden>
          <span>60</span>
          <span>1,500+</span>
        </div>
        <p className="muted small">
          It&apos;s on your electricity bill. A rough guide: 1 kW makes around {UNITS_PER_KW_MONTH}{' '}
          units a month and needs about {SQFT_PER_KW} sq ft of shade-free roof. An installer&apos;s
          survey gives the real figure.
        </p>
      </div>

      <div className="lp-sizer-out">
        <div className="lp-sizes" role="radiogroup" aria-label="System size">
          {sizes.map((c) => {
            const on = c.id === current.id;
            return (
              <button
                key={c.id}
                role="radio"
                aria-checked={on}
                className={`lp-size${on ? ' on' : ''}${c.id === suggested?.id ? ' fit' : ''}`}
                onClick={() => setPicked(c.id)}
              >
                <span
                  className="lp-size-bar"
                  style={{ ['--k' as string]: Math.min(kwOf(c), 11) }}
                />
                {c.model.replace(' kW', '')}
                {hotSet.has(c.id) ? <span className="lp-dot" aria-label="In demand" /> : null}
              </button>
            );
          })}
        </div>
        <div className="lp-sizer-card">
          <div className="lp-sizer-kw">
            {current.model}
            {current.id === suggested?.id ? <span className="lp-fit">Fits your use</span> : null}
            {hotSet.has(current.id) ? <span className="lp-hot">In demand</span> : null}
          </div>
          <dl className="lp-facts">
            <div>
              <dt>Roof space</dt>
              <dd>
                {above
                  ? `${(10 * SQFT_PER_KW).toLocaleString('en-IN')}+ sq ft`
                  : `~${(kw * SQFT_PER_KW).toLocaleString('en-IN')} sq ft`}
              </dd>
            </div>
            <div>
              <dt>Makes roughly</dt>
              <dd>
                {above
                  ? `${(10 * UNITS_PER_KW_MONTH).toLocaleString('en-IN')}+ units/mo`
                  : `${(kw * UNITS_PER_KW_MONTH).toLocaleString('en-IN')} units/mo`}
              </dd>
            </div>
          </dl>
          <a className="btn lg lp-cta" href={appPostLink(current)}>
            Find neighbours installing {current.model}
            <Icon name="chevron" size={18} />
          </a>
        </div>
      </div>
    </div>
  );
}
