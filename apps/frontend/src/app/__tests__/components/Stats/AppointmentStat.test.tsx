import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppointmentStat from '@/app/ui/widgets/Stats/AppointmentStat';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';
import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const MockDynamicChartCard = ({ data, keys, compactMonthAxis }: any) => (
      <div
        data-testid="chart"
        data-points={data.length}
        data-keys={keys.length}
        data-compact={String(compactMonthAxis)}
      />
    );
    MockDynamicChartCard.displayName = 'MockDynamicChartCard';
    return MockDynamicChartCard;
  },
}));

const mockAnalytics = {
  charts: {
    appointments: Array.from({ length: 7 }, (_, index) => ({
      month: `M${index + 1}`,
      Completed: index + 1,
      Cancelled: 0,
    })),
  },
  durationOptions: {
    appointments: ['Last week'],
  },
  emptyState: {
    appointmentsChart: false,
  },
};

jest.mock('@/app/features/dashboard/hooks/useDashboardAnalytics', () => ({
  mapDashboardDurationOption: (value: string) => value,
  useDashboardAnalytics: jest.fn(),
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

describe('AppointmentStat', () => {
  beforeEach(() => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue(mockAnalytics);
  });

  it('renders header and chart data', () => {
    render(<AppointmentStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Appointments');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-points', '7');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-keys', '2');
    expect(CardHeader).toHaveBeenCalled();
  });

  it('triggers onSelect from CardHeader', async () => {
    render(<AppointmentStat />);
    const button = screen.getByText('select');
    button.click();
    expect(screen.getByTestId('card-header')).toHaveTextContent('Appointments');
  });

  it('corrects selectedDuration when not present in durationOptions', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...mockAnalytics,
      durationOptions: { appointments: ['Last month'] },
    });
    render(<AppointmentStat />);
    expect(screen.getByTestId('chart')).toHaveAttribute('data-compact', 'true');
  });

  it('falls back to "Last week" when durationOptions is empty', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...mockAnalytics,
      durationOptions: { appointments: [] },
    });
    render(<AppointmentStat />);
    expect(screen.getByTestId('chart')).toHaveAttribute('data-compact', 'false');
  });
});
