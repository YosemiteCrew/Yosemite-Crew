import { useCallback, useEffect, useRef, useState } from 'react';

type PopoverManagerOptions = {
  closeOnHoverLeave?: boolean;
};

export type PopoverManagerReturn = {
  activePopoverKey: string | null;
  setActivePopoverKey: React.Dispatch<React.SetStateAction<string | null>>;
  activeRect: DOMRect | null;
  setActiveRect: React.Dispatch<React.SetStateAction<DOMRect | null>>;
  activeCursor: { x: number; y: number } | null;
  setActiveCursor: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  popoverDialogRef: React.RefObject<HTMLDialogElement | null>;
  clearCloseTimer: () => void;
  schedulePopoverClose: () => void;
  registerAnchorEl: (el: HTMLElement | null) => () => void;
  openPopover: (
    key: string,
    target: HTMLButtonElement,
    draggedId?: string | null,
    clientX?: number,
    clientY?: number
  ) => void;
  getPopoverStyle: (
    popoverWidth: number,
    popoverHeight: number
  ) => { top: number; left: number; width: number };
};

export const usePopoverManager = ({
  closeOnHoverLeave = true,
}: PopoverManagerOptions = {}): PopoverManagerReturn => {
  const [activePopoverKey, setActivePopoverKey] = useState<string | null>(null);
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [activeCursor, setActiveCursor] = useState<{ x: number; y: number } | null>(null);
  const popoverDialogRef = useRef<HTMLDialogElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const swallowDismissClick = useCallback(() => {
    const handleClickCapture = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if ('stopImmediatePropagation' in event) {
        event.stopImmediatePropagation();
      }
      globalThis.removeEventListener('click', handleClickCapture, true);
    };

    globalThis.addEventListener('click', handleClickCapture, true);
  }, []);

  useEffect(() => {
    if (!activePopoverKey) return;
    const closePopover = () => setActivePopoverKey(null);
    const closePopoverOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (popoverDialogRef.current?.contains(target)) return;
      if ((target as Element | null)?.closest?.('[data-popover-panel]')) return;
      event.preventDefault();
      event.stopPropagation();
      if ('stopImmediatePropagation' in event) {
        event.stopImmediatePropagation();
      }
      swallowDismissClick();
      setActivePopoverKey(null);
    };
    globalThis.addEventListener('scroll', closePopover, true);
    globalThis.addEventListener('resize', closePopover);
    globalThis.addEventListener('pointerdown', closePopoverOnOutsidePointer, true);
    return () => {
      globalThis.removeEventListener('scroll', closePopover, true);
      globalThis.removeEventListener('resize', closePopover);
      globalThis.removeEventListener('pointerdown', closePopoverOnOutsidePointer, true);
    };
  }, [activePopoverKey, swallowDismissClick]);

  const registerAnchorEl = useCallback(
    (el: HTMLElement | null): (() => void) => {
      if (!el) return () => {};
      const onEnter = () => {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }
      };
      const onLeave = () => {
        if (!closeOnHoverLeave) return;
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => setActivePopoverKey(null), 120);
      };
      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
      return () => {
        el.removeEventListener('mouseenter', onEnter);
        el.removeEventListener('mouseleave', onLeave);
      };
    },
    [closeOnHoverLeave]
  );

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const schedulePopoverClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setActivePopoverKey(null);
    }, 120);
  }, [clearCloseTimer]);

  useEffect(() => {
    const dialogEl = popoverDialogRef.current;
    if (!dialogEl || !activePopoverKey) return;

    const onMouseEnter = () => clearCloseTimer();
    const onMouseLeave = () => {
      if (!closeOnHoverLeave) return;
      schedulePopoverClose();
    };
    const onFocusIn = () => clearCloseTimer();
    const onFocusOut = (event: FocusEvent) => {
      const nextFocused = event.relatedTarget as Node | null;
      if (!nextFocused || !dialogEl.contains(nextFocused)) {
        schedulePopoverClose();
      }
    };
    const onTouchStart = () => clearCloseTimer();
    const onTouchEnd = () => schedulePopoverClose();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePopoverKey(null);
      }
    };

    dialogEl.addEventListener('mouseenter', onMouseEnter);
    dialogEl.addEventListener('mouseleave', onMouseLeave);
    dialogEl.addEventListener('focusin', onFocusIn);
    dialogEl.addEventListener('focusout', onFocusOut);
    dialogEl.addEventListener('touchstart', onTouchStart, { passive: true });
    dialogEl.addEventListener('touchend', onTouchEnd, { passive: true });
    dialogEl.addEventListener('keydown', onKeyDown);

    return () => {
      dialogEl.removeEventListener('mouseenter', onMouseEnter);
      dialogEl.removeEventListener('mouseleave', onMouseLeave);
      dialogEl.removeEventListener('focusin', onFocusIn);
      dialogEl.removeEventListener('focusout', onFocusOut);
      dialogEl.removeEventListener('touchstart', onTouchStart);
      dialogEl.removeEventListener('touchend', onTouchEnd);
      dialogEl.removeEventListener('keydown', onKeyDown);
    };
  }, [activePopoverKey, clearCloseTimer, closeOnHoverLeave, schedulePopoverClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearCloseTimer();
      }
    };
  }, [clearCloseTimer]);

  const openPopover = useCallback(
    (
      key: string,
      target: HTMLButtonElement,
      draggedId?: string | null,
      clientX?: number,
      clientY?: number
    ) => {
      if (draggedId) return;
      clearCloseTimer();
      setActiveRect(target.getBoundingClientRect());
      if (typeof clientX === 'number' && typeof clientY === 'number') {
        setActiveCursor({ x: clientX, y: clientY });
      } else {
        setActiveCursor(null);
      }
      setActivePopoverKey(key);
    },
    [clearCloseTimer]
  );

  const getPopoverStyle = useCallback(
    (popoverWidth: number, popoverHeight: number) => {
      if (!activeRect) return { top: 0, left: 0, width: popoverWidth };
      const margin = 8;
      const viewportWidth = globalThis.innerWidth;
      const viewportHeight = globalThis.innerHeight;
      const anchorX = activeCursor?.x ?? activeRect.left + activeRect.width / 2;
      const anchorY = activeCursor?.y ?? activeRect.top;
      const availableRight = viewportWidth - anchorX - margin;
      const availableLeft = anchorX - margin;
      const shouldPlaceRight = availableRight >= popoverWidth || availableRight >= availableLeft;
      const preferredLeft = shouldPlaceRight ? anchorX + margin : anchorX - popoverWidth - margin;
      const left = Math.max(margin, Math.min(preferredLeft, viewportWidth - popoverWidth - margin));
      const placeAbove = anchorY + popoverHeight + margin > viewportHeight;
      const top = placeAbove
        ? Math.max(margin, anchorY - popoverHeight - margin)
        : Math.max(margin, anchorY);
      return { top, left, width: popoverWidth };
    },
    [activeRect, activeCursor]
  );

  return {
    activePopoverKey,
    setActivePopoverKey,
    activeRect,
    setActiveRect,
    activeCursor,
    setActiveCursor,
    popoverDialogRef,
    clearCloseTimer,
    schedulePopoverClose,
    registerAnchorEl,
    openPopover,
    getPopoverStyle,
  };
};
