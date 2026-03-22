import { useState } from 'react';
import { useLocation, useWeather, useCryptoPrices, useMetalPrices, useBTCMerchants } from './hooks';
import type { TabId } from './types';
import kipitaSplash from './assets/kipita-splash.jpeg';
import kipitaLogo from './assets/kipita-logo.png';
import HomeScreen from './screens/HomeScreen';
import AIScreen from './screens/AIScreen';
import TripsScreen from './screens/TripsScreen';
import PlacesScreen from './screens/PlacesScreen';
import MapsScreen from './screens/MapsScreen';
import WalletScreen from './screens/WalletScreen';
import GroupsScreen from './screens/GroupsScreen';

const NAV_ITEMS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'ai', label: 'AI', icon: 'auto_awesome' },
  { id: 'trips', label: 'Trips', icon: 'flight_takeoff' },
  { id: 'places', label: 'Places', icon: 'explore' },
  { id: 'groups', label: 'Groups', icon: 'groups' },
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

export default function App() {
  const [tab, setTab] = useState<TabId>('home');
  const [showProfile, setShowProfile] = useState(false);
  const [showSOS, setShowSOS] = useState(false);
  const [splash, setSplash] = useState(true);

  const location = useLocation();
  const weather = useWeather(location.lat, location.lng);
  const prices = useCryptoPrices();
  const metals = useMetalPrices();
  const { merchants, loading: merchantsLoading } = useBTCMerchants(location.lat, location.lng);

  const btcPrice = prices.find(p => p.symbol === 'BTC')?.price || 0;

  // Splash screen
  if (splash) {
    setTimeout(() => setSplash(false), 2000);
    return (
      <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-kipita-red-dk flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl font-extrabold tracking-tight">ki<span className="text-kipita-red">pi</span>ta</div>
          <p className="mt-3 text-base font-medium text-white/70">Your Ultimate Travel Companion</p>
          <div className="flex gap-2 justify-center mt-10">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-2 h-2 rounded-full bg-white/40" style={{ animation: `dot-pulse 1.4s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    switch (tab) {
      case 'home': return <HomeScreen weather={weather} locationName={location.name} onSwitchTab={setTab} />;
      case 'ai': return <AIScreen btcPrice={btcPrice} locationName={location.name} />;
      case 'trips': return <TripsScreen />;
      case 'places': return <PlacesScreen locationName={location.name} />;
      case 'maps': return <MapsScreen lat={location.lat} lng={location.lng} merchants={merchants} loading={merchantsLoading} />;
      case 'wallet': return <WalletScreen prices={prices} metals={metals} onOpenMaps={() => setTab('maps')} />;
      case 'groups': return <GroupsScreen />;
    }
  };

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-background">
      {/* Top Bar */}
      <header className="h-[72px] bg-card border-b border-border shadow-sm flex items-center px-4 gap-3 relative z-[100] flex-shrink-0">
        <div className="flex-shrink-0">
          <span className="text-2xl font-extrabold tracking-tight">ki<span className="text-kipita-red">pi</span>ta</span>
        </div>
        <button onClick={() => setTab('maps')}
          className="flex-1 max-w-[240px] flex items-center gap-1.5 bg-muted rounded-full px-4 py-2.5 text-sm font-semibold text-muted-foreground overflow-hidden min-w-0">
          <span className="ms text-kipita-red text-lg flex-shrink-0">location_on</span>
          <span className="truncate">{location.name}</span>
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
            className="bg-kipita-red rounded-full w-9 h-9 flex items-center justify-center text-lg animate-sos flex-shrink-0"
            title="Emergency SOS">🚨</button>
          <button onClick={() => setShowProfile(!showProfile)}
            className="w-11 h-11 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            <span className="ms text-2xl text-muted-foreground">account_circle</span>
          </button>
        </div>
      </header>

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
                    navigator.share({ title: 'My Location', text: `I need help! My location: https://maps.google.com/?q=${location.lat},${location.lng}` });
                  } else {
                    navigator.clipboard.writeText(`https://maps.google.com/?q=${location.lat},${location.lng}`);
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
          <button key={item.id} onClick={() => setTab(item.id)}
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
