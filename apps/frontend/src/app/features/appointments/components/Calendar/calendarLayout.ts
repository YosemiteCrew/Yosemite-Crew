import { MINUTES_PER_STEP } from '@/app/features/appointments/components/Calendar/helpers';

export type CalendarZoomMode = 'in' | 'out';

export const getHourRowHeightPx = (zoomMode: CalendarZoomMode): number => {
  return zoomMode === 'out' ? 34 : 180;
};

export const getPixelsPerStepForZoom = (zoomMode: CalendarZoomMode): number => {
  const stepsPerHour = 60 / MINUTES_PER_STEP;
  return getHourRowHeightPx(zoomMode) / stepsPerHour;
};

export const getCalendarColumnGridStyle = (columnCount: number, minColumnWidthPx: number) => {
  const safeColumns = Math.max(1, columnCount);
  return {
    gridTemplateColumns: `repeat(${safeColumns}, minmax(${minColumnWidthPx}px, 1fr))`,
    width: `max(100%, ${safeColumns * minColumnWidthPx}px)`,
  } as const;
};

export const formatHourLabel = (hour24: number): string => {
  const normalized = ((hour24 % 24) + 24) % 24;
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  const meridiem = normalized < 12 ? 'AM' : 'PM';
  return `${hour12}:00 ${meridiem}`;
};
