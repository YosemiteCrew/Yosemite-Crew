import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './GlassTooltip.css';

type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

type GlassTooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: TooltipSide;
  className?: string;
  maxWidth?: number | string;
  /** Also toggle open on tap. Hover and focus have no touch equivalent, so a
   * trigger whose only affordance is `content` (e.g. the full value behind a
   * truncated label) is otherwise unreachable on a touchscreen. Off by
   * default: a trigger with its own click behavior (navigation, a button
   * action) would have that first tap swallowed by the tooltip opening
   * instead - review each call site before opting in. */
  openOnClick?: boolean;
};

const GlassTooltip = ({
  content,
  children,
  side = 'top',
  className = '',
  maxWidth,
  openOnClick = false,
}: GlassTooltipProps) => {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const mounted = typeof document !== 'undefined';
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    transform: 'translate(-50%, -100%)',
  });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;

    const rect = trigger.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const gap = 10;
    const viewportPadding = 8;

    let top = 0;
    let left = 0;
    const transformBySide: Record<TooltipSide, string> = {
      top: 'translate(-50%, -100%)',
      right: 'translate(0, -50%)',
      bottom: 'translate(-50%, 0)',
      left: 'translate(-100%, -50%)',
    };

    if (side === 'right') {
      top = rect.top + rect.height / 2;
      left = rect.right + gap;
    } else if (side === 'left') {
      top = rect.top + rect.height / 2;
      left = rect.left - gap;
    } else if (side === 'bottom') {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2;
    } else {
      top = rect.top - gap;
      left = rect.left + rect.width / 2;
    }

    if (side === 'top' || side === 'bottom') {
      const minLeft = viewportPadding + bubbleRect.width / 2;
      const maxLeft = globalThis.window.innerWidth - viewportPadding - bubbleRect.width / 2;
      left = Math.max(minLeft, Math.min(left, maxLeft));

      const maxTop = globalThis.window.innerHeight - bubbleRect.height - viewportPadding;
      const minTop = viewportPadding;
      top = Math.max(minTop, Math.min(top, maxTop));
    } else {
      const maxLeft = globalThis.window.innerWidth - bubbleRect.width - viewportPadding;
      const minLeft = viewportPadding;
      left = Math.max(minLeft, Math.min(left, maxLeft));

      const minTop = viewportPadding + bubbleRect.height / 2;
      const maxTop = globalThis.window.innerHeight - viewportPadding - bubbleRect.height / 2;
      top = Math.max(minTop, Math.min(top, maxTop));
    }

    setPosition({ top, left, transform: transformBySide[side] });
  }, [side]);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const onReposition = () => updatePosition();
    globalThis.window.addEventListener('resize', onReposition);
    globalThis.window.addEventListener('scroll', onReposition, true);
    return () => {
      globalThis.window.removeEventListener('resize', onReposition);
      globalThis.window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const openTooltip = () => setOpen(true);
    const closeTooltip = (event?: FocusEvent) => {
      if (event && trigger.contains(event.relatedTarget as Node | null)) return;
      setOpen(false);
    };

    trigger.addEventListener('mouseenter', openTooltip);
    trigger.addEventListener('mouseleave', closeTooltip);
    trigger.addEventListener('focusin', openTooltip);
    trigger.addEventListener('focusout', closeTooltip);

    return () => {
      trigger.removeEventListener('mouseenter', openTooltip);
      trigger.removeEventListener('mouseleave', closeTooltip);
      trigger.removeEventListener('focusin', openTooltip);
      trigger.removeEventListener('focusout', closeTooltip);
    };
  }, []);

  useEffect(() => {
    if (!openOnClick) return undefined;
    const trigger = triggerRef.current;
    if (!trigger) return undefined;

    // Idempotent open, not a toggle: a toggle would also have to survive a
    // Storybook play function that retries the dispatch until the listener
    // is bound (see storyInteractions.ts), where a second, redundant dispatch
    // would close what the first one just opened.
    const openTooltip = (event: MouseEvent) => {
      event.stopPropagation();
      setOpen(true);
    };
    trigger.addEventListener('click', openTooltip);
    return () => trigger.removeEventListener('click', openTooltip);
  }, [openOnClick]);

  useEffect(() => {
    if (!openOnClick || !open) return undefined;
    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || bubbleRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside, { passive: true });
    document.addEventListener('touchstart', closeOnOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('touchstart', closeOnOutside);
    };
  }, [openOnClick, open]);

  return (
    <span ref={triggerRef} className={`glass-tooltip relative inline-flex ${className}`}>
      {children}
      {mounted && open
        ? createPortal(
            <div
              ref={bubbleRef}
              role="tooltip"
              className="glass-tooltip-bubble"
              style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                transform: position.transform,
                ...(maxWidth
                  ? { maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth }
                  : {}),
              }}
            >
              {content}
            </div>,
            document.body
          )
        : null}
    </span>
  );
};

export default GlassTooltip;
