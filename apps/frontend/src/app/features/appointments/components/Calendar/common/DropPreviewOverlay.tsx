import React from 'react';

type DropPreviewOverlayProps = {
  dropPreviewMinute: number;
  height: number;
  draggedAppointmentDurationMinutes?: number;
  draggedAppointmentLabel?: string | null;
};

const DropPreviewOverlay = ({
  dropPreviewMinute,
  height,
  draggedAppointmentDurationMinutes,
  draggedAppointmentLabel,
}: DropPreviewOverlayProps) => (
  <div
    className="pointer-events-none absolute inset-x-1 z-30 rounded-md border-2 border-dashed border-grey-light bg-calendar-preview-overlay"
    style={{
      top: `${((dropPreviewMinute % 60) / 60) * height}px`,
      height: `${Math.max(
        14,
        (Math.min(
          Math.max(5, draggedAppointmentDurationMinutes ?? 30),
          60 - (dropPreviewMinute % 60)
        ) /
          60) *
          height
      )}px`,
    }}
  >
    <div className="size-full flex items-center justify-center px-2 text-caption-1 text-text-brand truncate">
      {draggedAppointmentLabel || 'Appointment'}
    </div>
  </div>
);

export default DropPreviewOverlay;
