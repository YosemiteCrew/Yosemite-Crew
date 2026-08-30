'use client';

import React from 'react';
import Link from 'next/link';
// Deep import on purpose. Card.tsx pulls in react and clsx and nothing else;
// the `@/app/ui` barrel re-exports Cards, whose SectionCard calls
// useSubscriptionForPrimaryOrg() and usePermissions() unconditionally - hooks
// that have no session to read on a public page.
import Card from '@/app/ui/Card';

/**
 * The shared surface for both public booking pages.
 *
 * `/book/<slug>` and `/book/<slug>/confirm` used to be two different designs -
 * 560px with p-5 on one, 520px with p-6 on the other - so the column visibly
 * jumped when a reader followed the emailed link. Everything that decides what
 * the pages look like lives here, and both import it.
 *
 * Components only. The class recipes live in `bookingStyles.ts` and the pure
 * helpers in `bookingFormat.ts`, because a module that exports both components
 * and non-components cannot preserve state across a Fast Refresh.
 */

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
