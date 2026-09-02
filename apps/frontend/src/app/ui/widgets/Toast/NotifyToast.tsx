import React from 'react';
import type { ToastContentProps } from 'react-toastify';
import { IoAlertCircle, IoCheckmarkCircle, IoInformationCircle, IoWarning } from 'react-icons/io5';
import Close from '@/app/ui/primitives/Icons/Close';

export type NotifyTone = 'success' | 'error' | 'info' | 'warning';

export type NotifyToastData = {
  title: string;
  text?: string;
};

type ToneRecipe = {
  Icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean; className?: string }>;
  /** Tinted disc behind the glyph and the glyph colour, both from the status tokens. */
  bg: string;
  ink: string;
};

/**
 * One glyph per tone, on the same tinted disc the status pills use, so a toast
 * reads as the same family as the pill that will later show the state it
 * announced. The icons are Ionicons (the PIMS icon set), not the auth pages'
 * Solar set.
 */
const TONES: Record<NotifyTone, ToneRecipe> = {
  success: {
    Icon: IoCheckmarkCircle,
    bg: 'var(--color-pill-success-bg)',
    ink: 'var(--color-pill-success-text)',
  },
  error: {
    Icon: IoAlertCircle,
    bg: 'var(--danger-bg)',
    ink: 'var(--danger-text)',
  },
  info: {
    Icon: IoInformationCircle,
    bg: 'var(--blue-soft)',
    ink: 'var(--blue-text)',
  },
  warning: {
    Icon: IoWarning,
    bg: 'var(--warn-bg)',
    ink: 'var(--warn-text)',
  },
};

type NotifyToastProps = ToastContentProps<NotifyToastData> & {
  tone: NotifyTone;
};

/**
 * Body of every runtime toast `useNotify` raises through react-toastify.
 *
 * The surface (warm --screen card, hairline, level-3 float, 16px radius, Satoshi)
 * is the `.Toastify__toast` override in globals.css; this component owns the
 * inside: a 32px tone disc, a 13.5px/700 --ink title, a 12.5px --ink-muted
 * detail line, and the shared round Close control. The tone tokens flip with
 * `html[data-theme='dark']`, so no per-theme branch is needed here.
 */
const NotifyToast = ({ data, closeToast, tone }: NotifyToastProps) => {
  const { Icon, bg, ink } = TONES[tone];
  return (
    <div className="flex w-full items-start gap-3" data-tone={tone}>
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: bg, color: ink }}
      >
        <Icon size={18} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px] pt-[5px]">
        <div className="text-[13.5px] font-bold leading-[1.25] tracking-[-0.01em] text-[var(--ink)]">
          {data.title}
        </div>
        {data.text ? (
          <div className="text-[12.5px] leading-[1.4] text-[var(--ink-muted)]">{data.text}</div>
        ) : null}
      </div>
      <Close onClick={closeToast} />
    </div>
  );
};

export default NotifyToast;
