import { useState } from 'react';
import { DESTINATIONS, TRANSPORT_LINKS } from '../data';
import type { TabId } from '../types';

interface Props {
  weather: { emoji: string; temp: string; desc: string };
  locationName: string;
  onSwitchTab: (tab: TabId) => void;
}

export default function HomeScreen({ weather, locationName, onSwitchTab }: Props) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning ✈️' : hour < 18 ? 'Good afternoon 🌤️' : 'Good evening 🌙';

  const quickTools = [
    { emoji: '🌐', label: 'Translate', tab: 'places' as TabId },
    { emoji: '₿', label: 'BTC Map', tab: 'maps' as TabId },
    { emoji: '💱', label: 'Currency', tab: 'wallet' as TabId },
    { emoji: '🛡️', label: 'Safety', tab: 'home' as TabId },
    { emoji: '📍', label: 'Nearby', tab: 'places' as TabId },
    { emoji: '👥', label: 'Groups', tab: 'groups' as TabId },
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
        <button className="mt-3 flex items-center gap-1.5 text-white/60 text-xs font-medium">
          <span>{weather.emoji}</span>
          <span>{weather.temp}</span>
          <span>·</span>
          <span>{weather.desc}</span>
          <span>·</span>
          <span>{locationName}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-24">
        {/* Quick Tools */}
        <h3 className="text-sm font-bold text-foreground mb-3">Quick Tools</h3>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {quickTools.map(t => (
            <button key={t.label} onClick={() => onSwitchTab(t.tab)}
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

        {/* Popular Destinations */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">Popular Destinations</h3>
          <button onClick={() => onSwitchTab('places')} className="text-xs text-kipita-red font-semibold">See all</button>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
          {DESTINATIONS.filter(d => d.popular).map(d => (
            <div key={d.id} className="flex-shrink-0 w-44 bg-card border border-border rounded-kipita overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-24 bg-gradient-to-br from-kipita-navy to-kipita-red/60 flex items-center justify-center text-4xl">
                {d.emoji}
              </div>
              <div className="p-3">
                <div className="font-bold text-sm">{d.city}</div>
                <div className="text-xs text-muted-foreground">{d.country}</div>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-xs text-kipita-btc font-bold">⭐ {d.rating}</span>
                  <span className="text-xs text-muted-foreground">· ${d.monthlyCost}/mo</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
