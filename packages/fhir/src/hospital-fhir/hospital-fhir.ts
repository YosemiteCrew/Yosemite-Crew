import {
  DataItem,
  FHIRBundleGraph,
  FHIRtoJSONSpeacilityStats,
  FHIRBundleGraphForSpecialitywiseAppointments,
} from "@yosemite-crew/types";

export function getLastDayOfMonth(month: number): number {
  const currentYear = new Date().getFullYear();
  return new Date(currentYear, month, 0).getDate(); // Get last day of given month
}

export function convertFHIRToGraphData(
  fhirBundle: FHIRBundleGraph
): DataItem[] {
  if (!fhirBundle || !Array.isArray(fhirBundle.entry)) return [];

  return fhirBundle.entry.map((entry) => {
    const resource = entry.resource;

    const monthname =
      resource.extension?.find(
        (ext) =>
          ext.url === "http://example.org/fhir/StructureDefinition/month-name"
      )?.valueString || "";

    const getCount = (label: string): number =>
      resource.group?.find((g) => g.code.text === label)?.population[0]
        ?.count ?? 0;

    return {
      monthname,
      completed: getCount("Successful Appointments"),
      cancelled: getCount("Canceled Appointments"),
    };
  });
}

export function FHIRtoJSONSpeacilityStats(
  bundle: FHIRBundleGraphForSpecialitywiseAppointments
): FHIRtoJSONSpeacilityStats[] {
  if (!bundle || !Array.isArray(bundle.entry)) return [];

  return bundle.entry.map((entry: any) => {
    const resource = entry.resource;
    const departmentName =
      resource.extension?.find(
        (ext: any) =>
          ext.url ===
          "http://example.org/fhir/StructureDefinition/department-name"
      )?.valueString || "Unknown";

    return {
      name: departmentName,
      value: resource.valueQuantity?.value ?? 0,
    };
  });
}

function formatStatName(key: string): string {
  switch (key) {
    case "todaysAppointments":
      return "Today's Appointments";
    case "upcomingAppointments":
      return "Upcoming Appointments";
    case "completedAppointments":
      return "Completed Appointments";
    case "newAppointments":
      return "New Appointments";
    default:
      return key;
  }
}
