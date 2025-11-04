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

export const generateTimeOptions = (): TimeOption[] => {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 15) {
      const hh = hour.toString().padStart(2, "0");
      const mm = min.toString().padStart(2, "0");
      const ampm = hour < 12 ? "AM" : "PM";
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      options.push({
        value: `${hh}:${mm}`,
        label: `${displayHour}:${mm} ${ampm}`,
      });
    }
  }
  options.push({ value: "23:59", label: "11:59 PM" });
  return options;
};

export const timeOptions: TimeOption[] = generateTimeOptions();

export const timeIndex: Map<string, number> = new Map(
  timeOptions.map((opt, idx) => [opt.value, idx])
);

export const getTimeLabelFromValue = (value: string): string => {
  const match = timeOptions.find((e) => e.value === value);
  return match ? match.label : value;
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
