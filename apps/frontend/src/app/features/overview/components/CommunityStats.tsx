'use client';
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
const DynamicChartCard = dynamic(() => import('@/app/ui/widgets/DynamicChart/DynamicChartCard'), {
  ssr: false,
});
import { TrafficDataPoint, StarsDataPoint } from '../hooks/useOverviewStats';
import type { ChartTooltipLabelFormatter } from '@/app/ui/widgets/DynamicChart/chartAxis';

type CommunityStatsProps = {
  trafficChart: TrafficDataPoint[];
  starsChart: StarsDataPoint[];
  isLoading: boolean;
};

type ViewType = 'Unique' | 'Cumulative' | 'Stars';
type GranularityType = 'Daily' | 'Monthly' | 'Yearly';
type AggregatedTrafficPoint = {
  dateKey: string;
  month: string;
  'Repository clones': number;
  Builders: number;
};
type AggregatedStarsPoint = {
  dateKey: string;
  month: string;
  'Github Stars': number;
};

type NavigationConfig = {
  currentLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  isPreviousDisabled: boolean;
  isNextDisabled: boolean;
};

const getMonthKey = (dateKey: string) => dateKey.slice(0, 7);

const getYearKey = (dateKey: string) => dateKey.slice(0, 4);

const shortMonthYearFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});

const longMonthYearFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const formatMonthLabel = (dateKey: string) =>
  shortMonthYearFormatter.format(new Date(dateKey)).replace(' ', " '");

const formatMonthHeading = (monthKey: string) =>
  longMonthYearFormatter.format(new Date(`${monthKey}-01T00:00:00.000Z`));

const formatYearHeading = (yearKey: string) => yearKey;

const getDayNumber = (dateKey: string) => new Date(`${dateKey}T00:00:00.000Z`).getUTCDate();

const aggregateTrafficByMonth = (
  trafficChart: TrafficDataPoint[],
  view: Exclude<ViewType, 'Stars'>
): AggregatedTrafficPoint[] => {
  const aggregated = new Map<string, AggregatedTrafficPoint>();

  trafficChart.forEach((dataPoint) => {
    const date = new Date(dataPoint.dateKey);
    const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const existing = aggregated.get(monthKey);
    const repositoryClonesValue =
      view === 'Unique'
        ? dataPoint['Repository clones (unique)']
        : dataPoint['Repository clones (cumulative)'];
    const buildersValue =
      view === 'Unique' ? dataPoint['Builders (Unique)'] : dataPoint['Builders (Cumulative)'];

    if (existing) {
      existing['Repository clones'] += repositoryClonesValue;
      existing.Builders = view === 'Unique' ? existing.Builders + buildersValue : buildersValue;
      return;
    }

    aggregated.set(monthKey, {
      dateKey: `${monthKey}-01T00:00:00.000Z`,
      month: formatMonthLabel(dataPoint.dateKey),
      'Repository clones': repositoryClonesValue,
      Builders: buildersValue,
    });
  });

  return Array.from(aggregated.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([, value]) => value);
};

const aggregateStarsByYear = (starsChart: StarsDataPoint[]): AggregatedStarsPoint[] => {
  const aggregated = new Map<string, AggregatedStarsPoint>();

  starsChart.forEach((dataPoint) => {
    const year = String(new Date(dataPoint.dateKey).getUTCFullYear());
    aggregated.set(year, {
      dateKey: `${year}-01-01T00:00:00.000Z`,
      month: year,
      'Github Stars': dataPoint['Github Stars'],
    });
  });

  return Array.from(aggregated.entries())
    .sort(([leftYear], [rightYear]) => leftYear.localeCompare(rightYear))
    .map(([, value]) => value);
};

const getGranularityOptions = (view: ViewType): GranularityType[] =>
  view === 'Stars' ? ['Monthly', 'Yearly'] : ['Daily', 'Monthly'];

const getNextViewGranularity = (nextView: ViewType, currentGranularity: GranularityType) => {
  const nextOptions = getGranularityOptions(nextView);
  return nextOptions.includes(currentGranularity) ? currentGranularity : 'Monthly';
};

const getAvailablePeriodKeys = (
  view: ViewType,
  effectiveGranularity: GranularityType,
  trafficChart: TrafficDataPoint[],
  starsChart: StarsDataPoint[]
) => {
  if (view === 'Stars') {
    if (effectiveGranularity === 'Monthly') {
      return Array.from(new Set(starsChart.map((dataPoint) => getYearKey(dataPoint.dateKey)))).sort(
        (a, b) => a.localeCompare(b)
      );
    }
    return [];
  }

  if (effectiveGranularity === 'Daily') {
    return Array.from(
      new Set(trafficChart.map((dataPoint) => getMonthKey(dataPoint.dateKey)))
    ).sort((a, b) => a.localeCompare(b));
  }

  return Array.from(new Set(trafficChart.map((dataPoint) => getYearKey(dataPoint.dateKey)))).sort(
    (a, b) => a.localeCompare(b)
  );
};

const getResolvedPeriodKey = (availablePeriodKeys: string[], selectedPeriodKey: string | null) =>
  selectedPeriodKey && availablePeriodKeys.includes(selectedPeriodKey)
    ? selectedPeriodKey
    : (availablePeriodKeys.at(-1) ?? null);

const buildNavigationConfig = (
  availablePeriodKeys: string[],
  selectedPeriodKey: string | null,
  setSelectedPeriodKey: React.Dispatch<React.SetStateAction<string | null>>,
  formatter: (key: string) => string
): NavigationConfig | null => {
  if (availablePeriodKeys.length <= 1 || !selectedPeriodKey) {
    return null;
  }

  const selectedIndex = availablePeriodKeys.indexOf(selectedPeriodKey);
  /* v8 ignore next 3 -- unreachable: getResolvedPeriodKey only ever returns a key taken from availablePeriodKeys (either the selected one it just verified with includes(), or at(-1)), so indexOf never returns -1 here */
  if (selectedIndex === -1) {
    return null;
  }

  const previousPeriodKey = availablePeriodKeys[selectedIndex - 1];
  const nextPeriodKey = availablePeriodKeys[selectedIndex + 1];

  return {
    currentLabel: formatter(selectedPeriodKey),
    /* v8 ignore next -- unreachable fallback: isPreviousDisabled disables the Prev button at index 0, so previousPeriodKey is always defined when onPrevious can fire */
    onPrevious: () => setSelectedPeriodKey(previousPeriodKey ?? selectedPeriodKey),
    /* v8 ignore next -- unreachable fallback: isNextDisabled disables the Next button at the last index, so nextPeriodKey is always defined when onNext can fire */
    onNext: () => setSelectedPeriodKey(nextPeriodKey ?? selectedPeriodKey),
    isPreviousDisabled: selectedIndex === 0,
    isNextDisabled: selectedIndex === availablePeriodKeys.length - 1,
  };
};

type ChartConfig = {
  chartData: Array<Record<string, number | string>>;
  yAxisWidth: number;
  xAxisDataKey?: string;
  xAxisType?: 'category' | 'number';
  xAxisTicks?: number[];
  xAxisDomain?: [number, number];
  xTickFormatter?: (value: string | number) => string;
  tooltipLabelFormatter?: ChartTooltipLabelFormatter;
};

const buildStarsChartConfig = (
  starsChart: StarsDataPoint[],
  effectiveGranularity: GranularityType,
  resolvedPeriodKey: string | null
): ChartConfig => {
  const chartData =
    effectiveGranularity === 'Yearly'
      ? aggregateStarsByYear(starsChart).map(({ dateKey: _dateKey, ...dataPoint }) => dataPoint)
      : starsChart.reduce<Omit<StarsDataPoint, 'dateKey'>[]>((dataPoints, dataPoint) => {
          if (getYearKey(dataPoint.dateKey) !== resolvedPeriodKey) return dataPoints;
          const { dateKey: _dateKey, ...chartPoint } = dataPoint;
          dataPoints.push(chartPoint);
          return dataPoints;
        }, []);
  return { chartData, yAxisWidth: 45 };
};

const buildTrafficChartConfig = (
  trafficChart: TrafficDataPoint[],
  view: Exclude<ViewType, 'Stars'>,
  effectiveGranularity: GranularityType,
  resolvedPeriodKey: string | null
): ChartConfig => {
  const mapTrafficPoint = (d: TrafficDataPoint) => ({
    month: d.month,
    dayNumber: getDayNumber(d.dateKey),
    'Repository clones':
      view === 'Unique' ? d['Repository clones (unique)'] : d['Repository clones (cumulative)'],
    Builders: view === 'Unique' ? d['Builders (Unique)'] : d['Builders (Cumulative)'],
  });

  const trafficData =
    effectiveGranularity === 'Monthly'
      ? aggregateTrafficByMonth(trafficChart, view).reduce<Array<Record<string, number | string>>>(
          (dataPoints, dataPoint) => {
            if (getYearKey(dataPoint.dateKey) !== resolvedPeriodKey) return dataPoints;
            const { dateKey: _dateKey, ...chartPoint } = dataPoint;
            dataPoints.push(chartPoint);
            return dataPoints;
          },
          []
        )
      : trafficChart.reduce<ReturnType<typeof mapTrafficPoint>[]>((dataPoints, dataPoint) => {
          if (getMonthKey(dataPoint.dateKey) !== resolvedPeriodKey) return dataPoints;
          dataPoints.push(mapTrafficPoint(dataPoint));
          return dataPoints;
        }, []);

  const chartData = trafficData.length > 0 ? trafficData : [];

  if (effectiveGranularity !== 'Daily' || chartData.length === 0) {
    return { chartData, yAxisWidth: 40 };
  }

  const dayTicks = (chartData as Array<Record<string, number | string>>)
    .reduce<number[]>((ticks, dataPoint) => {
      const value = Number(dataPoint.dayNumber);
      if (!ticks.includes(value)) ticks.push(value);
      return ticks;
    }, [])
    .sort((left, right) => left - right);

  return {
    chartData,
    yAxisWidth: 40,
    xAxisDataKey: 'dayNumber',
    xAxisType: 'number',
    xAxisTicks: dayTicks,
    xAxisDomain: [dayTicks[0], dayTicks.at(-1) as number],
    xTickFormatter: String,
    tooltipLabelFormatter: (_label, payload) => String(payload?.[0]?.payload?.month ?? _label),
  };
};

const chartKeys = [
  { name: 'Repository clones', color: 'var(--color-badge-blue-bg)' },
  { name: 'Builders', color: 'var(--success)' },
  { name: 'Github Stars', color: 'var(--color-warning-600)' },
];

const CommunityStats = ({ trafficChart, starsChart, isLoading }: CommunityStatsProps) => {
  const [view, setView] = useState<ViewType>('Unique');
  const [granularity, setGranularity] = useState<GranularityType>('Daily');
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="text-center p-10 text-text-secondary font-satoshi">
        Loading Repository Data…
      </div>
    );
  }

  const granularityOptions = getGranularityOptions(view);
  /* v8 ignore next -- unreachable 'Monthly' fallback: every view toggle normalises granularity through getNextViewGranularity in the same batched update, so granularity is always one of the current view's options by the time this renders */
  const effectiveGranularity = granularityOptions.includes(granularity) ? granularity : 'Monthly';
  const availablePeriodKeys = getAvailablePeriodKeys(
    view,
    effectiveGranularity,
    trafficChart,
    starsChart
  );
  const resolvedPeriodKey = getResolvedPeriodKey(availablePeriodKeys, selectedPeriodKey);
  const shouldCompactTimeline =
    (view === 'Stars' && effectiveGranularity === 'Monthly') ||
    (view !== 'Stars' && effectiveGranularity === 'Daily');
  const periodFormatter = effectiveGranularity === 'Daily' ? formatMonthHeading : formatYearHeading;
  const navigationConfig =
    view === 'Stars' && effectiveGranularity === 'Yearly'
      ? null
      : buildNavigationConfig(
          availablePeriodKeys,
          resolvedPeriodKey,
          setSelectedPeriodKey,
          periodFormatter
        );

  const {
    chartData,
    yAxisWidth,
    xAxisDataKey,
    xAxisType,
    xAxisTicks,
    xAxisDomain,
    xTickFormatter,
    tooltipLabelFormatter,
  } =
    view === 'Stars'
      ? buildStarsChartConfig(starsChart, effectiveGranularity, resolvedPeriodKey)
      : buildTrafficChartConfig(trafficChart, view, effectiveGranularity, resolvedPeriodKey);

  const chartHeader = (
    <div className="ChartCardHeader">
      <div className="ChartCardTopRow">
        <div className="PeriodToggle">
          {granularityOptions.map((option) => (
            <button
              type="button"
              key={option}
              className={`TogglePill ${effectiveGranularity === option ? 'Active' : ''}`}
              onClick={() => {
                setGranularity(option);
                setSelectedPeriodKey(null);
              }}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="ChartLegendInline">
          {chartKeys.map((key) => (
            <span key={key.name} className="ChartLegendItem">
              <span className="ChartLegendDot" style={{ backgroundColor: key.color }} />
              <span className="text-caption-1 text-text-primary">{key.name}</span>
            </span>
          ))}
        </div>

        <div className="DataToggle">
          <button
            type="button"
            className={`TogglePill ${view === 'Unique' ? 'Active' : ''}`}
            onClick={() => {
              setView('Unique');
              setGranularity((current) => {
                const nextGranularity = getNextViewGranularity('Unique', current);
                if (nextGranularity !== current) {
                  setSelectedPeriodKey(null);
                }
                return nextGranularity;
              });
            }}
          >
            Unique
          </button>
          <button
            type="button"
            className={`TogglePill ${view === 'Cumulative' ? 'Active' : ''}`}
            onClick={() => {
              setView('Cumulative');
              setGranularity((current) => {
                const nextGranularity = getNextViewGranularity('Cumulative', current);
                if (nextGranularity !== current) {
                  setSelectedPeriodKey(null);
                }
                return nextGranularity;
              });
            }}
          >
            Cumulative
          </button>
          <button
            type="button"
            className={`TogglePill ${view === 'Stars' ? 'Active' : ''}`}
            onClick={() => {
              setView('Stars');
              setGranularity((current) => {
                const nextGranularity = getNextViewGranularity('Stars', current);
                if (nextGranularity !== current) {
                  setSelectedPeriodKey(null);
                }
                return nextGranularity;
              });
            }}
          >
            Stars
          </button>
        </div>
      </div>
    </div>
  );

  const chartFooter = navigationConfig ? (
    <div className="ChartNavigation">
      <button
        type="button"
        className="ChartNavigationButton"
        onClick={navigationConfig.onPrevious}
        disabled={navigationConfig.isPreviousDisabled}
        aria-label="Show previous period"
      >
        Prev
      </button>
      <span className="ChartNavigationLabel">{navigationConfig.currentLabel}</span>
      <button
        type="button"
        className="ChartNavigationButton"
        onClick={navigationConfig.onNext}
        disabled={navigationConfig.isNextDisabled}
        aria-label="Show next period"
      >
        Next
      </button>
    </div>
  ) : null;

  return (
    <div className="CommunityStatsContainer">
      <style>{`
        .ForceLeftLegend .recharts-legend-wrapper {
          left: 0 !important;
          right: auto !important;
          width: 100% !important;
        }
        .ForceLeftLegend .recharts-default-legend {
          text-align: left !important;
          display: flex !important;
          justify-content: flex-start !important;
          align-items: center;
          padding-left: 0px !important;
          margin-top: 0px !important;
          flex-wrap: wrap;
        }
        .ForceLeftLegend .recharts-wrapper {
          margin-top: 10px;
        }

        /* Mobile adjustments specifically for the legend */
        @media screen and (max-width: 768px) {
          .ForceLeftLegend .recharts-default-legend {
             justify-content: center !important;
             gap: 8px !important;
             margin-bottom: 8px !important;
          }
          .ForceLeftLegend .recharts-legend-item {
             margin-right: 8px !important;
          }
        }
      `}</style>

      {/* SINGLE FULL-WIDTH CHART */}
      <div className="ChartGrid">
        <div className="StatsCardWrapper ForceLeftLegend">
          <div className="ChartWrapper">
            <DynamicChartCard
              data={chartData}
              type="line"
              keys={chartKeys}
              hideKeys={true}
              yAxisWidth={yAxisWidth}
              chartHeight={320}
              compactMonthAxis={shouldCompactTimeline}
              deriveCompactAxisLabel={false}
              xAxisDataKey={xAxisDataKey}
              xAxisType={xAxisType}
              xAxisTicks={xAxisTicks}
              xAxisDomain={xAxisDomain}
              xTickFormatter={xTickFormatter}
              tooltipLabelFormatter={tooltipLabelFormatter}
              headerContent={chartHeader}
              footerContent={chartFooter}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityStats;
