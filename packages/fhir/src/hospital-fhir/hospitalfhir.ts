import { DataItem, FHIRBundleGraph,FHIRtoJSONSpeacilityStats,FHIRBundleGraphForSpecialitywiseAppointments } from "@yosemite-crew/types";

export function getLastDayOfMonth(month: number): number {
    const currentYear = new Date().getFullYear();
    return new Date(currentYear, month, 0).getDate(); // Get last day of given month
  }
  
 export function convertGraphDataToFHIR(graphData: any[]) {
    return {
      resourceType: "Bundle",
      type: "collection",
      entry: graphData.map((data) => {
        const lastDay = getLastDayOfMonth(data.month);
        const monthPadded = String(data.month).padStart(2, "0");
  
        return {
          resource: {
            resourceType: "MeasureReport",
            id: `appointments-${data.month}`,
            status: "complete",
            type: "summary",
            period: {
              start: `2025-${monthPadded}-01`,
              end: `2025-${monthPadded}-${lastDay}`,
            },
            measure: "AppointmentMetrics",
            extension: [
              {
                url: "http://example.org/fhir/StructureDefinition/month-name",
                valueString: data.monthName,
              },
            ],
            group: [
              {
                code: { text: "Total Appointments" },
                population: [{ count: data.totalAppointments }],
              },
              {
                code: { text: "Successful Appointments" },
                population: [{ count: data.successful }],
              },
              {
                code: { text: "Canceled Appointments" },
                population: [{ count: data.canceled }],
              },
            ],
          },
        };
      }),
    };
  }
  
  export function convertFHIRToGraphData(fhirBundle: FHIRBundleGraph): DataItem[] {
    if (!fhirBundle || !Array.isArray(fhirBundle.entry)) return [];
  
    return fhirBundle.entry.map((entry) => {
      const resource = entry.resource;
  
      const monthname =
        resource.extension?.find(
          (ext) => ext.url === "http://example.org/fhir/StructureDefinition/month-name"
        )?.valueString || "";
  
      const getCount = (label: string): number =>
        resource.group?.find((g) => g.code.text === label)?.population[0]?.count ?? 0;
  
      return {
        monthname,
        completed: getCount("Successful Appointments"),
        cancelled: getCount("Canceled Appointments"),
      };
    });
  }
  export function convertSpecialityWiseAppointmentsToFHIR(data: FHIRtoJSONSpeacilityStats[]): FHIRBundleGraphForSpecialitywiseAppointments {
    return {
      resourceType: "Bundle",
      type: "collection",
      entry: data.map((item:any) => ({
        resource: {
          resourceType: "Observation",
          id: item._id,
          status: "final",
          code: {
            text: "Department Appointment Count",
          },
          valueQuantity: {
            value: item.count,
          },
          extension: [
            {
              url: "http://example.org/fhir/StructureDefinition/department-name",
              valueString: item.departmentName,
            },
          ],
        },
      })),
    };
  }
  export function FHIRtoJSONSpeacilityStats(bundle: FHIRBundleGraphForSpecialitywiseAppointments): FHIRtoJSONSpeacilityStats[] {
    if (!bundle || !Array.isArray(bundle.entry)) return [];
  
    return bundle.entry.map((entry:any) => {
      const resource = entry.resource;
      const departmentName = resource.extension?.find(
        (ext:any) => ext.url === "http://example.org/fhir/StructureDefinition/department-name"
      )?.valueString || "Unknown";
  
      return {
        name: departmentName,
        value: resource.valueQuantity?.value ?? 0,
      };
    });
  }
  export function convertAppointmentStatsToFHIR(stats: {
    todaysAppointments: number;
    upcomingAppointments: number;
    completedAppointments: number;
    newAppointments: number;
  }) {
    const entries = Object.entries(stats).map(([key, value]) => ({
      resource: {
        resourceType: "Observation",
        id: key,
        code: {
          text: formatStatName(key),
        },
        valueInteger: value,
      },
    }));
  
    return {
      resourceType: "Bundle",
      type: "collection",
      entry: entries,
    };
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
  // convertAppointmentStatsFromFHIR.ts
export function convertAppointmentStatsFromFHIR(fhirBundle: any): {
  todaysAppointments: number;
  upcomingAppointments: number;
  completedAppointments: number;
  newAppointments: number;
} {
  const result: Record<string, number> = {};

  for (const entry of fhirBundle.entry || []) {
    const resource = entry.resource;
    if (resource.resourceType === "Observation" && resource.id && typeof resource.valueInteger === "number") {
      result[resource.id] = resource.valueInteger;
    }
  }

  return {
    todaysAppointments: result.todaysAppointments || 0,
    upcomingAppointments: result.upcomingAppointments || 0,
    completedAppointments: result.completedAppointments || 0,
    newAppointments: result.newAppointments || 0,
  };
}
