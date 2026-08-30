'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { confirmBookingRequest } from '@/app/features/publicBooking/services/publicBooking.service';
import {
  BookFooter,
  BookShell,
  CheckIcon,
  IconDisc,
  STATE_BODY,
  Skeleton,
  StateCard,
  WarnIcon,
} from '../bookingChrome';

/**
 * Where the emailed confirmation link lands.
 *
 * The confirmation itself is a POST, not this page load. Mail clients and link
 * scanners fetch URLs to preview them, so a GET that confirmed on arrival would
 * confirm requests nobody clicked - which is exactly the property the email step
 * exists to establish. The page reads the token from the query and posts it once.
 *
 * It shares `bookingChrome` with the booking page. It used to pick its own
 * width and padding (520/p-6 against 560/p-5), so the column visibly jumped
 * when a reader followed the link out of their inbox.
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
    <BookShell>
      {state === 'confirming' ? (
        <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] p-5 yc-card-elevated sm:p-8">
          <p className="sr-only" role="status">
            Confirming your request…
          </p>
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="size-11 rounded-full" />
            <Skeleton className="h-6 w-1/2 rounded-xl" />
            <Skeleton className="h-4 w-3/4 rounded-xl" />
          </div>
        </div>
      ) : null}

      {state === 'confirmed' ? (
        <StateCard
          headingLevel="h1"
          heading="Request confirmed"
          icon={
            <IconDisc tone="success">
              <CheckIcon />
            </IconDisc>
          }
        >
          {/* Two whole sentences rather than one with a placeholder spliced into
              it. The fallback used to render the literal "The practice can now
              see your request", which reads to a pet owner like the page has
              lost track of who they booked with. */}
          {practiceName ? (
            <p className={STATE_BODY}>
              {practiceName} can now see your request and will contact you to arrange the
              appointment.
            </p>
          ) : (
            <p className={STATE_BODY}>
              Your request is confirmed. The practice will contact you to arrange the appointment.
            </p>
          )}
          <p className="w-full rounded-xl bg-[var(--inset)] px-4 py-3 text-caption-1 text-[var(--ink-body)]">
            Nothing is booked yet, and the time you asked for is not being held.
          </p>
        </StateCard>
      ) : null}

      {state === 'invalid' ? (
        <StateCard
          headingLevel="h1"
          heading="This link is not valid"
          icon={
            <IconDisc tone="warn">
              <WarnIcon />
            </IconDisc>
          }
        >
          <p className={STATE_BODY}>
            It may have already been used, or it may have expired. Confirmation links last 48 hours.
            Please submit your request again, or contact the practice directly.
          </p>
        </StateCard>
      ) : null}

      <BookFooter />
    </BookShell>
  );
};

export default ConfirmClient;
