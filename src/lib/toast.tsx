import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const EVENT = 'kip:toast';

export function notify(message: string) {
  if (!message) return;
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const handler = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail;
      setMessage(msg);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(null), 1800);
    };
    window.addEventListener(EVENT, handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      if (timer) window.clearTimeout(timer);
    };
  }, []);
  if (!message || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] bg-foreground text-background text-xs font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-none">
      {message}
    </div>,
    document.body
  );
}
