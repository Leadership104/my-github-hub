import { useState } from 'react';
import { DESTINATIONS, TRANSPORT_LINKS, PERKS } from '../data';
import type { TabId } from '../types';

interface Props {
  weather: { emoji: string; temp: string; desc: string };
  locationName: string;
  onSwitchTab: (tab: TabId, hint?: string) => void;
}

export default function HomeScreen({ weather, locationName, onSwitchTab }: Props) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning ✈️' : hour < 18 ? 'Good afternoon 🌤️' : 'Good evening 🌙';

  const quickTools = [
    { emoji: '🌐', label: 'Translate', action: () => onSwitchTab('places', 'phrases') },
    { emoji: '🏧', label: 'ATM Finder', action: () => onSwitchTab('maps', 'atm') },
    { emoji: '💱', label: 'Currency', action: () => onSwitchTab('wallet') },
    { emoji: '🛡️', label: 'Safety', action: () => onSwitchTab('maps', 'hospital') },
    { emoji: '🗺️', label: 'Maps', action: () => onSwitchTab('maps') },
    { emoji: '👥', label: 'Groups', action: () => onSwitchTab('groups') },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Dark header */}
      <div className="bg-gradient-to-br from-kipita-navy to-[#16213e] px-5 pt-5 pb-6 flex-shrink-0">
        <p className="text-white/70 text-sm font-medium">{greeting}</p>
        <h1 className="text-white text-2xl font-extrabold mt-1">Where to next?</h1>
        <button onClick={() => onSwitchTab('places')}
          className="mt-4 w-full flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-3 text-white/60 text-sm">
          <span className="ms text-lg">search</span>
          Search destinations, hotels, flights…
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-24">
        {/* Quick Tools */}
        <h3 className="text-sm font-bold text-foreground mb-3">Quick Tools</h3>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {quickTools.map(t => (
            <button key={t.label} onClick={t.action}
              className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-kipita hover:shadow-md transition-all">
              <span className="text-2xl">{t.emoji}</span>
              <span className="text-xs font-semibold text-foreground">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Book Transport */}
        <h3 className="text-sm font-bold text-foreground mb-3">Book Transport</h3>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {TRANSPORT_LINKS.map(t => (
            <a key={t.label} href={t.url} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-kipita hover:shadow-md transition-all no-underline">
              <span className="text-2xl">{t.emoji}</span>
              <span className="text-xs font-semibold text-foreground">{t.label}</span>
            </a>
          ))}
        </div>

        {/* AI CTA */}
        <button onClick={() => onSwitchTab('ai')}
          className="w-full flex items-center gap-3 bg-gradient-to-r from-[#1a1a2e] to-kipita-red rounded-kipita p-4 mb-6 text-left hover:scale-[1.01] transition-transform">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <span className="ms text-white text-2xl">auto_awesome</span>
          </div>
          <div className="flex-1">
            <div className="text-white font-extrabold text-sm">Kipita AI</div>
            <div className="text-white/60 text-xs mt-0.5">Plan trips · Safety · Bitcoin · Translate</div>
          </div>
          <span className="ms text-white/40 text-xl">chevron_right</span>
        </button>

        {/* Perks & Deals */}
        <h3 className="text-sm font-bold text-foreground mb-3">🎁 Perks & Deals</h3>
        <div className="space-y-2 mb-6">
          {PERKS.filter(p => p.category === 'btc').slice(0, 3).map(p => (
            <a key={p.title} href={p.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-card border border-border rounded-kipita-sm hover:shadow-md transition-all no-underline">
              <span className="text-xl flex-shrink-0">{p.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-foreground">{p.title}</div>
                <div className="text-[10px] text-muted-foreground truncate">{p.desc}</div>
              </div>
              <div className="bg-kipita-red-lt px-2 py-1 rounded text-[9px] font-bold text-kipita-red flex-shrink-0">{p.code}</div>
            </a>
          ))}
        </div>

        {/* Upside — Cash Back */}
        <a href="https://upside.com/" target="_blank" rel="noopener noreferrer"
          className="block w-full bg-gradient-to-r from-green-600 to-emerald-500 rounded-kipita p-4 mb-6 hover:opacity-90 transition-opacity no-underline">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⛽</span>
            <div className="flex-1">
              <div className="text-white font-extrabold text-sm">Upside — Cash Back</div>
              <div className="text-white/70 text-xs mt-0.5">Earn cash back on gas, food & groceries every time you fill up.</div>
            </div>
            <span className="ms text-white/60 text-xl">chevron_right</span>
          </div>
        </a>

      </div>
    </div>
  );
}
