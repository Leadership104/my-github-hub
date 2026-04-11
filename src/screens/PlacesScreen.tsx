import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UtensilsCrossed, BedDouble, Car, ShoppingCart, HeartPulse, Compass, Clock, MapPin, Star, ChefHat, Navigation, Search, Fuel, Shirt, Monitor, Sparkles, Zap, Wine } from 'lucide-react';
import { getCategories, CATEGORY_SUBS } from '../data';
import { supabase } from '@/integrations/supabase/client';
import { haversine, useDragScroll } from '../hooks';

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
  closingTime: string | null;
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

/* ── Drive time estimate from haversine distance ── */
function estimateDriveTime(distKm: number): string {
  // Avg city driving ~25 km/h
  const minutes = Math.round((distKm / 25) * 60);
  if (minutes < 1) return '< 1 min';
  if (minutes === 1) return '1 min';
  return `${minutes} min`;
}

/* ── Extract must-try dish from reviews ── */
function extractMustTry(reviews: LivePlace['reviews']): string | null {
  if (!reviews || reviews.length === 0) return null;
  // Food-related keywords to look for in reviews
  const foodPatterns = [
    /must.?try[:\s]+(?:the\s+)?([^.!,]{3,40})/i,
    /recommend[:\s]+(?:the\s+)?([^.!,]{3,40})/i,
    /best\s+([^.!,]{3,30})\s+(?:I've|i've|we've|ever)/i,
    /amazing\s+([^.!,]{3,30})/i,
    /incredible\s+([^.!,]{3,30})/i,
    /outstanding\s+([^.!,]{3,30})/i,
    /try\s+(?:the\s+)?([^.!,]{3,30})/i,
    /loved\s+(?:the\s+)?([^.!,]{3,30})/i,
    /(\w+\s+\w+(?:\s+\w+)?)\s+(?:was|is|were)\s+(?:incredible|amazing|outstanding|excellent|perfect|delicious)/i,
  ];

  for (const review of reviews) {
    if (review.rating < 4) continue;
    for (const pattern of foodPatterns) {
      const match = review.text.match(pattern);
      if (match?.[1]) {
        const dish = match[1].trim();
        // Filter out non-food phrases
        if (dish.length > 3 && dish.length < 40 && !dish.match(/^(place|restaurant|service|staff|waiter|view|atmosphere|experience|visit|time)/i)) {
          return dish.charAt(0).toUpperCase() + dish.slice(1);
        }
      }
    }
  }

  // Fallback: look for the most-mentioned food words in 4-5 star reviews
  const topReview = reviews.find(r => r.rating >= 4 && r.text.length > 20);
  if (topReview) {
    // Extract first sentence as a highlight
    const firstSentence = topReview.text.split(/[.!]/)[0]?.trim();
    if (firstSentence && firstSentence.length < 60) return `"${firstSentence}"`;
  }
  return null;
}

/* ── Check if closing within N minutes ── */
function isClosingSoon(closingTime: string | null, withinMinutes = 30): boolean {
  if (!closingTime) return false;
  const [h, m] = closingTime.split(':').map(Number);
  const now = new Date();
  const closeMinutes = h * 60 + m;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diff = closeMinutes - nowMinutes;
  return diff > 0 && diff <= withinMinutes;
}

/* ── Cuisine types for the food guide ── */
const CUISINE_FILTERS = [
  { id: 'all', label: 'All', emoji: '🍽️' },
  { id: 'italian', label: 'Italian', emoji: '🍝' },
  { id: 'japanese', label: 'Japanese', emoji: '🍱' },
  { id: 'mexican', label: 'Mexican', emoji: '🌮' },
  { id: 'chinese', label: 'Chinese', emoji: '🥡' },
  { id: 'thai', label: 'Thai', emoji: '🍜' },
  { id: 'indian', label: 'Indian', emoji: '🍛' },
  { id: 'american', label: 'American', emoji: '🍔' },
  { id: 'mediterranean', label: 'Mediterranean', emoji: '🥙' },
  { id: 'korean', label: 'Korean', emoji: '🥘' },
  { id: 'vietnamese', label: 'Vietnamese', emoji: '🍲' },
  { id: 'seafood', label: 'Seafood', emoji: '🦞' },
  { id: 'steakhouse', label: 'Steakhouse', emoji: '🥩' },
];

export default function PlacesScreen({ locationName = 'Current location', lat = 40.7128, lng = -74.006, initialView }: Props) {
  const [view, setView] = useState<'main' | 'section' | 'category' | 'subcategory' | 'detail' | 'foodguide'>(initialView === 'phrases' || initialView === 'destinations' ? 'main' : (initialView || 'main') as any);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<{ label: string; query: string } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<LivePlace | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [livePlaces, setLivePlaces] = useState<LivePlace[]>([]);
  const [loading, setLoading] = useState(false);
  const categories = getCategories();

  // Food Guide state
  const [selectedCuisine, setSelectedCuisine] = useState('all');
  const [foodGuidePlaces, setFoodGuidePlaces] = useState<LivePlace[]>([]);
  const [foodGuideLoading, setFoodGuideLoading] = useState(false);
  const cuisineScrollRef = useDragScroll<HTMLDivElement>();
  const chipsScrollRef = useDragScroll<HTMLDivElement>();

  const BIG_SECTIONS = [
    { id: 'eat', label: 'Food & Drinks', emoji: '🍽️', icon: UtensilsCrossed, catIds: ['food', 'cafe', 'drinks'] },
    { id: 'stay', label: 'Places to Stay', emoji: '🏨', icon: BedDouble, catIds: ['hotel'] },
    { id: 'transport', label: 'Transport', emoji: '🚗', icon: Car, catIds: ['transport', 'auto', 'gas', 'ev'] },
    { id: 'shop', label: 'Shopping', emoji: '🛍️', icon: ShoppingCart, catIds: ['shop'] },
    { id: 'money', label: 'ATM', emoji: '🏧', icon: MapPin, catIds: ['atm', 'btcatm'] },
    { id: 'health', label: 'Health', emoji: '💊', icon: HeartPulse, catIds: ['hospital', 'pharmacy', 'gym', 'spa'] },
    { id: 'explore', label: 'Entertainment', emoji: '🎭', icon: Compass, catIds: ['nightlife', 'beach', 'attractions'] },
    { id: 'library', label: 'Libraries', emoji: '📚', icon: Monitor, catIds: ['library'] },
  ];

  // Auto-refresh results when location changes while viewing a subcategory
  const prevLocRef = React.useRef({ lat, lng });
  React.useEffect(() => {
    if (prevLocRef.current.lat === lat && prevLocRef.current.lng === lng) return;
    prevLocRef.current = { lat, lng };
    if (view === 'subcategory' && selectedSub) {
      (async () => {
        setLoading(true);
        const places = await fetchGooglePlaces('search', { query: `${selectedSub.label} near ${locationName}`, lat, lng, radius: 5000 });
        setLivePlaces(places);
        setLoading(false);
      })();
    }
    if (view === 'foodguide') {
      loadFoodGuide(selectedCuisine);
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
    if (place.placeId) {
      const detailed = await fetchGooglePlaces('details', { placeId: place.placeId });
      if (detailed.length > 0) setSelectedPlace(detailed[0]);
    }
  }, []);

  /* ── Food Guide loader ── */
  const loadFoodGuide = useCallback(async (cuisine: string) => {
    setFoodGuideLoading(true);
    const query = cuisine === 'all'
      ? `restaurants near ${locationName}`
      : `authentic ${cuisine} restaurant near ${locationName}`;
    const places = await fetchGooglePlaces('search', { query, lat, lng, radius: 8000 }); // ~10 min drive radius

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Filter: open and not closing within 30 min
    const filtered = places.filter(p => {
      if (p.openNow === false) return false;
      if (p.closingTime && isClosingSoon(p.closingTime, 30)) return false;
      return true;
    });

    // Sort by proximity (closest first)
    const sorted = [...filtered].sort((a, b) => {
      const distA = a.lat && a.lng ? haversine(lat, lng, a.lat, a.lng) : 9999;
      const distB = b.lat && b.lng ? haversine(lat, lng, b.lat, b.lng) : 9999;
      return distA - distB;
    });

    // Only include within ~10 min drive (~7 km in city)
    const nearby = sorted.filter(p => {
      if (!p.lat || !p.lng) return true;
      return haversine(lat, lng, p.lat, p.lng) <= 7;
    });

    setFoodGuidePlaces(nearby.length > 0 ? nearby : sorted.slice(0, 10));
    setFoodGuideLoading(false);
  }, [lat, lng, locationName]);

  const openFoodGuide = useCallback(async () => {
    setView('foodguide');
    setSelectedCuisine('all');
    await loadFoodGuide('all');
  }, [loadFoodGuide]);

  const changeCuisine = useCallback(async (cuisine: string) => {
    setSelectedCuisine(cuisine);
    await loadFoodGuide(cuisine);
  }, [loadFoodGuide]);

  // Place detail view
  if (view === 'detail' && selectedPlace) {
    const backView = selectedPlace ? (foodGuidePlaces.length > 0 ? 'section' : 'subcategory') : 'subcategory';
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-shrink-0">
          <button onClick={() => setView(backView as any)} className="flex items-center gap-1 text-sm text-muted-foreground px-5 pt-5 mb-2">
            <span className="ms text-lg">arrow_back</span> Back
          </button>
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
            {selectedPlace.closingTime && selectedPlace.openNow && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isClosingSoon(selectedPlace.closingTime) ? 'bg-amber-100 text-amber-700' : 'text-muted-foreground'}`}>
                Closes {selectedPlace.closingTime}
              </span>
            )}
            {selectedPlace.priceLevel && (
              <span className="text-xs text-muted-foreground">💰 {selectedPlace.priceLevel.replace('PRICE_LEVEL_', '')}</span>
            )}
          </div>

          {selectedPlace.address && <p className="text-sm text-muted-foreground mt-3">📍 {selectedPlace.address}</p>}
          {selectedPlace.summary && <p className="text-sm text-muted-foreground/80 mt-2 italic">{selectedPlace.summary}</p>}

          {/* Must-try dish */}
          {(() => {
            const mustTry = extractMustTry(selectedPlace.reviews);
            return mustTry ? (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-kipita p-3 flex items-start gap-2">
                <ChefHat className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-800">Must-Try</p>
                  <p className="text-xs text-amber-700">{mustTry}</p>
                </div>
              </div>
            ) : null;
          })()}

          {/* Drive time */}
          {selectedPlace.lat && selectedPlace.lng && (
            <div className="flex items-center gap-1.5 mt-3 text-sm text-muted-foreground">
              <Navigation className="w-3.5 h-3.5" />
              <span>~{estimateDriveTime(haversine(lat, lng, selectedPlace.lat, selectedPlace.lng))} drive</span>
              <span className="text-muted-foreground/50">({haversine(lat, lng, selectedPlace.lat, selectedPlace.lng).toFixed(1)} km)</span>
            </div>
          )}

          <div className="flex gap-3 mt-3">
            {selectedPlace.phone && (
              <a href={`tel:${selectedPlace.phone}`} className="flex items-center gap-1 text-sm text-blue-600 font-semibold">
                📞 {selectedPlace.phone}
              </a>
            )}
          </div>

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

  /* ── Food Guide View ── */
  if (view === 'foodguide') {
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-5 pt-5 pb-2 flex-shrink-0">
          <button onClick={() => setView('main')} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
            <span className="ms text-lg">arrow_back</span> Back
          </button>
          <div className="flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-foreground" />
            <h2 className="text-xl font-extrabold">Local Food Guide</h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {locationName}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {currentTime}</span>
          </div>
          <p className="text-[11px] text-muted-foreground/70 mt-1">Open now · within 10 min drive · sorted by closest</p>

          {/* Cuisine filter chips */}
          <div ref={cuisineScrollRef} className="flex gap-2 overflow-x-auto scrollbar-hide mt-3 pb-2 -mx-1 px-1">
            {CUISINE_FILTERS.map(c => (
              <button key={c.id} onClick={() => changeCuisine(c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex-shrink-0
                  ${selectedCuisine === c.id
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-card border-border text-foreground hover:shadow-sm'
                  }`}>
                <span>{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-24 pt-3 space-y-3">
          {foodGuideLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-card border border-border rounded-kipita overflow-hidden animate-pulse">
                  <div className="flex gap-3 p-4">
                    <div className="w-20 h-20 bg-muted rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                      <div className="flex gap-2">
                        <div className="h-5 bg-muted rounded-full w-14" />
                        <div className="h-5 bg-muted rounded-full w-16" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : foodGuidePlaces.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-4xl block mb-3">🍽️</span>
              <p className="text-sm font-semibold text-foreground">No open restaurants found</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different cuisine or check back later</p>
            </div>
          ) : foodGuidePlaces.map((p, i) => {
            const distKm = p.lat && p.lng ? haversine(lat, lng, p.lat, p.lng) : null;
            const driveTime = distKm ? estimateDriveTime(distKm) : null;
            const mustTry = extractMustTry(p.reviews);
            const closingSoon = isClosingSoon(p.closingTime);

            return (
              <button key={p.placeId || i} onClick={() => openPlaceDetail(p)}
                className="w-full bg-card border border-border rounded-kipita overflow-hidden text-left hover:shadow-md transition-shadow">
                <div className="flex gap-3 p-4">
                  {/* Photo or placeholder */}
                  <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Name & type */}
                    <div className="font-bold text-sm truncate">{p.name}</div>
                    {p.typeLabel && <div className="text-[10px] text-muted-foreground">{p.typeLabel}</div>}

                    {/* Rating + Drive time row */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {p.rating && (
                        <span className="flex items-center gap-0.5 text-xs font-bold text-amber-500">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {p.rating.toFixed(1)}
                        </span>
                      )}
                      {p.reviewCount > 0 && <span className="text-[10px] text-muted-foreground">({p.reviewCount.toLocaleString()})</span>}
                      {driveTime && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Navigation className="w-2.5 h-2.5" /> {driveTime}
                        </span>
                      )}
                      {p.priceLevel && <span className="text-[10px] text-muted-foreground">{p.priceLevel.replace('PRICE_LEVEL_', '')}</span>}
                    </div>

                    {/* Open status */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">OPEN</span>
                      {p.closingTime && (
                        <span className={`text-[10px] ${closingSoon ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}`}>
                          {closingSoon ? '⚠ Closing soon' : `Closes ${p.closingTime}`}
                        </span>
                      )}
                    </div>

                    {/* Must-try dish */}
                    {mustTry && (
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full w-fit max-w-full truncate">
                        <ChefHat className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">{mustTry}</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
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

    // For 'eat' section, integrate food guide at top
    if (selectedSection === 'eat') {
      const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="px-5 pt-5 pb-2 flex-shrink-0">
            <button onClick={() => { setView('main'); setSelectedSection(null); }} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
              <span className="ms text-lg">arrow_back</span> Back
            </button>
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="w-7 h-7 text-foreground" />
              <h2 className="text-xl font-extrabold">Food & Drinks</h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {locationName}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {currentTime}</span>
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-1">Open now · within 10 min drive · sorted by closest</p>

            {/* Unified browse chips — deduplicated, horizontal scroll */}
            <div ref={chipsScrollRef} className="flex gap-2 overflow-x-auto scrollbar-hide mt-3 pb-2 -mx-1 px-1">
              {(() => {
                const seen = new Set<string>();
                const allChips: { label: string; query: string; emoji: string; key: string }[] = [];
                sectionCats.forEach(cat => {
                  (CATEGORY_SUBS[cat.id] || []).forEach(sub => {
                    const norm = sub.label.toLowerCase().replace(/[^a-z]/g, '');
                    if (!seen.has(norm)) {
                      seen.add(norm);
                      allChips.push({ ...sub, key: `${cat.id}-${sub.label}` });
                    }
                  });
                });
                return allChips.map(chip => (
                  <button key={chip.key} onClick={() => openSubResult(chip.label, chip.query)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border bg-card border-border text-foreground hover:shadow-sm transition-all flex-shrink-0">
                    <span>{chip.emoji}</span> {chip.label}
                  </button>
                ));
              })()}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-24 pt-3 space-y-3">

            <h3 className="text-sm font-bold text-foreground">🍴 Nearby Now</h3>

            {foodGuideLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-card border border-border rounded-kipita overflow-hidden animate-pulse">
                    <div className="flex gap-3 p-4">
                      <div className="w-20 h-20 bg-muted rounded-xl flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                        <div className="flex gap-2">
                          <div className="h-5 bg-muted rounded-full w-14" />
                          <div className="h-5 bg-muted rounded-full w-16" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : foodGuidePlaces.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl block mb-3">🍽️</span>
                <p className="text-sm font-semibold text-foreground">No open restaurants found</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different cuisine or check back later</p>
              </div>
            ) : foodGuidePlaces.map((p, i) => {
              const distKm = p.lat && p.lng ? haversine(lat, lng, p.lat, p.lng) : null;
              const driveTime = distKm ? estimateDriveTime(distKm) : null;
              const mustTry = extractMustTry(p.reviews);
              const closingSoon = isClosingSoon(p.closingTime);

              return (
                <button key={p.placeId || i} onClick={() => openPlaceDetail(p)}
                  className="w-full bg-card border border-border rounded-kipita overflow-hidden text-left hover:shadow-md transition-shadow">
                  <div className="flex gap-3 p-4">
                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{p.name}</div>
                      {p.typeLabel && <div className="text-[10px] text-muted-foreground">{p.typeLabel}</div>}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {p.rating && (
                          <span className="flex items-center gap-0.5 text-xs font-bold text-amber-500">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {p.rating.toFixed(1)}
                          </span>
                        )}
                        {p.reviewCount > 0 && <span className="text-[10px] text-muted-foreground">({p.reviewCount.toLocaleString()})</span>}
                        {driveTime && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Navigation className="w-2.5 h-2.5" /> {driveTime}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">OPEN</span>
                        {p.closingTime && (
                          <span className={`text-[10px] ${closingSoon ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}`}>
                            {closingSoon ? '⚠ Closing soon' : `Closes ${p.closingTime}`}
                          </span>
                        )}
                      </div>
                      {mustTry && (
                        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full w-fit max-w-full truncate">
                          <ChefHat className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate">{mustTry}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

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

          {/* If single category, show its subcategory chips directly */}
          {sectionCats.length === 1 && (CATEGORY_SUBS[sectionCats[0].id] || []).length > 0 && (
            <div ref={chipsScrollRef} className="flex gap-2 overflow-x-auto scrollbar-hide mt-3 pb-2 -mx-1 px-1">
              {(CATEGORY_SUBS[sectionCats[0].id] || []).map(sub => (
                <button key={sub.label} onClick={() => openSubResult(sub.label, sub.query)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border bg-card border-border text-foreground hover:shadow-sm transition-all flex-shrink-0">
                  <span>{sub.emoji}</span> {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-24 pt-3">
          {sectionCats.length > 1 ? (
            <>
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
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Tap a type above to find places nearby</p>
          )}
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

        {/* Category Sections */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {BIG_SECTIONS.map(section => (
            <button key={section.id} onClick={() => {
              setSelectedSection(section.id);
              setView('section');
              if (section.id === 'eat') loadFoodGuide('all');
            }}
              className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-kipita hover:shadow-md transition-all active:scale-[0.98]">
              <span className="text-2xl">{section.emoji}</span>
              <span className="text-xs font-semibold text-foreground">{section.label}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
