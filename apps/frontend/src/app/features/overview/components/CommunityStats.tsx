'use client';
import React from 'react';
import { FaGithub } from 'react-icons/fa';
import DynamicChartCard from '@/app/ui/widgets/DynamicChart/DynamicChartCard';
import { RepoStatsSummary, ChartDataPoint } from '../hooks/useOverviewStats';

type CommunityStatsProps = {
  data: RepoStatsSummary | null;
  clonesChart: ChartDataPoint[];
  forksChart: ChartDataPoint[];
  starsChart: ChartDataPoint[];
  isLoading: boolean;
};

const CommunityStats = ({
  data,
  clonesChart,
  forksChart,
  starsChart,
  isLoading,
}: CommunityStatsProps) => {
  if (isLoading || !data) {
    return (
      <div
        className="text-center p-10 text-text-secondary"
        style={{ fontFamily: 'var(--satoshi-font)' }}
      >
        Loading Repository Data...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* SECTION HEADER */}
      <div className="OverviewSectionTitle">
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FaGithub /> GitHub Community
        </span>
        {data.generated_at_utc && (
          <span
            style={{
              fontFamily: 'var(--satoshi-font)',
              fontSize: '0.875rem',
              fontWeight: 400,
              color: 'var(--color-text-tertiary)',
              border: '1px solid var(--color-card-border)',
              padding: '4px 12px',
              borderRadius: '100px',
              background: 'var(--whitebg)',
            }}
          >
            Updated: {data.generated_at_utc.replace(' UTC', '')}
          </span>
        )}
      </div>

      {/* QUICK STATS ROW */}
      <div className="QuickStatsGrid">
        <div className="QuickStatCard">
          <span className="QuickStatLabel">Total Views</span>
          <span className="QuickStatValue">{data.views?.total || 0}</span>
        </div>
        <div className="QuickStatCard">
          <span className="QuickStatLabel">Unique Visitors</span>
          <span className="QuickStatValue">{data.views?.unique || 0}</span>
        </div>
        <div className="QuickStatCard">
          <span className="QuickStatLabel">Total Clones</span>
          <span className="QuickStatValue">{data.clones?.total || 0}</span>
        </div>
        <div className="QuickStatCard">
          <span className="QuickStatLabel">Unique Cloners</span>
          <span className="QuickStatValue">{data.clones?.unique || 0}</span>
        </div>
      </div>

      {/* 3 CHARTS ROW */}
      <div className="ChartGrid">
        {/* CHART 1: Clones -> Self Hosters */}
        <div className="PremiumCard">
          <h3 className="CardTitle">Self Hosters</h3>
          <div className="ChartWrapper">
            <DynamicChartCard
              data={clonesChart}
              type="line"
              keys={[{ name: 'Self Hosters', color: '#247AED' }]}
              yAxisWidth={40}
            />
          </div>
        </div>

        {/* CHART 2: Forks -> Builders */}
        <div className="PremiumCard">
          <h3 className="CardTitle">Builders</h3>
          <div className="ChartWrapper">
            <DynamicChartCard
              data={forksChart}
              type="line"
              keys={[{ name: 'Builders', color: '#8A2BE2' }]}
              yAxisWidth={40}
            />
          </div>
        </div>

        {/* CHART 3: Stargazers */}
        <div className="PremiumCard">
          <h3 className="CardTitle">Stargazers</h3>
          <div className="ChartWrapper">
            <DynamicChartCard
              data={starsChart}
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
