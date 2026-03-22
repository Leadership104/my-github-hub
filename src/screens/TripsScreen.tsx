import { useState } from 'react';
import type { Trip, ItineraryItem } from '../types';
import { BOOKING_TILES, PERKS } from '../data';
import AIScreen from './AIScreen';

export default function TripsScreen() {
  const [trips, setTrips] = useState<Trip[]>(() => {
    const saved = localStorage.getItem('kip_trips');
    return saved ? JSON.parse(saved) : [
      { id: '1', dest: 'Tokyo', country: 'Japan', emoji: '🗼', start: '2026-04-10', end: '2026-04-17', notes: 'Visit Shibuya, Akihabara, try ramen!', status: 'upcoming', items: [
        { id: 'i1', day: 1, time: '10:00', title: 'Arrive Narita Airport', done: false },
        { id: 'i2', day: 1, time: '14:00', title: 'Check in Shinjuku hotel', done: false },
        { id: 'i3', day: 2, time: '09:00', title: 'Meiji Shrine visit', done: false },
      ]},
      { id: '2', dest: 'Bali', country: 'Indonesia', emoji: '🌴', start: '2026-05-01', end: '2026-05-10', notes: 'Canggu coworking + surf', status: 'upcoming', items: [] },
    ];
  });

  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [showForm, setShowForm] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [form, setForm] = useState({ dest: '', country: '', start: '', end: '', notes: '' });

  const save = (updated: Trip[]) => { setTrips(updated); localStorage.setItem('kip_trips', JSON.stringify(updated)); };

  const createTrip = () => {
    if (!form.dest) return;
    const emoji = ['🏔️', '🌴', '🏖️', '🌺', '🗼', '🏙️'][Math.floor(Math.random() * 6)];
    const t: Trip = { id: Date.now().toString(), dest: form.dest, country: form.country, emoji, start: form.start, end: form.end, notes: form.notes, status: 'upcoming', items: [] };
    save([t, ...trips]);
    setForm({ dest: '', country: '', start: '', end: '', notes: '' });
    setShowForm(false);
  };

  const toggleItem = (tripId: string, itemId: string) => {
    save(trips.map(t => t.id === tripId ? { ...t, items: t.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) } : t));
  };

  const filtered = trips.filter(t => tab === 'upcoming' ? t.status === 'upcoming' || t.status === 'active' : t.status === 'past' || t.status === 'cancelled');
  const travelPerks = PERKS.filter(p => p.category === 'travel');

  if (selectedTrip) {
    const trip = trips.find(t => t.id === selectedTrip.id) || selectedTrip;
    const daysUntil = Math.ceil((new Date(trip.start).getTime() - Date.now()) / 86400000);
    return (
      <div className="flex flex-col h-full">
        <div className="bg-gradient-to-br from-kipita-navy to-kipita-red p-5 flex-shrink-0">
          <button onClick={() => setSelectedTrip(null)} className="text-white/70 flex items-center gap-1 mb-3 text-sm">
            <span className="ms text-lg">arrow_back</span> Back
          </button>
          <div className="text-4xl mb-2">{trip.emoji}</div>
          <h2 className="text-white text-xl font-extrabold">{trip.dest}, {trip.country}</h2>
          <p className="text-white/60 text-sm mt-1">{trip.start} → {trip.end}</p>
          {daysUntil > 0 && <p className="text-white/80 text-xs mt-2 font-semibold">{daysUntil} days away!</p>}
        </div>
        <div className="flex-1 overflow-y-auto p-5 pb-24">
          {trip.notes && <div className="bg-card border border-border rounded-kipita p-4 mb-4 text-sm text-muted-foreground">{trip.notes}</div>}

          {/* Book for This Trip */}
          <h3 className="font-bold text-sm mb-3">📦 Book for This Trip</h3>
          <div className="grid grid-cols-4 gap-2 mb-5">
            {BOOKING_TILES.slice(0, 8).map(b => (
              <a key={b.label} href={b.url} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 p-3 bg-card border border-border rounded-kipita-sm hover:shadow-md transition-all no-underline text-center">
                <span className="text-xl">{b.emoji}</span>
                <span className="text-[10px] font-semibold text-foreground leading-tight">{b.label}</span>
              </a>
            ))}
          </div>

          {/* Travel Perks */}
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
                <div className="bg-kipita-red-lt px-2 py-1 rounded text-[9px] font-bold text-kipita-red flex-shrink-0">{p.code}</div>
              </a>
            ))}
          </div>

          {/* Itinerary */}
          <h3 className="font-bold text-sm mb-3">Itinerary</h3>
          {trip.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet. Use Kipita AI to generate one!</p>
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
        <button className="w-full flex items-center gap-3 bg-gradient-to-r from-[#1a1a2e] to-kipita-red rounded-kipita p-4 mb-4 text-left">
          <span className="text-2xl">✨</span>
          <div className="flex-1">
            <div className="text-white font-extrabold text-sm">Plan with AI</div>
            <div className="text-white/60 text-xs">Generate itineraries instantly</div>
          </div>
        </button>

        {filtered.map(trip => (
          <button key={trip.id} onClick={() => setSelectedTrip(trip)}
            className="w-full flex items-center gap-3 p-4 bg-card border border-border rounded-kipita mb-3 text-left hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl flex-shrink-0">{trip.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{trip.dest}, {trip.country}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{trip.start} → {trip.end}</div>
              {trip.items.length > 0 && (
                <div className="text-xs text-kipita-green font-semibold mt-1">{trip.items.filter(i => i.done).length}/{trip.items.length} completed</div>
              )}
            </div>
            <span className="ms text-muted-foreground">chevron_right</span>
          </button>
        ))}

        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No {tab} trips yet</p>}

        {/* New trip form */}
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
