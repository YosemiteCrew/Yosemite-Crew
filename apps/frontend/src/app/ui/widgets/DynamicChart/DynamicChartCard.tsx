'use client';
import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { LayoutType } from 'recharts/types/util/types';

type ChartProps = {
  data: any[];
  type?: 'bar' | 'line';
  keys: { name: string; color: string }[];
  yTickFormatter?: (value: number) => string;
  yAxisWidth?: number;
  chartHeight?: number;
  layout?: LayoutType;
  barSize?: number;
  hideKeys?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  compactMonthAxis?: boolean;
  deriveCompactAxisLabel?: boolean;
  xAxisDataKey?: string;
  xAxisType?: 'category' | 'number';
  xAxisTicks?: Array<string | number>;
  xAxisDomain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax'];
  xTickFormatter?: (value: string | number) => string;
  tooltipLabelFormatter?: (label: string | number, payload?: any[]) => React.ReactNode;
  headerContent?: React.ReactNode;
  footerContent?: React.ReactNode;
};

type TiltedTickProps = { x: number; y: number; payload: { value: string } };
type ChartKey = { name: string; color: string };
type AxisLabelConfig = {
  value: string;
  position: 'insideBottom' | 'insideLeft';
  offset: number;
  dy?: number;
  dx?: number;
  angle?: number;
};

const MONTH_NAME_PATTERN = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i;
const DAY_PATTERN = /\b([12]?\d|3[01])\b/;

const parseAxisValueAsDate = (value: string): Date | null => {
  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) {
    return new Date(timestamp);
  }

  const withCurrentYear = Date.parse(`${value} ${new Date().getFullYear()}`);
  if (!Number.isNaN(withCurrentYear)) {
    return new Date(withCurrentYear);
  }

  return null;
};

const getMonthLabelFromData = (data: any[]): string | undefined => {
  const labels = data
    .map((point) => point?.month)
    .filter(
      (monthValue): monthValue is string =>
        typeof monthValue === 'string' && monthValue.trim().length > 0
    );

  if (labels.length === 0) return undefined;

  const parsedDates = labels.map(parseAxisValueAsDate);
  if (parsedDates.every((date): date is Date => date instanceof Date)) {
    const first = parsedDates[0];
    const allSameMonthAndYear = parsedDates.every(
      (date) => date.getMonth() === first.getMonth() && date.getFullYear() === first.getFullYear()
    );

    if (allSameMonthAndYear) {
      return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(first);
    }
  }

  const monthToken = MONTH_NAME_PATTERN.exec(labels[0])?.[0];
  return monthToken ? monthToken[0].toUpperCase() + monthToken.slice(1).toLowerCase() : undefined;
};

const getDayTickLabel = (value: string): string => {
  const parsed = parseAxisValueAsDate(value);
  if (parsed) {
    return new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(parsed);
  }

  const dayToken = DAY_PATTERN.exec(value)?.[0];
  return dayToken ?? value;
};

const TiltedYTick = ({ x, y, payload }: TiltedTickProps) => (
  <g transform={`translate(${x},${y})`}>
    <text x={0} y={0} dx={-4} textAnchor="end" fontSize={11} fill="#666" transform="rotate(-30)">
      {payload.value}
    </text>
  </g>
);

const getXAxisLabel = (xAxisLabel?: string): AxisLabelConfig | undefined =>
  xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -2, dy: 16 } : undefined;

const getYAxisLabel = (
  yAxisLabel?: string,
  isVerticalLayout = false
): AxisLabelConfig | undefined => {
  if (!yAxisLabel || isVerticalLayout) return undefined;
  return { value: yAxisLabel, angle: -90, position: 'insideLeft', offset: 0, dx: -12 };
};

type LineChartContentProps = {
  data: any[];
  width?: number;
  height?: number;
  chartMargin: { top: number; right: number; left: number; bottom: number };
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
  tooltipLabelFormatter?: (label: string | number, payload?: any[]) => React.ReactNode;
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
  chartMargin: { top: number; right: number; left: number; bottom: number };
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

const ChartLegend = ({ keys }: { keys: ChartKey[] }) => (
  <div className="flex items-center justify-center w-full gap-6">
    {keys.map((key) => (
      <span key={key.name} className="flex items-center gap-1.5">
        <span
          style={{
            width: '16px',
            height: '16px',
            backgroundColor: key.color,
            borderRadius: '50%',
            display: 'inline-block',
          }}
        />
        <span className="text-capton-1 text-text-primary">{key.name}</span>
      </span>
    ))}
  </div>
);

const DynamicChartCard: React.FC<ChartProps> = ({
  data,
  type = 'bar',
  keys,
  yTickFormatter,
  yAxisWidth,
  chartHeight = 300,
  layout,
  barSize,
  hideKeys = false,
  xAxisLabel,
  yAxisLabel,
  compactMonthAxis = false,
  deriveCompactAxisLabel = true,
  xAxisDataKey = 'month',
  xAxisType = 'category',
  xAxisTicks,
  xAxisDomain,
  xTickFormatter,
  tooltipLabelFormatter,
  headerContent,
  footerContent,
}) => {
  const isVerticalLayout = layout === 'vertical';
  const effectiveXAxisLabel =
    compactMonthAxis && !isVerticalLayout && deriveCompactAxisLabel
      ? (getMonthLabelFromData(data) ?? xAxisLabel)
      : xAxisLabel;
  const chartMargin = {
    top: 0,
    right: isVerticalLayout ? 8 : 0,
    left: yAxisLabel ? 20 : 0,
    bottom: effectiveXAxisLabel ? 26 : 0,
  };

  return (
    <div className="bg-white border border-card-border p-3 flex flex-col gap-2 rounded-2xl">
      {headerContent}
      {!hideKeys && !headerContent && <ChartLegend keys={keys} />}
      <ResponsiveContainer width="100%" height={chartHeight}>
        {type === 'line' ? (
          <LineChartContent
            data={data}
            chartMargin={chartMargin}
            keys={keys}
            yTickFormatter={yTickFormatter}
            xAxisLabel={effectiveXAxisLabel}
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
            xAxisLabel={effectiveXAxisLabel}
            yAxisLabel={yAxisLabel}
            barSize={barSize}
            compactMonthAxis={compactMonthAxis}
          />
        )}
      </ResponsiveContainer>
      {footerContent}
    </div>
  );
};

export default DynamicChartCard;
