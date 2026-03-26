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

const CommunityStats = ({ trafficChart, starsChart, isLoading }: CommunityStatsProps) => {
  const [view, setView] = useState<ViewType>('Unique');

  if (isLoading) {
    return (
      <div
        className="text-center p-10 text-text-secondary"
        style={{ fontFamily: 'var(--satoshi-font)' }}
      >
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

  let chartData: any[] = [];
  let yAxisWidth = 40;

  if (view === 'Stars') {
    chartData = starsChart;
    yAxisWidth = 45;
  } else {
    chartData = trafficChart.map((d) => ({
      month: d.month,
      'Self Hosters':
        view === 'Unique' ? d['Self Hosters (Unique)'] : d['Self Hosters (Cumulative)'],
      Builders: view === 'Unique' ? d['Builders (Unique)'] : d['Builders (Cumulative)'],
    }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
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
          padding-left: 0px !important;
          margin-top: 0px !important;
        }
        .ForceLeftLegend .recharts-wrapper {
          margin-top: 10px;
        }
      `}</style>

      {/* SINGLE FULL-WIDTH CHART */}
      <div className="ChartGrid">
        <div className="PremiumCard ForceLeftLegend" style={{ position: 'relative' }}>
          <div
            className="DataToggle"
            style={{
              position: 'absolute',
              top: '12px',
              right: '24px',
              zIndex: 10,
              margin: 0,
            }}
          >
            <button
              className={`TogglePill ${view === 'Unique' ? 'Active' : ''}`}
              onClick={() => setView('Unique')}
            >
              Unique
            </button>
            <button
              className={`TogglePill ${view === 'Cumulative' ? 'Active' : ''}`}
              onClick={() => setView('Cumulative')}
            >
              Cumulative
            </button>
            <button
              className={`TogglePill ${view === 'Stars' ? 'Active' : ''}`}
              onClick={() => setView('Stars')}
            >
              Stars
            </button>
          </div>

          {/* FIXED: Changed minHeight to an explicit height of 400px so it stops overflowing! */}
          <div className="ChartWrapper" style={{ width: '100%', height: '366px' }}>
            <DynamicChartCard
              data={chartData}
              type="line"
              keys={chartKeys}
              yAxisWidth={yAxisWidth}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityStats;
