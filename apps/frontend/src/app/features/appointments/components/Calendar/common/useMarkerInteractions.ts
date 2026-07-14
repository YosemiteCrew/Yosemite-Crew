import { useEffect, useMemo, useRef, useState } from 'react';
import { Appointment } from '@yosemite-crew/types';

const MARKER_CLICK_DELAY_MS = 180;

export type MarkerContextMenuState = {
  appointment: Appointment;
  x: number;
  y: number;
};

const swallowNextClick = () => {
  const handleClickCapture = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if ('stopImmediatePropagation' in event) {
      event.stopImmediatePropagation();
    }
    globalThis.removeEventListener('click', handleClickCapture, true);
  };
  globalThis.addEventListener('click', handleClickCapture, true);
};

type UseMarkerInteractionsArgs = {
  handleOpenPopover: (
    key: string,
    target: HTMLButtonElement,
    clientX?: number,
    clientY?: number
  ) => void;
  setActivePopoverKey: (key: string | null) => void;
  /** Invoked on marker double-click after pending click/menu/popover state is cleared. */
  onMarkerDoubleClick: (appointment: Appointment) => void;
  /** Optional selector whose ancestors are exempt from the outside-click dismiss. */
  dismissIgnoreSelector?: string;
};

/**
 * Owns the marker click/double-click/context-menu interaction handling shared by
 * the day-calendar and slot markers — the click-vs-doubleclick delay timer, and
 * the right-click context menu's open/dismiss lifecycle (outside click, scroll,
 * resize, Escape).
 */
export function useMarkerInteractions({
  handleOpenPopover,
  setActivePopoverKey,
  onMarkerDoubleClick,
  dismissIgnoreSelector,
}: UseMarkerInteractionsArgs) {
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const [contextMenu, setContextMenu] = useState<MarkerContextMenuState | null>(null);

  useEffect(
    () => () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!contextMenu) return;

    const closeContextMenu = () => setContextMenu(null);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (contextMenuRef.current?.contains(target)) return;
      if (dismissIgnoreSelector && (target as Element | null)?.closest(dismissIgnoreSelector)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if ('stopImmediatePropagation' in event) {
        event.stopImmediatePropagation();
      }
      swallowNextClick();
      setContextMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    globalThis.addEventListener('pointerdown', handlePointerDown, true);
    globalThis.addEventListener('scroll', closeContextMenu, true);
    globalThis.addEventListener('resize', closeContextMenu);
    globalThis.addEventListener('keydown', handleKeyDown);

    return () => {
      globalThis.removeEventListener('pointerdown', handlePointerDown, true);
      globalThis.removeEventListener('scroll', closeContextMenu, true);
      globalThis.removeEventListener('resize', closeContextMenu);
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, dismissIgnoreSelector]);

  const contextMenuStyle = useMemo(() => {
    if (!contextMenu) return null;
    const width = 280;
    const height = 420;
    const margin = 12;
    const left = Math.max(margin, Math.min(contextMenu.x, globalThis.innerWidth - width - margin));
    const top = Math.max(margin, Math.min(contextMenu.y, globalThis.innerHeight - height - margin));
    return { left, top, width };
  }, [contextMenu]);

  const clearPendingMarkerClick = () => {
    if (!clickTimerRef.current) return;
    clearTimeout(clickTimerRef.current);
    clickTimerRef.current = null;
  };

  const handleMarkerClick = (event: React.MouseEvent<HTMLButtonElement>, key: string) => {
    const target = event.currentTarget;
    const { clientX, clientY } = event;
    clearPendingMarkerClick();
    setContextMenu(null);
    clickTimerRef.current = setTimeout(() => {
      handleOpenPopover(key, target, clientX, clientY);
      clickTimerRef.current = null;
    }, MARKER_CLICK_DELAY_MS);
  };

  const handleMarkerDoubleClick = (appointment: Appointment) => {
    clearPendingMarkerClick();
    setContextMenu(null);
    setActivePopoverKey(null);
    onMarkerDoubleClick(appointment);
  };

  const handleMarkerContextMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    appointment: Appointment
  ) => {
    event.preventDefault();
    clearPendingMarkerClick();
    setActivePopoverKey(null);
    setContextMenu({
      appointment,
      x: event.clientX,
      y: event.clientY,
    });
  };

  return {
    contextMenuRef,
    contextMenu,
    setContextMenu,
    contextMenuStyle,
    handleMarkerClick,
    handleMarkerDoubleClick,
    handleMarkerContextMenu,
  };
}
