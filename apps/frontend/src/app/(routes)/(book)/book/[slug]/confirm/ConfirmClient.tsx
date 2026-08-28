'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { confirmBookingRequest } from '@/app/features/publicBooking/services/publicBooking.service';

/**
 * Where the emailed confirmation link lands.
 *
 * The confirmation itself is a POST, not this page load. Mail clients and link
 * scanners fetch URLs to preview them, so a GET that confirmed on arrival would
 * confirm requests nobody clicked - which is exactly the property the email step
 * exists to establish. The page reads the token from the query and posts it once.
 */

type State = 'confirming' | 'confirmed' | 'invalid';

const ConfirmClient = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  // Derived from the token rather than set inside the effect: a link with no
  // token is already invalid before anything runs, and writing that state
  // synchronously in an effect cascades a render.
  const [state, setState] = useState<State>(token ? 'confirming' : 'invalid');
  const [practiceName, setPracticeName] = useState('');
  // React 18 mounts effects twice in development; confirming is a write, so it
  // runs once regardless.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!token) return;

    confirmBookingRequest(token)
      .then((result) => {
        setPracticeName(result.practiceName);
        setState('confirmed');
      })
      .catch(() => setState('invalid'));
  }, [token]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col justify-center gap-3 p-6"
    >
      {state === 'confirming' ? (
        <p className="text-[14px] text-[var(--ink-muted)]">Confirming your request…</p>
      ) : null}

      {state === 'confirmed' ? (
        <>
          <h1 className="text-[20px] font-bold text-[var(--ink)]">Request confirmed</h1>
          <p className="text-[14px] text-[var(--ink-body)]">
            {practiceName || 'The practice'} can now see your request and will contact you to
            arrange the appointment.
          </p>
          <p className="text-[13px] text-[var(--ink-faint)]">
            Nothing is booked yet, and the time you asked for is not being held.
          </p>
        </>
      ) : null}

      {state === 'invalid' ? (
        <>
          <h1 className="text-[20px] font-bold text-[var(--ink)]">This link is not valid</h1>
          <p className="text-[14px] text-[var(--ink-body)]">
            It may have already been used, or it may have expired. Confirmation links last 48 hours.
            Please submit your request again, or contact the practice directly.
          </p>
        </>
      ) : null}
    </main>
  );
};

export default ConfirmClient;
