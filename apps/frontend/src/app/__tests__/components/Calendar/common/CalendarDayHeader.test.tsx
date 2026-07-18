import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CalendarDayHeader, {
  CalendarDayNav,
} from '@/app/features/appointments/components/Calendar/common/CalendarDayHeader';
import type { Team } from '@/app/features/organization/types/team';

jest.mock('@/app/ui/primitives/Icons/Back', () => ({
  __esModule: true,
  default: ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      back
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Next', () => ({
  __esModule: true,
  default: ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      next
    </button>
  ),
}));

jest.mock('@/app/features/appointments/components/Calendar/common/CalendarTeamNamesRow', () => ({
  CalendarTeamNamesRow: ({ team }: { team: Team[] }) => (
    <div data-testid="team-names-row">{team.length} members</div>
  ),
}));

const navProps = {
  weekday: 'Monday',
  dateNumber: '31',
  onPrevDay: jest.fn(),
  onNextDay: jest.fn(),
};

const team = [{ _id: 'u1', name: 'Dr Smith' }] as unknown as Team[];

describe('CalendarDayNav', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the weekday and date number', () => {
    render(<CalendarDayNav {...navProps} />);

    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
  });

  it('fires the day navigation callbacks', () => {
    render(<CalendarDayNav {...navProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'back' }));
    expect(navProps.onPrevDay).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'next' }));
    expect(navProps.onNextDay).toHaveBeenCalledTimes(1);
  });

  it('pins itself to the left of the scroll viewport and sizes to its own content', () => {
    // UserCalendar renders the nav inside an overflow-x-auto container on a min-w-max track
    // sized to the whole team grid. Without sticky left-0 the arrows scroll out of view, and
    // without w-fit they stretch across the full scrollable width.
    const { container } = render(<CalendarDayNav {...navProps} />);
    const nav = container.firstElementChild;

    expect(nav).toHaveClass('sticky');
    expect(nav).toHaveClass('left-0');
    expect(nav).toHaveClass('w-fit');
  });
});

describe('CalendarDayHeader', () => {
  it('renders the day nav above the team names row', () => {
    render(
      <CalendarDayHeader
        {...navProps}
        team={team}
        teamColumnsStyle={{ gridTemplateColumns: '1fr' }}
      />
    );

    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByTestId('team-names-row')).toHaveTextContent('1 members');
  });
});
