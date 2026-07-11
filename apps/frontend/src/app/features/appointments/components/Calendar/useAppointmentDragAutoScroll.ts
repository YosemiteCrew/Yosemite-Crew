import { useCallback, useEffect, useRef, useState } from 'react';

export const useDragAutoScrollSuppression = () => {
  const [suppressAutoScroll, setSuppressAutoScroll] = useState(false);
  const suppressAutoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markDropped = useCallback(() => {
    if (suppressAutoScrollTimerRef.current) clearTimeout(suppressAutoScrollTimerRef.current);
    setSuppressAutoScroll(true);
    suppressAutoScrollTimerRef.current = setTimeout(() => setSuppressAutoScroll(false), 4000);
  }, []);

  return { markDropped, suppressAutoScroll };
};

export const useAppointmentDragAutoScroll = (
  draggedAppointmentId: string | null,
  availabilityVersion: number
) => {
  useEffect(() => {
    if (!draggedAppointmentId) return;
    const edgeThreshold = 72;
    const scrollAmount = 28;
    const handleDragOver = (event: DragEvent) => {
      const x = event.clientX;
      const y = event.clientY;
      const viewportWidth = globalThis.innerWidth;
      const viewportHeight = globalThis.innerHeight;

      if (x >= 0 && x < edgeThreshold) {
        globalThis.scrollBy({ left: -scrollAmount });
      } else if (x > viewportWidth - edgeThreshold) {
        globalThis.scrollBy({ left: scrollAmount });
      }
      if (y >= 0 && y < edgeThreshold) {
        globalThis.scrollBy({ top: -scrollAmount });
      } else if (y > viewportHeight - edgeThreshold) {
        globalThis.scrollBy({ top: scrollAmount });
      }

      const hoveredElement = document.elementFromPoint(x, y) as HTMLElement | null;
      const scrollContainer = hoveredElement?.closest?.(
        "[data-calendar-scroll='true']"
      ) as HTMLElement | null;
      if (!scrollContainer) return;
      const rect = scrollContainer.getBoundingClientRect();
      let deltaX = 0;
      let deltaY = 0;
      if (x - rect.left < edgeThreshold) deltaX = -scrollAmount;
      else if (rect.right - x < edgeThreshold) deltaX = scrollAmount;
      if (y - rect.top < edgeThreshold) deltaY = -scrollAmount;
      else if (rect.bottom - y < edgeThreshold) deltaY = scrollAmount;
      if (deltaX !== 0 || deltaY !== 0) scrollContainer.scrollBy({ left: deltaX, top: deltaY });
    };

    globalThis.addEventListener('dragover', handleDragOver);
    return () => globalThis.removeEventListener('dragover', handleDragOver);
  }, [draggedAppointmentId, availabilityVersion]);
};
