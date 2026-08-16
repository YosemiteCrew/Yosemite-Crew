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

  it('takes the shared header recipe rather than restating the band inline', () => {
    const { container } = render(<CalendarTeamNamesRow team={team} teamColumnsStyle={{}} />);

    const band = container.firstChild as HTMLElement;
    // The --screen-2 surface now comes from `.yc-table-head`, which also carries
    // the type, tracking and closing rule. Restating any of it inline is how
    // this band drifted to 9.5px/0.08em against the table's 10.5px/0.1em.
    expect(band).toHaveClass('yc-table-head');
    expect(band.style.background).toBe('');
    // Flush, or the labels stop lining up with the body columns; static,
    // because the gutter spacers below are sticky against the scroller.
    expect(band).toHaveClass('yc-table-head--flush', 'yc-table-head--static');
  });
});
