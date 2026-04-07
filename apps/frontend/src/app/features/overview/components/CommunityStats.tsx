'use client';
import React, { useState } from 'react';
import DynamicChartCard from '@/app/ui/widgets/DynamicChart/DynamicChartCard';
import { TrafficDataPoint, StarsDataPoint } from '../hooks/useOverviewStats';

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
  'Self Hosters': number;
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

const formatMonthLabel = (dateKey: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
    .format(new Date(dateKey))
    .replace(' ', " '");

const formatMonthHeading = (monthKey: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${monthKey}-01T00:00:00.000Z`));

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
    const selfHostersValue =
      view === 'Unique'
        ? dataPoint['Self Hosters (Unique)']
        : dataPoint['Self Hosters (Cumulative)'];
    const buildersValue =
      view === 'Unique' ? dataPoint['Builders (Unique)'] : dataPoint['Builders (Cumulative)'];

    if (existing) {
      existing['Self Hosters'] += selfHostersValue;
      existing.Builders = view === 'Unique' ? existing.Builders + buildersValue : buildersValue;
      return;
    }

    aggregated.set(monthKey, {
      dateKey: `${monthKey}-01T00:00:00.000Z`,
      month: formatMonthLabel(dataPoint.dateKey),
      'Self Hosters': selfHostersValue,
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
      return Array.from(
        new Set(starsChart.map((dataPoint) => getYearKey(dataPoint.dateKey)))
      ).sort();
    }
    return [];
  }

  if (effectiveGranularity === 'Daily') {
    return Array.from(
      new Set(trafficChart.map((dataPoint) => getMonthKey(dataPoint.dateKey)))
    ).sort();
  }

  return Array.from(new Set(trafficChart.map((dataPoint) => getYearKey(dataPoint.dateKey)))).sort();
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
  if (selectedIndex === -1) {
    return null;
  }

  return {
    currentLabel: formatter(selectedPeriodKey),
    onPrevious: () =>
      setSelectedPeriodKey(availablePeriodKeys[selectedIndex - 1] ?? selectedPeriodKey),
    onNext: () => setSelectedPeriodKey(availablePeriodKeys[selectedIndex + 1] ?? selectedPeriodKey),
    isPreviousDisabled: selectedIndex === 0,
    isNextDisabled: selectedIndex === availablePeriodKeys.length - 1,
  };
};

const CommunityStats = ({ trafficChart, starsChart, isLoading }: CommunityStatsProps) => {
  const [view, setView] = useState<ViewType>('Unique');
  const [granularity, setGranularity] = useState<GranularityType>('Daily');
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="text-center p-10 text-text-secondary font-satoshi">
        Loading Repository Data...
      </div>
    );
  }

  // We ALWAYS pass all three keys so the legend permanently shows them all.
  const chartKeys = [
    { name: 'Self Hosters', color: '#247AED' },
    { name: 'Builders', color: '#10B981' },
    { name: 'Github Stars', color: '#F68523' },
  ];

  let chartData: Array<Record<string, number | string>> = [];
  let yAxisWidth = 40;
  const granularityOptions = getGranularityOptions(view);
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
  const navigationConfig =
    view === 'Stars' && effectiveGranularity === 'Yearly'
      ? null
      : buildNavigationConfig(
          availablePeriodKeys,
          resolvedPeriodKey,
          setSelectedPeriodKey,
          effectiveGranularity === 'Daily' ? formatMonthHeading : formatYearHeading
        );
  let xAxisDataKey: string | undefined;
  let xAxisType: 'category' | 'number' | undefined;
  let xAxisTicks: number[] | undefined;
  let xAxisDomain: [number, number] | undefined;
  let xTickFormatter: ((value: string | number) => string) | undefined;
  let tooltipLabelFormatter:
    | ((label: string | number, payload?: any[]) => React.ReactNode)
    | undefined;

  const mapTrafficPoint = (d: TrafficDataPoint) => ({
    month: d.month,
    dayNumber: getDayNumber(d.dateKey),
    'Self Hosters': view === 'Unique' ? d['Self Hosters (Unique)'] : d['Self Hosters (Cumulative)'],
    Builders: view === 'Unique' ? d['Builders (Unique)'] : d['Builders (Cumulative)'],
  });

  if (view === 'Stars') {
    chartData =
      effectiveGranularity === 'Yearly'
        ? aggregateStarsByYear(starsChart).map(({ dateKey, ...dataPoint }) => dataPoint)
        : starsChart
            .filter((dataPoint) => getYearKey(dataPoint.dateKey) === resolvedPeriodKey)
            .map(({ dateKey, ...dataPoint }) => dataPoint);
    yAxisWidth = 45;
  } else {
    const trafficData =
      effectiveGranularity === 'Monthly'
        ? aggregateTrafficByMonth(trafficChart, view)
            .filter((dataPoint) => getYearKey(dataPoint.dateKey) === resolvedPeriodKey)
            .map(({ dateKey, ...dataPoint }) => dataPoint)
        : trafficChart
            .filter((dataPoint) => getMonthKey(dataPoint.dateKey) === resolvedPeriodKey)
            .map(mapTrafficPoint);
    chartData = trafficData.length > 0 ? trafficData : [];

    if (effectiveGranularity === 'Daily' && chartData.length > 0) {
      const dayTicks = chartData
        .map((dataPoint) => Number(dataPoint.dayNumber))
        .filter((value, index, values) => values.indexOf(value) === index)
        .sort((left, right) => left - right);

      xAxisDataKey = 'dayNumber';
      xAxisType = 'number';
      xAxisTicks = dayTicks;
      xAxisDomain = [dayTicks[0], dayTicks[dayTicks.length - 1]];
      xTickFormatter = (value) => String(value);
      tooltipLabelFormatter = (_label, payload) => String(payload?.[0]?.payload?.month ?? _label);
    }
  }

  const chartHeader = (
    <div className="ChartCardHeader">
      <div className="ChartCardTopRow">
        <div className="PeriodToggle">
          {granularityOptions.map((option) => (
            <button
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
              <span className="text-capton-1 text-text-primary">{key.name}</span>
            </span>
          ))}
        </div>

        <div className="DataToggle">
          <button
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
        className="ChartNavigationButton"
        onClick={navigationConfig.onPrevious}
        disabled={navigationConfig.isPreviousDisabled}
        aria-label="Show previous period"
      >
        Prev
      </button>
      <span className="ChartNavigationLabel">{navigationConfig.currentLabel}</span>
      <button
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
