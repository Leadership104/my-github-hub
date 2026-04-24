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
export default function InAppBrowser({ url, title, onClose }: Props) {
  const [blocked, setBlocked] = useState(false);

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
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <span className="text-4xl mb-3">🔒</span>
            <p className="text-sm font-bold mb-1">This site can't be embedded</p>
            <p className="text-xs text-muted-foreground mb-4">Open it in a new tab to continue.</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-kipita-red text-white rounded-full text-xs font-bold no-underline"
            >
              Open in new tab
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
