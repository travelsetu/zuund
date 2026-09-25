import type { ProductCategory } from '@zuund/shared';
import type { IconName } from '@/components/Icon';

/**
 * One landing page per category at zuund.com/<slug>. The catalog and live demand come
 * from the API; the words live here. Copy never promises discounts or savings: members
 * compare notes and each one buys on their own terms.
 */
export interface CategoryPage {
  slug: string;
  category: ProductCategory;
  /** Plural noun for counts: "people buying cars". */
  noun: string;
  /** One item: "model", "size", "destination". */
  itemNoun: string;
  eyebrow: string;
  title: [string, string];
  lead: string;
  metaTitle: string;
  metaDescription: string;
  cta: string;
  explorerTitle: string;
  explorerLead: string;
  /** What people actually talk about inside a collective for this category. */
  together: Array<{ icon: IconName; title: string; body: string }>;
  steps: [string, string, string];
  faq: Array<{ q: string; a: string }>;
}

export const CATEGORY_PAGES: CategoryPage[] = [
  {
    slug: 'cars',
    category: 'CAR',
    noun: 'cars',
    itemNoun: 'model',
    eyebrow: 'Cars on ZUUND',
    title: ['Buying a car?', 'Don’t do it alone.'],
    lead: 'See who in your city is buying the same model, from a hatchback to a supercar. Compare notes on variants, waiting times and dealer quotes, then decide together. Each of you buys on your own terms.',
    metaTitle: 'Buy your next car alongside people buying the same model',
    metaDescription:
      'Find people in your city buying the same car model. Compare variants, waiting times and dealer quotes in a buyers-only collective. Free to post.',
    cta: 'Find buyers for my car',
    explorerTitle: 'Which car are you buying?',
    explorerLead:
      'Every model on ZUUND, by brand and body type. Pick yours to start your Buying Post.',
    together: [
      {
        icon: 'doc',
        title: 'Quotes side by side',
        body: 'Members share the on-road quotes they got, so everyone can see what is included and ask better questions at the showroom.',
      },
      {
        icon: 'clock',
        title: 'Real waiting times',
        body: 'Hear from people booking the same variant in your city, not from a sales pitch.',
      },
      {
        icon: 'poll',
        title: 'Settle the variant',
        body: 'Petrol or diesel, manual or automatic, which colour: run a poll and see what people like you chose.',
      },
    ],
    steps: [
      'Pick your model, city and when you plan to buy.',
      'See how many people nearby are buying the same car.',
      'Join the collective to discuss, share quotes and run polls.',
    ],
    faq: [
      {
        q: 'Is ZUUND a dealer or a car marketplace?',
        a: 'No. ZUUND never sells cars and takes no commission. It brings buyers of the same model in the same city together; every member chooses their dealer and buys for themselves.',
      },
      {
        q: 'Which cars can I post for?',
        a: 'Over 240 current models from more than 30 brands, from everyday hatchbacks and SUVs to electric cars and supercars. If yours is missing, tell us and we will add it.',
      },
      {
        q: 'Will dealers call me?',
        a: 'No. Collectives are for buyers only, and your phone number and email are never shown to anyone.',
      },
      {
        q: 'Do I get a discount?',
        a: 'ZUUND makes no promises about prices. What you get is other buyers’ experience: their quotes, waiting times and questions, so you can decide with more information.',
      },
    ],
  },
  {
    slug: 'solar',
    category: 'SOLAR',
    noun: 'rooftop solar',
    itemNoun: 'size',
    eyebrow: 'Rooftop solar on ZUUND',
    title: ['Going solar?', 'So are your neighbours.'],
    lead: 'Meet people in your city installing the same size of rooftop system, from 1 kW to 10 kW and above. Compare installers, net-metering steps and first-hand experience before you commit.',
    metaTitle: 'Install rooftop solar alongside neighbours doing the same',
    metaDescription:
      'Find people in your city installing the same size of rooftop solar. Compare installers, paperwork and experience in a buyers-only collective. Free to post.',
    cta: 'Find neighbours going solar',
    explorerTitle: 'What size system do you need?',
    explorerLead:
      'Slide to your usual monthly electricity use for a rough size, then start your Buying Post.',
    together: [
      {
        icon: 'people',
        title: 'Installer experiences',
        body: 'Who turned up on time, who explained the paperwork, whose after-sales support worked. Hear it from people near you.',
      },
      {
        icon: 'doc',
        title: 'The paperwork, together',
        body: 'Net metering, inspections and scheme applications are easier when someone a few steps ahead can answer your questions.',
      },
      {
        icon: 'poll',
        title: 'Compare the options',
        body: 'Panel types, inverters and warranties: share the proposals you received and weigh them up as a group.',
      },
    ],
    steps: [
      'Pick your system size, city and when you plan to install.',
      'See how many people nearby are installing the same.',
      'Join the collective to share proposals and compare installers.',
    ],
    faq: [
      {
        q: 'Does ZUUND install solar panels?',
        a: 'No. ZUUND is not an installer and takes no commission. It connects people in the same city installing rooftop solar; each member chooses their own installer.',
      },
      {
        q: 'How do I know which size I need?',
        a: 'As a rough guide, 1 kW of rooftop solar produces around 120 units a month in much of India, and needs about 100 sq ft of shade-free roof. An installer’s site survey gives the real figure for your home.',
      },
      {
        q: 'Why are there no brands?',
        a: 'Solar posts are grouped by system size only, so everyone installing a 3 kW system in your city lands in the same collective, whichever installer they are talking to.',
      },
      {
        q: 'Will installers contact me?',
        a: 'No. Collectives are for buyers only, and your phone number and email are never shown to anyone.',
      },
    ],
  },
  {
    slug: 'holidays',
    category: 'HOLIDAY',
    noun: 'holidays',
    itemNoun: 'destination',
    eyebrow: 'Holiday packages on ZUUND',
    title: ['Planning a holiday?', 'Meet people going too.'],
    lead: 'Pick a destination in India or abroad and meet travellers from your city planning the same trip, in the same month. Share itineraries, hotel finds and package quotes, and decide together.',
    metaTitle: 'Plan your holiday with people from your city going to the same place',
    metaDescription:
      'Find people in your city planning a holiday to the same destination. Share itineraries, hotels and package quotes in a travellers-only collective. Free to post.',
    cta: 'Find travellers for my trip',
    explorerTitle: 'Where are you going?',
    explorerLead: 'Destinations across India and abroad, from India. Pick yours to plan the trip.',
    together: [
      {
        icon: 'calendar',
        title: 'Same place, same time',
        body: 'Your post carries the month and week you want to travel, so you meet people planning your trip, not someone else’s.',
      },
      {
        icon: 'doc',
        title: 'Itineraries and quotes',
        body: 'Share the packages you were offered and the itineraries you like, and see what others found.',
      },
      {
        icon: 'chat',
        title: 'Ask before you book',
        body: 'Hotels, visas, what to pack for children: questions answered by people from your city going the same way.',
      },
    ],
    steps: [
      'Pick your destination, travel month, travellers and hotel type.',
      'See how many people from your city are planning the same trip.',
      'Join the collective to share itineraries and plan together.',
    ],
    faq: [
      {
        q: 'Is ZUUND a travel agent?',
        a: 'No. ZUUND does not sell packages and takes no commission. It connects people from the same city planning the same trip; each traveller books for themselves.',
      },
      {
        q: 'Do we have to travel together?',
        a: 'Only if you want to. Many members simply compare packages and tips. Some decide to travel as a group; that choice is yours.',
      },
      {
        q: 'Which destinations are there?',
        a: 'Popular destinations across India, including whole-state tours, and international holidays from India to Southeast Asia, the Middle East, Europe and beyond.',
      },
      {
        q: 'Who can see my trip?',
        a: 'Other members see your name, city and trip. Your phone number and email are never shown, and you can block or report anyone at any time.',
      },
    ],
  },
];

export const categoryPage = (slug: string) => CATEGORY_PAGES.find((c) => c.slug === slug);
export const pageFor = (category: ProductCategory) =>
  CATEGORY_PAGES.find((c) => c.category === category)!;
