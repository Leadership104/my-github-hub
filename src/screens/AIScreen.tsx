import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, Trip, Booking, TabId } from '../types';
import { DESTINATIONS } from '../data';
import { supabase } from '../integrations/supabase/client';

function extractDestFromMsg(msg: string) {
  const known = DESTINATIONS.find(d => msg.toLowerCase().includes(d.city.toLowerCase()));
  if (known) return `${known.city}, ${known.country}`;
  const cleaned = msg.replace(/plan|a|my|trip|to|travel|for|in|visit|itinerary|i want|go to|take me to|tell me about|what about|how is|\?/gi, ' ').replace(/\s+/g, ' ').trim();
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

// Map place types to Places screen section hints
function placeTypeToHint(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('restaurant') || t.includes('food')) return 'food';
  if (t.includes('cafe') || t.includes('coffee')) return 'coffee';
  if (t.includes('bar') || t.includes('pub') || t.includes('night')) return 'nightlife';
  if (t.includes('attraction') || t.includes('museum') || t.includes('park')) return 'attractions';
  if (t.includes('shop') || t.includes('store') || t.includes('mall')) return 'shopping';
  return 'food';
}

function PlaceChips({ places, onTap }: { places: PlaceChip[]; onTap: (p: PlaceChip) => void }) {
  if (!places.length) return null;
  return (
    <div className="px-1 pb-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">📍 Spots nearby — tap to explore</p>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {places.map((p, i) => (
          <button
            key={`${p.name}-${i}`}
            onClick={() => onTap(p)}
            className="flex-shrink-0 bg-card border border-border rounded-xl px-3 py-2 text-left hover:border-kipita-red/40 hover:bg-muted transition-all max-w-[180px]"
          >
            <div className="text-xs font-bold text-foreground truncate">{p.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {p.rating && <span className="text-[10px] font-semibold text-amber-500">★ {p.rating}</span>}
              {p.openNow === true && <span className="text-[10px] text-emerald-500 font-medium">Open</span>}
              {p.openNow === false && <span className="text-[10px] text-muted-foreground">Closed</span>}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{p.type}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        msg.role === 'user'
          ? 'bg-kipita-red text-white rounded-br-sm'
          : 'bg-card border border-border text-foreground rounded-bl-sm'
      }`}>
        {msg.text.split(/(\*\*\[.*?\]\(.*?\)\*\*|\*\*.*?\*\*|\[.*?\]\(.*?\))/g).map((part, i) => {
          const boldLinkMatch = part.match(/^\*\*\[(.+?)\]\((.+?)\)\*\*$/);
          if (boldLinkMatch) return <a key={i} href={boldLinkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-kipita-red underline font-bold">{boldLinkMatch[1]}</a>;
          const boldMatch = part.match(/^\*\*(.+?)\*\*$/);
          if (boldMatch) return <strong key={i}>{boldMatch[1]}</strong>;
          const linkMatch = part.match(/^\[(.+?)\]\((.+?)\)$/);
          if (linkMatch) return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-kipita-red underline font-semibold">{linkMatch[1]}</a>;
          return <span key={i}>{part}</span>;
        })}
      </div>
    </div>
  );
}

export default function AIScreen({ btcPrice, locationName, countryCode, lat, lng, weather, advisoryScore, trips, onCreateTrip, onAddBooking, onBack, onSwitchTab }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [lastTrip, setLastTrip] = useState<{ dest: string; country: string; days: number } | null>(null);
  const [tripCreatedToast, setTripCreatedToast] = useState('');
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceChip[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const briefingKeyRef = useRef<string>('');

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Agentic auto-briefing
  useEffect(() => {
    if (!locationName) return;
    const key = `${locationName}|${countryCode || ''}`;
    if (briefingKeyRef.current === key) return;
    briefingKeyRef.current = key;

    const placeholder: ChatMessage = {
      id: 'briefing-' + Date.now(),
      role: 'ai',
      text: `🧭 Checking out **${locationName}** for you…\n\nPulling live spots, weather, and the vibe.`,
      timestamp: Date.now(),
    };
    setMessages([placeholder]);
    setNearbyPlaces([]);
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
    }).catch((err) => {
      console.error('Briefing error:', err);
      setMessages([{
        id: 'briefing-fallback', role: 'ai',
        text: `Hey! I'm your Kipita AI travel buddy. Couldn't pull live data for **${locationName}** right now, but I'm here to help.\n\n💡 Try: "What should I do today?" · "Best food nearby" · "Is it safe here?"`,
        timestamp: Date.now(),
      }]);
    }).finally(() => setBriefingLoading(false));
  }, [locationName, countryCode, lat, lng, weather, advisoryScore, btcPrice]);

  const quickActions = [
    { emoji: '📋', label: 'My Trips', prompt: 'Show my trips and bookings' },
    { emoji: '✈️', label: 'Plan Trip', prompt: 'Plan a 5-day trip for a digital nomad' },
    { emoji: '🛡️', label: 'Safety', prompt: `Give me the real safety vibe for ${locationName || 'my area'} — what should I watch out for?` },
    { emoji: '🍽️', label: 'Best Food', prompt: `What's the best food near me right now?` },
    { emoji: '🌃', label: 'Tonight', prompt: `What should I do tonight in ${locationName || 'this area'}?` },
  ];

  const handlePlaceChipTap = useCallback((place: PlaceChip) => {
    if (onSwitchTab) {
      const hint = placeTypeToHint(place.type);
      onSwitchTab('places', hint);
    }
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
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const context: Record<string, unknown> = {};
      if (locationName) context.location = locationName;
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

      // Update place chips if new ones came back
      if (data?.places?.length) setNearbyPlaces(data.places);

      // Detect trip planning intent
      if (/\b(plan|trip|travel|visit|itinerary|go to)\b/.test(text.toLowerCase()) && !/\b(my trips?|my bookings?|show)\b/.test(text.toLowerCase())) {
        const dest = extractDestFromMsg(text) || 'New Destination';
        const knownDest = DESTINATIONS.find(d => text.toLowerCase().includes(d.city.toLowerCase()));
        const days = parseInt(text.match(/(\d+)\s*days?/i)?.[1] || '7');
        setLastTrip({ dest, country: knownDest?.country || '', days });
      }
    } catch (err) {
      console.error('AI chat error:', err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(), role: 'ai',
        text: "⚠️ Having trouble connecting right now. Check your connection and try again.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, locationName, lat, lng, btcPrice, weather, advisoryScore, trips]);

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
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-kipita-navy to-kipita-red flex items-center justify-center text-xl">✨</div>
        <div className="flex-1">
          <h3 className="font-bold text-foreground">Kipita AI</h3>
          <p className="text-xs text-muted-foreground">
            {briefingLoading ? `Scouting ${locationName}…` : loading ? 'Thinking…' : `📍 ${locationName || 'Live data'} · Your travel buddy`}
          </p>
        </div>
        <button onClick={() => { briefingKeyRef.current = ''; setNearbyPlaces([]); setMessages([{ id: '0', role: 'ai', text: "Fresh start! What's on your mind? 🌍", timestamp: Date.now() }]); setLastTrip(null); }}
          className="ms text-muted-foreground text-xl hover:text-foreground transition-colors">refresh</button>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 p-3 overflow-x-auto scrollbar-hide flex-shrink-0">
        {quickActions.map(a => (
          <button key={a.label} onClick={() => sendMessage(a.prompt)}
            className="flex-shrink-0 px-3 py-2 bg-card border border-border rounded-full text-xs font-semibold hover:bg-muted transition-colors">
            {a.emoji} {a.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {/* Place chips after briefing */}
        {!loading && !briefingLoading && nearbyPlaces.length > 0 && (
          <PlaceChips places={nearbyPlaces} onTap={handlePlaceChipTap} />
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl px-4 py-3 rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Add to Trips button */}
        {lastTrip && !loading && (
          <div className="flex justify-center gap-2">
            <button onClick={() => handleCreateTrip(lastTrip.dest)}
              className="px-4 py-2 bg-kipita-green text-white rounded-full text-xs font-bold hover:opacity-90 transition-opacity">
              ✈️ Create Trip: {lastTrip.dest}
            </button>
            <button onClick={() => setLastTrip(null)}
              className="px-3 py-2 bg-muted text-muted-foreground rounded-full text-xs font-semibold">
              Dismiss
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 p-3 border-t border-border bg-card flex-shrink-0">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder="Ask me anything about this area…"
          rows={1}
          className="flex-1 resize-none bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red transition-colors"
        />
        <button onClick={() => sendMessage(input)}
          className="w-10 h-10 bg-kipita-red text-white rounded-full flex items-center justify-center flex-shrink-0 hover:bg-kipita-red-dk transition-colors">
          <span className="ms text-lg">send</span>
        </button>
      </div>
    </div>
  );
}
