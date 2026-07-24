import { type ReactNode } from 'react';

export type ChartKey = { name: string; color: string };

/* recharts hands the tooltip label in as a ReactNode and the hovered payload as a
   readonly array, so the chart wrappers have to accept those widths verbatim. */
export type ChartTooltipLabelFormatter = (label: ReactNode, payload?: readonly any[]) => ReactNode;

export type AxisLabelConfig = {
  value: string;
  position: 'insideBottom' | 'insideLeft';
  offset: number;
  dy?: number;
  dx?: number;
  angle?: number;
};

const MONTH_NAME_PATTERN = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i;
const DAY_PATTERN = /\b([12]?\d|3[01])\b/;
const axisMonthYearFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
});
const axisDayFormatter = new Intl.DateTimeFormat('en-US', { day: 'numeric' });

export const parseAxisValueAsDate = (value: string): Date | null => {
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

export const getMonthLabelFromData = (data: any[]): string | undefined => {
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
      return axisMonthYearFormatter.format(first);
    }
  }

  const monthToken = MONTH_NAME_PATTERN.exec(labels[0])?.[0];
  return monthToken ? monthToken[0].toUpperCase() + monthToken.slice(1).toLowerCase() : undefined;
};

export const getDayTickLabel = (value: string): string => {
  const parsed = parseAxisValueAsDate(value);
  if (parsed) {
    return axisDayFormatter.format(parsed);
  }

  const dayToken = DAY_PATTERN.exec(value)?.[0];
  return dayToken ?? value;
};

export const getXAxisLabel = (xAxisLabel?: string): AxisLabelConfig | undefined =>
  xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -2, dy: 16 } : undefined;

export const getYAxisLabel = (
  yAxisLabel?: string,
  isVerticalLayout = false
): AxisLabelConfig | undefined => {
  if (!yAxisLabel || isVerticalLayout) return undefined;
  return { value: yAxisLabel, angle: -90, position: 'insideLeft', offset: 0, dx: -12 };
};
