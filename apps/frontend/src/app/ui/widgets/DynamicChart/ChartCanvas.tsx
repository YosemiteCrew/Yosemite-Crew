'use client';
import { type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LayoutType } from 'recharts/types/util/types';

import {
  type ChartKey,
  getDayTickLabel,
  getXAxisLabel,
  getYAxisLabel,
} from '@/app/ui/widgets/DynamicChart/chartAxis';

/* Recharts resolves its children by matching each child's type against the real
   Bar/XAxis/... components, so every recharts element here must be imported
   statically. Wrapping them in next/dynamic makes recharts see anonymous
   loadable components instead, and it silently drops them - an empty chart.
   Code splitting happens one level up: DynamicChartCard lazy-loads this whole
   module, so recharts still stays out of the initial bundle. */

type TiltedTickProps = { x: number; y: number; payload: { value: string } };

const TiltedYTick = ({ x, y, payload }: TiltedTickProps) => (
  <g transform={`translate(${x},${y})`}>
    <text
      x={0}
      y={0}
      dx={-4}
      textAnchor="end"
      fontSize={11}
      fill="var(--ink-faint)"
      transform="rotate(-30)"
    >
      {payload.value}
    </text>
  </g>
);

type ChartMargin = { top: number; right: number; left: number; bottom: number };

type LineChartContentProps = {
  data: any[];
  width?: number;
  height?: number;
  chartMargin: ChartMargin;
  keys: ChartKey[];
  yTickFormatter?: (value: number) => string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  compactMonthAxis?: boolean;
  xAxisDataKey?: string;
  xAxisType?: 'category' | 'number';
  xAxisTicks?: Array<string | number>;
  xAxisDomain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax'];
  xTickFormatter?: (value: string | number) => string;
  tooltipLabelFormatter?: (label: string | number, payload?: any[]) => ReactNode;
};

const LineChartContent = ({
  data,
  width,
  height,
  chartMargin,
  keys,
  yTickFormatter,
  xAxisLabel,
  yAxisLabel,
  compactMonthAxis,
  xAxisDataKey = 'month',
  xAxisType = 'category',
  xAxisTicks,
  xAxisDomain,
  xTickFormatter,
  tooltipLabelFormatter,
}: LineChartContentProps) => (
  <LineChart data={data} margin={chartMargin} width={width} height={height}>
    <XAxis
      dataKey={xAxisDataKey}
      type={xAxisType}
      scale={xAxisType === 'number' ? 'linear' : 'point'}
      tick={{ fontSize: 11 }}
      ticks={xAxisTicks}
      domain={xAxisDomain}
      allowDataOverflow={xAxisType === 'number'}
      interval={compactMonthAxis ? 'preserveStartEnd' : 0}
      minTickGap={compactMonthAxis ? 12 : undefined}
      tickFormatter={
        xTickFormatter ??
        (compactMonthAxis && xAxisType === 'category' ? getDayTickLabel : undefined)
      }
      label={getXAxisLabel(xAxisLabel)}
    />
    <YAxis
      tickFormatter={yTickFormatter}
      label={
        yAxisLabel
          ? { value: yAxisLabel, angle: -90, position: 'insideLeft', offset: 4, dx: -16 }
          : undefined
      }
    />
    <Tooltip labelFormatter={tooltipLabelFormatter} />
    {keys.map((key) => (
      <Line
        key={key.name}
        type="monotone"
        dataKey={key.name}
        stroke={key.color}
        strokeWidth={2}
        dot={false}
      />
    ))}
  </LineChart>
);

type BarChartContentProps = {
  data: any[];
  width?: number;
  height?: number;
  layout?: LayoutType;
  isVerticalLayout: boolean;
  chartMargin: ChartMargin;
  keys: ChartKey[];
  yTickFormatter?: (value: number) => string;
  yAxisWidth?: number;
  xAxisLabel?: string;
  yAxisLabel?: string;
  barSize?: number;
  compactMonthAxis?: boolean;
};

const BarChartContent = ({
  data,
  width,
  height,
  layout,
  isVerticalLayout,
  chartMargin,
  keys,
  yTickFormatter,
  yAxisWidth,
  xAxisLabel,
  yAxisLabel,
  barSize,
  compactMonthAxis,
}: BarChartContentProps) => (
  <BarChart
    data={data}
    layout={layout}
    style={{ height: '100%', maxHeight: '100%', width: '100%', maxWidth: '100%' }}
    margin={chartMargin}
    width={width}
    height={height}
  >
    <CartesianGrid strokeDasharray="4 4" vertical={false} />
    <XAxis
      dataKey={isVerticalLayout ? undefined : 'month'}
      type={isVerticalLayout ? 'number' : 'category'}
      tick={{ fontSize: 11 }}
      interval={compactMonthAxis && !isVerticalLayout ? 'preserveStartEnd' : 0}
      minTickGap={compactMonthAxis && !isVerticalLayout ? 12 : undefined}
      tickFormatter={compactMonthAxis && !isVerticalLayout ? getDayTickLabel : undefined}
      label={getXAxisLabel(xAxisLabel)}
    />
    <YAxis
      dataKey={isVerticalLayout ? 'month' : undefined}
      type={isVerticalLayout ? 'category' : 'number'}
      tickFormatter={isVerticalLayout ? undefined : yTickFormatter}
      width={isVerticalLayout ? 100 : yAxisWidth}
      tick={isVerticalLayout ? TiltedYTick : { fontSize: 11 }}
      label={getYAxisLabel(yAxisLabel, isVerticalLayout)}
    />
    <Tooltip />
    {keys.map((key) => (
      <Bar key={key.name} dataKey={key.name} fill={key.color} stackId="a" barSize={barSize} />
    ))}
  </BarChart>
);

export type ChartCanvasProps = {
  data: any[];
  type: 'bar' | 'line';
  keys: ChartKey[];
  chartHeight: number;
  chartMargin: ChartMargin;
  isVerticalLayout: boolean;
  layout?: LayoutType;
  yTickFormatter?: (value: number) => string;
  yAxisWidth?: number;
  barSize?: number;
  xAxisLabel?: string;
  yAxisLabel?: string;
  compactMonthAxis?: boolean;
  xAxisDataKey?: string;
  xAxisType?: 'category' | 'number';
  xAxisTicks?: Array<string | number>;
  xAxisDomain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax'];
  xTickFormatter?: (value: string | number) => string;
  tooltipLabelFormatter?: (label: string | number, payload?: any[]) => ReactNode;
};

const ChartCanvas = ({
  data,
  type,
  keys,
  chartHeight,
  chartMargin,
  isVerticalLayout,
  layout,
  yTickFormatter,
  yAxisWidth,
  barSize,
  xAxisLabel,
  yAxisLabel,
  compactMonthAxis,
  xAxisDataKey,
  xAxisType,
  xAxisTicks,
  xAxisDomain,
  xTickFormatter,
  tooltipLabelFormatter,
}: ChartCanvasProps) => (
  <ResponsiveContainer width="100%" height={chartHeight}>
    {type === 'line' ? (
      <LineChartContent
        data={data}
        chartMargin={chartMargin}
        keys={keys}
        yTickFormatter={yTickFormatter}
        xAxisLabel={xAxisLabel}
        yAxisLabel={yAxisLabel}
        compactMonthAxis={compactMonthAxis}
        xAxisDataKey={xAxisDataKey}
        xAxisType={xAxisType}
        xAxisTicks={xAxisTicks}
        xAxisDomain={xAxisDomain}
        xTickFormatter={xTickFormatter}
        tooltipLabelFormatter={tooltipLabelFormatter}
      />
    ) : (
      <BarChartContent
        data={data}
        layout={layout}
        isVerticalLayout={isVerticalLayout}
        chartMargin={chartMargin}
        keys={keys}
        yTickFormatter={yTickFormatter}
        yAxisWidth={yAxisWidth}
        xAxisLabel={xAxisLabel}
        yAxisLabel={yAxisLabel}
        barSize={barSize}
        compactMonthAxis={compactMonthAxis}
      />
    )}
  </ResponsiveContainer>
);

export default ChartCanvas;
