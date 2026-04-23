import { useState, useEffect } from 'react';
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

const FOOD_SUBS = [
  { emoji: '🍽️', label: 'Restaurants', hint: 'food' },
  { emoji: '🍸', label: 'Drinks', hint: 'drinks' },
  { emoji: '☕', label: 'Coffee', hint: 'cafe' },
  { emoji: '🍺', label: 'Bars', hint: 'bars' },
];

type FeaturedCategory = { emoji: string; label: string; hint: string; featured: boolean };

function getSituationalCategories(): FeaturedCategory[] {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  const isWeekend = day === 0 || day === 6;

  if (hour >= 6 && hour < 11) {
    // Morning
    return isWeekend
      ? [
          { emoji: '🌽', label: "Farmers\nMarket", hint: 'market', featured: true },
          { emoji: '☕', label: 'Coffee', hint: 'cafe', featured: true },
          { emoji: '🎭', label: 'Attractions', hint: 'attractions', featured: false },
          { emoji: '🛍️', label: 'Shopping', hint: 'shop', featured: false },
        ]
      : [
          { emoji: '☕', label: 'Coffee', hint: 'cafe', featured: true },
          { emoji: '🍳', label: 'Breakfast', hint: 'breakfast', featured: true },
          { emoji: '⛽', label: 'Fuel', hint: 'fuel', featured: false },
          { emoji: '🔧', label: 'Auto\nRepair', hint: 'auto-repair', featured: false },
        ];
  }

  if (hour >= 11 && hour < 17) {
    // Afternoon
    return [
      { emoji: '🎭', label: 'Attractions', hint: 'attractions', featured: true },
      { emoji: '🛍️', label: 'Shopping', hint: 'shop', featured: true },
      { emoji: '🌽', label: "Farmers\nMarket", hint: 'market', featured: false },
      { emoji: '🔧', label: 'Auto\nRepair', hint: 'auto-repair', featured: false },
    ];
  }

  if (hour >= 17 && hour < 21) {
    // Evening
    return [
      { emoji: '🍽️', label: 'Dinner', hint: 'dinner', featured: true },
      { emoji: '🍺', label: 'Bars', hint: 'bars', featured: true },
      { emoji: '🎭', label: 'Shows', hint: 'attractions', featured: false },
      { emoji: '🏧', label: 'ATM', hint: 'atm', featured: false },
    ];
  }

  // Night
  return [
    { emoji: '🎉', label: 'Nightlife', hint: 'nightlife', featured: true },
    { emoji: '🍜', label: 'Late Night', hint: 'food', featured: true },
    { emoji: '🏧', label: 'ATM', hint: 'atm', featured: false },
    { emoji: '⛽', label: 'Fuel', hint: 'fuel', featured: false },
  ];
}

export default function HomeScreen({ weather, forecast, locationName, fullAddress, countryCode, onSwitchTab }: Props) {
  const liveSafety = useTravelSafety(countryCode);
  const [safetyResult, setSafetyResult] = useState<{ score: number; level: number; label: string; color: string } | null>(null);
  const [foodExpanded, setFoodExpanded] = useState(false);

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

  /* 5-level safety dots */
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
      case 'food':
        setFoodExpanded(prev => !prev);
        break;
      case 'fun':
        onSwitchTab('places', 'nightlife');
        break;
      case 'shopping':
        onSwitchTab('places', 'shop');
        break;
      case 'fuel':
        onSwitchTab('fuel');
        break;
      case 'maps':
        onSwitchTab('maps');
        break;
      case 'atm':
        onSwitchTab('atm');
        break;
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Safety bar */}
      <div className="bg-gradient-to-br from-kipita-navy to-[#16213e] px-4 py-3 flex-shrink-0">
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

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">

        {/* AI CTA — Know B4 U Go */}
        <button onClick={() => onSwitchTab('ai')}
          className="w-full flex items-center gap-3 bg-card rounded-kipita p-4 mb-5 text-left hover:shadow-md transition-shadow shadow-sm">
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
              className={`flex flex-col items-center justify-center gap-2 py-5 bg-card border rounded-kipita-sm shadow-sm transition-all hover:shadow-md active:scale-95 ${
                item.id === 'food' && foodExpanded ? 'border-kipita-red' : 'border-border'
              }`}
            >
              <span className="text-3xl">{item.emoji}</span>
              <span className="text-xs font-bold text-foreground">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Food sub-options (expandable) */}
        {foodExpanded && (
          <div className="bg-muted/60 rounded-kipita-sm p-3 mb-3 -mx-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Choose a category</p>
            <div className="grid grid-cols-4 gap-2">
              {FOOD_SUBS.map(sub => (
                <button
                  key={sub.label}
                  onClick={() => { onSwitchTab('places', sub.hint); setFoodExpanded(false); }}
                  className="flex flex-col items-center gap-1.5 py-3 bg-card border border-border rounded-kipita-sm hover:shadow-sm transition-all active:scale-95"
                >
                  <span className="text-xl">{sub.emoji}</span>
                  <span className="text-[10px] font-semibold text-foreground text-center leading-tight">{sub.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Featured Near Me — situation-based */}
        <h2 className="text-sm font-bold text-foreground mt-4 mb-3">Featured Near Me</h2>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {getSituationalCategories().map(cat => (
            <button
              key={cat.label}
              onClick={() => {
                if (cat.hint === 'fuel') onSwitchTab('fuel');
                else if (cat.hint === 'atm') onSwitchTab('atm');
                else onSwitchTab('places', cat.hint);
              }}
              className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-kipita-sm border-2 transition-all hover:shadow-sm active:scale-95 ${
                cat.featured
                  ? 'bg-card border-yellow-400'
                  : 'bg-muted/40 border-border'
              }`}
            >
              <span className="text-2xl">{cat.emoji}</span>
              <span className={`text-[10px] font-semibold text-center leading-tight whitespace-pre-line ${cat.featured ? 'text-foreground' : 'text-muted-foreground'}`}>
                {cat.label}
              </span>
            </button>
          ))}
        </div>

        {/* Kipita Perks button */}
        <button
          onClick={() => onSwitchTab('perks')}
          className="w-full flex items-center justify-between gap-3 p-4 bg-card border-2 border-kipita-green rounded-kipita shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
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
