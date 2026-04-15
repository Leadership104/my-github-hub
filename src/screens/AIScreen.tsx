import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, Trip, Booking } from '../types';
import { DESTINATIONS } from '../data';
import { supabase } from '../integrations/supabase/client';

function extractDestFromMsg(msg: string) {
  const known = DESTINATIONS.find(d => msg.toLowerCase().includes(d.city.toLowerCase()));
  if (known) return `${known.city}, ${known.country}`;
  const cleaned = msg.replace(/plan|a|my|trip|to|travel|for|in|visit|itinerary|i want|go to|take me to|tell me about|what about|how is|\?/gi, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > 2 ? cleaned.replace(/\b\w/g, c => c.toUpperCase()) : null;
}

interface Props {
  btcPrice?: number;
  locationName?: string;
  weather?: { emoji: string; temp: string; desc: string };
  trips?: Trip[];
  onCreateTrip?: (dest: string, country: string, days: number) => void;
  onAddBooking?: (tripId: string, booking: Booking) => void;
  onBack?: () => void;
}

export default function AIScreen({ btcPrice, locationName, weather, trips, onCreateTrip, onAddBooking, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'ai', text: "Hi! I'm Kipita AI — your real-time travel companion powered by Gemini. I can help you plan trips, find places, check safety, and more.\n\n💡 Try: \"Plan a trip to Bali\" · \"Is Tokyo safe?\" · \"Best nomad cities 2026\"", timestamp: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastTrip, setLastTrip] = useState<{ dest: string; country: string; days: number } | null>(null);
  const [tripCreatedToast, setTripCreatedToast] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const quickActions = [
    { emoji: '📋', label: 'My Trips', prompt: 'Show my trips and bookings' },
    { emoji: '✈️', label: 'Plan Trip', prompt: 'Plan a 5-day trip for a digital nomad' },
    { emoji: '🏨', label: 'Book Hotel', prompt: `Book a hotel in ${locationName || 'Tokyo'}` },
    { emoji: '🛡️', label: 'Safety', prompt: `What is the safety situation for ${locationName || 'my area'}?` },
    { emoji: '💰', label: 'Cost Guide', prompt: `How much does it cost to live in ${locationName || 'Lisbon'}?` },
  ];

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
      if (btcPrice) context.btcPrice = btcPrice;
      if (weather) context.weather = `${weather.emoji} ${weather.temp} ${weather.desc}`;
      if (trips && trips.length > 0) context.trips = trips;

      // Send recent history for context
      const history = messages.slice(-10).map(m => ({ role: m.role, text: m.text }));

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { message: text.trim(), history, context },
      });

      if (error) throw error;

      const reply = data?.reply || "I'm sorry, I couldn't process that. Please try again.";
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', text: reply, timestamp: Date.now() };
      setMessages(prev => [...prev.slice(-18), aiMsg]);

      // Detect trip planning intent for "Create Trip" button
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
        text: "⚠️ I'm having trouble connecting right now. Please check your connection and try again.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, locationName, btcPrice, weather, trips]);

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
          <p className="text-xs text-muted-foreground">{loading ? 'Thinking…' : 'Powered by Gemini · Live data'}</p>
        </div>
        <button onClick={() => { setMessages([{ id: '0', role: 'ai', text: "Chat cleared! I'm ready to help. 🌍 Ask me anything.", timestamp: Date.now() }]); setLastTrip(null); }}
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
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
        ))}
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
          placeholder="Plan trips, book hotels, ask anything…"
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
