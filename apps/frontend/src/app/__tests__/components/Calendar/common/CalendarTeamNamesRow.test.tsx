import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CalendarTeamNamesRow } from '@/app/features/appointments/components/Calendar/common/CalendarTeamNamesRow';
import type { Team } from '@/app/features/organization/types/team';

const mockUserLabelsSpy = jest.fn();

jest.mock('@/app/features/appointments/components/Calendar/common/UserLabels', () => ({
  __esModule: true,
  default: (props: { team: Team[]; appointmentCounts?: Record<string, number> }) => {
    mockUserLabelsSpy(props);
    return <div data-testid="user-labels">{props.team.map((member) => member.name).join(',')}</div>;
  },
}));

describe('CalendarTeamNamesRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('paints the header band with a theme-aware surface, not hardcoded white', () => {
    const { container } = render(<CalendarTeamNamesRow team={team} teamColumnsStyle={{}} />);

    const band = container.firstChild as HTMLElement;
    expect(band.style.background).toContain('var(--screen)');
    expect(band.style.background).not.toContain('white');
  });

  it('forwards per-practitioner appointment counts to the user labels', () => {
    render(
      <CalendarTeamNamesRow
        team={team}
        teamColumnsStyle={{}}
        appointmentCounts={{ '1': 4, '2': 0 }}
      />
    );

    expect(mockUserLabelsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentCounts: { '1': 4, '2': 0 } })
    );
  });
});
