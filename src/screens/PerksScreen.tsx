import { useState } from 'react';
import { PERKS } from '../data';
import InAppBrowser from '../components/InAppBrowser';

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
  const [browser, setBrowser] = useState<{ url: string; title: string } | null>(null);

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
          <p className="text-xs text-muted-foreground">Partner brands — tap to visit</p>
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

      {/* Perks list — clean, just brand + link */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(p => (
            <button
              key={p.title}
              onClick={() => setBrowser({ url: p.url, title: p.title })}
              className="flex flex-col items-center justify-center gap-2 p-5 bg-card border border-border rounded-kipita-sm hover:shadow-md hover:border-kipita-red/40 transition-all text-center active:scale-95"
            >
              <span className="text-3xl">{p.icon}</span>
              <span className="text-sm font-bold text-foreground">{p.title}</span>
              <span className="text-[10px] text-kipita-red font-semibold">Visit →</span>
            </button>
          ))}
        </div>
      </div>

      {browser && <InAppBrowser url={browser.url} title={browser.title} onClose={() => setBrowser(null)} />}
    </div>
  );
}
