import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppointmentLeadersStat from '@/app/ui/widgets/Stats/AppointmentLeadersStat';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const MockDynamicChartCard = ({ layout, hideKeys }: any) => (
      <div data-testid="chart" data-layout={layout} data-hide={String(hideKeys)} />
    );
    MockDynamicChartCard.displayName = 'MockDynamicChartCard';
    return MockDynamicChartCard;
  },
}));

jest.mock('@/app/ui/cards/CardHeader/CardHeader', () => ({
  __esModule: true,
  default: jest.fn(({ title }: any) => <div data-testid="card-header">{title}</div>),
}));

describe('AppointmentLeadersStat', () => {
  it('renders leader chart', () => {
    render(<AppointmentLeadersStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Appointment leaders');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-hide', 'false');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-layout', 'vertical');
    expect(CardHeader).toHaveBeenCalled();
  });
});
