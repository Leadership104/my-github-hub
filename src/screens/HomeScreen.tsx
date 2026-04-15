import { useState } from 'react';
import { DESTINATIONS, PERKS } from '../data';
import type { TabId } from '../types';
import type { ForecastDay } from '../hooks';

/* Country code → flag emoji */
const codeToFlag = (code?: string) => {
  if (!code || code.length !== 2) return '🌍';
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
};

/* Safety advisory text from score */
const advisoryText = (score?: number) => {
  if (!score) return { text: 'No data', level: 0 };
  if (score >= 9) return { text: 'Exercise normal precautions', level: 4 };
  if (score >= 7.5) return { text: 'Exercise increased caution', level: 3 };
  if (score >= 6) return { text: 'Be aware', level: 2 };
  if (score >= 4) return { text: 'Reconsider travel', level: 1 };
  return { text: 'Do not travel', level: 0 };
};

interface Props {
  weather: { emoji: string; temp: string; desc: string };
  forecast: ForecastDay[];
  locationName: string;
  fullAddress?: string;
  countryCode?: string;
  onSwitchTab: (tab: TabId, hint?: string) => void;
}

export default function HomeScreen({ weather, forecast, locationName, fullAddress, countryCode, onSwitchTab }: Props) {
  const [showSafetyDetail, setShowSafetyDetail] = useState(false);

  const safetyDest = DESTINATIONS.find(d =>
    locationName.toLowerCase().includes(d.city.toLowerCase()) ||
    locationName.toLowerCase().includes(d.country.toLowerCase())
  );
  const safetyScore = safetyDest?.safetyScore;
  const advisory = advisoryText(safetyScore);
  const flag = codeToFlag(countryCode);
  const displayAddress = fullAddress || locationName;

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
    { emoji: '🛡️', label: 'Safety', action: () => onSwitchTab('maps', 'hospital') },
    { emoji: '🗺️', label: 'Maps', action: () => onSwitchTab('maps') },
    { emoji: '👥', label: 'Groups', action: () => onSwitchTab('groups') },
    { emoji: '🔍', label: 'Places', action: () => onSwitchTab('places') },
  ];

  /* 5-level safety indicator */
  const safetyDots = (level: number) => (
    <div className="flex flex-col gap-[2px]">
      <span className={`w-[8px] h-[8px] rounded-full ${level <= 0 ? 'bg-destructive' : 'bg-destructive/20'}`} />
      <span className={`w-[8px] h-[8px] rounded-full ${level <= 1 ? 'bg-orange-400' : 'bg-orange-400/20'}`} />
      <span className={`w-[8px] h-[8px] rounded-full ${level === 2 ? 'bg-yellow-400' : 'bg-yellow-400/20'}`} />
      <span className={`w-[8px] h-[8px] rounded-full ${level >= 3 ? 'bg-lime-400' : 'bg-lime-400/20'}`} />
      <span className={`w-[8px] h-[8px] rounded-full ${level >= 4 ? 'bg-kipita-green' : 'bg-kipita-green/20'}`} />
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Location + Safety advisory bar */}
      <div className="bg-gradient-to-br from-kipita-navy to-[#16213e] px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">{flag}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate leading-tight">{displayAddress}</p>
          </div>
          <button onClick={() => setShowSafetyDetail(!showSafetyDetail)}
            className="flex items-center gap-2 flex-shrink-0">
            <span className="text-white/80 text-[11px] font-semibold text-right leading-tight max-w-[100px]">{advisory.text}</span>
            <span className="text-white/40 text-xs">▸</span>
            {safetyDots(advisory.level)}
          </button>
        </div>
      </div>

      {/* Safety detail expandable */}
      {showSafetyDetail && safetyDest && (
        <div className="bg-card border-b border-border px-4 py-3 space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Safety Details — {safetyDest.city}</span>
            <span className={`text-sm font-extrabold ${safetyScore! >= 8 ? 'text-kipita-green' : safetyScore! >= 6 ? 'text-yellow-500' : 'text-kipita-red'}`}>{safetyScore}/10</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground">Monthly Cost</p>
              <p className="text-xs font-bold">${safetyDest.monthlyCost.toLocaleString()}</p>
            </div>
            <div className="bg-muted rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground">Internet</p>
              <p className="text-xs font-bold">{safetyDest.speed} Mbps</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">{safetyDest.desc}</p>
        </div>
      )}

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
