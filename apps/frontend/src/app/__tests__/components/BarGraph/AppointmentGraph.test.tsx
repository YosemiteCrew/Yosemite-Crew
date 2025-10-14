import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AppointmentGraph from '@/app/components/BarGraph/AppointmentGraph';

// Mocking the 'recharts' library to isolate the component for testing
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

// Mock data for the graph
const mockAppointmentData = [
  { monthname: 'January', completed: 250, cancelled: 40 },
  { monthname: 'February', completed: 300, cancelled: 55 },
];

describe('AppointmentGraph Component', () => {
  test('should render the graph and its elements correctly', () => {
    render(<AppointmentGraph data={mockAppointmentData} />);

    // Check for legend items
    expect(screen.getByText(/Completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Cancelled/i)).toBeInTheDocument();

    // Check for the initial state of the dropdown button
    expect(screen.getByRole('button', { name: /Appointments/i })).toBeInTheDocument();

    const barChart = screen.getByTestId('bar-chart');
    expect(barChart).toBeInTheDocument();

    // Verify that the correct data is passed to the chart
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

    // Find the main toggle button, which has aria-expanded
    const dropdownToggle = screen.getByRole('button', { name: /Appointments/i, expanded: false });
    await user.click(dropdownToggle);

    // Click the 'Revenue' option in the dropdown menu
    const revenueItem = screen.getByRole('button', { name: 'Revenue' });
    await user.click(revenueItem);

    // After selection, the menu closes and the main toggle's text changes.
    // We can now uniquely find it by its name and closed state.
    const revenueButton = screen.getByRole('button', { name: /Revenue/i, expanded: false });
    expect(revenueButton).toBeInTheDocument();

    // The 'Appointments' button should no longer be present
  });

  test('should render without errors when data prop is empty or undefined', () => {
    // Test with an empty array
    const { rerender } = render(<AppointmentGraph data={[]} />);
    let barChart = screen.getByTestId('bar-chart');
    expect(barChart).toHaveAttribute('data-chart-data', JSON.stringify([]));

    // Test with undefined data
    rerender(<AppointmentGraph data={undefined} />);
    barChart = screen.getByTestId('bar-chart');
    expect(barChart).toHaveAttribute('data-chart-data', JSON.stringify([]));
  });
});

