import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

/** Readers for the GeoNames extracts in prisma/data (CC BY 4.0, www.geonames.org). */
const DIR = join(__dirname, 'data');

export interface GeoCountry {
  code: string;
  name: string;
  continent: string;
}

export interface GeoCity {
  geonameId: number;
  name: string;
  state: string;
  countryCode: string;
  population: number;
  latitude: number;
  longitude: number;
  slug: string;
}

function rows(text: string): string[][] {
  return text
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('\t'));
}

export function readCountries(): GeoCountry[] {
  return rows(readFileSync(join(DIR, 'countries.tsv'), 'utf8')).map(([code, name, continent]) => ({
    code: code!,
    name: name!,
    continent: continent!,
  }));
}

export function readCities(): GeoCity[] {
  const text = gunzipSync(readFileSync(join(DIR, 'cities.tsv.gz'))).toString('utf8');
  return rows(text).map(([id, name, , cc, state, pop, lat, lng, slug]) => ({
    geonameId: Number(id),
    name: name!,
    state: state ?? '',
    countryCode: cc!,
    population: Number(pop) || 0,
    latitude: Number(lat),
    longitude: Number(lng),
    slug: slug!,
  }));
}
