import { AppointmentInput, AppointmentStatus, FHIRAppointment, FHIRAppointmentBundleParams, IFHIRAppointmentData, SimplifiedAppointment, WebAppointmentType, } from "@yosemite-crew/types";

export function parseAppointment(fhirData: IFHIRAppointmentData): Partial<WebAppointmentType> | null {

  try {
    if (!fhirData || fhirData.resourceType !== "Appointment") {
      return null;
    }
    const startDateObj = new Date(fhirData.start);

    const appointmentDate: number | string | null = fhirData.start || "";
    const purposeOfVisit = fhirData.description || "";

    const concernOfVisit = fhirData.reasonCode[0]?.text || "";

    // Extract slotId from extensions
    const slotsId =
      fhirData.extension?.find(
        (ext: any) =>
          ext.url ===
          "http://example.org/fhir/StructureDefinition/slotsId"
      )?.valueString || "";

    // Extract patientId, doctorId, and hospitalId from participants
    let petId = "";
    let doctorId = "";
    let hospitalId = "";

    (fhirData.participant || []).forEach((p: any) => {
      const ref = p.actor?.reference || "";
      if (ref.startsWith("Patient/")) {
        petId = ref.replace("Patient/", "");
      } else if (ref.startsWith("Practitioner/")) {
        doctorId = ref.replace("Practitioner/", "");
      } else if (ref.startsWith("Location/")) {
        hospitalId = ref.replace("Location/", "");
      }
    });

    // Extract department info from serviceType
    const department =
      fhirData.serviceType?.[0]?.coding?.[0]?.code ||
      "";


    // Optional: derive timeslot from appointment start
    let timeslot = "";
    // if (appointmentDate) {
    //   const dateObj = new Date(appointmentDate);
    //   timeslot = dateObj.toTimeString().split(" ")[0]; // HH:MM:SS
    // }
    if (startDateObj) {
      const dateObj = new Date(startDateObj);
      timeslot = dateObj.toTimeString().split(" ")[0]; // HH:MM:SS
    }
    return {
      appointmentDate: appointmentDate as string,
      purposeOfVisit,
      hospitalId,
      department,
      petId,
      slotsId,
      veterinarian: doctorId,
      appointmentTime: timeslot
    };
  } catch (err) {
    console.error("Error parsing FHIR Appointment:", err);
    return null;
  }
}

export function convertAppointmentsToFHIRBundle({
  status = "Calendar",
  appointments,
  totalCount,
}: FHIRAppointmentBundleParams) {
  const fhirAppointments = appointments.map((appt: any) =>
    convertToFHIRMyCalender(appt)
  );

  return {
    resourceType: "Bundle",
    type: "collection",
    total: totalCount,
    meta: {
      profile: ["http://hl7.org/fhir/StructureDefinition/Appointment"],
    },
    entry: fhirAppointments,
  };
}

export function formatDateTime(date: string | Date, time?: string): string {
  const isoDate = new Date(date).toISOString().split("T")[0];
  return time ? `${isoDate}T${time}` : `${isoDate}`;
}

export function mapStatus(status: AppointmentStatus): string {
  const mapping: Record<string, string> = {
    confirmed: "booked",
    cancelled: "cancelled",
    completed: "fulfilled",
    pending: "proposed",
  };
  return mapping[status as unknown as string] || "booked";
}

export function convertFHIRToPlainJSON(fhirBundle: any): SimplifiedAppointment[] {
  if (!fhirBundle || !Array.isArray(fhirBundle.entry)) return [];

  return fhirBundle.entry.map((entry: any) => {
    const resource = entry.resource;

    const petName = resource.description?.replace("Appointment for ", "") || "Unknown";
    const veterinarian = resource.participant?.[0]?.actor?.display || "Unknown Veterinarian";
    const ownerName = resource.participant?.[1]?.actor?.display || "Unknown Owner";
    const department = resource.specialty?.[0]?.text || "General";

    return {
      id: resource.id,
      petName,
      veterinarian,
      ownerName,
      department,
      dateTime: resource.start,
      status: resource.status,
    };
  });
}

export function convertToFHIRMyCalender(fhirAppointments: FHIRAppointment[]): AppointmentInput[] {
  return fhirAppointments.map((appt: FHIRAppointment) => {
    const dateObj = new Date(appt.start);

    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12; // convert 0 to 12
    const paddedMinutes = minutes.toString().padStart(2, '0');

    const appointmentTime = `${hour12}:${paddedMinutes} ${ampm}`;
    const appointmentDate = dateObj.toISOString().split('T')[0]; // only YYYY-MM-DD

    const ownerParticipant = appt.participant.find(p => p.actor?.display?.startsWith("Owner:"));
    const petParticipant = appt.participant.find(p => p.actor?.display?.startsWith("Pet:"));
    const vetParticipant = appt.participant.find(p => p.actor?.display?.startsWith("Veterinarian:"));

    const hospitalExt = appt.extension?.find(ext => ext.url.includes("hospitalId"));

    return {
      _id: appt.id,
      appointmentDate,
      appointmentTime,
      appointmentStatus: appt.status,
      department: appt.serviceType?.[0]?.text || '',
      ownerName: ownerParticipant?.actor?.display?.replace("Owner: ", "") || '',
      petName: petParticipant?.actor?.display?.replace("Pet: ", "") || '',
      veterinarian: vetParticipant?.actor?.display?.replace("Veterinarian: ", "") || '',
      hospitalId: hospitalExt?.valueString || '',
    };
  });
}

export function convertFromFHIRAppointments(fhirData: FHIRAppointment[]): AppointmentInput[] {
  return fhirData.map((fhir) => {
    const dateObj = new Date(fhir.start);

    // Extract time in "HH:MM AM/PM" format
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    const formattedTime = `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;

    // Extract participants
    let ownerName = "";
    let petName = "";
    let veterinarian: string | null = null;

    fhir.participant.forEach((p) => {
      const name = p.actor.display;
      if (name.startsWith("Owner: ")) {
        ownerName = name.replace("Owner: ", "");
      } else if (name.startsWith("Pet: ")) {
        petName = name.replace("Pet: ", "");
      } else if (name.startsWith("Veterinarian: ")) {
        veterinarian = name.replace("Veterinarian: ", "");
      }
    });

    const hospitalExtension = fhir.extension?.find(
      (ext) => ext.url === "http://example.org/fhir/StructureDefinition/hospitalId"
    );

    return {
      _id: fhir.id,
      ownerName,
      petName,
      appointmentTime: formattedTime,
      hospitalId: hospitalExtension?.valueString || "",
      appointmentStatus: fhir.status,
      appointmentDate: new Date(dateObj.setHours(0, 0, 0, 0)).toISOString(),
      department: fhir.serviceType[0]?.text || "",
      veterinarian,
    };
  });
}