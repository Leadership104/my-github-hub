import { useState, useEffect } from 'react';
import type { TabId } from '../types';
import type { ForecastDay } from '../hooks';
import { useTravelSafety } from '../hooks';
import { computeSafetyScore, advisoryToBaseRates, detectTimeOfDay, safetyLevel } from '../lib/safetyEngine';
import { getDestinationDetails } from '../lib/destinationSearch';

interface Props {
  weather: { emoji: string; temp: string; desc: string };
  forecast: ForecastDay[];
  locationName: string;
  fullAddress?: string;
  countryCode?: string;
  onSwitchTab: (tab: TabId, hint?: string) => void;
}

const FOOD_SUBS = [
  { emoji: '🍽️', label: 'Restaurants', hint: 'food' },
  { emoji: '🍸', label: 'Drinks', hint: 'drinks' },
  { emoji: '☕', label: 'Coffee', hint: 'cafe' },
  { emoji: '🍺', label: 'Bars', hint: 'nightlife' },
];

type FeaturedTile = { emoji: string; label: string; hint: string };

/** Situation-aware featured tiles based on time of day + day of week. */
function getFeaturedNearMe(): FeaturedTile[] {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  if (hour >= 23 || hour < 4) {
    return [
      { emoji: '🌃', label: 'Nightlife', hint: 'nightlife' },
      { emoji: '🏧', label: 'ATM', hint: 'atm' },
      { emoji: '🍔', label: 'Late Eats', hint: 'food' },
      { emoji: '⛽', label: 'Gas', hint: 'gas' },
    ];
  }
  if (hour >= 18) {
    return [
      { emoji: '🍽️', label: 'Dinner', hint: 'food' },
      { emoji: '🍻', label: 'Bars', hint: 'drinks' },
      { emoji: '🎭', label: 'Attractions', hint: 'attractions' },
      { emoji: '☕', label: 'Coffee', hint: 'coffee' },
    ];
  }
  if (isWeekend && hour < 12) {
    return [
      { emoji: '🌽', label: "Farmers\nMarket", hint: 'farmers_market' },
      { emoji: '🎭', label: 'Attractions', hint: 'attractions' },
      { emoji: '☕', label: 'Brunch', hint: 'coffee' },
      { emoji: '🛍️', label: 'Shopping', hint: 'shop' },
    ];
  }
  if (hour < 11) {
    return [
      { emoji: '☕', label: 'Coffee', hint: 'coffee' },
      { emoji: '🔧', label: 'Auto\nRepair', hint: 'mechanic' },
      { emoji: '⛽', label: 'Gas', hint: 'gas' },
      { emoji: '🥐', label: 'Breakfast', hint: 'food' },
    ];
  }
  return [
    { emoji: '🍽️', label: 'Lunch', hint: 'food' },
    { emoji: '🎭', label: 'Attractions', hint: 'attractions' },
    { emoji: '🛍️', label: 'Shopping', hint: 'shop' },
    { emoji: '🏥', label: 'Pharmacy', hint: 'pharmacy' },
  ];
}

export default function HomeScreen({ weather, forecast, locationName, fullAddress, countryCode, onSwitchTab }: Props) {
  const liveSafety = useTravelSafety(countryCode);
  const [safetyResult, setSafetyResult] = useState<{ score: number; level: number; label: string; color: string } | null>(null);
  const [foodExpanded, setFoodExpanded] = useState(false);
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
    if (!liveSafety) return;
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
  }, [liveSafety]);

  const level = safetyResult?.level ?? -1;
  const DOTS = [
    { min: 0, color: '#ef4444' },
    { min: 1, color: '#f97316' },
    { min: 2, color: '#eab308' },
    { min: 3, color: '#84cc16' },
    { min: 4, color: '#22c55e' },
  ];

  const handleEssentialTap = (id: string) => {
    switch (id) {
      case 'food': setFoodExpanded(prev => !prev); break;
      case 'fun': onSwitchTab('places', 'nightlife'); break;
      case 'shopping': onSwitchTab('places', 'shop'); break;
      case 'fuel': onSwitchTab('fuel'); break;
      case 'maps': onSwitchTab('maps'); break;
      case 'atm': onSwitchTab('atm'); break;
    }
  };

  const ESSENTIALS = [
    { id: 'food', emoji: '🍽️', label: 'Food' },
    { id: 'fun', emoji: '🎭', label: 'Fun' },
    { id: 'shopping', emoji: '🛍️', label: 'Shopping' },
    { id: 'fuel', emoji: '⛽', label: 'Fuel' },
    { id: 'maps', emoji: '🗺️', label: 'Maps' },
    { id: 'atm', emoji: '🏧', label: 'ATM' },
  ];

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
        <div className="grid grid-cols-3 gap-3 mb-2">
          {ESSENTIALS.map(item => (
            <button
              key={item.id}
              onClick={() => handleEssentialTap(item.id)}
              className="btn-3d flex flex-col items-center justify-center gap-2 py-5 glass rounded-kipita-sm"
            >
              <span className="text-3xl">{item.emoji}</span>
              <span className="text-xs font-bold text-foreground">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Food sub-options */}
        {foodExpanded && (
          <div className="glass rounded-kipita-sm p-3 mb-3 animate-float-in">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Choose a category</p>
            <div className="grid grid-cols-4 gap-2">
              {FOOD_SUBS.map(sub => (
                <button
                  key={sub.label}
                  onClick={() => { onSwitchTab('places', sub.hint); setFoodExpanded(false); }}
                  className="btn-3d flex flex-col items-center gap-1.5 py-3 bg-card rounded-kipita-sm"
                >
                  <span className="text-xl">{sub.emoji}</span>
                  <span className="text-[10px] font-semibold text-foreground text-center leading-tight">{sub.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Featured Near Me */}
        <h2 className="text-sm font-bold text-foreground mt-4 mb-1">Featured Near Me</h2>
        <p className="text-[10px] text-muted-foreground mb-3">Curated for right now · 1-tap</p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {getFeaturedNearMe().map(cat => (
            <button
              key={cat.label}
              onClick={() => onSwitchTab('places', cat.hint)}
              className="btn-3d flex flex-col items-center justify-center gap-1.5 py-4 rounded-kipita-sm glass"
            >
              <span className="text-2xl">{cat.emoji}</span>
              <span className="text-[10px] font-semibold text-center leading-tight whitespace-pre-line text-foreground">
                {cat.label}
              </span>
            </button>
          ))}
        </div>

        {/* Kipita Perks */}
        <button
          onClick={() => onSwitchTab('perks')}
          className="btn-3d w-full flex items-center justify-between gap-3 p-4 glass rounded-kipita"
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
