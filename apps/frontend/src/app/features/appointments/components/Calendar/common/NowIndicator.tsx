import React from 'react';

type NowIndicatorProps = {
  topPx: number;
  timeLabel: string | null;
};

const NowIndicator = ({ topPx, timeLabel }: NowIndicatorProps) => (
  <div className="pointer-events-none absolute inset-0">
    <div className="grid h-full grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
      <div />
      <div className="relative">
        <div className="absolute left-0 right-2 z-20" style={{ top: topPx }}>
          {timeLabel && (
            <div
              className="absolute left-3 -translate-y-[115%] text-[10px] leading-none font-semibold whitespace-nowrap"
              style={{ color: 'var(--color-danger-700)' }}
            >
              {timeLabel}
            </div>
          )}
          <div
            className="absolute -left-3 w-3 h-3 rounded-full translate-y-[-50%]"
            style={{ backgroundColor: 'var(--color-danger-700)' }}
          />
          <div
            className="translate-y-[-50%]"
            style={{
              borderTopWidth: '2px',
              borderTopStyle: 'solid',
              borderTopColor: 'var(--color-danger-700)',
            }}
          />
        </div>
      </div>
      <div />
    </div>
  </div>
);

export default NowIndicator;
