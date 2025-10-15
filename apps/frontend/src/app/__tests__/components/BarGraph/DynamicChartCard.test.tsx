import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DynamicChartCard from '../../../components/BarGraph/DynamicChartCard';

let yAxisProps: any = {};

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
        XAxis: () => <div data-testid="x-axis" />,
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
    beforeEach(() => {
        yAxisProps = {};
    });

    test('should render a BarChart by default and display the legend', () => {
        render(<DynamicChartCard data={mockData} keys={mockKeys} />);

        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();

        const barElements = screen.getAllByTestId('bar-element');
        expect(barElements).toHaveLength(mockKeys.length);

        mockKeys.forEach((key) => {
            expect(screen.getByText(key.name)).toBeInTheDocument();
        });
    });

    test('should render a LineChart when type prop is "line"', () => {
        render(<DynamicChartCard data={mockData} keys={mockKeys} type="line" />);

        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();

        const lineElements = screen.getAllByTestId('line-element');
        expect(lineElements).toHaveLength(mockKeys.length);
    });

    test('should pass the yTickFormatter prop to the YAxis component', () => {
        render(
            <DynamicChartCard
                data={mockData}
                keys={mockKeys}
                yTickFormatter={mockTickFormatter}
            />
        );

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
});

