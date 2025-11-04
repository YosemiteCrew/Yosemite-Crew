export const generateTimeOptions = () => {
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

export const timeOptions = generateTimeOptions();

export const timeIndex = new Map(
  timeOptions.map((opt, idx) => [opt.value, idx])
);

export const getTimeLabelFromValue = (value: string) => {
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
];

export const DEFAULT_INTERVAL = { start: "09:00", end: "17:00" };
