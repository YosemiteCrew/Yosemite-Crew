import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DynamicChartCard from '@/app/ui/widgets/DynamicChart/DynamicChartCard';

let yAxisProps: any = {};
let xAxisProps: any = {};

// The card lazy-loads one module (ChartCanvas), so resolve it synchronously and
// let the real canvas render against the mocked recharts below.
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    // Exercise the real loader so its import path is covered.
    void loader().catch(() => undefined);
    const LoadableChartCanvas = (props: Record<string, unknown>) => {
      // requireActual only un-mocks the canvas itself; its own `recharts` import
      // still resolves to the mock below.
      const Canvas = jest.requireActual('@/app/ui/widgets/DynamicChart/ChartCanvas')
        .default as React.ComponentType<any>;
      return React.createElement(Canvas, props);
    };
    LoadableChartCanvas.displayName = 'MockDynamicChartCanvas';
    return LoadableChartCanvas;
  },
}));

jest.mock('recharts', () => {
  const Recharts = jest.requireActual('recharts');
  return {
    ...Recharts,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    BarChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="bar-chart">{children}</div>
    ),
    LineChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="line-chart">{children}</div>
    ),
    XAxis: (props: any) => {
      xAxisProps = props;
      return <div data-testid="x-axis" />;
    },
    YAxis: (props: any) => {
      yAxisProps = props;
      return <div data-testid="y-axis" />;
    },
    Tooltip: () => <div data-testid="tooltip" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Bar: ({ name }: { name: string }) => <div data-testid="bar-element">{name}</div>,
    Line: ({ name }: { name: string }) => <div data-testid="line-element">{name}</div>,
    Legend: ({ payload }: { payload: { value: string }[] }) => (
      <div data-testid="legend">
        {payload.map((entry) => (
          <span key={entry.value}>{entry.value}</span>
        ))}
      </div>
    ),
  };
});

const mockData = [
  { month: 'Jan', sales: 4000, profit: 2400 },
  { month: 'Feb', sales: 3000, profit: 1398 },
];

const mockKeys = [
  { name: 'sales', color: 'rgb(54, 162, 235)' },
  { name: 'profit', color: 'rgb(75, 192, 192)' },
];

const mockTickFormatter = (value: number) => `$${value / 1000}K`;

describe('DynamicChartCard Component', () => {
  beforeAll(async () => {
    // Settle the fire-and-forget loader promises invoked at module import.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  beforeEach(() => {
    yAxisProps = {};
    xAxisProps = {};
  });

  test('should render a BarChart by default and display the legend', () => {
    render(<DynamicChartCard data={mockData} keys={mockKeys} />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();

    const barElements = screen.getAllByTestId('bar-element');
    expect(barElements).toHaveLength(mockKeys.length);

    for (const key of mockKeys) {
      expect(screen.getByText(key.name)).toBeInTheDocument();
    }
  });

  test('should render a LineChart when type prop is "line"', () => {
    render(<DynamicChartCard data={mockData} keys={mockKeys} type="line" />);

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();

    const lineElements = screen.getAllByTestId('line-element');
    expect(lineElements).toHaveLength(mockKeys.length);
  });

  test('should pass the yTickFormatter prop to the YAxis component', () => {
    render(<DynamicChartCard data={mockData} keys={mockKeys} yTickFormatter={mockTickFormatter} />);

    expect(yAxisProps.tickFormatter).toBe(mockTickFormatter);

    expect(yAxisProps.tickFormatter(5000)).toBe('$5K');
  });

  test('should render without chart elements or legend when keys array is empty', () => {
    render(<DynamicChartCard data={mockData} keys={[]} />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();

    expect(screen.queryByTestId('bar-element')).not.toBeInTheDocument();

    expect(screen.queryByText('sales')).not.toBeInTheDocument();
    expect(screen.queryByText('profit')).not.toBeInTheDocument();
  });

  test('should compact x-axis labels for month view when compactMonthAxis is enabled', () => {
    render(
      <DynamicChartCard
        data={[
          { month: '2026-03-01', sales: 10 },
          { month: '2026-03-02', sales: 12 },
          { month: '2026-03-03', sales: 14 },
        ]}
        keys={[{ name: 'sales', color: 'rgb(54, 162, 235)' }]}
        compactMonthAxis
      />
    );

    expect(xAxisProps.interval).toBe('preserveStartEnd');
    expect(xAxisProps.minTickGap).toBe(12);
    expect(xAxisProps.tickFormatter('2026-03-08')).toBe('8');
    expect(xAxisProps.label?.value).toBe('Mar 2026');
  });

  test('renders the empty state when isEmpty is set', () => {
    render(<DynamicChartCard data={[]} keys={mockKeys} isEmpty chartHeight={220} />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });

  test('renders a vertical bar layout with tilted y ticks', () => {
    render(
      <DynamicChartCard
        data={mockData}
        keys={mockKeys}
        layout="vertical"
        yAxisWidth={80}
        yTickFormatter={mockTickFormatter}
        yAxisLabel="Revenue"
      />
    );

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(xAxisProps.dataKey).toBeUndefined();
    expect(xAxisProps.type).toBe('number');
    expect(yAxisProps.dataKey).toBe('month');
    expect(yAxisProps.type).toBe('category');
    expect(yAxisProps.width).toBe(100);
    expect(yAxisProps.tickFormatter).toBeUndefined();
    // Vertical layout suppresses the y-axis label.
    expect(yAxisProps.label).toBeUndefined();
    // The tick renderer is the custom TiltedYTick component.
    const tickNode = yAxisProps.tick({ x: 5, y: 6, payload: { value: 'Mon' } });
    expect(tickNode).toBeTruthy();
  });

  test('applies the horizontal y-axis label and margin', () => {
    render(<DynamicChartCard data={mockData} keys={mockKeys} yAxisLabel="Revenue" />);

    expect(yAxisProps.label).toEqual(
      expect.objectContaining({ value: 'Revenue', angle: -90, position: 'insideLeft' })
    );
  });

  test('configures a numeric line axis with domain, ticks and labels', () => {
    render(
      <DynamicChartCard
        type="line"
        data={[
          { x: 0, sales: 1 },
          { x: 5, sales: 2 },
        ]}
        keys={[{ name: 'sales', color: 'red' }]}
        xAxisType="number"
        xAxisDataKey="x"
        xAxisDomain={[0, 10]}
        xAxisTicks={[0, 5, 10]}
        yAxisLabel="Units"
        compactMonthAxis
      />
    );

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(xAxisProps.scale).toBe('linear');
    expect(xAxisProps.allowDataOverflow).toBe(true);
    expect(xAxisProps.interval).toBe('preserveStartEnd');
    expect(xAxisProps.minTickGap).toBe(12);
    expect(xAxisProps.domain).toEqual([0, 10]);
    expect(xAxisProps.ticks).toEqual([0, 5, 10]);
    // A numeric axis is not a category axis, so no day-tick formatter is applied.
    expect(xAxisProps.tickFormatter).toBeUndefined();
    expect(yAxisProps.label).toEqual(
      expect.objectContaining({ value: 'Units', angle: -90, offset: 4 })
    );
  });

  test('uses the day tick formatter for a compact category line axis', () => {
    render(
      <DynamicChartCard
        type="line"
        data={[
          { month: '2026-03-01', sales: 1 },
          { month: '2026-03-02', sales: 2 },
        ]}
        keys={[{ name: 'sales', color: 'red' }]}
        compactMonthAxis
      />
    );

    expect(typeof xAxisProps.tickFormatter).toBe('function');
    // Parseable date -> formatted day.
    expect(xAxisProps.tickFormatter('2026-03-09')).toBe('9');
    // Unparseable but has a day token.
    expect(xAxisProps.tickFormatter('Week 20')).toBe('20');
    // Unparseable (Date.parse rejects even with a year appended) and no day
    // token -> original value passes through unchanged.
    expect(xAxisProps.tickFormatter('1999 2000')).toBe('1999 2000');
    expect(xAxisProps.label?.value).toBe('Mar 2026');
  });

  test('prefers a provided x tick formatter on the line axis', () => {
    const formatter = (value: string | number) => `#${value}`;
    render(
      <DynamicChartCard type="line" data={mockData} keys={mockKeys} xTickFormatter={formatter} />
    );

    expect(xAxisProps.tickFormatter).toBe(formatter);
    expect(xAxisProps.scale).toBe('point');
  });

  test('derives month labels from name tokens and falls back to xAxisLabel', () => {
    const { rerender } = render(
      <DynamicChartCard
        data={[
          { month: 'Jan', sales: 1 },
          { month: 'Feb', sales: 2 },
        ]}
        keys={[{ name: 'sales', color: 'red' }]}
        compactMonthAxis
      />
    );

    // Jan/Feb parse via the current-year fallback; different months -> month name token.
    expect(xAxisProps.label?.value).toBe('Jan');

    rerender(
      <DynamicChartCard
        data={[{ month: 'Q1' }, { month: 'Q2' }]}
        keys={[{ name: 'sales', color: 'red' }]}
        compactMonthAxis
        xAxisLabel="Quarter"
      />
    );

    // Unparseable, no month token -> undefined -> falls back to the provided xAxisLabel.
    expect(xAxisProps.label?.value).toBe('Quarter');
  });

  test('renders header and footer content and hides the legend', () => {
    render(
      <DynamicChartCard
        data={mockData}
        keys={mockKeys}
        headerContent={<div>custom-header</div>}
        footerContent={<div>custom-footer</div>}
      />
    );

    expect(screen.getByText('custom-header')).toBeInTheDocument();
    expect(screen.getByText('custom-footer')).toBeInTheDocument();
    // headerContent replaces the default legend.
    expect(screen.queryByText('sales')).not.toBeInTheDocument();
  });
});
