'use client';
import React, { useState } from 'react';
import DynamicChartCard from '@/app/ui/widgets/DynamicChart/DynamicChartCard';
import { ChartDataPoint } from '../hooks/useOverviewStats';

type CommunityStatsProps = {
  combinedChart: ChartDataPoint[];
  isLoading: boolean;
};

const CommunityStats = ({ combinedChart, isLoading }: CommunityStatsProps) => {
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

  const trafficData = combinedChart.map((d) => ({
    month: d.month,
    'Self Hosters':
      trafficView === 'Unique' ? d['Self Hosters (Unique)'] : d['Self Hosters (Cumulative)'],
    Builders: trafficView === 'Unique' ? d['Builders (Unique)'] : d['Builders (Cumulative)'],
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <style>{`
        /* Force Recharts legends perfectly flush to the left */
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
        /* Give the chart a tiny bit of breathing room from the legend */
        .ForceLeftLegend .recharts-wrapper {
          margin-top: 10px;
        }
      `}</style>

      {/* 2 CHARTS ROW */}
      <div className="ChartGrid">
        <div className="PremiumCard ForceLeftLegend" style={{ position: 'relative' }}>
          <div
            className="DataToggle"
            style={{
              position: 'absolute',
              top: '12px',
              right: '8px',
              zIndex: 10,
              margin: 0,
            }}
          >
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

          <div className="ChartWrapper" style={{ width: '100%', minHeight: '350px' }}>
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

        <div className="PremiumCard ForceLeftLegend" style={{ position: 'relative' }}>
          <div className="ChartWrapper" style={{ width: '100%', minHeight: '350px' }}>
            <DynamicChartCard
              data={combinedChart}
              type="line"
              keys={[{ name: 'Github Stars', color: '#F68523' }]}
              yAxisWidth={45}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityStats;
