import React, { useState, useMemo } from 'react';
import { ArrowLeft, MapPin, ExternalLink, Navigation2, Tent, Mountain, Waves, Bike, Snowflake, Compass, Bird, Dumbbell, TreePine, RefreshCw } from 'lucide-react';
import { useOSMRecreation, useNPSParks, useRecreationGov, useDragScroll } from '../hooks';
import type { RecreationCategory, RecreationSpot } from '../types';
import {
  RECREATION_HIGHLIGHTS,
  OUTDOOR_ACTIVITY_GUIDE,
  RECREATION_EXTERNAL_LINKS,
  type RecreationHighlight,
  type ActivityTypeGuide,
} from '../data';

interface Props {
  lat: number;
  lng: number;
  locationName: string;
  countryCode?: string;
  onBack: () => void;
}

const CATEGORY_TABS: { id: RecreationCategory; label: string; emoji: string }[] = [
  { id: 'all',      label: 'All',      emoji: '🌲' },
  { id: 'camping',  label: 'Camping',  emoji: '⛺' },
  { id: 'hiking',   label: 'Hiking',   emoji: '🥾' },
  { id: 'water',    label: 'Water',    emoji: '🌊' },
  { id: 'adventure',label: 'Adventure',emoji: '🧗' },
  { id: 'cycling',  label: 'Cycling',  emoji: '🚴' },
  { id: 'winter',   label: 'Winter',   emoji: '❄️' },
  { id: 'wildlife', label: 'Wildlife', emoji: '🦅' },
  { id: 'fitness',  label: 'Fitness',  emoji: '💪' },
];

const SOURCE_STYLES: Record<RecreationSpot['source'], { label: string; cls: string }> = {
  'recreation.gov': { label: 'Recreation.gov', cls: 'bg-muted text-foreground' },
  'nps':            { label: 'NPS',             cls: 'bg-blue-100 text-blue-800'  },
  'osm':            { label: 'OpenStreetMap',   cls: 'bg-amber-100 text-amber-800'},
  'parks_canada':   { label: 'Parks Canada',    cls: 'bg-red-100 text-red-800'   },
  'featured':       { label: 'Kipita Pick',     cls: 'bg-purple-100 text-purple-800' },
};

const DIFFICULTY_STYLES = {
  easy:     'bg-muted text-foreground',
  moderate: 'bg-amber-100 text-amber-700',
  hard:     'bg-red-100 text-red-700',
};

function SourceBadge({ source }: { source: RecreationSpot['source'] }) {
  const s = SOURCE_STYLES[source];
  return <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${s.cls}`}>{s.label}</span>;
}

function SpotCard({ spot }: { spot: RecreationSpot }) {
  const distLabel = spot.distKm != null
    ? spot.distKm < 1 ? `${Math.round(spot.distKm * 1000)} m` : `${spot.distKm.toFixed(1)} km`
    : null;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-2 animate-fade-in transition-transform hover:scale-[1.01]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <SourceBadge source={spot.source} />
            {spot.difficulty && (
              <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 capitalize ${DIFFICULTY_STYLES[spot.difficulty]}`}>
                {spot.difficulty}
              </span>
            )}
          </div>
          <h4 className="font-extrabold text-sm leading-tight">{spot.name}</h4>
          {spot.parkName && <p className="text-[11px] text-muted-foreground">{spot.parkName}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {distLabel && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Navigation2 className="w-3 h-3" />
              <span>{distLabel}</span>
            </div>
          )}
          {spot.cost && (
            <span className="text-[11px] font-semibold text-foreground">{spot.cost}</span>
          )}
        </div>
      </div>

      {spot.description && (
        <p className="text-[12px] text-muted-foreground leading-snug line-clamp-2">{spot.description}</p>
      )}

      {(spot.activities && spot.activities.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {spot.activities.slice(0, 4).map(act => (
            <span key={act} className="text-[10px] bg-muted rounded-full px-2 py-0.5 font-medium">{act}</span>
          ))}
        </div>
      )}

      {(spot.amenities && spot.amenities.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {spot.amenities.slice(0, 4).map(a => (
            <span key={a} className="text-[10px] bg-muted/60 rounded-full px-2 py-0.5 text-muted-foreground">{a}</span>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {spot.reservationUrl && (
          <a
            href={spot.reservationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-bold text-white bg-kipita-red rounded-full px-3 py-1.5 hover:opacity-90 hover:scale-105 active:scale-95 transition-all"
          >
            {spot.reservable ? 'Reserve' : 'View'}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {spot.website && spot.website !== spot.reservationUrl && (
          <a
            href={spot.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-bold text-kipita-red border border-kipita-red rounded-full px-3 py-1.5 hover:bg-kipita-red/5 hover:scale-105 active:scale-95 transition-all"
          >
            Website
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function HighlightCard({ item, city }: { item: RecreationHighlight; city: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-2 flex-shrink-0 w-72 animate-fade-in transition-transform hover:scale-[1.02]">
      <div className="flex items-start gap-2">
        <span className="text-2xl">{item.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1 mb-0.5">
            <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-purple-100 text-purple-800 capitalize">{item.category}</span>
            {item.difficulty && (
              <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                item.difficulty.toLowerCase().startsWith('e') ? DIFFICULTY_STYLES.easy :
                item.difficulty.toLowerCase().startsWith('m') ? DIFFICULTY_STYLES.moderate :
                DIFFICULTY_STYLES.hard
              }`}>{item.difficulty}</span>
            )}
          </div>
          <h4 className="font-extrabold text-sm leading-tight">{item.name}</h4>
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground leading-snug line-clamp-3">{item.description}</p>

      {item.tip && (
        <div className="bg-amber-50 rounded-xl p-2.5 text-[11px] text-amber-800 leading-snug">
          <span className="font-bold">💡 Tip:</span> {item.tip}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        {item.duration && <span>⏱ {item.duration}</span>}
        {item.cost && <span className="font-semibold text-foreground">{item.cost}</span>}
      </div>

      {item.bookingUrl && (
        <a
          href={item.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-bold text-white bg-kipita-red rounded-full px-3 py-1.5 w-fit hover:opacity-90 hover:scale-105 active:scale-95 transition-all"
        >
          Book / Info
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function ActivityGuideCard({ guide }: { guide: ActivityTypeGuide }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden transition-transform hover:scale-[1.01]">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-2xl">{guide.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-sm">{guide.name}</div>
          <div className="text-[11px] text-muted-foreground leading-snug line-clamp-1">{guide.description}</div>
        </div>
        <span className="text-muted-foreground text-base">{expanded ? '▲' : '▽'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <div className="font-bold text-muted-foreground uppercase tracking-wide mb-1">Difficulty</div>
              <div>{guide.difficulty}</div>
            </div>
            <div>
              <div className="font-bold text-muted-foreground uppercase tracking-wide mb-1">Best Season</div>
              <div>{guide.bestSeason}</div>
            </div>
          </div>

          <div>
            <div className="font-bold text-muted-foreground uppercase tracking-wide text-[11px] mb-1">Essential Gear</div>
            <div className="flex flex-wrap gap-1">
              {guide.gear.map(g => (
                <span key={g} className="text-[10px] bg-muted rounded-full px-2 py-0.5">{g}</span>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-2.5 text-[11px] text-blue-800 leading-snug">
            <span className="font-bold">📋 Booking tip:</span> {guide.bookingTip}
          </div>
        </div>
      )}
    </div>
  );
}

function ParksCanadaBanner() {
  const links = RECREATION_EXTERNAL_LINKS.parksCanada;
  return (
    <div className="bg-gradient-to-br from-red-700 to-rose-800 rounded-2xl p-4 text-white">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl">🍁</span>
        <div>
          <div className="font-extrabold text-base">Parks Canada</div>
          <div className="text-white/80 text-[12px]">Official Canada national park reservations</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Find a Park', url: links.findApark,    emoji: '🏔️' },
          { label: 'Book a Site',  url: links.reservations, emoji: '⛺' },
        ].map(link => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 hover:scale-[1.02] active:scale-95 rounded-xl p-2.5 text-[12px] font-bold transition-all"
          >
            <span>{link.emoji}</span>
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function InternationalLinks() {
  const links = RECREATION_EXTERNAL_LINKS.international;
  return (
    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-4 text-white">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl">🌍</span>
        <div>
          <div className="font-extrabold text-base">Global Trail Resources</div>
          <div className="text-white/80 text-[12px]">Discover trails, routes, and outdoor adventures worldwide</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'AllTrails',     url: links.alltrails,    emoji: '🥾' },
          { label: 'Komoot',        url: links.komoot,       emoji: '🗺️' },
          { label: 'Outdooractive', url: links.outdooractive, emoji: '🌲' },
          { label: 'Wikiloc',       url: links.wikiloc,      emoji: '📍' },
        ].map(link => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 hover:scale-[1.02] active:scale-95 rounded-xl p-2.5 text-[12px] font-bold transition-all"
          >
            <span>{link.emoji}</span>
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function RecreationScreen({ lat, lng, locationName, countryCode, onBack }: Props) {
  const [activeCategory, setActiveCategory] = useState<RecreationCategory>('all');
  const tabsRef = useDragScroll<HTMLDivElement>();

  const { spots: osmSpots, loading: osmLoading } = useOSMRecreation(lat, lng);
  const { parks: npsParks, loading: npsLoading } = useNPSParks(lat, lng, countryCode);
  const { facilities: recGovFacilities, loading: recGovLoading } = useRecreationGov(lat, lng, countryCode);

  const isUS = countryCode === 'US';
  const isCA = countryCode === 'CA';

  const cityKey = locationName.split(',')[0]?.trim();
  const cityHighlights = RECREATION_HIGHLIGHTS[cityKey] ?? null;

  const allSpots = useMemo(() => {
    const combined: RecreationSpot[] = [
      ...recGovFacilities,
      ...npsParks,
      ...osmSpots,
    ];
    // deduplicate by proximity (within 100m same name)
    const seen = new Set<string>();
    return combined.filter(s => {
      const k = s.name.toLowerCase().replace(/\s+/g, '');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [osmSpots, npsParks, recGovFacilities]);

  // Determine which categories actually have content available (live spots OR city highlights).
  // Only show chips for categories that have something to show.
  const availableCategories = useMemo(() => {
    const set = new Set<RecreationCategory>();
    for (const s of allSpots) set.add(s.category);
    if (cityHighlights) for (const h of cityHighlights) set.add(h.category);
    return set;
  }, [allSpots, cityHighlights]);

  const visibleTabs = useMemo(() => {
    if (availableCategories.size === 0) return [];
    // Always include 'all' first when anything is available
    return CATEGORY_TABS.filter(t => t.id === 'all' || availableCategories.has(t.id));
  }, [availableCategories]);

  const filteredSpots = activeCategory === 'all'
    ? allSpots
    : allSpots.filter(s => s.category === activeCategory);

  const filteredHighlights = cityHighlights
    ? (activeCategory === 'all' ? cityHighlights : cityHighlights.filter(h => h.category === activeCategory))
    : [];

  const filteredGuide = activeCategory === 'all'
    ? OUTDOOR_ACTIVITY_GUIDE
    : OUTDOOR_ACTIVITY_GUIDE.filter(g => g.id === activeCategory);

  const isLoading = osmLoading || npsLoading || recGovLoading;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="bg-white border-b border-black/10 px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-sm">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-all hover:scale-110 active:scale-95 flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-extrabold text-lg leading-tight">Outdoor Recreation</h2>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-kipita-red flex-shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">{locationName}</span>
          </div>
        </div>
      </div>

      {/* Category Tabs — only show categories with content */}
      {visibleTabs.length > 0 && (
        <div
          ref={tabsRef}
          className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide flex-shrink-0 border-b border-black/5 bg-white"
        >
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105 active:scale-95 ${
                activeCategory === tab.id
                  ? 'bg-kipita-red text-white shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Scroll Area */}
      <div className="flex-1 overflow-y-auto pb-8">

        {/* ── Near You (live OSM + NPS + Recreation.gov) ── */}
        <section className="px-4 pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-extrabold text-base">Near You</h3>
            {isLoading && <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
          </div>

          {isLoading && filteredSpots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-8 h-8 border-2 border-kipita-red border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Searching recreation spots…</p>
            </div>
          ) : filteredSpots.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🌲</div>
              <p className="text-sm text-muted-foreground">No {activeCategory === 'all' ? '' : activeCategory + ' '}spots found within 20 km</p>
            </div>
          ) : (
            <div className="space-y-3 stagger">
              {filteredSpots.slice(0, 12).map(spot => (
                <SpotCard key={spot.id} spot={spot} />
              ))}
              {filteredSpots.length > 12 && (
                <p className="text-xs text-center text-muted-foreground py-1">
                  +{filteredSpots.length - 12} more spots in the area
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── NPS National Parks (US only) ── */}
        {isUS && npsParks.length > 0 && (activeCategory === 'all' || ['camping', 'hiking', 'water', 'adventure', 'wildlife'].includes(activeCategory)) && (
          <section className="px-4 pt-6">
            <h3 className="font-extrabold text-base mb-3">National Parks</h3>
            <div className="space-y-3">
              {npsParks.slice(0, 4).map(park => (
                <SpotCard key={park.id} spot={park} />
              ))}
            </div>
          </section>
        )}

        {/* ── Canada: Parks Canada ── */}
        {isCA && (activeCategory === 'all' || ['camping', 'hiking'].includes(activeCategory)) && (
          <section className="px-4 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-extrabold text-base">Parks Canada</h3>
              <span className="text-[10px] bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-bold">Official</span>
            </div>
            <ParksCanadaBanner />
          </section>
        )}

        {/* ── City Highlights ── */}
        {filteredHighlights.length > 0 && (
          <section className="pt-6">
            <div className="flex items-center gap-2 px-4 mb-3">
              <h3 className="font-extrabold text-base">Top Picks — {cityKey}</h3>
              <span className="text-[10px] bg-purple-100 text-purple-800 rounded-full px-2 py-0.5 font-bold">Curated</span>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
              {filteredHighlights.map((item, i) => (
                <HighlightCard key={i} item={item} city={cityKey} />
              ))}
            </div>
          </section>
        )}

        {/* ── International Resources ── */}
        {!isUS && !isCA && (activeCategory === 'all' || ['hiking', 'cycling', 'adventure'].includes(activeCategory)) && (
          <section className="px-4 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-extrabold text-base">Global Trail Finder</h3>
            </div>
            <InternationalLinks />
          </section>
        )}

        {/* ── Activity Guide ── */}
        {filteredGuide.length > 0 && (
          <section className="px-4 pt-6">
            <h3 className="font-extrabold text-base mb-3">Activity Guide</h3>
            <div className="space-y-2">
              {filteredGuide.map(guide => (
                <ActivityGuideCard key={guide.id} guide={guide} />
              ))}
            </div>
          </section>
        )}

        {/* ── Data attribution ── */}
        <div className="px-4 pt-6 pb-2">
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Live data from{' '}
            <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a>
            {isUS && (
              <>
                {' '}·{' '}
                <a href="https://www.nps.gov/" target="_blank" rel="noopener noreferrer" className="underline">NPS</a>
              </>
            )}
            {' '}· Curated picks by Kipita
          </p>
        </div>
      </div>
    </div>
  );
}
