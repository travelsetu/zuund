import {
  HERO_DETAILS,
  VEHICLES,
  VEHICLE_VIEWBOX,
  WHEEL_R,
  WHEEL_Y,
  isElectric,
  vehicleBody,
  vehicleShapeFor,
} from '@zuund/shared';
import { useId } from 'react';

/**
 * ZUUND's own vehicle drawing (same data as the app). `hero` = the detailed banner car.
 */
export function VehicleArt({
  segment,
  width,
  onDark,
  hero,
}: {
  segment?: string | null;
  width?: number | string;
  onDark?: boolean;
  hero?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const v = VEHICLES[hero ? 'suv' : vehicleShapeFor(segment)];
  const ev = !hero && isElectric(segment);
  const c = hero
    ? {
        top: '#5B95FF',
        bottom: '#1E56DA',
        glass: '#0B2A6F',
        line: '#0A2A7A',
        wheel: '#030B22',
        hub: '#C9D6F2',
      }
    : onDark
      ? {
          top: '#FFFFFF',
          bottom: '#DCE6FB',
          glass: '#1B3170',
          line: '#8FA6D9',
          wheel: '#020B24',
          hub: '#AFC0E8',
        }
      : {
          top: '#3D7CF5',
          bottom: '#1650E0',
          glass: '#DCE8FF',
          line: '#0E3A9E',
          wheel: '#071833',
          hub: '#AFC0E8',
        };
  const [rear, front] = v.wheels;
  return (
    <svg
      viewBox={VEHICLE_VIEWBOX}
      width={width}
      aria-hidden
      style={{ display: 'block', height: 'auto' }}
    >
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.top} />
          <stop offset="1" stopColor={c.bottom} />
        </linearGradient>
      </defs>
      <ellipse
        cx={(rear + front) / 2}
        cy={96}
        rx={(front - rear) / 2 + 34}
        ry={4}
        fill="#000"
        opacity={onDark || hero ? 0.3 : 0.1}
      />
      <path d={vehicleBody(v)} fill={`url(#${id}b)`} />
      {v.windows.map((d) => (
        <path key={d} d={d} fill={c.glass} />
      ))}
      {(v.lines ?? []).map((d) => (
        <path
          key={d}
          d={d}
          stroke={c.line}
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.5}
          fill="none"
        />
      ))}
      {hero && (
        <g>
          <path d={HERO_DETAILS.headlight} fill="#FFE9A8" />
          <path d={HERO_DETAILS.taillight} fill="#FF6B6B" />
          <path d={HERO_DETAILS.mirror} fill="#1E56DA" />
          {HERO_DETAILS.handles.map((d) => (
            <path key={d} d={d} stroke="#0A2A7A" strokeWidth={2} strokeLinecap="round" />
          ))}
          <path d={HERO_DETAILS.bumper} stroke="#0A2A7A" strokeWidth={1.5} strokeLinecap="round" />
          <path
            d={HERO_DETAILS.sill}
            stroke="#0A2A7A"
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.5}
          />
        </g>
      )}
      {v.wheels.map((x) => (
        <g key={x}>
          <circle cx={x} cy={WHEEL_Y} r={WHEEL_R} fill={c.wheel} />
          <circle cx={x} cy={WHEEL_Y} r={hero ? 8 : 5.5} fill={c.hub} />
          {hero && <circle cx={x} cy={WHEEL_Y} r={3} fill={c.wheel} />}
        </g>
      ))}
      {ev && (
        <g transform="translate(206 4)">
          <circle cx={12} cy={12} r={12} fill="#0E9F5B" />
          <path d="M13 4 L7 13 H11 L10 20 L17 10 H13 Z" fill="#FFFFFF" />
        </g>
      )}
    </svg>
  );
}
