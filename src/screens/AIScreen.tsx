import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { DESTINATIONS, AI_RESPONSES, CITY_COSTS } from '../data';

function extractDestFromMsg(msg: string) {
  const known = DESTINATIONS.find(d => msg.toLowerCase().includes(d.city.toLowerCase()));
  if (known) return `${known.city}, ${known.country}`;
  const cleaned = msg.replace(/plan|a|my|trip|to|travel|for|in|visit|itinerary|i want|go to|take me to|tell me about|what about|how is|\?/gi, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > 2 ? cleaned.replace(/\b\w/g, c => c.toUpperCase()) : null;
}

function getAiResponse(msg: string, lastAi: string, btcPrice?: number, locationName?: string): string {
  const m = msg.toLowerCase();
  const knownDest = DESTINATIONS.find(d => m.includes(d.city.toLowerCase()) || m.includes(d.country.toLowerCase()));

  // Follow-up detection
  if (/\b(more|details|tell me more|what else|expand|elaborate|continue)\b/.test(m) && lastAi) {
    const dest = extractDestFromMsg(lastAi) || locationName || 'your destination';
    return `Here's more on **${dest}**:\n\n${AI_RESPONSES.plan(dest)}`;
  }

  // Destination info query — now includes photo + detailed costs
  if (knownDest && /\b(about|info|tell|what|like|describe|nomad|stats|overview|how is|worth)\b/.test(m) && !/\b(plan|trip|visit|go|travel|itinerary)\b/.test(m)) {
    const d = knownDest;
    const costs = CITY_COSTS[d.city];
    const photoLine = costs ? `[PHOTO:${costs.photoUrl}:${costs.landmark}]\n\n` : '';
    return `${photoLine}🌍 **${d.city}, ${d.country}** ${d.emoji}\n\n⭐ **${d.rating}/5** · 📶 ${d.speed} Mbps · 🛡️ Safety ${d.safetyScore}/10\n💰 **$${d.monthlyCost.toLocaleString()}/month** · ${d.weatherDesc} ${d.temp}°C\n\n${d.desc}\n\n**Tags:** ${d.tags.join(', ')}\n\n**Nomad population:** ${d.pop}`;
  }

  // Best cities / nomad cities / compare
  if (/\b(best|top|rank|compare|nomad cit|digital nomad)\b/.test(m) && /\b(city|cities|destination|place)\b/.test(m)) {
    const sorted = [...DESTINATIONS].sort((a, b) => b.rating - a.rating);
    return `🏆 **Top Nomad Cities 2026**\n\n${sorted.map((d, i) => `${i + 1}. **${d.city}** ${d.emoji} — ⭐ ${d.rating} · 📶 ${d.speed} Mbps · $${d.monthlyCost}/mo · Safety ${d.safetyScore}/10`).join('\n')}\n\n💡 *Ask me about any city for a detailed breakdown!*`;
  }

  // Cost / budget / affordable
  if (/\b(cost|cheap|budget|affordable|expense|price)\b/.test(m)) {
    if (knownDest) {
      return `💰 **Cost of Living — ${knownDest.city}, ${knownDest.country}**\n\n**Monthly estimate:** ~$${knownDest.monthlyCost.toLocaleString()}\n\n• 🏠 Accommodation: ~$${Math.round(knownDest.monthlyCost * 0.4)}/mo\n• 🍜 Food: ~$${Math.round(knownDest.monthlyCost * 0.25)}/mo\n• 🚇 Transport: ~$${Math.round(knownDest.monthlyCost * 0.1)}/mo\n• 💻 Coworking: ~$${Math.round(knownDest.monthlyCost * 0.1)}/mo\n• 🎉 Entertainment: ~$${Math.round(knownDest.monthlyCost * 0.15)}/mo`;
    }
    const sorted = [...DESTINATIONS].sort((a, b) => a.monthlyCost - b.monthlyCost);
    return `💰 **Most Affordable Nomad Destinations**\n\n${sorted.slice(0, 5).map((d, i) => `${i + 1}. **${d.city}** ${d.emoji} — $${d.monthlyCost.toLocaleString()}/month`).join('\n')}\n\n*Ask about any city for a full cost breakdown!*`;
  }

  // WiFi / internet
  if (/\b(wifi|internet|speed|mbps|fast)\b/.test(m)) {
    const sorted = [...DESTINATIONS].sort((a, b) => b.speed - a.speed);
    return `📶 **Fastest Internet — Nomad Cities**\n\n${sorted.map((d, i) => `${i + 1}. **${d.city}** ${d.emoji} — ${d.speed} Mbps`).join('\n')}\n\n💡 *All speeds are averages from co-working spaces and cafes.*`;
  }

  // Plan/trip/travel/visit
  if (/\b(plan|trip|travel|visit|go to|itinerary|take me)\b/.test(m)) {
    const dest = knownDest ? `${knownDest.city}, ${knownDest.country}` : (extractDestFromMsg(msg) || locationName || 'New Destination');
    const costNote = knownDest ? `\n\n💰 **Estimated cost:** ~$${Math.round(knownDest.monthlyCost / 30 * 7).toLocaleString()} for 7 days` : '';
    return AI_RESPONSES.plan(dest) + costNote;
  }

  // Safety
  if (/\b(safe|safety|danger|dangerous|risk|crime|secure)\b/.test(m)) {
    if (knownDest) {
      const level = knownDest.safetyScore >= 8.5 ? 'VERY SAFE ✅' : knownDest.safetyScore >= 7.5 ? 'SAFE ✅' : '⚠️ MODERATE';
      return `🛡️ **Safety: ${knownDest.city}, ${knownDest.country}**\n\n**Score: ${knownDest.safetyScore}/10 — ${level}**\n\n${AI_RESPONSES.safety(knownDest.city)}`;
    }
    const sorted = [...DESTINATIONS].sort((a, b) => b.safetyScore - a.safetyScore).slice(0, 4);
    return `🛡️ **Safest Nomad Destinations**\n\n${sorted.map((d, i) => `${i + 1}. **${d.city}** — ${d.safetyScore}/10 ${d.emoji}`).join('\n')}\n\n${AI_RESPONSES.safety(locationName || 'your location')}`;
  }

  // Advisories
  if (/\b(advisor|warning|alert|entry|restriction)\b/.test(m)) return AI_RESPONSES.advisories();

  // Perks / deals / codes / discounts
  if (/\b(perks?|deals?|discounts?|coupons?|codes?|promos?|offers?|swan|fold|kinesis|affiliate|upside)\b/.test(m)) return AI_RESPONSES.perks();

  // Phrases
  if (/\b(phrase|language|speak|translate|hello|thank you)\b/.test(m)) return AI_RESPONSES.phrases();

  // Gold / metals
  if (/\b(gold|silver|platinum|metal|commodity)\b/.test(m)) {
    const btcStr = btcPrice ? `$${btcPrice.toLocaleString()}` : 'loading…';
    return `🥇 **Live Commodity & Crypto Prices**\n\n• BTC: ${btcStr}\n\nOpen the **Wallet** tab for ETH, SOL, gold, silver, platinum + live currency converter.`;
  }

  // Bitcoin / crypto
  if (/\b(bitcoin|btc|lightning|crypto|satoshi|sats)\b/.test(m)) {
    const price = btcPrice ? `$${btcPrice.toLocaleString()}` : 'loading…';
    return `₿ **Bitcoin Travel with Kipita**\n\nLive BTC price: **${price}**\n\n• 🗺️ **Maps tab** — thousands of BTC merchants via BTCMap\n• 🏧 **Places → BTC ATM** — find Bitcoin ATMs near you\n• 💳 **Wallet tab** — live BTC, ETH, SOL prices + converter\n• 🌍 **Most BTC-friendly:** El Salvador 🇸🇻, Portugal 🇵🇹, Japan 🇯🇵, UAE 🇦🇪, Switzerland 🇨🇭`;
  }

  // Visa / passport
  if (/\b(visa|passport|entry|immigration)\b/.test(m)) {
    if (knownDest) {
      const visaInfo: Record<string, string> = {
        Thailand: '🇹🇭 30–60 days visa on arrival · Thailand LTR Visa available (10 yrs)',
        Portugal: '🇵🇹 90/180 Schengen days · D8 Digital Nomad Visa available',
        Indonesia: '🇮🇩 30 days VOA extendable · B211A visa for nomads',
        Japan: '🇯🇵 90 days (most Western passports) · No nomad visa yet',
        Spain: '🇪🇸 90/180 Schengen · Digital Nomad Visa available',
        Colombia: '🇨🇴 90 days on arrival · Extendable to 180',
        UAE: '🇦🇪 30–90 days on arrival · Freelance/remote work permit available',
      };
      return `🛂 **Visa Info — ${knownDest.city}, ${knownDest.country}**\n\n${visaInfo[knownDest.country] || `Entry requirements for **${knownDest.country}** vary by passport.`}\n\n**Always verify** current requirements on your country's official embassy site.`;
    }
    return '🛂 **Visa & Entry Requirements**\n\n• 🇹🇭 Thailand: 30–60 days VOA\n• 🇮🇩 Indonesia (Bali): 30 days extendable\n• 🇵🇹 Portugal (Schengen): 90/180 days · D8 nomad visa\n• 🇦🇪 UAE: 30–90 days on arrival\n• 🇯🇵 Japan: 90 days (most Western passports)\n\n**Always verify** on your government\'s official travel advisory site.';
  }

  // Currency / FX
  if (/\b(currency|exchange|convert|forex|rate|usd|eur|gbp|thb)\b/.test(m)) {
    const btcLine = btcPrice ? `BTC is at **$${btcPrice.toLocaleString()}** right now. ` : '';
    return `💱 **Live Currency & Exchange**\n\n${btcLine}Open the **Wallet** tab for real-time rates on 150+ currencies + a built-in converter.\n\nFor destination-specific costs:\n${DESTINATIONS.slice(0, 4).map(d => `• ${d.city}: ~$${d.monthlyCost.toLocaleString()}/mo`).join('\n')}`;
  }

  // Packing
  if (/\b(pack|packing|what to bring|luggage|bag)\b/.test(m)) {
    return `🎒 **Nomad Packing Essentials**\n\n**Documents:**\n• Passport + digital copies\n• Travel insurance\n• Visa docs if required\n\n**Tech:**\n• Laptop + travel adapter\n• Phone + eSIM (try Airalo for data)\n• Portable battery\n\n**Money:**\n• Cards with no foreign fees\n• Small BTC wallet for Lightning payments\n• Cash for arrival\n\n**Health:**\n• 1 month of any prescriptions\n• Basic first aid kit`;
  }

  return AI_RESPONSES.default(msg.slice(0, 50));
}

function getSuggestions(msg: string, response: string, locationName: string): { text: string; msg: string }[] {
  const r = response.toLowerCase();
  const knownDest = DESTINATIONS.find(d => msg.toLowerCase().includes(d.city.toLowerCase()));
  const destName = knownDest ? knownDest.city : (locationName || 'here');
  if (r.includes('day 1') || r.includes('itinerary'))
    return [
      { text: `🛡️ Is ${destName} safe?`, msg: `Is ${destName} safe?` },
      { text: `💰 Cost breakdown`, msg: `How much does ${destName} cost per month?` },
      { text: `₿ BTC spots`, msg: `Bitcoin merchants in ${destName}` },
    ];
  if (r.includes('safety score') || r.includes('safest'))
    return [
      { text: `✈️ Plan trip`, msg: `Plan a trip to ${destName}` },
      { text: `🛂 Visa info`, msg: `Visa requirements for ${destName}` },
      { text: `📋 Advisories`, msg: `Show current travel advisories` },
    ];
  if (r.includes('monthly cost') || r.includes('/mo'))
    return [
      { text: `📶 Best WiFi cities`, msg: `Which cities have the fastest internet?` },
      { text: `🏆 Top nomad cities`, msg: `Best nomad cities 2026` },
      { text: `✈️ Plan budget trip`, msg: `Plan an affordable trip` },
    ];
  return [
    { text: `✈️ Plan a trip`, msg: `Plan a 7-day trip to ${destName}` },
    { text: `🏆 Best nomad cities`, msg: `Best nomad cities 2026` },
    { text: `₿ BTC travel tips`, msg: `Bitcoin travel tips` },
  ];
}

interface Props {
  btcPrice?: number;
  locationName?: string;
}

export default function AIScreen({ btcPrice, locationName }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'ai', text: "Hi! I'm your AI travel companion powered by Gemini. I can help you plan trips, check travel safety, find places to visit, and more. What would you like to explore today?", timestamp: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<{ text: string; msg: string }[]>([]);
  const [lastTrip, setLastTrip] = useState<{ dest: string; days: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, suggestions]);

  const quickActions = [
    { emoji: '✈️', label: 'Plan a Trip', prompt: 'Plan a 5-day trip for a digital nomad' },
    { emoji: '🛡️', label: 'Safety', prompt: `What is the safety situation for ${locationName || 'my area'}?` },
    { emoji: '🏆', label: 'Top Cities', prompt: 'What are the best nomad cities in 2026?' },
    { emoji: '₿', label: 'BTC Travel', prompt: 'Find Bitcoin-friendly spots and BTC merchants near me' },
    { emoji: '🎁', label: 'Perks', prompt: 'Show me all Kipita perks and deals' },
  ];

  const sendMessage = (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setSuggestions([]);

    const delay = 800 + Math.min(text.length * 8, 800);
    setTimeout(() => {
      const lastAi = messages.filter(m => m.role === 'ai').slice(-1)[0]?.text || '';
      const response = getAiResponse(text, lastAi, btcPrice, locationName);
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', text: response, timestamp: Date.now() };
      setMessages(prev => [...prev.slice(-18), aiMsg]);
      setLoading(false);

      // Check for trip plan
      if (/\b(plan|trip|travel|visit|itinerary|go to)\b/.test(text.toLowerCase())) {
        const dest = extractDestFromMsg(text) || 'New Destination';
        const days = parseInt(text.match(/(\d+)\s*days?/i)?.[1] || '7');
        setLastTrip({ dest, days });
      }

      setSuggestions(getSuggestions(text, response, locationName || 'here'));
    }, delay);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-kipita-navy to-kipita-red flex items-center justify-center text-xl">✨</div>
        <div className="flex-1">
          <h3 className="font-bold text-foreground">Kipita AI</h3>
          <p className="text-xs text-muted-foreground">{loading ? 'Thinking…' : 'Powered by Gemini 2.0'}</p>
        </div>
        <button onClick={() => { setMessages([{ id: '0', role: 'ai', text: "Chat cleared! I'm ready to help. 🌍 Ask me anything.", timestamp: Date.now() }]); setSuggestions([]); setLastTrip(null); }}
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
              {msg.text.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\))/g).map((part, i) => {
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
        {/* Suggestion chips */}
        {suggestions.length > 0 && !loading && (
          <div className="flex gap-2 flex-wrap">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => { setSuggestions([]); sendMessage(s.msg); }}
                className="px-3 py-2 bg-card border border-border rounded-full text-xs font-semibold hover:bg-muted transition-colors">
                {s.text}
              </button>
            ))}
          </div>
        )}
        {/* Add to Trips button */}
        {lastTrip && !loading && (
          <div className="flex justify-center">
            <button onClick={() => setLastTrip(null)}
              className="px-4 py-2 bg-kipita-green text-white rounded-full text-xs font-bold hover:opacity-90 transition-opacity">
              ✈️ Add to Trips: {lastTrip.dest}
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
