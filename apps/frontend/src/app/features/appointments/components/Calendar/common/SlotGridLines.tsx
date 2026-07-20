import React from 'react';

type SlotGridLinesProps = {
  userId: string;
  hour: number;
  lastVisibleHour: number;
  slotOffsetMinutes: number[];
};

// Hour rules are the frame's plain `1px solid var(--hairline)`. The sub-hour slot
// rules have no counterpart in the frame, so they take a diluted --hairline, which
// stays a step softer than the hour rule in both themes (a flat --divider does not:
// it is darker than --hairline in light and lighter in dark).
const HOUR_LINE_COLOR = 'var(--hairline)';
const SLOT_LINE_COLOR = 'color-mix(in srgb, var(--hairline) 55%, transparent)';

const SlotGridLines = ({
  userId,
  hour,
  lastVisibleHour,
  slotOffsetMinutes,
}: SlotGridLinesProps) => (
  <div className="pointer-events-none absolute inset-0 z-10">
    <div className="absolute inset-x-0 top-0 border-t" style={{ borderColor: HOUR_LINE_COLOR }} />
    {slotOffsetMinutes.map((minute) => (
      <div
        key={`${userId}-${hour}-slot-${minute}`}
        className="absolute inset-x-0 border-t"
        style={{ top: `${(minute / 60) * 100}%`, borderColor: SLOT_LINE_COLOR }}
      />
    ))}
    {hour === lastVisibleHour && (
      <div
        className="absolute inset-x-0 top-full border-t"
        style={{ borderColor: HOUR_LINE_COLOR }}
      />
    )}
  </div>
);

export default SlotGridLines;
