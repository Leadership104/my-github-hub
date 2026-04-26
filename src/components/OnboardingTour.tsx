import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface TourStep {
  /** data-tour attribute value of the element to highlight */
  target: string;
  /** Short, single-sentence explanation */
  tip: string;
  /** Optional title above the tip */
  title?: string;
  /** Where to place the tooltip relative to the target. Default: 'bottom'. */
  placement?: 'top' | 'bottom';
}

interface Props {
  /** Stable id for this tour (e.g. 'home', 'ai', 'trips', 'places'). Persisted in localStorage. */
  tourId: string;
  steps: TourStep[];
  /** Called when the tour finishes or is skipped. */
  onClose?: () => void;
}

const storageKey = (id: string) => `kip_tour_${id}_done`;

export function hasSeenTour(id: string): boolean {
  try { return localStorage.getItem(storageKey(id)) === '1'; } catch { return false; }
}

export function markTourSeen(id: string) {
  try { localStorage.setItem(storageKey(id), '1'); } catch { /* noop */ }
}

/** Reset all tours so they replay on next visit. Useful for "Replay tour" debug. */
export function resetAllTours() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('kip_tour_') && k.endsWith('_done'))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* noop */ }
}

/**
 * Spotlight onboarding tour. Renders a full-screen dim overlay with a circular
 * cutout around each step's target element + a one-sentence tip card.
 * Persists completion in localStorage so each tour only runs once per device.
 */
export default function OnboardingTour({ tourId, steps, onClose }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vp, setVp] = useState({ w: typeof window !== 'undefined' ? window.innerWidth : 0, h: typeof window !== 'undefined' ? window.innerHeight : 0 });
  const targetRef = useRef<HTMLElement | null>(null);

  const step = steps[stepIdx];

  // Find the target element + measure it (re-measure on resize / scroll).
  useLayoutEffect(() => {
    if (!step) return;
    let raf = 0;
    let attempts = 0;
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        targetRef.current = el;
        // Make sure the target is in view
        try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* noop */ }
        // Wait one frame for scroll, then measure
        raf = requestAnimationFrame(() => setRect(el.getBoundingClientRect()));
      } else if (attempts < 20) {
        // The screen may still be mounting — retry briefly
        attempts++;
        raf = requestAnimationFrame(find);
      } else {
        // Target missing — skip this step gracefully
        next();
      }
    };
    find();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, step?.target]);

  useEffect(() => {
    const onResize = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight });
      if (targetRef.current) setRect(targetRef.current.getBoundingClientRect());
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, []);

  const finish = () => {
    markTourSeen(tourId);
    onClose?.();
  };

  const skip = () => finish();

  const next = () => {
    if (stepIdx >= steps.length - 1) finish();
    else setStepIdx(i => i + 1);
  };

  if (!step) return null;

  // Compute spotlight circle around the target
  const padding = 10;
  const cx = rect ? rect.left + rect.width / 2 : vp.w / 2;
  const cy = rect ? rect.top + rect.height / 2 : vp.h / 2;
  const radius = rect
    ? Math.max(rect.width, rect.height) / 2 + padding
    : 60;

  // Tooltip placement — auto if not set
  const placement: 'top' | 'bottom' =
    step.placement || (cy + radius + 180 < vp.h ? 'bottom' : 'top');
  const tooltipTop = placement === 'bottom' ? cy + radius + 16 : Math.max(16, cy - radius - 200);

  return (
    <div className="fixed inset-0 z-[9000] pointer-events-none" aria-live="polite">
      {/* Dim overlay with circular cutout */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        width={vp.w}
        height={vp.h}
        onClick={next}
      >
        <defs>
          <mask id={`tour-mask-${tourId}`}>
            <rect width="100%" height="100%" fill="white" />
            {rect && <circle cx={cx} cy={cy} r={radius} fill="black" />}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.65)"
          mask={`url(#tour-mask-${tourId})`}
        />
        {/* Highlight ring */}
        {rect && (
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="hsl(var(--kipita-red, 0 84% 55%))"
            strokeWidth={3}
            style={{ filter: 'drop-shadow(0 0 12px rgba(225, 29, 72, 0.6))' }}
          />
        )}
      </svg>

      {/* Tooltip card */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[min(92vw,360px)] pointer-events-auto"
        style={{ top: tooltipTop }}
      >
        <div className="bg-white text-black rounded-2xl shadow-2xl p-4 border-2 border-kipita-red">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold tracking-widest text-kipita-red">
              QUICK TIP {stepIdx + 1} OF {steps.length}
            </span>
            <button
              onClick={skip}
              className="text-[11px] font-bold text-black/50 hover:text-black underline"
            >
              Skip
            </button>
          </div>
          {step.title && (
            <h4 className="text-base font-extrabold mb-1">{step.title}</h4>
          )}
          <p className="text-sm leading-snug text-black/80">{step.tip}</p>
          <div className="flex items-center justify-between mt-3 gap-2">
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === stepIdx ? 'w-6 bg-kipita-red' : 'w-1.5 bg-black/20'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="bg-kipita-red text-white text-xs font-extrabold px-4 py-2 rounded-full hover:bg-kipita-red/90 transition-colors"
            >
              {stepIdx >= steps.length - 1 ? 'Got it' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
