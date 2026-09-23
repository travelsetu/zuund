import { useId } from 'react';

/**
 * The ZUUND wordmark (brand/zuund-logo.svg): navy Z·N·D, and two U's drawn as
 * people — a blue and a green buyer, together. `size` ≈ letter height in px.
 */
export function Logo({ size = 28, light }: { size?: number; light?: boolean }) {
  const id = useId().replace(/:/g, '');
  const height = size * 1.5;
  const ink = light ? '#FFFFFF' : '#071833';
  return (
    <svg
      viewBox="0 0 1010 268"
      height={height}
      width={(height * 1010) / 268}
      role="img"
      aria-label="ZUUND"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#48A8F7" />
          <stop offset="1" stopColor="#2D5EE6" />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6CCD60" />
          <stop offset="1" stopColor="#3BA048" />
        </linearGradient>
      </defs>
      <g transform="translate(-80 -95)">
        <g fill={ink} stroke={ink} strokeWidth={10} strokeLinejoin="round">
          <path d="M92 174H286V228L162 302H286V352H92V298L216 224H92Z" />
          <path d="M694 174H750L818 272V174H876V352H820L752 254V352H694Z" />
          <path
            fillRule="evenodd"
            d="M899 174H988A89 89 0 0 1 988 352H899ZM957 226V300H982A37 37 0 0 0 982 226Z"
          />
        </g>
        <path
          d="M331 201V271A54 54 0 0 0 439 271V201"
          fill="none"
          stroke={`url(#${id}b)`}
          strokeWidth={62}
          strokeLinecap="round"
        />
        <circle cx={385} cy={139} r={36} fill="#3F8CF1" />
        <path
          d="M536 201V271A54 54 0 0 0 644 271V201"
          fill="none"
          stroke={`url(#${id}g)`}
          strokeWidth={62}
          strokeLinecap="round"
        />
        <circle cx={590} cy={139} r={36} fill="#5DBE59" />
      </g>
    </svg>
  );
}
