import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './GlassTooltip.css';

type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

type GlassTooltipProps = {
  content: string;
  children: React.ReactNode;
  side?: TooltipSide;
  className?: string;
};

const GlassTooltip = ({ content, children, side = 'top', className = '' }: GlassTooltipProps) => {
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
    let transform = 'translate(-50%, -100%)';

    if (side === 'right') {
      top = rect.top + rect.height / 2;
      left = rect.right + gap;
      transform = 'translate(0, -50%)';
    } else if (side === 'left') {
      top = rect.top + rect.height / 2;
      left = rect.left - gap;
      transform = 'translate(-100%, -50%)';
    } else if (side === 'bottom') {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2;
      transform = 'translate(-50%, 0)';
    } else {
      top = rect.top - gap;
      left = rect.left + rect.width / 2;
      transform = 'translate(-50%, -100%)';
    }

    const maxLeft = window.innerWidth - bubbleRect.width - viewportPadding;
    const minLeft = viewportPadding;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    const maxTop = window.innerHeight - bubbleRect.height - viewportPadding;
    const minTop = viewportPadding;
    top = Math.max(minTop, Math.min(top, maxTop));

    setPosition({ top, left, transform });
  }, [side]);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const onReposition = () => updatePosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updatePosition]);

  return (
    <div
      ref={triggerRef}
      className={`glass-tooltip relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setOpen(false);
      }}
    >
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
              }}
            >
              {content}
            </div>,
            document.body
          )
        : null}
    </div>
  );
};

export default GlassTooltip;
