interface Props {
  onBack: () => void;
}

const UPSIDE_URL = 'https://upside.com/';

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
          <p className="text-xs text-muted-foreground">Powered by Upside — earn on every fill-up</p>
        </div>
        <a
          href={UPSIDE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-kipita-red font-semibold px-2 py-1 rounded-full hover:bg-kipita-red/10 transition-colors flex items-center gap-1"
        >
          <span className="ms text-sm">open_in_new</span>
          Open
        </a>
      </div>

      {/* Embedded Upside */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src={UPSIDE_URL}
          className="w-full h-full border-none"
          title="Upside – Cash Back on Fuel, Food & Groceries"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
}
