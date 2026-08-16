import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CalendarTeamNamesRow } from '@/app/features/appointments/components/Calendar/common/CalendarTeamNamesRow';
import type { Team } from '@/app/features/organization/types/team';

jest.mock('@/app/features/appointments/components/Calendar/common/UserLabels', () => ({
  __esModule: true,
  default: ({ team }: { team: Team[] }) => (
    <div data-testid="user-labels">{team.map((member) => member.name).join(',')}</div>
  ),
}));

describe('CalendarTeamNamesRow', () => {
  const team = [
    { _id: '1', name: 'Dr. Sarah Weber' },
    { _id: '2', name: 'Dr. Matteo Brunner' },
  ] as unknown as Team[];

  it('renders the team labels between the sticky gutters', () => {
    render(
      <CalendarTeamNamesRow team={team} teamColumnsStyle={{ gridTemplateColumns: '1fr 1fr' }} />
    );

    expect(screen.getByTestId('user-labels')).toHaveTextContent(
      'Dr. Sarah Weber,Dr. Matteo Brunner'
    );
  });

  it('keeps the warm band but not the header type, whose casing would eat the names', () => {
    const { container } = render(<CalendarTeamNamesRow team={team} teamColumnsStyle={{}} />);

    const band = container.firstChild as HTMLElement;
    expect(band.style.background).toContain('var(--screen-2)');
    // NOT `.yc-table-head`: its `text-transform: uppercase` and 0.1em tracking
    // inherit into UserLabels, which resets neither, so "Dr. Sarah Weber" and
    // her speciality subline render as wide-tracked capitals. These labels are
    // practitioner names - data - not column nouns.
    expect(band).not.toHaveClass('yc-table-head');
    // The band's own defect stays fixed: it closed on --color-neutral-200 while
    // every sibling calendar band closes on --hairline.
    expect(band.className).toContain('border-[var(--hairline)]');
    expect(band.className).not.toContain('border-card-border');
  });
});
