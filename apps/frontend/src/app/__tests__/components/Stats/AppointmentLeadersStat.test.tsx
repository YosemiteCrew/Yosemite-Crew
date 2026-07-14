import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppointmentLeadersStat from '@/app/ui/widgets/Stats/AppointmentLeadersStat';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';
import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const MockDynamicChartCard = ({ layout, hideKeys, keys, data }: any) => (
      <div
        data-testid="chart"
        data-layout={layout}
        data-hide={String(hideKeys)}
        data-colors={(keys ?? []).map((key: { color: string }) => key.color).join(',')}
        data-names={data.map((d: any) => d.month).join(',')}
      />
    );
    MockDynamicChartCard.displayName = 'MockDynamicChartCard';
    return MockDynamicChartCard;
  },
}));

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

describe('AppointmentLeadersStat', () => {
  beforeEach(() => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue(mockAnalytics);
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { practionerId: 'staff-1', name: 'Dr Smith' },
      { practionerId: 'staff-3', name: '' },
    ]);
  });

  it('renders leader chart', () => {
    render(<AppointmentLeadersStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Appointment leaders');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-hide', 'false');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-layout', 'vertical');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-colors', 'var(--cta)');
    expect(CardHeader).toHaveBeenCalled();
  });

  it('maps leaders to names when a team member matches, falls back to staffId otherwise', () => {
    render(<AppointmentLeadersStat />);
    expect(screen.getByTestId('chart')).toHaveAttribute('data-names', 'Dr Smith,staff-2');
  });

  it('uses the empty name as-is when a team member has one set (nullish, not falsy, fallback)', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([{ practionerId: 'staff-2', name: '' }]);
    render(<AppointmentLeadersStat />);
    expect(screen.getByTestId('chart')).toHaveAttribute('data-names', 'staff-1,');
  });

  it('falls back to practionerId when member has no name property at all', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([{ practionerId: 'staff-2' }]);
    render(<AppointmentLeadersStat />);
    expect(screen.getByTestId('chart')).toHaveAttribute('data-names', 'staff-1,staff-2');
  });

  it('skips team members without a practionerId', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([{ name: 'No Id' }]);
    render(<AppointmentLeadersStat />);
    expect(screen.getByTestId('chart')).toHaveAttribute('data-names', 'staff-1,staff-2');
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
