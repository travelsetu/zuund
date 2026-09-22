import { useEffect, useState } from 'react';
import type { CarDto, CityDto } from '@zuund/shared';
import { Select } from '@/components/ui';
import { api } from '@/lib/api';

/** Car + city dropdowns backed by the public catalog endpoints. */
export function CatalogFilters({
  carId,
  cityId,
  onCar,
  onCity,
}: {
  carId: string;
  cityId: string;
  onCar: (v: string) => void;
  onCity: (v: string) => void;
}) {
  const [cars, setCars] = useState<CarDto[]>([]);
  const [cities, setCities] = useState<CityDto[]>([]);
  useEffect(() => {
    api.catalog
      .cars('')
      .then(setCars)
      .catch(() => setCars([]));
    api.catalog
      .cities()
      .then(setCities)
      .catch(() => setCities([]));
  }, []);
  return (
    <>
      <Select
        label="Car"
        value={carId}
        onChange={onCar}
        options={cars.map((c) => ({ value: c.id, label: c.displayName }))}
      />
      <Select
        label="City"
        value={cityId}
        onChange={onCity}
        options={cities.map((c) => ({ value: c.id, label: c.name }))}
      />
    </>
  );
}
