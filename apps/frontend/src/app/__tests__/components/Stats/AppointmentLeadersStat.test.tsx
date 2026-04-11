import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppointmentLeadersStat from '@/app/ui/widgets/Stats/AppointmentLeadersStat';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';
import DynamicChartCard from '@/app/ui/widgets/DynamicChart/DynamicChartCard';

jest.mock('@/app/ui/cards/CardHeader/CardHeader', () => ({
  __esModule: true,
  default: jest.fn(({ title }: any) => <div data-testid="card-header">{title}</div>),
}));

jest.mock('@/app/ui/widgets/DynamicChart/DynamicChartCard', () => ({
  __esModule: true,
  default: jest.fn(({ layout, hideKeys }: any) => (
    <div data-testid="chart" data-layout={layout} data-hide={String(hideKeys)} />
  )),
}));

describe('AppointmentLeadersStat', () => {
  it('renders leader chart', () => {
    render(<AppointmentLeadersStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Appointment leaders');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-hide', 'false');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-layout', 'vertical');
    expect(CardHeader).toHaveBeenCalled();
    expect(DynamicChartCard).toHaveBeenCalled();
  });
});
