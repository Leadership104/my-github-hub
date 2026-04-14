import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useWeather, useCryptoPrices, useMetalPrices, useBTCMerchants } from './hooks';
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


const NAV_ITEMS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'ai', label: 'AI', icon: 'auto_awesome' },
  { id: 'trips', label: 'Travel', icon: 'flight_takeoff' },
  { id: 'places', label: 'Places', icon: 'explore' },
];

const PRESET_LOCATIONS: LocationState[] = [
  { lat: 40.7128, lng: -74.006, name: 'New York, US' },
  { lat: 34.0522, lng: -118.2437, name: 'Los Angeles, US' },
  { lat: 41.8781, lng: -87.6298, name: 'Chicago, US' },
  { lat: 29.7604, lng: -95.3698, name: 'Houston, US' },
  { lat: 25.7617, lng: -80.1918, name: 'Miami, US' },
  { lat: 51.5074, lng: -0.1278, name: 'London, UK' },
  { lat: 48.8566, lng: 2.3522, name: 'Paris, FR' },
  { lat: 35.6762, lng: 139.6503, name: 'Tokyo, JP' },
  { lat: 13.7563, lng: 100.5018, name: 'Bangkok, TH' },
  { lat: 1.3521, lng: 103.8198, name: 'Singapore, SG' },
  { lat: -33.8688, lng: 151.2093, name: 'Sydney, AU' },
  { lat: 19.4326, lng: -99.1332, name: 'Mexico City, MX' },
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
  const [showSOS, setShowSOS] = useState(false);
  const [splash, setSplash] = useState(true);

  const switchTab = useCallback((t: TabId, hint?: string) => {
    setTab(t);
    setScreenHint(hint);
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
        const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&addressdetails=1`);
        const d = await r.json();
        setLocationSuggestions(d.map((item: any) => ({
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          name: (() => {
            const city = item.address?.city || item.address?.town || item.address?.village || item.display_name?.split(',')[0] || val;
            const country = item.address?.country_code?.toUpperCase() || '';
            return city + (country ? `, ${country}` : '');
          })(),
        })));
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
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lt}&lon=${lg}&format=json`);
          const d = await r.json();
          const city = d.address?.city || d.address?.town || d.address?.village || d.address?.county || '';
          const country = d.address?.country_code?.toUpperCase() || '';
          const n = city ? `${city}${country ? ', ' + country : ''}` : 'Current Location';
          selectLocation({ lat: lt, lng: lg, name: n });
        } catch {
          selectLocation({ lat: lt, lng: lg, name: 'Current Location' });
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [selectLocation]);

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
      case 'home': return <HomeScreen weather={weather} forecast={forecast} locationName={locationName} fullAddress={fullAddress} countryCode={countryCode} onSwitchTab={switchTab} />;
      case 'ai': return <AIScreen btcPrice={btcPrice} locationName={locationName} weather={weather} trips={trips} onCreateTrip={handleCreateTrip} onAddBooking={handleAddBooking} />;
      case 'trips': return <TripsScreen trips={trips} onSaveTrips={saveTrips} />;
      case 'places': return <PlacesScreen locationName={locationName} lat={lat} lng={lng} initialView={screenHint as any} />;
      case 'maps': return <MapsScreen lat={lat} lng={lng} merchants={merchants} loading={merchantsLoading} initialFilter={screenHint} />;
      case 'wallet': return <WalletScreen prices={prices} metals={metals} onOpenMaps={() => switchTab('maps')} />;
    }
  };

  const filteredPresets = locationSearch.trim()
    ? PRESET_LOCATIONS.filter(l => l.name.toLowerCase().includes(locationSearch.toLowerCase()))
    : PRESET_LOCATIONS;

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-background">
      {/* Top Bar */}
      <header className="h-[72px] bg-card border-b border-border shadow-sm flex items-center px-4 gap-3 relative z-[100] flex-shrink-0">
        <div className="flex-shrink-0">
          <img src={kipitaLogo} alt="Kipita" className="h-9 w-auto" />
        </div>
        <button onClick={() => setShowLocationPicker(true)}
          className="flex-1 max-w-[240px] flex items-center gap-1.5 bg-muted rounded-full px-4 py-2.5 text-sm font-semibold text-muted-foreground overflow-hidden min-w-0">
          <span className="ms text-kipita-red text-lg flex-shrink-0">location_on</span>
          <span className="truncate">{locationName}</span>
          <span className="ms text-xs text-muted-foreground flex-shrink-0">expand_more</span>
        </button>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button className="flex items-center gap-1 px-2.5 py-2 rounded-kipita-sm text-xs font-bold text-muted-foreground hover:bg-muted transition-colors">
            <span>{weather.emoji}</span>
            <span>{weather.temp}</span>
          </button>
          <div className="flex items-center gap-0.5 px-1">
            <span className="w-[7px] h-[7px] rounded-full bg-kipita-green" />
            <span className="w-[7px] h-[7px] rounded-full bg-kipita-green" />
            <span className="w-[7px] h-[7px] rounded-full bg-kipita-green" />
            <span className="w-[7px] h-[7px] rounded-full bg-border" />
          </div>
          <button onClick={() => setShowSOS(true)}
            className="bg-kipita-red rounded-md w-10 h-10 flex items-center justify-center flex-shrink-0 shadow-md"
            title="Emergency SOS">
            <span className="text-white font-extrabold text-[11px] tracking-wide">SOS</span>
          </button>
        </div>
        <button onClick={() => setShowProfile(!showProfile)}
          className="ml-auto w-11 h-11 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          <span className="ms text-2xl text-muted-foreground">account_circle</span>
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
                  placeholder="Search city or address…" autoFocus
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

      {/* SOS Modal */}
      {showSOS && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[300]" onClick={() => setShowSOS(false)} />
          <div className="fixed inset-x-4 top-[10%] max-w-md mx-auto bg-card rounded-2xl shadow-2xl z-[301] overflow-hidden max-h-[80vh] flex flex-col">
            <div className="bg-kipita-red px-5 py-4 flex items-center gap-3">
              <span className="text-3xl">🚨</span>
              <div>
                <h3 className="text-white font-extrabold text-lg">Emergency SOS</h3>
                <p className="text-white/80 text-xs">Tap a number to call emergency services</p>
              </div>
              <button onClick={() => setShowSOS(false)} className="ml-auto text-white/80 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              {EMERGENCY_NUMBERS.map(e => (
                <div key={e.country} className="bg-muted rounded-xl p-3">
                  <div className="font-bold text-sm mb-2">{e.country}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <a href={`tel:${e.police}`} className="bg-card border border-border rounded-lg p-2 text-center hover:bg-kipita-red-lt transition-colors">
                      <div className="text-[10px] text-muted-foreground">Police</div>
                      <div className="font-extrabold text-sm text-kipita-red">{e.police}</div>
                    </a>
                    <a href={`tel:${e.ambulance}`} className="bg-card border border-border rounded-lg p-2 text-center hover:bg-kipita-red-lt transition-colors">
                      <div className="text-[10px] text-muted-foreground">Ambulance</div>
                      <div className="font-extrabold text-sm text-kipita-red">{e.ambulance}</div>
                    </a>
                    <a href={`tel:${e.fire}`} className="bg-card border border-border rounded-lg p-2 text-center hover:bg-kipita-red-lt transition-colors">
                      <div className="text-[10px] text-muted-foreground">Fire</div>
                      <div className="font-extrabold text-sm text-kipita-red">{e.fire}</div>
                    </a>
                  </div>
                </div>
              ))}
              <div className="bg-kipita-red-lt rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">📍 Share your location with emergency contacts</p>
                <button onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: 'My Location', text: `I need help! My location: https://maps.google.com/?q=${lat},${lng}` });
                  } else {
                    navigator.clipboard.writeText(`https://maps.google.com/?q=${lat},${lng}`);
                    alert('Location link copied to clipboard!');
                  }
                }} className="mt-2 bg-kipita-red text-white font-bold text-sm px-4 py-2 rounded-full">
                  📤 Share Location
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Profile dropdown */}
      {showProfile && (
        <>
          <div className="fixed inset-0 z-[150]" onClick={() => setShowProfile(false)} />
          <div className="absolute top-[76px] right-2 bg-card border border-border rounded-kipita shadow-lg min-w-[240px] z-[200] overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <span className="ms text-4xl text-muted-foreground">account_circle</span>
              <div>
                <div className="text-sm font-bold">Guest User</div>
                <div className="text-xs text-muted-foreground">Not signed in</div>
              </div>
            </div>
            <hr className="border-border" />
            <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium hover:bg-muted transition-colors">
              <span className="ms text-lg text-muted-foreground">edit</span> Edit Profile
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium hover:bg-muted transition-colors">
              <span className="ms text-lg text-muted-foreground">shield</span> Travel Safety
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium hover:bg-muted transition-colors">
              <span className="ms text-lg text-muted-foreground">settings</span> Settings
            </button>
            <hr className="border-border" />
            <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-kipita-red hover:bg-muted transition-colors">
              <span className="ms text-lg">logout</span> Sign Out
            </button>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {renderScreen()}
      </main>

      {/* Bottom Nav */}
      <nav className="h-[84px] bg-card/95 backdrop-blur-xl border-t border-border shadow-[0_-4px_24px_rgba(0,0,0,.06)] flex items-stretch flex-shrink-0 z-[100] overflow-x-auto scrollbar-hide"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={() => switchTab(item.id)}
            className={`flex-1 min-w-[60px] flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
              tab === item.id ? 'text-kipita-red' : 'text-muted-foreground'
            }`}>
            <span className={`ms text-2xl ${tab === item.id ? 'text-kipita-red' : ''}`}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}