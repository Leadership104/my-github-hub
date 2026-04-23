import { useState } from 'react';
import { PERKS } from '../data';

interface Props {
  onBack: () => void;
}

const CATEGORY_TABS = [
  { id: 'all', label: 'All', emoji: '🎁' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'btc', label: 'Bitcoin', emoji: '₿' },
  { id: 'tools', label: 'Tools', emoji: '🛠️' },
];

export default function PerksScreen({ onBack }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filtered = activeCategory === 'all' ? PERKS : PERKS.filter(p => p.category === activeCategory);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <span className="ms text-xl text-foreground">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">🎁 Kipita Perks</h1>
          <p className="text-xs text-muted-foreground">Exclusive deals for Kipita users</p>
        </div>
      </div>

      {/* Category tabs */}
      <div className="bg-card border-b border-border flex-shrink-0 px-4">
        <div className="flex gap-1 py-2 overflow-x-auto no-scrollbar" style={{ scrollbarWidth: 'none' }}>
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeCategory === tab.id
                  ? 'bg-kipita-red text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Perks list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Hero banner */}
        <div className="bg-gradient-to-r from-kipita-red to-rose-500 rounded-kipita p-4 mb-5 text-white">
          <div className="font-extrabold text-sm mb-1">Members-Only Savings</div>
          <div className="text-white/80 text-xs">Use your exclusive codes to unlock partner deals below.</div>
        </div>

        <div className="space-y-3">
          {filtered.map(p => (
            <a
              key={p.title}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-card border border-border rounded-kipita-sm hover:shadow-md transition-all no-underline"
            >
              <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">{p.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{p.title}</span>
                  {p.expiry !== 'Ongoing' && (
                    <span className="text-[9px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {p.expiry}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{p.desc}</div>
                {p.code && (
                  <div className="inline-flex items-center gap-1 mt-1.5 bg-kipita-red/10 border border-kipita-red/30 rounded px-2 py-0.5">
                    <span className="text-[10px] font-mono font-bold text-kipita-red">{p.code}</span>
                  </div>
                )}
              </div>
              <span className="ms text-muted-foreground text-lg flex-shrink-0">chevron_right</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
