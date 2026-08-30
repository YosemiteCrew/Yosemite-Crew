'use client';

import React from 'react';
import Link from 'next/link';
// Deep import on purpose. Card.tsx pulls in react and clsx and nothing else;
// the `@/app/ui` barrel re-exports Cards, whose SectionCard calls
// useSubscriptionForPrimaryOrg() and usePermissions() unconditionally - hooks
// that have no session to read on a public page.
import Card from '@/app/ui/Card';
import type { PublicSlot } from '@/app/features/publicBooking/services/publicBooking.service';

/**
 * The shared surface for both public booking pages.
 *
 * `/book/<slug>` and `/book/<slug>/confirm` used to be two different designs -
 * 560px with p-5 on one, 520px with p-6 on the other - so the column visibly
 * jumped when a reader followed the emailed link. Everything that decides what
 * the pages look like lives here, and both import it.
 *
 * On the class strings below: several carry a trailing `!`, and none of them is
 * decorative. globals.css declares its own @layer blocks, and everything
 * between them is unlayered. For normal declarations an unlayered rule beats a
 * layered one whatever the specificity, so a plain Tailwind utility loses to
 * any unlayered rule setting the same property; for important declarations the
 * order reverses. Each `!` below names the rule it is beating.
 */

/**
 * Every text field, textarea and the date input.
 *
 * The focus indicator is a box-shadow, not an outline, and that is forced:
 * `input:focus-visible { outline: none }` is unlayered, so no `outline-*`
 * utility can ever beat it. The old recipe also set `outline-none` itself,
 * which was redundant against that rule and actively harmful - `outline` is the
 * one property forced-colors mode preserves.
 */
export const FIELD =
  'w-full min-h-12 rounded-xl border-[1.5px] border-[var(--ink-6b)] bg-[var(--field-bg)] ' +
  'px-4 py-3 text-body-4 text-[var(--ink-body)] placeholder:text-[var(--ink-muted)] ' +
  'transition-[border-color,box-shadow] duration-150 ease-out ' +
  'hover:border-[var(--ink)] ' +
  'focus-visible:border-[var(--color-input-border-active)] ' +
  'focus-visible:shadow-[0_0_0_3px_var(--glow-b26)]';

/**
 * Time slots and quick-day chips.
 *
 * Selection is a fill, not a border-colour swap. The old recipe changed only
 * the border, which is a 3.01:1 delta in light and 2.88:1 in dark - and it was
 * written as an inline `style` object, which is why the page had no hover,
 * focus or active state anywhere: a style attribute has no pseudo-classes.
 *
 * Tailwind's `aria-pressed:` variant compiles to `[aria-pressed="true"]`, so
 * React still renders the literal "false" the tests read.
 */
export const PILL =
  'flex min-h-11 items-center justify-center rounded-full border-[1.5px] border-[var(--ink-6b)] ' +
  'bg-[var(--field-bg)] px-2 text-body-4-emphasis tabular-nums text-[var(--ink)] ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out ' +
  'hover:border-[var(--blue-strong)] hover:bg-[var(--blue-soft)] hover:text-[var(--blue-text)] ' +
  'active:translate-y-px ' +
  'aria-pressed:border-[var(--blue-strong)] aria-pressed:bg-[var(--blue-strong)] ' +
  'aria-pressed:text-[var(--white-text)] aria-pressed:shadow-[0_6px_16px_var(--glow-b26)]';

/**
 * The time grid, sized by its content rather than by breakpoints.
 *
 * auto-fill with a 4.5rem floor gives three columns on a 320px phone, four on a
 * 390px one and six on the desktop card, without a single breakpoint prefix and
 * without ever dropping a pill under the 44px target. A fixed `grid-cols-3`
 * made a 27-slot day nine rows deep on a phone, which is most of why the
 * redesign was running longer than the page it replaced.
 */
export const SLOT_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2';

/** The label above a field. Named because six fields share it, and Sonar
 *  counts a class string repeated three times as a duplicated literal. */
export const FIELD_LABEL = 'mb-2 block text-caption-1 text-[var(--ink-body)]';

/** Quiet supporting copy: hints, the status line, footnotes. */
export const META_TEXT = 'text-caption-1 text-[var(--ink-muted)]';

/** Body copy in a centred state card, measured for a comfortable line length. */
export const STATE_BODY = 'max-w-[46ch] text-body-4 text-[var(--ink-body)]';

/** Section eyebrows. `font-bold` and the tracking are utilities, so they beat
 *  .text-caption-2's own weight and tracking in @layer components. */
export const EYEBROW =
  'mb-4 block text-caption-2 font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]';

/**
 * `min-h-svh`, not `min-h-screen` (100vh overflows by the height of the iOS
 * toolbar) and not dvh (which jitters as browser chrome collapses).
 *
 * The id and tabIndex are load-bearing: the root layout's SkipLink targets
 * them, and globals.css sets their scroll-margin.
 */
export const BookShell = ({ children }: { children: React.ReactNode }) => (
  <main
    id="main-content"
    tabIndex={-1}
    className="min-h-svh w-full bg-[var(--page)] px-4 py-8 sm:px-6 sm:py-12"
  >
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 lg:max-w-[720px]">
      {children}
    </div>
  </main>
);

export const BookFooter = () => (
  <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-caption-2 text-[var(--ink-muted)]">
    <span>Booking page provided by Yosemite Crew</span>
    {/* `underline!`, not `underline`: `a { text-decoration: none !important }`
        is unlayered, and a layered non-important utility loses to it. */}
    <Link
      href="/privacy-policy"
      className="underline! underline-offset-2 transition-colors duration-150 ease-out hover:text-[var(--ink-body)]"
    >
      Privacy
    </Link>
    <Link
      href="/terms-and-conditions"
      className="underline! underline-offset-2 transition-colors duration-150 ease-out hover:text-[var(--ink-body)]"
    >
      Terms
    </Link>
  </footer>
);

const DISC_TONES = {
  brand: 'bg-[var(--blue-soft)] text-[var(--blue-text)]',
  warn: 'bg-[var(--warn-bg)] text-[var(--warn-text)]',
  success: 'bg-[var(--inset)] text-[var(--success-text)]',
} as const;

export const IconDisc = ({
  tone,
  children,
}: {
  tone: keyof typeof DISC_TONES;
  children: React.ReactNode;
}) => (
  <span
    aria-hidden="true"
    className={`flex size-11 shrink-0 items-center justify-center rounded-full ${DISC_TONES[tone]}`}
  >
    {children}
  </span>
);

export const WarnIcon = ({ className = 'size-5 shrink-0' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 6v4.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="13.75" r="0.9" fill="currentColor" />
  </svg>
);

export const CheckIcon = ({ className = 'size-5 shrink-0' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <path
      d="m4.75 10.5 3.4 3.4 7.1-7.9"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ClockIcon = ({ className = 'size-5 shrink-0' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 5.5V10l3 1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const Spinner = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-4 shrink-0 animate-spin">
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" opacity="0.3" />
    <path d="M18 10a8 8 0 0 0-8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * One tone, on purpose.
 *
 * Everything this page can report - times would not load, the request would not
 * send, the slot went while the form was open - means "we could not do this
 * yet", never "something was destroyed". Two colours for one meaning is
 * vocabulary the page has not earned.
 *
 * The svg is a sibling of the text, and svg is phrasing content, so this raises
 * no validateDOMNesting error - which matters, because jest.setup.ts turns
 * console.error into a throw.
 */
export const Callout = ({
  children,
  role,
  className = '',
}: {
  children: React.ReactNode;
  role?: 'alert';
  className?: string;
}) => (
  <p
    role={role}
    className={`flex items-start gap-3 rounded-xl border border-[var(--warn-border)] bg-[var(--warn-bg)] px-4 py-3 text-caption-1 text-[var(--warn-text)] ${className}`}
  >
    <WarnIcon className="mt-0.5 size-4 shrink-0" />
    <span>{children}</span>
  </p>
);

/**
 * The shape every state that replaces the form takes, so the page never
 * changes size under the reader.
 *
 * A `[tabindex='-1']` element is excluded from the global focus-ring selector,
 * so moving focus here after a submit draws no ring - correct for a status
 * region that the reader did not tab to.
 */
export const StateCard = ({
  icon,
  heading,
  headingLevel = 'h2',
  innerRef,
  children,
}: {
  icon: React.ReactNode;
  heading: string;
  headingLevel?: 'h1' | 'h2';
  innerRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) => {
  const Heading = headingLevel;
  return (
    <Card className="p-5 sm:p-8">
      <div
        ref={innerRef}
        tabIndex={innerRef ? -1 : undefined}
        className="flex flex-col items-center gap-4 text-center"
      >
        {icon}
        <Heading className="text-heading-2 text-[var(--ink)]">{heading}</Heading>
        {children}
      </div>
    </Card>
  );
};

/** A shimmering placeholder block. A div, so it adds no phantom role. */
export const Skeleton = ({ className }: { className: string }) => (
  <div className={`bg-[var(--band)] yc-shimmer ${className}`} />
);

const UTC_DAY = (iso: string) => new Date(`${iso}T00:00:00Z`);

// Pinned to en-GB and UTC so the strings are the same in jest, in CI and in the
// browser, whatever the machine's locale and zone.
export const formatShortDay = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(UTC_DAY(iso));

export const formatLongDay = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(UTC_DAY(iso));

const RELATIVE_DAY_LABELS = ['Today', 'Tomorrow'] as const;

/** Indexed rather than nested ternaries, which Sonar rejects. */
export const quickDayLabel = (index: number, iso: string) =>
  RELATIVE_DAY_LABELS[index] ?? formatShortDay(iso);

export const DAY_PARTS = [
  { key: 'morning', label: 'Morning', until: 12 },
  { key: 'afternoon', label: 'Afternoon', until: 17 },
  { key: 'evening', label: 'Evening', until: 24 },
] as const;

/**
 * Twenty-seven identical capsules in one flat wrap is a wall, not a choice.
 *
 * One map over a fixed list with no per-group conditional, so a fixture of
 * three slots exercises every path in it.
 */
export const groupByDayPart = (slots: PublicSlot[]) =>
  DAY_PARTS.map((part, index) => {
    const from = index === 0 ? 0 : DAY_PARTS[index - 1].until;
    return {
      ...part,
      slots: slots.filter((slot) => {
        const hour = Number(slot.startTime.slice(0, 2));
        return hour >= from && hour < part.until;
      }),
    };
  }).filter((group) => group.slots.length > 0);

/**
 * Which of the two preconditions is missing, in words.
 *
 * The submit button is disabled from first paint until a time is chosen and
 * consent is ticked, and nothing on the page used to say which. Returns null
 * when neither is missing, and the caller shows the chosen summary instead.
 */
export const describeBlock = (selectedTime: string | null, consent: boolean) => {
  if (!selectedTime) return 'Choose a time above to send your request.';
  if (!consent) return 'Tick the box above to send your request.';
  return null;
};
