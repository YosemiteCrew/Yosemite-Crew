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

  it('paints the header band with the warm --screen-2 surface, not a blue tint or white', () => {
    const { container } = render(<CalendarTeamNamesRow team={team} teamColumnsStyle={{}} />);

    const band = container.firstChild as HTMLElement;
    expect(band.style.background).toContain('var(--screen-2)');
    expect(band.style.background).not.toContain('white');
    expect(band.style.background).not.toContain('brand');
  });
});
