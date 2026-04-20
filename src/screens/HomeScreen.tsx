import { useState, useEffect, useCallback } from 'react';
import { PERKS } from '../data';
import type { TabId } from '../types';
import type { ForecastDay } from '../hooks';
import { useTravelSafety } from '../hooks';
import { computeSafetyScore, advisoryToBaseRates, detectTimeOfDay, safetyLevel } from '../lib/safetyEngine';

interface Props {
  weather: { emoji: string; temp: string; desc: string };
  forecast: ForecastDay[];
  locationName: string;
  fullAddress?: string;
  countryCode?: string;
  onSwitchTab: (tab: TabId, hint?: string) => void;
}

export default function HomeScreen({ weather, forecast, locationName, fullAddress, countryCode, onSwitchTab }: Props) {
  // Live safety data from travel-advisory.info
  const liveSafety = useTravelSafety(countryCode);

  // Compute Kipita Safety Score
  const [safetyResult, setSafetyResult] = useState<{ score: number; level: number; label: string; color: string } | null>(null);

  useEffect(() => {
    if (!liveSafety) return;
    // Convert advisory raw score to base rates and compute
    const rawScore = liveSafety.rawScore ?? 2.5;
    const baseRates = advisoryToBaseRates(rawScore);
    const timeOfDay = detectTimeOfDay();
    const result = computeSafetyScore({
      context: 'AWAY', // default for travelers
      situational: { timeOfDay, density: 'residential', events: 'none', weather: 'normal' },
      baseRates,
    });
    const sl = safetyLevel(result.score);
    setSafetyResult({ score: result.score, ...sl });
  }, [liveSafety]);

  // Abbreviate location: show city, state abbreviation
  const abbreviatedLocation = (() => {
    const name = locationName || 'Detecting…';
    // Already short format like "New York, US"
    return name;
  })();

  const essentials = [
    { emoji: '🍽️', label: 'Food', action: () => onSwitchTab('places', 'food') },
    { emoji: '☕', label: 'Coffee', action: () => onSwitchTab('places', 'cafe') },
    { emoji: '⛽', label: 'Gas', action: () => onSwitchTab('places', 'gas') },
    { emoji: '🏥', label: 'Medical', action: () => onSwitchTab('places', 'medical') },
    { emoji: '🏧', label: 'ATM', action: () => onSwitchTab('maps', 'atm') },
    { emoji: '🚇', label: 'Transit', action: () => onSwitchTab('places', 'transport') },
  ];

  /* ── 3-level category drill-down ── */
  type SubChip = { label: string; hint: string; emoji: string };
  type SubGroup = { label: string; emoji: string; subs: SubChip[] };
  type TopCat = { id: string; label: string; emoji: string; color: string; groups: SubGroup[] };

  const TOP_CATEGORIES: TopCat[] = [
    {
      id: 'restaurants', label: 'Restaurants', emoji: '🍽️', color: 'shadow-sm',
      groups: [
        { label: 'Food', emoji: '🍽️', subs: [
          { label: 'American', hint: 'food', emoji: '🍔' },
          { label: 'Italian', hint: 'food', emoji: '🍝' },
          { label: 'Mexican', hint: 'food', emoji: '🌮' },
          { label: 'Japanese', hint: 'food', emoji: '🍱' },
          { label: 'Chinese', hint: 'food', emoji: '🥡' },
          { label: 'Pizza', hint: 'food', emoji: '🍕' },
          { label: 'All Food', hint: 'food', emoji: '🍽️' },
        ]},
        { label: 'Cafés', emoji: '☕', subs: [
          { label: 'Coffee', hint: 'cafe', emoji: '☕' },
          { label: 'Boba / Tea', hint: 'cafe', emoji: '🧋' },
          { label: 'Bakery Café', hint: 'cafe', emoji: '🥐' },
          { label: 'All Cafés', hint: 'cafe', emoji: '🍵' },
        ]},
        { label: 'Drinks & Bars', emoji: '🍸', subs: [
          { label: 'Cocktail Bar', hint: 'drinks', emoji: '🍸' },
          { label: 'Brewery', hint: 'drinks', emoji: '🍺' },
          { label: 'Wine Bar', hint: 'drinks', emoji: '🍷' },
          { label: 'Rooftop', hint: 'drinks', emoji: '🌃' },
          { label: 'All Bars', hint: 'drinks', emoji: '🥂' },
        ]},
      ],
    },
    {
      id: 'entertainment', label: 'Entertainment', emoji: '🎭', color: 'shadow-sm',
      groups: [
        { label: 'Nightlife', emoji: '🎵', subs: [
          { label: 'Nightclub', hint: 'nightlife', emoji: '🎉' },
          { label: 'Live Music', hint: 'nightlife', emoji: '🎵' },
          { label: 'Pub', hint: 'nightlife', emoji: '🍺' },
          { label: 'Rooftop', hint: 'nightlife', emoji: '🌃' },
        ]},
        { label: 'Attractions', emoji: '🎡', subs: [
          { label: 'Museums', hint: 'places', emoji: '🏛️' },
          { label: 'Tours', hint: 'places', emoji: '🗺️' },
          { label: 'Theme Parks', hint: 'places', emoji: '🎢' },
          { label: 'Landmarks', hint: 'places', emoji: '🗽' },
          { label: 'Events', hint: 'places', emoji: '🎪' },
        ]},
        { label: 'Outdoors', emoji: '🏖️', subs: [
          { label: 'Beach', hint: 'places', emoji: '🏖️' },
          { label: 'Park', hint: 'places', emoji: '🌳' },
          { label: 'Hiking', hint: 'places', emoji: '🥾' },
        ]},
      ],
    },
    {
      id: 'shopping', label: 'Shopping', emoji: '🛍️', color: 'shadow-sm',
      groups: [
        { label: 'Stores', emoji: '🛍️', subs: [
          { label: 'Mall', hint: 'shop', emoji: '🏬' },
          { label: 'Clothing', hint: 'shop', emoji: '👔' },
          { label: 'Electronics', hint: 'shop', emoji: '📱' },
          { label: 'Local Market', hint: 'shop', emoji: '🏪' },
          { label: 'All Shops', hint: 'shop', emoji: '🛍️' },
        ]},
        { label: 'Groceries', emoji: '🛒', subs: [
          { label: 'Supermarket', hint: 'shop', emoji: '🛒' },
          { label: 'Convenience', hint: 'shop', emoji: '🏪' },
        ]},
      ],
    },
    {
      id: 'essentials', label: 'Essentials', emoji: '🧰', color: 'shadow-sm',
      groups: [
        { label: 'Transport', emoji: '🚗', subs: [
          { label: 'Gas Stations', hint: 'gas', emoji: '⛽' },
          { label: 'Transit', hint: 'transport', emoji: '🚇' },
          { label: 'EV Charging', hint: 'places', emoji: '⚡' },
          { label: 'Auto Care', hint: 'places', emoji: '🔧' },
        ]},
        { label: 'Medical', emoji: '🏥', subs: [
          { label: 'Hospital', hint: 'hospital', emoji: '🏥' },
          { label: 'Pharmacy', hint: 'pharmacy', emoji: '💊' },
          { label: 'Urgent Care', hint: 'medical', emoji: '⚕️' },
          { label: 'Dentist', hint: 'medical', emoji: '🦷' },
        ]},
        { label: 'Money', emoji: '🏧', subs: [
          { label: 'ATM', hint: 'atm', emoji: '🏧' },
          { label: 'BTC ATM', hint: 'atm', emoji: '₿' },
        ]},
        { label: 'Stay', emoji: '🏨', subs: [
          { label: 'Hotel', hint: 'hotel', emoji: '🏨' },
          { label: 'Hostel', hint: 'hotel', emoji: '🛏️' },
          { label: 'Resort', hint: 'hotel', emoji: '🏖️' },
        ]},
      ],
    },
  ];

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const currentCat = TOP_CATEGORIES.find(c => c.id === activeCat) || null;
  const currentGroup = currentCat?.groups.find(g => g.label === activeGroup) || null;

  /* 5-level safety dots */
  const level = safetyResult?.level ?? -1;
  const DOTS = [
    { min: 0, color: '#ef4444', label: 'Unsafe' },
    { min: 1, color: '#f97316', label: 'Risky' },
    { min: 2, color: '#eab308', label: 'Moderate' },
    { min: 3, color: '#84cc16', label: 'Safer' },
    { min: 4, color: '#22c55e', label: 'Safe' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Location + Safety advisory bar (dark section) */}
      <div className="bg-gradient-to-br from-kipita-navy to-[#16213e] px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate leading-tight">{abbreviatedLocation}</p>
          </div>
        <button onClick={() => onSwitchTab('safety')}
            className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              {DOTS.map((dot, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <span className="w-[10px] h-[10px] rounded-full transition-all"
                    style={{
                      backgroundColor: level >= dot.min ? dot.color : `${dot.color}25`,
                      boxShadow: level === dot.min ? `0 0 6px ${dot.color}` : 'none',
                    }} />
                </div>
              ))}
            </div>
            <span className="text-[11px] font-bold ml-1" style={{ color: safetyResult?.color ?? '#64748b' }}>
              {safetyResult?.label ?? '…'}
            </span>
            <span className="text-white/40 text-xs">▸</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-24">
        {/* AI CTA - Moved to top */}
        <button onClick={() => onSwitchTab('ai')}
          className="w-full flex items-center gap-3 bg-card rounded-kipita p-4 mb-5 text-left hover:shadow-md transition-shadow shadow-sm">
          <div className="w-11 h-11 rounded-full bg-kipita-red-lt flex items-center justify-center">
            <span className="ms text-kipita-red text-xl">auto_awesome</span>
          </div>
          <div className="flex-1">
            <div className="text-foreground font-extrabold text-sm">Kipita AI : Know Before You Go</div>
            <div className="text-muted-foreground text-xs mt-0.5">Gain Insights BEFORE you travel.</div>
          </div>
          <span className="ms text-muted-foreground text-xl">chevron_right</span>
        </button>

        {/* Top Categories: 4 square tiles drilling down to subcategories */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {TOP_CATEGORIES.map(c => (
            <button key={c.id}
              onClick={() => {
                if (activeCat === c.id) { setActiveCat(null); setActiveGroup(null); }
                else { setActiveCat(c.id); setActiveGroup(null); }
              }}
              className={`aspect-square rounded-kipita-sm text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 px-1 bg-card text-foreground border ${
                activeCat === c.id ? c.color + ' shadow-md' : 'border-border'
              }`}>
              <span className="text-xl">{c.emoji}</span>
              <span className="leading-tight text-center">{c.label}</span>
            </button>
          ))}
        </div>

        {/* Level 2: subcategory groups — single horizontal scroll line on light gray */}
        {currentCat && (
          <div className="bg-muted/60 rounded-kipita-sm p-2 mb-2 -mx-1">
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-1" style={{ scrollbarWidth: 'none' }}>
              {currentCat.groups.map(g => (
                <button key={g.label}
                  onClick={() => setActiveGroup(activeGroup === g.label ? null : g.label)}
                  className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-semibold border whitespace-nowrap transition-all bg-card text-foreground ${
                    activeGroup === g.label
                      ? 'shadow-sm'
                      : 'border-border'
                  }`}>
                  <span className="mr-1">{g.emoji}</span>{g.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Level 3: final subcategory chips — single horizontal scroll line on light gray */}
        {currentGroup && (
          <div className="bg-muted/60 rounded-kipita-sm p-2 mb-5 -mx-1">
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-1" style={{ scrollbarWidth: 'none' }}>
              {currentGroup.subs.map(s => (
                <button key={s.label}
                  onClick={() => onSwitchTab(s.hint === 'atm' ? 'maps' : 'places', s.hint)}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-card border border-border rounded-full text-xs font-semibold text-foreground whitespace-nowrap hover:shadow-sm transition-colors">
                  <span>{s.emoji}</span>{s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Kipita Perks */}
        <h3 className="text-sm font-bold text-foreground mb-3">🎁 Kipita Perks</h3>
        <div className="space-y-2 mb-5">
          {PERKS.filter(p => p.category === 'btc').slice(0, 3).map(p => (
            <a key={p.title} href={p.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-card border border-border rounded-kipita-sm hover:shadow-md transition-all no-underline">
              <span className="text-xl flex-shrink-0">{p.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-foreground">{p.title}</div>
                <div className="text-[10px] text-muted-foreground truncate">{p.desc}</div>
              </div>
              <span className="ms text-muted-foreground text-sm flex-shrink-0">chevron_right</span>
            </a>
          ))}
        </div>

        {/* Upside */}
        <a href="https://upside.com/" target="_blank" rel="noopener noreferrer"
          className="block w-full bg-gradient-to-r from-kipita-green to-emerald-500 rounded-kipita p-4 mb-6 hover:opacity-90 transition-opacity no-underline">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⛽</span>
            <div className="flex-1">
              <div className="text-white font-extrabold text-sm">Upside — Cash Back</div>
              <div className="text-white/70 text-xs mt-0.5">Earn cash back on gas, food & groceries.</div>
            </div>
            <span className="ms text-white/60 text-xl">chevron_right</span>
          </div>
        </a>
      </div>
    </div>
  );
}
