import React from 'react';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';
import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';

const formatTurnoverValue = (value: number) => {
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(1);
};

const IndividualProductTurnoverStat = () => {
  const analytics = useDashboardAnalytics('last_1_year');
  const options = analytics.durationOptions.individualProductTurnover;
  const products = analytics.productTurnover;
  const isEmpty = analytics.emptyState.individualProductTurnover;
  const visibleProducts = products.slice(0, 6);

  const maxValue = visibleProducts.reduce((max, product) => Math.max(max, product.turnover), 0);

  return (
    <div className="flex flex-col gap-2">
      <CardHeader title={'Individual product turnover'} options={options} selected={options[0]} />
      <div className="bg-white border border-card-border p-3 rounded-2xl w-full min-h-75 flex flex-col gap-3">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-2 text-text-tertiary flex-1">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <rect x="4" y="24" width="8" height="12" rx="2" fill="#E7E7E7" />
              <rect x="16" y="16" width="8" height="20" rx="2" fill="#E7E7E7" />
              <rect x="28" y="10" width="8" height="26" rx="2" fill="#E7E7E7" />
            </svg>
            <span className="text-body-3">No data available</span>
          </div>
        ) : (
          visibleProducts.map((product) => {
            const widthPercentage = maxValue > 0 ? (product.turnover / maxValue) * 100 : 0;
            return (
              <div
                key={product.itemId}
                className="grid grid-cols-[120px_1fr_32px] gap-2 items-center"
              >
                <div className="text-body-4 text-text-primary break-words leading-4">
                  {product.name}
                </div>
                <div
                  className="h-5 rounded-full bg-[#F4F4F4] overflow-hidden"
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
          })
        )}
      </div>
    </div>
  );
};

export default IndividualProductTurnoverStat;
