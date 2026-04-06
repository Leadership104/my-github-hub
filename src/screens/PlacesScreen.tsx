import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UtensilsCrossed, PartyPopper, ShoppingBag, Plane } from 'lucide-react';
import { getCategories, CATEGORY_SUBS } from '../data';
import { supabase } from '@/integrations/supabase/client';

interface LivePlace {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  reviewCount: number;
  priceLevel: string | null;
  photoUrl: string | null;
  photos: string[];
  openNow: boolean | null;
  hours: string[];
  phone: string | null;
  website: string | null;
  types: string[];
  typeLabel: string | null;
  mapsUrl: string | null;
  reviews: { author: string; rating: number; text: string; time: string; photoUrl?: string | null }[];
  summary: string | null;
  source: string;
}

interface Props {
  locationName?: string;
  lat?: number;
  lng?: number;
  initialView?: 'phrases' | 'destinations';
}

async function fetchGooglePlaces(action: string, params: Record<string, unknown>): Promise<LivePlace[]> {
  try {
    const { data, error } = await supabase.functions.invoke('places-proxy', {
      body: { action, ...params },
    });
    if (error) throw error;
    return Array.isArray(data) ? data : data ? [data] : [];
  } catch (e) {
    console.warn('Google Places proxy error:', e);
    return [];
  }
}

export default function PlacesScreen({ locationName = 'Current location', lat = 40.7128, lng = -74.006, initialView }: Props) {
  const [view, setView] = useState<'main' | 'section' | 'category' | 'subcategory' | 'destinations' | 'phrases' | 'detail'>(initialView || 'main');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<{ label: string; query: string } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<LivePlace | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [lang, setLang] = useState('es');
  const [livePlaces, setLivePlaces] = useState<LivePlace[]>([]);
  const [loading, setLoading] = useState(false);
  const categories = getCategories();

  const BIG_SECTIONS = [
    { id: 'restaurants', label: 'Restaurants', icon: UtensilsCrossed, color: 'from-orange-500 to-red-500', catIds: ['food', 'cafe'] },
    { id: 'entertainment', label: 'Entertainment', icon: PartyPopper, color: 'from-purple-500 to-pink-500', catIds: ['nightlife', 'beach', 'gym'] },
    { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: 'from-blue-500 to-cyan-500', catIds: ['shop', 'atm', 'btcatm', 'auto'] },
    { id: 'travel', label: 'Travel', icon: Plane, color: 'from-emerald-500 to-teal-500', catIds: ['hotel', 'transport', 'hospital', 'pharmacy'] },
  ];

  // Auto-refresh results when location changes while viewing a subcategory
  const prevLocRef = React.useRef({ lat, lng });
  React.useEffect(() => {
    if (prevLocRef.current.lat === lat && prevLocRef.current.lng === lng) return;
    prevLocRef.current = { lat, lng };
    if (view === 'subcategory' && selectedSub) {
      // Re-fetch with new location
      (async () => {
        setLoading(true);
        const places = await fetchGooglePlaces('search', { query: `${selectedSub.label} near ${locationName}`, lat, lng, radius: 5000 });
        setLivePlaces(places);
        setLoading(false);
      })();
    }
  }, [lat, lng, locationName, view, selectedSub]);

  const hour = new Date().getHours();
  const greet = hour < 5 ? '🌙 Late Night' : hour < 10 ? '🍳 Good Morning' : hour < 14 ? '☀️ Good Afternoon' : hour < 18 ? '🌤️ Afternoon' : '🌆 Good Evening';

  const openCategory = (catId: string) => { setSelectedCat(catId); setView('category'); };

  const openSubResult = useCallback(async (label: string, query: string) => {
    setSelectedSub({ label, query });
    setView('subcategory');
    setLoading(true);
    const places = await fetchGooglePlaces('search', { query: `${label} near ${locationName}`, lat, lng, radius: 5000 });
    // Sort: open places first, then by distance (lat/lng proximity)
    const sorted = [...places].sort((a, b) => {
      if (a.openNow !== b.openNow) return a.openNow ? -1 : 1;
      const distA = a.lat && a.lng ? Math.hypot(a.lat - lat, a.lng - lng) : 999;
      const distB = b.lat && b.lng ? Math.hypot(b.lat - lat, b.lng - lng) : 999;
      return distA - distB;
    });
    setLivePlaces(sorted);
    setLoading(false);
  }, [lat, lng, locationName]);

  const openPlaceDetail = useCallback(async (place: LivePlace) => {
    setSelectedPlace(place);
    setView('detail');
    // Fetch full details if we have a placeId
    if (place.placeId) {
      const detailed = await fetchGooglePlaces('details', { placeId: place.placeId });
      if (detailed.length > 0) setSelectedPlace(detailed[0]);
    }
  }, []);

  // Place detail view
  if (view === 'detail' && selectedPlace) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-shrink-0">
          <button onClick={() => setView('subcategory')} className="flex items-center gap-1 text-sm text-muted-foreground px-5 pt-5 mb-2">
            <span className="ms text-lg">arrow_back</span> Back
          </button>
          {/* Photo gallery */}
          {selectedPlace.photos && selectedPlace.photos.length > 0 ? (
            <div className="flex overflow-x-auto scrollbar-hide gap-0.5">
              {selectedPlace.photos.map((url, i) => (
                <img key={i} src={url} alt={`${selectedPlace.name} ${i + 1}`}
                  className="h-48 w-auto object-cover flex-shrink-0" />
              ))}
            </div>
          ) : selectedPlace.photoUrl ? (
            <img src={selectedPlace.photoUrl} alt={selectedPlace.name} className="w-full h-48 object-cover" />
          ) : (
            <div className="w-full h-32 bg-muted flex items-center justify-center text-4xl">📍</div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-24 pt-4">
          <h2 className="text-xl font-extrabold">{selectedPlace.name}</h2>
          {selectedPlace.typeLabel && (
            <span className="inline-block text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full mt-1">
              {selectedPlace.typeLabel}
            </span>
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {selectedPlace.rating && (
              <span className="flex items-center gap-1 text-sm font-bold text-amber-500">
                ⭐ {selectedPlace.rating.toFixed(1)}
              </span>
            )}
            {selectedPlace.reviewCount > 0 && <span className="text-xs text-muted-foreground">({selectedPlace.reviewCount.toLocaleString()} reviews)</span>}
            {selectedPlace.openNow !== null && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${selectedPlace.openNow ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {selectedPlace.openNow ? '● Open Now' : '● Closed'}
              </span>
            )}
            {selectedPlace.priceLevel && (
              <span className="text-xs text-muted-foreground">💰 {selectedPlace.priceLevel.replace('PRICE_LEVEL_', '')}</span>
            )}
          </div>

          {selectedPlace.address && <p className="text-sm text-muted-foreground mt-3">📍 {selectedPlace.address}</p>}
          {selectedPlace.summary && <p className="text-sm text-muted-foreground/80 mt-2 italic">{selectedPlace.summary}</p>}

          {/* Contact */}
          <div className="flex gap-3 mt-3">
            {selectedPlace.phone && (
              <a href={`tel:${selectedPlace.phone}`} className="flex items-center gap-1 text-sm text-blue-600 font-semibold">
                📞 {selectedPlace.phone}
              </a>
            )}
          </div>

          {/* Hours */}
          {selectedPlace.hours && selectedPlace.hours.length > 0 && (
            <div className="mt-4 bg-muted rounded-kipita p-3">
              <p className="text-xs font-bold mb-2">🕐 Opening Hours</p>
              <div className="space-y-1">
                {selectedPlace.hours.map((h, i) => (
                  <div key={i} className="text-xs text-muted-foreground">{h}</div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {selectedPlace.reviews && selectedPlace.reviews.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-bold mb-2">Reviews</p>
              <div className="space-y-3">
                {selectedPlace.reviews.map((r, i) => (
                  <div key={i} className="bg-muted rounded-kipita p-3">
                    <div className="flex items-center gap-2 mb-1">
                      {r.photoUrl && <img src={r.photoUrl} alt="" className="w-6 h-6 rounded-full" />}
                      <span className="text-xs font-bold">{r.author}</span>
                      <span className="text-amber-400 text-xs">{'★'.repeat(r.rating)}</span>
                      {r.time && <span className="text-[10px] text-muted-foreground ml-auto">{r.time}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{r.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            {selectedPlace.mapsUrl && (
              <a href={selectedPlace.mapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center text-sm bg-kipita-red text-white px-4 py-2.5 rounded-kipita-sm font-bold no-underline">📍 Directions</a>
            )}
            {selectedPlace.website && (
              <a href={selectedPlace.website} target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center text-sm bg-muted text-foreground px-4 py-2.5 rounded-kipita-sm font-bold no-underline">🌐 Website</a>
            )}
          </div>
          <div className="text-[9px] text-muted-foreground/50 mt-3 text-center">via {selectedPlace.source}</div>
        </div>
      </div>
    );
  }



  // Subcategory result view with LIVE Google Places data
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
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-card border border-border rounded-kipita overflow-hidden animate-pulse">
                  <div className="w-full h-32 bg-muted" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="flex gap-2">
                      <div className="h-5 bg-muted rounded-full w-14" />
                      <div className="h-5 bg-muted rounded-full w-16" />
                      <div className="h-5 bg-muted rounded-full w-12" />
                    </div>
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="flex gap-2 mt-2">
                      <div className="flex-1 h-8 bg-muted rounded-kipita-sm" />
                      <div className="flex-1 h-8 bg-muted rounded-kipita-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : livePlaces.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">No places found nearby.</div>
          ) : livePlaces.map((p, i) => (
            <button key={p.placeId || i} onClick={() => openPlaceDetail(p)}
              className="w-full bg-card border border-border rounded-kipita overflow-hidden text-left hover:shadow-md transition-shadow">
              {p.photoUrl && (
                <img src={p.photoUrl} alt={p.name} className="w-full h-32 object-cover" />
              )}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {!p.photoUrl && (
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl flex-shrink-0">📍</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{p.name}</div>
                    {p.typeLabel && <div className="text-xs text-muted-foreground mt-0.5">{p.typeLabel}</div>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {p.openNow !== null && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.openNow ? 'bg-kipita-green/20 text-kipita-green' : 'bg-muted text-muted-foreground'}`}>
                          {p.openNow ? 'OPEN' : 'CLOSED'}
                        </span>
                      )}
                      {p.rating && <span className="text-xs text-amber-500 font-bold">⭐ {p.rating}</span>}
                      {p.reviewCount > 0 && <span className="text-xs text-muted-foreground">({p.reviewCount.toLocaleString()})</span>}
                      {p.priceLevel && <span className="text-xs text-muted-foreground">{p.priceLevel.replace('PRICE_LEVEL_', '')}</span>}
                    </div>
                    {p.address && <div className="text-xs text-muted-foreground mt-1 truncate">{p.address}</div>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <a href={p.mapsUrl || `https://www.google.com/maps/search/${encodeURIComponent(p.name)}`} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex-1 flex items-center justify-center gap-1 bg-muted text-foreground py-2 rounded-kipita-sm text-xs font-semibold no-underline">
                    <span className="ms text-sm">directions</span> DIRECTIONS
                  </a>
                  <span className="flex-1 flex items-center justify-center gap-1 bg-muted text-foreground py-2 rounded-kipita-sm text-xs font-semibold">
                    <span className="ms text-sm">info</span> MORE INFO
                  </span>
                </div>
              </div>
            </button>
          ))}
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
          <button onClick={() => selectedSection ? setView('section') : setView('main')} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
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

  // Section view — shows categories within a big section
  if (view === 'section' && selectedSection) {
    const section = BIG_SECTIONS.find(s => s.id === selectedSection);
    const sectionCats = categories.filter(c => section?.catIds.includes(c.id));
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <button onClick={() => { setView('main'); setSelectedSection(null); }} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
            <span className="ms text-lg">arrow_back</span> Back
          </button>
          <div className="flex items-center gap-3">
            {section && <section.icon className="w-7 h-7 text-foreground" />}
            <h2 className="text-xl font-extrabold">{section?.label}</h2>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <span className="ms text-sm">location_on</span> {locationName}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-24 pt-3">
          <p className="text-sm text-muted-foreground mb-4">Choose a category:</p>
          <div className="grid grid-cols-2 gap-3">
            {sectionCats.map(cat => (
              <button key={cat.id} onClick={() => openCategory(cat.id)}
                className="flex flex-col items-center gap-3 p-5 bg-card border border-border rounded-kipita hover:shadow-md transition-all text-center">
                <span className="text-3xl">{cat.emoji}</span>
                <span className="text-sm font-bold text-foreground">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Main places view
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <h2 className="text-xl font-extrabold mb-1">Explore</h2>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <span className="ms text-sm">location_on</span> {locationName}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-24 pt-3">
        <p className="text-sm font-semibold text-muted-foreground mb-4">{greet} — Find places nearby</p>

        {/* 4 Big Category Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {BIG_SECTIONS.map(section => (
            <button key={section.id} onClick={() => { setSelectedSection(section.id); setView('section'); }}
              className={`flex flex-col items-center justify-center gap-3 p-6 bg-gradient-to-br ${section.color} rounded-kipita text-white shadow-lg hover:shadow-xl transition-all active:scale-95`}>
              <section.icon className="w-10 h-10" />
              <span className="text-base font-extrabold tracking-wide">{section.label}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}