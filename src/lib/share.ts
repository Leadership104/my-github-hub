export interface ShareablePlace {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
}

function buildMapsLink(p: ShareablePlace): string {
  if (p.mapsUrl) return p.mapsUrl;
  if (typeof p.lat === 'number' && typeof p.lng === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
  }
  const q = encodeURIComponent(`${p.name ?? ''} ${p.address ?? ''}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/**
 * Share a place via the native share sheet, falling back to copying to the
 * clipboard. Returns a short status the caller can surface as a toast.
 */
export async function sharePlace(p: ShareablePlace): Promise<'shared' | 'copied' | 'failed'> {
  const url = buildMapsLink(p);
  const title = p.name || 'Shared place';
  const text = [p.name, p.address].filter(Boolean).join(' — ');
  const payload = { title, text: text || title, url };

  try {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (typeof nav.share === 'function') {
      await nav.share(payload);
      return 'shared';
    }
  } catch (err) {
    // User cancelled or share failed; fall through to clipboard.
    if ((err as DOMException)?.name === 'AbortError') return 'failed';
  }

  try {
    const full = `${title}${text && text !== title ? ` — ${p.address ?? ''}` : ''}\n${url}`;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(full);
      return 'copied';
    }
  } catch {
    /* ignore */
  }
  return 'failed';
}
