import { useState, useEffect, useRef } from 'react';
import type { Trip, Booking } from '../types';
import { BOOKING_TILES, PERKS, DESTINATIONS, PHRASES } from '../data';
import { buildTrip, pickEmoji } from '../lib/tripPlanner';
import { searchDestinations, getDestinationDetails, type DestinationResult } from '../lib/destinationSearch';
import AIScreen from './AIScreen';
import GroupsScreen from './GroupsScreen';
import InAppBrowser from '../components/InAppBrowser';

const BOOKING_TYPE_META: Record<string, { emoji: string; label: string }> = {
  flight: { emoji: '✈️', label: 'Flight' },
  hotel: { emoji: '🏨', label: 'Hotel' },
  cruise: { emoji: '🚢', label: 'Cruise' },
  car: { emoji: '🚗', label: 'Car Rental' },
  insurance: { emoji: '🛡️', label: 'Insurance' },
  esim: { emoji: '📶', label: 'eSIM' },
};

const POPULAR_DESTS = [
  { city: 'Tokyo', country: 'Japan', emoji: '🗼' },
  { city: 'Bali', country: 'Indonesia', emoji: '🌴' },
  { city: 'Paris', country: 'France', emoji: '🗼' },
  { city: 'Bangkok', country: 'Thailand', emoji: '🛕' },
  { city: 'Lisbon', country: 'Portugal', emoji: '🇵🇹' },
  { city: 'Mexico City', country: 'Mexico', emoji: '🌮' },
];

interface Props {
  trips: Trip[];
  onSaveTrips: (updated: Trip[]) => void;
  onBack?: () => void;
  onSwitchTab?: (tab: import('../types').TabId, hint?: string) => void;
}

type WizardStep = 'dest' | 'date' | 'days' | 'invites' | 'confirm';

export default function TripsScreen({ trips, onSaveTrips, onBack, onSwitchTab }: Props) {
  const save = (updated: Trip[]) => onSaveTrips(updated);

  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showAiPlanner, setShowAiPlanner] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingForm, setBookingForm] = useState({ type: 'hotel' as Booking['type'], name: '', confirmationCode: '', checkIn: '', checkOut: '', departureTime: '', arrivalTime: '', flightNumber: '', address: '', notes: '' });
  const [tripsView, setTripsView] = useState<'main' | 'destinations' | 'phrases' | 'groups'>('main');
  const [lang, setLang] = useState('es');
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({ 1: true });
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  // Plan a trip wizard
  const [showWizard, setShowWizard] = useState(false);
  const [wStep, setWStep] = useState<WizardStep>('dest');
  const [wDest, setWDest] = useState('');
  const [wCountry, setWCountry] = useState('');
  const [wStart, setWStart] = useState('');
  const [wDays, setWDays] = useState(7);
  const [wInvites, setWInvites] = useState<string[]>([]);
  const [wInviteInput, setWInviteInput] = useState('');

  // Live destination search
  const [wSearchQuery, setWSearchQuery] = useState('');
  const [wSearchResults, setWSearchResults] = useState<DestinationResult[]>([]);
  const [wSearching, setWSearching] = useState(false);
  const [wPickedPhoto, setWPickedPhoto] = useState<string | undefined>();
  const [wPickedSummary, setWPickedSummary] = useState<string | undefined>();
  const [wLoadingDetails, setWLoadingDetails] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // In-app browser for affiliate links
  const [browserUrl, setBrowserUrl] = useState<string | null>(null);
  const [browserTitle, setBrowserTitle] = useState<string>('');
  const openInternal = (url: string, title: string) => { setBrowserUrl(url); setBrowserTitle(title); };

  // Debounced live search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (wSearchQuery.trim().length < 2) { setWSearchResults([]); return; }
    setWSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchDestinations(wSearchQuery);
      setWSearchResults(results);
      setWSearching(false);
    }, 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [wSearchQuery]);

  // Hydrate photo + summary when destination picked
  const pickDestination = async (city: string, country: string) => {
    setWDest(city); setWCountry(country);
    setWPickedPhoto(undefined); setWPickedSummary(undefined);
    setWLoadingDetails(true);
    const d = await getDestinationDetails(city, country);
    setWPickedPhoto(d.photo); setWPickedSummary(d.summary);
    setWLoadingDetails(false);
  };

  const resetWizard = () => {
    setShowWizard(false);
    setWStep('dest');
    setWDest(''); setWCountry(''); setWStart(''); setWDays(7);
    setWInvites([]); setWInviteInput('');
    setWSearchQuery(''); setWSearchResults([]);
    setWPickedPhoto(undefined); setWPickedSummary(undefined);
  };

  const finishWizard = () => {
    if (!wDest) return;
    const t = buildTrip({ dest: wDest, country: wCountry, days: wDays, startDate: wStart || undefined, invites: wInvites });
    save([t, ...trips]);
    resetWizard();
  };

  const createTripFromAi = (dest: string, country: string, days: number) => {
    const t = buildTrip({ dest, country, days });
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
      cruise: { provider: 'Expedia Cruises', url: 'https://www.expedia.com/' },
      car: { provider: 'RentalCars', url: 'https://www.rentalcars.com/?utm_source=kipita' },
      insurance: { provider: 'World Nomads', url: 'https://www.worldnomads.com/' },
      esim: { provider: 'Airalo', url: 'https://www.airalo.com/?utm_source=kipita' },
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

  const inviteToTrip = (tripId: string, email: string) => {
    if (!email.trim()) return;
    save(trips.map(t => t.id === tripId
      ? { ...t, invites: [...(t.invites || []), email.trim()] }
      : t));
    setInviteEmail('');
    setShowInviteForm(false);
  };

  const filtered = trips.filter(t => tab === 'upcoming' ? t.status === 'upcoming' || t.status === 'active' : t.status === 'past' || t.status === 'cancelled');

  /* ── TRIP DETAIL — matches screenshot ── */
  if (selectedTrip) {
    const trip = trips.find(t => t.id === selectedTrip.id) || selectedTrip;
    const daysUntil = Math.ceil((new Date(trip.start).getTime() - Date.now()) / 86400000);
    const bookings = trip.bookings || [];
    const flightBooking = bookings.find(b => b.type === 'flight');
    const hotelBooking = bookings.find(b => b.type === 'hotel');
    const tripDays = Math.max(1, Math.ceil((new Date(trip.end).getTime() - new Date(trip.start).getTime()) / 86400000));
    const itineraryByDay: Record<number, typeof trip.items> = {};
    trip.items.forEach(it => {
      (itineraryByDay[it.day] ||= []).push(it);
    });

    const formatRange = () => {
      const fmt = (s: string) => {
        const d = new Date(s);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      };
      return `${fmt(trip.start)} → ${fmt(trip.end)}`;
    };

    const BOOK_MANAGE_TILES = [
      {
        emoji: '✈️', label: 'Flights',
        sub: flightBooking?.flightNumber || 'Search',
        url: 'https://expedia.com/affiliate/eA2cKky',
        active: !!flightBooking,
      },
      {
        emoji: '🏨', label: 'Hotels',
        sub: hotelBooking?.name?.slice(0, 14) || 'Search',
        url: 'https://www.hotels.com/affiliate/RrZ7bmg',
        active: !!hotelBooking,
      },
      {
        emoji: '🚗', label: 'Car Rental',
        sub: 'Search',
        url: 'https://www.rentalcars.com/?utm_source=kipita',
        active: false,
      },
      {
        emoji: '🚕', label: 'Uber',
        sub: 'Request',
        url: 'https://uber.com/?utm_source=kipita',
        active: false,
      },
      {
        emoji: '🛻', label: 'Lyft',
        sub: 'Request',
        url: 'https://lyft.com/?utm_source=kipita',
        active: false,
      },
    ];

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Hero image */}
        <div className="relative h-56 bg-gradient-to-br from-kipita-navy via-slate-700 to-slate-900 flex-shrink-0 overflow-hidden">
          <button
            onClick={() => { setSelectedTrip(null); setShowInviteForm(false); }}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white z-10"
          >
            <span className="ms text-xl">arrow_back</span>
          </button>
          {daysUntil > 0 && (
            <span className="absolute top-4 right-4 bg-kipita-red text-white text-[11px] font-extrabold px-3 py-1.5 rounded-full z-10">
              In {daysUntil} day{daysUntil !== 1 ? 's' : ''}
            </span>
          )}
          {/* Watermark emoji */}
          <div className="absolute inset-0 flex items-center justify-center opacity-20 text-[12rem] select-none pointer-events-none">
            {trip.emoji}
          </div>
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{trip.emoji}</span>
              <h2 className="text-2xl font-extrabold">{trip.dest}</h2>
            </div>
            <p className="text-white/80 text-xs mt-1">{formatRange()} · {tripDays} days</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-24">
          {/* BOOK & MANAGE row */}
          <div className="bg-card border-b border-border px-4 py-4">
            <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-3">BOOK & MANAGE</p>
            <div className="grid grid-cols-5 gap-2">
              {BOOK_MANAGE_TILES.map(t => (
                <a
                  key={t.label}
                  href={t.url}
                  target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 p-2 rounded-xl border border-border hover:border-kipita-red/40 hover:shadow-sm transition-all no-underline text-center active:scale-95"
                >
                  <span className="text-xl">{t.emoji}</span>
                  <span className={`text-[10px] font-bold ${t.active ? 'text-kipita-red' : 'text-foreground'}`}>{t.label}</span>
                  <span className="text-[9px] text-muted-foreground truncate w-full">{t.sub}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Itinerary section */}
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-extrabold text-foreground">Itinerary</h3>
              <button
                onClick={() => { setSelectedTrip(null); setShowAiPlanner(true); }}
                className="text-xs font-bold text-kipita-red bg-kipita-red/10 px-3 py-1.5 rounded-full flex items-center gap-1"
              >
                ✨ Ask AI
              </button>
            </div>

            {trip.items.length === 0 ? (
              <div className="text-center py-8 bg-muted/40 rounded-kipita">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm text-muted-foreground mb-3">No itinerary yet</p>
                <button
                  onClick={() => { setSelectedTrip(null); setShowAiPlanner(true); }}
                  className="px-4 py-2 bg-kipita-red text-white rounded-full text-xs font-bold"
                >
                  ✨ Generate with AI
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: tripDays }, (_, i) => i + 1).map(day => {
                  const dayItems = itineraryByDay[day] || [];
                  if (dayItems.length === 0) return null;
                  const isOpen = expandedDays[day] ?? false;
                  const dayLabel = day === 1 ? 'Arrival Day' : day === tripDays ? 'Departure Day' : `Day ${day}`;
                  return (
                    <div key={day} className="bg-card border border-border rounded-kipita overflow-hidden">
                      <button
                        onClick={() => setExpandedDays({ ...expandedDays, [day]: !isOpen })}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                      >
                        <span className="bg-kipita-red text-white text-[11px] font-extrabold px-2.5 py-1 rounded-md">Day {day}</span>
                        <span className="text-sm font-bold text-foreground flex-1 text-left">{dayLabel}</span>
                        <span className={`ms text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
                      </button>
                      {isOpen && (
                        <div className="border-t border-border divide-y divide-border">
                          {dayItems.map(it => (
                            <button
                              key={it.id}
                              onClick={() => toggleItem(trip.id, it.id)}
                              className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors ${it.done ? 'opacity-60' : ''}`}
                            >
                              <span className="text-[11px] font-bold text-muted-foreground tabular-nums w-12 flex-shrink-0 pt-0.5">{it.time}</span>
                              <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${it.done ? 'bg-kipita-green border-kipita-green' : 'border-border'}`}>
                                {it.done && <span className="text-white text-[8px]">✓</span>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-xs font-bold text-foreground leading-snug ${it.done ? 'line-through' : ''}`}>{it.title}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Invites */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-extrabold text-foreground">Trip Members</h3>
                <button onClick={() => setShowInviteForm(!showInviteForm)} className="text-xs font-bold text-kipita-red">
                  + Invite
                </button>
              </div>
              {showInviteForm && (
                <div className="flex gap-2 mb-3">
                  <input
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="flex-1 bg-card border border-border rounded-kipita-sm px-3 py-2 text-xs outline-none focus:border-kipita-red"
                  />
                  <button onClick={() => inviteToTrip(trip.id, inviteEmail)} className="px-3 py-2 bg-kipita-red text-white rounded-kipita-sm text-xs font-bold">Add</button>
                </div>
              )}
              {(trip.invites || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No members yet — invites enable group SOS alerts.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(trip.invites || []).map(em => (
                    <span key={em} className="text-xs bg-muted px-3 py-1.5 rounded-full font-semibold text-foreground">{em}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Bookings list */}
            {bookings.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-extrabold text-foreground">Confirmations</h3>
                  <button onClick={() => setShowBookingForm(true)} className="text-xs font-bold text-kipita-red">+ Add</button>
                </div>
                <div className="space-y-2">
                  {bookings.map(b => {
                    const meta = BOOKING_TYPE_META[b.type] || { emoji: '📦', label: b.type };
                    return (
                      <div key={b.id} className="bg-card border border-border rounded-kipita p-3">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{meta.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate">{b.name}</div>
                            <div className="text-[11px] text-muted-foreground">{b.provider}{b.confirmationCode ? ` · ${b.confirmationCode}` : ''}</div>
                            {b.flightNumber && <div className="text-[11px] text-muted-foreground">✈️ {b.flightNumber}</div>}
                            {(b.checkIn || b.checkOut) && (
                              <div className="text-[11px] text-muted-foreground">{b.checkIn} → {b.checkOut}</div>
                            )}
                          </div>
                          <button onClick={() => removeBooking(trip.id, b.id)} className="text-[11px] text-muted-foreground hover:text-kipita-red">Remove</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {bookings.length === 0 && (
              <button
                onClick={() => setShowBookingForm(true)}
                className="mt-6 w-full py-3 border-2 border-dashed border-border rounded-kipita text-xs font-semibold text-muted-foreground hover:border-kipita-red hover:text-kipita-red transition-colors"
              >
                + Add Booking Confirmation
              </button>
            )}

            {/* Add booking inline form */}
            {showBookingForm && (
              <div className="mt-3 bg-card border border-border rounded-kipita p-4 space-y-3">
                <h4 className="font-bold text-sm">Add Booking</h4>
                <select value={bookingForm.type} onChange={e => setBookingForm({ ...bookingForm, type: e.target.value as Booking['type'] })}
                  className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red">
                  {Object.entries(BOOKING_TYPE_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.emoji} {v.label}</option>
                  ))}
                </select>
                <input value={bookingForm.name} onChange={e => setBookingForm({ ...bookingForm, name: e.target.value })} placeholder="Name *"
                  className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
                <input value={bookingForm.confirmationCode} onChange={e => setBookingForm({ ...bookingForm, confirmationCode: e.target.value })} placeholder="Confirmation code"
                  className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
                {(bookingForm.type === 'flight') && (
                  <input value={bookingForm.flightNumber} onChange={e => setBookingForm({ ...bookingForm, flightNumber: e.target.value })} placeholder="Flight number"
                    className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
                )}
                <div className="flex gap-2">
                  <button onClick={submitBookingForm} className="flex-1 bg-kipita-red text-white py-2.5 rounded-kipita-sm font-bold text-sm">Save</button>
                  <button onClick={() => setShowBookingForm(false)} className="px-4 py-2.5 bg-muted rounded-kipita-sm text-sm font-semibold text-muted-foreground">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── DESTINATIONS view ── */
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

  /* ── PHRASES view ── */
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

  /* ── GROUPS view ── */
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

  /* ── MAIN trips view ── */
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
        {/* Plan a trip — primary CTA opens wizard */}
        <button
          onClick={() => setShowWizard(true)}
          className="w-full flex items-center gap-3 bg-gradient-to-r from-kipita-red to-rose-500 text-white rounded-kipita p-4 mb-3 text-left hover:shadow-lg transition-shadow shadow-md active:scale-[0.98]"
        >
          <span className="text-2xl">✈️</span>
          <div className="flex-1">
            <div className="font-extrabold text-sm">Plan a Trip</div>
            <div className="text-white/85 text-xs">Step-by-step booking · adds to your trips</div>
          </div>
          <span className="ms text-xl">arrow_forward</span>
        </button>

        {/* AI Planner secondary */}
        <button onClick={() => setShowAiPlanner(true)} className="w-full flex items-center gap-3 bg-card rounded-kipita p-4 mb-4 text-left hover:shadow-md transition-shadow shadow-sm border border-border">
          <span className="text-2xl">✨</span>
          <div className="flex-1">
            <div className="text-foreground font-extrabold text-sm">Plan with AI</div>
            <div className="text-muted-foreground text-xs">Chat to build a custom itinerary</div>
          </div>
        </button>

        {/* Travel utilities */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button onClick={() => setTripsView('destinations')} className="flex flex-col items-center gap-1.5 p-3 bg-card rounded-kipita text-center hover:shadow-md transition-shadow shadow-sm">
            <span className="text-xl">🌍</span>
            <div className="text-foreground font-bold text-[11px]">Destinations</div>
          </button>
          <button onClick={() => setTripsView('phrases')} className="flex flex-col items-center gap-1.5 p-3 bg-card rounded-kipita text-center hover:shadow-md transition-shadow shadow-sm">
            <span className="text-xl">🌐</span>
            <div className="text-foreground font-bold text-[11px]">Phrases</div>
          </button>
          <button onClick={() => setTripsView('groups')} className="flex flex-col items-center gap-1.5 p-3 bg-card rounded-kipita text-center hover:shadow-md transition-shadow shadow-sm">
            <span className="text-xl">👥</span>
            <div className="text-foreground font-bold text-[11px]">Groups</div>
          </button>
          <button onClick={() => onSwitchTab?.('maps')} className="flex flex-col items-center gap-1.5 p-3 bg-card rounded-kipita text-center hover:shadow-md transition-shadow shadow-sm">
            <span className="text-xl">🗺️</span>
            <div className="text-foreground font-bold text-[11px]">Maps</div>
          </button>
          <button onClick={() => onSwitchTab?.('wallet')} className="flex flex-col items-center gap-1.5 p-3 bg-card rounded-kipita text-center hover:shadow-md transition-shadow shadow-sm">
            <span className="text-xl">💱</span>
            <div className="text-foreground font-bold text-[11px]">Currency</div>
          </button>
          <button onClick={() => onSwitchTab?.('perks')} className="flex flex-col items-center gap-1.5 p-3 bg-card rounded-kipita text-center hover:shadow-md transition-shadow shadow-sm">
            <span className="text-xl">🎁</span>
            <div className="text-foreground font-bold text-[11px]">Perks</div>
          </button>
        </div>

        {/* AI Planner Modal */}
        {showAiPlanner && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background">
            <div className="flex items-center gap-2 p-3 border-b border-border bg-card flex-shrink-0">
              <button onClick={() => setShowAiPlanner(false)} className="ms text-lg text-muted-foreground hover:text-foreground">close</button>
              <h3 className="font-bold text-sm flex-1">AI Trip Planner</h3>
            </div>
            <div className="flex-1 overflow-hidden">
              <AIScreen trips={trips} onCreateTrip={createTripFromAi} onAddBooking={addBookingToTrip} />
            </div>
          </div>
        )}

        {/* Plan a Trip wizard modal */}
        {showWizard && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background">
            <div className="flex items-center gap-2 p-4 border-b border-border bg-card flex-shrink-0">
              <button onClick={resetWizard} className="ms text-xl text-muted-foreground">close</button>
              <h3 className="font-bold text-base flex-1">Plan a Trip</h3>
              <span className="text-[10px] font-bold text-muted-foreground tracking-wider">
                {wStep === 'dest' ? '1/5' : wStep === 'date' ? '2/5' : wStep === 'days' ? '3/5' : wStep === 'invites' ? '4/5' : '5/5'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* Step 1: Destination */}
              {wStep === 'dest' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xl font-extrabold mb-1">Where to?</h4>
                    <p className="text-sm text-muted-foreground">Pick a city or type your own.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {POPULAR_DESTS.map(d => (
                      <button key={d.city}
                        onClick={() => { setWDest(d.city); setWCountry(d.country); }}
                        className={`p-4 rounded-kipita border-2 text-left transition-all ${wDest === d.city ? 'border-kipita-red bg-kipita-red/5' : 'border-border bg-card hover:border-kipita-red/30'}`}
                      >
                        <div className="text-2xl mb-1">{d.emoji}</div>
                        <div className="text-sm font-bold">{d.city}</div>
                        <div className="text-[11px] text-muted-foreground">{d.country}</div>
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground">Or type a destination</label>
                    <input value={wDest} onChange={e => setWDest(e.target.value)} placeholder="e.g. Reykjavik"
                      className="mt-1 w-full bg-card border border-border rounded-kipita-sm px-3 py-3 text-sm outline-none focus:border-kipita-red" />
                    <input value={wCountry} onChange={e => setWCountry(e.target.value)} placeholder="Country"
                      className="mt-2 w-full bg-card border border-border rounded-kipita-sm px-3 py-3 text-sm outline-none focus:border-kipita-red" />
                  </div>
                </div>
              )}

              {/* Step 2: Date */}
              {wStep === 'date' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xl font-extrabold mb-1">When?</h4>
                    <p className="text-sm text-muted-foreground">Pick a departure date — leave blank for ~2 weeks out.</p>
                  </div>
                  <input type="date" value={wStart} onChange={e => setWStart(e.target.value)}
                    className="w-full bg-card border border-border rounded-kipita-sm px-3 py-4 text-base outline-none focus:border-kipita-red" />
                </div>
              )}

              {/* Step 3: Days */}
              {wStep === 'days' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xl font-extrabold mb-1">How long?</h4>
                    <p className="text-sm text-muted-foreground">Trip duration in days.</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 5, 7, 10, 14, 21, 30].map(d => (
                      <button key={d} onClick={() => setWDays(d)}
                        className={`py-4 rounded-kipita border-2 font-bold text-sm transition-all ${wDays === d ? 'border-kipita-red bg-kipita-red text-white' : 'border-border bg-card text-foreground'}`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground">Or custom</label>
                    <input type="number" min={1} max={90} value={wDays} onChange={e => setWDays(Math.max(1, parseInt(e.target.value) || 1))}
                      className="mt-1 w-full bg-card border border-border rounded-kipita-sm px-3 py-3 text-sm outline-none focus:border-kipita-red" />
                  </div>
                </div>
              )}

              {/* Step 4: Invites */}
              {wStep === 'invites' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xl font-extrabold mb-1">Travel companions?</h4>
                    <p className="text-sm text-muted-foreground">Add emails — they'll get SOS alerts during the trip.</p>
                  </div>
                  <div className="flex gap-2">
                    <input value={wInviteInput} onChange={e => setWInviteInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && wInviteInput.trim()) { setWInvites([...wInvites, wInviteInput.trim()]); setWInviteInput(''); } }}
                      placeholder="email@example.com"
                      className="flex-1 bg-card border border-border rounded-kipita-sm px-3 py-3 text-sm outline-none focus:border-kipita-red" />
                    <button onClick={() => { if (wInviteInput.trim()) { setWInvites([...wInvites, wInviteInput.trim()]); setWInviteInput(''); } }}
                      className="px-4 py-3 bg-kipita-red text-white rounded-kipita-sm text-sm font-bold">Add</button>
                  </div>
                  {wInvites.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {wInvites.map(em => (
                        <span key={em} className="text-xs bg-muted px-3 py-1.5 rounded-full font-semibold flex items-center gap-1">
                          {em}
                          <button onClick={() => setWInvites(wInvites.filter(x => x !== em))} className="text-muted-foreground hover:text-kipita-red">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Optional — you can skip this step.</p>
                </div>
              )}

              {/* Step 5: Confirm */}
              {wStep === 'confirm' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xl font-extrabold mb-1">Ready?</h4>
                    <p className="text-sm text-muted-foreground">We'll generate a starter itinerary. You can refine details after.</p>
                  </div>
                  <div className="bg-card border border-border rounded-kipita p-4 space-y-2">
                    <div className="flex items-center gap-2"><span className="text-2xl">{pickEmoji(wDest, wCountry)}</span><span className="font-bold text-lg">{wDest}{wCountry ? `, ${wCountry}` : ''}</span></div>
                    <div className="text-sm text-muted-foreground">📅 Starts {wStart || 'in ~2 weeks'}</div>
                    <div className="text-sm text-muted-foreground">⏱️ {wDays} days</div>
                    {wInvites.length > 0 && <div className="text-sm text-muted-foreground">👥 {wInvites.length} member{wInvites.length > 1 ? 's' : ''}</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Wizard footer nav */}
            <div className="flex gap-2 p-4 border-t border-border bg-card flex-shrink-0">
              {wStep !== 'dest' && (
                <button onClick={() => setWStep(wStep === 'date' ? 'dest' : wStep === 'days' ? 'date' : wStep === 'invites' ? 'days' : 'invites')}
                  className="px-4 py-3 bg-muted text-foreground rounded-kipita-sm text-sm font-bold">Back</button>
              )}
              {wStep !== 'confirm' ? (
                <button onClick={() => setWStep(wStep === 'dest' ? 'date' : wStep === 'date' ? 'days' : wStep === 'days' ? 'invites' : 'confirm')}
                  disabled={wStep === 'dest' && !wDest}
                  className="flex-1 bg-kipita-red text-white py-3 rounded-kipita-sm font-bold text-sm disabled:opacity-40">
                  Next
                </button>
              ) : (
                <button onClick={finishWizard}
                  className="flex-1 bg-kipita-green text-white py-3 rounded-kipita-sm font-bold text-sm">
                  ✈️ Create Trip
                </button>
              )}
            </div>
          </div>
        )}

        {/* Trip list */}
        {filtered.map(trip => {
          const bookingCount = trip.bookings?.length || 0;
          return (
            <button key={trip.id} onClick={() => { setSelectedTrip(trip); setExpandedDays({ 1: true }); }}
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

        {filtered.length === 0 && (
          <div className="text-center py-10">
            <p className="text-4xl mb-2">🧳</p>
            <p className="text-sm text-muted-foreground">No {tab} trips yet</p>
            <button onClick={() => setShowWizard(true)} className="mt-3 px-4 py-2 bg-kipita-red text-white rounded-full text-xs font-bold">
              ✈️ Plan your first trip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
