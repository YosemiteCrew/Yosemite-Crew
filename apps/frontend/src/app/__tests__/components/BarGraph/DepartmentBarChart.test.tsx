import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DepartmentBarChart from '@/app/components/BarGraph/DepartmentBarChart';

jest.mock('recharts', () => {
  let capturedProps: any = {};

  return {
    ...jest.requireActual('recharts'),
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    BarChart: (props: any) => {
      capturedProps = props;
      return <div data-testid="bar-chart">{props.children}</div>;
    },
    getCapturedProps: () => capturedProps,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Bar: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-element">{children}</div>,
    LabelList: () => <div data-testid="label-list" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    ReferenceLine: () => <div data-testid="reference-line" />,
  };
});

const recharts = jest.requireMock('recharts');

const mockDepartmentData = [
  { name: 'Cardiology', value: 150 },
  { name: 'Neurology', value: 120 },
  { name: 'Oncology', value: 95 },
];

describe('DepartmentBarChart Component', () => {
  beforeEach(() => {
  });

  test('should render the vertical bar chart and its elements', () => {
    render(<DepartmentBarChart data={mockDepartmentData} />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('bar-element')).toBeInTheDocument();
    expect(screen.getByTestId('label-list')).toBeInTheDocument();
  });

  test('should pass the correct data and layout props to the BarChart', () => {
    render(<DepartmentBarChart data={mockDepartmentData} />);

    const capturedProps = recharts.getCapturedProps();

    expect(capturedProps.layout).toBe('vertical');

    expect(capturedProps.data).toEqual(mockDepartmentData);
  });

  test('should render without errors when data is an empty array', () => {
    render(<DepartmentBarChart data={[]} />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();

    const capturedProps = recharts.getCapturedProps();

    expect(capturedProps.data).toEqual([]);
  });
});