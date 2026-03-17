import React from 'react';

type SlotGridLinesProps = {
  userId: string;
  hour: number;
  lastVisibleHour: number;
  slotOffsetMinutes: number[];
};

const SlotGridLines = ({
  userId,
  hour,
  lastVisibleHour,
  slotOffsetMinutes,
}: SlotGridLinesProps) => (
  <div className="pointer-events-none absolute inset-0 z-10">
    <div className="absolute inset-x-0 top-0 border-t border-[#C3CEDC]" />
    {slotOffsetMinutes.map((minute) => (
      <div
        key={`${userId}-${hour}-slot-${minute}`}
        className="absolute inset-x-0 border-t border-[#E9EDF3]"
        style={{ top: `${(minute / 60) * 100}%` }}
      />
    ))}
    {hour === lastVisibleHour && (
      <div className="absolute inset-x-0 top-full border-t border-[#C3CEDC]" />
    )}
  </div>
);

export default SlotGridLines;
