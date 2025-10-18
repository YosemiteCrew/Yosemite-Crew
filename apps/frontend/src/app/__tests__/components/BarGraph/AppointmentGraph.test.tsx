import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AppointmentGraph from '@/app/components/BarGraph/AppointmentGraph';

jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    BarChart: ({ children, data }: { children: React.ReactNode; data: any[] }) => (
      <div data-testid="bar-chart" data-chart-data={JSON.stringify(data || [])}>
        {children}
      </div>
    ),
    Bar: () => <div data-testid="bar-element" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    ReferenceLine: () => <div data-testid="reference-line" />,
  };
});

const mockAppointmentData = [
  { monthname: 'January', completed: 250, cancelled: 40 },
  { monthname: 'February', completed: 300, cancelled: 55 },
];

describe('AppointmentGraph Component', () => {
  test('should render the graph and its elements correctly', () => {
    render(<AppointmentGraph data={mockAppointmentData} />);

    expect(screen.getByText(/Completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Cancelled/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Appointments/i })).toBeInTheDocument();

    const barChart = screen.getByTestId('bar-chart');
    expect(barChart).toBeInTheDocument();

    const expectedFormattedData = [
      { name: 'January', completed: 250, cancelled: 40 },
      { name: 'February', completed: 300, cancelled: 55 },
    ];
    expect(barChart).toHaveAttribute(
      'data-chart-data',
      JSON.stringify(expectedFormattedData)
    );
  });

  test('should update the dropdown text upon selection', async () => {
    const user = userEvent.setup();
    render(<AppointmentGraph data={mockAppointmentData} />);

    const dropdownToggle = screen.getByRole('button', { name: /Appointments/i, expanded: false });
    await user.click(dropdownToggle);

    const revenueItem = screen.getByRole('button', { name: 'Revenue' });
    await user.click(revenueItem);

    const revenueButton = screen.getByRole('button', { name: /Revenue/i, expanded: false });
    expect(revenueButton).toBeInTheDocument();

  });

  test('should render without errors when data prop is empty or undefined', () => {
    const { rerender } = render(<AppointmentGraph data={[]} />);
    let barChart = screen.getByTestId('bar-chart');
    expect(barChart).toHaveAttribute('data-chart-data', JSON.stringify([]));

    rerender(<AppointmentGraph data={undefined} />);
    barChart = screen.getByTestId('bar-chart');
    expect(barChart).toHaveAttribute('data-chart-data', JSON.stringify([]));
  });
});

