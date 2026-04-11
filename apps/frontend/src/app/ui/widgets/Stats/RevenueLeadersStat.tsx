import React, { useEffect, useState } from 'react';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoney } from '@/app/lib/money';
import {
  DashboardDurationOption,
  mapDashboardDurationOption,
  useDashboardAnalytics,
} from '@/app/features/dashboard/hooks/useDashboardAnalytics';

const RevenueLeadersStat = () => {
  const [selectedDuration, setSelectedDuration] = useState<DashboardDurationOption>('Last week');
  const currency = useCurrencyForPrimaryOrg();
  const analytics = useDashboardAnalytics(mapDashboardDurationOption(selectedDuration));
  const durationOptions = analytics.durationOptions.revenueLeaders;
  const leaders = analytics.revenueLeaders;

  useEffect(() => {
    if (!durationOptions.includes(selectedDuration)) {
      setSelectedDuration(durationOptions[0] ?? 'Last week');
    }
  }, [durationOptions, selectedDuration]);

  const topLeader = leaders[0] ?? { label: 'No data', revenue: 0 };
  const secondLeader = leaders[1] ?? { label: 'No data', revenue: 0 };
  const thirdLeader = leaders[2] ?? { label: 'No data', revenue: 0 };

  return (
    <div className="flex flex-col gap-2">
      <CardHeader
        title={'Revenue leaders'}
        options={durationOptions}
        selected={selectedDuration}
        onSelect={(next) => setSelectedDuration(next as DashboardDurationOption)}
      />
      <div className="bg-white border border-card-border p-3 flex flex-col gap-2 rounded-2xl w-full min-h-[356px] overflow-hidden">
        <div className="bg-text-primary w-full p-3 rounded-2xl flex flex-col justify-end gap-1 h-1/2">
          <div className="text-heading-1 text-white">
            {formatMoney(topLeader.revenue, currency)}
          </div>
          <div className="text-body-4 text-white">{topLeader.label}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 h-1/2">
          <div className="bg-text-primary w-full p-3 rounded-2xl flex flex-col justify-end gap-1 h-full">
            <div className="text-heading-1 text-white">
              {formatMoney(secondLeader.revenue, currency)}
            </div>
            <div className="text-body-4 text-white">{secondLeader.label}</div>
          </div>
          <div className="bg-text-primary w-full p-3 rounded-2xl flex flex-col justify-end gap-1 h-full">
            <div className="text-heading-1 text-white">
              {formatMoney(thirdLeader.revenue, currency)}
            </div>
            <div className="text-body-4 text-white">{thirdLeader.label}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueLeadersStat;
