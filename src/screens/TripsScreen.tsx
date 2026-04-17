import { useState } from 'react';
import type { Trip, ItineraryItem, Booking } from '../types';
import { BOOKING_TILES, PERKS, DESTINATIONS, PHRASES } from '../data';
import AIScreen from './AIScreen';
import GroupsScreen from './GroupsScreen';

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
  const [detailTab, setDetailTab] = useState<'bookings' | 'itinerary' | 'book'>('bookings');
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
    const bookings = trip.bookings || [];

    return (
      <div className="flex flex-col h-full">
        <div className="bg-gradient-to-br from-kipita-navy to-kipita-red p-5 flex-shrink-0">
          <button onClick={() => { setSelectedTrip(null); setDetailTab('bookings'); }} className="text-white/70 flex items-center gap-1 mb-3 text-sm">
            <span className="ms text-lg">arrow_back</span> Back
          </button>
          <div className="text-4xl mb-2">{trip.emoji}</div>
          <h2 className="text-white text-xl font-extrabold">{trip.dest}, {trip.country}</h2>
          <p className="text-white/60 text-sm mt-1">{trip.start} → {trip.end}</p>
          <div className="flex gap-3 mt-2">
            {daysUntil > 0 && <span className="text-white/80 text-xs font-semibold">{daysUntil} days away!</span>}
            {bookings.length > 0 && <span className="text-white/80 text-xs font-semibold">📦 {bookings.length} booking{bookings.length > 1 ? 's' : ''}</span>}
          </div>
        </div>

        {/* Detail tabs */}
        <div className="flex border-b border-border bg-card flex-shrink-0">
          {(['bookings', 'itinerary', 'book'] as const).map(t => (
            <button key={t} onClick={() => setDetailTab(t)}
              className={`flex-1 py-3 text-xs font-bold transition-colors ${detailTab === t ? 'text-kipita-red border-b-2 border-kipita-red' : 'text-muted-foreground'}`}>
              {t === 'bookings' ? '📦 Bookings' : t === 'itinerary' ? '📋 Itinerary' : '🛒 Book Now'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 pb-24">
          {trip.notes && <div className="bg-card border border-border rounded-kipita p-4 mb-4 text-sm text-muted-foreground">{trip.notes}</div>}

          {/* BOOKINGS TAB */}
          {detailTab === 'bookings' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">📦 My Bookings</h3>
                <button onClick={() => setShowBookingForm(true)} className="text-xs font-bold text-kipita-red">+ Add Booking</button>
              </div>

              {bookings.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">📦</p>
                  <p className="text-sm text-muted-foreground mb-3">No bookings yet</p>
                  <button onClick={() => setDetailTab('book')} className="px-4 py-2 bg-kipita-red text-white rounded-full text-xs font-bold">
                    Book Flight, Hotel or Cruise
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookings.map(b => {
                    const meta = BOOKING_TYPE_META[b.type] || { emoji: '📦', label: b.type };
                    return (
                      <div key={b.id} className="bg-card border border-border rounded-kipita p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl flex-shrink-0">{meta.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm truncate">{b.name}</span>
                              <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-semibold text-muted-foreground">{meta.label}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">{b.provider}</div>

                            {b.confirmationCode && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <span className="text-[10px] font-bold text-muted-foreground">CONF:</span>
                                <span className="text-xs font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded">{b.confirmationCode}</span>
                              </div>
                            )}

                            {b.flightNumber && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] font-bold text-muted-foreground">FLIGHT:</span>
                                <span className="text-xs font-mono font-bold text-foreground">{b.flightNumber}</span>
                              </div>
                            )}

                            {(b.checkIn || b.checkOut) && (
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                {b.checkIn && <span>📅 In: <strong className="text-foreground">{b.checkIn}</strong></span>}
                                {b.checkOut && <span>📅 Out: <strong className="text-foreground">{b.checkOut}</strong></span>}
                              </div>
                            )}

                            {(b.departureTime || b.arrivalTime) && (
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                {b.departureTime && <span>🛫 <strong className="text-foreground">{b.departureTime}</strong></span>}
                                {b.arrivalTime && <span>🛬 <strong className="text-foreground">{b.arrivalTime}</strong></span>}
                              </div>
                            )}

                            {b.address && <div className="text-xs text-muted-foreground mt-1">📍 {b.address}</div>}
                            {b.notes && <div className="text-xs text-muted-foreground mt-1 italic">{b.notes}</div>}
                          </div>
                        </div>

                        <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                          {b.affiliateUrl && (
                            <a href={b.affiliateUrl} target="_blank" rel="noopener noreferrer"
                              className="flex-1 text-center py-2 bg-kipita-red text-white rounded-kipita-sm text-xs font-bold hover:bg-kipita-red-dk transition-colors no-underline">
                              Manage on {b.provider}
                            </a>
                          )}
                          <button onClick={() => removeBooking(trip.id, b.id)}
                            className="px-3 py-2 text-xs text-muted-foreground hover:text-kipita-red transition-colors">
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add booking form */}
              {showBookingForm && (
                <div className="mt-4 bg-card border border-border rounded-kipita p-4 space-y-3">
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

                  {(bookingForm.type === 'flight' || bookingForm.type === 'cruise') && (
                    <>
                      <input value={bookingForm.flightNumber} onChange={e => setBookingForm({ ...bookingForm, flightNumber: e.target.value })}
                        placeholder={bookingForm.type === 'flight' ? 'Flight number (e.g. NH105)' : 'Ship / cabin number'}
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

                  <input value={bookingForm.address} onChange={e => setBookingForm({ ...bookingForm, address: e.target.value })} placeholder="Address (optional)"
                    className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
                  <input value={bookingForm.notes} onChange={e => setBookingForm({ ...bookingForm, notes: e.target.value })} placeholder="Notes (optional)"
                    className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />

                  <div className="flex gap-2">
                    <button onClick={submitBookingForm} className="flex-1 bg-kipita-red text-white py-3 rounded-kipita-sm font-bold text-sm hover:bg-kipita-red-dk transition-colors">
                      Save Booking
                    </button>
                    <button onClick={() => setShowBookingForm(false)} className="px-4 py-3 bg-muted rounded-kipita-sm text-sm font-semibold text-muted-foreground">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ITINERARY TAB */}
          {detailTab === 'itinerary' && (
            <>
              <h3 className="font-bold text-sm mb-3">📋 Itinerary</h3>
              {trip.items.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">📋</p>
                  <p className="text-sm text-muted-foreground mb-3">No items yet</p>
                  <button onClick={() => { setSelectedTrip(null); setShowAiPlanner(true); }} className="px-4 py-2 bg-kipita-red text-white rounded-full text-xs font-bold">
                    ✨ Generate with AI
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {trip.items.map(item => (
                    <button key={item.id} onClick={() => toggleItem(trip.id, item.id)}
                      className={`w-full flex items-center gap-3 p-3 bg-card border border-border rounded-kipita-sm text-left transition-opacity ${item.done ? 'opacity-50' : ''}`}>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-kipita-green border-kipita-green' : 'border-border'}`}>
                        {item.done && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div>
                        <div className={`text-sm font-semibold ${item.done ? 'line-through' : ''}`}>{item.title}</div>
                        <div className="text-xs text-muted-foreground">Day {item.day} · {item.time}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* BOOK NOW TAB */}
          {detailTab === 'book' && (
            <>
              <h3 className="font-bold text-sm mb-3">🛒 Book for This Trip</h3>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {BOOKING_TILES.slice(0, 10).map(b => (
                  <a key={b.label} href={b.url} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-kipita-sm hover:shadow-md transition-all no-underline text-center">
                    <span className="text-2xl">{b.emoji}</span>
                    <span className="text-xs font-bold text-foreground">{b.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{b.desc}</span>
                    <span className="text-[9px] bg-muted px-2 py-0.5 rounded text-muted-foreground">{b.provider}</span>
                  </a>
                ))}
              </div>

              <h3 className="font-bold text-sm mb-3">🎁 Trip Perks</h3>
              <div className="space-y-2 mb-5">
                {travelPerks.map(p => (
                  <a key={p.title} href={p.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-card border border-border rounded-kipita-sm hover:shadow-md transition-all no-underline">
                    <span className="text-xl flex-shrink-0">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-foreground">{p.title}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{p.desc}</div>
                    </div>
                    {p.code && <div className="bg-kipita-red-lt px-2 py-1 rounded text-[9px] font-bold text-kipita-red flex-shrink-0">{p.code}</div>}
                  </a>
                ))}
              </div>

              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2">After booking, add your confirmation details:</p>
                <button onClick={() => { setDetailTab('bookings'); setShowBookingForm(true); }}
                  className="px-4 py-2 bg-kipita-green text-white rounded-full text-xs font-bold">
                  + Add Booking Confirmation
                </button>
              </div>
            </>
          )}
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
        <button onClick={() => setShowAiPlanner(true)} className="w-full flex items-center gap-3 bg-gradient-to-r from-[#1a1a2e] to-kipita-red rounded-kipita p-4 mb-4 text-left">
          <span className="text-2xl">✨</span>
          <div className="flex-1">
            <div className="text-white font-extrabold text-sm">Plan & Book with AI</div>
            <div className="text-white/60 text-xs">Generate itineraries, book hotels, flights & more</div>
          </div>
        </button>

        {/* Destinations, Phrases & Groups buttons */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button onClick={() => setTripsView('destinations')}
            className="flex flex-col items-center gap-1.5 p-3 bg-gradient-to-r from-kipita-navy to-kipita-navy-card rounded-kipita text-center">
            <span className="text-xl">🌍</span>
            <div className="text-white font-bold text-[11px]">Destinations</div>
          </button>
          <button onClick={() => setTripsView('phrases')}
            className="flex flex-col items-center gap-1.5 p-3 bg-gradient-to-r from-kipita-red to-kipita-red-dk rounded-kipita text-center">
            <span className="text-xl">🌐</span>
            <div className="text-white font-bold text-[11px]">Phrases</div>
          </button>
          <button onClick={() => setTripsView('groups')}
            className="flex flex-col items-center gap-1.5 p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-kipita text-center">
            <span className="text-xl">👥</span>
            <div className="text-white font-bold text-[11px]">Groups</div>
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
              <AIScreen trips={trips} onCreateTrip={createTripFromAi} onAddBooking={addBookingToTrip} />
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
