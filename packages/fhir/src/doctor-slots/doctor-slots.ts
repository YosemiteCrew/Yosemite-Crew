import { FhirSlot, Slot } from "@yosemite-crew/types";

export function convertToFhirSlotResource(data: {
  doctorId: string;
  day: string;
  date: string; // Format: YYYY-MM-DD
  duration: string | number;
  timeSlots: { time: string; selected: boolean }[];
  unavailableSlots: string[];
}) {
  const { doctorId, day, date, duration, timeSlots, unavailableSlots } = data;

  const slotEntries = timeSlots.map((slot) => {
    const start = convertTimeToISO(date, slot.time);

    return {
      resource: {
        resourceType: "Slot",
        status: "free", // timeSlots are always free
        schedule: {
          reference: `Schedule/${doctorId}`,
        },
        start,
        extension: [
          {
            url: "http://example.com/fhir/StructureDefinition/slot-day",
            valueString: day,
          },
          {
            url: "http://example.com/fhir/StructureDefinition/slot-selected",
            valueBoolean: slot.selected,
          },
          {
            url: "http://example.com/fhir/StructureDefinition/slot-duration",
            valueString: String(duration),
          },
        ],
      },
    };
  });

  const unavailableEntries = unavailableSlots.map((timeStr) => {
    const start = convertTimeToISO(date, timeStr);

    return {
      resource: {
        resourceType: "Slot",
        status: "busy", // unavailable are always busy
        schedule: {
          reference: `Schedule/${doctorId}`,
        },
        start,
        extension: [
          {
            url: "http://example.com/fhir/StructureDefinition/slot-day",
            valueString: day,
          },
          {
            url: "http://example.com/fhir/StructureDefinition/slot-selected",
            valueBoolean: false, // default false
          },
          {
            url: "http://example.com/fhir/StructureDefinition/slot-duration",
            valueString: String(duration),
          },
        ],
      },
    };
  });

  return {
    resourceType: "Bundle",
    type: "collection",
    entry: [...slotEntries, ...unavailableEntries],
  };
}

// Helper: Converts '8:00 AM' + date to ISO string
function convertTimeToISO(date: string, timeStr: string): string {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) throw new Error(`Invalid time format: ${timeStr}`);

  let [_, hourStr, minuteStr, ampm] = match;
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
  if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;

  return `${date}T${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}:00`;
}

export function convertFromFhirSlotBundle(bundle: any) {
  if (!bundle || !Array.isArray(bundle.entry)) return null;

  const timeSlots: { time: string; selected: boolean }[] = [];
  const unavailableSlots: string[] = [];

  for (const entry of bundle.entry) {
    const resource = entry.resource;
    const start = resource.start;

    const time = new Date(start).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const selected = resource.extension?.find(
      (ext: any) =>
        ext.url === "http://example.com/fhir/StructureDefinition/slot-selected"
    )?.valueBoolean ?? false;

    if (resource.status === "busy") {
      unavailableSlots.push(time);
    } else {
      timeSlots.push({ time, selected });
    }
  }

  const first = bundle.entry[0]?.resource;

  const day = first?.extension?.find(
    (ext: any) =>
      ext.url === "http://example.com/fhir/StructureDefinition/slot-day"
  )?.valueString ?? "";

  const duration = first?.extension?.find(
    (ext: any) =>
      ext.url === "http://example.com/fhir/StructureDefinition/slot-duration"
  )?.valueString ?? "0";

  const doctorId = first?.schedule?.reference?.split("/")[1] || "";
  const date = first?.start?.split("T")[0] || "";

  return {
    doctorId,
    date,
    day,
    duration,
    timeSlots,
    unavailableSlots,
  };
}












export function convertToFhirSlotResources(slots: Slot[], doctorId: string, date: string): FhirSlot[] {
  return slots.map((slot, index) => ({
    resourceType: "Slot",
    id: `${doctorId}-${date}-${index}`,
    extension: [
      {
        url: "http://example.org/fhir/StructureDefinition/original-time",
        valueString: slot.time, // keep time as-is (e.g., "10:00 AM")
      },
    ],
    status: slot.selected ? "busy" : "free",
  }));
}


export function convertFromFhirSlots(fhirSlots: FhirSlot[]): Slot[] {
  return fhirSlots.map((slot) => {
    const timeExt = slot.extension.find((ext) => ext.url === "http://example.org/fhir/StructureDefinition/original-time");
    return {
      time: timeExt?.valueString || "",
      selected: slot.status === "busy",
    };
  });
}
