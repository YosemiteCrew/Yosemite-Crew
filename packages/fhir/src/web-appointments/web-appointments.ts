import {
  AppointmentForTable,
  FHIRAppointmentData,
  MyAppointmentData,
  NormalResponseForTable,
} from "@yosemite-crew/types";

export function fromFHIR(data: FHIRAppointmentData[]): MyAppointmentData[] {
  return data.map((item) => {
    const ext = getExtensionMap(item.extension || []);
    return {
      _id: item.id,
      tokenNumber: ext.tokenNumber || "",
      ownerName: item.participant[1]?.actor?.display || "",
      petName: ext.petName || "",
      pet: ext.pet || "",
      breed: ext.breed || "",
      purposeOfVisit: item.description || "",
      passportNumber:
        ext.passportNumber ||
        item.participant[1]?.actor?.reference?.split("/")[1] ||
        "",
      microChipNumber: ext.microChipNumber || "",
      appointmentType: ext.appointmentType || "",
      appointmentSource: ext.appointmentSource || "",
      slotsId: ext.slotsId || "",
      appointmentStatus: reverseMapStatus(item.status),
      petImage: ext.petImage || null,
      departmentName: ext.departmentName || "",
      veterinarianId:
        item.participant[0]?.actor?.reference?.split("/")[1] || "",
      doctorName: item.participant[0]?.actor?.display || "",
      appointmentDate: ext.appointmentDate || "",
      appointmentTime: ext.appointmentTime || "",
    };
  });
}

function mapStatus(status: string): string {
  const mapping: Record<string, string> = {
    pending: "proposed",
    confirmed: "booked",
    cancelled: "cancelled",
  };
  return mapping[status] || "unknown";
}

function reverseMapStatus(status: string): string {
  const mapping: Record<string, string> = {
    proposed: "pending",
    booked: "confirmed",
    cancelled: "cancelled",
  };
  return mapping[status] || "pending";
}

function getExtensionMap(
  extensions: Array<{ url: string; valueString: string }>
) {
  const map: Record<string, string> = {};
  extensions.forEach((ext) => {
    const key = ext.url.split("/").pop() || "";
    map[key] = ext.valueString;
  });
  return map;
}

export function fhirToNormalForTable(bundle: any): NormalResponseForTable {
  const appointments: AppointmentForTable[] = (bundle.entry || []).map(
    (entry: any) => {
      const resource = entry.resource;
      return {
        _id: resource.id,
        tokenNumber: resource.identifier?.[0]?.value || "",
        petName:
          resource.participant
            .find((p: any) => p.actor.display.startsWith("Pet:"))
            ?.actor.display.split(": ")[1]
            .split(" (")[0] || "",
        ownerName:
          resource.participant
            .find((p: any) => p.actor.display.startsWith("Owner:"))
            ?.actor.display.replace("Owner: ", "") || "",
        slotsId: resource.supportingInformation?.[0]?.display || "",
        pet:
          resource.participant
            .find((p: any) => p.actor.display.startsWith("Pet:"))
            ?.actor.display.split("(")[1]
            ?.split(",")[0] || "",
        breed:
          resource.participant
            .find((p: any) => p.actor.display.startsWith("Pet:"))
            ?.actor.display.split(",")[1]
            ?.replace(")", "")
            .trim() || "",
        petImage:
          resource.extension?.find((e: any) => e.url === "petImage")
            ?.valueString || "",
        departmentName: resource.serviceType?.[0]?.text || "",
        purposeOfVisit: resource.description || "",
        appointmentType:
          resource.extension?.find((e: any) => e.url === "appointmentType")
            ?.valueString || "",
        appointmentDate: resource.start.split("T")[0],
        appointmentTime: resource.start.split("T")[1],
        appointmentStatus: resource.status,
        doctorName: resource.participant
          .find((p: any) => p.actor.display.startsWith("Doctor:"))
          ?.actor.display.replace("Doctor: ", ""),
      };
    }
  );

  const paginationExt =
    bundle.extension?.find(
      (e: any) => e.url === "http://example.org/pagination"
    )?.extension || [];

  return {
    message: "Data fetched successfully",
    totalAppointments: bundle.total || 0,
    Appointments: appointments,
    pagination: {
      offset:
        paginationExt.find((e: any) => e.url === "offset")?.valueInteger || 0,
      limit:
        paginationExt.find((e: any) => e.url === "limit")?.valueInteger || 0,
      hasMore:
        paginationExt.find((e: any) => e.url === "hasMore")?.valueBoolean ||
        false,
    },
  };
}
