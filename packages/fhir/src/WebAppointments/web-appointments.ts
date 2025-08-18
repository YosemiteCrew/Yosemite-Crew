import { FHIRAppointmentBooking, FHIRAppointmentData, FHIRDoctorOption, FHIREmergencyAppointment, FHIREmergencyAppointmentForTable, FhirPetResource, FHIRPractitioner, ForBookingFHIRSlot, ForBookingTimeSlot, MyAppointmentData, NormalAppointmentData, NormalDoctor, NormalDoctorOption, NormalEmergencyAppointment, NormalEmergencyAppointmentForTable, NormalPetData, TimeSlotFHIRBundle } from "@yosemite-crew/types";

export function convertPetDataToFhir(input: NormalPetData | NormalPetData[]): FhirPetResource[] {
  const pets = Array.isArray(input) ? input : [input];

  return pets.map((pet) => ({
    resourceType: "Patient",
    id: pet.petId,
    name: [
      { text: pet.petName },
      ...(pet.petParentName ? [{ text: pet.petParentName }] : []),
    ],
    photo: [{ url: pet.petImage }],
    extension: [
      {
        url: "https://example.org/fhir/StructureDefinition/pet-parent-id",
        valueString: pet.petParentId,
      },
      ...(pet.passportNumber ? [{
        url: "https://example.org/fhir/StructureDefinition/pet-passport-number",
        valueString: pet.passportNumber
      }] : []),
      ...(pet.microChipNumber ? [{
        url: "https://example.org/fhir/StructureDefinition/pet-microchip-number",
        valueString: pet.microChipNumber
      }] : []),
    ],
  }));
}

export function convertFhirToNormalPetData(
  input: FhirPetResource | FhirPetResource[]
): NormalPetData[] {
  const resources = Array.isArray(input) ? input : [input];

  return resources.map((res) => {
    // Extract pet parent name from the second name entry if it exists
    const petParentName = res.name.length > 1 ? res.name[1]?.text : "";
    
    return {
      petId: res.id,
      petName: res.name[0]?.text || "",
      petImage: res.photo[0]?.url || "",
      petParentId: res.extension.find(
        ext => ext.url === "https://example.org/fhir/StructureDefinition/pet-parent-id"
      )?.valueString || "",
      petParentName: petParentName,
      passportNumber: res.extension.find(
        ext => ext.url === "https://example.org/fhir/StructureDefinition/pet-passport-number"
      )?.valueString || "",
      microChipNumber: res.extension.find(
        ext => ext.url === "https://example.org/fhir/StructureDefinition/pet-microchip-number"
      )?.valueString || ""
    };
  });
}




/** ✅ Convert Normal to FHIR format */
export const convertToFHIRDoctorOptions = (
  normalList: NormalDoctorOption[]
): FHIRDoctorOption[] => {
  return normalList.map((doc) => ({
    resourceType: 'Practitioner',
    id: doc.value,
    name: {
      text: doc.label,
    },
  }));
};

/** ✅ Convert FHIR back to Normal format */
export const convertFromFHIRDoctorOptions = (
  fhirList: FHIRDoctorOption[]
): NormalDoctorOption[] => {
  return fhirList.map((fhir) => ({
    value: fhir.id,
    label: fhir.name?.text ?? '',
  }));
};




//<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< for booking get timeslots>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

// Normal → FHIR
export function convertTimeSlotsToFHIR(timeSlots: ForBookingTimeSlot[]): TimeSlotFHIRBundle {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: timeSlots.map((slot) => ({
      resource: {
        resourceType: "Slot",
        id: slot._id,
        start: slot.time, // keeping time as string, you can make it full ISO datetime
        status: slot.selected ? "busy" : "free",
      } as ForBookingFHIRSlot,
    })),
  };
}

// FHIR → Normal
export function convertFHIRToTimeSlots(bundle: TimeSlotFHIRBundle): ForBookingTimeSlot[] {
  if (!bundle.entry) return [];
  return bundle.entry.map((entry) => ({
    _id: entry.resource.id,
    time: entry.resource.start,
    selected: entry.resource.status === "busy",
  }));
}




// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< for booking appiontment response >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

export function convertAppointmentToFHIR(data: NormalAppointmentData): FHIRAppointmentBooking {
  return {
    resourceType: "Appointment",
    id: data.slotsId,
    status: "booked",
    serviceType: [
      {
        coding: [
          {
            system: "http://example.com/appointment-type",
            code: data.appointmentType,
            display: data.purposeOfVisit,
          },
        ],
      },
    ],
    start: data.appointmentDate,
    extension: [
      { url: "http://example.com/appointmentTime", valueString: data.appointmentTime },
      { url: "http://example.com/passportNumber", valueString: data.passportNumber },
      { url: "http://example.com/microChipNumber", valueString: data.microChipNumber },
      { url: "http://example.com/day", valueString: data.day },
      { url: "http://example.com/department", valueString: data.department },
    ],
    participant: [
      {
        actor: {
          reference: `Practitioner/${data.veterinarian}`,
          display: data.ownerName, // Vet name
        },
        status: "accepted",
      },
      {
        actor: {
          reference: `RelatedPerson/${data.ownerId}`, // FHIR-supported owner link
          display: data.ownerName,
        },
        status: "accepted",
      },
      {
        actor: {
          reference: `Patient/${data.petId}`, // FHIR-supported pet link
          display: data.petName,
        },
        status: "accepted",
      },
    ],
  };
}

export function convertFHIRToAppointment(fhir: FHIRAppointmentBooking): NormalAppointmentData {
  const getExt = (url: string) =>
    fhir.extension.find((e) => e.url === url)?.valueString || "";

  return {
    petName: fhir.participant.find(p => p.actor.reference?.startsWith("Patient/"))?.actor.display || "",
    ownerName: fhir.participant.find(p => p.actor.reference?.startsWith("RelatedPerson/"))?.actor.display || "",
    passportNumber: getExt("http://example.com/passportNumber"),
    microChipNumber: getExt("http://example.com/microChipNumber"),
    purposeOfVisit: fhir.serviceType[0]?.coding[0]?.display || "",
    appointmentDate: fhir.start,
    appointmentTime: getExt("http://example.com/appointmentTime"),
    appointmentType: fhir.serviceType[0]?.coding[0]?.code || "",
    day: getExt("http://example.com/day"),
    department: getExt("http://example.com/department"),
    slotsId: fhir.id,
    veterinarian: fhir.participant.find(p => p.actor.reference?.startsWith("Practitioner/"))?.actor.reference?.split("/")[1] || "",
    ownerId: fhir.participant.find(p => p.actor.reference?.startsWith("RelatedPerson/"))?.actor.reference?.split("/")[1] || "",
    petId: fhir.participant.find(p => p.actor.reference?.startsWith("Patient/"))?.actor.reference?.split("/")[1] || "",
  };
}


//<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<To Get 
export function toFHIR(data: MyAppointmentData[]): FHIRAppointmentData[] {
  return data.map((item) => ({
    resourceType: "Appointment",
    id: item._id,
    status: mapStatus(item.appointmentStatus),
    description: item.purposeOfVisit,
    participant: [
      {
        actor: {
          reference: `Practitioner/${item.veterinarianId}`,
          display: item.doctorName,
        },
        status: "accepted",
      },
      {
        actor: {
          reference: `Patient/${item.passportNumber}`,
          display: item.ownerName,
        },
        status: "accepted",
      },
    ],
    extension: [
      { url: "http://example.org/fhir/StructureDefinition/tokenNumber", valueString: item.tokenNumber },
      { url: "http://example.org/fhir/StructureDefinition/petName", valueString: item.petName },
      { url: "http://example.org/fhir/StructureDefinition/pet", valueString: item.pet },
      { url: "http://example.org/fhir/StructureDefinition/breed", valueString: item.breed },
      { url: "http://example.org/fhir/StructureDefinition/microChipNumber", valueString: item.microChipNumber },
      { url: "http://example.org/fhir/StructureDefinition/passportNumber", valueString: item.passportNumber },
      { url: "http://example.org/fhir/StructureDefinition/appointmentType", valueString: item.appointmentType },
      { url: "http://example.org/fhir/StructureDefinition/appointmentSource", valueString: item.appointmentSource },
      { url: "http://example.org/fhir/StructureDefinition/departmentName", valueString: item.departmentName },
      { url: "http://example.org/fhir/StructureDefinition/petImage", valueString: item.petImage || "" },
      { url: "http://example.org/fhir/StructureDefinition/appointmentDate", valueString: item.appointmentDate },
      { url: "http://example.org/fhir/StructureDefinition/appointmentTime", valueString: item.appointmentTime },
      { url: "http://example.org/fhir/StructureDefinition/slotsId", valueString: item.slotsId },
    ],
  }));
}

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
      passportNumber: ext.passportNumber || item.participant[1]?.actor?.reference?.split("/")[1] || "",
      microChipNumber: ext.microChipNumber || "",
      appointmentType: ext.appointmentType || "",
      appointmentSource: ext.appointmentSource || "",
      slotsId: ext.slotsId || "",
      appointmentStatus: reverseMapStatus(item.status),
      petImage: ext.petImage || null,
      departmentName: ext.departmentName || "",
      veterinarianId: item.participant[0]?.actor?.reference?.split("/")[1] || "",
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

function getExtensionMap(extensions: Array<{ url: string; valueString: string }>) {
  const map: Record<string, string> = {};
  extensions.forEach((ext) => {
    const key = ext.url.split("/").pop() || "";
    map[key] = ext.valueString;
  });
  return map;
}







//<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< Emegency Section >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

export function convertDoctorsToFHIR(doctors: NormalDoctor[]): FHIRPractitioner[] {
  return doctors.map((doc) => ({
    resourceType: "Practitioner",
    id: doc.cognitoId,
    name: [{ text: doc.fullName }],
    extension: [
      {
        url: "http://example.com/fhir/StructureDefinition/department-id",
        valueString: doc.department
      }
    ]
  }));
}

export function convertDoctorsFromFHIR(fhirDocs: FHIRPractitioner[]): NormalDoctor[] {
  return fhirDocs.map((doc) => ({
    cognitoId: doc.id,
    department: doc.extension?.find(
      (ext) => ext.url === "http://example.com/fhir/StructureDefinition/department-id"
    )?.valueString || "",
    fullName: doc.name?.[0]?.text || ""
  }));
}



export function convertEmergencyAppointmentToFHIR(data: NormalEmergencyAppointment): FHIREmergencyAppointment {
  return {
    resourceType: "Appointment",
    id: data.userId ||"",
    participant: [
      {
        actor: {
          reference: `Practitioner/${data.veterinarian}`,
          display: data.veterinarian, // You can pass vet name here if available
        },
        status: "accepted",
      },
      {
        actor: {
          reference: `Patient/${data.userId}`,
          display: data.ownerName,
        },
        status: "accepted",
      },
    ],
    extension: [
      { url: "http://example.com/fhir/StructureDefinition/department-id", valueString: data.department ||""},
      { url: "http://example.com/fhir/StructureDefinition/email", valueString: data.email ||""},
      { url: "http://example.com/fhir/StructureDefinition/country-code", valueString: data.countryCode ||"" },
      { url: "http://example.com/fhir/StructureDefinition/gender", valueString: data.gender ||""},
      { url: "http://example.com/fhir/StructureDefinition/phone-number", valueString: data.phoneNumber||"" },
      { url: "http://example.com/fhir/StructureDefinition/pet-name", valueString: data.petName ||""},
      { url: "http://example.com/fhir/StructureDefinition/pet-breed", valueString: data.petBreed ||""},
      { url: "http://example.com/fhir/StructureDefinition/pet-type", valueString: data.petType||"" },
    ],
  };
}

export function convertEmergencyAppointmentFromFHIR(fhir: FHIREmergencyAppointment): NormalEmergencyAppointment {
  return {
    userId: fhir.id,
    veterinarian: fhir.participant?.find((p) => p.actor.reference.startsWith("Practitioner/"))?.actor.reference.split("/")[1] || "",
    ownerName: fhir.participant?.find((p) => p.actor.reference.startsWith("Patient/"))?.actor.display || "",
    department: fhir.extension?.find((e) => e.url.endsWith("department-id"))?.valueString || "",
    email: fhir.extension?.find((e) => e.url.endsWith("email"))?.valueString || "",
    countryCode: fhir.extension?.find((e) => e.url.endsWith("country-code"))?.valueString || "",
    gender: fhir.extension?.find((e) => e.url.endsWith("gender"))?.valueString || "",
    phoneNumber: fhir.extension?.find((e) => e.url.endsWith("phone-number"))?.valueString || "",
    petName: fhir.extension?.find((e) => e.url.endsWith("pet-name"))?.valueString || "",
    petBreed: fhir.extension?.find((e) => e.url.endsWith("pet-breed"))?.valueString || "",
    petType: fhir.extension?.find((e) => e.url.endsWith("pet-type"))?.valueString || "",
  };
}





// Convert Normal -> FHIR
export function convertEmergencyAppointmentToFHIRForTable(
  normal: NormalEmergencyAppointmentForTable
): FHIREmergencyAppointmentForTable {
  return {
    resourceType: "Appointment",
    id: normal._id,
    identifier: [
      {
        system: "http://example.org/emergency-appointments",
        value: normal.tokenNumber,
      },
    ],
    status: normal.appointmentStatus, // "pending", "booked", etc.
    description: `${normal.petName} (${normal.petType}) - ${normal.petBreed}`,
    participant: [
      {
        actor: {
          reference: `Practitioner/${normal.veterinarian}`,
          display: normal.veterinarian,
        },
        status: "accepted",
      },
      {
        actor: {
          reference: `Patient/${normal.userId}`,
          display: `${normal.ownerName} (${normal.email})`,
        },
        status: "accepted",
      },
    ],
    supportingInformation: [
      {
        reference: `Organization/${normal.hospitalId}`,
        display: "Hospital",
      },
      {
        reference: `HealthcareService/${normal.departmentName}`,
        display: normal.departmentName,
      },
    ],
    extension: [
      { url: "http://example.org/fhir/StructureDefinition/phoneNumber", valueString: String(normal.phoneNumber) },
      { url: "http://example.org/fhir/StructureDefinition/gender", valueString: normal.gender },
       { url: "http://example.org/fhir/StructureDefinition/appointmentTime", valueString: normal.appointmentTime }, // NEW
    ],
  };
}

// Convert FHIR -> Normal
export function convertEmergencyAppointmentFromFHIRForTable(
  fhir: FHIREmergencyAppointmentForTable
): NormalEmergencyAppointmentForTable {
  return {
    _id: fhir.id,
    userId: fhir.participant.find((p) => p.actor.reference.startsWith("Patient/"))?.actor.reference.replace("Patient/", "") || "",
    hospitalId: fhir.supportingInformation?.find((s) => s.reference.startsWith("Organization/"))?.reference.replace("Organization/", "") || "",
    tokenNumber: fhir.identifier[0]?.value || "",
    ownerName: fhir.participant.find((p) => p.actor.reference.startsWith("Patient/"))?.actor.display.split(" (")[0] || "",
    petName: fhir.description?.split(" (")[0] || "",
    appointmentStatus: fhir.status,
    petType: fhir.description?.split("(")[1]?.split(")")[0] || "",
    petBreed: fhir.description?.split("- ")[1] || "",
    gender: fhir.extension?.find((e) => e.url.includes("gender"))?.valueString || "",
    phoneNumber: Number(fhir.extension?.find((e) => e.url.includes("phoneNumber"))?.valueString) || 0,
   email:
  fhir.participant.find((p) =>
    p.actor.reference.startsWith("Patient/")
  )?.actor.display.split("(")[1]?.split(")")[0] || "",

    veterinarian: fhir.participant.find((p) => p.actor.reference.startsWith("Practitioner/"))?.actor.display || "",
    departmentName: fhir.supportingInformation?.find((s) => s.reference.startsWith("HealthcareService/"))?.display || "",
    appointmentTime:
      fhir.extension?.find((e) => e.url.includes("appointmentTime"))
        ?.valueString || "",
  };
}
