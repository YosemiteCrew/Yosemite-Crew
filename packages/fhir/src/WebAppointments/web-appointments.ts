import { FHIRAppointmentBooking, FHIRDoctorOption, FhirPetResource, ForBookingFHIRSlot, ForBookingTimeSlot, NormalAppointmentData, NormalDoctorOption, NormalPetData, TimeSlotFHIRBundle } from "@yosemite-crew/types";

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
    start: data.appointmentDate, // no modification
    extension: [
      { url: "http://example.com/appointmentTime", valueString: data.appointmentTime }, // no modification
      { url: "http://example.com/passportNumber", valueString: data.passportNumber },
      { url: "http://example.com/microChipNumber", valueString: data.microChipNumber },
      { url: "http://example.com/day", valueString: data.day },
      { url: "http://example.com/department", valueString: data.department },
    ],
    participant: [
      {
        actor: {
          reference: `Practitioner/${data.veterinarian}`,
          display: data.ownerName,
        },
        status: "accepted",
      },
      {
        actor: {
          reference: `Patient/${data.petName}`,
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
    petName: fhir.participant[1]?.actor.display || "",
    ownerName: fhir.participant[0]?.actor.display || "",
    passportNumber: getExt("http://example.com/passportNumber"),
    microChipNumber: getExt("http://example.com/microChipNumber"),
    purposeOfVisit: fhir.serviceType[0]?.coding[0]?.display || "",
    appointmentDate: fhir.start, // no modification
    appointmentTime: getExt("http://example.com/appointmentTime"), // no modification
    appointmentType: fhir.serviceType[0]?.coding[0]?.code || "",
    day: getExt("http://example.com/day"),
    department: getExt("http://example.com/department"),
    slotsId: fhir.id,
    veterinarian: fhir.participant[0]?.actor.reference?.split("/")[1] || "",
  };
}