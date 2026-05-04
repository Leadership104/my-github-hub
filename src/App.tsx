import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n, SUPPORTED_LANGUAGES, type LangCode } from './i18n';
import { useLocation, useWeather, useCryptoPrices, useMetalPrices, useBTCMerchants, useTravelSafety, preciseReverseGeocode } from './hooks';
import type { ForecastDay } from './hooks';
import type { Trip, Booking } from './types';
import type { TabId } from './types';
import type { LocationState } from './hooks';
import kipitaSplash from './assets/kipita-splash.jpeg';
import kipitaLogo from './assets/kipita-icon.png';
import HomeScreen from './screens/HomeScreen';
import AIScreen from './screens/AIScreen';
import TripsScreen from './screens/TripsScreen';
import PlacesScreen from './screens/PlacesScreen';
import MapsScreen from './screens/MapsScreen';
import WalletScreen from './screens/WalletScreen';
import SafetyScreen from './screens/SafetyScreen';
import ATMScreen from './screens/ATMScreen';
import PerksScreen from './screens/PerksScreen';
import FuelScreen from './screens/FuelScreen';
import OnboardingTour, { hasSeenTour, resetAllTours, type TourStep } from './components/OnboardingTour';

/** First-time tour steps per tab. Each tour runs once, persisted in localStorage. */
const TOURS: Record<string, TourStep[]> = {
  home: [
    { target: 'header-location', title: 'Set your location', tip: 'Tap here to switch cities — everything in the app (places, weather, safety, prices) follows this.' },
    { target: 'header-sos', title: 'Emergency SOS', tip: 'One-tap dial of local emergency numbers wherever you are.' },
    { target: 'home-essentials', title: 'Essentials grid', tip: 'Quick jumps to the things travelers need first: food, fuel, ATMs, medical, transit.' },
    { target: 'nav-ai', title: 'Know B4 You Go', tip: 'Your AI concierge — ask anything about your destination before or during your trip.' },
  ],
  ai: [
    { target: 'ai-quick-actions', title: 'Quick actions', tip: 'Tap a chip for an instant briefing on safety, money, food or transport.' },
    { target: 'ai-input', title: 'Ask anything', tip: 'Type a question — answers blend live data with your trip context.' },
  ],
  trips: [
    { target: 'trips-plan-cta', title: 'Plan a trip', tip: 'Start a new trip with arrival/departure dates and we\'ll seed your itinerary.' },
    { target: 'trips-ai-cta', title: 'AI itinerary', tip: 'Let Know B4 You Go build a day-by-day plan you can edit.' },
  ],
  places: [
    { target: 'places-grid', title: 'Browse by need', tip: 'Tap a tile to see live results from Google Places near you.' },
  ],
};


const NAV_ITEMS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'ai', label: 'AI', icon: 'auto_awesome' },
  { id: 'trips', label: 'Travel', icon: 'flight_takeoff' },
  { id: 'places', label: 'Places', icon: 'explore' },
];

const PRESET_LOCATIONS: LocationState[] = [
  { lat: 40.7128, lng: -74.006, name: 'New York, US', countryCode: 'US' },
  { lat: 34.0522, lng: -118.2437, name: 'Los Angeles, US', countryCode: 'US' },
  { lat: 41.8781, lng: -87.6298, name: 'Chicago, US', countryCode: 'US' },
  { lat: 29.7604, lng: -95.3698, name: 'Houston, US', countryCode: 'US' },
  { lat: 25.7617, lng: -80.1918, name: 'Miami, US', countryCode: 'US' },
  { lat: 51.5074, lng: -0.1278, name: 'London, UK', countryCode: 'GB' },
  { lat: 48.8566, lng: 2.3522, name: 'Paris, FR', countryCode: 'FR' },
  { lat: 35.6762, lng: 139.6503, name: 'Tokyo, JP', countryCode: 'JP' },
  { lat: 13.7563, lng: 100.5018, name: 'Bangkok, TH', countryCode: 'TH' },
  { lat: 1.3521, lng: 103.8198, name: 'Singapore, SG', countryCode: 'SG' },
  { lat: -33.8688, lng: 151.2093, name: 'Sydney, AU', countryCode: 'AU' },
  { lat: 19.4326, lng: -99.1332, name: 'Mexico City, MX', countryCode: 'MX' },
];

const EMERGENCY_NUMBERS: { country: string; police: string; ambulance: string; fire: string }[] = [
  { country: '🇺🇸 USA', police: '911', ambulance: '911', fire: '911' },
  { country: '🇬🇧 UK', police: '999', ambulance: '999', fire: '999' },
  { country: '🇪🇺 EU', police: '112', ambulance: '112', fire: '112' },
  { country: '🇹🇭 Thailand', police: '191', ambulance: '1669', fire: '199' },
  { country: '🇯🇵 Japan', police: '110', ambulance: '119', fire: '119' },
  { country: '🇲🇽 Mexico', police: '911', ambulance: '911', fire: '911' },
  { country: '🇧🇷 Brazil', police: '190', ambulance: '192', fire: '193' },
  { country: '🇮🇩 Indonesia', police: '110', ambulance: '118', fire: '113' },
];

function loadTrips(): Trip[] {
  const saved = localStorage.getItem('kip_trips');
  if (saved) return JSON.parse(saved);
  const defaults: Trip[] = [
    { id: '1', dest: 'Tokyo', country: 'Japan', emoji: '🗼', start: '2026-04-10', end: '2026-04-17', notes: 'Visit Shibuya, Akihabara, try ramen!', status: 'upcoming', items: [
      { id: 'i1', day: 1, time: '10:00', title: 'Arrive Narita Airport', done: false },
      { id: 'i2', day: 1, time: '14:00', title: 'Check in Shinjuku hotel', done: false },
      { id: 'i3', day: 2, time: '09:00', title: 'Meiji Shrine visit', done: false },
    ], bookings: [
      { id: 'b1', type: 'flight', provider: 'Expedia', name: 'LAX → NRT (ANA)', flightNumber: 'NH105', departureTime: '2026-04-10 11:30', arrivalTime: '2026-04-11 15:30', confirmationCode: 'EXP-7842', affiliateUrl: 'https://expedia.com/affiliate/eA2cKky', bookedAt: Date.now() },
      { id: 'b2', type: 'hotel', provider: 'Hotels.com', name: 'Hotel Gracery Shinjuku', checkIn: '2026-04-11', checkOut: '2026-04-17', confirmationCode: 'HTL-3291', address: '1-19-1 Kabukicho, Shinjuku', affiliateUrl: 'https://www.hotels.com/affiliate/RrZ7bmg', bookedAt: Date.now() },
    ]},
    { id: '2', dest: 'Bali', country: 'Indonesia', emoji: '🌴', start: '2026-05-01', end: '2026-05-10', notes: 'Canggu coworking + surf', status: 'upcoming', items: [], bookings: [] },
  ];
  localStorage.setItem('kip_trips', JSON.stringify(defaults));
  return defaults;
}

export default function App() {
  const [tab, setTab] = useState<TabId>('home');
  const [screenHint, setScreenHint] = useState<string | undefined>();
  const prevTabRef = useRef<TabId>('home');
  const [trips, setTrips] = useState<Trip[]>(loadTrips);

  const saveTrips = useCallback((updated: Trip[]) => {
    setTrips(updated);
    localStorage.setItem('kip_trips', JSON.stringify(updated));
  }, []);

  const handleCreateTrip = useCallback((dest: string, country: string, days: number) => {
    const emoji = ['🏔️', '🌴', '🏖️', '🌺', '🗼', '🏙️'][Math.floor(Math.random() * 6)];
    const start = new Date(); start.setDate(start.getDate() + 14);
    const end = new Date(start); end.setDate(end.getDate() + days);
    const t: Trip = {
      id: Date.now().toString(), dest, country, emoji,
      start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0],
      notes: `AI-planned ${days}-day trip`, status: 'upcoming', items: [], bookings: [], createdAt: Date.now(),
    };
    saveTrips([t, ...trips]);
  }, [trips, saveTrips]);

  const handleAddBooking = useCallback((tripId: string, booking: Booking) => {
    saveTrips(trips.map(t => t.id === tripId ? { ...t, bookings: [...(t.bookings || []), booking] } : t));
  }, [trips, saveTrips]);
  const [showProfile, setShowProfile] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const { t, lang, setLang } = useI18n();
  const NAV_LABELS: Partial<Record<TabId, string>> = {
    home: t('nav.home'), ai: t('nav.ai'), trips: t('nav.travel'), places: t('nav.places'),
  };
  const [showSOS, setShowSOS] = useState(false);
  const [splash, setSplash] = useState(true);

  // First-time onboarding tour: runs once per tab, persisted in localStorage.
  const [activeTour, setActiveTour] = useState<string | null>(null);
  useEffect(() => {
    if (splash) return;
    const steps = TOURS[tab];
    if (steps && steps.length > 0 && !hasSeenTour(tab)) {
      // Small delay so the screen has time to mount + measure
      const t = setTimeout(() => setActiveTour(tab), 350);
      return () => clearTimeout(t);
    }
    setActiveTour(null);
  }, [tab, splash]);

  const switchTab = useCallback((t: TabId, hint?: string) => {
    prevTabRef.current = tab;
    setTab(t);
    setScreenHint(hint);
  }, [tab]);

  const goBack = useCallback(() => {
    setTab(prevTabRef.current || 'home');
    prevTabRef.current = 'home';
    setScreenHint(undefined);
  }, []);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationState[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { lat, lng, name: locationName, fullAddress, countryCode, updateLocation } = useLocation();
  const { forecast, ...weather } = useWeather(lat, lng);
  const prices = useCryptoPrices();
  const metals = useMetalPrices();
  const { merchants, loading: merchantsLoading } = useBTCMerchants(lat, lng);

  const btcPrice = prices.find(p => p.symbol === 'BTC')?.price || 0;

  const handleLocationSearch = useCallback((val: string) => {
    setLocationSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (val.trim().length < 2) { setLocationSuggestions([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      try {
        // Use addressdetails + extratags + namedetails so we can resolve
        // neighborhoods, suburbs, postal codes, hamlets — not just cities.
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=8&addressdetails=1&extratags=1&namedetails=1&accept-language=en`;
        const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
        const d = await r.json();
        setLocationSuggestions(d.map((item: any) => {
          const a = item.address || {};
          // Prefer the most specific named place the user likely typed.
          const locality =
            a.neighbourhood || a.suburb || a.quarter || a.hamlet ||
            a.village || a.town || a.city_district || a.city ||
            a.municipality || a.county || item.namedetails?.name ||
            item.display_name?.split(',')[0] || val;
          const region = a.city || a.town || a.state || '';
          const postcode = a.postcode || '';
          const country = a.country_code?.toUpperCase() || '';
          // Build a compact label like "Whalley Range, Manchester, GB"
          const parts: string[] = [locality];
          if (region && region !== locality) parts.push(region);
          if (postcode && !region) parts.push(postcode);
          if (country) parts.push(country);
          return {
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            name: parts.join(', '),
            fullAddress: item.display_name || val,
            countryCode: country,
          };
        }));
      } catch { setLocationSuggestions([]); }
    }, 400);
  }, []);

  const selectLocation = useCallback((loc: LocationState) => {
    updateLocation(loc);
    setShowLocationPicker(false);
    setLocationSearch('');
    setLocationSuggestions([]);
  }, [updateLocation]);

  const detectCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lt, longitude: lg } = pos.coords;
        try {
          const { name, fullAddress, countryCode } = await preciseReverseGeocode(lt, lg);
          selectLocation({ lat: lt, lng: lg, name, fullAddress, countryCode });
        } catch {
          selectLocation({ lat: lt, lng: lg, name: 'Current Location' });
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [selectLocation]);

  const advisoryData = useTravelSafety(countryCode);

  // Splash screen
  if (splash) {
    setTimeout(() => setSplash(false), 2000);
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
        <img src={kipitaSplash} alt="Kipita" className="w-full h-full object-contain p-4" />
        <div className="absolute bottom-16 flex gap-2 justify-center">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-2.5 h-2.5 rounded-full bg-kipita-red" style={{ animation: `dot-pulse 1.4s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    switch (tab) {
      case 'home': return <HomeScreen weather={weather} forecast={forecast} locationName={locationName} fullAddress={fullAddress} countryCode={countryCode} lat={lat} lng={lng} onSwitchTab={switchTab} />;
      case 'ai': return <AIScreen btcPrice={btcPrice} locationName={locationName} countryCode={countryCode} lat={lat} lng={lng} weather={weather} advisoryScore={advisoryData?.rawScore} trips={trips} onCreateTrip={handleCreateTrip} onAddBooking={handleAddBooking} onBack={goBack} onSwitchTab={switchTab} />;
      case 'trips': return <TripsScreen trips={trips} onSaveTrips={saveTrips} onBack={goBack} onSwitchTab={switchTab} initialHint={screenHint} />;
      case 'places': return <PlacesScreen locationName={locationName} lat={lat} lng={lng} initialView={screenHint as any} onBack={goBack} />;
      case 'maps': return <MapsScreen lat={lat} lng={lng} merchants={merchants} loading={merchantsLoading} initialFilter={screenHint} onBack={goBack} />;
      case 'wallet': return <WalletScreen prices={prices} metals={metals} onOpenMaps={() => switchTab('maps')} onBack={goBack} />;
      case 'safety': return <SafetyScreen locationName={locationName} countryCode={countryCode} advisoryScore={advisoryData?.rawScore} lat={lat} lng={lng} onBack={goBack} />;
      case 'atm': return <ATMScreen lat={lat} lng={lng} merchants={merchants} onBack={goBack} onViewOnMap={(filter) => switchTab('maps', filter)} />;
      case 'perks': return <PerksScreen onBack={goBack} />;
      case 'fuel': return <FuelScreen onBack={goBack} />;
    }
  };

  const filteredPresets = locationSearch.trim()
    ? PRESET_LOCATIONS.filter(l => l.name.toLowerCase().includes(locationSearch.toLowerCase()))
    : PRESET_LOCATIONS;

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-background">
      {/* Top Bar */}
      <header className="h-[72px] bg-white border-b border-black/40 shadow-sm flex items-center px-4 gap-3 relative z-[100] flex-shrink-0">
        <div className="flex-shrink-0">
          <img src={kipitaLogo} alt="Kipita" className="h-9 w-auto" />
        </div>
        <button onClick={() => setShowLocationPicker(true)}
          data-tour="header-location"
          className="flex-1 max-w-[240px] flex items-center gap-1.5 bg-black/5 hover:bg-black/10 transition-colors rounded-full px-4 py-2.5 text-sm font-semibold text-kipita-navy overflow-hidden min-w-0">
          <span className="ms text-lg flex-shrink-0">location_on</span>
          <span className="truncate">{locationName}</span>
          <span className="ms text-xs text-kipita-navy/60 flex-shrink-0">expand_more</span>
        </button>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button className="flex items-center gap-1 px-2.5 py-2 rounded-kipita-sm text-xs font-bold text-kipita-navy hover:bg-black/5 transition-colors">
            <span>{weather.emoji}</span>
            <span>{weather.temp}</span>
          </button>
          <button onClick={() => setShowSOS(true)}
            data-tour="header-sos"
            className="bg-kipita-red rounded-md w-10 h-10 flex items-center justify-center flex-shrink-0 shadow-md"
            title="Emergency SOS">
            <span className="text-white font-extrabold text-[11px] tracking-wide">SOS</span>
          </button>
        </div>
        <button onClick={() => setShowProfile(!showProfile)}
          className="ml-auto w-11 h-11 rounded-full bg-black/5 hover:bg-black/10 transition-colors flex items-center justify-center overflow-hidden flex-shrink-0">
          <span className="ms text-2xl text-kipita-navy">account_circle</span>
        </button>
      </header>

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[300]" onClick={() => setShowLocationPicker(false)} />
          <div className="fixed inset-x-4 top-[8%] max-w-md mx-auto bg-card rounded-2xl shadow-2xl z-[301] overflow-hidden max-h-[80vh] flex flex-col">
            <div className="px-5 pt-5 pb-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-extrabold">Change Location</h3>
                <button onClick={() => setShowLocationPicker(false)} className="text-muted-foreground text-xl leading-none">&times;</button>
              </div>
              <div className="flex items-center gap-2 bg-muted rounded-kipita-sm px-3 py-2.5">
                <span className="ms text-muted-foreground text-lg">search</span>
                <input value={locationSearch} onChange={e => handleLocationSearch(e.target.value)}
                  placeholder="City, neighborhood, or postal code…" autoFocus
                  className="flex-1 bg-transparent outline-none text-sm" />
                {locationSearch && (
                  <button onClick={() => { setLocationSearch(''); setLocationSuggestions([]); }} className="text-muted-foreground text-sm">✕</button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {/* Use current location button */}
              <button onClick={detectCurrentLocation}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-kipita hover:bg-muted transition-colors text-left mb-2">
                <span className="ms text-kipita-red text-xl">my_location</span>
                <div>
                  <div className="text-sm font-bold">Use Current Location</div>
                  <div className="text-[10px] text-muted-foreground">Detect via GPS</div>
                </div>
              </button>

              <hr className="border-border my-2" />

              {/* Search results */}
              {locationSuggestions.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Search Results</p>
                  {locationSuggestions.map((s, i) => (
                    <button key={i} onClick={() => selectLocation(s)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left">
                      <span className="ms text-muted-foreground text-lg">location_on</span>
                      <span className="text-sm font-semibold">{s.name}</span>
                    </button>
                  ))}
                  <hr className="border-border my-2" />
                </div>
              )}

              {/* Preset locations */}
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Popular Cities</p>
              <div className="space-y-0.5">
                {filteredPresets.map(loc => (
                  <button key={loc.name} onClick={() => selectLocation(loc)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left ${
                      locationName === loc.name ? 'bg-kipita-red/10' : ''
                    }`}>
                    <span className="ms text-muted-foreground text-lg">location_city</span>
                    <span className={`text-sm font-semibold ${locationName === loc.name ? 'text-kipita-red' : ''}`}>{loc.name}</span>
                    {locationName === loc.name && <span className="ms text-kipita-red text-sm ml-auto">check</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* SOS Modal — bottom sheet style matching screenshot */}
      {showSOS && (() => {
        const activeOrUpcoming = trips.find(t => t.status === 'active') || trips.find(t => t.status === 'upcoming');
        const tripMembers = activeOrUpcoming?.invites || [];
        const localEmergency = EMERGENCY_NUMBERS.find(e => e.country.includes(countryCode || 'USA')) || EMERGENCY_NUMBERS[0];
        const sosMessage = `🚨 EMERGENCY: I need help. My current location: https://maps.google.com/?q=${lat},${lng}`;
        const alertTripMembers = () => {
          if (tripMembers.length === 0) return;
          const subject = encodeURIComponent('🚨 Emergency Alert from Kipita');
          const body = encodeURIComponent(`${sosMessage}\n\n— Sent via Kipita SOS`);
          window.location.href = `mailto:${tripMembers.join(',')}?subject=${subject}&body=${body}`;
        };
        return (
          <>
            <div className="fixed inset-0 bg-black/60 z-[300]" onClick={() => setShowSOS(false)} />
            <div className="fixed inset-x-0 bottom-0 max-w-md mx-auto bg-card rounded-t-3xl shadow-2xl z-[301] overflow-hidden max-h-[85vh] flex flex-col">
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              {/* Header */}
              <div className="flex items-start justify-between px-5 pt-2 pb-3">
                <div>
                  <h3 className="text-kipita-red font-extrabold text-lg flex items-center gap-1.5">
                    SOS Emergency <span className="text-base">🆘</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Alert your trip members and get help fast</p>
                </div>
                <button onClick={() => setShowSOS(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/70">
                  <span className="text-lg leading-none">&times;</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
                {/* Emergency Mode banner */}
                <div className="bg-gradient-to-br from-kipita-red to-rose-600 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
                  <span className="text-3xl">🚨</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-extrabold text-sm">Emergency Mode</div>
                    <div className="text-white/80 text-[11px] leading-snug">Use the buttons below to alert your group or get to safety</div>
                  </div>
                </div>

                {/* Trip Members alert */}
                <div>
                  <div className="text-xs font-bold text-foreground mb-2">Trip Members</div>
                  {tripMembers.length === 0 ? (
                    <div className="bg-muted/60 rounded-xl p-4 text-center">
                      <div className="text-xs text-muted-foreground">No trip members to alert.</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Add people to a trip to enable group alerts.</div>
                    </div>
                  ) : (
                    <button
                      onClick={alertTripMembers}
                      className="w-full bg-kipita-red text-white rounded-xl p-3 text-left flex items-center gap-3 hover:opacity-95 active:scale-[0.98] transition-all"
                    >
                      <span className="text-xl">📨</span>
                      <div className="flex-1">
                        <div className="font-bold text-sm">Alert {tripMembers.length} member{tripMembers.length > 1 ? 's' : ''}</div>
                        <div className="text-[11px] text-white/80 truncate">{tripMembers.join(', ')}</div>
                      </div>
                      <span className="ms text-lg">arrow_forward</span>
                    </button>
                  )}
                </div>

                {/* Get Help Now */}
                <div>
                  <div className="text-xs font-bold text-foreground mb-2">Get Help Now</div>
                  <div className="space-y-2">
                    <a
                      href={`https://www.google.com/maps/search/hospital/@${lat},${lng},14z`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl no-underline hover:bg-orange-100 transition-colors active:scale-[0.98]"
                    >
                      <span className="text-2xl">🏥</span>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-foreground">Navigate to Hospital</div>
                        <div className="text-[11px] text-muted-foreground">Opens maps with nearest hospital</div>
                      </div>
                      <span className="ms text-kipita-red text-lg">arrow_forward</span>
                    </a>
                    <a
                      href={`https://www.google.com/maps/search/fire+station/@${lat},${lng},14z`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-rose-50 rounded-xl no-underline hover:bg-rose-100 transition-colors active:scale-[0.98]"
                    >
                      <span className="text-2xl">🚒</span>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-foreground">Navigate to Fire Station</div>
                        <div className="text-[11px] text-muted-foreground">Opens maps with nearest fire station</div>
                      </div>
                      <span className="ms text-kipita-red text-lg">arrow_forward</span>
                    </a>
                    <a
                      href={`tel:${localEmergency.police}`}
                      className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl no-underline hover:bg-emerald-100 transition-colors active:scale-[0.98]"
                    >
                      <span className="text-2xl">📞</span>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-foreground">Call Emergency Services</div>
                        <div className="text-[11px] text-muted-foreground">Dial {localEmergency.police} ({localEmergency.country.replace(/[🇺🇸🇬🇧🇪🇺🇹🇭🇯🇵🇲🇽🇧🇷🇮🇩 ]/g, '').trim() || 'local'}) — adjust for local emergency number</div>
                      </div>
                      <span className="ms text-kipita-red text-lg">arrow_forward</span>
                    </a>
                  </div>
                </div>

                {/* Share location */}
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: 'My Location', text: sosMessage });
                    } else {
                      navigator.clipboard.writeText(sosMessage);
                      alert('Location link copied to clipboard!');
                    }
                  }}
                  className="w-full bg-muted text-foreground font-semibold text-xs px-4 py-3 rounded-xl hover:bg-muted/70 transition-colors"
                >
                  📤 Share Location with Anyone
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* Profile dropdown */}
      {showProfile && (
        <>
          <div className="fixed inset-0 z-[150]" onClick={() => { setShowProfile(false); setShowLangPicker(false); }} />
          <div className="absolute top-[76px] right-2 bg-card border border-border rounded-kipita shadow-lg min-w-[260px] max-w-[300px] z-[200] overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <span className="ms text-4xl text-muted-foreground">account_circle</span>
              <div>
                <div className="text-sm font-bold">{t('profile.guest')}</div>
                <div className="text-xs text-muted-foreground">{t('profile.notSignedIn')}</div>
              </div>
            </div>
            <hr className="border-border" />
            {!showLangPicker ? (
              <>
                <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium hover:bg-muted transition-colors">
                  <span className="ms text-lg text-muted-foreground">edit</span> {t('profile.edit')}
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium hover:bg-muted transition-colors">
                  <span className="ms text-lg text-muted-foreground">shield</span> {t('profile.safety')}
                </button>
                <button
                  onClick={() => setShowLangPicker(true)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium hover:bg-muted transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <span className="ms text-lg text-muted-foreground">language</span> {t('profile.language')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {SUPPORTED_LANGUAGES.find(l => l.code === lang)?.flag} {SUPPORTED_LANGUAGES.find(l => l.code === lang)?.label}
                  </span>
                </button>
                <button
                  onClick={() => {
                    resetAllTours();
                    setShowProfile(false);
                    setActiveTour(tab);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium hover:bg-muted transition-colors"
                >
                  <span className="ms text-lg text-muted-foreground">school</span> {t('profile.replayTour')}
                </button>
                <hr className="border-border" />
                <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-kipita-red hover:bg-muted transition-colors">
                  <span className="ms text-lg">logout</span> {t('profile.signOut')}
                </button>
              </>
            ) : (
              <div className="max-h-[320px] overflow-y-auto">
                <button
                  onClick={() => setShowLangPicker(false)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors border-b border-border"
                >
                  <span className="ms text-base">arrow_back</span> {t('common.back')}
                </button>
                {SUPPORTED_LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => { setLang(l.code as LangCode); setShowLangPicker(false); }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium hover:bg-muted transition-colors ${lang === l.code ? 'bg-muted' : ''}`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-lg">{l.flag}</span> {l.label}
                    </span>
                    {lang === l.code && <span className="ms text-base text-kipita-red">check</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {renderScreen()}
      </main>

      {/* Bottom Nav — bubbly motion */}
      <nav className="h-[84px] glass border-t border-white/40 shadow-[0_-4px_24px_rgba(0,0,0,.06)] flex items-stretch flex-shrink-0 z-[100] overflow-x-auto scrollbar-hide"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV_ITEMS.map(item => {
          const active = tab === item.id;
          return (
            <button key={item.id} onClick={() => switchTab(item.id)}
              data-tour={`nav-${item.id}`}
              className={`flex-1 min-w-[60px] flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                active ? 'text-kipita-red' : 'text-muted-foreground'
              }`}>
              <span
                key={`${item.id}-${active}`}
                data-active={active}
                className={`ms text-2xl tab-bubbly ${active ? 'text-kipita-red' : ''}`}
                style={active ? { transform: 'scale(1.15)' } : undefined}
              >
                {item.icon}
              </span>
              {NAV_LABELS[item.id] ?? item.label}
            </button>
          );
        })}
      </nav>

      {/* First-time onboarding tour */}
      {activeTour && (
        <OnboardingTour
          tourId={activeTour}
          steps={TOURS[activeTour] || []}
          onClose={() => setActiveTour(null)}
        />
      )}
    </div>
  );
}