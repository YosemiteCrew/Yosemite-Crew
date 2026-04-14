import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './GlassTooltip.css';

type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

type GlassTooltipProps = {
  content: string;
  children: React.ReactNode;
  side?: TooltipSide;
  className?: string;
  maxWidth?: number | string;
};

const GlassTooltip = ({
  content,
  children,
  side = 'top',
  className = '',
  maxWidth,
}: GlassTooltipProps) => {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    transform: 'translate(-50%, -100%)',
  });

  useEffect(() => {
    setMounted(typeof document !== 'undefined');
  }, []);

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
