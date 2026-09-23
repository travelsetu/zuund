/**
 * ZUUND's own vehicle illustrations: one side-profile silhouette per body type,
 * shared by the app (react-native-svg) and the website (SVG). Deliberately
 * generic — no manufacturer shapes, badges or photos.
 *
 * Coordinates are in a 240×100 box, front of the vehicle to the right,
 * wheels resting on y = 95.
 */
export type VehicleShape =
  | 'hatchback'
  | 'sedan'
  | 'suv'
  | 'muv'
  | 'van'
  | 'pickup'
  | 'coupe'
  | 'convertible';

export interface VehicleArt {
  /**
   * Upper outline, from the rear bottom corner (y 84) over the roof to the front
   * bottom corner (y 84). vehicleBody() closes it along the bottom with wheel arches.
   */
  profile: string;
  /** Glass areas. */
  windows: string[];
  /** Wheel centres (x); all wheels share WHEEL_Y and WHEEL_R. */
  wheels: [number, number];
  /** Thin detail lines: door seams, bed rail. */
  lines?: string[];
}

export const VEHICLE_VIEWBOX = '0 0 240 100';
export const WHEEL_Y = 82;
export const WHEEL_R = 13;
/** Wheel-arch radius: a little larger than the wheel, so a sliver of body shows around the tyre. */
const ARCH_R = 17;

/** Full body path: the profile closed along the bottom with an arch over each wheel. */
export function vehicleBody(v: VehicleArt): string {
  const [rear, front] = v.wheels;
  return (
    `${v.profile} L${front + ARCH_R} 84 A${ARCH_R} ${ARCH_R} 0 0 0 ${front - ARCH_R} 84 ` +
    `L${rear + ARCH_R} 84 A${ARCH_R} ${ARCH_R} 0 0 0 ${rear - ARCH_R} 84 Z`
  );
}

export const VEHICLES: Record<VehicleShape, VehicleArt> = {
  hatchback: {
    profile: 'M48 84 L46 58 Q46 50 52 44 L62 34 Q66 30 74 30 L126 30 Q134 30 140 36 L156 50 L186 55 Q194 57 196 64 L196 84',
    windows: ['M60 50 L68 38 Q70 35 75 35 L98 35 L98 50 Z', 'M103 35 L124 35 Q130 35 134 39 L146 50 L103 50 Z'],
    wheels: [76, 168],
    lines: ['M100 52 L100 74'],
  },
  sedan: {
    profile: 'M28 84 L28 62 Q28 56 36 55 L70 52 L88 36 Q93 32 100 32 L144 32 Q151 32 156 37 L172 52 L204 56 Q212 58 213 66 L213 84',
    windows: ['M90 50 L100 39 Q102 37 106 37 L124 37 L124 50 Z', 'M129 37 L143 37 Q148 37 152 41 L161 50 L129 50 Z'],
    wheels: [62, 182],
    lines: ['M126 52 L126 74'],
  },
  suv: {
    profile: 'M36 84 L36 44 Q36 30 50 28 L148 27 Q156 27 162 33 L176 48 L204 52 Q212 54 213 62 L213 84',
    windows: ['M48 48 L50 36 Q51 33 56 33 L96 33 L96 48 Z', 'M101 33 L145 33 Q150 33 154 37 L164 48 L101 48 Z'],
    wheels: [72, 180],
    lines: ['M98 50 L98 74'],
  },
  muv: {
    profile: 'M24 84 L24 42 Q24 30 38 29 L146 28 Q154 28 160 34 L180 50 L206 54 Q214 56 215 64 L215 84',
    windows: ['M36 47 L38 35 Q39 33 43 33 L78 33 L78 47 Z', 'M83 33 L118 33 L118 47 L83 47 Z', 'M123 33 L143 33 Q148 33 152 37 L163 47 L123 47 Z'],
    wheels: [58, 186],
    lines: ['M80 49 L80 74', 'M120 49 L120 74'],
  },
  van: {
    profile: 'M32 84 L32 30 Q32 20 44 20 L160 20 Q168 20 173 27 L194 52 Q208 55 209 64 L209 84',
    windows: ['M44 44 L44 28 L110 28 L110 44 Z', 'M116 28 L158 28 Q163 28 166 32 L181 46 L116 46 Z'],
    wheels: [64, 178],
    lines: ['M113 30 L113 74'],
  },
  pickup: {
    profile: 'M20 84 L20 54 L96 54 L98 38 Q100 31 108 31 L146 31 Q153 31 158 36 L172 50 L204 54 Q212 56 213 64 L213 84',
    windows: ['M106 50 L108 39 Q109 36 113 36 L143 36 Q148 36 152 40 L161 50 Z'],
    wheels: [54, 182],
    lines: ['M22 58 L94 58', 'M130 52 L130 74'],
  },
  coupe: {
    profile: 'M30 84 L30 64 Q30 58 38 57 L80 54 L102 40 Q108 36 116 36 L140 36 Q148 36 154 42 L172 55 L206 59 Q213 61 214 68 L214 84',
    windows: ['M100 54 L112 43 Q115 41 119 41 L139 41 Q145 41 149 45 L159 54 Z'],
    wheels: [64, 184],
    lines: ['M130 56 L130 74'],
  },
  convertible: {
    profile: 'M30 84 L30 64 Q30 58 38 57 L120 56 L132 44 L136 44 L148 57 L206 59 Q213 61 214 68 L214 84',
    windows: ['M126 55 L134 47 L140 55 Z'],
    wheels: [64, 184],
    lines: ['M90 57 L104 50 L112 50 L112 57'],
  },
};

/** Which silhouette to draw for a catalog item. EVs keep a sensible body (crossover). */
export function vehicleShapeFor(segment: string | null | undefined): VehicleShape {
  switch ((segment ?? '').toLowerCase()) {
    case 'hatchback':
      return 'hatchback';
    case 'sedan':
      return 'sedan';
    case 'muv':
      return 'muv';
    case 'van':
      return 'van';
    case 'pickup':
      return 'pickup';
    case 'coupe':
      return 'coupe';
    case 'convertible':
      return 'convertible';
    default:
      return 'suv';
  }
}

export const isElectric = (segment: string | null | undefined) =>
  (segment ?? '').toUpperCase() === 'EV';

/**
 * Extra detail for the large banner car (drawn on the SUV silhouette):
 * lights, mirror, handles and a bumper line. Still generic — no badges or grilles
 * that could read as a particular brand.
 */
export const HERO_DETAILS = {
  headlight: 'M199 54 L210 56 Q213 58 211 61 L200 60 Q197 57 199 54 Z',
  taillight: 'M36 45 L41 45 L41 57 L36 57 Z',
  mirror: 'M160 43 Q160 40 164 40 L168 40 L168 47 L162 47 Z',
  handles: ['M78 56 L87 56', 'M120 56 L129 56'],
  bumper: 'M196 71 L213 71',
  sill: 'M58 76 L154 76',
} as const;
