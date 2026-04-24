import { useState } from 'react';

interface Props {
  url: string;
  title?: string;
  onClose: () => void;
}

/**
 * In-app browser modal. Keeps users inside Kipita when visiting affiliate links
 * with a clear back button instead of opening a new tab.
 *
 * Note: Many partner sites block being embedded via iframe (X-Frame-Options).
 * We provide a fallback "Open in new tab" button for those cases.
 */
const EXTERNAL_ONLY_HOSTS = ['upside.com', 'expedia.com', 'hotels.com', 'apple.com', 'play.google.com'];
const isExternalOnly = (url: string) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return EXTERNAL_ONLY_HOSTS.some(h => host === h || host.endsWith('.' + h));
  } catch { return false; }
};

export default function InAppBrowser({ url, title, onClose }: Props) {
  const [blocked, setBlocked] = useState(isExternalOnly(url));

  return (
    <div className="fixed inset-0 z-[400] flex flex-col bg-background">
      {/* Header with back button */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border bg-card flex-shrink-0">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"
          aria-label="Back"
        >
          <span className="ms text-xl text-foreground">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">{title || 'Browse'}</div>
          <div className="text-[10px] text-muted-foreground truncate">{url}</div>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"
          aria-label="Open in new tab"
          title="Open in new tab"
        >
          <span className="ms text-xl text-muted-foreground">open_in_new</span>
        </a>
      </div>

      {/* Embedded site */}
      <div className="flex-1 relative bg-muted">
        {!blocked ? (
          <iframe
            src={url}
            title={title || 'Affiliate'}
            className="w-full h-full border-0 bg-white"
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={(e) => {
              // Heuristic: sites blocking iframe show blank doc
              try {
                const doc = (e.target as HTMLIFrameElement).contentDocument;
                if (doc && doc.body && doc.body.children.length === 0) setBlocked(true);
              } catch {
                // cross-origin (expected) — don't mark blocked
              }
            }}
            onError={() => setBlocked(true)}
          />
        ) : (
          <div className="absolute inset-0 overflow-y-auto bg-background">
            <div className="max-w-md mx-auto px-5 py-8">
              <div className="glass rounded-kipita p-6 text-center">
                <div className="text-5xl mb-3">🤝</div>
                <p className="text-base font-extrabold text-foreground mb-1">{title || 'Partner'}</p>
                <p className="text-xs text-muted-foreground mb-5 break-all">{url}</p>
                <p className="text-sm text-foreground mb-5 leading-relaxed">
                  This partner doesn't allow being shown inside other apps for security reasons.
                  Tap below to continue with your Kipita perk — you can come right back.
                </p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-3d inline-flex items-center justify-center gap-2 w-full bg-kipita-red text-white font-bold py-3 rounded-full no-underline"
                >
                  <span className="ms text-base">open_in_new</span>
                  Continue to {title || 'partner'}
                </a>
                <button
                  onClick={onClose}
                  className="mt-3 w-full text-xs text-muted-foreground font-semibold py-2"
                >
                  ← Stay in Kipita
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
