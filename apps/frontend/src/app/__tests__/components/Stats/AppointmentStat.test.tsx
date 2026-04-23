import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppointmentStat from '@/app/ui/widgets/Stats/AppointmentStat';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';
import DynamicChartCard from '@/app/ui/widgets/DynamicChart/DynamicChartCard';

jest.mock('@/app/features/dashboard/hooks/useDashboardAnalytics', () => ({
  mapDashboardDurationOption: (value: string) => value,
  useDashboardAnalytics: () => ({
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
  }),
}));

jest.mock('@/app/ui/cards/CardHeader/CardHeader', () => ({
  __esModule: true,
  default: jest.fn(({ title }: any) => <div data-testid="card-header">{title}</div>),
}));

jest.mock('@/app/ui/widgets/DynamicChart/DynamicChartCard', () => ({
  __esModule: true,
  default: jest.fn(({ data, keys }: any) => (
    <div data-testid="chart" data-points={data.length} data-keys={keys.length} />
  )),
}));

describe('AppointmentStat', () => {
  it('renders header and chart data', () => {
    render(<AppointmentStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Appointments');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-points', '7');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-keys', '2');
    expect(CardHeader).toHaveBeenCalled();
    expect(DynamicChartCard).toHaveBeenCalled();
  });
});
