'use client';
import { type FC, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
/* Type-only, so it is erased at compile time and never pulls recharts into this chunk. */
import type { CartesianLayout } from 'recharts';

import {
  type ChartKey,
  type ChartTooltipLabelFormatter,
  getMonthLabelFromData,
} from '@/app/ui/widgets/DynamicChart/chartAxis';

const ChartSkeleton = ({ height }: { height: number }) => (
  <div
    className="rounded-[18px] bg-[var(--inset)] animate-pulse"
    style={{ height }}
    aria-hidden="true"
  />
);

/* The whole recharts canvas is one lazy chunk. Splitting at this boundary - rather
   than wrapping each recharts element in next/dynamic - is what keeps recharts out
   of the initial bundle without hiding the real component types from recharts. */
const ChartCanvas = dynamic(() => import('@/app/ui/widgets/DynamicChart/ChartCanvas'), {
  ssr: false,
  loading: () => <ChartSkeleton height={300} />,
});

type ChartProps = {
  data: any[];
  type?: 'bar' | 'line';
  keys: ChartKey[];
  isEmpty?: boolean;
  yTickFormatter?: (value: number) => string;
  yAxisWidth?: number;
  chartHeight?: number;
  layout?: CartesianLayout;
  barSize?: number;
  hideKeys?: boolean;
  /** Renders the compact, axis-less bar sparkline the dashboard design uses. */
  hideYAxis?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  compactMonthAxis?: boolean;
  deriveCompactAxisLabel?: boolean;
  xAxisDataKey?: string;
  xAxisType?: 'category' | 'number';
  xAxisTicks?: Array<string | number>;
  xAxisDomain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax'];
  xTickFormatter?: (value: string | number) => string;
  tooltipLabelFormatter?: ChartTooltipLabelFormatter;
  headerContent?: ReactNode;
  footerContent?: ReactNode;
};

/* The design keeps the legend right-aligned alongside the card title rather than
   centred above the chart. */
const ChartLegend = ({ keys }: { keys: ChartKey[] }) => (
  <div className="flex items-center justify-end w-full gap-3">
    {keys.map((key) => (
      <span key={key.name} className="flex items-center gap-1.5">
        <span
          style={{
            width: '9px',
            height: '9px',
            backgroundColor: key.color,
            borderRadius: '3px',
            display: 'inline-block',
          }}
        />
        <span className="text-[11px] text-[var(--ink-muted)]">{key.name}</span>
      </span>
    ))}
  </div>
);

const EmptyChartState = ({ height }: { height: number }) => (
  <div
    className="flex flex-col items-center justify-center gap-2 text-[var(--ink-faint)]"
    style={{ height }}
  >
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="4" y="24" width="8" height="12" rx="2" fill="var(--divider)" />
      <rect x="16" y="16" width="8" height="20" rx="2" fill="var(--divider)" />
      <rect x="28" y="10" width="8" height="26" rx="2" fill="var(--divider)" />
    </svg>
    <span className="text-[13px]">No data available</span>
  </div>
);

const DynamicChartCard: FC<ChartProps> = ({
  data,
  type = 'bar',
  keys,
  isEmpty = false,
  yTickFormatter,
  yAxisWidth,
  chartHeight = 300,
  layout,
  barSize,
  hideKeys = false,
  hideYAxis = false,
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
    <div className="flex flex-col gap-3 rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] px-5 py-4 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
      {headerContent}
      {!hideKeys && !headerContent && <ChartLegend keys={keys} />}
      {isEmpty ? (
        <EmptyChartState height={chartHeight} />
      ) : (
        <ChartCanvas
          data={data}
          type={type}
          keys={keys}
          chartHeight={chartHeight}
          chartMargin={chartMargin}
          isVerticalLayout={isVerticalLayout}
          layout={layout}
          yTickFormatter={yTickFormatter}
          yAxisWidth={yAxisWidth}
          hideYAxis={hideYAxis}
          barSize={barSize}
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
      )}
      {footerContent}
    </div>
  );
};

export default DynamicChartCard;
