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
  distanceMi?: number;
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
  /** Optional support handoff: when set, AI opens in support mode and auto-sends this prompt. */
  handoffPrompt?: string;
  /** Visible mode label shown in the header when in support handoff. */
  handoffLabel?: string;
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
    <div className="px-1 pb-2 pt-1">
      <p className="text-[10px] font-bold text-kipita-red uppercase tracking-wider mb-1.5 px-1">
        ✨ Recommended near you
      </p>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {places.map((p, i) => (
          <button
            key={`${p.name}-${i}`}
            onClick={() => onTap(p)}
            className="relative flex-shrink-0 bg-white border border-neutral-200 rounded-xl px-3 py-2 pb-4 text-left hover:border-neutral-400 transition-all min-w-[160px] max-w-[200px] active:scale-95 shadow-sm"
          >
            <div className="text-xs font-bold text-black truncate">{p.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {p.rating != null && (
                <span className="text-[10px] font-semibold text-amber-400">★ <span className="text-black">{p.rating}</span></span>
              )}
              {p.openNow === true  && <span className="text-[10px] text-emerald-600 font-medium">Open</span>}
              {p.openNow === false && <span className="text-[10px] text-neutral-500">Closed</span>}
            </div>
            <div className="text-[10px] text-neutral-600 mt-0.5 truncate">{p.type}</div>
            {p.distanceMi != null && (
              <div className="absolute bottom-1 right-2 text-[9px] font-medium text-neutral-400">
                {p.distanceMi < 0.1 ? '<0.1' : p.distanceMi.toFixed(1)} mi
              </div>
            )}
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
// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  msg,
  onInAppNav,
}: {
  msg: ChatMessage;
  onInAppNav?: (tab: TabId, hint?: string) => void;
}) {
  const isAI = msg.role === 'ai';

  // kipita://tab/<tab>?hint=<hint>  → in-app navigation
  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('kipita://')) {
      e.preventDefault();
      try {
        const u = new URL(href);
        // host = "tab", pathname = "/<tabId>"
        const tab = (u.pathname.replace(/^\//, '') || u.host) as TabId;
        const hint = u.searchParams.get('hint') || undefined;
        onInAppNav?.(tab, hint);
      } catch {
        /* ignore */
      }
    }
  };

  const renderLink = (label: string, href: string, bold = false) => {
    const isInApp = href.startsWith('kipita://');
    if (isInApp) {
      return (
        <button
          onClick={() => {
            try {
              const u = new URL(href);
              const tab = (u.pathname.replace(/^\//, '') || u.host) as TabId;
              const hint = u.searchParams.get('hint') || undefined;
              onInAppNav?.(tab, hint);
            } catch { /* ignore */ }
          }}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold align-baseline mx-0.5 ${
            isAI
              ? 'bg-kipita-red/10 text-kipita-red border border-kipita-red/30 hover:bg-kipita-red/20'
              : 'bg-white/20 text-white border border-white/40 hover:bg-white/30'
          } transition-colors`}
        >
          → {label}
        </button>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => handleAnchorClick(e, href)}
        className={`${isAI ? 'text-kipita-red' : 'text-white'} underline ${bold ? 'font-bold' : 'font-semibold'}`}
      >
        {label}
      </a>
    );
  };

  return (
    <div className={`flex ${isAI ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        isAI
          ? 'bg-card border border-border text-foreground rounded-bl-sm'
          : 'bg-kipita-red text-white rounded-br-sm'
      }`}>
        {msg.text.split(/(\*\*\[.*?\]\(.*?\)\*\*|\*\*.*?\*\*|\[.*?\]\(.*?\))/g).map((part, i) => {
          const boldLink = part.match(/^\*\*\[(.+?)\]\((.+?)\)\*\*$/);
          if (boldLink) return <span key={i}>{renderLink(boldLink[1], boldLink[2], true)}</span>;
          const bold = part.match(/^\*\*(.+?)\*\*$/);
          if (bold) return <strong key={i}>{bold[1]}</strong>;
          const link = part.match(/^\[(.+?)\]\((.+?)\)$/);
          if (link) return <span key={i}>{renderLink(link[1], link[2])}</span>;
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
// Order matches a traveler's natural decision flow: plan → brief → safety → health → eat/do → logistics → money.
// Wildfires, earthquakes, and active disasters are intentionally NOT separate chips — they live behind the
// 🛡️ Safety chip as a follow-up emergency briefing the user can opt into after their normal safety read.
const QUICK_ACTIONS = [
  { emoji: '✈️', label: 'Plan a trip',      prompt: '__OPEN_WIZARD__' },
  { emoji: '🗺️', label: 'Brief me',         prompt: 'Give me a full Know Before You Go briefing for where I am right now.' },
  { emoji: '🛡️', label: 'Safety',           prompt: 'What\'s the real safety situation here right now — crime, scams, things to watch for? Give me the normal briefing first, and at the end ask if I want a live emergency check (wildfires, earthquakes, active disasters).' },
  { emoji: '🌫️', label: 'Air quality',      prompt: 'How is the air quality and pollution near me right now? Use live AQI/PM2.5 data and tell me if it\'s safe to be outside or exercise.' },
  { emoji: '🏥', label: 'Health',           prompt: 'Give me a real health briefing for this area right now — air quality, water safety, disease risks, vaccines, and the nearest hospital. Use live data.' },
  { emoji: '💧', label: 'Tap water',        prompt: 'Is the tap water safe to drink here? Cite the CDC and explain risks if not.' },
  { emoji: '🍽️', label: 'Best food',        prompt: 'What\'s the best food near me right now? Be specific with real spots.' },
  { emoji: '🌃', label: 'Tonight',          prompt: 'What\'s the best thing to do tonight? Give me something specific and exciting.' },
  { emoji: '🏨', label: 'Where to stay',    prompt: 'What\'s the best neighborhood to stay in here, and what\'s a realistic hotel budget?' },
  { emoji: '🚕', label: 'Get around',       prompt: 'How do I get around safely here? Uber, taxis, transit — what\'s the real deal?' },
  { emoji: '🛂', label: 'Visas & entry',    prompt: 'What are the entry/visa requirements for this country and any docs I need to have ready?' },
  { emoji: '💱', label: 'Money & ATMs',     prompt: 'How should I handle money here — ATMs, cards, cash, tipping, and a realistic daily budget?' },
  { emoji: '⛽', label: 'Cheap gas',        prompt: 'I want to save on gas — what cashback or fuel rewards work here?' },
];

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AIScreen({
  btcPrice, locationName, countryCode, lat, lng,
  weather, advisoryScore, trips,
  onCreateTrip, onBack, onSwitchTab,
  handoffPrompt, handoffLabel,
}: Props) {
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions]   = useState<string[]>([]);
  const [input, setInput]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [lastTrip, setLastTrip]         = useState<{ dest: string; country: string; days: number } | null>(null);
  const [tripCreatedToast, setTripCreatedToast] = useState('');
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceChip[]>([]);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef                  = useRef<any>(null);
  const bottomRef                       = useRef<HTMLDivElement>(null);
  const scrollContainerRef              = useRef<HTMLDivElement>(null);
  const lastAiMsgRef                    = useRef<HTMLDivElement>(null);
  const briefingKeyRef                  = useRef<string>('');
  const textareaRef                     = useRef<HTMLTextAreaElement>(null);
  const prevMsgCountRef                 = useRef<number>(0);

  const speechSupported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const toggleListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(prev => (prev ? prev + ' ' : '') + transcript.trim());
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    recognitionRef.current = rec;
    try { rec.start(); setIsListening(true); } catch { setIsListening(false); }
  }, [isListening]);

  // Normal chat view: oldest message at the top, newest at the bottom.
  // Whenever a new message arrives (user or AI) or auxiliary content updates,
  // scroll the container to the bottom so the latest exchange is visible.
  useEffect(() => {
    prevMsgCountRef.current = messages.length;
    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    });
  }, [messages, suggestions, nearbyPlaces, briefingLoading, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [input]);

  // Agentic auto-briefing when location changes (skip in support handoff mode)
  useEffect(() => {
    if (handoffPrompt) return;
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
        text: `Hey! I'm **Know B4 You Go**, your travel intelligence AI.\n\n📍 **${locationName || 'Wherever you are'}** — I'm ready to help.\n\nAsk me about safety, food, money, transport, or let me give you a full briefing.`,
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

      // Recommended chips are situational — clear them when the new reply has none,
      // so stale chips from a prior question don't linger.
      setNearbyPlaces(data?.places?.length ? data.places : []);
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

  // Support handoff: auto-send the prefilled prompt once on mount
  const handoffSentRef = useRef(false);
  useEffect(() => {
    if (!handoffPrompt || handoffSentRef.current) return;
    handoffSentRef.current = true;
    // Seed an intro message so the user sees the support context immediately
    setMessages([{
      id: 'handoff-intro',
      role: 'ai',
      text: `🆘 **${handoffLabel || 'Support handoff'}** — I've got the full context. Working on next steps now…`,
      timestamp: Date.now(),
    }]);
    // Defer to ensure sendMessage closure is ready
    const t = setTimeout(() => sendMessage(handoffPrompt), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffPrompt]);

  const handleRefresh = () => {
    briefingKeyRef.current = '';
    setNearbyPlaces([]);
    setSuggestions([]);
    setLastTrip(null);
    setMessages([{
      id: '0',
      role: 'ai',
      text: `Fresh start! I'm **Know B4 You Go** — your travel intelligence AI.\n\nAsk me anything about ${locationName || 'where you are'}, or tap a quick action to dive in. 🌍`,
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
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card flex-shrink-0">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-kipita-navy via-kipita-red to-kipita-teal flex items-center justify-center flex-shrink-0">
          <span className="text-xs">✦</span>
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <h3 className="font-extrabold text-foreground text-base leading-tight">Know B4 You Go</h3>
          <p className="text-[10px] text-muted-foreground leading-tight truncate">
            {briefingLoading
              ? `🔍 Scouting ${locationName}…`
              : loading
              ? '💭 Thinking…'
              : 'Intelligence Powered Insights'}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="ms text-muted-foreground text-base hover:text-foreground transition-colors p-1"
          title="Fresh start"
        >
          refresh
        </button>
      </div>

      {/* Live stats bar */}
      <StatsBar weather={weather} advisoryScore={advisoryScore} locationName={locationName} />

      {/* Quick actions horizontal scroll */}
      <div data-tour="ai-quick-actions" className="flex gap-2 px-3 py-2.5 overflow-x-auto scrollbar-hide flex-shrink-0 border-b border-border/50">
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

      {/* Messages — normal chronological order: oldest at top, newest at bottom */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, idx) => {
          const isNewest = idx === messages.length - 1 && msg.role === 'ai';
          return (
            <div key={msg.id} ref={isNewest ? lastAiMsgRef : undefined}>
              <MessageBubble msg={msg} onInAppNav={onSwitchTab} />
            </div>
          );
        })}

        {(loading || briefingLoading) && <TypingIndicator />}

        {/* Nearby place chips (shown after briefing) */}
        {!loading && !briefingLoading && nearbyPlaces.length > 0 && (
          <PlaceChips places={nearbyPlaces} onTap={handlePlaceChipTap} />
        )}

        {/* Suggestion chips */}
        {!loading && !briefingLoading && suggestions.length > 0 && (
          <SuggestionChips suggestions={suggestions} onTap={sendMessage} />
        )}

        {/* Open in Planner CTA */}
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
      <div data-tour="ai-input" className="flex items-end gap-2 p-3 border-t border-border bg-card flex-shrink-0">
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
        {speechSupported && (
          <button
            onClick={toggleListening}
            type="button"
            title={isListening ? 'Stop listening' : 'Voice input'}
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95 ${isListening ? 'bg-kipita-red text-white animate-pulse' : 'bg-muted text-foreground hover:bg-muted/70'}`}
          >
            <span className="ms text-lg">{isListening ? 'mic' : 'mic_none'}</span>
          </button>
        )}
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
