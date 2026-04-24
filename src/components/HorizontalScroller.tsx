import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

/**
 * Horizontal scroll container that:
 * - Converts vertical mouse-wheel into horizontal scroll (desktop trackpads/mice)
 * - Supports click-and-drag panning with the mouse
 * - Keeps native touch swipe on mobile
 */
export default function HorizontalScroller({ children, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // If user is scrolling vertically and there's horizontal overflow, redirect.
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    let isDown = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    const onDown = (e: MouseEvent) => {
      isDown = true;
      moved = false;
      startX = e.pageX;
      startScroll = el.scrollLeft;
      el.style.cursor = 'grabbing';
    };
    const onMove = (e: MouseEvent) => {
      if (!isDown) return;
      const dx = e.pageX - startX;
      if (Math.abs(dx) > 4) moved = true;
      el.scrollLeft = startScroll - dx;
    };
    const onUp = (e: MouseEvent) => {
      isDown = false;
      el.style.cursor = '';
      // If user dragged, swallow the click that follows so chips don't trigger.
      if (moved) {
        const stop = (ev: Event) => {
          ev.stopPropagation();
          ev.preventDefault();
          el.removeEventListener('click', stop, true);
        };
        el.addEventListener('click', stop, true);
      }
    };
    const onLeave = () => {
      isDown = false;
      el.style.cursor = '';
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousedown', onDown);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseup', onUp);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseup', onUp);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`overflow-x-auto overflow-y-hidden scrollbar-hide cursor-grab select-none ${className}`}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {children}
    </div>
  );
}
