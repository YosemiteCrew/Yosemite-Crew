import React from 'react';
import StatCardShell from '@/app/ui/widgets/Stats/StatCardShell';
import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';

const formatTurnoverValue = (value: number) => value.toFixed(1);

const IndividualProductTurnoverStat = () => {
  const analytics = useDashboardAnalytics('last_1_year');
  const options = analytics.durationOptions.individualProductTurnover;
  const products = analytics.productTurnover;
  const isEmpty = analytics.emptyState.individualProductTurnover;
  const visibleProducts = products.slice(0, 6);

  const maxValue = visibleProducts.reduce((max, product) => Math.max(max, product.turnover), 0);

  return (
    <StatCardShell title={'Product turnover'} options={options} isEmpty={isEmpty}>
      {visibleProducts.map((product) => {
        const widthPercentage = maxValue > 0 ? (product.turnover / maxValue) * 100 : 0;
        return (
          <div key={product.itemId} className="grid grid-cols-[120px_1fr_32px] gap-2 items-center">
            <div className="text-body-4 text-text-primary break-words leading-4">
              {product.name}
            </div>
            <div
              className="h-5 rounded-full bg-neutral-100 overflow-hidden"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to right, rgba(17,17,17,0.08) 0, rgba(17,17,17,0.08) 1px, transparent 1px, transparent 16.66%)',
              }}
            >
              <div
                className="h-full bg-text-primary rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, widthPercentage))}%` }}
              />
            </div>
            <div className="text-body-4 text-text-primary text-right">
              {formatTurnoverValue(product.turnover)}
            </div>
          </div>
        );
      })}
    </StatCardShell>
  );
};

export default IndividualProductTurnoverStat;
