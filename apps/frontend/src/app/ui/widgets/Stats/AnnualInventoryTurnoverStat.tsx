import React from 'react';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';
import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';

const SEGMENT_COUNT = 6;

const AnnualInventoryTurnoverStat = () => {
  const analytics = useDashboardAnalytics('last_1_year');
  const options = analytics.durationOptions.annualInventoryTurnover;
  const turnover = analytics.inventoryTurnover;

  const turnsPerYear = Math.max(0, turnover.turnsPerYear);
  const targetTurns = Math.max(0, turnover.targetTurnsPerYear);
  const restockDays = Math.max(0, turnover.restockCycleDays);

  const completionRatio = targetTurns > 0 ? Math.min(1, turnsPerYear / targetTurns) : 0;
  const filledSegments = Math.round(completionRatio * SEGMENT_COUNT);

  const trend = turnover.trend;
  const start = trend[0];
  const end = trend.at(-1);

  return (
    <div className="flex flex-col gap-2">
      <CardHeader title={'Annual inventory turnover'} options={options} selected={options[0]} />
      <div className="bg-white border border-card-border p-3 rounded-2xl w-full min-h-[300px] flex flex-col gap-3">
        <div className="text-body-1 text-text-primary">{turnsPerYear.toFixed(1)} turns / year</div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-body-3 text-text-primary">Restock every {restockDays || 0} days</div>
          <div className="text-body-3 text-text-primary">
            Target: {targetTurns.toFixed(1)} x (
            {targetTurns > 0 ? Math.round(365 / targetTurns) : 0} days)
          </div>
        </div>

        <div className="flex items-center justify-between text-body-4 text-text-tertiary">
          <span>{start ? `${start.month} ${start.year}` : 'Start'}</span>
          <span>{end ? `${end.month} ${end.year}` : 'End'}</span>
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
            <div
              key={`turnover-segment-${index + 1}`}
              className={`h-2 rounded-full ${index < filledSegments ? 'bg-[#F28A2E]' : 'bg-[#E7E7E7]'}`}
            />
          ))}
        </div>

        <p className="text-body-3 text-text-secondary">
          <span className="text-blue-text">Note :</span> Annual inventory turnover is how many times
          your clinic uses up and replaces inventory in a year.
        </p>
      </div>
    </div>
  );
};

export default AnnualInventoryTurnoverStat;
