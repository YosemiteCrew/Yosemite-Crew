import React from 'react';
import { computeEstimate } from './appointmentCentralModalUtils';

type AppointmentEstimatePanelProps = {
  cost: unknown;
  maxDiscount: unknown;
  currency?: string;
};

const FONT = 'var(--font-satoshi), sans-serif';
const NEUTRAL_900 = 'var(--color-neutral-900)';

const label14M: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '120%',
  color: NEUTRAL_900,
};

const value14B: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 14,
  fontWeight: 700,
  lineHeight: '120%',
  color: NEUTRAL_900,
};

const AppointmentEstimatePanel = ({
  cost,
  maxDiscount,
  currency,
}: AppointmentEstimatePanelProps) => {
  const costNum = Number(cost) || 0;
  const discountNum = Number(maxDiscount) || 0;
  const estimate = computeEstimate(cost);
  const currencyLabel = currency ?? 'USD';

  const costDisplay = costNum > 0 ? `$ ${costNum.toFixed(2)}` : '-';
  const discountDisplay = discountNum > 0 ? `$${discountNum.toFixed(2)}` : '-';
  const estimateDisplay = estimate > 0 ? `$ ${estimate.toFixed(2)}` : '$ 00.00';
  const estimateIsReal = estimate > 0;

  return (
    <div className="rounded-2xl border border-card-border p-4 flex gap-4 items-center">
      {/* Left col: Cost + Max discount — label left, value right, two rows */}
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span style={label14M}>{`Cost (${currencyLabel}):`}</span>
          <span style={value14B}>{costDisplay}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span style={label14M}>Max discount:</span>
          <span style={value14B}>{discountDisplay}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px bg-card-border self-stretch" />

      {/* Right col: Estimate label + large value */}
      <div className="flex flex-col items-end justify-center gap-1 shrink-0">
        <span
          style={{
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 500,
            lineHeight: '120%',
            letterSpacing: '-0.28px',
            color: NEUTRAL_900,
            textAlign: 'right',
          }}
        >
          Estimate
        </span>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 24,
            fontWeight: 700,
            lineHeight: '120%',
            letterSpacing: '-0.48px',
            color: estimateIsReal ? 'var(--color-primary-600)' : 'var(--color-neutral-400)',
            textAlign: 'right',
          }}
        >
          {estimateDisplay}
        </span>
      </div>
    </div>
  );
};

export default AppointmentEstimatePanel;
