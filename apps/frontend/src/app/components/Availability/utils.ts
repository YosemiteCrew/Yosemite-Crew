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
export type SetAvailability = React.Dispatch<
  React.SetStateAction<AvailabilityState>
>;

const formatUtcTimeToLocalLabel = (value: string): string => {
  if (!value) return value;
  const date = new Date(`1970-01-01T${value}:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
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

export type ApiAvailability = {
  availabilities: {
    dayOfWeek: string;
    slots: { startTime: string; endTime: string }[];
  }[];
};

export const convertAvailability = (
  availability: AvailabilityState
): ApiAvailability => {
  const result = {
    availabilities: Object.entries(availability)
      .filter(([_, data]) => data.enabled)
      .map(([day, data]) => {
        const validSlots = data.intervals
          .filter((interval) => interval.start && interval.end)
          .map((interval) => ({
            startTime: interval.start,
            endTime: interval.end,
          }));

        return {
          dayOfWeek: day.toUpperCase(),
          slots: validSlots,
        };
      })
      .filter((day) => day.slots.length > 0),
  };
  return result;
};

export type ApiSlot = {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
};

export type ApiDayAvailability = {
  _id: string;
  userId?: string;
  organisationId: string;
  dayOfWeek: string;
  slots: ApiSlot[];
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
};

export type GetAvailabilityResponse = {
  message?: string;
  data: ApiDayAvailability[];
};

export const convertFromGetApi = (
  apiData: ApiDayAvailability[]
): AvailabilityState => {
  const hasAnyAvailableSlot = apiData.some((entry) =>
    entry.slots?.some((slot) => slot.isAvailable)
  );
  if (!hasAnyAvailableSlot) {
    return daysOfWeek.reduce<AvailabilityState>((acc, day) => {
      const isWeekday =
        day === "Monday" ||
        day === "Tuesday" ||
        day === "Wednesday" ||
        day === "Thursday" ||
        day === "Friday";

      acc[day] = {
        enabled: isWeekday,
        intervals: [{ ...DEFAULT_INTERVAL }],
      };
      return acc;
    }, {} as AvailabilityState);
  }
  const result: AvailabilityState = {} as AvailabilityState;
  const apiMap = new Map<string, ApiSlot[]>(
    apiData.map((entry) => [
      entry.dayOfWeek.toUpperCase(),
      entry.slots.filter((slot) => slot.isAvailable),
    ])
  );
  for (const day of daysOfWeek) {
    const key = day.toUpperCase();
    const slots = apiMap.get(key);
    if (!slots || slots.length === 0) {
      result[day] = {
        enabled: false,
        intervals: [{ ...DEFAULT_INTERVAL }],
      };
      continue;
    }
    result[day] = {
      enabled: true,
      intervals: slots.map((slot) => ({
        start: slot.startTime,
        end: slot.endTime,
      })),
    };
  }
  return result;
};

export const hasAtLeastOneAvailability = (
  converted: ApiAvailability
): boolean => {
  return (
    Array.isArray(converted.availabilities) &&
    converted.availabilities.length > 0
  );
};
