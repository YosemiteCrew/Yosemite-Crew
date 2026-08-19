/** Hour rules behind the markers: the hour boundary, each slot step, and the closing rule. */
export const TaskSlotGridLines = ({
  hour,
  slotOffsetMinutes,
  isLastVisibleHour,
}: {
  hour: number;
  slotOffsetMinutes: number[];
  isLastVisibleHour: boolean;
}) => (
  // The same rules as common/SlotGridLines.tsx:14-15, which this file's own Week
  // and Team views already render. This private copy was still on the pre-redesign
  // cool ramp: --color-calendar-line-soft is #e9edf3, a COOL grey on the warm bone
  // ground in light, and #302820 in dark - 1.01:1 on the slot surface, so the
  // sub-hour rules simply were not there.
  <div className="pointer-events-none absolute inset-0 z-[5]">
    <div className="absolute inset-x-0 top-0 border-t border-[var(--hairline)]" />
    {slotOffsetMinutes.map((minute) => (
      <div
        key={`task-slot-grid-${hour}-${minute}`}
        className="absolute inset-x-0 border-t"
        style={{
          top: `${(minute / 60) * 100}%`,
          borderTopColor: 'color-mix(in srgb, var(--hairline) 55%, transparent)',
        }}
      />
    ))}
    {isLastVisibleHour && (
      <div className="absolute inset-x-0 top-full border-t border-[var(--hairline)]" />
    )}
  </div>
);

export default TaskSlotGridLines;
