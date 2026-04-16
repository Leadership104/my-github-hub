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

  const quickTools = [
    { emoji: '🌐', label: 'Translate', action: () => onSwitchTab('places', 'phrases') },
    { emoji: '💱', label: 'Currency', action: () => onSwitchTab('wallet') },
    { emoji: '🛡️', label: 'Safety', action: () => onSwitchTab('safety') },
    { emoji: '🗺️', label: 'Maps', action: () => onSwitchTab('maps') },
    { emoji: '👥', label: 'Groups', action: () => onSwitchTab('groups') },
    { emoji: '🔍', label: 'Places', action: () => onSwitchTab('places') },
  ];

  /* 5-level safety dots: red(danger) → orange → yellow → lime → green(safe) */
  const level = safetyResult?.level ?? -1;
  const DOT_CONFIG = [
    { threshold: (l: number) => l <= 0, active: 'bg-destructive', inactive: 'bg-destructive/20' },
    { threshold: (l: number) => l <= 1, active: 'bg-orange-400', inactive: 'bg-orange-400/20' },
    { threshold: (l: number) => l === 2, active: 'bg-yellow-400', inactive: 'bg-yellow-400/20' },
    { threshold: (l: number) => l >= 3, active: 'bg-lime-400', inactive: 'bg-lime-400/20' },
    { threshold: (l: number) => l >= 4, active: 'bg-kipita-green', inactive: 'bg-kipita-green/20' },
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
            <div className="text-right">
              <span className="text-white/80 text-[11px] font-semibold leading-tight max-w-[100px] block">
                {safetyResult ? safetyResult.label : 'Loading…'}
              </span>
              {safetyResult && (
                <span className="text-[9px] font-bold" style={{ color: safetyResult.color }}>
                  {safetyResult.score}/100
                </span>
              )}
            </div>
            <div className="flex flex-col gap-[2px]">
              {DOT_CONFIG.map((dot, i) => (
                <span key={i} className={`w-[8px] h-[8px] rounded-full ${
                  level >= 0 && dot.threshold(level) ? dot.active : dot.inactive
                }`} />
              ))}
            </div>
            <span className="text-white/40 text-xs">▸</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-24">
        {/* Essentials */}
        <h3 className="text-sm font-bold text-foreground mb-3">Essentials</h3>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {essentials.map(t => (
            <button key={t.label} onClick={t.action}
              className="flex flex-col items-center gap-2 p-3.5 bg-card border border-border rounded-kipita hover:shadow-md transition-all">
              <span className="text-2xl">{t.emoji}</span>
              <span className="text-xs font-semibold text-foreground">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Quick Tools */}
        <h3 className="text-sm font-bold text-foreground mb-3">Quick Tools</h3>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {quickTools.map(t => (
            <button key={t.label} onClick={t.action}
              className="flex flex-col items-center gap-2 p-3.5 bg-card border border-border rounded-kipita hover:shadow-md transition-all">
              <span className="text-2xl">{t.emoji}</span>
              <span className="text-xs font-semibold text-foreground">{t.label}</span>
            </button>
          ))}
        </div>

        {/* AI CTA */}
        <button onClick={() => onSwitchTab('ai')}
          className="w-full flex items-center gap-3 bg-gradient-to-r from-[#1a1a2e] to-kipita-red rounded-kipita p-4 mb-5 text-left hover:scale-[1.01] transition-transform">
          <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
            <span className="ms text-white text-xl">auto_awesome</span>
          </div>
          <div className="flex-1">
            <div className="text-white font-extrabold text-sm">Kipita AI</div>
            <div className="text-white/60 text-xs mt-0.5">Plan trips · Safety · Bitcoin · Translate</div>
          </div>
          <span className="ms text-white/40 text-xl">chevron_right</span>
        </button>

        {/* Perks & Deals */}
        <h3 className="text-sm font-bold text-foreground mb-3">🎁 Perks & Deals</h3>
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
