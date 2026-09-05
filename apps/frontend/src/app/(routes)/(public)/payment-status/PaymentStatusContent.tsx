'use client';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { fetchPaymentStatus, type PaymentStatusResult } from '@/app/lib/paymentStatusRequest';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';

type RequestState = 'missing_session' | 'loading' | 'ready' | 'error';

/** Which of the three marks sits above the copy; `null` draws none. */
type MarkKind = 'failed' | 'paid' | 'pending' | null;

type PaymentStatusState = {
  data: PaymentStatusResult | null;
  requestState: RequestState;
  stopped: boolean;
};

type PaymentStatusView = {
  title: string;
  subtitle: string;
  chipLabel: string | null;
  amountLabel: string | null;
  mark: MarkKind;
};

const shortId = (value: string) =>
  value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;

// Stripe's configured redirect appends a stray quote to the session id
// (…{CHECKOUT_SESSION_ID}"), which arrives here as a trailing " / %22 and breaks
// the status lookup. Strip any surrounding quotes/whitespace before using it.
const normalizeSessionId = (raw: string | null) =>
  raw ? raw.trim().replaceAll('"', '').replaceAll("'", '') || null : raw;

const initialStateFor = (sessionId: string | null): PaymentStatusState => ({
  data: null,
  requestState: sessionId ? 'loading' : 'missing_session',
  stopped: !sessionId,
});

const amountLabelFor = (data: PaymentStatusResult) =>
  typeof data.total !== 'number' || data.total <= 0 ? null : `Amount ${data.total}`;

/** Everything the card reads off one request state - title, copy, chips, mark. */
const describeStatus = (
  requestState: RequestState,
  data: PaymentStatusResult | null
): PaymentStatusView => {
  if (requestState === 'missing_session') {
    return {
      title: 'Missing payment session',
      subtitle: 'We could not find a payment session in the URL.',
      chipLabel: null,
      amountLabel: null,
      mark: 'failed',
    };
  }
  if (requestState === 'loading') {
    return {
      title: 'Checking payment status',
      subtitle: 'We are confirming your payment with the bank. This usually takes a few seconds.',
      chipLabel: 'Checking',
      amountLabel: null,
      mark: 'pending',
    };
  }
  if (requestState === 'error') {
    return {
      title: 'We could not confirm your payment',
      subtitle:
        'We could not confirm this payment right now. Please refresh this page or contact support if the issue continues.',
      chipLabel: 'Unable to confirm',
      amountLabel: null,
      mark: 'failed',
    };
  }
  if (!data) {
    return {
      title: 'Checking payment status',
      subtitle: 'We are checking your payment status.',
      chipLabel: null,
      amountLabel: null,
      mark: null,
    };
  }

  const chipLabel = data.status ? data.status.replaceAll('_', ' ') : null;
  const amountLabel = amountLabelFor(data);

  if (data.status === 'paid') {
    return {
      title: 'Payment complete',
      subtitle: 'Thanks for your payment. Your receipt will arrive shortly.',
      chipLabel,
      amountLabel,
      mark: 'paid',
    };
  }
  if (data.status === 'no_payment_required') {
    return {
      title: 'Payment cancelled',
      subtitle: 'This payment did not complete. If this looks wrong, contact support.',
      chipLabel,
      amountLabel,
      mark: 'failed',
    };
  }
  return {
    title: 'Waiting for confirmation',
    subtitle: 'We are still waiting on confirmation. You can safely close this tab.',
    chipLabel,
    amountLabel,
    mark: data.status === 'unpaid' ? 'pending' : null,
  };
};

const StatusMark = ({ kind }: { kind: MarkKind }) => {
  if (kind === 'failed') {
    return (
      <svg className="size-24" viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r="46" fill="none" stroke="#dc2626" strokeWidth="6" />
        <path d="M42 42l36 36" fill="none" stroke="#dc2626" strokeWidth="7" strokeLinecap="round" />
        <path
          d="M78 42l-36 36"
          fill="none"
          stroke="#dc2626"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === 'paid') {
    return (
      <svg className="size-24" viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r="46" fill="none" stroke="#16a34a" strokeWidth="6" />
        <path
          d="M38 62l16 16 30-34"
          fill="none"
          stroke="#16a34a"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === 'pending') {
    return (
      <div className="flex gap-2" aria-hidden>
        <span className="size-3.5 rounded-full bg-[var(--ink-fixed)] animate-[pulse-dot_1s_cubic-bezier(0.16,1,0.3,1)_infinite]" />
        <span className="size-3.5 rounded-full bg-[var(--ink-fixed)] animate-[pulse-dot_1s_cubic-bezier(0.16,1,0.3,1)_infinite_150ms]" />
        <span className="size-3.5 rounded-full bg-[var(--ink-fixed)] animate-[pulse-dot_1s_cubic-bezier(0.16,1,0.3,1)_infinite_300ms]" />
      </div>
    );
  }
  return null;
};

export function PaymentStatusContent() {
  const searchParams = useSearchParams();
  const session_id = normalizeSessionId(searchParams.get('session_id'));

  const [state, setState] = useState<PaymentStatusState>(() => initialStateFor(session_id));
  const stopPollingRef = useRef(false);

  // Render-phase adjustment: restart from a clean slate when the session id changes.
  const [prevSessionId, setPrevSessionId] = useState(session_id);
  if (prevSessionId !== session_id) {
    setPrevSessionId(session_id);
    setState(initialStateFor(session_id));
  }

  useEffect(() => {
    if (!session_id) {
      return;
    }
    stopPollingRef.current = false;

    const safeSessionId = session_id;
    let alive = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const maxAttempts = 30;

    const scheduleNextFetch = () => {
      if (!alive || stopPollingRef.current) return;
      timeoutId = setTimeout(fetchStatus, 2000);
    };

    async function fetchStatus() {
      if (!alive || stopPollingRef.current) return;
      try {
        const json = await fetchPaymentStatus(safeSessionId);
        if (!alive) return;
        setState((current) => ({ ...current, data: json, requestState: 'ready' }));
        attempts += 1;
        if (
          json.status === 'paid' ||
          json.status === 'no_payment_required' ||
          attempts >= maxAttempts
        ) {
          stopPollingRef.current = true;
          setState((current) => ({ ...current, stopped: true }));
        } else {
          scheduleNextFetch();
        }
      } catch {
        if (!alive) return;
        stopPollingRef.current = true;
        setState((current) => ({ ...current, requestState: 'error', data: null, stopped: true }));
      }
    }

    fetchStatus();

    return () => {
      alive = false;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [session_id]);

  const { data, requestState, stopped } = state;
  // A session id that never reached state (first render after a URL change is
  // reconciled above) still reads as "missing", exactly as the copy used to.
  const effectiveState: RequestState = session_id ? requestState : 'missing_session';
  const view = describeStatus(effectiveState, data);
  const statusToneRole =
    effectiveState === 'error' || effectiveState === 'missing_session' ? 'alert' : 'status';

  return (
    // A light product surface outside the (app) layout, reached by both
    // /payment-status and /success, so it needs the readable faint inks of its
    // own - see body:has([data-yc-app]) in globals.css. Without the marker the
    // `text-text-tertiary` line below sits at 3.45:1 even on white.
    <div
      data-yc-app
      data-yc-surface="light"
      className="min-h-[max(720px,100vh)] flex items-center justify-center px-4 pt-22 pb-10 bg-[radial-gradient(circle_at_10%_10%,rgba(250,238,210,0.6),transparent_45%),radial-gradient(circle_at_90%_20%,rgba(210,235,248,0.6),transparent_45%),radial-gradient(circle_at_50%_90%,rgba(215,245,230,0.7),transparent_50%)]"
    >
      {/* Opaque, not bg-white/80. The card pins its inks light because it is a
          receipt, but at 80% the themed page beneath it bled through: in dark the
          surface composited to #d2d2d1 instead of white, which dropped the
          "Yosemite Crew" kicker to 3.94:1. A pinned surface has to be opaque or
          the pin only half-holds. */}
      <div className="w-full max-w-xl bg-white border border-card-border rounded-2xl px-6 py-10">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative flex items-center justify-center size-24 rounded-full">
            <StatusMark kind={view.mark} />
          </div>

          <div
            className="flex flex-col gap-2"
            role={statusToneRole}
            aria-live={effectiveState === 'ready' ? 'polite' : 'assertive'}
            aria-busy={effectiveState === 'loading'}
          >
            <div className="text-body-4 text-text-tertiary">Yosemite Crew</div>
            <h1 className="text-heading-1 text-text-primary">{view.title}</h1>
            <div className="text-body-3 text-text-secondary max-w-xl">{view.subtitle}</div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-caption-1 text-text-primary">
            {session_id && (
              <span className="px-4 py-2 rounded-full border border-card-border bg-white/70">
                Session {shortId(session_id)}
              </span>
            )}
            {view.chipLabel && (
              <span className="px-4 py-2 rounded-full border border-card-border bg-white/70">
                Status {view.chipLabel}
              </span>
            )}
            {view.amountLabel && (
              <span className="px-4 py-2 rounded-full border border-card-border bg-white/70">
                {view.amountLabel}
              </span>
            )}
            {stopped && (
              <span className="px-4 py-2 rounded-full border border-card-border bg-white/70">
                Auto-check stopped
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Secondary text="Return home" href="/" />
          </div>
        </div>
      </div>
    </div>
  );
}
