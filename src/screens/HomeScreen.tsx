import { useState, useEffect } from 'react';
import HorizontalScroller from '../components/HorizontalScroller';
import type { TabId } from '../types';
import type { ForecastDay } from '../hooks';
import { useTravelSafety } from '../hooks';
import { computeSafetyScore, advisoryToBaseRates, detectTimeOfDay, safetyLevel, cityVarianceFromSeed } from '../lib/safetyEngine';
import { getDestinationDetails } from '../lib/destinationSearch';
import { CATEGORY_SUBS } from '../data';

interface Props {
  weather: { emoji: string; temp: string; desc: string };
  forecast: ForecastDay[];
  locationName: string;
  fullAddress?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
  onSwitchTab: (tab: TabId, hint?: string) => void;
}

type SubChip = { emoji: string; label: string; hint: string };

/* Custom Fuel icon: green car with thunderbolt through it */
function FuelIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Car body */}
      <path d="M6 30 L10 18 Q12 14 17 14 L47 14 Q52 14 54 18 L58 30 L58 38 Q58 40 56 40 L52 40 Q50 40 50 38 L50 36 L14 36 L14 38 Q14 40 12 40 L8 40 Q6 40 6 38 Z"
        fill="hsl(142 71% 45%)" stroke="hsl(142 76% 28%)" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Windows */}
      <path d="M14 26 L17 18 Q18 16 20 16 L44 16 Q46 16 47 18 L50 26 Z" fill="hsl(200 90% 78%)" opacity="0.85" />
      {/* Wheels */}
      <circle cx="18" cy="38" r="4" fill="hsl(220 15% 18%)" />
      <circle cx="46" cy="38" r="4" fill="hsl(220 15% 18%)" />
      <circle cx="18" cy="38" r="1.5" fill="hsl(0 0% 90%)" />
      <circle cx="46" cy="38" r="1.5" fill="hsl(0 0% 90%)" />
      {/* Thunderbolt across the car */}
      <path d="M38 8 L24 28 L31 28 L26 44 L42 22 L34 22 L40 8 Z"
        fill="hsl(48 100% 55%)" stroke="hsl(30 90% 30%)" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Subchip definitions for each essential tile ── */
const ESSENTIAL_CHIPS: Record<string, SubChip[]> = {
  food: [
    { emoji: '🍽️', label: 'Restaurants', hint: 'food' },
    { emoji: '☕', label: 'Coffee', hint: 'cafe' },
    { emoji: '🍸', label: 'Drinks (21+)', hint: 'drinks' },
    { emoji: '🥐', label: 'Bakery', hint: 'food' },
    { emoji: '🍕', label: 'Pizza', hint: 'food' },
    { emoji: '🍔', label: 'Burgers', hint: 'food' },
    { emoji: '🍜', label: 'Asian', hint: 'food' },
    { emoji: '🌮', label: 'Mexican', hint: 'food' },
    { emoji: '🥗', label: 'Healthy', hint: 'food' },
  ],
  fun: [
    { emoji: '🎭', label: 'Attractions', hint: 'attractions' },
    { emoji: '🏛️', label: 'Museums', hint: 'museum' },
    { emoji: '🎢', label: 'Theme Parks', hint: 'attractions' },
    { emoji: '🎬', label: 'Cinema', hint: 'attractions' },
    { emoji: '🎳', label: 'Bowling', hint: 'attractions' },
    { emoji: '🕹️', label: 'Arcade', hint: 'attractions' },
    { emoji: '🌃', label: 'Nightlife (21+)', hint: 'nightlife' },
    { emoji: '🎵', label: 'Live Music', hint: 'nightlife' },
  ],
  shopping: [
    { emoji: '🏬', label: 'Mall', hint: 'shop' },
    { emoji: '🛒', label: 'Grocery', hint: 'grocery' },
    { emoji: '🏪', label: 'Market', hint: 'market' },
    { emoji: '🌽', label: 'Farmers Market', hint: 'farmers_market' },
    { emoji: '👔', label: 'Clothing', hint: 'shop' },
    { emoji: '📱', label: 'Electronics', hint: 'shop' },
  ],
  fuel: [
    { emoji: '⛽', label: 'Gas Station', hint: 'gas' },
    { emoji: '⚡', label: 'EV Charging', hint: 'gas' },
    { emoji: '🛢️', label: 'Diesel', hint: 'gas' },
  ],
  maps: [
    { emoji: '🗺️', label: 'Open Map', hint: '' },
    { emoji: '🚗', label: 'Drive', hint: '' },
    { emoji: '🚶', label: 'Walk', hint: '' },
  ],
  atm: [
    { emoji: '🏧', label: 'ATM', hint: 'atm' },
    { emoji: '₿', label: 'Bitcoin ATM', hint: 'atm' },
    { emoji: '🏦', label: 'Bank', hint: 'atm' },
  ],
};

type FeaturedTile = { id: string; emoji: string; label: string; hint: string; chips: SubChip[] };

/** Situation-aware featured tiles based on time of day + day of week. */
function getFeaturedNearMe(): FeaturedTile[] {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  const drinks: SubChip[] = (CATEGORY_SUBS.drinks || []).map(s => ({ emoji: s.emoji, label: s.label, hint: 'drinks' }));
  const nightlife: SubChip[] = (CATEGORY_SUBS.nightlife || []).map(s => ({ emoji: s.emoji, label: s.label, hint: 'nightlife' }));
  const attractions: SubChip[] = (CATEGORY_SUBS.attractions || []).map(s => ({ emoji: s.emoji, label: s.label, hint: 'attractions' }));
  const cafes: SubChip[] = (CATEGORY_SUBS.cafe || []).map(s => ({ emoji: s.emoji, label: s.label, hint: 'cafe' }));
  const food: SubChip[] = (CATEGORY_SUBS.food || []).map(s => ({ emoji: s.emoji, label: s.label, hint: 'food' }));
  const shop: SubChip[] = (CATEGORY_SUBS.shop || []).map(s => ({ emoji: s.emoji, label: s.label, hint: 'shop' }));
  const gas: SubChip[] = (CATEGORY_SUBS.gas || []).map(s => ({ emoji: s.emoji, label: s.label, hint: 'gas' }));
  const wellness: SubChip[] = (CATEGORY_SUBS.gym || []).map(s => ({ emoji: s.emoji, label: s.label, hint: 'gym' }));
  const parks: SubChip[] = (CATEGORY_SUBS.park || []).map(s => ({ emoji: s.emoji, label: s.label, hint: 'park' }));

  if (hour >= 23 || hour < 4) {
    // Late night: food → nightlife → essentials
    return [
      { id: 'late', emoji: '🍔', label: 'Late Eats', hint: 'food', chips: food },
      { id: 'nightlife', emoji: '🌃', label: 'Nightlife', hint: 'nightlife', chips: nightlife },
      { id: 'atm', emoji: '💵', label: '$ Money', hint: 'atm', chips: ESSENTIAL_CHIPS.atm },
      { id: 'gas', emoji: '⛽', label: 'Gas', hint: 'gas', chips: gas },
    ];
  }
  if (hour >= 18) {
    // Evening: food & drinks → nightlife → coffee
    return [
      { id: 'dinner', emoji: '🍽️', label: 'Dinner', hint: 'food', chips: food },
      { id: 'drinks', emoji: '🍸', label: 'Drinks', hint: 'drinks', chips: drinks },
      { id: 'nightlife', emoji: '🌃', label: 'Nightlife', hint: 'nightlife', chips: nightlife },
      { id: 'coffee', emoji: '☕', label: 'Coffee', hint: 'cafe', chips: cafes },
    ];
  }
  // Afternoon: parks → food → drinks → nightlife preview
  if (hour >= 14) {
    return [
      { id: 'parks', emoji: '🌳', label: 'Parks', hint: 'park', chips: parks },
      { id: 'dinner', emoji: '🍽️', label: 'Dinner', hint: 'food', chips: food },
      { id: 'drinks', emoji: '🍸', label: 'Drinks', hint: 'drinks', chips: drinks },
      { id: 'nightlife', emoji: '🌃', label: 'Nightlife', hint: 'nightlife', chips: nightlife },
    ];
  }
  if (isWeekend && hour < 12) {
    // Weekend morning: brunch → parks → attractions → recreation
    return [
      { id: 'brunch', emoji: '☕', label: 'Brunch', hint: 'cafe', chips: cafes },
      { id: 'parks', emoji: '🌳', label: 'Parks', hint: 'park', chips: parks },
      { id: 'attractions', emoji: '🎭', label: 'Attractions', hint: 'attractions', chips: attractions },
      { id: 'recreation', emoji: '🏋️', label: 'Recreation', hint: 'gym', chips: wellness },
    ];
  }
  if (hour < 11) {
    // Morning: coffee → breakfast → parks → gas
    return [
      { id: 'coffee', emoji: '☕', label: 'Coffee', hint: 'cafe', chips: cafes },
      { id: 'breakfast', emoji: '🥐', label: 'Breakfast', hint: 'food', chips: food },
      { id: 'parks', emoji: '🌳', label: 'Parks', hint: 'park', chips: parks },
      { id: 'gas', emoji: '⛽', label: 'Gas', hint: 'gas', chips: gas },
    ];
  }
  // Midday: food → parks → attractions → shopping
  return [
    { id: 'lunch', emoji: '🍽️', label: 'Lunch', hint: 'food', chips: food },
    { id: 'parks', emoji: '🌳', label: 'Parks', hint: 'park', chips: parks },
    { id: 'attractions', emoji: '🎭', label: 'Attractions', hint: 'attractions', chips: attractions },
    { id: 'shop', emoji: '🛍️', label: 'Shopping', hint: 'shop', chips: shop },
  ];
}

export default function HomeScreen({ weather, forecast, locationName, fullAddress, countryCode, lat, lng, onSwitchTab }: Props) {
  const [bgPhoto, setBgPhoto] = useState<string | undefined>();

  // Pull a real photo of the current city for the background
  useEffect(() => {
    if (!locationName) return;
    const [city, country] = locationName.split(',').map(s => s.trim());
    let cancelled = false;
    getDestinationDetails(city, country).then(d => {
      if (!cancelled && d.photo) setBgPhoto(d.photo);
    });
    return () => { cancelled = true; };
  }, [locationName]);

  const handleEssentialTap = (id: string) => {
    switch (id) {
      case 'food': onSwitchTab('places', 'food'); break;
      case 'fun': onSwitchTab('places', 'attractions'); break;
      case 'shopping': onSwitchTab('places', 'shop'); break;
      case 'fuel': onSwitchTab('fuel'); break;
      case 'maps': onSwitchTab('maps'); break;
      case 'atm': onSwitchTab('atm'); break;
      case 'parks': onSwitchTab('places', 'park'); break;
      case 'parking': onSwitchTab('places', 'parking'); break;
      case 'lodges': onSwitchTab('places', 'lodge'); break;
      case 'business': onSwitchTab('business'); break;
    }
  };

  const ESSENTIALS: { id: string; label: string; color: string; render: () => JSX.Element }[] = [
    { id: 'food',     label: 'Food & Drinks', color: '#DD6B20', render: () => <span className="text-3xl">🍽️</span> },
    { id: 'shopping', label: 'Shopping',      color: '#D69E2E', render: () => <span className="text-3xl">🛍️</span> },
    { id: 'fun',      label: 'Fun',           color: '#805AD5', render: () => <span className="text-3xl">🎭</span> },
    { id: 'fuel',     label: 'Gas/EV',        color: '#38A169', render: () => <FuelIcon size={36} /> },
    { id: 'maps',     label: 'Maps',          color: '#3182CE', render: () => <span className="text-3xl">🗺️</span> },
    { id: 'atm',      label: '$ Money',       color: '#2C7A7B', render: () => <span className="text-3xl">💵</span> },
  ];

  const [featured, setFeatured] = useState<FeaturedTile[]>(() => getFeaturedNearMe());
  useEffect(() => {
    // Recompute on mount, when tab regains focus, and every 5 minutes so the
    // "Featured Near Me" tiles reflect the current time of day.
    const recompute = () => setFeatured(getFeaturedNearMe());
    recompute();
    const id = window.setInterval(recompute, 5 * 60 * 1000);
    const onVis = () => { if (!document.hidden) recompute(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Faint city photo background */}
      {bgPhoto && (
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url(${bgPhoto})`, opacity: 0.18 }}
          aria-hidden
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background pointer-events-none" aria-hidden />

      {/* Safety bar moved to global LocationSafetyBar in App.tsx for cross-screen consistency */}

      <div className="relative flex-1 overflow-y-auto px-4 pt-3 pb-24">

        {/* Know Before You Go CTA (compact) */}
        <button onClick={() => onSwitchTab('ai')}
          className="btn-outline-3d w-full flex items-center gap-2.5 rounded-kipita px-3 py-2 mb-3 text-left animate-fadeSlideUp"
          style={{ borderColor: '#DD3B49', borderWidth: '1.5px' }}>
          <div className="w-8 h-8 rounded-full bg-kipita-red-lt flex items-center justify-center flex-shrink-0">
            <span className="ms text-kipita-red text-base">auto_awesome</span>
          </div>
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-foreground font-extrabold text-base leading-tight">Know Before You Go</div>
            <div className="text-muted-foreground text-[10px] leading-tight">Intelligence Powered Insights</div>
          </div>
          <span className="ms text-muted-foreground text-lg">chevron_right</span>
        </button>

        {/* Essentials Grid */}
        <h2 className="text-sm font-bold text-foreground mb-2">Essentials</h2>
        <div data-tour="home-essentials" className="grid grid-cols-2 gap-2 mb-3 stagger">
          {ESSENTIALS.map(item => (
            <button
              key={item.id}
              onClick={() => handleEssentialTap(item.id)}
              className="btn-outline-3d flex flex-col items-center justify-center gap-1.5 py-3 rounded-kipita-sm"
              style={{ borderColor: item.color }}
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: item.color + '22' }}>
                {item.render()}
              </div>
              <span className="text-[11px] font-bold" style={{ color: item.color }}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Featured Near Me */}
        <h2 className="text-sm font-bold text-foreground mt-3 mb-0.5">Featured Near Me</h2>
        <p className="text-[10px] text-muted-foreground mb-2">Curated for right now · tap to explore</p>
        <div className="grid grid-cols-4 gap-2 mb-3 stagger">
          {featured.map(cat => (
            <button
              key={cat.id}
              onClick={() => onSwitchTab('places', cat.hint)}
              className="btn-outline-3d flex flex-col items-center justify-center gap-1 py-2.5 rounded-kipita-sm"
              style={{ borderColor: '#3182CE' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#3182CE22' }}>
                <span className="text-2xl">{cat.emoji}</span>
              </div>
              <span className="text-[10px] font-semibold text-center leading-tight whitespace-pre-line text-foreground">
                {cat.label}
              </span>
            </button>
          ))}
        </div>

        {/* Kipita Perks */}
        <button
          onClick={() => onSwitchTab('perks')}
          className="btn-outline-3d w-full flex items-center justify-between gap-3 px-4 py-3 rounded-kipita mt-1"
          style={{ borderColor: '#805AD5' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🎁</span>
            <span className="text-sm font-extrabold text-foreground">Kipita Perks</span>
          </div>
          <span className="ms text-muted-foreground text-xl">chevron_right</span>
        </button>


      </div>
    </div>
  );
}
