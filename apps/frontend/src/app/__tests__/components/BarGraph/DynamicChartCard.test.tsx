import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DynamicChartCard from '../../../components/BarGraph/DynamicChartCard';

// This variable will capture the props passed to the YAxis component for testing.
let yAxisProps: any = {};

// Mock the 'recharts' library. This is crucial for isolating the component and
// preventing actual chart rendering during tests.
jest.mock('recharts', () => {
    // We must mock every component from recharts that DynamicChartCard uses.
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
            // Capture the props passed to YAxis for later assertions.
            yAxisProps = props;
            return <div data-testid="y-axis" />;
        },
        Tooltip: () => <div data-testid="tooltip" />,
        CartesianGrid: () => <div data-testid="cartesian-grid" />,
        // Mock the Bar component to render a simple div for each key.
        // This allows us to verify that the correct number of bars are rendered.
        Bar: ({ name }: { name: string }) => <div data-testid="bar-element">{name}</div>,
        // Mock the Line component similarly.
        Line: ({ name }: { name: string }) => <div data-testid="line-element">{name}</div>,
        // Mock the Legend component to render the names of the keys.
        Legend: ({ payload }: { payload: { value: string }[] }) => (
            <div data-testid="legend">
                {payload.map((entry) => (
                    <span key={entry.value}>{entry.value}</span>
                ))}
            </div>
        ),
    };
});

// Define reusable mock data for the tests.
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
    // Reset the captured YAxis props before each test to ensure isolation.
    beforeEach(() => {
        yAxisProps = {};
    });

    test('should render a BarChart by default and display the legend', () => {
        render(<DynamicChartCard data={mockData} keys={mockKeys} />);

        // Check that the BarChart is rendered and the LineChart is not.
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();

        // Check that the correct number of Bar elements are rendered (one for each key).
        const barElements = screen.getAllByTestId('bar-element');
        expect(barElements).toHaveLength(mockKeys.length);

        // Check that the legend displays the name for each key.
        mockKeys.forEach((key) => {
            // Use `within` to search for the text only inside the legend.
            expect(screen.getByText(key.name)).toBeInTheDocument();
        });
    });

    test('should render a LineChart when type prop is "line"', () => {
        render(<DynamicChartCard data={mockData} keys={mockKeys} type="line" />);

        // Check that the LineChart is rendered and the BarChart is not.
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();

        // Check that the correct number of Line elements are rendered.
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

        // Verify that the tickFormatter function was passed correctly to our mocked YAxis.
        expect(yAxisProps.tickFormatter).toBe(mockTickFormatter);

        // Verify that the passed function works as expected.
        expect(yAxisProps.tickFormatter(5000)).toBe('$5K');
    });

    test('should render without chart elements or legend when keys array is empty', () => {
        render(<DynamicChartCard data={mockData} keys={[]} />);

        // The chart container should still be rendered.
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();

        // No Bar elements should be rendered if the keys array is empty.
        expect(screen.queryByTestId('bar-element')).not.toBeInTheDocument();

        // The legend should not render any of the key names.
        expect(screen.queryByText('sales')).not.toBeInTheDocument();
        expect(screen.queryByText('profit')).not.toBeInTheDocument();
    });
});

