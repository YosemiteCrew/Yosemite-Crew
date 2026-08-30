import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { BookFooter, BookShell } from '@/app/(routes)/(book)/book/[slug]/bookingChrome';
import {
  describeBlock,
  formatLongDay,
  formatShortDay,
  groupByDayPart,
  quickDayLabel,
} from '@/app/(routes)/(book)/book/[slug]/bookingFormat';

const slot = (startTime: string) => ({ startTime, endTime: startTime });

describe('bookingFormat helpers', () => {
  // Pinned to en-GB and UTC in the source precisely so these strings are the
  // same here, in CI, and in a reader's browser whatever their locale.
  it('writes a short day for a chip and a long one for the hint', () => {
    expect(formatShortDay('2026-10-06')).toBe('Tue 6 Oct');
    expect(formatLongDay('2026-09-02')).toBe('Wednesday 2 September');
  });

  it('names the first two quick days in relative terms and dates the rest', () => {
    expect(quickDayLabel(0, '2026-09-01')).toBe('Today');
    expect(quickDayLabel(1, '2026-09-02')).toBe('Tomorrow');
    expect(quickDayLabel(2, '2026-10-06')).toBe('Tue 6 Oct');
  });

  it('splits times into the day parts that actually have any', () => {
    const groups = groupByDayPart([slot('08:30'), slot('13:00'), slot('19:00')]);

    expect(groups.map((group) => group.key)).toEqual(['morning', 'afternoon', 'evening']);
    expect(groups.map((group) => group.slots.length)).toEqual([1, 1, 1]);
  });

  it('drops a day part with nothing in it rather than heading an empty grid', () => {
    const groups = groupByDayPart([slot('09:00'), slot('10:00')]);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Morning');
  });

  it('names which precondition is missing, and says nothing once neither is', () => {
    expect(describeBlock(null, false)).toMatch(/Choose a time/);
    expect(describeBlock('09:00', false)).toMatch(/Tick the box/);
    expect(describeBlock('09:00', true)).toBeNull();
  });
});

describe('bookingChrome shell', () => {
  it('keeps the skip-link target the root layout points at', () => {
    render(
      <BookShell>
        <p>content</p>
      </BookShell>
    );

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveAttribute('tabindex', '-1');
  });

  it('tells a stranger whose page this is, and where the policies are', () => {
    render(<BookFooter />);

    expect(screen.getByText(/Booking page provided by Yosemite Crew/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/privacy-policy'
    );
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute(
      'href',
      '/terms-and-conditions'
    );
  });
});
