import { useEffect, useMemo, useRef, useState } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';

const MARKER_CLICK_DELAY_MS = 180;

type ContextMenuState = {
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

type UseDayCalendarMarkerInteractionsArgs = {
  handleOpenPopover: (
    key: string,
    target: HTMLButtonElement,
    clientX?: number,
    clientY?: number
  ) => void;
  setActivePopoverKey: (key: string | null) => void;
  handleOpenWorkspace?: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  handleDetailAppointment: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
};

/**
 * Extracted from DayCalendar: owns the marker click/double-click/context-menu
 * interaction handling — the click-vs-doubleclick delay timer, and the
 * right-click context menu's open/dismiss lifecycle (outside click, scroll,
 * resize, Escape). Pure structural extraction, behavior unchanged.
 */
export function useDayCalendarMarkerInteractions({
  handleOpenPopover,
  setActivePopoverKey,
  handleOpenWorkspace,
  handleDetailAppointment,
}: UseDayCalendarMarkerInteractionsArgs) {
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

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
  }, [contextMenu]);

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
    if (handleOpenWorkspace) handleOpenWorkspace(appointment);
    else handleDetailAppointment(appointment);
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
