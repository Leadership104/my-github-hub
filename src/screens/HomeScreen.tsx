import { useState, useEffect } from 'react';
import HorizontalScroller from '../components/HorizontalScroller';
import type { TabId } from '../types';
import type { ForecastDay } from '../hooks';
import { useTravelSafety } from '../hooks';
import { computeSafetyScore, advisoryToBaseRates, detectTimeOfDay, safetyLevel } from '../lib/safetyEngine';
import { getDestinationDetails } from '../lib/destinationSearch';
import { CATEGORY_SUBS } from '../data';

interface Props {
  weather: { emoji: string; temp: string; desc: string };
  forecast: ForecastDay[];
  locationName: string;
  fullAddress?: string;
  countryCode?: string;
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

  if (hour >= 23 || hour < 4) {
    return [
      { id: 'nightlife', emoji: '🌃', label: 'Nightlife', hint: 'nightlife', chips: nightlife },
      { id: 'atm', emoji: '🏧', label: 'ATM', hint: 'atm', chips: ESSENTIAL_CHIPS.atm },
      { id: 'late', emoji: '🍔', label: 'Late Eats', hint: 'food', chips: food },
      { id: 'gas', emoji: '⛽', label: 'Gas', hint: 'gas', chips: gas },
    ];
  }
  if (hour >= 18) {
    return [
      { id: 'dinner', emoji: '🍽️', label: 'Dinner', hint: 'food', chips: food },
      { id: 'drinks', emoji: '🍸', label: 'Drinks', hint: 'drinks', chips: drinks },
      { id: 'attractions', emoji: '🎭', label: 'Attractions', hint: 'attractions', chips: attractions },
      { id: 'coffee', emoji: '☕', label: 'Coffee', hint: 'cafe', chips: cafes },
    ];
  }
  if (isWeekend && hour < 12) {
    return [
      { id: 'farmers', emoji: '🌽', label: "Farmers\nMarket", hint: 'farmers_market', chips: shop },
      { id: 'attractions', emoji: '🎭', label: 'Attractions', hint: 'attractions', chips: attractions },
      { id: 'brunch', emoji: '☕', label: 'Brunch', hint: 'cafe', chips: cafes },
      { id: 'shop', emoji: '🛍️', label: 'Shopping', hint: 'shop', chips: shop },
    ];
  }
  if (hour < 11) {
    return [
      { id: 'coffee', emoji: '☕', label: 'Coffee', hint: 'cafe', chips: cafes },
      { id: 'auto', emoji: '🔧', label: 'Auto\nRepair', hint: 'mechanic', chips: [] },
      { id: 'gas', emoji: '⛽', label: 'Gas', hint: 'gas', chips: gas },
      { id: 'breakfast', emoji: '🥐', label: 'Breakfast', hint: 'food', chips: food },
    ];
  }
  return [
    { id: 'lunch', emoji: '🍽️', label: 'Lunch', hint: 'food', chips: food },
    { id: 'attractions', emoji: '🎭', label: 'Attractions', hint: 'attractions', chips: attractions },
    { id: 'shop', emoji: '🛍️', label: 'Shopping', hint: 'shop', chips: shop },
    { id: 'pharmacy', emoji: '🏥', label: 'Pharmacy', hint: 'pharmacy', chips: [] },
  ];
}

export default function HomeScreen({ weather, forecast, locationName, fullAddress, countryCode, onSwitchTab }: Props) {
  const liveSafety = useTravelSafety(countryCode);
  const [safetyResult, setSafetyResult] = useState<{ score: number; level: number; label: string; color: string } | null>(null);
  const [expandedTile, setExpandedTile] = useState<string | null>(null);
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

  useEffect(() => {
    if (!liveSafety) {
      // Country changed or no advisory available — clear the badge so it reflects the new location
      setSafetyResult(null);
      return;
    }
    const rawScore = liveSafety.rawScore ?? 2.5;
    const baseRates = advisoryToBaseRates(rawScore);
    const timeOfDay = detectTimeOfDay();
    const result = computeSafetyScore({
      context: 'AWAY',
      situational: { timeOfDay, density: 'residential', events: 'none', weather: 'normal' },
      baseRates,
    });
    const sl = safetyLevel(result.score);
    setSafetyResult({ score: result.score, ...sl });
  }, [liveSafety, countryCode]);

  const level = safetyResult?.level ?? -1;
  const DOTS = [
    { min: 0, color: '#ef4444' },
    { min: 1, color: '#f97316' },
    { min: 2, color: '#eab308' },
    { min: 3, color: '#84cc16' },
    { min: 4, color: '#22c55e' },
  ];

  const handleEssentialTap = (id: string) => {
    // Toggle chip drawer for tiles that have chips
    if ((ESSENTIAL_CHIPS[id] || []).length > 0) {
      setExpandedTile(prev => prev === id ? null : id);
      return;
    }
    // Fallback direct nav
    switch (id) {
      case 'maps': onSwitchTab('maps'); break;
      case 'atm': onSwitchTab('atm'); break;
      case 'fuel': onSwitchTab('fuel'); break;
    }
  };

  const handleChipTap = (chip: SubChip, parentId: string) => {
    if (parentId === 'fuel') { onSwitchTab('fuel'); return; }
    if (parentId === 'maps') { onSwitchTab('maps'); return; }
    if (parentId === 'atm') { onSwitchTab('atm'); return; }
    if (chip.hint) onSwitchTab('places', chip.hint);
  };

  const ESSENTIALS: { id: string; label: string; render: () => JSX.Element }[] = [
    { id: 'food', label: 'Food', render: () => <span className="text-3xl">🍽️</span> },
    { id: 'fun', label: 'Entertainment', render: () => <span className="text-3xl">🎭</span> },
    { id: 'shopping', label: 'Shopping', render: () => <span className="text-3xl">🛍️</span> },
    { id: 'fuel', label: 'Gas/EV', render: () => <FuelIcon size={36} /> },
    { id: 'maps', label: 'Maps', render: () => <span className="text-3xl">🗺️</span> },
    { id: 'atm', label: 'ATM', render: () => <span className="text-3xl">🏧</span> },
  ];

  const featured = getFeaturedNearMe();

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

      {/* Safety bar */}
      <div className="relative bg-gradient-to-br from-kipita-navy to-[#16213e] px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate leading-tight">{locationName || 'Detecting…'}</p>
          </div>
          <button onClick={() => onSwitchTab('safety')} className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              {DOTS.map((dot, i) => (
                <span key={i} className="w-[10px] h-[10px] rounded-full transition-all"
                  style={{
                    backgroundColor: level >= dot.min ? dot.color : `${dot.color}25`,
                    boxShadow: level === dot.min ? `0 0 6px ${dot.color}` : 'none',
                  }} />
              ))}
            </div>
            <span className="text-[11px] font-bold ml-1" style={{ color: safetyResult?.color ?? '#64748b' }}>
              {safetyResult?.label ?? '…'}
            </span>
            <span className="text-white/40 text-xs">▸</span>
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto px-4 pt-4 pb-24">

        {/* AI CTA */}
        <button onClick={() => onSwitchTab('ai')}
          className="btn-3d w-full flex items-center gap-3 glass rounded-kipita p-4 mb-5 text-left">
          <div className="w-11 h-11 rounded-full bg-kipita-red-lt flex items-center justify-center">
            <span className="ms text-kipita-red text-xl">auto_awesome</span>
          </div>
          <div className="flex-1">
            <div className="text-foreground font-extrabold text-sm">Kipita AI</div>
            <div className="text-muted-foreground text-xs mt-0.5">powered insights</div>
          </div>
          <span className="ms text-muted-foreground text-xl">chevron_right</span>
        </button>

        {/* Essentials Grid */}
        <h2 className="text-sm font-bold text-foreground mb-3">Essentials</h2>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {ESSENTIALS.map(item => {
            const isExpanded = expandedTile === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleEssentialTap(item.id)}
                aria-expanded={isExpanded}
                className={`btn-3d flex flex-col items-center justify-center gap-2 py-5 glass rounded-kipita-sm transition-all ${isExpanded ? 'ring-2 ring-kipita-red/60' : ''}`}
              >
                {item.render()}
                <span className="text-xs font-bold text-foreground">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Expanded chip drawer for any essential */}
        {expandedTile && (ESSENTIAL_CHIPS[expandedTile] || []).length > 0 && (
          <div className="glass rounded-kipita-sm p-3 mb-4 animate-float-in">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {ESSENTIALS.find(e => e.id === expandedTile)?.label} · tap to explore
              </p>
              <button
                onClick={() => setExpandedTile(null)}
                className="text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="@container">
              <HorizontalScroller className="snap-x snap-mandatory -mx-1 px-1">
                <div className="flex gap-2 pb-1 w-max">
                  {ESSENTIAL_CHIPS[expandedTile].map(chip => (
                    <button
                      key={chip.label}
                      onClick={() => { handleChipTap(chip, expandedTile); setExpandedTile(null); }}
                      className="btn-3d flex items-center gap-2 px-4 py-2.5 bg-card rounded-full text-left snap-start flex-shrink-0"
                    >
                      <span className="text-lg flex-shrink-0">{chip.emoji}</span>
                      <span className="text-xs font-semibold text-foreground whitespace-nowrap">{chip.label}</span>
                    </button>
                  ))}
                </div>
              </HorizontalScroller>
            </div>
          </div>
        )}

        {/* Featured Near Me */}
        <h2 className="text-sm font-bold text-foreground mt-4 mb-1">Featured Near Me</h2>
        <p className="text-[10px] text-muted-foreground mb-3">Curated for right now · tap to expand</p>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {featured.map(cat => {
            const isExpanded = expandedTile === `f:${cat.id}`;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  if (cat.chips.length > 0) {
                    setExpandedTile(prev => prev === `f:${cat.id}` ? null : `f:${cat.id}`);
                  } else {
                    onSwitchTab('places', cat.hint);
                  }
                }}
                aria-expanded={isExpanded}
                className={`btn-3d flex flex-col items-center justify-center gap-1.5 py-4 rounded-kipita-sm glass transition-all ${isExpanded ? 'ring-2 ring-kipita-red/60' : ''}`}
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span className="text-[10px] font-semibold text-center leading-tight whitespace-pre-line text-foreground">
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Featured chip drawer */}
        {expandedTile?.startsWith('f:') && (() => {
          const id = expandedTile.slice(2);
          const tile = featured.find(f => f.id === id);
          if (!tile || tile.chips.length === 0) return null;
          return (
            <div className="glass rounded-kipita-sm p-3 mb-4 animate-float-in">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {tile.label.replace(/\n/g, ' ')} · open now near you
                </p>
                <button
                  onClick={() => setExpandedTile(null)}
                  className="text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <button
                onClick={() => { onSwitchTab('places', tile.hint); setExpandedTile(null); }}
                className="btn-3d w-full flex items-center justify-center gap-1.5 px-2.5 py-2 mb-2 bg-kipita-red text-white rounded-full"
              >
                <span className="text-base">{tile.emoji}</span>
                <span className="text-[10px] font-bold truncate">View all {tile.label.replace(/\n/g, ' ')}</span>
              </button>
              <div className="@container">
                <HorizontalScroller className="snap-x snap-mandatory -mx-1 px-1">
                  <div className="flex gap-2 pb-1 w-max">
                    {tile.chips.map(chip => (
                      <button
                        key={chip.label}
                        onClick={() => { onSwitchTab('places', chip.hint); setExpandedTile(null); }}
                        className="btn-3d flex items-center gap-2 px-4 py-2.5 bg-card rounded-full text-left snap-start flex-shrink-0"
                      >
                        <span className="text-lg flex-shrink-0">{chip.emoji}</span>
                        <span className="text-xs font-semibold text-foreground whitespace-nowrap">{chip.label}</span>
                      </button>
                    ))}
                  </div>
                </HorizontalScroller>
              </div>
            </div>
          );
        })()}

        {/* Kipita Perks */}
        <button
          onClick={() => onSwitchTab('perks')}
          className="btn-3d w-full flex items-center justify-between gap-3 p-4 glass rounded-kipita mt-2"
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
