import React from 'react';

/**
 * The one status pill for the whole app. Geometry and type are the warm-bone
 * badge: 10px/700 uppercase, +0.06em, a full-radius bordered pill, with an
 * optional leading live-dot. Colour is the only thing that varies.
 *
 * Two ways to colour it:
 * - `tone` picks a `--color-pill-*` token set (the normal case).
 * - `tokens` passes an explicit {bg,text,border} set, so the many features that
 *   already compute a status colour via a helper can adopt the shared geometry
 *   without rewriting their colour logic. `tokens` wins when both are given.
 *
 * There is no `danger` tone: the pill token scale has no danger set, and the
 * app has always drawn error/overdue states with `warning`. Callers that mean
 * danger pass `tone="warning"` (or their own tokens).
 */
export type StatusTone = 'success' | 'warning' | 'info' | 'neutral' | 'accent' | 'progress';

export type StatusPillTokens = { bg: string; text: string; border: string };

const TONE_TOKENS: Record<StatusTone, StatusPillTokens> = {
  success: {
    bg: 'var(--color-pill-success-bg)',
    text: 'var(--color-pill-success-text)',
    border: 'var(--color-pill-success-border)',
  },
  warning: {
    bg: 'var(--color-pill-warning-bg)',
    text: 'var(--color-pill-warning-text)',
    border: 'var(--color-pill-warning-border)',
  },
  info: {
    bg: 'var(--color-pill-info-bg)',
    text: 'var(--color-pill-info-text)',
    border: 'var(--color-pill-info-border)',
  },
  neutral: {
    bg: 'var(--color-pill-neutral-bg)',
    text: 'var(--color-pill-neutral-text)',
    border: 'var(--color-pill-neutral-border)',
  },
  accent: {
    bg: 'var(--color-pill-accent-bg)',
    text: 'var(--color-pill-accent-text)',
    border: 'var(--color-pill-accent-border)',
  },
  progress: {
    bg: 'var(--color-pill-progress-bg)',
    text: 'var(--color-pill-progress-text)',
    border: 'var(--color-pill-progress-border)',
  },
};

type StatusPillProps = {
  /** The state or category shown. Rendered uppercase by the type styles. */
  label: React.ReactNode;
  /** Semantic colour. Ignored when `tokens` is given. Defaults to neutral. */
  tone?: StatusTone;
  /** Explicit colour set for callers that already resolve a status colour. */
  tokens?: StatusPillTokens;
  /** Leading `--success` dot for a "live"/"online" state. */
  showDot?: boolean;
  /** Extra classes for layout only (e.g. `w-fit`). */
  className?: string;
};

const StatusPill = ({
  label,
  tone = 'neutral',
  tokens,
  showDot = false,
  className,
}: StatusPillProps) => {
  const resolved = tokens ?? TONE_TOKENS[tone];
  return (
    <span
      className={`inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full! border! px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${
        className ?? ''
      }`}
      style={{
        backgroundColor: resolved.bg,
        color: resolved.text,
        borderColor: resolved.border,
        borderStyle: 'solid',
      }}
    >
      {showDot && (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full"
          style={{ backgroundColor: 'var(--success)' }}
        />
      )}
      {label}
    </span>
  );
};

export default StatusPill;
