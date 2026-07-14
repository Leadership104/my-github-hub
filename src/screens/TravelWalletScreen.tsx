import { useEffect, useState } from 'react';
import type { Trip } from '../types';
import { notify } from '../lib/toast';
import HorizontalScroller from '../components/HorizontalScroller';

type TripType = 'domestic' | 'international';
type StorageKind = 'pictures' | 'videos' | 'pdfs';
type WalletTab = 'overview' | 'documents' | 'storage' | 'settings';

interface StorageItem {
  id: string;
  name: string;
  data: string;
}

interface WalletState {
  tripType: TripType;
  checklist: Record<string, Record<string, boolean>>;
  reminders: Record<string, boolean>;
  mail: { hold: string; resume: string };
  storage: Record<StorageKind, StorageItem[]>;
}

interface ChecklistItem { id: string; label: string; }
interface ChecklistGroup { id: string; title: string; emoji: string; bg: string; items: ChecklistItem[]; }

const CHECKLISTS: Record<TripType, ChecklistGroup[]> = {
  domestic: [
    { id: 'accommodation', title: 'Accommodation', emoji: '🏨', bg: '#E9E4FB', items: [
      { id: 'hotel', label: 'Hotel reservation confirmed' },
    ]},
    { id: 'identification', title: 'Identification', emoji: '🪪', bg: '#DDEBFF', items: [
      { id: 'license', label: "Driver's license packed" },
      { id: 'passport', label: 'Passport packed (backup ID)' },
    ]},
    { id: 'currency', title: 'Currency', emoji: '💵', bg: '#E3F5E1', items: [
      { id: 'cash', label: 'Cash on hand' },
      { id: 'card', label: 'Credit card packed' },
      { id: 'cardNotice', label: 'Card issuer notified of travel' },
    ]},
    { id: 'tickets', title: 'Travel Tickets', emoji: '🎫', bg: '#FDECD8', items: [
      { id: 'airline', label: 'Airline ticket confirmed' },
      { id: 'bus', label: 'Bus ticket confirmed' },
      { id: 'train', label: 'Train ticket confirmed' },
    ]},
    { id: 'transportation', title: 'Transportation', emoji: '🚗', bg: '#DDF3E4', items: [
      { id: 'rental', label: 'Car rental arranged' },
      { id: 'limo', label: 'Limo / car service arranged' },
    ]},
  ],
  international: [
    { id: 'accommodation', title: 'Accommodation', emoji: '🏨', bg: '#E9E4FB', items: [
      { id: 'hotel', label: 'Hotel reservation confirmed' },
    ]},
    { id: 'currency', title: 'Currency', emoji: '💵', bg: '#E3F5E1', items: [
      { id: 'cash', label: 'Local currency on hand' },
      { id: 'card', label: 'Credit card packed' },
      { id: 'cardNotice', label: 'Card issuer notified — charges enabled' },
    ]},
    { id: 'mobile', title: 'Mobile Phone', emoji: '📱', bg: '#DDEBFF', items: [
      { id: 'roaming', label: 'Roaming on / eSIM ready' },
    ]},
    { id: 'passport', title: 'Passport & Visa', emoji: '🛂', bg: '#FDE7E6', items: [
      { id: 'passportValid', label: 'Passport valid 6+ months' },
      { id: 'visa', label: 'Entry visa obtained' },
    ]},
    { id: 'health', title: 'Vaccinations', emoji: '💉', bg: '#FDECD8', items: [
      { id: 'vaccine', label: 'Vaccinations up to date' },
      { id: 'testRecord', label: 'Test records saved' },
    ]},
    { id: 'tickets', title: 'Travel Tickets', emoji: '🎫', bg: '#E3F5E1', items: [
      { id: 'airline', label: 'Airline ticket confirmed' },
      { id: 'train', label: 'Train / rail ticket confirmed' },
    ]},
    { id: 'transportation', title: 'Transportation', emoji: '🚕', bg: '#DDF3E4', items: [
      { id: 'taxi', label: 'Taxi / ride share arranged' },
      { id: 'rental', label: 'Car rental arranged' },
    ]},
  ],
};

const REMINDERS: { id: string; emoji: string; text: string }[] = [
  { id: 'mail', emoji: '📬', text: 'Suspend mail delivery' },
  { id: 'newspaper', emoji: '📰', text: 'Pause newspaper delivery' },
  { id: 'packages', emoji: '📦', text: 'Hold package deliveries' },
  { id: 'thermostat', emoji: '🌡️', text: 'Set thermostat to away' },
];

const KIND_META: Record<StorageKind, { label: string; emoji: string; accept: string }> = {
  pictures: { label: 'Pictures', emoji: '🖼️', accept: 'image/*' },
  videos: { label: 'Videos', emoji: '🎥', accept: 'video/*' },
  pdfs: { label: 'PDF files', emoji: '📄', accept: 'application/pdf' },
};

const walletKey = (tripId: string) => `kip_wallet_${tripId}`;

function loadWallet(tripId: string): WalletState {
  try {
    const raw = localStorage.getItem(walletKey(tripId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore corrupt data */ }
  return {
    tripType: 'domestic',
    checklist: {},
    reminders: {},
    mail: { hold: '', resume: '' },
    storage: { pictures: [], videos: [], pdfs: [] },
  };
}

function readiness(tripType: TripType, checklist: WalletState['checklist']) {
  const groups = CHECKLISTS[tripType];
  let done = 0, total = 0;
  groups.forEach(g => g.items.forEach(it => {
    total++;
    if (checklist[g.id]?.[it.id]) done++;
  }));
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

function countdownParts(target?: string) {
  if (!target) return null;
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  return { days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000) };
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg - 180) * Math.PI / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function ReadinessGauge({ percent }: { percent: number }) {
  const cx = 130, cy = 120, r = 100;
  const start = polar(cx, cy, r, 0), end = polar(cx, cy, r, 180);
  const arcPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
  const marker = polar(cx, cy, r, (percent / 100) * 180);
  let label = 'GETTING STARTED', color = 'hsl(var(--kipita-red))';
  if (percent >= 90) { label = 'READY TO GO'; color = 'hsl(var(--kipita-green))'; }
  else if (percent >= 60) { label = 'ALMOST THERE'; color = '#F5B400'; }
  else if (percent >= 30) { label = 'IN PROGRESS'; color = '#F97316'; }
  return (
    <svg width="260" height="150" viewBox="0 0 260 150" className="mx-auto max-w-full">
      <defs>
        <linearGradient id="walletGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--kipita-red))" />
          <stop offset="35%" stopColor="#F97316" />
          <stop offset="65%" stopColor="#F5B400" />
          <stop offset="100%" stopColor="hsl(var(--kipita-green))" />
        </linearGradient>
      </defs>
      <path d={arcPath} fill="none" stroke="hsl(var(--muted))" strokeWidth={16} strokeLinecap="round" />
      <path d={arcPath} fill="none" stroke="url(#walletGaugeGrad)" strokeWidth={16} strokeLinecap="round" opacity={0.95} />
      <circle cx={marker.x} cy={marker.y} r={9} fill="white" stroke={color} strokeWidth={4} />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={40} fontWeight={800} fill="hsl(var(--foreground))">{percent}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fontWeight={700} fill={color} letterSpacing={1}>{label}</text>
      <text x={start.x} y={cy + 34} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">0</text>
      <text x={end.x} y={cy + 34} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">100</text>
    </svg>
  );
}

interface Props {
  trip: Trip;
  onBack: () => void;
  onOpenSafety: () => void;
}

export default function TravelWalletScreen({ trip, onBack, onOpenSafety }: Props) {
  const [wallet, setWallet] = useState<WalletState>(() => loadWallet(trip.id));
  const [tab, setTab] = useState<WalletTab>('overview');
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [storageKind, setStorageKind] = useState<StorageKind>('pictures');
  const [, forceTick] = useState(0);

  useEffect(() => {
    try { localStorage.setItem(walletKey(trip.id), JSON.stringify(wallet)); } catch { /* storage full/unavailable */ }
  }, [wallet, trip.id]);

  // Refresh the countdown once a minute while this screen is open.
  useEffect(() => {
    const id = window.setInterval(() => forceTick(t => t + 1), 60000);
    return () => window.clearInterval(id);
  }, []);

  const departure = trip.departureAt || trip.start;
  const { done, total, pct } = readiness(wallet.tripType, wallet.checklist);
  const cd = countdownParts(departure);
  const groups = CHECKLISTS[wallet.tripType];
  const activeGroup = groups.find(g => g.id === openCategory) || null;
  const items = wallet.storage[storageKind];

  const setTripType = (tt: TripType) => { setWallet(w => ({ ...w, tripType: tt })); setOpenCategory(null); };

  const toggleItem = (groupId: string, itemId: string) => {
    setWallet(w => ({
      ...w,
      checklist: { ...w.checklist, [groupId]: { ...w.checklist[groupId], [itemId]: !w.checklist[groupId]?.[itemId] } },
    }));
  };

  const toggleReminder = (id: string) => {
    setWallet(w => ({ ...w, reminders: { ...w.reminders, [id]: !w.reminders[id] } }));
  };

  const setMail = (patch: Partial<WalletState['mail']>) => setWallet(w => ({ ...w, mail: { ...w.mail, ...patch } }));

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      if (file.size > 4_000_000) { notify('File too large — 4MB max'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        setWallet(w => ({
          ...w,
          storage: { ...w.storage, [storageKind]: [...w.storage[storageKind], { id: `${Date.now()}-${Math.random()}`, name: file.name, data: String(reader.result) }] },
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeStorageItem = (id: string) => {
    setWallet(w => ({ ...w, storage: { ...w.storage, [storageKind]: w.storage[storageKind].filter(i => i.id !== id) } }));
  };

  const resetWallet = () => {
    if (!confirm('Clear all Travel Wallet data for this trip? This cannot be undone.')) return;
    try { localStorage.removeItem(walletKey(trip.id)); } catch { /* ignore */ }
    setWallet(loadWallet(trip.id));
    setOpenCategory(null);
    notify('Travel Wallet reset');
  };

  const pillClass = (active: boolean) =>
    `px-4 py-2 rounded-full text-xs font-bold transition-colors ${active ? 'bg-kipita-navy text-white' : 'bg-muted text-muted-foreground'}`;

  const TABS: { id: WalletTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'documents', label: 'Documents' },
    { id: 'storage', label: 'Storage' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden screen-enter">
      <div className="bg-card border-b border-border px-4 pt-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <span className="ms text-lg">arrow_back</span> Back
          </button>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-kipita-green" /> Saved on this device
          </span>
        </div>
        <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2 truncate">
          <span className="ms text-kipita-red text-xl">luggage</span>
          <span className="truncate">Travel Wallet — {trip.dest}</span>
        </h2>
        <p className="text-xs text-muted-foreground mb-3 mt-0.5">{wallet.tripType === 'international' ? 'International trip' : 'Domestic trip'}</p>
        <div className="flex gap-5 border-b border-border overflow-x-auto scrollbar-hide">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setOpenCategory(null); }}
              className={`pb-2.5 text-[11px] font-extrabold tracking-wide uppercase border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === t.id ? 'text-kipita-red border-kipita-red' : 'text-muted-foreground border-transparent'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {tab === 'overview' && (
          <>
            <div className="bg-card border border-border rounded-kipita p-5 mb-4">
              <div className="text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase mb-1 text-center">Ready 2 Go Score</div>
              <ReadinessGauge percent={pct} />
              <div className="flex gap-2 justify-center mt-2">
                <div className="bg-muted rounded-2xl px-4 py-2 text-center min-w-[92px]">
                  <div className="text-[10px] font-extrabold text-muted-foreground tracking-wide">COUNTDOWN</div>
                  <div className="text-sm font-extrabold text-foreground">{cd ? `${cd.days}d ${cd.hours}h` : '—'}</div>
                </div>
                <div className="bg-muted rounded-2xl px-4 py-2 text-center min-w-[92px]">
                  <div className="text-[10px] font-extrabold text-muted-foreground tracking-wide">DOCS DONE</div>
                  <div className="text-sm font-extrabold text-foreground">{done}/{total}</div>
                </div>
              </div>
              {pct === 100 && (
                <div className="flex justify-center mt-3">
                  <span className="bg-kipita-green/15 text-kipita-green text-xs font-bold px-3 py-1.5 rounded-full">🧳 Everything's packed — ready to go</span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <p className="font-extrabold text-sm mb-0.5 text-foreground">Before you lock the door</p>
              <p className="text-xs text-muted-foreground mb-3">Kipita suggests these while your trip is close.</p>
              <HorizontalScroller className="flex gap-3 pb-1">
                {REMINDERS.map(rm => {
                  const isDone = !!wallet.reminders[rm.id];
                  return (
                    <div key={rm.id} className={`flex-shrink-0 w-36 bg-card border border-border rounded-kipita p-3.5 ${isDone ? 'opacity-50' : ''}`}>
                      <span className="text-xl">{rm.emoji}</span>
                      <p className={`text-xs font-medium text-foreground mt-2 mb-2.5 ${isDone ? 'line-through' : ''}`}>{rm.text}</p>
                      <button onClick={() => toggleReminder(rm.id)} className="text-[11px] font-extrabold text-kipita-red">{isDone ? 'Undo' : 'Mark done'}</button>
                    </div>
                  );
                })}
              </HorizontalScroller>
            </div>

            <div className="bg-card border border-border rounded-kipita p-4 mb-4">
              <p className="font-extrabold text-sm mb-0.5 text-foreground">Post Office</p>
              <p className="text-xs text-muted-foreground mb-3">Suspend mail while you're away.</p>
              <div className="flex gap-3">
                <label className="flex-1 min-w-0">
                  <span className="block text-[10px] font-extrabold text-muted-foreground tracking-wide mb-1">HOLD STARTING</span>
                  <input type="date" value={wallet.mail.hold} onChange={e => setMail({ hold: e.target.value })}
                    className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2 text-xs outline-none focus:border-kipita-red" />
                </label>
                <label className="flex-1 min-w-0">
                  <span className="block text-[10px] font-extrabold text-muted-foreground tracking-wide mb-1">RESUME ON</span>
                  <input type="date" value={wallet.mail.resume} onChange={e => setMail({ resume: e.target.value })}
                    className="w-full bg-background border border-border rounded-kipita-sm px-3 py-2 text-xs outline-none focus:border-kipita-red" />
                </label>
              </div>
            </div>

            <button onClick={onOpenSafety} className="w-full flex items-center gap-3 bg-card border border-kipita-red/40 rounded-full px-4 py-3 hover:shadow-md transition-shadow active:scale-[0.99]">
              <span className="w-9 h-9 rounded-full bg-kipita-red/10 flex items-center justify-center flex-shrink-0">
                <span className="ms text-kipita-red text-lg">shield</span>
              </span>
              <span className="flex-1 min-w-0 text-left">
                <div className="text-sm font-bold text-foreground truncate">Check destination safety</div>
                <div className="text-xs text-muted-foreground truncate">See the live Safety score for {trip.dest}</div>
              </span>
              <span className="ms text-muted-foreground">chevron_right</span>
            </button>
          </>
        )}

        {tab === 'documents' && (
          <>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setTripType('domestic')} className={pillClass(wallet.tripType === 'domestic')}>Domestic</button>
              <button onClick={() => setTripType('international')} className={pillClass(wallet.tripType === 'international')}>International</button>
            </div>

            {!activeGroup ? (
              <>
                <p className="text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase mb-2">Documents Required</p>
                <div className="grid grid-cols-2 gap-3">
                  {groups.map(g => {
                    const doneCount = g.items.filter(it => wallet.checklist[g.id]?.[it.id]).length;
                    const allDone = doneCount === g.items.length;
                    return (
                      <button key={g.id} onClick={() => setOpenCategory(g.id)}
                        className="bg-card border border-border rounded-kipita p-4 flex flex-col items-center gap-2 text-center hover:shadow-md transition-shadow active:scale-[0.98]">
                        <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: g.bg }}>{g.emoji}</span>
                        <span className="text-sm font-semibold text-foreground">{g.title}</span>
                        <span className={`text-xs font-extrabold ${allDone ? 'text-kipita-green' : 'text-muted-foreground'}`}>{doneCount}/{g.items.length}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <button onClick={() => setOpenCategory(null)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground mb-3 hover:text-foreground transition-colors">
                  <span className="ms text-lg">arrow_back</span> Back
                </button>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: activeGroup.bg }}>{activeGroup.emoji}</span>
                  <p className="font-extrabold text-base text-foreground">{activeGroup.title}</p>
                </div>
                <div className="space-y-2">
                  {activeGroup.items.map(it => {
                    const checked = !!wallet.checklist[activeGroup.id]?.[it.id];
                    return (
                      <button key={it.id} onClick={() => toggleItem(activeGroup.id, it.id)}
                        className="w-full flex items-center gap-3 bg-card border border-border rounded-kipita px-4 py-3 text-left hover:shadow-sm transition-shadow">
                        <span className={`ms text-xl ${checked ? 'text-kipita-green' : 'text-muted-foreground'}`}>{checked ? 'check_circle' : 'radio_button_unchecked'}</span>
                        <span className={`text-sm text-foreground ${checked ? 'line-through text-muted-foreground' : ''}`}>{it.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'storage' && (
          <>
            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
              {(Object.entries(KIND_META) as [StorageKind, typeof KIND_META[StorageKind]][]).map(([k, m]) => (
                <button key={k} onClick={() => setStorageKind(k)} className={`flex-shrink-0 ${pillClass(storageKind === k)}`}>
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>

            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-kipita px-4 py-4 mb-4 text-sm font-bold text-muted-foreground cursor-pointer relative overflow-hidden hover:border-kipita-red/50 transition-colors">
              <input type="file" multiple accept={KIND_META[storageKind].accept} onChange={e => handleFiles(e.target.files)}
                className="absolute inset-0 opacity-0 cursor-pointer" />
              <span className="ms text-lg">add</span> Add {KIND_META[storageKind].label.toLowerCase()}
            </label>

            {items.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">Nothing added yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {items.map(item => (
                  <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border flex items-center justify-center">
                    {storageKind === 'pictures' && <img src={item.data} alt={item.name} className="w-full h-full object-cover" />}
                    {storageKind === 'videos' && <video src={item.data} muted className="w-full h-full object-cover" />}
                    {storageKind === 'pdfs' && <span className="text-3xl">📄</span>}
                    <button onClick={() => removeStorageItem(item.id)} aria-label="Remove"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center">
                      <span className="ms text-white text-xs">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'settings' && (
          <>
            <div className="bg-card border border-border rounded-kipita p-4 mb-4">
              <p className="font-extrabold text-sm mb-3 text-foreground">Trip type</p>
              <div className="flex gap-2">
                <button onClick={() => setTripType('domestic')} className={pillClass(wallet.tripType === 'domestic')}>Domestic</button>
                <button onClick={() => setTripType('international')} className={pillClass(wallet.tripType === 'international')}>International</button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-kipita p-4 mb-4">
              <p className="font-extrabold text-sm mb-3 text-foreground">Trip</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Destination</span>
                  <div className="font-bold text-foreground mt-0.5">{trip.dest}{trip.country ? `, ${trip.country}` : ''}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Departure</span>
                  <div className="font-bold text-foreground mt-0.5">{departure ? new Date(departure).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">Edit destination or dates from the trip's edit (pencil) button.</p>
            </div>

            <div className="bg-card border border-border rounded-kipita p-4 mb-4 flex items-center gap-2.5">
              <span className="ms text-lg text-muted-foreground">lock</span>
              <span className="text-xs text-muted-foreground">PIN lock reuses your Kipita account credentials.</span>
            </div>

            <button onClick={resetWallet} className="w-full text-center py-2 text-xs font-extrabold text-kipita-red">
              Reset Travel Wallet data for this trip
            </button>
          </>
        )}
      </div>
    </div>
  );
}
