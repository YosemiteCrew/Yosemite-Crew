/** Drag affordances: the droppable bands, plus the dashed preview at the landing minute. */
export const TaskDropOverlays = ({
  availabilitySegments,
  dropPreviewMinute,
  draggedTaskLabel,
  draggedTaskDurationMinutes,
  hourStartMinute,
  height,
}: {
  availabilitySegments: Array<{ top: number; height: number }>;
  dropPreviewMinute: number | null;
  draggedTaskLabel?: string | null;
  draggedTaskDurationMinutes: number;
  hourStartMinute: number;
  height: number;
}) => (
  <>
    {availabilitySegments.map((segment, index) => (
      <div
        key={`task-drop-availability-${index}-${segment.top}`}
        className="pointer-events-none absolute left-1 right-1 z-10 rounded-xl border border-card-border bg-[var(--color-calendar-availability-overlay)]"
        style={{
          top: segment.top,
          height: segment.height,
        }}
      />
    ))}
    {dropPreviewMinute != null && (
      <div
        className="pointer-events-none absolute left-1 right-1 z-[15]"
        style={{
          top: ((dropPreviewMinute - hourStartMinute) / 60) * height,
        }}
      >
        <div
          className="rounded-xl border-2 border-dashed border-card-border bg-[var(--color-calendar-preview-overlay)]"
          style={{
            height: Math.max(12, (Math.max(5, draggedTaskDurationMinutes) / 60) * height),
          }}
        >
          <div className="size-full flex items-center justify-center px-2 text-caption-1 text-blue-text truncate">
            {draggedTaskLabel || 'Task'}
          </div>
        </div>
      </div>
    )}
  </>
);

export default TaskDropOverlays;
