import { useState, useEffect, useRef } from 'react';
import type { Trip, Booking } from '../types';
import { BOOKING_TILES, PERKS, DESTINATIONS, PHRASES } from '../data';
import { buildTrip, pickEmoji } from '../lib/tripPlanner';
import { searchDestinations, getRichDestinationDetails, type DestinationResult, type DestinationDetails, type NewsItem } from '../lib/destinationSearch';
import AIScreen from './AIScreen';
import GroupsScreen from './GroupsScreen';
import InAppBrowser from '../components/InAppBrowser';

const BOOKING_TYPE_META: Record<string, { emoji: string; label: string }> = {
  flight: { emoji: '✈️', label: 'Flight' },
  hotel: { emoji: '🏨', label: 'Hotel' },
  cruise: { emoji: '🚢', label: 'Cruise' },
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
  /** Optional hint of form "plan:City|Country" to auto-open wizard pre-filled */
  initialHint?: string;
}

type WizardStep = 'dest' | 'date' | 'days' | 'invites' | 'confirm';

export default function TripsScreen({ trips, onSaveTrips, onBack, onSwitchTab, initialHint }: Props) {
  const save = (updated: Trip[]) => onSaveTrips(updated);

  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showAiPlanner, setShowAiPlanner] = useState(false);
  const [aiHandoff, setAiHandoff] = useState<{ prompt: string; label: string } | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingForm, setBookingForm] = useState({ type: 'hotel' as Booking['type'], name: '', confirmationCode: '', checkIn: '', checkOut: '', departureTime: '', arrivalTime: '', flightNumber: '', address: '', notes: '' });
  const [tripsView, setTripsView] = useState<'main' | 'destinations' | 'phrases' | 'groups'>('main');
  const [lang, setLang] = useState('es');
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({ 1: true });
  const [editMode, setEditMode] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  // Plan a trip wizard
  const [showWizard, setShowWizard] = useState(false);
  const [wStep, setWStep] = useState<WizardStep>('dest');
  const [wDest, setWDest] = useState('');
  const [wCountry, setWCountry] = useState('');
  const [wStart, setWStart] = useState('');
  const [wDays, setWDays] = useState(7);
  const [wArrivalAt, setWArrivalAt] = useState(''); // YYYY-MM-DDTHH:mm
  const [wDepartureAt, setWDepartureAt] = useState('');
  const [wInvites, setWInvites] = useState<string[]>([]);
  const [wInviteInput, setWInviteInput] = useState('');

  // Live destination search
  const [wSearchQuery, setWSearchQuery] = useState('');
  const [wSearchResults, setWSearchResults] = useState<DestinationResult[]>([]);
  const [wSearching, setWSearching] = useState(false);
  const [wPickedPhoto, setWPickedPhoto] = useState<string | undefined>();
  const [wPickedSummary, setWPickedSummary] = useState<string | undefined>();
  const [wPickedGallery, setWPickedGallery] = useState<string[]>([]);
  const [wPickedHistory, setWPickedHistory] = useState<string | undefined>();
  const [wPickedArea, setWPickedArea] = useState<string | undefined>();
  const [wPickedHero, setWPickedHero] = useState<string | undefined>();
  const [wPickedNews, setWPickedNews] = useState<NewsItem[]>([]);
  const [wLoadingDetails, setWLoadingDetails] = useState(false);
  const [tripRich, setTripRich] = useState<DestinationDetails | null>(null);
  const [tripRichLoading, setTripRichLoading] = useState(false);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
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

  // When a trip is selected, fetch rich details (gallery + history + overview)
  useEffect(() => {
    if (!selectedTrip) { setTripRich(null); setActivePhoto(null); return; }
    let cancelled = false;
    setTripRichLoading(true);
    setTripRich(null);
    setActivePhoto(selectedTrip.photo || null);
    getRichDestinationDetails(selectedTrip.dest, selectedTrip.country).then(d => {
      if (cancelled) return;
      setTripRich(d);
      setActivePhoto(prev => prev || d.photo || null);
      setTripRichLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedTrip]);

  // Auto-open wizard from external hint, e.g. "plan:Lisbon|Portugal"
  useEffect(() => {
    if (!initialHint || !initialHint.startsWith('plan:')) return;
    const payload = initialHint.slice(5);
    const [city, country = ''] = payload.split('|');
    if (!city) return;
    setShowWizard(true);
    setWStep('dest');
    pickDestination(city.trim(), country.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHint]);

  // Hydrate photo + summary + gallery + history when destination picked
  const pickDestination = async (city: string, country: string) => {
    setWDest(city); setWCountry(country);
    setWPickedPhoto(undefined); setWPickedSummary(undefined);
    setWPickedGallery([]); setWPickedHistory(undefined); setWPickedArea(undefined);
    setWPickedHero(undefined); setWPickedNews([]);
    setWLoadingDetails(true);
    const d = await getRichDestinationDetails(city, country);
    setWPickedPhoto(d.photo);
    setWPickedHero(d.photo);
    setWPickedSummary(d.summary);
    setWPickedGallery(d.gallery || []);
    setWPickedHistory(d.history);
    setWPickedArea(d.areaOverview);
    setWPickedNews(d.news || []);
    setWLoadingDetails(false);
  };

  const resetWizard = () => {
    setShowWizard(false);
    setWStep('dest');
    setWDest(''); setWCountry(''); setWStart(''); setWDays(7);
    setWArrivalAt(''); setWDepartureAt('');
    setWInvites([]); setWInviteInput('');
    setWSearchQuery(''); setWSearchResults([]);
    setWPickedPhoto(undefined); setWPickedSummary(undefined);
    setWPickedGallery([]); setWPickedHistory(undefined); setWPickedArea(undefined);
    setWPickedHero(undefined);
  };

  const finishWizard = () => {
    if (!wDest) return;
    // Derive days/start from explicit arrival/departure when both set
    let days = wDays;
    let startDate = wStart || undefined;
    if (wArrivalAt && wDepartureAt) {
      const ms = new Date(wDepartureAt).getTime() - new Date(wArrivalAt).getTime();
      days = Math.max(1, Math.ceil(ms / 86400000));
      startDate = wArrivalAt.split('T')[0];
    } else if (wArrivalAt) {
      startDate = wArrivalAt.split('T')[0];
    }
    const t = buildTrip({
      dest: wDest, country: wCountry, days,
      startDate, invites: wInvites,
      arrivalAt: wArrivalAt || undefined,
      departureAt: wDepartureAt || undefined,
      photo: wPickedPhoto, summary: wPickedSummary,
      gallery: wPickedGallery, history: wPickedHistory, areaOverview: wPickedArea,
    });
    save([t, ...trips]);
    resetWizard();
    // Land directly into the new trip so user sees booking flow
    setSelectedTrip(t);
    setExpandedDays({ 1: true });
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
      cruise: { provider: 'Expedia Cruises', url: 'https://www.expedia.com/?siteid=1&langid=1033&clickref=1110l34GXzfF&affcid=US.DIRECT.PHG.1100l360011.1100l68075&ref_id=1110l34GXzfF&my_ad=AFF.US.DIRECT.PHG.1100l360011.1100l68075&afflid=1110l34GXzfF&affdtl=PHG.1110l34GXzfF.PZ2TDkyK4w' },
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

  const updateItem = (tripId: string, itemId: string, patch: Partial<import('../types').ItineraryItem>) => {
    save(trips.map(t => t.id === tripId ? { ...t, items: t.items.map(i => i.id === itemId ? { ...i, ...patch } : i) } : t));
  };

  const deleteItem = (tripId: string, itemId: string) => {
    save(trips.map(t => t.id === tripId ? { ...t, items: t.items.filter(i => i.id !== itemId) } : t));
  };

  const addItem = (tripId: string, day: number) => {
    const newItem: import('../types').ItineraryItem = { id: `i-${Date.now()}`, day, time: '12:00', title: 'New activity', done: false };
    save(trips.map(t => t.id === tripId ? { ...t, items: [...t.items, newItem] } : t));
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
        emoji: '🚢', label: 'Cruises',
        sub: 'Search',
        url: 'https://www.expedia.com/?siteid=1&langid=1033&clickref=1110l34GXzfF&affcid=US.DIRECT.PHG.1100l360011.1100l68075&ref_id=1110l34GXzfF&my_ad=AFF.US.DIRECT.PHG.1100l360011.1100l68075&afflid=1110l34GXzfF&affdtl=PHG.1110l34GXzfF.PZ2TDkyK4w',
        active: false,
      },
    ];

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {browserUrl && <InAppBrowser url={browserUrl} title={browserTitle} onClose={() => setBrowserUrl(null)} />}
        {/* Hero image — main + thumbnails */}
        {(() => {
          const heroPhoto = activePhoto || trip.photo || tripRich?.photo;
          const galleryPool: string[] = [
            ...(trip.photo ? [trip.photo] : []),
            ...(tripRich?.photo ? [tripRich.photo] : []),
            ...(tripRich?.gallery || []),
          ];
          const galleryUnique = Array.from(new Set(galleryPool)).slice(0, 5);
          return (
            <div className="relative h-56 bg-gradient-to-br from-kipita-navy via-slate-700 to-slate-900 flex-shrink-0 overflow-hidden">
              {heroPhoto && (
                <img src={heroPhoto} alt={trip.dest} className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/30" />
              <button
                onClick={() => { setSelectedTrip(null); setShowInviteForm(false); }}
                className="btn-3d absolute top-4 left-4 w-10 h-10 rounded-full glass-dark flex items-center justify-center text-white z-10"
              >
                <span className="ms text-xl">arrow_back</span>
              </button>
              {daysUntil > 0 && (
                <span className="absolute top-4 right-4 glass-dark text-white text-[11px] font-extrabold px-3 py-1.5 rounded-full z-10">
                  In {daysUntil} day{daysUntil !== 1 ? 's' : ''}
                </span>
              )}
              {!heroPhoto && (
                <div className="absolute inset-0 flex items-center justify-center opacity-20 text-[12rem] select-none pointer-events-none">
                  {trip.emoji}
                </div>
              )}
              <div className="absolute bottom-3 left-4 right-4 text-white z-10">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{trip.emoji}</span>
                  <h2 className="text-2xl font-extrabold drop-shadow">{trip.dest}</h2>
                </div>
                <p className="text-white/90 text-xs mt-1 drop-shadow">{formatRange()} · {tripDays} days</p>
              </div>
            </div>
          );
        })()}

        {/* Photo gallery thumbnails */}
        {(() => {
          const galleryPool: string[] = [
            ...(trip.photo ? [trip.photo] : []),
            ...(tripRich?.photo ? [tripRich.photo] : []),
            ...(tripRich?.gallery || []),
          ];
          const galleryUnique = Array.from(new Set(galleryPool)).slice(0, 5);
          if (galleryUnique.length < 2 && !tripRichLoading) return null;
          return (
            <div className="bg-card border-b border-border px-4 py-3 flex-shrink-0">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {tripRichLoading && galleryUnique.length === 0 && (
                  <>
                    {[0,1,2,3].map(i => (
                      <div key={i} className="w-20 h-20 rounded-xl bg-muted animate-pulse flex-shrink-0" />
                    ))}
                  </>
                )}
                {galleryUnique.map((url) => (
                  <button
                    key={url}
                    onClick={() => setActivePhoto(url)}
                    className={`btn-3d relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 ${activePhoto === url ? 'ring-2 ring-kipita-red ring-offset-2 ring-offset-card' : ''}`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* (Summary moved into scrollable area below for fold visibility) */}

        <div className="flex-1 overflow-y-auto pb-24">
          {/* BOOK & MANAGE row */}
          <div className="bg-card border-b border-border px-4 py-4">
            <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-3">BOOK & MANAGE</p>
            <div className="grid grid-cols-5 gap-2">
              {BOOK_MANAGE_TILES.map(t => (
                <button
                  key={t.label}
                  onClick={() => openInternal(t.url, `${t.label} · ${trip.dest}`)}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl border border-border hover:border-kipita-red/40 hover:shadow-sm transition-all text-center active:scale-95"
                >
                  <span className="text-xl">{t.emoji}</span>
                  <span className={`text-[10px] font-bold ${t.active ? 'text-kipita-red' : 'text-foreground'}`}>{t.label}</span>
                  <span className="text-[9px] text-muted-foreground truncate w-full">{t.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* About destination — collapsible (Overview / History / The Area) */}
          {(trip.summary || tripRich?.summary || tripRich?.history || tripRich?.areaOverview) && (() => {
            const overview = trip.summary || tripRich?.summary;
            return (
              <details className="group bg-card border-b border-border">
                <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-muted-foreground tracking-widest">ABOUT {trip.dest.toUpperCase()}</p>
                  <span className="ms text-muted-foreground text-lg group-open:rotate-180 transition-transform">expand_more</span>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  {overview && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1">OVERVIEW</p>
                      <p className="text-xs text-foreground leading-relaxed">{overview}</p>
                    </div>
                  )}
                  {tripRich?.history && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1">HISTORY</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{tripRich.history}</p>
                    </div>
                  )}
                  {tripRich?.areaOverview && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1">THE AREA</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{tripRich.areaOverview}</p>
                    </div>
                  )}
                </div>
              </details>
            );
          })()}

          {/* Itinerary section */}
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="text-base font-extrabold text-foreground">Itinerary</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditMode(m => !m)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 ${editMode ? 'bg-kipita-green text-white' : 'bg-muted text-foreground'}`}
                >
                  <span className="ms text-sm">{editMode ? 'check' : 'edit'}</span>
                  {editMode ? 'Done' : 'Edit'}
                </button>
                <button
                  onClick={() => { setSelectedTrip(null); setShowAiPlanner(true); }}
                  className="text-xs font-bold text-kipita-red bg-kipita-red/10 px-3 py-1.5 rounded-full flex items-center gap-1"
                >
                  ✨ Ask AI
                </button>
              </div>
            </div>

            {/* Arrival / Departure summary */}
            {(trip.arrivalAt || trip.departureAt) && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-muted/40 rounded-kipita-sm p-2.5">
                  <div className="text-[10px] font-bold text-muted-foreground tracking-wider">✈️ ARRIVAL</div>
                  <div className="text-xs font-bold text-foreground mt-0.5">
                    {trip.arrivalAt ? new Date(trip.arrivalAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                  </div>
                </div>
                <div className="bg-muted/40 rounded-kipita-sm p-2.5">
                  <div className="text-[10px] font-bold text-muted-foreground tracking-wider">🛬 DEPARTURE</div>
                  <div className="text-xs font-bold text-foreground mt-0.5">
                    {trip.departureAt ? new Date(trip.departureAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                  </div>
                </div>
              </div>
            )}

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
                  const dayItems = (itineraryByDay[day] || []).slice().sort((a, b) => a.time.localeCompare(b.time));
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
                        <span className="text-[10px] text-muted-foreground">{dayItems.length} item{dayItems.length !== 1 ? 's' : ''}</span>
                        <span className={`ms text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
                      </button>
                      {isOpen && (
                        <div className="border-t border-border divide-y divide-border">
                          {dayItems.length === 0 && !editMode && (
                            <div className="px-4 py-3 text-xs text-muted-foreground italic">No activities yet.</div>
                          )}
                          {dayItems.map(it => {
                            const isEditing = editMode && editingItemId === it.id;
                            if (isEditing) {
                              return (
                                <div key={it.id} className="px-4 py-3 bg-muted/30 flex items-start gap-2">
                                  <input
                                    type="time"
                                    value={it.time}
                                    onChange={e => updateItem(trip.id, it.id, { time: e.target.value })}
                                    className="bg-card border border-border rounded px-2 py-1 text-xs w-24 outline-none focus:border-kipita-red"
                                  />
                                  <input
                                    type="text"
                                    value={it.title}
                                    onChange={e => updateItem(trip.id, it.id, { title: e.target.value })}
                                    className="flex-1 bg-card border border-border rounded px-2 py-1 text-xs outline-none focus:border-kipita-red"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => setEditingItemId(null)}
                                    className="ms text-base text-kipita-green"
                                    aria-label="Save"
                                  >check</button>
                                </div>
                              );
                            }
                            return (
                              <div key={it.id} className={`flex items-start gap-3 px-4 py-3 ${it.done ? 'opacity-60' : ''}`}>
                                <button
                                  onClick={() => toggleItem(trip.id, it.id)}
                                  className="flex items-start gap-3 flex-1 min-w-0 text-left hover:bg-muted/30 -mx-2 px-2 py-1 rounded transition-colors"
                                >
                                  <span className="text-[11px] font-bold text-muted-foreground tabular-nums w-12 flex-shrink-0 pt-0.5">{it.time}</span>
                                  <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${it.done ? 'bg-kipita-green border-kipita-green' : 'border-border'}`}>
                                    {it.done && <span className="text-white text-[8px]">✓</span>}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-xs font-bold text-foreground leading-snug ${it.done ? 'line-through' : ''}`}>{it.title}</div>
                                  </div>
                                </button>
                                {editMode && (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      onClick={() => setEditingItemId(it.id)}
                                      className="ms text-base text-muted-foreground hover:text-foreground p-1"
                                      aria-label="Edit"
                                    >edit</button>
                                    <button
                                      onClick={() => deleteItem(trip.id, it.id)}
                                      className="ms text-base text-muted-foreground hover:text-kipita-red p-1"
                                      aria-label="Delete"
                                    >delete</button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {editMode && (
                            <button
                              onClick={() => addItem(trip.id, day)}
                              className="w-full text-xs font-bold text-kipita-red px-4 py-2.5 hover:bg-kipita-red/5 transition-colors flex items-center justify-center gap-1"
                            >
                              <span className="ms text-sm">add</span> Add activity
                            </button>
                          )}
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
          <div className="fixed inset-0 z-[350] flex flex-col bg-background">
            <div className="flex items-center gap-2 p-3 border-b border-border bg-card flex-shrink-0">
              <button onClick={() => setShowAiPlanner(false)} className="ms text-lg text-muted-foreground hover:text-foreground">close</button>
              <h3 className="font-bold text-sm flex-1">AI Trip Planner</h3>
            </div>
            <div className="flex-1 overflow-hidden">
              <AIScreen trips={trips} onCreateTrip={createTripFromAi} onAddBooking={addBookingToTrip} />
            </div>
          </div>
        )}

        {/* Plan a Trip — single-screen form */}
        {showWizard && (
          <div className="fixed inset-0 z-[350] flex flex-col bg-background">
            <div className="flex items-center gap-2 p-4 border-b border-border bg-card flex-shrink-0">
              <button onClick={resetWizard} className="ms text-xl text-muted-foreground">close</button>
              <h3 className="font-bold text-base flex-1">Plan a Trip</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* ── Destination search ── */}
              <section className="space-y-3">
                <div>
                  <h4 className="text-lg font-extrabold mb-1">1. Where to?</h4>
                  <p className="text-xs text-muted-foreground">Search any city — we pull a real HD photo, summary & latest news.</p>
                </div>
                <div className="relative">
                  <span className="ms text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-lg">search</span>
                  <input
                    value={wSearchQuery}
                    onChange={e => setWSearchQuery(e.target.value)}
                    placeholder="Try: Lisbon, Reykjavik, Cartagena…"
                    className="w-full bg-card border border-border rounded-kipita-sm pl-10 pr-10 py-3 text-sm outline-none focus:border-kipita-red"
                  />
                  {wSearching && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">…</span>
                  )}
                </div>

                {wSearchResults.length > 0 && (
                  <div className="bg-card border border-border rounded-kipita divide-y divide-border max-h-56 overflow-y-auto">
                    {wSearchResults.map((r, i) => (
                      <button
                        key={`${r.name}-${i}`}
                        onClick={() => { pickDestination(r.name, r.country); setWSearchQuery(''); setWSearchResults([]); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                      >
                        <span className="ms text-muted-foreground text-lg">place</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold truncate">{r.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {[r.region, r.country].filter(Boolean).join(', ')}
                            {r.population ? ` · ${(r.population / 1000).toFixed(0)}k` : ''}
                          </div>
                        </div>
                        <span className="ms text-muted-foreground">chevron_right</span>
                      </button>
                    ))}
                  </div>
                )}

                {!wDest && wSearchResults.length === 0 && !wSearching && (
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground tracking-wider mb-2">POPULAR DESTINATIONS</p>
                    <div className="grid grid-cols-3 gap-2">
                      {POPULAR_DESTS.map(d => (
                        <button key={d.city}
                          onClick={() => pickDestination(d.city, d.country)}
                          className="btn-3d p-3 rounded-kipita glass text-left"
                        >
                          <div className="text-2xl mb-1">{d.emoji}</div>
                          <div className="text-xs font-bold">{d.city}</div>
                          <div className="text-[10px] text-muted-foreground">{d.country}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Picked destination preview */}
                {wDest && (() => {
                  const pool = [
                    ...(wPickedPhoto ? [wPickedPhoto] : []),
                    ...wPickedGallery,
                  ];
                  const unique = Array.from(new Set(pool));
                  const hero = wPickedHero || wPickedPhoto;
                  const thumbs = unique.filter(u => u !== hero).slice(0, 4);
                  return (
                    <div className="rounded-kipita overflow-hidden bg-card shadow-lg border border-border/40">
                      <div className="relative h-56 bg-gradient-to-br from-kipita-navy to-slate-700">
                        {wLoadingDetails && !hero ? (
                          <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center text-xs text-muted-foreground">
                            Loading HD photo…
                          </div>
                        ) : hero ? (
                          <img src={hero} alt={wDest} loading="eager" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-7xl">{pickEmoji(wDest, wCountry)}</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        <button
                          onClick={() => { setWDest(''); setWCountry(''); setWPickedPhoto(undefined); setWPickedSummary(undefined); setWPickedGallery([]); setWPickedHero(undefined); setWPickedHistory(undefined); setWPickedArea(undefined); }}
                          className="btn-3d absolute top-3 right-3 glass-dark text-white text-[10px] font-bold px-3 py-1.5 rounded-full"
                        >
                          Change
                        </button>
                        <div className="absolute bottom-3 left-4 right-4 text-white">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl drop-shadow">{pickEmoji(wDest, wCountry)}</span>
                            <div>
                              <div className="font-extrabold text-xl drop-shadow">{wDest}</div>
                              <div className="text-[11px] text-white/90 drop-shadow">{wCountry}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {(thumbs.length > 0 || wLoadingDetails) && (
                        <div className="px-3 py-3 grid grid-cols-4 gap-2 bg-card">
                          {wLoadingDetails && thumbs.length === 0
                            ? [0,1,2,3].map(i => <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />)
                            : thumbs.map(url => (
                                <button
                                  key={url}
                                  onClick={() => setWPickedHero(url)}
                                  className={`btn-3d aspect-square rounded-lg overflow-hidden ${wPickedHero === url ? 'ring-2 ring-kipita-red ring-offset-2 ring-offset-card' : ''}`}
                                >
                                  <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                                </button>
                              ))
                          }
                        </div>
                      )}

                      <div className="px-4 pb-4 space-y-3">
                        {wPickedSummary && (
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1">OVERVIEW</p>
                            <p className="text-xs text-foreground leading-relaxed">{wPickedSummary}</p>
                          </div>
                        )}
                        {wPickedNews && wPickedNews.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1.5">📰 LATEST NEWS</p>
                            <div className="space-y-1.5">
                              {wPickedNews.slice(0, 4).map((n, i) => (
                                <button
                                  key={i}
                                  onClick={() => openInternal(n.url, n.source || 'News')}
                                  className="w-full text-left bg-muted/40 hover:bg-muted rounded-lg p-2 transition-colors"
                                >
                                  <div className="text-[11px] font-bold text-foreground line-clamp-2 leading-snug">{n.title}</div>
                                  {n.source && (
                                    <div className="text-[10px] text-muted-foreground mt-0.5">{n.source}</div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {wPickedHistory && (
                          <details>
                            <summary className="text-[10px] font-bold text-muted-foreground tracking-widest cursor-pointer">HISTORY</summary>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-1">{wPickedHistory}</p>
                          </details>
                        )}
                        {wPickedArea && (
                          <details>
                            <summary className="text-[10px] font-bold text-muted-foreground tracking-widest cursor-pointer">THE AREA</summary>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-1">{wPickedArea}</p>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </section>

              {/* ── Arrival & Departure ── */}
              <section className="space-y-3">
                <div>
                  <h4 className="text-lg font-extrabold">2. Arrival & Departure</h4>
                  <p className="text-xs text-muted-foreground">Set exact dates & times — we'll seed your itinerary with arrival and departure.</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground tracking-wider mb-1 block">✈️ ARRIVAL</label>
                    <input
                      type="datetime-local"
                      value={wArrivalAt}
                      onChange={e => {
                        setWArrivalAt(e.target.value);
                        if (e.target.value) setWStart(e.target.value.split('T')[0]);
                      }}
                      className="w-full bg-card border border-border rounded-kipita-sm px-3 py-3 text-sm outline-none focus:border-kipita-red"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground tracking-wider mb-1 block">🛬 DEPARTURE</label>
                    <input
                      type="datetime-local"
                      value={wDepartureAt}
                      min={wArrivalAt || undefined}
                      onChange={e => setWDepartureAt(e.target.value)}
                      className="w-full bg-card border border-border rounded-kipita-sm px-3 py-3 text-sm outline-none focus:border-kipita-red"
                    />
                  </div>
                </div>
                {/* Quick presets — set departure = arrival + N days */}
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1.5">Quick length (sets departure):</p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {[3, 5, 7, 10, 14, 21, 30].map(d => (
                      <button
                        key={d}
                        onClick={() => {
                          setWDays(d);
                          const base = wArrivalAt ? new Date(wArrivalAt) : (() => { const x = new Date(); x.setDate(x.getDate() + 14); x.setHours(15, 0, 0, 0); return x; })();
                          if (!wArrivalAt) {
                            const pad = (n: number) => String(n).padStart(2, '0');
                            setWArrivalAt(`${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`);
                          }
                          const dep = new Date(base);
                          dep.setDate(dep.getDate() + d);
                          dep.setHours(12, 0, 0, 0);
                          const pad = (n: number) => String(n).padStart(2, '0');
                          setWDepartureAt(`${dep.getFullYear()}-${pad(dep.getMonth() + 1)}-${pad(dep.getDate())}T${pad(dep.getHours())}:${pad(dep.getMinutes())}`);
                        }}
                        className={`py-2.5 rounded-kipita-sm border-2 font-bold text-xs transition-all ${wDays === d ? 'border-kipita-red bg-kipita-red text-white' : 'border-border bg-card text-foreground'}`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
                {wArrivalAt && wDepartureAt && (
                  <div className="text-[11px] bg-muted/40 rounded-lg px-3 py-2 text-foreground">
                    Trip length: <strong>{Math.max(1, Math.ceil((new Date(wDepartureAt).getTime() - new Date(wArrivalAt).getTime()) / 86400000))} days</strong>
                  </div>
                )}
                {/* Stuck? Ask AI */}
                <button
                  onClick={() => { resetWizard(); setShowAiPlanner(true); }}
                  className="w-full text-xs font-bold text-kipita-red bg-kipita-red/10 px-3 py-2 rounded-full flex items-center justify-center gap-1 mt-1"
                >
                  ✨ Stuck? Ask AI to suggest dates & flights
                </button>
              </section>

              {/* ── Invites ── */}
              <section className="space-y-2">
                <h4 className="text-lg font-extrabold">4. Travel companions <span className="text-xs font-normal text-muted-foreground">(optional)</span></h4>
                <div className="flex gap-2">
                  <input value={wInviteInput} onChange={e => setWInviteInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && wInviteInput.trim()) { setWInvites([...wInvites, wInviteInput.trim()]); setWInviteInput(''); } }}
                    placeholder="email@example.com"
                    className="flex-1 bg-card border border-border rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:border-kipita-red" />
                  <button onClick={() => { if (wInviteInput.trim()) { setWInvites([...wInvites, wInviteInput.trim()]); setWInviteInput(''); } }}
                    className="px-4 py-2.5 bg-muted text-foreground rounded-kipita-sm text-sm font-bold">Add</button>
                </div>
                {wInvites.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {wInvites.map(em => (
                      <span key={em} className="text-xs bg-muted px-3 py-1.5 rounded-full font-semibold flex items-center gap-1">
                        {em}
                        <button onClick={() => setWInvites(wInvites.filter(x => x !== em))} className="text-muted-foreground hover:text-kipita-red">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Single submit button */}
            <div className="p-4 border-t border-border bg-card flex-shrink-0">
              <button
                onClick={finishWizard}
                disabled={!wDest}
                className="w-full bg-kipita-green hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white py-4 rounded-kipita font-extrabold text-sm shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <span className="ms text-lg">check_circle</span>
                {wDest ? `Create trip to ${wDest}` : 'Pick a destination first'}
              </button>
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
      {browserUrl && <InAppBrowser url={browserUrl} title={browserTitle} onClose={() => setBrowserUrl(null)} />}
    </div>
  );
}
