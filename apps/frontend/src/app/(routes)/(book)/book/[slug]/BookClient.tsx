'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PublicBookingRequestError,
  getPublicPractice,
  getPublicSlots,
  submitBookingRequest,
  type PublicPractice,
  type PublicService,
  type PublicSlot,
} from '@/app/features/publicBooking/services/publicBooking.service';

/**
 * The page a pet owner sees at `/book/<slug>`.
 *
 * Written to be honest about what a submission is. Nothing here says "booked":
 * the practice has to accept a request and get in touch, so the button says
 * "Request this time" and the success state says an email is on its way. The
 * whole point of this change was to stop the product claiming things it does not
 * do, and that has to hold on the page the public actually sees.
 */

type LoadState = 'loading' | 'ready' | 'unavailable';

const todayIso = () => new Date().toISOString().slice(0, 10);

const isoDaysFromToday = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const FIELD =
  'w-full rounded-[12px] border-[1.5px] border-[var(--hairline)] bg-[var(--screen)] px-3.5 py-2.5 text-[14px] text-[var(--ink-body)] outline-none focus:border-[var(--blue)]';

const Shell = ({ children }: { children: React.ReactNode }) => (
  <main
    id="main-content"
    tabIndex={-1}
    className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col gap-5 p-5"
  >
    {children}
  </main>
);

const PracticeHeader = ({ practice }: { practice: PublicPractice }) => (
  <header className="flex items-center gap-3">
    <span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-[var(--blue-soft)] text-[16px] font-extrabold text-[var(--blue-text)]">
      {practice.name.charAt(0).toUpperCase()}
    </span>
    <span className="min-w-0">
      <h1 className="truncate text-[20px] font-bold text-[var(--ink)]">{practice.name}</h1>
      {practice.city ? (
        <p className="text-[13px] text-[var(--ink-muted)]">
          {[practice.city, practice.country].filter(Boolean).join(', ')}
        </p>
      ) : null}
    </span>
  </header>
);

type SlotsResult = { key: string; windows: PublicSlot[]; error: string | null };

type FormValues = {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  petName: string;
  petSpecies: string;
  concern: string;
  consent: boolean;
};

const EMPTY_FORM: FormValues = {
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  petName: '',
  petSpecies: '',
  concern: '',
  consent: false,
};

const BookClient = ({ slug }: { slug: string }) => {
  const router = useRouter();

  const [state, setState] = useState<LoadState>('loading');
  const [practice, setPractice] = useState<PublicPractice | null>(null);

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [slotsResult, setSlotsResult] = useState<SlotsResult | null>(null);

  const [startTime, setStartTime] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;

    getPublicPractice(slug)
      .then((result) => {
        if (!active) return;
        if (result.kind === 'redirect') {
          // The practice renamed. Replace rather than push, so Back does not
          // return the reader to an address that no longer exists.
          router.replace(`/book/${result.slug}`);
          return;
        }
        setPractice(result.practice);
        setServiceId(result.practice.services[0]?.id ?? null);
        setState('ready');
      })
      .catch(() => {
        if (active) setState('unavailable');
      });

    return () => {
      active = false;
    };
  }, [slug, router]);

  const maxDate = useMemo(
    () => (practice ? isoDaysFromToday(practice.bookingWindowDays) : todayIso()),
    [practice]
  );

  // One key per (service, date) pair. Everything about the slot list is derived
  // from whether the result we hold matches the key we are currently asking
  // about, so the effect only ever writes state asynchronously - setting a
  // loading flag synchronously inside it cascades renders, which the lint rule
  // is right to reject.
  const slotsKey = serviceId ? `${serviceId}|${date}` : null;
  const slotsLoading = slotsKey !== null && slotsResult?.key !== slotsKey;
  const slots = slotsResult?.key === slotsKey ? slotsResult.windows : null;
  const slotsError = slotsResult?.key === slotsKey ? slotsResult.error : null;

  // A chosen time only counts while it is still on offer. Changing the service
  // or the day therefore deselects it without an effect writing state.
  const selectedTime =
    startTime && slots?.some((slot) => slot.startTime === startTime) ? startTime : null;

  useEffect(() => {
    if (!serviceId || !slotsKey) return;
    let active = true;

    getPublicSlots(slug, serviceId, date)
      .then((result) => {
        if (active) setSlotsResult({ key: slotsKey, windows: result.windows, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSlotsResult({
          key: slotsKey,
          windows: [],
          error:
            error instanceof PublicBookingRequestError
              ? error.message
              : 'Could not load available times.',
        });
      });

    return () => {
      active = false;
    };
  }, [slug, serviceId, date, slotsKey]);

  const setField = useCallback(
    <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
      setForm((previous) => ({ ...previous, [key]: value })),
    []
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!serviceId || !selectedTime || submitting || !form.consent) return;

    setSubmitting(true);
    setSubmitError(null);

    submitBookingRequest(slug, {
      serviceId,
      date,
      startTime: selectedTime,
      ownerName: form.ownerName,
      ownerEmail: form.ownerEmail,
      ownerPhone: form.ownerPhone.trim() || null,
      petName: form.petName,
      petSpecies: form.petSpecies,
      concern: form.concern.trim() || null,
      consent: true,
    })
      .then(() => setSubmitted(true))
      .catch((error: unknown) => {
        setSubmitError(
          error instanceof PublicBookingRequestError
            ? error.message
            : 'Could not send your request. Please try again.'
        );
        // A 409 means the slot went while the form was open, so the times on
        // screen are stale. Clearing the choice forces a re-pick rather than
        // letting the reader resubmit the same gone slot.
        if (error instanceof PublicBookingRequestError && error.status === 409) {
          setStartTime(null);
        }
      })
      .finally(() => setSubmitting(false));
  };

  if (state === 'loading') {
    return (
      <Shell>
        <p className="text-[14px] text-[var(--ink-muted)]">Loading…</p>
      </Shell>
    );
  }

  if (state === 'unavailable' || !practice) {
    return (
      <Shell>
        <h1 className="text-[20px] font-bold text-[var(--ink)]">
          This booking page is not available
        </h1>
        <p className="text-[14px] text-[var(--ink-muted)]">
          The address may be wrong, or the practice may not be taking online bookings. Please
          contact the practice directly.
        </p>
      </Shell>
    );
  }

  if (submitted) {
    return (
      <Shell>
        <PracticeHeader practice={practice} />
        <div className="rounded-[16px] border border-[var(--divider)] bg-[var(--inset)] p-5">
          <h2 className="text-[17px] font-bold text-[var(--ink)]">Check your email</h2>
          <p className="mt-2 text-[14px] text-[var(--ink-body)]">
            We have sent a link to <strong>{form.ownerEmail}</strong>. Follow it to confirm your
            request, and {practice.name} will be in touch to arrange the appointment.
          </p>
          <p className="mt-3 text-[13px] text-[var(--ink-faint)]">
            Nothing is booked yet. The time you chose is not being held.
          </p>
        </div>
      </Shell>
    );
  }

  if (practice.services.length === 0) {
    return (
      <Shell>
        <PracticeHeader practice={practice} />
        <p className="text-[14px] text-[var(--ink-muted)]">
          {practice.name} is not offering online booking for any services at the moment. Please
          contact the practice directly.
        </p>
      </Shell>
    );
  }

  const canSubmit = Boolean(selectedTime) && form.consent && !submitting;

  return (
    <Shell>
      <PracticeHeader practice={practice} />

      {practice.welcomeMessage ? (
        <p className="text-[14.5px] text-[var(--ink-body)]">{practice.welcomeMessage}</p>
      ) : null}

      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2 text-[13px] font-bold text-[var(--ink)]">
            What do you need?
          </legend>
          {practice.services.map((service: PublicService) => (
            <label
              key={service.id}
              className="flex cursor-pointer items-center gap-3 rounded-[13px] border-[1.5px] px-3.5 py-2.5"
              style={{
                borderColor: serviceId === service.id ? 'var(--blue)' : 'var(--hairline)',
              }}
            >
              <input
                type="radio"
                name="service"
                value={service.id}
                checked={serviceId === service.id}
                onChange={() => setServiceId(service.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-[var(--ink)]">
                  {service.name}
                </span>
                <span className="block text-[12.5px] text-[var(--ink-faint)]">
                  {service.durationMinutes} min
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-[var(--ink)]">Preferred day</span>
          <input
            type="date"
            className={FIELD}
            value={date}
            min={todayIso()}
            max={maxDate}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-bold text-[var(--ink)]">Available times</legend>

          {slotsLoading ? (
            <p className="text-[13px] text-[var(--ink-muted)]">Checking availability…</p>
          ) : null}

          {!slotsLoading && slotsError ? (
            <p role="alert" className="text-[13px] text-[var(--warn-text)]">
              {slotsError}
            </p>
          ) : null}

          {!slotsLoading && !slotsError && slots?.length === 0 ? (
            <p className="text-[13px] text-[var(--ink-muted)]">
              No times available on this day. Try another date.
            </p>
          ) : null}

          {!slotsLoading && slots && slots.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.startTime}
                  type="button"
                  aria-pressed={selectedTime === slot.startTime}
                  onClick={() => setStartTime(slot.startTime)}
                  className="rounded-full border-[1.5px] px-3.5 py-2 text-[13.5px] font-semibold text-[var(--ink)]"
                  style={{
                    borderColor:
                      selectedTime === slot.startTime ? 'var(--blue)' : 'var(--hairline)',
                  }}
                >
                  {slot.startTime}
                </button>
              ))}
            </div>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2 text-[13px] font-bold text-[var(--ink)]">Your details</legend>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-[var(--ink-muted)]">Your name</span>
            <input
              className={FIELD}
              required
              maxLength={120}
              value={form.ownerName}
              onChange={(event) => setField('ownerName', event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-[var(--ink-muted)]">Email</span>
            <input
              className={FIELD}
              type="email"
              required
              maxLength={254}
              value={form.ownerEmail}
              onChange={(event) => setField('ownerEmail', event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-[var(--ink-muted)]">Phone (optional)</span>
            <input
              className={FIELD}
              maxLength={40}
              value={form.ownerPhone}
              onChange={(event) => setField('ownerPhone', event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-[var(--ink-muted)]">Pet name</span>
            <input
              className={FIELD}
              required
              maxLength={120}
              value={form.petName}
              onChange={(event) => setField('petName', event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-[var(--ink-muted)]">Species</span>
            <input
              className={FIELD}
              required
              maxLength={60}
              placeholder="Dog, cat, rabbit…"
              value={form.petSpecies}
              onChange={(event) => setField('petSpecies', event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-[var(--ink-muted)]">
              What is the visit for? (optional)
            </span>
            <textarea
              className={FIELD}
              rows={3}
              maxLength={1000}
              value={form.concern}
              onChange={(event) => setField('concern', event.target.value)}
            />
          </label>
        </fieldset>

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.consent}
            onChange={(event) => setField('consent', event.target.checked)}
          />
          <span className="text-[12.5px] text-[var(--ink-muted)]">
            I agree that {practice.name} may store these details to handle my booking request. They
            are deleted 30 days after the requested date.
          </span>
        </label>

        {submitError ? (
          <p role="alert" className="text-[13px] text-[var(--warn-text)]">
            {submitError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--cta)] px-5 text-[14px] font-semibold text-[var(--cta-text)] disabled:opacity-50"
        >
          {submitting ? 'Sending…' : 'Request this time'}
        </button>

        <p className="text-[12.5px] text-[var(--ink-faint)]">
          This sends a request, not a booking. {practice.name} will confirm the appointment with
          you, and the time is not held in the meantime.
        </p>
      </form>
    </Shell>
  );
};

export default BookClient;
