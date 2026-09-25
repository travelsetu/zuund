import type { ProductCategory } from '@zuund/shared';
import { VehicleArt } from '@/components/VehicleArt';

/** People gathering around the thing being bought: the idea of ZUUND in one picture. */
function Buyers({ spots }: { spots: Array<{ x: string; y: string; d: number; tone: 'a' | 'b' }> }) {
  return (
    <>
      {spots.map((s, i) => (
        <span
          key={i}
          className={`lp-buyer ${s.tone}`}
          style={{ left: s.x, top: s.y, animationDelay: `${s.d}s` }}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" width="55%" fill="currentColor">
            <circle cx="12" cy="8" r="4.2" />
            <path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z" />
          </svg>
        </span>
      ))}
    </>
  );
}

function SolarHouse() {
  const cells = [];
  // Two rows of panels laid along the roof slope.
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 4; c++)
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={0}
          y={0}
          width={40}
          height={22}
          rx={2}
          transform={`translate(${118 + c * 44 - r * 22} ${128 + r * 26}) skewX(-40)`}
          fill="url(#lp-panel)"
          stroke="#8fb0ff"
          strokeWidth={1}
        />,
      );
  return (
    <svg viewBox="0 0 400 300" width="100%" aria-hidden className="lp-art-svg">
      <defs>
        <linearGradient id="lp-panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a5bd7" />
          <stop offset="1" stopColor="#0d2a7a" />
        </linearGradient>
        <radialGradient id="lp-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd66b" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      <g className="lp-sun" style={{ transformOrigin: '320px 62px' }}>
        {Array.from({ length: 12 }, (_, i) => (
          <rect
            key={i}
            x={317}
            y={10}
            width={6}
            height={16}
            rx={3}
            fill="#ffc94a"
            opacity={0.7}
            transform={`rotate(${i * 30} 320 62)`}
          />
        ))}
      </g>
      <circle cx={320} cy={62} r={30} fill="url(#lp-sun)" />
      {/* House */}
      <ellipse cx={200} cy={282} rx={170} ry={8} fill="#000" opacity={0.25} />
      <path d="M70 180 L70 280 L330 280 L330 180 Z" fill="#e8eefb" />
      <path d="M52 188 L150 112 L348 112 L348 120 L250 196 Z" fill="#c9d6f2" />
      <path d="M52 188 L150 112 L250 196 L52 196 Z" fill="#dfe7f8" />
      <path d="M250 196 L348 120 L348 188 L330 188 L330 280 L250 280 Z" fill="#b8c8ec" />
      {cells}
      <rect x={100} y={216} width={44} height={64} rx={4} fill="#1650e0" />
      <rect x={172} y={220} width={48} height={36} rx={4} fill="#9fd0ff" />
      <rect x={272} y={214} width={36} height={30} rx={4} fill="#9fd0ff" opacity={0.8} />
    </svg>
  );
}

const PLANE =
  'M14 0 L-6 -8 L-3 -1 L-12 -1 L-15 -5 L-17 -5 L-15 0 L-17 5 L-15 5 L-12 1 L-3 1 L-6 8 Z';

function Journey() {
  return (
    <svg viewBox="0 0 400 300" width="100%" aria-hidden className="lp-art-svg">
      <defs>
        <radialGradient id="lp-globe" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#3b3aa8" />
          <stop offset="1" stopColor="#15124f" />
        </radialGradient>
      </defs>
      <circle cx={200} cy={170} r={120} fill="url(#lp-globe)" />
      <g fill="none" stroke="#8e7dff" strokeWidth={1} opacity={0.45}>
        <ellipse cx={200} cy={170} rx={120} ry={40} />
        <ellipse cx={200} cy={170} rx={120} ry={85} />
        <ellipse cx={200} cy={170} rx={45} ry={120} />
        <ellipse cx={200} cy={170} rx={90} ry={120} />
      </g>
      {/* Continents, loosely: shapes, not a map. */}
      <g fill="#6d4aff" opacity={0.9}>
        <path d="M150 105 q30 -18 55 0 q10 20 -8 34 q-20 10 -24 30 q-18 -6 -20 -26 q-14 -16 -3 -38z" />
        <path d="M232 150 q26 -8 40 10 q8 22 -10 40 q-18 16 -30 -4 q-12 -24 0 -46z" />
        <path d="M168 200 q14 -4 20 8 q2 16 -12 22 q-14 -6 -8 -30z" />
      </g>
      <path
        id="lp-route"
        d="M70 230 C 110 60, 290 30, 340 150"
        fill="none"
        stroke="#fff"
        strokeWidth={2.5}
        strokeDasharray="2 9"
        strokeLinecap="round"
        opacity={0.8}
      />
      <g className="lp-pin" transform="translate(70 230)">
        <circle r={9} fill="#0e9f5b" />
        <circle r={3.5} fill="#fff" />
      </g>
      <g className="lp-pin" transform="translate(340 150)">
        <circle r={9} fill="#ffb020" />
        <circle r={3.5} fill="#fff" />
      </g>
      <g className="lp-plane">
        <path d={PLANE} fill="#fff" />
        <animateMotion dur="7s" repeatCount="indefinite" rotate="auto">
          <mpath href="#lp-route" />
        </animateMotion>
      </g>
      {/* Without motion: the plane rests mid-route. */}
      <g className="lp-plane-still" transform="translate(205 72) rotate(8)">
        <path d={PLANE} fill="#fff" />
      </g>
    </svg>
  );
}

export function HeroArt({ category }: { category: ProductCategory }) {
  if (category === 'SOLAR')
    return (
      <div className="lp-art">
        <SolarHouse />
        <Buyers
          spots={[
            { x: '4%', y: '40%', d: 0, tone: 'a' },
            { x: '84%', y: '48%', d: 0.8, tone: 'b' },
            { x: '14%', y: '74%', d: 1.6, tone: 'b' },
          ]}
        />
      </div>
    );
  if (category === 'HOLIDAY')
    return (
      <div className="lp-art">
        <Journey />
        <Buyers
          spots={[
            { x: '2%', y: '56%', d: 0, tone: 'b' },
            { x: '12%', y: '82%', d: 0.9, tone: 'a' },
            { x: '86%', y: '30%', d: 1.7, tone: 'a' },
          ]}
        />
      </div>
    );
  return (
    <div className="lp-art lp-art-car">
      <VehicleArt hero width="100%" />
      <Buyers
        spots={[
          { x: '6%', y: '0%', d: 0, tone: 'a' },
          { x: '44%', y: '-14%', d: 0.7, tone: 'b' },
          { x: '82%', y: '2%', d: 1.4, tone: 'a' },
        ]}
      />
    </div>
  );
}
