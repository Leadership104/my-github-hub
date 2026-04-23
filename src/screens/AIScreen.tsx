import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, Trip, Booking, TabId } from '../types';
import { DESTINATIONS } from '../data';
import { supabase } from '../integrations/supabase/client';

function extractDestFromMsg(msg: string) {
  const known = DESTINATIONS.find(d => msg.toLowerCase().includes(d.city.toLowerCase()));
  if (known) return `${known.city}, ${known.country}`;
  const cleaned = msg
    .replace(/plan|a|my|trip|to|travel|for|in|visit|itinerary|i want|go to|take me to|tell me about|what about|how is|\?/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  return cleaned.length > 2 ? cleaned.replace(/\b\w/g, c => c.toUpperCase()) : null;
}

interface PlaceChip {
  name: string;
  type: string;
  rating?: number;
  reviews?: number;
  openNow?: boolean;
  summary?: string;
}

interface Props {
  btcPrice?: number;
  locationName?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
  weather?: { emoji: string; temp: string; desc: string };
  advisoryScore?: number;
  trips?: Trip[];
  onCreateTrip?: (dest: string, country: string, days: number) => void;
  onCreateFullTrip?: (trip: Trip) => void;
  onAddBooking?: (tripId: string, booking: Booking) => void;
  onBack?: () => void;
  onSwitchTab?: (tab: TabId, hint?: string) => void;
}

// ── Trip Booking Wizard ───────────────────────────────────────────────────────
type WizardStep = 'destination' | 'dates' | 'duration' | 'confirm';

interface WizardState {
  step: WizardStep;
  destination: string;
  country: string;
  startDate: string;
  days: number;
}

function buildItinerary(dest: string, days: number, startDate: string): import('../types').ItineraryItem[] {
  const templates: Record<string, string[][]> = {
    Tokyo: [
      ['10:00', '✈️ Arrive at Narita Airport (NRT) – Collect luggage, clear customs. Pick up pocket Wi-Fi.', 'Narita International Airport'],
      ['14:00', '🚄 Narita Express → Shinjuku – Take the N\'EX express train. 90-minute scenic ride.', 'Narita → Shinjuku'],
      ['16:00', '🏨 Hotel Check-in – Freshen up and enjoy the city-view lobby.', 'Shinjuku, Tokyo'],
      ['19:00', '🍜 Ramen at Ichiran Shinjuku – Solo ramen booths — an iconic Tokyo experience.', 'Shinjuku'],
    ],
    Bali: [
      ['12:00', '✈️ Arrive at Ngurah Rai Airport – Transfer to Canggu area.', 'Denpasar Airport'],
      ['15:00', '🏨 Check-in to Villa or Hostel – Drop bags and head to the pool.', 'Canggu'],
      ['18:00', '🌅 Sunset at Echo Beach – Watch surfers and the famous Bali sunset.', 'Canggu Beach'],
      ['20:00', '🍻 Dinner at Single Fin – Rooftop bar and restaurant with ocean views.', 'Uluwatu'],
    ],
    Paris: [
      ['10:00', '✈️ Arrive CDG Airport – Take the RER B to central Paris.', 'Charles de Gaulle Airport'],
      ['13:00', '🗼 Eiffel Tower – Visit and take the lift to the second floor.', 'Champ de Mars, Paris'],
      ['15:30', '🥐 Café de Flore – Iconic Parisian café. Enjoy a croque monsieur.', 'Saint-Germain-des-Prés'],
      ['19:00', '🍷 Dinner in Le Marais – Walk the cobblestone streets and dine at a bistro.', 'Le Marais'],
    ],
    Bangkok: [
      ['11:00', '✈️ Arrive Suvarnabhumi Airport – Take Airport Rail Link to city.', 'Suvarnabhumi Airport'],
      ['14:00', '🛕 Grand Palace & Wat Phra Kaew – Thailand\'s most sacred temple complex.', 'Old City'],
      ['17:00', '🛶 Chao Phraya River Cruise – Jump on the orange flag boat.', 'Tha Tien Pier'],
      ['20:00', '🍢 Street Food at Yaowarat (Chinatown) – Seafood, noodles, and durian.', 'Yaowarat Road'],
    ],
  };

  const city = Object.keys(templates).find(k => dest.toLowerCase().includes(k.toLowerCase())) || '';
  const dayItems: import('../types').ItineraryItem[] = [];
  const startMs = new Date(startDate).getTime();

  for (let d = 1; d <= days; d++) {
    const dayMs = startMs + (d - 1) * 86400000;
    const date = new Date(dayMs);

    if (d === 1 && city && templates[city]) {
      templates[city].forEach((row, idx) => {
        dayItems.push({ id: `ai-d${d}-${idx}`, day: d, time: row[0], title: `${row[1]}${row[2] ? '\n📍 ' + row[2] : ''}`, done: false });
      });
    } else {
      const genericDay = [
        { time: '09:00', title: `🌅 Morning exploration – Start the day with a local breakfast` },
        { time: '11:30', title: `🗺️ Sightseeing – Explore a landmark or neighborhood in ${dest}` },
        { time: '13:00', title: `🍽️ Lunch – Try a local restaurant recommended by Kipita AI` },
        { time: '15:30', title: `🛍️ Shopping or activity – Markets, tours, or a cultural experience` },
        { time: '19:00', title: `🌆 Evening dinner – Rooftop, riverside, or local street food` },
      ];
      genericDay.forEach((item, idx) => {
        dayItems.push({ id: `ai-d${d}-${idx}`, day: d, time: item.time, title: item.title, done: false });
      });
    }
  }
  return dayItems;
}

function placeTypeToHint(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('restaurant') || t.includes('food')) return 'food';
  if (t.includes('cafe') || t.includes('coffee')) return 'coffee';
  if (t.includes('bar') || t.includes('pub') || t.includes('night')) return 'nightlife';
  if (t.includes('attraction') || t.includes('museum') || t.includes('park')) return 'attractions';
  if (t.includes('shop') || t.includes('store') || t.includes('mall')) return 'shopping';
  return 'food';
}

// ── Live Stats Bar ────────────────────────────────────────────────────────────
function StatsBar({
  weather, advisoryScore, locationName,
}: {
  weather?: { emoji: string; temp: string; desc: string };
  advisoryScore?: number;
  locationName?: string;
}) {
  const safetyColor =
    advisoryScore == null   ? '#64748b'
    : advisoryScore <= 1.5  ? '#22c55e'
    : advisoryScore <= 2.5  ? '#84cc16'
    : advisoryScore <= 3.5  ? '#eab308'
    : advisoryScore <= 4.2  ? '#f97316' : '#ef4444';
  const safetyLabel =
    advisoryScore == null   ? 'No data'
    : advisoryScore <= 1.5  ? 'Very safe'
    : advisoryScore <= 2.5  ? 'Generally safe'
    : advisoryScore <= 3.5  ? 'Stay alert'
    : advisoryScore <= 4.2  ? 'High risk' : 'Extreme risk';

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!weather && advisoryScore == null) return null;

  return (
    <div className="flex gap-2 px-3 py-2 border-b border-border bg-card/60 overflow-x-auto scrollbar-hide flex-shrink-0">
      {weather && (
        <div className="flex items-center gap-1.5 flex-shrink-0 bg-muted/60 rounded-lg px-2 py-1">
          <span className="text-sm">{weather.emoji}</span>
          <span className="text-[11px] font-bold text-foreground">{weather.temp}</span>
          <span className="text-[10px] text-muted-foreground hidden sm:block">{weather.desc}</span>
        </div>
      )}
      {advisoryScore != null && (
        <div className="flex items-center gap-1.5 flex-shrink-0 bg-muted/60 rounded-lg px-2 py-1">
          <span className="text-sm">🛡️</span>
          <span className="text-[11px] font-bold" style={{ color: safetyColor }}>{safetyLabel}</span>
        </div>
      )}
      <div className="flex items-center gap-1 flex-shrink-0 bg-muted/60 rounded-lg px-2 py-1">
        <span className="text-[10px] text-muted-foreground">🕒 {timeStr}</span>
      </div>
      {locationName && (
        <div className="flex items-center gap-1 flex-shrink-0 bg-muted/60 rounded-lg px-2 py-1 ml-auto">
          <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">📍 {locationName}</span>
        </div>
      )}
    </div>
  );
}

// ── Place Chips ───────────────────────────────────────────────────────────────
function PlaceChips({ places, onTap }: { places: PlaceChip[]; onTap: (p: PlaceChip) => void }) {
  if (!places.length) return null;
  return (
    <div className="px-1 pb-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
        📍 Nearby — tap to explore
      </p>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {places.map((p, i) => (
          <button
            key={`${p.name}-${i}`}
            onClick={() => onTap(p)}
            className="flex-shrink-0 bg-card border border-border rounded-xl px-3 py-2 text-left hover:border-kipita-red/40 hover:bg-muted transition-all max-w-[180px] active:scale-95"
          >
            <div className="text-xs font-bold text-foreground truncate">{p.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {p.rating && <span className="text-[10px] font-semibold text-amber-500">★ {p.rating}</span>}
              {p.openNow === true  && <span className="text-[10px] text-emerald-500 font-medium">Open</span>}
              {p.openNow === false && <span className="text-[10px] text-muted-foreground">Closed</span>}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{p.type}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Suggestion Chips ──────────────────────────────────────────────────────────
function SuggestionChips({ suggestions, onTap }: { suggestions: string[]; onTap: (s: string) => void }) {
  if (!suggestions.length) return null;
  return (
    <div className="px-1 pb-1">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onTap(s)}
            className="flex-shrink-0 text-[11px] font-medium text-kipita-red border border-kipita-red/30 bg-kipita-red/5 rounded-full px-3 py-1.5 hover:bg-kipita-red/10 transition-colors active:scale-95 max-w-[200px] truncate"
          >
            {s.replace(/^\*Ask me: /, '').replace(/\*$/, '').replace(/^"|"$/, '')}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isAI = msg.role === 'ai';
  return (
    <div className={`flex ${isAI ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        isAI
          ? 'bg-card border border-border text-foreground rounded-bl-sm'
          : 'bg-kipita-red text-white rounded-br-sm'
      }`}>
        {msg.text.split(/(\*\*\[.*?\]\(.*?\)\*\*|\*\*.*?\*\*|\[.*?\]\(.*?\))/g).map((part, i) => {
          const boldLink = part.match(/^\*\*\[(.+?)\]\((.+?)\)\*\*$/);
          if (boldLink) return (
            <a key={i} href={boldLink[2]} target="_blank" rel="noopener noreferrer"
              className="text-kipita-red underline font-bold">{boldLink[1]}</a>
          );
          const bold = part.match(/^\*\*(.+?)\*\*$/);
          if (bold) return <strong key={i}>{bold[1]}</strong>;
          const link = part.match(/^\[(.+?)\]\((.+?)\)$/);
          if (link) return (
            <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer"
              className={isAI ? 'text-kipita-red underline font-semibold' : 'text-white underline font-semibold'}>{link[1]}</a>
          );
          return <span key={i}>{part}</span>;
        })}
      </div>
    </div>
  );
}

// ── Typing Indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-card border border-border rounded-2xl px-4 py-3 rounded-bl-sm">
        <div className="flex gap-1 items-center">
          <span className="w-2 h-2 bg-kipita-red/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-kipita-red/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-kipita-red/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ── Quick Actions ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { emoji: '🗺️', label: 'Brief me',        prompt: 'Give me a full Know Before You Go briefing for where I am right now.' },
  { emoji: '🛡️', label: 'Safety intel',   prompt: 'What\'s the real safety situation here? What should I specifically watch out for?' },
  { emoji: '🍽️', label: 'Best food',       prompt: 'What\'s the best food near me right now? Be specific with real spots.' },
  { emoji: '✈️', label: 'Plan a trip',      prompt: '__OPEN_WIZARD__' },
  { emoji: '💰', label: 'Money tips',       prompt: 'What do I need to know about money here? ATMs, cards, budget, tips.' },
  { emoji: '🌃', label: 'Tonight',          prompt: 'What\'s the best thing to do tonight? Give me something specific and exciting.' },
  { emoji: '🏨', label: 'Where to stay',   prompt: 'What\'s the best neighborhood to stay in here, and what\'s a realistic hotel budget?' },
  { emoji: '🚕', label: 'Get around',       prompt: 'How do I get around safely here? Uber, taxis, transit — what\'s the real deal?' },
];

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AIScreen({
  btcPrice, locationName, countryCode, lat, lng,
  weather, advisoryScore, trips,
  onCreateTrip, onCreateFullTrip, onBack, onSwitchTab,
}: Props) {
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions]   = useState<string[]>([]);
  const [input, setInput]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [lastTrip, setLastTrip]         = useState<{ dest: string; country: string; days: number } | null>(null);
  const [tripCreatedToast, setTripCreatedToast] = useState('');
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceChip[]>([]);
  const [wizard, setWizard]             = useState<WizardState | null>(null);
  const bottomRef                       = useRef<HTMLDivElement>(null);
  const briefingKeyRef                  = useRef<string>('');
  const textareaRef                     = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, suggestions]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [input]);

  // Agentic auto-briefing when location changes
  useEffect(() => {
    if (!locationName) return;
    const key = `${locationName}|${countryCode || ''}`;
    if (briefingKeyRef.current === key) return;
    briefingKeyRef.current = key;

    setMessages([{
      id: 'briefing-loading',
      role: 'ai',
      text: `🧭 Scouting **${locationName}** for you…\n\nPulling live spots, conditions, and local intel.`,
      timestamp: Date.now(),
    }]);
    setNearbyPlaces([]);
    setSuggestions([]);
    setBriefingLoading(true);

    supabase.functions.invoke('ai-chat', {
      body: {
        message: 'agentic-briefing',
        history: [],
        agenticBriefing: true,
        context: {
          location: locationName,
          countryCode,
          lat,
          lng,
          btcPrice,
          weather: weather ? `${weather.emoji} ${weather.temp} ${weather.desc}` : undefined,
          advisoryScore,
        },
      },
    }).then(({ data, error }) => {
      if (error) throw error;
      const reply = data?.reply || `Here's the vibe for **${locationName}** — ask me anything!`;
      setMessages([{ id: 'briefing-result', role: 'ai', text: reply, timestamp: Date.now() }]);
      if (data?.places?.length) setNearbyPlaces(data.places);
      if (data?.suggestions?.length) setSuggestions(data.suggestions);
    }).catch(() => {
      setMessages([{
        id: 'briefing-fallback',
        role: 'ai',
        text: `Hey! I'm your Kipita travel intelligence AI — your ultimate "Know Before You Go" expert.\n\n📍 **${locationName || 'Wherever you are'}** — I'm ready to help.\n\nAsk me about safety, food, money, transport, or let me give you a full briefing.`,
        timestamp: Date.now(),
      }]);
    }).finally(() => setBriefingLoading(false));
  }, [locationName, countryCode, lat, lng, weather, advisoryScore, btcPrice]);

  const handlePlaceChipTap = useCallback((place: PlaceChip) => {
    if (onSwitchTab) onSwitchTab('places', placeTypeToHint(place.type));
  }, [onSwitchTab]);

  const handleCreateTrip = (dest: string) => {
    const knownDest = DESTINATIONS.find(d => dest.toLowerCase().includes(d.city.toLowerCase()));
    const cityName = knownDest?.city || dest.split(',')[0].trim();
    const countryName = knownDest?.country || dest.split(',')[1]?.trim() || '';
    const days = 7;
    if (onCreateTrip) {
      onCreateTrip(cityName, countryName, days);
      setTripCreatedToast(cityName);
      setTimeout(() => setTripCreatedToast(''), 3000);
    }
    setLastTrip(null);
  };

  const openWizard = (dest?: string) => {
    const knownDest = dest ? DESTINATIONS.find(d => dest.toLowerCase().includes(d.city.toLowerCase())) : null;
    const today = new Date();
    today.setDate(today.getDate() + 14);
    setWizard({
      step: 'destination',
      destination: knownDest?.city || dest || '',
      country: knownDest?.country || '',
      startDate: today.toISOString().split('T')[0],
      days: 7,
    });
  };

  const saveWizardTrip = () => {
    if (!wizard) return;
    const emojis = ['🏔️', '🌴', '🏖️', '🌺', '🗼', '🏙️', '🗽', '🏝️'];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const endDate = new Date(wizard.startDate);
    endDate.setDate(endDate.getDate() + wizard.days);
    const items = buildItinerary(wizard.destination, wizard.days, wizard.startDate);
    const trip: Trip = {
      id: Date.now().toString(),
      dest: wizard.destination,
      country: wizard.country,
      emoji,
      start: wizard.startDate,
      end: endDate.toISOString().split('T')[0],
      notes: `AI-planned ${wizard.days}-day trip to ${wizard.destination}`,
      status: 'upcoming',
      items,
      bookings: [],
      createdAt: Date.now(),
    };
    if (onCreateFullTrip) {
      onCreateFullTrip(trip);
    } else if (onCreateTrip) {
      onCreateTrip(wizard.destination, wizard.country, wizard.days);
    }
    setTripCreatedToast(wizard.destination);
    setTimeout(() => setTripCreatedToast(''), 3500);
    setWizard(null);
    setLastTrip(null);
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSuggestions([]);
    setLoading(true);

    try {
      const context: Record<string, unknown> = {};
      if (locationName) context.location = locationName;
      if (countryCode) context.countryCode = countryCode;
      if (typeof lat === 'number') context.lat = lat;
      if (typeof lng === 'number') context.lng = lng;
      if (btcPrice) context.btcPrice = btcPrice;
      if (weather) context.weather = `${weather.emoji} ${weather.temp} ${weather.desc}`;
      if (typeof advisoryScore === 'number') context.advisoryScore = advisoryScore;
      if (trips && trips.length > 0) context.trips = trips;

      const history = messages.slice(-10).map(m => ({ role: m.role, text: m.text }));

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { message: text.trim(), history, context },
      });

      if (error) throw error;

      const reply = data?.reply || "I'm sorry, I couldn't process that. Please try again.";
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', text: reply, timestamp: Date.now() };
      setMessages(prev => [...prev.slice(-18), aiMsg]);

      if (data?.places?.length) setNearbyPlaces(data.places);
      if (data?.suggestions?.length) setSuggestions(data.suggestions);

      // Detect trip planning intent
      if (
        /\b(plan|trip|travel|visit|itinerary|go to)\b/.test(text.toLowerCase()) &&
        !/\b(my trips?|my bookings?|show)\b/.test(text.toLowerCase())
      ) {
        const dest = extractDestFromMsg(text) || 'New Destination';
        const knownDest = DESTINATIONS.find(d => text.toLowerCase().includes(d.city.toLowerCase()));
        const days = parseInt(text.match(/(\d+)\s*days?/i)?.[1] || '7');
        setLastTrip({ dest, country: knownDest?.country || '', days });
      }
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: '⚠️ Having trouble connecting right now. Check your connection and try again.',
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, locationName, countryCode, lat, lng, btcPrice, weather, advisoryScore, trips]);

  const handleRefresh = () => {
    briefingKeyRef.current = '';
    setNearbyPlaces([]);
    setSuggestions([]);
    setLastTrip(null);
    setMessages([{
      id: '0',
      role: 'ai',
      text: `Fresh start! I'm your Kipita travel intelligence AI — "Know Before You Go" expert.\n\nAsk me anything about ${locationName || 'where you are'}, or tap a quick action to dive in. 🌍`,
      timestamp: Date.now(),
    }]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toast */}
      {tripCreatedToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-kipita-green text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg animate-fade-in">
          ✅ Trip to {tripCreatedToast} created!
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-kipita-navy via-kipita-red to-kipita-teal flex items-center justify-center flex-shrink-0">
          <span className="text-lg">✦</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground">Kipita AI</h3>
          <p className="text-xs text-muted-foreground truncate">
            {briefingLoading
              ? `🔍 Scouting ${locationName}…`
              : loading
              ? '💭 Thinking…'
              : `Know Before You Go · ${locationName || 'Locating…'}`}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="ms text-muted-foreground text-xl hover:text-foreground transition-colors p-1"
          title="Fresh start"
        >
          refresh
        </button>
      </div>

      {/* Live stats bar */}
      <StatsBar weather={weather} advisoryScore={advisoryScore} locationName={locationName} />

      {/* Quick actions horizontal scroll */}
      <div className="flex gap-2 px-3 py-2.5 overflow-x-auto scrollbar-hide flex-shrink-0 border-b border-border/50">
        {QUICK_ACTIONS.map(a => (
          <button
            key={a.label}
            onClick={() => a.prompt === '__OPEN_WIZARD__' ? openWizard() : sendMessage(a.prompt)}
            disabled={loading || briefingLoading}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-full text-xs font-semibold hover:bg-muted hover:border-kipita-red/30 transition-all disabled:opacity-40 active:scale-95"
          >
            <span>{a.emoji}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Trip Booking Wizard Modal */}
      {wizard && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end justify-center" onClick={() => setWizard(null)}>
          <div className="w-full max-w-md bg-card rounded-t-2xl shadow-2xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-base">✈️ Plan a Trip</h3>
              <button onClick={() => setWizard(null)} className="text-muted-foreground text-xl leading-none">✕</button>
            </div>

            {/* Step indicator */}
            <div className="flex gap-1.5 mb-5">
              {(['destination', 'dates', 'duration', 'confirm'] as WizardStep[]).map((s, i) => (
                <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${
                  ['destination', 'dates', 'duration', 'confirm'].indexOf(wizard.step) >= i
                    ? 'bg-kipita-red' : 'bg-muted'
                }`} />
              ))}
            </div>

            {wizard.step === 'destination' && (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">Where do you want to go?</p>
                <input
                  autoFocus
                  value={wizard.destination}
                  onChange={e => setWizard({ ...wizard, destination: e.target.value })}
                  placeholder="e.g. Tokyo, Bali, Paris…"
                  className="w-full bg-background border border-border rounded-kipita-sm px-4 py-3 text-sm outline-none focus:border-kipita-red"
                />
                <input
                  value={wizard.country}
                  onChange={e => setWizard({ ...wizard, country: e.target.value })}
                  placeholder="Country (optional)"
                  className="w-full bg-background border border-border rounded-kipita-sm px-4 py-3 text-sm outline-none focus:border-kipita-red"
                />
                <div className="flex flex-wrap gap-2">
                  {['Tokyo', 'Bali', 'Bangkok', 'Paris', 'Lisbon', 'NYC'].map(d => (
                    <button key={d} onClick={() => {
                      const kd = DESTINATIONS.find(x => x.city === d);
                      setWizard({ ...wizard, destination: d, country: kd?.country || '' });
                    }} className="px-3 py-1.5 bg-muted rounded-full text-xs font-semibold hover:bg-muted/80 transition-colors">
                      {d}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => wizard.destination && setWizard({ ...wizard, step: 'dates' })}
                  disabled={!wizard.destination}
                  className="w-full bg-kipita-red text-white py-3 rounded-kipita-sm font-bold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  Next →
                </button>
              </div>
            )}

            {wizard.step === 'dates' && (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">When are you leaving?</p>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Departure Date</label>
                  <input
                    type="date"
                    value={wizard.startDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setWizard({ ...wizard, startDate: e.target.value })}
                    className="w-full bg-background border border-border rounded-kipita-sm px-4 py-3 text-sm outline-none focus:border-kipita-red"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setWizard({ ...wizard, step: 'destination' })}
                    className="flex-1 py-3 bg-muted rounded-kipita-sm text-sm font-semibold text-muted-foreground">
                    ← Back
                  </button>
                  <button onClick={() => setWizard({ ...wizard, step: 'duration' })}
                    className="flex-1 bg-kipita-red text-white py-3 rounded-kipita-sm font-bold text-sm hover:opacity-90 transition-opacity">
                    Next →
                  </button>
                </div>
              </div>
            )}

            {wizard.step === 'duration' && (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">How many days?</p>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 5, 7, 10, 14, 21].map(d => (
                    <button key={d} onClick={() => setWizard({ ...wizard, days: d })}
                      className={`py-3 rounded-kipita-sm text-sm font-bold border transition-all ${
                        wizard.days === d ? 'bg-kipita-red text-white border-kipita-red' : 'bg-muted border-border text-foreground'
                      }`}>
                      {d}d
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setWizard({ ...wizard, step: 'dates' })}
                    className="flex-1 py-3 bg-muted rounded-kipita-sm text-sm font-semibold text-muted-foreground">
                    ← Back
                  </button>
                  <button onClick={() => setWizard({ ...wizard, step: 'confirm' })}
                    className="flex-1 bg-kipita-red text-white py-3 rounded-kipita-sm font-bold text-sm hover:opacity-90 transition-opacity">
                    Next →
                  </button>
                </div>
              </div>
            )}

            {wizard.step === 'confirm' && (
              <div className="space-y-4">
                <div className="bg-muted/60 rounded-kipita p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Destination</span>
                    <span className="font-bold">{wizard.destination}{wizard.country ? `, ${wizard.country}` : ''}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Departure</span>
                    <span className="font-bold">{wizard.startDate}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-bold">{wizard.days} days</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">Kipita AI will generate a full day-by-day itinerary for your trip.</p>
                <button onClick={saveWizardTrip}
                  className="w-full bg-gradient-to-r from-kipita-navy to-kipita-red text-white py-3.5 rounded-kipita-sm font-extrabold text-sm hover:opacity-90 transition-opacity">
                  ✈️ Save Trip + Generate Itinerary
                </button>
                <button onClick={() => setWizard({ ...wizard, step: 'duration' })}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  ← Back
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {/* Nearby place chips (shown after briefing) */}
        {!loading && !briefingLoading && nearbyPlaces.length > 0 && (
          <PlaceChips places={nearbyPlaces} onTap={handlePlaceChipTap} />
        )}

        {/* Suggestion chips */}
        {!loading && !briefingLoading && suggestions.length > 0 && (
          <SuggestionChips suggestions={suggestions} onTap={sendMessage} />
        )}

        {(loading || briefingLoading) && <TypingIndicator />}

        {/* Create trip CTA */}
        {lastTrip && !loading && (
          <div className="mx-2 p-4 bg-card border border-kipita-red/30 rounded-kipita shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">✈️</span>
              <div>
                <div className="text-xs font-extrabold text-foreground">Trip Detected: {lastTrip.dest}</div>
                <div className="text-[10px] text-muted-foreground">Build a full itinerary with AI</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => openWizard(lastTrip.dest)}
                className="flex-1 py-2.5 bg-kipita-red text-white rounded-kipita-sm text-xs font-bold hover:opacity-90 transition-opacity active:scale-95"
              >
                ✈️ Plan This Trip
              </button>
              <button
                onClick={() => setLastTrip(null)}
                className="px-3 py-2 bg-muted text-muted-foreground rounded-kipita-sm text-xs font-semibold"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 p-3 border-t border-border bg-card flex-shrink-0">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          placeholder="Ask anything about this destination…"
          rows={1}
          className="flex-1 resize-none bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red transition-colors min-h-[40px] max-h-[120px]"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          className="w-10 h-10 bg-kipita-red text-white rounded-full flex items-center justify-center flex-shrink-0 hover:bg-kipita-red/90 transition-all disabled:opacity-40 active:scale-95"
        >
          <span className="ms text-lg">send</span>
        </button>
      </div>
    </div>
  );
}
