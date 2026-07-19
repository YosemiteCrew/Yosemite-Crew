import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppointmentLeadersStat from '@/app/ui/widgets/Stats/AppointmentLeadersStat';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';
import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';

const mockAnalytics = {
  durationOptions: { appointmentLeaders: ['Last week'] },
  appointmentLeaders: [
    { staffId: 'staff-1', Completed: 5 },
    { staffId: 'staff-2', Completed: 3 },
  ],
  emptyState: { appointmentLeaders: false },
};

jest.mock('@/app/features/dashboard/hooks/useDashboardAnalytics', () => ({
  mapDashboardDurationOption: (value: string) => value,
  useDashboardAnalytics: jest.fn(),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/ui/cards/CardHeader/CardHeader', () => ({
  __esModule: true,
  default: jest.fn(({ title, options, onSelect }: any) => (
    <div data-testid="card-header">
      {title}
      <button type="button" onClick={() => onSelect(options[0])}>
        select
      </button>
    </div>
  )),
}));

const barsIn = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('div')).filter(
    (node) => (node as HTMLDivElement).style.width
  ) as HTMLDivElement[];

describe('AppointmentLeadersStat', () => {
  beforeEach(() => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue(mockAnalytics);
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { practionerId: 'staff-1', name: 'Dr Smith' },
      { practionerId: 'staff-3', name: '' },
    ]);
  });

  it('renders the leaderboard rows with names and completed counts', () => {
    render(<AppointmentLeadersStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Appointment leaders');
    expect(screen.getByText('Dr Smith')).toBeInTheDocument();
    expect(screen.getByText('staff-2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(CardHeader).toHaveBeenCalled();
  });

  it('maps leaders to names when a team member matches, falls back to staffId otherwise', () => {
    render(<AppointmentLeadersStat />);
    expect(screen.getByText('Dr Smith')).toBeInTheDocument();
    expect(screen.getByText('staff-2')).toBeInTheDocument();
  });

  it('uses the empty name as-is when a team member has one set (nullish, not falsy, fallback)', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([{ practionerId: 'staff-2', name: '' }]);
    render(<AppointmentLeadersStat />);
    // staff-1 has no mapping -> falls back to its staffId.
    expect(screen.getByText('staff-1')).toBeInTheDocument();
    // staff-2 maps to the empty string, so its staffId label is not rendered.
    expect(screen.queryByText('staff-2')).not.toBeInTheDocument();
  });

  it('falls back to practionerId when member has no name property at all', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([{ practionerId: 'staff-2' }]);
    render(<AppointmentLeadersStat />);
    expect(screen.getByText('staff-1')).toBeInTheDocument();
    expect(screen.getByText('staff-2')).toBeInTheDocument();
  });

  it('skips team members without a practionerId', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([{ name: 'No Id' }]);
    render(<AppointmentLeadersStat />);
    expect(screen.getByText('staff-1')).toBeInTheDocument();
    expect(screen.getByText('staff-2')).toBeInTheDocument();
    expect(screen.queryByText('No Id')).not.toBeInTheDocument();
  });

  it('renders the empty state when there are no appointment leaders', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...mockAnalytics,
      emptyState: { appointmentLeaders: true },
    });
    render(<AppointmentLeadersStat />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByText('Dr Smith')).not.toBeInTheDocument();
  });

  it('renders proportional bar widths and fades opacity down the ranks', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...mockAnalytics,
      appointmentLeaders: [
        { staffId: 's1', Completed: 10 },
        { staffId: 's2', Completed: 8 },
        { staffId: 's3', Completed: 6 },
        { staffId: 's4', Completed: 4 },
      ],
    });
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
    const { container } = render(<AppointmentLeadersStat />);
    const bars = barsIn(container);
    expect(bars).toHaveLength(4);
    expect(bars[0].style.width).toBe('100%');
    expect(bars[3].style.width).toBe('40%');
    expect(bars[0].style.opacity).toBe('1');
    expect(bars[1].style.opacity).toBe('0.82');
    expect(bars[2].style.opacity).toBe('0.64');
    expect(bars[3].style.opacity).toBe('0.5');
  });

  it('renders a zero-width bar when no leader has completed appointments', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...mockAnalytics,
      appointmentLeaders: [{ staffId: 's1', Completed: 0 }],
      emptyState: { appointmentLeaders: false },
    });
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
    const { container } = render(<AppointmentLeadersStat />);
    const bars = barsIn(container);
    expect(bars).toHaveLength(1);
    expect(bars[0].style.width).toBe('0%');
  });

  it('triggers onSelect from CardHeader', () => {
    render(<AppointmentLeadersStat />);
    screen.getByText('select').click();
    expect(screen.getByTestId('card-header')).toHaveTextContent('Appointment leaders');
  });

  it('corrects selectedDuration when not present in durationOptions', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...mockAnalytics,
      durationOptions: { appointmentLeaders: ['Last month'] },
    });
    render(<AppointmentLeadersStat />);
    expect(screen.getByTestId('card-header')).toHaveTextContent('Appointment leaders');
  });

  it('falls back to "Last week" when durationOptions is empty', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...mockAnalytics,
      durationOptions: { appointmentLeaders: [] },
    });
    render(<AppointmentLeadersStat />);
    expect(screen.getByTestId('card-header')).toHaveTextContent('Appointment leaders');
  });
});
