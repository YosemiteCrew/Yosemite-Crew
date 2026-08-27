'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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

/**
 * A discriminated union rather than a status string beside a nullable practice.
 *
 * It makes "ready implies we have a practice" a fact the compiler enforces, so
 * the render path needs no null guard that can never fire - and no unreachable
 * branch to explain in a coverage report.
 */
type PracticeView =
  { status: 'loading' } | { status: 'unavailable' } | { status: 'ready'; practice: PublicPractice };

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

/**
 * The time picker and its four states.
 *
 * Extracted from `BookClient` rather than inlined: those four conditionals sat
 * inside a function that was already branching on load state, submission state
 * and service selection, and Sonar was right that the result had stopped being
 * readable in one pass.
 */
const SlotPicker = ({
  loading,
  error,
  slots,
  selectedTime,
  onSelect,
}: {
  loading: boolean;
  error: string | null;
  slots: PublicSlot[] | null;
  selectedTime: string | null;
  onSelect: (startTime: string) => void;
}) => {
  const body = () => {
    if (loading) {
      return <p className="text-[13px] text-[var(--ink-muted)]">Checking availability…</p>;
    }
    if (error) {
      return (
        <p role="alert" className="text-[13px] text-[var(--warn-text)]">
          {error}
        </p>
      );
    }
    if (!slots || slots.length === 0) {
      return (
        <p className="text-[13px] text-[var(--ink-muted)]">
          No times available on this day. Try another date.
        </p>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <button
            key={slot.startTime}
            type="button"
            aria-pressed={selectedTime === slot.startTime}
            onClick={() => onSelect(slot.startTime)}
            className="rounded-full border-[1.5px] px-3.5 py-2 text-[13.5px] font-semibold text-[var(--ink)]"
            style={{
              borderColor: selectedTime === slot.startTime ? 'var(--blue)' : 'var(--hairline)',
            }}
          >
            {slot.startTime}
          </button>
        ))}
      </div>
    );
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] font-bold text-[var(--ink)]">Available times</legend>
      {body()}
    </fieldset>
  );
};

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

/**
 * The states that replace the form entirely.
 *
 * Returns null when the booking form should render instead. Pulled out of
 * `BookClient` so that component branches once on "is there a status to show"
 * rather than four times on which one.
 */
const PendingOrUnavailable = ({ status }: { status: 'loading' | 'unavailable' }) =>
  status === 'loading' ? (
    <Shell>
      <p className="text-[14px] text-[var(--ink-muted)]">Loading…</p>
    </Shell>
  ) : (
    <Shell>
      <h1 className="text-[20px] font-bold text-[var(--ink)]">
        This booking page is not available
      </h1>
      <p className="text-[14px] text-[var(--ink-muted)]">
        The address may be wrong, or the practice may not be taking online bookings. Please contact
        the practice directly.
      </p>
    </Shell>
  );

const renderStatus = ({
  practice,
  submitted,
  ownerEmail,
}: {
  practice: PublicPractice;
  submitted: boolean;
  ownerEmail: string;
}): React.ReactElement | null => {
  if (submitted) {
    return (
      <Shell>
        <PracticeHeader practice={practice} />
        <div className="rounded-[16px] border border-[var(--divider)] bg-[var(--inset)] p-5">
          <h2 className="text-[17px] font-bold text-[var(--ink)]">Check your email</h2>
          <p className="mt-2 text-[14px] text-[var(--ink-body)]">
            We have sent a link to <strong>{ownerEmail}</strong>. Follow it to confirm your request,
            and {practice.name} will be in touch to arrange the appointment.
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

  return null;
};

/**
 * Loads the practice, and redirects when the slug has been retired.
 *
 * A hook rather than an effect inside the component: the callback nests two
 * conditionals inside a promise inside an effect, and leaving that in
 * `BookClient` is most of what pushed its cognitive complexity past the limit.
 */
const usePractice = (slug: string): PracticeView => {
  const router = useRouter();
  // Held in a ref so the effect depends on the slug alone. `useRouter()` is not
  // contractually identity-stable, and this effect now stores a freshly built
  // object on success - so a router that changes identity per render would
  // re-run the load, set new state, and re-run it again forever.
  const routerRef = useRef(router);
  // Synced in an effect, not during render: reading or writing a ref while
  // rendering is what the React Compiler rule forbids, and the initial value
  // already covers the first pass.
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const [view, setView] = useState<PracticeView>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    getPublicPractice(slug)
      .then((result) => {
        if (!active) return;
        if (result.kind === 'redirect') {
          // Replace rather than push, so Back does not return the reader to an
          // address that no longer exists.
          routerRef.current.replace(`/book/${result.slug}`);
          return;
        }
        setView({ status: 'ready', practice: result.practice });
      })
      .catch(() => {
        if (active) setView({ status: 'unavailable' });
      });

    return () => {
      active = false;
    };
  }, [slug]);

  return view;
};

/**
 * Available times for one service on one day.
 *
 * Keyed by the (service, date) pair so everything the caller needs is derived
 * from whether the held result matches the key currently being asked about. The
 * effect therefore only writes state asynchronously; setting a loading flag
 * synchronously inside it would cascade renders.
 */
const useSlots = (slug: string, serviceId: string | null, date: string) => {
  const [result, setResult] = useState<SlotsResult | null>(null);

  const key = serviceId ? `${serviceId}|${date}` : null;

  useEffect(() => {
    if (!serviceId || !key) return;
    let active = true;

    getPublicSlots(slug, serviceId, date)
      .then((slots) => {
        if (active) setResult({ key, windows: slots.windows, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setResult({
          key,
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
  }, [slug, serviceId, date, key]);

  const matches = result?.key === key;
  return {
    loading: key !== null && !matches,
    slots: matches ? result.windows : null,
    error: matches ? result.error : null,
  };
};

const BookClient = ({ slug }: { slug: string }) => {
  const view = usePractice(slug);
  // Needed before the guard below, because the default service feeds `useSlots`
  // and every hook has to run on every render.
  const loaded = view.status === 'ready' ? view.practice : null;

  // Derived, not stored: the practice's first service is the default until the
  // reader picks another, so nothing has to write it when the practice loads.
  const [serviceOverride, setServiceOverride] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const serviceId = serviceOverride ?? loaded?.services[0]?.id ?? null;

  const [startTime, setStartTime] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { loading: slotsLoading, slots, error: slotsError } = useSlots(slug, serviceId, date);

  // A chosen time only counts while it is still on offer, so changing the
  // service or the day deselects it without an effect writing state.
  const selectedTime =
    startTime && slots?.some((slot) => slot.startTime === startTime) ? startTime : null;

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

  if (view.status !== 'ready') return <PendingOrUnavailable status={view.status} />;

  // Past the guard the compiler knows there is a practice, so nothing below
  // needs a null check.
  const practice = view.practice;
  const maxDate = isoDaysFromToday(practice.bookingWindowDays);

  // One branch for the remaining states. They live in `renderStatus`, which has
  // its own complexity budget.
  const statusView = renderStatus({
    practice,
    submitted,
    ownerEmail: form.ownerEmail,
  });
  if (statusView) return statusView;

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
              htmlFor={`service-${service.id}`}
              className="flex cursor-pointer items-center gap-3 rounded-[13px] border-[1.5px] px-3.5 py-2.5"
              style={{
                borderColor: serviceId === service.id ? 'var(--blue)' : 'var(--hairline)',
              }}
            >
              <input
                id={`service-${service.id}`}
                type="radio"
                name="service"
                // The visible name sits two elements deep, which is past what a
                // label's implicit association is guaranteed to expose. The
                // explicit id/htmlFor pair plus this label give the control a
                // name in every assistive technology rather than most.
                aria-label={service.name}
                value={service.id}
                checked={serviceId === service.id}
                onChange={() => setServiceOverride(service.id)}
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

        <SlotPicker
          loading={slotsLoading}
          error={slotsError}
          slots={slots}
          selectedTime={selectedTime}
          onSelect={setStartTime}
        />

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
