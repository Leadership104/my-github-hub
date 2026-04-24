interface Props {
  onBack: () => void;
}

const UPSIDE_URL = 'https://upside.com/';
const UPSIDE_APP_STORE = 'https://apps.apple.com/us/app/upside-cash-back-deals/id1099584682';
const UPSIDE_PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.endorlabs.GetUpside';

export default function FuelScreen({ onBack }: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <span className="ms text-xl text-foreground">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">⛽ Fuel & Cash Back</h1>
          <p className="text-xs text-muted-foreground">Earn cash back every time you fill up</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-md mx-auto">
          {/* Hero */}
          <div className="glass rounded-kipita p-6 text-center mb-4">
            <div className="text-6xl mb-3">⛽</div>
            <h2 className="text-xl font-extrabold text-foreground mb-1">Cash Back on Fuel</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Powered by Upside — earn up to 25¢/gallon at thousands of gas stations near you.
            </p>
            <a
              href={UPSIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-3d inline-flex items-center justify-center gap-2 w-full bg-kipita-red text-white font-bold py-3 rounded-full"
            >
              <span className="ms text-base">open_in_new</span>
              Open Upside in Browser
            </a>
          </div>

          {/* App download */}
          <div className="glass rounded-kipita-sm p-4 mb-4">
            <p className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider">Get the Upside app</p>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={UPSIDE_APP_STORE}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-3d flex items-center justify-center gap-2 bg-kipita-navy text-white py-2.5 rounded-full text-xs font-semibold"
              >
                <span className="text-base"></span>
                App Store
              </a>
              <a
                href={UPSIDE_PLAY_STORE}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-3d flex items-center justify-center gap-2 bg-kipita-navy text-white py-2.5 rounded-full text-xs font-semibold"
              >
                <span className="ms text-base">android</span>
                Google Play
              </a>
            </div>
          </div>

          {/* How it works */}
          <div className="glass rounded-kipita-sm p-4">
            <p className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider">How it works</p>
            <ol className="space-y-2 text-sm text-foreground">
              <li className="flex gap-2"><span className="font-bold text-kipita-red">1.</span> Claim an offer at a nearby gas station</li>
              <li className="flex gap-2"><span className="font-bold text-kipita-red">2.</span> Fill up and pay with any card</li>
              <li className="flex gap-2"><span className="font-bold text-kipita-red">3.</span> Snap a photo of your receipt</li>
              <li className="flex gap-2"><span className="font-bold text-kipita-red">4.</span> Get cash back deposited to your account</li>
            </ol>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-4">
            Upside doesn't allow embedded preview. Tap above to open in your browser or app.
          </p>
        </div>
      </div>
    </div>
  );
}
