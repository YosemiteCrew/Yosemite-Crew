import React from 'react';
import Link from 'next/link';
import { IoArrowForward, IoCalendarOutline } from 'react-icons/io5';
import AccordionButton from '@/app/ui/primitives/Accordion/AccordionButton';

const OnlineBooking = () => (
  <AccordionButton title="Online booking" showButton={false}>
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] px-5! py-4! sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--blue-soft)] text-[var(--blue-text)]">
          <IoCalendarOutline size={16} />
        </span>
        <span className="min-w-0">
          <span className="block text-[13.5px] font-bold text-[var(--ink)]">
            Set up your public booking page
          </span>
          <span className="block text-[12px] text-[var(--ink-muted)]">
            Choose bookable services, availability and branding, then share a public link.
          </span>
        </span>
      </div>
      <Link
        href="/public-booking-setup"
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--cta)] px-4 py-2 text-[12.5px] font-semibold text-[var(--cta-text)]"
      >
        Set up
        <IoArrowForward size={13} aria-hidden="true" />
      </Link>
    </div>
  </AccordionButton>
);

export default OnlineBooking;
