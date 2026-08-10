'use client';
import React, { useEffect, useState } from 'react';
import { IoTimeOutline } from 'react-icons/io5';
import { formatElapsed } from '@/app/lib/appointmentWorkspace';

type VisitTimerProps = {
  /**
   * Best-available visit start. The data model has no room-entry timestamp, so the
   * workspace binds this to the encounter check-in time (`encounter.admittedAt`) and
   * falls back to the booked `appointment.startTime`. When absent, the timer renders
   * a resting "Not started" state rather than fabricating an elapsed value.
   */
  startAt?: string | Date;
  /** Booked slot end (`appointment.endTime`); when the elapsed time passes it, the
   *  pill turns amber ("Over booked slot"). It never blocks actions. */
  bookedEndAt?: string | Date;
  className?: string;
  /**
   * Presentation only. `default` is the desktop header pill; `phone` renders the
   * compact clock + elapsed pill used by the phone patient bar. The timing logic
   * (start resolution, tick, states) is identical across variants.
   */
  variant?: 'default' | 'phone';
};

/** Drop a leading "00:" so an under-an-hour elapsed reads "MM:SS" in the compact pill. */
const toCompactElapsed = (elapsed: string): string =>
  elapsed.startsWith('00:') ? elapsed.slice(3) : elapsed;

const toMs = (value?: string | Date): number | undefined => {
  if (!value) return undefined;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? undefined : ms;
};

type VisitTimerInnerProps = {
  startMs?: number;
  bookedEndAt?: string | Date;
  className: string;
  isPhone: boolean;
};

const VisitTimerInner = ({ startMs, bookedEndAt, className, isPhone }: VisitTimerInnerProps) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (startMs === undefined) return;
    const interval = globalThis.setInterval(() => setNowMs(Date.now()), 1000);
    return () => globalThis.clearInterval(interval);
  }, [startMs]);

  // No start timestamp available, or the start is still in the future → resting.
  if (startMs === undefined || nowMs < startMs) {
    if (isPhone) {
      return (
        <span
          data-testid="visit-timer"
          data-state="idle"
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-(--hairline) bg-(--pill-raised) px-[9px] py-[5px] text-[10px] font-bold text-(--ink-faint) ${className}`}
        >
          <IoTimeOutline size={11} aria-hidden="true" className="text-(--ink-faint)" />
          Not started
        </span>
      );
    }
    return (
      <span
        data-testid="visit-timer"
        data-state="idle"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-card-border bg-neutral-0 px-3 py-1.5 text-caption-1 font-semibold text-text-secondary ${className}`}
      >
        <IoTimeOutline size={13} aria-hidden="true" className="text-text-tertiary" />
        Not started
      </span>
    );
  }

  const elapsed = formatElapsed(nowMs - startMs);
  const bookedEndMs = toMs(bookedEndAt);
  const overBooked = bookedEndMs !== undefined && nowMs > bookedEndMs;

  if (overBooked) {
    if (isPhone) {
      return (
        <span
          data-testid="visit-timer"
          data-state="over"
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-warning-300 bg-warning-100 px-[9px] py-[5px] text-[10px] font-bold tabular-nums text-warning-700 ${className}`}
        >
          <IoTimeOutline size={11} aria-hidden="true" />
          {toCompactElapsed(elapsed)}
        </span>
      );
    }
    return (
      <span
        data-testid="visit-timer"
        data-state="over"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning-300 bg-warning-100 px-3 py-1.5 text-caption-1 font-semibold tabular-nums text-warning-700 ${className}`}
      >
        <IoTimeOutline size={13} aria-hidden="true" />
        Over booked slot · {elapsed}
      </span>
    );
  }

  if (isPhone) {
    return (
      <span
        data-testid="visit-timer"
        data-state="running"
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-(--hairline) bg-(--pill-raised) px-[9px] py-[5px] text-[10px] font-bold tabular-nums text-(--ink-body) ${className}`}
      >
        <IoTimeOutline size={11} aria-hidden="true" className="text-(--ink-faint)" />
        {toCompactElapsed(elapsed)}
      </span>
    );
  }

  return (
    <span
      data-testid="visit-timer"
      data-state="running"
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-card-border bg-neutral-0 px-3 py-1.5 text-caption-1 font-semibold tabular-nums text-text-primary ${className}`}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 animate-pulse rounded-full bg-pill-success-text"
      />
      In room {elapsed}
    </span>
  );
};

/**
 * "In room HH:MM:SS" visit timer pill for the workspace header. Counts up once per
 * second from the best-available start. Three states, per the design's micro-states:
 * resting ("Not started"), running (green pulse dot), and over-booked (amber, past
 * the booked slot). Purely informational — it never gates any action.
 */
const VisitTimer = ({
  startAt,
  bookedEndAt,
  className = '',
  variant = 'default',
}: VisitTimerProps) => {
  const startMs = toMs(startAt);
  // Re-seed immediately when the start changes: the key remounts the inner timer,
  // whose `nowMs` initializer reads the clock on its first render, so the displayed
  // elapsed value never lags a frame behind the prop.
  return (
    <VisitTimerInner
      key={startMs ?? 'unset'}
      startMs={startMs}
      bookedEndAt={bookedEndAt}
      className={className}
      isPhone={variant === 'phone'}
    />
  );
};

export default VisitTimer;
