import type { CarDto } from '@zuund/shared';
import { VehicleArt } from './VehicleArt';

const DIM = { sm: 30, md: 54, lg: 110 } as const;

/** Category illustration (no licensed product photos yet); uses the catalog image when there is one. */
export function ProductArt({
  car,
  size = 'md',
}: {
  car: Pick<CarDto, 'category' | 'imageUrl'> & { segment?: string | null };
  size?: 'sm' | 'md' | 'lg';
}) {
  const solar = car.category === 'SOLAR';
  if (car.imageUrl) {
    return (
      <span className={`product-art ${size}`} style={{ background: 'transparent' }}>
        <img src={car.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} />
      </span>
    );
  }
  const d = DIM[size];
  return (
    <span className={`product-art ${size}${solar ? ' solar' : ''}`} aria-hidden>
      {solar ? (
        <svg width={d} height={d} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 3h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7v3h3v2H8v-2h3v-3H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 2v3h4V5zm6 0v3h2V5zm4 0v3h4V5zM5 10v3h4v-3zm6 0v3h2v-3zm4 0v3h4v-3z" />
        </svg>
      ) : (
        // ZUUND's own drawing for the body type: no manufacturer photos or logos.
        <VehicleArt segment={car.segment} width="88%" />
      )}
    </span>
  );
}
