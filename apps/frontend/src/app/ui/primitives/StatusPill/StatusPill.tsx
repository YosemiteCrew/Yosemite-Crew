import React from 'react';

/**
 * The one status pill for the whole app. Geometry and type are the design's
 * micro-badge: 10px/700 uppercase, +0.08em, 3px 10px inside a full-radius
 * bordered pill, with an optional leading live-dot. Colour is the only thing
 * that varies.
 *
 * Two ways to colour it:
 * - `tone` picks a `--color-pill-*` token set (the normal case).
 * - `tokens` passes an explicit {bg,text,border} set, so the many features that
 *   already compute a status colour via a helper can adopt the shared geometry
 *   without rewriting their colour logic. `tokens` wins when both are given.
 *
 * `danger` draws from the `--danger-*` scale rather than `--color-pill-*`,
 * which has no danger set. It is a distinct tone on purpose: folding danger
 * into `warning` would silently repaint every error state amber.
 */
export type StatusTone =
  'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent' | 'progress';

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
  danger: {
    bg: 'var(--color-pill-danger-bg)',
    text: 'var(--color-pill-danger-text)',
    border: 'var(--color-pill-danger-border)',
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
  /**
   * Colour passthrough for the many features whose status helpers already return
   * a CSS style object ({color, backgroundColor, borderColor}). Wins over
   * `tone`/`tokens`, so `<StatusPill style={getInvoiceStatusStyle(s)} .../>` just
   * works. Colour only - layout belongs in `className`.
   */
  style?: React.CSSProperties;
  /** Leading `--success` dot for a "live"/"online" state. */
  showDot?: boolean;
  /** Extra classes for layout only (e.g. `w-fit`). */
  className?: string;
};

const StatusPill = ({
  label,
  tone = 'neutral',
  tokens,
  style,
  showDot = false,
  className,
}: StatusPillProps) => {
  const resolved = tokens ?? TONE_TOKENS[tone];
  // Geometry is the design's micro-badge, measured off the `.dc.html` sources:
  // 3px 10px padding, 10px/700, +0.08em, `line-height: normal` -> 21.5px tall.
  // `py-0.5` + the inherited 15px line-height used to render it 21px with the
  // wrong optical padding, while `.appointment-status` (line-height: 1) came
  // out at 18px, so the same status read at two sizes across the app.
  //
  // `w-fit` matters: a badge is often a direct child of a flex column, whose
  // default `align-items: stretch` would otherwise pull it into a full-width
  // band. An explicit cross size defeats the stretch, and unlike `self-start`
  // it leaves the badge centred in the flex rows it also sits in.
  //
  // `overflow-hidden` is the companion to `max-w-full`: a clamped pill must clip
  // inside its own border rather than let `whitespace-nowrap` text bleed across
  // it into the next column. `title` keeps the full label reachable when it does.
  // No `justify-center`: a `w-fit` pill is exactly its content, so centring only
  // ever shows up on a clamped pill - where it clips BOTH ends and the label
  // becomes unreadable. Start-aligned, a clamped pill still reads from the top.
  return (
    <span
      title={typeof label === 'string' ? label : undefined}
      className={`inline-flex w-fit max-w-full shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full! border! px-2.5 py-[3px] text-[10px] leading-[normal] font-bold uppercase tracking-[0.08em] ${
        className ?? ''
      }`}
      style={{
        backgroundColor: resolved.bg,
        color: resolved.text,
        borderColor: resolved.border,
        borderStyle: 'solid',
        ...style,
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
