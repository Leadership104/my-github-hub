import { useState } from 'react';
import type { Trip, ItineraryItem, Booking } from '../types';
import { BOOKING_TILES, PERKS, DESTINATIONS, PHRASES } from '../data';
import AIScreen from './AIScreen';
import GroupsScreen from './GroupsScreen';

function countryFlag(country: string): string {
  const map: Record<string, string> = {
    Japan: '🇯🇵', Indonesia: '🇮🇩', Thailand: '🇹🇭', France: '🇫🇷', Italy: '🇮🇹',
    Spain: '🇪🇸', USA: '🇺🇸', UK: '🇬🇧', Australia: '🇦🇺', Singapore: '🇸🇬',
    Mexico: '🇲🇽', Brazil: '🇧🇷', Portugal: '🇵🇹', Germany: '🇩🇪', Netherlands: '🇳🇱',
    Colombia: '🇨🇴', Vietnam: '🇻🇳', India: '🇮🇳', Canada: '🇨🇦', UAE: '🇦🇪',
    Greece: '🇬🇷', Morocco: '🇲🇦', Kenya: '🇰🇪', Peru: '🇵🇪', Argentina: '🇦🇷',
  };
  return map[country] || '🌍';
}

const DEST_GRADIENTS: Record<string, string> = {
  Tokyo: 'from-rose-900 to-slate-800',
  Bali: 'from-emerald-800 to-teal-900',
  Paris: 'from-blue-900 to-indigo-800',
  Bangkok: 'from-amber-800 to-orange-900',
  Singapore: 'from-sky-800 to-blue-900',
  London: 'from-gray-800 to-slate-900',
  Rome: 'from-orange-800 to-red-900',
  Barcelona: 'from-yellow-700 to-orange-800',
  Lisbon: 'from-teal-800 to-cyan-900',
  Miami: 'from-pink-700 to-purple-800',
};

function tripGradient(dest: string) {
  return DEST_GRADIENTS[dest] || 'from-kipita-navy to-kipita-red';
}

function daysBetween(start: string, end: string) {
  return Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000));
}

const BOOKING_TYPE_META: Record<string, { emoji: string; label: string }> = {
  flight: { emoji: '✈️', label: 'Flight' },
  hotel: { emoji: '🏨', label: 'Hotel' },
  cruise: { emoji: '🚢', label: 'Cruise' },
  car: { emoji: '🚗', label: 'Car Rental' },
  insurance: { emoji: '🛡️', label: 'Insurance' },
  esim: { emoji: '📶', label: 'eSIM' },
};

interface Props {
  trips: Trip[];
  onSaveTrips: (updated: Trip[]) => void;
  onBack?: () => void;
  onSwitchTab?: (tab: import('../types').TabId, hint?: string) => void;
}

export default function TripsScreen({ trips, onSaveTrips, onBack, onSwitchTab }: Props) {
  const save = (updated: Trip[]) => onSaveTrips(updated);

  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [showForm, setShowForm] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showAiPlanner, setShowAiPlanner] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingForm, setBookingForm] = useState({ type: 'hotel' as Booking['type'], name: '', confirmationCode: '', checkIn: '', checkOut: '', departureTime: '', arrivalTime: '', flightNumber: '', address: '', notes: '' });
  const [form, setForm] = useState({ dest: '', country: '', start: '', end: '', notes: '' });
  const [detailTab, setDetailTab] = useState<'bookings' | 'itinerary' | 'book'>('itinerary');
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});
  const [tripsView, setTripsView] = useState<'main' | 'destinations' | 'phrases' | 'groups'>('main');
  const [lang, setLang] = useState('es');

  const createTrip = () => {
    if (!form.dest) return;
    const emoji = ['🏔️', '🌴', '🏖️', '🌺', '🗼', '🏙️'][Math.floor(Math.random() * 6)];
    const t: Trip = { id: Date.now().toString(), dest: form.dest, country: form.country, emoji, start: form.start, end: form.end, notes: form.notes, status: 'upcoming', items: [], bookings: [] };
    save([t, ...trips]);
    setForm({ dest: '', country: '', start: '', end: '', notes: '' });
    setShowForm(false);
  };

  const createTripFromAi = (dest: string, country: string, days: number) => {
    const emoji = ['🏔️', '🌴', '🏖️', '🌺', '🗼', '🏙️'][Math.floor(Math.random() * 6)];
    const start = new Date(); start.setDate(start.getDate() + 14);
    const end = new Date(start); end.setDate(end.getDate() + days);
    const t: Trip = {
      id: Date.now().toString(), dest, country, emoji,
      start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0],
      notes: `AI-planned ${days}-day trip`, status: 'upcoming', items: [], bookings: [], createdAt: Date.now(),
    };
    save([t, ...trips]);
  };

  const addBookingToTrip = (tripId: string, booking: Booking) => {
    save(trips.map(t => t.id === tripId ? { ...t, bookings: [...(t.bookings || []), booking] } : t));
  };

  const removeBooking = (tripId: string, bookingId: string) => {
    save(trips.map(t => t.id === tripId ? { ...t, bookings: (t.bookings || []).filter(b => b.id !== bookingId) } : t));
  };

  const submitBookingForm = () => {
    if (!selectedTrip || !bookingForm.name) return;
    const providerMap: Record<string, { provider: string; url: string }> = {
      hotel: { provider: 'Hotels.com', url: 'https://www.hotels.com/affiliate/RrZ7bmg' },
      flight: { provider: 'Expedia', url: 'https://expedia.com/affiliate/eA2cKky' },
      cruise: { provider: 'Expedia Cruises', url: 'https://www.expedia.com/?siteid=1&langid=1033&clickref=1110l34GXzfF&affcid=US.DIRECT.PHG.1100l360011.1100l68075&ref_id=1110l34GXzfF&my_ad=AFF.US.DIRECT.PHG.1100l360011.1100l68075&afflid=1110l34GXzfF&affdtl=PHG.1110l34GXzfF.PZ2TDkyK4w' },
      car: { provider: 'RentalCars', url: 'https://www.rentalcars.com/?utm_source=kipita&utm_medium=app' },
      insurance: { provider: 'World Nomads', url: 'https://www.worldnomads.com/' },
      esim: { provider: 'Airalo', url: 'https://www.airalo.com/?utm_source=kipita&utm_medium=app&utm_campaign=KIPITA5' },
    };
    const p = providerMap[bookingForm.type] || providerMap.hotel;
    const booking: Booking = {
      id: `b-${Date.now()}`,
      type: bookingForm.type,
      provider: p.provider,
      name: bookingForm.name,
      confirmationCode: bookingForm.confirmationCode || undefined,
      checkIn: bookingForm.checkIn || undefined,
      checkOut: bookingForm.checkOut || undefined,
      departureTime: bookingForm.departureTime || undefined,
      arrivalTime: bookingForm.arrivalTime || undefined,
      flightNumber: bookingForm.flightNumber || undefined,
      address: bookingForm.address || undefined,
      notes: bookingForm.notes || undefined,
      affiliateUrl: p.url,
      bookedAt: Date.now(),
    };
    addBookingToTrip(selectedTrip.id, booking);
    setBookingForm({ type: 'hotel', name: '', confirmationCode: '', checkIn: '', checkOut: '', departureTime: '', arrivalTime: '', flightNumber: '', address: '', notes: '' });
    setShowBookingForm(false);
  };

  const toggleItem = (tripId: string, itemId: string) => {
    save(trips.map(t => t.id === tripId ? { ...t, items: t.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) } : t));
  };

  const filtered = trips.filter(t => tab === 'upcoming' ? t.status === 'upcoming' || t.status === 'active' : t.status === 'past' || t.status === 'cancelled');
  const travelPerks = PERKS.filter(p => p.category === 'travel');

  // Trip detail view
  if (selectedTrip) {
    const trip = trips.find(t => t.id === selectedTrip.id) || selectedTrip;
    const daysUntil = Math.ceil((new Date(trip.start).getTime() - Date.now()) / 86400000);
    const totalDays = daysBetween(trip.start, trip.end);
    const bookings = trip.bookings || [];
    const flightBooking = bookings.find(b => b.type === 'flight');
    const hotelBooking = bookings.find(b => b.type === 'hotel');

    // Group itinerary items by day
    const maxDay = trip.items.reduce((m, i) => Math.max(m, i.day), 0);
    const dayGroups: ItineraryItem[][] = Array.from({ length: Math.max(maxDay, totalDays) }, (_, i) =>
      trip.items.filter(item => item.day === i + 1)
    );

    const BOOK_MANAGE = [
      { emoji: '✈️', label: 'Flights', sub: flightBooking?.flightNumber || 'Search', url: flightBooking?.affiliateUrl || 'https://expedia.com/affiliate/eA2cKky' },
      { emoji: '🏨', label: 'Hotels', sub: hotelBooking?.name || 'Search', url: hotelBooking?.affiliateUrl || 'https://www.hotels.com/affiliate/RrZ7bmg' },
      { emoji: '🚗', label: 'Car Rental', sub: 'Search', url: 'https://www.rentalcars.com/?utm_source=kipita&utm_medium=app' },
      { emoji: '🟡', label: 'Uber', sub: 'Request', url: 'https://uber.com/?utm_source=kipita' },
      { emoji: '🩷', label: 'Lyft', sub: 'Request', url: 'https://lyft.com/?utm_source=kipita' },
    ];

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Hero */}
        <div className={`relative bg-gradient-to-br ${tripGradient(trip.dest)} flex-shrink-0`} style={{ minHeight: 200 }}>
          <div className="absolute inset-0 flex items-center justify-center opacity-20 text-[120px] select-none pointer-events-none">
            {trip.emoji}
          </div>
          {/* Top bar */}
          <div className="relative flex items-center justify-between px-4 pt-4 pb-2">
            <button onClick={() => { setSelectedTrip(null); setDetailTab('itinerary'); setExpandedDays({}); }}
              className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors">
              <span className="ms text-white text-xl">arrow_back</span>
            </button>
            {daysUntil > 0 && (
              <span className="bg-kipita-red text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                In {daysUntil} day{daysUntil !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {/* Destination info */}
          <div className="relative px-5 pb-5 pt-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{countryFlag(trip.country)}</span>
              <h2 className="text-white text-2xl font-extrabold">{trip.dest}</h2>
            </div>
            <p className="text-white/70 text-xs">
              {trip.start} → {trip.end} · {totalDays} day{totalDays !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-background pb-24">
          {/* BOOK & MANAGE */}
          <div className="bg-card border-b border-border px-4 py-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Book & Manage</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" style={{ scrollbarWidth: 'none' }}>
              {BOOK_MANAGE.map(item => (
                <a key={item.label} href={item.url} target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 flex flex-col items-center gap-1.5 bg-muted/50 border border-border rounded-xl px-4 py-3 min-w-[72px] hover:shadow-md transition-all no-underline active:scale-95">
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-[11px] font-bold text-foreground">{item.label}</span>
                  <span className="text-[9px] text-muted-foreground truncate max-w-[70px] text-center">{item.sub}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Add booking shortcut */}
          <div className="px-4 py-2 border-b border-border bg-card flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Have a confirmation code?</span>
            <button onClick={() => setShowBookingForm(true)} className="text-xs font-bold text-kipita-red">+ Add Booking</button>
          </div>

          {/* Add booking form */}
          {showBookingForm && (
            <div className="mx-4 mt-3 bg-card border border-border rounded-kipita p-4 space-y-3">
              <h4 className="font-bold text-sm">Add Booking</h4>
              <select value={bookingForm.type} onChange={e => setBookingForm({ ...bookingForm, type: e.target.value as Booking['type'] })}
                className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red">
                {Object.entries(BOOKING_TYPE_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
              <input value={bookingForm.name} onChange={e => setBookingForm({ ...bookingForm, name: e.target.value })} placeholder="Name (e.g. Hilton Tokyo) *"
                className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
              <input value={bookingForm.confirmationCode} onChange={e => setBookingForm({ ...bookingForm, confirmationCode: e.target.value })} placeholder="Confirmation code"
                className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
              {(bookingForm.type === 'flight' || bookingForm.type === 'cruise') && (
                <>
                  <input value={bookingForm.flightNumber} onChange={e => setBookingForm({ ...bookingForm, flightNumber: e.target.value })}
                    placeholder="Flight number (e.g. NH105)"
                    className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Departure</label>
                      <input type="datetime-local" value={bookingForm.departureTime} onChange={e => setBookingForm({ ...bookingForm, departureTime: e.target.value })}
                        className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Arrival</label>
                      <input type="datetime-local" value={bookingForm.arrivalTime} onChange={e => setBookingForm({ ...bookingForm, arrivalTime: e.target.value })}
                        className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
                    </div>
                  </div>
                </>
              )}
              {(bookingForm.type === 'hotel' || bookingForm.type === 'car') && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Check-in</label>
                    <input type="date" value={bookingForm.checkIn} onChange={e => setBookingForm({ ...bookingForm, checkIn: e.target.value })}
                      className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Check-out</label>
                    <input type="date" value={bookingForm.checkOut} onChange={e => setBookingForm({ ...bookingForm, checkOut: e.target.value })}
                      className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
                  </div>
                </div>
              )}
              <input value={bookingForm.address} onChange={e => setBookingForm({ ...bookingForm, address: e.target.value })} placeholder="Address (optional)"
                className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
              <div className="flex gap-2">
                <button onClick={submitBookingForm} className="flex-1 bg-kipita-red text-white py-3 rounded-kipita-sm font-bold text-sm hover:bg-kipita-red-dk transition-colors">Save Booking</button>
                <button onClick={() => setShowBookingForm(false)} className="px-4 py-3 bg-muted rounded-kipita-sm text-sm font-semibold text-muted-foreground">Cancel</button>
              </div>
            </div>
          )}

          {/* Itinerary */}
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-foreground">Itinerary</h3>
              <button onClick={() => setShowAiPlanner(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-kipita-navy to-kipita-red text-white text-xs font-bold rounded-full shadow-sm hover:opacity-90 transition-opacity">
                ✨ Ask AI
              </button>
            </div>

            {trip.items.length === 0 ? (
              <div className="text-center py-10 bg-card border border-border rounded-kipita">
                <p className="text-3xl mb-2">🗺️</p>
                <p className="text-sm font-semibold text-foreground mb-1">No itinerary yet</p>
                <p className="text-xs text-muted-foreground mb-4">Let AI build your day-by-day plan</p>
                <button onClick={() => setShowAiPlanner(true)}
                  className="px-5 py-2.5 bg-kipita-red text-white rounded-full text-xs font-bold hover:bg-kipita-red-dk transition-colors">
                  ✨ Generate with AI
                </button>
              </div>
            ) : (
              <div className="space-y-3 pb-6">
                {dayGroups.map((items, dayIdx) => {
                  const dayNum = dayIdx + 1;
                  const isExpanded = expandedDays[dayNum] !== false; // default open
                  return (
                    <div key={dayNum} className="bg-card border border-border rounded-kipita overflow-hidden">
                      <button
                        onClick={() => setExpandedDays(prev => ({ ...prev, [dayNum]: !isExpanded }))}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                      >
                        <span className="flex-shrink-0 bg-kipita-red text-white text-xs font-extrabold px-2 py-0.5 rounded-full">
                          Day {dayNum}
                        </span>
                        <span className="text-sm font-bold text-foreground flex-1 text-left">
                          {items[0]?.title?.replace(/^.*?[–\-]\s*/, '').split('–')[0].trim() || `Day ${dayNum}`}
                        </span>
                        <span className="ms text-muted-foreground text-lg flex-shrink-0">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                      {isExpanded && items.length > 0 && (
                        <div className="border-t border-border divide-y divide-border">
                          {items.map((item, idx) => {
                            const parts = item.title.split('–').map(s => s.trim());
                            const actName = parts[0] || item.title;
                            const actDesc = parts[1] || '';
                            const icon = item.title.match(/^(\S+)\s/)?.[1] || '📍';
                            return (
                              <button key={item.id}
                                onClick={() => toggleItem(trip.id, item.id)}
                                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-opacity ${item.done ? 'opacity-50' : ''} hover:bg-muted/30`}
                              >
                                <div className="flex-shrink-0 text-center pt-0.5 w-12">
                                  <div className="text-[10px] font-bold text-kipita-red">{item.time}</div>
                                </div>
                                <div className="text-lg flex-shrink-0">{icon}</div>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-xs font-bold text-foreground ${item.done ? 'line-through' : ''}`}>
                                    {actName.replace(/^[^\w]/, '').trim()}
                                  </div>
                                  {actDesc && <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{actDesc}</div>}
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${item.done ? 'bg-kipita-green border-kipita-green' : 'border-border'}`}>
                                  {item.done && <span className="text-white text-[10px]">✓</span>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {isExpanded && items.length === 0 && (
                        <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border">Nothing planned yet for Day {dayNum}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Destinations view
  if (tripsView === 'destinations') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <button onClick={() => setTripsView('main')} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
            <span className="ms text-lg">arrow_back</span> Back
          </button>
          <h2 className="text-xl font-extrabold">Nomad Destinations</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-24 pt-3 space-y-3">
          {DESTINATIONS.map(d => (
            <div key={d.id} className="bg-card border border-border rounded-kipita p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-kipita-navy to-kipita-red/40 flex items-center justify-center text-2xl flex-shrink-0">{d.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base">{d.city}, {d.country}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {d.tags.map(t => <span key={t} className="bg-muted text-muted-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">{t}</span>)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div><span className="text-muted-foreground">Safety</span><div className="font-bold text-kipita-green">{d.safetyScore}/10</div></div>
                    <div><span className="text-muted-foreground">WiFi</span><div className="font-bold">{d.speed} Mbps</div></div>
                    <div><span className="text-muted-foreground">Cost</span><div className="font-bold">${d.monthlyCost}/mo</div></div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{d.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Phrases view
  if (tripsView === 'phrases') {
    const phraseData = PHRASES[lang];
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <button onClick={() => setTripsView('main')} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
            <span className="ms text-lg">arrow_back</span> Back
          </button>
          <h2 className="text-xl font-extrabold">Travel Phrases</h2>
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
            {Object.entries(PHRASES).map(([key, val]) => (
              <button key={key} onClick={() => setLang(key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${lang === key ? 'bg-kipita-red text-white' : 'bg-muted text-muted-foreground'}`}>
                {val.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-24 pt-3">
          {phraseData?.phrases.map((p, i) => (
            <div key={i} className="bg-card border border-border rounded-kipita p-4 mb-3">
              <div className="text-xs text-muted-foreground font-semibold mb-1">English</div>
              <div className="text-sm font-bold mb-2">{p.en}</div>
              <div className="text-xs text-muted-foreground font-semibold mb-1">{phraseData.label.split(' ')[1]}</div>
              <div className="text-lg font-extrabold text-kipita-red">{p.local}</div>
              <div className="text-xs text-muted-foreground mt-1 italic">🔊 {p.phon}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // Groups view
  if (tripsView === 'groups') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <button onClick={() => setTripsView('main')} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
            <span className="ms text-lg">arrow_back</span> Back
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <GroupsScreen />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <h2 className="text-xl font-extrabold">My Trips</h2>
        <div className="flex gap-2 mt-3">
          {(['upcoming', 'completed'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${tab === t ? 'bg-kipita-red text-white' : 'bg-muted text-muted-foreground'}`}>
              {t === 'upcoming' ? 'Upcoming' : 'Completed'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-24">
        {/* AI Banner */}
        <button onClick={() => setShowAiPlanner(true)} className="w-full flex items-center gap-3 bg-card rounded-kipita p-4 mb-4 text-left hover:shadow-md transition-shadow shadow-sm">
          <span className="text-2xl">✨</span>
          <div className="flex-1">
            <div className="text-foreground font-extrabold text-sm">Plan & Book with AI</div>
            <div className="text-muted-foreground text-xs">Generate itineraries, book hotels, flights & more</div>
          </div>
        </button>

        {/* Travel utilities */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button onClick={() => setTripsView('destinations')}
            className="flex flex-col items-center gap-1.5 p-3 bg-card rounded-kipita text-center hover:shadow-md transition-shadow shadow-sm">
            <span className="text-xl">🌍</span>
            <div className="text-foreground font-bold text-[11px]">Destinations</div>
          </button>
          <button onClick={() => setTripsView('phrases')}
            className="flex flex-col items-center gap-1.5 p-3 bg-card rounded-kipita text-center hover:shadow-md transition-shadow shadow-sm">
            <span className="text-xl">🌐</span>
            <div className="text-foreground font-bold text-[11px]">Phrases</div>
          </button>
          <button onClick={() => setTripsView('groups')}
            className="flex flex-col items-center gap-1.5 p-3 bg-card rounded-kipita text-center hover:shadow-md transition-shadow shadow-sm">
            <span className="text-xl">👥</span>
            <div className="text-foreground font-bold text-[11px]">Groups</div>
          </button>
          <button onClick={() => onSwitchTab?.('maps')}
            className="flex flex-col items-center gap-1.5 p-3 bg-card rounded-kipita text-center hover:shadow-md transition-shadow shadow-sm">
            <span className="text-xl">🗺️</span>
            <div className="text-foreground font-bold text-[11px]">Maps</div>
          </button>
          <button onClick={() => onSwitchTab?.('wallet')}
            className="flex flex-col items-center gap-1.5 p-3 bg-card rounded-kipita text-center hover:shadow-md transition-shadow shadow-sm">
            <span className="text-xl">💱</span>
            <div className="text-foreground font-bold text-[11px]">Currency</div>
          </button>
        </div>

        {/* AI Planner Modal */}
        {showAiPlanner && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background">
            <div className="flex items-center gap-2 p-3 border-b border-border bg-card flex-shrink-0">
              <button onClick={() => setShowAiPlanner(false)} className="ms text-lg text-muted-foreground hover:text-foreground">close</button>
              <h3 className="font-bold text-sm flex-1">AI Trip Planner & Booking</h3>
            </div>
            <div className="flex-1 overflow-hidden">
              <AIScreen trips={trips} onCreateTrip={createTripFromAi} onCreateFullTrip={(t) => { save([t, ...trips]); setShowAiPlanner(false); }} onAddBooking={addBookingToTrip} />
            </div>
          </div>
        )}

        {filtered.map(trip => {
          const bookingCount = trip.bookings?.length || 0;
          return (
            <button key={trip.id} onClick={() => setSelectedTrip(trip)}
              className="w-full flex items-center gap-3 p-4 bg-card border border-border rounded-kipita mb-3 text-left hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl flex-shrink-0">{trip.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{trip.dest}, {trip.country}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{trip.start} → {trip.end}</div>
                <div className="flex gap-3 mt-1">
                  {trip.items.length > 0 && (
                    <span className="text-xs text-kipita-green font-semibold">{trip.items.filter(i => i.done).length}/{trip.items.length} tasks</span>
                  )}
                  {bookingCount > 0 && (
                    <span className="text-xs text-kipita-red font-semibold">📦 {bookingCount} booking{bookingCount > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
              <span className="ms text-muted-foreground">chevron_right</span>
            </button>
          );
        })}

        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No {tab} trips yet</p>}

        {showForm ? (
          <div className="bg-card border border-border rounded-kipita p-4 mt-4 space-y-3">
            <input value={form.dest} onChange={e => setForm({ ...form, dest: e.target.value })} placeholder="Destination *"
              className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
            <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder="Country"
              className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })}
                className="bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
              <input type="date" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })}
                className="bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
            </div>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes" rows={2}
              className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red resize-none" />
            <button onClick={createTrip} className="w-full bg-kipita-red text-white py-3 rounded-kipita-sm font-bold text-sm hover:bg-kipita-red-dk transition-colors">
              Create Trip
            </button>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)}
            className="w-full mt-4 py-3 border-2 border-dashed border-border rounded-kipita text-sm font-semibold text-muted-foreground hover:border-kipita-red hover:text-kipita-red transition-colors">
            + New Trip
          </button>
        )}
      </div>
    </div>
  );
}
