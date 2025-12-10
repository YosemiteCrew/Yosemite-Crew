export interface TimeOption {
  value: string;
  label: string;
}
export interface Interval {
  start: string;
  end: string;
}
export interface DayAvailability {
  enabled: boolean;
  intervals: Interval[];
}
export type AvailabilityState = Record<string, DayAvailability>;
export type SetAvailability = React.Dispatch<React.SetStateAction<AvailabilityState>>;

const formatUtcTimeToLocalLabel = (value: string): string => {
  if (!value) return value;
  const date = new Date(`1970-01-01T${value}:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const generateTimeOptions = (): TimeOption[] => {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 15) {
      const hh = hour.toString().padStart(2, "0");
      const mm = min.toString().padStart(2, "0");
      const label = formatUtcTimeToLocalLabel(`${hh}:${mm}`);
      options.push({
        value: `${hh}:${mm}`,
        label,
      });
    }
  }
  options.push({ value: "23:59", label: formatUtcTimeToLocalLabel("23:59") });
  return options;
};

export const timeOptions: TimeOption[] = generateTimeOptions();

export const timeIndex: Map<string, number> = new Map(
  timeOptions.map((opt, idx) => [opt.value, idx])
);

export const getTimeLabelFromValue = (value: string): string => {
  const match = timeOptions.find((e) => e.value === value);
  return match ? match.label : formatUtcTimeToLocalLabel(value);
};

export const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DEFAULT_INTERVAL: Interval = { start: "09:00", end: "17:00" };
