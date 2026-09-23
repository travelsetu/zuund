import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Phase 1 catalog: cars, rooftop solar and cities. Slugs are stable identifiers; edit names freely. */

export const CITIES: Array<{ name: string; state: string; slug: string }> = [
  { name: 'Ahmedabad', state: 'Gujarat', slug: 'ahmedabad' },
  { name: 'Surat', state: 'Gujarat', slug: 'surat' },
  { name: 'Vadodara', state: 'Gujarat', slug: 'vadodara' },
  { name: 'Rajkot', state: 'Gujarat', slug: 'rajkot' },
  { name: 'Mumbai', state: 'Maharashtra', slug: 'mumbai' },
  { name: 'Pune', state: 'Maharashtra', slug: 'pune' },
  { name: 'Nagpur', state: 'Maharashtra', slug: 'nagpur' },
  { name: 'Delhi', state: 'Delhi', slug: 'delhi' },
  { name: 'Gurugram', state: 'Haryana', slug: 'gurugram' },
  { name: 'Noida', state: 'Uttar Pradesh', slug: 'noida' },
  { name: 'Lucknow', state: 'Uttar Pradesh', slug: 'lucknow' },
  { name: 'Jaipur', state: 'Rajasthan', slug: 'jaipur' },
  { name: 'Bengaluru', state: 'Karnataka', slug: 'bengaluru' },
  { name: 'Hyderabad', state: 'Telangana', slug: 'hyderabad' },
  { name: 'Chennai', state: 'Tamil Nadu', slug: 'chennai' },
  { name: 'Coimbatore', state: 'Tamil Nadu', slug: 'coimbatore' },
  { name: 'Kolkata', state: 'West Bengal', slug: 'kolkata' },
  { name: 'Indore', state: 'Madhya Pradesh', slug: 'indore' },
  { name: 'Bhopal', state: 'Madhya Pradesh', slug: 'bhopal' },
  { name: 'Chandigarh', state: 'Chandigarh', slug: 'chandigarh' },
  { name: 'Kochi', state: 'Kerala', slug: 'kochi' },
  { name: 'Thiruvananthapuram', state: 'Kerala', slug: 'thiruvananthapuram' },
  { name: 'Bhubaneswar', state: 'Odisha', slug: 'bhubaneswar' },
  { name: 'Patna', state: 'Bihar', slug: 'patna' },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', slug: 'visakhapatnam' },
];

/** Cars: the verified catalogue in prisma/data/cars.json (see its _about). */
export const CARS: Array<{ brand: string; model: string; segment: string; slug?: string }> = (
  JSON.parse(readFileSync(join(__dirname, 'data', 'cars.json'), 'utf8')) as {
    models: Array<{ brand: string; model: string; segment: string; slug?: string }>;
  }
).models;

/**
 * Rooftop solar by system size only — no brands. Buyers of a same-size system in
 * a city meet; brand is something they can discuss inside the collective.
 */
const SOLAR_SIZES_KW = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const SOLAR: Array<{
  brand: string;
  model: string;
  displayName: string;
  segment: string;
  /** Pinned where the name would clash: "10+ kW" slugifies the same as "10 kW". */
  slug?: string;
}> = [
  ...SOLAR_SIZES_KW.map((kw) => ({
    brand: 'Rooftop Solar',
    model: `${kw} kW`,
    displayName: `${kw} kW Rooftop Solar`,
    segment: 'On-grid rooftop',
  })),
  // Anything bigger than 10 kW.
  {
    brand: 'Rooftop Solar',
    model: '10+ kW',
    displayName: '10+ kW Rooftop Solar',
    segment: 'On-grid rooftop',
    slug: '10-plus-kw-rooftop-solar',
  },
];

/**
 * Holiday packages from India: popular destinations by trip type — whole-state tours
 * ("Kerala", "Rajasthan") first in each region, then places (the item's brand)
 * and region (its segment, used for the filter chips). Named the way Indian travel
 * agents sell them ("Shimla & Manali", "Europe Multi-country").
 */
const DOMESTIC: Record<string, string[]> = {
  'North India': [
    'Himachal',
    'Uttarakhand',
    'Kashmir',
    'Ladakh',
    'Shimla & Manali',
    'Spiti Valley',
    'Dharamshala & McLeod Ganj',
    'Rishikesh & Haridwar',
    'Char Dham',
    'Nainital',
    'Mussoorie',
    'Jim Corbett',
    'Amritsar',
    'Agra',
    'Varanasi',
  ],
  'West India': [
    'Rajasthan',
    'Gujarat',
    'Goa',
    'Jaipur',
    'Udaipur',
    'Jodhpur',
    'Jaisalmer',
    'Mount Abu',
    'Rann of Kutch',
    'Mahabaleshwar',
  ],
  'South India': [
    'South India',
    'Kerala',
    'Kerala Backwaters',
    'Munnar',
    'Wayanad',
    'Kovalam',
    'Ooty',
    'Kodaikanal',
    'Coorg',
    'Mysuru',
    'Hampi',
    'Gokarna',
    'Puducherry',
    'Madurai & Rameswaram',
    'Tirupati',
  ],
  'East & North-East': ['Darjeeling', 'Sikkim', 'Meghalaya', 'Kaziranga', 'Tawang', 'Puri'],
  'Central India': ['Khajuraho', 'Kanha & Bandhavgarh', 'Pachmarhi'],
  Islands: ['Andaman Islands', 'Lakshadweep'],
};
const INTERNATIONAL: Record<string, string[]> = {
  'Southeast Asia': [
    'Thailand',
    'Bali',
    'Singapore',
    'Malaysia',
    'Vietnam',
    'Cambodia',
    'Philippines',
  ],
  'Middle East': ['Dubai', 'Abu Dhabi', 'Oman', 'Qatar'],
  'Indian Ocean': ['Maldives', 'Mauritius', 'Seychelles'],
  'South Asia': ['Sri Lanka', 'Nepal', 'Bhutan'],
  'East Asia': ['Japan', 'South Korea', 'Hong Kong'],
  Europe: [
    'Europe Multi-country',
    'Switzerland',
    'France',
    'Italy',
    'United Kingdom',
    'Spain',
    'Greece',
    'Turkey',
  ],
  'Central Asia & Caucasus': ['Georgia', 'Azerbaijan', 'Kazakhstan', 'Uzbekistan'],
  Africa: ['Kenya', 'South Africa', 'Egypt'],
  Americas: ['USA', 'Canada'],
  Oceania: ['Australia', 'New Zealand'],
};
export const HOLIDAYS: Array<{
  brand: string;
  model: string;
  displayName: string;
  segment: string;
}> = (
  [
    ['Domestic', DOMESTIC],
    ['International', INTERNATIONAL],
  ] as const
).flatMap(([brand, regions]) =>
  Object.entries(regions).flatMap(([segment, places]) =>
    places.map((model) => ({ brand, model, displayName: `${model} Holiday Package`, segment })),
  ),
);

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
