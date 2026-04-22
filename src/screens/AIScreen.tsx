import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, Trip, Booking } from '../types';
import { DESTINATIONS } from '../data';
import { supabase } from '../integrations/supabase/client';

/* ── Markdown renderer ────────────────────────────────────────────────────── */
function parseInline(str: string, key: string): React.ReactNode[] {
  const tokens = str.split(/(\*\*\[[^\]]+\]\([^)]+\)\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return tokens.map((tok, j) => {
    const boldLink = tok.match(/^\*\*\[(.+?)\]\((.+?)\)\*\*$/);
    if (boldLink) return <a key={`${key}bl${j}`} href={boldLink[2]} target="_blank" rel="noopener noreferrer" className="text-kipita-red underline font-bold">{boldLink[1]}</a>;
    if (/^\*\*(.+)\*\*$/.test(tok)) return <strong key={`${key}b${j}`}>{tok.slice(2, -2)}</strong>;
    if (/^\*(.+)\*$/.test(tok)) return <em key={`${key}i${j}`}>{tok.slice(1, -1)}</em>;
    if (/^`(.+)`$/.test(tok)) return <code key={`${key}c${j}`} className="bg-muted/60 px-1 rounded text-[11px] font-mono">{tok.slice(1, -1)}</code>;
    const link = tok.match(/^\[(.+?)\]\((.+?)\)$/);
    if (link) return <a key={`${key}a${j}`} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-kipita-red underline font-semibold">{link[1]}</a>;
    return <span key={`${key}t${j}`}>{tok}</span>;
  });
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (line.startsWith('## ')) {
      out.push(<p key={i} className="text-sm font-bold text-foreground mt-2 mb-0.5">{line.slice(3)}</p>);
      i++;
    } else if (line.startsWith('### ')) {
      out.push(<p key={i} className="text-xs font-semibold text-foreground mt-1.5 mb-0.5">{line.slice(4)}</p>);
      i++;
    } else if (line === '---') {
      out.push(<hr key={i} className="border-border my-1.5" />);
      i++;
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('• '))) {
        const content = lines[i].trim().replace(/^[-•]\s/, '');
        items.push(<li key={i} className="leading-snug">{parseInline(content, `li${i}`)}</li>);
        i++;
      }
      out.push(<ul key={`ul${i}`} className="list-disc pl-4 space-y-0.5 my-1 text-sm">{items}</ul>);
    } else if (/^\d+\.\s/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        const content = lines[i].trim().replace(/^\d+\.\s/, '');
        items.push(<li key={i} className="leading-snug">{parseInline(content, `ol${i}`)}</li>);
        i++;
      }
      out.push(<ol key={`ol${i}`} className="list-decimal pl-4 space-y-0.5 my-1 text-sm">{items}</ol>);
    } else if (line === '') {
      if (out.length > 0) out.push(<div key={i} className="h-1" />);
      i++;
    } else {
      out.push(<p key={i} className="text-sm leading-relaxed">{parseInline(line, `p${i}`)}</p>);
      i++;
    }
  }
  return <>{out}</>;
}

/* ── Follow-up suggestion generator ──────────────────────────────────────── */
function getFollowUps(aiText: string, location: string): string[] {
  const t = aiText.toLowerCase();
  const loc = location?.split(',')[0] || 'Bali';
  const rules: [RegExp, string[]][] = [
    [/visa|entry require|passport|border/, [`How long can I stay in ${loc}?`, 'Digital nomad visas available?', 'Do I need travel insurance?']],
    [/cost|budget|per month|expensive|cheap|price/, ['Cheapest neighborhoods to stay?', 'What\'s a good daily budget?', 'How does it compare to NYC?']],
    [/hotel|hostel|airbnb|accommodation|coliv/, ['Best neighborhoods to stay in?', 'Long-term rental options?', 'Coliving spaces near me?']],
    [/safe|crime|danger|scam|security/, ['Which areas to avoid?', 'Common scams to watch out for?', 'Emergency numbers?']],
    [/food|restaurant|eat|cuisine|street food/, ['Best street food spots?', 'Vegan/vegetarian options?', 'How much is a typical meal?']],
    [/nomad|cowork|remote work|wifi|internet/, ['Best coworking spaces?', 'Is internet fast enough for video calls?', 'Nomad community tips?']],
    [/flight|airport|airline|fly|transit/, ['Budget airlines for this route?', 'Best time to book?', 'Airport to city center transport?']],
    [/itinerary|day 1|day 2|week|schedule|plan/, [`Create a ${loc} trip in my app`, 'What to pack?', 'Best day trips nearby?']],
    [/bitcoin|btc|crypto|exchange rate|currency/, ['Where to exchange USD?', 'Fee-free banking abroad?', 'Bitcoin-friendly spots?']],
    [/weather|climate|season|rainy|monsoon/, ['Best time of year to visit?', 'What to pack for the weather?', 'Shoulder season benefits?']],
    [/health|vaccine|hospital|insurance|medical/, ['Do I need vaccines?', 'What travel insurance do you recommend?', 'Quality of healthcare?']],
  ];
  for (const [rx, sugg] of rules) {
    if (rx.test(t)) return sugg;
  }
  return [`Cost of living in ${loc}?`, `Is ${loc} safe for solo travelers?`, `Digital nomad tips for ${loc}?`];
}

function extractDest(msg: string) {
  const known = DESTINATIONS.find(d => msg.toLowerCase().includes(d.city.toLowerCase()));
  if (known) return `${known.city}, ${known.country}`;
  const cleaned = msg.replace(/plan|a|my|trip|to|travel|for|in|visit|itinerary|i want|go to|take me to|tell me about|what about|how is|\?/gi, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > 2 ? cleaned.replace(/\b\w/g, c => c.toUpperCase()) : null;
}

const CHAT_STORAGE_KEY = 'kipita_ai_messages_v2';

/* ── Component ────────────────────────────────────────────────────────────── */
interface Props {
  btcPrice?: number;
  locationName?: string;
  countryCode?: string;
  weather?: { emoji: string; temp: string; desc: string };
  trips?: Trip[];
  onCreateTrip?: (dest: string, country: string, days: number) => void;
  onAddBooking?: (tripId: string, booking: Booking) => void;
  onBack?: () => void;
}

const WELCOME: ChatMessage = {
  id: '0', role: 'ai', timestamp: 0,
  text: "Hi! I'm **Kipita AI** — your real-time travel intelligence companion.\n\nI know visa requirements, cost of living, safety conditions, nomad hotspots, and more — with live exchange rates and destination data built in.\n\n💡 Try: *\"Plan 7 days in Bali\"* · *\"Is Mexico City safe?\"* · *\"Cheapest nomad cities under $1k/mo\"*",
};

export default function AIScreen({ btcPrice, locationName, countryCode, weather, trips, onCreateTrip, onAddBooking: _onAddBooking, onBack: _onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [lastTrip, setLastTrip] = useState<{ dest: string; country: string; days: number } | null>(null);
  const [tripToast, setTripToast] = useState('');
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<any>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const city = locationName?.split(',')[0] || 'Bangkok';

  /* Persist messages */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed: ChatMessage[] = JSON.parse(saved);
        if (parsed.length > 1) { setMessages(parsed); return; }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (messages.length > 1) {
      try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-30))); } catch { /* ignore */ }
    }
  }, [messages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  /* Voice input */
  const hasVoice = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const toggleVoice = () => {
    if (listening) { recogRef.current?.abort(); setListening(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.onresult = (e: any) => { setInput(e.results[0][0].transcript); setListening(false); inputRef.current?.focus(); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recogRef.current = rec;
    rec.start();
    setListening(true);
  };

  /* Quick actions */
  const quickActions = [
    { emoji: '🗺️', label: 'Plan Trip',      prompt: `Plan a 7-day digital nomad trip to ${city}. Give a day-by-day itinerary.` },
    { emoji: '💰', label: 'Cost of Living', prompt: `What does it cost to live comfortably in ${city} for one month? Break it down.` },
    { emoji: '🛂', label: 'Visa Info',      prompt: `What are the visa and entry requirements for ${locationName?.split(',')[1]?.trim() || city}? US passport.` },
    { emoji: '🛡️', label: 'Safety',         prompt: `Is ${city} safe right now? What should a traveler know about safety there?` },
    { emoji: '💻', label: 'Nomad Life',     prompt: `Is ${city} good for digital nomads? Cover coworking, wifi speeds, community, and vibe.` },
    { emoji: '🏨', label: 'Where to Stay',  prompt: `Best neighborhoods and accommodation options for a traveler in ${city}. All budgets.` },
    { emoji: '🍜', label: 'Food & Eats',    prompt: `Best local food, must-try dishes, and top restaurants in ${city}.` },
    { emoji: '💱', label: 'Currency Tips',  prompt: `Currency and money tips for ${locationName || city} — best exchange apps, ATM strategy, avoid fees.` },
  ];

  /* Send message */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setSuggestions([]);
    setLastTrip(null);

    try {
      const context: Record<string, unknown> = {};
      if (locationName)  context.location    = locationName;
      if (countryCode)   context.countryCode = countryCode;
      if (btcPrice)      context.btcPrice    = btcPrice;
      if (weather)       context.weather     = `${weather.emoji} ${weather.temp} ${weather.desc}`;
      if (trips?.length) context.trips       = trips;

      const history = messages.slice(-12).map(m => ({ role: m.role, text: m.text }));

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { message: text.trim(), history, context },
      });

      if (error) throw error;

      const reply = data?.reply || "I'm having trouble connecting. Please try again.";
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', text: reply, timestamp: Date.now() };
      setMessages(prev => [...prev.slice(-20), aiMsg]);
      setSuggestions(getFollowUps(reply, locationName || ''));

      // Detect trip intent
      if (/\b(plan|trip|travel|visit|itinerary|go to)\b/i.test(text) && !/\b(my trips?|show|bookings?)\b/i.test(text)) {
        const dest = extractDest(text) || 'New Destination';
        const known = DESTINATIONS.find(d => text.toLowerCase().includes(d.city.toLowerCase()));
        const days = parseInt(text.match(/(\d+)\s*days?/i)?.[1] || '7');
        setLastTrip({ dest, country: known?.country || '', days });
      }
    } catch (err) {
      console.error('AI chat error:', err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'ai', timestamp: Date.now(),
        text: '⚠️ Connection issue. Check your network and try again.',
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, locationName, countryCode, btcPrice, weather, trips]);

  const handleCreateTrip = (dest: string) => {
    const known = DESTINATIONS.find(d => dest.toLowerCase().includes(d.city.toLowerCase()));
    const city  = known?.city    || dest.split(',')[0].trim();
    const cntry = known?.country || dest.split(',')[1]?.trim() || '';
    if (onCreateTrip) { onCreateTrip(city, cntry, lastTrip?.days ?? 7); }
    setTripToast(city);
    setTimeout(() => setTripToast(''), 3000);
    setLastTrip(null);
  };

  const clearChat = () => {
    setMessages([WELCOME]);
    setSuggestions([]);
    setLastTrip(null);
    try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Trip created toast */}
      {tripToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-kipita-green text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
          ✅ Trip to {tripToast} created!
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-kipita-navy to-kipita-red flex items-center justify-center text-lg flex-shrink-0">✨</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-sm">Kipita AI</h3>
          <p className="text-[10px] text-muted-foreground truncate">
            {loading ? '● Thinking…' : 'Gemini · Live exchange rates · Country data'}
          </p>
        </div>
        <button onClick={clearChat} title="Clear chat"
          className="ms text-muted-foreground text-xl hover:text-foreground transition-colors flex-shrink-0">
          refresh
        </button>
      </div>

      {/* Live context bar */}
      {(locationName || weather || btcPrice) && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 border-b border-border overflow-x-auto scrollbar-hide flex-shrink-0">
          <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider flex-shrink-0 mr-1">Context:</span>
          {locationName && (
            <span className="text-[10px] text-muted-foreground bg-card border border-border rounded-full px-2 py-0.5 flex-shrink-0">
              📍 {locationName.split(',')[0]}
            </span>
          )}
          {weather && (
            <span className="text-[10px] text-muted-foreground bg-card border border-border rounded-full px-2 py-0.5 flex-shrink-0">
              {weather.emoji} {weather.temp}
            </span>
          )}
          {btcPrice && (
            <span className="text-[10px] text-muted-foreground bg-card border border-border rounded-full px-2 py-0.5 flex-shrink-0">
              ₿ ${btcPrice.toLocaleString()}
            </span>
          )}
          {(trips?.length ?? 0) > 0 && (
            <span className="text-[10px] text-muted-foreground bg-card border border-border rounded-full px-2 py-0.5 flex-shrink-0">
              ✈️ {trips!.length} trip{trips!.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Quick action chips */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto scrollbar-hide flex-shrink-0 border-b border-border">
        {quickActions.map(a => (
          <button key={a.label} onClick={() => sendMessage(a.prompt)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-full text-[11px] font-semibold text-foreground hover:border-kipita-red/50 hover:bg-muted transition-all">
            <span>{a.emoji}</span><span>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, idx) => {
          const isLastAi = msg.role === 'ai' && idx === messages.length - 1 && !loading;
          return (
            <div key={msg.id}>
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-kipita-navy to-kipita-red flex items-center justify-center text-[10px] mr-2 flex-shrink-0 mt-1">✨</div>
                )}
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-kipita-red text-white rounded-br-sm text-sm leading-relaxed'
                    : 'bg-card border border-border text-foreground rounded-bl-sm'
                }`}>
                  {msg.role === 'user'
                    ? msg.text
                    : renderMarkdown(msg.text)
                  }
                </div>
              </div>

              {/* Follow-up suggestion chips after last AI message */}
              {isLastAi && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
                  {suggestions.map(s => (
                    <button key={s} onClick={() => sendMessage(s)}
                      className="text-[11px] px-2.5 py-1 bg-muted/50 border border-border rounded-full text-muted-foreground hover:text-foreground hover:border-kipita-red/40 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-start items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-kipita-navy to-kipita-red flex items-center justify-center text-[10px] flex-shrink-0">✨</div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 150, 300].map(delay => (
                  <span key={delay} className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Create Trip CTA */}
        {lastTrip && !loading && (
          <div className="flex justify-center gap-2 py-1">
            <button onClick={() => handleCreateTrip(lastTrip.dest)}
              className="px-4 py-2 bg-kipita-green text-white rounded-full text-xs font-bold hover:opacity-90 transition-opacity">
              ✈️ Create Trip: {lastTrip.dest}
            </button>
            <button onClick={() => setLastTrip(null)}
              className="px-3 py-2 bg-muted text-muted-foreground rounded-full text-xs font-semibold hover:bg-muted/80">
              Dismiss
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex items-end gap-2 px-3 py-3 border-t border-border bg-card flex-shrink-0">
        {hasVoice && (
          <button onClick={toggleVoice} title={listening ? 'Stop listening' : 'Voice input'}
            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
              listening
                ? 'bg-kipita-red text-white animate-pulse'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}>
            <span className="ms text-lg">{listening ? 'mic' : 'mic_none'}</span>
          </button>
        )}
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder="Ask anything about travel, visas, costs, safety…"
          rows={1}
          className="flex-1 resize-none bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red transition-colors"
        />
        <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
          className="w-9 h-9 bg-kipita-red text-white rounded-full flex items-center justify-center flex-shrink-0 hover:bg-kipita-red/90 disabled:opacity-40 transition-all">
          <span className="ms text-lg">send</span>
        </button>
      </div>
    </div>
  );
}
