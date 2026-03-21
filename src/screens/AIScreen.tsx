import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';

export default function AIScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'ai', text: "Hi! I'm your AI travel companion powered by Gemini. I can help you plan trips, check travel safety, find places to visit, and more. What would you like to explore today?", timestamp: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const quickActions = [
    { emoji: '✈️', label: 'Plan a Trip', prompt: 'Plan a 7-day trip to Tokyo on a $2000 budget' },
    { emoji: '🛡️', label: 'Safety', prompt: 'What are the safest nomad cities in Southeast Asia?' },
    { emoji: '📋', label: 'Advisories', prompt: 'Show me current travel advisories for Thailand' },
    { emoji: '🌐', label: 'Phrases', prompt: 'Teach me essential Japanese phrases for travel' },
  ];

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Simulated AI response (would use Gemini API in production)
    setTimeout(() => {
      const responses: Record<string, string> = {
        trip: `**7-Day Tokyo Itinerary 🗼**\n\n**Day 1:** Arrive Narita → Shinjuku hotel. Evening: explore Kabukicho, Golden Gai\n**Day 2:** Meiji Shrine → Harajuku → Shibuya Crossing\n**Day 3:** Tsukiji Outer Market → Asakusa → Senso-ji Temple\n**Day 4:** Day trip to Hakone (Mt Fuji views)\n**Day 5:** Akihabara → Ueno Park → TeamLab\n**Day 6:** Tsukiji Sushi Workshop → Odaiba\n**Day 7:** Nakameguro → Shopping → Departure\n\n💰 **Budget:** ~$285/day including accommodation, food, transport\n₿ **BTC tip:** 1000+ merchants in Tokyo accept Bitcoin via Lightning!`,
        safety: `**Safest Nomad Cities in SE Asia 🛡️**\n\n1. 🇸🇬 **Singapore** — Safety 9.8/10, ultra-modern\n2. 🇯🇵 **Tokyo** — Safety 9.4/10, lowest crime rate\n3. 🇹🇭 **Chiang Mai** — Safety 8.2/10, nomad favorite\n4. 🇲🇾 **Kuala Lumpur** — Safety 7.9/10, affordable\n5. 🇮🇩 **Bali** — Safety 7.9/10, great community\n\n⚠️ Always check local advisories before traveling.`,
        default: `Great question! As your AI travel companion, I can help with:\n\n✈️ **Trip Planning** — Custom itineraries with budgets\n🛡️ **Safety Info** — Real-time advisories & alerts\n₿ **Bitcoin** — Find BTC-friendly spots worldwide\n🌐 **Phrases** — Essential phrases in 15+ languages\n🗺️ **Destinations** — Nomad scores, costs, weather\n\nWhat would you like to explore?`
      };
      const key = text.toLowerCase().includes('trip') || text.toLowerCase().includes('tokyo') ? 'trip'
        : text.toLowerCase().includes('safe') ? 'safety' : 'default';
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', text: responses[key], timestamp: Date.now() };
      setMessages(prev => [...prev, aiMsg]);
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-kipita-navy to-kipita-red flex items-center justify-center text-xl">✨</div>
        <div>
          <h3 className="font-bold text-foreground">Kipita AI</h3>
          <p className="text-xs text-muted-foreground">Powered by Gemini 2.0</p>
        </div>
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
              {msg.text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
                i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
              )}
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
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 p-3 border-t border-border bg-card flex-shrink-0">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder="Ask me anything about travel…"
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
