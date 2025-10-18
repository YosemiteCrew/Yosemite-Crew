import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardChart from '@/app/components/BarGraph/DashboardChart';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children, data }: { children: React.ReactNode; data: any[] }) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  AreaChart: ({ children, data }: { children: React.ReactNode; data: any[] }) => (
    <div data-testid="area-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Bar: () => <div data-testid="bar-element" />,
  Area: () => <div data-testid="area-element" />,
}));

const mockBarData = [
  { month: 'Jan', completed: 100, cancelled: 20 },
  { month: 'Feb', completed: 150, cancelled: 10 },
];

const mockLineData = [
  { month: 'Jan', revenue: 5000 },
  { month: 'Feb', revenue: 7500 },
];

describe('DashboardChart Component', () => {

  test('should render the empty state when showEmpty is true', () => {
    render(<DashboardChart data={[]} type="bar" showEmpty={true} />);

    expect(screen.getByText('No data available')).toBeInTheDocument();

    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();
  });

  test('should render a BarChart when type is "bar" and showEmpty is false', () => {
    render(<DashboardChart data={mockBarData} type="bar" />);

    const barChart = screen.getByTestId('bar-chart');
    expect(barChart).toBeInTheDocument();
    expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();

    expect(barChart).toHaveAttribute('data-chart-data', JSON.stringify(mockBarData));

    expect(screen.queryByText('No data available')).not.toBeInTheDocument();
  });

  test('should render an AreaChart when type is "line" and showEmpty is false', () => {
    render(<DashboardChart data={mockLineData} type="line" />);

    const areaChart = screen.getByTestId('area-chart');
    expect(areaChart).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();

    expect(areaChart).toHaveAttribute('data-chart-data', JSON.stringify(mockLineData));

    expect(screen.queryByText('No data available')).not.toBeInTheDocument();
  });
});