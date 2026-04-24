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
  onAddBooking?: (tripId: string, booking: Booking) => void;
  onBack?: () => void;
  onSwitchTab?: (tab: TabId, hint?: string) => void;
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
  { emoji: '✈️', label: 'Plan a trip',      prompt: '__OPEN_WIZARD__' },
  { emoji: '🗺️', label: 'Brief me',        prompt: 'Give me a full Know Before You Go briefing for where I am right now.' },
  { emoji: '🛡️', label: 'Safety intel',   prompt: 'What\'s the real safety situation here? What should I specifically watch out for?' },
  { emoji: '🍽️', label: 'Best food',       prompt: 'What\'s the best food near me right now? Be specific with real spots.' },
  { emoji: '💰', label: 'Money tips',       prompt: 'What do I need to know about money here? ATMs, cards, budget, tips.' },
  { emoji: '🌃', label: 'Tonight',          prompt: 'What\'s the best thing to do tonight? Give me something specific and exciting.' },
  { emoji: '🏨', label: 'Where to stay',   prompt: 'What\'s the best neighborhood to stay in here, and what\'s a realistic hotel budget?' },
  { emoji: '🚕', label: 'Get around',       prompt: 'How do I get around safely here? Uber, taxis, transit — what\'s the real deal?' },
];

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AIScreen({
  btcPrice, locationName, countryCode, lat, lng,
  weather, advisoryScore, trips,
  onCreateTrip, onBack, onSwitchTab,
}: Props) {
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions]   = useState<string[]>([]);
  const [input, setInput]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [lastTrip, setLastTrip]         = useState<{ dest: string; country: string; days: number } | null>(null);
  const [tripCreatedToast, setTripCreatedToast] = useState('');
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceChip[]>([]);
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

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    // Intercept Plan-a-trip quick action → jump straight to wizard at current location
    if (text.trim() === '__OPEN_WIZARD__') {
      const hint = locationName ? `plan:${locationName}|${countryCode || ''}` : '';
      onSwitchTab?.('trips', hint);
      return;
    }
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
  }, [loading, messages, locationName, countryCode, lat, lng, btcPrice, weather, advisoryScore, trips, onSwitchTab]);

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
            onClick={() => sendMessage(a.prompt)}
            disabled={loading || briefingLoading}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-full text-xs font-semibold hover:bg-muted hover:border-kipita-red/30 transition-all disabled:opacity-40 active:scale-95"
          >
            <span>{a.emoji}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>

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

        {/* Open in Planner CTA — preferred path: rich preview + dates + duration */}
        {lastTrip && !loading && (
          <div className="flex flex-col items-center gap-2 my-2">
            <button
              onClick={() => {
                const cityFromDest = lastTrip.dest.split(',')[0].trim();
                const hint = `plan:${cityFromDest}|${lastTrip.country}`;
                setLastTrip(null);
                onSwitchTab?.('trips', hint);
              }}
              className="px-4 py-2 bg-kipita-red text-white rounded-full text-xs font-bold hover:opacity-90 transition-opacity active:scale-95 shadow-md"
            >
              ✈️ Open {lastTrip.dest.split(',')[0]} in Trip Planner
            </button>
            <button
              onClick={() => handleCreateTrip(lastTrip.dest)}
              className="text-[11px] text-muted-foreground underline"
            >
              Or quick-create a {lastTrip.days}-day trip
            </button>
            <button
              onClick={() => setLastTrip(null)}
              className="text-[10px] text-muted-foreground"
            >
              Dismiss
            </button>
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
