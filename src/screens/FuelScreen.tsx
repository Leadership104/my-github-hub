import type { TabId } from '../types';

interface Props {
  onBack: () => void;
  onSwitchTab: (tab: TabId, hint?: string) => void;
}

const UPSIDE_URL = 'https://upside.com/';
const UPSIDE_APP_STORE = 'https://apps.apple.com/us/app/upside-cash-back-deals/id1099584682';
const UPSIDE_PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.endorlabs.GetUpside';

export default function FuelScreen({ onBack, onSwitchTab }: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden screen-enter">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <span className="ms text-xl text-foreground">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">⛽ Gas / EV</h1>
          <p className="text-xs text-muted-foreground">Find stations & earn cash back</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-md mx-auto space-y-3 stagger">

          {/* Gas Stations */}
          <button
            onClick={() => onSwitchTab('maps', 'gas')}
            className="btn-outline-3d w-full flex items-center gap-4 p-5 rounded-2xl"
            style={{ borderColor: '#DD3B49' }}
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'hsl(355 71% 55% / 0.10)' }}>
              <span className="text-4xl leading-none">⛽</span>
            </div>
            <div className="text-left flex-1">
              <div className="font-extrabold text-lg leading-tight" style={{ color: '#DD3B49' }}>Gas Stations</div>
              <div className="text-xs text-muted-foreground mt-0.5">Find nearest gas stations on the map</div>
            </div>
            <span className="ms text-2xl text-muted-foreground">chevron_right</span>
          </button>

          {/* EV Charging */}
          <button
            onClick={() => onSwitchTab('maps', 'ev')}
            className="btn-outline-3d w-full flex items-center gap-4 p-5 rounded-2xl"
            style={{ borderColor: '#38A169' }}
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'hsl(142 71% 45% / 0.10)' }}>
              <span className="text-4xl leading-none">⚡</span>
            </div>
            <div className="text-left flex-1">
              <div className="font-extrabold text-lg leading-tight" style={{ color: '#38A169' }}>EV Charging</div>
              <div className="text-xs text-muted-foreground mt-0.5">Find nearest EV chargers on the map</div>
            </div>
            <span className="ms text-2xl text-muted-foreground">chevron_right</span>
          </button>

          {/* Upside */}
          <a
            href={UPSIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline-3d w-full flex items-center gap-4 p-5 rounded-2xl"
            style={{ borderColor: '#D97706' }}
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'hsl(38 92% 50% / 0.10)' }}>
              <span className="text-4xl leading-none">💰</span>
            </div>
            <div className="text-left flex-1">
              <div className="font-extrabold text-lg leading-tight" style={{ color: '#D97706' }}>Upside</div>
              <div className="text-xs text-muted-foreground mt-0.5">Earn up to 25¢/gallon cash back</div>
            </div>
            <span className="ms text-2xl text-muted-foreground">open_in_new</span>
          </a>

          {/* Upside app download */}
          <div className="glass rounded-kipita-sm p-4 mt-2">
            <p className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider">Get the Upside app</p>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={UPSIDE_APP_STORE}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline-3d flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-semibold"
                style={{ borderColor: '#1e3a5f', color: '#1e3a5f' }}
              >
                <span className="text-base"></span>
                App Store
              </a>
              <a
                href={UPSIDE_PLAY_STORE}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline-3d flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-semibold"
                style={{ borderColor: '#1e3a5f', color: '#1e3a5f' }}
              >
                <span className="ms text-base">android</span>
                Google Play
              </a>
            </div>
          </div>

          {/* How it works */}
          <div className="glass rounded-kipita-sm p-4">
            <p className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider">How Upside works</p>
            <ol className="space-y-2 text-sm text-foreground">
              <li className="flex gap-2"><span className="font-bold text-kipita-red">1.</span> Claim an offer at a nearby gas station</li>
              <li className="flex gap-2"><span className="font-bold text-kipita-red">2.</span> Fill up and pay with any card</li>
              <li className="flex gap-2"><span className="font-bold text-kipita-red">3.</span> Snap a photo of your receipt</li>
              <li className="flex gap-2"><span className="font-bold text-kipita-red">4.</span> Get cash back deposited to your account</li>
            </ol>
          </div>

          <p className="text-[10px] text-muted-foreground text-center pb-2">
            Upside doesn't allow embedded preview. Tap above to open in your browser or app.
          </p>
        </div>
      </div>
    </div>
  );
}
