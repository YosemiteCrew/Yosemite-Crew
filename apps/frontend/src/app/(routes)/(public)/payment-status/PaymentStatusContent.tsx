'use client';
import { buildPaymentStatusUrl } from '@/app/lib/paymentStatusUrl';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { useSearchParams } from 'next/navigation';
import React, { useMemo, useEffect, useRef, useState } from 'react';

type DisplayState = 'paid' | 'no_payment_required' | 'unpaid';
type RequestState = 'missing_session' | 'loading' | 'ready' | 'error';

type Return = {
  status: DisplayState;
  total: number;
};

type PaymentStatusState = {
  data: Return | null;
  requestState: RequestState;
  stopped: boolean;
};

const shortId = (value: string) =>
  value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;

export function PaymentStatusContent() {
  const searchParams = useSearchParams();
  // Stripe's configured redirect appends a stray quote to the session id
  // (…{CHECKOUT_SESSION_ID}"), which arrives here as a trailing " / %22 and breaks
  // the status lookup. Strip any surrounding quotes/whitespace before using it.
  const rawSessionId = searchParams.get('session_id');
  const session_id = rawSessionId
    ? rawSessionId.trim().replaceAll('"', '').replaceAll("'", '') || null
    : rawSessionId;

  const [state, setState] = useState<PaymentStatusState>({
    data: null,
    requestState: session_id ? 'loading' : 'missing_session',
    stopped: false,
  });
  const stopPollingRef = useRef(false);

  useEffect(() => {
    setState({
      data: null,
      requestState: session_id ? 'loading' : 'missing_session',
      stopped: !session_id,
    });
    stopPollingRef.current = false;
  }, [session_id]);

  useEffect(() => {
    if (!session_id) {
      return;
    }

    const safeSessionId = session_id;
    let alive = true;
    let attempts = 0;
    const maxAttempts = 30;

    async function fetchStatus() {
      if (stopPollingRef.current) return;
      try {
        const res = await fetch(buildPaymentStatusUrl(safeSessionId), {
          cache: 'no-store',
        });
        const json = (await res.json()) as Return;
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
        }
      } catch {
        if (!alive) return;
        setState((current) => ({ ...current, requestState: 'error', data: null }));
        stopPollingRef.current = true;
        setState((current) => ({ ...current, stopped: true }));
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [session_id]);

  const { data, requestState, stopped } = state;

  const title = useMemo(() => {
    if (!session_id || requestState === 'missing_session') return 'Missing payment session';
    if (requestState === 'loading') return 'Checking payment status';
    if (requestState === 'error') return 'We could not confirm your payment';
    if (!data) return 'Checking payment status';
    if (data.status === 'paid') return 'Payment complete';
    if (data.status === 'no_payment_required') return 'Payment cancelled';
    return 'Waiting for confirmation';
  }, [data, requestState, session_id]);

  const subtitle = useMemo(() => {
    if (!session_id || requestState === 'missing_session') {
      return 'We could not find a payment session in the URL.';
    }
    if (requestState === 'loading') {
      return 'We are confirming your payment with the bank. This usually takes a few seconds.';
    }
    if (requestState === 'error') {
      return 'We could not confirm this payment right now. Please refresh this page or contact support if the issue continues.';
    }
    if (!data) {
      return 'We are checking your payment status.';
    }
    if (data.status === 'paid') {
      return 'Thanks for your payment. Your receipt will arrive shortly.';
    }
    if (data.status === 'no_payment_required') {
      return 'This payment did not complete. If this looks wrong, contact support.';
    }
    return 'We are still waiting on confirmation. You can safely close this tab.';
  }, [data, requestState, session_id]);

  const statusChipLabel = useMemo(() => {
    if (requestState === 'loading') return 'Checking';
    if (requestState === 'error') return 'Unable to confirm';
    if (!data?.status) return null;
    return data.status.replaceAll('_', ' ');
  }, [data, requestState]);

  const amountLabel = useMemo(() => {
    if (typeof data?.total !== 'number' || data.total <= 0) return null;
    return `Amount ${data.total}`;
  }, [data]);

  const statusToneRole =
    requestState === 'error' || requestState === 'missing_session' ? 'alert' : 'status';

  return (
    <div className="min-h-[max(720px,100vh)] flex items-center justify-center px-4 pt-22 pb-10 bg-[radial-gradient(circle_at_10%_10%,rgba(250,238,210,0.6),transparent_45%),radial-gradient(circle_at_90%_20%,rgba(210,235,248,0.6),transparent_45%),radial-gradient(circle_at_50%_90%,rgba(215,245,230,0.7),transparent_50%)]">
      <div className="w-full max-w-xl bg-white/80 border border-card-border rounded-2xl px-6 py-10">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative flex items-center justify-center size-24 rounded-full">
            {(requestState === 'missing_session' || requestState === 'error') && (
              <svg className="size-24" viewBox="0 0 120 120" aria-hidden>
                <circle cx="60" cy="60" r="46" fill="none" stroke="#dc2626" strokeWidth="6" />
                <path
                  d="M42 42l36 36"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
                <path
                  d="M78 42l-36 36"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {data?.status === 'paid' && (
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
            )}
            {(requestState === 'loading' || data?.status === 'unpaid') && (
              <div className="flex gap-2" aria-hidden>
                <span className="size-3.5 rounded-full bg-slate-900 animate-[pulse-dot_1s_cubic-bezier(0.16,1,0.3,1)_infinite]" />
                <span className="size-3.5 rounded-full bg-slate-900 animate-[pulse-dot_1s_cubic-bezier(0.16,1,0.3,1)_infinite_150ms]" />
                <span className="size-3.5 rounded-full bg-slate-900 animate-[pulse-dot_1s_cubic-bezier(0.16,1,0.3,1)_infinite_300ms]" />
              </div>
            )}
            {data?.status === 'no_payment_required' && (
              <svg className="size-24" viewBox="0 0 120 120" aria-hidden>
                <circle cx="60" cy="60" r="46" fill="none" stroke="#dc2626" strokeWidth="6" />
                <path
                  d="M42 42l36 36"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
                <path
                  d="M78 42l-36 36"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>

          <div
            className="flex flex-col gap-2"
            role={statusToneRole}
            aria-live={requestState === 'ready' ? 'polite' : 'assertive'}
            aria-busy={requestState === 'loading'}
          >
            <div className="text-body-4 text-text-tertiary">Yosemite Crew</div>
            <h1 className="text-heading-1 text-text-primary">{title}</h1>
            <div className="text-body-3 text-text-secondary max-w-xl">{subtitle}</div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-caption-1 text-text-primary">
            {session_id && (
              <span className="px-4 py-2 rounded-full border border-card-border bg-white/70">
                Session {shortId(session_id)}
              </span>
            )}
            {statusChipLabel && (
              <span className="px-4 py-2 rounded-full border border-card-border bg-white/70">
                Status {statusChipLabel}
              </span>
            )}
            {amountLabel && (
              <span className="px-4 py-2 rounded-full border border-card-border bg-white/70">
                {amountLabel}
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
