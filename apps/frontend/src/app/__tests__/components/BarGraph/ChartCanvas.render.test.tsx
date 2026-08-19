import React from 'react';
import { render } from '@testing-library/react';
import ChartCanvas from '@/app/ui/widgets/DynamicChart/ChartCanvas';

/* DynamicChartCard.test.tsx mocks every recharts element, so it asserts the props we hand
   to recharts but can never catch recharts failing to resolve those children - the exact
   failure mode that once shipped blank dashboard charts (see .react-doctor/false-positives.md).
   This suite keeps Bar/Line/XAxis/YAxis/Tooltip/CartesianGrid REAL and counts the SVG that
   comes out, so an upgrade that silently stops rendering fails here instead of in production.
   Only ResponsiveContainer is replaced: jsdom has no layout, so it would measure 0x0. */
jest.mock('recharts', () => {
  const actual = jest.requireActual('recharts');
  const ReactLib = jest.requireActual('react');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      ReactLib.cloneElement(children, { width: 600, height: 300 }),
  };
});

const data = [
  { month: 'Apr 1', dayNumber: 1, 'Repository clones': 6, Builders: 2 },
  { month: 'Apr 2', dayNumber: 2, 'Repository clones': 9, Builders: 4 },
  { month: 'Apr 3', dayNumber: 3, 'Repository clones': 3, Builders: 7 },
];

const keys = [
  { name: 'Repository clones', color: '#123456' },
  { name: 'Builders', color: '#654321' },
];

const chartMargin = { top: 0, right: 0, left: 0, bottom: 0 };

describe('ChartCanvas against real recharts', () => {
  it('draws every stacked bar, both axes and the grid', () => {
    const { container } = render(
      <ChartCanvas
        data={data}
        type="bar"
        keys={keys}
        chartHeight={300}
        chartMargin={chartMargin}
        isVerticalLayout={false}
        xAxisLabel="April"
        yAxisLabel="Visitors"
      />
    );

    expect(container.querySelectorAll('svg.recharts-surface')).toHaveLength(1);
    // 3 data points x 2 stacked keys
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(6);
    expect(
      container.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick')
    ).toHaveLength(3);
    expect(
      container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick').length
    ).toBeGreaterThan(0);
    expect(container.querySelectorAll('.recharts-cartesian-grid')).toHaveLength(1);
  });

  it('renders the custom tilted Y tick on the vertical layout', () => {
    const { container } = render(
      <ChartCanvas
        data={data}
        type="bar"
        keys={keys}
        chartHeight={300}
        chartMargin={chartMargin}
        isVerticalLayout
        layout="vertical"
      />
    );

    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(6);
    // TiltedYTick is a function component recharts must call with real tick geometry.
    const tiltedTicks = container.querySelectorAll('text[transform="rotate(-30)"]');
    expect(tiltedTicks).toHaveLength(3);
    expect(Array.from(tiltedTicks, (tick) => tick.textContent)).toEqual([
      'Apr 1',
      'Apr 2',
      'Apr 3',
    ]);
  });

  it('draws one line per key on a numeric x axis', () => {
    const { container } = render(
      <ChartCanvas
        data={data}
        type="line"
        keys={keys}
        chartHeight={300}
        chartMargin={chartMargin}
        isVerticalLayout={false}
        xAxisDataKey="dayNumber"
        xAxisType="number"
        xAxisTicks={[1, 2, 3]}
        xAxisDomain={[1, 3]}
        xTickFormatter={String}
        tooltipLabelFormatter={(label) => String(label)}
      />
    );

    expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(2);
    expect(
      container.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick')
    ).toHaveLength(3);
  });
});
