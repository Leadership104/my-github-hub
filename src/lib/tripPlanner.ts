import type { ItineraryItem, Trip } from '../types';

const EMOJI_BY_DEST: Record<string, string> = {
  tokyo: '🗼', kyoto: '⛩️', osaka: '🏯', japan: '🗼',
  bali: '🌴', indonesia: '🌴', jakarta: '🏙️',
  bangkok: '🛕', thailand: '🛕', 'chiang mai': '🏔️', phuket: '🏖️',
  paris: '🗼', france: '🗼',
  london: '🎡', uk: '🎡',
  'new york': '🗽', 'nyc': '🗽',
  rome: '🏛️', italy: '🍝',
  barcelona: '🏖️', spain: '💃', madrid: '🇪🇸',
  lisbon: '🇵🇹', portugal: '🇵🇹',
  dubai: '🏙️', uae: '🏙️',
  singapore: '🦁', sydney: '🌉', australia: '🦘',
  'mexico city': '🌮', mexico: '🌮', cancun: '🏖️', tulum: '🏝️',
  bogota: '🌺', medellin: '🌺', colombia: '🌺',
};

export function pickEmoji(dest: string, country: string): string {
  const d = dest.toLowerCase().trim();
  const c = country.toLowerCase().trim();
  return EMOJI_BY_DEST[d] || EMOJI_BY_DEST[c] || '✈️';
}

/** Destination-specific itinerary templates. */
const DEST_TEMPLATES: Record<string, (day: number) => Omit<ItineraryItem, 'id' | 'day' | 'done'>[]> = {
  tokyo: (day) => {
    const d: Record<number, Omit<ItineraryItem, 'id' | 'day' | 'done'>[]> = {
      1: [
        { time: '15:00', title: 'Arrive at Narita Airport (NRT) — collect luggage, clear customs, pick up pocket WiFi' },
        { time: '17:30', title: 'Narita Express → Shinjuku — 90-min scenic train' },
        { time: '19:30', title: 'Hotel check-in — Park Hyatt Tokyo or similar' },
        { time: '21:00', title: 'Ramen at Ichiran Shinjuku — solo ramen booths' },
      ],
      2: [
        { time: '08:00', title: 'Tsukiji Outer Market breakfast — fresh sushi & street food' },
        { time: '11:00', title: 'Senso-ji Temple in Asakusa' },
        { time: '14:00', title: 'TeamLab Borderless or Planets — book ahead!' },
        { time: '19:00', title: 'Izakaya hop in Golden Gai (Shinjuku)' },
      ],
      3: [
        { time: '09:00', title: 'Day trip to Kamakura — Great Buddha & beach' },
        { time: '18:00', title: 'Return to Tokyo, dinner in Ebisu' },
      ],
      4: [
        { time: '10:00', title: 'Shibuya Sky observation deck' },
        { time: '13:00', title: 'Conveyor-belt sushi in Shibuya' },
        { time: '15:00', title: 'Harajuku & Omotesando shopping' },
        { time: '20:00', title: 'Karaoke + cocktails in Roppongi' },
      ],
      5: [
        { time: '08:00', title: 'Day trip to Hakone — onsen + Mt Fuji views' },
        { time: '20:00', title: 'Kaiseki dinner back in Tokyo' },
      ],
    };
    return d[day] || [
      { time: '10:00', title: `Day ${day} — explore a new neighborhood` },
      { time: '13:00', title: 'Lunch at a local spot' },
      { time: '20:00', title: 'Dinner & evening walk' },
    ];
  },
  bali: (day) => {
    const d: Record<number, Omit<ItineraryItem, 'id' | 'day' | 'done'>[]> = {
      1: [
        { time: '14:00', title: 'Arrive at Denpasar (DPS) — taxi to Canggu' },
        { time: '17:00', title: 'Hotel/villa check-in' },
        { time: '19:00', title: 'Sunset at Echo Beach' },
      ],
      2: [
        { time: '07:00', title: 'Surf lesson at Batu Bolong' },
        { time: '11:00', title: 'Smoothie bowl brunch in Canggu' },
        { time: '16:00', title: 'Tanah Lot temple at sunset' },
      ],
      3: [
        { time: '08:00', title: 'Drive to Ubud — rice terraces at Tegallalang' },
        { time: '13:00', title: 'Lunch overlooking jungle' },
        { time: '17:00', title: 'Ubud Monkey Forest' },
      ],
    };
    return d[day] || [
      { time: '09:00', title: 'Beach morning + breakfast' },
      { time: '14:00', title: 'Spa or pool lounge' },
      { time: '19:00', title: 'Beach club dinner' },
    ];
  },
  paris: (day) => {
    const d: Record<number, Omit<ItineraryItem, 'id' | 'day' | 'done'>[]> = {
      1: [
        { time: '15:00', title: 'Arrive at CDG — RER B to city' },
        { time: '18:00', title: 'Hotel check-in (Marais or Saint-Germain)' },
        { time: '20:00', title: 'Bistro dinner + Seine walk' },
      ],
      2: [
        { time: '09:00', title: 'Eiffel Tower + Champ de Mars' },
        { time: '13:00', title: 'Lunch in 7th arrondissement' },
        { time: '15:00', title: 'Louvre Museum (book ahead!)' },
        { time: '20:00', title: 'Dinner in Le Marais' },
      ],
    };
    return d[day] || [
      { time: '10:00', title: 'Café + neighborhood stroll' },
      { time: '14:00', title: 'Museum or landmark visit' },
      { time: '20:00', title: 'Dinner at a wine bar' },
    ];
  },
};

export function generateItinerary(dest: string, days: number): ItineraryItem[] {
  const key = dest.toLowerCase().trim();
  const template = DEST_TEMPLATES[key];
  const items: ItineraryItem[] = [];
  for (let day = 1; day <= days; day++) {
    const dayItems = template ? template(day) : [
      { time: '09:00', title: `Day ${day} — morning explore in ${dest}` },
      { time: '12:30', title: 'Lunch at a local spot' },
      { time: '15:00', title: 'Afternoon activity or museum' },
      { time: '19:00', title: 'Dinner & evening walk' },
    ];
    dayItems.forEach((d, i) => {
      items.push({
        id: `i-${Date.now()}-${day}-${i}`,
        day,
        time: d.time,
        title: d.title,
        done: false,
      });
    });
  }
  return items;
}

export function buildTrip(opts: {
  dest: string;
  country: string;
  days: number;
  startDate?: string; // YYYY-MM-DD
  notes?: string;
  invites?: string[];
}): Trip {
  const start = opts.startDate ? new Date(opts.startDate) : (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d; })();
  const end = new Date(start);
  end.setDate(end.getDate() + opts.days);
  return {
    id: Date.now().toString(),
    dest: opts.dest,
    country: opts.country,
    emoji: pickEmoji(opts.dest, opts.country),
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    notes: opts.notes ?? `${opts.days}-day trip`,
    status: 'upcoming',
    items: generateItinerary(opts.dest, opts.days),
    bookings: [],
    invites: opts.invites || [],
    createdAt: Date.now(),
  };
}
