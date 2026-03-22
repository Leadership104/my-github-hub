import { useState } from 'react';
import { getCategories, CATEGORY_SUBS, DESTINATIONS, PHRASES, generateDemoPlaces } from '../data';
import type { DemoPlace } from '../types';

interface Props {
  locationName?: string;
}

export default function PlacesScreen({ locationName = 'Current location' }: Props) {
  const [view, setView] = useState<'main' | 'category' | 'subcategory' | 'destinations' | 'phrases'>('main');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<{ label: string; query: string } | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [lang, setLang] = useState('es');
  const [demoPlaces, setDemoPlaces] = useState<DemoPlace[]>([]);
  const categories = getCategories();

  const hour = new Date().getHours();
  const greet = hour < 5 ? '🌙 Late Night' : hour < 10 ? '🍳 Good Morning' : hour < 14 ? '☀️ Good Afternoon' : hour < 18 ? '🌤️ Afternoon' : '🌆 Good Evening';

  const openCategory = (catId: string) => { setSelectedCat(catId); setView('category'); };

  const openSubResult = (label: string, query: string) => {
    setSelectedSub({ label, query });
    setDemoPlaces(generateDemoPlaces(query, label, 6, locationName));
    setView('subcategory');
  };

  if (view === 'phrases') {
    const phraseData = PHRASES[lang];
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <button onClick={() => setView('main')} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
            <span className="ms text-lg">arrow_back</span> Back
          </button>
          <h2 className="text-xl font-extrabold">Travel Phrases</h2>
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
            {Object.entries(PHRASES).map(([key, val]) => (
              <button key={key} onClick={() => setLang(key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${lang === key ? 'bg-kipita-red text-white' : 'bg-muted text-muted-foreground'}`}>
                {val.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-24 pt-3">
          {phraseData?.phrases.map((p, i) => (
            <div key={i} className="bg-card border border-border rounded-kipita p-4 mb-3">
              <div className="text-xs text-muted-foreground font-semibold mb-1">English</div>
              <div className="text-sm font-bold mb-2">{p.en}</div>
              <div className="text-xs text-muted-foreground font-semibold mb-1">{phraseData.label.split(' ')[1]}</div>
              <div className="text-lg font-extrabold text-kipita-red">{p.local}</div>
              <div className="text-xs text-muted-foreground mt-1 italic">🔊 {p.phon}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'destinations') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <button onClick={() => setView('main')} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
            <span className="ms text-lg">arrow_back</span> Back
          </button>
          <h2 className="text-xl font-extrabold">Nomad Destinations</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-24 pt-3 space-y-3">
          {DESTINATIONS.map(d => (
            <div key={d.id} className="bg-card border border-border rounded-kipita p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-kipita-navy to-kipita-red/40 flex items-center justify-center text-2xl flex-shrink-0">{d.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base">{d.city}, {d.country}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {d.tags.map(t => <span key={t} className="bg-muted text-muted-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">{t}</span>)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div><span className="text-muted-foreground">Safety</span><div className="font-bold text-kipita-green">{d.safetyScore}/10</div></div>
                    <div><span className="text-muted-foreground">WiFi</span><div className="font-bold">{d.speed} Mbps</div></div>
                    <div><span className="text-muted-foreground">Cost</span><div className="font-bold">${d.monthlyCost}/mo</div></div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{d.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Subcategory result view with demo places
  if (view === 'subcategory' && selectedSub) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <button onClick={() => setView('category')} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
            <span className="ms text-lg">arrow_back</span> Back
          </button>
          <h2 className="text-xl font-extrabold">{selectedSub.label}</h2>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <span className="ms text-sm">location_on</span> {locationName}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-24 pt-3 space-y-3">
          {demoPlaces.map((p, i) => (
            <div key={i} className="bg-card border border-border rounded-kipita overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl flex-shrink-0">{p.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{selectedSub.label}</div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.isOpen ? 'bg-kipita-green/20 text-kipita-green' : 'bg-muted text-muted-foreground'}`}>
                        {p.isOpen ? 'OPEN' : 'CLOSED'}
                      </span>
                      <span className="text-xs text-muted-foreground">⭐ {p.rating}</span>
                      <span className="text-xs text-muted-foreground">({p.reviews})</span>
                      <span className="text-xs text-muted-foreground">{p.price}</span>
                      <span className="text-xs text-muted-foreground">{p.dist}mi</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{p.addr}</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <a href={`https://www.google.com/maps/search/${encodeURIComponent(p.name)}`} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1 bg-muted text-foreground py-2 rounded-kipita-sm text-xs font-semibold no-underline">
                    <span className="ms text-sm">directions</span> DIRECTIONS
                  </a>
                  <button className="flex-1 flex items-center justify-center gap-1 bg-muted text-foreground py-2 rounded-kipita-sm text-xs font-semibold">
                    <span className="ms text-sm">info</span> MORE INFO
                  </button>
                </div>
              </div>
            </div>
          ))}
          <a href={`https://www.google.com/maps/search/${encodeURIComponent(selectedSub.query)}${''}`} target="_blank" rel="noopener noreferrer"
            className="block text-center text-kipita-red text-sm font-bold py-3 no-underline">
            See more on Google Maps →
          </a>
        </div>
      </div>
    );
  }

  if (view === 'category' && selectedCat) {
    const cat = categories.find(c => c.id === selectedCat);
    const subs = CATEGORY_SUBS[selectedCat] || [];
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <button onClick={() => setView('main')} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
            <span className="ms text-lg">arrow_back</span> Back
          </button>
          <h2 className="text-xl font-extrabold">{cat?.emoji} {cat?.label}</h2>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <span className="ms text-sm">location_on</span> {locationName}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-24 pt-3">
          {subs.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">Choose a type of {cat?.label.toLowerCase()}:</p>
              <div className="grid grid-cols-2 gap-3">
                {subs.map(s => (
                  <button key={s.label} onClick={() => openSubResult(s.label, s.query)}
                    className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-kipita hover:shadow-md transition-all text-center">
                    <span className="text-2xl">{s.emoji}</span>
                    <span className="text-xs font-semibold text-foreground">{s.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <a href={`https://www.google.com/maps/search/${encodeURIComponent(cat?.query || '')}`} target="_blank" rel="noopener noreferrer"
              className="block bg-card border border-border rounded-kipita p-6 text-center hover:shadow-md no-underline">
              <span className="text-4xl block mb-3">{cat?.emoji}</span>
              <span className="text-sm font-bold text-foreground">Search {cat?.label} on Google Maps</span>
              <span className="block text-xs text-muted-foreground mt-1">Opens in a new tab</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  // Main places view
  const filteredCats = searchQ ? categories.filter(c => c.label.toLowerCase().includes(searchQ.toLowerCase())) : categories;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <h2 className="text-xl font-extrabold mb-1">Explore</h2>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <span className="ms text-sm">location_on</span> {locationName}
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-kipita-sm px-3 py-2.5">
          <span className="ms text-muted-foreground text-lg">search</span>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search categories…"
            className="flex-1 bg-transparent outline-none text-sm" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-24 pt-3">
        <p className="text-sm font-semibold text-muted-foreground mb-4">{greet} — Find places nearby</p>

        {/* Feature buttons */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button onClick={() => setView('destinations')}
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-kipita-navy to-kipita-navy-card rounded-kipita text-left">
            <span className="text-2xl">🌍</span>
            <div><div className="text-white font-bold text-sm">Destinations</div><div className="text-white/50 text-[10px]">Nomad scores</div></div>
          </button>
          <button onClick={() => setView('phrases')}
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-kipita-red to-kipita-red-dk rounded-kipita text-left">
            <span className="text-2xl">🌐</span>
            <div><div className="text-white font-bold text-sm">Phrases</div><div className="text-white/50 text-[10px]">10 languages · 20+ phrases</div></div>
          </button>
        </div>

        {/* Category grid */}
        <h3 className="text-sm font-bold mb-3">Nearby Places</h3>
        <div className="grid grid-cols-3 gap-3">
          {filteredCats.map(cat => (
            <button key={cat.id} onClick={() => openCategory(cat.id)}
              className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-kipita hover:shadow-md transition-all">
              <span className="text-2xl">{cat.emoji}</span>
              <span className="text-xs font-semibold text-foreground">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
