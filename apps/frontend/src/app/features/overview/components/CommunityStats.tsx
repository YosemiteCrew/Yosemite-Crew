'use client';
import React, { useState } from 'react';
import DynamicChartCard from '@/app/ui/widgets/DynamicChart/DynamicChartCard';
import { ChartDataPoint } from '../hooks/useOverviewStats';

type CommunityStatsProps = {
  combinedChart: ChartDataPoint[];
  isLoading: boolean;
};

const CommunityStats = ({ combinedChart, isLoading }: CommunityStatsProps) => {
  // Default view is 'Unique' as requested
  const [trafficView, setTrafficView] = useState<'Unique' | 'Cumulative'>('Unique');

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

  // Map the raw data into simple keys for the chart based on the active toggle
  const trafficData = combinedChart.map((d) => ({
    month: d.month,
    'Self Hosters':
      trafficView === 'Unique' ? d['Self Hosters (Unique)'] : d['Self Hosters (Cumulative)'],
    Builders: trafficView === 'Unique' ? d['Builders (Unique)'] : d['Builders (Cumulative)'],
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* 2 CHARTS ROW */}
      <div className="ChartGrid">
        {/* CHART 1: Traffic (Self Hosters & Builders) */}
        <div className="PremiumCard LeftAlignLegend" style={{ position: 'relative' }}>
          {/* CUSTOM TOGGLE PILLS */}
          <div className="DataToggle">
            <button
              className={`TogglePill ${trafficView === 'Unique' ? 'Active' : ''}`}
              onClick={() => setTrafficView('Unique')}
            >
              Unique
            </button>
            <button
              className={`TogglePill ${trafficView === 'Cumulative' ? 'Active' : ''}`}
              onClick={() => setTrafficView('Cumulative')}
            >
              Cumulative
            </button>
          </div>

          <h3 className="CardTitle">15-Day Repository Traffic</h3>

          <div className="ChartWrapper">
            <DynamicChartCard
              data={trafficData}
              type="line"
              keys={[
                { name: 'Self Hosters', color: '#247AED' },
                { name: 'Builders', color: '#10B981' },
              ]}
              yAxisWidth={40}
            />
          </div>
        </div>

        {/* CHART 2: Stargazers */}
        <div className="PremiumCard">
          <h3 className="CardTitle">Stargazers</h3>
          <div className="ChartWrapper">
            <DynamicChartCard
              data={combinedChart}
              type="line"
              keys={[{ name: 'Stars', color: '#F68523' }]}
              yAxisWidth={45}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityStats;
