'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/app/ui/Card';
import {
  PublicBookingRequestError,
  getPublicPractice,
  getPublicSlots,
  submitBookingRequest,
  type PublicPractice,
  type PublicService,
  type PublicSlot,
} from '@/app/features/publicBooking/services/publicBooking.service';
import {
  BookFooter,
  BookShell,
  Callout,
  CheckIcon,
  ClockIcon,
  IconDisc,
  Skeleton,
  Spinner,
  WarnIcon,
} from './bookingChrome';
import {
  EYEBROW,
  FIELD,
  FIELD_LABEL,
  META_TEXT,
  PILL,
  SLOT_GRID,
  STATE_BODY,
} from './bookingStyles';
import { describeBlock, formatLongDay, groupByDayPart, quickDayLabel } from './bookingFormat';

/**
 * The page a pet owner sees at `/book/<slug>`.
 *
 * Written to be honest about what a submission is. Nothing here says "booked":
 * the practice has to accept a request and get in touch, so the button says
 * "Request this time" and the success state says an email is on its way. The
 * whole point of this change was to stop the product claiming things it does not
 * do, and that has to hold on the page the public actually sees.
 *
 * That sentence used to be the least readable line on the page - 12.5px on
 * --ink-faint, 2.84:1, at the very bottom, under the button. It is now a ruled
 * callout at the top of the card, at 16px and 10.39:1, before the reader
 * touches a field. It also has to appear EXACTLY once: the test and the story
 * both match it with a singular getByText, so the closing footnote says
 * something else.
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

const PracticeHeader = ({ practice }: { practice: PublicPractice }) => (
  <header className="flex items-start gap-3 px-5 pt-5 pb-4 sm:px-8 sm:pt-8">
    {/* --blue-soft measured 1.07:1 against the page - the tile had no shape at
        all and the letter floated unattached. --blue-strong is 5.86:1 on the
        card, and carries --white-text rather than --cta-text, which flips dark
        and would read at 3.72:1 on a fill that stays blue.
        aria-hidden because the h1 beside it already says the name. */}
    <span
      aria-hidden="true"
      className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--blue-strong)] text-body-4-emphasis text-[var(--white-text)]"
    >
      {practice.name.charAt(0).toUpperCase()}
    </span>
    {/* A div, not a span. Phrasing content may not contain flow content; this
        renders today only because the flex row blockifies it, and the moment it
        stops being one, validateDOMNesting throws in the test environment. */}
    <div className="min-w-0">
      {/* font-newsreader alongside text-page-title is required, not belt and
          braces: the class's own @apply font-newsreader sits in
          @layer components and loses to the unlayered `* { font-family: inherit }`.
          `truncate` is gone - it clipped the one string the page exists to
          convey at 320px and at 200% zoom. */}
      <h1 className="font-newsreader text-page-title text-balance">{practice.name}</h1>
      {practice.city ? (
        <p className="mt-1 text-caption-1 text-[var(--ink-muted)]">
          {[practice.city, practice.country].filter(Boolean).join(', ')}
        </p>
      ) : null}
    </div>
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
  groupRef,
}: {
  loading: boolean;
  error: string | null;
  slots: PublicSlot[] | null;
  selectedTime: string | null;
  onSelect: (startTime: string) => void;
  groupRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const body = () => {
    if (loading) {
      // Skeletons in the same grid the pills will occupy, so nothing collapses
      // and reflows underneath the reader when they arrive. role="status", never
      // alert - the tests assert no alert is mounted in the normal state.
      return (
        <>
          <div className={SLOT_GRID} aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-11 rounded-full" />
            ))}
          </div>
          {/* <output>, not a p with role="status" - it carries that role
              implicitly, and Sonar's S6819 asks for the element over the ARIA
              attribute. Precedent: AccessibilityReportClient and InvoiceTable. */}
          <output className="sr-only">Checking availability…</output>
        </>
      );
    }
    if (error) {
      return <Callout role="alert">{error}</Callout>;
    }
    if (!slots || slots.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-[var(--ink-6b)] bg-[var(--inset)] px-4 py-8 text-center">
          <p className="text-body-4 text-[var(--ink-body)]">
            No times available on this day. Try another date.
          </p>
        </div>
      );
    }

    const groups = groupByDayPart(slots);
    // A lone "MORNING" heading over a morning-only day is noise, so its legend
    // goes sr-only; the group keeps its accessible name either way.
    const manyGroups = groups.length > 1;

    return groups.map((group) => (
      // A fieldset, not a div with role="group": these are related controls
      // inside a form, which is what the element is for, and Sonar's S6819 asks
      // for the element over the role. The h3 sits INSIDE the legend - legend
      // takes heading content - so the group keeps its accessible name and a
      // reader can still jump between day parts by heading.
      <fieldset key={group.key} className="mb-4 last:mb-0">
        <legend className={manyGroups ? 'mb-2' : 'sr-only'}>
          <h3
            className={
              manyGroups
                ? 'text-caption-2 font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]'
                : ''
            }
          >
            {group.label}
          </h3>
        </legend>
        <div className={SLOT_GRID}>
          {group.slots.map((slot) => (
            // The button's entire text is the bare startTime. No end time, no
            // duration, no aria-label: getByRole('button', { name: '09:00' })
            // is an exact match in both the tests and the story.
            <button
              key={slot.startTime}
              type="button"
              aria-pressed={selectedTime === slot.startTime}
              onClick={() => onSelect(slot.startTime)}
              className={PILL}
            >
              {slot.startTime}
            </button>
          ))}
        </div>
      </fieldset>
    ));
  };

  return (
    <section aria-labelledby="slots-label">
      <p id="slots-label" className="mb-3 text-caption-1 text-[var(--ink-body)]">
        Available times
      </p>
      <div ref={groupRef} tabIndex={-1}>
        {body()}
      </div>
    </section>
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
    <BookShell>
      {/* A skeleton of the page that is coming, not the word "Loading" on an
          empty screen. Nothing asserts that string. */}
      <Card className="p-5 sm:p-8" aria-busy="true">
        <output className="sr-only">Loading this practice’s booking page</output>
        <div className="flex items-start gap-3">
          <Skeleton className="size-11 shrink-0 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-6 w-2/3 rounded-xl" />
            <Skeleton className="mt-2 h-4 w-1/3 rounded-xl" />
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-14 rounded-xl" />
          ))}
        </div>
      </Card>
      <BookFooter />
    </BookShell>
  ) : (
    <BookShell>
      <Card className="p-5 sm:p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <IconDisc tone="warn">
            <WarnIcon />
          </IconDisc>
          <h1 className="text-heading-2 text-[var(--ink)]">This booking page is not available</h1>
          <p className={STATE_BODY}>
            The address may be wrong, or the practice may not be taking online bookings. Please
            contact the practice directly.
          </p>
        </div>
      </Card>
      <BookFooter />
    </BookShell>
  );

/**
 * The success state, and the focus move that goes with it.
 *
 * It owns its own ref and effect rather than taking them from `BookClient`:
 * this only ever mounts once the request has gone, so "focus me on mount" is
 * the whole rule, and keeping it here means no ref crosses a plain function
 * call during render.
 *
 * Before this the form simply unmounted, focus fell to `<body>`, and nothing
 * told a screen-reader user the submission had worked.
 */
const SubmittedCard = ({
  practice,
  ownerEmail,
}: {
  practice: PublicPractice;
  ownerEmail: string;
}) => {
  const statusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    statusRef.current?.focus();
  }, []);

  return (
    <BookShell>
      <Card>
        <PracticeHeader practice={practice} />
        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div
            ref={statusRef}
            tabIndex={-1}
            className="flex flex-col items-center gap-4 text-center"
          >
            <IconDisc tone="success">
              <CheckIcon />
            </IconDisc>
            <h2 className="text-heading-2 text-[var(--ink)]">Check your email</h2>
            <p className={STATE_BODY}>
              We have sent a link to{' '}
              <strong className="font-medium break-all text-[var(--ink)]">{ownerEmail}</strong>.
              Follow it to confirm your request, and {practice.name} will be in touch to arrange the
              appointment.
            </p>
            <p className="w-full rounded-xl bg-[var(--inset)] px-4 py-3 text-caption-1 text-[var(--ink-body)]">
              Nothing is booked yet. The time you chose is not being held.
            </p>
          </div>
        </div>
      </Card>
      <BookFooter />
    </BookShell>
  );
};

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
    return <SubmittedCard practice={practice} ownerEmail={ownerEmail} />;
  }

  if (practice.services.length === 0) {
    return (
      <BookShell>
        <Card>
          <PracticeHeader practice={practice} />
          <p className="px-5 pb-6 text-body-4 text-[var(--ink-body)] sm:px-8 sm:pb-8">
            {practice.name} is not offering online booking for any services at the moment. Please
            contact the practice directly.
          </p>
        </Card>
        <BookFooter />
      </BookShell>
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

/**
 * The four sections of the form, each its own component.
 *
 * `BookClient` was a 420-line component and React Doctor was right that it had
 * stopped being readable in one pass - the same reason `SlotPicker` and
 * `renderStatus` were pulled out before it. Each of these takes only what it
 * renders, so what a section depends on is visible in its signature.
 */

const ServiceFieldset = ({
  services,
  serviceId,
  onSelect,
}: {
  services: PublicService[];
  serviceId: string | null;
  onSelect: (id: string) => void;
}) => (
  <fieldset>
    <legend className={EYEBROW}>Service</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      {services.map((service: PublicService) => (
        <label
          key={service.id}
          htmlFor={`service-${service.id}`}
          className="flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] border-[var(--ink-6b)] bg-[var(--field-bg)] p-4 transition-[border-color,background-color,box-shadow] duration-150 ease-out hover:border-[var(--ink)] hover:bg-[var(--screen-2)] has-[:checked]:border-[var(--blue-strong)] has-[:checked]:bg-[var(--blue-soft)] has-[:focus-visible]:border-[var(--color-input-border-active)] has-[:focus-visible]:shadow-[0_0_0_3px_var(--glow-b26)]"
        >
          {/* The input, the dot and the content are DIRECT SIBLINGS, and
                that is the whole trick: peer-checked: compiles to
                `.peer:checked ~ &`, a following-sibling combinator, so it
                cannot reach a descendant of a sibling. sr-only is
                position:absolute, so it is out of flow and never becomes a
                flex item.
                size-px! because input[type=radio]{width:18px;height:18px}
                is unlayered and beats sr-only's layered 1px.
                aria-label is gone: with an explicit htmlFor/id pair the
                name already comes from the label's subtree, and the
                attribute was subtracting the duration from it. */}
          <input
            id={`service-${service.id}`}
            type="radio"
            name="service"
            className="peer sr-only size-px!"
            value={service.id}
            checked={serviceId === service.id}
            onChange={() => onSelect(service.id)}
          />
          <span
            aria-hidden="true"
            className="mt-1 flex size-5 shrink-0 rounded-full border-[1.5px] border-[var(--ink-6b)] bg-[var(--screen)] transition-[background-color,border-color] duration-150 ease-out before:m-auto before:size-2 before:scale-0 before:rounded-full before:bg-[var(--white-text)] before:transition-transform before:duration-150 before:content-[''] peer-checked:border-[var(--blue-strong)] peer-checked:bg-[var(--blue-strong)] peer-checked:before:scale-100 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-input-border-active)]"
          />
          {/* --ink-body, not --ink-muted. Muted ink measures 4.04:1 on
                the selected row's wash in dark - the row is the one place
                on the card where the ground changes under the meta text,
                and it is the row the reader is most likely to read. The
                name still separates by weight, size and --ink. */}
          <span className="min-w-0 flex-1">
            <span className="block text-body-4-emphasis text-[var(--ink)]">{service.name}</span>
            <span className="mt-1 block text-caption-1 tabular-nums text-[var(--ink-body)]">
              {service.durationMinutes} min
            </span>
            {/* Fetched today and thrown away, which is exactly why these
                  rows looked so empty: the only thing each had to say was
                  "30 min". */}
            {service.description ? (
              <span className="mt-1 line-clamp-2 block text-caption-1 text-[var(--ink-body)]">
                {service.description}
              </span>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  </fieldset>
);

const DayAndTime = ({
  date,
  minDate,
  maxDate,
  bookingWindowDays,
  quickDays,
  onDateChange,
  slotsLoading,
  slots,
  slotsError,
  selectedTime,
  onSelectTime,
  slotGroupRef,
}: {
  date: string;
  minDate: string;
  maxDate: string;
  bookingWindowDays: number;
  quickDays: string[];
  onDateChange: (iso: string) => void;
  slotsLoading: boolean;
  slots: PublicSlot[] | null;
  slotsError: string | null;
  selectedTime: string | null;
  onSelectTime: (startTime: string) => void;
  slotGroupRef: React.RefObject<HTMLDivElement | null>;
}) => (
  <section>
    <h2 className={EYEBROW}>Day and time</h2>

    <div className="flex flex-col gap-2">
      {/* An htmlFor/id pair, not a wrapping label: getByLabelText matches
            the label's whole recursive textContent, so the hint has to sit
            outside it or it would leak into the accessible name. */}
      <label htmlFor="book-day" className="text-caption-1 text-[var(--ink-body)]">
        Preferred day
      </label>
      {/* Stays a native date input. The test reads .min and .max off the
            DOM node, and react-datepicker exposes neither. */}
      <input
        id="book-day"
        type="date"
        className={`${FIELD} tabular-nums`}
        value={date}
        min={minDate}
        max={maxDate}
        aria-describedby="book-day-hint"
        onChange={(event) => onDateChange(event.target.value)}
      />
      <p id="book-day-hint" className={META_TEXT}>
        {formatLongDay(date)} · you can book up to {bookingWindowDays} days ahead.
      </p>
    </div>

    {/* The near-term case, which is most of them, without going near the
          browser's own calendar widget. */}
    <div className="scrollbar-hidden -mx-1 mt-3 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
      {quickDays.map((iso, index) => (
        <button
          key={iso}
          type="button"
          aria-pressed={date === iso}
          onClick={() => onDateChange(iso)}
          className="min-h-11 shrink-0 rounded-full border-[1.5px] border-[var(--ink-6b)] bg-[var(--field-bg)] px-4 text-caption-1 text-[var(--ink)] transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-[var(--blue-strong)] hover:bg-[var(--blue-soft)] hover:text-[var(--blue-text)] active:translate-y-px aria-pressed:border-[var(--blue-strong)] aria-pressed:bg-[var(--blue-strong)] aria-pressed:text-[var(--white-text)]"
        >
          {quickDayLabel(index, iso)}
        </button>
      ))}
    </div>

    <SlotPicker
      loading={slotsLoading}
      error={slotsError}
      slots={slots}
      selectedTime={selectedTime}
      onSelect={onSelectTime}
      groupRef={slotGroupRef}
    />
  </section>
);

const DetailsFieldset = ({
  form,
  setField,
}: {
  form: FormValues;
  setField: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
}) => (
  <fieldset>
    <legend className={EYEBROW}>Your details</legend>
    {/* One line under the eyebrow, never an asterisk inside a label -
          getByLabelText matches the label's full text. */}
    <p id="required-note" className="mb-4 text-caption-1 text-[var(--ink-muted)]">
      Everything here is needed unless it says optional.
    </p>
    <div className="flex flex-col gap-5 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5">
      <div>
        <label htmlFor="book-name" className={FIELD_LABEL}>
          Your name
        </label>
        {/* autoComplete on every field that has a token. There were none
              before, so no browser offered a stranger their own details. */}
        <input
          id="book-name"
          className={FIELD}
          required
          maxLength={120}
          autoComplete="name"
          aria-describedby="required-note"
          value={form.ownerName}
          onChange={(event) => setField('ownerName', event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="book-email" className={FIELD_LABEL}>
          Email
        </label>
        <input
          id="book-email"
          className={FIELD}
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          placeholder="you@example.com"
          aria-describedby="required-note"
          value={form.ownerEmail}
          onChange={(event) => setField('ownerEmail', event.target.value)}
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="book-phone" className={FIELD_LABEL}>
          Phone (optional)
        </label>
        <input
          id="book-phone"
          className={FIELD}
          type="tel"
          maxLength={40}
          autoComplete="tel"
          inputMode="tel"
          placeholder="+49 30 1234567"
          value={form.ownerPhone}
          onChange={(event) => setField('ownerPhone', event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="book-pet" className={FIELD_LABEL}>
          Pet name
        </label>
        <input
          id="book-pet"
          className={FIELD}
          required
          maxLength={120}
          autoComplete="off"
          placeholder="Rex"
          aria-describedby="required-note"
          value={form.petName}
          onChange={(event) => setField('petName', event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="book-species" className={FIELD_LABEL}>
          Species
        </label>
        <input
          id="book-species"
          className={FIELD}
          required
          maxLength={60}
          autoComplete="off"
          placeholder="Dog, cat, rabbit…"
          aria-describedby="required-note"
          value={form.petSpecies}
          onChange={(event) => setField('petSpecies', event.target.value)}
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="book-concern" className={FIELD_LABEL}>
          What is the visit for? (optional)
        </label>
        <textarea
          id="book-concern"
          className={FIELD}
          rows={4}
          maxLength={1000}
          placeholder="Limping on the back left leg since Tuesday"
          value={form.concern}
          onChange={(event) => setField('concern', event.target.value)}
        />
      </div>
    </div>
  </fieldset>
);

const CheckAndSend = ({
  practiceName,
  consent,
  setField,
  submitError,
  statusLine,
  canSubmit,
  submitting,
}: {
  practiceName: string;
  consent: boolean;
  setField: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  submitError: string | null;
  statusLine: string;
  canSubmit: boolean;
  submitting: boolean;
}) => (
  <section>
    <h2 className={EYEBROW}>Check and send</h2>
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer items-start gap-3">
        {/* size-6! = 24px, clearing the target-size floor on the control
              itself. The ! is required: input[type=checkbox]{width:20px}
              is unlayered and non-important, so a plain size-6 in
              @layer utilities loses to it.
              shrink-0 because this is a flex item beside a two-line
              sentence - it used to compress into an oval on a narrow
              viewport, and it is the one control that gates submission.
              Appearance, radius, fill and tick already come from
              globals.css and flip correctly; do not restyle them. */}
        <input
          type="checkbox"
          className="size-6! shrink-0"
          checked={consent}
          onChange={(event) => setField('consent', event.target.checked)}
        />
        <span className="text-caption-1 text-[var(--ink-body)]">
          I agree that {practiceName} may store these details to handle my booking request. They are
          deleted 30 days after the requested date.
        </span>
      </label>

      {submitError ? <Callout role="alert">{submitError}</Callout> : null}

      <p id="submit-state" className={META_TEXT}>
        {statusLine}
      </p>

      {/* disabled:opacity-50 is gone. It composited fill and label
            against the page - 2.75:1 for the surface and 3.05:1 for the
            label - for the whole session, because first paint has neither
            a time nor consent. The replacement is 5.07:1 boundary and
            5.41:1 label, and "Sending" no longer looks identical to
            "you can't press this yet".
            NOT --color-surface-disabled: it is a fixed literal with no
            dark override, so it would strand this button as a pale bone
            slab on the espresso page. --inset flips. */}
      <button
        type="submit"
        disabled={!canSubmit}
        aria-describedby="submit-state"
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-transparent bg-[var(--cta)] px-6 text-body-4-emphasis text-[var(--cta-text)] shadow-[0_8px_22px_var(--sh16)] transition-[background-color,box-shadow,transform] duration-150 ease-out enabled:hover:bg-[var(--cta-hover)] enabled:active:translate-y-px enabled:active:shadow-[0_2px_8px_var(--sh12)] disabled:cursor-not-allowed disabled:border-[var(--ink-6b)] disabled:bg-[var(--inset)] disabled:text-[var(--ink-muted)] disabled:shadow-none"
      >
        {submitting ? (
          <>
            <Spinner />
            Sending…
          </>
        ) : (
          'Request this time'
        )}
      </button>

      <p className={META_TEXT}>Your details are only used to handle this request.</p>
    </div>
  </section>
);

const BookClient = ({ slug }: { slug: string }) => {
  const view = usePractice(slug);
  // Needed before the guard below, because the default service feeds `useSlots`
  // and every hook has to run on every render.
  const loaded = view.status === 'ready' ? view.practice : null;

  // Derived, not stored: the practice's first service is the default until the
  // reader picks another, so nothing has to write it when the practice loads.
  const [serviceOverride, setServiceOverride] = useState<string | null>(null);
  // The function, not its result: passing `todayIso()` re-derives today's date
  // on every render and throws the value away.
  const [date, setDate] = useState(todayIso);
  const serviceId = serviceOverride ?? loaded?.services[0]?.id ?? null;

  const [startTime, setStartTime] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const slotGroupRef = useRef<HTMLDivElement | null>(null);

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
        // letting the reader resubmit the same gone slot - and it disables the
        // button they just pressed, so focus has to go somewhere deliberate
        // rather than falling to <body> as the alert appears.
        if (error instanceof PublicBookingRequestError && error.status === 409) {
          setStartTime(null);
          slotGroupRef.current?.focus();
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
  const blockedReason = describeBlock(selectedTime, form.consent);
  const chosen = practice.services.find((service) => service.id === serviceId);
  // A COMPOUND string, deliberately. A bare `{chosen.name}` anywhere else on
  // the page puts a second element with that exact direct text in the tree, and
  // the test's getByText for the service name is singular - it would throw
  // "found multiple elements". Any recap renders "{name} · {n} min", never the
  // bare name.
  const summaryLine = chosen
    ? `${chosen.name} · ${chosen.durationMinutes} min · ${formatLongDay(date)} · ${selectedTime}`
    : '';

  // Five days at most, clamped to the practice's booking window, so a 3-day
  // window renders three chips. Pure state, no fetch of its own.
  const quickDays = Array.from({ length: 5 }, (_, index) => isoDaysFromToday(index)).filter(
    (iso) => iso <= maxDate
  );

  return (
    <BookShell>
      <Card>
        <PracticeHeader practice={practice} />

        {/* The page's honesty, printed on the document rather than whispered
            under the button. Must appear exactly once - the footnote below the
            submit button says something else on purpose. */}
        <div className="mx-5 mb-5 flex gap-3 rounded-r-xl border-l-[3px] border-[var(--ink)] bg-[var(--inset)] px-4 py-3 sm:mx-8">
          <ClockIcon className="mt-0.5 size-4 shrink-0 text-[var(--ink-muted)]" />
          <p className="text-body-4 text-[var(--ink-body)]">
            This sends a request, not a booking. {practice.name} will confirm the appointment with
            you, and the time is not held in the meantime.
          </p>
        </div>

        {practice.welcomeMessage ? (
          <p className="px-5 pb-5 text-body-4 text-[var(--ink-body)] sm:px-8">
            {practice.welcomeMessage}
          </p>
        ) : null}

        <form className="flex flex-col gap-8 px-5 pb-6 sm:px-8 sm:pb-8" onSubmit={handleSubmit}>
          <ServiceFieldset
            services={practice.services}
            serviceId={serviceId}
            onSelect={setServiceOverride}
          />

          <DayAndTime
            date={date}
            minDate={todayIso()}
            maxDate={maxDate}
            bookingWindowDays={practice.bookingWindowDays}
            quickDays={quickDays}
            onDateChange={setDate}
            slotsLoading={slotsLoading}
            slots={slots}
            slotsError={slotsError}
            selectedTime={selectedTime}
            onSelectTime={setStartTime}
            slotGroupRef={slotGroupRef}
          />

          <DetailsFieldset form={form} setField={setField} />

          <CheckAndSend
            practiceName={practice.name}
            consent={form.consent}
            setField={setField}
            submitError={submitError}
            statusLine={blockedReason ?? summaryLine}
            canSubmit={canSubmit}
            submitting={submitting}
          />
        </form>
      </Card>
      <BookFooter />
    </BookShell>
  );
};

export default BookClient;
