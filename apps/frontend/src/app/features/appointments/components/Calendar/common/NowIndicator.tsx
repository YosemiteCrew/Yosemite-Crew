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
            <div className="absolute left-3 -translate-y-[115%] text-[10px] leading-none font-semibold text-red-500 whitespace-nowrap">
              {timeLabel}
            </div>
          )}
          <div className="absolute -left-3 w-3 h-3 rounded-full bg-red-500 translate-y-[-50%]" />
          <div className="border-t-2 border-t-red-500 translate-y-[-50%]" />
        </div>
      </div>
      <div />
    </div>
  </div>
);

export default NowIndicator;
